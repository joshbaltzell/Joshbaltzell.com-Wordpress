/* Price the Lemonade.
   The top half is pure logic (no DOM) so it can run in node for checks.
   The bottom half draws the page. */
(function (root) {
  'use strict';

  /* ---------- Logic ---------- */

  const PRICES = [2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6];
  const COST = 1.2;
  const DAYS = 30;
  const HOT = [13, 19]; // the hot week in the seasonal round

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Mix two integers into one 32-bit seed (so each day gets its own stream).
  function mix(a, b) {
    let h = Math.imul((a ^ 0x9e3779b9) | 0, 0x85ebca6b) ^ Math.imul((b + 0x632be5ab) | 0, 0xc2b2ae35);
    h ^= h >>> 16; h = Math.imul(h, 0x7feb352d);
    h ^= h >>> 15; h = Math.imul(h, 0x846ca68b);
    h ^= h >>> 16;
    return h >>> 0;
  }

  function normal(rng) {
    let u = 0;
    while (u === 0) u = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
  }

  // Marsaglia and Tsang (2000). For shape < 1, boost with Gamma(k+1) * U^(1/k).
  function gammaSample(k, rng) {
    if (k < 1) {
      let u = 0;
      while (u === 0) u = rng();
      return gammaSample(k + 1, rng) * Math.pow(u, 1 / k);
    }
    const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x, v;
      do { x = normal(rng); v = 1 + c * x; } while (v <= 0);
      v = v * v * v;
      const u = rng();
      if (u < 1 - 0.0331 * x * x * x * x) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  }

  function betaSample(a, b, rng) {
    const x = gammaSample(a, rng), y = gammaSample(b, rng);
    return x / (x + y);
  }

  const isHot = (d) => d >= HOT[0] && d <= HOT[1];

  // Each curve gives the chance a visitor buys at price x on day d, and the
  // mean number of visitors on day d. j is a small per-round shift (-0.25..0.25).
  const CURVES = [
    {
      key: 'steep', name: 'Steep',
      blurb: 'Buyers dropped off quickly as the price went up.',
      make: (j) => {
        const c = 3.1 + j;
        return { buy: (x) => 0.92 / (1 + Math.exp((x - c) / 0.32)), visitors: () => 60 };
      }
    },
    {
      key: 'flat', name: 'Flat',
      blurb: 'Buyers barely cared about price, so several prices made about the same money.',
      make: (j) => {
        const r = 0.26 + j * 0.06;
        return { buy: (x) => 0.7 * Math.exp(-r * (x - 2)), visitors: () => 60 };
      }
    },
    {
      key: 'cliff', name: 'Cliff at $5.00',
      blurb: 'Almost everyone paid up to $5.00. Above that, almost nobody did.',
      make: () => ({
        buy: (x) => (0.62 - 0.025 * (x - 2)) / (1 + Math.exp((x - 5.25) / 0.06)),
        visitors: () => 60
      })
    },
    {
      key: 'hot', name: 'Hot week',
      blurb: 'Days 13 to 19 were hot. More people came, and they paid more. The dashed line is a hot day.',
      make: (j) => {
        const c = 3.4 + j;
        return {
          buy: (x, d) => 0.9 / (1 + Math.exp((x - (isHot(d) ? c + 1.4 : c)) / 0.45)),
          visitors: (d) => (isHot(d) ? 110 : 55),
          hot: HOT
        };
      }
    }
  ];

  function kindOf(seed) { return ((seed % CURVES.length) + CURVES.length) % CURVES.length; }

  function newSeed(kind, rand) {
    const r = rand || Math.random;
    return (1 + Math.floor(r() * 249999)) * CURVES.length + kind;
  }

  function makeBot(seed) {
    const rng = mulberry32(mix(seed, 0xB07));
    const arms = PRICES.map(() => ({ a: 1, b: 1 }));
    return {
      arms,
      pick() {
        const v = arms.map((arm, i) => betaSample(arm.a, arm.b, rng) * (PRICES[i] - COST));
        return v.indexOf(Math.max(...v));
      },
      observe(i, visitors, buyers) { arms[i].a += buyers; arms[i].b += visitors - buyers; }
    };
  }

  function createRound(seed) {
    const kind = kindOf(seed);
    const jr = mulberry32(mix(seed, 777));
    const curve = CURVES[kind].make((jr() - 0.5) * 0.5);
    // Visitors and their willingness are drawn once per day from the day's own
    // seed. Both players see the same visitors: a visitor buys if their number
    // is below the buy chance at the price they were shown.
    const draws = [];
    for (let d = 1; d <= DAYS; d++) {
      const r = mulberry32(mix(seed, d));
      const n = Math.max(5, Math.round(curve.visitors(d) * Math.exp(0.18 * normal(r))));
      const u = new Float64Array(n);
      for (let k = 0; k < n; k++) u[k] = r();
      draws.push({ n, u });
    }
    return { seed, kind, def: CURVES[kind], curve, draws, bot: makeBot(seed) };
  }

  function sell(round, d, i) {
    const { n, u } = round.draws[d - 1];
    const p = round.curve.buy(PRICES[i], d);
    let cups = 0;
    for (let k = 0; k < n; k++) if (u[k] < p) cups++;
    return { i, visitors: n, cups, profit: cups * (PRICES[i] - COST) };
  }

  // What each fixed price would have made over the whole month, on the same visitors.
  function hindsight(round) {
    const totals = PRICES.map((_, i) => {
      let s = 0;
      for (let d = 1; d <= DAYS; d++) s += sell(round, d, i).profit;
      return s;
    });
    const best = totals.indexOf(Math.max(...totals));
    return { totals, best, bestTotal: totals[best] };
  }

  // Expected profit per day at each price, for drawing the revealed curve.
  function expectedProfit(round, x, d) {
    return round.curve.visitors(d) * round.curve.buy(x, d) * (x - COST);
  }

  // When a player settled: the price they used most in the last week, and the
  // earliest day from which at least 80% of their picks were that price.
  function settle(picks) {
    const n = picks.length, tail = picks.slice(-7);
    const count = (arr, i) => arr.filter((p) => p === i).length;
    const ranked = PRICES.map((_, i) => i).filter((i) => count(tail, i))
      .sort((a, b) => count(tail, b) - count(tail, a) || (b === tail[tail.length - 1]) - (a === tail[tail.length - 1]));
    const main = ranked[0];
    for (let s = 1; s <= n; s++) {
      if (picks[s - 1] !== main) continue;
      const rest = picks.slice(s - 1), share = count(rest, main) / rest.length;
      if (share >= 0.8) return { day: s, price: main, exact: share === 1, ranked, distinct: new Set(picks).size };
    }
    return { day: n, price: main, exact: true, ranked, distinct: new Set(picks).size };
  }

  // Play a whole round with a policy (for checks in node).
  function simulate(seed, policy) {
    const round = createRound(seed);
    const rr = mulberry32(mix(seed, 0x5EED));
    let you = 0, bot = 0;
    for (let d = 1; d <= DAYS; d++) {
      const yi = policy === 'random' ? Math.floor(rr() * PRICES.length) : 0;
      you += sell(round, d, yi).profit;
      const bi = round.bot.pick();
      const b = sell(round, d, bi);
      round.bot.observe(bi, b.visitors, b.cups);
      bot += b.profit;
    }
    const h = hindsight(round);
    return { kind: CURVES[round.kind].key, best: PRICES[h.best], bestTotal: h.bestTotal, randomRegret: h.bestTotal - you, botRegret: h.bestTotal - bot };
  }

  const Logic = {
    PRICES, COST, DAYS, CURVES, mulberry32, mix, gammaSample, betaSample,
    kindOf, newSeed, makeBot, createRound, sell, hindsight, expectedProfit, settle, simulate
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Logic;
  if (typeof document === 'undefined') return;

  /* ---------- Page ---------- */

  const $ = (s) => document.querySelector(s);
  const money = (v) => (v < 0 ? '-' : '') + '$' + Math.round(Math.abs(v)).toLocaleString('en-US');
  const price = (i) => '$' + PRICES[i].toFixed(2);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  const el = {
    play: $('#play'), end: $('#end'), day: $('#day-label'), seed: $('#seed'),
    ladder: $('#ladder'), sellBtn: $('#sell'), five: $('#five'), rest: $('#rest'),
    youTotal: $('#you-total'), youLast: $('#you-last'), botTotal: $('#bot-total'), botLast: $('#bot-last'),
    strip: $('#strip'), stripNote: $('#strip-note'), rows: $('#rows'),
    summary: $('#summary'), results: $('#results'), curve: $('#curve'), curveName: $('#curve-name'),
    curveBlurb: $('#curve-blurb'), again: $('#again'), next: $('#next')
  };

  let state;
  let roundNo = 1;
  let busy = false;

  function start(seed) {
    state = { round: createRound(seed), days: [], sel: null, result: null };
    try { history.replaceState(null, '', '?seed=' + seed); } catch (e) { /* file:// may refuse */ }
    el.play.hidden = false;
    el.end.hidden = true;
    render();
  }

  // Price ladder
  PRICES.forEach((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip price';
    b.setAttribute('role', 'radio');
    b.dataset.i = i;
    b.innerHTML = '<span class="price__key" aria-hidden="true">' + (i + 1) + '</span>$' + p.toFixed(2);
    b.addEventListener('click', () => choose(i));
    el.ladder.appendChild(b);
  });

  function choose(i, focus) {
    if (busy || state.result) return;
    state.sel = Math.max(0, Math.min(PRICES.length - 1, i));
    renderControls();
    if (focus) el.ladder.children[state.sel].focus();
  }

  function step() {
    const r = state.round, d = state.days.length + 1;
    if (d > DAYS || state.sel === null) return false;
    const you = sell(r, d, state.sel);
    const bi = r.bot.pick();
    const bot = sell(r, d, bi);
    r.bot.observe(bi, bot.visitors, bot.cups);
    state.days.push({ d, visitors: you.visitors, you, bot });
    return true;
  }

  function run(n) {
    if (busy || state.sel === null || state.result) return;
    const target = Math.min(DAYS, state.days.length + n);
    if (n === 1 || reduce.matches) {
      while (state.days.length < target) step();
      return after();
    }
    busy = true;
    const tick = () => {
      step();
      render();
      if (state.days.length < target) setTimeout(tick, 70);
      else { busy = false; after(); }
    };
    tick();
  }

  function after() {
    if (state.days.length >= DAYS) finish();
    render();
  }

  function totals() {
    let you = 0, bot = 0;
    state.days.forEach((x) => { you += x.you.profit; bot += x.bot.profit; });
    return { you, bot };
  }

  function lastLine(x) {
    return 'Day ' + x.d + ': ' + price(x.i) + '. ' + x.cups + ' of ' + x.visitors + ' bought. ' + money(x.profit) + ' profit.';
  }

  function renderControls() {
    const done = !!state.result;
    [...el.ladder.children].forEach((b, i) => {
      const on = state.sel === i;
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.tabIndex = on || (state.sel === null && i === 0) ? 0 : -1;
      b.disabled = busy || done;
    });
    const none = state.sel === null;
    el.sellBtn.textContent = none ? 'Pick a price first' : 'Sell at ' + price(state.sel);
    el.sellBtn.disabled = none || busy || done;
    el.five.disabled = none || busy || done;
    el.rest.disabled = none || busy || done;
  }

  function render() {
    const n = state.days.length;
    el.day.textContent = 'Round ' + roundNo + ' · Day ' + Math.min(n + 1, DAYS) + ' of ' + DAYS;
    el.seed.textContent = 'Seed ' + state.round.seed;
    el.seed.href = '?seed=' + state.round.seed;
    renderControls();

    const t = totals();
    el.youTotal.textContent = money(t.you);
    el.botTotal.textContent = money(t.bot);
    if (n) {
      const x = state.days[n - 1];
      el.youLast.textContent = lastLine({ ...x.you, d: x.d });
      el.botLast.textContent = lastLine({ ...x.bot, d: x.d });
    } else {
      el.youLast.textContent = 'No sales yet.';
      el.botLast.textContent = 'No sales yet. It starts knowing nothing too.';
    }

    el.stripNote.hidden = n > 0;
    el.rows.innerHTML = '';
    if (!n) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="6" class="empty">Nothing sold yet. Each day you play shows up here, newest first.</td>';
      el.rows.appendChild(tr);
    }
    for (let k = n - 1; k >= 0; k--) {
      const x = state.days[k];
      const tr = document.createElement('tr');
      if (k === n - 1 && !state.result) tr.className = 'fresh';
      if (state.round.curve.hot && x.d >= HOT[0] && x.d <= HOT[1] && state.result) tr.className = 'hot';
      tr.innerHTML = '<td>' + x.d + '</td><td>' + x.visitors + '</td>' +
        '<td>' + price(x.you.i) + '</td><td>' + money(x.you.profit) + '</td>' +
        '<td>' + price(x.bot.i) + '</td><td>' + money(x.bot.profit) + '</td>';
      el.rows.appendChild(tr);
    }
    drawStrip();
    if (state.result) drawCurve();
  }

  /* ---------- End of round ---------- */

  function describe(picks, isYou) {
    const st = settle(picks), p = price(st.price), mostly = st.exact ? '' : 'mostly ';
    const who = isYou ? 'You' : 'The bot';
    if (st.distinct === 1) return who + ' charged ' + p + ' every day.';
    if (st.day <= 3) return who + ' landed on ' + p + ' by day ' + st.day + ' and ' + mostly + 'stayed.';
    if (st.day <= DAYS - 4) {
      return isYou
        ? 'You settled on ' + p + ' by day ' + st.day + ' and ' + mostly + 'stayed.'
        : 'The bot kept testing until day ' + st.day + ', then ' + mostly + 'stayed on ' + p + '.';
    }
    const pair = st.ranked.slice(0, 2).sort((a, b) => a - b).map(price).join(' and ');
    return who + (isYou ? ' were' : ' was') + ' still trying prices near the end, mostly ' + pair + '.';
  }

  function finish() {
    const r = state.round, h = hindsight(r), t = totals();
    const youPicks = state.days.map((x) => x.you.i), botPicks = state.days.map((x) => x.bot.i);
    state.result = { h, t, youPicks, botPicks };

    const gap = t.you - t.bot;
    let cmp;
    if (Math.abs(gap) < 1) cmp = 'You and the bot finished level.';
    else cmp = gap > 0 ? 'It finished ' + money(gap) + ' behind you.' : 'It finished ' + money(-gap) + ' ahead of you.';

    const lines = [
      describe(youPicks, true),
      describe(botPicks, false) + ' ' + cmp,
      'Looking back, the best single price was ' + price(h.best) + '. Charging it all month would have made ' + money(h.bestTotal) + '.'
    ];
    if (r.curve.hot) lines.push('A fixed price can’t follow a hot week, so a player who moved with it could beat that number.');
    const youDistinct = new Set(youPicks).size;
    if (youDistinct <= 3 && t.bot > t.you + 1) {
      lines.push('People often stop trying new prices after a few days. It feels safe, and sometimes it costs a little.');
    }
    el.summary.innerHTML = lines.map((l) => '<p>' + l + '</p>').join('');

    const regret = (v) => {
      const left = h.bestTotal - v;
      return left >= 0.5 ? money(left) : left <= -0.5 ? money(-left) + ' ahead' : '$0';
    };
    el.results.innerHTML =
      '<tr><th scope="row"><span class="key key--you"></span>You</th><td>' + money(t.you) + '</td><td>' + regret(t.you) + '</td></tr>' +
      '<tr><th scope="row"><span class="key key--bot"></span>Bot</th><td>' + money(t.bot) + '</td><td>' + regret(t.bot) + '</td></tr>' +
      '<tr><th scope="row">' + price(h.best) + ' every day</th><td>' + money(h.bestTotal) + '</td><td>—</td></tr>';

    el.curveName.textContent = 'The hidden curve: ' + r.def.name;
    el.curveBlurb.textContent = r.def.blurb;
    el.play.hidden = true;
    el.end.hidden = false;
    // Wait for layout before drawing the newly shown canvas.
    requestAnimationFrame(() => { drawCurve(); el.next.focus(); });
  }

  /* ---------- Drawing ---------- */

  const probe = document.createElement('span');
  probe.style.display = 'none';
  document.body.appendChild(probe);
  function tone(name) {
    probe.style.color = 'var(--' + name + ')';
    return getComputedStyle(probe).color;
  }
  function palette() {
    return { ink: tone('ink'), muted: tone('muted'), line: tone('line'), sunk: tone('sunk'), raised: tone('raised'), you: tone('ember'), bot: tone('note') };
  }
  const monoFont = (px) => px + 'px "JetBrains Mono", ui-monospace, Menlo, monospace';

  function setup(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return null;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    return { g, w, h };
  }

  function drawStrip() {
    const c = setup(el.strip);
    if (!c) return;
    const { g, w, h } = c, col = palette();
    const L = 46, R = 10, T = 10, B = 24;
    const X = (d) => L + ((d - 0.5) / DAYS) * (w - L - R);
    const Y = (i) => T + (1 - i / (PRICES.length - 1)) * (h - T - B);

    if (state.result && state.round.curve.hot) {
      g.fillStyle = col.sunk;
      g.fillRect(X(HOT[0] - 0.5), T - 6, X(HOT[1] + 0.5) - X(HOT[0] - 0.5), h - T - B + 12);
      g.fillStyle = col.muted; g.font = monoFont(10); g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      g.fillText('hot week', X((HOT[0] + HOT[1]) / 2), h - 6);
    }
    g.font = monoFont(11);
    g.textBaseline = 'middle';
    PRICES.forEach((p, i) => {
      g.strokeStyle = col.line; g.lineWidth = 1;
      g.beginPath(); g.moveTo(L, Y(i) + 0.5); g.lineTo(w - R, Y(i) + 0.5); g.stroke();
      if (i % 2 === 0 || h > 260) { g.fillStyle = col.muted; g.textAlign = 'right'; g.fillText('$' + p.toFixed(2), L - 6, Y(i)); }
    });
    g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = col.muted;
    [1, 10, 20, 30].forEach((d) => g.fillText(d === 1 ? 'Day 1' : String(d), X(d), h - 6));

    if (state.result) {
      const yb = Y(state.result.h.best);
      g.strokeStyle = col.ink; g.setLineDash([4, 4]); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(L, yb); g.lineTo(w - R, yb); g.stroke(); g.setLineDash([]);
    }
    const rad = Math.max(3, Math.min(5, (w - L - R) / DAYS / 3));
    state.days.forEach((x) => {
      g.strokeStyle = col.bot; g.lineWidth = 2;
      g.beginPath(); g.arc(X(x.d), Y(x.bot.i), rad + 2.5, 0, Math.PI * 2); g.stroke();
      g.fillStyle = col.you;
      g.beginPath(); g.arc(X(x.d), Y(x.you.i), rad, 0, Math.PI * 2); g.fill();
    });
  }

  function drawCurve() {
    const c = setup(el.curve);
    if (!c) return;
    const { g, w, h } = c, col = palette(), r = state.round, res = state.result;
    const L = 46, R = 12, T = 14, B = 26;
    const x0 = 1.8, x1 = 6.2;
    const days = r.curve.hot ? [1, HOT[0]] : [1];
    let max = 0;
    for (let x = 2; x <= 6.001; x += 0.05) days.forEach((d) => { max = Math.max(max, expectedProfit(r, x, d)); });
    const stepRaw = max / 4, mag = Math.pow(10, Math.floor(Math.log10(stepRaw)));
    const unit = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((m) => m >= stepRaw);
    max = unit * 4;
    const X = (x) => L + ((x - x0) / (x1 - x0)) * (w - L - R);
    const Y = (v) => T + (1 - v / max) * (h - T - B);

    g.font = monoFont(11);
    g.lineWidth = 1;
    for (let k = 0; k <= 4; k++) {
      const v = (max * k) / 4;
      g.strokeStyle = col.line;
      g.beginPath(); g.moveTo(L, Math.round(Y(v)) + 0.5); g.lineTo(w - R, Math.round(Y(v)) + 0.5); g.stroke();
      g.fillStyle = col.muted; g.textAlign = 'right'; g.textBaseline = 'middle';
      g.fillText('$' + Math.round(v), L - 6, Y(v));
    }
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    PRICES.forEach((p, i) => { if (i % 2 === 0 || w > 520) g.fillText('$' + p.toFixed(2), X(p), h - 6); });

    // Expected profit per day at each price (dashed for the hot week).
    days.forEach((d, k) => {
      g.strokeStyle = col.ink; g.lineWidth = 2; g.setLineDash(k ? [5, 4] : []);
      g.beginPath();
      for (let x = 2; x <= 6.001; x += 0.02) {
        const px = X(x), py = Y(expectedProfit(r, x, d));
        x === 2 ? g.moveTo(px, py) : g.lineTo(px, py);
      }
      g.stroke();
    });
    g.setLineDash([]);

    // Picks: circle area grows with the number of days at that price.
    const dayRef = (i) => {
      // Place marks on the normal-day curve, which is what most days looked like.
      return Y(expectedProfit(r, PRICES[i], 1));
    };
    const counts = (picks) => PRICES.map((_, i) => picks.filter((p) => p === i).length);
    const yc = counts(res.youPicks), bc = counts(res.botPicks);
    const size = (n) => 3 + Math.sqrt(n) * 2.4;
    PRICES.forEach((p, i) => {
      if (bc[i]) { g.strokeStyle = col.bot; g.lineWidth = 2; g.beginPath(); g.arc(X(p), dayRef(i), size(bc[i]) + 3, 0, Math.PI * 2); g.stroke(); }
      if (yc[i]) { g.fillStyle = col.you; g.globalAlpha = 0.85; g.beginPath(); g.arc(X(p), dayRef(i), size(yc[i]), 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; }
    });

    // Best fixed price.
    const bx = X(PRICES[res.h.best]);
    g.strokeStyle = col.muted; g.setLineDash([3, 4]); g.lineWidth = 1;
    g.beginPath(); g.moveTo(bx, T); g.lineTo(bx, h - B); g.stroke(); g.setLineDash([]);
    g.fillStyle = col.muted; g.textAlign = bx > w - 90 ? 'right' : 'left'; g.textBaseline = 'top';
    g.fillText('best fixed', bx + (bx > w - 90 ? -5 : 5), T);
  }

  /* ---------- Wiring ---------- */

  el.sellBtn.addEventListener('click', () => run(1));
  el.five.addEventListener('click', () => run(5));
  el.rest.addEventListener('click', () => run(DAYS));
  el.again.addEventListener('click', () => start(state.round.seed));
  el.next.addEventListener('click', () => {
    roundNo++;
    start(newSeed((state.round.kind + 1) % CURVES.length));
    el.ladder.focus();
    window.scrollTo({ top: 0, behavior: reduce.matches ? 'auto' : 'smooth' });
  });

  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target, onButton = t.tagName === 'BUTTON' && !t.classList.contains('price');
    if (t.tagName === 'A' || t.tagName === 'INPUT') return;
    if (state.result) {
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); el.next.click(); }
      return;
    }
    if (/^[1-9]$/.test(e.key)) { e.preventDefault(); choose(+e.key - 1, t.classList.contains('price')); return; }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); choose(state.sel === null ? 0 : state.sel - 1, true); return; }
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); choose(state.sel === null ? 0 : state.sel + 1, true); return; }
    if (e.key === ' ' && t.classList.contains('price')) { e.preventDefault(); choose(+t.dataset.i); return; }
    if ((e.key === 'Enter' || e.key === ' ') && !onButton) { e.preventDefault(); run(1); return; }
    if (e.key === 'r' || e.key === 'R') { e.preventDefault(); run(5); return; }
    if (e.key === 'f' || e.key === 'F') { e.preventDefault(); run(DAYS); }
  });

  const redraw = () => { drawStrip(); if (state.result) drawCurve(); };
  if ('ResizeObserver' in window) new ResizeObserver(redraw).observe(el.strip);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redraw);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(redraw);

  const q = parseInt(new URLSearchParams(location.search).get('seed'), 10);
  start(Number.isFinite(q) && q > 0 ? q : newSeed(0));
})(this);
