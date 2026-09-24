#!/usr/bin/env python3
"""PH1-02 art spike build script.

Renders every sprite defined in art/src/sprites/ to public/sprites/*.png (1x, PNG-8,
palette-only by construction — see art/src/dsl.py:save_png), writes
public/sprites/manifest.json, and composes the two judging previews at
art/preview/room.png (4x) and art/preview/sheet.png (1x) / sheet@4x.png (4x).

Usage: python3 art/build.py   (stdlib + pillow only, no other dependencies)
"""
from __future__ import annotations

import json
import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT = os.path.dirname(_HERE)
sys.path.insert(0, _REPO_ROOT)

from art.src.dsl import Canvas, save_png, scale_nn
from art.src import iso
from art.src.sprites import floor, wall, desk, worker, badge_reader

SPRITES_DIR = os.path.join(_REPO_ROOT, "public", "sprites")
PREVIEW_DIR = os.path.join(_HERE, "preview")

WALK_FRAME_MS = 120


def build_static_sprites():
    """floor / wall / desk: one frame each. Returns manifest entries."""
    manifest = {}

    f = floor.build()
    save_png(f, os.path.join(SPRITES_DIR, "floor.png"))
    manifest["floor"] = {
        "w": f.w, "h": f.h, "anchor": list(floor.ANCHOR),
        "frames": {"default": [{"file": "floor.png", "duration": 0}]},
    }

    w = wall.build()
    save_png(w, os.path.join(SPRITES_DIR, "wall.png"))
    manifest["wall"] = {
        "w": w.w, "h": w.h, "anchor": list(wall.ANCHOR),
        "frames": {"default": [{"file": "wall.png", "duration": 0}]},
    }

    d = desk.build()
    save_png(d, os.path.join(SPRITES_DIR, "desk.png"))
    manifest["desk"] = {
        "w": d.w, "h": d.h, "anchor": list(desk.ANCHOR),
        "frames": {"default": [{"file": "desk.png", "duration": 0}]},
    }
    return manifest, {"floor": f, "wall": w, "desk": d}


def build_badge_reader():
    red = badge_reader.build("red")
    green = badge_reader.build("green")
    save_png(red, os.path.join(SPRITES_DIR, "badge-reader-red.png"))
    save_png(green, os.path.join(SPRITES_DIR, "badge-reader-green.png"))
    entry = {
        "w": badge_reader.W, "h": badge_reader.H, "anchor": list(badge_reader.ANCHOR),
        "frames": {
            "red": [{"file": "badge-reader-red.png", "duration": 0}],
            "green": [{"file": "badge-reader-green.png", "duration": 0}],
        },
    }
    return entry, {"red": red, "green": green}


def build_worker():
    directions = worker.build_all()
    frames_manifest = {}
    rendered = {}
    for direction, frames in directions.items():
        rendered[direction] = frames
        file_list = []
        for i, frame in enumerate(frames):
            fname = f"worker-{direction}-{i}.png"
            save_png(frame, os.path.join(SPRITES_DIR, fname))
            file_list.append({"file": fname, "duration": WALK_FRAME_MS})
        frames_manifest[direction] = file_list
    entry = {
        "w": worker.W, "h": worker.H, "anchor": list(worker.ANCHOR),
        "frames": frames_manifest,
    }
    return entry, rendered


def build_manifest():
    manifest, static = build_static_sprites()
    badge_entry, badge_rendered = build_badge_reader()
    manifest["badge-reader"] = badge_entry
    worker_entry, worker_rendered = build_worker()
    manifest["worker"] = worker_entry

    manifest_path = os.path.join(SPRITES_DIR, "manifest.json")
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2, sort_keys=True)
        f.write("\n")

    return static, badge_rendered, worker_rendered


# ---------------------------------------------------------------------------
# Previews
# ---------------------------------------------------------------------------

def build_sheet(static, badge_rendered, worker_rendered):
    """Every sprite laid out on one sheet — the style-reference sheet, at 1x and 4x."""
    pad = 4
    cell_w, cell_h = 40, 56
    cols = 8
    items = []
    items.append(("floor", static["floor"]))
    items.append(("wall", static["wall"]))
    items.append(("desk", static["desk"]))
    items.append(("badge-red", badge_rendered["red"]))
    items.append(("badge-green", badge_rendered["green"]))
    for direction in ("down", "up", "left", "right"):
        for i, frame in enumerate(worker_rendered[direction]):
            items.append((f"worker-{direction}-{i}", frame))

    rows = (len(items) + cols - 1) // cols
    sheet = Canvas(cols * cell_w, rows * cell_h)
    for i, (_name, spr) in enumerate(items):
        col, row = i % cols, i // cols
        x = col * cell_w + (cell_w - spr.w) // 2
        y = row * cell_h + (cell_h - spr.h) // 2
        sheet.paste(spr, x, y)

    save_png(sheet, os.path.join(PREVIEW_DIR, "sheet.png"))
    save_png(scale_nn(sheet, 4), os.path.join(PREVIEW_DIR, "sheet@4x.png"))


def build_room(static, badge_rendered, worker_rendered):
    """3x3 floor, two walls, two desks, one worker mid-stride, a badge reader on a
    wall — composited on the isometric grid, saved at 4x (the judged deliverable)."""
    origin = (130, 90)
    scene = Canvas(300, 260)

    floor_spr, wall_spr, desk_spr = static["floor"], static["wall"], static["desk"]

    # back wall: two segments across the top-back edge (row -1), col 0 and 1
    for col in (0, 1):
        pt = iso.iso_to_screen(col, -1, origin)
        iso.place(scene, wall_spr, wall.ANCHOR, pt)

    # badge reader mounted on the right-hand wall segment (col 1), offset into its
    # right (unshadowed-by-window) portion — a wall prop, not placed via floor anchor
    wall_pt = iso.iso_to_screen(1, -1, origin)
    wx = wall_pt[0] - wall.ANCHOR[0] + 21
    wy = wall_pt[1] - wall.ANCHOR[1] + 18
    scene.paste(badge_rendered["green"], wx, wy)

    # 3x3 floor, painted back-to-front
    cells = [(c, r) for r in range(3) for c in range(3)]
    cells.sort(key=lambda cr: cr[0] + cr[1])
    for col, row in cells:
        pt = iso.iso_to_screen(col, row, origin)
        iso.place(scene, floor_spr, floor.ANCHOR, pt)

    # props on top of the floor, sorted by depth so nearer ones paint last
    props = []
    props.append(((0, 0), desk_spr, desk.ANCHOR))
    props.append(((2, 0), desk_spr, desk.ANCHOR))
    walk_frame = worker_rendered["right"][1]  # mid-stride, passing pose
    props.append(((1, 2), walk_frame, worker.ANCHOR))
    props.sort(key=lambda p: p[0][0] + p[0][1])
    for (col, row), spr, anchor in props:
        pt = iso.iso_to_screen(col, row, origin)
        iso.place(scene, spr, anchor, pt)

    bbox = scene.img.getbbox()
    if bbox:
        x0, y0, x1, y1 = bbox
        margin = 4
        x0, y0 = max(x0 - margin, 0), max(y0 - margin, 0)
        x1, y1 = min(x1 + margin, scene.w), min(y1 + margin, scene.h)
        cropped = Canvas(x1 - x0, y1 - y0)
        cropped.img = scene.img.crop((x0, y0, x1, y1))
        scene = cropped

    save_png(scale_nn(scene, 4), os.path.join(PREVIEW_DIR, "room.png"))


def main():
    static, badge_rendered, worker_rendered = build_manifest()
    build_sheet(static, badge_rendered, worker_rendered)
    build_room(static, badge_rendered, worker_rendered)
    print("Build complete.")


if __name__ == "__main__":
    main()
