<?php
/**
 * A plain page such as About.
 */

get_header();

while ( have_posts() ) :
	the_post();
	?>
<div class="l-shell">
	<div class="l-spine">
		<?php
		// A page's featured image sits in its spine, small and outlined like any other picture.
		if ( has_post_thumbnail() ) {
			the_post_thumbnail( 'medium_large', array( 'class' => 'figure__img jb-spine-picture' ) );
		}
		?>
	</div>
	<article <?php post_class(); ?>>
		<header class="post-head">
			<h1 class="t-title"><?php the_title(); ?></h1>
			<?php jb_lead(); ?>
		</header>
		<div class="prose">
			<?php the_content(); ?>
		</div>
	</article>
</div>
	<?php
endwhile;

get_footer();
