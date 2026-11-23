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
- Deploy the theme to WP Engine and repeat the Local content migration there.
- Fix comment spam on the production site.
- Games repo side: the `play` subdomain, frozen versions, and a game list file.

## The Theme (wp-content/themes/jb-toybox/)

The design system is the source of truth: https://claude.ai/artifact/X3s5eC5AtjvbynyqAteSDi (read `project/README.md` and `project/wordpress.md` there before changing how anything looks).

- `theme.json`, `assets/css/tokens.wp.css`, `assets/css/bundle.css`, `assets/js/stack.js` and `assets/fonts/` come from the design system. Don't hand-edit `bundle.css` or `tokens.wp.css`; re-copy them when the design system changes. `stack.js` now differs from the design system's copy: it adds live physics so landed blocks can be dragged, thrown, shaken and tidied, and it tries further seeds when a pile lands with a block leaning past 8 degrees, and loose blocks are bottom-weighted with a gentle pull toward upright (every change is marked `play:` in the file). Re-copying it would lose that. `theme.json` has two deliberate differences from the handoff file: no block-template declarations, and no global link hover style.
- `assets/css/wp.css` holds the WordPress-only rules (core block overrides, Button block styles, comments, the `color-scheme` line that turns dark mode on). Every value in it is a token.
- It is a classic PHP-template theme with `theme.json`, not a block theme. The design's markup is exact and custom (popover menu, the stack), so templates output it directly. Posts are still written in the block editor.
- The five kinds are categories with the slugs `toys`, `code`, `design`, `writing`, `photos` (`inc/kinds.php`). A post's kind picks its face color (`data-kind`), its spine facts and its body layout in `single.php`. Topics are tags.
- A post's lead paragraph is its Excerpt. Other facts come from the "Post details" box.
- `[game name="…" version="…" url="…" poster="…" keys="{←} {→} move | second note"]` puts a playable game in an article. Point `url` at a frozen copy of that version.
- Departures from the design system are in a labelled section at the end of `wp.css`: the two-part home page opening, and depth on blocks (each block is a glass-fronted box: content on the back wall, four inner walls drawn as one mitred border on `::before`, and a glare on `::after`). Box depth is in `cqw` so it scales with each block (pictured as 4 inches wide, 1 inch deep). `assets/js/site.js` moves the walls, the well's side walls, its back-wall pattern and the cast shadows with the pointer, or with scrolling on touch screens; it does nothing under reduced motion. On touch, a block is picked up by pressing and holding (in `stack.js`). List pager buttons and filter chips load the next list in place without a page reload (`site.js`, falling back to a normal link). The pager also departs from it: `jb_pager()` shows "Showing 1 to 12 of 23" with "12 newer" and "11 older" buttons, with no page numbers and no disabled button.
- `assets/js/stack-rules.js` adds special-block rules for particular toys (`pond`, `tunnel`), and `wp.css` has a `data-skin="gyms"` look. A post opts in through the "Special block" field. Art for rules lives in `assets/img/rules/`; the Pond Chorus sprites there are copied from the Browser-Games repo.
- The stack script and Matter.js 0.19.0 (bundled in `assets/js/vendor/`) load only on pages that have a stack.
- The About link appears in the navigation once a published page with the slug `about` exists. A page's featured image shows in its spine.
- Toys carry a type of Game or Toy (`toy_type`); the only tags are `game` and `toy`, used as the Toys list filters, and any post can carry a "Started from" credit (`credit_name`, `credit_url`).
- In Local, the 23 games from the Browser-Games repo are toy posts with draft write-ups, and there is a draft About page. None of that content is in git; it lives in the Local database.

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
- `themes/jb-toybox` and `mu-plugins/jb-toybox-content.php` are symlinked from this repo into the Local site, so repo edits show up immediately.
- `jb-toybox` is the active theme in Local. Elementor, Elementor Pro, Astra Starter Sites and Genesis Blocks are deactivated there. To see the old site, activate Astra and those plugins again.
- The six 2023 posts were migrated in Local only: all are in Writing, their old categories became tags, Elementor no longer controls three of them, and bold-paragraph headings became real headings.
- Local uses pretty permalinks (`/%postname%/`); production still uses plain.
- WP-CLI: run `. "/Users/joshbaltzell/Local Sites/joshbaltzell.com/app/.envrc"` first, then `wp` from `app/public`. `wp db query` fails on the socket; other commands work.
- Database backups in the Local site folder under `app/sql/`: `before-prep-2026-11-22.sql` (as pulled) and `before-theme-2026-11-22.sql` (before the theme switch and post migration).
- Don't push from Local to WP Engine while the symlinks are in place without checking how Local handles them.

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
