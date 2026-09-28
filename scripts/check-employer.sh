#!/usr/bin/env bash
# R-33 / D-014 (amended): neither employer may be named — not the name, not
# the logo, not the domain. Checks the built output (default `dist`) and,
# inside a git work tree, every tracked file in the repo.
#
# The names are deliberately not in this repo. They come from the
# EMPLOYER_DENYLIST environment variable (an Actions secret in CI):
# comma- or newline-separated, matched case-insensitively as plain
# substrings. docs/content/TONE.md's descriptors are what replace them.
#
# Unset list: fails when CI is set (the guard must never pass by default in
# CI), otherwise warns and skips so a fresh clone still builds. On a hit it
# prints file:line and the entry's position in the list, never the name
# itself — CI logs are public.
set -euo pipefail

DIST_DIR="${1:-dist}"

if [ ! -d "$DIST_DIR" ]; then
  echo "check-employer: '$DIST_DIR' does not exist — run the build first." >&2
  exit 1
fi

EMPLOYERS=()
while IFS= read -r entry; do
  entry="${entry#"${entry%%[![:space:]]*}"}"
  entry="${entry%"${entry##*[![:space:]]}"}"
  if [ -n "$entry" ]; then EMPLOYERS+=("$entry"); fi
done < <(printf '%s\n' "${EMPLOYER_DENYLIST:-}" | tr ',' '\n')

if [ "${#EMPLOYERS[@]}" -eq 0 ]; then
  if [ -n "${CI:-}" ]; then
    echo "check-employer: EMPLOYER_DENYLIST is empty in CI — set the Actions secret." >&2
    exit 1
  fi
  echo "check-employer: EMPLOYER_DENYLIST is not set — skipping (CI always runs this check)." >&2
  exit 0
fi

found=0
report() { # $1 = entry number, $2 = where; stdin = grep -n output
  local hits
  hits=$(cut -d: -f1-2)
  if [ -n "$hits" ]; then
    echo "check-employer: denylist entry #$1 found in $2:" >&2
    printf '%s\n' "$hits" | sed 's/^/  /' >&2
    found=1
  fi
}

for i in "${!EMPLOYERS[@]}"; do
  name="${EMPLOYERS[$i]}"
  report "$((i + 1))" "$DIST_DIR" < <(grep -riIFn --exclude-dir=.git -- "$name" "$DIST_DIR" || true)
  if git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    report "$((i + 1))" "the repo" < <(git grep -iIFn -- "$name" || true)
  fi
done

if [ "$found" -ne 0 ]; then
  exit 1
fi

echo "check-employer: clean — no denylisted employer name in $DIST_DIR or the repo (${#EMPLOYERS[@]} entries)."
