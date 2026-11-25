/* The Lemonade lessons: shared logic.
   Pure logic, no DOM, so it runs in node for checks. ui.js draws the page.
   Taken from Price the Lemonade (toys/price-the-lemonade/toy.js) and extended
   with stands across the street. With no stands across the street, a day plays
   exactly as it does in Price the Lemonade. */
(function (root) {
  'use strict';

  /* ---------- Menu, cost, customers ---------- */

  const BASE = [2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6];
  const NINES = [2.99, 3.99, 4.99, 5.99];
  const QUARTERS = Array.from({ length: 17 }, (_, k) => 2 + k * 0.25);
  const COST = 1.2;
  const HOT = [13, 19]; // the hot week in the seasonal round
  const DECOY = 9; // the Grand cup's price on the menu
  const FLOOR = 2, TOP = 6, OPEN = 3.5;

  // How the customers think. nines puts .99 prices on the menu.
  const DEFAULTS = { charm: true, ref: true, anchor: true, nines: true };
  const ALL_OFF = { charm: false, ref: false, anchor: false, nines: false };
  // Sizes are illustrative, not measured. Each one shifts the price a visitor
  // feels, in dollars, before the hidden curve turns it into a chance of buying.
  const SIZES = {
    charm: 0.08,   // a .99 price feels this much lower
    anchor: 0.05,  // the Grand cup makes a regular cup feel this much cheaper
    refUp: 0.20,   // a raise above the remembered price feels 20% bigger
    refDown: 0.08, // a cut below it feels only 8% bigger
    memory: 3      // customers remember the last three days' prices
  };

  // How visitors pick a stand when there is more than one. Each stand has a
  // share of regulars who only ever go there. Everyone else picks a stand with
  // a logit on price: a 50-cent gap sends 3 in 4 of them to the cheaper stand.
  const SPREAD = 0.5 / Math.log(3);

  function normSettings(s) {
    const out = {};
    Object.keys(DEFAULTS).forEach((k) => { out[k] = s && k in s ? !!s[k] : DEFAULTS[k]; });
    return out;
  }

  function ladder(menu, nines) {
    if (menu === 'quarter') return QUARTERS.slice();
    if (menu === 'nines' && nines) return BASE.concat(NINES).sort((a, b) => a - b);
    return BASE.slice();
  }

  const isCharm = (x) => Math.round(x * 100) % 100 === 99;
  const cents = (x) => Math.round(x * 100) / 100;

  /* ---------- Random numbers ---------- */

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

  /* ---------- Hidden curves ---------- */

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
  const CURVE_KEYS = CURVES.map((c) => c.key);

  function kindOf(seed) { return ((seed % CURVES.length) + CURVES.length) % CURVES.length; }

  function newSeed(kind, rand) {
    const r = rand || Math.random;
    return (1 + Math.floor(r() * 249999)) * CURVES.length + kind;
  }

  /* ---------- Stands across the street ---------- */

  // Each rule looks at the other stands' prices yesterday. "you" is the word
  // used when the stand faces one player; "many" when there are two stands.
  const RIVALS = {
    under: {
      you: 'Stay 25 cents under you', many: '25¢ under the lowest',
      floor: FLOOR, next: (t) => t - 0.25
    },
    match: {
      you: 'Match you', many: 'Match the lowest',
      floor: FLOOR, next: (t) => t
    },
    hold: {
      you: 'Hold $3.50', many: 'Hold $3.50',
      floor: FLOOR, next: () => 3.5
    },
    undercut: {
      you: 'Undercut, but never below $2.50', many: 'Undercut the lowest, not below $2.50',
      floor: 2.5, next: (t) => t - 0.25
    },
    above: {
      you: 'Stay 10% above you', many: '10% above the lowest',
      floor: FLOOR, next: (t) => Math.round(t * 1.1 * 20) / 20
    }
  };
  const RIVAL_KEYS = Object.keys(RIVALS);

  const clampRival = (key, x) => cents(Math.max(RIVALS[key].floor, Math.min(TOP, x)));

  // A stand's price today, from the other stands' prices yesterday.
  function rivalPrice(key, others) {
    return clampRival(key, RIVALS[key].next(Math.min.apply(null, others)));
  }

  // Today's prices for every stand across the street. mine: this street's
  // player's prices so far; theirs: each stand's prices so far. Day 1 is the
  // opening price.
  function rivalsToday(round, d, mine, theirs) {
    return round.rivals.map((key, j) => {
      if (d === 1) return clampRival(key, key === 'hold' ? 3.5 : OPEN);
      const others = [mine[d - 2]];
      theirs.forEach((arr, k) => { if (k !== j) others.push(arr[d - 2]); });
      return rivalPrice(key, others);
    });
  }

  /* ---------- Lessons ---------- */

  const LESSONS = {
    1: { lesson: 1, days: 30, menu: 'half', psych: false, rivals: [], rules: false, curves: ['steep', 'flat', 'cliff', 'hot'], bigStep: 5, loyal: 0 },
    2: { lesson: 2, days: 30, menu: 'nines', psych: true, rivals: [], rules: false, curves: ['steep', 'flat', 'cliff', 'hot'], bigStep: 5, loyal: 0 },
    3: { lesson: 3, days: 90, menu: 'quarter', psych: false, rivals: ['under'], rules: true, curves: ['steep', 'flat', 'cliff'], bigStep: 7, loyal: 0.2 },
    4: { lesson: 4, days: 90, menu: 'quarter', psych: false, rivals: ['under', 'match'], rules: true, curves: ['steep', 'flat', 'cliff'], bigStep: 7, loyal: 0.15 }
  };

  function config(c) {
    const src = c || {};
    const base = LESSONS[src.lesson] || LESSONS[1];
    const out = Object.assign({}, base, src);
    out.rivals = (Array.isArray(out.rivals) ? out.rivals : []).filter((k) => k in RIVALS).slice(0, 2);
    out.days = Math.max(5, Math.min(365, Math.round(+out.days) || base.days));
    return out;
  }

  /* ---------- Bot ---------- */

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

  /* ---------- A round ---------- */

  // opts: { days, menu, settings, rivals, loyal } (a lesson config works).
  function createRound(seed, opts) {
    const o = opts || {};
    const days = o.days || 30;
    const s = o.psych === false ? Object.assign({}, ALL_OFF) : normSettings(o.settings);
    const prices = ladder(o.menu || 'half', s.nines);
    const kind = kindOf(seed);
    const jr = mulberry32(mix(seed, 777));
    const curve = CURVES[kind].make((jr() - 0.5) * 0.5);
    // Visitors and their willingness are drawn once per day from the day's own
    // seed. Both players see the same visitors: a visitor buys if their number
    // is below the buy chance at the price they were shown. When there is more
    // than one stand, a second number (from its own stream, so the first ones
    // match Price the Lemonade) picks the stand.
    const draws = [];
    for (let d = 1; d <= days; d++) {
      const r = mulberry32(mix(seed, d));
      const n = Math.max(5, Math.round(curve.visitors(d) * Math.exp(0.18 * normal(r))));
      const u = new Float64Array(n);
      for (let k = 0; k < n; k++) u[k] = r();
      const rc = mulberry32(mix(mix(seed, 0xC401), d));
      const c = new Float64Array(n);
      for (let k = 0; k < n; k++) c[k] = rc();
      draws.push({ n, u, c });
    }
    const rivals = (o.rivals || []).filter((k) => k in RIVALS);
    return {
      seed, kind, def: CURVES[kind], curve, draws, s, prices, days,
      rivals, loyal: rivals.length ? (o.loyal || 0.2) : 0,
      bot: makeBot(seed, prices)
    };
  }

  // A copy of the round facing different stands (same customers and days).
  function withRivals(round, keys) {
    return Object.assign({}, round, { rivals: keys.slice(), loyal: keys.length ? (round.loyal || 0.2) : 0 });
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

  // Where each shopper goes, given the stands' prices: [P(stand 0), ...].
  function shopperShares(prices) {
    const w = prices.map((x) => Math.exp(-x / SPREAD));
    const t = w.reduce((a, b) => a + b, 0);
    return w.map((v) => v / t);
  }

  // One day on one street. prices[0] is the player (or bot); the rest are the
  // stands across the street. prevs[j]: stand j's prices before today.
  function market(round, d, prices, prevs) {
    const { n, u, c } = round.draws[d - 1];
    const S = prices.length;
    const p = prices.map((x, j) => buyChance(round, x, d, refPrice(prevs[j])));
    const cups = new Array(S).fill(0), came = new Array(S).fill(0);
    if (S === 1) {
      for (let k = 0; k < n; k++) if (u[k] < p[0]) cups[0]++;
      came[0] = n;
    } else {
      const L = round.loyal, ls = L * S;
      const share = shopperShares(prices);
      for (let k = 0; k < n; k++) {
        const v = c[k];
        let j;
        if (v < ls) j = Math.min(S - 1, Math.floor(v / L));
        else {
          let z = (v - ls) / (1 - ls);
          j = 0;
          while (j < S - 1 && z >= share[j]) { z -= share[j]; j++; }
        }
        came[j]++;
        if (u[k] < p[j]) cups[j]++;
      }
    }
    return prices.map((x, j) => ({ price: x, visitors: n, came: came[j], cups: cups[j], profit: cups[j] * (x - COST) }));
  }

  // prev: the prices this stand charged before day d, oldest first. Alone on the street.
  function sell(round, d, i, prev) {
    const r = market(round, d, [round.prices[i]], [prev || []])[0];
    return { i, price: r.price, visitors: r.visitors, cups: r.cups, profit: r.profit };
  }

  // One day for both streets. youI is the player's (or rule's) price index.
  // The bot plays its own street, against its own copy of the stands.
  function playDay(round, days, youI) {
    const d = days.length + 1;
    const youPrev = days.map((x) => x.you.price), botPrev = days.map((x) => x.bot.price);
    const rivPrev = round.rivals.map((_, j) => days.map((x) => x.rivals[j].price));
    const botRivPrev = round.rivals.map((_, j) => days.map((x) => x.botRivals[j].price));
    const rp = rivalsToday(round, d, youPrev, rivPrev);
    const brp = rivalsToday(round, d, botPrev, botRivPrev);
    const yr = market(round, d, [round.prices[youI]].concat(rp), [youPrev].concat(rivPrev));
    const bi = round.bot.pick();
    const br = market(round, d, [round.prices[bi]].concat(brp), [botPrev].concat(botRivPrev));
    round.bot.observe(bi, br[0].visitors, br[0].cups);
    const strip = (r, i) => ({ i, price: r.price, visitors: r.visitors, came: r.came, cups: r.cups, profit: r.profit });
    return {
      d, visitors: yr[0].visitors,
      you: strip(yr[0], youI), bot: strip(br[0], bi),
      rivals: yr.slice(1), botRivals: br.slice(1)
    };
  }

  // Total profit from holding one price all round, with the stands reacting.
  function holdTotal(round, x) {
    let s = 0;
    const mine = [], theirs = round.rivals.map(() => []);
    for (let d = 1; d <= round.days; d++) {
      const rp = rivalsToday(round, d, mine, theirs);
      s += market(round, d, [x].concat(rp), [mine].concat(theirs))[0].profit;
      mine.push(x);
      rp.forEach((v, j) => theirs[j].push(v));
    }
    return s;
  }

  // What each fixed price would have made over the whole round, on the same visitors.
  function hindsight(round) {
    const totals = round.prices.map((x) => holdTotal(round, x));
    const best = totals.indexOf(Math.max(...totals));
    return { totals, best, bestTotal: totals[best], bestPrice: round.prices[best] };
  }

  // Replay a list of prices (one per day) under other settings, same visitors.
  function replay(round, prices, settings) {
    const r = Object.assign({}, round, { s: normSettings(settings) });
    let s = 0;
    const mine = [], theirs = r.rivals.map(() => []);
    prices.forEach((x, k) => {
      const d = k + 1;
      const rp = rivalsToday(r, d, mine, theirs);
      s += market(r, d, [x].concat(rp), [mine].concat(theirs))[0].profit;
      mine.push(x);
      rp.forEach((v, j) => theirs[j].push(v));
    });
    return s;
  }

  // Expected profit per day at a price held steady, alone, for drawing the curve.
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
    change: 'cups sold yesterday compared with the day before',
    comp: 'competitor’s price yesterday'
  };
  const OPS = {
    gt: 'is more than', lt: 'is less than', up: 'went up', down: 'went down',
    below: 'is less than mine', above: 'is more than mine', same: 'is the same as mine'
  };
  const SUBJ_OPS = {
    cups: ['gt', 'lt', 'up', 'down'],
    profit: ['gt', 'lt', 'up', 'down'],
    change: ['gt', 'lt', 'up', 'down'],
    comp: ['below', 'above', 'same', 'down', 'up']
  };
  const ACTS = {
    raise: 'raise the price', lower: 'lower the price', keep: 'keep the price', best: 'go back to the best price so far',
    match: 'match the competitor', under: 'go under the competitor'
  };
  const STEPS = [0.5, 0.25];
  const MAX_LINES = 3;

  const PRESETS = {
    hold: { name: 'Hold one price', rule: { start: 3.5, explore: false, lines: [] } },
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
      rule: { start: 2.5, explore: false, lines: [{ subj: 'cups', op: 'lt', value: 30, act: 'lower', step: 0.5 }] }
    }
  };

  // Rules for a street with a stand across it.
  const STREET_PRESETS = {
    hold: { name: 'Hold one price', rule: { start: 4, explore: false, lines: [] } },
    match: {
      name: 'Match them',
      rule: {
        start: 4, explore: false, lines: [
          { subj: 'comp', op: 'below', value: 0, act: 'match', step: 0.25 },
          { subj: 'comp', op: 'above', value: 0, act: 'raise', step: 0.25 }
        ]
      }
    },
    under: {
      name: 'Always undercut',
      rule: {
        start: 3.5, explore: false, lines: [
          { subj: 'comp', op: 'below', value: 0, act: 'under', step: 0.25 },
          { subj: 'comp', op: 'same', value: 0, act: 'under', step: 0.25 }
        ]
      }
    },
    ignore: {
      name: 'Ignore them',
      rule: {
        start: 4, explore: false, lines: [
          { subj: 'cups', op: 'gt', value: 20, act: 'raise', step: 0.25 },
          { subj: 'cups', op: 'lt', value: 10, act: 'lower', step: 0.25 }
        ]
      }
    }
  };

  const clone = (o) => JSON.parse(JSON.stringify(o));

  // Make any rule safe to run: known words only, at most three lines, numbers finite.
  function normRule(r) {
    const src = r || {};
    const lines = (Array.isArray(src.lines) ? src.lines : []).slice(0, MAX_LINES).map((l) => {
      const subj = l && l.subj in SUBJECTS ? l.subj : 'cups';
      const op = l && SUBJ_OPS[subj].indexOf(l.op) >= 0 ? l.op : SUBJ_OPS[subj][0];
      return {
        subj, op,
        value: l && Number.isFinite(+l.value) ? +l.value : 0,
        act: l && l.act in ACTS ? l.act : 'keep',
        step: l && STEPS.indexOf(+l.step) >= 0 ? +l.step : 0.5
      };
    });
    const start = Number.isFinite(+src.start) ? +src.start : 3;
    return { start, explore: !!src.explore, lines };
  }

  // The menu price nearest to x (so anything off the menu clamps to its ends).
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
  // hist entries: { i, price, cups, profit, comp } where comp is the cheapest
  // competitor's price that day (null with nobody across the street).
  function check(l, hist) {
    const n = hist.length;
    if (!n) return null;
    const y = hist[n - 1], b = n > 1 ? hist[n - 2] : null;
    if (l.subj === 'comp') {
      if (y.comp === null || y.comp === undefined) return null;
      const c = y.comp, m = y.price;
      if (l.op === 'below') return c < m - 1e-9 ? 'they charged ' + fmt(c) + ', under your ' + fmt(m) : null;
      if (l.op === 'above') return c > m + 1e-9 ? 'they charged ' + fmt(c) + ', over your ' + fmt(m) : null;
      if (l.op === 'same') return Math.abs(c - m) < 1e-9 ? 'they charged ' + fmt(c) + ', the same as you' : null;
      if (!b || b.comp === null || b.comp === undefined) return null;
      if (l.op === 'up') return c > b.comp + 1e-9 ? 'they went up to ' + fmt(c) + ' from ' + fmt(b.comp) : null;
      return c < b.comp - 1e-9 ? 'they went down to ' + fmt(c) + ' from ' + fmt(b.comp) : null;
    }
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
  // Returns { i, line, why }. Every price it returns is on the menu.
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
    const comp = hist[n - 1].comp;
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
      if (l.act === 'match' || l.act === 'under') {
        if (comp === null || comp === undefined) return { i: cur, line: k, why: tag + 'nobody to follow, kept ' + fmt(prices[cur]) };
        const want = l.act === 'match' ? comp : comp - l.step;
        const j = nearest(prices, want);
        const edge = Math.abs(prices[j] - want) > 1e-9 ? (want < prices[0] ? ', the lowest price' : want > prices[prices.length - 1] ? ', the top price' : '') : '';
        return { i: j, line: k, why: tag + (j === cur ? 'stayed at ' : (l.act === 'match' ? 'matched at ' : 'went under to ')) + fmt(prices[j]) + edge };
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

  // The history a rule sees: its own days, plus the cheapest competitor price.
  function ruleHistory(days, who) {
    const k = who === 'bot' ? 'botRivals' : 'rivals';
    return days.map((x) => ({
      i: x[who].i, price: x[who].price, cups: x[who].cups, profit: x[who].profit,
      comp: x[k] && x[k].length ? Math.min.apply(null, x[k].map((r) => r.price)) : null
    }));
  }

  // Play one day with a rule. Returns the day with why and line attached.
  function ruleDay(round, days, rule) {
    const dec = decide(rule, round.prices, ruleHistory(days, 'you'));
    const day = playDay(round, days, dec.i);
    day.why = dec.why;
    day.line = dec.line;
    return day;
  }

  // Run a rule for the whole round beside the bot, on a fresh round.
  function runRule(round, ruleIn) {
    const rule = normRule(ruleIn);
    const days = [];
    for (let d = 1; d <= round.days; d++) days.push(ruleDay(round, days, rule));
    let you = 0, bot = 0;
    days.forEach((x) => { you += x.you.profit; bot += x.bot.profit; });
    return { days, you, bot, h: hindsight(round) };
  }

  /* ---------- What the stands are doing ---------- */

  // A one-line note about the street on day d (1-based), from the prices.
  // who: 'you' or 'bot' (whose street). names: stand names.
  function streetNote(round, days, d, who, names) {
    const k = who === 'bot' ? 'botRivals' : 'rivals';
    const R = round.rivals.length;
    if (!R || d < 1 || d > days.length) return null;
    const me = (t) => days[t - 1][who].price;
    const rv = (t, j) => days[t - 1][k][j].price;
    const you = who === 'bot' ? 'the bot' : 'you';
    const your = who === 'bot' ? 'the bot’s' : 'your';
    if (R === 1) {
      const key = round.rivals[0], x = rv(d, 0), name = names[0];
      if (d === 1) return { d, kind: 'open', text: 'Day 1: ' + name + ' opened at ' + fmt(x) + '.' };
      const y = me(d - 1), fl = RIVALS[key].floor;
      const atFloor = Math.abs(x - fl) < 1e-9 && key !== 'hold' && key !== 'match' && RIVALS[key].next(y) < fl - 1e-9;
      let what;
      if (key === 'hold') what = 'held ' + fmt(x) + ', whatever ' + you + ' charged';
      else if (atFloor) what = 'charged ' + fmt(x) + ', the lowest its rule allows. It can’t go under ' + your + ' ' + fmt(y);
      else if (key === 'match') what = 'matched ' + your + ' ' + fmt(y) + ' from yesterday';
      else if (key === 'above') what = 'charged ' + fmt(x) + ', 10% over ' + your + ' ' + fmt(y) + ' yesterday';
      else what = 'charged ' + fmt(x) + ', 25 cents under ' + your + ' ' + fmt(y) + ' yesterday';
      // A chase: the player has cut at least three times in the last week and the stand followed.
      let cuts = 0;
      for (let t = Math.max(2, d - 6); t <= d - 1; t++) if (me(t) < me(t - 1) - 1e-9) cuts++;
      const fell = d >= 8 && x < rv(d - 7, 0) - 1e-9;
      if (key !== 'hold' && cuts >= 3 && fell) {
        return { d, kind: 'chase', text: 'Day ' + d + ': ' + (who === 'bot' ? 'the bot has' : 'you have') + ' cut ' + cuts + ' times this week, and ' + name + ' followed down to ' + fmt(x) + '.' };
      }
      return { d, kind: atFloor ? 'floor' : 'react', text: 'Day ' + d + ': ' + name + ' ' + what + '.' };
    }
    // Two stands.
    const a = (t) => rv(t, 0), b = (t) => rv(t, 1);
    const low = (t) => Math.min(a(t), b(t));
    const floors = round.rivals.map((key) => RIVALS[key].floor);
    const both = (t) => fmt(a(t)) === fmt(b(t)) ? 'both charged ' + fmt(a(t)) : names[0] + ' charged ' + fmt(a(t)) + ' and ' + names[1] + ' ' + fmt(b(t));
    if (d === 1) return { d, kind: 'open', text: 'Day 1: ' + both(1) + '.' };
    const atFloors = Math.abs(a(d) - floors[0]) < 1e-9 && Math.abs(b(d) - floors[1]) < 1e-9;
    // How far back the street's lowest price has been moving one way.
    const dir = (t) => (low(t) < low(t - 1) - 1e-9 ? -1 : low(t) > low(t - 1) + 1e-9 ? 1 : 0);
    let s = d, sign = 0;
    for (let t = d; t >= 2; t--) {
      const v = dir(t);
      if (v === 0) { if (t >= d - 1) continue; break; }
      if (!sign) sign = v;
      if (v !== sign) break;
      s = t - 1;
    }
    // Were the stands following the player, or each other?
    const ledByMe = (t) => me(t - 1) < Math.min(a(t - 1), b(t - 1)) - 1e-9;
    let led = 0, span = 0;
    for (let t = Math.max(2, s + 1); t <= d; t++) { span++; if (ledByMe(t)) led++; }
    const moved = (t, j) => (rv(t, j) < rv(t - 1, j) - 1e-9 ? -1 : rv(t, j) > rv(t - 1, j) + 1e-9 ? 1 : 0);
    const everyDay = d >= 3 && [0, 1].every((j) => moved(d, j) === sign && moved(d - 1, j) === sign);
    if (atFloors && d >= 3 && low(d) < low(1) - 1e-9) {
      let first = d;
      while (first > 1 && Math.abs(a(first - 1) - floors[0]) < 1e-9 && Math.abs(b(first - 1) - floors[1]) < 1e-9) first--;
      const fl = floors[0] === floors[1] ? 'the lowest price their rules allow, ' + fmt(floors[0]) : 'the lowest prices their rules allow, ' + fmt(floors[0]) + ' and ' + fmt(floors[1]);
      return { d, kind: 'floor', first, text: 'Day ' + d + ': both competitors have been at ' + fl + ', since day ' + first + '. They can’t go lower.' };
    }
    if (sign && d - s >= 3 && Math.abs(low(d) - low(s)) >= 0.5 - 1e-9) {
      if (led * 2 > span) {
        return { d, kind: sign < 0 ? 'follow-down' : 'follow-up', start: s, text: 'Day ' + d + ': both competitors are following ' + your + ' price ' + (sign < 0 ? 'down' : 'up') + '. The cheaper competitor went from ' + fmt(low(s)) + ' on day ' + s + ' to ' + fmt(low(d)) + '.' };
      }
      const verb = sign < 0 ? (everyDay ? 'are now undercutting each other every day' : 'are taking turns undercutting each other')
        : (everyDay ? 'are now raising after each other every day' : 'are taking turns raising after each other');
      return { d, kind: sign < 0 ? 'spiral-down' : 'spiral-up', start: s, text: 'Day ' + d + ': both competitors ' + verb + '. The cheaper competitor went from ' + fmt(low(s)) + ' on day ' + s + ' to ' + fmt(low(d)) + '.' };
    }
    return { d, kind: 'calm', text: 'Day ' + d + ': ' + both(d) + '.' };
  }

  // Every note for a street, for the end of the round.
  function streetNotes(round, days, who, names) {
    const out = [];
    for (let d = 1; d <= days.length; d++) out.push(streetNote(round, days, d, who, names));
    return out;
  }

  // Play a whole round with a policy (for checks in node).
  function simulate(seed, policy, cfg) {
    const round = createRound(seed, cfg);
    const rr = mulberry32(mix(seed, 0x5EED));
    const days = [];
    for (let d = 1; d <= round.days; d++) {
      const yi = policy === 'random' ? Math.floor(rr() * round.prices.length) : typeof policy === 'number' ? policy : 0;
      days.push(playDay(round, days, yi));
    }
    let you = 0, bot = 0;
    days.forEach((x) => { you += x.you.profit; bot += x.bot.profit; });
    const h = hindsight(round);
    return { round, days, kind: CURVES[round.kind].key, best: round.prices[h.best], bestTotal: h.bestTotal, you, bot };
  }

  const Engine = {
    BASE, NINES, QUARTERS, COST, HOT, DECOY, FLOOR, TOP, OPEN, CURVES, CURVE_KEYS, DEFAULTS, ALL_OFF, SIZES, SPREAD,
    RIVALS, RIVAL_KEYS, LESSONS, SUBJECTS, OPS, SUBJ_OPS, ACTS, STEPS, MAX_LINES, PRESETS, STREET_PRESETS,
    mulberry32, mix, normal, gammaSample, betaSample, normSettings, ladder, isCharm, cents, config,
    kindOf, newSeed, makeBot, createRound, withRivals, refPrice, feel, buyChance, shopperShares, market, sell,
    rivalPrice, rivalsToday, clampRival, playDay, holdTotal, hindsight, replay, expectedProfit, settle,
    normRule, nearest, move, bestSoFar, check, decide, ruleHistory, ruleDay, runRule,
    streetNote, streetNotes, simulate, clone, fmt, dollars
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
  if (root) root.LemonadeEngine = Engine;
})(typeof window !== 'undefined' ? window : this);
