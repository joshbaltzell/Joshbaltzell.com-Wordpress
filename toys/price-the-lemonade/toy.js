/* Price the Lemonade.
   The top half is pure logic (no DOM) so it can run in node for checks.
   The bottom half draws the page. */
(function (root) {
  'use strict';

  /* ---------- Logic ---------- */

  const BASE = [2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6];
  const NINES = [2.99, 3.99, 4.99, 5.99];
  const PRICES = BASE; // the plain ladder, kept for older callers
  const COST = 1.2;
  const DAYS = 30;
  const HOT = [13, 19]; // the hot week in the seasonal round
  const DECOY = 9; // the Grand cup's price on the menu

  // How the customers think. Each is on by default. nines puts .99 prices on the menu.
  const DEFAULTS = { charm: true, ref: true, anchor: true, nines: true };
  // Sizes are illustrative, not measured. Each one shifts the price a visitor
  // feels, in dollars, before the hidden curve turns it into a chance of buying.
  const SIZES = {
    charm: 0.08,   // a .99 price feels this much lower
    anchor: 0.05,  // the Grand cup makes a regular cup feel this much cheaper
    refUp: 0.20,   // a raise above the remembered price feels 20% bigger
    refDown: 0.08, // a cut below it feels only 8% bigger
    memory: 3      // customers remember the last three days' prices
  };

  function normSettings(s) {
    const out = {};
    Object.keys(DEFAULTS).forEach((k) => { out[k] = s && k in s ? !!s[k] : DEFAULTS[k]; });
    return out;
  }

  function ladder(nines) {
    return nines ? BASE.concat(NINES).sort((a, b) => a - b) : BASE.slice();
  }

  const isCharm = (x) => Math.round(x * 100) % 100 === 99;

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

  function makeBot(seed, prices) {
    const ps = prices || BASE;
    const rng = mulberry32(mix(seed, 0xB07));
    const arms = ps.map(() => ({ a: 1, b: 1 }));
    return {
      arms,
      pick() {
        const v = arms.map((arm, i) => betaSample(arm.a, arm.b, rng) * (ps[i] - COST));
        return v.indexOf(Math.max(...v));
      },
      observe(i, visitors, buyers) { arms[i].a += buyers; arms[i].b += visitors - buyers; }
    };
  }

  function createRound(seed, settings) {
    const s = normSettings(settings);
    const prices = ladder(s.nines);
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
    return { seed, kind, def: CURVES[kind], curve, draws, s, prices, bot: makeBot(seed, prices) };
  }

  // What customers remember: the average price over the last few days.
  function refPrice(prev) {
    if (!prev || !prev.length) return null;
    const r = prev.slice(-SIZES.memory);
    return r.reduce((a, b) => a + b, 0) / r.length;
  }

  // The price a visitor feels, given what's on the menu and what they remember.
  function feel(s, x, ref) {
    let p = x;
    if (s.charm && isCharm(x)) p -= SIZES.charm;
    if (s.anchor) p -= SIZES.anchor;
    if (s.ref && ref !== null && ref !== undefined) {
      const g = x - ref;
      p += g > 0 ? SIZES.refUp * g : SIZES.refDown * g;
    }
    return p;
  }

  function buyChance(round, x, d, ref) {
    return round.curve.buy(feel(round.s, x, ref), d);
  }

  // prev: the prices this stand charged before day d, oldest first.
  function sell(round, d, i, prev) {
    const { n, u } = round.draws[d - 1];
    const x = round.prices[i];
    const p = buyChance(round, x, d, refPrice(prev));
    let cups = 0;
    for (let k = 0; k < n; k++) if (u[k] < p) cups++;
    return { i, price: x, visitors: n, cups, profit: cups * (x - COST) };
  }

  // What each fixed price would have made over the whole month, on the same visitors.
  function hindsight(round) {
    const totals = round.prices.map((x, i) => {
      let s = 0;
      const prev = [];
      for (let d = 1; d <= DAYS; d++) { s += sell(round, d, i, prev).profit; prev.push(x); }
      return s;
    });
    const best = totals.indexOf(Math.max(...totals));
    return { totals, best, bestTotal: totals[best] };
  }

  // Expected profit per day at a price held steady, for drawing the revealed curve.
  function expectedProfit(round, x, d, noCharm) {
    const s = noCharm ? Object.assign({}, round.s, { charm: false }) : round.s;
    return round.curve.visitors(d) * round.curve.buy(feel(s, x, x), d) * (x - COST);
  }

  // When a player settled: the price they used most in the last week, and the
  // earliest day from which at least 80% of their picks were that price.
  function settle(picks, n0) {
    const n = picks.length, tail = picks.slice(-7);
    const count = (arr, i) => arr.filter((p) => p === i).length;
    const size = n0 || Math.max(...picks) + 1;
    const ranked = Array.from({ length: size }, (_, i) => i).filter((i) => count(tail, i))
      .sort((a, b) => count(tail, b) - count(tail, a) || (b === tail[tail.length - 1]) - (a === tail[tail.length - 1]));
    const main = ranked[0];
    for (let s = 1; s <= n; s++) {
      if (picks[s - 1] !== main) continue;
      const rest = picks.slice(s - 1), share = count(rest, main) / rest.length;
      if (share >= 0.8) return { day: s, price: main, exact: share === 1, ranked, distinct: new Set(picks).size };
    }
    return { day: n, price: main, exact: true, ranked, distinct: new Set(picks).size };
  }

  /* ---------- Rules ---------- */

  const SUBJECTS = {
    cups: 'cups sold yesterday',
    profit: 'profit yesterday',
    change: 'cups sold yesterday compared with the day before'
  };
  const OPS = { gt: 'is more than', lt: 'is less than', up: 'went up', down: 'went down' };
  const ACTS = { raise: 'raise the price', lower: 'lower the price', keep: 'keep the price', best: 'go back to the best price so far' };
  const STEPS = [0.5, 0.25];
  const MAX_LINES = 3;

  const PRESETS = {
    hold: {
      name: 'Hold one price',
      rule: { start: 3.5, explore: false, lines: [] }
    },
    crowd: {
      name: 'Follow the crowd',
      rule: {
        start: 3, explore: false, lines: [
          { subj: 'cups', op: 'gt', value: 35, act: 'raise', step: 0.5 },
          { subj: 'cups', op: 'lt', value: 25, act: 'lower', step: 0.5 }
        ]
      }
    },
    climb: {
      name: 'Climb until it hurts',
      rule: {
        start: 2.5, explore: false, lines: [
          { subj: 'profit', op: 'up', value: 0, act: 'raise', step: 0.5 },
          { subj: 'profit', op: 'down', value: 0, act: 'lower', step: 0.5 }
        ]
      }
    },
    cheap: {
      name: 'Cheap and cheerful',
      rule: {
        start: 2.5, explore: false, lines: [
          { subj: 'cups', op: 'lt', value: 30, act: 'lower', step: 0.5 }
        ]
      }
    }
  };

  const clone = (o) => JSON.parse(JSON.stringify(o));

  // Make any rule safe to run: known words only, at most three lines, numbers finite.
  function normRule(r) {
    const src = r || {};
    const lines = (Array.isArray(src.lines) ? src.lines : []).slice(0, MAX_LINES).map((l) => ({
      subj: l && l.subj in SUBJECTS ? l.subj : 'cups',
      op: l && l.op in OPS ? l.op : 'gt',
      value: l && Number.isFinite(+l.value) ? +l.value : 0,
      act: l && l.act in ACTS ? l.act : 'keep',
      step: l && STEPS.indexOf(+l.step) >= 0 ? +l.step : 0.5
    }));
    const start = Number.isFinite(+src.start) ? +src.start : 3;
    return { start, explore: !!src.explore, lines };
  }

  // The menu price nearest to x.
  function nearest(prices, x) {
    let best = 0;
    prices.forEach((p, j) => { if (Math.abs(p - x) < Math.abs(prices[best] - x) - 1e-9) best = j; });
    return best;
  }

  // Move from price index i by step dollars in direction dir, landing on a menu
  // price. Always moves at least one rung unless already at the end of the menu.
  function move(prices, i, dir, step) {
    const cur = prices[i], target = cur + dir * step;
    let best = -1;
    prices.forEach((p, j) => {
      if (dir > 0 ? p <= cur + 1e-9 : p >= cur - 1e-9) return;
      if (best < 0) { best = j; return; }
      const dj = Math.abs(p - target), db = Math.abs(prices[best] - target);
      if (dj < db - 1e-9 || (Math.abs(dj - db) < 1e-9 && Math.abs(p - cur) < Math.abs(prices[best] - cur))) best = j;
    });
    return best < 0 ? { i, clamped: true } : { i: best, clamped: false };
  }

  // The price with the best average profit per day among those charged so far.
  function bestSoFar(hist) {
    const sum = {}, cnt = {};
    hist.forEach((h) => { sum[h.i] = (sum[h.i] || 0) + h.profit; cnt[h.i] = (cnt[h.i] || 0) + 1; });
    let best = -1, bestAvg = -Infinity;
    Object.keys(sum).forEach((k) => {
      const avg = sum[k] / cnt[k];
      if (avg > bestAvg + 1e-9) { bestAvg = avg; best = +k; }
    });
    return best;
  }

  const dollars = (v) => (v < 0 ? '-$' : '$') + Math.round(Math.abs(v)).toLocaleString('en-US');
  const fmt = (p) => '$' + p.toFixed(2);

  // Does line l match, given the history? Returns a short description or null.
  function check(l, hist) {
    const n = hist.length;
    if (!n) return null;
    const y = hist[n - 1], b = n > 1 ? hist[n - 2] : null;
    if (l.subj === 'cups' || l.subj === 'profit') {
      const cups = l.subj === 'cups';
      const v = cups ? y.cups : y.profit;
      const show = cups ? String : dollars;
      const said = cups ? 'sold ' : 'profit ';
      if (l.op === 'gt') return v > l.value ? said + show(v) + ' > ' + show(l.value) : null;
      if (l.op === 'lt') return v < l.value ? said + show(v) + ' < ' + show(l.value) : null;
      if (!b) return null;
      const w = cups ? b.cups : b.profit;
      if (l.op === 'up') return v > w + 1e-9 ? said + show(v) + ', up from ' + show(w) : null;
      return v < w - 1e-9 ? said + show(v) + ', down from ' + show(w) : null;
    }
    // change: cups yesterday minus cups the day before
    if (!b) return null;
    const c = y.cups - b.cups, sc = (c > 0 ? '+' : '') + c;
    const said = 'sold ' + y.cups + ' after ' + b.cups;
    if (l.op === 'gt') return c > l.value ? said + ' (' + sc + ' > ' + l.value + ')' : null;
    if (l.op === 'lt') return c < l.value ? said + ' (' + sc + ' < ' + l.value + ')' : null;
    if (l.op === 'up') return c > 0 ? said + ', up' : null;
    return c < 0 ? said + ', down' : null;
  }

  // Decide today's price from the rule and this stand's own history.
  // hist: [{ i, cups, profit }], oldest first. Returns { i, line, why }.
  function decide(ruleIn, prices, hist) {
    const rule = normRule(ruleIn);
    const n = hist.length;
    const startI = nearest(prices, rule.start);
    if (rule.explore && n < prices.length) {
      return { i: n, line: 'tour', why: 'trying every price once, ' + fmt(prices[n]) };
    }
    if (rule.explore && n === prices.length) {
      const b = bestSoFar(hist);
      return { i: b, line: 'tour-end', why: 'tried every price, went to the best so far, ' + fmt(prices[b]) };
    }
    if (!n) return { i: startI, line: 'start', why: 'started at ' + fmt(prices[startI]) };
    const cur = hist[n - 1].i;
    for (let k = 0; k < rule.lines.length; k++) {
      const l = rule.lines[k];
      const said = check(l, hist);
      if (!said) continue;
      const tag = 'line ' + (k + 1) + ', ' + said + ', ';
      if (l.act === 'keep') return { i: cur, line: k, why: tag + 'kept ' + fmt(prices[cur]) };
      if (l.act === 'best') {
        const b = bestSoFar(hist);
        return { i: b, line: k, why: tag + (b === cur ? 'stayed at ' : 'went back to ') + fmt(prices[b]) + ', the best so far' };
      }
      const dir = l.act === 'raise' ? 1 : -1;
      const m = move(prices, cur, dir, l.step);
      if (m.clamped) {
        return { i: cur, line: k, why: tag + 'already at ' + fmt(prices[cur]) + (dir > 0 ? ', the top price' : ', the lowest price') + ', so kept it' };
      }
      return { i: m.i, line: k, why: tag + (dir > 0 ? 'raised to ' : 'lowered to ') + fmt(prices[m.i]) };
    }
    return { i: cur, line: 'otherwise', why: 'no line matched, kept ' + fmt(prices[cur]) };
  }

  // One day for both stands. youI is the player's (or rule's) price index.
  function playDay(round, days, youI) {
    const d = days.length + 1;
    const youPrev = days.map((x) => x.you.price), botPrev = days.map((x) => x.bot.price);
    const you = sell(round, d, youI, youPrev);
    const bi = round.bot.pick();
    const bot = sell(round, d, bi, botPrev);
    round.bot.observe(bi, bot.visitors, bot.cups);
    return { d, visitors: you.visitors, you, bot };
  }

  // Run a rule for the whole month beside the bot, on a fresh round.
  function runRule(round, ruleIn) {
    const rule = normRule(ruleIn);
    const days = [];
    for (let d = 1; d <= DAYS; d++) {
      const dec = decide(rule, round.prices, days.map((x) => x.you));
      const day = playDay(round, days, dec.i);
      day.why = dec.why;
      day.line = dec.line;
      days.push(day);
    }
    let you = 0, bot = 0;
    days.forEach((x) => { you += x.you.profit; bot += x.bot.profit; });
    return { days, you, bot, h: hindsight(round) };
  }

  // Play a whole round with a policy (for checks in node).
  function simulate(seed, policy, settings) {
    const round = createRound(seed, settings);
    const rr = mulberry32(mix(seed, 0x5EED));
    const days = [];
    for (let d = 1; d <= DAYS; d++) {
      const yi = policy === 'random' ? Math.floor(rr() * round.prices.length) : 0;
      days.push(playDay(round, days, yi));
    }
    let you = 0, bot = 0;
    days.forEach((x) => { you += x.you.profit; bot += x.bot.profit; });
    const h = hindsight(round);
    return { kind: CURVES[round.kind].key, best: round.prices[h.best], bestTotal: h.bestTotal, randomRegret: h.bestTotal - you, botRegret: h.bestTotal - bot };
  }

  const Logic = {
    BASE, NINES, PRICES, COST, DAYS, DECOY, CURVES, DEFAULTS, SIZES, SUBJECTS, OPS, ACTS, STEPS, MAX_LINES, PRESETS,
    mulberry32, mix, gammaSample, betaSample, normSettings, ladder, isCharm, refPrice, feel, buyChance,
    kindOf, newSeed, makeBot, createRound, sell, hindsight, expectedProfit, settle,
    normRule, nearest, move, bestSoFar, check, decide, playDay, runRule, simulate, clone
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Logic;
  if (typeof document === 'undefined') return;

  /* ---------- Page ---------- */

  const $ = (s) => document.querySelector(s);
  const money = (v) => (v < 0 ? '-' : '') + '$' + Math.round(Math.abs(v)).toLocaleString('en-US');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const el = {
    modePick: $('#mode-pick'), modeRule: $('#mode-rule'),
    play: $('#play'), rulePanel: $('#rule'), end: $('#end'), day: $('#day-label'), seed: $('#seed'),
    ruleDay: $('#rule-day'), ruleSeed: $('#rule-seed'),
    ladder: $('#ladder'), sellBtn: $('#sell'), five: $('#five'), rest: $('#rest'), board: $('#board'), ruleBoard: $('#rule-board'),
    youTag: $('#you-tag'), youTotal: $('#you-total'), youLast: $('#you-last'), botTotal: $('#bot-total'), botLast: $('#bot-last'),
    strip: $('#strip'), stripNote: $('#strip-note'), rows: $('#rows'), youCol: $('#you-col'),
    summary: $('#summary'), results: $('#results'), curve: $('#curve'), curveName: $('#curve-name'),
    curveBlurb: $('#curve-blurb'), again: $('#again'), next: $('#next'), legendYou: $('#legend-you'), legendNines: $('#legend-nines'),
    endTitle: $('#end-title'), endHint: $('#end-hint'),
    presets: $('#presets'), start: $('#rule-start'), lines: $('#rule-lines'), addLine: $('#add-line'),
    explore: $('#rule-explore'), runBtn: $('#run-rule'), last: $('#rule-last'),
    why: $('#why'), whyList: $('#why-list'),
    psy: $('#psy'), psyHint: $('#psy-hint'), keys: $('#keys')
  };

  // Set by the inline script in the page head: inside a frame, or ?embed=1.
  const embedded = document.documentElement.classList.contains('is-embedded');
  const keepEmbed = /[?&]embed=1(&|$)/.test(location.search);
  const folds = [...document.querySelectorAll('details.fold')];

  let settings = normSettings();
  let mode = 'pick';
  let rule = clone(PRESETS.crowd.rule);
  let lastRun = null; // { key, total } from the previous rule run on this seed and settings
  let state;
  let roundNo = 1;
  let busy = false;
  let timer = null;

  const fmtI = (i) => fmt(state.round.prices[i]);
  const settingsKey = () => Object.keys(DEFAULTS).map((k) => (settings[k] ? 1 : 0)).join('');

  // embed: keep ?embed=1 (for the frame's own address, not for the share link).
  function query(seed, embed) {
    const q = new URLSearchParams();
    if (embed && keepEmbed) q.set('embed', '1');
    q.set('seed', seed);
    if (mode === 'rule') q.set('mode', 'rule');
    const off = Object.keys(DEFAULTS).filter((k) => !settings[k]);
    if (off.length) q.set('off', off.join(','));
    return '?' + q.toString();
  }

  function start(seed) {
    clearTimeout(timer);
    if (busy) setEditorDisabled(false);
    busy = false;
    state = { round: createRound(seed, settings), days: [], sel: null, result: null, run: null };
    try { history.replaceState(null, '', query(seed, true)); } catch (e) { /* file:// may refuse */ }
    el.end.hidden = true;
    buildLadder();
    fillStart();
    renderMode();
    render();
  }

  /* ---------- Mode ---------- */

  function renderMode() {
    const rm = mode === 'rule';
    el.modePick.setAttribute('aria-pressed', rm ? 'false' : 'true');
    el.modeRule.setAttribute('aria-pressed', rm ? 'true' : 'false');
    el.play.hidden = rm || !!state.result;
    el.rulePanel.hidden = !rm;
    el.why.hidden = !rm || !state.days.length;
    el.youTag.textContent = rm ? 'Your rule' : 'You';
    el.youCol.textContent = rm ? 'Rule' : 'You';
    el.legendYou.textContent = rm ? 'Your rule' : 'You';
    el.again.textContent = rm ? 'Edit the rule' : 'Play this round again';
    el.endHint.textContent = rm
      ? 'Change a line and run it again on the same days, or press N for the next round.'
      : 'Each round uses a different hidden curve. N starts the next one.';
    const on = Object.keys(DEFAULTS).filter((k) => k !== 'nines' && settings[k]).length;
    el.psyHint.textContent = on === 3 ? 'Three effects, all on' : on ? on + ' of 3 effects on' : 'All three effects off';
    const board = settings.anchor ? 'On the menu board: Grand cup ' + fmt(DECOY) + ', and a regular cup at your price.' : '';
    [el.board, el.ruleBoard].forEach((b) => { b.textContent = board; b.hidden = !board; });
  }

  function setMode(m) {
    if (busy || m === mode) return;
    mode = m;
    start(state.round.seed);
  }

  /* ---------- Price ladder (pick mode) ---------- */

  function buildLadder() {
    el.ladder.innerHTML = '';
    state.round.prices.forEach((p, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip price' + (isCharm(p) ? ' price--nine' : '');
      b.setAttribute('role', 'radio');
      b.dataset.i = i;
      const k = BASE.indexOf(p);
      b.innerHTML = (k >= 0 ? '<span class="price__key" aria-hidden="true">' + (k + 1) + '</span>' : '') + fmt(p);
      b.addEventListener('click', () => choose(i));
      el.ladder.appendChild(b);
    });
    el.keys.innerHTML = settings.nines
      ? 'Keys: <kbd>1</kbd>–<kbd>9</kbd> pick a round price, <kbd>←</kbd><kbd>→</kbd> step through every price, <kbd>Enter</kbd> sells one day, <kbd>R</kbd> five days, <kbd>F</kbd> the rest of the month.'
      : 'Keys: <kbd>1</kbd>–<kbd>9</kbd> or <kbd>←</kbd><kbd>→</kbd> pick a price, <kbd>Enter</kbd> sells one day, <kbd>R</kbd> five days, <kbd>F</kbd> the rest of the month.';
  }

  function choose(i, focus) {
    if (busy || state.result || mode !== 'pick') return;
    state.sel = Math.max(0, Math.min(state.round.prices.length - 1, i));
    renderControls();
    if (focus) el.ladder.children[state.sel].focus();
  }

  function step() {
    if (state.days.length >= DAYS || state.sel === null) return false;
    state.days.push(playDay(state.round, state.days, state.sel));
    return true;
  }

  function run(n) {
    if (busy || state.sel === null || state.result || mode !== 'pick') return;
    const target = Math.min(DAYS, state.days.length + n);
    if (n === 1 || reduce.matches) {
      while (state.days.length < target) step();
      return after();
    }
    busy = true;
    const tick = () => {
      step();
      render();
      if (state.days.length < target) timer = setTimeout(tick, 70);
      else { busy = false; after(); }
    };
    tick();
  }

  function after() {
    if (state.days.length >= DAYS) finish();
    render();
  }

  /* ---------- Rule editor ---------- */

  const options = (map, sel) => Object.keys(map).map((k) =>
    '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + esc(map[k]) + '</option>').join('');

  function fillStart() {
    const ps = state.round.prices;
    const si = nearest(ps, rule.start);
    rule.start = ps[si];
    el.start.innerHTML = ps.map((p, i) => '<option value="' + p + '"' + (i === si ? ' selected' : '') + '>' + fmt(p) + '</option>').join('');
    el.explore.checked = !!rule.explore;
    renderLines();
  }

  function renderLines() {
    el.lines.innerHTML = rule.lines.map((l, k) => {
      const n = k + 1;
      const needsValue = l.op === 'gt' || l.op === 'lt';
      const needsStep = l.act === 'raise' || l.act === 'lower';
      const isMoney = l.subj === 'profit';
      return '<li class="rline" data-k="' + k + '">' +
        '<span class="rline__word">If</span>' +
        '<select data-f="subj" aria-label="Line ' + n + ': what to look at">' + options(SUBJECTS, l.subj) + '</select>' +
        '<select data-f="op" aria-label="Line ' + n + ': how to compare">' + options(OPS, l.op) + '</select>' +
        '<span class="rline__num"' + (needsValue ? '' : ' hidden') + '>' + (isMoney ? '<span aria-hidden="true">$</span>' : '') +
          '<input type="number" data-f="value" inputmode="numeric" step="1" value="' + l.value + '" aria-label="Line ' + n + ': number' + (isMoney ? ' in dollars' : '') + '"></span>' +
        '<span class="rline__word">then</span>' +
        '<select data-f="act" aria-label="Line ' + n + ': what to do">' + options(ACTS, l.act) + '</select>' +
        '<select data-f="step" aria-label="Line ' + n + ': by how much"' + (needsStep ? '' : ' hidden') + '>' +
          STEPS.map((s) => '<option value="' + s + '"' + (s === l.step ? ' selected' : '') + '>by ' + fmt(s) + '</option>').join('') + '</select>' +
        '<button class="btn btn--small" type="button" data-remove aria-label="Remove line ' + n + '">Remove</button>' +
        '</li>';
    }).join('');
    el.addLine.disabled = busy || rule.lines.length >= MAX_LINES;
    el.addLine.textContent = rule.lines.length >= MAX_LINES ? 'Three lines is the limit' : 'Add an “If … then …” line';
    renderLast();
  }

  function readField(t) {
    const li = t.closest('.rline');
    if (!li) return;
    const l = rule.lines[+li.dataset.k], f = t.dataset.f;
    if (f === 'value') l.value = Number.isFinite(parseFloat(t.value)) ? parseFloat(t.value) : 0;
    else if (f === 'step') l.step = +t.value;
    else l[f] = t.value;
    if (f === 'op' || f === 'act' || f === 'subj') {
      renderLines();
      const again = el.lines.children[+li.dataset.k];
      if (again) again.querySelector('[data-f="' + f + '"]').focus();
    }
  }

  function setEditorDisabled(off) {
    el.rulePanel.querySelectorAll('select, input, button').forEach((c) => { c.disabled = off; });
    if (!off) el.addLine.disabled = rule.lines.length >= MAX_LINES;
    el.runBtn.textContent = off ? 'Running…' : 'Run the rule for 30 days';
  }

  function renderLast() {
    const key = state.round.seed + ':' + settingsKey();
    el.last.textContent = lastRun && lastRun.key === key ? 'Last run on these days: ' + money(lastRun.total) + '.' : '';
    el.last.hidden = !el.last.textContent;
  }

  function runRuleUI() {
    if (busy) return;
    rule = normRule(rule);
    const round = createRound(state.round.seed, settings);
    const res = runRule(round, rule);
    const key = round.seed + ':' + settingsKey();
    state = { round, days: [], sel: null, result: null, run: res, prev: lastRun && lastRun.key === key ? lastRun : null };
    el.end.hidden = true;
    if (reduce.matches) {
      state.days = res.days.slice();
      finish();
      render();
      return;
    }
    busy = true;
    setEditorDisabled(true);
    let k = 0;
    const tick = () => {
      state.days.push(res.days[k++]);
      render();
      if (k < DAYS) timer = setTimeout(tick, 40);
      else { busy = false; setEditorDisabled(false); finish(); render(); }
    };
    tick();
  }

  /* ---------- Render ---------- */

  function totals() {
    let you = 0, bot = 0;
    state.days.forEach((x) => { you += x.you.profit; bot += x.bot.profit; });
    return { you, bot };
  }

  function lastLine(x, d) {
    return 'Day ' + d + ': ' + fmt(x.price) + '. ' + x.cups + ' of ' + x.visitors + ' bought. ' + money(x.profit) + ' profit.';
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
    el.sellBtn.textContent = none ? 'Pick a price first' : 'Sell at ' + fmtI(state.sel);
    el.sellBtn.disabled = none || busy || done;
    el.five.disabled = none || busy || done;
    el.rest.disabled = none || busy || done;
  }

  function render() {
    const n = state.days.length, rm = mode === 'rule';
    const label = 'Round ' + roundNo + ' · Day ' + Math.min(n + 1, DAYS) + ' of ' + DAYS;
    const seedText = 'Seed ' + state.round.seed, href = query(state.round.seed);
    el.day.textContent = label;
    el.ruleDay.textContent = state.result ? 'Round ' + roundNo + ' · 30 days run' : n ? label : 'Round ' + roundNo + ' · Not run yet';
    [el.seed, el.ruleSeed].forEach((a) => {
      a.textContent = seedText; a.href = href;
      if (embedded) { a.target = '_blank'; a.rel = 'noopener'; }
    });
    renderControls();
    renderMode();

    const t = totals();
    el.youTotal.textContent = money(t.you);
    el.botTotal.textContent = money(t.bot);
    if (n) {
      const x = state.days[n - 1];
      el.youLast.textContent = lastLine(x.you, x.d);
      el.botLast.textContent = lastLine(x.bot, x.d);
    } else {
      el.youLast.textContent = rm ? 'Not run yet.' : 'No sales yet.';
      el.botLast.textContent = 'No sales yet. It starts knowing nothing too.';
    }

    el.stripNote.hidden = n > 0;
    el.stripNote.textContent = rm
      ? 'Empty for now. Run the rule and each day adds a dot for your rule and a ring for the bot.'
      : 'Empty for now. Each day adds a dot for you and a ring for the bot, so you can see who is still trying new prices.';
    el.rows.innerHTML = '';
    if (!n) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="6" class="empty">' + (rm ? 'Nothing sold yet. Each day the rule plays shows up here, newest first.' : 'Nothing sold yet. Each day you play shows up here, newest first.') + '</td>';
      el.rows.appendChild(tr);
    }
    for (let k = n - 1; k >= 0; k--) {
      const x = state.days[k];
      const tr = document.createElement('tr');
      if (k === n - 1 && !state.result) tr.className = 'fresh';
      if (state.round.curve.hot && x.d >= HOT[0] && x.d <= HOT[1] && state.result) tr.className = 'hot';
      tr.innerHTML = '<td>' + x.d + '</td><td>' + x.visitors + '</td>' +
        '<td>' + fmt(x.you.price) + '</td><td>' + money(x.you.profit) + '</td>' +
        '<td>' + fmt(x.bot.price) + '</td><td>' + money(x.bot.profit) + '</td>';
      el.rows.appendChild(tr);
    }

    if (rm) {
      el.whyList.innerHTML = state.days.map((x) =>
        '<li><span class="why__day">Day ' + x.d + ':</span> ' + esc(x.why) + '. <span class="muted">Sold ' + x.you.cups + ', ' + money(x.you.profit) + '.</span></li>').join('');
    }
    drawStrip();
    if (state.result) drawCurve();
  }

  /* ---------- End of round ---------- */

  function describe(picks, who) {
    const st = settle(picks, state.round.prices.length), p = fmtI(st.price), mostly = st.exact ? '' : 'mostly ';
    const name = { you: 'You', bot: 'The bot', rule: 'Your rule' }[who];
    if (st.distinct === 1) return name + ' charged ' + p + ' every day.';
    if (st.day <= 3) return name + ' landed on ' + p + ' by day ' + st.day + ' and ' + mostly + 'stayed.';
    if (st.day <= DAYS - 4) {
      if (who === 'bot') return 'The bot kept testing until day ' + st.day + ', then ' + mostly + 'stayed on ' + p + '.';
      return name + ' settled on ' + p + ' by day ' + st.day + ' and ' + mostly + 'stayed.';
    }
    const pair = st.ranked.slice(0, 2).sort((a, b) => a - b).map(fmtI).join(' and ');
    return name + (who === 'you' ? ' were' : ' was') + ' still ' + (who === 'rule' ? 'moving' : 'trying prices') + ' near the end, mostly ' + pair + '.';
  }

  function finish() {
    const r = state.round, h = state.run ? state.run.h : hindsight(r), t = totals(), rm = mode === 'rule';
    const youPicks = state.days.map((x) => x.you.i), botPicks = state.days.map((x) => x.bot.i);
    state.result = { h, t, youPicks, botPicks };

    const gap = t.you - t.bot, them = rm ? 'your rule' : 'you';
    let cmp;
    if (Math.abs(gap) < 1) cmp = (rm ? 'Your rule' : 'You') + ' and the bot finished level.';
    else cmp = gap > 0 ? 'It finished ' + money(gap) + ' behind ' + them + '.' : 'It finished ' + money(-gap) + ' ahead of ' + them + '.';

    const lines = [
      describe(youPicks, rm ? 'rule' : 'you'),
      describe(botPicks, 'bot') + ' ' + cmp,
      'Looking back, the best single price was ' + fmtI(h.best) + '. Charging it all month would have made ' + money(h.bestTotal) + '.'
    ];
    if (r.curve.hot) lines.push('A fixed price can’t follow a hot week, so a player who moved with it could beat that number.');
    if (rm && state.prev) {
      const dv = t.you - state.prev.total;
      lines.push(Math.abs(dv) < 1 ? 'That’s the same as your last rule.' : 'That’s ' + money(Math.abs(dv)) + (dv > 0 ? ' more' : ' less') + ' than your last rule.');
    }
    if (!rm && new Set(youPicks).size <= 3 && t.bot > t.you + 1) {
      lines.push('People often stop trying new prices after a few days. It feels safe, and sometimes it costs a little.');
    }
    el.summary.innerHTML = lines.map((l) => '<p>' + l + '</p>').join('');

    const regret = (v) => {
      const left = h.bestTotal - v;
      return left >= 0.5 ? money(left) : left <= -0.5 ? money(-left) + ' ahead' : '$0';
    };
    el.results.innerHTML =
      '<tr><th scope="row"><span class="key key--you"></span>' + (rm ? 'Your rule' : 'You') + '</th><td>' + money(t.you) + '</td><td>' + regret(t.you) + '</td></tr>' +
      '<tr><th scope="row"><span class="key key--bot"></span>Bot</th><td>' + money(t.bot) + '</td><td>' + regret(t.bot) + '</td></tr>' +
      (rm && state.prev ? '<tr><th scope="row">Last rule</th><td>' + money(state.prev.total) + '</td><td>' + regret(state.prev.total) + '</td></tr>' : '') +
      '<tr><th scope="row">' + fmtI(h.best) + ' every day</th><td>' + money(h.bestTotal) + '</td><td>—</td></tr>';

    if (rm) lastRun = { key: r.seed + ':' + settingsKey(), total: t.you };

    el.curveName.textContent = 'The hidden curve: ' + r.def.name;
    el.curveBlurb.textContent = r.def.blurb;
    el.legendNines.hidden = !(r.s.nines && r.s.charm);
    el.play.hidden = true;
    el.end.hidden = false;
    renderLast();
    // Wait for layout before drawing the newly shown canvas.
    requestAnimationFrame(() => {
      drawCurve();
      if (embedded) {
        // Scroll only this frame's page, never the article around it.
        (rm ? el.endTitle : el.next).focus({ preventScroll: true });
        reveal(el.end);
      } else if (rm) el.endTitle.focus();
      else el.next.focus();
    });
  }

  function reveal(node) {
    const behavior = reduce.matches ? 'auto' : 'smooth';
    if (!embedded) return node.scrollIntoView({ behavior, block: 'start' });
    window.scrollTo({ top: Math.max(0, node.getBoundingClientRect().top + window.scrollY - 8), behavior });
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
    const Y = (p) => T + (1 - (p - 2) / 4) * (h - T - B);

    if (state.result && state.round.curve.hot) {
      g.fillStyle = col.sunk;
      g.fillRect(X(HOT[0] - 0.5), T - 6, X(HOT[1] + 0.5) - X(HOT[0] - 0.5), h - T - B + 12);
      g.fillStyle = col.muted; g.font = monoFont(10); g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      g.fillText('hot week', X((HOT[0] + HOT[1]) / 2), h - 6);
    }
    g.font = monoFont(11);
    g.textBaseline = 'middle';
    BASE.forEach((p, i) => {
      g.strokeStyle = col.line; g.lineWidth = 1;
      g.beginPath(); g.moveTo(L, Y(p) + 0.5); g.lineTo(w - R, Y(p) + 0.5); g.stroke();
      if (i % 2 === 0 || h > 260) { g.fillStyle = col.muted; g.textAlign = 'right'; g.fillText(fmt(p), L - 6, Y(p)); }
    });
    g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = col.muted;
    [1, 10, 20, 30].forEach((d) => g.fillText(d === 1 ? 'Day 1' : String(d), X(d), h - 6));

    if (state.result) {
      const yb = Y(state.round.prices[state.result.h.best]);
      g.strokeStyle = col.ink; g.setLineDash([4, 4]); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(L, yb); g.lineTo(w - R, yb); g.stroke(); g.setLineDash([]);
    }
    const rad = Math.max(3, Math.min(5, (w - L - R) / DAYS / 3));
    state.days.forEach((x) => {
      g.strokeStyle = col.bot; g.lineWidth = 2;
      g.beginPath(); g.arc(X(x.d), Y(x.bot.price), rad + 2.5, 0, Math.PI * 2); g.stroke();
      g.fillStyle = col.you;
      g.beginPath(); g.arc(X(x.d), Y(x.you.price), rad, 0, Math.PI * 2); g.fill();
    });
  }

  function drawCurve() {
    const c = setup(el.curve);
    if (!c) return;
    const { g, w, h } = c, col = palette(), r = state.round, res = state.result, ps = r.prices;
    const L = 46, R = 12, T = 14, B = 26;
    const x0 = 1.8, x1 = 6.2;
    const days = r.curve.hot ? [1, HOT[0]] : [1];
    let max = 0;
    for (let x = 2; x <= 6.001; x += 0.05) days.forEach((d) => { max = Math.max(max, expectedProfit(r, x, d, true)); });
    ps.forEach((p) => days.forEach((d) => { max = Math.max(max, expectedProfit(r, p, d)); }));
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
    BASE.forEach((p, i) => { if (i % 2 === 0 || w > 520) g.fillText(fmt(p), X(p), h - 6); });

    // Expected profit per day at each price held steady (dashed for the hot week).
    days.forEach((d, k) => {
      g.strokeStyle = col.ink; g.lineWidth = 2; g.setLineDash(k ? [5, 4] : []);
      g.beginPath();
      for (let x = 2; x <= 6.001; x += 0.02) {
        const px = X(x), py = Y(expectedProfit(r, x, d, true));
        x === 2 ? g.moveTo(px, py) : g.lineTo(px, py);
      }
      g.stroke();
    });
    g.setLineDash([]);

    // .99 prices sit a little above the line when charm prices are on.
    if (r.s.charm) {
      g.fillStyle = col.ink;
      ps.forEach((p) => {
        if (!isCharm(p)) return;
        g.beginPath(); g.arc(X(p), Y(expectedProfit(r, p, 1)), 2.5, 0, Math.PI * 2); g.fill();
      });
    }

    // Picks: circle area grows with the number of days at that price.
    // Marks sit on the normal-day curve, which is what most days looked like.
    const dayRef = (i) => Y(expectedProfit(r, ps[i], 1));
    const counts = (picks) => ps.map((_, i) => picks.filter((p) => p === i).length);
    const yc = counts(res.youPicks), bc = counts(res.botPicks);
    const size = (n) => 3 + Math.sqrt(n) * 2.4;
    ps.forEach((p, i) => {
      if (bc[i]) { g.strokeStyle = col.bot; g.lineWidth = 2; g.beginPath(); g.arc(X(p), dayRef(i), size(bc[i]) + 3, 0, Math.PI * 2); g.stroke(); }
      if (yc[i]) { g.fillStyle = col.you; g.globalAlpha = 0.85; g.beginPath(); g.arc(X(p), dayRef(i), size(yc[i]), 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; }
    });

    // Best fixed price.
    const bx = X(ps[res.h.best]);
    g.strokeStyle = col.muted; g.setLineDash([3, 4]); g.lineWidth = 1;
    g.beginPath(); g.moveTo(bx, T); g.lineTo(bx, h - B); g.stroke(); g.setLineDash([]);
    g.fillStyle = col.muted; g.textAlign = bx > w - 90 ? 'right' : 'left'; g.textBaseline = 'top';
    g.fillText('best fixed', bx + (bx > w - 90 ? -5 : 5), T);
  }

  /* ---------- Wiring ---------- */

  el.sellBtn.addEventListener('click', () => run(1));
  el.five.addEventListener('click', () => run(5));
  el.rest.addEventListener('click', () => run(DAYS));
  el.modePick.addEventListener('click', () => setMode('pick'));
  el.modeRule.addEventListener('click', () => setMode('rule'));
  el.again.addEventListener('click', () => {
    if (mode === 'rule') {
      reveal(el.rulePanel);
      el.start.focus({ preventScroll: true });
    } else start(state.round.seed);
  });
  el.next.addEventListener('click', () => {
    roundNo++;
    start(newSeed((state.round.kind + 1) % CURVES.length));
    (mode === 'rule' ? el.runBtn : el.ladder).focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: reduce.matches ? 'auto' : 'smooth' });
  });

  el.presets.addEventListener('click', (e) => {
    const b = e.target.closest('[data-preset]');
    if (!b || busy) return;
    rule = clone(PRESETS[b.dataset.preset].rule);
    fillStart();
  });
  el.start.addEventListener('change', () => { rule.start = +el.start.value; });
  el.explore.addEventListener('change', () => { rule.explore = el.explore.checked; });
  el.addLine.addEventListener('click', () => {
    if (rule.lines.length >= MAX_LINES) return;
    rule.lines.push({ subj: 'cups', op: 'gt', value: 30, act: 'raise', step: 0.5 });
    renderLines();
    const li = el.lines.lastElementChild;
    if (li) li.querySelector('select').focus();
  });
  el.lines.addEventListener('change', (e) => readField(e.target));
  el.lines.addEventListener('input', (e) => { if (e.target.dataset.f === 'value') readField(e.target); });
  el.lines.addEventListener('click', (e) => {
    const b = e.target.closest('[data-remove]');
    if (!b) return;
    const k = +b.closest('.rline').dataset.k;
    rule.lines.splice(k, 1);
    renderLines();
    const next = el.lines.children[Math.min(k, rule.lines.length - 1)];
    (next ? next.querySelector('select') : el.addLine).focus();
  });
  el.runBtn.addEventListener('click', runRuleUI);

  el.psy.addEventListener('change', (e) => {
    const k = e.target.dataset.setting;
    if (!k) return;
    settings[k] = e.target.checked;
    start(state.round.seed);
  });

  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    // Enter and Space keep their own meaning on buttons and on a fold's summary row.
    const onButton = (t.tagName === 'BUTTON' && !t.classList.contains('price')) || t.tagName === 'SUMMARY';
    if (/^(A|INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return;
    if (state.result) {
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); el.next.click(); }
      return;
    }
    if (mode !== 'pick') return;
    const ps = state.round.prices;
    if (/^[1-9]$/.test(e.key)) { e.preventDefault(); choose(ps.indexOf(BASE[+e.key - 1]), t.classList.contains('price')); return; }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); choose(state.sel === null ? 0 : state.sel - 1, true); return; }
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); choose(state.sel === null ? 0 : state.sel + 1, true); return; }
    if (e.key === ' ' && t.classList.contains('price')) { e.preventDefault(); choose(+t.dataset.i); return; }
    if ((e.key === 'Enter' || e.key === ' ') && !onButton) { e.preventDefault(); run(1); return; }
    if (e.key === 'r' || e.key === 'R') { e.preventDefault(); run(5); return; }
    if (e.key === 'f' || e.key === 'F') { e.preventDefault(); run(DAYS); }
  });

  const redraw = () => { drawStrip(); if (state.result) drawCurve(); };
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(redraw);
    ro.observe(el.strip);
    ro.observe(el.curve);
  }
  // Canvases in a closed fold have no size; draw them when the fold opens.
  folds.forEach((d) => d.addEventListener('toggle', () => { if (d.open) redraw(); }));
  if (embedded) folds.forEach((d) => { d.open = false; });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redraw);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(redraw);

  // Read the address: ?seed=, &mode=rule, &off=charm,ref,anchor,nines
  const params = new URLSearchParams(location.search);
  const q = parseInt(params.get('seed'), 10);
  if (params.get('mode') === 'rule') mode = 'rule';
  (params.get('off') || '').split(',').forEach((k) => { if (k in DEFAULTS) settings[k] = false; });
  el.psy.querySelectorAll('[data-setting]').forEach((c) => { c.checked = settings[c.dataset.setting]; });
  start(Number.isFinite(q) && q > 0 ? q : newSeed(0));
})(this);
