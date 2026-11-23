<?php
/**
 * The top of every page: the name on the left, the six places you can go on the right.
 * Below 900px the links go behind a Menu button, using the HTML popover attribute.
 */

$jb_about = get_page_by_path( 'about' );
?>
<!doctype html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo( 'charset' ); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1">
<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<a class="skip" href="#main"><?php esc_html_e( 'Skip to content', 'jb-toybox' ); ?></a>
<div class="l-page">
<header class="site-header">
	<a class="site-title" href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php bloginfo( 'name' ); ?></a>
	<button class="btn btn--small site-menu-btn" type="button" popovertarget="site-nav"><?php esc_html_e( 'Menu', 'jb-toybox' ); ?></button>
	<nav class="site-nav" id="site-nav" popover aria-label="<?php esc_attr_e( 'Site', 'jb-toybox' ); ?>">
		<div class="site-nav__head"><span class="site-title"><?php bloginfo( 'name' ); ?></span><button class="btn btn--small" type="button" popovertarget="site-nav" popovertargetaction="hide"><?php esc_html_e( 'Close', 'jb-toybox' ); ?></button></div>
		<ul class="site-nav__list">
			<?php
			foreach ( array_keys( jb_kinds() ) as $jb_slug ) :
				$jb_kind = jb_kind_by_slug( $jb_slug );
				?>
			<li><a href="<?php echo esc_url( $jb_kind['url'] ); ?>" data-kind="<?php echo esc_attr( $jb_kind['kind'] ); ?>"<?php echo is_category( $jb_slug ) ? ' aria-current="page"' : ''; ?>><?php echo esc_html( $jb_kind['plural'] ); ?></a></li>
			<?php endforeach; ?>
			<?php if ( $jb_about && 'publish' === $jb_about->post_status ) : ?>
			<li><a href="<?php echo esc_url( get_permalink( $jb_about ) ); ?>"<?php echo is_page( $jb_about->ID ) ? ' aria-current="page"' : ''; ?>><?php echo esc_html( get_the_title( $jb_about ) ); ?></a></li>
			<?php endif; ?>
		</ul>
	</nav>
</header>
<main id="main" class="l-main">
