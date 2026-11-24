# Launch runbook: JB Toybox on joshbaltzell.com

The launch pushes the Local site (theme, content and database) to the WP Engine
**production** environment with Local's Push. Local is already connected to production
(Local → Josh Baltzell Website → Connect shows WP Engine, production).

Git push to WP Engine is not an option from this Mac: `git@git.wpengine.com` refuses the
`wpegitkey` key. Local's Push doesn't need it.

## What was prepared on 2026-11-24

- **Spam.** The 567 comments waiting in moderation were all spam and are deleted in
  Local. `wp-content/mu-plugins/jb-comment-guard.php` now refuses comments that arrive
  without a signed stamp from the form, with a filled-in decoy field, in under 3
  seconds, or with a stamp over 14 days old. Pingbacks and trackbacks are refused and
  closed on every post. It needs no plugin and no account. Tested in Local: five fake
  submissions were refused and a real one went through to moderation.
- **Leftover pages.** "Sample Page" and the lorem-ipsum "Home" (ID 6) are drafts now.
  The live home page is still `home-2` (ID 802), drawn by `front-page.php`.
- **Checks.** All 48 public URLs in Local return 200. Old plain links like `/?p=1`
  redirect to the new addresses, so switching permalinks breaks no links. All 23 Play
  links return 200. No PHP errors.
- **Backup.** Database before this prep: `app/sql/before-launch-prep-2026-11-24.sql`.
- **`bin/local-links.sh`** swaps the symlinks in the Local site for real copies before
  the push, and back afterwards.

## Decide before pushing

0. **Look Alive's post describes the new version of the game** (seventeen dishes, three waters, the ending).
   That version is only on the Browser-Games branch `look-alive-wave-2`; the live game (`main`, GitHub Pages)
   is still the ten-dish one. Merge that branch first, or put the old text back (a WordPress revision of the
   post has it).

1. **Search engines: decided, nothing to do.** Production only. `jb-search-visibility.php`
   turns indexing on when the site's address is joshbaltzell.com and off everywhere else,
   whatever the database says. Check after the push: view source on the live home page
   should have no `noindex` meta tag.
2. **Timezone.** The site is on UTC, so post dates can land a day off. Set a city in
   Settings → General if that matters.
3. **Anything new on production since 2026-11-22?** The database push replaces
   production's database. As far as anyone knows, only spam has come in since the pull.

## Launch steps

1. **Back up production.** WP Engine portal → the production environment → Backup points →
   Back up now. Note the time; this is the rollback.
2. **Check PHP.** In the same portal, production must be on PHP 8.1 or newer (the theme
   requires 8.1; Local runs 8.2).
3. **Copy the linked files into Local:**
   ```sh
   cd ~/Documents/GitHub/joshbaltzell.com
   bin/local-links.sh copy
   bin/local-links.sh status   # every line should start with "copy"
   ```
4. **Push.** Local → Josh Baltzell Website → Connect → Push to production.
   - Tick **Include database**.
   - Under files, push `wp-content/themes/jb-toybox`, `wp-content/mu-plugins` (three
     files of ours: content, comment guard, search visibility) and
     `wp-content/uploads`. Plugins don't need pushing: their files are already on
     production, and the database decides which ones are on.
5. **Put the links back:** `bin/local-links.sh link`. If it stops because a copy differs
   from the repo, something was edited in Local during the push. Compare before
   relinking.
6. **On production** (wp-admin):
   - Settings → Permalinks → Save. This rebuilds the rules for `/%postname%/`.
   - WP Engine portal → Clear all caches.
7. **Smoke test** in a private window:
   - [ ] View source on the home page: no `noindex` robots tag (the live site has one today).
   - [ ] Home: the pile rises and settles at the top of the well, newest first, blocks can be thrown, the
         lever (bottom of the screen, on the well's edge) and the Pile/Shelf switch work.
   - [ ] Look Alive: microbes drift inside its case and now and then escape through the crack at the top right.
   - [ ] Picnic Raid: ants mill around its rim and, every 15 to 25 seconds, march to a nearby block.
   - [ ] Pond Chorus: the frog croaks and a little water sloshes on its floor when the box moves.
   - [ ] Nerf the Wolves: move the pointer across it, or tilt the well; the layers separate.
   - [ ] Hal's Minigolf: pixelated walls and the pixel title typeface (Chrome; other browsers may skip the filter).
   - [ ] `/toys/` with the Games/Toys chips, and `/writing/`.
   - [ ] One game post (Play opens the game) and Gyms of War (live cover runs).
   - [ ] `/about/` shows in the nav and loads.
   - [ ] `/?p=1` redirects to the Amazon marketplace post.
   - [ ] A missing page shows the 404 page.
   - [ ] On a 2023 post, wait a few seconds and leave a comment. It should be held for
         moderation. Then delete it.
   - [ ] Phone: hold to pick up a block, and dark mode.

## After launch (no rush)

- Production still has Astra, Elementor, Elementor Pro, Astra Starter Sites, Genesis
  Blocks and WPForms Lite installed. After the push all but WPForms are inactive.
  WPForms is only used by the old Elementor home page, which no longer shows, so it can
  be turned off. Deleting the unused ones reduces what needs updating.
- Akismet is installed but inactive. If spam still gets through the guard, turn it on
  with a free personal key.
- Update CLAUDE.md's "Production" section to describe the new site.

## Rollback

WP Engine portal → Backup points → restore the backup from step 1 (files and database).
