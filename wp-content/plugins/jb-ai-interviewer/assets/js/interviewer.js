/**
 * JB AI Interviewer — Admin Chat UI
 *
 * Manages the interview conversation within a WordPress meta box.
 * Talks to custom REST API endpoints that proxy to OpenAI.
 */
(function () {
	'use strict';

	// --- State ---
	var state = {
		phase: 'setup', // 'setup' | 'active' | 'complete'
		messages: [],    // { role: 'assistant'|'user', content: string }
		round: 0,
		isLoading: false,
		lastRetryAction: null,
	};

	// --- Config (injected by PHP via wp_localize_script) ---
	var config = window.jbaiConfig || {};

	// --- DOM References ---
	var els = {};

	/**
	 * Initialize the app once DOM is ready.
	 */
	function init() {
		els.app        = document.getElementById('jbai-app');
		els.setup      = document.getElementById('jbai-setup');
		els.chat       = document.getElementById('jbai-chat');
		els.messages   = document.getElementById('jbai-messages');
		els.typing     = document.getElementById('jbai-typing');
		els.input      = document.getElementById('jbai-input');
		els.inputArea  = document.getElementById('jbai-input-area');
		els.sendBtn    = document.getElementById('jbai-send');
		els.startBtn   = document.getElementById('jbai-start');
		els.endBtn     = document.getElementById('jbai-end');
		els.formatBtn  = document.getElementById('jbai-format');
		els.resetBtn   = document.getElementById('jbai-reset');
		els.roundBadge = document.getElementById('jbai-round-badge');
		els.status     = document.getElementById('jbai-status');
		els.error      = document.getElementById('jbai-error');
		els.errorMsg   = document.getElementById('jbai-error-msg');
		els.retryBtn   = document.getElementById('jbai-retry');
		els.subject    = document.getElementById('jbai-subject');
		els.angle      = document.getElementById('jbai-angle');
		els.audience   = document.getElementById('jbai-audience');

		if (!els.app) return;

		bindEvents();
		restoreConversation();
	}

	/**
	 * Bind all event listeners.
	 */
	function bindEvents() {
		els.startBtn.addEventListener('click', handleStart);
		els.sendBtn.addEventListener('click', handleSend);
		els.endBtn.addEventListener('click', handleEnd);
		els.formatBtn.addEventListener('click', handleFormat);
		els.resetBtn.addEventListener('click', handleReset);
		els.retryBtn.addEventListener('click', handleRetry);

		els.input.addEventListener('keydown', function (e) {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				handleSend();
			}
		});
	}

	/**
	 * Restore an existing conversation from post meta (page reload support).
	 */
	function restoreConversation() {
		var conv = config.conversation;
		if (!conv || !conv.length) {
			// Pre-fill setup fields if saved.
			if (config.subject) els.subject.value = config.subject;
			if (config.angle) els.angle.value = config.angle;
			if (config.audience) els.audience.value = config.audience;
			return;
		}

		// Rebuild state from conversation history.
		state.messages = [];
		state.round = 0;

		for (var i = 0; i < conv.length; i++) {
			var msg = conv[i];
			if (msg.role === 'system') continue;

			if (msg.role === 'assistant') {
				state.messages.push({ role: 'assistant', content: msg.content });
			} else if (msg.role === 'user') {
				state.messages.push({ role: 'user', content: msg.content });
				state.round++;
			}
		}

		// Determine phase.
		if (config.isComplete) {
			state.phase = 'complete';
		} else if (state.messages.length > 0) {
			state.phase = 'active';
		}

		showChatPanel();
		renderAllMessages();
		updateControls();
	}

	/**
	 * Start a new interview.
	 */
	function handleStart() {
		var subject  = els.subject.value.trim();
		var angle    = els.angle.value.trim();
		var audience = els.audience.value.trim();

		if (!subject) {
			els.subject.focus();
			els.subject.style.borderColor = '#C4785B';
			return;
		}

		els.subject.style.borderColor = '';
		state.phase = 'active';
		showChatPanel();
		showTyping();
		setLoading(true);

		apiCall('chat', {
			post_id: config.postId,
			message: '',
			subject: subject,
			angle: angle,
			audience: audience,
		}, function (data) {
			hideTyping();
			setLoading(false);
			addMessage('assistant', data.question);
			state.round = data.round;
			updateControls();

			if (data.is_complete) {
				state.phase = 'complete';
				updateControls();
			}
		}, function (err) {
			hideTyping();
			setLoading(false);
			showError(err, function () { handleStart(); });
		});
	}

	/**
	 * Send user's answer.
	 */
	function handleSend() {
		var text = els.input.value.trim();
		if (!text || state.isLoading) return;

		addMessage('user', text);
		els.input.value = '';
		autoResizeInput();
		sendMessage(text);
	}

	/**
	 * Send a message to the API (also used for retry without re-adding to UI).
	 */
	function sendMessage(text) {
		showTyping();
		setLoading(true);

		apiCall('chat', {
			post_id: config.postId,
			message: text,
		}, function (data) {
			hideTyping();
			setLoading(false);
			addMessage('assistant', data.question);
			state.round = data.round;
			updateControls();

			if (data.is_complete) {
				state.phase = 'complete';
				updateControls();
			}
		}, function (err) {
			hideTyping();
			setLoading(false);
			showError(err, function () {
				// Retry sends the same message without re-adding to the UI.
				sendMessage(text);
			});
		});
	}

	/**
	 * End the interview early.
	 */
	function handleEnd() {
		if (!confirm('End this interview early? You can still format and insert what you have.')) {
			return;
		}
		state.phase = 'complete';
		updateControls();

		// Persist completion status server-side.
		apiCall('complete', {
			post_id: config.postId,
		}, function () {}, function () {});
	}

	/**
	 * Format the conversation and insert into the post editor.
	 */
	function handleFormat() {
		setLoading(true);
		els.formatBtn.disabled = true;
		els.formatBtn.textContent = 'Formatting...';

		apiCall('format', {
			post_id: config.postId,
		}, function (data) {
			setLoading(false);
			els.formatBtn.textContent = 'Format & Insert into Post';
			els.formatBtn.disabled = false;

			if (data.content) {
				insertIntoEditor(data.content);
				els.formatBtn.textContent = 'Inserted! (' + data.exchange_count + ' exchanges)';
				els.formatBtn.disabled = true;
				setTimeout(function () {
					els.formatBtn.textContent = 'Format & Insert into Post';
					els.formatBtn.disabled = false;
				}, 3000);
			}
		}, function (err) {
			setLoading(false);
			els.formatBtn.textContent = 'Format & Insert into Post';
			els.formatBtn.disabled = false;
			showError(err, handleFormat);
		});
	}

	/**
	 * Reset the interview — clear conversation and return to setup.
	 */
	function handleReset() {
		if (!confirm('Reset this interview? All conversation history will be deleted.')) {
			return;
		}

		apiCall('reset', {
			post_id: config.postId,
		}, function () {
			state.phase = 'setup';
			state.messages = [];
			state.round = 0;
			els.messages.innerHTML = '';
			showSetupPanel();
		}, function (err) {
			showError(err, handleReset);
		});
	}

	/**
	 * Retry last failed action.
	 */
	function handleRetry() {
		hideError();
		if (state.lastRetryAction) {
			state.lastRetryAction();
		}
	}

	// --- UI Helpers ---

	function showChatPanel() {
		els.setup.style.display = 'none';
		els.chat.style.display = '';
	}

	function showSetupPanel() {
		els.chat.style.display = 'none';
		els.setup.style.display = '';
	}

	function showTyping() {
		els.typing.style.display = '';
		scrollToBottom();
	}

	function hideTyping() {
		els.typing.style.display = 'none';
	}

	function setLoading(loading) {
		state.isLoading = loading;
		els.sendBtn.disabled = loading;
		els.input.disabled = loading;
		if (!loading) {
			els.input.focus();
		}
	}

	function showError(message, retryFn) {
		els.error.style.display = '';
		els.errorMsg.textContent = message;
		state.lastRetryAction = retryFn || null;
		els.retryBtn.style.display = retryFn ? '' : 'none';
	}

	function hideError() {
		els.error.style.display = 'none';
	}

	/**
	 * Add a message to the chat and render it.
	 */
	function addMessage(role, content) {
		state.messages.push({ role: role, content: content });
		renderMessage(role, content, true);
		hideError();
	}

	/**
	 * Render a single message bubble.
	 */
	function renderMessage(role, content, animate) {
		var bubble = document.createElement('div');
		bubble.className = 'jbai-message jbai-message-' + role;
		if (animate) {
			bubble.classList.add('jbai-message-enter');
		}

		var label = document.createElement('span');
		label.className = 'jbai-message-label';
		label.textContent = role === 'assistant' ? 'AI' : 'Josh';

		var text = document.createElement('div');
		text.className = 'jbai-message-text';
		text.textContent = content;

		bubble.appendChild(label);
		bubble.appendChild(text);
		els.messages.appendChild(bubble);
		scrollToBottom();
	}

	/**
	 * Render all messages (for restore).
	 */
	function renderAllMessages() {
		els.messages.innerHTML = '';
		for (var i = 0; i < state.messages.length; i++) {
			renderMessage(state.messages[i].role, state.messages[i].content, false);
		}
	}

	/**
	 * Update control visibility based on state.
	 */
	function updateControls() {
		// Round badge.
		els.roundBadge.textContent = 'Round ' + state.round + ' of 8-12';

		// End button visible after round 4.
		els.endBtn.style.display = (state.phase === 'active' && state.round >= 4) ? '' : 'none';

		// Format button visible when complete.
		els.formatBtn.style.display = (state.phase === 'complete') ? '' : 'none';

		// Input area hidden when complete.
		els.inputArea.style.display = (state.phase === 'complete') ? 'none' : '';

		// Status indicator.
		if (state.phase === 'complete') {
			els.status.textContent = 'Interview complete';
			els.status.className = 'jbai-status jbai-status-complete';
		} else {
			els.status.textContent = 'In progress';
			els.status.className = 'jbai-status jbai-status-active';
		}
	}

	function scrollToBottom() {
		setTimeout(function () {
			els.messages.scrollTop = els.messages.scrollHeight;
		}, 50);
	}

	function autoResizeInput() {
		els.input.style.height = 'auto';
		els.input.style.height = Math.min(els.input.scrollHeight, 200) + 'px';
	}

	/**
	 * Insert block content into the Gutenberg editor.
	 */
	function insertIntoEditor(content) {
		// Try Gutenberg (block editor) first.
		if (window.wp && window.wp.blocks && window.wp.data) {
			try {
				var blocks = window.wp.blocks.parse(content);
				if (blocks && blocks.length) {
					window.wp.data.dispatch('core/block-editor').resetBlocks(blocks);
					return;
				}
			} catch (e) {
				// Fall through to next method.
			}
		}

		// Fallback: edit post content directly.
		if (window.wp && window.wp.data) {
			try {
				window.wp.data.dispatch('core/editor').editPost({ content: content });
				return;
			} catch (e) {
				// Fall through to clipboard.
			}
		}

		// Last resort: copy to clipboard.
		if (navigator.clipboard) {
			navigator.clipboard.writeText(content);
			alert('Content copied to clipboard. Paste it into the post editor.');
		}
	}

	// --- API ---

	/**
	 * Make a REST API call.
	 */
	function apiCall(endpoint, data, onSuccess, onError) {
		var url = config.restUrl + endpoint;

		fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-WP-Nonce': config.nonce,
			},
			body: JSON.stringify(data),
		})
		.then(function (response) {
			return response.json().then(function (body) {
				return { ok: response.ok, status: response.status, body: body };
			});
		})
		.then(function (result) {
			if (result.ok) {
				onSuccess(result.body);
			} else {
				var msg = result.body.message || result.body.data || 'Request failed (HTTP ' + result.status + ')';
				onError(msg);
			}
		})
		.catch(function (err) {
			onError('Network error: ' + err.message);
		});
	}

	// --- Boot ---

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
