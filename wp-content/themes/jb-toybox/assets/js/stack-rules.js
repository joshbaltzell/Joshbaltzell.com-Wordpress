/* Josh Baltzell: extra rules for special blocks in the stack.
   stack.js ships two rules, sun and hole. These are added for particular toys. A rule's art(g, w, h, t, heat, C)
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

  /* ---- tunnel: flying forward through Jam Tunnel. Frames rush outward from the far end; the bars are notes. ---- */
  var NOTES = [
    { side: 'floor', at: .32, z: .05, c: '#7cc7ff', len: .16 }, { side: 'floor', at: .66, z: .42, c: '#7cc7ff', len: .12 },
    { side: 'left', at: .45, z: .22, c: '#ff8a3d', len: .2 }, { side: 'right', at: .58, z: .61, c: '#c58cff', len: .22 },
    { side: 'roof', at: .5, z: .78, c: '#6bf3b8', len: .2 }, { side: 'left', at: .7, z: .9, c: '#c58cff', len: .16 },
    { side: 'right', at: .3, z: .33, c: '#6bf3b8', len: .14 }
  ];
  JBStack.rules.tunnel = {
    art: function (g, w, h, t, heat, C) {
      var cx = w / 2, cy = h / 2, speed = .28, RINGS = 6, i, z, s;
      g.fillStyle = C['part-night']; g.fillRect(0, 0, w, h);
      /* how big a frame is drawn at depth z: 0 is the far end, 1 is just past the viewer */
      function scale(z) { return .1 + 1.15 * z * z; }
      g.strokeStyle = '#ff8a3d'; g.lineJoin = 'miter';
      /* the four seams of the tunnel */
      g.globalAlpha = .4; g.lineWidth = 1.5; g.beginPath();
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (c) { g.moveTo(cx + c[0] * w * .05, cy + c[1] * h * .05); g.lineTo(cx + c[0] * w * .64, cy + c[1] * h * .64); });
      g.stroke();
      /* frames coming toward you */
      for (i = 0; i < RINGS; i++) {
        z = (i / RINGS + t * speed) % 1; s = scale(z);
        g.globalAlpha = .25 + .75 * z; g.lineWidth = 1 + 2 * z;
        g.strokeRect(cx - w * s / 2, cy - h * s / 2, w * s, h * s);
      }
      /* notes riding the walls */
      NOTES.forEach(function (n) {
        var z0 = (n.z + t * speed) % 1, s0 = scale(z0), bw = w * s0, bh = h * s0, x0 = cx - bw / 2, y0 = cy - bh / 2, th = 1.5 + 5 * z0;
        g.globalAlpha = Math.min(1, .3 + z0 * 1.4); g.fillStyle = n.c;
        if (n.side === 'floor') g.fillRect(x0 + bw * n.at - bw * n.len / 2, y0 + bh - th * 1.6, bw * n.len, th);
        else if (n.side === 'roof') g.fillRect(x0 + bw * n.at - bw * n.len / 2, y0 + th * .6, bw * n.len, th);
        else if (n.side === 'left') g.fillRect(x0 + th * .6, y0 + bh * n.at - bh * n.len / 2, th, bh * n.len);
        else g.fillRect(x0 + bw - th * 1.6, y0 + bh * n.at - bh * n.len / 2, th, bh * n.len);
      });
      g.globalAlpha = 1;
    }
  };
})();
