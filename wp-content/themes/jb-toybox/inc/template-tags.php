<?php
/**
 * Pieces of markup the templates share. Each one outputs the design system's
 * markup for a component, so the site stylesheet applies unchanged.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Turn "[Space] shoot" into a drawn key followed by the words.
 *
 * Braces work too ("{Space} shoot"), for use inside a shortcode, where square
 * brackets would end the shortcode early.
 *
 * @param string $text Plain text with keys in square brackets or braces.
 * @return string Escaped HTML.
 */
function jb_keys( $text ) {
	return preg_replace( '/[\[{]([^\]}]+)[\]}]/', '<kbd class="kbd">$1</kbd>', esc_html( $text ) );
}

/**
 * "6 minutes", from the word count.
 *
 * @param int|WP_Post|null $post Post, or the current one.
 * @return string
 */
function jb_reading_time( $post = null ) {
	$words   = str_word_count( wp_strip_all_tags( get_post_field( 'post_content', get_post( $post ) ) ) );
	$minutes = max( 1, (int) round( $words / 230 ) );
	/* translators: %s: number of minutes. */
	return sprintf( _n( '%s minute', '%s minutes', $minutes, 'jb-toybox' ), number_format_i18n( $minutes ) );
}

/**
 * How many pictures a post's body holds. More than one makes a photo post a set.
 *
 * @param int|WP_Post|null $post Post, or the current one.
 * @return int
 */
function jb_picture_count( $post = null ) {
	return substr_count( get_post_field( 'post_content', get_post( $post ) ), '<img ' );
}

/**
 * The paragraph under a title. Only a hand-written excerpt is used.
 */
function jb_lead() {
	if ( has_excerpt() ) {
		echo '<p class="t-lead">' . wp_kses_post( get_the_excerpt() ) . '</p>';
	}
}

/**
 * One article as a block: the post card and the toy card.
 *
 * The block is a box, not a link: the main link covers the cover and the words, and a second, smaller link
 * (Play) sits over the cover, so the two never nest. The peek (the one-line pitch and Play) shows on hover
 * and keyboard focus; on a touch screen only the Play corner shows.
 *
 * @param WP_Post    $post      The post.
 * @param bool       $toy_types Unused; kept so existing calls still work.
 * @param float|null $age       0 for the newest in a list, 1 for the oldest. Older blocks sit further back.
 */
function jb_card( $post, $toy_types = false, $age = null ) {
	$kind  = jb_kind( $post );
	$label = $kind['singular'];
	$type  = '';
	// A post in Toys says whether it is a toy or a game, wherever its block appears.
	if ( 'toy' === $kind['kind'] ) {
		$type  = get_post_meta( $post->ID, 'toy_type', true );
		$label = $type ? $type : $label;
	}

	// A rule gives the block one of the built-in animated covers (data-rule).
	$rule  = get_post_meta( $post->ID, 'rule', true );
	$cover = get_the_post_thumbnail_url( $post, 'jb-cover' );
	$play  = 'toy' === $kind['kind'] ? get_post_meta( $post->ID, 'toy_play_url', true ) : '';
	$pitch = has_excerpt( $post ) ? get_the_excerpt( $post ) : '';
	$tags  = wp_list_pluck( (array) get_the_tags( $post->ID ), 'slug' );

	$design = jb_block_design( $post );

	$attrs  = ' data-post="' . esc_attr( $post->ID ) . '" data-kind="' . esc_attr( $kind['kind'] ) . '"';
	$attrs .= $tags ? ' data-tags="' . esc_attr( implode( ' ', $tags ) ) . '"' : '';
	$attrs .= $rule ? ' data-rule="' . esc_attr( $rule ) . '"' : '';
	$attrs .= $design['font'] ? ' data-font="' . esc_attr( $design['font'] ) . '"' : '';
	$style  = $design['vars'];
	if ( null !== $age ) {
		$style .= '--age:' . number_format( (float) $age, 3, '.', '' ) . ';';
	}
	$attrs .= $style ? ' style="' . esc_attr( $style ) . '"' : '';
	?>
<div class="blk<?php echo $design['class'] ? ' ' . esc_attr( $design['class'] ) : ''; ?>"<?php echo $attrs; // phpcs:ignore WordPress.Security.EscapeOutput -- escaped above. ?>>
	<?php echo $design['style']; // phpcs:ignore WordPress.Security.EscapeOutput -- built by jb_block_design(). ?>
	<a class="blk__link" href="<?php echo esc_url( get_permalink( $post ) ); ?>">
		<span class="cov<?php echo 'toy' === $kind['kind'] ? ' cov--night' : ''; ?>"><?php if ( $cover ) : ?><img src="<?php echo esc_url( $cover ); ?>" alt="" width="480" height="270" loading="lazy"><?php endif; ?><?php echo $design['cover']; // phpcs:ignore WordPress.Security.EscapeOutput -- built by jb_block_design(). ?></span>
		<span class="det"><span class="det__title"><?php echo esc_html( get_the_title( $post ) ); ?></span><span class="det__meta"><span><?php echo esc_html( $label ); ?></span><time datetime="<?php echo esc_attr( get_the_date( 'Y-m', $post ) ); ?>"><?php echo esc_html( get_the_date( 'M Y', $post ) ); ?></time></span></span>
	</a>
	<?php if ( $pitch || $play ) : ?>
	<span class="blk__peek">
		<?php if ( $pitch ) : ?><span class="blk__pitch"><?php echo esc_html( wp_trim_words( $pitch, 22 ) ); ?></span><?php endif; ?>
		<?php if ( $play ) : ?><a class="btn btn--small btn--primary blk__play" href="<?php echo esc_url( $play ); ?>"><?php esc_html_e( 'Play', 'jb-toybox' ); ?><span class="sr-only"> <?php echo esc_html( get_the_title( $post ) ); ?></span></a><?php endif; ?>
	</span>
	<?php endif; ?>
</div>
	<?php
}

/**
 * A block's own design, from the Block design fields on its post.
 *
 * Everything here is set in WordPress, per post, so a new design never needs a theme change. The returned
 * pieces are already escaped: a class list, CSS custom properties for the style attribute, a data-font value,
 * the extra cover markup (a video or a sealed live cover), and a <style> scoped to this post's block.
 *
 * @param WP_Post $post The post.
 * @return array{class: string, vars: string, font: string, cover: string, style: string}
 */
function jb_block_design( $post ) {
	static $seen = array();
	$m = function ( $key ) use ( $post ) {
		return (string) get_post_meta( $post->ID, $key, true );
	};
	$out   = array( 'class' => '', 'vars' => '', 'font' => '', 'cover' => '', 'style' => '' );
	$class = array();

	foreach ( array( 'look_face' => '--c', 'look_text' => '--on', 'look_title' => '--title-color' ) as $key => $var ) {
		$color = sanitize_hex_color( $m( $key ) );
		if ( $color ) {
			$out['vars'] .= $var . ':' . $color . ';';
		}
	}
	if ( 'upper' === $m( 'look_case' ) ) {
		$class[] = 'blk--upper';
	}
	if ( 'worn' === $m( 'look_wear' ) ) {
		$class[] = 'blk--worn';
	}

	$css  = '';
	$font = $m( 'look_font' );
	$file = esc_url_raw( $m( 'look_font_file' ) );
	if ( 'custom' === $font && $file ) {
		$family = 'jb-font-' . $post->ID;
		$css   .= '@font-face{font-family:"' . $family . '";src:url("' . esc_url_raw( $file ) . '");font-display:swap}';
		$out['vars'] .= '--title-font:"' . $family . '",var(--font-display);';
		$out['font']  = 'custom';
	} elseif ( in_array( $font, array( 'mono', 'text', 'dirt' ), true ) ) {
		$out['font'] = $font;
	}

	// Custom CSS: & stands for this post's block. It cannot break out of its <style> element.
	$own = $m( 'look_css' );
	if ( '' !== trim( $own ) ) {
		$css .= str_replace( '&', '.blk[data-post="' . $post->ID . '"]', str_ireplace( '</', '', $own ) );
	}
	// The same post can appear twice on a page (the pile and a card grid); its style is written once.
	if ( $css && empty( $seen[ $post->ID ] ) ) {
		$seen[ $post->ID ] = true;
		$out['style']      = '<style>' . $css . '</style>';
	}

	$kind = $m( 'cover_kind' );
	if ( 'video' === $kind && $m( 'cover_video' ) ) {
		$out['cover'] = '<video class="cov__media" muted loop playsinline preload="none" aria-hidden="true" data-src="' . esc_url( $m( 'cover_video' ) ) . '"></video>';
		$class[]      = 'blk--moving';
	} elseif ( 'live' === $kind && '' !== trim( $m( 'cover_live' ) ) ) {
		// sandbox="allow-scripts" without allow-same-origin: the code runs, but cannot reach the site, its cookies or its pages.
		$out['cover'] = '<iframe class="cov__media" sandbox="allow-scripts" tabindex="-1" aria-hidden="true" title="" data-srcdoc="' . esc_attr( $m( 'cover_live' ) ) . '"></iframe>';
		$class[]      = 'blk--moving';
	}
	if ( 'layers' === $kind ) {
		// A layered picture: each line is "address depth [left top height]", back to front. site.js sets --look-x
		// and --look-y on the block, stack.js sets --lean on the rack, and each layer moves by its depth.
		$layers = '';
		foreach ( preg_split( '/\R/', $m( 'cover_layers' ) ) as $line ) {
			$bits = preg_split( '/\s+/', trim( $line ) );
			$src  = isset( $bits[0] ) ? esc_url( $bits[0] ) : '';
			if ( '' === $src ) {
				continue;
			}
			$z     = isset( $bits[1] ) ? max( 0, min( 1, (float) $bits[1] ) ) : 0;
			$style = '--z:' . round( $z, 3 );
			$place = array_slice( $bits, 2, 3 );
			if ( 3 === count( $place ) && count( array_filter( $place, 'is_numeric' ) ) === 3 ) {
				$style .= ';left:' . (float) $place[0] . '%;top:' . (float) $place[1] . '%;height:' . (float) $place[2] . '%';
				$class_name = 'cov__layer';
			} else {
				$class_name = 'cov__layer cov__layer--fill';
			}
			$layers .= '<img class="' . $class_name . '" src="' . $src . '" alt="" decoding="async" loading="lazy" style="' . esc_attr( $style ) . '">';
		}
		if ( $layers ) {
			$out['cover'] = '<span class="cov__layers" aria-hidden="true">' . $layers . '</span>';
			$class[]      = 'blk--layered';
		}
	}

	$out['class'] = implode( ' ', $class );
	return $out;
}

/**
 * The stack: blocks in a well, newest on top.
 *
 * @param WP_Post[] $posts Posts, newest first.
 * @param array     $args  {
 *     @type string $label      Accessible name of the list.
 *     @type int    $seed       Which drop. The same number always lands the same way.
 *     @type bool   $toy_types  Passed to jb_card().
 *     @type string $empty      What will land here, for the empty state.
 *     @type int    $batch      How many show at first, and how many each press of More adds.
 *     @type int    $batch_phone The same, on a narrow screen.
 * }
 */
function jb_stack( $posts, $args = array() ) {
	$args = wp_parse_args(
		$args,
		array(
			'label'     => __( 'Posts', 'jb-toybox' ),
			'seed'      => 3,
			'toy_types'   => false,
			'empty'       => __( 'When there is something, it will fall in from the top.', 'jb-toybox' ),
			'batch'       => 12,
			'batch_phone' => 9,
		)
	);

	if ( ! $posts ) {
		?>
<section class="rack"><div class="floor"></div><div class="shaft"><span class="rail rail--l"></span><div class="well well--empty"><div class="empty"><h2 class="t-heading"><?php esc_html_e( 'Nothing has landed here yet.', 'jb-toybox' ); ?></h2><p class="t-lead"><?php echo esc_html( $args['empty'] ); ?></p><a class="btn" href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php esc_html_e( 'See everything else', 'jb-toybox' ); ?></a></div></div><span class="rail rail--r"></span></div></section>
		<?php
		return;
	}

	wp_enqueue_script( 'jb-stack' );
	$last = max( 1, count( $posts ) - 1 );
	?>
<div class="rack__bar">
	<span class="t-readout" data-stack-status role="status"></span>
	<span class="l-row">
		<span class="rack__view" role="group" aria-label="<?php esc_attr_e( 'View', 'jb-toybox' ); ?>" data-stack-views hidden><button class="btn btn--small" type="button" data-stack-view="pile" aria-pressed="true"><?php esc_html_e( 'Pile', 'jb-toybox' ); ?></button><button class="btn btn--small" type="button" data-stack-view="shelf" aria-pressed="false"><?php esc_html_e( 'Shelf', 'jb-toybox' ); ?></button></span>
		<button class="btn btn--small" type="button" data-stack-tidy hidden><?php esc_html_e( 'Tidy up', 'jb-toybox' ); ?></button>
		<button class="btn btn--small" type="button" data-stack-shake hidden><?php esc_html_e( 'Shake', 'jb-toybox' ); ?></button>
		<button class="btn btn--small" type="button" data-stack-motion hidden><?php esc_html_e( 'Pause motion', 'jb-toybox' ); ?></button>
		<button class="btn btn--small" type="button" data-stack-sound aria-pressed="true" hidden><?php esc_html_e( 'Sound on', 'jb-toybox' ); ?></button>
	</span>
	<?php // On a phone the buttons and the tilt handle roll up behind this, so the pile is on the first screen. ?>
	<button class="btn btn--small rack__tools" type="button" aria-expanded="false" data-stack-tools hidden><?php esc_html_e( 'Controls', 'jb-toybox' ); ?></button>
</div>
<section class="rack" data-stack data-across="2" data-seed="<?php echo esc_attr( $args['seed'] ); ?>" data-batch="<?php echo esc_attr( $args['batch'] ); ?>" data-batch-phone="<?php echo esc_attr( $args['batch_phone'] ); ?>" aria-label="<?php echo esc_attr( $args['label'] ); ?>">
	<div class="rack__machine" hidden>
		<div class="tilt" data-tilt role="slider" tabindex="0" aria-label="<?php esc_attr_e( 'Tilt the well. Hold the left or right arrow key.', 'jb-toybox' ); ?>" aria-valuemin="-1" aria-valuemax="1" aria-valuenow="0"><span class="tilt__track" aria-hidden="true"></span><span class="tilt__knob" aria-hidden="true"></span><span class="tilt__label" aria-hidden="true"><?php esc_html_e( 'Tilt', 'jb-toybox' ); ?></span></div>
	</div>
	<div class="floor"></div><?php // The pile floats up, so its floor is a ceiling above the well. ?>
	<div class="shaft"><span class="rail rail--l"></span>
		<div class="well"><ol class="pile" aria-label="<?php echo esc_attr( sprintf( /* translators: %s: name of the list. */ __( '%s, newest first', 'jb-toybox' ), $args['label'] ) ); ?>">
			<?php foreach ( array_values( $posts ) as $i => $post ) : ?>
			<li><?php jb_card( $post, $args['toy_types'], $i / $last ); ?></li>
			<?php endforeach; ?>
		</ol></div>
	<span class="rail rail--r"></span>
	<div class="lever-dock" hidden><?php // Sticks to the bottom of the screen while you scroll the well, and rests where new blocks come in. ?>
		<button class="lever" type="button" data-lever><span class="lever__slot" aria-hidden="true"><span class="lever__arm"></span></span><span class="lever__label"></span></button>
	</div>
	</div>
</section>
<p class="rack__more"><button class="btn" type="button" data-stack-more hidden></button></p>
	<?php
}

/**
 * Blocks in an even grid with no well, for "more like this" under an article.
 *
 * @param WP_Post[] $posts     Posts.
 * @param bool      $toy_types Passed to jb_card().
 */
function jb_card_grid( $posts, $toy_types = false ) {
	echo '<ul class="card-grid">';
	foreach ( $posts as $post ) {
		echo '<li>';
		jb_card( $post, $toy_types );
		echo '</li>';
	}
	echo '</ul>';
}

/**
 * "More code": up to three other posts of the same kind, topped up with the
 * newest of anything else so the row is never short.
 *
 * @param int|WP_Post|null $post Post, or the current one.
 */
function jb_more( $post = null ) {
	$post = get_post( $post );
	$kind = jb_kind( $post );
	$base = array(
		'post_type'           => 'post',
		'posts_per_page'      => 3,
		'post__not_in'        => array( $post->ID ),
		'ignore_sticky_posts' => true,
		'no_found_rows'       => true,
	);

	$posts = $kind['term'] ? get_posts( $base + array( 'cat' => $kind['term']->term_id ) ) : array();
	if ( count( $posts ) < 3 ) {
		$base['posts_per_page'] = 3 - count( $posts );
		$base['post__not_in']   = array_merge( array( $post->ID ), wp_list_pluck( $posts, 'ID' ) );
		$posts                  = array_merge( $posts, get_posts( $base ) );
	}
	if ( ! $posts ) {
		return;
	}
	?>
<section><h2 class="t-heading post-foot__name"><?php echo esc_html( sprintf( /* translators: %s: a kind of post, lower case. */ __( 'More %s', 'jb-toybox' ), mb_strtolower( $kind['plural'] ) ) ); ?></h2>
	<?php jb_card_grid( $posts, 'toy' === $kind['kind'] ); ?>
</section>
	<?php
}

/**
 * Photographs, each shown whole, in a grid that keeps every picture's shape.
 *
 * @param WP_Post[] $posts Photo posts.
 */
function jb_photo_grid( $posts ) {
	echo '<ul class="photo-grid">';
	foreach ( $posts as $post ) {
		$count = jb_picture_count( $post );
		$set   = $count > 1;
		$line  = get_post_meta( $post->ID, 'photo_line', true );
		if ( $set ) {
			/* translators: 1: number of photographs, 2: month and year. */
			$line = sprintf( __( 'Set of %1$s &middot; %2$s', 'jb-toybox' ), number_format_i18n( $count ), get_the_date( 'M Y', $post ) );
		} elseif ( ! $line ) {
			$line = get_the_date( 'M Y', $post );
		}
		$image = get_the_post_thumbnail(
			$post,
			'large',
			array(
				'class'   => 'photo__img',
				'loading' => 'lazy',
			)
		);
		?>
<li><a class="photo<?php echo $set ? ' photo--set' : ''; ?>" href="<?php echo esc_url( get_permalink( $post ) ); ?>"><?php echo $image; // phpcs:ignore WordPress.Security.EscapeOutput -- core markup. ?><span class="caption"><span class="caption__title"><?php echo esc_html( get_the_title( $post ) ); ?></span><span class="t-readout"><?php echo wp_kses( $line, array() ); ?></span></span></a></li>
		<?php
	}
	echo '</ul>';
}

/**
 * A post's topics (its tags) as chips.
 *
 * @param int|WP_Post|null $post Post, or the current one.
 * @return string HTML, or an empty string when the post has no tags.
 */
function jb_post_topics( $post = null ) {
	$tags = get_the_tags( get_post( $post )->ID );
	// "Games" and "Toys" are how the Toys list is filtered; on a post that fact is already shown as its type.
	$tags = $tags ? array_filter(
		$tags,
		function ( $tag ) {
			return ! in_array( $tag->slug, array( 'game', 'toy' ), true );
		}
	) : array();
	if ( ! $tags ) {
		return '';
	}
	$html = '<ul class="topics">';
	foreach ( $tags as $tag ) {
		$html .= '<li><a class="topic" href="' . esc_url( get_tag_link( $tag ) ) . '">' . esc_html( $tag->name ) . '</a></li>';
	}
	return $html . '</ul>';
}

/**
 * The spine of a list of one kind: a count, and the topics that narrow it.
 *
 * @param array $kind Entry from jb_kind_by_slug().
 */
function jb_list_spine( $kind ) {
	global $wp_query;
	$found   = (int) $wp_query->found_posts;
	$count   = sprintf( $found === 1 ? $kind['count'][0] : $kind['count'][1], number_format_i18n( $found ) );

	// The topics used by posts of this kind, most used first.
	$topics = array();
	if ( $kind['term'] ) {
		$ids = get_posts(
			array(
				'post_type'      => 'post',
				'cat'            => $kind['term']->term_id,
				'posts_per_page' => 200,
				'fields'         => 'ids',
				'no_found_rows'  => true,
			)
		);
		if ( $ids ) {
			$counts = array();
			foreach ( wp_get_object_terms( $ids, 'post_tag', array( 'fields' => 'all_with_object_id' ) ) as $term ) {
				$counts[ $term->slug ]['name']  = $term->name;
				$counts[ $term->slug ]['count'] = ( $counts[ $term->slug ]['count'] ?? 0 ) + 1;
			}
			uasort(
				$counts,
				function ( $a, $b ) {
					return $b['count'] <=> $a['count'];
				}
			);
			$topics = array_slice( $counts, 0, 12, true );
		}
	}

	$chosen = (string) get_query_var( 'tag' );
	// On the full list the chips filter in place (data-stack-filter). On a list the server already filtered,
	// they are ordinary links, because the other items are not on the page.
	$live   = '' === $chosen;
	?>
<aside class="l-spine l-spine--sticky" aria-label="<?php esc_attr_e( 'Narrow the list', 'jb-toybox' ); ?>">
	<p class="t-readout t-muted jb-spine-count"><?php echo wp_kses( $count, array() ); ?></p>
	<?php if ( $topics ) : ?>
	<ul class="topics">
		<li><a class="topic<?php echo '' === $chosen ? ' is-on' : ''; ?>" href="<?php echo esc_url( $kind['url'] ); ?>"<?php echo '' === $chosen ? ' aria-current="true"' : ''; ?><?php echo $live ? ' data-stack-filter=""' : ''; ?>><?php esc_html_e( 'All', 'jb-toybox' ); ?></a></li>
		<?php foreach ( $topics as $slug => $topic ) : ?>
		<li><a class="topic<?php echo $chosen === $slug ? ' is-on' : ''; ?>" href="<?php echo esc_url( add_query_arg( 'tag', $slug, $kind['url'] ) ); ?>"<?php echo $chosen === $slug ? ' aria-current="true"' : ''; ?><?php echo $live ? ' data-stack-filter="' . esc_attr( $slug ) . '"' : ''; ?>><?php echo esc_html( $topic['name'] ); ?></a></li>
		<?php endforeach; ?>
	</ul>
	<?php endif; ?>
</aside>
	<?php
}

/**
 * The five kinds as rows with a count: the way into each list, and the key to
 * the colors in the pile.
 *
 * @param string $current Category slug of the list being shown, if any.
 */
function jb_kind_list( $current = '' ) {
	echo '<ul class="kind-list">';
	foreach ( array_keys( jb_kinds() ) as $slug ) {
		$kind  = jb_kind_by_slug( $slug );
		$count = $kind['term'] ? (int) $kind['term']->count : 0;
		// A kind with nothing in it yet stays out of the list, unless it is the list being shown.
		if ( ! $count && $current !== $slug ) {
			continue;
		}
		printf(
			'<li><a href="%1$s"%2$s><span class="kind" data-kind="%3$s">%4$s</span><span class="t-readout">%5$s</span></a></li>',
			esc_url( $kind['url'] ),
			$current === $slug ? ' aria-current="page"' : '',
			esc_attr( $kind['kind'] ),
			esc_html( $kind['plural'] ),
			esc_html( number_format_i18n( $count ) )
		);
	}
	echo '</ul>';
}

/**
 * The spine of a single post: what kind of thing it is, and the facts that go
 * with that kind.
 *
 * @param array $rows Label => HTML value. Empty values are left out.
 * @param string $label Accessible name of the spine.
 */
function jb_facts( $rows, $label ) {
	?>
<aside class="l-spine l-spine--sticky" aria-label="<?php echo esc_attr( $label ); ?>">
	<dl class="facts">
		<?php
		foreach ( $rows as $name => $row ) :
			if ( '' === (string) $row['value'] ) {
				continue;
			}
			?>
		<div><dt><?php echo esc_html( $name ); ?></dt><dd<?php echo ! empty( $row['mono'] ) ? ' class="t-readout"' : ''; ?>><?php echo $row['value']; // phpcs:ignore WordPress.Security.EscapeOutput -- each value is escaped where it is built. ?></dd></div>
		<?php endforeach; ?>
	</dl>
</aside>
	<?php
}

/**
 * Whose work a post started from, as a link when there is an address.
 *
 * @param int|WP_Post|null $post Post, or the current one.
 * @return string Escaped HTML, or an empty string when no credit is given.
 */
function jb_credit( $post = null ) {
	$id   = get_post( $post )->ID;
	$name = get_post_meta( $id, 'credit_name', true );
	$url  = get_post_meta( $id, 'credit_url', true );
	if ( ! $name ) {
		return '';
	}
	return $url ? '<a class="link" href="' . esc_url( $url ) . '">' . esc_html( $name ) . '</a>' : esc_html( $name );
}

/**
 * The kind label for a post, as a link to that kind's list.
 *
 * @param array $kind Entry from jb_kind().
 * @return string
 */
function jb_kind_link( $kind ) {
	return sprintf( '<a class="kind" data-kind="%1$s" href="%2$s">%3$s</a>', esc_attr( $kind['kind'] ), esc_url( $kind['url'] ), esc_html( $kind['singular'] ) );
}

/**
 * The kind line for a toy post: "Game" or "Toy", linking to that filter on the Toys list. Falls back to the plain
 * kind link when no type is set.
 *
 * @param array  $kind Entry from jb_kind_by_slug().
 * @param string $type The post's toy_type (Game or Toy).
 * @return string
 */
function jb_toy_type_link( $kind, $type ) {
	$type = trim( (string) $type );
	if ( '' === $type ) {
		return jb_kind_link( $kind );
	}
	$url = add_query_arg( 'tag', sanitize_title( $type ), $kind['url'] );
	return sprintf( '<a class="kind" data-kind="%1$s" href="%2$s">%3$s</a>', esc_attr( $kind['kind'] ), esc_url( $url ), esc_html( $type ) );
}

/**
 * A date in the spine: "18 Nov 2026".
 *
 * @param string $format Date format for the words.
 * @return string
 */
function jb_time( $format = 'j M Y' ) {
	return sprintf( '<time datetime="%1$s">%2$s</time>', esc_attr( get_the_date( 'Y-m-d' ) ), esc_html( get_the_date( $format ) ) );
}

/**
 * One comment, in the design system's markup. The closing </li> is left to WordPress.
 *
 * @param WP_Comment $comment The comment.
 * @param array      $args    Arguments from wp_list_comments().
 * @param int        $depth   Depth of the comment.
 */
function jb_comment( $comment, $args, $depth ) {
	$by_author = $comment->user_id && (int) $comment->user_id === (int) get_post_field( 'post_author', $comment->comment_post_ID );
	?>
<li id="comment-<?php comment_ID(); ?>" class="comment">
	<div class="comment__by"><span class="comment__name"><?php echo esc_html( get_comment_author( $comment ) ); ?></span><?php if ( $by_author ) : ?><span class="t-tag"><?php esc_html_e( 'Author', 'jb-toybox' ); ?></span><?php endif; ?><time class="t-tag" datetime="<?php echo esc_attr( get_comment_date( 'Y-m-d', $comment ) ); ?>"><?php echo esc_html( get_comment_date( 'j M Y', $comment ) ); ?></time></div>
	<?php if ( '0' === $comment->comment_approved ) : ?>
	<p class="t-small t-muted"><?php esc_html_e( 'Your comment is waiting to be approved.', 'jb-toybox' ); ?></p>
	<?php endif; ?>
	<div class="comment__text"><?php comment_text(); ?></div>
	<?php
	comment_reply_link(
		array_merge(
			$args,
			array(
				'depth'     => $depth,
				'max_depth' => $args['max_depth'],
				'before'    => '<p class="comment__reply">',
				'after'     => '</p>',
			)
		)
	);
}
