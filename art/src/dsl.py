"""Tiny sprite DSL + drawing primitives for the PH1-02 art spike.

Two ways to define a sprite, mixed as needed:
  1. `from_rows(rows, mapping)` — a list of equal-length strings, one character per
     pixel, mapped to palette colour names via `mapping`. Good for hand-authored
     silhouettes (the worker, the badge reader).
  2. `Canvas` drawing primitives (`rect`, `polygon`, `line`) — good for geometric,
     parametric shapes (the floor diamond, wall extrusion, desk box).

Both end up as a `Canvas`, which is the only thing `build.py` knows how to save.
"""
from __future__ import annotations

import json
import os
from PIL import Image, ImageDraw, ImageOps

_HERE = os.path.dirname(os.path.abspath(__file__))
_PALETTE_PATH = os.path.join(_HERE, "..", "palette.json")

with open(_PALETTE_PATH) as f:
    _raw = json.load(f)

# PH1-06 raised the cap from 24 to 32 (shadow, sticky, net, paper, outfits, skins).
MAX_COLOURS = 32

PALETTE_NAMES = [k for k in _raw.keys() if not k.startswith("_")]
if len(PALETTE_NAMES) > MAX_COLOURS:
    raise ValueError(f"palette.json has {len(PALETTE_NAMES)} colours, max is {MAX_COLOURS}")


def _hex_to_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


PALETTE_RGB = {name: _hex_to_rgb(_raw[name]) for name in PALETTE_NAMES}
PALETTE_RGBA = {name: (*rgb, 255) for name, rgb in PALETTE_RGB.items()}
# index 0 is reserved for transparency; real colours start at 1
PALETTE_INDEX = {name: i + 1 for i, name in enumerate(PALETTE_NAMES)}
RGB_TO_INDEX = {rgb: PALETTE_INDEX[name] for name, rgb in PALETTE_RGB.items()}

TRANSPARENT = (0, 0, 0, 0)


class Canvas:
    """An RGBA drawing surface that only ever holds palette-exact colours."""

    def __init__(self, w: int, h: int):
        self.w = w
        self.h = h
        self.img = Image.new("RGBA", (w, h), TRANSPARENT)
        self.draw = ImageDraw.Draw(self.img)

    # -- primitives ---------------------------------------------------
    def rect(self, x0, y0, x1, y1, color):
        self.draw.rectangle([x0, y0, x1, y1], fill=PALETTE_RGBA[color])

    def outlined_rect(self, x0, y0, x1, y1, fill, outline):
        """A filled rect with a 1px outline border, drawn as two nested rects — the
        cheap, reliable way to keep a hard black edge on every blocky part without
        hand-tracing a polygon border."""
        self.rect(x0 - 1, y0 - 1, x1 + 1, y1 + 1, outline)
        self.rect(x0, y0, x1, y1, fill)

    def polygon(self, points, color):
        self.draw.polygon(points, fill=PALETTE_RGBA[color])

    def line(self, points, color, width=1):
        self.draw.line(points, fill=PALETTE_RGBA[color], width=width)

    def diag_line(self, x0, y0, x1, y1, color):
        """A clean single-pixel-per-step diagonal, plotted manually. PIL's draw.line
        at width=1 thickens shallow (near-horizontal or near-vertical) diagonals into
        uneven blocks; this walks the dominant axis one pixel at a time instead, which
        is what a hand-drawn pixel-art diagonal actually looks like."""
        dx = x1 - x0
        dy = y1 - y0
        steps = max(abs(dx), abs(dy))
        if steps == 0:
            self.point(x0, y0, color)
            return
        for i in range(steps + 1):
            x = round(x0 + dx * i / steps)
            y = round(y0 + dy * i / steps)
            self.point(x, y, color)

    def point(self, x, y, color):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.img.putpixel((x, y), PALETTE_RGBA[color])

    def paste(self, other: "Canvas", x: int, y: int):
        self.img.alpha_composite(other.img, (x, y))

    def mirror_h(self) -> "Canvas":
        c = Canvas(self.w, self.h)
        c.img = ImageOps.mirror(self.img)
        c.draw = ImageDraw.Draw(c.img)
        return c

    def crop_paste_h_flip(self, x0, x1, y0, y1) -> "Canvas":
        """Mirror only a sub-region (e.g. just the legs) back into a copy of self."""
        c = Canvas(self.w, self.h)
        c.img = self.img.copy()
        region = self.img.crop((x0, y0, x1, y1))
        region = ImageOps.mirror(region)
        c.img.alpha_composite(region, (x0, y0))
        c.draw = ImageDraw.Draw(c.img)
        return c

    def verify_palette_only(self):
        """Raise if any pixel isn't transparent or an exact palette colour."""
        for rgba in self.img.getdata():
            r, g, b, a = rgba
            if a == 0:
                continue
            if a != 255 or (r, g, b) not in RGB_TO_INDEX:
                raise ValueError(f"non-palette pixel {rgba} in a {self.w}x{self.h} canvas")


def from_rows(rows: list[str], mapping: dict[str, str | None]) -> Canvas:
    """Build a Canvas from ASCII rows. mapping maps a character to a palette colour
    name, or to None for transparent. '.' is always transparent."""
    h = len(rows)
    w = len(rows[0])
    for r in rows:
        assert len(r) == w, f"row length mismatch: {len(r)} != {w} in {r!r}"
    c = Canvas(w, h)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == ".":
                continue
            color = mapping.get(ch)
            if color is None:
                continue
            c.point(x, y, color)
    return c


def scale_nn(canvas: Canvas, factor: int) -> Canvas:
    """Integer nearest-neighbour upscale — the only scaling this pipeline allows."""
    assert factor >= 1 and int(factor) == factor
    out = Canvas(canvas.w * factor, canvas.h * factor)
    out.img = canvas.img.resize(
        (canvas.w * factor, canvas.h * factor), resample=Image.NEAREST
    )
    out.draw = ImageDraw.Draw(out.img)
    return out


def save_png(canvas: Canvas, path: str):
    """Save as PNG-8 (palette mode) using ONLY the fixed palette (<= 32 colours), so the
    palette-only constraint is structural, not just checked after the fact."""
    canvas.verify_palette_only()
    os.makedirs(os.path.dirname(path), exist_ok=True)

    palette_bytes = [0, 0, 0]  # index 0 = transparent placeholder colour, unused visually
    for name in PALETTE_NAMES:
        palette_bytes.extend(PALETTE_RGB[name])
    # pad to 256 entries
    palette_bytes.extend([0, 0, 0] * (256 - len(palette_bytes) // 3))

    out = Image.new("P", (canvas.w, canvas.h), 0)
    out.putpalette(palette_bytes)
    px_in = canvas.img.load()
    px_out = out.load()
    for y in range(canvas.h):
        for x in range(canvas.w):
            r, g, b, a = px_in[x, y]
            if a == 0:
                px_out[x, y] = 0
            else:
                px_out[x, y] = RGB_TO_INDEX[(r, g, b)]
    out.info["transparency"] = 0
    # deterministic: no metadata, no timestamps, fixed settings
    out.save(path, format="PNG", optimize=False)
