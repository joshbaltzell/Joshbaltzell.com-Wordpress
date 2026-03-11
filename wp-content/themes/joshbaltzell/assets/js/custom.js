/**
 * Josh Baltzell Theme - Custom JavaScript
 * Handles scroll-triggered animations, reading progress, and interactive effects.
 */

(function () {
	'use strict';

	var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	/**
	 * Scroll Reveal - Animate elements when they enter the viewport.
	 */
	function initScrollReveal() {
		var animatedElements = document.querySelectorAll(
			'.jb-slide-up, .jb-fade-in, .jb-stagger-in'
		);

		if (!animatedElements.length) return;

		if (reducedMotion) {
			animatedElements.forEach(function (el) {
				el.classList.add('jb-visible');
			});
			return;
		}

		var observer = new IntersectionObserver(
			function (entries) {
				entries.forEach(function (entry) {
					if (entry.isIntersecting) {
						if (entry.target.classList.contains('jb-stagger-in')) {
							var parent = entry.target.parentElement;
							if (parent) {
								var siblings = parent.querySelectorAll('.jb-stagger-in');
								siblings.forEach(function (sibling, index) {
									sibling.style.animationDelay = (index * 0.1) + 's';
								});
							}
						}

						entry.target.classList.add('jb-visible');
						observer.unobserve(entry.target);
					}
				});
			},
			{
				threshold: 0.1,
				rootMargin: '0px 0px -40px 0px',
			}
		);

		animatedElements.forEach(function (el) {
			observer.observe(el);
		});
	}

	/**
	 * Interview Q&A progressive reveal.
	 * Each interview exchange fades in as the reader scrolls to it.
	 */
	function initInterviewReveal() {
		var exchanges = document.querySelectorAll('.jb-interview-content .interview-exchange');
		if (!exchanges.length || reducedMotion) return;

		exchanges.forEach(function (exchange) {
			exchange.style.opacity = '0';
			exchange.style.transform = 'translateY(16px)';
			exchange.style.transition = 'opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1), transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
		});

		var observer = new IntersectionObserver(
			function (entries) {
				entries.forEach(function (entry) {
					if (entry.isIntersecting) {
						entry.target.style.opacity = '1';
						entry.target.style.transform = 'translateY(0)';
						observer.unobserve(entry.target);
					}
				});
			},
			{
				threshold: 0.05,
				rootMargin: '0px 0px -60px 0px',
			}
		);

		exchanges.forEach(function (el) {
			observer.observe(el);
		});
	}

	/**
	 * Reading progress bar for interview posts.
	 */
	function initReadingProgress() {
		var content = document.querySelector('.jb-interview-content');
		if (!content) return;

		var bar = document.createElement('div');
		bar.setAttribute('aria-hidden', 'true');
		bar.style.cssText =
			'position:fixed;top:0;left:0;height:3px;width:0;' +
			'background:linear-gradient(90deg, var(--wp--preset--color--secondary), var(--wp--preset--color--accent));' +
			'z-index:9999;transition:width 0.15s linear;pointer-events:none;';
		document.body.appendChild(bar);

		var ticking = false;

		function updateProgress() {
			var rect = content.getBoundingClientRect();
			var contentTop = rect.top + window.scrollY;
			var contentHeight = rect.height;
			var scrolled = window.scrollY - contentTop;
			var viewHeight = window.innerHeight;
			var progress = Math.min(1, Math.max(0, scrolled / (contentHeight - viewHeight)));

			bar.style.width = (progress * 100) + '%';

			if (progress >= 1) {
				bar.style.opacity = '0.5';
			} else {
				bar.style.opacity = '1';
			}
			ticking = false;
		}

		window.addEventListener('scroll', function () {
			if (!ticking) {
				window.requestAnimationFrame(updateProgress);
				ticking = true;
			}
		}, { passive: true });
	}

	/**
	 * Header scroll effect - Adds shadow and blur when scrolled.
	 */
	function initHeaderScroll() {
		var header = document.querySelector('header.wp-block-group');
		if (!header) return;

		var ticking = false;

		function updateHeader() {
			if (window.scrollY > 20) {
				header.classList.add('jb-scrolled');
			} else {
				header.classList.remove('jb-scrolled');
			}
			ticking = false;
		}

		window.addEventListener('scroll', function () {
			if (!ticking) {
				window.requestAnimationFrame(updateHeader);
				ticking = true;
			}
		}, { passive: true });
	}

	/**
	 * Subtle parallax effect for hero sections.
	 */
	function initParallax() {
		var heroes = document.querySelectorAll('.jb-hero');
		if (!heroes.length || reducedMotion || window.innerWidth < 768) return;

		var ticking = false;

		function updateParallax() {
			var scrollY = window.scrollY;
			heroes.forEach(function (hero) {
				var rect = hero.getBoundingClientRect();
				if (rect.bottom > 0 && rect.top < window.innerHeight) {
					hero.style.setProperty('--jb-parallax-y', (scrollY * 0.15) + 'px');
				}
			});
			ticking = false;
		}

		window.addEventListener('scroll', function () {
			if (!ticking) {
				window.requestAnimationFrame(updateParallax);
				ticking = true;
			}
		}, { passive: true });
	}

	/**
	 * Smooth anchor scrolling with offset for fixed header.
	 */
	function initSmoothAnchors() {
		document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
			anchor.addEventListener('click', function (e) {
				var targetId = this.getAttribute('href');
				if (targetId === '#') return;

				var target = document.querySelector(targetId);
				if (target) {
					e.preventDefault();
					var headerEl = document.querySelector('header.wp-block-group');
					var headerHeight = headerEl ? headerEl.offsetHeight : 0;
					var targetPosition = target.getBoundingClientRect().top + window.scrollY - headerHeight - 20;
					window.scrollTo({
						top: targetPosition,
						behavior: 'smooth',
					});
				}
			});
		});
	}

	/**
	 * Typewriter-style cursor blink on the hero tagline.
	 */
	function initCursorBlink() {
		var tagline = document.querySelector('.jb-hero .has-heading-font-family[style*="italic"]');
		if (!tagline || reducedMotion) return;

		var cursor = document.createElement('span');
		cursor.setAttribute('aria-hidden', 'true');
		cursor.style.cssText =
			'display:inline-block;width:2px;height:1em;background:var(--wp--preset--color--secondary);' +
			'margin-left:4px;vertical-align:text-bottom;animation:subtlePulse 1s ease-in-out 3;';
		tagline.appendChild(cursor);

		setTimeout(function () {
			cursor.style.transition = 'opacity 0.5s ease';
			cursor.style.opacity = '0';
			setTimeout(function () {
				cursor.remove();
			}, 500);
		}, 3500);
	}

	/**
	 * Magnetic hover effect on interview cards.
	 * Cards subtly tilt toward the cursor position.
	 */
	function initCardTilt() {
		if (reducedMotion || window.innerWidth < 768) return;

		var cards = document.querySelectorAll('.jb-interview-card');
		cards.forEach(function (card) {
			card.addEventListener('mousemove', function (e) {
				var rect = card.getBoundingClientRect();
				var x = e.clientX - rect.left;
				var y = e.clientY - rect.top;
				var centerX = rect.width / 2;
				var centerY = rect.height / 2;
				var rotateX = ((y - centerY) / centerY) * -2;
				var rotateY = ((x - centerX) / centerX) * 2;

				card.style.transform = 'translateY(-6px) perspective(800px) rotateX(' + rotateX + 'deg) rotateY(' + rotateY + 'deg)';
			});

			card.addEventListener('mouseleave', function () {
				card.style.transform = '';
			});
		});
	}

	/**
	 * Smooth image reveal on lazy-load.
	 */
	function initImageReveal() {
		if (reducedMotion) return;

		var images = document.querySelectorAll('img[loading="lazy"]');
		images.forEach(function (img) {
			if (!img.complete) {
				img.style.opacity = '0';
				img.addEventListener('load', function () {
					img.style.opacity = '1';
				});
			}
		});
	}

	/**
	 * Horizontal scrolling carousel for Featured Interviews.
	 * Supports mouse drag, touch, keyboard, scroll-snap, and indicators.
	 */
	function initCarousel() {
		var carousel = document.querySelector('.jb-carousel');
		if (!carousel) return;

		var cards = carousel.querySelectorAll('.jb-carousel-card');
		var indicatorContainer = document.querySelector('.jb-carousel-indicators');

		// Build indicators
		if (indicatorContainer && cards.length) {
			indicatorContainer.innerHTML = '';
			cards.forEach(function (_, i) {
				var dot = document.createElement('button');
				dot.className = 'jb-carousel-indicator' + (i === 0 ? ' is-active' : '');
				dot.setAttribute('aria-label', 'Go to slide ' + (i + 1));
				dot.addEventListener('click', function () {
					cards[i].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
				});
				indicatorContainer.appendChild(dot);
			});
		}

		// Update active indicator on scroll
		var indicators = indicatorContainer ? indicatorContainer.querySelectorAll('.jb-carousel-indicator') : [];
		var scrollTicking = false;

		function updateIndicators() {
			var containerCenter = carousel.scrollLeft + carousel.offsetWidth / 2;
			var closestIndex = 0;
			var closestDistance = Infinity;

			cards.forEach(function (card, i) {
				var cardCenter = card.offsetLeft + card.offsetWidth / 2;
				var distance = Math.abs(containerCenter - cardCenter);
				if (distance < closestDistance) {
					closestDistance = distance;
					closestIndex = i;
				}
			});

			indicators.forEach(function (ind, i) {
				ind.classList.toggle('is-active', i === closestIndex);
			});
			scrollTicking = false;
		}

		carousel.addEventListener('scroll', function () {
			if (!scrollTicking) {
				window.requestAnimationFrame(updateIndicators);
				scrollTicking = true;
			}
		}, { passive: true });

		// Mouse drag scrolling
		var isDragging = false;
		var startX = 0;
		var scrollStart = 0;

		carousel.addEventListener('mousedown', function (e) {
			isDragging = true;
			startX = e.pageX;
			scrollStart = carousel.scrollLeft;
			carousel.classList.add('is-dragging');
		});

		document.addEventListener('mousemove', function (e) {
			if (!isDragging) return;
			e.preventDefault();
			var walk = (e.pageX - startX) * 1.5;
			carousel.scrollLeft = scrollStart - walk;
		});

		document.addEventListener('mouseup', function () {
			if (!isDragging) return;
			isDragging = false;
			// Re-enable snap after drag with brief delay
			setTimeout(function () {
				carousel.classList.remove('is-dragging');
			}, 50);
		});

		// Prevent link clicks after drag
		carousel.addEventListener('click', function (e) {
			if (Math.abs(carousel.scrollLeft - scrollStart) > 5) {
				e.preventDefault();
			}
		}, true);

		// Keyboard navigation
		carousel.setAttribute('tabindex', '0');
		carousel.setAttribute('role', 'region');
		carousel.setAttribute('aria-label', 'Featured interviews carousel');

		carousel.addEventListener('keydown', function (e) {
			if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
				e.preventDefault();
				var scrollAmount = carousel.offsetWidth * 0.7;
				carousel.scrollBy({
					left: e.key === 'ArrowRight' ? scrollAmount : -scrollAmount,
					behavior: 'smooth'
				});
			}
		});

		// Scroll hint animation on first load
		if (!reducedMotion && cards.length > 1) {
			setTimeout(function () {
				carousel.style.transition = 'none';
				var originalScroll = carousel.scrollLeft;
				carousel.scrollTo({ left: originalScroll + 60, behavior: 'smooth' });
				setTimeout(function () {
					carousel.scrollTo({ left: originalScroll, behavior: 'smooth' });
				}, 400);
			}, 1500);
		}
	}

	/**
	 * Text reveal animation using IntersectionObserver.
	 * Works with .jb-text-reveal, .jb-scale-in, .jb-clip-reveal, .jb-line-grow elements.
	 */
	function initTextReveal() {
		var elements = document.querySelectorAll(
			'.jb-text-reveal, .jb-scale-in, .jb-clip-reveal, .jb-line-grow'
		);

		if (!elements.length) return;

		if (reducedMotion) {
			elements.forEach(function (el) {
				el.classList.add('jb-visible');
			});
			return;
		}

		var observer = new IntersectionObserver(
			function (entries) {
				entries.forEach(function (entry) {
					if (entry.isIntersecting) {
						entry.target.classList.add('jb-visible');
						observer.unobserve(entry.target);
					}
				});
			},
			{
				threshold: 0.1,
				rootMargin: '0px 0px -60px 0px',
			}
		);

		elements.forEach(function (el) {
			observer.observe(el);
		});
	}

	/**
	 * Split text into individual word spans for staggered animation.
	 * Elements with .jb-word-split get their text split into .jb-text-reveal-word spans.
	 */
	function initWordSplit() {
		var elements = document.querySelectorAll('.jb-word-split');
		if (!elements.length) return;

		elements.forEach(function (el) {
			var text = el.textContent.trim();
			if (!text) return;

			// Preserve original text for accessibility
			el.setAttribute('aria-label', text);

			var words = text.split(/\s+/);
			el.innerHTML = '';

			words.forEach(function (word, i) {
				var span = document.createElement('span');
				span.className = 'jb-text-reveal-word';
				span.style.setProperty('--word-index', i);
				span.textContent = word;
				span.setAttribute('aria-hidden', 'true');
				el.appendChild(span);

				// Add space between words
				if (i < words.length - 1) {
					el.appendChild(document.createTextNode(' '));
				}
			});
		});
	}

	/**
	 * Enhanced header overlay — transparent on hero, solid on scroll.
	 * Extends initHeaderScroll when .jb-hero-dramatic is present.
	 */
	function initHeaderOverlay() {
		var header = document.querySelector('header.wp-block-group');
		var hero = document.querySelector('.jb-hero-dramatic');
		if (!header) return;

		// If we have a dramatic hero, enable overlay mode
		if (hero && window.innerWidth > 781) {
			header.classList.add('jb-header-overlay');
		}
	}

	/**
	 * Copy-to-clipboard for prompt guide code blocks.
	 */
	function initPromptCopy() {
		var guide = document.querySelector('.jb-prompt-guide');
		if (!guide) return;

		var codeBlocks = guide.querySelectorAll('.wp-block-code');
		codeBlocks.forEach(function (block) {
			block.style.cursor = 'pointer';
			block.setAttribute('title', 'Click to copy');

			block.addEventListener('click', function () {
				var code = block.querySelector('code');
				if (!code) return;

				var text = code.innerText;
				navigator.clipboard.writeText(text).then(function () {
					var label = block.querySelector('::before') || block;
					var original = block.getAttribute('data-label') || '';
					block.setAttribute('data-copied', 'true');
					block.style.borderColor = 'var(--wp--preset--color--accent)';

					setTimeout(function () {
						block.removeAttribute('data-copied');
						block.style.borderColor = '';
					}, 2000);
				});
			});
		});
	}

	/**
	 * Initialize all effects when DOM is ready.
	 */
	function init() {
		initWordSplit();
		initScrollReveal();
		initTextReveal();
		initInterviewReveal();
		initReadingProgress();
		initHeaderScroll();
		initHeaderOverlay();
		initParallax();
		initSmoothAnchors();
		initCursorBlink();
		initCardTilt();
		initCarousel();
		initImageReveal();
		initPromptCopy();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
