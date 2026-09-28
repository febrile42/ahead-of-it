"""PH1-08a floor-convention spike: a throwaway mock compositor.

Not pipeline code. Nothing here is imported by `art/build.py` and nothing here writes
under `public/`. It reads the sprite PNGs + manifest committed by PH1-07 (commit
9045ff4, the richest committed sprite set) straight out of the git object store, so the
mocks are reproducible without touching another worktree, and draws flat palette-colour
blocks for every prop no one has drawn yet. Proportions are real (1 tile = 32 x 16,
worker = 16 x 24, anchors as in art/style.md); polish is not.
"""
from __future__ import annotations

import io
import json
import math
import os
import subprocess
from functools import lru_cache

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
SPRITE_COMMIT = "9045ff4"  # PH1-07: band 150 drawn (febrile42/art-pass-3)

PAL = {k: v for k, v in json.load(open(os.path.join(REPO, "art", "palette.json"))).items()
       if not k.startswith("_")}


def rgb(name):
    h = PAL[name]
    return (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), 255)


def _git_blob(path):
    return subprocess.run(["git", "-C", REPO, "show", f"{SPRITE_COMMIT}:{path}"],
                          check=True, capture_output=True).stdout


@lru_cache(maxsize=None)
def manifest():
    return json.loads(_git_blob("public/sprites/manifest.json"))


@lru_cache(maxsize=None)
def sprite(name, frame="default"):
    """-> (RGBA image, anchor)."""
    e = manifest()[name]
    fr = e["frames"][frame][0]["file"]
    im = Image.open(io.BytesIO(_git_blob(f"public/sprites/{fr}"))).convert("RGBA")
    return im, tuple(e["anchor"]), e.get("points", {})


# --- 3x5 glyphs: art/src/glyphs.py plus a few this mock needs ----------------------
import sys
sys.path.insert(0, REPO)
from art.src.glyphs import GLYPHS as _BASE  # read-only import

GLYPHS = dict(_BASE)
GLYPHS.update({
    "-": ["...", "...", "###", "...", "..."],
    "$": [".#.", "##.", ".#.", ".##", ".#."],
    ".": [".", ".", ".", ".", "#"],
    ",": [".", ".", ".", "#", "#"],
    "/": ["..#", "..#", ".#.", "#..", "#.."],
    "X": ["#.#", "#.#", ".#.", "#.#", "#.#"],
    "Q": [".#.", "#.#", "#.#", "##.", ".##"],
    "J": ["..#", "..#", "..#", "#.#", ".#."],
    "Z": ["###", "..#", ".#.", "#..", "###"],
    "+": ["...", ".#.", "###", ".#.", "..."],
    "(": [".#", "#.", "#.", "#.", ".#"],
    ")": ["#.", ".#", ".#", ".#", "#."],
    "=": ["...", "###", "...", "###", "..."],
    ">": ["#..", ".#.", "..#", ".#.", "#.."],
    "<": ["..#", ".#.", "#..", ".#.", "..#"],
    "#": ["#.#", "###", "#.#", "###", "#.#"],
    "%": ["#.#", "..#", ".#.", "#..", "#.#"],
    "*": ["...", "#.#", ".#.", "#.#", "..."],
    "@": [".#.", "#.#", "#.#", "#..", ".##"],
    "'": ["#", "#", ".", ".", "."],
    "·": [".", ".", "#", ".", "."],
})


def text_w(t):
    return sum(len(GLYPHS[c][0]) for c in t) + max(len(t) - 1, 0)


def draw_text(im, t, x, y, col="outline", scale=1):
    px = im.load()
    c = rgb(col) if isinstance(col, str) else col
    for ch in t:
        rows = GLYPHS[ch]
        for dy, row in enumerate(rows):
            for dx, p in enumerate(row):
                if p == "#":
                    for sy in range(scale):
                        for sx in range(scale):
                            X, Y = x + dx * scale + sx, y + dy * scale + sy
                            if 0 <= X < im.width and 0 <= Y < im.height:
                                px[X, Y] = c
        x += (len(rows[0]) + 1) * scale


def label_img(t, bg="paper", fg="outline", border="outline", pad=1):
    lines = t.split("\n")
    w = max(text_w(l) for l in lines) + 2 * pad + 2
    h = len(lines) * 6 - 1 + 2 * pad + 2
    im = Image.new("RGBA", (w, h), rgb(bg))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, w - 1, h - 1], outline=rgb(border))
    for i, l in enumerate(lines):
        draw_text(im, l, 1 + pad + (w - 2 - 2 * pad - text_w(l)) // 2, 1 + pad + i * 6, fg)
    return im


# --- the scene: depth-sorted draws in grid space --------------------------------------
class Scene:
    """Grid convention is scene80's: at(c, r) = the front vertex of tile (c, r);
    g(u, v) is a continuous floor point, tile (i, j) spanning [i, i+1] x [j, j+1]."""

    def __init__(self, w, h, origin, bg=None):
        self.im = Image.new("RGBA", (w, h), bg or (0, 0, 0, 0))
        self.o = origin
        self.items = []
        self.hot = []  # (gag, part, cx, cy, primary)

    def at(self, c, r):
        return (self.o[0] + round((c - r) * 16), self.o[1] + round((c + r) * 8))

    def g(self, u, v, z=0):
        return (self.o[0] + round((u - v) * 16), self.o[1] + round((u + v - 2) * 8) - z)

    def _add(self, depth, fn):
        self.items.append((depth, len(self.items), fn))

    def paste_now(self, im, anchor, pt):
        self.im.alpha_composite(im, (pt[0] - anchor[0], pt[1] - anchor[1])) \
            if 0 <= pt[0] - anchor[0] and 0 <= pt[1] - anchor[1] and \
            pt[0] - anchor[0] + im.width <= self.im.width and \
            pt[1] - anchor[1] + im.height <= self.im.height \
            else self._paste_clip(im, pt[0] - anchor[0], pt[1] - anchor[1])

    def _paste_clip(self, im, x, y):
        self.im.paste(im, (x, y), im)

    def spr(self, name, frame, pt, depth, flip=False):
        im, a, _ = sprite(name, frame)
        if flip:
            im = im.transpose(Image.FLIP_LEFT_RIGHT)
            a = (im.width - 1 - a[0], a[1])
        self._add(depth, lambda: self.paste_now(im, a, pt))
        return pt

    def tile(self, name, c, r, frame="default", depth=None, dx=0, dy=0, flip=False):
        pt = self.at(c, r)
        return self.spr(name, frame, (pt[0] + dx, pt[1] + dy),
                        c + r + 1 if depth is None else depth, flip)

    def fig(self, name, frame, u, v, depth=None, flip=False):
        return self.spr(name, frame, self.g(u, v), u + v if depth is None else depth, flip)

    def img(self, im, pt, depth, anchor=None):
        a = anchor or (im.width // 2, im.height)
        self._add(depth, lambda: self.paste_now(im, a, pt))

    def label(self, t, pt, depth=99, **kw):
        """Billboard label, anchored bottom-centre on pt."""
        im = label_img(t, **kw)
        self.img(im, pt, depth)
        return im.size

    def box(self, u0, v0, u1, v1, h, top, left, right, z=0, depth=None, text=None,
            text_col="outline"):
        """Flat iso box on footprint [u0,u1]x[v0,v1], h px tall, standing at height z."""
        g = self.g
        A, B, C, D = g(u0, v0, z), g(u1, v0, z), g(u1, v1, z), g(u0, v1, z)
        up = lambda p: (p[0], p[1] - h)
        ol = rgb("outline")

        def fn():
            d = ImageDraw.Draw(self.im)
            d.polygon([D, C, up(C), up(D)], fill=rgb(left), outline=ol)
            d.polygon([B, C, up(C), up(B)], fill=rgb(right), outline=ol)
            d.polygon([up(A), up(B), up(C), up(D)], fill=rgb(top), outline=ol)
            if text:
                w = text_w(text)
                cx, cy = (up(A)[0] + up(C)[0]) // 2, (up(A)[1] + up(C)[1]) // 2
                draw_text(self.im, text, cx - w // 2, cy - 2, text_col)
        self._add(u1 + v1 - 0.5 if depth is None else depth, fn)
        top_c = up(g((u0 + u1) / 2, (v0 + v1) / 2, z))
        return top_c

    def ellipse(self, cx, cy, rx, ry, fill, depth, outline="outline"):
        def fn():
            ImageDraw.Draw(self.im).ellipse([cx - rx, cy - ry, cx + rx, cy + ry],
                                            fill=rgb(fill), outline=rgb(outline))
        self._add(depth, fn)

    def line(self, pts, col, depth, width=1):
        def fn():
            ImageDraw.Draw(self.im).line(pts, fill=rgb(col), width=width)
        self._add(depth, fn)

    def rect(self, x0, y0, x1, y1, fill, depth, outline="outline"):
        def fn():
            ImageDraw.Draw(self.im).rectangle([x0, y0, x1, y1], fill=rgb(fill),
                                              outline=rgb(outline) if outline else None)
        self._add(depth, fn)

    def hotspot(self, gag, part, pt, primary=True):
        self.hot.append((gag, part, pt[0], pt[1], primary))

    def flush(self):
        for _, _, fn in sorted(self.items, key=lambda t: (t[0], t[1])):
            fn()
        self.items = []
        return self.im


# --- room shells ------------------------------------------------------------------------
def room_shell(sc: Scene, c0, r0, cols, rows, door_rows=(), win_rows=(), win_cols=(),
               closet=None, floor="floor-office"):
    at = sc.at
    c1, r1 = c0 + cols - 1, r0 + rows - 1
    for c in range(c0, c1 + 1):
        sc.paste_now(*sprite("slab-l")[:2], at(c, r1))
    for r in range(r0, r1 + 1):
        sc.paste_now(*sprite("slab-r")[:2], at(c1, r))
    for r in range(r0, r1 + 1):
        for c in range(c0, c1 + 1):
            name = floor
            if closet and closet[0] <= c <= closet[2] and closet[1] <= r <= closet[3]:
                name = "floor-closet"
            sc.paste_now(*sprite(name)[:2], at(c, r))
    sc.paste_now(*sprite("wall-corner")[:2], at(c0, r0))
    for r in range(r0, r1 + 1):
        n = "wall-back-l-end" if r == r1 else (
            "wall-back-l-door" if r in door_rows else
            "wall-back-l-window" if r in win_rows else "wall-back-l")
        sc.paste_now(*sprite(n)[:2], at(c0, r))
    for c in range(c0, c1 + 1):
        n = "wall-back-r-end" if c == c1 else (
            "wall-back-r-window" if c in win_cols else "wall-back-r")
        sc.paste_now(*sprite(n)[:2], at(c, r0))


def scale_nn(im, k):
    return im.resize((im.width * k, im.height * k), Image.NEAREST)


# --- spacing ------------------------------------------------------------------------------
def spacing(hot, ratio=1.0):
    """Min distance (CSS px at `ratio` CSS px per art px) between primary hotspot centres,
    and every offending pair below 44."""
    prim = [h for h in hot if h[4]]
    worst, bad = math.inf, []
    for i in range(len(prim)):
        for j in range(i + 1, len(prim)):
            a, b = prim[i], prim[j]
            d = math.hypot(a[2] - b[2], a[3] - b[3]) * ratio
            worst = min(worst, d)
            if d < 44:
                bad.append((a[0], b[0], round(d, 1)))
    return worst, bad
