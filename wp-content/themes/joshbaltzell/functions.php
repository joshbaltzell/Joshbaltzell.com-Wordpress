<?php
/**
 * Josh Baltzell Theme Functions
 *
 * @package joshbaltzell
 * @since 1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Theme setup.
 */
function joshbaltzell_setup() {
	add_theme_support( 'wp-block-styles' );
	add_theme_support( 'editor-styles' );
	add_theme_support( 'post-thumbnails' );
	add_theme_support( 'responsive-embeds' );
	add_theme_support( 'custom-logo', array(
		'height'      => 60,
		'width'       => 200,
		'flex-height' => true,
		'flex-width'  => true,
	) );

	add_image_size( 'featured-large', 2400, 1350, true );
	add_image_size( 'featured-medium', 1200, 675, true );
	add_image_size( 'social-share', 1200, 630, true );
	add_image_size( 'interview-thumb', 600, 338, true );
}
add_action( 'after_setup_theme', 'joshbaltzell_setup' );

/**
 * Enqueue custom styles.
 */
function joshbaltzell_enqueue_styles() {
	wp_enqueue_style(
		'joshbaltzell-custom',
		get_theme_file_uri( 'assets/css/custom.css' ),
		array(),
		wp_get_theme()->get( 'Version' )
	);
}
add_action( 'wp_enqueue_scripts', 'joshbaltzell_enqueue_styles' );

/**
 * Enqueue editor styles.
 */
function joshbaltzell_enqueue_editor_styles() {
	add_editor_style( 'assets/css/custom.css' );
}
add_action( 'after_setup_theme', 'joshbaltzell_enqueue_editor_styles' );

/**
 * Enqueue custom scripts.
 */
function joshbaltzell_enqueue_scripts() {
	wp_enqueue_script(
		'joshbaltzell-custom',
		get_theme_file_uri( 'assets/js/custom.js' ),
		array(),
		wp_get_theme()->get( 'Version' ),
		true
	);
}
add_action( 'wp_enqueue_scripts', 'joshbaltzell_enqueue_scripts' );

/**
 * Register block pattern categories.
 */
function joshbaltzell_register_pattern_categories() {
	register_block_pattern_category( 'joshbaltzell-interview', array(
		'label' => __( 'AI Interview', 'joshbaltzell' ),
	) );
	register_block_pattern_category( 'joshbaltzell-resume', array(
		'label' => __( 'Resume / CV', 'joshbaltzell' ),
	) );
	register_block_pattern_category( 'joshbaltzell-hero', array(
		'label' => __( 'Hero Sections', 'joshbaltzell' ),
	) );
	register_block_pattern_category( 'joshbaltzell-cta', array(
		'label' => __( 'Calls to Action', 'joshbaltzell' ),
	) );
}
add_action( 'init', 'joshbaltzell_register_pattern_categories' );

/**
 * Register custom post meta for block editor.
 */
function joshbaltzell_register_post_meta() {
	register_post_meta( 'ai_interview', '_interview_topic_subtitle', array(
		'show_in_rest'  => true,
		'single'        => true,
		'type'          => 'string',
		'auth_callback' => function () {
			return current_user_can( 'edit_posts' );
		},
	) );

	register_post_meta( 'ai_interview', '_interview_read_time', array(
		'show_in_rest'  => true,
		'single'        => true,
		'type'          => 'string',
		'auth_callback' => function () {
			return current_user_can( 'edit_posts' );
		},
	) );
}
add_action( 'init', 'joshbaltzell_register_post_meta' );

/**
 * Add WebP upload support.
 */
function joshbaltzell_mime_types( $mimes ) {
	$mimes['webp'] = 'image/webp';
	$mimes['svg']  = 'image/svg+xml';
	return $mimes;
}
add_filter( 'upload_mimes', 'joshbaltzell_mime_types' );

/**
 * Estimated reading time for posts.
 */
function joshbaltzell_reading_time( $content = '' ) {
	if ( empty( $content ) ) {
		$content = get_the_content();
	}
	$word_count = str_word_count( wp_strip_all_tags( $content ) );
	$minutes    = max( 1, ceil( $word_count / 250 ) );
	return sprintf( '%d min read', $minutes );
}
