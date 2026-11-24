<?php
/**
 * One kind of post as its own pile. Serves Toys, Code, Design and Writing;
 * photographs get a grid (category-photos.php), and any other category gets the
 * general list (index.php).
 */

$jb_term = get_queried_object();
if ( ! isset( jb_kinds()[ $jb_term->slug ] ) ) {
	get_template_part( 'index' );
	return;
}

get_header();

$jb_kind = jb_kind_by_slug( $jb_term->slug );
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
		jb_stack(
			$wp_query->posts,
			array(
				'label'     => 'toy' === $jb_kind['kind'] ? $jb_kind['plural'] : sprintf( /* translators: %s: a kind of post. */ __( '%s posts', 'jb-toybox' ), $jb_kind['singular'] ),
				'seed'      => 'toy' === $jb_kind['kind'] ? 12 : 3,
				'toy_types' => true,
				'empty'     => sprintf( /* translators: %s: a kind of post, lower case. */ __( 'When there is a %s post, it will fall in from the top.', 'jb-toybox' ), mb_strtolower( $jb_kind['singular'] ) ),
			)
		);
		?>
	</div>
</div>
<?php
get_footer();
