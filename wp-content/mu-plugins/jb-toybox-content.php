<?php
/**
 * Plugin Name: JB Toybox Content
 * Description: The extra facts a post can carry (whose work it started from, a toy's link and version, a photograph's settings, a special block's rule), and the box in the editor where they are filled in.
 * Author: Josh Baltzell
 * Version: 1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The fields, grouped by the kind of post they belong to.
 *
 * @return array<string, array<string, array{label: string, hint: string, type: string}>>
 */
function jb_content_fields() {
	return array(
		__( 'Credit', 'jb-toybox' ) => array(
			'credit_name' => array(
				'label' => __( 'Started from', 'jb-toybox' ),
				'hint'  => __( 'The work or person this idea came from: Asteroids (Atari, 1979)', 'jb-toybox' ),
				'type'  => 'text',
			),
			'credit_url'  => array(
				'label' => __( 'Their address', 'jb-toybox' ),
				'hint'  => __( 'Where to find them or their work. The credit becomes a link.', 'jb-toybox' ),
				'type'  => 'url',
			),
		),
		__( 'Toy', 'jb-toybox' )    => array(
			'toy_play_url'   => array(
				'label' => __( 'Play address', 'jb-toybox' ),
				'hint'  => __( 'Where the Play button goes: the live, latest build.', 'jb-toybox' ),
				'type'  => 'url',
			),
			'toy_source_url' => array(
				'label' => __( 'Source address', 'jb-toybox' ),
				'hint'  => __( 'Where the code lives.', 'jb-toybox' ),
				'type'  => 'url',
			),
			'toy_version'    => array(
				'label' => __( 'Version', 'jb-toybox' ),
				'hint'  => __( 'For example 1.2', 'jb-toybox' ),
				'type'  => 'text',
			),
			'toy_type'       => array(
				'label' => __( 'Type', 'jb-toybox' ),
				'hint'  => __( 'Toy (you play with it; there is no losing) or Game (it has a goal). Shown on its block and on its page.', 'jb-toybox' ),
				'type'  => 'text',
			),
			'toy_plays_on'   => array(
				'label' => __( 'Plays on', 'jb-toybox' ),
				'hint'  => __( 'For example: Keyboard, or one thumb', 'jb-toybox' ),
				'type'  => 'text',
			),
			'toy_controls'   => array(
				'label' => __( 'Controls', 'jb-toybox' ),
				'hint'  => __( 'Put keys in square brackets: [←] [→] aim · [Space] shoot', 'jb-toybox' ),
				'type'  => 'text',
			),
		),
		__( 'Photo', 'jb-toybox' )  => array(
			'photo_line'   => array(
				'label' => __( 'Settings line', 'jb-toybox' ),
				'hint'  => __( 'Shown under a single photograph in the grid: 35mm · f/8 · 1/500 s', 'jb-toybox' ),
				'type'  => 'text',
			),
			'photo_camera' => array(
				'label' => __( 'Camera', 'jb-toybox' ),
				'hint'  => __( 'For example: 35mm and 90mm, available light', 'jb-toybox' ),
				'type'  => 'text',
			),
		),
		__( 'Stack', 'jb-toybox' )  => array(
			'rule' => array(
				'label'   => __( 'Special block', 'jb-toybox' ),
				'hint'    => __( 'Gives this post\'s block its own animation and light in the stack. At most two in view.', 'jb-toybox' ),
				'type'    => 'select',
				'options' => array(
					''     => __( 'None', 'jb-toybox' ),
					'sun'  => __( 'Sun: warm light', 'jb-toybox' ),
					'hole' => __( 'Black hole: dark light, a pull, orbiting stars', 'jb-toybox' ),
					'pond'   => __( 'Pond: the Pond Chorus frog croaks', 'jb-toybox' ),
					'microbes' => __( 'Microbes: Look Alive\'s cells crawl the rim and wander to other blocks (keeps the cover)', 'jb-toybox' ),
				),
			),
		),
		__( 'Block design', 'jb-toybox' ) => array(
			'cover_kind'     => array(
				'label'   => __( 'Cover', 'jb-toybox' ),
				'hint'    => __( 'What fills the top of this post\'s block. The featured image is always the still picture, shown before anything loads and whenever motion is off.', 'jb-toybox' ),
				'type'    => 'select',
				'options' => array(
					''      => __( 'Featured image', 'jb-toybox' ),
					'video' => __( 'Looping video', 'jb-toybox' ),
					'live'  => __( 'Live cover (code)', 'jb-toybox' ),
				),
			),
			'cover_video'    => array(
				'label' => __( 'Video', 'jb-toybox' ),
				'hint'  => __( 'A short, silent MP4 or WebM. It loops with no sound, and only plays while the block is on screen.', 'jb-toybox' ),
				'type'  => 'media',
				'media' => 'video',
			),
			'cover_live'     => array(
				'label' => __( 'Live cover code', 'jb-toybox' ),
				'hint'  => __( 'A small HTML page (HTML, CSS and a script) that draws the cover. It runs sealed off from the site, cannot be clicked, and is stopped when motion is paused or off screen. It may listen for a message {jb: "pause"} or {jb: "play"}. Administrators only.', 'jb-toybox' ),
				'type'  => 'code',
			),
			'look_face'      => array(
				'label' => __( 'Face color', 'jb-toybox' ),
				'hint'  => __( 'The block\'s own color. The box walls are worked out from it. Leave empty for the color of its kind.', 'jb-toybox' ),
				'type'  => 'color',
			),
			'look_text'      => array(
				'label' => __( 'Text color', 'jb-toybox' ),
				'hint'  => __( 'For the kind and date line. Check it reads well on the face color.', 'jb-toybox' ),
				'type'  => 'color',
			),
			'look_title'     => array(
				'label' => __( 'Title color', 'jb-toybox' ),
				'hint'  => __( 'Leave empty to match the text color.', 'jb-toybox' ),
				'type'  => 'color',
			),
			'look_font'      => array(
				'label'   => __( 'Title typeface', 'jb-toybox' ),
				'hint'    => __( 'Custom file: upload a WOFF2 font to the Media Library and choose it below.', 'jb-toybox' ),
				'type'    => 'select',
				'options' => array(
					''        => __( 'Site display face', 'jb-toybox' ),
					'mono'    => __( 'Mono', 'jb-toybox' ),
					'text'    => __( 'Reading face', 'jb-toybox' ),
					'dirt'    => __( 'Distressed (Rubik Dirt)', 'jb-toybox' ),
					'custom'  => __( 'Custom file', 'jb-toybox' ),
				),
			),
			'look_font_file' => array(
				'label' => __( 'Custom typeface', 'jb-toybox' ),
				'hint'  => __( 'A WOFF2 or WOFF file from the Media Library. Used when the typeface above is Custom file.', 'jb-toybox' ),
				'type'  => 'media',
				'media' => 'application',
			),
			'look_case'      => array(
				'label'   => __( 'Title case', 'jb-toybox' ),
				'hint'    => '',
				'type'    => 'select',
				'options' => array(
					''      => __( 'As written', 'jb-toybox' ),
					'upper' => __( 'Capitals', 'jb-toybox' ),
				),
			),
			'look_wear'      => array(
				'label'   => __( 'Wear', 'jb-toybox' ),
				'hint'    => '',
				'type'    => 'select',
				'options' => array(
					''     => __( 'New', 'jb-toybox' ),
					'worn' => __( 'Knocked about: scratches, scuffs and uneven corners', 'jb-toybox' ),
				),
			),
			'look_css'       => array(
				'label' => __( 'Custom CSS', 'jb-toybox' ),
				'hint'  => __( 'For anything the options above cannot do. Write & for this block, for example: & .det { letter-spacing: .05em } — it only ever applies to this post\'s block. Administrators only.', 'jb-toybox' ),
				'type'  => 'code',
			),
		),
	);
}

/**
 * How each kind of field is cleaned before it is saved.
 *
 * Code fields (live covers and custom CSS) are kept as written, but only for people allowed to post
 * unfiltered HTML, which on a single site means administrators. Anyone else saving one clears it.
 *
 * @param string $type Field type.
 * @return callable
 */
function jb_content_sanitizer( $type ) {
	switch ( $type ) {
		case 'url':
		case 'media':
			return 'esc_url_raw';
		case 'color':
			return function ( $v ) {
				return (string) sanitize_hex_color( $v );
			};
		case 'code':
			return function ( $v ) {
				return current_user_can( 'unfiltered_html' ) ? (string) $v : '';
			};
		default:
			return 'sanitize_text_field';
	}
}

/**
 * Register each field as post meta so it is saved, sanitized and available to the editor.
 */
function jb_content_register_meta() {
	foreach ( jb_content_fields() as $fields ) {
		foreach ( $fields as $key => $field ) {
			register_post_meta(
				'post',
				$key,
				array(
					'type'              => 'string',
					'description'       => $field['hint'],
					'single'            => true,
					'show_in_rest'      => true,
					'sanitize_callback' => jb_content_sanitizer( $field['type'] ),
					'auth_callback'     => function () {
						return current_user_can( 'edit_posts' );
					},
				)
			);
		}
	}
}
add_action( 'init', 'jb_content_register_meta' );

/**
 * Add the "Post details" box to the post editor.
 */
function jb_content_add_meta_box() {
	add_meta_box( 'jb-content', __( 'Post details', 'jb-toybox' ), 'jb_content_render_meta_box', 'post', 'normal', 'default' );
}
add_action( 'add_meta_boxes', 'jb_content_add_meta_box' );

/**
 * Draw the box: one group of fields for each kind that has any.
 *
 * @param WP_Post $post The post being edited.
 */
function jb_content_render_meta_box( $post ) {
	wp_nonce_field( 'jb_content_save', 'jb_content_nonce' );

	echo '<p>' . esc_html__( 'Credit and Block design are for any post. Fill in only the other group that fits this post. The paragraph under the title is the Excerpt.', 'jb-toybox' ) . '</p>';

	foreach ( jb_content_fields() as $group => $fields ) {
		echo '<h4 style="margin:1.25em 0 .25em">' . esc_html( $group ) . '</h4>';
		echo '<table class="form-table" role="presentation" style="margin-top:0"><tbody>';
		foreach ( $fields as $key => $field ) {
			$value = get_post_meta( $post->ID, $key, true );
			$id    = 'jb-' . $key;
			echo '<tr><th scope="row" style="padding:.5em 0;width:10em"><label for="' . esc_attr( $id ) . '">' . esc_html( $field['label'] ) . '</label></th><td style="padding:.5em 0">';
			if ( 'select' === $field['type'] ) {
				echo '<select id="' . esc_attr( $id ) . '" name="' . esc_attr( $key ) . '">';
				foreach ( $field['options'] as $option => $label ) {
					echo '<option value="' . esc_attr( $option ) . '"' . selected( $value, $option, false ) . '>' . esc_html( $label ) . '</option>';
				}
				echo '</select>';
			} elseif ( 'color' === $field['type'] ) {
				// A text box holds the value so it can be left empty; the swatch beside it picks one.
				echo '<input class="jb-color" id="' . esc_attr( $id ) . '" name="' . esc_attr( $key ) . '" type="text" value="' . esc_attr( $value ) . '" placeholder="#rrggbb" size="9" pattern="#[0-9a-fA-F]{6}"> ';
				echo '<input type="color" class="jb-color-pick" data-for="' . esc_attr( $id ) . '" value="' . esc_attr( $value ? $value : '#7d8d39' ) . '" aria-label="' . esc_attr( $field['label'] ) . '"> ';
				echo '<button type="button" class="button-link jb-color-clear" data-for="' . esc_attr( $id ) . '">' . esc_html__( 'Clear', 'jb-toybox' ) . '</button>';
			} elseif ( 'media' === $field['type'] ) {
				echo '<input class="regular-text" id="' . esc_attr( $id ) . '" name="' . esc_attr( $key ) . '" type="url" value="' . esc_attr( $value ) . '"> ';
				echo '<button type="button" class="button jb-media" data-for="' . esc_attr( $id ) . '" data-type="' . esc_attr( $field['media'] ) . '">' . esc_html__( 'Choose from Media Library', 'jb-toybox' ) . '</button>';
			} elseif ( 'code' === $field['type'] ) {
				$locked = ! current_user_can( 'unfiltered_html' );
				echo '<textarea class="large-text code" id="' . esc_attr( $id ) . '" name="' . esc_attr( $key ) . '" rows="8" spellcheck="false"' . ( $locked ? ' readonly' : '' ) . '>' . esc_textarea( $value ) . '</textarea>';
			} else {
				echo '<input class="large-text" id="' . esc_attr( $id ) . '" name="' . esc_attr( $key ) . '" type="' . esc_attr( $field['type'] ) . '" value="' . esc_attr( $value ) . '">';
			}
			if ( $field['hint'] ) {
				echo '<p class="description">' . esc_html( $field['hint'] ) . '</p>';
			}
			echo '</td></tr>';
		}
		echo '</tbody></table>';
	}
}

/**
 * Save the box. An emptied field is removed, not stored as an empty string.
 *
 * @param int $post_id The post being saved.
 */
function jb_content_save_meta_box( $post_id ) {
	if ( ! isset( $_POST['jb_content_nonce'] ) || ! wp_verify_nonce( sanitize_key( $_POST['jb_content_nonce'] ), 'jb_content_save' ) ) {
		return;
	}
	if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
		return;
	}
	if ( ! current_user_can( 'edit_post', $post_id ) ) {
		return;
	}

	foreach ( jb_content_fields() as $fields ) {
		foreach ( $fields as $key => $field ) {
			if ( ! isset( $_POST[ $key ] ) ) {
				continue;
			}
			if ( 'code' === $field['type'] && ! current_user_can( 'unfiltered_html' ) ) {
				continue;
			}
			$value = wp_unslash( $_POST[ $key ] ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput -- sanitized by the registered callback.
			if ( 'select' === $field['type'] && ! isset( $field['options'][ $value ] ) ) {
				$value = '';
			}
			if ( 'code' !== $field['type'] && 'select' !== $field['type'] ) {
				$value = call_user_func( jb_content_sanitizer( $field['type'] ), $value );
			}
			if ( '' === trim( (string) $value ) ) {
				delete_post_meta( $post_id, $key );
			} else {
				update_post_meta( $post_id, $key, $value );
			}
		}
	}
}
add_action( 'save_post_post', 'jb_content_save_meta_box' );

/**
 * The Media Library picker and colour swatches for the box.
 *
 * @param string $hook The admin page being loaded.
 */
function jb_content_admin_assets( $hook ) {
	if ( ! in_array( $hook, array( 'post.php', 'post-new.php' ), true ) ) {
		return;
	}
	wp_enqueue_media();
	wp_add_inline_script(
		'media-editor',
		"(function(){document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('.jb-media');if(b){e.preventDefault();var f=wp.media({title:b.textContent,library:{type:b.getAttribute('data-type')},multiple:false});f.on('select',function(){var a=f.state().get('selection').first().toJSON();document.getElementById(b.getAttribute('data-for')).value=a.url;});f.open();return;}var c=e.target.closest&&e.target.closest('.jb-color-clear');if(c){e.preventDefault();document.getElementById(c.getAttribute('data-for')).value='';}});document.addEventListener('input',function(e){if(e.target.classList&&e.target.classList.contains('jb-color-pick')){document.getElementById(e.target.getAttribute('data-for')).value=e.target.value;}});})();"
	);
}
add_action( 'admin_enqueue_scripts', 'jb_content_admin_assets' );

/**
 * Let administrators upload font files for custom typefaces. WordPress refuses them by default.
 *
 * @param array $types Allowed upload types.
 * @return array
 */
function jb_content_font_uploads( $types ) {
	if ( current_user_can( 'unfiltered_html' ) ) {
		$types['woff2'] = 'font/woff2';
		$types['woff']  = 'font/woff';
	}
	return $types;
}
add_filter( 'upload_mimes', 'jb_content_font_uploads' );

/**
 * WordPress checks a file's real type as well as its name; font files often report a generic type.
 *
 * @param array  $data     What WordPress worked out.
 * @param string $file     Path to the file.
 * @param string $filename The file's name.
 * @return array
 */
function jb_content_font_filetype( $data, $file, $filename ) {
	$ext = strtolower( pathinfo( $filename, PATHINFO_EXTENSION ) );
	if ( in_array( $ext, array( 'woff2', 'woff' ), true ) && current_user_can( 'unfiltered_html' ) ) {
		$data['ext']  = $ext;
		$data['type'] = 'font/' . $ext;
	}
	return $data;
}
add_filter( 'wp_check_filetype_and_ext', 'jb_content_font_filetype', 10, 3 );
