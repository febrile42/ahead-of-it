"""Scene composer (PH1-07): renders a band x state room from *data* (`layout.py`) using
only what ships — `public/sprites/manifest.json` and the PNGs it names — exactly the way
the site's painter will. Nothing here knows what any sprite is.

A placement is a dict:

  sprite, frame, index   manifest key, frame key (default "default"), frame index (0)
  tile: [col, row]       anchor on iso_to_screen(col, row) (+ optional dx, dy), or
  floor: [fc, fr]        a continuous floor point (tile (i, j) spans i..i+1), or
  attach: {id, point | offset}   relative to another placement: its named manifest
                         point, or a pixel offset from its anchor point
  depth                  sort key; default col + row + 1 (tile), fc + fr (floor)
  layer                  "base" (drawn first, in list order: floors, walls, roads),
                         "main" (depth-sorted, ties in list order) or "over" (last,
                         in list order: network lines, callouts)
  id                     so lines and attachments can refer to it
  band, states, quiet    see layout.py: filtered before rendering

A line is {line: "dotted", from: {id, point}, to: {id, point}, colour, halo}.
"""
from __future__ import annotations

import json
import os

from PIL import Image, ImageDraw

from .dsl import Canvas
from . import iso
from .vox import dotted

_HERE = os.path.dirname(os.path.abspath(__file__))
SPRITES_DIR = os.path.join(_HERE, "..", "..", "public", "sprites")


class Library:
    """Sprites as the site sees them: manifest entries + PNGs, loaded once."""

    def __init__(self, sprites_dir: str = SPRITES_DIR):
        self.dir = sprites_dir
        with open(os.path.join(sprites_dir, "manifest.json")) as f:
            self.manifest = json.load(f)
        self._img = {}

    def image(self, sprite: str, frame: str = "default", index: int = 0) -> Image.Image:
        fname = self.manifest[sprite]["frames"][frame][index]["file"]
        if fname not in self._img:
            self._img[fname] = Image.open(os.path.join(self.dir, fname)).convert("RGBA")
        return self._img[fname]

    def anchor(self, sprite: str):
        return tuple(self.manifest[sprite]["anchor"])

    def point(self, sprite: str, name: str):
        return tuple(self.manifest[sprite]["points"][name])


def resolve(lib: Library, placements: list, origin) -> list:
    """Placements -> [{..., "x", "y", "depth", "order"}]: screen anchor points, in the
    band's own origin. Attachments are resolved against earlier placements."""
    out, by_id = [], {}
    for order, p in enumerate(placements):
        if "line" in p:
            out.append(dict(p, order=order))
            continue
        q = dict(p, order=order)
        q.setdefault("frame", "default")
        q.setdefault("index", 0)
        q.setdefault("layer", "main")
        if "tile" in p:
            col, row = p["tile"]
            x, y = iso.iso_to_screen(col, row, origin)
            x += p.get("dx", 0)
            y += p.get("dy", 0)
            q.setdefault("depth", col + row + 1)
        elif "floor" in p:
            fc, fr = p["floor"]
            x = origin[0] + round((fc - fr) * 16) + p.get("dx", 0)
            y = origin[1] + round((fc + fr - 2) * 8) + p.get("dy", 0)
            q.setdefault("depth", fc + fr)
        else:
            a = p["attach"]
            t = by_id[a["id"]]
            if "point" in a:
                ax, ay = lib.anchor(t["sprite"])
                px, py = lib.point(t["sprite"], a["point"])
                x, y = t["x"] - ax + px, t["y"] - ay + py
            else:
                x, y = t["x"] + a["offset"][0], t["y"] + a["offset"][1]
            q.setdefault("depth", t["depth"] + 0.01)
        q["x"], q["y"] = x, y
        out.append(q)
        if "id" in q:
            by_id[q["id"]] = q
    return out


def _point_of(lib, by_id, ref):
    t = by_id[ref["id"]]
    ax, ay = lib.anchor(t["sprite"])
    px, py = lib.point(t["sprite"], ref["point"])
    return (t["x"] - ax + px, t["y"] - ay + py)


def render(lib: Library, resolved: list, size) -> Canvas:
    c = Canvas(*size)
    by_id = {q["id"]: q for q in resolved if "id" in q}

    def paste(q):
        img = lib.image(q["sprite"], q["frame"], q["index"])
        ax, ay = lib.anchor(q["sprite"])
        c.img.alpha_composite(img, (q["x"] - ax, q["y"] - ay))

    base = [q for q in resolved if q.get("layer") == "base"]
    main = [q for q in resolved if q.get("layer") == "main" and "line" not in q]
    over = [q for q in resolved if q.get("layer") == "over" or "line" in q]
    for q in base:
        paste(q)
    for q in sorted(main, key=lambda q: (q["depth"], q["order"])):
        paste(q)
    for q in over:
        if "line" in q:
            dotted(c, _point_of(lib, by_id, q["from"]), _point_of(lib, by_id, q["to"]),
                   q.get("colour", "net"), halo=q.get("halo", "outline"))
        else:
            paste(q)
    c.draw = ImageDraw.Draw(c.img)
    return c


def bounds(lib: Library, resolved: list):
    """Union of the opaque pixels of every sprite in `resolved` (lines excluded: they
    run between sprites' points, so they are inside it). (x0, y0, x1, y1) or None."""
    box = None
    for q in resolved:
        if "line" in q:
            continue
        img = lib.image(q["sprite"], q["frame"], q["index"])
        bb = img.getchannel("A").getbbox()
        if not bb:
            continue
        ax, ay = lib.anchor(q["sprite"])
        x0, y0 = q["x"] - ax + bb[0], q["y"] - ay + bb[1]
        x1, y1 = q["x"] - ax + bb[2], q["y"] - ay + bb[3]
        box = (x0, y0, x1, y1) if box is None else (
            min(box[0], x0), min(box[1], y0), max(box[2], x1), max(box[3], y1))
    return box


def fit(lib: Library, placement_lists: list, margin: int):
    """(origin, size) of the smallest canvas that holds everything drawn in any of
    `placement_lists` (e.g. one view's two states, so both share a canvas and overlay
    pixel for pixel), with `margin` clear pixels all round. Nothing is ever cut."""
    box = None
    for placements in placement_lists:
        b = bounds(lib, resolve(lib, placements, (0, 0)))
        if b is None:
            continue
        box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]),
                                     max(box[2], b[2]), max(box[3], b[3]))
    x0, y0, x1, y1 = box
    return (margin - x0, margin - y0), (x1 - x0 + 2 * margin, y1 - y0 + 2 * margin)
