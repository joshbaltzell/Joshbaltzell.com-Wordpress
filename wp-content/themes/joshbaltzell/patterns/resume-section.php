<?php
/**
 * Title: Resume Section
 * Slug: joshbaltzell/resume-section
 * Categories: joshbaltzell-resume
 * Description: A resume section with heading, separator, and content area.
 */
?>

<!-- wp:group {"className":"jb-resume-section jb-fade-in","style":{"spacing":{"margin":{"bottom":"var:preset|spacing|50"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group jb-resume-section jb-fade-in" style="margin-bottom:var(--wp--preset--spacing--50)">

<!-- wp:heading {"style":{"typography":{"fontSize":"var:preset|font-size|x-large","textTransform":"uppercase","letterSpacing":"0.05em"}},"textColor":"secondary","fontFamily":"body"} -->
<h2 class="wp-block-heading has-secondary-color has-text-color has-body-font-family" style="font-size:var(--wp--preset--font-size--x-large);letter-spacing:0.05em;text-transform:uppercase">Section Title</h2>
<!-- /wp:heading -->

<!-- wp:separator {"style":{"spacing":{"margin":{"top":"var:preset|spacing|10","bottom":"var:preset|spacing|30"}}},"backgroundColor":"border"} -->
<hr class="wp-block-separator has-text-color has-border-color has-border-background-color has-background" style="margin-top:var(--wp--preset--spacing--10);margin-bottom:var(--wp--preset--spacing--30)"/>
<!-- /wp:separator -->

<!-- wp:paragraph {"style":{"typography":{"fontSize":"var:preset|font-size|medium","lineHeight":"1.8"}}} -->
<p style="font-size:var(--wp--preset--font-size--medium);line-height:1.8">Section content goes here.</p>
<!-- /wp:paragraph -->

</div>
<!-- /wp:group -->
