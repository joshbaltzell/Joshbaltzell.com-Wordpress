/* Josh Baltzell: the stack.
   Upgrades a plain list of article blocks (.rack > .shaft > .well > ol.pile > li > a.blk) into a pile that is
   dropped into its well with real physics, and lets a few special blocks carry their own animation and light.
   Without this script, or without Matter.js, the same markup is a tidy grid and nothing is lost.

   Markup options, all on .rack:
     data-across="mix|2|3"   rows of 2 and 3 (default), 2 across, or 3 across
     data-neat="0..100"      how neatly the blocks land (default 80)
     data-seed="n"           which drop; the same number always lands the same way
     data-min-rows="n"       keep the well at least this many rows tall
   A block becomes special with data-rule="name"; rules live in JBStack.rules.
   A button with data-stack-motion, and an element with data-stack-status, beside the rack are wired if present.

   CHANGED FROM THE DESIGN SYSTEM'S COPY: the pile is also a toy. Once it has landed, a block can be picked up
   with a mouse or pen, moved and thrown, and the others react with live physics. Buttons with data-stack-shake
   and data-stack-tidy beside the rack are wired if present. Every change is marked "play:" below.

   It also shows only part of its list at a time (the "active set"). Everything else sits in the page, hidden,
   and comes and goes through three operations: add (falls in from the top), remove (falls out through the
   floor) and tidy (drop the active set again from scratch). More, the filters, and Pile or shelf are all
   built on those three. Without the script every item shows, as a plain grid. */
(function () {
  'use strict';
  var TAU = Math.PI * 2, STEP = [1, .68, .4], SH = [3, 4];
  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function hex(c) { c = (c || '').trim(); if (c.length === 4) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]; var n = parseInt(c.slice(1), 16); return isNaN(n) ? [128, 128, 128] : [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function lum(c) { var v = hex(c); return v[0] * .2126 + v[1] * .7152 + v[2] * .0722; }
  function rgba(c, a) { var v = hex(c); return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + a.toFixed(3) + ')'; }
  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function world(p, lx, ly, w, h) { var c = Math.cos(p[2]), s = Math.sin(p[2]), x = lx - w / 2, y = ly - h / 2; return [p[0] + x * c - y * s, p[1] + x * s + y * c]; }
  function dist(p, b, wx, wy) { var c = Math.cos(p[2]), s = Math.sin(p[2]), x = wx - p[0], y = wy - p[1], lx = Math.abs(x * c + y * s) - b.w / 2, ly = Math.abs(-x * s + y * c) - b.h / 2; return Math.hypot(Math.max(0, lx), Math.max(0, ly)); }

  /* ---- what a special block may declare ----
     art(g, w, h, t, heat, C)  draws its cover every frame, on a canvas the size of the cover
     light {at, reach, tone}   a point on its cover that shines, how far in units, 'warm' or 'dark'
     pull                      how many pixels it may drag its neighbours toward itself
     stars                     things that orbit the block, by orbit size in units                       */
  var RULES = {
    sun: { art: sunArt, light: { at: [.3, .55], reach: 2.3, tone: 'warm' } },
    hole: { art: holeArt, light: { at: [.5, .5], reach: 1.9, tone: 'dark' }, pull: 5, stars: [1.0, 1.28, 1.6] }
  };
  function sunArt(g, w, h, t, heat, C) {
    g.fillStyle = C['ground-raised']; g.fillRect(0, 0, w, h);
    var cx = w * .3, cy = h * .55, r = h * .23, n = 12, len = r * (.55 + .1 * Math.sin(t * 1.7) + .5 * heat), rot = t * .22, i, a;
    g.lineWidth = 2; g.strokeStyle = C.ink; g.lineJoin = 'round'; g.fillStyle = C['part-straw'];
    for (i = 0; i < n; i++) { a = rot + i * TAU / n; var r0 = r + 3, r1 = r0 + len * (i % 2 ? .6 : 1); g.beginPath(); g.moveTo(cx + Math.cos(a - .16) * r0, cy + Math.sin(a - .16) * r0); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.lineTo(cx + Math.cos(a + .16) * r0, cy + Math.sin(a + .16) * r0); g.closePath(); g.fill(); g.stroke(); }
    g.fillStyle = C['part-ember']; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill(); g.stroke();
    var x0 = w * .5, rise = h * .7, run = rise * .78, top = h - rise + 2;
    g.fillStyle = C['part-moss']; g.beginPath(); g.moveTo(x0, h + 3); g.lineTo(x0 + run, top); g.lineTo(w + 3, top); g.lineTo(w + 3, h + 3); g.closePath(); g.fill(); g.stroke();
    var px0 = x0 + run * .62 + 6, py0 = h - rise * .2, px1 = x0 + run * 1.06 + 6, py1 = top + rise * .16, pw = Math.max(40, w - px1 - 18);
    function panel() { g.beginPath(); g.moveTo(px0, py0); g.lineTo(px1, py1); g.lineTo(px1 + pw, py1); g.lineTo(px0 + pw, py0); g.closePath(); }
    panel(); g.fillStyle = C['part-slate']; g.fill();
    g.save(); g.clip(); var gx = px0 - 30 + ((t * 46) % (pw + 160)); g.fillStyle = C['part-straw']; g.globalAlpha = .55 + .35 * heat;
    g.beginPath(); g.moveTo(gx, py0); g.lineTo(gx + (px1 - px0), py1); g.lineTo(gx + (px1 - px0) + 16, py1); g.lineTo(gx + 16, py0); g.closePath(); g.fill(); g.restore(); g.globalAlpha = 1;
    panel(); g.stroke();
    for (i = 1; i < 3; i++) { g.beginPath(); g.moveTo(px0 + pw * i / 3, py0); g.lineTo(px1 + pw * i / 3, py1); g.stroke(); }
  }
  function holeArt(g, w, h, t, heat, C) {
    g.fillStyle = C['part-night']; g.fillRect(0, 0, w, h);
    var i, cx = w / 2, cy = h * .5, r = h * .25, rx = h * .78, ry = h * .2, R = rng(42);
    g.fillStyle = C['on-night']; for (i = 0; i < 18; i++) { var sx = R() * w, sy = R() * h, sr = .7 + R() * .9; if (Math.abs(sx - cx) < rx * 1.05 && Math.abs(sy - cy) < r * 1.2) continue; g.globalAlpha = .45 + .4 * R(); g.beginPath(); g.arc(sx, sy, sr, 0, TAU); g.fill(); }
    g.globalAlpha = 1; g.save(); g.translate(cx, cy); g.rotate(-.2);
    function ring(a0, a1) { g.beginPath(); g.ellipse(0, 0, rx, ry, 0, a0, a1); g.strokeStyle = C['part-ember']; g.lineWidth = 5; g.stroke(); g.beginPath(); g.ellipse(0, 0, rx * .8, ry * .72, 0, a0, a1); g.strokeStyle = C['part-straw']; g.lineWidth = 1.5; g.stroke(); }
    function blobs(front) { for (var k = 0; k < 2; k++) { var th = t * (1.5 + .9 * heat) * (k ? .7 : 1) + k * 2.6; if ((Math.sin(th) > 0) !== front) continue; var q = k ? 1.22 : 1; g.beginPath(); g.arc(rx * q * Math.cos(th), ry * q * Math.sin(th), 3.2, 0, TAU); g.fillStyle = C['on-night']; g.fill(); } }
    ring(Math.PI, TAU); blobs(false);
    g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fillStyle = '#000'; g.globalAlpha = .55; g.fill(); g.globalAlpha = 1; g.strokeStyle = C['on-night']; g.lineWidth = 1.5; g.stroke();
    ring(0, Math.PI); blobs(true); g.restore();
  }

  function JBStack(rack, opts) {
    opts = opts || {};
    var well = rack.querySelector('.well'), pile = rack.querySelector('.pile');
    if (!well || !pile) return null;
    var blks = [].slice.call(pile.querySelectorAll('.blk')), N = blks.length, M = window.Matter;
    if (!N) return null;
    var scope = rack.parentNode || document, status = scope.querySelector('[data-stack-status]'), mo = scope.querySelector('[data-stack-motion]'), shakeBtn = scope.querySelector('[data-stack-shake]'), tidyBtn = scope.querySelector('[data-stack-tidy]');
    var moreBtn = (scope.parentNode || document).querySelector('[data-stack-more]'), views = scope.querySelector('[data-stack-views]'), chips = [].slice.call(document.querySelectorAll('[data-stack-filter]'));
    var items = blks.map(function (b) { return b.parentNode; });
    var tags = blks.map(function (b) { return (' ' + (b.getAttribute('data-tags') || '') + ' '); });
    var phone = window.matchMedia && matchMedia('(max-width: 599.98px)').matches;
    var batch = Math.max(1, +(rack.getAttribute(phone ? 'data-batch-phone' : 'data-batch') || N));
    /* play: the active set. limit is how many matching items show; tag is the current filter ('' for all) */
    var active = [], falling = [], limit = batch, tag = '', shelf = false;
    var mq = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
    var S = { mode: rack.getAttribute('data-across') || 'mix', neat: +(rack.getAttribute('data-neat') || 80), seed: +(rack.getAttribute('data-seed') || 5), minRows: +(rack.getAttribute('data-min-rows') || 0), motion: !mq.matches };
    var GAP = 14, HEAD = 64;
    /* feel: how each block was moving last frame, how squashed it is, dust in the air, and how far the well is knocked */
    var prevY = [], vy = [], squash = [], dust = [], kickY = 0, shaftEl = rack.querySelector('.shaft');
    /* the launch pad sits in the top band of the well, so that band is taller when there is one */
    var padEl = well.querySelector('.well__pad'), padHot = -1, launching = false;
    if (padEl) HEAD = 128;
    /* the machine: an optional lever for More and a handle that tilts the well */
    var machine = rack.querySelector('.rack__machine'), lever = rack.querySelector('[data-lever]'), tiltEl = rack.querySelector('[data-tilt]'), tilt = 0;
    var W = 0, H = 0, U = 0, L = [], sim = null, fin = [], endAt = 0, phase = 'rest', t0 = 0, litAt = -1e9, clock = 0, last = 0, raf = 0, seen = false, armed = true, dpr = 1, queued = 0;
    var pose = [], lift = [], want = [], cov = [], face = [], shadow = [], own = [], C = {}, specials = [], allSpecials = specials;

    /* ---- sound ----
       Nothing makes a sound until you have touched the pile or one of its controls: the first drop is always
       silent. After that, a block landing gives a short, soft wooden knock, quieter for small bumps, lower for
       big blocks, and never more than a few at once. A Sound button turns it off, and that choice is kept. */
    var soundBtn = scope.querySelector('[data-stack-sound]'), audio = null, touched = false, lastKnock = 0, soundOn = true;
    try { soundOn = localStorage.getItem('jb-sound') !== 'off'; } catch (e) {}
    function arm() {
      if (touched) return; touched = true;
      var A = window.AudioContext || window.webkitAudioContext;
      if (A && soundOn) { try { audio = new A(); } catch (e) { audio = null; } }
    }
    function tone(fn) {
      if (!touched || !soundOn) return;
      if (!audio) { var A = window.AudioContext || window.webkitAudioContext; if (!A) return; try { audio = new A(); } catch (e) { return; } }
      if (audio.state === 'suspended') audio.resume();
      try { fn(audio, audio.currentTime); } catch (e) {}
    }
    var noiseBuf = null;
    function noise(a) {
      if (noiseBuf) return noiseBuf;
      noiseBuf = a.createBuffer(1, Math.round(a.sampleRate * .08), a.sampleRate);
      var d = noiseBuf.getChannelData(0); for (var k = 0; k < d.length; k++) d[k] = (Math.random() * 2 - 1) * (1 - k / d.length);
      return noiseBuf;
    }
    function knock(size, strength) {
      var now = performance.now(); if (now - lastKnock < 45) return; lastKnock = now;
      tone(function (a, t) {
        var vol = Math.min(.05, .008 + .04 * strength), out = a.createGain(); out.gain.value = vol; out.connect(a.destination);
        var src = a.createBufferSource(), bp = a.createBiquadFilter(), env = a.createGain();
        src.buffer = noise(a); bp.type = 'bandpass'; bp.frequency.value = 1300 - size * 140 + Math.random() * 120; bp.Q.value = 4;
        env.gain.setValueAtTime(1, t); env.gain.exponentialRampToValueAtTime(.001, t + .07);
        src.connect(bp); bp.connect(env); env.connect(out); src.start(t); src.stop(t + .08);
        var o = a.createOscillator(), og2 = a.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(210 - size * 18, t); o.frequency.exponentialRampToValueAtTime(90, t + .06);
        og2.gain.setValueAtTime(.6, t); og2.gain.exponentialRampToValueAtTime(.001, t + .07); o.connect(og2); og2.connect(out); o.start(t); o.stop(t + .08);
      });
    }
    function clack() { tone(function (a, t) { var o = a.createOscillator(), g = a.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(260, t + .05); g.gain.setValueAtTime(.025, t); g.gain.exponentialRampToValueAtTime(.001, t + .07); o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + .08); }); }
    function chime() { tone(function (a, t) { [523, 784].forEach(function (f, k) { var o = a.createOscillator(), g = a.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(.0001, t + k * .09); g.gain.exponentialRampToValueAtTime(.03, t + k * .09 + .01); g.gain.exponentialRampToValueAtTime(.001, t + k * .09 + .25); o.connect(g); g.connect(a.destination); o.start(t + k * .09); o.stop(t + k * .09 + .26); }); }); }
    function syncSound() { if (soundBtn) { soundBtn.hidden = false; soundBtn.setAttribute('aria-pressed', String(soundOn)); soundBtn.textContent = soundOn ? 'Sound on' : 'Sound off'; } }
    if (soundBtn) soundBtn.addEventListener('click', function () { soundOn = !soundOn; try { localStorage.setItem('jb-sound', soundOn ? 'on' : 'off'); } catch (e) {} if (soundOn) { arm(); clack(); } syncSound(); });
    /* touching the pile, or any of its controls, is what lets it make sound */
    rack.addEventListener('pointerdown', arm, true);
    if (scope.addEventListener) scope.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('.rack__bar button, [data-stack-more], .rack__machine')) arm(); }, true);
    chips.forEach(function (c) { c.addEventListener('click', arm, true); });
    var moreWrap = moreBtn && moreBtn.parentNode; if (moreWrap) moreWrap.addEventListener('click', arm, true);

    function mk(tag, cls, parent, first) { var e = document.createElement(tag); e.className = cls; e.setAttribute('aria-hidden', 'true'); if (first) parent.insertBefore(e, parent.firstChild); else parent.appendChild(e); return e; }
    var under = mk('canvas', 'well__fx well__fx--under', well, true), over = mk('canvas', 'well__fx well__fx--over', well, false), ug = under.getContext('2d'), og = over.getContext('2d');
    var lits = { l: null, r: null, f: null };
    [['l', '.rail--l'], ['r', '.rail--r'], ['f', '.floor']].forEach(function (x) { var host = rack.querySelector(x[1]); if (host) lits[x[0]] = host.querySelector('i') || mk('i', '', host, false); });

    blks.forEach(function (b, i) {
      lift[i] = want[i] = 0;
      var r = JBStack.rules[b.getAttribute('data-rule')];
      if (!r) return;
      var c = b.querySelector('.cov'), cv = c && (c.querySelector('canvas') || mk('canvas', 'cov__art', c, false));
      own[i] = !!cv;
      if (cv) specials.push({ i: i, rule: r, cv: cv, g: cv.getContext('2d'), heat: 0, ph: [0, 2.1, 4.4] });
    });

    function colors() {
      var cs = getComputedStyle(rack);
      ['ground', 'ground-raised', 'ground-sunk', 'ink', 'line', 'part-ember', 'part-olive', 'part-moss', 'part-straw', 'part-slate', 'part-night', 'on-night'].forEach(function (k) { C[k] = cs.getPropertyValue('--' + k).trim() || '#888888'; });
      C.dark = lum(C.ink) < lum(C['ground-sunk']) ? C.ink : C['ground-sunk'];
      C.isDark = lum(C.ground) < lum(C.ink);
      blks.forEach(function (b, i) { face[i] = getComputedStyle(b).getPropertyValue('--c').trim().toLowerCase(); });
    }

    /* ---- the drop: worked out in full before anything moves, then played back ---- */
    function layout(mode) {
      /* rows from the floor up; the oldest article (last in the list) lands first */
      var pat = mode === '2' ? [[3, 3]] : mode === '3' ? [[2, 2, 2]] : mode === '1' ? [[6]] : [[2, 2, 2], [3, 3]];
      var ids = [], out = [], r = 0, k;
      for (k = 0; k < N; k++) { out[k] = null; if (active[k]) ids.push(k); }
      var left = ids.length, p = ids.length - 1;
      while (left > 0) {
        var row = pat[r % pat.length].slice(0, Math.min(left, pat[r % pat.length].length)), x = 0, idx = [];
        for (k = 0; k < row.length; k++) idx.push(ids[p - k]);
        idx.reverse();
        for (k = 0; k < row.length; k++) { out[idx[k]] = { units: row[k], w: row[k] * U - GAP, x: x + row[k] * U / 2, row: r, col: k, h: 0 }; x += row[k] * U; }
        p -= row.length; left -= row.length; r++;
      }
      return out;
    }
    function still() {
      var rows = [], base = [], y = H;
      L.forEach(function (b) { if (b) rows[b.row] = Math.max(rows[b.row] || 0, b.h); });
      rows.forEach(function (h, r) { base[r] = y; y -= h; });
      return { frames: [L.map(function (b) { return b ? [b.x, base[b.row] - b.h / 2, 0] : null; })], ms: 0 };
    }
    function simulate(seed, mess) {
      var R = rng(seed), engine = M.Engine.create({ enableSleeping: true, positionIterations: 12, velocityIterations: 10 });
      engine.gravity.y = 1.7;
      var st = { isStatic: true, friction: 1 };
      M.Composite.add(engine.world, [M.Bodies.rectangle(W / 2, H + 100, W + 800, 200, st), M.Bodies.rectangle(-100, H / 2 - 600, 200, H + 2400, st), M.Bodies.rectangle(W + 100, H / 2 - 600, 200, H + 2400, st)]);
      var order = L.map(function (b, i) { return b ? i : -1; }).filter(function (i) { return i >= 0; }).sort(function (a, b) { return L[a].row - L[b].row || L[a].col - L[b].col; });
      var gapT = Math.max(45, Math.min(150, 1500 / order.length)), at = 0, sched = order.map(function (i) {
        var b = L[i], half = (b.units * U - b.w) / 2, s = { i: i, at: at, x: b.x + (R() - .5) * 2 * half * (.3 + mess), a: (R() - .5) * 2 * (.006 + mess * .06), av: (R() - .5) * 2 * mess * .012 };
        at += gapT * (.8 + R() * .4); return s;
      });
      var bodies = [], frames = [], dt = 1000 / 120, t = 0, step = 0, next = 0, lastAt = sched[sched.length - 1].at, maxT = lastAt + 7000;
      while (t < maxT) {
        while (next < sched.length && sched[next].at <= t) {
          var s = sched[next], b = L[s.i], clear = true;
          /* never let a block appear inside one that has not yet fallen out of the way (a one-block-wide pile on a phone) */
          for (var q = 0; q < N && clear; q++) { var o = bodies[q]; if (o && L[q] && Math.abs(o.position.x - s.x) < (L[q].w + b.w) / 2 + 4 && o.position.y - L[q].h / 2 < 4) clear = false; }
          if (!clear) break;
          next++;
          var body = M.Bodies.rectangle(s.x, -b.h / 2 - 8, b.w, b.h, { restitution: .06, friction: .35, frictionStatic: .6, frictionAir: .004, density: .002, slop: .02, sleepThreshold: 40 });
          M.Body.setAngle(body, s.a); M.Body.setAngularVelocity(body, s.av); M.Body.setVelocity(body, { x: 0, y: 5 });
          bodies[s.i] = body; M.Composite.add(engine.world, body);
        }
        M.Engine.update(engine, dt); t += dt; step++;
        if (step % 2 === 0) frames.push(L.map(function (b, i) { var bd = bodies[i]; return bd ? [bd.position.x, bd.position.y, bd.angle] : null; }));
        if (next === sched.length && t > lastAt + 600 && bodies.every(function (b) { return !b || b.isSleeping; })) break;
      }
      M.Composite.clear(engine.world, false); M.Engine.clear(engine);
      return { frames: frames, ms: t };
    }
    function topOf(f) { var top = Infinity; f.forEach(function (p, i) { if (!p || !L[i]) return; top = Math.min(top, p[1] - (Math.abs(Math.cos(p[2])) * L[i].h + Math.abs(Math.sin(p[2])) * L[i].w) / 2); }); return top; }

    function build(replay) {
      endPlay(); /* play: any rebuild puts the pile back as it was dropped */
      if (shelf) return;
      falling = [];
      blks.forEach(function (b, i) { items[i].hidden = !active[i]; });
      W = well.clientWidth; if (!W) return;
      U = W / 6; dpr = Math.min(2, window.devicePixelRatio || 1);
      placePad();
      var mode = W < 520 ? '1' : S.mode, i;
      L = layout(mode);
      blks.forEach(function (b, i) { if (!L[i]) return; b.style.width = L[i].w.toFixed(1) + 'px'; b.setAttribute('data-u', L[i].units); b.style.zIndex = 1 + L[i].row * 4 + L[i].col; });
      blks.forEach(function (b, i) { if (L[i]) L[i].h = b.offsetHeight; });
      var rows = [], tall = 0; L.forEach(function (b) { if (!b) return; rows[b.row] = Math.max(rows[b.row] || 0, b.h); tall = Math.max(tall, b.h); });
      var need = rows.reduce(function (a, b) { return a + b; }, 0);
      H = Math.max(mode === '1' ? 0 : S.minRows * tall, need) + HEAD;
      var mess = 1 - S.neat / 100;
      sim = M ? simulate(S.seed, mess) : still();
      fin = sim.frames[sim.frames.length - 1];
      if (M && topOf(fin) < 16) { H = Math.ceil(H + 30 - topOf(fin)); sim = simulate(S.seed, mess); fin = sim.frames[sim.frames.length - 1]; }
      /* play: a pile that topples is not a list. If a block ends up leaning past 8 degrees, try the next few
         seeds and keep the calmest pile that still fits the well. Still repeatable: the same list lands the same way. */
      if (M) {
        var best = sim, bestLean = leanOf(fin), sd = S.seed, tries = 0;
        while (bestLean > 8 && tries++ < 10) {
          sd = sd % 997 + 1;
          var alt = simulate(sd, mess), af = alt.frames[alt.frames.length - 1], al = leanOf(af);
          if (topOf(af) >= 16 && al < bestLean) { best = alt; bestLean = al; }
        }
        sim = best; fin = sim.frames[sim.frames.length - 1];
      }
      endAt = 0;
      for (var f = sim.frames.length - 2; f >= 0 && !endAt; f--) for (i = 0; i < N; i++) { var p = sim.frames[f][i], q = fin[i]; if (!q) continue; if (!p || Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) > .4 || Math.abs(p[2] - q[2]) > .002) { endAt = (f + 2) * 1000 / 60; break; } }
      well.style.height = H + 'px';
      [under, over].forEach(function (c) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); });
      blks.forEach(function (b, i) { var c = b.querySelector('.cov'); cov[i] = c ? { x: c.offsetLeft + b.clientLeft, y: c.offsetTop + b.clientTop, w: c.clientWidth, h: c.clientHeight } : { x: 0, y: 0, w: L[i].w, h: 0 }; });
      specials.forEach(function (s) { s.cv.width = Math.round(cov[s.i].w * dpr); s.cv.height = Math.round(cov[s.i].h * dpr); });
      if (replay && S.motion && M && sim.frames.length > 1) { phase = 'drop'; t0 = performance.now(); }
      else { phase = 'rest'; litAt = replay ? performance.now() : -1e9; }
      report(); last = 0; kick();
    }
    function leanOf(f) { var lean = 0; f.forEach(function (p) { if (!p) return; var a = Math.abs(p[2] * 180 / Math.PI) % 180; lean = Math.max(lean, Math.min(a, 180 - a)); }); return lean; }
    function count() { var n = 0; for (var i = 0; i < N; i++) if (active[i]) n++; return n; }
    function report() {
      var lean = leanOf(fin), n = count();
      var N = n; /* play: the line describes what is in the well, not the whole list */
      var text = shelf ? N + ' on the shelf' : !M ? N + ' blocks · placed, not dropped (the physics did not load)' : phase === 'play' ? N + ' blocks · loose · drag one, or tidy up' : N + ' blocks · ' + (phase === 'drop' ? 'dropping' : 'landed in ' + (endAt / 1000).toFixed(1) + ' s') + ' · steepest lean ' + lean.toFixed(1) + '°' + (phase === 'rest' && canPlay() ? (fine ? ' · pick one up' : ' · press and hold one') : '');
      if (status) status.textContent = text;
      syncMore(); syncMachine();
      if (opts.onReport) opts.onReport({ blocks: N, phase: phase, landedMs: endAt, lean: lean, physics: !!M });
    }

    function rings(g, l, al) { g.fillStyle = l.tone === 'warm' ? C['part-straw'] : C.dark; for (var k = 0; k < 3; k++) { g.globalAlpha = al[k] * l.amt; g.beginPath(); g.arc(l.x, l.y, l.R * STEP[k], 0, TAU); g.fill(); } g.globalAlpha = 1; }
    function reachOf(s, lit) { var lg = s.rule.light; return lg.reach * U * (.55 + .45 * lit) * (lg.tone === 'warm' ? 1 + .05 * Math.sin(clock * 1.7) + .02 * Math.sin(clock * 4.7) + .2 * s.heat : 1 + .12 * s.heat); }
    function strip(el, dir, c0, R, gapTo, off, amt) {
      if (!el) return;
      var o = R > gapTo ? Math.sqrt(R * R - gapTo * gapTo) : 0, r2 = R * STEP[1], n = r2 > gapTo ? Math.sqrt(r2 * r2 - gapTo * gapTo) : 0, v = '';
      if (o > 1) { var a = (c0 - o + off).toFixed(1), b = (c0 - n + off).toFixed(1), c = (c0 + n + off).toFixed(1), d = (c0 + o + off).toFixed(1), lo = rgba(C['part-straw'], .5 * amt), hi = rgba(C['part-straw'], .9 * amt);
        v = 'linear-gradient(' + dir + ',transparent ' + a + 'px,' + lo + ' ' + a + 'px ' + b + 'px,' + hi + ' ' + b + 'px ' + c + 'px,' + lo + ' ' + c + 'px ' + d + 'px,transparent ' + d + 'px)'; }
      if (el._v !== v) { el._v = v; el.style.background = v; }
    }

    function draw(lit) {
      var i, j, p, b, P = [], lights = [], orbit = null;
      /* play: with a long list in the well, only the first two special blocks in it light up and move */
      var specials = allSpecials.filter(function (s) { return active[s.i] && !falling[s.i]; }).slice(0, 2);
      for (i = 0; i < N; i++) P[i] = pose[i] ? [pose[i][0], pose[i][1] - 3 * lift[i], pose[i][2]] : null;
      /* pulls first, so the light falls on blocks where they have been dragged to */
      if (lit > 0) specials.forEach(function (s) {
        var r = s.rule; p = P[s.i]; if (!p || !r.pull || !r.light) return;
        var c = cov[s.i], at = world(p, c.x + c.w * r.light.at[0], c.y + c.h * r.light.at[1], L[s.i].w, L[s.i].h), R = reachOf(s, lit), breath = .6 + .4 * Math.sin(clock * 1.2);
        for (j = 0; j < N; j++) if (j !== s.i && P[j]) { var k = clamp(1 - dist(P[j], L[j], at[0], at[1]) / R); if (k > 0) { var dx = at[0] - P[j][0], dy = at[1] - P[j][1], n = Math.hypot(dx, dy) || 1, amt = r.pull * k * lit * breath * (1 + .8 * s.heat); P[j][0] += dx / n * amt; P[j][1] += dy / n * amt; } }
      });
      if (lit > 0) specials.forEach(function (s) {
        p = P[s.i]; if (!p) return;
        if (s.rule.light) { var c = cov[s.i], lg = s.rule.light, at = world(p, c.x + c.w * lg.at[0], c.y + c.h * lg.at[1], L[s.i].w, L[s.i].h); lights.push({ i: s.i, x: at[0], y: at[1], R: reachOf(s, lit), tone: lg.tone, amt: lit }); }
        if (s.rule.stars) orbit = { s: s, x: p[0], y: p[1] };
      });

      for (i = 0; i < N; i++) {
        b = blks[i]; p = P[i];
        if (!p) { if (b.style.visibility !== 'hidden') b.style.visibility = 'hidden'; continue; }
        if (b.style.visibility) b.style.visibility = '';
        var sq = squash[i] || 0;
        b.style.transform = 'translate(' + (p[0] - L[i].w / 2).toFixed(2) + 'px,' + (p[1] - L[i].h / 2).toFixed(2) + 'px) rotate(' + p[2].toFixed(4) + 'rad)' + (sq ? ' translateY(' + (L[i].h * sq / 2).toFixed(2) + 'px) scale(' + (1 + sq * .6).toFixed(4) + ',' + (1 - sq).toFixed(4) + ')' : '');
      }

      /* light on the paper of the well, under the blocks */
      ug.setTransform(dpr, 0, 0, dpr, 0, 0); ug.clearRect(0, 0, W, H);
      lights.forEach(function (l) { rings(ug, l, l.tone === 'warm' ? (C.isDark ? [.1, .1, .12] : [.3, .26, .3]) : (C.isDark ? [.3, .3, .3] : [.05, .06, .08])); });

      /* light on the blocks: cover art, the edges that face the lamp, and which way the shadow falls */
      og.setTransform(dpr, 0, 0, dpr, 0, 0); og.clearRect(0, 0, W, H); og.lineCap = 'butt';
      if (dust.length) { og.fillStyle = C.ink; dust.forEach(function (d) { var k = d.life / d.max; og.globalAlpha = k > .66 ? .22 : k > .33 ? .14 : .07; og.beginPath(); og.arc(d.x, d.y, d.r * (.6 + .4 * k), 0, TAU); og.fill(); }); og.globalAlpha = 1; }
      for (j = 0; j < N; j++) {
        p = P[j]; if (!p) continue; b = L[j];
        var sh = [SH[0], SH[1]], cs = Math.cos(p[2]), sn = Math.sin(p[2]);
        lights.forEach(function (l) {
          if (l.i === j) return;
          var k = clamp(1 - dist(p, b, l.x, l.y) / l.R); if (k <= 0) return;
          var c = cov[j], q = [world(p, c.x, c.y, b.w, b.h), world(p, c.x + c.w, c.y, b.w, b.h), world(p, c.x + c.w, c.y + c.h, b.w, b.h), world(p, c.x, c.y + c.h, b.w, b.h)];
          if (!own[j] && c.h > 0) { og.save(); og.beginPath(); og.moveTo(q[0][0], q[0][1]); og.lineTo(q[1][0], q[1][1]); og.lineTo(q[2][0], q[2][1]); og.lineTo(q[3][0], q[3][1]); og.closePath(); og.clip();
            rings(og, l, l.tone === 'warm' ? [.16, .16, .2] : [.1, .12, .14]); og.restore(); }
          var dx = p[0] - l.x, dy = p[1] - l.y, n = Math.hypot(dx, dy) || 1, push = l.tone === 'warm' ? 8 : -4;
          sh[0] += dx / n * push * k * l.amt; sh[1] += dy / n * push * k * l.amt;
          if (l.tone !== 'warm') return;
          var e = 3.6, r = [world(p, e, e, b.w, b.h), world(p, b.w - e, e, b.w, b.h), world(p, b.w - e, b.h - e, b.w, b.h), world(p, e, b.h - e, b.w, b.h)], nm = [[0, -1], [1, 0], [0, 1], [-1, 0]];
          og.strokeStyle = face[j] === C['part-straw'].toLowerCase() ? '#ffffff' : C['part-straw']; og.lineWidth = 3;
          for (var s = 0; s < 4; s++) {
            var a0 = r[s], a1 = r[(s + 1) % 4], mx = (a0[0] + a1[0]) / 2, my = (a0[1] + a1[1]) / 2, nx = nm[s][0] * cs - nm[s][1] * sn, ny = nm[s][0] * sn + nm[s][1] * cs, lx = l.x - mx, ly = l.y - my, ln = Math.hypot(lx, ly) || 1;
            var al = clamp(k * (nx * lx + ny * ly) / ln * 2.2) * l.amt; if (al < .04) continue;
            og.globalAlpha = al; og.beginPath(); og.moveTo(a0[0], a0[1]); og.lineTo(a1[0], a1[1]); og.stroke();
          }
          og.globalAlpha = 1;
        });
        var m = 1 + .9 * Math.max(0, lift[j]) + .7 * Math.min(0, lift[j]), sx = ((sh[0] * cs + sh[1] * sn) * m).toFixed(1) + 'px', sy = ((-sh[0] * sn + sh[1] * cs) * m).toFixed(1) + 'px';
        if (shadow[j] !== sx + sy) { shadow[j] = sx + sy; blks[j].style.setProperty('--sx', sx); blks[j].style.setProperty('--sy', sy); }
      }

      /* stars: the far half of each orbit passes behind the pile, the near half in front of it */
      if (orbit) orbit.s.rule.stars.forEach(function (au, k) {
        var th = orbit.s.ph[k], a = au * U, x = a * Math.cos(th), y = a * .4 * Math.sin(th), t = -.24, g = Math.sin(th) > 0 ? og : ug;
        g.globalAlpha = lit; g.fillStyle = [C['part-straw'], '#ffffff', C['part-olive']][k % 3]; g.strokeStyle = C.ink; g.lineWidth = 1.5;
        g.beginPath(); g.arc(orbit.x + x * Math.cos(t) - y * Math.sin(t), orbit.y + x * Math.sin(t) + y * Math.cos(t), 4.5 - k * .6, 0, TAU); g.fill(); g.stroke(); g.globalAlpha = 1;
      });

      /* the rails and the floor catch warm light too */
      var w0 = null; lights.forEach(function (l) { if (l.tone === 'warm' && !w0) w0 = l; });
      strip(lits.l, 'to bottom', w0 ? w0.y : 0, w0 ? w0.R : 0, w0 ? w0.x : 1e9, 6, w0 ? w0.amt : 0);
      strip(lits.r, 'to bottom', w0 ? w0.y : 0, w0 ? w0.R : 0, w0 ? W - w0.x : 1e9, 6, w0 ? w0.amt : 0);
      strip(lits.f, 'to right', w0 ? w0.x : 0, w0 ? w0.R : 0, w0 ? H - w0.y : 1e9, 14, w0 ? w0.amt : 0);

      specials.forEach(function (s) { var c = cov[s.i]; s.g.setTransform(dpr, 0, 0, dpr, 0, 0); s.rule.art(s.g, c.w, c.h, clock, s.heat, C); });
    }

    /* feel: a block that was falling and suddenly is not has landed. It squashes a little, kicks up a puff of
       flat dust from its corners, knocks the well if it was heavy and fast, and, once you have touched the pile,
       makes a soft knock. Nothing here changes the physics. */
    function feel(dt) {
      var busy = false, i;
      for (i = 0; i < N; i++) {
        var p = pose[i];
        if (!p || !L[i]) { prevY[i] = null; vy[i] = 0; continue; }
        var v = prevY[i] == null ? 0 : (p[1] - prevY[i]) * 16 / Math.max(1, dt);
        if (vy[i] > 3 && v < vy[i] * .35 && !(grab && grab.i === i)) landed(i, Math.min(1, vy[i] / 14));
        vy[i] = v; prevY[i] = p[1];
        if (squash[i] > .002) { squash[i] *= Math.pow(.8, dt / 16); busy = true; } else squash[i] = 0;
      }
      if (dust.length) { busy = true; dust = dust.filter(function (d) { d.x += d.vx * dt / 16; d.y += d.vy * dt / 16; d.vx *= .9; d.vy *= .9; d.life -= dt; return d.life > 0; }); }
      if (kickY > .05) { kickY *= Math.pow(.75, dt / 16); busy = true; } else kickY = 0;
      if (shaftEl) shaftEl.style.transform = kickY ? 'translateY(' + kickY.toFixed(2) + 'px)' : '';
      return busy;
    }
    function landed(i, s) {
      if (s < .12) return;
      var p = pose[i], b = L[i];
      squash[i] = Math.max(squash[i] || 0, .02 + .05 * s);
      [[4, b.h - 2, -1], [b.w - 4, b.h - 2, 1]].forEach(function (c) {
        var at = world(p, c[0], c[1], b.w, b.h);
        for (var k = 0; k < 3; k++) dust.push({ x: at[0], y: at[1], vx: c[2] * (1 + Math.random() * 2.2) * s, vy: -(.3 + Math.random() * 1.2) * s, r: 2 + Math.random() * 3 * s, life: 260 + Math.random() * 160, max: 420 });
      });
      if (dust.length > 120) dust.splice(0, dust.length - 120);
      if (s > .55 && b.units >= 3) kickY = Math.max(kickY, 2.5 * s);
      knock(b.units, s);
    }
    function frame(now) {
      raf = 0; var dt = Math.min(50, last ? now - last : 16), busy = false, i; last = now;
      if (S.motion) { clock += dt / 1000; specials.forEach(function (s) { if (s.rule.stars) s.rule.stars.forEach(function (au, k) { s.ph[k] += dt / 1000 * .9 * Math.pow(s.rule.stars[0] / au, 1.5) * (1 + .8 * s.heat); }); }); }
      if (phase === 'drop') {
        var t = Math.max(0, now - t0), fi = t * 60 / 1000, a = Math.floor(fi), u = fi - a, F = sim.frames;
        if (t >= endAt || a >= F.length - 1) { phase = 'rest'; litAt = now; report(); }
        else { for (i = 0; i < N; i++) { var p0 = F[a][i], p1 = F[a + 1][i]; pose[i] = p0 && p1 ? [p0[0] + (p1[0] - p0[0]) * u, p0[1] + (p1[1] - p0[1]) * u, p0[2] + (p1[2] - p0[2]) * u] : null; } busy = true; }
      }
      if (phase === 'rest') for (i = 0; i < N; i++) pose[i] = fin[i];
      if (phase === 'play') busy = stepPlay(dt) || busy; /* play: live physics */
      if (S.motion && feel(dt)) busy = true;
      for (i = 0; i < N; i++) { var d = want[i] - lift[i]; if (S.motion && Math.abs(d) > .01) { lift[i] += d * Math.min(1, dt / 70); busy = true; } else lift[i] = want[i]; }
      specials.forEach(function (s) { var d = (want[s.i] > 0 ? 1 : 0) - s.heat; if (Math.abs(d) > .01) { s.heat += d * Math.min(1, dt / 260); busy = true; } else s.heat = want[s.i] > 0 ? 1 : 0; });
      var lit = phase !== 'drop' ? clamp((now - litAt) / 800) : 0; lit = lit * lit * (3 - 2 * lit);
      if (phase !== 'drop' && lit < 1) busy = true;
      draw(lit);
      if (busy || (S.motion && seen && !document.hidden && specials.length)) kick();
    }
    function kick() { if (!raf && !dead && !shelf) raf = requestAnimationFrame(frame); }

    /* ---- play: the landed pile as a toy ----
       Nothing here runs until a block is dragged or Shake is pressed. The drop itself is still baked and
       repeatable; this takes over from where it landed, with the same world the drop was worked out in. */
    var live = null, grab = null, hold = null, dragged = false, dead = false, off = [], fine = !window.matchMedia || matchMedia('(pointer: fine)').matches;
    function canPlay() { return !!M && S.motion; }
    function startPlay() {
      if (live || !canPlay()) return !!live;
      /* a pile still settling counts as landed the moment someone reaches for it */
      if (phase === 'drop') { for (var k = 0; k < N; k++) pose[k] = fin[k]; litAt = performance.now(); }
      var engine = M.Engine.create({ enableSleeping: true, positionIterations: 12, velocityIterations: 10 });
      engine.gravity.y = 1.7;
      var st = { isStatic: true, friction: 1 };
      var floor = M.Bodies.rectangle(W / 2, H + 100, W + 800, 200, st);
      /* the side walls reach far above and below, because the well can grow while it is being played with */
      M.Composite.add(engine.world, [floor, M.Bodies.rectangle(-100, 0, 200, 60000, st), M.Bodies.rectangle(W + 100, 0, 200, 60000, st)]);
      var bodies = L.map(function (b, i) {
        var p = pose[i] || fin[i];
        if (!b || !p) return null;
        var body = M.Bodies.rectangle(p[0], p[1], b.w, b.h, { restitution: .06, friction: .35, frictionStatic: .6, frictionAir: .012, density: .002, slop: .02, sleepThreshold: 40 });
        M.Body.setAngle(body, p[2]);
        /* bottom-weighted: the centre of mass sits low in the block, so it hangs upright from the hand and
           tends to come down the right way up. off[] is how far below the middle that is. */
        off[i] = b.h * .3;
        M.Body.setCentre(body, { x: -off[i] * Math.sin(p[2]), y: off[i] * Math.cos(p[2]) }, true);
        return body;
      });
      M.Composite.add(engine.world, bodies.filter(Boolean));
      live = { engine: engine, bodies: bodies, acc: 0, floor: floor };
      phase = 'play'; rack.classList.add('rack--loose'); if (tidyBtn) tidyBtn.hidden = false; report();
      return true;
    }
    function endPlay() {
      if (!live) return;
      dropGrab(); M.Composite.clear(live.engine.world, false); M.Engine.clear(live.engine); live = null;
      blks.forEach(function (b, i) { b.style.zIndex = L[i] ? 1 + L[i].row * 4 + L[i].col : ''; if (falling[i]) items[i].hidden = true; });
      falling = []; rack.classList.remove('rack--open');
      rack.classList.remove('rack--loose'); if (tidyBtn) tidyBtn.hidden = true;
      phase = 'rest';
    }
    function stepPlay(dt) {
      if (!live) return false;
      var i, moving = !!grab;
      if (S.motion) {
        live.acc = Math.min(live.acc + dt, 50);
        while (live.acc >= 1000 / 120) {
          /* a gentle pull back toward upright on anything still moving, strongest when upside down */
          for (i = 0; i < N; i++) { var rb = live.bodies[i]; if (!rb || falling[i] || rb.isSleeping || (grab && grab.i === i)) continue; var tilt = Math.atan2(Math.sin(rb.angle), Math.cos(rb.angle)); rb.torque -= tilt / Math.PI * rb.inertia * 4e-5; }
          M.Engine.update(live.engine, 1000 / 120); live.acc -= 1000 / 120;
        }
      }
      var gone = false;
      for (i = 0; i < N; i++) {
        var bd = live.bodies[i];
        if (!bd) continue;
        /* play: a block on its way out falls through the floor and is put away once it is below the well */
        if (falling[i]) {
          if (bd.position.y - L[i].h > H + 20) { M.Composite.remove(live.engine.world, bd); live.bodies[i] = null; falling[i] = false; pose[i] = fin[i] = null; L[i] = null; items[i].hidden = true; blks[i].style.transform = ''; gone = true; continue; }
        } else
        /* a block thrown clear of the well comes back in from the top */
        if (bd.position.y > H + 400 || bd.position.x < -300 || bd.position.x > W + 300) { M.Body.setPosition(bd, { x: W / 2, y: -L[i].h }); M.Body.setVelocity(bd, { x: 0, y: 0 }); M.Body.setAngle(bd, 0); M.Body.setAngularVelocity(bd, 0); }
        /* the pose is the middle of the block, which sits above its low centre of mass */
        pose[i] = fin[i] = [bd.position.x + off[i] * Math.sin(bd.angle), bd.position.y - off[i] * Math.cos(bd.angle), bd.angle];
        if (!bd.isSleeping) moving = true;
        /* higher blocks, and then blocks further right, sit in front, so a block resting on another hides its top face */
        var z = 100 + Math.round((H - bd.position.y) / 4) * 8 + Math.round(bd.position.x / W * 6);
        if (grab && grab.i === i) z = 99999;
        if (falling[i]) z = 50;
        if (blks[i].style.zIndex !== String(z)) blks[i].style.zIndex = z;
      }
      if (gone && !falling.some(Boolean)) { rack.classList.remove('rack--open'); setTimeout(fit, 500); }
      if (falling.some(Boolean)) moving = true;
      /* play: whenever the pile comes to rest, fit the well to it */
      if (moving) live.fitted = false; else if (!live.fitted) { live.fitted = true; fit(); }
      return S.motion && moving;
    }
    /* play: make the well the right height for what is in it, moving everything with the floor so nothing jumps */
    function resize(newH) {
      newH = Math.max(HEAD + 40, Math.round(newH));
      var d = newH - H; if (!d) return;
      H = newH; well.style.height = H + 'px';
      [under, over].forEach(function (c) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); });
      if (live) {
        live.bodies.forEach(function (bd) { if (bd) M.Body.setPosition(bd, { x: bd.position.x, y: bd.position.y + d }); });
        M.Body.setPosition(live.floor, { x: live.floor.position.x, y: live.floor.position.y + d });
      }
      for (var i = 0; i < N; i++) { if (fin[i]) { fin[i] = [fin[i][0], fin[i][1] + d, fin[i][2]]; pose[i] = fin[i]; } if (prevY[i] != null) prevY[i] += d; }
      dust.forEach(function (q) { q.y += d; });
      if (padEl) placePad();
      last = 0; kick();
    }
    /* shrink the well to the pile, once things have settled */
    function fit() {
      if (!live || shelf || grab || falling.some(Boolean)) return;
      var top = Infinity;
      live.bodies.forEach(function (bd) { if (bd) top = Math.min(top, bd.bounds.min.y); });
      if (top === Infinity) return;
      var need = H - top + HEAD;
      if (need < H - 4) resize(need);
    }
    function body(i, x, y, a) {
      var b = L[i], bd = M.Bodies.rectangle(x, y, b.w, b.h, { restitution: .06, friction: .35, frictionStatic: .6, frictionAir: .012, density: .002, slop: .02, sleepThreshold: 40 });
      M.Body.setAngle(bd, a || 0); off[i] = b.h * .3;
      M.Body.setCentre(bd, { x: -off[i] * Math.sin(a || 0), y: off[i] * Math.cos(a || 0) }, true);
      return bd;
    }
    /* the column with the most room above it, so a new block lands low; ties go left to right in turn */
    function lowest(units, cols, k) {
      var w = W / cols, best = 0, bestTop = -Infinity;
      for (var c = 0; c < cols; c++) {
        var x0 = c * w, x1 = x0 + w, top = H;
        live.bodies.forEach(function (bd) { if (bd && bd.bounds.max.x > x0 + 4 && bd.bounds.min.x < x1 - 4) top = Math.min(top, bd.bounds.min.y); });
        if (top > bestTop + 2 || (Math.abs(top - bestTop) <= 2 && (c - k % cols + cols) % cols === 0)) { bestTop = top; best = c; }
      }
      return (best + .5) * w + (Math.random() - .5) * w * .1;
    }
    /* add: blocks fall in from the top, one after another, into a well that has grown to hold them */
    function addLive(list) {
      if (!list.length || !startPlay()) return;
      var n = 0, wide = W < 520, area = 0;
      list.forEach(function (i) {
        var units = wide ? 6 : (n++ % 5 < 3 ? 2 : 3);
        L[i] = { units: units, w: units * U - GAP, x: 0, row: 0, col: 0, h: 0 };
        items[i].hidden = false; blks[i].style.width = L[i].w.toFixed(1) + 'px'; blks[i].setAttribute('data-u', units);
        L[i].h = blks[i].offsetHeight; area += L[i].h * units / 6;
        pose[i] = fin[i] = null; blks[i].style.transform = 'translate(-9999px,0)';
      });
      resize(H + area * 1.2 + 20);
      list.forEach(function (i, k) {
        setTimeout(function () {
          if (!live || !active[i] || live.bodies[i]) return;
          /* spread arrivals across the width, lowest spot first, so they settle side by side instead of in a tower */
          var half = (L[i].units * U) / 2, cols = Math.max(1, Math.floor(6 / L[i].units)), x = cols === 1 ? W / 2 : lowest(L[i].units, cols, k);
          var bd = body(i, x, -L[i].h / 2 - 8, (Math.random() - .5) * .06);
          M.Body.setVelocity(bd, { x: 0, y: 5 });
          live.bodies[i] = bd; M.Composite.add(live.engine.world, bd);
          last = 0; kick();
        }, k * 140);
      });
      setTimeout(fit, list.length * 140 + 2600);
    }
    /* remove: the floor opens and the blocks drop out through it; nothing else is touched */
    function removeLive(list) {
      if (!list.length || !startPlay()) return;
      rack.classList.add('rack--open');
      list.forEach(function (i) {
        var bd = live.bodies[i]; if (!bd) { items[i].hidden = true; L[i] = null; pose[i] = fin[i] = null; return; }
        falling[i] = true;
        bd.collisionFilter = { group: -1, category: 2, mask: 0 };
        M.Sleeping.set(bd, false); M.Body.setVelocity(bd, { x: 0, y: 3 });
      });
      last = 0; kick();
    }
    function point(e) { var r = well.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function takeGrab(i, pt) {
      var bd = live.bodies[i];
      M.Sleeping.set(bd, false);
      grab.c = M.Constraint.create({ pointA: pt, bodyB: bd, pointB: { x: pt.x - bd.position.x, y: pt.y - bd.position.y }, length: 0, stiffness: .18, damping: .12 });
      grab.c.angleB = bd.angle;
      M.Composite.add(live.engine.world, grab.c);
      rack.classList.add('rack--held');
    }
    function dropGrab() {
      if (padEl && padHot >= 0 && !launching) padIdle();
      if (grab && grab.c && live) M.Composite.remove(live.engine.world, grab.c);
      grab = null; rack.classList.remove('rack--held');
    }
    function shake() {
      if (!M) return;
      if (!S.motion) setMotion(true); /* pressing Shake is asking for motion, even when it was paused or reduced */
      if (!startPlay()) return;
      live.bodies.forEach(function (bd, i) {
        if (!bd || falling[i]) return;
        M.Sleeping.set(bd, false);
        M.Body.setVelocity(bd, { x: (Math.random() - .5) * 16, y: -(7 + Math.random() * 9) });
        M.Body.setAngularVelocity(bd, (Math.random() - .5) * .09);
      });
      last = 0; kick();
    }
    pile.addEventListener('pointerdown', function (e) {
      var i = at(e.target);
      if (i < 0 || e.button || !canPlay() || shelf || falling[i] || (e.target.closest && e.target.closest('.blk__play'))) return;
      if (e.pointerType === 'touch') {
        /* on a touch screen a swipe has to stay a scroll, so a block is picked up by pressing and holding it */
        clearTimeout(hold && hold.timer);
        hold = { i: i, id: e.pointerId, from: point(e), timer: setTimeout(function () {
          if (!hold) return;
          grab = { i: hold.i, id: hold.id, from: hold.from, c: null }; hold = null;
          if (!startPlay()) { grab = null; return; }
          dragged = true; takeGrab(grab.i, grab.from);
          if (navigator.vibrate) navigator.vibrate(12);
          last = 0; kick();
        }, 320) };
        return;
      }
      grab = { i: i, id: e.pointerId, from: point(e), c: null };
    });
    /* while a block is held by a finger, the page must not scroll under it */
    pile.addEventListener('touchmove', function (e) { if (grab && e.cancelable) e.preventDefault(); }, { passive: false });
    pile.addEventListener('contextmenu', function (e) { if (grab || hold || dragged) e.preventDefault(); });
    window.addEventListener('pointermove', function (e) {
      if (hold && e.pointerId === hold.id) { var hp = point(e); if (Math.hypot(hp.x - hold.from.x, hp.y - hold.from.y) > 10) { clearTimeout(hold.timer); hold = null; } }
      if (!grab || e.pointerId !== grab.id) return;
      var pt = point(e);
      if (!grab.c) {
        if (Math.hypot(pt.x - grab.from.x, pt.y - grab.from.y) < 6) return; /* a press that barely moves is still a click */
        if (!startPlay()) { grab = null; return; }
        dragged = true; takeGrab(grab.i, grab.from);
      }
      grab.c.pointA = pt; M.Sleeping.set(live.bodies[grab.i], false);
      if (padEl && !launching) { var on = overPad(pt); if (on && padHot !== grab.i) { padHot = grab.i; padEl.classList.add('is-hot'); padLabel('Let go to ' + (blks[grab.i].querySelector('.blk__play') ? 'play ' : 'open ') + titleOf(grab.i), true); } else if (!on && padHot >= 0) padIdle(); }
      last = 0; kick(); e.preventDefault();
    });
    function letGo(e) {
      if (hold && (!e || e.pointerId === hold.id)) { clearTimeout(hold.timer); hold = null; }
      if (grab && (!e || e.pointerId === grab.id)) { var gi = grab.i, over = e && padEl && overPad(point(e)); dropGrab(); if (over) launch(gi); kick(); }
    }
    /* ---- the launch pad ----
       Optional: clicking a block still opens it, and Play still plays. This is a third way in, for when you are
       already holding one: carry it to the pad and let go, and its game starts (or, for a post, it opens). */
    function placePad() { if (!padEl) return; padEl.style.width = Math.max(120, Math.min(2 * U - GAP, 260)) + 'px'; }
    function overPad(pt) { var r = padEl.getBoundingClientRect(), w = well.getBoundingClientRect(); return pt.x >= r.left - w.left && pt.x <= r.right - w.left && pt.y >= r.top - w.top && pt.y <= r.bottom - w.top; }
    function titleOf(i) { var t = blks[i].querySelector('.det__title'); return t ? t.textContent.trim() : ''; }
    function hrefOf(i) { var a = blks[i].querySelector('.blk__play') || blks[i].querySelector('.blk__link'); return a ? a.href : ''; }
    function padLabel(text, say) {
      var l = padEl.querySelector('.well__pad-label'); if (l) l.textContent = text;
      /* a block held over the pad hides its label, so the status line above the well says it too */
      if (status) { if (say) status.textContent = text; else if (say === false) report(); }
    }
    function padIdle() { var was = padHot >= 0; padHot = -1; padEl.classList.remove('is-hot'); padLabel(padEl.getAttribute('data-idle') || '', was ? false : undefined); }
    function launch(i) {
      var href = hrefOf(i); if (!href || launching) return;
      launching = true; padEl.classList.add('is-hot', 'is-launching');
      padLabel((blks[i].querySelector('.blk__play') ? 'Starting ' : 'Opening ') + titleOf(i), true);
      if (live && live.bodies[i]) {
        var r = padEl.getBoundingClientRect(), w = well.getBoundingClientRect(), bd = live.bodies[i];
        M.Body.setAngle(bd, 0); M.Body.setVelocity(bd, { x: 0, y: 0 }); M.Body.setAngularVelocity(bd, 0);
        M.Body.setPosition(bd, { x: r.left - w.left + r.width / 2, y: r.top - w.top + r.height / 2 + off[i] }); M.Body.setStatic(bd, true);
      }
      chime(); last = 0; kick();
      setTimeout(function () { window.location.href = href; }, 520);
      setTimeout(function () { launching = false; if (padEl) { padEl.classList.remove('is-launching'); padIdle(); } }, 3000);
    }
    window.addEventListener('pointerup', letGo); window.addEventListener('pointercancel', letGo);
    /* a drag is not a click: the block only opens if it barely moved */
    pile.addEventListener('click', function (e) { if (dragged) { dragged = false; e.preventDefault(); e.stopPropagation(); } }, true);
    if (shakeBtn) { shakeBtn.hidden = !M; shakeBtn.addEventListener('click', shake); }
    if (tidyBtn) tidyBtn.addEventListener('click', function () { build(true); });

    /* ---- hands ---- */
    function at(t) { var a = t && t.closest ? t.closest('.blk') : null; return a ? blks.indexOf(a) : -1; }
    pile.addEventListener('pointerover', function (e) { var i = at(e.target); if (i >= 0 && want[i] >= 0) { want[i] = 1; kick(); } });
    pile.addEventListener('pointerout', function (e) { var i = at(e.target); if (i >= 0 && !blks[i].contains(e.relatedTarget) && !blks[i].contains(document.activeElement)) { want[i] = 0; kick(); } });
    pile.addEventListener('focusin', function (e) { var i = at(e.target); if (i >= 0) { want[i] = 1; kick(); } });
    pile.addEventListener('focusout', function (e) { var i = at(e.target); if (i >= 0) { want[i] = 0; kick(); } });
    pile.addEventListener('pointerdown', function (e) { var i = at(e.target); if (i >= 0) { want[i] = -.7; kick(); } });
    function release() { for (var i = 0; i < N; i++) if (want[i] < 0) want[i] = blks[i].matches(':hover') || blks[i].contains(document.activeElement) ? 1 : 0; kick(); }
    window.addEventListener('pointerup', release); window.addEventListener('pointercancel', release);
    pile.addEventListener('dragstart', function (e) { e.preventDefault(); });

    /* ---- the active set, and the three things that change it ---- */
    function matches(i) { return !tag || tags[i].indexOf(' ' + tag + ' ') >= 0; }
    function target() { var t = [], n = 0; for (var i = 0; i < N; i++) { t[i] = false; if (matches(i) && n < limit) { t[i] = true; n++; } } return t; }
    function totalMatching() { var n = 0; for (var i = 0; i < N; i++) if (matches(i)) n++; return n; }
    function apply(regroup) {
      dropGrab();
      var t = target(), add = [], drop = [], i;
      for (i = 0; i < N; i++) { if (t[i] && !active[i]) add.push(i); if (!t[i] && active[i]) drop.push(i); }
      for (i = 0; i < N; i++) active[i] = t[i];
      if (shelf) { for (i = 0; i < N; i++) items[i].hidden = !active[i]; stagger(); report(); return; }
      /* with no motion, or no physics, things simply appear and disappear in place */
      /* a pile still dropping counts as landed the moment it is filtered, just as it does when it is touched */
      if (!M || !S.motion || !L.length) { build(false); return; }
      removeLive(drop);
      /* a filter: once the others have fallen through the floor, the set that is left drops in again, tidily.
         More: the new blocks simply fall in on top of the pile that is there. */
      if (regroup && drop.length) setTimeout(function () { if (!shelf) build(true); }, 1100);
      else setTimeout(function () { addLive(add); report(); }, drop.length ? 650 : 0);
      report();
    }
    /* on the shelf, each block slides onto its shelf a moment after the one before it */
    function stagger() { var k = 0; for (var i = 0; i < N; i++) if (active[i]) items[i].style.setProperty('--i', k++); }
    function syncMore() {
      if (!moreBtn) return;
      var left = totalMatching() - count();
      moreBtn.hidden = left <= 0;
      moreBtn.textContent = Math.min(batch, left) + ' more';
    }
    function more() { limit += batch; apply(); }
    function filter(t) {
      tag = t || ''; limit = batch;
      chips.forEach(function (c) { var on = (c.getAttribute('data-stack-filter') || '') === tag; c.classList.toggle('is-on', on); if (on) c.setAttribute('aria-current', 'true'); else c.removeAttribute('aria-current'); });
      apply(true);
    }
    function setShelf(on, save) {
      if (on === shelf && save !== 'init') return;
      if (on) {
        endPlay(); shelf = true;
        if (raf) cancelAnimationFrame(raf); raf = 0;
        rack.classList.remove('rack--live'); rack.classList.add('rack--shelf');
        well.style.height = '';
        blks.forEach(function (b, i) { b.style.transform = ''; b.style.width = ''; b.style.zIndex = ''; b.style.visibility = ''; items[i].hidden = !active[i]; });
        stagger();
      } else {
        shelf = false; rack.classList.remove('rack--shelf'); rack.classList.add('rack--live');
        build(S.motion);
      }
      if (views) [].forEach.call(views.querySelectorAll('[data-stack-view]'), function (b) { b.setAttribute('aria-pressed', String((b.getAttribute('data-stack-view') === 'shelf') === on)); });
      [shakeBtn, mo].forEach(function (b) { if (b) b.disabled = on; });
      if (save === true) { try { localStorage.setItem('jb-view', on ? 'shelf' : 'pile'); } catch (e) {} }
      report();
    }
    if (moreBtn) moreBtn.addEventListener('click', more);
    chips.forEach(function (c) { c.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
      e.preventDefault(); filter(c.getAttribute('data-stack-filter'));
      try { history.replaceState(history.state, '', c.href); } catch (er) {}
    }); });
    if (views) { views.hidden = false; [].forEach.call(views.querySelectorAll('[data-stack-view]'), function (b) { b.addEventListener('click', function () { setShelf(b.getAttribute('data-stack-view') === 'shelf', true); }); }); }

    function syncMachine() {
      if (!machine) return;
      machine.hidden = !M || shelf || !S.motion;
      if (lever) { var left = totalMatching() - count(); lever.disabled = left <= 0; var lb = lever.querySelector('.lever__label'); if (lb) lb.textContent = left > 0 ? 'Pull for ' + Math.min(batch, left) + ' more' : 'All in'; }
    }
    if (lever) lever.addEventListener('click', function () {
      if (lever.disabled) return;
      lever.classList.remove('is-pulled'); void lever.offsetWidth; lever.classList.add('is-pulled');
      clack(); setTimeout(more, 180);
    });
    /* tilt: drag the handle (or hold an arrow key on it) and gravity leans that way; let go and it springs back */
    function setTilt(v) {
      tilt = Math.max(-1, Math.min(1, v));
      if (tiltEl) { tiltEl.style.setProperty('--tilt', tilt.toFixed(3)); tiltEl.setAttribute('aria-valuenow', tilt.toFixed(2)); }
      if (shaftEl) shaftEl.style.rotate = (tilt * 1.6).toFixed(2) + 'deg';
      if (tilt && !live) startPlay();
      if (live) { live.engine.gravity.x = tilt * 2.2; live.bodies.forEach(function (bd, i) { if (bd && !falling[i] && !bd.isStatic) M.Sleeping.set(bd, false); }); }
      last = 0; kick();
    }
    if (tiltEl) {
      var tDrag = null;
      tiltEl.addEventListener('pointerdown', function (e) { arm(); tDrag = { id: e.pointerId, x: e.clientX, w: tiltEl.getBoundingClientRect().width }; tiltEl.setPointerCapture(e.pointerId); tiltEl.classList.add('is-held'); e.preventDefault(); });
      tiltEl.addEventListener('pointermove', function (e) { if (tDrag && e.pointerId === tDrag.id) setTilt((e.clientX - tDrag.x) / (tDrag.w / 2)); });
      var tEnd = function (e) { if (tDrag && (!e || e.pointerId === tDrag.id)) { tDrag = null; tiltEl.classList.remove('is-held'); setTilt(0); } };
      tiltEl.addEventListener('pointerup', tEnd); tiltEl.addEventListener('pointercancel', tEnd); tiltEl.addEventListener('lostpointercapture', tEnd);
      tiltEl.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { arm(); setTilt(e.key === 'ArrowLeft' ? -1 : 1); e.preventDefault(); } });
      tiltEl.addEventListener('keyup', function (e) { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') setTilt(0); });
    }

    function setMotion(on) { S.motion = on; try { rack.dispatchEvent(new CustomEvent('jb:motion', { bubbles: true, detail: { on: on } })); } catch (e) {} if (!on && tilt) setTilt(0); setTimeout(syncMachine, 0); if (mo) { mo.textContent = on ? 'Pause motion' : 'Play motion'; mo.hidden = false; } if (!on && phase === 'drop') { phase = 'rest'; litAt = -1e9; report(); } last = 0; kick(); }
    if (mo) mo.addEventListener('click', function () { setMotion(!S.motion); });
    if (mq.addEventListener) mq.addEventListener('change', function () { setMotion(!mq.matches); });

    /* ---- start ---- */
    for (var a0 = 0; a0 < N; a0++) active[a0] = a0 < batch;
    var savedView = null; try { savedView = localStorage.getItem('jb-view'); } catch (e) {}
    rack.classList.add('rack--live'); colors(); setMotion(S.motion); syncSound(); placePad();
    if (padEl) { padEl.hidden = !M; padIdle(); }
    if (savedView === 'shelf' || (!savedView && mq.matches)) { armed = false; setShelf(true, 'init'); } else build(false);
    /* play: a width change during the first drop (a scrollbar appearing as the page grows) restarts the drop
       instead of cancelling it */
    if (window.ResizeObserver) new ResizeObserver(function () { if (Math.abs(well.clientWidth - W) > 1) build(phase === 'drop'); }).observe(well);
    else window.addEventListener('resize', function () { build(false); });
    if (window.IntersectionObserver) new IntersectionObserver(function (es) { seen = es[es.length - 1].isIntersecting; if (seen && armed && !shelf) { armed = false; build(true); } else if (seen) kick(); }, { rootMargin: '0px 0px -15% 0px' }).observe(rack);
    else { seen = true; armed = false; build(true); }
    document.addEventListener('visibilitychange', kick);
    if (window.MutationObserver) new MutationObserver(function () { colors(); kick(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
    if (window.matchMedia) { var dk = matchMedia('(prefers-color-scheme: dark)'); if (dk.addEventListener) dk.addEventListener('change', function () { colors(); kick(); }); }

    return {
      set: function (o) { var replay = false; if (o.mode && o.mode !== S.mode) { S.mode = o.mode; replay = true; } if (o.neat != null) S.neat = Math.max(0, Math.min(100, +o.neat)); if (o.seed != null) S.seed = +o.seed; if (replay) build(true); else if (!queued) queued = requestAnimationFrame(function () { queued = 0; build(false); }); },
      drop: function () { S.seed = S.seed % 997 + 1; build(true); },
      motion: setMotion,
      shake: shake,
      tidy: function () { build(true); },
      /* play: stop for good, when the list this pile belongs to is swapped for another without a page load */
      more: more,
      filter: filter,
      shelf: function (on) { setShelf(!!on, true); },
      active: function () { return active.slice(); },
      destroy: function () { endPlay(); dead = true; if (raf) cancelAnimationFrame(raf); raf = 0; },
      state: function () { return { phase: phase, W: W, H: H, blocks: N, endAt: endAt, physics: !!M, motion: S.motion, neat: S.neat, mode: S.mode }; }
    };
  }
  JBStack.rules = RULES;
  window.JBStack = JBStack;

  function boot() { [].forEach.call(document.querySelectorAll('.rack[data-stack]'), function (r) { if (!r.__stack) r.__stack = JBStack(r); }); }
  function ready() { if (document.fonts && document.fonts.ready) { var done = false, go = function () { if (!done) { done = true; boot(); } }; document.fonts.ready.then(go); setTimeout(go, 1200); } else boot(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})();
