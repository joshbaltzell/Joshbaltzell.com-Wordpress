<?php
/**
 * Plugin Name: JB Comment Guard
 * Description: Turns away comment spam without an outside service. The comment form carries a signed timestamp and an empty decoy field; a comment that arrives without the stamp, with a forged or stale one, too quickly, or with the decoy filled in is refused. Pingbacks and trackbacks are refused outright. Logged-in users skip the checks.
 * Version: 1.0.0
 *
 * Bots that post straight to wp-comments-post.php never see the form, so they
 * never have a valid stamp. Pages may be served from WP Engine's cache, so the
 * stamp is allowed to be up to MAX_AGE old.
 */

defined( 'ABSPATH' ) || exit;

const JB_GUARD_MIN_AGE = 3;                 // Seconds. Faster than this is a script.
const JB_GUARD_MAX_AGE = 14 * DAY_IN_SECONDS; // Longer than any page cache.

/**
 * The signature for a stamp: time and post, keyed with the site's salt.
 *
 * @param int $time    Unix time the form was made.
 * @param int $post_id Post the form belongs to.
 * @return string
 */
function jb_guard_sign( $time, $post_id ) {
	return hash_hmac( 'sha256', $time . '|' . $post_id, wp_salt( 'nonce' ) );
}

/**
 * Adds the stamp and the decoy to the form for logged-out visitors. The decoy is
 * moved off screen and out of the tab order; people never see it, form-filling
 * bots tend to fill it.
 */
add_action(
	'comment_form_after_fields',
	function () {
		$time = time();
		$post = get_the_ID();
		printf(
			'<input type="hidden" name="jb_stamp" value="%1$s">' .
			'<div aria-hidden="true" style="position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden">' .
			'<label for="jb_website">Leave this empty</label><input type="text" id="jb_website" name="jb_website" value="" tabindex="-1" autocomplete="off"></div>',
			esc_attr( $time . '.' . jb_guard_sign( $time, $post ) )
		);
	}
);

/**
 * Checks a comment before WordPress saves it.
 *
 * @param array $data The comment about to be saved.
 * @return array
 */
add_filter(
	'preprocess_comment',
	function ( $data ) {
		$type = isset( $data['comment_type'] ) ? $data['comment_type'] : 'comment';

		if ( in_array( $type, array( 'pingback', 'trackback' ), true ) ) {
			jb_guard_refuse();
		}

		// Only the public form (wp-comments-post.php fires pre_comment_on_post) is
		// checked. Logged-in people, admin replies and WP-CLI are trusted.
		if ( is_user_logged_in() || ! did_action( 'pre_comment_on_post' ) ) {
			return $data;
		}

		// phpcs:disable WordPress.Security.NonceVerification -- the stamp is the check.
		$decoy = isset( $_POST['jb_website'] ) ? wp_unslash( $_POST['jb_website'] ) : '';
		$stamp = isset( $_POST['jb_stamp'] ) ? wp_unslash( $_POST['jb_stamp'] ) : '';
		// Anything but plain text in either field is a script, not a person.
		if ( ! is_string( $decoy ) || ! is_string( $stamp ) ) {
			jb_guard_refuse();
		}
		$decoy = trim( $decoy );
		$stamp = sanitize_text_field( $stamp );
		// phpcs:enable

		if ( '' !== $decoy ) {
			jb_guard_refuse();
		}

		$parts = explode( '.', $stamp, 2 );
		if ( 2 !== count( $parts ) || ! ctype_digit( $parts[0] ) ) {
			jb_guard_refuse();
		}

		$time = (int) $parts[0];
		$post = (int) $data['comment_post_ID'];
		$age  = time() - $time;

		if ( ! hash_equals( jb_guard_sign( $time, $post ), $parts[1] ) || $age > JB_GUARD_MAX_AGE ) {
			jb_guard_refuse( __( 'This page was open too long. Reload it and send your comment again.', 'jb-toybox' ) );
		}

		if ( $age < JB_GUARD_MIN_AGE ) {
			jb_guard_refuse( __( 'That was quick. Wait a moment and send it again.', 'jb-toybox' ) );
		}

		return $data;
	},
	1
);

/**
 * Stops the request with a plain message and a 403.
 *
 * @param string $message What the visitor reads.
 */
function jb_guard_refuse( $message = '' ) {
	wp_die(
		esc_html( $message ? $message : __( 'Your comment could not be sent.', 'jb-toybox' ) ),
		esc_html__( 'Comment not sent', 'jb-toybox' ),
		array(
			'response'  => 403,
			'back_link' => true,
		)
	);
}

// No pingbacks over XML-RPC, and no X-Pingback header advertising them.
add_filter(
	'xmlrpc_methods',
	function ( $methods ) {
		unset( $methods['pingback.ping'], $methods['pingback.extensions.getPingbacks'] );
		return $methods;
	}
);
add_filter(
	'wp_headers',
	function ( $headers ) {
		unset( $headers['X-Pingback'] );
		return $headers;
	}
);
