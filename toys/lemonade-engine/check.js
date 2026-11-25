/* Checks for the shared Lemonade logic. Run: node toys/lemonade-engine/check.js
   Not needed by the toys themselves; a packager can leave it out. */
'use strict';
const assert = require('assert');
const path = require('path');
const E = require('./engine.js');
let O = null;
try { O = require(path.join(__dirname, '../price-the-lemonade/toy.js')); } catch (e) { /* optional */ }

const say = (...a) => console.log(...a);
const keyOf = (days) => days.map((x) => [x.you.price, x.you.cups, x.bot.price, x.bot.cups, x.rivals.map((r) => r.price + '/' + r.cups).join(',')].join(':')).join('|');

// 1. The same seed reproduces, in every lesson.
for (const lesson of [1, 2, 3, 4]) {
  const c = E.config({ lesson });
  const a = E.simulate(12345, 'random', c), b = E.simulate(12345, 'random', c), z = E.simulate(12349, 'random', c);
  assert.strictEqual(keyOf(a.days), keyOf(b.days), 'lesson ' + lesson + ' reproduces');
  assert.notStrictEqual(keyOf(a.days), keyOf(z.days), 'lesson ' + lesson + ' differs by seed');
  say('lesson ' + lesson + ': seed 12345 reproduces (' + a.days.length + ' days, random prices made ' + E.dollars(a.you) + ', bot ' + E.dollars(a.bot) + ', best fixed ' + E.fmt(a.best) + ' for ' + E.dollars(a.bestTotal) + ')');
}

// 2. With no competitor, the visitor model is lesson 1's (and Price the Lemonade's).
for (const seed of [8, 9, 10, 11, 4001]) {
  const r1 = E.createRound(seed, E.config({ lesson: 1 }));
  // A lesson-3 round with its competitor removed, on the lesson-1 menu.
  const r3 = E.withRivals(E.createRound(seed, Object.assign(E.config({ lesson: 3 }), { menu: 'half', days: 30 })), []);
  for (let d = 1; d <= 30; d++) {
    for (let i = 0; i < 9; i++) {
      const a = E.sell(r1, d, i, []), b = E.market(r3, d, [r3.prices[i]], [[]])[0];
      assert.strictEqual(a.cups, b.cups, 'no-competitor street matches lesson 1');
    }
  }
  if (O) {
    const o = O.createRound(seed, { charm: false, ref: false, anchor: false, nines: false });
    const od = [], ed = [];
    for (let d = 1; d <= 30; d++) {
      const i = (d * 7 + seed) % 9;
      od.push(O.playDay(o, od, i)); ed.push(E.playDay(r1, ed, i));
      assert.strictEqual(ed[d - 1].you.cups, od[d - 1].you.cups);
      assert.strictEqual(ed[d - 1].bot.i, od[d - 1].bot.i, 'bot picks match Price the Lemonade');
    }
    const o2 = O.createRound(seed, {}), r2 = E.createRound(seed, E.config({ lesson: 2 }));
    const od2 = [], ed2 = [];
    for (let d = 1; d <= 30; d++) {
      const i = (d * 5) % 13;
      od2.push(O.playDay(o2, od2, i)); ed2.push(E.playDay(r2, ed2, i));
      assert.strictEqual(ed2[d - 1].you.cups, od2[d - 1].you.cups, 'lesson 2 matches Price the Lemonade with effects on');
    }
  }
}
say('no competitor: lesson 3\'s street with nobody across it sells exactly what lesson 1 sells' + (O ? ', and lessons 1 and 2 match Price the Lemonade day for day (sales and bot picks)' : ''));

// 3. "Stay 25 cents under you" ends each day 25 cents under your previous price, clamped to its floor.
{
  const r = E.createRound(4242, E.config({ lesson: 3, rivals: ['under'] }));
  const days = [];
  const path = [4, 4, 3.5, 3, 2.5, 2.25, 2, 2, 3, 5.75, 6, 2.25];
  path.forEach((p) => days.push(E.playDay(r, days, r.prices.indexOf(p))));
  const seen = [];
  days.forEach((x, k) => {
    const want = k === 0 ? E.OPEN : Math.max(2, path[k - 1] - 0.25);
    assert.strictEqual(x.rivals[0].price, want, 'day ' + (k + 1));
    seen.push(E.fmt(x.rivals[0].price));
  });
  // Its own copy reacts to the bot instead.
  days.forEach((x, k) => { if (k) assert.strictEqual(x.botRivals[0].price, Math.max(2, days[k - 1].bot.price - 0.25)); });
  const u = E.createRound(4242, E.config({ lesson: 3, rivals: ['undercut'] }));
  const ud = [];
  path.forEach((p) => ud.push(E.playDay(u, ud, u.prices.indexOf(p))));
  ud.forEach((x, k) => { if (k) assert.strictEqual(x.rivals[0].price, Math.max(2.5, path[k - 1] - 0.25)); });
  say('under you: your prices ' + path.map(E.fmt).join(' ') + '\n            its prices  ' + seen.join(' ') + '  (floor $2.00; the "never below $2.50" stand stops at $2.50)');
}

// 4. Lesson 4: two undercutting stands spiral to their floors while you hold a price.
for (const pair of [['under', 'under'], ['under', 'match'], ['undercut', 'under']]) {
  const c = E.config({ lesson: 4, rivals: pair });
  const r = E.createRound(777, c);
  const days = [];
  const hold = r.prices.indexOf(4.5);
  for (let d = 1; d <= c.days; d++) days.push(E.playDay(r, days, hold));
  // Where they come to rest: each at its floor, unless the other's floor holds it up
  // (a "25 under" stand facing a $2.50 floor rests at $2.25).
  const floors = pair.map((k) => E.RIVALS[k].floor);
  if (pair[0] === 'undercut' && pair[1] === 'under') floors[1] = 2.25;
  const first = days.findIndex((x) => x.rivals.every((s, j) => s.price === floors[j])) + 1;
  assert(first > 0 && first <= c.days, pair.join('+') + ' reach floors');
  assert(days.slice(first - 1).every((x) => x.rivals.every((s, j) => s.price === floors[j])), 'and stay there');
  const notes = E.streetNotes(r, days, 'you', ['Stand A', 'Stand B']);
  const spiral = notes.find((n) => n && n.kind === 'spiral-down');
  assert(spiral, 'a spiral note appears');
  say('lesson 4, ' + pair.map((k) => E.RIVALS[k].many).join(' + ') + ', you hold $4.50: resting at ' + floors.map(E.fmt).join('/') + ' by day ' + first +
    '. Prices days 1-8: ' + days.slice(0, 8).map((x) => x.rivals.map((s) => s.price.toFixed(2)).join('/')).join(' ') +
    '\n   note: "' + spiral.text + '"');
}
{
  // Upward: "10% above the cheapest" plus a player rule that raises when they're above.
  const c = E.config({ lesson: 4, rivals: ['above', 'above'] });
  const r = E.createRound(778, c);
  const rule = { start: 3, lines: [{ subj: 'comp', op: 'above', act: 'raise', step: 0.25 }] };
  const days = [];
  for (let d = 1; d <= 30; d++) days.push(E.ruleDay(r, days, rule));
  say('lesson 4, both "10% above the cheapest", your rule raises when they are above: you go ' + days.filter((x, k) => k % 5 === 0).map((x) => E.fmt(x.you.price)).join(' ') + ' (every 5th day)');
}

// 5. Rules clamp to the menu.
{
  const q = E.QUARTERS;
  const h = (price, comp) => [{ i: q.indexOf(price), price, cups: 10, profit: 20, comp }];
  assert.strictEqual(q[E.decide({ start: 1 }, q, []).i], 2, 'start below the menu');
  assert.strictEqual(q[E.decide({ start: 99 }, q, []).i], 6, 'start above the menu');
  assert.strictEqual(q[E.decide({ start: 3.1 }, q, []).i], 3, 'start snaps');
  const under = { lines: [{ subj: 'comp', op: 'below', act: 'under', step: 0.5 }] };
  assert.strictEqual(q[E.decide(under, q, h(2.25, 2)).i], 2, 'going under $2.00 stays at $2.00');
  const lower = { lines: [{ subj: 'cups', op: 'lt', value: 50, act: 'lower', step: 0.5 }] };
  const dl = E.decide(lower, q, h(2, null));
  assert.strictEqual(q[dl.i], 2, 'lowering at the bottom stays');
  const raise = { lines: [{ subj: 'cups', op: 'gt', value: 0, act: 'raise', step: 0.5 }] };
  assert.strictEqual(q[E.decide(raise, q, h(6, null)).i], 6, 'raising at the top stays');
  const match = { lines: [{ subj: 'comp', op: 'below', act: 'match' }] };
  assert.strictEqual(q[E.decide(match, q, h(4, 3.6)).i], 3.5, 'matching $3.60 lands on $3.50, the nearest menu price');
  const half = E.BASE;
  assert.strictEqual(half[E.decide(under, half, [{ i: 2, price: 3, cups: 1, profit: 1, comp: 2.75 }]).i], 2, 'on a 50-cent menu, under $2.75 by 50 cents snaps to $2.00');
  const junk = E.normRule({ start: 'x', lines: [{ subj: 'nope', op: 'below', act: 'fly', step: 9 }, {}, {}, {}] });
  assert.strictEqual(junk.lines.length, 3); assert.strictEqual(junk.lines[0].subj, 'cups'); assert.strictEqual(junk.lines[0].op, 'gt'); assert.strictEqual(junk.lines[0].act, 'keep');
  // A whole run of every preset stays on the menu.
  for (const k of Object.keys(E.STREET_PRESETS)) {
    const r = E.createRound(31337, E.config({ lesson: 3 }));
    const res = E.runRule(r, E.STREET_PRESETS[k].rule);
    assert(res.days.every((x) => q.indexOf(x.you.price) >= 0));
    say('rule "' + E.STREET_PRESETS[k].name + '" vs stay 25 under, seed 31337: ' + E.dollars(res.you) + ' (bot ' + E.dollars(res.bot) + ', stand ' + E.dollars(res.days.reduce((s, x) => s + x.rivals[0].profit, 0)) + '), ended at ' + E.fmt(res.days[89].you.price));
  }
  say('rules clamp to the menu: start $1 -> $2.00, start $99 -> $6.00, under $2.00 -> $2.00, raise at $6.00 -> $6.00, match $3.60 -> $3.50');
}

// 6. The visitor split.
{
  const s = E.shopperShares([3, 3.5]);
  assert(Math.abs(s[0] - 0.75) < 1e-9);
  const r = E.createRound(5, E.config({ lesson: 3 }));
  let came = [0, 0], n = 0;
  for (let d = 1; d <= 90; d++) { const m = E.market(r, d, [3.5, 3.5], [[], []]); came[0] += m[0].came; came[1] += m[1].came; n += m[0].visitors; }
  const r2 = E.createRound(5, E.config({ lesson: 3 }));
  let c2 = [0, 0];
  for (let d = 1; d <= 90; d++) { const m = E.market(r2, d, [3, 3.5], [[], []]); c2[0] += m[0].came; c2[1] += m[1].came; }
  say('split: a 50-cent gap sends ' + Math.round(s[0] * 100) + '% of shoppers to the cheaper stand. Equal prices: ' + Math.round(came[0] / n * 100) + '% / ' + Math.round(came[1] / n * 100) + '%' +
    ' of visitors. $3.00 vs $3.50: ' + Math.round(c2[0] / n * 100) + '% / ' + Math.round(c2[1] / n * 100) + '% (20% regulars at each)');
  for (const lesson of [3, 4]) {
    const c = E.config({ lesson });
    for (const seed of [4, 5, 6]) {
      const r3 = E.createRound(seed, c);
      const best = {};
      E.RIVAL_KEYS.forEach((k) => { best[k] = E.fmt(E.hindsight(E.withRivals(r3, lesson === 3 ? [k] : [k, k])).bestPrice); });
      const alone = E.hindsight(E.withRivals(r3, []));
      say('lesson ' + lesson + ' seed ' + seed + ' (' + r3.def.key + '): best price to hold alone ' + E.fmt(alone.bestPrice) + '; against ' + (lesson === 3 ? '' : 'two of ') + Object.keys(best).map((k) => k + ' ' + best[k]).join(', '));
    }
  }
}
say('All checks passed.');
