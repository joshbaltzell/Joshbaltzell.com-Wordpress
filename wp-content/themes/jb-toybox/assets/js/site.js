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
  function collect() { blocks = [].slice.call(document.querySelectorAll('.blk')); wells = [].slice.call(document.querySelectorAll('.rack .well')); state = []; wstate = []; }
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
      r = rects[i]; if (r.bottom < -300 || r.top > innerHeight + 300) continue;
      var st = state[i] || (state[i] = { l: REST_L, b: REST_B }), wl = REST_L, wb = REST_B;
      if (e) { wl = .5 + clamp((e.x - (r.left + r.width / 2)) / REACH) * SWING; wb = .5 + clamp(((r.top + r.height / 2) - e.y) / REACH) * SWING; }
      var nl = ease(st.l, wl), nb = ease(st.b, wb);
      if (nl !== wl || nb !== wb) moving = true;
      if (nl !== st.l || nb !== st.b || !st.set) {
        st.l = nl; st.b = nb; st.set = true;
        var bs = blocks[i].style;
        bs.setProperty('--wall-l', (SIDES * nl).toFixed(2) + 'cqw'); bs.setProperty('--wall-r', (SIDES * (1 - nl)).toFixed(2) + 'cqw');
        bs.setProperty('--wall-b', (UPDOWN * nb).toFixed(2) + 'cqw'); bs.setProperty('--wall-t', (UPDOWN * (1 - nb)).toFixed(2) + 'cqw');
        bs.setProperty('--glare-x', (70 - nl * 80).toFixed(1) + '%');
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

/* More of a list without loading a new page.
   The buttons under a list ("11 older", "12 newer") and the filter chips beside it are ordinary links, and
   without this script they work as ordinary links. With it, the next list is fetched, swapped in where the
   old one was, and its pile drops in. The address bar and the Back button keep working. If anything about the
   fetched page is not what is expected, the link is simply followed the usual way. */
(function () {
  'use strict';
  if (!window.fetch || !window.DOMParser || !history.pushState) return;
  var busy = false;
  function shell(doc) { return doc.querySelector('main .l-shell'); }
  function isList(el) { return !!el && !!el.querySelector('.rack, .photo-grid') && !!el.querySelector('.l-head'); }
  function load(url, push) {
    if (busy) return; busy = true;
    var old = shell(document);
    document.documentElement.classList.add('jb-loading');
    fetch(url, { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }).then(function (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html'), next = shell(doc);
      if (!old || !isList(next) || (next.querySelector('.rack[data-stack]') && !window.JBStack)) throw new Error('not a list');
      [].forEach.call(old.querySelectorAll('.rack'), function (r) { if (r.__stack && r.__stack.destroy) r.__stack.destroy(); });
      next = document.importNode(next, true);
      old.parentNode.replaceChild(next, old);
      document.title = doc.title;
      if (push) history.pushState({ jb: 1 }, '', url);
      [].forEach.call(next.querySelectorAll('.rack[data-stack]'), function (r) { r.__stack = window.JBStack(r); });
      document.dispatchEvent(new CustomEvent('jb:content'));
      /* keep the top of the list in view, and tell keyboard and screen-reader users where they are */
      var head = next.querySelector('.l-head h1');
      if (next.getBoundingClientRect().top < 0) next.scrollIntoView({ block: 'start' });
      if (head) { head.setAttribute('tabindex', '-1'); head.focus({ preventScroll: true }); }
    }).catch(function () { location.href = url; }).then(function () { busy = false; document.documentElement.classList.remove('jb-loading'); });
  }
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest ? e.target.closest('main .l-shell .pager a[href], main .l-shell .l-spine .topics a[href]') : null;
    if (!a || a.origin !== location.origin || !isList(shell(document))) return;
    e.preventDefault(); load(a.href, true);
  });
  window.addEventListener('popstate', function () { if (isList(shell(document))) load(location.href, false); else location.reload(); });
})();
