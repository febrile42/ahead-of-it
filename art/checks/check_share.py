#!/usr/bin/env python3
"""PH3-02 (D-057): the share sprites meet SCENE-FORMAT "Share sprites", read back off disk.

- `share-flag`: one `default` frame, >= 12 x 16 art px, an `anchor` on the tip (the
  pixel above it is the mark's lowest opaque pixel).
- `share-caption`: one `default` frame; the source string equals `copy.shareCaption` in
  content.json and the committed PNG is exactly that string lettered; <= 400 image px
  wide and a cap height >= 36 image px at its `shareScale`.
- `share-url`: exactly the eight stops; each frame is `resume.joshgister.com/?n=<n>&it=none`
  lettered; <= 400 image px wide and a cap height >= 10 image px at its `shareScale`.
- every entry has an integer `shareScale`.

Usage: python3 art/checks/check_share.py   (after python3 art/build.py)
"""
import json
import os
import sys

from PIL import Image, ImageChops

_HERE = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT = os.path.dirname(os.path.dirname(_HERE))
sys.path.insert(0, _REPO_ROOT)

from art.src import face  # noqa: E402
from art.src.sprites import share  # noqa: E402

SPRITES = os.path.join(_REPO_ROOT, "public", "sprites")
problems = []


def need(ok, msg):
    if not ok:
        problems.append(msg)


def png(entry, frame):
    return Image.open(os.path.join(SPRITES, entry["frames"][frame][0]["file"])).convert("RGBA")


def same(a: Image.Image, b: Image.Image) -> bool:
    return a.size == b.size and ImageChops.difference(a, b).getbbox() is None


with open(os.path.join(SPRITES, "manifest.json")) as f:
    manifest = json.load(f)
with open(share.CONTENT, encoding="utf-8") as f:
    shareCaption = json.load(f)["copy"]["shareCaption"]

for key in ("share-flag", "share-caption", "share-url"):
    need(key in manifest, f"{key}: missing from manifest.json")
if problems:
    print("\n".join(f"FAIL — {p}" for p in problems), file=sys.stderr)
    sys.exit(1)

for key in ("share-flag", "share-caption", "share-url"):
    s = manifest[key].get("shareScale")
    need(isinstance(s, int) and s >= 1, f"{key}: shareScale {s!r} is not a positive integer")

fl = manifest["share-flag"]
need(list(fl["frames"]) == ["default"], f"share-flag: frames {list(fl['frames'])}")
need(fl["w"] >= 12 and fl["h"] >= 16, f"share-flag: {fl['w']}x{fl['h']} < 12x16")
img = png(fl, "default")
ax, ay = fl["anchor"]
need(0 < ay <= img.height and img.getpixel((ax, ay - 1))[3] == 255,
     f"share-flag: anchor {fl['anchor']} is not just below an opaque pixel")
need(all(img.getpixel((x, y))[3] == 0 for x in range(img.width) for y in range(ay, img.height)),
     "share-flag: pixels at or below the anchor row")
need(img.getpixel((ax, ay - 1))[:3] == (0x1A, 0x14, 0x10), "share-flag: tip is not the outline")

cap = manifest["share-caption"]
need(list(cap["frames"]) == ["default"], f"share-caption: frames {list(cap['frames'])}")
need(share.caption_text() == shareCaption, "share-caption: source string != copy.shareCaption")
lines = face.wrap(shareCaption, share.MAX_W // cap["shareScale"])
need(" ".join(lines) == shareCaption, "share-caption: wrap lost or changed characters")
need(same(png(cap, "default"), share.letter(lines).img),
     "share-caption: committed PNG is not copy.shareCaption lettered (run art/build.py)")
need(cap["w"] * cap["shareScale"] <= 400, f"share-caption: {cap['w'] * cap['shareScale']} > 400 px")
need(face.CAP * cap["shareScale"] >= 36, f"share-caption: cap {face.CAP * cap['shareScale']} < 36 px")

url = manifest["share-url"]
need(sorted(url["frames"], key=int) == list(share.STOPS), f"share-url: frames {list(url['frames'])}")
for n in url["frames"]:
    text = f"resume.joshgister.com/?n={n}&it=none"
    want = share.letter([text]).img
    got = png(url, n)
    need(same(got.crop((0, 0) + want.size), want) and got.crop((want.width, 0) + got.size).getbbox() is None,
         f"share-url {n}: committed PNG is not {text!r} lettered")
need(url["w"] * url["shareScale"] <= 400, f"share-url: {url['w'] * url['shareScale']} > 400 px")
need(face.CAP * url["shareScale"] >= 10, f"share-url: cap {face.CAP * url['shareScale']} < 10 px")

if problems:
    print("\n".join(f"FAIL — {p}" for p in problems), file=sys.stderr)
    sys.exit(1)
print(f"PASS — share-flag {fl['w']}x{fl['h']} @{fl['shareScale']}; share-caption "
      f"{len(lines)} lines, {cap['w'] * cap['shareScale']} px wide, cap "
      f"{face.CAP * cap['shareScale']} px @{cap['shareScale']}; share-url x{len(url['frames'])}, "
      f"{url['w'] * url['shareScale']} px wide, cap {face.CAP * url['shareScale']} px "
      f"@{url['shareScale']}")
