<?php
/**
 * The end of every page: the line, the same links plus RSS, and the typefaces.
 */

?>
</main>
</div>
<footer class="site-footer">
	<div class="l-page site-footer__in">
		<p class="site-footer__line"><?php esc_html_e( 'I like complicated problems.', 'jb-toybox' ); ?></p>
		<div>
			<ul class="site-footer__list">
				<?php
				foreach ( array_keys( jb_kinds() ) as $jb_slug ) :
					$jb_kind = jb_kind_by_slug( $jb_slug );
					// Only kinds that have something in them yet.
					if ( empty( $jb_kind['term'] ) || ! (int) $jb_kind['term']->count ) {
						continue;
					}
					?>
				<li><a class="link" href="<?php echo esc_url( $jb_kind['url'] ); ?>"><?php echo esc_html( $jb_kind['plural'] ); ?></a></li>
				<?php endforeach; ?>
				<?php foreach ( jb_nav_pages() as $jb_page ) : ?>
				<li><a class="link" href="<?php echo esc_url( get_permalink( $jb_page ) ); ?>"><?php echo esc_html( get_the_title( $jb_page ) ); ?></a></li>
				<?php endforeach; ?>
				<?php foreach ( jb_social_links() as $jb_link ) : ?>
				<li><?php echo jb_social_link( $jb_link ); // phpcs:ignore WordPress.Security.EscapeOutput -- escaped in jb_social_link(). ?></li>
				<?php endforeach; ?>
				<li><a class="link" href="<?php echo esc_url( get_feed_link() ); ?>"><?php esc_html_e( 'RSS', 'jb-toybox' ); ?></a></li>
			</ul>
			<p class="site-footer__meta t-readout"><?php bloginfo( 'name' ); ?> &middot; <?php echo esc_html( wp_date( 'Y' ) ); ?> &middot; <?php esc_html_e( 'Set in Bricolage Grotesque, Atkinson Hyperlegible Next and JetBrains Mono', 'jb-toybox' ); ?></p>
		</div>
	</div>
</footer>
<?php wp_footer(); ?>
</body>
</html>
