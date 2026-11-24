<?php
/**
 * [text_toys] puts a small row of toys into a page that let a visitor poke at the page's own words:
 * call out the nouns, black words out, or read the page in another voice. Made for quiet pages like About.
 *
 * The row is hidden until its script runs, so without script the page reads as normal. The script and the
 * English parser it uses for nouns (compromise 14.10.0, MIT, in assets/js/vendor/) load only on pages that
 * use the shortcode, and the parser loads only when someone asks for nouns.
 *
 * @package jb-toybox
 */

/**
 * The [text_toys] shortcode.
 *
 * @return string
 */
function jb_toybox_text_toys_shortcode() {
	$script = get_theme_file_path( 'assets/js/text-toys.js' );
	wp_enqueue_script( 'jb-text-toys', get_theme_file_uri( 'assets/js/text-toys.js' ), array(), filemtime( $script ), array( 'in_footer' => true, 'strategy' => 'defer' ) );

	$parser = get_theme_file_uri( 'assets/js/vendor/compromise.min.js' ) . '?ver=14.10.0';

	ob_start();
	?>
<div class="text-toys" data-text-toys data-parser="<?php echo esc_url( $parser ); ?>" hidden>
	<p class="t-tag text-toys__label"><?php esc_html_e( 'Poke at this page', 'jb-toybox' ); ?></p>
	<div class="topics" role="group" aria-label="<?php esc_attr_e( 'Toys for this page', 'jb-toybox' ); ?>">
		<button type="button" class="topic" data-toy="nouns" aria-pressed="false"><?php esc_html_e( 'Call out the nouns', 'jb-toybox' ); ?></button>
		<button type="button" class="topic" data-toy="redact" aria-pressed="false"><?php esc_html_e( 'Redact', 'jb-toybox' ); ?></button>
		<button type="button" class="topic" data-toy="voice" aria-pressed="false"><?php esc_html_e( 'Voice: plain', 'jb-toybox' ); ?></button>
		<button type="button" class="topic" data-toy="reset"><?php esc_html_e( 'Put it back', 'jb-toybox' ); ?></button>
	</div>
	<p class="t-small text-toys__readout" aria-live="polite"></p>
</div>
	<?php
	return ob_get_clean();
}
add_shortcode( 'text_toys', 'jb_toybox_text_toys_shortcode' );
