/* Text toys: a row of buttons, placed with [text_toys], that play with the words of the page they sit in.
   Call out the nouns, black words out, or read the page in another voice. Put it back undoes all of it.
   The words are wrapped in spans the first time a toy is used, never before. */
(function () {
	'use strict';

	var row = document.querySelector('[data-text-toys]');
	if (!row) return;
	var prose = row.closest('.prose') || row.parentElement;
	var readout = row.querySelector('.text-toys__readout');
	var buttons = {};
	row.querySelectorAll('[data-toy]').forEach(function (b) { buttons[b.dataset.toy] = b; });

	// Each voice swaps whole words. Keys are lower case; capitals are kept as they were.
	var VOICES = [
		{ name: 'plain', words: {} },
		{ name: 'Legalese', words: {
			i: 'the Author', my: 'the Author’s', me: 'the Author', you: 'the Visitor', your: 'the Visitor’s',
			site: 'website (the “Premises”)', workbench: 'workbench, as defined in Schedule A', question: 'matter in dispute',
			game: 'game of skill or chance', games: 'games of skill or chance', toys: 'chattels', toy: 'chattel',
			idea: 'concept', ideas: 'concepts', build: 'construct', learned: 'ascertained', wrong: 'in breach',
			hear: 'receive written notice of', issue: 'formal grievance', browser: 'user agent', physics: 'laws of motion',
			pile: 'aggregation', pause: 'suspend', someone: 'a third party', people: 'parties', links: 'refers'
		} },
		{ name: 'Pirate', words: {
			my: 'me', you: 'ye', your: 'yer', is: 'be', are: 'be', site: 'ship', workbench: 'plank', question: 'riddle',
			game: 'game o’ dice', games: 'games o’ dice', toys: 'trinkets', toy: 'trinket', work: 'plunder',
			find: 'hunt', browser: 'spyglass', code: 'treasure map', issue: 'message in a bottle', wrong: 'off course',
			ai: 'parrot', idea: 'scheme', ideas: 'schemes', page: 'scroll', learned: 'learned (by thunder)',
			physics: 'sea', front: 'bow', hello: 'ahoy', touch: 'parley'
		} },
		{ name: 'Corporate memo', words: {
			site: 'platform', workbench: 'innovation hub', question: 'learning opportunity', game: 'engagement vertical',
			games: 'engagement verticals', toys: 'MVPs', toy: 'MVP', build: 'spin up', learned: 'actioned', idea: 'initiative',
			ideas: 'initiatives', someone: 'a stakeholder', people: 'stakeholders', wrong: 'misaligned', hear: 'circle back on',
			touch: 'sync', pause: 'deprioritize', small: 'lean', find: 'surface', things: 'deliverables', thing: 'deliverable',
			work: 'bandwidth', write: 'socialize', says: 'aligns'
		} }
	];

	var state = { wrapped: false, nouns: false, redact: false, voice: 0 };
	var words = [];
	var parser = null;

	function say(text) { readout.textContent = text; }

	// Wrap every word in the page (but not in this row) in a span that remembers what it said.
	function wrap() {
		if (state.wrapped) return;
		state.wrapped = true;
		var walker = document.createTreeWalker(prose, NodeFilter.SHOW_TEXT, {
			acceptNode: function (n) {
				if (row.contains(n) || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
				var p = n.parentElement;
				if (p && p.closest('script, style, code, pre, .game')) return NodeFilter.FILTER_REJECT;
				return NodeFilter.FILTER_ACCEPT;
			}
		});
		var nodes = [];
		while (walker.nextNode()) nodes.push(walker.currentNode);
		nodes.forEach(function (n) {
			var frag = document.createDocumentFragment();
			n.nodeValue.split(/([A-Za-zÀ-ɏ’']+)/).forEach(function (part, i) {
				if (!part) return;
				if (i % 2 === 0) { frag.appendChild(document.createTextNode(part)); return; }
				var s = document.createElement('span');
				s.className = 'tt-w';
				s.textContent = part;
				s.dataset.o = part;
				frag.appendChild(s);
				words.push(s);
			});
			n.parentNode.replaceChild(frag, n);
		});
	}

	function press(name, on) { buttons[name].setAttribute('aria-pressed', on ? 'true' : 'false'); }

	function keepCase(from, to) {
		// A long all-caps word stays shouted; a short one like "AI" is an acronym, so just capitalise.
		if (from === from.toUpperCase() && from.length > 2) return to.toUpperCase();
		if (from[0] === from[0].toUpperCase()) return to.charAt(0).toUpperCase() + to.slice(1);
		return to;
	}

	function applyVoice() {
		var map = VOICES[state.voice].words;
		var swapped = 0;
		words.forEach(function (w) {
			var o = w.dataset.o;
			var to = map[o.toLowerCase()];
			w.textContent = to ? keepCase(o, to) : o;
			w.classList.toggle('is-swapped', !!to);
			if (to) swapped++;
		});
		return swapped;
	}

	// The parser is big, so it loads the first time someone asks for nouns.
	function loadParser() {
		if (parser) return parser;
		parser = new Promise(function (resolve, reject) {
			if (window.nlp) { resolve(window.nlp); return; }
			var s = document.createElement('script');
			s.src = row.dataset.parser;
			s.onload = function () { window.nlp ? resolve(window.nlp) : reject(); };
			s.onerror = reject;
			document.head.appendChild(s);
		});
		return parser;
	}

	function clean(t) { return t.toLowerCase().replace(/[’']s$/, '').replace(/[^a-zÀ-ɏ]/g, ''); }

	// Parse the page block by block, with its punctuation, then walk the parsed words and the page's word
	// spans side by side, so "work" is a noun where it is used as one and not everywhere.
	function markNouns(nlp) {
		var blocks = [];
		prose.querySelectorAll('p, li, h2, h3, h4, blockquote, figcaption').forEach(function (b) {
			if (!row.contains(b) && !b.querySelector('p, li')) blocks.push(b);
		});
		var counts = {};
		var hits = 0;
		words.forEach(function (w) { w.classList.remove('is-noun'); });
		blocks.forEach(function (b) {
			var spans = Array.prototype.slice.call(b.querySelectorAll('.tt-w'));
			var at = 0;
			nlp(b.textContent).terms().json().forEach(function (sentence) {
				(sentence.terms || []).forEach(function (t) {
					var k = clean(t.text);
					if (!k) return;
					// Find this word among the next few spans; parsers and the page split words slightly differently.
					for (var j = at; j < Math.min(spans.length, at + 4); j++) {
						if (clean(spans[j].textContent).indexOf(k) === 0 || k.indexOf(clean(spans[j].textContent)) === 0) {
							var tags = t.tags || [];
							var noun = tags.indexOf('Noun') > -1 && tags.indexOf('Pronoun') < 0 && tags.indexOf('Determiner') < 0;
							if (noun) {
								spans[j].classList.add('is-noun');
								hits++;
								counts[k] = (counts[k] || 0) + 1;
							}
							at = j + 1;
							return;
						}
					}
				});
			});
		});
		var top = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || b.length - a.length; })[0];
		var pct = Math.round(100 * hits / Math.max(1, words.length));
		var verdict = pct >= 30 ? 'Heavy on things, light on doing.' : pct >= 20 ? 'A fair balance of things and doing.' : 'Mostly doing. Restless page.';
		say('This page is ' + pct + '% nouns. ' + (top ? 'Most suspicious: “' + top + '”, seen ' + counts[top] + (counts[top] === 1 ? ' time. ' : ' times. ') : '') + verdict);
	}

	function toggleNouns() {
		wrap();
		state.nouns = !state.nouns;
		press('nouns', state.nouns);
		if (!state.nouns) {
			words.forEach(function (w) { w.classList.remove('is-noun'); });
			say('The nouns have been released without charge.');
			return;
		}
		say('Looking for nouns…');
		loadParser().then(function (nlp) {
			if (state.nouns) markNouns(nlp);
		}, function () {
			state.nouns = false;
			press('nouns', false);
			say('The noun finder didn’t load. The nouns got away this time.');
		});
	}

	function toggleRedact() {
		wrap();
		state.redact = !state.redact;
		press('redact', state.redact);
		prose.classList.toggle('is-redacting', state.redact);
		var gone = prose.querySelectorAll('.tt-w.is-gone').length;
		say(state.redact ? 'Tap any word to black it out. Tap it again to declassify it.' : 'Redaction desk closed. ' + gone + (gone === 1 ? ' word' : ' words') + ' classified.');
	}

	function nextVoice() {
		wrap();
		state.voice = (state.voice + 1) % VOICES.length;
		var v = VOICES[state.voice];
		buttons.voice.textContent = 'Voice: ' + v.name;
		press('voice', state.voice !== 0);
		var n = applyVoice();
		if (state.nouns && window.nlp) markNouns(window.nlp);
		say(state.voice === 0 ? 'Back to plain.' : 'Now reading in ' + v.name + '. ' + n + (n === 1 ? ' word' : ' words') + ' changed. Press again for the next voice.');
	}

	function reset() {
		state.nouns = state.redact = false;
		state.voice = 0;
		press('nouns', false);
		press('redact', false);
		press('voice', false);
		buttons.voice.textContent = 'Voice: plain';
		prose.classList.remove('is-redacting');
		words.forEach(function (w) {
			w.textContent = w.dataset.o;
			w.classList.remove('is-noun', 'is-gone', 'is-swapped');
		});
		say('Everything is back where it was.');
	}

	prose.addEventListener('click', function (e) {
		if (!state.redact) return;
		var w = e.target.closest('.tt-w');
		if (!w || row.contains(w)) return;
		e.preventDefault(); // a word inside a link is redacted, not followed
		w.classList.toggle('is-gone');
		var gone = prose.querySelectorAll('.tt-w.is-gone').length;
		say(gone >= words.length ? 'Nothing to see here.' : gone + ' of ' + words.length + ' words classified.');
	});

	buttons.nouns.addEventListener('click', toggleNouns);
	buttons.redact.addEventListener('click', toggleRedact);
	buttons.voice.addEventListener('click', nextVoice);
	buttons.reset.addEventListener('click', reset);

	row.hidden = false;
	say('Three toys for a quiet page. Put it back undoes them.');
})();
