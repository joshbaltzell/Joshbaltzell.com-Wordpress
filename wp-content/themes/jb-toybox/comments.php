<?php
/**
 * Comments under an article, then the form: comment first, name and email side
 * by side, one primary button. A reply is indented once and never further.
 */

if ( post_password_required() ) {
	return;
}

$jb_number = (int) get_comments_number();
?>
<section id="comments" aria-labelledby="comments-h">
	<h2 class="t-heading post-foot__name" id="comments-h">
		<?php
		/* translators: %s: number of comments. */
		echo esc_html( $jb_number ? sprintf( _n( '%s comment', '%s comments', $jb_number, 'jb-toybox' ), number_format_i18n( $jb_number ) ) : __( 'Comments', 'jb-toybox' ) );
		?>
	</h2>

	<?php if ( have_comments() ) : ?>
	<ol class="comments">
		<?php
		wp_list_comments(
			array(
				'style'     => 'ol',
				'callback'  => 'jb_comment',
				'max_depth' => 2,
				'type'      => 'comment',
			)
		);
		?>
	</ol>
	<?php the_comments_pagination(); ?>
	<?php endif; ?>

	<?php
	if ( comments_open() ) {
		$jb_required = get_option( 'require_name_email' ) ? ' required' : '';
		$jb_author   = wp_get_current_commenter();

		comment_form(
			array(
				'class_form'           => 'comment-form',
				'title_reply'          => '',
				'title_reply_before'   => '<p class="t-small" id="reply-title">',
				'title_reply_after'    => '</p>',
				'comment_notes_before' => '',
				'comment_notes_after'  => '',
				'logged_in_as'         => '',
				'label_submit'         => __( 'Send comment', 'jb-toybox' ),
				'class_submit'         => 'btn btn--primary',
				'submit_field'         => '<div>%1$s %2$s</div>',
				'comment_field'        => '<div class="field"><label for="comment">' . esc_html__( 'Comment', 'jb-toybox' ) . '</label><textarea class="input" id="comment" name="comment" rows="4" maxlength="65525" required></textarea></div>',
				'fields'               => array(
					'author'  => '<div class="comment-form__pair"><div class="field"><label for="author">' . esc_html__( 'Name', 'jb-toybox' ) . '</label><input class="input" id="author" name="author" type="text" value="' . esc_attr( $jb_author['comment_author'] ) . '" autocomplete="name" maxlength="245"' . $jb_required . '></div>',
					'email'   => '<div class="field"><label for="email">' . esc_html__( 'Email', 'jb-toybox' ) . '</label><input class="input" id="email" name="email" type="email" value="' . esc_attr( $jb_author['comment_author_email'] ) . '" autocomplete="email" maxlength="100" aria-describedby="email-hint"' . $jb_required . '><span class="field__hint" id="email-hint">' . esc_html__( 'Never shown.', 'jb-toybox' ) . '</span></div></div>',
					'cookies' => '<label class="check"><input id="wp-comment-cookies-consent" name="wp-comment-cookies-consent" type="checkbox" value="yes"' . ( empty( $jb_author['comment_author_email'] ) ? '' : ' checked' ) . '><span>' . esc_html__( 'Remember my name and email in this browser.', 'jb-toybox' ) . '</span></label>',
				),
			)
		);
	} elseif ( $jb_number ) {
		echo '<p class="t-small t-muted">' . esc_html__( 'Comments are closed.', 'jb-toybox' ) . '</p>';
	}
	?>
</section>
