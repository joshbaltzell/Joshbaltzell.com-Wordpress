<?php
/**
 * Where else to find Josh: X, Instagram and LinkedIn. The addresses are set in Settings → General and show in the
 * footer, under the home page introduction and at the end of the About page. A network with no address is left out.
 *
 * @package jb-toybox
 */

/**
 * The networks, in the order they show.
 *
 * @return array<string, string> Option name => label.
 */
function jb_social_networks() {
	return array(
		'jb_link_x'         => __( 'X', 'jb-toybox' ),
		'jb_link_instagram' => __( 'Instagram', 'jb-toybox' ),
		'jb_link_linkedin'  => __( 'LinkedIn', 'jb-toybox' ),
	);
}

/**
 * The profiles that have an address.
 *
 * @return array<int, array{label: string, url: string}>
 */
function jb_social_links() {
	$out = array();
	foreach ( jb_social_networks() as $option => $label ) {
		$url = esc_url( (string) get_option( $option, '' ) );
		if ( '' !== $url ) {
			$out[] = array(
				'label' => $label,
				'url'   => $url,
			);
		}
	}
	return $out;
}

/**
 * One link. rel="me" says the profile belongs to the same person as this site.
 *
 * @param array $link From jb_social_links().
 * @param string $class Class for the link.
 * @return string
 */
function jb_social_link( $link, $class = 'link' ) {
	return '<a class="' . esc_attr( $class ) . '" href="' . esc_url( $link['url'] ) . '" rel="me">' . esc_html( $link['label'] ) . '</a>';
}

/**
 * The three address fields on Settings → General.
 */
function jb_social_settings() {
	foreach ( jb_social_networks() as $option => $label ) {
		register_setting(
			'general',
			$option,
			array(
				'type'              => 'string',
				'sanitize_callback' => 'esc_url_raw',
				'default'           => '',
			)
		);
		add_settings_field(
			$option,
			/* translators: %s: a social network, such as LinkedIn. */
			sprintf( __( '%s profile', 'jb-toybox' ), $label ),
			function () use ( $option ) {
				printf( '<input type="url" class="regular-text code" name="%1$s" id="%1$s" value="%2$s" placeholder="https://">', esc_attr( $option ), esc_attr( get_option( $option, '' ) ) );
			},
			'general'
		);
	}
}
add_action( 'admin_init', 'jb_social_settings' );

/**
 * The About page ends with the same links.
 *
 * @param string $content The page's content.
 * @return string
 */
function jb_social_on_about( $content ) {
	if ( ! is_page( 'about' ) || ! in_the_loop() || ! is_main_query() ) {
		return $content;
	}
	$links = jb_social_links();
	if ( ! $links ) {
		return $content;
	}
	$items = '';
	foreach ( $links as $link ) {
		$items .= '<li>' . jb_social_link( $link ) . '</li>';
	}
	return $content . '<h2>' . esc_html__( 'Find me elsewhere', 'jb-toybox' ) . '</h2><ul class="jb-elsewhere">' . $items . '</ul>';
}
add_filter( 'the_content', 'jb_social_on_about', 20 );
