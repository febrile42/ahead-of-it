"""Band 150 props (PH1-07), both states. `docs/content/BANDS-AND-GAGS.md` §150.

Same conventions as band80.py: every prop is a `vox.Sprite` anchored on the front vertex
of the tile it is placed on; billboards (cards, notes, signs) anchor where they touch
what they belong to.

Without
  G3.2  trolley             a supermarket trolley of laptops parked by the closet, one
                            with a `DAVE?` sticky note
        desk-retail-box     a laptop still in its shop box, on the CEO's desk
  G4.2  fishing-line        a line from above the ceiling, hook, envelope on the hook,
                            hanging in front of the finance monitor
  G4.3  desk-turned-sheet   (+ desk-sheet) back-to-back desks, a spreadsheet on each,
        card-customers      the `CUSTOMERS` card taped to each monitor
  G5.1  road-*              the road between HQ and the inset office, a dashed line
        truck               a tiny courier truck on it (2-frame `drive`)
        envelope            (in worker-give's hand) a padded envelope, hard-drive bulge

Built
  G3.2  laptop-shelf        a shelf of identical tagged laptops, green lights
  G4.2  fishing-shield      the hook bounced off a small shield over the monitor
        card-report         a `REPORT` button on the finance monitor
  G4.3  sign-pipeline       one screen: CRM > ERP > HRIS
  G5.1  link-*              a solid network link along the road, blinking
"""
from __future__ import annotations

from ..dsl import Canvas
from ..vox import Iso, SwapIso, Sprite, make, make_anim
from .. import glyphs
from . import desk as desk_mod
from .band80 import _thick, _rows


def _card(text: str, fill="paper", ink="outline", tape=True, pad=1) -> Canvas:
    """A billboarded card in the 3x5 glyphs, 1 px outline. Anchor: bottom centre."""
    tw = glyphs.text_width(text)
    w, h = tw + 2 * pad + 2, 5 + 2 * max(pad, 1) + 2
    c = Canvas(w, h + (1 if tape else 0))
    c.rect(0, 0, w - 1, h - 1, "outline")
    c.rect(1, 1, w - 2, h - 2, fill)
    glyphs.draw(c, text, 1 + pad, 1 + max(pad, 1), ink)
    if tape:
        c.point(2, h, "wall-shadow")
        c.point(w - 3, h, "wall-shadow")
    return c


# -- G3.2 without: the trolley -------------------------------------------------------

def _laptop_flat(iso: Iso, c0, r0, z, lid="chair-mid", w=3.2, d=2.4):
    """A closed laptop lying flat: a thin slab."""
    iso.box(c0, r0, z, c0 + w, r0 + d, z + 0.9, top=lid, left="badge-body",
            right="chair-dark", outline="outline")


def _laptop_open(iso: Iso, c0, r0, z, w=3.0):
    """An open laptop standing in the pile, screen toward the viewer (+r)."""
    iso.box(c0, r0, z, c0 + w, r0 + 2.0, z + 0.7, top="chair-mid", left="badge-body",
            right="chair-dark")
    f = iso.box(c0, r0 - 0.4, z, c0 + w, r0, z + 4.2, top="chair-dark",
                left="monitor-frame", right="outline")
    iso.paint(f, "L", r0, lambda cc, zz: "monitor-screen"
              if c0 + 0.4 <= cc < c0 + w - 0.4 and z + 0.8 <= zz < z + 3.6 else None)


def _laptop_tilted(iso: Iso, c0, r0, z, w=3.2):
    """An open laptop whose lid leans back at an angle, screen lit toward the viewer."""
    iso.box(c0, r0, z, c0 + w, r0 + 2.2, z + 0.7, top="chair-mid", left="badge-body",
            right="chair-dark")
    for k in range(5):                                   # the lid, stepping back as it rises
        rr = r0 - 0.35 * k
        f = iso.box(c0, rr - 0.5, z + 0.7 + k, c0 + w, rr, z + 1.7 + k, top="chair-dark",
                    left="monitor-frame", right="outline", outline=None)
        if 1 <= k <= 3:
            iso.paint(f, "L", rr, lambda cc, zz: "monitor-screen"
                      if c0 + 0.5 <= cc < c0 + w - 0.5 else None)
    iso.box(c0, r0 - 2.3, z + 5.4, c0 + w, r0 - 1.6, z + 5.8, top="outline",
            left="outline", right="outline", outline=None)   # the lid's top edge


def _trolley(iso: Iso, c: Canvas):
    """PH1-10: drawn to read as a supermarket trolley at 1x. Long axis along +c. A
    chrome wire basket (a light grid over a dark load) raised on a chassis with daylight
    under it and castors at the corners; the handle rises at the +c end with a red grip
    standing clear above the load; closed laptops heaped over the rim, two lids open
    and leaning back, screens lit."""
    B0, B1, R0, R1 = 0.5, 15.0, 1.0, 7.0
    ZB, ZT = 7.0, 14.0                              # basket bottom / rim
    iso.floor_shadow(B0, R0, B1, R1, grow=1.0, grow_r=0.4)
    # chassis: two low rails, and a castor under each corner
    for rr in (R0 + 1.0, R1 - 1.2):
        iso.box(B0 + 0.8, rr, 1.6, B1 - 1.2, rr + 0.5, 2.1, top="badge-body",
                left="chair-mid", right="chair-mid", outline=None)
    for cc, rr in ((B0 + 1.0, R0 + 1.0), (B1 - 1.6, R0 + 1.0),
                   (B0 + 1.0, R1 - 0.8), (B1 - 1.6, R1 - 0.8)):
        x, y = iso.pt(cc, rr, 0)
        c.rect(x - 1, y - 1, x, y, "outline")
        c.point(x, y - 2, "badge-body")
    # four legs from the rails up to the basket floor
    for cc, rr in ((B0 + 0.8, R1 - 0.7), (B1 - 1.2, R1 - 0.7), (B1 - 1.2, R0 + 0.7),
                   (B0 + 0.8, R0 + 0.7)):
        x, y = iso.pt(cc, rr, 2.1)
        for k in range(0, 6):
            c.point(x, y - k, "badge-body")
    # the load: the basket is full to the rim, then heaped above it
    stack = iso.box(B0 + 0.3, R0 + 0.3, ZB, B1 - 0.3, R1 - 0.3, ZT - 0.5, top="chair-dark",
                    left="chair-mid", right="chair-dark", outline=None)

    def edges(u, z):
        k = int((z - ZB) // 1.5)
        if (z - ZB) % 1.5 < 0.6:
            return "outline"
        if k % 3 == 1 and int(u // 5) % 2 == 0:
            return "monitor-screen"
        return ("chair-dark", "chair-mid", "monitor-frame")[k % 3]
    iso.paint(stack, "L", R1 - 0.3, edges)
    iso.paint(stack, "R", B1 - 0.3, lambda u, z: "chair-dark" if (z - ZB) % 1.5 < 0.6 else "chair-mid")
    top = ZT
    for i, (cc, rr, zz) in enumerate(((1.6, 2.0, top - 1.2), (5.0, 2.2, top - 0.8),
                                      (8.6, 2.0, top - 1.0), (11.8, 2.4, top - 1.0),
                                      (3.2, 3.2, top + 0.2), (9.8, 3.4, top + 0.4),
                                      (1.6, 4.2, top - 0.2), (12.0, 4.4, top - 0.4))):
        _laptop_flat(iso, cc, rr, zz, lid=("chair-mid", "monitor-frame", "chair-dark")[i % 3],
                     w=3.4, d=2.6)
    _laptop_tilted(iso, 3.0, 4.8, top + 0.8)
    _laptop_tilted(iso, 8.4, 4.6, top + 1.2)
    # the basket: an open wire box — only its two visible sides, as a grid
    f = iso.box_faces(B0, R0, ZB, B1, R1, ZT)
    lit = {k: v for k, v in f.items() if v in ("L", "R")}

    def wire(face, u, z):
        if z >= ZT - 0.9:
            return "paper" if face == "L" else "wall-shadow"      # the rim
        if z < ZB + 0.8:
            return "wall-trim"                                    # the basket floor
        if u % 2.0 < 0.6 or (z - ZB) % 3.0 < 0.7:
            return "wall-shadow" if face == "L" else "wall-trim"  # chrome wire
        return None
    for (x, y), face in lit.items():
        px, py = x + 0.5 - iso.ox, y + 0.5 - iso.oy
        if face == "L":
            u = px / 2 + R1
            z = u + R1 - py
        else:
            u = B1 - px / 2
            z = B1 + u - py
        col = wire(face, u, z)
        if col:
            c.point(x, y, col)
    iso.outline(set(f), "outline")
    # the handle at the +c end (nose toward the closet), so it stands against open
    # floor: two posts climbing up and out, a red grip across, clear above the heap
    HZ = ZT + 7.0
    for rr in (R0 + 0.4, R1 - 0.4):
        _thick(iso, [(B1, rr, ZT - 1.0), (B1 + 2.0, rr, HZ)], "wall-trim", width=1)
    _thick(iso, [(B1 + 2.2, R0 - 0.2, HZ), (B1 + 2.2, R1 + 0.2, HZ)], "badge-red", width=2)
    # the note hangs low on the basket's near side, over the wire
    x, y = iso.pt(11.5, R1, ZB + 2.0)
    return {"note": (x, y)}


def note_dave() -> Canvas:
    """Yellow sticky note, `DAVE?` in the glyphs. Nobody knows whose laptop this was."""
    return _card("DAVE?", fill="sticky", tape=False, pad=1)


# -- G3.2 built: the laptop shelf ------------------------------------------------------

def _laptop_shelf(iso: Iso, c: Canvas):
    """Grey shelving with a back panel; on each of two shelves four identical laptops
    stand lid-out, each with a white asset tag and a green 'managed' light."""
    C0, C1, R0, R1 = 1.0, 15.0, 0.8, 4.6
    iso.floor_shadow(C0, R0, C1, R1, grow=1.0)
    iso.box(C0, R0, 0, C1, R0 + 0.5, 21, top="wall-trim", left="wall-shadow",
            right="wall-trim")                                  # back panel
    for cc in (C0, C1 - 0.8):
        iso.box(cc, R0, 0, cc + 0.8, R1, 21, top="wall-trim", left="badge-body",
                right="chair-mid")
    for z in (1.0, 10.5):
        iso.box(C0 + 0.8, R0 + 0.5, z, C1 - 0.8, R1, z + 1, top="wall-trim",
                left="badge-body", right="chair-mid")
        for k in range(4):
            cc = C0 + 1.5 + k * 3.1
            f = iso.box(cc, 2.4, z + 1, cc + 2.6, 3.1, z + 7.5, top="chair-mid",
                        left="monitor-frame", right="outline")

            def lid(u, zz, cc=cc, z=z):
                if z + 5.0 <= zz < z + 6.0 and cc + 0.5 <= u < cc + 1.8:
                    return "paper"            # asset tag
                if z + 2.5 <= zz < z + 3.5 and cc + 1.9 <= u < cc + 2.4:
                    return "badge-green"      # managed, encrypted, wipeable
                return None
            iso.paint(f, "L", 3.1, lid)
    iso.box(C0, R0, 20, C1, R1, 21, top="wall-trim", left="badge-body", right="chair-mid")


# -- G3.2 without: a laptop in its shop box, on the CEO's desk ------------------------

def desk_retail_box() -> Canvas:
    """The plain desk with a retail laptop box on it: white carton, a blue band and a
    picture of the laptop inside. Arrived at the front door, bought on a card."""
    c = desk_mod.build("plain")
    iso = Iso(c)
    top = desk_mod.DESK["top"] + desk_mod.DESK["slab"]
    f = iso.box(0.7, 1.2, top, 3.7, 3.9, top + 6.5, top="paper", left="paper",
                right="wall-shadow")

    def side(u, z):
        if top + 5.0 <= z < top + 6.0:
            return "shirt-1"                          # the brand band
        if 1.2 <= u < 3.2 and top + 0.8 <= z < top + 4.4:
            if z < top + 1.6:
                return "chair-mid"                    # the laptop's base
            return "monitor-screen" if 1.6 <= u < 2.8 and z >= top + 2.2 else "monitor-frame"
        return None
    iso.paint(f, "L", 3.9, side)
    iso.paint(f, "R", 3.7, lambda r, z: "shirt-1-dark" if top + 5.0 <= z < top + 6.0 else None)
    return c


# -- G4.2: the fish ---------------------------------------------------------------------

# PH1-10 fix round: the finance desk stands a tile off the back wall, so the line hangs
# in open air. It hangs between the worker's head and the monitor (r 2 .. 6), above the
# screen's top edge so the envelope is never read as screen content.
FISH_C, FISH_R = 4.4, 3.4
WALL_R = -8.0                      # the back wall, relative to the desk's tile (a tile back)


def _rod_and_line(iso: Iso, c: Canvas, z_hook: float, x_shift=0):
    """A long rod angled down over the top of the back wall from somewhere beyond it,
    its tip out over the desk, and the line straight down off the tip."""
    tip_z = 44.0
    _thick(iso, [(FISH_C - 5.0, WALL_R - 5.0, 52.0), (FISH_C, FISH_R, tip_z)],
           "desk-wood-dark", width=1)
    x0, y0 = iso.pt(FISH_C, FISH_R, tip_z)
    x1, y1 = iso.pt(FISH_C, FISH_R, z_hook)
    for y in range(y0 + 1, y1):
        t = (y - y0) / max(1, y1 - y0)
        c.point(x0 + round(x_shift * t * t), y, "outline")
    return x1 + x_shift, y1


def _hook(c: Canvas, x, y):
    """A J hook, 5 x 9, hung from (x, y): a ring eye where the line ties on, the shank,
    the bend and the barbed point turned back up — a clear J against the wall."""
    for (dx, dy) in ((-1, 0), (0, 0), (1, 0), (-1, 1), (1, 1), (-1, 2), (0, 2), (1, 2)):
        c.point(x + dx, y + dy, "outline")                        # the eye
    for dy in range(3, 8):
        c.point(x, y + dy, "badge-body")                          # the shank
        c.point(x + 1, y + dy, "outline")
    for (dx, dy) in ((0, 8), (-1, 8), (-2, 8), (-3, 7), (-3, 6), (-3, 5)):
        c.point(x + dx, y + dy, "outline")                        # the bend, the point
    c.point(x - 2, y + 5, "outline")                              # the barb
    c.point(x - 1, y + 7, "badge-body")


def _envelope(c: Canvas, x, y, w=9, h=6):
    """A closed envelope, top-left at (x, y): paper, outline, the flap's V."""
    c.rect(x, y, x + w - 1, y + h - 1, "outline")
    c.rect(x + 1, y + 1, x + w - 2, y + h - 2, "paper")
    for k in range((w - 1) // 2):
        c.point(x + 1 + k, y + 1 + k * (h - 3) // max(1, (w - 3) // 2), "wall-trim")
        c.point(x + w - 2 - k, y + 1 + k * (h - 3) // max(1, (w - 3) // 2), "wall-trim")
    c.point(x + w // 2, y + h // 2, "badge-red")      # a red seal: URGENT


def _fishing_line(iso: Iso, c: Canvas):
    x, y = _rod_and_line(iso, c, 35.0)
    # the envelope hangs with the hook's bend through its top edge; the hook is drawn
    # over the paper so the J reads
    _hook(c, x, y - 3)
    _envelope(c, x - 7, y + 6, w=11, h=7)
    c.point(x - 2, y + 6, "outline")                  # caught on the bend
    return {"bait": (x - 2, y + 9)}


def _fishing_shield(iso: Iso, c: Canvas):
    """Built: the same line comes down and lands on a small shield over the monitor;
    the hook is stopped on its rim, the envelope knocked askew, going nowhere."""
    sx, sy = iso.pt(FISH_C, FISH_R, 25.0)      # shield centre, above the screen
    x, y = _rod_and_line(iso, c, 32.0)
    rows = [
        "ooooooooo",
        "obbbbbbbo",
        "obbbbbwbo",
        "obbbbwwbo",
        "obwbwwbbo",
        "obwwwbbbo",
        ".obwbbbo.",
        "..obbbo..",
        "...obo...",
        "....o....",
    ]
    _rows(c, rows, sx - 4, sy - 5, {"o": "outline", "b": "shirt-1", "w": "paper"})
    # the hook stopped on the rim, the envelope swung off to the side
    _hook(c, x, y - 9)
    _envelope(c, x + 4, y - 5, w=7, h=5)
    for dx, dy in ((-4, 3), (-5, 1), (1, 4), (2, 3)):   # impact ticks on the rim
        c.point(x + dx, y + dy, "sticky")


def card_report() -> Canvas:
    """The `REPORT` button, taped over the finance monitor: a red button, white glyphs."""
    return _card("REPORT", fill="badge-red", ink="paper", tape=False, pad=1)


# -- G4.3: two CRMs -------------------------------------------------------------------

def _sheet(c, z, b, c0, c1):
    """A spreadsheet: green header row, white cells, grey rules."""
    if b == 0:
        return "shirt-2-dark"
    if (c - c0) % 1.4 < 0.5:
        return "wall-trim"
    return "wall-shadow" if b % 2 == 0 else "paper"


def desk_sheet(turned: bool = False) -> Canvas:
    return desk_mod.build("plain", turned=turned, screen=_sheet)


def card_customers() -> Canvas:
    """Taped to the top of each of the two monitors. Both say the same thing."""
    return _card("CUSTOMERS")


def sign_pipeline() -> Canvas:
    """Built: one screen on a stand, the systems joined up: CRM > ERP > HRIS."""
    parts = [("CRM", "glass"), (">", "wall-shadow"), ("ERP", "sticky"), (">", "wall-shadow"),
             ("HRIS", "badge-green")]
    text = "".join(t for t, _ in parts)
    tw = glyphs.text_width(text)
    w, h = tw + 6, 11
    c = Canvas(w, h + 8)
    c.rect(0, 0, w - 1, h - 1, "outline")
    c.rect(1, 1, w - 2, h - 2, "monitor-frame")
    c.rect(2, 2, w - 3, h - 3, "shirt-1-dark")
    x = 3
    for t, col in parts:
        glyphs.draw(c, t, x, 3, col)
        x += glyphs.text_width(t) + 1
    # a stand: pole and a flat foot, with its shadow
    mid = w // 2
    c.rect(mid - 1, h, mid, h + 5, "monitor-frame")
    c.point(mid + 1, h, "outline")
    c.rect(mid - 5, h + 6, mid + 4, h + 6, "outline")
    c.rect(mid - 4, h + 7, mid + 6, h + 7, "shadow")
    return c


# -- G5.1: the road, the truck, the link -----------------------------------------------

ROAD_W = (2.0, 6.0)        # the strip's extent across a tile, world units


def _road_pieces(iso: Iso, spans, dashes):
    """spans: [(c0, r0, c1, r1)] asphalt rectangles; dashes: [(c0, r0, c1, r1)]."""
    pts = set()
    for (c0, r0, c1, r1) in spans:
        f = iso.box(c0, r0, -0.4, c1, r1, 0, top="chair-mid", left="chair-dark",
                    right="chair-dark", outline=None)
        pts |= {k for k, v in f.items() if v == "T"}
    for (c0, r0, c1, r1) in dashes:
        iso.box(c0, r0, 0, c1, r1, 0.001, top="paper", left="paper", right="paper",
                outline=None)
    # kerb: a dark edge where the asphalt meets nothing
    for (x, y) in pts:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if (x + dx, y + dy) not in pts:
                iso.c.point(x, y, "chair-dark")
                break


def _road_r(iso, c):
    a, b = ROAD_W
    _road_pieces(iso, [(a, 0, b, 8)], [(3.7, 1.0, 4.3, 3.0), (3.7, 5.0, 4.3, 7.0)])


def _road_c(iso, c):
    a, b = ROAD_W
    _road_pieces(iso, [(0, a, 8, b)], [(1.0, 3.7, 3.0, 4.3), (5.0, 3.7, 7.0, 4.3)])


def _road_turn(iso, c):
    """In along +r from the tile's back-right edge, out along -c through its back-left
    edge (HQ's door is up-right of the turn, the inset office's down-left... up-left)."""
    a, b = ROAD_W
    _road_pieces(iso, [(a, 0, b, b), (0, a, b, b)],
                 [(3.7, 0.5, 4.3, 2.5), (0.5, 3.7, 2.5, 4.3)])


LINK_MS = 300


def _link(iso: Iso, c: Canvas, frame: int, legs):
    """The solid network link along the road's centre line: 2 px of `net` with an
    outline halo; frame 1 lights a packet on each leg (the blink)."""
    for (p0, p1) in legs:
        fill = _thick(iso, [(p0[0], p0[1], 0.6), (p1[0], p1[1], 0.6)], "net", width=2)
        if frame == 1:
            x0, y0 = iso.pt(p0[0], p0[1], 0.6)
            x1, y1 = iso.pt(p1[0], p1[1], 0.6)
            for t in (0.3, 0.8):
                x, y = round(x0 + (x1 - x0) * t), round(y0 + (y1 - y0) * t)
                for (px, py) in ((x, y), (x + 1, y), (x, y + 1), (x + 1, y + 1)):
                    if (px, py) in fill:
                        c.point(px, py, "paper")


def _link_r(iso, c, frame):
    _link(iso, c, frame, [((4, 0), (4, 8))])


def _link_c(iso, c, frame):
    _link(iso, c, frame, [((0, 4), (8, 4))])


def _link_turn(iso, c, frame):
    _link(iso, c, frame, [((4, 0), (4, 4)), ((4, 4), (0, 4))])


TRUCK_MS = 160


def _truck(iso: Iso, c: Canvas, frame: int):
    """A tiny courier van driving +r (toward the viewer's lower left): brown box, cab
    in front, windscreen, wheels on the visible side. Frame 1 bobs the body 1 unit."""
    C0, C1 = 2.0, 6.0
    iso.floor_shadow(C0, 0.5, C1, 8.0, grow=0.8, grow_r=0.3)
    for rr in (1.8, 6.2):                      # wheels on the +c side
        iso.box(C1 - 0.4, rr - 0.9, 0, C1 + 0.1, rr + 0.9, 2.2, top="outline",
                left="outline", right="chair-dark", outline="outline")
    z = 1.5 + (0.6 if frame else 0)
    f = iso.box(C0, 0.5, z, C1, 5.5, z + 7.0, top="desk-wood", left="desk-wood-dark",
                right="hair-1")
    iso.paint(f, "R", C1, lambda rr, zz: "sticky" if z + 4.0 <= zz < z + 5.0 else None)
    cab = iso.box(C0, 5.5, z, C1, 8.0, z + 4.8, top="desk-wood", left="desk-wood-dark",
                  right="hair-1")
    iso.paint(cab, "L", 8.0, lambda cc, zz: "glass" if z + 2.4 <= zz < z + 4.2 and C0 + 0.5 <= cc < C1 - 0.5
              else ("sticky" if zz < z + 1.0 and (cc < C0 + 1.0 or cc >= C1 - 1.0) else None))
    iso.paint(cab, "R", C1, lambda rr, zz: "glass-dark" if z + 2.4 <= zz < z + 4.2 and rr < 7.4 else None)


# -- registry ---------------------------------------------------------------------------

def _desk_sprite(cv: Canvas, turned=False, kind="plain") -> Sprite:
    return Sprite(cv, desk_mod.ANCHOR, {"net": desk_mod.net_point(kind, turned),
                                        "card": desk_mod.card_point(turned)})


def build_all() -> dict:
    note = note_dave()
    cust = card_customers()
    rep = card_report()
    pipe = sign_pipeline()
    return {
        # without
        # parked along +r, nose to the wall, right across the closet door
        "trolley": make(_trolley),
        "note-dave": Sprite(note, (note.w // 2, note.h)),
        "desk-retail-box": _desk_sprite(desk_retail_box()),
        "fishing-line": make(_fishing_line),
        "desk-sheet": _desk_sprite(desk_sheet()),
        "desk-turned-sheet": _desk_sprite(desk_sheet(turned=True), turned=True),
        "card-customers": Sprite(cust, (cust.w // 2, cust.h)),
        "road-r": make(_road_r),
        "road-c": make(_road_c),
        "road-turn": make(_road_turn),
        "truck": make_anim(_truck, 2, key="drive", ms=TRUCK_MS),
        # built
        "laptop-shelf": make(_laptop_shelf),
        "fishing-shield": make(_fishing_shield),
        # a button on the screen: anchored at its centre, placed on the desk's `net`
        # point (the middle of the screen)
        "card-report": Sprite(rep, (rep.w // 2, rep.h // 2)),
        "desk-turned": _desk_sprite(desk_mod.build("plain", turned=True), turned=True),
        "sign-pipeline": Sprite(pipe, (pipe.w // 2, pipe.h)),
        "link-r": make_anim(_link_r, 2, ms=LINK_MS),
        "link-c": make_anim(_link_c, 2, ms=LINK_MS),
        "link-turn": make_anim(_link_turn, 2, ms=LINK_MS),
    }
