/* Twelve Reviews: a "which would you buy" game about small samples.
   Math: a Dirichlet prior over the five star levels for each category.
   Posterior = prior + observed counts. P(A better than B) by sampling. */
(function () {
  'use strict';

  // ---------- random numbers ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashSeed(s) {
    s = String(s);
    if (/^\d+$/.test(s)) return Number(s) >>> 0;
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function normal(rng) {
    var u = 0, v = 0;
    while (u === 0) u = rng();
    v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // Marsaglia and Tsang (2000). Shapes below 1 use the boost Gamma(a+1) * U^(1/a).
  function gamma(rng, a) {
    if (a < 1) {
      var u0 = rng();
      while (u0 === 0) u0 = rng();
      return gamma(rng, a + 1) * Math.pow(u0, 1 / a);
    }
    var d = a - 1 / 3, c = 1 / Math.sqrt(9 * d);
    for (;;) {
      var x, v;
      do { x = normal(rng); v = 1 + c * x; } while (v <= 0);
      v = v * v * v;
      var u = rng();
      if (u < 1 - 0.0331 * x * x * x * x) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  }

  function dirichlet(rng, alpha) {
    var g = alpha.map(function (a) { return gamma(rng, a); });
    var s = g.reduce(function (p, q) { return p + q; }, 0);
    return g.map(function (x) { return x / s; });
  }

  // ---------- stars ----------
  // Arrays are indexed 0..4 for 1..5 stars.
  function meanStars(p) {
    var s = 0, t = 0;
    for (var i = 0; i < 5; i++) { s += (i + 1) * p[i]; t += p[i]; }
    return t ? s / t : 0;
  }
  function total(c) { return c.reduce(function (a, b) { return a + b; }, 0); }

  function sampleReviews(rng, p, n) {
    var counts = [0, 0, 0, 0, 0];
    for (var j = 0; j < n; j++) {
      var r = rng(), acc = 0, k = 0;
      for (; k < 4; k++) { acc += p[k]; if (r < acc) break; }
      counts[k]++;
    }
    return counts;
  }

  // ---------- categories (illustrative priors, not fitted to data) ----------
  // shape: share of reviews at 1..5 stars for a typical product in the aisle.
  // K: prior strength, in reviews. About 30 reviews of evidence balance it.
  var K = 30;
  var CATEGORIES = [
    { name: 'Phone cables', shape: [.03, .02, .04, .14, .77],
      note: 'Phone cables sit near 4.6. One-star piles are rare.',
      items: ['Braided USB-C cable, 2 m', 'USB-C to Lightning, 1 m', 'Right-angle charging cable', 'Three-pack of short cables', 'Coiled car cable'] },
    { name: "Kids' books", shape: [.02, .01, .03, .12, .82],
      note: "Kids' books sit near 4.7. Almost everything is loved.",
      items: ['Board book about tractors', 'Bedtime counting book', 'Lift-the-flap animals', 'Picture book about a lost mitten', 'First word book'] },
    { name: 'Water bottles', shape: [.04, .03, .05, .16, .72],
      note: 'Water bottles sit near 4.5, with a small tail of leaks.',
      items: ['Insulated steel bottle, 750 ml', 'Glass bottle with sleeve', 'Collapsible silicone bottle', 'Wide-mouth bottle with straw'] },
    { name: 'Phone cases', shape: [.06, .04, .07, .18, .65],
      note: 'Phone cases sit near 4.3. Some arrive the wrong size.',
      items: ['Clear slim case', 'Rugged case with stand', 'Leather folio case', 'Silicone case, matte'] },
    { name: 'Air fryers', shape: [.09, .04, .06, .16, .65],
      note: 'Air fryers sit near 4.2. A real share of buyers get a dud.',
      items: ['Basket air fryer, 4 L', 'Dual-drawer air fryer', 'Compact air fryer, 2 L', 'Air fryer oven'] },
    { name: 'Hair dryers', shape: [.10, .05, .08, .20, .57],
      note: 'Hair dryers sit near 4.1 and split opinion. Lots of 1s.',
      items: ['Ionic hair dryer', 'Travel hair dryer, folding', 'Dryer with diffuser', 'Quiet salon dryer'] },
    { name: 'Coffee grinders', shape: [.12, .05, .07, .18, .58],
      note: 'Coffee grinders sit near 4.1. People either love them or return them.',
      items: ['Burr grinder, 40 settings', 'Blade grinder', 'Hand grinder, steel burrs', 'Conical burr grinder'] },
    { name: 'Wireless earbuds', shape: [.14, .06, .08, .17, .55],
      note: 'Earbuds sit near 3.9. Many 1-star reviews about one ear dying.',
      items: ['Earbuds with charging case', 'Sport earbuds with hooks', 'Noise-cancelling earbuds', 'Budget earbuds'] }
  ];
  CATEGORIES.forEach(function (c) {
    var s = total(c.shape);
    c.alpha = c.shape.map(function (x) { return K * x / s; });
  });

  // ---------- posterior ----------
  function posteriorDraws(rng, alpha, counts, n) {
    var post = alpha.map(function (a, i) { return a + counts[i]; });
    var out = new Float64Array(n);
    for (var j = 0; j < n; j++) out[j] = meanStars(dirichlet(rng, post));
    return { draws: out, mean: meanStars(post) };
  }

  function quantile(sorted, q) {
    var pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }

  // Compare two products in one category. Interval is the middle 95%.
  function compare(alpha, countsA, countsB, seed, n) {
    n = n || 4000;
    var rng = mulberry32(seed >>> 0);
    var a = posteriorDraws(rng, alpha, countsA, n);
    var b = posteriorDraws(rng, alpha, countsB, n);
    var wins = 0;
    for (var j = 0; j < n; j++) wins += a.draws[j] > b.draws[j] ? 1 : a.draws[j] === b.draws[j] ? 0.5 : 0;
    function summary(x) {
      var s = Array.prototype.slice.call(x.draws).sort(function (p, q) { return p - q; });
      return { mean: x.mean, lo: quantile(s, 0.025), hi: quantile(s, 0.975) };
    }
    return { a: summary(a), b: summary(b), pAB: wins / n };
  }

  // Evan Miller's lower bound for star ratings (from "Ranking Items With Star
  // Ratings", his follow-up to "How Not To Sort By Average Rating"): a flat
  // prior of one review at each level, then mean minus z standard errors.
  function millerLowerBound(counts, z) {
    z = z || 1.65;
    var N = total(counts) + 5, m = 0, m2 = 0;
    for (var i = 0; i < 5; i++) {
      var w = (counts[i] + 1) / N, s = i + 1;
      m += s * w; m2 += s * s * w;
    }
    return m - z * Math.sqrt(Math.max(0, m2 - m * m) / (N + 1));
  }

  // ---------- rounds ----------
  function intBetweenLog(rng, lo, hi) {
    return Math.round(Math.exp(Math.log(lo) + rng() * (Math.log(hi) - Math.log(lo))));
  }
  function round1(x) { return Math.round(x * 10) / 10; }

  function makeProduct(rng, cat, n) {
    var truth = dirichlet(rng, cat.alpha);
    var counts = sampleReviews(rng, truth, n);
    return { truth: truth, trueMean: meanStars(truth), counts: counts, n: n, avg: meanStars(counts) };
  }

  function postMean(alpha, counts) {
    return meanStars(alpha.map(function (a, i) { return a + counts[i]; }));
  }

  // Most rounds: a high average on few reviews against a slightly lower one on many.
  // smallFavoured says which way the posterior should lean, so the answer is not
  // always "trust the big sample" (or, with a strong prior, always the small one).
  function makeRound(rng, cat, interesting, smallFavoured) {
    var best = null;
    for (var t = 0; t < 600; t++) {
      var small, big;
      if (interesting) {
        small = makeProduct(rng, cat, intBetweenLog(rng, 5, 40));
        big = makeProduct(rng, cat, intBetweenLog(rng, 350, 3200));
      } else {
        small = makeProduct(rng, cat, intBetweenLog(rng, 15, 120));
        big = makeProduct(rng, cat, intBetweenLog(rng, 120, 900));
      }
      var gap = round1(small.avg) - round1(big.avg);
      var ok = interesting ? gap >= 0.15 && gap <= 0.55 : Math.abs(gap) >= 0.1 && Math.abs(gap) <= 0.4;
      if (!ok) continue;
      var lean = postMean(cat.alpha, small.counts) - postMean(cat.alpha, big.counts);
      var right = smallFavoured ? lean > 0.02 : lean < -0.02;
      if (right || !best) best = { small: small, big: big };
      if (right && Math.abs(lean) < 0.18) break; // close calls make better rounds
    }
    return best || { small: small, big: big };
  }

  function makeGame(seed, rounds) {
    rounds = rounds || 10;
    var rng = mulberry32(hashSeed(seed));
    var order = CATEGORIES.slice();
    for (var i = order.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1)), tmp = order[i]; order[i] = order[j]; order[j] = tmp;
    }
    var plain = [2 + Math.floor(rng() * 3), 6 + Math.floor(rng() * 3)]; // two calmer rounds
    var out = [];
    for (var r = 0; r < rounds; r++) {
      var cat = order[r % order.length];
      var pair = makeRound(rng, cat, plain.indexOf(r) < 0, rng() < 0.4);
      var names = cat.items.slice(), nA = names.splice(Math.floor(rng() * names.length), 1)[0];
      var nB = names[Math.floor(rng() * names.length)];
      pair.small.name = nA; pair.big.name = nB;
      var smallLeft = rng() < 0.5;
      out.push({
        cat: cat,
        products: smallLeft ? [pair.small, pair.big] : [pair.big, pair.small],
        seed: (hashSeed(seed) ^ Math.imul(r + 1, 0x9E3779B1)) >>> 0
      });
    }
    return out;
  }

  var api = { mulberry32: mulberry32, hashSeed: hashSeed, gamma: gamma, dirichlet: dirichlet,
    compare: compare, millerLowerBound: millerLowerBound, CATEGORIES: CATEGORIES, K: K,
    makeGame: makeGame, meanStars: meanStars };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;

  // ---------- page ----------
  var $ = function (s) { return document.querySelector(s); };
  var fmt1 = function (x) { return x.toFixed(1); };
  var fmt2 = function (x) { return x.toFixed(2); };
  var fmtN = function (n) { return n.toLocaleString('en-US'); };
  var pct = function (p) {
    var v = Math.round(p * 100);
    if (v >= 100) return 'over 99%';
    if (v <= 0) return 'under 1%';
    return v + '%';
  };

  var params = new URLSearchParams(location.search);
  var seed = params.get('seed') || String(Math.floor(Math.random() * 1e6));
  var ROUNDS = 10;
  var game, idx, focus, results, picked;

  function start(s) {
    seed = String(s);
    game = makeGame(seed, ROUNDS);
    idx = 0; results = [];
    $('#end').hidden = true;
    $('#play').hidden = false;
    var link = location.pathname + '?seed=' + encodeURIComponent(seed);
    $('#seed').textContent = seed;
    $('#seed-link').href = link;
    show();
  }

  function histogram(counts) {
    var n = total(counts) || 1, html = '';
    for (var i = 4; i >= 0; i--) {
      var share = counts[i] / n;
      html += '<div class="bar"><span class="bar__label">' + (i + 1) + '★</span>' +
        '<span class="bar__track"><span class="bar__fill" style="width:' + (share * 100).toFixed(1) + '%"></span></span>' +
        '<span class="bar__pct">' + Math.round(share * 100) + '%</span></div>';
    }
    return html;
  }

  function show() {
    var round = game[idx];
    picked = null; focus = -1;
    $('#round-no').textContent = 'Round ' + (idx + 1) + ' of ' + ROUNDS;
    $('#aisle').textContent = round.cat.name;
    var cards = document.querySelectorAll('.product');
    round.products.forEach(function (p, i) {
      var c = cards[i];
      c.classList.remove('is-picked', 'is-other', 'is-focus');
      c.querySelector('.product__name').textContent = p.name;
      c.querySelector('.product__avg').textContent = fmt1(round1(p.avg));
      c.querySelector('.product__count').textContent = fmtN(p.n) + (p.n === 1 ? ' review' : ' reviews');
      c.querySelector('.hist').innerHTML = histogram(p.counts);
      var btn = c.querySelector('.pick');
      btn.disabled = false;
      btn.textContent = 'Pick this one';
    });
    $('#reveal').hidden = true;
    $('#tally').textContent = tallyText();
  }

  function tallyText() {
    if (!results.length) return 'Picks so far: none.';
    var smaller = results.filter(function (r) { return r.choseSmaller; }).length;
    var likely = results.filter(function (r) { return r.likelier; }).length;
    return 'Smaller sample picked: ' + smaller + ' of ' + results.length +
      '. Likelier-better pick: ' + likely + ' of ' + results.length + '.';
  }

  function describe(p, s, label) {
    var avg = fmt1(round1(p.avg)), width = s.hi - s.lo;
    var lead = label + ' ' + avg + ' had ' + fmtN(p.n) + (p.n === 1 ? ' review. ' : ' reviews. ');
    if (width < 0.2) return lead + 'Its true average is almost certainly ' + fmt1(s.lo) + ' to ' + fmt1(s.hi) + '.';
    if (width < 0.5) return lead + 'Its true average is probably ' + fmt1(s.lo) + ' to ' + fmt1(s.hi) + '.';
    return lead + 'Its true average could be anywhere from ' + fmt1(s.lo) + ' to ' + fmt1(s.hi) + '.';
  }

  function pick(i) {
    if (picked !== null || !game) return;
    picked = i;
    var round = game[idx], A = round.products[0], B = round.products[1];
    var cmp = compare(round.cat.alpha, A.counts, B.counts, round.seed, 4000);
    var sums = [cmp.a, cmp.b];
    var pPick = i === 0 ? cmp.pAB : 1 - cmp.pAB;
    var smallIdx = A.n < B.n ? 0 : 1;
    results.push({ choseSmaller: i === smallIdx, likelier: pPick > 0.5, pPick: pPick,
      smallLikelier: (smallIdx === 0 ? cmp.pAB : 1 - cmp.pAB) > 0.5,
      truthPick: round.products[i].trueMean > round.products[1 - i].trueMean });

    document.querySelectorAll('.product').forEach(function (c, j) {
      c.classList.remove('is-focus');
      c.classList.add(j === i ? 'is-picked' : 'is-other');
      var btn = c.querySelector('.pick');
      btn.disabled = true;
      btn.textContent = j === i ? 'Your pick' : 'Not picked';
    });

    // Labels: "The 4.8" unless both show the same average.
    var same = fmt1(round1(A.avg)) === fmt1(round1(B.avg));
    var labels = same ? ['The left one, at', 'The right one, at'] : ['The', 'The'];
    var first = [i, 1 - i];
    var copy = first.map(function (j) { return describe(round.products[j], sums[j], labels[j]); });
    $('#reveal-copy').textContent = copy.join(' ') + ' Chance your pick is the better one: ' + pct(pPick) + '.';

    // Shared scale for the two intervals.
    var lo = Math.min(sums[0].lo, sums[1].lo), hi = Math.max(sums[0].hi, sums[1].hi);
    var pad = Math.max(0.1, (hi - lo) * 0.12);
    lo = Math.max(1, lo - pad); hi = Math.min(5, hi + pad);
    var pos = function (x) { return ((x - lo) / (hi - lo) * 100).toFixed(2) + '%'; };
    var rows = '';
    round.products.forEach(function (p, j) {
      var s = sums[j];
      rows += '<div class="iv' + (j === i ? ' iv--pick' : '') + '">' +
        '<span class="iv__name">' + (j === 0 ? 'Left' : 'Right') + (j === i ? ', your pick' : '') + '</span>' +
        '<span class="iv__track"><span class="iv__range" style="left:' + pos(s.lo) + ';width:calc(' + pos(s.hi) + ' - ' + pos(s.lo) + ')"></span>' +
        '<span class="iv__dot" style="left:' + pos(s.mean) + '"></span></span>' +
        '<span class="iv__val">' + fmt2(s.mean) + ' <span class="muted">(' + fmt2(s.lo) + '–' + fmt2(s.hi) + ')</span></span></div>';
    });
    rows += '<div class="iv iv--axis"><span></span><span class="iv__axis"><span>' + fmt1(lo) + '</span><span>' + fmt1(hi) + '</span></span><span></span></div>';
    $('#intervals').innerHTML = rows;

    var lbA = millerLowerBound(A.counts), lbB = millerLowerBound(B.counts);
    var lbWinner = Math.abs(lbA - lbB) < 0.005 ? 'calls it a tie' : 'ranks the ' + (lbA > lbB ? 'left' : 'right') + ' one higher';
    $('#miller').textContent = 'Lower bound: left ' + fmt2(lbA) + ', right ' + fmt2(lbB) + '. It ' + lbWinner + '.';
    $('#aisle-note').textContent = round.cat.note;
    $('#truth').textContent = 'Behind the curtain, the left one was really ' + fmt2(A.trueMean) +
      ' and the right one ' + fmt2(B.trueMean) + '.';

    $('#next').textContent = idx + 1 < ROUNDS ? 'Next round' : 'See the summary';
    $('#tally').textContent = tallyText();
    $('#reveal').hidden = false;
    $('#next').focus({ preventScroll: true });
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    $('#reveal').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
  }

  function next() {
    if (picked === null) return;
    idx++;
    if (idx < ROUNDS) { show(); $('#play').scrollIntoView({ block: 'start' }); return; }
    finish();
  }

  function finish() {
    $('#play').hidden = true;
    $('#end').hidden = false;
    var n = results.length;
    var smaller = results.filter(function (r) { return r.choseSmaller; }).length;
    var likely = results.filter(function (r) { return r.likelier; }).length;
    var smallWon = results.filter(function (r) { return r.smallLikelier; }).length;
    var truth = results.filter(function (r) { return r.truthPick; }).length;
    var avgP = results.reduce(function (s, r) { return s + r.pPick; }, 0) / n;
    var lines = [
      'You picked the smaller sample ' + smaller + ' of ' + n + ' times.',
      'The smaller sample was the likelier-better product in ' + smallWon + ' of ' + n + ' rounds.',
      'Your pick was the likelier-better one ' + likely + ' of ' + n + ' times. On average, each pick had a ' + pct(avgP) + ' chance of being the better product.',
      'Checked against the hidden truth, your pick really was better ' + truth + ' of ' + n + ' times.'
    ];
    var verdict;
    if (smaller >= 6 && smallWon <= 4) verdict = 'A high average on a few reviews pulled you in more often than the numbers back up. Most people do the same.';
    else if (smaller <= 4 && smallWon >= 6) verdict = 'You leaned on the bigger samples, but this shelf mostly favoured the small ones. The aisle matters as much as the count.';
    else if (smaller <= 4) verdict = 'You leaned on the bigger samples. On this shelf, that was usually the better bet.';
    else verdict = 'You mixed it up. The useful habit is asking how many reviews stand behind the average, then how this kind of product usually rates.';
    $('#summary').innerHTML = lines.map(function (l) { return '<li>' + l + '</li>'; }).join('');
    $('#verdict').textContent = verdict;
    $('#again').focus({ preventScroll: true });
  }

  function setFocus(i) {
    if (picked !== null) return;
    focus = i;
    document.querySelectorAll('.product').forEach(function (c, j) { c.classList.toggle('is-focus', j === i); });
  }

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if ($('#play').hidden) return;
    var tag = (e.target && e.target.tagName) || '';
    if (picked === null) {
      if (e.key === '1') { pick(0); e.preventDefault(); }
      else if (e.key === '2') { pick(1); e.preventDefault(); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { setFocus(0); e.preventDefault(); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { setFocus(1); e.preventDefault(); }
      else if (e.key === 'Enter' && focus >= 0 && tag !== 'BUTTON' && tag !== 'A') { pick(focus); e.preventDefault(); }
    } else if (e.key === 'Enter' && tag !== 'BUTTON' && tag !== 'A') { next(); e.preventDefault(); }
  });

  document.querySelectorAll('.product').forEach(function (c, i) {
    c.addEventListener('click', function (e) {
      if (e.target.closest('a')) return;
      pick(i);
    });
  });
  $('#next').addEventListener('click', next);
  $('#again').addEventListener('click', function () {
    var s = String(Math.floor(Math.random() * 1e6));
    try { history.replaceState(null, '', location.pathname + '?seed=' + s); } catch (err) { /* file:// may refuse */ }
    start(s);
    $('#play').scrollIntoView({ block: 'start' });
  });
  $('#replay').addEventListener('click', function () { start(seed); $('#play').scrollIntoView({ block: 'start' }); });

  start(seed);
})();
