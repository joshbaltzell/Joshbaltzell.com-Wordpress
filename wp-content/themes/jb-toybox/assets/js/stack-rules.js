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
  JBStack.rules.pond = {
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
     A small colony crawls slowly round the edge of the box. Every so often one leaves, crosses to a nearby
     block, explores its rim, maybe hops to another, and fades out about a minute after it set off. The colony
     buds a new cell to replace it. The block keeps its own cover (no art); everything is drawn over the pile.
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
  var COLONY = 8, CRAWL = [4, 9], CROSS = 18, LIFE = [50, 70], FADE = 4;
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
  function born(home, d, now) {
    return { host: home, d: d, dir: Math.random() < .5 ? -1 : 1, v: rnd(CRAWL[0], CRAWL[1]), kind: Math.random() < .65 ? 'rod' : 'ring', len: rnd(11, 17), wid: rnd(4.2, 5.2), r: rnd(3.3, 4.2), links: Math.random() < .5 ? 1 : Math.random() < .6 ? 2 : 3, kink: rnd(-.18, .18), ph: Math.random() * 6.28, mode: 'rim', left: 0, alpha: 0, x: 0, y: 0, hx: 1, hy: 0, next: now + rnd(12, 24) };
  }
  JBStack.rules.microbes = {
    over: function (g, S) {
      var st = S.state, me = S.blocks[S.self], t = S.t, dt = S.dt, k, m;
      if (!st.list) { st.list = []; st.wander = t + rnd(6, 12); st.bud = 0; }
      var inset = Math.max(5, S.U * .035);
      if (me && !st.list.length) for (k = 0; k < COLONY; k++) { m = born(S.self, (k + Math.random() * .6) / COLONY * rim(me, 0, inset).per, t); m.alpha = 1; st.list.push(m); }

      /* send one out now and then, never more than two away at once */
      var out = st.list.filter(function (q) { return q.left; }).length;
      if (me && dt && t > st.wander && out < 2) {
        st.wander = t + rnd(14, 28);
        var homers = st.list.filter(function (q) { return !q.left && q.mode === 'rim' && q.alpha >= 1; });
        var near = S.blocks.map(function (b, i) { return b && i !== S.self ? { i: i, e: Math.hypot(b.x - me.x, b.y - me.y) } : null; }).filter(Boolean).sort(function (a, b) { return a.e - b.e; }).slice(0, 4);
        if (homers.length > 3 && near.length) { m = homers[Math.floor(Math.random() * homers.length)]; m.left = t; m.life = rnd(LIFE[0], LIFE[1]); go(m, near[Math.floor(Math.random() * near.length)].i); }
      }
      /* keep the colony topped up, one bud at a time */
      var home = st.list.filter(function (q) { return !q.left; }).length;
      if (me && dt && home < COLONY && t > st.bud) { st.bud = t + rnd(8, 16); m = born(S.self, Math.random() * rim(me, 0, inset).per, t); st.list.push(m); }

      function go(q, to) { var b = S.blocks[to]; if (!b) return; q.mode = 'cross'; q.to = to; q.toD = nearestOnRim(b, q.x, q.y, inset); }

      st.list.forEach(function (q) {
        var b = S.blocks[q.host];
        /* the block it is on has left the well: an explorer fades, a homebody waits */
        if (q.left && (!b || (q.mode === 'cross' && !S.blocks[q.to]))) q.dying = true;
        if (q.left && t - q.left > q.life) q.dying = true;
        if (q.dying) q.alpha -= dt / (q.mode === 'cross' || !b ? 1.2 : FADE); else if (q.alpha < 1) q.alpha = Math.min(1, q.alpha + dt / 2);
        if (!b && !q.left) return;
        if (q.mode === 'rim' && b) {
          if (dt && Math.random() < dt * .08) q.dir = -q.dir; /* now and then it changes its mind */
          q.d += q.dir * q.v * dt;
          var p = rim(b, q.d, inset); q.x = p.x; q.y = p.y; q.hx = p.tx * q.dir; q.hy = p.ty * q.dir;
          if (q.left && !q.dying && t > q.next) { q.next = t + rnd(14, 24); var nb = S.blocks.map(function (o, i) { return o && i !== q.host && i !== S.self ? { i: i, e: Math.hypot(o.x - b.x, o.y - b.y) } : null; }).filter(Boolean).sort(function (a, c) { return a.e - c.e; })[0]; if (nb) go(q, nb.i); }
        } else if (q.mode === 'cross' && S.blocks[q.to]) {
          var aim = rim(S.blocks[q.to], q.toD, inset), dx = aim.x - q.x, dy = aim.y - q.y, n = Math.hypot(dx, dy) || 1, step = CROSS * dt;
          q.hx = dx / n; q.hy = dy / n;
          if (n <= step) { q.mode = 'rim'; q.host = q.to; q.d = q.toD; q.x = aim.x; q.y = aim.y; q.next = t + rnd(14, 24); }
          else { q.x += q.hx * step; q.y += q.hy * step; }
        }
      });
      st.list = st.list.filter(function (q) { return q.alpha > 0 || !q.dying; });

      /* draw: a rod lies along the way it is going, its chain trailing behind; a ring just sits */
      st.list.forEach(function (q) {
        var a = Math.max(0, q.alpha) * S.lit; if (a <= .01 || (!S.blocks[q.host] && !q.left)) return;
        g.globalAlpha = a;
        if (q.kind === 'ring') { var sr = sprite('ring', 0, q.r); g.drawImage(sr.c, q.x - sr.w / 2, q.y - sr.h / 2, sr.w, sr.h); return; }
        var sp = sprite('rod', q.len, q.wid), ang = Math.atan2(q.hy, q.hx) + Math.sin(t * .7 + q.ph) * .05, x = q.x, y = q.y;
        for (var k = 0; k < q.links; k++) {
          g.save(); g.translate(x, y); g.rotate(ang); g.drawImage(sp.c, -sp.w / 2, -sp.h / 2, sp.w, sp.h); g.restore();
          ang += q.kink; x -= Math.cos(ang) * (q.len + .8); y -= Math.sin(ang) * (q.len + .8);
        }
      });
      g.globalAlpha = 1;
    }
  };
})();
