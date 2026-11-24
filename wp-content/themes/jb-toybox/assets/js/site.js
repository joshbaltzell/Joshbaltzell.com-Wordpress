/* Josh Baltzell: the shell's only script besides the stack.
   A game frame is a <details> holding an <iframe>. Closing it would only hide the game, which would keep
   running and keep playing sound. This empties the frame on Stop and loads it again on Play.
   Without this script the frame still opens and plays. */
(function () {
  'use strict';
  document.addEventListener('toggle', function (event) {
    var stage = event.target;
    if (!stage.classList || !stage.classList.contains('game__stage')) return;
    var frame = stage.querySelector('iframe');
    if (!frame) return;
    if (!frame.dataset.src) frame.dataset.src = frame.getAttribute('src');
    if (stage.open) { frame.setAttribute('src', frame.dataset.src); frame.focus(); }
    else frame.setAttribute('src', 'about:blank');
  }, true);
})();

/* Looking into the boxes, and into the well they sit in.
   Each block is drawn as a shallow box with its content on the back wall, and the well is a deeper cabinet
   behind them. Your eye is the pointer when there is one; on a touch screen it is a fixed point a little above
   the middle of the screen, so the view changes as you scroll instead.
   - A box left of the eye shows more of its left wall, a box below it shows more of its floor, and so on.
   - The content slides across the back wall to match, and the glare on the glass moves the other way.
   - The well's side walls do the same, its dotted back wall drifts a little, and the shadows the blocks cast
     on that back wall drift with it. Things further away move less than things close up, which is the depth.
   Opposite walls always add up to the same size, so nothing changes size and nothing re-wraps.
   With reduced motion, every box and the well keep their resting view. */
(function () {
  'use strict';
  if (!window.matchMedia || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var SIDES = 9.8, UPDOWN = 6.4;          /* left + right walls, and ceiling + floor, in cqw */
  var REST_L = .653, REST_B = .656;       /* shares at rest: looking in from above and to the right */
  var REACH = 700, SWING = .36;           /* px from the eye for a full swing, and how far a share may move */
  var hasMouse = matchMedia('(pointer: fine)').matches;
  var blocks = [], wells = [], state = [], wstate = [], pointer = null, raf = 0, idle = 0;
  var age = [];
  function collect() { blocks = [].slice.call(document.querySelectorAll('.blk')); wells = [].slice.call(document.querySelectorAll('.rack .well')); state = []; wstate = []; age = blocks.map(function (b) { return parseFloat(b.style.getPropertyValue('--age')) || 0; }); }
  collect();
  /* a list swapped in without a page load brings new blocks */
  document.addEventListener('jb:content', function () { collect(); kick(); });
  function clamp(v) { return v < -1 ? -1 : v > 1 ? 1 : v; }
  function ease(now, want) { var next = now + (want - now) * .18; return Math.abs(want - next) < .002 ? want : next; }
  function eye() { return pointer || (hasMouse ? null : { x: innerWidth / 2, y: innerHeight * .42 }); }
  function frame() {
    raf = 0;
    var e = eye(), moving = false, i, r, rects = [], wrects = [];
    /* read everything first, then write, so the browser lays the page out once */
    for (i = 0; i < blocks.length; i++) rects[i] = blocks[i].getBoundingClientRect();
    for (i = 0; i < wells.length; i++) wrects[i] = wells[i].getBoundingClientRect();
    for (i = 0; i < blocks.length; i++) {
      r = rects[i]; if (!r.width || r.bottom < -300 || r.top > innerHeight + 300) continue;
      var st = state[i] || (state[i] = { l: REST_L, b: REST_B }), wl = REST_L, wb = REST_B;
      /* older things sit further back, so they turn less as your eye moves */
      var sw = SWING * (1 - .6 * age[i]);
      if (e) { wl = .5 + clamp((e.x - (r.left + r.width / 2)) / REACH) * sw; wb = .5 + clamp(((r.top + r.height / 2) - e.y) / REACH) * sw; }
      var nl = ease(st.l, wl), nb = ease(st.b, wb);
      if (nl !== wl || nb !== wb) moving = true;
      if (nl !== st.l || nb !== st.b || !st.set) {
        st.l = nl; st.b = nb; st.set = true;
        var bs = blocks[i].style;
        bs.setProperty('--wall-l', (SIDES * nl).toFixed(2) + 'cqw'); bs.setProperty('--wall-r', (SIDES * (1 - nl)).toFixed(2) + 'cqw');
        bs.setProperty('--wall-b', (UPDOWN * nb).toFixed(2) + 'cqw'); bs.setProperty('--wall-t', (UPDOWN * (1 - nb)).toFixed(2) + 'cqw');
        bs.setProperty('--glare-x', (70 - nl * 80).toFixed(1) + '%');
        /* where the eye is, -1 to 1 across and up, for anything inside the box that sits at a depth (layered covers) */
        bs.setProperty('--look-x', ((nl - .5) / SWING).toFixed(3)); bs.setProperty('--look-y', ((nb - .5) / SWING).toFixed(3));
      }
    }
    for (i = 0; i < wells.length; i++) {
      r = wrects[i]; if (r.bottom < -300 || r.top > innerHeight + 300) continue;
      var ws = wstate[i] || (wstate[i] = { x: .15, y: .15 }), wx = .15, wy = .15;
      if (e) { wx = clamp((e.x - (r.left + r.width / 2)) / (REACH * 1.3)); wy = clamp((e.y - Math.max(r.top, Math.min(e.y, r.bottom))) / REACH + (e.y - (r.top + r.height / 2)) / (REACH * 4)); }
      var nx = ease(ws.x, wx), ny = ease(ws.y, wy);
      if (nx !== wx || ny !== wy) moving = true;
      if (nx !== ws.x || ny !== ws.y || !ws.set) {
        ws.x = nx; ws.y = ny; ws.set = true;
        var s = wells[i].style;
        s.setProperty('--well-l', (16 + nx * 11).toFixed(1) + 'px'); s.setProperty('--well-r', (16 - nx * 11).toFixed(1) + 'px');
        s.setProperty('--bgx', (nx * 9).toFixed(1) + 'px'); s.setProperty('--bgy', (ny * 9).toFixed(1) + 'px');
        s.setProperty('--cast-x', (nx * 7).toFixed(1) + 'px'); s.setProperty('--cast-y', (ny * 5).toFixed(1) + 'px');
      }
    }
    if (moving) idle = 0; else idle++;
    if (idle < 40) raf = requestAnimationFrame(frame);
  }
  function kick() { idle = 0; if (!raf) raf = requestAnimationFrame(frame); }
  window.addEventListener('pointermove', function (ev) { if (ev.pointerType === 'touch') return; pointer = { x: ev.clientX, y: ev.clientY }; kick(); }, { passive: true });
  document.documentElement.addEventListener('pointerleave', function () { pointer = null; kick(); });
  window.addEventListener('blur', function () { pointer = null; kick(); });
  window.addEventListener('scroll', kick, { passive: true });
  window.addEventListener('resize', kick);
  /* blocks move while the pile drops and while it is played with, so keep looking for the first few seconds and after any press */
  window.addEventListener('pointerdown', kick, { passive: true });
  var warm = setInterval(kick, 400); setTimeout(function () { clearInterval(warm); }, 9000);
  kick();
})();

/* Moving covers: a post's looping video or live cover (set in its Block design).
   Nothing loads until the block is on screen. A cover stops when it scrolls away, when its pile's motion is
   paused, and never starts for visitors who have asked for less motion: the still picture stays instead.
   A live cover runs in a sealed frame and is sent {jb: 'play'} and {jb: 'pause'} as well. */
(function () {
  'use strict';
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var media = [].slice.call(document.querySelectorAll('.cov__media'));
  if (!media.length || reduced || !window.IntersectionObserver) return;
  var seen = new WeakMap(), paused = new WeakMap();
  function rackOf(el) { return el.closest('.rack'); }
  function allowed(el) { var r = rackOf(el); return seen.get(el) && !(r && paused.get(r)); }
  function tell(el, what) { try { el.contentWindow.postMessage({ jb: what }, '*'); } catch (e) {} }
  function start(el) {
    if (el.tagName === 'VIDEO') {
      el.onplaying = function () { el.classList.add('is-on'); };
      if (!el.getAttribute('src')) el.setAttribute('src', el.getAttribute('data-src'));
      var p = el.play(); if (p && p.catch) p.catch(function () {});
    } else if (!el.hasAttribute('srcdoc')) {
      el.onload = function () { el.classList.add('is-on'); tell(el, 'play'); };
      el.setAttribute('srcdoc', el.getAttribute('data-srcdoc'));
    } else tell(el, 'play');
  }
  function stop(el) {
    if (el.tagName === 'VIDEO') { el.pause(); return; }
    /* a live cover that scrolls away is unloaded, so nothing keeps running off screen; paused in view, it is told to hold */
    if (!seen.get(el)) { el.classList.remove('is-on'); el.removeAttribute('srcdoc'); }
    else tell(el, 'pause');
  }
  function sync(el) { if (allowed(el)) start(el); else stop(el); }
  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { seen.set(e.target, e.isIntersecting); sync(e.target); }); }, { rootMargin: '120px 0px' });
  media.forEach(function (el) { io.observe(el); });
  document.addEventListener('jb:motion', function (e) {
    var r = e.target; paused.set(r, !e.detail.on);
    media.forEach(function (el) { if (rackOf(el) === r) sync(el); });
  });
})();

/* The pile's controls roll up on a phone: one Controls button opens the buttons and the tilt handle. The button
   is hidden until this runs, so without script there is no button that does nothing. */
(function () {
  'use strict';
  [].forEach.call(document.querySelectorAll('[data-stack-tools]'), function (b) {
    var bar = b.closest('.rack__bar');
    if (!bar) return;
    b.hidden = false;
    b.addEventListener('click', function () {
      var open = !bar.classList.contains('is-open');
      bar.classList.toggle('is-open', open);
      b.setAttribute('aria-expanded', open ? 'true' : 'false');
      b.textContent = open ? 'Hide controls' : 'Controls';
    });
  });
})();
