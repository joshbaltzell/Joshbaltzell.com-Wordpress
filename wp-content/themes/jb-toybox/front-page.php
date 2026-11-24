<?php
/**
 * Home: the line and what the site is for, then the newest nine of everything.
 */

get_header();

$jb_newest = get_posts(
	array(
		'post_type'           => 'post',
		'posts_per_page'      => 36,
		'ignore_sticky_posts' => true,
		'no_found_rows'       => true,
	)
);
$jb_all    = get_post_type_archive_link( 'post' );
$jb_toys   = jb_kind_by_slug( 'toys' );
$jb_about  = get_page_by_path( 'about' );

// The introduction is the front page's Excerpt when one is written, so it can be changed in the editor.
$jb_front = (int) get_option( 'page_on_front' );
$jb_intro = $jb_front && has_excerpt( $jb_front ) ? get_the_excerpt( $jb_front ) : __( 'I\'m Josh Baltzell. This is my blog, and a place where I mess around with small ideas: games and toys you can play right here, plus notes on design, code and AI. Most of them start with something clever someone else made, and I\'ll point you to it.', 'jb-toybox' );
?>
<section class="home-hero">
	<h1 class="t-shout"><?php esc_html_e( 'I like complicated problems.', 'jb-toybox' ); ?></h1>
	<div class="home-hero__intro">
		<p class="t-lead"><?php echo wp_kses_post( $jb_intro ); ?></p>
		<p class="home-hero__ways">
			<a class="link link--more" href="<?php echo esc_url( $jb_toys['url'] ); ?>"><?php esc_html_e( 'Start with a toy', 'jb-toybox' ); ?></a>
			<?php if ( $jb_about && 'publish' === $jb_about->post_status ) : ?>
			<a class="link link--more" href="<?php echo esc_url( get_permalink( $jb_about ) ); ?>"><?php esc_html_e( 'More about me', 'jb-toybox' ); ?></a>
			<?php endif; ?>
		</p>
		<?php
		$jb_social = jb_social_links();
		if ( $jb_social ) :
			?>
		<p class="t-small home-hero__elsewhere"><?php esc_html_e( 'Also on', 'jb-toybox' ); ?>
			<?php echo implode( ' &middot; ', array_map( 'jb_social_link', $jb_social ) ); // phpcs:ignore WordPress.Security.EscapeOutput -- escaped in jb_social_link(). ?>
		</p>
		<?php endif; ?>
	</div>
</section>
<div class="l-shell">
	<aside class="l-spine l-spine--sticky" aria-labelledby="in-pile">
		<h2 class="t-tag t-muted jb-spine-name" id="in-pile"><?php esc_html_e( 'In the pile', 'jb-toybox' ); ?></h2>
		<?php jb_kind_list(); ?>
	</aside>
	<section aria-labelledby="latest">
		<h2 class="sr-only" id="latest"><?php esc_html_e( 'The newest things', 'jb-toybox' ); ?></h2>
		<?php
		jb_stack(
			$jb_newest,
			array(
				'label'       => __( 'The newest things', 'jb-toybox' ),
				'seed'        => 5,
				'batch'       => 9,
				'batch_phone' => 9,
			)
		);
		?>
		<?php if ( $jb_all && untrailingslashit( $jb_all ) !== untrailingslashit( home_url() ) ) : ?>
		<p class="jb-more-line"><a class="link link--more" href="<?php echo esc_url( $jb_all ); ?>"><?php esc_html_e( 'Everything, back to the first one', 'jb-toybox' ); ?></a></p>
		<?php endif; ?>
	</section>
</div>
<?php
get_footer();
