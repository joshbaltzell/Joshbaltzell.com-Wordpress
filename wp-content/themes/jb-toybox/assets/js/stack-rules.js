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
})();
