<?php
/**
 * Every photograph whole. Photographs are the one kind of thing that is not
 * dropped into a well: they keep their own shape, in a grid.
 */

get_header();

$jb_term = get_queried_object();
$jb_kind = jb_kind_by_slug( 'photos' );
$jb_lead = $jb_term->description ? $jb_term->description : $jb_kind['lead'];
?>
<div class="l-shell">
	<?php jb_list_spine( $jb_kind ); ?>
	<div>
		<header class="l-head">
			<h1 class="t-title"><?php echo esc_html( $jb_kind['plural'] ); ?></h1>
			<?php if ( $jb_lead ) : ?>
			<p class="t-lead"><?php echo wp_kses_post( $jb_lead ); ?></p>
			<?php endif; ?>
		</header>
		<?php
		if ( have_posts() ) {
			jb_photo_grid( $wp_query->posts );
		} else {
			jb_stack( array(), array( 'empty' => __( 'When there is a photograph, it will be shown here whole.', 'jb-toybox' ) ) );
		}
		?>
	</div>
</div>
<?php
get_footer();
