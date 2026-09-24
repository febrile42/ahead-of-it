#!/usr/bin/env bash
# R-33 / D-014 (amended): neither employer may be named in served content —
# not the name, not the logo, not the domain. Names come from
# docs/content/TIMELINE.md's headings ("Previous employer — a $200M company on a nine-building campus" and
# "Current employer — a $3B+ clean-energy company, Boston MA"); docs/content/TONE.md's descriptor rule is what
# replaces them in panel copy. Case-insensitive; exits 1 on any hit.
set -euo pipefail

DIST_DIR="${1:-dist}"

if [ ! -d "$DIST_DIR" ]; then
  echo "check-employer: '$DIST_DIR' does not exist — run the build first." >&2
  exit 1
fi

EMPLOYERS=("the previous employer" "the current employer")
found=0

for name in "${EMPLOYERS[@]}"; do
  if grep -riIl --exclude-dir=.git -- "$name" "$DIST_DIR" > /dev/null 2>&1; then
    echo "check-employer: forbidden employer name '$name' found in $DIST_DIR:" >&2
    grep -riIn --exclude-dir=.git -- "$name" "$DIST_DIR" >&2 || true
    found=1
  fi
done

if [ "$found" -ne 0 ]; then
  exit 1
fi

echo "check-employer: clean — neither employer name appears in $DIST_DIR."
