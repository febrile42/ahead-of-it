"""Pixel-exact isometric solids (PH1-06).

The spike's `iso.iso_box` traces edges with `diag_line`, which rounds 2:1 slopes into
uneven stairs and only supports square footprints. Band-80 props (shelves, racks, sofas,
walls, a desk you can sit at) need rectangular boxes whose edges tile seamlessly with the
floor grid, so this module rasterises by *inverse projection* instead: for every pixel
it asks "which face of the box is under this pixel's centre?". The result is the standard
pixel-art iso stair (two pixels across, one down) on every edge, and a box that is exactly
one tile wide rasterises to exactly the floor-tile diamond.

World units (see art/style.md "World units"): one tile is 8 x 8 units on the floor;
+c (column) runs down-right on screen, +r (row) runs down-left, +z is up, 1 unit = 1 px.

    screen_x = ox + 2 * (c - r)
    screen_y = oy + (c + r) - z

(ox, oy) is the screen point of world (0, 0, 0). For a sprite anchored on one floor
tile, pass `tile_origin(canvas)`: the tile's back vertex sits 16 px above the canvas's
bottom-centre anchor.
"""
from __future__ import annotations

from .dsl import Canvas

TILE = 8  # world units per tile edge


def tile_origin(canvas: Canvas) -> tuple[float, float]:
    """World (0,0,0) for a sprite whose anchor is the bottom-centre of its canvas and
    whose footprint is the one floor tile under that anchor."""
    return canvas.w / 2, canvas.h - 16


class Iso:
    """Draws solids onto `canvas` in world coordinates around origin (ox, oy)."""

    def __init__(self, canvas: Canvas, origin: tuple[float, float] | None = None):
        self.c = canvas
        self.ox, self.oy = origin if origin is not None else tile_origin(canvas)

    # -- projection ---------------------------------------------------------
    def pt(self, c: float, r: float, z: float = 0) -> tuple[int, int]:
        """Pixel whose top-left corner is the projection of (c, r, z)."""
        return (int(self.ox + 2 * (c - r)), int(self.oy + (c + r) - z))

    def left_px(self, r: float, c: float, z: float) -> tuple[int, int]:
        """Pixel on a +r-facing ('left', lit) face lying in plane r, at (c, z)."""
        return (int(self.ox + 2 * (c - r) + 1), int(self.oy + (c + r) - z - 1))

    def right_px(self, c: float, r: float, z: float) -> tuple[int, int]:
        """Pixel on a +c-facing ('right', shaded) face lying in plane c, at (r, z)."""
        return (int(self.ox + 2 * (c - r) - 1), int(self.oy + (c + r) - z - 1))

    # -- rasterisation --------------------------------------------------------
    def box_faces(self, c0, r0, z0, c1, r1, z1) -> dict:
        """{(x, y): 'T' | 'L' | 'R'} — which visible face of the box covers each pixel
        centre. T = top (z = z1), L = the +r face (lit), R = the +c face (shaded)."""
        ox, oy = self.ox, self.oy
        xs = [ox + 2 * (c - r) for c in (c0, c1) for r in (r0, r1)]
        ys = [oy + (c + r) - z for c in (c0, c1) for r in (r0, r1) for z in (z0, z1)]
        faces = {}
        for y in range(int(min(ys)) - 1, int(max(ys)) + 2):
            for x in range(int(min(xs)) - 1, int(max(xs)) + 2):
                px, py = x + 0.5 - ox, y + 0.5 - oy
                col = (px / 2 + py + z1) / 2
                row = (py + z1 - px / 2) / 2
                if c0 <= col < c1 and r0 <= row < r1:
                    faces[(x, y)] = "T"
                    continue
                col = px / 2 + r1
                z = col + r1 - py
                if c0 <= col < c1 and z0 <= z < z1:
                    faces[(x, y)] = "L"
                    continue
                row = c1 - px / 2
                z = c1 + row - py
                if r0 <= row < r1 and z0 <= z < z1:
                    faces[(x, y)] = "R"
        return faces

    def box(self, c0, r0, z0, c1, r1, z1, top, left, right,
            outline: str | None = "outline", edge: str | None = None,
            open_sides: str = "") -> dict:
        """Draw a box; return its {(x, y): face} map for further detailing.

        `outline` traces the silhouette. `edge` (optional) draws the seams between faces
        — the top face's front edges and the front vertical corner — so boxes whose faces
        share a colour still read as solid. `open_sides` may contain "l" / "r": leave the
        leftmost / rightmost silhouette column un-outlined (wall segments that join a
        neighbour)."""
        faces = self.box_faces(c0, r0, z0, c1, r1, z1)
        colour = {"T": top, "L": left, "R": right}
        for (x, y), f in faces.items():
            if colour[f] is not None:
                self.c.point(x, y, colour[f])
        if edge:
            for (x, y), f in faces.items():
                below = faces.get((x, y + 1))
                if f == "T" and below in ("L", "R"):
                    self.c.point(x, y, edge)
                elif f == "L" and faces.get((x + 1, y)) == "R":
                    self.c.point(x, y, edge)
        if outline:
            self.outline(set(faces), outline, open_sides)
        return faces

    def paint(self, faces: dict, face: str, plane: float, fn):
        """Repaint the pixels of one face using face-local world coordinates.

        face "L" lies in plane r = plane; fn(c, z) -> colour | None.
        face "R" lies in plane c = plane; fn(r, z) -> colour | None.
        face "T" lies in plane z = plane; fn(c, r) -> colour | None.
        Returning None leaves the pixel as it is. This is how screen content, stickers
        and labels skew correctly with the surface they are on."""
        for (x, y), f in faces.items():
            if f != face:
                continue
            px, py = x + 0.5 - self.ox, y + 0.5 - self.oy
            if face == "L":
                c = px / 2 + plane
                col = fn(c, c + plane - py)
            elif face == "R":
                r = plane - px / 2
                col = fn(r, plane + r - py)
            else:
                col = fn((px / 2 + py + plane) / 2, (py + plane - px / 2) / 2)
            if col is not None:
                self.c.point(x, y, col)

    def outline(self, pts: set, colour: str, open_sides: str = ""):
        """Paint every pixel of `pts` that touches the outside (4-neighbour) in `colour`."""
        if not pts:
            return
        xs = [p[0] for p in pts]
        minx, maxx = min(xs), max(xs)
        for (x, y) in pts:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if (x + dx, y + dy) in pts:
                    continue
                if "l" in open_sides and x == minx and dx == -1:
                    continue
                if "r" in open_sides and x == maxx and dx == 1:
                    continue
                self.c.point(x, y, colour)
                break

    def floor_shadow(self, c0, r0, c1, r1, grow: float = 1.5, grow_r: float = 0.5,
                     colour: str = "shadow"):
        """Ground-contact shadow for a box footprint (style.md "Shadows"): the footprint
        grown by `grow` toward +c (light comes from the top-left, so shadow falls toward
        screen down-right) and by a thinner `grow_r` toward +r so the front edge also
        sits on something. Draw it before the object."""
        faces = self.box_faces(c0, r0, 0, c1 + grow, r1 + grow_r, 0.001)
        for (x, y), f in faces.items():
            if f == "T":
                self.c.point(x, y, colour)


def dotted(canvas: Canvas, p0, p1, colour: str = "net", on: int = 1, period: int = 3,
           phase: int = 0, halo: str | None = None):
    """The 'on the network' convention (style.md): a 1 px dotted line, `on` pixels lit
    out of every `period`, stepping along the dominant axis. Optional `halo` puts a
    1 px dark pixel under each dot so it reads on light and dark ground alike."""
    x0, y0 = p0
    x1, y1 = p1
    dx, dy = x1 - x0, y1 - y0
    steps = max(abs(dx), abs(dy))
    if steps == 0:
        return
    for i in range(steps + 1):
        if (i + phase) % period >= on:
            continue
        x = x0 + (dx * i) // steps if dx >= 0 else x0 - ((-dx) * i) // steps
        y = y0 + (dy * i) // steps if dy >= 0 else y0 - ((-dy) * i) // steps
        if halo:
            canvas.point(x, y + 1, halo)
        canvas.point(x, y, colour)
