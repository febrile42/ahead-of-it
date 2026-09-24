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
        "slab-l": make(lambda iso, c: _slab_l(iso)),
        "slab-r": make(lambda iso, c: _slab_r(iso)),
    }
    return out
