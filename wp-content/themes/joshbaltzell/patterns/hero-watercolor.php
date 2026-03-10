<?php
/**
 * Title: Hero with Watercolor Background
 * Slug: joshbaltzell/hero-watercolor
 * Categories: joshbaltzell-hero
 * Description: A hero section with watercolor wash background, heading, subtitle, and CTA.
 */
?>

<!-- wp:group {"className":"jb-hero jb-watercolor-bg","style":{"spacing":{"padding":{"top":"var:preset|spacing|70","bottom":"var:preset|spacing|70","left":"var:preset|spacing|30","right":"var:preset|spacing|30"}}},"layout":{"type":"constrained","contentSize":"800px"}} -->
<div class="wp-block-group jb-hero jb-watercolor-bg" style="padding-top:var(--wp--preset--spacing--70);padding-right:var(--wp--preset--spacing--30);padding-bottom:var(--wp--preset--spacing--70);padding-left:var(--wp--preset--spacing--30)">

<!-- wp:heading {"textAlign":"center","level":1,"className":"jb-slide-up","style":{"typography":{"fontSize":"var:preset|font-size|xxx-large","fontWeight":"700","letterSpacing":"-0.03em"}},"textColor":"primary","fontFamily":"heading"} -->
<h1 class="wp-block-heading has-text-align-center jb-slide-up has-primary-color has-text-color has-heading-font-family" style="font-size:var(--wp--preset--font-size--xxx-large);font-weight:700;letter-spacing:-0.03em">Page Title</h1>
<!-- /wp:heading -->

<!-- wp:paragraph {"align":"center","className":"jb-slide-up jb-delay-1","style":{"typography":{"fontSize":"var:preset|font-size|large","fontStyle":"italic"}},"textColor":"muted","fontFamily":"heading"} -->
<p class="has-text-align-center jb-slide-up jb-delay-1 has-muted-color has-text-color has-heading-font-family" style="font-size:var(--wp--preset--font-size--large);font-style:italic">A descriptive subtitle goes here</p>
<!-- /wp:paragraph -->

<!-- wp:buttons {"className":"jb-slide-up jb-delay-2","layout":{"type":"flex","justifyContent":"center"},"style":{"spacing":{"margin":{"top":"var:preset|spacing|40"}}}} -->
<div class="wp-block-buttons jb-slide-up jb-delay-2" style="margin-top:var(--wp--preset--spacing--40)">
<!-- wp:button -->
<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="#">Call to Action</a></div>
<!-- /wp:button -->
</div>
<!-- /wp:buttons -->

</div>
<!-- /wp:group -->
