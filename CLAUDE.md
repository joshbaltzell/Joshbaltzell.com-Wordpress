# Project Context for Claude

## Repository Overview

This repo (`Joshbaltzell.com-Wordpress`) holds the code for joshbaltzell.com, a WordPress site hosted on WP Engine.

| Directory | What It Is | Status |
|---|---|---|
| `wp-content/themes/jb-toybox/` | The site's theme, built from the Josh Baltzell design system | Built and checked in Local. Not deployed. |
| `wp-content/mu-plugins/jb-toybox-content.php` | Post meta for toys, photographs and special stack blocks, plus the "Post details" box in the editor | In use by the theme. |
| `wp-content/themes/joshbaltzell/` | Custom block theme (watercolor aesthetic, `ai_interview` templates) | Never deployed to production. Being replaced by a new design system. |
| `wp-content/mu-plugins/jb-post-types.php` | Registers the `ai_interview` post type and `interview_topic` taxonomy | Tied to the old interview concept. |
| `content/` | One unpublished interview and a publishing guide | Left over from the interview concept. |
| `frame-recommender/` | ML recommendation engine for custom picture frames (Adobe Commerce, scikit-learn, FastAPI) | Built. Unrelated to the website. |

The Quotable Slack bot (`slack-interview-bot/`) and the JB AI Interviewer plugin were removed in November 2026. Both remain in git history.

## Site Direction

The site is a personal workshop: toys, code posts, design posts, writing, and photographs. It stays on WordPress.

Still to do:
- Launch: push Local (theme, content, database) to WP Engine production. The steps are in `LAUNCH.md`.
- Games repo side: the `play` subdomain, frozen versions, and a game list file.

Comment spam is handled by `wp-content/mu-plugins/jb-comment-guard.php` (a signed stamp and a decoy field on the comment form, no outside service). It reaches production with the launch.

## The Theme (wp-content/themes/jb-toybox/)

The design system is the source of truth: https://claude.ai/artifact/X3s5eC5AtjvbynyqAteSDi (read `project/README.md` and `project/wordpress.md` there before changing how anything looks).

- `theme.json`, `assets/css/tokens.wp.css`, `assets/css/bundle.css`, `assets/js/stack.js` and `assets/fonts/` come from the design system. Don't hand-edit `bundle.css` or `tokens.wp.css`; re-copy them when the design system changes. `stack.js` now differs from the design system's copy: it adds live physics so landed blocks can be dragged, thrown, shaken and tidied, and it tries further seeds when a pile lands with a block leaning past 8 degrees, and loose blocks are bottom-weighted with a gentle pull toward upright (every change is marked `play:` in the file). Re-copying it would lose that. `theme.json` has two deliberate differences from the handoff file: no block-template declarations, and no global link hover style.
- `assets/css/wp.css` holds the WordPress-only rules (core block overrides, Button block styles, comments, the `color-scheme` line that turns dark mode on). Every value in it is a token.
- It is a classic PHP-template theme with `theme.json`, not a block theme. The design's markup is exact and custom (popover menu, the stack), so templates output it directly. Posts are still written in the block editor.
- The five kinds are categories with the slugs `toys`, `code`, `design`, `writing`, `photos` (`inc/kinds.php`). A post's kind picks its face color (`data-kind`), its spine facts and its body layout in `single.php`. Topics are tags.
- A post's lead paragraph is its Excerpt. Other facts come from the "Post details" box.
- `[game name="…" version="…" url="…" poster="…" keys="{←} {→} move | second note"]` puts a playable game in an article. Point `url` at a frozen copy of that version.
- Departures from the design system are in a labelled section at the end of `wp.css`: the two-part home page opening, and depth on blocks (each block is a glass-fronted box: content on the back wall, four inner walls drawn as one mitred border on `::before`, and a glare on `::after`). Box depth is in `cqw` so it scales with each block (pictured as 4 inches wide, 1 inch deep). `assets/js/site.js` moves the walls, the well's side walls, its back-wall pattern and the cast shadows with the pointer, or with scrolling on touch screens; it does nothing under reduced motion. On touch, a block is picked up by pressing and holding (in `stack.js`). There is no pager. Every list puts its whole set in the page (capped at 48; the home page at 36), and the stack shows a first batch (12, or 9 on a phone and on the home page). `stack.js` keeps an "active set" with three operations: add (blocks fall in from the top), remove (the floor opens and they fall out) and tidy (re-drop). Built on those:
  - **More:** the "N more" button under the well adds the next batch.
  - **Filters:** chips with `data-stack-filter` (Games, Toys) swap the active set in place and update the address with `history.replaceState`. On a list the server already filtered (`?tag=`), the chips are plain links. Without script, every item shows and the chip links filter on the server.
  - **Pile or shelf:** a toggle under the well. Shelf turns physics off and shows a tidy grid. The choice is kept in `localStorage` (`jb-view`); reduced motion starts on the shelf.
  - **Peek:** each block is a `div.blk` holding a stretched main link (`.blk__link`) and a `.blk__peek` with the one-line pitch (the excerpt) and a Play link for toys. It shows on hover and focus; on touch only the Play corner shows. Pressing Play never picks a block up.
  - **Age:** `--age` (0 newest to 1 oldest) dims older blocks, shortens their shadow and reduces their parallax. Size never changes.
  - At most two special blocks animate at once.
  - **Feel:** `stack.js` watches every block for a sudden stop (in the baked drop and in live play). A landing squashes the block slightly, puffs flat dust from its corners on the front canvas, and knocks the well if the block is big and fast. None of it changes the physics.
  - **Sound:** Web Audio, created only after the visitor touches the pile or one of its controls, so the first drop is always silent. A landing is a short, quiet knock (peak gain about 0.04), rate-limited. The Sound button turns it off and the choice is kept in `localStorage` (`jb-sound`). The flag for this is `touched`; `armed` is the separate first-drop flag, and reusing that name once broke the opening drop.
  - **Machine panel** (`.rack__machine`, optional, hidden on the shelf and when motion is paused): a tilt handle that leans gravity sideways while held (arrow keys too), and a lever that does what More does. The plain buttons stay.
- **Custom block designs are made in WordPress, not in the theme.** The post editor's Post details box has a "Block design" group: cover (featured image, looping video, or live cover code), face, text and title colours, title typeface (site faces, Rubik Dirt, or an uploaded WOFF2), capitals, "knocked about" wear, and custom CSS where `&` means this post's block. `jb_block_design()` in `inc/template-tags.php` turns those into the block's classes, CSS variables, cover markup and a scoped `<style>`. Live covers run in `<iframe sandbox="allow-scripts">` (no same-origin), can't be clicked, load only on screen, unload off screen, hear `{jb:'pause'}` / `{jb:'play'}`, and never load under reduced motion (`site.js`). Code fields and font uploads are administrator-only (`unfiltered_html`); WP-CLI scripts that set them need `--user=1`. Gyms of War and Jam Tunnel are set up this way. Don't add new designs to the theme.
- The "Special block" field still offers the built-in rules: Sun and Black hole (from the design system, in `stack.js`) and Pond (`assets/js/stack-rules.js`, sprites in `assets/img/rules/pond/`).
- The stack script and Matter.js 0.19.0 (bundled in `assets/js/vendor/`) load only on pages that have a stack.
- The About link appears in the navigation once a published page with the slug `about` exists. A page's featured image shows in its spine.
- Toys carry a type of Game or Toy (`toy_type`); the only tags are `game` and `toy`, used as the Toys list filters, and any post can carry a "Started from" credit (`credit_name`, `credit_url`).
- In Local, the 23 games from the Browser-Games repo are published toy posts, and the About page is published. None of that content is in git; it lives in the Local database.

## Production (WP Engine)

Production does not run anything from this repo. It runs:
- Astra theme with an Elementor-built home page
- Elementor, Elementor Pro, Astra Starter Sites, Genesis Blocks, WPForms Lite
- 6 blog posts from April 2023, plain permalinks

## Local Development

The site runs in Local (by WP Engine), pulled from the production environment:
- Files: `/Users/joshbaltzell/Local Sites/joshbaltzell.com/app/public`
- URL: http://localhost:10058/
- The Local site folder is not a git repo. This repo is the source of truth for custom code.

Local setup details:
- `themes/jb-toybox`, `mu-plugins/jb-toybox-content.php`, `mu-plugins/jb-comment-guard.php` and `mu-plugins/jb-search-visibility.php` are symlinked from this repo into the Local site, so repo edits show up immediately. `bin/local-links.sh copy|link|status` swaps them for real copies before a push and back after.
- `jb-toybox` is the active theme in Local. Elementor, Elementor Pro, Astra Starter Sites and Genesis Blocks are deactivated there. To see the old site, activate Astra and those plugins again.
- The six 2023 posts were migrated in Local only: all are in Writing, their old categories became tags, Elementor no longer controls three of them, and bold-paragraph headings became real headings.
- Local uses pretty permalinks (`/%postname%/`); production still uses plain.
- WP-CLI: run `. "/Users/joshbaltzell/Local Sites/joshbaltzell.com/app/.envrc"` first, then `wp` from `app/public`. `wp db query` fails on the socket; other commands work.
- Database backups in the Local site folder under `app/sql/`: `before-prep-2026-11-22.sql` (as pulled) and `before-theme-2026-11-22.sql` (before the theme switch and post migration).
- Local is connected to WP Engine **production**. Don't push from Local while the symlinks are in place; run `bin/local-links.sh copy` first.
- Git push to WP Engine (`staging` remote) is refused for this Mac's key, so Local's Push is the deploy route.
- Search engines index production only: `mu-plugins/jb-search-visibility.php` forces `blog_public` to 1 on the joshbaltzell.com host and 0 everywhere else, so the Settings → Reading checkbox has no effect.
- Backup before launch prep: `app/sql/before-launch-prep-2026-11-24.sql`. Since then the 567 held spam comments were deleted, pings closed on every post, and the Sample Page and the lorem-ipsum Home (ID 6) set to draft.

## Toys

Toys are static builds hosted outside WordPress. The first set is the games in `github.com/joshbaltzell/Browser-Games`, live on GitHub Pages. Agreed approach:
- Games stay in their own repo, served from a subdomain (planned: `play.joshbaltzell.com`).
- Each toy gets a `toy` post with a Play link to the live build.
- An article about a specific version embeds a frozen copy (planned: `/archive/<game>/v<n>/` in the games repo), never the live build.

The root `docker-compose.yml` is an older, separate WordPress setup on port 8080 with an empty database.

## Git Workflow
- Working branch: `claude/wordpress-ai-interview-setup-G4cob`
- Remotes: `origin` (GitHub) and `staging` (WP Engine `joshstg` install)
- Always push with: `git push -u origin <branch-name>`
- Commit messages should be descriptive (what + why)
