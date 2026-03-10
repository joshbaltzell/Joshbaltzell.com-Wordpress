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
	 * Initialize all effects when DOM is ready.
	 */
	function init() {
		initScrollReveal();
		initInterviewReveal();
		initReadingProgress();
		initHeaderScroll();
		initParallax();
		initSmoothAnchors();
		initCursorBlink();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
