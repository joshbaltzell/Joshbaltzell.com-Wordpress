<?php
/**
 * Plugin Name: JB Search Visibility
 * Description: Lets search engines in only on the live site. Everywhere else (Local, WP Engine staging, any copy) the site asks not to be indexed, whatever Settings → Reading says. A database pushed between environments can't change that.
 * Version: 1.0.0
 */

defined( 'ABSPATH' ) || exit;

const JB_LIVE_HOSTS = array( 'joshbaltzell.com', 'www.joshbaltzell.com' );

/**
 * Whether this copy of the site is the live one.
 *
 * @return bool
 */
function jb_is_live_site() {
	$host = wp_parse_url( home_url(), PHP_URL_HOST );
	return in_array( strtolower( (string) $host ), JB_LIVE_HOSTS, true );
}

// The "Discourage search engines" setting follows the host, not the database.
add_filter(
	'pre_option_blog_public',
	function () {
		return jb_is_live_site() ? '1' : '0';
	}
);
