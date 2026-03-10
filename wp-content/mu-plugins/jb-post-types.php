<?php
/**
 * Plugin Name: JB Custom Post Types
 * Description: Registers custom post types and taxonomies for JoshBaltzell.com.
 * Version: 1.0.0
 * Author: Josh Baltzell
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the AI Interview custom post type.
 */
function jb_register_ai_interview_post_type() {
	$labels = array(
		'name'                  => 'AI Interviews',
		'singular_name'         => 'AI Interview',
		'menu_name'             => 'AI Interviews',
		'all_items'             => 'All Interviews',
		'add_new'               => 'Add New Interview',
		'add_new_item'          => 'Add New Interview',
		'edit_item'             => 'Edit Interview',
		'new_item'              => 'New Interview',
		'view_item'             => 'View Interview',
		'view_items'            => 'View Interviews',
		'search_items'          => 'Search Interviews',
		'not_found'             => 'No interviews found',
		'not_found_in_trash'    => 'No interviews found in trash',
		'archives'              => 'Interview Archives',
		'featured_image'        => 'Interview Artwork',
		'set_featured_image'    => 'Set interview artwork',
		'remove_featured_image' => 'Remove interview artwork',
		'use_featured_image'    => 'Use as interview artwork',
	);

	$args = array(
		'labels'              => $labels,
		'public'              => true,
		'publicly_queryable'  => true,
		'show_ui'             => true,
		'show_in_menu'        => true,
		'show_in_rest'        => true,
		'query_var'           => true,
		'rewrite'             => array( 'slug' => 'interviews', 'with_front' => false ),
		'capability_type'     => 'post',
		'has_archive'         => true,
		'hierarchical'        => false,
		'menu_position'       => 5,
		'menu_icon'           => 'dashicons-format-chat',
		'supports'            => array(
			'title',
			'editor',
			'thumbnail',
			'excerpt',
			'custom-fields',
			'revisions',
		),
		'template'            => array(
			array( 'core/pattern', array(
				'slug' => 'joshbaltzell/interview-question',
			) ),
		),
	);

	register_post_type( 'ai_interview', $args );
}
add_action( 'init', 'jb_register_ai_interview_post_type' );

/**
 * Register the Interview Topic taxonomy.
 */
function jb_register_interview_topic_taxonomy() {
	$labels = array(
		'name'              => 'Interview Topics',
		'singular_name'     => 'Interview Topic',
		'search_items'      => 'Search Topics',
		'all_items'         => 'All Topics',
		'edit_item'         => 'Edit Topic',
		'update_item'       => 'Update Topic',
		'add_new_item'      => 'Add New Topic',
		'new_item_name'     => 'New Topic Name',
		'menu_name'         => 'Topics',
	);

	$args = array(
		'labels'            => $labels,
		'hierarchical'      => true,
		'public'            => true,
		'show_ui'           => true,
		'show_in_rest'      => true,
		'show_admin_column' => true,
		'query_var'         => true,
		'rewrite'           => array( 'slug' => 'topic', 'with_front' => false ),
	);

	register_taxonomy( 'interview_topic', array( 'ai_interview' ), $args );
}
add_action( 'init', 'jb_register_interview_topic_taxonomy' );

/**
 * Pre-populate default interview topics on theme activation.
 */
function jb_create_default_topics() {
	$topics = array(
		'Technology & Engineering',
		'Business & Commerce',
		'Philosophy & Life',
		'Career & Leadership',
	);

	foreach ( $topics as $topic ) {
		if ( ! term_exists( $topic, 'interview_topic' ) ) {
			wp_insert_term( $topic, 'interview_topic' );
		}
	}
}
add_action( 'after_switch_theme', 'jb_create_default_topics' );

/**
 * Flush rewrite rules on activation.
 */
function jb_flush_rewrite_rules() {
	jb_register_ai_interview_post_type();
	jb_register_interview_topic_taxonomy();
	flush_rewrite_rules();
}
register_activation_hook( __FILE__, 'jb_flush_rewrite_rules' );
