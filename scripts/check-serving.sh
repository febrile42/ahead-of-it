#!/usr/bin/env bash
# R-26: serving hygiene. Only public/ (or the build output) is uploaded —
# .git, docs, and source must never be served. Same rule and reason as
# joshgister.com. Checks the *build output*, not the source tree: this is
# what wrangler.jsonc's assets.directory actually uploads (R-26, R-33 sibling
# check is scripts/check-employer.sh).
set -euo pipefail

DIST_DIR="${1:-dist}"

if [ ! -d "$DIST_DIR" ]; then
  echo "check-serving: '$DIST_DIR' does not exist — run the build first." >&2
  exit 1
fi

found=0

# .git* anywhere under dist (a .git dir, .gitignore, .gitattributes, ...)
while IFS= read -r -d '' path; do
  echo "check-serving: forbidden path in $DIST_DIR: $path" >&2
  found=1
done < <(find "$DIST_DIR" -iname '.git*' -print0)

# a docs/ directory anywhere under dist
while IFS= read -r -d '' path; do
  echo "check-serving: forbidden path in $DIST_DIR: $path" >&2
  found=1
done < <(find "$DIST_DIR" -type d -iname 'docs' -print0)

# an art/src directory (source art, as opposed to exported sprites/scenes)
while IFS= read -r -d '' path; do
  echo "check-serving: forbidden path in $DIST_DIR: $path" >&2
  found=1
done < <(find "$DIST_DIR" -type d -ipath '*art/src' -print0)

# any markdown file
while IFS= read -r -d '' path; do
  echo "check-serving: forbidden file in $DIST_DIR: $path" >&2
  found=1
done < <(find "$DIST_DIR" -iname '*.md' -print0)

if [ "$found" -ne 0 ]; then
  exit 1
fi

echo "check-serving: clean — no .git*, docs/, art/src, or *.md under $DIST_DIR."
