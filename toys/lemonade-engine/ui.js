/* The Lemonade lessons: the page. Reads window.LEMONADE (set by each lesson's
   index.html), builds the controls, the chart and the folds into #lemonade,
   and plays rounds with engine.js. */
(function () {
  'use strict';
  const E = window.LemonadeEngine;
  const C = E.config(window.LEMONADE || {});
  const D = C.days;
  const R = C.rivals.length;
  const {
    BASE, COST, HOT, DECOY, DEFAULTS, ALL_OFF, RIVALS, RIVAL_KEYS, SUBJECTS, OPS, SUBJ_OPS, ACTS, STEPS, MAX_LINES,
    normSettings, isCharm, createRound, withRivals, playDay, ruleDay, hindsight, replay, expectedProfit, settle,
    normRule, nearest, newSeed, streetNote, streetNotes, clone, fmt
  } = E;

  const $ = (s) => document.querySelector(s);
  const money = (v) => (v < 0 ? '-' : '') + '$' + Math.round(Math.abs(v)).toLocaleString('en-US');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sum = (a) => a.reduce((x, y) => x + y, 0);

  // Words that change with the number of stands across the street.
  const NAMES = C.names || (R === 1 ? ['The other stand'] : ['Stand A', 'Stand B']);
  // In the middle of a sentence (the street notes).
  const MID = R === 1 ? NAMES.map((n) => n.replace(/^The /, 'the ')) : NAMES;
  const SHORT = C.short || (R === 1 ? ['Other stand'] : NAMES);
  const ruleName = (key) => (R > 1 ? RIVALS[key].many : RIVALS[key].you);
  const subjects = Object.assign({}, SUBJECTS, { comp: R > 1 ? 'cheapest competitor’s price yesterday' : 'competitor’s price yesterday' });
  const acts = Object.assign({}, ACTS, R > 1 ? { match: 'match the cheapest competitor', under: 'go under the cheapest competitor' } : {});
  if (!R) { delete subjects.comp; delete acts.match; delete acts.under; }
  const PRESETS = R ? E.STREET_PRESETS : E.PRESETS;
  const bigLabel = C.bigStep === 7 ? 'a week' : C.bigStep + ' days';
  const SPLIT = C.split || (R === 1
    ? 'Each visitor picks a stand, then buys or walks on. One in five always come to you and one in five always go to them. The rest lean toward the cheaper stand: a 50-cent gap sends 3 in 4 of them there.'
    : 'Each visitor picks one of the three stands, then buys or walks on. About one in seven are regulars at each stand. The rest lean toward the cheapest: a 50-cent gap sends 3 in 4 of them there.');

  /* ---------- Markup ---------- */

  const swatchClass = (j) => 'swatch swatch--' + (j ? 'b' : 'a');
  const rivalOptions = (sel) => RIVAL_KEYS.map((k) =>
    '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + esc(ruleName(k)) + '</option>').join('');

  const setupHTML = (C.rules || R) ? '<div class="setup">' +
    (C.rules ? '<div class="modes" role="group" aria-label="How to play">' +
      '<button class="chip" id="mode-pick" type="button" aria-pressed="true">Pick each day</button>' +
      '<button class="chip" id="mode-rule" type="button" aria-pressed="false">Write a rule</button></div>' : '') +
    (R ? '<div class="rivals">' + C.rivals.map((k, j) =>
      '<p class="rival"><span class="' + swatchClass(j) + '" aria-hidden="true"></span><label for="rival-' + j + '">' +
      (R === 1 ? 'Across the street' : esc(NAMES[j])) + '</label><select id="rival-' + j + '" data-j="' + j + '">' + rivalOptions(k) + '</select></p>').join('') +
      '</div><p class="split">' + esc(SPLIT) + '</p>' : '') +
    '</div>' : '';

  const endHTML =
    '<section class="panel end" id="end" hidden aria-labelledby="end-title">' +
      '<span class="tag">Day ' + D + '</span>' +
      '<h2 id="end-title" tabindex="-1">How it went</h2>' +
      '<div class="summary" id="summary" aria-live="polite"></div>' +
      '<div class="row"><button class="btn btn--primary" id="next" type="button">Next round</button>' +
      '<button class="btn" id="again" type="button">Play this round again</button></div>' +
      '<p class="small muted" id="end-hint" style="margin:0"></p>' +
    '</section>';

  const afterHTML =
    '<details class="panel fold" id="more-fold" hidden open><summary><h2>The numbers</h2><span class="fold__hint">Totals and the best fixed price</span></summary><div class="fold__body">' +
      '<div class="summary" id="more"></div>' +
      '<div class="results-wrap"><table class="results"><thead><tr><th scope="col">&nbsp;</th><th scope="col">Profit</th><th scope="col">Left on the table</th></tr></thead><tbody id="results"></tbody></table></div>' +
    '</div></details>' +
    '<details class="panel fold" id="curve-fold" hidden open><summary><h2 id="curve-name">The hidden curve</h2></summary><div class="fold__body">' +
      '<p class="small muted" id="curve-blurb" style="margin:0"></p>' +
      '<canvas class="curve" id="curve" role="img" aria-label=""></canvas>' +
      '<p class="curve-legend" id="curve-legend"></p>' +
    '</div></details>';

  const playHTML =
    '<section class="panel" id="play" aria-labelledby="play-title">' +
      '<div class="row play-top"><span class="tag" id="day-label" aria-live="polite"></span><a class="seed" id="seed" href="?seed=" title="Link to replay this round">Seed</a></div>' +
      '<h2 id="play-title" class="sr-only">Today’s price</h2>' +
      '<div class="ladder' + (C.menu === 'quarter' ? ' ladder--quarter' : '') + '" id="ladder" role="radiogroup" aria-labelledby="play-title"></div>' +
      '<p class="board" id="board" hidden></p>' +
      '<div class="row actions">' +
        '<button class="btn btn--primary" id="sell" type="button">Pick a price first</button>' +
        '<button class="btn" id="five" type="button">Same price, ' + bigLabel + '</button>' +
        '<button class="btn" id="rest" type="button">Same price to day ' + D + '</button>' +
      '</div>' +
      '<p class="keys small muted" id="keys"></p>' +
    '</section>';

  const presetChips = Object.keys(PRESETS).map((k) => '<button class="chip" type="button" data-preset="' + k + '">' + esc(PRESETS[k].name) + '</button>').join('');
  const ruleHTML = C.rules ?
    '<section class="panel rule" id="rule" hidden aria-labelledby="rule-title">' +
      '<div class="row play-top"><span class="tag" id="rule-day" aria-live="polite"></span><a class="seed" id="rule-seed" href="?seed=" title="Link to replay this round">Seed</a></div>' +
      '<details class="fold fold--inner fold--edit" id="rule-edit" open>' +
        '<summary><h2 id="rule-title">Your pricing rule</h2><span class="fold__hint" id="rule-sum"></span></summary>' +
        '<div class="fold__body">' +
          '<p class="small muted" style="margin:0">Each morning the rule looks at yesterday and picks a price. Lines are checked in order, and the first one that matches wins. Prices snap to the menu, $2.00 to $6.00. You can change the rule between days.</p>' +
          '<div><p class="small muted presets-label" style="margin:0 0 var(--space-1)">Start from an example, then change it:</p><div class="presets" id="presets">' + presetChips + '</div></div>' +
          '<p class="field"><label for="rule-start"><strong>Start at</strong></label> <select id="rule-start"></select></p>' +
          '<ol class="rlines" id="rule-lines" aria-label="If … then … lines"></ol>' +
          '<div><button class="btn btn--small" id="add-line" type="button" style="margin-left:0">Add an “If … then …” line</button></div>' +
          '<p class="otherwise">Otherwise, keep the price.</p>' +
          '<label class="check"><input type="checkbox" id="rule-explore"> <span>Try every price once first. The rule charges each menu price once, lowest first, then goes to the best one so far and takes over from there.</span></label>' +
        '</div>' +
      '</details>' +
      '<div class="row run-row">' +
        '<button class="btn btn--primary" id="run-1" type="button">Run one day</button>' +
        '<button class="btn" id="run-week" type="button">Run ' + bigLabel + '</button>' +
        '<button class="btn" id="run-all" type="button">Run to day ' + D + '</button>' +
        '<button class="btn btn--small" id="run-reset" type="button">Start over</button>' +
      '</div>' +
      '<p class="last" id="rule-last" aria-live="polite" hidden></p>' +
    '</section>' : '';

  const chartHTML =
    '<section class="panel chart-panel" id="chart-panel" aria-labelledby="chart-title">' +
      '<h2 id="chart-title" class="sr-only">Prices and profit by day</h2>' +
      '<div class="chart-head"><ul class="legend" id="legend" aria-label="Totals so far"></ul>' +
      (R ? '<button class="chip street" id="street" type="button" aria-pressed="false">Show the bot’s street</button>' : '') + '</div>' +
      '<canvas class="chart" id="chart" role="img" aria-label="Price by day on top, profit by day underneath. The Day by day table has the same numbers."></canvas>' +
      (R ? '<p class="note" id="note" aria-live="polite"></p>' : '') +
      '<p class="lastday" id="lastday" aria-live="polite"></p>' +
    '</section>';

  const rivalCols = C.rivals.map((_, j) => '<th scope="col">' + esc(SHORT[j]) + '</th>').join('');
  const foldsHTML =
    (C.rules ? '<details class="panel fold" id="why" hidden open><summary><h2>What the rule did</h2><span class="fold__hint">One line per day</span></summary>' +
      '<div class="fold__body"><ol class="why-list" id="why-list" tabindex="0" aria-label="One line per day"></ol></div></details>' : '') +
    '<details class="panel fold" id="hist" open><summary><h2>Day by day</h2><span class="fold__hint">Every price and sale</span></summary>' +
      '<div class="fold__body"><div class="history" tabindex="0" aria-label="Daily results"><table>' +
        '<thead><tr><th scope="col">Day</th><th scope="col">Visitors</th><th scope="col" id="you-col">You</th><th scope="col">Sold</th><th scope="col">Profit</th>' + rivalCols +
        '<th scope="col">Bot</th><th scope="col">Sold</th><th scope="col">Profit</th></tr></thead><tbody id="rows"></tbody></table></div>' +
      (R ? '<p class="small muted" style="margin:0">The stand columns are the stands across your street. The bot’s street has its own copies, which react to the bot.</p>' : '') +
      '</div></details>';

  const mount = document.getElementById('lemonade');
  mount.outerHTML = setupHTML + endHTML + playHTML + ruleHTML + chartHTML + afterHTML + foldsHTML;

  const el = {
    modePick: $('#mode-pick'), modeRule: $('#mode-rule'),
    play: $('#play'), rulePanel: $('#rule'), end: $('#end'), day: $('#day-label'), seed: $('#seed'),
    ruleDay: $('#rule-day'), ruleSeed: $('#rule-seed'), ruleEdit: $('#rule-edit'), ruleSum: $('#rule-sum'),
    ladder: $('#ladder'), sellBtn: $('#sell'), five: $('#five'), rest: $('#rest'), board: $('#board'),
    rows: $('#rows'), youCol: $('#you-col'), legend: $('#legend'), street: $('#street'),
    chart: $('#chart'), note: $('#note'), lastday: $('#lastday'),
    summary: $('#summary'), more: $('#more'), moreFold: $('#more-fold'), curveFold: $('#curve-fold'), results: $('#results'), curve: $('#curve'), curveName: $('#curve-name'),
    curveBlurb: $('#curve-blurb'), curveLegend: $('#curve-legend'), again: $('#again'), next: $('#next'),
    endTitle: $('#end-title'), endHint: $('#end-hint'),
    presets: $('#presets'), start: $('#rule-start'), lines: $('#rule-lines'), addLine: $('#add-line'),
    explore: $('#rule-explore'), run1: $('#run-1'), runWeek: $('#run-week'), runAll: $('#run-all'), runReset: $('#run-reset'),
    last: $('#rule-last'), why: $('#why'), whyList: $('#why-list'),
    psy: $('#psy'), psyHint: $('#psy-hint'), keys: $('#keys')
  };

  // Set by the inline script in the page head: inside a frame, or ?embed=1.
  const embedded = document.documentElement.classList.contains('is-embedded');
  const keepEmbed = /[?&]embed=1(&|$)/.test(location.search);
  const folds = [...document.querySelectorAll('details.fold')];

  let settings = C.psych ? normSettings() : Object.assign({}, ALL_OFF);
  let rivals = C.rivals.slice();
  let mode = 'pick';
  let rule = clone(PRESETS[R ? 'match' : 'crowd'].rule);
  let lastRun = null; // { key, total } from the previous finished rule run on this seed and setup
  let state;
  let roundNo = 1;
  let busy = false;
  let timer = null;
  let botStreet = false;

  const fmtI = (i) => fmt(state.round.prices[i]);
  const setupKey = () => state.round.seed + ':' + Object.keys(DEFAULTS).map((k) => (settings[k] ? 1 : 0)).join('') + ':' + rivals.join(',');
  const roundOpts = () => ({ days: D, menu: C.menu, psych: C.psych, settings, rivals, loyal: C.loyal });

  // embed: keep ?embed=1 (for the frame's own address, not for the share link).
  function query(seed, embed) {
    const q = new URLSearchParams();
    if (embed && keepEmbed) q.set('embed', '1');
    q.set('seed', seed);
    if (mode === 'rule') q.set('mode', 'rule');
    if (C.psych) {
      const off = Object.keys(DEFAULTS).filter((k) => !settings[k]);
      if (off.length) q.set('off', off.join(','));
    }
    if (R && rivals.join(',') !== C.rivals.join(',')) q.set('vs', rivals.join(','));
    return '?' + q.toString();
  }

  function start(seed) {
    clearTimeout(timer);
    busy = false;
    state = { round: createRound(seed, roundOpts()), days: [], sel: null, result: null, prev: null };
    try { history.replaceState(null, '', query(seed, true)); } catch (e) { /* file:// may refuse */ }
    el.end.hidden = true;
    el.moreFold.hidden = true;
    el.curveFold.hidden = true;
    buildLadder();
    if (C.rules) fillStart();
    render();
  }

  /* ---------- Mode ---------- */

  function renderMode() {
    const rm = mode === 'rule', done = !!state.result;
    if (el.modePick) {
      el.modePick.setAttribute('aria-pressed', rm ? 'false' : 'true');
      el.modeRule.setAttribute('aria-pressed', rm ? 'true' : 'false');
    }
    el.play.hidden = rm || done;
    if (el.rulePanel) el.rulePanel.hidden = !rm || (done && !state.editing);
    if (el.why) el.why.hidden = !rm || !state.days.length;
    el.youCol.textContent = rm ? 'Rule' : 'You';
    el.again.textContent = rm ? 'Edit the rule' : 'Play this round again';
    el.endHint.textContent = rm
      ? 'Change a line and run it again on the same days, or press N for the next round.'
      : 'Each round uses a different hidden curve. N starts the next one.';
    if (el.psyHint) {
      const on = ['charm', 'ref', 'anchor'].filter((k) => settings[k]).length;
      el.psyHint.textContent = on === 3 ? 'Three effects, all on' : on ? on + ' of 3 effects on' : 'All three effects off';
    }
    const board = C.psych && settings.anchor ? 'On the menu board: Grand cup ' + fmt(DECOY) + ', and a regular cup at your price.' : '';
    el.board.textContent = board; el.board.hidden = !board;
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
    const tail = '<kbd>Enter</kbd> sells one day, <kbd>R</kbd> ' + bigLabel + ', <kbd>F</kbd> to day ' + D + '.';
    el.keys.innerHTML = state.round.prices.length > BASE.length
      ? (C.menu === 'quarter'
        ? 'Keys: <kbd>1</kbd>–<kbd>9</kbd> whole and half dollars, <kbd>←</kbd><kbd>→</kbd> every price, <kbd>Enter</kbd> one day, <kbd>R</kbd> ' + bigLabel + ', <kbd>F</kbd> to day ' + D + '.'
        : 'Keys: <kbd>1</kbd>–<kbd>9</kbd> pick a round price, <kbd>←</kbd><kbd>→</kbd> step through every price, ' + tail)
      : 'Keys: <kbd>1</kbd>–<kbd>9</kbd> or <kbd>←</kbd><kbd>→</kbd> pick a price, ' + tail;
  }

  function choose(i, focus) {
    if (busy || state.result || mode !== 'pick') return;
    state.sel = Math.max(0, Math.min(state.round.prices.length - 1, i));
    renderControls();
    if (focus) el.ladder.children[state.sel].focus();
  }

  /* ---------- Playing days ---------- */

  function stepOne() {
    if (state.days.length >= D) return false;
    if (mode === 'rule') {
      rule = normRule(rule);
      const day = ruleDay(state.round, state.days, rule);
      day.ruleKey = JSON.stringify(rule);
      state.days.push(day);
    } else {
      if (state.sel === null) return false;
      state.days.push(playDay(state.round, state.days, state.sel));
    }
    return true;
  }

  function advance(n) {
    if (busy) return;
    if (mode === 'pick' && (state.sel === null || state.result)) return;
    if (mode === 'rule') {
      if (state.result) {
        // Running again starts from day 1 on the same days.
        const seed = state.round.seed;
        start(seed);
      }
      if (!state.days.length && lastRun && lastRun.key === setupKey()) state.prev = lastRun;
      if (embedded && el.ruleEdit.open && !state.days.length) el.ruleEdit.open = false;
    }
    const target = Math.min(D, state.days.length + n);
    if (n === 1 || reduce.matches) {
      while (state.days.length < target) stepOne();
      return after();
    }
    busy = true;
    if (mode === 'rule') setEditorDisabled(true);
    const speed = D > 40 ? 30 : 70;
    const tick = () => {
      stepOne();
      render();
      if (state.days.length < target) timer = setTimeout(tick, speed);
      else { busy = false; if (mode === 'rule') setEditorDisabled(false); after(); }
    };
    tick();
  }

  function after() {
    if (state.days.length >= D) finish();
    render();
  }

  /* ---------- Rule editor ---------- */

  const options = (map, keys, sel) => keys.map((k) =>
    '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + esc(map[k]) + '</option>').join('');

  function fillStart() {
    const ps = state.round.prices;
    const si = nearest(ps, rule.start);
    rule.start = ps[si];
    el.start.innerHTML = ps.map((p, i) => '<option value="' + p + '"' + (i === si ? ' selected' : '') + '>' + fmt(p) + '</option>').join('');
    el.explore.checked = !!rule.explore;
    renderLines();
  }

  function ruleSummary() {
    const n = rule.lines.length;
    return 'Starts at ' + fmt(state.round.prices[nearest(state.round.prices, rule.start)]) + ' · ' +
      (n === 1 ? 'one line' : n ? n + ' lines' : 'no lines') + (rule.explore ? ' · tries every price first' : '');
  }

  function renderLines() {
    const subjKeys = Object.keys(subjects), actKeys = Object.keys(acts);
    rule.lines.forEach((l) => {
      if (!(l.subj in subjects)) l.subj = 'cups';
      if (SUBJ_OPS[l.subj].indexOf(l.op) < 0) l.op = SUBJ_OPS[l.subj][0];
      if (!(l.act in acts)) l.act = 'keep';
    });
    el.lines.innerHTML = rule.lines.map((l, k) => {
      const n = k + 1;
      const needsValue = l.op === 'gt' || l.op === 'lt';
      const needsStep = l.act === 'raise' || l.act === 'lower' || l.act === 'under';
      const isMoney = l.subj === 'profit';
      return '<li class="rline" data-k="' + k + '">' +
        '<span class="rline__word">If</span>' +
        '<select data-f="subj" aria-label="Line ' + n + ': what to look at">' + options(subjects, subjKeys, l.subj) + '</select>' +
        '<select data-f="op" aria-label="Line ' + n + ': how to compare">' + options(OPS, SUBJ_OPS[l.subj], l.op) + '</select>' +
        '<span class="rline__num"' + (needsValue ? '' : ' hidden') + '>' + (isMoney ? '<span aria-hidden="true">$</span>' : '') +
          '<input type="number" data-f="value" inputmode="numeric" step="1" value="' + l.value + '" aria-label="Line ' + n + ': number' + (isMoney ? ' in dollars' : '') + '"></span>' +
        '<span class="rline__word">then</span>' +
        '<select data-f="act" aria-label="Line ' + n + ': what to do">' + options(acts, actKeys, l.act) + '</select>' +
        '<select data-f="step" aria-label="Line ' + n + ': by how much"' + (needsStep ? '' : ' hidden') + '>' +
          STEPS.map((s) => '<option value="' + s + '"' + (s === l.step ? ' selected' : '') + '>by ' + fmt(s) + '</option>').join('') + '</select>' +
        '<button class="btn btn--small" type="button" data-remove aria-label="Remove line ' + n + '">Remove</button>' +
        '</li>';
    }).join('');
    el.addLine.disabled = busy || rule.lines.length >= MAX_LINES;
    el.addLine.textContent = rule.lines.length >= MAX_LINES ? 'Three lines is the limit' : 'Add an “If … then …” line';
    el.ruleSum.textContent = ruleSummary();
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
  }

  function renderLast() {
    if (!el.last) return;
    el.last.textContent = lastRun && lastRun.key === setupKey() ? 'Last finished run on these days: ' + money(lastRun.total) + '.' : '';
    el.last.hidden = !el.last.textContent;
  }

  /* ---------- Render ---------- */

  function totals(days, who) {
    const t = { you: 0, bot: 0, rivals: C.rivals.map(() => 0), botRivals: C.rivals.map(() => 0) };
    days.forEach((x) => {
      t.you += x.you.profit; t.bot += x.bot.profit;
      x.rivals.forEach((r, j) => { t.rivals[j] += r.profit; });
      x.botRivals.forEach((r, j) => { t.botRivals[j] += r.profit; });
    });
    return who ? t[who] : t;
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
    if (el.run1) {
      const fresh = !state.days.length || done;
      el.run1.textContent = done ? 'Run again, one day' : 'Run one day';
      el.runReset.hidden = fresh;
      [el.run1, el.runWeek, el.runAll].forEach((b) => { b.disabled = busy; });
      el.runReset.disabled = busy;
    }
  }

  function youName(cap) { return mode === 'rule' ? (cap ? 'Your rule' : 'your rule') : (cap ? 'You' : 'you'); }

  function renderLegend(t) {
    const items = [['you', youName(true), t.you], ['bot', 'Bot', t.bot]];
    const rt = botStreet ? t.botRivals : t.rivals;
    C.rivals.forEach((_, j) => items.push([j ? 'b' : 'a', SHORT[j] + (botStreet ? ' (bot’s street)' : ''), rt[j]]));
    el.legend.innerHTML = items.map((it) =>
      '<li><span class="swatch swatch--' + it[0] + '" aria-hidden="true"></span>' + esc(it[1]) + ' <b>' + money(it[2]) + '</b></li>').join('');
  }

  function soldLine(name, x, verbYou) {
    return name + ' sold ' + x.cups + (verbYou ? ' of ' + x.visitors : '') + ' at ' + fmt(x.price) + ' for ' + money(x.profit);
  }

  function renderLastDay() {
    const n = state.days.length;
    if (!n) {
      // Embedded, the note line carries the sentence on how visitors pick a stand.
      el.lastday.textContent = R && embedded ? ''
        : R ? 'Nothing sold yet. Each day adds a point for ' + youName() + ', the bot and the stands across the street.'
          : 'Nothing sold yet. Each day adds a point for ' + youName() + ' and the bot, so you can see who is still trying new prices.';
      el.lastday.hidden = !el.lastday.textContent;
      if (el.note) el.note.textContent = R && embedded ? SPLIT : R ? 'Across the street: ' + rivals.map((k, j) => (R > 1 ? NAMES[j] + ', ' : '') + '“' + ruleName(k) + '”').join('. ') + '.' : '';
      return;
    }
    const x = state.days[n - 1];
    let s = 'Day ' + x.d + ': ' + soldLine(youName(true), x.you, true) + '.';
    if (R) {
      s += ' ' + x.rivals.map((r, j) => NAMES[j] + ' sold ' + r.cups + ' at ' + fmt(r.price)).join(', ') + '.';
    }
    s += ' The bot sold ' + x.bot.cups + ' at ' + fmt(x.bot.price) + ' for ' + money(x.bot.profit) + '.';
    el.lastday.textContent = s;
    el.lastday.hidden = false;
    if (el.note) {
      const note = streetNote(state.round, state.days, n, botStreet ? 'bot' : 'you', MID);
      el.note.innerHTML = (botStreet ? '<span class="note__street">Bot’s street.</span> ' : '') + esc(note ? note.text : '');
    }
  }

  function render() {
    const n = state.days.length, rm = mode === 'rule';
    const label = 'Round ' + roundNo + ' · Day ' + Math.min(n + 1, D) + ' of ' + D;
    const seedText = 'Seed ' + state.round.seed, href = query(state.round.seed);
    el.day.textContent = label;
    if (el.ruleDay) el.ruleDay.textContent = state.result ? 'Round ' + roundNo + ' · ' + D + ' days run' : n ? 'Round ' + roundNo + ' · Day ' + n + ' of ' + D + ' run' : 'Round ' + roundNo + ' · Not run yet';
    [el.seed, el.ruleSeed].forEach((a) => {
      if (!a) return;
      a.textContent = seedText; a.href = href;
      if (embedded) { a.target = '_blank'; a.rel = 'noopener'; }
    });
    renderControls();
    renderMode();
    renderLegend(totals(state.days));
    renderLastDay();

    el.rows.innerHTML = '';
    if (!n) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="' + (8 + R) + '" class="empty">' + (rm ? 'Nothing sold yet. Each day the rule plays shows up here, newest first.' : 'Nothing sold yet. Each day you play shows up here, newest first.') + '</td>';
      el.rows.appendChild(tr);
    }
    const frag = document.createDocumentFragment();
    for (let k = n - 1; k >= 0; k--) {
      const x = state.days[k];
      const tr = document.createElement('tr');
      if (k === n - 1 && !state.result) tr.className = 'fresh';
      if (state.round.curve.hot && x.d >= HOT[0] && x.d <= HOT[1] && state.result) tr.className = 'hot';
      tr.innerHTML = '<td>' + x.d + '</td><td>' + x.visitors + '</td>' +
        '<td>' + fmt(x.you.price) + '</td><td>' + x.you.cups + '</td><td>' + money(x.you.profit) + '</td>' +
        x.rivals.map((r) => '<td>' + fmt(r.price) + '</td>').join('') +
        '<td>' + fmt(x.bot.price) + '</td><td>' + x.bot.cups + '</td><td>' + money(x.bot.profit) + '</td>';
      frag.appendChild(tr);
    }
    el.rows.appendChild(frag);

    if (rm && el.whyList) {
      el.whyList.innerHTML = state.days.map((x) =>
        '<li><span class="why__day">Day ' + x.d + ':</span> ' + esc(x.why) + '. <span class="muted">Sold ' + x.you.cups + ', ' + money(x.you.profit) + '.</span></li>').join('');
    }
    drawChart();
    if (state.result) drawCurve();
  }

  /* ---------- End of round ---------- */

  function describe(picks, who) {
    const st = settle(picks, state.round.prices.length), p = fmtI(st.price), mostly = st.exact ? '' : 'mostly ';
    const name = { you: 'You', bot: 'The bot', rule: 'Your rule' }[who];
    if (st.distinct === 1) return name + ' charged ' + p + ' every day.';
    if (st.day <= 3) return name + ' landed on ' + p + ' by day ' + st.day + ' and ' + mostly + 'stayed.';
    if (st.day <= D - 4) {
      if (who === 'bot') return 'The bot kept testing until day ' + st.day + ', then ' + mostly + 'stayed on ' + p + '.';
      return name + ' settled on ' + p + ' by day ' + st.day + ' and ' + mostly + 'stayed.';
    }
    const pair = st.ranked.slice(0, 2).sort((a, b) => a - b).map(fmtI).join(' and ');
    return name + (who === 'you' ? ' were' : ' was') + ' still ' + (who === 'rule' ? 'moving' : 'trying prices') + ' near the end, mostly ' + pair + '.';
  }

  const prices = (n) => (n === 1 ? 'one price' : n + ' prices');

  // Lesson 1: exploring costs money now and pays later.
  function lessonExplore(t, h, youPicks, botPicks) {
    const ys = settle(youPicks, state.round.prices.length), bs = settle(botPicks, state.round.prices.length);
    const E10 = Math.min(10, Math.floor(D / 3));
    const part = (who, a, b) => sum(state.days.slice(a, b).map((x) => x[who].profit));
    const yE = part('you', 0, E10), bE = part('bot', 0, E10), yL = part('you', E10, D), bL = part('bot', E10, D);
    const gap = t.bot - t.you;
    const best = fmt(h.bestPrice);
    if (gap > 1 && bE < yE - 1 && bL > yL + 1) {
      return 'In the first ' + E10 + ' days the bot made ' + money(yE - bE) + ' less than you while it tried prices. Over the last ' + (D - E10) +
        ' it made ' + money(bL - yL) + ' more. Exploring cost it money early and paid later.';
    }
    if (gap > 1 && ys.distinct <= 3) {
      return 'You tried ' + prices(ys.distinct) + ' and settled by day ' + ys.day + '. The bot tried ' + bs.distinct + ' and finished ' + money(gap) +
        ' ahead. Settling early felt safe, and here it cost you.';
    }
    if (gap > 1) {
      return 'The bot finished ' + money(gap) + ' ahead. It tried ' + prices(bs.distinct) + ' early, then stayed with what sold' +
        (ys.day > D - 4 && ys.distinct > 3 ? ', while you were still moving near the end.' : '.');
    }
    if (gap < -1 && ys.distinct <= 3) {
      const near = h.bestTotal - t.you < h.bestTotal * 0.05;
      return (ys.distinct === 1 ? 'You charged ' + fmtI(ys.price) + ' every day' : ys.day <= 2 ? 'You settled on ' + fmtI(ys.price) + ' from day ' + ys.day : 'You settled on ' + fmtI(ys.price) + ' by day ' + ys.day) + ' and finished ' + money(-gap) + ' ahead of the bot. ' +
        (fmtI(ys.price) === best ? 'Your early guess was the best price to hold, so the bot’s testing days were pure cost.'
          : near ? 'Your early guess was close to the best price, ' + best + ', so the bot’s testing days cost more than they found.'
            : 'The bot spent its testing days and still didn’t catch up in ' + D + ' days.');
    }
    if (gap < -1) {
      const yRate = yE / E10, lRate = yL / (D - E10);
      return 'You tried ' + prices(ys.distinct) + ' and finished ' + money(-gap) + ' ahead of the bot.' +
        (lRate > yRate * 1.1 ? ' You made ' + money(yE / E10) + ' a day while testing and ' + money(lRate) + ' a day after. The testing paid for itself.' : '');
    }
    return 'You and the bot finished level, after you tried ' + prices(ys.distinct) + ' and the bot ' + prices(bs.distinct) + '.';
  }

  // Lesson 2: the same price lands differently depending on how it is shown and what came before.
  function lessonHuman(t) {
    const on = ['charm', 'ref', 'anchor'].filter((k) => settings[k]);
    if (!on.length) return { lesson: 'With all three effects off, these customers only saw the number. Turn one on and play the same days again to see what changes.', extra: [] };
    const seq = state.days.map((x) => x.you.price);
    const plain = replay(state.round, seq, ALL_OFF);
    const diff = t.you - plain;
    const each = on.map((k) => {
      const s = Object.assign({}, settings); s[k] = false;
      return { k, d: t.you - replay(state.round, seq, s) };
    }).sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
    const lead = 'The same prices on the same days, to customers who only see the number, would have made ' + money(plain) + '. ' +
      (Math.abs(diff) < 1 ? 'How they were shown made almost no difference this time.'
        : 'How they were shown, and what came before, ' + (diff > 0 ? 'was worth ' + money(diff) + ' to you.' : 'cost you ' + money(-diff) + '.'));
    const top = each[0], extra = [];
    if (Math.abs(top.d) >= 1) {
      const raises = seq.filter((p, k) => k && p > seq[k - 1] + 1e-9).length, cuts = seq.filter((p, k) => k && p < seq[k - 1] - 1e-9).length;
      const nines = seq.filter(isCharm).length;
      if (top.k === 'ref') {
        extra.push(top.d < 0
          ? 'Most of that came from reference prices. You raised the price ' + (raises === 1 ? 'once' : raises + ' times') + ', and each raise lost more buyers than an equal cut won back.'
          : 'Most of that came from reference prices. You cut more than you raised, so many days felt cheap next to the last three.');
      } else if (top.k === 'charm') {
        extra.push('Most of that came from charm prices. On the ' + (nines === 1 ? 'one day' : nines + ' days') + ' you charged a .99 price, it sold like a price 8 cents lower.');
      } else {
        extra.push('Most of that came from the Grand cup on the menu board. Next to ' + fmt(DECOY) + ', every price felt 5 cents lower.');
      }
    }
    return { lesson: lead, extra };
  }

  function bestAgainst(keys) { return hindsight(withRivals(state.round, keys)); }

  // Lesson 3: the best price depends on their rule.
  function lessonStreet(t, h) {
    const key = rivals[0], name = ruleName(key);
    const others = RIVAL_KEYS.filter((k) => k !== key).map((k) => ({ k, h: bestAgainst([k]) }));
    others.sort((a, b) => Math.abs(b.h.bestPrice - h.bestPrice) - Math.abs(a.h.bestPrice - h.bestPrice));
    const o = others[0];
    let lesson;
    if (Math.abs(o.h.bestPrice - h.bestPrice) > 1e-9) {
      lesson = 'Against “' + name + '”, the best price to hold all ' + D + ' days was ' + fmt(h.bestPrice) + '. Against “' + ruleName(o.k) +
        '” it would have been ' + fmt(o.h.bestPrice) + '. The customers were the same. Only the other stand’s rule changed.';
    } else {
      lesson = 'Against “' + name + '”, the best price to hold all ' + D + ' days was ' + fmt(h.bestPrice) + ', and this round it was the same against every rule on the list. Try another round: the curve matters too.';
    }
    const seq = state.days.map((x) => x.you.price);
    const extra = [];
    extra.push(youName(true) + ' made ' + money(t.you) + '. ' + NAMES[0] + ' made ' + money(t.rivals[0]) + '. Holding ' + fmt(h.bestPrice) + ' every day would have made ' + money(h.bestTotal) + '.');
    if ((key === 'under' || key === 'undercut' || key === 'match') && seq[0] - seq[seq.length - 1] >= 0.75) {
      extra.push(youName(true) + ' started at ' + fmt(seq[0]) + ' and ended at ' + fmt(seq[seq.length - 1]) + '. The other stand followed every cut.');
    }
    return { lesson, extra };
  }

  // Lesson 4: two stands react to you and to each other.
  function lessonSpiral(t, h) {
    const notes = streetNotes(state.round, state.days, 'you', NAMES).filter(Boolean);
    const floor = notes.find((x) => x.kind === 'floor');
    const spiral = notes.find((x) => x.kind === 'spiral-down' || x.kind === 'spiral-up');
    const follow = notes.find((x) => x.kind === 'follow-down' || x.kind === 'follow-up');
    const lastN = notes[notes.length - 1];
    let lesson;
    if (floor && spiral && spiral.kind === 'spiral-down') {
      lesson = 'The two stands were undercutting each other from day ' + (spiral.start + 1) + ' and both sat at their floors from day ' + floor.first +
        '. Neither rule looks at customers. Each one reacts to the other stand as well as to ' + youName() + ', so one cut led to the next.';
    } else if (floor) {
      lesson = 'Both stands followed ' + (mode === 'rule' ? 'your rule' : 'you') + ' down and sat at their floors from day ' + floor.first + '. Each cut ' + youName() + ' made was answered the next day.';
    } else if (spiral && spiral.kind === 'spiral-up') {
      lesson = 'The two stands pushed each other up from day ' + (spiral.start + 1) + '. A rule that stays above the cheapest only climbs when the others climb too, and here they did.';
    } else if (spiral) {
      lesson = 'The two stands undercut each other from day ' + (spiral.start + 1) + ', but never both reached their floors. ' + (lastN ? lastN.text.replace(/^Day \d+: /, 'By the end, ') : '');
    } else if (follow) {
      lesson = 'The two stands followed ' + youName() + ' rather than each other this time. Their prices moved when ' + youName() + ' moved.';
    } else {
      const holds = rivals.filter((k) => k === 'hold').length;
      lesson = 'These two rules didn’t spiral this time.' + (holds ? ' “Hold $3.50” doesn’t react, so it kept the street steady.' : ' Try two stands that both undercut.');
    }
    const lowEnd = Math.min.apply(null, state.days[D - 1].rivals.map((r) => r.price));
    const extra = [
      youName(true) + ' made ' + money(t.you) + '. ' + NAMES[0] + ' made ' + money(t.rivals[0]) + ' and ' + NAMES[1] + ' ' + money(t.rivals[1]) +
        '. On day ' + D + ' the cheapest stand across the street charged ' + fmt(lowEnd) + '.',
      'Against these two rules, the best price to hold all ' + D + ' days was ' + fmt(h.bestPrice) + ', for ' + money(h.bestTotal) + '.'
    ];
    return { lesson, extra };
  }

  function finish() {
    const r = state.round, t = totals(state.days), rm = mode === 'rule';
    const h = hindsight(r);
    const youPicks = state.days.map((x) => x.you.i), botPicks = state.days.map((x) => x.bot.i);
    const sameRule = rm && state.days.every((x) => x.ruleKey === state.days[0].ruleKey);
    state.result = { h, t, youPicks, botPicks, alone: R ? bestAgainst([]) : h };
    state.editing = false;

    const gap = t.you - t.bot, them = rm ? 'your rule' : 'you';
    const cmp = Math.abs(gap) < 1 ? (rm ? 'Your rule' : 'You') + ' and the bot finished level.'
      : gap > 0 ? 'It finished ' + money(gap) + ' behind ' + them + '.' : 'It finished ' + money(-gap) + ' ahead of ' + them + '.';

    let lesson, extra = [];
    if (C.lesson === 1) lesson = lessonExplore(t, h, youPicks, botPicks);
    else if (C.lesson === 2) { const o = lessonHuman(t); lesson = o.lesson; extra = o.extra; }
    else if (R === 1) { const o = lessonStreet(t, h); lesson = o.lesson; extra = o.extra; }
    else { const o = lessonSpiral(t, h); lesson = o.lesson; extra = o.extra; }

    const lines = extra.slice();
    if (R) {
      lines.push('The bot made ' + money(t.bot) + ' against its own copy of the ' + (R > 1 ? 'stands' : 'stand') + '. ' + cmp + ' It learns from what sells and doesn’t know about their rules.');
      if (!lines.some((l) => /With nobody across the street/.test(l))) {
        lines.push('With nobody across the street, the best price on these days was ' + fmt(state.result.alone.bestPrice) + '.');
      }
    } else {
      // Lesson 2 leads with which effect mattered; lesson 1 with how each player settled.
      const told = [describe(youPicks, rm ? 'rule' : 'you'), describe(botPicks, 'bot') + ' ' + cmp];
      if (C.lesson === 2) lines.push(...told); else lines.unshift(...told);
      lines.push('Looking back, the best single price was ' + fmtI(h.best) + '. Charging it all month would have made ' + money(h.bestTotal) + '.');
      if (r.curve.hot) lines.push('A fixed price can’t follow a hot week, so a player who moved with it could beat that number.');
    }
    if (rm && sameRule && state.prev) {
      const dv = t.you - state.prev.total;
      lines.push(Math.abs(dv) < 1 ? 'That’s the same as your last finished run.' : 'That’s ' + money(Math.abs(dv)) + (dv > 0 ? ' more' : ' less') + ' than your last finished run.');
    }
    if (C.lesson === 4) lines.push('The Repricer Spiral picks up from here: the same thing with bots that react every minute.');

    // The lesson line and the first detail stay in view; the rest folds away when embedded.
    const keep = embedded ? 1 : lines.length;
    el.summary.innerHTML = '<p class="lesson">' + esc(lesson) + '</p>' + lines.slice(0, keep).map((l) => '<p>' + esc(l) + '</p>').join('');
    el.more.innerHTML = lines.slice(keep).map((l) => '<p>' + esc(l) + '</p>').join('');
    el.more.hidden = !el.more.innerHTML;

    const regret = (v) => {
      const left = h.bestTotal - v;
      return left >= 0.5 ? money(left) : left <= -0.5 ? money(-left) + ' ahead' : '$0';
    };
    el.results.innerHTML =
      '<tr><th scope="row"><span class="key key--you"></span>' + (rm ? 'Your rule' : 'You') + '</th><td>' + money(t.you) + '</td><td>' + regret(t.you) + '</td></tr>' +
      '<tr><th scope="row"><span class="key key--bot"></span>Bot</th><td>' + money(t.bot) + '</td><td>' + regret(t.bot) + '</td></tr>' +
      (rm && sameRule && state.prev ? '<tr><th scope="row">Last run</th><td>' + money(state.prev.total) + '</td><td>' + regret(state.prev.total) + '</td></tr>' : '') +
      C.rivals.map((_, j) => '<tr><th scope="row">' + esc(NAMES[j]) + '</th><td>' + money(t.rivals[j]) + '</td><td>—</td></tr>').join('') +
      '<tr><th scope="row">' + fmtI(h.best) + ' every day</th><td>' + money(h.bestTotal) + '</td><td>—</td></tr>';

    if (rm && sameRule) lastRun = { key: setupKey(), total: t.you };

    if (R) {
      el.curveName.textContent = 'Holding one price, against ' + (R > 1 ? 'these stands' : 'this stand');
      el.curveBlurb.textContent = 'What each price would have made if held all ' + D + ' days, with the stands reacting to it. The hidden curve this round: ' + r.def.name.toLowerCase() + '. ' + r.def.blurb;
      el.curveLegend.innerHTML = '<span>Solid line: against ' + (R > 1 ? 'these two rules' : '“' + esc(ruleName(rivals[0])) + '”') + '</span><span>Dashed line: nobody across the street</span><span>Dot: the price ' + esc(youName()) + ' used most</span>';
      el.curve.setAttribute('aria-label', 'Total profit for each price held all round, against these stands and with nobody across the street.');
    } else {
      el.curveName.textContent = 'The hidden curve: ' + r.def.name;
      el.curveBlurb.textContent = r.def.blurb;
      el.curveLegend.innerHTML = '<span>Line: expected profit per day at a price held steady</span><span><span class="key key--you"></span>' + esc(youName(true)) + '</span><span><span class="key key--bot"></span>Bot</span><span>Bigger circle, more days</span>' +
        (r.s.nines && r.s.charm ? '<span>Small dots: .99 prices</span>' : '');
      el.curve.setAttribute('aria-label', 'Expected profit per day at each price held steady, with the days each player spent at each price marked as circles.');
    }
    el.end.hidden = false;
    el.moreFold.hidden = false;
    el.curveFold.hidden = false;
    renderLast();
    requestAnimationFrame(() => {
      drawCurve();
      if (embedded) {
        // Scroll only this frame's page, never the article around it.
        el.next.focus({ preventScroll: true });
        reveal(el.end);
      } else el.next.focus();
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
    return {
      ink: tone('ink'), muted: tone('muted'), line: tone('line'), sunk: tone('sunk'), raised: tone('raised'),
      you: tone('ember'), bot: tone('note'), a: tone('olive'), b: tone('ink')
    };
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

  function niceMax(v, parts) {
    const raw = Math.max(v, 1) / parts, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const unit = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((m) => m >= raw);
    return { max: unit * parts, unit };
  }

  // The series on the chart, back to front.
  function series(col) {
    const out = [];
    const rk = botStreet ? 'botRivals' : 'rivals';
    C.rivals.forEach((_, j) => out.push({
      color: j ? col.b : col.a, dash: j ? [2, 3] : [7, 4], width: j ? 1.75 : 2.25,
      get: (x) => x[rk][j]
    }));
    out.push({ color: col.bot, dash: [], width: 2, ring: true, get: (x) => x.bot });
    out.push({ color: col.you, dash: [], width: 2.75, dot: true, get: (x) => x.you });
    return out;
  }

  function drawChart() {
    const c = setup(el.chart);
    if (!c) return;
    const { g, w, h } = c, col = palette(), days = state.days, n = days.length;
    const L = 46, Rr = 10, T = 16, B = 22, GAP = 24;
    const inner = h - T - B - GAP;
    const pH = Math.round(inner * 0.64), fH = inner - pH;
    const pTop = T, pBot = T + pH, fTop = pBot + GAP, fBot = fTop + fH;
    const X = (d) => L + ((d - 0.5) / D) * (w - L - Rr);
    const p0 = 1.85, p1 = 6.15;
    const Y = (p) => pTop + (1 - (p - p0) / (p1 - p0)) * pH;
    const S = series(col);
    // On a long round, profit is a trailing 7-day average so the lines can be told apart.
    const AVG = D > 40 ? 7 : 1;
    const prof = (s, k) => {
      let t = 0, m = 0;
      for (let j = Math.max(0, k - AVG + 1); j <= k; j++) { t += s.get(days[j]).profit; m++; }
      return t / m;
    };
    let fmax = 0;
    days.forEach((x, k) => S.forEach((s) => { fmax = Math.max(fmax, prof(s, k)); }));
    const nm = niceMax(Math.max(fmax, 40), 2);
    const F = (v) => fBot - (v / nm.max) * fH;

    // Hot week (shown once the round is over).
    if (state.result && state.round.curve.hot) {
      g.fillStyle = col.sunk;
      g.fillRect(X(HOT[0] - 0.5), pTop - 4, X(HOT[1] + 0.5) - X(HOT[0] - 0.5), fBot - pTop + 4);
      g.fillStyle = col.muted; g.font = monoFont(10); g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      g.fillText('hot week', X((HOT[0] + HOT[1]) / 2), pTop + 8);
    }

    // Grid: whole dollars labelled, half dollars faint.
    g.font = monoFont(11);
    g.textBaseline = 'middle';
    for (let p = 2; p <= 6.001; p += 0.5) {
      const whole = Math.abs(p - Math.round(p)) < 1e-9;
      g.strokeStyle = col.line; g.lineWidth = 1; g.globalAlpha = whole ? 1 : 0.5;
      g.beginPath(); g.moveTo(L, Math.round(Y(p)) + 0.5); g.lineTo(w - Rr, Math.round(Y(p)) + 0.5); g.stroke();
      g.globalAlpha = 1;
      if (whole) { g.fillStyle = col.muted; g.textAlign = 'right'; g.fillText('$' + p, L - 6, Y(p)); }
    }
    for (let k = 0; k <= 2; k++) {
      const v = nm.unit * k;
      g.strokeStyle = col.line; g.lineWidth = 1;
      g.beginPath(); g.moveTo(L, Math.round(F(v)) + 0.5); g.lineTo(w - Rr, Math.round(F(v)) + 0.5); g.stroke();
      g.fillStyle = col.muted; g.textAlign = 'right';
      g.fillText('$' + Math.round(v), L - 6, F(v));
    }
    // Area titles.
    g.font = '600 11px "Atkinson Hyperlegible Next", system-ui, sans-serif';
    g.fillStyle = col.muted; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillText('Price', L + 4, 11);
    g.fillText(AVG > 1 ? 'Profit per day, 7-day average' : 'Profit per day', L + 4, fTop - 8);

    // Day ticks: every 10 days when the round is long, 1, 10, 20, 30 otherwise.
    g.font = monoFont(11);
    g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = col.muted;
    const ticks = [1];
    for (let d = 10; d <= D; d += 10) ticks.push(d);
    if (ticks[ticks.length - 1] !== D) ticks.push(D);
    ticks.forEach((d) => {
      g.strokeStyle = col.line; g.lineWidth = 1;
      g.beginPath(); g.moveTo(Math.round(X(d)) + 0.5, fBot); g.lineTo(Math.round(X(d)) + 0.5, fBot + 4); g.stroke();
      const roomy = X(ticks[1] || D) - X(1) > 64;
      g.fillText(d === 1 && roomy ? 'Day 1' : String(d), d === 1 && roomy ? Math.max(X(d), L + 16) : X(d), h - 5);
    });

    // Best fixed price, once the round is over.
    if (state.result) {
      const yb = Y(state.result.h.bestPrice);
      g.strokeStyle = col.ink; g.setLineDash([4, 4]); g.lineWidth = 1.25;
      g.beginPath(); g.moveTo(L, yb); g.lineTo(w - Rr, yb); g.stroke(); g.setLineDash([]);
      const label = 'best fixed ' + fmt(state.result.h.bestPrice);
      g.font = monoFont(10);
      const tw = g.measureText(label).width;
      g.fillStyle = col.raised; g.fillRect(w - Rr - tw - 6, yb - 15, tw + 6, 13);
      g.fillStyle = col.ink; g.textAlign = 'right'; g.textBaseline = 'bottom';
      g.fillText(label, w - Rr - 3, yb - 3);
    }

    if (!n) return;
    const dots = D <= 40;
    const rad = Math.max(2.5, Math.min(4.5, (w - L - Rr) / D / 3));
    const step = (s, val, Yf, width) => {
      g.strokeStyle = s.color; g.lineWidth = width; g.setLineDash(s.dash); g.lineJoin = 'round';
      g.beginPath();
      days.forEach((x, k) => {
        const y = Yf(val(x, k)), xa = X(x.d) - (dots ? 0 : (w - L - Rr) / D / 2), xb = X(x.d) + (dots ? 0 : (w - L - Rr) / D / 2);
        if (!k) g.moveTo(xa, y); else g.lineTo(xa, y);
        if (!dots) g.lineTo(xb, y);
      });
      g.stroke(); g.setLineDash([]);
    };
    S.forEach((s) => {
      g.globalAlpha = dots && (s.dot || s.ring) ? 0.55 : 1;
      step(s, (x) => s.get(x).price, Y, dots && (s.dot || s.ring) ? 1.5 : s.width);
      g.globalAlpha = 1;
      if (AVG > 1) {
        // A smooth line through the averages.
        g.strokeStyle = s.color; g.lineWidth = Math.max(1.25, s.width - 0.5); g.setLineDash(s.dash); g.lineJoin = 'round';
        g.beginPath();
        days.forEach((x, k) => (k ? g.lineTo(X(x.d), F(prof(s, k))) : g.moveTo(X(x.d), F(prof(s, k)))));
        g.stroke(); g.setLineDash([]);
      } else step(s, (x) => s.get(x).profit, F, Math.max(1.25, s.width - 0.75));
      if (dots && (s.dot || s.ring)) {
        days.forEach((x) => {
          const y = Y(s.get(x).price);
          g.beginPath(); g.arc(X(x.d), y, s.ring ? rad + 2.5 : rad, 0, Math.PI * 2);
          if (s.ring) { g.strokeStyle = s.color; g.lineWidth = 2; g.stroke(); } else { g.fillStyle = s.color; g.fill(); }
        });
      }
    });
    // Mark today's prices on a long round.
    if (!dots) {
      const x = days[n - 1];
      S.forEach((s) => {
        if (!s.dot && !s.ring) return;
        g.beginPath(); g.arc(X(x.d), Y(s.get(x).price), s.ring ? 5 : 3.5, 0, Math.PI * 2);
        if (s.ring) { g.strokeStyle = s.color; g.lineWidth = 2; g.stroke(); } else { g.fillStyle = s.color; g.fill(); }
      });
    }
  }

  function drawCurve() {
    const c = setup(el.curve);
    if (!c || !state.result) return;
    if (R) return drawHold(c);
    const { g, w, h } = c, col = palette(), r = state.round, res = state.result, ps = r.prices;
    const L = 46, Rr = 12, T = 14, B = 26;
    const x0 = 1.8, x1 = 6.2;
    const days = r.curve.hot ? [1, HOT[0]] : [1];
    let max = 0;
    for (let x = 2; x <= 6.001; x += 0.05) days.forEach((d) => { max = Math.max(max, expectedProfit(r, x, d, true)); });
    ps.forEach((p) => days.forEach((d) => { max = Math.max(max, expectedProfit(r, p, d)); }));
    max = niceMax(max, 4).max;
    const X = (x) => L + ((x - x0) / (x1 - x0)) * (w - L - Rr);
    const Y = (v) => T + (1 - v / max) * (h - T - B);

    g.font = monoFont(11);
    g.lineWidth = 1;
    for (let k = 0; k <= 4; k++) {
      const v = (max * k) / 4;
      g.strokeStyle = col.line;
      g.beginPath(); g.moveTo(L, Math.round(Y(v)) + 0.5); g.lineTo(w - Rr, Math.round(Y(v)) + 0.5); g.stroke();
      g.fillStyle = col.muted; g.textAlign = 'right'; g.textBaseline = 'middle';
      g.fillText('$' + Math.round(v), L - 6, Y(v));
    }
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    BASE.forEach((p, i) => { if (i % 2 === 0 || w > 520) g.fillText(fmt(p), X(p), h - 6); });

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

    if (r.s.charm) {
      g.fillStyle = col.ink;
      ps.forEach((p) => {
        if (!isCharm(p)) return;
        g.beginPath(); g.arc(X(p), Y(expectedProfit(r, p, 1)), 2.5, 0, Math.PI * 2); g.fill();
      });
    }

    const dayRef = (i) => Y(expectedProfit(r, ps[i], 1));
    const counts = (picks) => ps.map((_, i) => picks.filter((p) => p === i).length);
    const yc = counts(res.youPicks), bc = counts(res.botPicks);
    const size = (n) => 3 + Math.sqrt(n) * 2.4;
    ps.forEach((p, i) => {
      if (bc[i]) { g.strokeStyle = col.bot; g.lineWidth = 2; g.beginPath(); g.arc(X(p), dayRef(i), size(bc[i]) + 3, 0, Math.PI * 2); g.stroke(); }
      if (yc[i]) { g.fillStyle = col.you; g.globalAlpha = 0.85; g.beginPath(); g.arc(X(p), dayRef(i), size(yc[i]), 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; }
    });

    const bx = X(ps[res.h.best]);
    g.strokeStyle = col.muted; g.setLineDash([3, 4]); g.lineWidth = 1;
    g.beginPath(); g.moveTo(bx, T); g.lineTo(bx, h - B); g.stroke(); g.setLineDash([]);
    g.fillStyle = col.muted; g.textAlign = bx > w - 90 ? 'right' : 'left'; g.textBaseline = 'top';
    g.fillText('best fixed', bx + (bx > w - 90 ? -5 : 5), T);
  }

  // With stands across the street: the total from holding each price all round.
  function drawHold(c) {
    const { g, w, h } = c, col = palette(), res = state.result, ps = state.round.prices;
    const L = 52, Rr = 12, T = 14, B = 26;
    const X = (x) => L + ((x - 1.85) / 4.3) * (w - L - Rr);
    const max = niceMax(Math.max(...res.h.totals, ...res.alone.totals), 4).max;
    const Y = (v) => T + (1 - v / max) * (h - T - B);
    g.font = monoFont(11); g.lineWidth = 1;
    for (let k = 0; k <= 4; k++) {
      const v = (max * k) / 4;
      g.strokeStyle = col.line;
      g.beginPath(); g.moveTo(L, Math.round(Y(v)) + 0.5); g.lineTo(w - Rr, Math.round(Y(v)) + 0.5); g.stroke();
      g.fillStyle = col.muted; g.textAlign = 'right'; g.textBaseline = 'middle';
      g.fillText(money(v), L - 6, Y(v));
    }
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    BASE.forEach((p, i) => { if (i % 2 === 0 || w > 520) g.fillText(fmt(p), X(p), h - 6); });
    const line = (vals, dash) => {
      g.strokeStyle = col.ink; g.lineWidth = 2; g.setLineDash(dash);
      g.beginPath(); ps.forEach((p, i) => (i ? g.lineTo(X(p), Y(vals[i])) : g.moveTo(X(p), Y(vals[i])))); g.stroke(); g.setLineDash([]);
    };
    g.globalAlpha = 0.6; line(res.alone.totals, [5, 4]); g.globalAlpha = 1;
    line(res.h.totals, []);
    const mostUsed = (picks) => settle(picks, ps.length).ranked[0];
    const bi = mostUsed(res.botPicks), yi = mostUsed(res.youPicks);
    g.strokeStyle = col.bot; g.lineWidth = 2; g.beginPath(); g.arc(X(ps[bi]), Y(res.h.totals[bi]), 8, 0, Math.PI * 2); g.stroke();
    g.fillStyle = col.you; g.beginPath(); g.arc(X(ps[yi]), Y(res.h.totals[yi]), 5.5, 0, Math.PI * 2); g.fill();
    const bx = X(res.h.bestPrice);
    g.strokeStyle = col.muted; g.setLineDash([3, 4]); g.lineWidth = 1;
    g.beginPath(); g.moveTo(bx, T); g.lineTo(bx, h - B); g.stroke(); g.setLineDash([]);
    g.fillStyle = col.muted; g.textAlign = bx > w - 90 ? 'right' : 'left'; g.textBaseline = 'top';
    g.fillText('best fixed', bx + (bx > w - 90 ? -5 : 5), T);
  }

  /* ---------- Wiring ---------- */

  el.sellBtn.addEventListener('click', () => advance(1));
  el.five.addEventListener('click', () => advance(C.bigStep));
  el.rest.addEventListener('click', () => advance(D));
  if (el.modePick) {
    el.modePick.addEventListener('click', () => setMode('pick'));
    el.modeRule.addEventListener('click', () => setMode('rule'));
  }
  el.again.addEventListener('click', () => {
    if (mode === 'rule') {
      state.editing = true;
      el.ruleEdit.open = true;
      renderMode();
      reveal(el.rulePanel);
      el.start.focus({ preventScroll: true });
    } else start(state.round.seed);
  });
  el.next.addEventListener('click', () => {
    roundNo++;
    const ks = C.curves.map((k) => E.CURVE_KEYS.indexOf(k)).filter((k) => k >= 0);
    const at = ks.indexOf(state.round.kind);
    start(newSeed(ks[(at + 1) % ks.length]));
    (mode === 'rule' ? el.run1 : el.ladder).focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: reduce.matches ? 'auto' : 'smooth' });
  });

  document.querySelectorAll('.rival select').forEach((s) => s.addEventListener('change', () => {
    if (busy) { s.value = rivals[+s.dataset.j]; return; }
    rivals[+s.dataset.j] = s.value;
    start(state.round.seed);
  }));
  if (el.street) el.street.addEventListener('click', () => {
    botStreet = !botStreet;
    el.street.setAttribute('aria-pressed', botStreet ? 'true' : 'false');
    el.street.textContent = botStreet ? 'Show your street' : 'Show the bot’s street';
    renderLegend(totals(state.days));
    renderLastDay();
    drawChart();
  });

  if (C.rules) {
    el.presets.addEventListener('click', (e) => {
      const b = e.target.closest('[data-preset]');
      if (!b || busy) return;
      rule = clone(PRESETS[b.dataset.preset].rule);
      fillStart();
    });
    el.start.addEventListener('change', () => { rule.start = +el.start.value; el.ruleSum.textContent = ruleSummary(); });
    el.explore.addEventListener('change', () => { rule.explore = el.explore.checked; el.ruleSum.textContent = ruleSummary(); });
    el.addLine.addEventListener('click', () => {
      if (rule.lines.length >= MAX_LINES) return;
      rule.lines.push(R ? { subj: 'comp', op: 'below', value: 0, act: 'match', step: 0.25 } : { subj: 'cups', op: 'gt', value: 30, act: 'raise', step: 0.5 });
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
    el.run1.addEventListener('click', () => advance(1));
    el.runWeek.addEventListener('click', () => advance(C.bigStep));
    el.runAll.addEventListener('click', () => advance(D));
    el.runReset.addEventListener('click', () => { start(state.round.seed); el.run1.focus(); });
  }

  if (el.psy) el.psy.addEventListener('change', (e) => {
    const k = e.target.dataset.setting;
    if (!k || busy) return;
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
    if ((e.key === 'Enter' || e.key === ' ') && !onButton) { e.preventDefault(); advance(1); return; }
    if (e.key === 'r' || e.key === 'R') { e.preventDefault(); advance(C.bigStep); return; }
    if (e.key === 'f' || e.key === 'F') { e.preventDefault(); advance(D); }
  });

  const redraw = () => { drawChart(); if (state.result) drawCurve(); };
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(redraw);
    ro.observe(el.chart);
    ro.observe(el.curve);
  }
  // Canvases in a closed fold have no size; draw them when the fold opens.
  folds.forEach((d) => d.addEventListener('toggle', () => { if (d.open) redraw(); }));
  if (embedded) folds.forEach((d) => { if (!d.classList.contains('fold--edit')) d.open = false; });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redraw);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(redraw);

  // Read the address: ?seed=, &mode=rule, &off=charm,ref,anchor,nines, &vs=under,match
  const params = new URLSearchParams(location.search);
  const q = parseInt(params.get('seed'), 10);
  if (C.rules && params.get('mode') === 'rule') mode = 'rule';
  if (C.psych) (params.get('off') || '').split(',').forEach((k) => { if (k in DEFAULTS) settings[k] = false; });
  if (el.psy) el.psy.querySelectorAll('[data-setting]').forEach((c) => { c.checked = settings[c.dataset.setting]; });
  (params.get('vs') || '').split(',').forEach((k, j) => { if (j < R && k in RIVALS) rivals[j] = k; });
  document.querySelectorAll('.rival select').forEach((s) => { s.value = rivals[+s.dataset.j]; });
  const firstKind = E.CURVE_KEYS.indexOf(C.curves[0]);
  start(Number.isFinite(q) && q > 0 ? q : newSeed(firstKind));
})();
