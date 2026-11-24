<?php
/**
 * The end of every page: the line, the same links plus RSS, and the typefaces.
 */

$jb_about = get_page_by_path( 'about' );
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
				<?php if ( $jb_about && 'publish' === $jb_about->post_status ) : ?>
				<li><a class="link" href="<?php echo esc_url( get_permalink( $jb_about ) ); ?>"><?php echo esc_html( get_the_title( $jb_about ) ); ?></a></li>
				<?php endif; ?>
				<li><a class="link" href="<?php echo esc_url( get_feed_link() ); ?>"><?php esc_html_e( 'RSS', 'jb-toybox' ); ?></a></li>
			</ul>
			<p class="site-footer__meta t-readout"><?php bloginfo( 'name' ); ?> &middot; <?php echo esc_html( wp_date( 'Y' ) ); ?> &middot; <?php esc_html_e( 'Set in Bricolage Grotesque, Atkinson Hyperlegible Next and JetBrains Mono', 'jb-toybox' ); ?></p>
		</div>
	</div>
</footer>
<?php wp_footer(); ?>
</body>
</html>
