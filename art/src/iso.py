"""Isometric grid helpers: the diamond primitive, wall extrusion, and screen placement.

Tile is 32x16 (2:1). Every sprite's anchor is bottom-center of its own canvas
(see art/style.md "Anchors"); these helpers convert a (col, row) grid cell into the
screen point that every sprite on that cell shares.
"""
from __future__ import annotations

from .dsl import Canvas

TILE_W = 32
TILE_H = 16


def diamond(canvas: Canvas, top: str, left: str, right: str, outline: str):
    """Draw a shaded 32x16 iso diamond into `canvas` (must be >= 32x16), anchored at
    its own (0,0). top/left/right are palette colour names for the three shading
    zones (light from top-left: `top` is the brightest, `left` mid, `right` darkest),
    outline traces the silhouette."""
    w, h = TILE_W, TILE_H
    cx, cy = w // 2, h // 2
    top_pt, right_pt, bot_pt, left_pt = (cx, 0), (w - 1, cy), (cx, h - 1), (0, cy)

    # fill: split the diamond into a left half and right half from the vertical
    # centre-line, so the top-left light source reads as one clean highlight edge.
    canvas.polygon([top_pt, bot_pt, left_pt], left)
    canvas.polygon([top_pt, right_pt, bot_pt], right)

    canvas.diag_line(*top_pt, *right_pt, outline)
    canvas.diag_line(*right_pt, *bot_pt, outline)
    canvas.diag_line(*bot_pt, *left_pt, outline)
    canvas.diag_line(*left_pt, *top_pt, outline)

    # a bright sliver just inside the top-left edge sells the light direction,
    # drawn after the outline so it doesn't get overwritten by it
    canvas.diag_line(cx - 1, 1, 1, cy, top)


def extrude_wall(canvas: Canvas, face_h: int, fill: str, shadow: str, cap_top: str,
                  cap_left: str, cap_right: str, outline: str, trim: str):
    """Draw a wall segment: an iso cap — the top half of a standard `diamond` triangle,
    same 2:1 slope as the floor tile so it rasterizes as a clean edge, not a shallower
    (and much uglier) slope — on top of a vertical rectangular face `face_h` px tall.
    canvas must be TILE_W wide."""
    w = TILE_W
    cx = w // 2
    cap_h = TILE_H // 2  # 8px: apex at y=0, side points at y=cap_h — the true 2:1 slope

    apex, right_pt, left_pt = (cx, 0), (w - 1, cap_h), (0, cap_h)
    canvas.polygon([apex, (cx, cap_h), left_pt], cap_left)
    canvas.polygon([apex, right_pt, (cx, cap_h)], cap_right)

    face_top = cap_h
    face_bot = cap_h + face_h - 1

    # vertical face: left 2/3 lit, right 1/3 shadowed
    split = int(w * 0.62)
    canvas.rect(0, face_top, split, face_bot, fill)
    canvas.rect(split, face_top, w - 1, face_bot, shadow)

    # baseboard trim
    canvas.rect(0, face_bot - 3, w - 1, face_bot, trim)

    # outline around the whole silhouette
    canvas.diag_line(*left_pt, *apex, outline)
    canvas.diag_line(*apex, *right_pt, outline)
    canvas.line([(w - 1, cap_h), (w - 1, face_bot)], outline, width=1)
    canvas.line([(0, cap_h), (0, face_bot)], outline, width=1)
    canvas.line([(0, face_bot), (w - 1, face_bot)], outline, width=1)

    # highlight sliver just inside the cap's top-left edge
    canvas.diag_line(cx - 2, 2, 1, cap_h - 1, cap_top)


def iso_box(canvas: Canvas, cx: int, by: int, hw: int, hh: int, height: int,
            top: str, left: str, right: str, outline: str):
    """Draw a small isometric cube/box (desk, monitor body, chair block...): a top
    diamond (half-width hw, half-height hh — keep hw:hh at 2:1 to match the tile
    slope) extruded down by `height` px, with its front-bottom corner at (cx, by)."""
    F = (cx, by)
    L = (cx - hw, by - hh)
    R = (cx + hw, by - hh)
    B = (cx, by - 2 * hh)
    Ft = (cx, by - height)
    Lt = (cx - hw, by - hh - height)
    Rt = (cx + hw, by - hh - height)
    Bt = (cx, by - 2 * hh - height)

    canvas.polygon([Bt, Rt, Ft, Lt], top)
    canvas.polygon([Lt, Ft, F, L], left)
    canvas.polygon([Ft, Rt, R, F], right)

    canvas.diag_line(*Lt, *Bt, outline)
    canvas.diag_line(*Bt, *Rt, outline)
    canvas.diag_line(*Lt, *Ft, outline)
    canvas.diag_line(*Ft, *Rt, outline)
    canvas.line([Lt, L], outline, width=1)
    canvas.line([Rt, R], outline, width=1)
    canvas.line([Ft, F], outline, width=1)
    canvas.diag_line(*L, *F, outline)
    canvas.diag_line(*F, *R, outline)


def iso_to_screen(col: float, row: float, origin=(0, 0)) -> tuple[int, int]:
    """Grid cell -> screen point for that cell's floor-tile anchor (bottom-center)."""
    ox, oy = origin
    sx = ox + int(round((col - row) * (TILE_W / 2)))
    sy = oy + int(round((col + row) * (TILE_H / 2)))
    return sx, sy


def place(base: Canvas, sprite: Canvas, anchor: tuple[int, int], screen_xy: tuple[int, int]):
    """Paste `sprite` onto `base` so that `sprite`'s anchor pixel lands on screen_xy."""
    ax, ay = anchor
    sx, sy = screen_xy
    base.paste(sprite, sx - ax, sy - ay)
