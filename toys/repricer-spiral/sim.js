/* The Repricer Spiral: the simulation, with no page code, so it can run in node too.
   One tick is one minute. A week is 10,080 ticks. */
(function (root) {
  "use strict";

  var WEEK = 7 * 24 * 60;
  var MAX_PRICE = 1e15; // past this the numbers stop meaning anything

  var DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  function money(p) {
    if (!isFinite(p)) return "no limit";
    return "$" + p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function when(t, total) {
    var day = Math.floor(t / 1440);
    var m = t % 1440;
    var h = Math.floor(m / 60);
    var mm = m % 60;
    var ap = h < 12 ? "am" : "pm";
    var h12 = h % 12 === 0 ? 12 : h % 12;
    var clock = h12 + ":" + (mm < 10 ? "0" : "") + mm + " " + ap;
    if (total > WEEK) return "Day " + (day + 1) + ", " + clock;
    return DAYS[day % 7] + " " + clock;
  }

  // What a rule asks for, given the lowest rival price. Floors and ceilings come after.
  function ask(s, rival) {
    if (s.rule === "undercut") return rival * (1 - s.pct / 100);
    if (s.rule === "above") return rival * (1 + s.pct / 100);
    return rival; // match
  }

  function round2(p) { return Math.round(p * 100) / 100; }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // cfg: { sellers: [...], weights: {price, fba, rating}, total }
  function create(cfg) {
    var sim = {
      t: 0,
      total: cfg.total || WEEK,
      weights: clone(cfg.weights),
      sellers: cfg.sellers.map(function (s) {
        var c = clone(s);
        if (c.ceiling == null || c.ceiling === "") c.ceiling = Infinity;
        c.price = c.start;
        c.wins = 0;
        c.everWon = false;
        c.passed = 0; // highest power of ten passed, for runaway notes
        return c;
      }),
      events: [],
      buckets: [],
      bucketSize: 1,
      lastMove: 0,
      quietLogged: false,
      holder: -1
    };
    sim.bucketSize = Math.max(1, Math.ceil(sim.total / 1400));
    var live = sim.sellers.filter(function (s) { return s.active; });
    if (live.length) {
      log(sim, 0, "Prices start at " + list(live.map(function (s) { return money(s.price); })) + ".");
    }
    sim.sellers.forEach(function (s) { s.passed = Math.floor(Math.log10(Math.max(s.price, 1))); });
    return sim;
  }

  function list(a) {
    if (a.length < 2) return a.join("");
    return a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
  }

  function log(sim, t, text) {
    if (sim.events.length >= 400) return;
    sim.events.push({ t: t, text: text });
    if (sim.events.length === 400) sim.events.push({ t: t, text: "That is enough notes for one run. The log stops here." });
  }

  function reacts(s, t) {
    var every = Math.max(1, s.every | 0);
    return ((t - (s.offset || 0)) % every + every) % every === 0;
  }

  function score(s, lowest, w) {
    return w.price * (lowest / s.price) + (s.fba ? w.fba : 0) + w.rating * (s.rating / 5);
  }

  function tick(sim) {
    var t = sim.t;
    var S = sim.sellers;
    var live = [];
    for (var i = 0; i < S.length; i++) if (S[i].active) live.push(S[i]);
    if (!live.length) { sim.t++; return; }

    var moved = false;
    for (i = 0; i < live.length; i++) {
      var s = live[i];
      if (live.length < 2 || !reacts(s, t)) continue;
      var rival = Infinity;
      for (var j = 0; j < live.length; j++) if (live[j] !== s && live[j].price < rival) rival = live[j].price;
      var was = s.price;
      var want = ask(s, rival);
      var next;
      if (s.reset && want <= s.floor && was <= s.floor && isFinite(s.ceiling)) {
        next = s.ceiling;
      } else {
        next = Math.min(Math.max(want, s.floor), s.ceiling, MAX_PRICE);
      }
      next = round2(next);
      if (next === was) continue;
      s.price = next;
      moved = true;
      if (next === s.ceiling && was <= s.floor && s.reset) {
        log(sim, t, s.name + " sat at its floor, so it jumped back to its ceiling of " + money(s.ceiling) + ".");
      } else if (next === s.floor && was > s.floor) {
        log(sim, t, s.name + " hit " + (s.mine ? "your" : "its") + " floor of " + money(s.floor) + ".");
      } else if (next === s.ceiling && was < s.ceiling) {
        log(sim, t, s.name + " hit " + (s.mine ? "your" : "its") + " ceiling of " + money(s.ceiling) + ".");
      }
      var p10 = Math.floor(Math.log10(Math.max(next, 1)));
      if (p10 > s.passed && next >= 100) {
        s.passed = p10;
        log(sim, t, s.name + " passed " + money(Math.pow(10, p10)) + ".");
      }
    }

    if (moved) { sim.lastMove = t; sim.quietLogged = false; }

    // The Buy Box: best score wins this minute. Exact ties share it.
    var lowest = Infinity;
    for (i = 0; i < live.length; i++) if (live[i].price < lowest) lowest = live[i].price;
    var best = -Infinity, winners = [];
    for (i = 0; i < live.length; i++) {
      var sc = score(live[i], lowest, sim.weights);
      if (sc > best + 1e-12) { best = sc; winners = [live[i]]; }
      else if (Math.abs(sc - best) <= 1e-12) winners.push(live[i]);
    }
    for (i = 0; i < winners.length; i++) {
      winners[i].wins += 1 / winners.length;
      if (!winners[i].everWon && live.length > 1) {
        winners[i].everWon = true;
        if (t > 0) log(sim, t, winners[i].name + " won the Buy Box for the first time, at " + money(winners[i].price) + ".");
      }
    }
    var holder = winners.length === 1 ? S.indexOf(winners[0]) : -1;
    sim.holder = holder;

    if (!sim.quietLogged && t - sim.lastMove >= 1440 && live.length > 1) {
      sim.quietLogged = true;
      var who = holder >= 0 ? S[holder].name + " holds the Buy Box at " + money(S[holder].price) + "." : "The Buy Box is shared.";
      log(sim, t, "Nothing has moved for a day. " + who);
    }

    // Chart samples: per bucket, each seller's low, high and last price, and the Buy Box holder.
    var bi = Math.floor(t / sim.bucketSize);
    var b = sim.buckets[bi];
    if (!b) {
      b = sim.buckets[bi] = { lo: [], hi: [], last: [], wins: [] };
      for (i = 0; i < S.length; i++) { b.lo[i] = Infinity; b.hi[i] = -Infinity; b.wins[i] = 0; }
    }
    for (i = 0; i < S.length; i++) {
      if (!S[i].active) { b.last[i] = null; continue; }
      var p = S[i].price;
      if (p < b.lo[i]) b.lo[i] = p;
      if (p > b.hi[i]) b.hi[i] = p;
      b.last[i] = p;
    }
    if (holder >= 0) b.wins[holder]++;

    sim.t++;
  }

  function run(sim, n) {
    var end = Math.min(sim.total, sim.t + n);
    while (sim.t < end) tick(sim);
    return sim.t >= sim.total;
  }

  // Ticks until the next minute when any active seller reacts (at least 1).
  function nextReaction(sim) {
    var live = sim.sellers.filter(function (s) { return s.active; });
    for (var k = 0; k < 1440 * 7; k++) {
      var t = sim.t + k;
      for (var i = 0; i < live.length; i++) if (reacts(live[i], t)) return k + 1;
    }
    return 60;
  }

  function seller(name, color, o) {
    var s = {
      name: name, color: color, mine: name === "You", active: true,
      rule: "undercut", pct: 1, start: 30, floor: 10, ceiling: null,
      every: 15, offset: 0, fba: false, rating: 4.5, reset: false
    };
    for (var k in o) s[k] = o[k];
    return s;
  }

  var DEFAULT_WEIGHTS = { price: 60, fba: 25, rating: 15 };

  var PRESETS = [
    {
      id: "floor",
      name: "Race to the floor",
      note: "Everyone undercuts the lowest rival a little, every few minutes. By Tuesday evening two of them sit on their floors and the third sits just under them. Nobody chose those prices. The rules did.",
      total: WEEK, log: false,
      sellers: [
        seller("You", "ember", { rule: "undercut", pct: 1, start: 29.99, floor: 15, ceiling: 40, every: 240, offset: 0, fba: false, rating: 4.8 }),
        seller("Bot A", "slate", { rule: "undercut", pct: 1, start: 31.5, floor: 12, ceiling: 40, every: 60, offset: 20, fba: true, rating: 4.4 }),
        seller("Bot B", "olive", { rule: "undercut", pct: 0.5, start: 30.25, floor: 14, ceiling: 40, every: 30, offset: 40, fba: false, rating: 4.6 })
      ]
    },
    {
      id: "sawtooth",
      name: "Sawtooth",
      note: "Bot A jumps back to its ceiling when it reaches its floor. Bot B jumps up to just under your price, and the race starts again. You never move.",
      total: WEEK, log: false,
      sellers: [
        seller("You", "ember", { rule: "match", pct: 0, start: 24, floor: 24, ceiling: 40, every: 60, offset: 0, fba: false, rating: 4.8 }),
        seller("Bot A", "slate", { rule: "undercut", pct: 1, start: 34, floor: 14, ceiling: 34, every: 20, offset: 5, fba: true, rating: 4.3, reset: true }),
        seller("Bot B", "olive", { rule: "undercut", pct: 1, start: 33, floor: 13, ceiling: 34, every: 20, offset: 15, fba: false, rating: 4.6 })
      ]
    },
    {
      id: "matchers",
      name: "Matchers",
      note: "Everyone matches the lowest rival. All three start at the same price, so nothing ever moves. The Buy Box goes to whoever scores best on the other things.",
      total: WEEK, log: false,
      sellers: [
        seller("You", "ember", { rule: "match", pct: 0, start: 24, floor: 10, ceiling: 40, every: 15, offset: 0, fba: false, rating: 4.9 }),
        seller("Bot A", "slate", { rule: "match", pct: 0, start: 24, floor: 10, ceiling: 40, every: 5, offset: 2, fba: true, rating: 4.4 }),
        seller("Bot B", "olive", { rule: "match", pct: 0, start: 24, floor: 10, ceiling: 40, every: 10, offset: 4, fba: false, rating: 4.7 })
      ]
    },
    {
      id: "fly",
      name: "The $23.7 million book",
      note: "In 2011 Michael Eisen found a biology book listed at $23,698,655.93. One seller priced at 0.9983 times the other. The other priced at 1.270589 times the first. Each reacted once a day, with no ceiling. You sit this one out.",
      total: 8 * WEEK, log: true,
      sellers: [
        seller("You", "ember", { active: false, rule: "undercut", pct: 1, start: 35, floor: 10, ceiling: 60, every: 60, offset: 0, fba: false, rating: 4.8 }),
        seller("Bot A", "slate", { rule: "undercut", pct: 0.17, start: 35, floor: 0, ceiling: null, every: 1440, offset: 15 * 60, fba: false, rating: 4.6 }),
        seller("Bot B", "olive", { rule: "above", pct: 27.0589, start: 35, floor: 0, ceiling: null, every: 1440, offset: 9 * 60, fba: true, rating: 4.7 })
      ]
    }
  ];

  var api = {
    WEEK: WEEK, DAYS: DAYS, PRESETS: PRESETS, DEFAULT_WEIGHTS: DEFAULT_WEIGHTS,
    create: create, run: run, tick: tick, nextReaction: nextReaction,
    money: money, when: when, reacts: reacts, score: score, clone: clone
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Repricer = api;
})(this);
