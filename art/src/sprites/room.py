"""Room structure for the band scenes (PH1-06): floors, iso back walls, the cutaway
closet partitions, and the floor slab's front edge.

The spike's `wall` is a flat, front-facing panel; it can't line up along an isometric
edge, so a room needs these. `wall` itself is untouched (the manifest is a contract).

Every sprite here is placed like any other: anchor on `iso.iso_to_screen(col, row)` of
the tile it belongs to. Which *edge* of that tile it occupies is in the name:

  wall-back-r*     on the tile's back-right edge (a wall along +c, at r = 0), face lit
  wall-back-l*     on the tile's back-left edge  (a wall along +r, at c = 0), face shaded
  partition-c*     cutaway wall on the tile's front-left edge  (along +c, at r = 8)
  partition-r*     cutaway wall on the tile's front-right edge (along +r, at c = 8)
  slab-l / slab-r  the floor's thickness under the tile's front-left / front-right edge

Back walls are full height (40); partitions are cut away at 7 so the closet's contents
stay visible — the usual dollhouse convention — and their cut top is drawn dark
(`chair-dark`), the architectural sign for "this wall continues up; we sliced it". Wall runs tile seamlessly: segments are
outlined top and bottom only; `-end` variants close the run with a vertical line.
"""
from ..dsl import Canvas
from ..iso import diamond
from ..vox import Iso, make

WALL_H = 40
WALL_T = 1.5
PART_H = 7
PART_T = 1.0


# -- floors -------------------------------------------------------------------

def floor_tile(kind: str) -> Canvas:
    """Flat floor tiles. The spike's `floor` shades by halves, which reads as a pyramid
    once tiled; a floor is one plane, so these are one tone with a seam on the two back
    edges only (the next tile's seam closes the front)."""
    top, seam = {"office": ("floor-top", "floor-left"),
                 "closet": ("wall-trim", "badge-body")}[kind]
    c = Canvas(32, 16)
    iso = Iso(c, (16, 0))
    faces = iso.box_faces(0, 0, -1, 8, 8, 0)
    for (x, y), f in faces.items():
        if f == "T":
            c.point(x, y, top)
    # seams: back-left and back-right edges
    for (x, y), f in faces.items():
        if f == "T" and ((x - 1, y - 1) not in faces or (x + 1, y - 1) not in faces
                         or (x, y - 1) not in faces):
            if y <= 8:
                c.point(x, y, seam)
    return c


# -- walls ----------------------------------------------------------------------

def _wall_r(iso: Iso, window=False, end=False):
    faces = iso.box(0, -WALL_T, 0, 8, 0, WALL_H, top="wall-trim", left="wall",
                    right="wall-shadow", outline=None)
    iso.paint(faces, "L", 0, lambda c, z: "wall-trim" if z < 2.5 else None)
    if window:
        def win(c, z):
            if 1.5 <= c < 6.5 and 18 <= z < 33:
                if c < 1.9 or c >= 6.1 or z < 18.6 or z >= 32.4:
                    return "outline"
                if 3.8 <= c < 4.2 or 25 <= z < 25.6:
                    return "wall-trim"
                if z > 29 and c < 3:
                    return "glass-highlight"
                return "glass" if (c - 1.5) * 1.2 + (33 - z) * 0.3 < 5.5 else "glass-dark"
            return None
        iso.paint(faces, "L", 0, win)
    iso.outline(set(faces), "outline", "" if end else "v")
    return faces


def _wall_l(iso: Iso, door=False, window=False, end=False):
    faces = iso.box(-WALL_T, 0, 0, 0, 8, WALL_H, top="wall-trim", left="wall",
                    right="wall-shadow", outline=None)
    iso.paint(faces, "R", 0, lambda r, z: "wall-trim" if z < 2.5 else None)
    if door:
        # a glass front door with a push bar
        def d(r, z):
            if 1.5 <= r < 6.5 and 0 <= z < 26:
                if r < 1.9 or r >= 6.1 or z >= 25.4:
                    return "outline"
                if z < 2.5:
                    return "chair-dark"
                if 11 <= z < 12:
                    return "chair-mid"
                return "glass-dark" if r > 4.5 else "glass"
            return None
        iso.paint(faces, "R", 0, d)
    if window:
        def win(r, z):
            if 1.5 <= r < 6.5 and 18 <= z < 33:
                if r < 1.9 or r >= 6.1 or z < 18.6 or z >= 32.4:
                    return "outline"
                if 3.8 <= r < 4.2 or 25 <= z < 25.6:
                    return "wall-trim"
                return "glass-dark"
            return None
        iso.paint(faces, "R", 0, win)
    iso.outline(set(faces), "outline", "" if end else "v")
    return faces


def _corner(iso: Iso):
    faces = iso.box(-WALL_T, -WALL_T, 0, 0, 0, WALL_H, top="wall-trim", left="wall",
                    right="wall-shadow", outline=None)
    iso.outline(set(faces), "outline", "v")


# -- partitions (cutaway) ----------------------------------------------------------

def _partition_c(iso: Iso, end=False):
    faces = iso.box(0, 8 - PART_T, 0, 8, 8, PART_H, top="chair-dark", left="wall",
                    right="wall-shadow", outline=None)
    iso.outline(set(faces), "outline", "" if end else "v")


def _partition_r(iso: Iso, door: str | None = None, end=False):
    """door: None, "open" (doorway with the door swung back into the closet) or
    "closed" (a real door, shut, with a handle)."""
    if door is None:
        faces = iso.box(8, 0, 0, 8 + PART_T, 8, PART_H, top="chair-dark", left="wall",
                        right="wall-shadow", outline=None)
        iso.outline(set(faces), "outline", "" if end else "v")
        return
    # jambs either side of a doorway r 1.5 .. 6.5
    for r0, r1 in ((0, 1.5), (6.5, 8)):
        f = iso.box(8, r0, 0, 8 + PART_T, r1, PART_H, top="chair-dark", left="wall",
                    right="wall-shadow", outline=None)
        iso.outline(set(f), "outline")
    if door == "closed":
        f = iso.box(8.2, 1.5, 0, 8.8, 6.5, PART_H - 0.5, top="desk-wood",
                    left="desk-wood", right="desk-wood-dark")
        iso.paint(f, "R", 8.8, lambda r, z: "sticky" if 5.2 <= r < 5.8 and 4 <= z < 5 else None)
    else:
        # the door stands open, swung in against the closet side of the jamb
        iso.box(2.0, 6.5, 0, 8.0, 7.1, PART_H - 0.5, top="desk-wood",
                left="desk-wood", right="desk-wood-dark")


def _partition_c_door(iso: Iso):
    """PH1-07: a cutaway front wall on the tile's front-left edge (along +c at r = 8)
    with an open doorway, c 1.5 .. 6.5, and a door mat. The front door of band 150's
    HQ, where the courier comes to."""
    iso.box(1.8, 8 - PART_T, 0, 6.2, 8 + 0.8, 0.3, top="hair-1", left="hair-1",
            right="hair-1", outline=None)
    for c0, c1 in ((0, 1.5), (6.5, 8)):
        f = iso.box(c0, 8 - PART_T, 0, c1, 8, PART_H, top="chair-dark", left="wall",
                    right="wall-shadow", outline=None)
        iso.outline(set(f), "outline")
    # the door frame stands full height even though the wall is cut: two posts and a
    # lintel, so the opening reads as a front door and not a gap
    for c0 in (1.1, 6.5):
        iso.box(c0, 8 - PART_T, 0, c0 + 0.5, 8, 27, top="wall-trim", left="wall-trim",
                right="badge-body")
    iso.box(1.1, 8 - PART_T, 27, 6.9, 8, 29, top="wall-trim", left="wall-trim",
            right="badge-body")


def _partition_r_doorway(iso: Iso):
    """PH1-07: the same doorway on the tile's front-right edge (along +r at c = 8):
    cut jambs, a full-height frame, a mat. The inset office's front door."""
    iso.box(8 - PART_T, 1.8, 0, 8 + 0.8, 6.2, 0.3, top="hair-1", left="hair-1",
            right="hair-1", outline=None)
    for r0, r1 in ((0, 1.5), (6.5, 8)):
        f = iso.box(8, r0, 0, 8 + PART_T, r1, PART_H, top="chair-dark", left="wall",
                    right="wall-shadow", outline=None)
        iso.outline(set(f), "outline")
    for r0 in (1.1, 6.5):
        iso.box(8, r0, 0, 8 + PART_T, r0 + 0.5, 27, top="wall-trim", left="badge-body",
                right="wall-trim")
    iso.box(8, 1.1, 27, 8 + PART_T, 6.9, 29, top="wall-trim", left="badge-body",
            right="wall-trim")


# -- glass walls (PH1-07, band 220's conference room) -------------------------------

GLASS_H = 30        # full height: posts and door frames
GLASS_CUT = 11      # the panes, cut away just above table height


def _glass(iso: Iso, along: str, door=False, end=False, corner=False):
    """A glass wall on the tile's front-left edge (along "c", at r = 8) or front-right
    edge (along "r", at c = 8), **cut away** like every wall that would hide a room's
    contents (style.md "Cutaway rooms"): an aluminium sill, panes to GLASS_CUT with a
    frosted band and one glint each, and a `glass-highlight` cut top. What still stands
    full height is thin — the room's front corner posts (`corner`: at u = 0, `end`: at
    u = 8) and a door frame (`door`) — so the room reads as glass to the ceiling without
    anything but a 1 px line crossing the people inside. u runs 0..8 along the wall
    (for "r" walls, from the front end back)."""
    spans = [(0, 1.9), (6.1, 8)] if door else [(0, 8)]      # the doorway is open
    faces = {}
    for u0, u1 in spans:
        if along == "c":
            faces.update(iso.box_faces(u0, 8 - PART_T, 0, u1, 8, GLASS_CUT))
        else:
            faces.update(iso.box_faces(8, 8 - u1, 0, 8 + PART_T, 8 - u0, GLASS_CUT))
    face, plane = ("L", 8) if along == "c" else ("R", 8 + PART_T)

    def fn(u, z):
        if z < 1.5:
            return "badge-body"                    # sill
        if u < 0.7 or (end and u >= 7.3) or (door and (1.5 <= u < 1.9 or 6.1 <= u < 6.5)):
            return "badge-body"                    # mullions
        if 5.0 <= z < 7.0:
            return "glass"                         # frosted band
        g = u * 2 + z
        if 9.0 <= g < 10.0 and z >= 2:
            return "glass-highlight"               # one glint per pane
        return None
    if face == "L":
        iso.paint(faces, "L", plane, lambda c, z: fn(c, z))
    else:
        iso.paint(faces, "R", plane, lambda r, z: fn(8 - r, z))
    for (x, y), f in faces.items():
        if f == "T":
            iso.c.point(x, y, "glass-highlight")   # the cut top
    for (x, y), f in faces.items():               # sill line under it all
        if f == face and (x, y + 1) not in faces:
            iso.c.point(x, y, "outline")

    def post(u0, u1, z1):
        if along == "c":
            iso.box(u0, 8 - PART_T, 0, u1, 8, z1, top="badge-body", left="badge-body",
                    right="wall-shadow", outline=None)
        else:
            iso.box(8, 8 - u1, 0, 8 + PART_T, 8 - u0, z1, top="badge-body",
                    left="badge-body", right="wall-shadow", outline=None)
    if corner:
        post(0, 0.7, GLASS_H)
    if end:
        post(7.3, 8, GLASS_H)
    if door:
        post(1.5, 1.9, 24)
        post(6.1, 6.5, 24)
        if along == "c":
            iso.box(1.5, 8 - PART_T, 23, 6.5, 8, 24.5, top="badge-body",
                    left="badge-body", right="wall-shadow", outline=None)
        else:
            iso.box(8, 1.5, 23, 8 + PART_T, 6.5, 24.5, top="badge-body",
                    left="badge-body", right="wall-shadow", outline=None)


def _slab_l(iso: Iso):
    iso.box(0, 7.9, -5, 8, 8, 0, top=None, left="floor-left", right="floor-right",
            outline=None)
    faces = iso.box_faces(0, 7.9, -5, 8, 8, 0)
    iso.outline(set(faces), "outline", "v")


def _slab_r(iso: Iso):
    iso.box(7.9, 0, -5, 8, 8, 0, top=None, left="floor-left", right="floor-right",
            outline=None)
    faces = iso.box_faces(7.9, 0, -5, 8, 8, 0)
    iso.outline(set(faces), "outline", "v")


LOWER_H = 15.0      # how much of the storey below an upper floor shows under its slab


def _slab_upper(iso: Iso, side: str):
    """DIA-5 item 3: an upper floor's slab sits on the top of the storey below it — a
    strip of exterior wall with its row of windows, cut off square — so floor-2 reads
    as upstairs, not as a second ground-floor room. The windows are HQ's (street.py),
    so the room below is recognisably the same building. One tile's run of it."""
    if side == "l":
        _slab_l(iso)
        f = iso.box(0, 7.9, -5 - LOWER_H, 8, 8, -5, top=None, left="wall", right=None,
                    outline=None)
        iso.paint(f, "L", 8, _lower_window("glass"))
        iso.outline(set(f), "outline", "v")
    else:
        _slab_r(iso)
        f = iso.box(7.9, 0, -5 - LOWER_H, 8, 8, -5, top=None, left=None,
                    right="wall-shadow", outline=None)
        iso.paint(f, "R", 8, _lower_window("glass-dark"))
        iso.outline(set(f), "outline", "v")


def _lower_window(glass: str):
    z0, z1 = -5 - LOWER_H + 3.0, -5 - 2.0

    def fn(u, z):
        if not (1.8 <= u < 6.2 and z0 <= z < z1):
            return None
        if u < 2.3 or u >= 5.7 or z < z0 + 0.6 or z >= z1 - 0.6:
            return "outline"
        if abs(u - 4.0) < 0.3:
            return "wall-trim"
        if z > z1 - 3 and u < 3.4:
            return "glass-highlight"
        return glass
    return fn


def build_all() -> dict:
    """{name: Sprite}. Floors are returned as Sprites too (anchor (16, 16))."""
    from ..vox import Sprite
    out = {
        "floor-office": Sprite(floor_tile("office"), (16, 16)),
        "floor-closet": Sprite(floor_tile("closet"), (16, 16)),
        "wall-back-r": make(lambda iso, c: _wall_r(iso) and None),
        "wall-back-r-window": make(lambda iso, c: _wall_r(iso, window=True) and None),
        "wall-back-r-end": make(lambda iso, c: _wall_r(iso, end=True) and None),
        "wall-back-l": make(lambda iso, c: _wall_l(iso) and None),
        "wall-back-l-window": make(lambda iso, c: _wall_l(iso, window=True) and None),
        "wall-back-l-door": make(lambda iso, c: _wall_l(iso, door=True) and None),
        "wall-back-l-end": make(lambda iso, c: _wall_l(iso, end=True) and None),
        "wall-corner": make(lambda iso, c: _corner(iso)),
        "partition-c": make(lambda iso, c: _partition_c(iso)),
        "partition-c-end": make(lambda iso, c: _partition_c(iso, end=True)),
        "partition-r": make(lambda iso, c: _partition_r(iso)),
        "partition-r-end": make(lambda iso, c: _partition_r(iso, end=True)),
        "partition-r-door-open": make(lambda iso, c: _partition_r(iso, "open")),
        "partition-r-door-closed": make(lambda iso, c: _partition_r(iso, "closed")),
        "partition-c-door-open": make(lambda iso, c: _partition_c_door(iso)),
        "partition-r-doorway": make(lambda iso, c: _partition_r_doorway(iso)),
        "glass-c": make(lambda iso, c: _glass(iso, "c")),
        "glass-c-corner": make(lambda iso, c: _glass(iso, "c", corner=True)),
        "glass-c-end": make(lambda iso, c: _glass(iso, "c", end=True)),
        "glass-r": make(lambda iso, c: _glass(iso, "r")),
        "glass-r-door": make(lambda iso, c: _glass(iso, "r", door=True)),
        "slab-l": make(lambda iso, c: _slab_l(iso)),
        "slab-r": make(lambda iso, c: _slab_r(iso)),
        "slab-l-upper": make(lambda iso, c: _slab_upper(iso, "l")),
        "slab-r-upper": make(lambda iso, c: _slab_upper(iso, "r")),
    }
    return out
