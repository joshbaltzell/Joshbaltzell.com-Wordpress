#!/bin/sh
# Swap the Local site's links to this repo for real copies, and back.
#
#   bin/local-links.sh copy    before pushing Local to WP Engine
#   bin/local-links.sh link    after the push, so repo edits show up in Local again
#   bin/local-links.sh status  show what is there now
#
# Local's push may not follow symlinks, so the pushed site could end up with
# links pointing at this Mac instead of the theme. Copying first removes the doubt.

set -eu

REPO=$(cd "$(dirname "$0")/.." && pwd)
SITE="${LOCAL_SITE:-$HOME/Local Sites/joshbaltzell.com/app/public}"

# Paths relative to wp-content that live in this repo.
ITEMS="themes/jb-toybox mu-plugins/jb-toybox-content.php mu-plugins/jb-comment-guard.php mu-plugins/jb-search-visibility.php mu-plugins/jb-toy-files.php"

[ -d "$SITE/wp-content" ] || { echo "No Local site at $SITE" >&2; exit 1; }

status() {
	for item in $ITEMS; do
		dest="$SITE/wp-content/$item"
		if [ -L "$dest" ]; then echo "link  $item"
		elif [ -e "$dest" ]; then echo "copy  $item"
		else echo "none  $item"; fi
	done
}

case "${1:-status}" in
copy)
	for item in $ITEMS; do
		src="$REPO/wp-content/$item"; dest="$SITE/wp-content/$item"
		[ -L "$dest" ] || [ ! -e "$dest" ] || { echo "skip  $item (already a copy)"; continue; }
		rm -f "$dest"
		# -R copies directories; -P never follows links inside them.
		cp -RP "$src" "$dest"
		echo "copied $item"
	done
	;;
link)
	for item in $ITEMS; do
		src="$REPO/wp-content/$item"; dest="$SITE/wp-content/$item"
		if [ -e "$dest" ] && [ ! -L "$dest" ]; then
			# Refuse to throw away a copy that has drifted from the repo.
			if ! diff -rq "$src" "$dest" >/dev/null 2>&1; then
				echo "stop  $item differs from the repo; compare before relinking:" >&2
				diff -rq "$src" "$dest" >&2 || true
				exit 1
			fi
			rm -rf "$dest"
		fi
		[ -L "$dest" ] || ln -s "$src" "$dest"
		echo "linked $item"
	done
	;;
status) status ;;
*) echo "usage: $0 copy|link|status" >&2; exit 2 ;;
esac
