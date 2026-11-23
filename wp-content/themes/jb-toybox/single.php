<?php
/**
 * One post. The kind decides the spine's facts and the shape of the body:
 * a toy leads with its artwork and the Play button, writing gets the long-form
 * reading size, and a photo post ends with its neighbours.
 */

get_header();

while ( have_posts() ) :
	the_post();

	$jb_kind   = jb_kind();
	$jb_topics = jb_post_topics();
	$jb_id     = get_the_ID();
	$jb_credit = array( 'value' => jb_credit() );
	$jb_source = get_post_meta( $jb_id, 'toy_source_url', true );

	switch ( $jb_kind['kind'] ) {
		case 'toy':
			$jb_label = __( 'About this toy', 'jb-toybox' );
			$jb_facts = array(
				__( 'Kind', 'jb-toybox' )     => array( 'value' => jb_kind_link( $jb_kind ) ),
				__( 'Type', 'jb-toybox' )     => array( 'value' => esc_html( get_post_meta( $jb_id, 'toy_type', true ) ) ),
				__( 'Version', 'jb-toybox' )  => array( 'value' => esc_html( get_post_meta( $jb_id, 'toy_version', true ) ), 'mono' => true ),
				__( 'Released', 'jb-toybox' ) => array( 'value' => jb_time(), 'mono' => true ),
				__( 'Plays on', 'jb-toybox' ) => array( 'value' => esc_html( get_post_meta( $jb_id, 'toy_plays_on', true ) ) ),
				__( 'Controls', 'jb-toybox' ) => array( 'value' => jb_keys( get_post_meta( $jb_id, 'toy_controls', true ) ) ),
				__( 'Started from', 'jb-toybox' ) => $jb_credit,
				__( 'Source', 'jb-toybox' )   => array( 'value' => $jb_source ? '<a class="link" href="' . esc_url( $jb_source ) . '">' . esc_html__( 'Read the code', 'jb-toybox' ) . '</a>' : '' ),
				__( 'Topics', 'jb-toybox' )   => array( 'value' => $jb_topics ),
			);
			break;

		case 'photo':
			$jb_count = jb_picture_count();
			$jb_label = __( 'About these photographs', 'jb-toybox' );
			$jb_facts = array(
				__( 'Kind', 'jb-toybox' )   => array( 'value' => jb_kind_link( $jb_kind ) ),
				__( 'Taken', 'jb-toybox' )  => array( 'value' => jb_time( 'F Y' ), 'mono' => true ),
				__( 'Set of', 'jb-toybox' ) => array( 'value' => $jb_count > 1 ? esc_html( number_format_i18n( $jb_count ) ) : '', 'mono' => true ),
				__( 'Camera', 'jb-toybox' ) => array( 'value' => esc_html( get_post_meta( $jb_id, 'photo_camera', true ) ) ),
				__( 'Started from', 'jb-toybox' ) => $jb_credit,
				__( 'Topics', 'jb-toybox' ) => array( 'value' => $jb_topics ),
			);
			break;

		default:
			$jb_label = __( 'About this post', 'jb-toybox' );
			$jb_facts = array(
				__( 'Kind', 'jb-toybox' )         => array( 'value' => jb_kind_link( $jb_kind ) ),
				__( 'Posted', 'jb-toybox' )       => array( 'value' => jb_time(), 'mono' => true ),
				__( 'Reading time', 'jb-toybox' ) => array( 'value' => esc_html( jb_reading_time() ), 'mono' => true ),
				__( 'Started from', 'jb-toybox' ) => $jb_credit,
				__( 'Topics', 'jb-toybox' )       => array( 'value' => $jb_topics ),
			);
	}
	?>
<div class="l-shell">
	<?php jb_facts( $jb_facts, $jb_label ); ?>
	<article <?php post_class(); ?>>
		<header class="post-head">
			<h1 class="t-title"><?php the_title(); ?></h1>
			<?php jb_lead(); ?>
		</header>

		<?php
		if ( 'toy' === $jb_kind['kind'] ) :
			$jb_play = get_post_meta( $jb_id, 'toy_play_url', true );
			if ( has_post_thumbnail() || $jb_play ) :
				?>
		<div class="toy-hero">
				<?php if ( has_post_thumbnail() ) : ?>
			<div class="art-stage"><?php the_post_thumbnail( 'large' ); ?></div>
				<?php endif; ?>
				<?php if ( $jb_play ) : ?>
			<div class="toy-hero__go"><a class="btn btn--play" href="<?php echo esc_url( $jb_play ); ?>"><?php esc_html_e( 'Play', 'jb-toybox' ); ?></a><span class="t-small"><?php esc_html_e( 'Opens the game on its own page.', 'jb-toybox' ); ?></span></div>
				<?php endif; ?>
		</div>
				<?php
			endif;
		endif;
		?>

		<div class="prose<?php echo 'writing' === $jb_kind['kind'] ? ' prose--long' : ''; ?>">
			<?php the_content(); ?>
		</div>

		<?php
		if ( 'photo' === $jb_kind['kind'] ) :
			$jb_newer = get_adjacent_post( true, '', false );
			$jb_older = get_adjacent_post( true, '', true );
			if ( $jb_newer || $jb_older ) :
				?>
		<nav class="pager" aria-label="<?php esc_attr_e( 'Other sets', 'jb-toybox' ); ?>">
				<?php if ( $jb_newer ) : ?>
			<a class="btn" href="<?php echo esc_url( get_permalink( $jb_newer ) ); ?>">&larr; <?php echo esc_html( get_the_title( $jb_newer ) ); ?></a>
				<?php else : ?>
			<span></span>
				<?php endif; ?>
				<?php if ( $jb_older ) : ?>
			<a class="btn" href="<?php echo esc_url( get_permalink( $jb_older ) ); ?>"><?php echo esc_html( get_the_title( $jb_older ) ); ?> &rarr;</a>
				<?php endif; ?>
		</nav>
				<?php
			endif;
		else :
			?>
		<footer class="post-foot">
			<?php
			jb_more();
			if ( 'toy' !== $jb_kind['kind'] && ( comments_open() || get_comments_number() ) ) {
				comments_template();
			}
			?>
		</footer>
		<?php endif; ?>
	</article>
</div>
	<?php
endwhile;

get_footer();
