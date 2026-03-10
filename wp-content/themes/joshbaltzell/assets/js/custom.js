/**
 * Josh Baltzell Theme - Custom JavaScript
 * Handles scroll-triggered animations and subtle interactive effects.
 */

(function () {
	'use strict';

	/**
	 * Scroll Reveal - Animate elements when they enter the viewport.
	 * Uses IntersectionObserver for performance.
	 */
	function initScrollReveal() {
		const animatedElements = document.querySelectorAll(
			'.jb-slide-up, .jb-fade-in, .jb-stagger-in'
		);

		if (!animatedElements.length) return;

		// Respect reduced motion preferences
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			animatedElements.forEach(function (el) {
				el.classList.add('jb-visible');
			});
			return;
		}

		const observer = new IntersectionObserver(
			function (entries) {
				entries.forEach(function (entry) {
					if (entry.isIntersecting) {
						// For stagger-in elements, add sequential delays
						if (entry.target.classList.contains('jb-stagger-in')) {
							const parent = entry.target.parentElement;
							if (parent) {
								const siblings = parent.querySelectorAll('.jb-stagger-in');
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
	 * Header scroll effect - Adds shadow when scrolled past threshold.
	 */
	function initHeaderScroll() {
		const header = document.querySelector('header.wp-block-group');
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
	 * Moves the watercolor background at a slower rate than scroll.
	 */
	function initParallax() {
		var heroes = document.querySelectorAll('.jb-hero');
		if (!heroes.length) return;

		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

		// Skip on mobile for performance
		if (window.innerWidth < 768) return;

		var ticking = false;

		function updateParallax() {
			var scrollY = window.scrollY;
			heroes.forEach(function (hero) {
				var rect = hero.getBoundingClientRect();
				var visible = rect.bottom > 0 && rect.top < window.innerHeight;
				if (visible) {
					var offset = scrollY * 0.15;
					if (hero.style) {
						hero.style.setProperty('--jb-parallax-y', offset + 'px');
					}
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
					var headerHeight = document.querySelector('header.wp-block-group')
						? document.querySelector('header.wp-block-group').offsetHeight
						: 0;
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
	 * A subtle touch of interactivity.
	 */
	function initCursorBlink() {
		var tagline = document.querySelector('.jb-hero .has-heading-font-family[style*="italic"]');
		if (!tagline || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

		// Add a blinking cursor that fades after a moment
		var cursor = document.createElement('span');
		cursor.style.cssText =
			'display:inline-block;width:2px;height:1em;background:var(--wp--preset--color--secondary);' +
			'margin-left:4px;vertical-align:text-bottom;animation:subtlePulse 1s ease-in-out 3;';
		tagline.appendChild(cursor);

		// Remove cursor after animation completes
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
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}

	function init() {
		initScrollReveal();
		initHeaderScroll();
		initParallax();
		initSmoothAnchors();
		initCursorBlink();
	}
})();
