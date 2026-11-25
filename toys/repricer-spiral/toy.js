/* The Repricer Spiral: the page. The simulation lives in sim.js. */
(function () {
  "use strict";
  var R = window.Repricer;
  var $ = function (id) { return document.getElementById(id); };

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var COLOR_VAR = { ember: "--c-you", slate: "--c-a", olive: "--c-b" };
  var EVERY = [[1, "1 minute"], [5, "5 minutes"], [10, "10 minutes"], [15, "15 minutes"], [20, "20 minutes"], [30, "30 minutes"], [60, "1 hour"], [240, "4 hours"], [1440, "1 day"]];

  var state = {
    preset: null,
    sellers: [],          // the editable rules
    weights: R.clone(R.DEFAULT_WEIGHTS),
    total: R.WEEK,
    log: false,
    sim: null,
    playing: false,
    carry: 0,
    last: 0,
    logCount: 0
  };

  /* ---------- Colors from the stylesheet, resolved for the current light or dark scheme ---------- */
  var probe = document.createElement("span");
  probe.style.display = "none";
  document.querySelector(".toy").appendChild(probe);
  var palette = {};
  function resolve(v) { probe.style.color = "var(" + v + ")"; return getComputedStyle(probe).color; }
  function readPalette() {
    palette = {
      ink: resolve("--ink"), muted: resolve("--muted"), line: resolve("--line"), raised: resolve("--raised"),
      sunk: resolve("--sunk"), ember: resolve("--c-you"), slate: resolve("--c-a"), olive: resolve("--c-b")
    };
  }

  /* ---------- Presets ---------- */
  function buildPresets() {
    var box = $("presets");
    R.PRESETS.forEach(function (p) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.textContent = p.name; b.dataset.id = p.id;
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", function () { loadPreset(p.id, true); });
      box.appendChild(b);
    });
  }

  function loadPreset(id, autoplay) {
    var p = R.PRESETS.find(function (x) { return x.id === id; });
    state.preset = p;
    state.sellers = R.clone(p.sellers);
    state.weights = R.clone(R.DEFAULT_WEIGHTS);
    state.total = p.total;
    state.log = p.log;
    $("length").value = String(p.total);
    $("logscale").checked = p.log;
    $("preset-note").textContent = p.note;
    document.querySelectorAll("#presets .chip").forEach(function (c) {
      c.setAttribute("aria-pressed", c.dataset.id === id ? "true" : "false");
    });
    syncWeights();
    buildSellers();
    reset();
    if (autoplay) play();
  }

  /* ---------- Seller cards ---------- */
  function field(label, html, cls) {
    return '<label' + (cls ? ' class="' + cls + '"' : "") + '>' + label + html + "</label>";
  }

  function buildSellers() {
    var box = $("sellers");
    box.innerHTML = "";
    state.sellers.forEach(function (s, i) {
      var card = document.createElement("section");
      card.className = "panel seller";
      card.style.setProperty("--c", "var(" + COLOR_VAR[s.color] + ")");
      var every = EVERY.map(function (e) {
        return '<option value="' + e[0] + '"' + (e[0] === s.every ? " selected" : "") + ">" + e[1] + "</option>";
      }).join("");
      var id = "s" + i + "-";
      card.innerHTML =
        "<h3>" + s.name + '<span class="tag">' + (s.mine ? "Your rule" : "Bot") + "</span></h3>" +
        '<label class="check"><input type="checkbox" data-k="active" id="' + id + 'active"' + (s.active ? " checked" : "") + "> In the market</label>" +
        '<div class="fields">' +
        field("Rule", '<select data-k="rule">' +
          '<option value="undercut">Undercut the lowest rival by X%</option>' +
          '<option value="match">Match the lowest rival</option>' +
          '<option value="above">Stay X% above the lowest rival</option></select>', "wide") +
        field("X (%)", '<input type="number" data-k="pct" min="0" max="500" step="any" inputmode="decimal">') +
        field("Reacts every", '<select data-k="every">' + every + "</select>") +
        field("Starting price", '<input type="number" data-k="start" min="0.01" step="0.01" inputmode="decimal">') +
        field("Floor", '<input type="number" data-k="floor" min="0" step="0.01" inputmode="decimal">') +
        field("Ceiling", '<input type="number" data-k="ceiling" min="0" step="0.01" placeholder="None" inputmode="decimal">') +
        field("At the floor", '<select data-k="reset"><option value="">Stay there</option><option value="1">Jump to ceiling</option></select>') +
        field("Rating", '<input type="number" data-k="rating" min="1" max="5" step="0.1" inputmode="decimal">') +
        '<label class="check"><input type="checkbox" data-k="fba"> Marketplace ships it</label>' +
        "</div>";
      box.appendChild(card);
      card.querySelector('[data-k="rule"]').value = s.rule;
      card.querySelector('[data-k="pct"]').value = s.pct;
      card.querySelector('[data-k="start"]').value = s.start;
      card.querySelector('[data-k="floor"]').value = s.floor;
      card.querySelector('[data-k="ceiling"]').value = s.ceiling == null ? "" : s.ceiling;
      card.querySelector('[data-k="reset"]').value = s.reset ? "1" : "";
      card.querySelector('[data-k="rating"]').value = s.rating;
      card.querySelector('[data-k="fba"]').checked = !!s.fba;
      card.querySelector('[data-k="pct"]').disabled = s.rule === "match";
      card.dataset.off = String(!s.active);
      card.addEventListener("change", function (e) { edit(i, e.target, card); });
    });
  }

  function num(v, fallback) { var n = parseFloat(v); return isFinite(n) ? n : fallback; }

  function edit(i, el, card) {
    var s = state.sellers[i];
    var k = el.dataset.k;
    if (!k) return;
    if (k === "active" || k === "fba") s[k] = el.checked;
    else if (k === "rule") {
      s.rule = el.value;
      if (s.rule !== "match" && !s.pct) { s.pct = 1; card.querySelector('[data-k="pct"]').value = 1; }
    }
    else if (k === "reset") s.reset = el.value === "1";
    else if (k === "every") s.every = parseInt(el.value, 10);
    else if (k === "ceiling") s.ceiling = el.value === "" ? null : Math.max(0, num(el.value, 0));
    else if (k === "rating") s.rating = Math.min(5, Math.max(1, num(el.value, 4.5)));
    else s[k] = Math.max(k === "start" ? 0.01 : 0, num(el.value, s[k]));
    card.querySelector('[data-k="pct"]').disabled = s.rule === "match";
    card.dataset.off = String(!s.active);

    var sim = state.sim;
    if (k === "start" || sim.t === 0) { reset(); return; }
    // Everything else applies from the current minute.
    var live = sim.sellers[i];
    ["active", "fba", "rule", "reset", "every", "rating", "pct", "floor"].forEach(function (key) { live[key] = s[key]; });
    live.ceiling = s.ceiling == null ? Infinity : s.ceiling;
    render();
  }

  /* ---------- Weights ---------- */
  function syncWeights() {
    ["price", "fba", "rating"].forEach(function (k) {
      $("w-" + k).value = state.weights[k];
      $("o-" + k).textContent = state.weights[k];
    });
  }
  ["price", "fba", "rating"].forEach(function (k) {
    $("w-" + k).addEventListener("input", function (e) {
      state.weights[k] = parseInt(e.target.value, 10);
      $("o-" + k).textContent = state.weights[k];
      if (state.sim) { state.sim.weights[k] = state.weights[k]; }
    });
    $("w-" + k).addEventListener("change", function () { if (state.sim && state.sim.t === 0) reset(); else render(); });
  });

  /* ---------- Running ---------- */
  function reset() {
    pause();
    state.sim = R.create({ sellers: state.sellers, weights: state.weights, total: state.total });
    state.logCount = 0;
    $("log").innerHTML = "";
    render();
  }

  function finished() { return state.sim.t >= state.sim.total; }

  function play() {
    if (finished()) reset();
    if (reduce.matches) {
      R.run(state.sim, state.sim.total);
      render();
      return;
    }
    state.playing = true;
    state.carry = 0;
    state.last = performance.now();
    $("play").textContent = "Pause";
    requestAnimationFrame(frame);
  }

  function pause() {
    state.playing = false;
    $("play").textContent = state.sim && finished() ? "Play again" : "Play";
  }

  function frame(now) {
    if (!state.playing) return;
    var dt = Math.min(100, now - state.last);
    state.last = now;
    state.carry += parseInt($("speed").value, 10) * dt / 1000;
    var n = Math.floor(state.carry);
    state.carry -= n;
    if (n > 0) R.run(state.sim, n);
    if (finished()) { pause(); render(); return; }
    render();
    requestAnimationFrame(frame);
  }

  function step() {
    pause();
    if (finished()) return;
    R.run(state.sim, R.nextReaction(state.sim));
    render();
  }

  $("play").addEventListener("click", function () { state.playing ? pause() : play(); });
  $("step").addEventListener("click", step);
  $("reset").addEventListener("click", reset);
  $("length").addEventListener("change", function (e) { state.total = parseInt(e.target.value, 10); reset(); });
  $("logscale").addEventListener("change", function (e) { state.log = e.target.checked; drawChart(); });

  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var tag = e.target.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    var k = e.key.toLowerCase();
    if (k === " " && tag !== "BUTTON") { e.preventDefault(); state.playing ? pause() : play(); }
    else if (k === "s") step();
    else if (k === "r") reset();
    else if (k === "l") { $("logscale").checked = !$("logscale").checked; state.log = $("logscale").checked; drawChart(); }
  });

  /* ---------- Drawing ---------- */
  function render() {
    var sim = state.sim;
    var t = Math.max(0, sim.t - 1);
    $("clock").textContent = sim.t === 0 ? "Not started" : R.when(t, sim.total) + (finished() ? " (done)" : "");
    if (!state.playing) $("play").textContent = finished() ? "Play again" : (sim.t === 0 ? "Play" : "Resume");
    drawLegend();
    drawShare();
    drawLog();
    drawChart();
  }

  function ruleText(s) {
    var every = (EVERY.find(function (e) { return e[0] === s.every; }) || [0, s.every + " minutes"])[1];
    var r = s.rule === "match" ? "matches" : s.rule === "undercut" ? "undercuts by " + s.pct + "%" : "stays " + s.pct + "% above";
    return r + ", every " + every;
  }

  function drawLegend() {
    var box = $("legend");
    box.innerHTML = "";
    state.sim.sellers.forEach(function (s) {
      var d = document.createElement("div");
      d.style.setProperty("--c", "var(" + COLOR_VAR[s.color] + ")");
      d.innerHTML = '<span class="tag">' + s.name + "</span>" +
        (s.active ? '<span class="readout">' + R.money(s.price) + '</span><span class="small muted">' + ruleText(s) + "</span>"
                  : '<span class="out">Sitting out</span>');
      box.appendChild(d);
    });
  }

  function drawShare() {
    var sim = state.sim;
    var box = $("share");
    box.innerHTML = "";
    var total = sim.sellers.reduce(function (a, s) { return a + s.wins; }, 0);
    sim.sellers.forEach(function (s) {
      if (!s.active && !s.wins) return;
      var pct = total ? (100 * s.wins / total) : 0;
      var row = document.createElement("div");
      row.className = "share-row";
      row.style.setProperty("--c", "var(" + COLOR_VAR[s.color] + ")");
      row.innerHTML = "<span>" + s.name + '</span><span class="bar"><i style="width:' + pct.toFixed(1) + '%"></i></span><span class="pct">' + Math.round(pct) + "%</span>";
      box.appendChild(row);
    });
  }

  function drawLog() {
    var ev = state.sim.events;
    var box = $("log");
    if (ev.length === state.logCount) return;
    var atEnd = state.logCount === 0 || box.scrollTop + box.clientHeight >= box.scrollHeight - 8;
    var frag = document.createDocumentFragment();
    for (var i = state.logCount; i < ev.length; i++) {
      var li = document.createElement("li");
      li.innerHTML = "<time></time><span></span>";
      li.firstChild.textContent = R.when(ev[i].t, state.sim.total);
      li.lastChild.textContent = ev[i].text;
      frag.appendChild(li);
    }
    box.appendChild(frag);
    state.logCount = ev.length;
    if (atEnd) box.scrollTop = box.scrollHeight;
  }

  function niceStep(span, target) {
    var raw = span / target;
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var f = raw / mag;
    return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
  }

  function shortMoney(v) {
    if (v >= 1e9) return "$" + +(v / 1e9).toFixed(1) + "B";
    if (v >= 1e6) return "$" + +(v / 1e6).toFixed(1) + "M";
    if (v >= 1e4) return "$" + +(v / 1e3).toFixed(0) + "k";
    if (v >= 100) return "$" + Math.round(v);
    return "$" + +v.toFixed(2);
  }

  function drawChart() {
    var cv = $("chart");
    var sim = state.sim;
    var dpr = window.devicePixelRatio || 1;
    var W = cv.clientWidth, H = cv.clientHeight;
    if (!W || !H) return;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    }
    var g = cv.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    var font = getComputedStyle(document.body).getPropertyValue("--font-mono") || "monospace";
    g.font = "11px " + font;

    var L = 58, Rp = 10, T = 10, band = 10, gapB = 9, B = 22 + band + gapB + 2;
    var pw = W - L - Rp, ph = H - T - B;

    // Y range from everything drawn so far.
    var lo = Infinity, hi = -Infinity;
    var n = Math.ceil(sim.t / sim.bucketSize);
    for (var bi = 0; bi < n; bi++) {
      var b = sim.buckets[bi];
      if (!b) continue;
      for (var i = 0; i < sim.sellers.length; i++) {
        if (b.last[i] == null) continue;
        if (b.lo[i] < lo) lo = b.lo[i];
        if (b.hi[i] > hi) hi = b.hi[i];
      }
    }
    sim.sellers.forEach(function (s) { if (s.active) { lo = Math.min(lo, s.price); hi = Math.max(hi, s.price); } });
    if (!isFinite(lo)) { lo = 1; hi = 100; }

    var log = state.log;
    var y0, y1, ticks = [];
    if (log) {
      y0 = Math.log10(Math.max(0.01, lo) / 1.25);
      y1 = Math.log10(hi * 1.25);
      if (y1 - y0 < 0.6) { var mid = (y0 + y1) / 2; y0 = mid - 0.3; y1 = mid + 0.3; }
      var span = y1 - y0;
      var mults = span > 3 ? [1] : span > 1.2 ? [1, 3] : [1, 1.5, 2, 3, 5, 7];
      if (span > 8) mults = [1];
      var stepDec = span > 8 ? 2 : 1;
      for (var d = Math.floor(y0); d <= Math.ceil(y1); d += stepDec) {
        mults.forEach(function (m) { var v = m * Math.pow(10, d); var lv = Math.log10(v); if (lv >= y0 && lv <= y1) ticks.push(v); });
      }
    } else {
      y0 = 0;
      y1 = hi * 1.12;
      if (y1 <= 0) y1 = 1;
      var st = niceStep(y1, 5);
      y1 = Math.ceil(y1 / st) * st;
      for (var v = 0; v <= y1 + 1e-9; v += st) ticks.push(v);
    }
    function Y(p) {
      var u = log ? (Math.log10(Math.max(p, 1e-6)) - y0) / (y1 - y0) : (p - y0) / (y1 - y0);
      return T + ph - u * ph;
    }
    function X(t) { return L + (t / sim.total) * pw; }

    // Grid and labels
    g.strokeStyle = palette.line; g.lineWidth = 1; g.fillStyle = palette.muted;
    g.textAlign = "right"; g.textBaseline = "middle";
    ticks.forEach(function (v) {
      var y = Math.round(Y(v)) + 0.5;
      g.beginPath(); g.moveTo(L, y); g.lineTo(L + pw, y); g.stroke();
      g.fillText(shortMoney(v), L - 6, y);
    });
    var days = sim.total / 1440;
    var every = days <= 7 ? 1 : 7;
    g.textAlign = "center"; g.textBaseline = "top";
    for (var dd = 0; dd <= days; dd += every) {
      var x = Math.round(X(dd * 1440)) + 0.5;
      g.beginPath(); g.moveTo(x, T); g.lineTo(x, T + ph); g.stroke();
      if (dd < days) {
        var lab = days <= 7 ? R.DAYS[dd].slice(0, 3) : "Wk " + (dd / 7 + 1);
        var lx = X((dd + every / 2) * 1440);
        if (pw / (days / every) > 28) g.fillText(lab, lx, T + ph + gapB + band + 6);
      }
    }

    // Buy Box band: who held it most in each bucket.
    var bw = pw / Math.ceil(sim.total / sim.bucketSize);
    var bandY = T + ph + gapB; /* low enough that its label clears the $0 tick */
    g.fillStyle = palette.sunk; g.fillRect(L, bandY, pw, band);
    // Name the strip, so its colour reads as "this seller held the Buy Box", not as a status bar.
    g.fillStyle = palette.muted; g.textAlign = "right"; g.textBaseline = "middle";
    g.fillText("Buy Box", L - 6, bandY + band / 2);
    for (bi = 0; bi < n; bi++) {
      b = sim.buckets[bi];
      if (!b) continue;
      var top = -1, most = 0;
      for (i = 0; i < b.wins.length; i++) if (b.wins[i] > most) { most = b.wins[i]; top = i; }
      if (top < 0) continue;
      g.fillStyle = palette[sim.sellers[top].color];
      g.fillRect(L + bi * bw, bandY, Math.ceil(bw + 0.5), band);
    }

    // Price lines, You on top.
    var order = sim.sellers.map(function (s, i) { return i; }).sort(function (a, b2) { return (sim.sellers[a].mine ? 1 : 0) - (sim.sellers[b2].mine ? 1 : 0); });
    g.save();
    g.beginPath(); g.rect(L, T - 2, pw, ph + 4); g.clip();
    order.forEach(function (i) {
      var s = sim.sellers[i];
      g.strokeStyle = palette[s.color];
      g.lineWidth = s.mine ? 2.5 : 2;
      g.lineJoin = "round";
      g.beginPath();
      var drawing = false, prevY = 0;
      for (var k = 0; k < n; k++) {
        var bb = sim.buckets[k];
        if (!bb || bb.last[i] == null) { drawing = false; continue; }
        var x0 = X(k * sim.bucketSize), x1 = X(Math.min(sim.total, (k + 1) * sim.bucketSize));
        var yl = Y(bb.last[i]);
        if (!drawing) { g.moveTo(x0, yl); prevY = yl; drawing = true; }
        else g.lineTo(x0, prevY);
        if (bb.hi[i] > bb.lo[i]) { g.lineTo(x0, Y(bb.hi[i])); g.lineTo(x0, Y(bb.lo[i])); }
        g.lineTo(x0, yl);
        g.lineTo(x1, yl);
        prevY = yl;
      }
      g.stroke();
    });
    g.restore();

    // Now marker while running.
    if (sim.t > 0 && sim.t < sim.total) {
      var nx = Math.round(X(sim.t)) + 0.5;
      g.strokeStyle = palette.muted; g.setLineDash([3, 3]);
      g.beginPath(); g.moveTo(nx, T); g.lineTo(nx, T + ph); g.stroke();
      g.setLineDash([]);
    }

    cv.setAttribute("aria-label", "Price of each seller over time, " + (log ? "log" : "linear") + " scale. " +
      sim.sellers.filter(function (s) { return s.active; }).map(function (s) { return s.name + " now " + R.money(s.price); }).join(", ") + ".");
  }

  /* ---------- Start ---------- */
  function onScheme() { readPalette(); if (state.sim) drawChart(); }
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", onScheme);
  var rt;
  window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(drawChart, 60); });

  readPalette();
  buildPresets();
  var start = location.hash.slice(1);
  if (!R.PRESETS.some(function (p) { return p.id === start; })) start = "floor";
  loadPreset(start, false);
  // Open on a finished run so the chart is never empty.
  R.run(state.sim, state.sim.total);
  render();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawChart);
})();
