<?php
/**
 * The five kinds of thing on the site.
 *
 * Each kind is a category. The array key is the category slug; "kind" is the
 * value the stylesheet reads from data-kind to pick the face color.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The kinds, in the order they appear in navigation.
 *
 * @return array<string, array{kind: string, singular: string, plural: string, count: string[], lead: string}>
 */
function jb_kinds() {
	return array(
		'toys'    => array(
			'kind'     => 'toy',
			'singular' => __( 'Toy', 'jb-toybox' ),
			'plural'   => __( 'Toys', 'jb-toybox' ),
			'count'    => array( __( '%s toy', 'jb-toybox' ), __( '%s toys', 'jb-toybox' ) ),
			'lead'     => __( 'Small games and working models. Each one runs in the browser, and most take under a minute to learn.', 'jb-toybox' ),
		),
		'code'    => array(
			'kind'     => 'code',
			'singular' => __( 'Code', 'jb-toybox' ),
			'plural'   => __( 'Code', 'jb-toybox' ),
			'count'    => array( __( '%s post', 'jb-toybox' ), __( '%s posts', 'jb-toybox' ) ),
			'lead'     => __( 'How the things on this site are built, with the parts you can take.', 'jb-toybox' ),
		),
		'design'  => array(
			'kind'     => 'design',
			'singular' => __( 'Design', 'jb-toybox' ),
			'plural'   => __( 'Design', 'jb-toybox' ),
			'count'    => array( __( '%s post', 'jb-toybox' ), __( '%s posts', 'jb-toybox' ) ),
			'lead'     => __( 'Why things look the way they do, and whose idea it was first.', 'jb-toybox' ),
		),
		'writing' => array(
			'kind'     => 'writing',
			'singular' => __( 'Writing', 'jb-toybox' ),
			'plural'   => __( 'Writing', 'jb-toybox' ),
			'count'    => array( __( '%s post', 'jb-toybox' ), __( '%s posts', 'jb-toybox' ) ),
			'lead'     => __( 'Longer pieces, mostly about how something works.', 'jb-toybox' ),
		),
		'photos'  => array(
			'kind'     => 'photo',
			'singular' => __( 'Photo', 'jb-toybox' ),
			'plural'   => __( 'Photos', 'jb-toybox' ),
			'count'    => array( __( '%s photograph', 'jb-toybox' ), __( '%s photographs', 'jb-toybox' ) ),
			'lead'     => __( 'Shown whole, at the shape they were taken.', 'jb-toybox' ),
		),
	);
}

/**
 * Which kind a post is: the first of its categories that is one of the five.
 *
 * A post with none of them reads as writing, so nothing is ever without a face.
 *
 * @param int|WP_Post|null $post Post, or the current one.
 * @return string Category slug of the kind.
 */
function jb_kind_slug( $post = null ) {
	$kinds = jb_kinds();
	foreach ( (array) get_the_category( get_post( $post )->ID ) as $category ) {
		if ( isset( $kinds[ $category->slug ] ) ) {
			return $category->slug;
		}
	}
	return 'writing';
}

/**
 * The kind's entry for a post.
 *
 * @param int|WP_Post|null $post Post, or the current one.
 * @return array Entry from jb_kinds(), with "slug" and "url" added.
 */
function jb_kind( $post = null ) {
	$slug = jb_kind_slug( $post );
	return jb_kind_by_slug( $slug );
}

/**
 * A kind's entry by its category slug, with "slug" and "url" added.
 *
 * @param string $slug Category slug.
 * @return array
 */
function jb_kind_by_slug( $slug ) {
	$kinds        = jb_kinds();
	$entry        = $kinds[ $slug ];
	$entry['slug'] = $slug;
	$term         = get_category_by_slug( $slug );
	$entry['url']  = $term ? get_category_link( $term ) : home_url( '/' );
	$entry['term'] = $term ? $term : null;
	return $entry;
}
