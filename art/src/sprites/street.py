"""The street (PH1-10): HQ seen from outside, on a pavement plate, so the `street` view
is a whole exterior rather than the edge of the ground-floor room cropped.

  pavement   the plate's tile: light paving, seams on the back edges (like floor tiles)
  hq-3/hq-4  HQ as a building: a block 7 tiles along +c and 3 deep, a storey per floor
             of the band's narrative (`BANDS-AND-GAGS.md`: three floors at 150, four at
             220), a flat roof behind a parapet, windows on both visible faces. No sign,
             no name (D-014). Anchor: the front vertex of the block's front-most tile.
  hq-door    HQ's front door on the block's front-left face, with an awning over it.
             `open` (without: someone is standing in it, handing over the envelope) and
             `closed` (built: glass door, push bar). Anchor: its tile's front vertex.

World units as everywhere (style.md): a tile is 8 x 8, +z up, 1 unit = 1 px.
"""
from __future__ import annotations

from ..dsl import Canvas
from ..vox import Iso, Sprite, make

GROUND_H = 28        # the ground storey: tall enough for the door and a person
STOREY_H = 20        # every storey above it
PARAPET = 3

# the block, relative to its anchor tile (c 0..8, r 0..8 is the anchor tile)
BLOCK = dict(c0=-48.0, c1=8.0, r0=-16.0, r1=8.0)


def pavement() -> Canvas:
    """One plane of paving, a seam on the two back edges (the next tile closes the
    front), like `floor_tile` in room.py."""
    c = Canvas(32, 16)
    iso = Iso(c, (16, 0))
    faces = iso.box_faces(0, 0, -1, 8, 8, 0)
    for (x, y), f in faces.items():
        if f == "T":
            c.point(x, y, "wall-shadow")
    for (x, y), f in faces.items():
        if f == "T" and ((x - 1, y - 1) not in faces or (x + 1, y - 1) not in faces
                         or (x, y - 1) not in faces):
            if y <= 8:
                c.point(x, y, "wall-trim")
    return c


def _window(u0, u1, z0, z1, dark_from):
    """A window in face-local (u, z): outlined frame, a mullion, glass, glint top-left."""
    def fn(u, z):
        if not (u0 <= u < u1 and z0 <= z < z1):
            return None
        if u < u0 + 0.5 or u >= u1 - 0.5 or z < z0 + 0.6 or z >= z1 - 0.6:
            return "outline"
        if abs(u - (u0 + u1) / 2) < 0.3:
            return "wall-trim"
        if z > z1 - 3 and u < u0 + 1.6:
            return "glass-highlight"
        return "glass-dark" if u >= dark_from(u0, u1) else "glass"
    return fn


# PH1-11: from 360 HQ is a narrower, taller block (4 tiles along +c, 3 deep) at the
# street plate's back-right, so five and six storeys still fit D-036's 240 px and the
# inset office on the left is never behind it. Its door is on the same tile offset.
BLOCK_N = dict(c0=-24.0, c1=8.0, r0=-16.0, r1=8.0)


def _hq(iso: Iso, c: Canvas, floors: int, b=BLOCK, vent=True):
    top = GROUND_H + STOREY_H * (floors - 1)
    iso.floor_shadow(b["c0"], b["r0"], b["c1"], b["r1"], grow=2.0, grow_r=0.8)
    f = iso.box(b["c0"], b["r0"], 0, b["c1"], b["r1"], top + PARAPET, top="wall-trim",
                left="wall", right="wall-shadow", outline=None)
    # the storey lines and a plinth, then windows on both faces, one per tile per storey
    levels = [(0, GROUND_H)] + [(GROUND_H + STOREY_H * k, GROUND_H + STOREY_H * (k + 1))
                                for k in range(floors - 1)]

    def front_left(u, z):             # u = c, along the +r face (lit)
        if z < 2.0:
            return "wall-trim"
        if any(abs(z - lo) < 0.5 for lo, _ in levels[1:]) or abs(z - top) < 0.5:
            return "wall-trim"
        for k, (lo, hi) in enumerate(levels):
            for t in range(int(b["c0"] // 8), int(b["c1"] // 8)):
                u0 = t * 8.0
                if k == 0:
                    if t == -2:         # the door's tile: hq-door draws it
                        continue
                    w = _window(u0 + 1.2, u0 + 6.8, lo + 7, hi - 5, lambda a, bb: a + 3.8)
                else:
                    w = _window(u0 + 1.8, u0 + 6.2, lo + 5, hi - 4, lambda a, bb: a + 3.2)
                col = w(u, z)
                if col:
                    return col
        return None

    def front_right(r, z):            # u = r, along the +c face (shaded)
        if z < 2.0:
            return "wall-trim"
        if any(abs(z - lo) < 0.5 for lo, _ in levels[1:]) or abs(z - top) < 0.5:
            return "wall-trim"
        for k, (lo, hi) in enumerate(levels):
            for t in range(int(b["r0"] // 8), int(b["r1"] // 8)):
                u0 = t * 8.0
                zz = (lo + 7, hi - 5) if k == 0 else (lo + 5, hi - 4)
                w = _window(u0 + 1.8, u0 + 6.2, zz[0], zz[1], lambda a, bb: a + 1.0)
                col = w(r, z)
                if col:
                    return "glass-dark" if col == "glass" else col
        return None

    iso.paint(f, "L", b["r1"], front_left)
    iso.paint(f, "R", b["c1"], front_right)
    iso.outline(set(f), "outline")
    # the roof, sunk behind the parapet: a darker plane inset by a unit and a half
    roof = iso.box_faces(b["c0"] + 1.5, b["r0"] + 1.5, top + PARAPET - 0.01,
                         b["c1"] - 1.5, b["r1"] - 1.5, top + PARAPET)
    for (x, y), ff in roof.items():
        if ff == "T":
            c.point(x, y, "badge-body")
    # the parapet's inner lip catches the light on the back edges only
    for (x, y), ff in roof.items():
        if ff == "T" and ((x, y - 1) not in roof):
            c.point(x, y, "wall-shadow")
    # a plant box on the roof and a vent, so the roof reads as a roof
    if vent:
        iso.box(b["c1"] - 14, b["r0"] + 4, top + PARAPET, b["c1"] - 9, b["r0"] + 8,
                top + PARAPET + 4, top="chair-mid", left="badge-body", right="chair-dark")


def _hq_door(iso: Iso, c: Canvas, open_: bool):
    """On the front-left face (plane r = 8) of its tile, c 1.5 .. 6.5: a frame, the
    doorway, a step and mat, an awning above."""
    R = 8.0
    # a step and the mat in front
    iso.box(1.0, R, 0, 7.0, R + 2.0, 0.8, top="wall-trim", left="wall-trim",
            right="badge-body")
    iso.box(2.2, R + 0.4, 0.8, 5.8, R + 1.6, 0.9, top="hair-1", left="hair-1",
            right="hair-1", outline=None)
    # the frame, standing proud of the face by a hair so it paints over it
    f = iso.box(1.0, R - 0.2, 0.8, 7.0, R + 0.2, 26.0, top="wall-trim", left="wall-trim",
                right="badge-body")

    def door(u, z):
        if 1.6 <= u < 6.4 and z < 25.0:
            if open_:
                # the doorway: dark inside, the door leaf swung in (its edge on the left)
                if u < 2.4:
                    return "desk-wood-dark"
                return "chair-dark" if z > 3 else "hair-1"
            if u < 2.0 or u >= 6.0 or z >= 24.4:
                return "outline"
            if 11 <= z < 12:
                return "chair-mid"                     # push bar
            return "glass-dark" if u > 4.5 else "glass"
        return None
    iso.paint(f, "L", R + 0.2, door)
    # the awning: a slab out over the step
    iso.box(0.4, R - 0.2, 27.0, 7.6, R + 3.0, 28.4, top="badge-red", left="shirt-3-dark",
            right="shirt-3-dark")


def build_all() -> dict:
    pv = pavement()
    out = {
        "pavement": Sprite(pv, (16, 16)),
        "hq-3": make(lambda iso, c: _hq(iso, c, 3), size=360),
        "hq-4": make(lambda iso, c: _hq(iso, c, 4), size=360),
        "hq-5": make(lambda iso, c: _hq(iso, c, 5, BLOCK_N), size=360),
        "hq-6": make(lambda iso, c: _hq(iso, c, 6, BLOCK_N, vent=False), size=360),
    }
    # the door: two frames under one key, sharing a canvas (the union of both)
    door_open = make(lambda iso, c: _hq_door(iso, c, True))
    door_closed = make(lambda iso, c: _hq_door(iso, c, False))
    assert (door_open.w, door_open.h, door_open.anchor) == \
        (door_closed.w, door_closed.h, door_closed.anchor)
    door_open.anims = {"open": ([door_open.canvas], 0), "closed": ([door_closed.canvas], 0)}
    out["hq-door"] = door_open
    return out
