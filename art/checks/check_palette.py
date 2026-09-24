#!/usr/bin/env python3
"""Acceptance check: every PNG under public/sprites/ uses only palette.json colours
(or transparency). Independent of art/src/dsl.py:save_png's own enforcement — this
reads the PNGs back off disk, the way a reviewer who didn't write the build would.

Also enforces the palette itself: at most 32 named colours, no duplicate RGB values.

Usage: python3 art/checks/check_palette.py
Exit 0 and prints PASS per file if clean; exits 1 and prints the offending file/pixel
otherwise.
"""
import glob
import json
import os
import sys

from PIL import Image

_HERE = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT = os.path.dirname(os.path.dirname(_HERE))

with open(os.path.join(_REPO_ROOT, "art", "palette.json")) as f:
    raw = json.load(f)

# PH1-06: the palette may grow to at most 32 named colours, each a distinct RGB value.
MAX_COLOURS = 32

allowed = set()
names = [k for k in raw if not k.startswith("_")]
for name in names:
    h = raw[name].lstrip("#")
    allowed.add((int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)))

if len(names) > MAX_COLOURS:
    print(f"FAIL — palette.json has {len(names)} colours, cap is {MAX_COLOURS}", file=sys.stderr)
    sys.exit(1)
if len(allowed) != len(names):
    print("FAIL — palette.json has two names for the same RGB value", file=sys.stderr)
    sys.exit(1)


def check_file(path: str) -> list[str]:
    problems = []
    img = Image.open(path).convert("RGBA")
    for x in range(img.width):
        for y in range(img.height):
            r, g, b, a = img.getpixel((x, y))
            if a == 0:
                continue
            if (r, g, b) not in allowed:
                problems.append(f"{path}: pixel ({x},{y}) = #{r:02X}{g:02X}{b:02X} not in palette")
                if len(problems) >= 5:
                    return problems
    return problems


def main():
    sprites_dir = os.path.join(_REPO_ROOT, "public", "sprites")
    files = sorted(glob.glob(os.path.join(sprites_dir, "*.png")))
    if not files:
        print(f"No PNGs found under {sprites_dir}", file=sys.stderr)
        sys.exit(1)

    all_problems = []
    for path in files:
        problems = check_file(path)
        if problems:
            all_problems.extend(problems)
        else:
            print(f"PASS  {os.path.relpath(path, _REPO_ROOT)}")

    if all_problems:
        print("\nFAIL — non-palette pixels found:", file=sys.stderr)
        for p in all_problems:
            print(f"  {p}", file=sys.stderr)
        sys.exit(1)

    print(f"\nAll {len(files)} PNGs are palette-only ({len(allowed)} colours + transparency).")


if __name__ == "__main__":
    main()
