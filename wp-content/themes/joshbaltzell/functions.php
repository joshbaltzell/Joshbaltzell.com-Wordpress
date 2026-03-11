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
	add_image_size( 'carousel-featured', 1600, 1000, true );
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
 * Register AI Interview custom post type.
 */
function joshbaltzell_register_post_types() {
	register_post_type( 'ai_interview', array(
		'labels'              => array(
			'name'               => __( 'AI Interviews', 'joshbaltzell' ),
			'singular_name'      => __( 'AI Interview', 'joshbaltzell' ),
			'add_new'            => __( 'Add New', 'joshbaltzell' ),
			'add_new_item'       => __( 'Add New Interview', 'joshbaltzell' ),
			'edit_item'          => __( 'Edit Interview', 'joshbaltzell' ),
			'new_item'           => __( 'New Interview', 'joshbaltzell' ),
			'view_item'          => __( 'View Interview', 'joshbaltzell' ),
			'search_items'       => __( 'Search Interviews', 'joshbaltzell' ),
			'not_found'          => __( 'No interviews found', 'joshbaltzell' ),
			'not_found_in_trash' => __( 'No interviews found in Trash', 'joshbaltzell' ),
		),
		'public'              => true,
		'has_archive'         => true,
		'rewrite'             => array( 'slug' => 'interviews', 'with_front' => false ),
		'menu_icon'           => 'dashicons-format-chat',
		'menu_position'       => 5,
		'supports'            => array( 'title', 'editor', 'thumbnail', 'excerpt', 'custom-fields' ),
		'show_in_rest'        => true,
		'template'            => array(
			array( 'core/pattern', array( 'slug' => 'joshbaltzell/interview-prompt-guide' ) ),
		),
	) );
}
add_action( 'init', 'joshbaltzell_register_post_types' );

/**
 * Register Interview Topic taxonomy.
 */
function joshbaltzell_register_taxonomies() {
	register_taxonomy( 'interview_topic', 'ai_interview', array(
		'labels'            => array(
			'name'          => __( 'Interview Topics', 'joshbaltzell' ),
			'singular_name' => __( 'Interview Topic', 'joshbaltzell' ),
			'search_items'  => __( 'Search Topics', 'joshbaltzell' ),
			'all_items'     => __( 'All Topics', 'joshbaltzell' ),
			'edit_item'     => __( 'Edit Topic', 'joshbaltzell' ),
			'update_item'   => __( 'Update Topic', 'joshbaltzell' ),
			'add_new_item'  => __( 'Add New Topic', 'joshbaltzell' ),
			'new_item_name' => __( 'New Topic Name', 'joshbaltzell' ),
			'menu_name'     => __( 'Topics', 'joshbaltzell' ),
		),
		'hierarchical'      => true,
		'public'            => true,
		'show_in_rest'      => true,
		'rewrite'           => array( 'slug' => 'topic', 'with_front' => false ),
		'show_admin_column' => true,
	) );
}
add_action( 'init', 'joshbaltzell_register_taxonomies' );

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
 * Add meta box for interview details in the classic editor sidebar.
 */
function joshbaltzell_add_interview_meta_box() {
	add_meta_box(
		'jb_interview_details',
		__( 'Interview Details', 'joshbaltzell' ),
		'joshbaltzell_interview_meta_box_html',
		'ai_interview',
		'side',
		'high'
	);
}
add_action( 'add_meta_boxes', 'joshbaltzell_add_interview_meta_box' );

function joshbaltzell_interview_meta_box_html( $post ) {
	$subtitle  = get_post_meta( $post->ID, '_interview_topic_subtitle', true );
	$read_time = get_post_meta( $post->ID, '_interview_read_time', true );
	wp_nonce_field( 'jb_interview_meta', 'jb_interview_meta_nonce' );
	?>
	<p>
		<label for="jb_subtitle"><strong><?php esc_html_e( 'Subtitle', 'joshbaltzell' ); ?></strong></label><br>
		<input type="text" id="jb_subtitle" name="jb_subtitle" value="<?php echo esc_attr( $subtitle ); ?>" class="widefat" placeholder="e.g. A deeper look at leadership">
	</p>
	<p>
		<label for="jb_read_time"><strong><?php esc_html_e( 'Read Time', 'joshbaltzell' ); ?></strong></label><br>
		<input type="text" id="jb_read_time" name="jb_read_time" value="<?php echo esc_attr( $read_time ); ?>" class="widefat" placeholder="e.g. 8 min read (auto-calculated if empty)">
	</p>
	<?php
}

function joshbaltzell_save_interview_meta( $post_id ) {
	if ( ! isset( $_POST['jb_interview_meta_nonce'] ) || ! wp_verify_nonce( $_POST['jb_interview_meta_nonce'], 'jb_interview_meta' ) ) {
		return;
	}
	if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
		return;
	}
	if ( ! current_user_can( 'edit_post', $post_id ) ) {
		return;
	}

	if ( isset( $_POST['jb_subtitle'] ) ) {
		update_post_meta( $post_id, '_interview_topic_subtitle', sanitize_text_field( $_POST['jb_subtitle'] ) );
	}
	if ( isset( $_POST['jb_read_time'] ) ) {
		$read_time = sanitize_text_field( $_POST['jb_read_time'] );
		if ( empty( $read_time ) ) {
			$read_time = joshbaltzell_reading_time( get_post_field( 'post_content', $post_id ) );
		}
		update_post_meta( $post_id, '_interview_read_time', $read_time );
	}
}
add_action( 'save_post_ai_interview', 'joshbaltzell_save_interview_meta' );

/**
 * Add WebP upload support.
 */
function joshbaltzell_mime_types( $mimes ) {
	$mimes['webp'] = 'image/webp';
	// SVG intentionally excluded — requires sanitization library to prevent XSS.
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
