"""DIA-133: keep the hotspot marker's ticks off in-scene lettering.

The web draws each close-up hotspot as a reticle (four corner L-ticks, DIA-124) centred
on the hotspot rect's centre. Where that centre fell on a sign, the ticks crossed the
letters (AUDITOR read "ᴬUDIT⊿R"). The rule: **a tick never touches lettering.**

Lettering is found, not listed. The sprites are rebuilt once, in a subprocess, with every
glyph in `glyphs.GLYPHS` blanked (same widths, no ink); a view painted with both sprite
sets differs exactly where letters are seen, so a letter hidden behind a later entry
does not count and new signage is covered without anyone registering it.

`place_marker` gives a hotspot whose centred reticle touches letters a `marker` point:
the nearest point on the gag part's own opaque pixels, inside its rect, where the
reticle clears them. The web centres the 44 css px button and its reticle there instead
of on the rect's centre. The rect itself is never changed: it is the object's extent,
which sizes the reticle's frame and which walkers and moments keep out of, so moving the
tap point by shrinking it would have bent all three.
"""
from __future__ import annotations

import math
import os
import shutil
import subprocess
import sys
import tempfile

from PIL import Image, ImageChops

_HERE = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT = os.path.dirname(os.path.dirname(_HERE))

# The marker, from src/style.css `.hotspot::before` (the ink edge, the larger layer), in
# css px: frame = rect + 2 * 4, clamped to 28-40 per axis, plus 2; arm 12; thickness 4;
# `hs-breathe` peaks at scale 1.08.
FRAME_PAD, FRAME_MIN, FRAME_MAX = 4, 28, 40
EDGE_ARM, EDGE_T = 12, 4
BREATHE = 1.08
# css px per art px a close-up can be shown at. `chooseScale` (src/scene/assembler.ts)
# picks a whole number of device px per art px, so a phone gets one of three: 1.5 (360-375
# px wide, dpr 2), 5/3 (the same at dpr 3) and 2.0 (390-430 px). The ticks are a fixed css
# size, so each scale puts them on different art pixels; at all three they must clear.
# DESKTOP (up to the 720 px column's 4.0) is reported by check_lettering.py, not enforced:
# there the 40 px reticle is ~10 art px, smaller than a sign, so a marker on a text-dense
# object (the board, the hat stack) cannot always clear it, and the letters are twice
# the size of the ticks.
SCALES = (1.5, 5 / 3, 2.0)
DESKTOP = tuple(s / 100 for s in range(210, 401, 10))
# css px of daylight between a tick and a letter, best first. Only the last (0: a tick
# may sit next to a letter, never on one) is the rule; the FEATURE REQUESTS board, lettered
# top and bottom 30 px apart, clears nothing better on a phone.
CLEARANCES = (2.0, 1.0, 0.0)
CLEAR = CLEARANCES[0]


class Library:
    """A compose.Library view of the glyph-free sprite set: same manifest (shared, so
    the exporter's baked overlays resolve), files from the blank build, and anything
    the build did not write (the overlays, which carry no letters) from the real set."""

    def __init__(self, lib, blank_dir: str):
        self.manifest = lib.manifest
        self._lib, self._dir, self._img = lib, blank_dir, {}

    def image(self, sprite: str, frame: str = "default", index: int = 0) -> Image.Image:
        fname = self.manifest[sprite]["frames"][frame][index]["file"]
        if fname not in self._img:
            path = os.path.join(self._dir, fname)
            if os.path.exists(path):
                self._img[fname] = Image.open(path).convert("RGBA")
            else:
                self._img[fname] = self._lib.image(sprite, frame, index)
        return self._img[fname]

    def anchor(self, sprite: str):
        return self._lib.anchor(sprite)


_BUILD_BLANK = """
import os, sys
sys.path.insert(0, {root!r}); sys.path.insert(0, os.path.join({root!r}, "art"))
from art.src import glyphs
for ch, rows in glyphs.GLYPHS.items():
    glyphs.GLYPHS[ch] = ["." * len(r) for r in rows]
import build
build.SPRITES_DIR = {out!r}
build.build_manifest()
"""


class Blank:
    """Context manager: a glyph-free Library over `lib`, built into a scratch directory
    by a subprocess (so no sprite module's state from the real build can leak letters
    into it), removed on exit."""

    def __init__(self, lib):
        self._lib = lib

    def __enter__(self) -> Library:
        self._tmp = tempfile.mkdtemp(prefix="blank-sprites-")
        code = _BUILD_BLANK.format(root=_REPO_ROOT, out=self._tmp)
        subprocess.run([sys.executable, "-c", code], check=True, stdout=subprocess.DEVNULL)
        return Library(self._lib, self._tmp)

    def __exit__(self, *exc):
        shutil.rmtree(self._tmp, ignore_errors=True)


def letter_pixels(paint, lib, blank, entries: list, w: int, h: int) -> set:
    """{(x, y)} of every lettering pixel seen in a view painted from `entries`."""
    diff = ImageChops.difference(paint(lib, entries, w, h), paint(blank, entries, w, h))
    diff = diff.convert("L")
    bb = diff.getbbox()
    if not bb:
        return set()
    px = diff.load()
    return {(x, y) for y in range(bb[1], bb[3]) for x in range(bb[0], bb[2]) if px[x, y]}


def ticks(point: tuple, rect: tuple, scale: float, clear: float = CLEAR) -> list:
    """The marker's 8 edge bars, grown by `clear` css px, in the view's art px: centred
    on `point`, framed from hotspot `rect` (x0, y0, x1, y1), shown at `scale` css px per
    art px."""
    x0, y0, x1, y1 = rect
    fw = min(max((x1 - x0) * scale + 2 * FRAME_PAD, FRAME_MIN), FRAME_MAX) + 2
    fh = min(max((y1 - y0) * scale + 2 * FRAME_PAD, FRAME_MIN), FRAME_MAX) + 2
    k = BREATHE / scale
    hw, hh, a, t, c = fw / 2 * k, fh / 2 * k, EDGE_ARM * k, EDGE_T * k, clear / scale
    out = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = point[0] + sx * hw, point[1] + sy * hh
            for bw, bh in ((a, t), (t, a)):
                xa, xb = sorted((x, x - sx * bw))
                ya, yb = sorted((y, y - sy * bh))
                out.append((xa - c, ya - c, xb + c, yb + c))
    return out


def touching(point: tuple, rect: tuple, letters: set, scales=SCALES,
             first: bool = False, clear: float = CLEAR) -> set:
    """The lettering pixels any tick of the marker, grown by `clear`, overlaps at any
    of `scales` (just the first one found if `first`)."""
    hit = set()
    for s in scales:
        for (xa, ya, xb, yb) in ticks(point, rect, s, clear):
            for y in range(math.floor(ya), math.ceil(yb)):
                for x in range(math.floor(xa), math.ceil(xb)):
                    if (x, y) in letters:
                        hit.add((x, y))
                        if first:
                            return hit
    return hit


def centre(h: dict) -> tuple:
    """Where the web centres a hotspot's marker: its `marker`, else its rect's centre."""
    m = h.get("marker")
    if m:
        return m["x"], m["y"]
    return h["x"] + h["w"] / 2, h["y"] + h["h"] / 2


def place_marker(rect: tuple, own: Image.Image, letters: set, what: str):
    """None if hotspot `rect`'s centred marker already clears `letters` (the web's
    default), else the nearest half-pixel point on `own`'s opaque pixels (the gag
    part's own sprites), inside the rect, whose marker clears them at every phone
    scale, with the most daylight on offer (CLEARANCES). Raises if there is none."""
    x0, y0, x1, y1 = rect
    ocx, ocy = (x0 + x1) / 2, (y0 + y1) / 2
    if not touching((ocx, ocy), rect, letters, first=True):
        return None
    alpha = own.getchannel("A").load()
    cands = []
    for hy in range(2 * y0 + 1, 2 * y1):
        for hx in range(2 * x0 + 1, 2 * x1):
            cx, cy = hx / 2, hy / 2
            if alpha[int(cx), int(cy)]:
                cands.append(((cx - ocx) ** 2 + (cy - ocy) ** 2, cy, cx))
    cands.sort()
    for clear in CLEARANCES:
        for _d, cy, cx in cands:
            if not touching((cx, cy), rect, letters, first=True, clear=clear):
                return cx, cy
    # Nothing clears every phone. The picture needs re-composing (the object and the
    # letters are closer than the reticle is tall); until it is, clear the 390 px phone
    # (the bar the picture reviews use), graze the fewest letters elsewhere, and say so.
    # check_lettering.py still fails on it.
    best = None
    for d, cy, cx in cands:
        if touching((cx, cy), rect, letters, (2.0,), first=True, clear=0):
            continue
        n = len(touching((cx, cy), rect, letters, clear=0))
        if best is None or (n, d) < best[0]:
            best = ((n, d), (cx, cy))
    if best is None:
        raise ValueError(f"{what}: no point on the object puts the hotspot marker clear "
                         f"of the lettering; move the sign or the object in layout.py")
    print(f"lettering: {what}: no marker clears every phone scale; at "
          f"{best[1]} it clears 390 px and touches {best[0][0]} letter px on smaller "
          f"phones. Re-compose the view.", file=sys.stderr)
    return best[1]
