<?php
/**
 * Title: Hero with Watercolor Background
 * Slug: joshbaltzell/hero-watercolor
 * Categories: joshbaltzell-hero
 * Description: A dramatic hero section with watercolor wash background, heading, subtitle, and CTA.
 */
?>

<!-- wp:group {"className":"jb-hero jb-hero-dramatic jb-watercolor-bg","style":{"spacing":{"padding":{"top":"var:preset|spacing|80","bottom":"var:preset|spacing|70","left":"var:preset|spacing|30","right":"var:preset|spacing|30"}}},"layout":{"type":"constrained","contentSize":"800px"}} -->
<div class="wp-block-group jb-hero jb-hero-dramatic jb-watercolor-bg" style="padding-top:var(--wp--preset--spacing--80);padding-right:var(--wp--preset--spacing--30);padding-bottom:var(--wp--preset--spacing--70);padding-left:var(--wp--preset--spacing--30)">

<!-- wp:heading {"textAlign":"center","level":1,"className":"jb-text-reveal","style":{"typography":{"fontSize":"var:preset|font-size|display","fontWeight":"700","letterSpacing":"-0.04em"}},"textColor":"primary","fontFamily":"heading"} -->
<h1 class="wp-block-heading has-text-align-center jb-text-reveal has-primary-color has-text-color has-heading-font-family" style="font-size:var(--wp--preset--font-size--display);font-weight:700;letter-spacing:-0.04em">Page Title</h1>
<!-- /wp:heading -->

<!-- wp:paragraph {"align":"center","className":"jb-text-reveal jb-delay-1","style":{"typography":{"fontSize":"var:preset|font-size|x-large","fontStyle":"italic"}},"textColor":"muted","fontFamily":"heading"} -->
<p class="has-text-align-center jb-text-reveal jb-delay-1 has-muted-color has-text-color has-heading-font-family" style="font-size:var(--wp--preset--font-size--x-large);font-style:italic">A descriptive subtitle goes here</p>
<!-- /wp:paragraph -->

<!-- wp:buttons {"className":"jb-text-reveal jb-delay-2","layout":{"type":"flex","justifyContent":"center"},"style":{"spacing":{"margin":{"top":"var:preset|spacing|50"}}}} -->
<div class="wp-block-buttons jb-text-reveal jb-delay-2" style="margin-top:var(--wp--preset--spacing--50)">
<!-- wp:button -->
<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="#">Call to Action</a></div>
<!-- /wp:button -->
</div>
<!-- /wp:buttons -->

</div>
<!-- /wp:group -->
