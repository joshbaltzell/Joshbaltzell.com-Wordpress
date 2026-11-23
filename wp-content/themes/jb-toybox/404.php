<?php
/**
 * An address that leads nowhere. Plain words, two ways out, and three things
 * that do exist. The tipped block is still.
 */

get_header();

$jb_toys   = jb_kind_by_slug( 'toys' );
$jb_landed = get_posts(
	array(
		'post_type'           => 'post',
		'posts_per_page'      => 3,
		'ignore_sticky_posts' => true,
		'no_found_rows'       => true,
	)
);
?>
<div class="l-shell">
	<div class="l-spine"><span class="t-tag t-muted">404</span></div>
	<div>
		<header class="l-head">
			<h1 class="t-title"><?php esc_html_e( 'This page fell out of the stack.', 'jb-toybox' ); ?></h1>
			<p class="t-lead"><?php esc_html_e( 'The address may be old, or I may have moved it.', 'jb-toybox' ); ?></p>
			<div class="l-row jb-lost-row"><a class="btn btn--primary" href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php esc_html_e( 'Back to the pile', 'jb-toybox' ); ?></a><a class="btn" href="<?php echo esc_url( $jb_toys['url'] ); ?>"><?php esc_html_e( 'Play something', 'jb-toybox' ); ?></a></div>
		</header>
		<div class="jb-lost" aria-hidden="true"><div class="lost"><span class="blk" data-kind="writing">
			<span class="cov"><img src="<?php echo esc_url( get_theme_file_uri( 'assets/img/not-found.svg' ) ); ?>" alt="" width="480" height="270" loading="lazy"></span>
			<span class="det"><span class="det__title"><?php esc_html_e( 'Not found', 'jb-toybox' ); ?></span><span class="det__meta"><span><?php esc_html_e( 'Writing', 'jb-toybox' ); ?></span><span><?php esc_html_e( 'Never', 'jb-toybox' ); ?></span></span></span>
		</span></div><div class="floor"></div></div>
		<?php if ( $jb_landed ) : ?>
		<section class="l-section"><h2 class="t-heading post-foot__name"><?php esc_html_e( 'Things that did land', 'jb-toybox' ); ?></h2>
			<?php jb_card_grid( $jb_landed ); ?>
		</section>
		<?php endif; ?>
	</div>
</div>
<?php
get_footer();
