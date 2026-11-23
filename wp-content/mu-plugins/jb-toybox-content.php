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
					'tunnel' => __( 'Tunnel: flying forward through Jam Tunnel', 'jb-toybox' ),
					'gyms'   => __( 'Gyms of War: distressed lettering on a beat-up box', 'jb-toybox' ),
				),
			),
		),
	);
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
					'sanitize_callback' => 'url' === $field['type'] ? 'esc_url_raw' : 'sanitize_text_field',
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

	echo '<p>' . esc_html__( 'Credit is for any post. Fill in only the other group that fits this post. The paragraph under the title is the Excerpt.', 'jb-toybox' ) . '</p>';

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
			} else {
				echo '<input class="large-text" id="' . esc_attr( $id ) . '" name="' . esc_attr( $key ) . '" type="' . esc_attr( $field['type'] ) . '" value="' . esc_attr( $value ) . '">';
			}
			echo '<p class="description">' . esc_html( $field['hint'] ) . '</p></td></tr>';
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
			$value = wp_unslash( $_POST[ $key ] ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput -- sanitized by the registered callback.
			if ( 'select' === $field['type'] && ! isset( $field['options'][ $value ] ) ) {
				$value = '';
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
