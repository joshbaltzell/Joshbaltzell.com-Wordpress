# What's on `claude/workshop-ideas`

Five ideas from the [workshop ideas page](https://claude.ai/artifact/CnecfVs5KVKa78QymMwSHR), built overnight on
2026-11-24. The branch starts from `claude/toybox-theme` (the launch branch) and lives in its own worktree at
`../joshbaltzell.com-ideas`, so Local, which is linked to the main checkout, didn't change before the launch.

Nothing here is in the Local database or on the site yet.

## 1. Text toys for the About page (theme)

`[text_toys]` adds a row of three toys to any page: **Call out the nouns**, **Redact** and **Voice**
(plain, Legalese, Pirate, Corporate memo), plus **Put it back**. They work on the page's own words.

- Files: `inc/text-toys.php`, `assets/js/text-toys.js`, a labelled block at the end of `assets/css/wp.css`,
  and `assets/js/vendor/compromise.min.js` (compromise 14.10.0, MIT, an English parser for the nouns). The
  parser is 335 KB and loads only when someone presses "Call out the nouns".
- Without script, the row stays hidden and the page reads as normal.
- To use it: after this branch is merged, add a Shortcode block with `[text_toys]` at the end of the About page.
  Don't add it before the theme has it, or the page shows the raw shortcode.
- Tested on a copy of the About page in headless Chrome: 27% nouns, "Most suspicious: 'idea'". Pirate changes 36
  words, and Put it back restores every word. The parser makes a few odd calls ("here", "on"). The joke absorbs them.

## 2–4. Three toys

Each one is a single static page in `toys/<slug>/` with a `POST.md` draft write-up (title, excerpt, body,
credits) for its WordPress toy post. They share `toys/kit/` (the site's palette and faces). They belong in the
Browser-Games repo once the `play` subdomain exists. They're kept here so that repo's work in progress wasn't
disturbed.

- `toys/price-the-lemonade/`: 30 days to find a price, against a Thompson-sampling bot.
- `toys/repricer-spiral/`: repricing bots and a stand-in Buy Box, including the $23.7 million fly book.
- `toys/twelve-reviews/`: "4.8 from 12 or 4.5 from 2,000?", with honest posterior odds after each pick.

Open any `index.html` straight from disk; there are no build steps and nothing loads from the network.

## 5. Token linter

`node bin/lint-tokens.mjs` checks that the theme's own CSS uses tokens, and suggests the nearest token for each
raw value. `CLAUDE.md` says every value in `wp.css` is a token. Today it finds **16 raw values**, most in the
glass-box depth rules: glare and shadow colours written as `rgb(… / .05)`, a 45ms animation delay, the tilt
handle's `14rem` and `7rem`, and two `2px` shadow offsets.

These probably aren't mistakes, but they should be decided either way: give them tokens, or mark them
`/* raw: reason */` so the linter accepts them. Nothing was changed.
