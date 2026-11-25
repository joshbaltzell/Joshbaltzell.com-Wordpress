<?php
/**
 * JB Toybox theme setup.
 *
 * Design values live in theme.json. The stylesheets in assets/css come from the
 * design system unchanged, except wp.css, which holds the WordPress-only rules.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require get_theme_file_path( 'inc/kinds.php' );
require get_theme_file_path( 'inc/template-tags.php' );
require get_theme_file_path( 'inc/social.php' );

/**
 * Theme supports and image sizes.
 */
function jb_toybox_setup() {
	add_theme_support( 'title-tag' );
	add_theme_support( 'post-thumbnails' );
	add_theme_support( 'automatic-feed-links' );
	add_theme_support( 'responsive-embeds' );
	add_theme_support( 'html5', array( 'comment-form', 'comment-list', 'gallery', 'caption', 'style', 'script' ) );
	add_theme_support( 'editor-styles' );

	// A page's Excerpt is the paragraph under its title; the front page's is the home page's introduction.
	add_post_type_support( 'page', 'excerpt' );

	// Cover art on a block in the stack: 16:9, cropped to fill, at twice the drawn size.
	add_image_size( 'jb-cover', 960, 540, true );
}
add_action( 'after_setup_theme', 'jb_toybox_setup' );

/**
 * Make sure the five kinds exist as categories when the theme is switched on.
 */
function jb_toybox_ensure_kinds() {
	foreach ( jb_kinds() as $slug => $kind ) {
		if ( ! term_exists( $slug, 'category' ) ) {
			wp_insert_term( $kind['plural'], 'category', array( 'slug' => $slug ) );
		}
	}
}
add_action( 'after_switch_theme', 'jb_toybox_ensure_kinds' );

/**
 * Stylesheets: tokens, then the site stylesheet, then the WordPress-only rules.
 */
function jb_toybox_enqueue_assets() {
	$previous = array();
	foreach ( array( 'tokens.wp', 'bundle', 'wp' ) as $name ) {
		$path = get_theme_file_path( "assets/css/$name.css" );
		wp_enqueue_style( "jb-$name", get_theme_file_uri( "assets/css/$name.css" ), $previous, filemtime( $path ) );
		$previous = array( "jb-$name" );
	}

	$stack = get_theme_file_path( 'assets/js/stack.js' );
	wp_register_script( 'matter-js', get_theme_file_uri( 'assets/js/vendor/matter.min.js' ), array(), '0.19.0', array( 'in_footer' => true ) );
	wp_register_script( 'jb-stack-core', get_theme_file_uri( 'assets/js/stack.js' ), array( 'matter-js' ), filemtime( $stack ), array( 'in_footer' => true ) );
	// The extra rules load straight after the stack, before it starts, so it finds them.
	$rules = get_theme_file_path( 'assets/js/stack-rules.js' );
	wp_register_script( 'jb-stack', get_theme_file_uri( 'assets/js/stack-rules.js' ), array( 'jb-stack-core' ), filemtime( $rules ), array( 'in_footer' => true ) );

	$site = get_theme_file_path( 'assets/js/site.js' );
	wp_enqueue_script( 'jb-site', get_theme_file_uri( 'assets/js/site.js' ), array(), filemtime( $site ), array( 'in_footer' => true, 'strategy' => 'defer' ) );

	if ( is_singular() && comments_open() && get_option( 'thread_comments' ) ) {
		wp_enqueue_script( 'comment-reply' );
	}
}
add_action( 'wp_enqueue_scripts', 'jb_toybox_enqueue_assets' );

/**
 * Load the core block styles as one sheet, ahead of the theme's.
 *
 * Loaded block by block they can arrive after the theme's stylesheets, and
 * where a core rule and a design-system rule tie, the later one would win.
 */
add_filter( 'should_load_separate_core_block_assets', '__return_false' );

/**
 * Every base rule in the site stylesheet hangs off the class "jb" on <body>.
 */
function jb_toybox_body_class( $classes ) {
	$classes[] = 'jb';
	return $classes;
}
add_filter( 'body_class', 'jb_toybox_body_class' );

/**
 * Give the block editor the same tokens and article styles as the front end.
 *
 * The site stylesheet addresses the article body as .prose and the page as .jb.
 * In the editor those are the root container and the canvas body.
 */
function jb_toybox_editor_styles( $settings ) {
	$css = '';
	foreach ( array( 'tokens.wp', 'bundle' ) as $name ) {
		$css .= file_get_contents( get_theme_file_path( "assets/css/$name.css" ) );
	}
	$css = str_replace( array( '.prose', '.jb' ), array( '.is-root-container', 'body' ), $css );

	$settings['styles'][] = array( 'css' => $css );
	return $settings;
}
add_filter( 'block_editor_settings_all', 'jb_toybox_editor_styles' );

/**
 * The Button block's default look is the primary button. Add the other two.
 */
function jb_toybox_block_styles() {
	register_block_style( 'core/button', array( 'name' => 'secondary', 'label' => __( 'Secondary', 'jb-toybox' ) ) );
	register_block_style( 'core/button', array( 'name' => 'play', 'label' => __( 'Play', 'jb-toybox' ) ) );
}
add_action( 'init', 'jb_toybox_block_styles' );

/**
 * Every list is one page. The whole list is in the page, and the stack shows a first batch with a More
 * button for the rest, so there is no pager. Capped so a list can never get out of hand.
 */
function jb_toybox_list_size( $query ) {
	if ( is_admin() || ! $query->is_main_query() ) {
		return;
	}
	if ( $query->is_home() || $query->is_archive() || $query->is_search() ) {
		$query->set( 'posts_per_page', 48 );
		$query->set( 'no_found_rows', false );
		$query->set( 'ignore_sticky_posts', true );
	}
	if ( $query->is_search() ) {
		$query->set( 'post_type', 'post' );
	}
}
add_action( 'pre_get_posts', 'jb_toybox_list_size' );

/**
 * Code blocks can take keyboard focus, so a long line can be scrolled without a pointer.
 */
function jb_toybox_code_block( $html ) {
	return preg_replace( '/<pre class="wp-block-code"/', '<pre class="wp-block-code" tabindex="0"', $html, 1 );
}
add_filter( 'render_block_core/code', 'jb_toybox_code_block' );

/**
 * [game]: a playable game inside an article.
 *
 * [game name="Brick loop" version="1.2" url="https://…/archive/brick-loop/v1.2/"
 *       poster="https://…/poster.png" alt="What the artwork shows"
 *       keys="{←} {→} move the paddle | Miss the ball and the count starts over"]
 *
 * Keys go in braces, and "|" starts a new note.
 *
 * The game is not fetched until Play is pressed. Point "url" at a frozen copy
 * of the version the article is about, not at the live build.
 */
function jb_toybox_game_shortcode( $atts ) {
	$a = shortcode_atts(
		array(
			'name'    => '',
			'version' => '',
			'status'  => __( 'Playable', 'jb-toybox' ),
			'url'     => '',
			'toy'     => '',
			'poster'  => '',
			'poster_dark' => '',
			'height'  => '',
			'alt'     => '',
			'keys'    => '',
		),
		$atts,
		'game'
	);

	// A toy added under Posts → Toy files can be named instead of given an address: toy="price-the-lemonade".
	if ( '' === $a['url'] && '' !== $a['toy'] && function_exists( 'jb_toy_url' ) ) {
		$a['url'] = jb_toy_url( $a['toy'], (int) ltrim( (string) $a['version'], 'vV' ) );
	}
	if ( '' === $a['url'] ) {
		return '';
	}

	$label = $a['status'];
	if ( '' !== $a['version'] ) {
		$label .= ' &middot; v' . esc_html( ltrim( $a['version'], 'vV' ) );
	}

	$keys = '';
	foreach ( array_filter( array_map( 'trim', explode( '|', $a['keys'] ) ) ) as $line ) {
		$keys .= '<span>' . jb_keys( $line ) . '</span>';
	}

	ob_start();
	?>
<figure class="game alignwide">
	<div class="game__bar"><span class="game__name"><?php echo esc_html( $a['name'] ); ?> <span class="t-tag"><?php echo $label; // phpcs:ignore WordPress.Security.EscapeOutput -- escaped above. ?></span></span><a class="link game__open" href="<?php echo esc_url( $a['url'] ); ?>"><?php esc_html_e( 'Open full page', 'jb-toybox' ); ?> &nearr;</a></div>
	<details class="game__stage">
		<summary><?php if ( '' !== $a['poster'] ) : ?><picture><?php if ( '' !== $a['poster_dark'] ) : // a second still for dark mode, so a light screenshot doesn't glare on a dark page ?><source media="(prefers-color-scheme: dark)" srcset="<?php echo esc_url( $a['poster_dark'] ); ?>"><?php endif; ?><img class="game__poster" src="<?php echo esc_url( $a['poster'] ); ?>" alt="<?php echo esc_attr( $a['alt'] ); ?>" loading="lazy"></picture><?php endif; ?><span class="btn btn--play"><?php esc_html_e( 'Play', 'jb-toybox' ); ?></span><span class="btn btn--small game__stop"><?php esc_html_e( 'Stop', 'jb-toybox' ); ?></span></summary>
		<iframe class="game__screen" src="<?php echo esc_url( $a['url'] ); ?>"<?php echo (int) $a['height'] > 0 ? ' style="aspect-ratio:auto;height:' . (int) min( 2000, (int) $a['height'] ) . 'px"' : ''; /* a toy that needs more room than 16:9 asks for it */ ?> loading="lazy" title="<?php echo esc_attr( $a['name'] ); ?>" allow="fullscreen; gamepad; autoplay"></iframe>
	</details>
	<?php if ( '' !== $keys ) : ?><figcaption class="game__keys"><?php echo $keys; // phpcs:ignore WordPress.Security.EscapeOutput -- built by jb_keys(). ?></figcaption><?php endif; ?>
</figure>
	<?php
	return ob_get_clean();
}
add_shortcode( 'game', 'jb_toybox_game_shortcode' );
