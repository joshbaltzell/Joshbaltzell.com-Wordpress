/* Josh Baltzell: extra rules for special blocks in the stack.
   stack.js ships two rules, sun and hole. This file adds pond. New designs do not go here: they are made per post in
   WordPress (Block design), with no theme change. A rule's art(g, w, h, t, heat, C)
   draws the block's cover every frame: t is seconds of motion, heat rises to 1 while the block is pointed at,
   and C holds the site's colors. These rules ignore heat on purpose: each runs at one steady pace, and pointing
   at a block does not change it. Pause motion stops t, so each of these holds still on its current frame.
   A cover may use whatever colors its subject needs, so these use each game's own. */
(function () {
  'use strict';
  if (!window.JBStack || !JBStack.rules) return;
  var here = document.currentScript ? document.currentScript.src : '';
  var base = here.replace(/js\/stack-rules\.js.*$/, 'img/rules/');
  function load(name) { var i = new Image(); i.decoding = 'async'; i.src = base + name; return i; }
  function ready(i) { return i.complete && i.naturalWidth > 0; }
  /* fill the cover with a picture, cropped to fit, the way a block's own cover image is */
  function fill(g, i, w, h) {
    if (!ready(i)) return;
    var s = Math.max(w / i.naturalWidth, h / i.naturalHeight), dw = i.naturalWidth * s, dh = i.naturalHeight * s;
    g.drawImage(i, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }

  /* ---- pond: the frog from Pond Chorus croaks twice, then waits. Sprites are the game's own. ---- */
  var pond = { bg: load('pond/bg-pond.jpg'), idle: load('pond/frog-idle.png'), sing: load('pond/frog-sing.png') };
  /* ---- a little water in the bottom of the Pond Chorus box ----
     A few drops sit on the inner floor of the glass box, down by the date. They pull together into beads, merge
     when they touch and break apart when the box moves: they feel the box's angle and how hard it speeds up or
     stops, so dragging, throwing, tilting or shaking the pile sloshes them about. Drawn over the pile, clipped to
     the inside of the box, in the box's own coordinates. */
  var POND_WATER = { n: 16, g: 900, link: 11 };
  function pondWater(g, S) {
    var st = S.state, me = S.blocks[S.self];
    if (!me) return;
    var w = me.w, h = me.h, dt = S.dt;
    /* the inside of the box: the walls are a fixed share of the block's width (see the box depth in wp.css) */
    var x0 = -w / 2 + .042 * w, x1 = w / 2 - .022 * w, y0 = -h / 2 + .014 * w, y1 = h / 2 - .027 * w;
    if (!st.drops) {
      st.drops = [];
      for (var k = 0; k < POND_WATER.n; k++) {
        var clump = Math.floor(k / 4), cx = x0 + (x1 - x0) * (.15 + .23 * clump);
        st.drops.push({ x: cx + (Math.random() - .5) * 10, y: y1 - 3 - Math.random() * 3, vx: 0, vy: 0, r: 2.6 + Math.random() * 1.6 });
      }
      st.bx = me.x; st.by = me.y; st.bvx = 0; st.bvy = 0;
    }
    var D = st.drops, i, j, a, b;
    if (dt > 0) {
      /* how the box itself is moving, smoothed: its acceleration pushes the water the other way */
      var bvx = (me.x - st.bx) / dt, bvy = (me.y - st.by) / dt;
      var ax = (bvx - st.bvx) / dt, ay = (bvy - st.bvy) / dt, am = Math.hypot(ax, ay);
      if (am > 5000) { ax *= 5000 / am; ay *= 5000 / am; }
      st.bx = me.x; st.by = me.y; st.bvx = bvx; st.bvy = bvy;
      /* gravity and that push, turned into the box's own frame */
      var c = Math.cos(-me.a), s = Math.sin(-me.a), fx = -ax, fy = POND_WATER.g - ay;
      var gx = fx * c - fy * s, gy = fx * s + fy * c;
      var steps = 3, h1 = dt / steps;
      for (var n = 0; n < steps; n++) {
        for (i = 0; i < D.length; i++) { a = D[i]; a.vx += gx * h1; a.vy += gy * h1; }
        /* drops attract a little when near and push apart when overlapping, so they bead and merge */
        for (i = 0; i < D.length; i++) for (j = i + 1; j < D.length; j++) {
          a = D[i]; b = D[j];
          var dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || .01, rest = (a.r + b.r) * .8;
          if (d > POND_WATER.link) continue;
          var pull = d < rest ? (d - rest) * 40 : (d - rest) * 9 * (1 - d / POND_WATER.link);
          var ux = dx / d, uy = dy / d;
          a.vx += ux * pull * h1 * 6; a.vy += uy * pull * h1 * 6; b.vx -= ux * pull * h1 * 6; b.vy -= uy * pull * h1 * 6;
          /* and drag on each other, the way water holds together */
          var mvx = (a.vx + b.vx) / 2, mvy = (a.vy + b.vy) / 2, k2 = Math.min(1, h1 * 6);
          a.vx += (mvx - a.vx) * k2; a.vy += (mvy - a.vy) * k2; b.vx += (mvx - b.vx) * k2; b.vy += (mvy - b.vy) * k2;
        }
        for (i = 0; i < D.length; i++) {
          a = D[i];
          var damp = Math.pow(.2, h1); a.vx *= damp; a.vy *= damp;
          a.x += a.vx * h1; a.y += a.vy * h1;
          /* the inside of the glass box: the floor has a little friction, the walls give a small bounce */
          if (a.y > y1 - a.r) { a.y = y1 - a.r; if (a.vy > 0) a.vy *= -.15; a.vx *= Math.pow(.05, h1); }
          if (a.y < y0 + a.r) { a.y = y0 + a.r; if (a.vy < 0) a.vy *= -.2; }
          if (a.x < x0 + a.r) { a.x = x0 + a.r; if (a.vx < 0) a.vx *= -.2; }
          if (a.x > x1 - a.r) { a.x = x1 - a.r; if (a.vx > 0) a.vx *= -.2; }
        }
      }
    }
    /* draw: the drops and the necks between near ones as one shape, so beads that touch read as one */
    var off = st.cv || (st.cv = document.createElement('canvas')), SC2 = 2;
    var cw = Math.ceil(w * SC2), ch = Math.ceil(h * SC2);
    if (off.width !== cw || off.height !== ch) { off.width = cw; off.height = ch; }
    var o = off.getContext('2d');
    o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(0, 0, cw, ch);
    o.setTransform(SC2, 0, 0, SC2, w, h); /* origin at the box centre */
    o.fillStyle = o.strokeStyle = '#8ccff0'; o.lineCap = 'round';
    for (i = 0; i < D.length; i++) {
      a = D[i]; o.beginPath(); o.ellipse(a.x, a.y + a.r * .2, a.r * 1.3, a.r * .8, 0, 0, Math.PI * 2); o.fill(); /* water spreads flat on a floor */
      for (j = i + 1; j < D.length; j++) {
        b = D[j]; var dd = Math.hypot(b.x - a.x, b.y - a.y);
        if (dd < (a.r + b.r) * 1.35) { o.lineWidth = Math.min(a.r, b.r) * 1.6; o.beginPath(); o.moveTo(a.x, a.y); o.lineTo(b.x, b.y); o.stroke(); }
      }
    }
    /* a thin bright edge on top of each bead, where the light catches it */
    o.globalCompositeOperation = 'source-atop'; o.fillStyle = 'rgba(255,255,255,.75)';
    for (i = 0; i < D.length; i++) { a = D[i]; o.beginPath(); o.ellipse(a.x - a.r * .3, a.y - a.r * .25, a.r * .6, a.r * .25, 0, 0, Math.PI * 2); o.fill(); }
    o.globalCompositeOperation = 'source-over';
    g.save(); g.translate(me.x, me.y); g.rotate(me.a);
    g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip();
    g.globalAlpha = .72 * S.lit; g.drawImage(off, -w / 2, -h / 2, w, h);
    g.restore();
  }

  JBStack.rules.pond = {
    over: pondWater,
    art: function (g, w, h, t, heat, C) {
      g.fillStyle = C['part-night']; g.fillRect(0, 0, w, h);
      fill(g, pond.bg, w, h);
      var beat = t % 2.6, croak = beat < .34 ? beat / .34 : beat > .52 && beat < .86 ? (beat - .52) / .34 : -1;
      var frog = croak >= 0 ? pond.sing : pond.idle;
      if (!ready(frog)) return;
      var fh = h * .92, fw = fh * frog.naturalWidth / frog.naturalHeight, hop = croak >= 0 ? Math.sin(croak * Math.PI) * h * .035 : 0;
      var x = w * .5 - fw / 2, y = h * 1.04 - fh - hop;
      /* the croak, drawn as two hard-edged rings leaving the frog's mouth */
      if (croak >= 0) {
        g.strokeStyle = C['part-straw']; g.lineWidth = 2;
        for (var k = 0; k < 2; k++) {
          var r = h * (.16 + .3 * croak + .16 * k);
          g.globalAlpha = 1 - croak; g.beginPath(); g.arc(w * .5, y + fh * .42, r, -Math.PI * .92, -Math.PI * .08); g.stroke();
        }
        g.globalAlpha = 1;
      }
      g.drawImage(frog, x, y, fw, fh);
    }
  };

  /* The Jam Tunnel cover used to be a rule here. It is now a live cover set on that post in WordPress
     (Block design), which is how new moving covers are made. */

  /* ---- microbes: Look Alive's cells live on the rim of its block ----
     A colony of about sixteen lives inside the glass case, over the block's cover, drifting and bouncing off its
     edges. The glass is cracked in the top-right corner. Now and then one swims to the crack and squeezes out onto
     the frame, crawls its rim, crosses to nearby blocks, and fades out about a minute after it escaped. The colony
     divides to replace it. The block keeps its own cover (no art); everything is drawn over the pile.
     They look like bacteria under a microscope: lavender rods (bacilli) with bright edges and darker middles,
     some joined end to end in short chains, and small red rings (cocci). No tails. */
  var SC = 3, sprites = {};
  /* a rod or a ring drawn once, three times over size, with a soft glow, then scaled down when used */
  function sprite(kind, a, b) {
    var key = kind + a.toFixed(1) + 'x' + b.toFixed(1);
    if (sprites[key]) return sprites[key];
    var pad = 4, w = kind === 'rod' ? a : b * 2, h = kind === 'rod' ? b : b * 2;
    var c = document.createElement('canvas'); c.width = Math.ceil((w + pad * 2) * SC); c.height = Math.ceil((h + pad * 2) * SC);
    var g = c.getContext('2d'); g.scale(SC, SC); g.translate(pad, pad);
    g.beginPath();
    if (kind === 'rod') { var r = h / 2; g.moveTo(r, 0); g.lineTo(w - r, 0); g.arc(w - r, r, r, -Math.PI / 2, Math.PI / 2); g.lineTo(r, h); g.arc(r, r, r, Math.PI / 2, Math.PI * 1.5); g.closePath(); }
    else g.arc(b, b, b - .6, 0, Math.PI * 2);
    g.shadowColor = kind === 'rod' ? 'rgba(170,150,255,.9)' : 'rgba(255,90,70,.85)'; g.shadowBlur = 3;
    g.fillStyle = kind === 'rod' ? 'rgba(92,72,196,.72)' : 'rgba(40,8,12,.55)'; g.fill();
    g.shadowBlur = 0; g.lineWidth = kind === 'rod' ? 1.1 : 1.4;
    g.strokeStyle = kind === 'rod' ? '#e4ddff' : '#ff8f78'; g.stroke();
    return (sprites[key] = { c: c, w: w + pad * 2, h: h + pad * 2 });
  }
  var INSIDE = 16, OUT_MAX = 3, SWIM = [5, 10], CRAWL = [4, 9], CROSS = 18, LIFE = [50, 70], FADE = 4;
  function rnd(a, b) { return a + Math.random() * (b - a); }
  /* a point on a block's rim, `d` pixels along it clockwise from the top-left corner, in screen space */
  function rim(b, d, inset) {
    var hw = Math.max(4, b.w / 2 - inset), hh = Math.max(4, b.h / 2 - inset), per = 4 * (hw + hh), lx, ly, tx, ty;
    d = ((d % per) + per) % per;
    if (d < 2 * hw) { lx = -hw + d; ly = -hh; tx = 1; ty = 0; }
    else if ((d -= 2 * hw) < 2 * hh) { lx = hw; ly = -hh + d; tx = 0; ty = 1; }
    else if ((d -= 2 * hh) < 2 * hw) { lx = hw - d; ly = hh; tx = -1; ty = 0; }
    else { d -= 2 * hw; lx = -hw; ly = hh - d; tx = 0; ty = -1; }
    var c = Math.cos(b.a), s = Math.sin(b.a);
    return { x: b.x + lx * c - ly * s, y: b.y + lx * s + ly * c, tx: tx * c - ty * s, ty: tx * s + ty * c, per: per };
  }
  /* the spot on a block's rim nearest to (x, y), as a distance along it */
  function nearestOnRim(b, x, y, inset) {
    var per = rim(b, 0, inset).per, best = 0, bd = Infinity;
    for (var k = 0; k < 48; k++) { var d = per * k / 48, p = rim(b, d, inset), e = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y); if (e < bd) { bd = e; best = d; } }
    return best;
  }
  function toScreen(b, lx, ly) { var c = Math.cos(b.a), s = Math.sin(b.a); return { x: b.x + lx * c - ly * s, y: b.y + lx * s + ly * c }; }
  function microbe() {
    return { kind: Math.random() < .65 ? 'rod' : 'ring', len: rnd(11, 17), wid: rnd(4.2, 5.2), r: rnd(3.3, 4.2), links: Math.random() < .5 ? 1 : Math.random() < .6 ? 2 : 3, kink: rnd(-.18, .18), ph: Math.random() * 6.28, alpha: 0 };
  }
  /* one microbe at (x, y) facing ang: a ring just sits; a rod's chain trails behind it */
  function paint(g, q, x, y, ang, a) {
    g.globalAlpha = a;
    if (q.kind === 'ring') { var sr = sprite('ring', 0, q.r); g.drawImage(sr.c, x - sr.w / 2, y - sr.h / 2, sr.w, sr.h); return; }
    var sp = sprite('rod', q.len, q.wid);
    for (var k = 0; k < q.links; k++) {
      g.save(); g.translate(x, y); g.rotate(ang); g.drawImage(sp.c, -sp.w / 2, -sp.h / 2, sp.w, sp.h); g.restore();
      ang += q.kink; x -= Math.cos(ang) * (q.len + .8); y -= Math.sin(ang) * (q.len + .8);
    }
  }
  /* the crack: a few jagged lines spreading from the corner of the glass, worked out once */
  function crackLines() {
    var lines = [], k, j;
    for (k = 0; k < 6; k++) {
      var ang = Math.PI * (.52 + k * .09 + rnd(-.03, .03)), len = k === 0 || k === 5 ? rnd(8, 12) : rnd(14, 30), pts = [[0, 0]], x = 0, y = 0;
      for (j = 1; j <= 4; j++) { var aa = ang + rnd(-.35, .35); x += Math.cos(aa) * len / 4; y += Math.sin(aa) * len / 4; pts.push([x, y]); }
      lines.push(pts);
    }
    return lines;
  }
  JBStack.rules.microbes = {
    over: function (g, S) {
      var st = S.state, me = S.blocks[S.self], t = S.t, dt = S.dt, k, q;
      var inset = Math.max(5, S.U * .035);
      if (!st.inside) { st.inside = []; st.out = []; st.esc = t + rnd(3, 6); st.split = 0; st.crack = crackLines(); }

      /* the colony lives over the cover, behind the glass: a box in the block's own coordinates */
      var c = me && me.c, box = null, gap = null;
      if (me) {
        box = c ? { x0: c.x - me.w / 2 + 2, y0: c.y - me.h / 2 + 2, x1: c.x + c.w - me.w / 2 - 2, y1: c.y + c.h - me.h / 2 - 2 } : { x0: -me.w / 2 + 8, y0: -me.h / 2 + 8, x1: me.w / 2 - 8, y1: me.h / 2 - 8 };
        gap = { x: box.x1 - 1, y: box.y0 + 1 }; /* the crack is in the top-right corner */
        if (!st.inside.length) for (k = 0; k < INSIDE; k++) { q = microbe(); q.lx = rnd(box.x0, box.x1); q.ly = rnd(box.y0, box.y1); q.ang = rnd(0, 6.28); q.v = rnd(SWIM[0], SWIM[1]); q.alpha = 1; st.inside.push(q); }
      }

      /* inside: drift, turn a little, bounce off the edges of the case; one at a time heads for the crack */
      if (me && dt) {
        if (t > st.esc && st.out.length < OUT_MAX && st.inside.length > 6 && !st.inside.some(function (m) { return m.escaping; })) {
          st.esc = t + rnd(9, 18);
          var pick = st.inside.slice().sort(function (a, b) { return Math.hypot(a.lx - gap.x, a.ly - gap.y) - Math.hypot(b.lx - gap.x, b.ly - gap.y); })[Math.floor(Math.random() * 3)];
          if (pick) pick.escaping = true;
        }
        if (st.inside.length < INSIDE && t > st.split && st.inside.length) {
          /* the colony divides to replace what got away */
          st.split = t + rnd(4, 8);
          var par = st.inside[Math.floor(Math.random() * st.inside.length)], kid = microbe();
          kid.kind = par.kind; kid.lx = par.lx + rnd(-4, 4); kid.ly = par.ly + rnd(-4, 4); kid.ang = par.ang + rnd(-.6, .6); kid.v = rnd(SWIM[0], SWIM[1]);
          st.inside.push(kid);
        }
        st.inside.forEach(function (m) {
          if (m.alpha < 1) m.alpha = Math.min(1, m.alpha + dt / 2);
          if (m.escaping) {
            var want = Math.atan2(gap.y - m.ly, gap.x - m.lx), d = Math.hypot(gap.x - m.lx, gap.y - m.ly);
            m.ang += Math.atan2(Math.sin(want - m.ang), Math.cos(want - m.ang)) * Math.min(1, dt * 3);
            if (d < 3) { m.gone = true; return; }
          } else m.ang += rnd(-1, 1) * dt * 1.4;
          m.lx += Math.cos(m.ang) * m.v * dt; m.ly += Math.sin(m.ang) * m.v * dt;
          if (!m.escaping) {
            if (m.lx < box.x0 || m.lx > box.x1) { m.ang = Math.PI - m.ang; m.lx = Math.max(box.x0, Math.min(box.x1, m.lx)); }
            if (m.ly < box.y0 || m.ly > box.y1) { m.ang = -m.ang; m.ly = Math.max(box.y0, Math.min(box.y1, m.ly)); }
          }
        });
        /* through the crack and out onto the frame */
        st.inside = st.inside.filter(function (m) {
          if (!m.gone) return true;
          var corner = toScreen(me, me.w / 2, -me.h / 2), o = m;
          o.host = S.self; o.d = nearestOnRim(me, corner.x, corner.y, inset); o.dir = Math.random() < .5 ? -1 : 1; o.v = rnd(CRAWL[0], CRAWL[1]);
          o.mode = 'rim'; o.left = t; o.life = rnd(LIFE[0], LIFE[1]); o.next = t + rnd(5, 10); o.x = corner.x; o.y = corner.y; o.hx = 1; o.hy = 0;
          st.out.push(o); return false;
        });
      }

      /* outside: crawl the rim, cross to a nearby block, explore, fade about a minute after getting out */
      function go(o, to) { var b = S.blocks[to]; if (!b) return; o.mode = 'cross'; o.to = to; o.toD = nearestOnRim(b, o.x, o.y, inset); }
      st.out.forEach(function (o) {
        var b = S.blocks[o.host];
        if (!b || (o.mode === 'cross' && !S.blocks[o.to]) || t - o.left > o.life) o.dying = true;
        if (o.dying) o.alpha -= dt / (o.mode === 'cross' || !b ? 1.2 : FADE);
        if (o.mode === 'rim' && b) {
          if (dt && Math.random() < dt * .08) o.dir = -o.dir;
          o.d += o.dir * o.v * dt;
          var p = rim(b, o.d, inset); o.x = p.x; o.y = p.y; o.hx = p.tx * o.dir; o.hy = p.ty * o.dir;
          if (!o.dying && t > o.next) { o.next = t + rnd(14, 24); var nb = S.blocks.map(function (n, i) { return n && i !== o.host && i !== S.self ? { i: i, e: Math.hypot(n.x - b.x, n.y - b.y) } : null; }).filter(Boolean).sort(function (a, z) { return a.e - z.e; }).slice(0, 3); if (nb.length) go(o, nb[Math.floor(Math.random() * nb.length)].i); }
        } else if (o.mode === 'cross' && S.blocks[o.to]) {
          var aim = rim(S.blocks[o.to], o.toD, inset), dx = aim.x - o.x, dy = aim.y - o.y, n = Math.hypot(dx, dy) || 1, step = CROSS * dt;
          o.hx = dx / n; o.hy = dy / n;
          if (n <= step) { o.mode = 'rim'; o.host = o.to; o.d = o.toD; o.x = aim.x; o.y = aim.y; o.next = t + rnd(14, 24); }
          else { o.x += o.hx * step; o.y += o.hy * step; }
        }
      });
      st.out = st.out.filter(function (o) { return o.alpha > 0; });

      if (me) {
        g.save(); g.translate(me.x, me.y); g.rotate(me.a);
        /* inside the case: clipped to the cover and a little dimmer, as if seen through the glass */
        g.save(); g.beginPath(); g.rect(box.x0 - 2, box.y0 - 2, box.x1 - box.x0 + 4, box.y1 - box.y0 + 4); g.clip();
        st.inside.forEach(function (m) { paint(g, m, m.lx, m.ly, m.ang + Math.sin(t * .7 + m.ph) * .05, .82 * m.alpha * S.lit); });
        g.restore();
        /* the crack in the glass, over everything inside */
        g.translate(gap.x + 1, gap.y - 1); g.globalAlpha = S.lit; g.lineJoin = 'round'; g.lineCap = 'round';
        g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(-7, 0); g.lineTo(-2, 3); g.lineTo(0, 7); g.closePath(); g.fill();
        [['rgba(0,0,0,.45)', 1.6, .7], ['rgba(255,255,255,.85)', .9, 0]].forEach(function (pen) {
          g.strokeStyle = pen[0]; g.lineWidth = pen[1];
          st.crack.forEach(function (pts) { g.beginPath(); pts.forEach(function (pt, i) { if (i) g.lineTo(pt[0] + pen[2], pt[1] + pen[2]); else g.moveTo(pt[0] + pen[2], pt[1] + pen[2]); }); g.stroke(); });
        });
        g.restore();
      }
      st.out.forEach(function (o) { if (o.alpha > .01) paint(g, o, o.x, o.y, Math.atan2(o.hy, o.hx) + Math.sin(t * .7 + o.ph) * .05, Math.max(0, o.alpha) * S.lit); });
      g.globalAlpha = 1;
    }
  };

  /* ---- ants: Picnic Raid's ants raid the pile ----
     A few ants mill around the rim of the block. Every so often a column of them marches out in single file
     behind a leader: across to a nearby block, along part of its edge, and home again, carrying crumbs back.
     Followers walk the leader's exact path, a fixed distance apart. The block keeps its own cover (no art). */
  var ANT = { home: 5, file: 8, gap: 13, walk: 14, lap: [.25, .4], every: [14, 24] };
  function antPaint(g, x, y, ang, step, crumb, a) {
    g.save(); g.translate(x, y); g.rotate(ang); g.scale(1.5, 1.5); g.globalAlpha = a;
    /* legs first: three a side, swinging in turn */
    g.strokeStyle = '#3a120b'; g.lineWidth = .8; g.lineCap = 'round';
    for (var k = -1; k <= 1; k++) {
      var sw = Math.sin(step + k * 2.1) * 1.4;
      g.beginPath(); g.moveTo(k * 1.6, 0); g.lineTo(k * 1.6 + sw, -3.4); g.moveTo(k * 1.6, 0); g.lineTo(k * 1.6 - sw, 3.4); g.stroke();
    }
    g.fillStyle = '#8a2414'; /* Picnic Raid's ants are red */
    g.beginPath(); g.ellipse(-3.4, 0, 2.3, 1.7, 0, 0, Math.PI * 2); g.fill();   /* abdomen */
    g.beginPath(); g.ellipse(0, 0, 1.4, 1.1, 0, 0, Math.PI * 2); g.fill();      /* thorax */
    g.beginPath(); g.arc(2.6, 0, 1.3, 0, Math.PI * 2); g.fill();                /* head */
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = .6; g.beginPath(); g.arc(-3.6, -.5, 1.1, Math.PI * 1.1, Math.PI * 1.7); g.stroke();
    if (crumb) { g.fillStyle = '#f4d58a'; g.strokeStyle = '#8a5a1c'; g.lineWidth = .6; g.beginPath(); g.rect(3.4, -1.6, 3, 3); g.fill(); g.stroke(); }
    g.restore();
  }
  JBStack.rules.ants = {
    over: function (g, S) {
      var st = S.state, me = S.blocks[S.self], t = S.t, dt = S.dt, inset = Math.max(4, S.U * .03);
      if (!me) return;
      var per = rim(me, 0, inset).per;
      if (!st.home) {
        st.home = []; st.march = null; st.next = t + rnd(4, 8);
        for (var k = 0; k < ANT.home; k++) st.home.push({ d: rnd(0, per), dir: Math.random() < .5 ? -1 : 1, v: rnd(8, 13), step: rnd(0, 6) });
      }

      /* the ants at home wander the rim, turning back now and then */
      st.home.forEach(function (a) { if (dt && Math.random() < dt * .25) a.dir = -a.dir; a.d += a.dir * a.v * dt; a.step += a.v * dt * .9; });

      /* a march: the leader's path is recorded, the file follows it */
      if (!st.march && dt && t > st.next) {
        var near = S.blocks.map(function (b, i) { return b && i !== S.self ? { i: i, e: Math.hypot(b.x - me.x, b.y - me.y) } : null; }).filter(Boolean).sort(function (a, b) { return a.e - b.e; }).slice(0, 3);
        if (near.length) {
          var to = near[Math.floor(Math.random() * near.length)].i, start = rnd(0, per), p0 = rim(me, start, inset);
          st.march = { leg: 'out', to: to, d: start, dir: Math.random() < .5 ? -1 : 1, x: p0.x, y: p0.y, path: [[p0.x, p0.y]], len: [0], done: 0, fade: 1, step: 0 };
        }
      }
      var m = st.march;
      if (m && dt) {
        var step = ANT.walk * dt, tb = S.blocks[m.to];
        if (!tb && m.leg !== 'home' && m.leg !== 'back' && m.leg !== 'end') { m.leg = 'back'; m.aim = nearestOnRim(me, m.x, m.y, inset); }
        if (m.leg === 'out' || m.leg === 'back') {
          /* cross the gap in a straight line to the nearest point on the other block (or home) */
          var target = m.leg === 'out' ? tb : me;
          if (m.aim === undefined) m.aim = nearestOnRim(target, m.x, m.y, inset);
          var p = rim(target, m.aim, inset), dx = p.x - m.x, dy = p.y - m.y, n = Math.hypot(dx, dy) || 1;
          if (n <= step) { m.x = p.x; m.y = p.y; m.d = m.aim; m.aim = undefined; m.walked = 0; m.leg = m.leg === 'out' ? 'visit' : 'home'; m.lap = rnd(ANT.lap[0], ANT.lap[1]) * rim(target, 0, inset).per; }
          else { m.x += dx / n * step; m.y += dy / n * step; }
        } else if (m.leg === 'visit' || m.leg === 'home') {
          var host = m.leg === 'visit' ? tb : me;
          m.d += m.dir * step; m.walked += step;
          var q = rim(host, m.d, inset); m.x = q.x; m.y = q.y;
          if (m.walked > m.lap) { if (m.leg === 'visit') { m.leg = 'back'; m.turn = m.path.length; } else m.leg = 'end'; }
        }
        if (m.leg !== 'end') {
          var last = m.path[m.path.length - 1], seg = Math.hypot(m.x - last[0], m.y - last[1]);
          if (seg > 1.5) { m.path.push([m.x, m.y]); m.len.push(m.len[m.len.length - 1] + seg); }
        } else m.done += step;
        m.step += step * .9;
        /* the march is over when the last ant has reached the end of the path */
        if (m.leg === 'end' && m.done > (ANT.file - 1) * ANT.gap) { st.march = null; st.next = t + rnd(ANT.every[0], ANT.every[1]); }
      }

      /* draw: home ants, then the file (each ant found by distance along the leader's path) */
      st.home.forEach(function (a) { var p = rim(me, a.d, inset); antPaint(g, p.x, p.y, Math.atan2(p.ty * a.dir, p.tx * a.dir), a.step, false, .95 * S.lit); });
      m = st.march;
      if (m) {
        var total = m.len[m.len.length - 1] + m.done, j = m.len.length - 1;
        for (var f = 0; f < ANT.file; f++) {
          var at = total - f * ANT.gap;
          if (at < 0) break;
          if (at > m.len[m.len.length - 1]) continue; /* already home and gone in */
          while (j > 0 && m.len[j - 1] > at) j--;
          var i0 = Math.max(0, j - 1), a0 = m.path[i0], a1 = m.path[j], sl = (m.len[j] - m.len[i0]) || 1, u = (at - m.len[i0]) / sl;
          var x = a0[0] + (a1[0] - a0[0]) * u, y = a0[1] + (a1[1] - a0[1]) * u;
          antPaint(g, x, y, Math.atan2(a1[1] - a0[1], a1[0] - a0[0]), m.step - f * 1.3, m.turn !== undefined && j >= m.turn, .95 * S.lit);
        }
      }
      g.globalAlpha = 1;
    }
  };
})();
