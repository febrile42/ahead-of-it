"""Band 80 props (PH1-06), both states. `docs/content/BANDS-AND-GAGS.md` §80.

Every prop is a `vox.Sprite`: anchor = the front vertex of the tile it is placed on
(`iso.iso_to_screen(col, row)`), plus named points. The one named point used so far is
"net": where a dotted network line (style.md "On the network") attaches — a laptop, a
router, a firewall, a monitor.

Without (the as-found state)
  G1.1  closet-shelf        supply shelving: paper towels, a mop bucket's worth of
                            cleaning stock, and the router on the middle shelf
        box-fan             on a cardboard box, aimed at the router
        mop-bucket          so nobody mistakes the closet for a server room
        cable-spill         the cable that falls out when the door opens
  G1.2  desk-postit         (desk.py)
  G2.1  desk-dev            (desk.py) + worker queue poses (worker.py)
  G2.2  cable-floor-c/-r/-turn   taped floor cable, three pieces that tile
        sign-caution        a small A-frame, CAUTION in 3x5 glyphs
  G2.3  sofa, plant, tag-visitor, wifi (and `visitor` in worker.py)

Built
  G1.1  rack                small, boring, every unit labelled
  G1.2  desk-padlock        (desk.py)
  G2.1  sla-board           freestanding board by the support desk: OPEN:3 AVG:1H
  G2.2  cable-tray          wall-mounted tray along the back-right wall, tileable
  G2.3  firewall            brick-faced box on top of the rack; the line stops here
"""
from __future__ import annotations

from ..dsl import Canvas
from ..vox import Iso, make, make_anim
from .. import glyphs


# -- helpers -------------------------------------------------------------------

def _thick(iso: Iso, pts_world, colour: str, z: float = 0.4, width: int = 2):
    """A cable: a polyline of world points on (or above) the floor, drawn `width` px
    thick with an outline ring. Returns the set of fill pixels."""
    fill = set()
    for (c0, r0, *z0), (c1, r1, *z1) in zip(pts_world, pts_world[1:]):
        za = z0[0] if z0 else z
        zb = z1[0] if z1 else z
        x0, y0 = iso.pt(c0, r0, za)
        x1, y1 = iso.pt(c1, r1, zb)
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(steps + 1):
            x = x0 + round((x1 - x0) * i / steps)
            y = y0 + round((y1 - y0) * i / steps)
            for w in range(width):
                if abs(x1 - x0) >= abs(y1 - y0):
                    fill.add((x, y + w))
                else:
                    fill.add((x + w, y))
    for (x, y) in fill:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if (x + dx, y + dy) not in fill:
                iso.c.point(x + dx, y + dy, "outline")
    for (x, y) in fill:
        iso.c.point(x, y, colour)
    return fill


def _rows(c: Canvas, rows, x, y, mapping):
    for dy, row in enumerate(rows):
        for dx, ch in enumerate(row):
            if ch != "." and mapping.get(ch):
                c.point(x + dx, y + dy, mapping[ch])


# -- G1.1 without: the supply closet ---------------------------------------------

def _closet_shelf(iso: Iso, c: Canvas, frame: int = 0):
    """Supply shelving with the office's only router on the top shelf, beside the paper
    towels. PH1-07: the router is the gag, so it is now the darkest, largest thing on
    the shelf (20 px wide, antennas up), every cable in the closet converges on its
    ports, and frame 1 of the `blink` animation flickers its LEDs."""
    c0, c1, r0, r1 = 1.0, 13.0, 0.3, 3.8
    iso.floor_shadow(c0, r0, c1, r1, grow=1.0)
    # uprights (back one first)
    for cc in (c0, c1 - 0.8):
        iso.box(cc, r0, 0, cc + 0.8, r1, 31, top="wall-trim", left="badge-body",
                right="chair-mid")
    # shelves
    for z in (1, 11, 21, 30):
        iso.box(c0 + 0.8, r0, z, c1 - 0.8, r1, z + 1, top="wall-trim", left="badge-body",
                right="chair-mid")
    # bottom shelf: a cardboard box and two spray bottles
    iso.box(2.2, 0.6, 2, 6.2, 3.4, 7, top="desk-wood", left="desk-wood",
            right="desk-wood-dark", edge="desk-wood-dark")
    for cc in (8.0, 9.6):
        iso.box(cc, 1.2, 2, cc + 1.0, 2.2, 7, top="badge-green", left="badge-green",
                right="shirt-2-dark")
        iso.box(cc + 0.2, 1.4, 7, cc + 0.8, 2.0, 8.5, top="paper", left="paper",
                right="wall-shadow")
    # middle shelf: a stack of toilet rolls
    for cc, rr, zz in ((2.4, 1.2, 12), (4.0, 1.2, 12), (3.2, 1.0, 16)):
        iso.box(cc, rr, zz, cc + 1.4, rr + 1.4, zz + 4, top="paper", left="paper",
                right="wall-shadow")
    # top shelf: paper towels, three rolls
    for cc in (2.0, 3.6, 5.2):
        f = iso.box(cc, 1.2, 22, cc + 1.4, 2.6, 28, top="paper", left="paper",
                    right="wall-shadow")
        iso.paint(f, "T", 28, lambda a, b, cc=cc: "wall-trim" if abs(a - cc - 0.7) < 0.3 and abs(b - 1.9) < 0.3 else None)
    # ... and on top of the unit, silhouetted against the wall: the router
    R0, R1, RR0, RR1, Z0, Z1 = 2.6, 11.4, 0.7, 3.6, 31.0, 36.0
    rf = iso.box(R0, RR0, Z0, R1, RR1, Z1, top="chair-mid", left="monitor-frame",
                 right="outline", edge="chair-dark")
    lit = {0: ("badge-green", "badge-green", "sticky", "badge-green", "badge-green"),
           1: ("chair-dark", "badge-green", "badge-green", "chair-dark", "badge-red")}[frame]

    def leds(cc, z):
        if Z0 + 2.0 <= z < Z0 + 3.0:
            k = int((cc - R0 - 1.0) / 1.5)
            if 0 <= k < 5 and (cc - R0 - 1.0) % 1.5 < 1.0:
                return lit[k]
        return None
    iso.paint(rf, "L", RR1, leds)
    # four antennas, splayed, standing up against the wall
    for cc, lean in ((3.4, -3), (6.0, -1), (8.2, 1), (10.6, 3)):
        x, y = iso.pt(cc, 1.6, Z1)
        for k in range(10):
            c.point(x + (lean * k) // 9, y - k, "outline")
    # every cable in the closet converges on the router's front ports: one up the wall
    # to the ceiling, three down across the shelves to the floor and toward the door
    port = (7.0, RR1 + 0.2, Z0 + 0.6)
    runs = [
        ("sticky", [(13.6, 0.2, 40.0), (12.6, 0.4, 36.5), (10.0, 4.0, 33.0), port]),
        ("shirt-1", [(15.5, 5.2, 0.3), (12.8, 5.0, 0.3), (9.8, 4.4, 14.0), port]),
        ("badge-green", [(7.2, 6.6, 0.3), (6.8, 4.5, 16.0), port]),
        ("badge-red", [(2.4, 5.8, 0.3), (4.2, 4.4, 18.0), port]),
    ]
    for col, pts in runs:
        _thick(iso, pts, col, width=1)
    px, py = iso.pt(*port)
    for dx in (-1, 0, 1):
        c.point(px + dx, py, "chair-mid")
    return {"net": iso.pt(7.0, 2.0, Z1 + 1)}


def _box_fan(iso: Iso, c: Canvas):
    """On a cardboard box, its face turned -r: up-right on screen, at the shelf and
    the router. We see the back grille; the wind streaks run off toward the router."""
    iso.floor_shadow(0.5, 2.0, 6.0, 5.5, grow=1.0)
    iso.box(0.5, 2.0, 0, 6.0, 5.5, 4, top="desk-wood", left="desk-wood",
            right="desk-wood-dark", edge="desk-wood-dark")
    f = iso.box(0.5, 3.2, 4, 6.0, 4.4, 12.0, top="chair-mid", left="chair-mid",
                right="chair-dark")

    def grille(cc, z):
        dc, dz = (cc - 3.25) * 1.1, (z - 8.0) * 0.8
        d = (dc * dc + dz * dz) ** 0.5
        if d < 0.8:
            return "badge-body"
        if d < 2.6:
            return "wall-shadow" if int(d * 1.6) % 2 else "chair-dark"
        return None
    iso.paint(f, "L", 4.4, grille)
    # wind: three streaks heading -r (screen up-right), toward the router
    for i, (cc, z) in enumerate(((1.6, 13.0), (3.4, 14.5), (5.2, 12.5))):
        x, y = iso.pt(cc, 3.0, z)
        for k in range(4 + (i == 1)):   # rising: aimed up at the router on the shelf top
            c.point(x + k * 2, y - 2 * k, "glass-highlight")
            c.point(x + k * 2 + 1, y - 2 * k - 1, "glass-highlight")


def _mop_bucket(iso: Iso, c: Canvas):
    iso.floor_shadow(2.0, 2.0, 5.5, 5.5, grow=0.8)
    iso.box(2.0, 2.0, 0, 5.5, 5.5, 4.5, top="shirt-1-dark", left="sticky",
            right="sticky", edge="outline")
    # mop handle, leaning back against the wall
    x0, y0 = iso.pt(3.8, 3.8, 3.0)
    for k in range(20):
        c.point(x0 + k // 4, y0 - k, "desk-wood")
        c.point(x0 + k // 4 + 1, y0 - k, "outline")
    for dx in range(-2, 3):
        c.point(x0 + dx, y0 + 1, "paper")
        c.point(x0 + dx, y0 + 2, "wall-shadow")


def _cable_spill(iso: Iso, c: Canvas):
    """Out through the open door onto the floor in a loop. Anchored on the tile just
    outside the closet door (the door is on the closet's +c partition)."""
    _thick(iso, [(-1.5, 3.0), (0.5, 3.6), (2.5, 2.4), (4.0, 3.4), (3.4, 5.4),
                 (1.6, 5.0), (1.4, 3.2), (3.2, 2.0), (5.5, 2.6)], "shirt-1")
    # the free end: a clear RJ45 plug
    x, y = iso.pt(5.5, 2.6, 0.4)
    c.point(x + 1, y, "glass-highlight")
    c.point(x + 2, y, "glass-highlight")
    c.point(x + 1, y + 1, "glass")


# -- G2.2 without: taped floor cable --------------------------------------------------

def _tape_run(iso: Iso, pts, marks):
    _thick(iso, pts, "shirt-1")
    for (cc, rr, along) in marks:
        # a strip of silver tape across the cable
        if along == "c":
            iso.box(cc - 0.5, rr - 1.2, 0, cc + 0.5, rr + 1.2, 0.5, top="wall-shadow",
                    left="wall-trim", right="wall-trim", outline=None)
        else:
            iso.box(cc - 1.2, rr - 0.5, 0, cc + 1.2, rr + 0.5, 0.5, top="wall-shadow",
                    left="wall-trim", right="wall-trim", outline=None)


def _cable_c(iso, c):
    _tape_run(iso, [(0, 4), (8, 4)], [(2.0, 4.0, "c"), (6.0, 4.0, "c")])


def _cable_r(iso, c):
    _tape_run(iso, [(4, 0), (4, 8)], [(4.0, 2.0, "r"), (4.0, 6.0, "r")])


def _cable_turn(iso, c):
    """Comes in along +r at c=4, leaves along +c at r=4."""
    _tape_run(iso, [(4, 0), (4, 4), (8, 4)], [(4.0, 2.0, "r"), (6.0, 4.0, "c")])


def _sign_caution(iso: Iso, c: Canvas):
    """A small yellow A-frame at the tile centre. Text is billboarded, two lines."""
    iso.floor_shadow(3.0, 3.0, 5.5, 5.5, grow=1.2)
    x, y = iso.pt(4, 4, 0)  # tile centre on the floor
    w = 16
    x0, y1 = x - w // 2, y
    y0 = y1 - 17
    # rear leg peeking out, then the front panel
    for k in range(3):
        c.point(x0 + w - 1 + k // 2, y1 - k, "outline")
    c.rect(x0, y0, x0 + w - 1, y1 - 3, "outline")
    c.rect(x0 + 1, y0 + 1, x0 + w - 2, y1 - 4, "sticky")
    c.rect(x0 + 1, y1 - 3, x0 + 2, y1 - 1, "outline")
    c.rect(x0 + w - 3, y1 - 3, x0 + w - 2, y1 - 1, "outline")
    glyphs.draw(c, "CAU", x0 + (w - glyphs.text_width("CAU")) // 2, y0 + 2, "outline")
    glyphs.draw(c, "TION", x0 + (w - glyphs.text_width("TION")) // 2, y0 + 8, "outline")


# -- G2.3 without: the lobby ------------------------------------------------------------

SOFA = dict(c0=0.5, c1=5.5, r0=1.0, r1=15.0)


def _sofa(iso: Iso, c: Canvas):
    """Two tiles long, back against the back-left wall, facing +c. Anchor tile = the
    first (rear) of the two tiles."""
    s = SOFA
    iso.floor_shadow(s["c0"], s["r0"], s["c1"], s["r1"], grow=1.2)
    kw = dict(top="badge-red", left="shirt-3-dark", right="shirt-3-dark", edge="shirt-3-dark")
    iso.box(s["c0"], s["r0"], 0, s["c1"], s["r1"], 3.5, top="badge-red",
            left="shirt-3-dark", right="shirt-3-dark", edge="outline")
    iso.box(s["c0"], s["r0"] + 1.4, 3.5, s["c1"], s["r1"] - 1.4, 5.0, **kw)  # cushions
    iso.box(s["c0"], s["r0"], 3.5, s["c0"] + 1.8, s["r1"], 11.5, **kw)        # back
    iso.box(s["c0"] + 1.8, s["r0"], 3.5, s["c1"], s["r0"] + 1.4, 7.5, **kw)   # rear arm
    iso.box(s["c0"] + 1.8, s["r1"] - 1.4, 3.5, s["c1"], s["r1"], 7.5, **kw)   # front arm
    # cushion seam
    x0, y0 = iso.pt(s["c0"] + 1.8, 8.0, 5.0)
    x1, y1 = iso.pt(s["c1"], 8.0, 5.0)
    for k in range(x1 - x0 + 1):
        c.point(x0 + k, y0 + k // 2, "shirt-3-dark")


def _plant(iso: Iso, c: Canvas):
    iso.floor_shadow(2.5, 2.5, 5.5, 5.5, grow=0.8)
    iso.box(2.5, 2.5, 0, 5.5, 5.5, 5, top="hair-1", left="desk-wood-dark",
            right="hair-1", edge="outline")
    x, y = iso.pt(4, 4, 5)
    leaves = [
        "....g.g.....",
        "...gGg.g.g..",
        "..gGGgGgGg..",
        ".gGgGGgGGgg.",
        "gGGgGggGgGGg",
        ".gGGgGGgGgg.",
        "..ggGgGGgg..",
        "....gggg....",
    ]
    _rows(c, leaves, x - 6, y - 12, {"g": "shirt-2-dark", "G": "badge-green"})
    # outline the foliage silhouette
    pts = {(x - 6 + dx, y - 12 + dy) for dy, row in enumerate(leaves) for dx, ch in enumerate(row) if ch != "."}
    for (px, py) in pts:
        for dx, dy in ((1, 0), (-1, 0), (0, -1)):
            if (px + dx, py + dy) not in pts:
                c.point(px + dx, py + dy, "outline")


def tag_visitor() -> Canvas:
    """A visitor sticker blown up as a callout: red band, VISITOR in glyphs, a tail at
    the bottom-right pointing down at the wearer. Billboard; the anchor is the tail tip,
    which the scene puts just above the visitor's head."""
    tw = glyphs.text_width("VISITOR")
    w, h = tw + 4, 11
    c = Canvas(w, h + 3)
    c.rect(0, 0, w - 1, h - 1, "outline")
    c.rect(1, 1, w - 2, 2, "badge-red")
    c.rect(1, 3, w - 2, h - 2, "paper")
    glyphs.draw(c, "VISITOR", 2, 4, "outline")
    for k in range(3):
        c.rect(w - 5 + k, h - 1 + k, w - 3, h - 1 + k, "outline")
    c.point(w - 4, h - 1, "paper")
    return c


def wifi() -> Canvas:
    """Three arcs in the network colour: this device is broadcasting / on the network."""
    rows = [
        ".nnnnn.",
        "n.....n",
        "..nnn..",
        ".n...n.",
        "...n...",
    ]
    c = Canvas(7, 5)
    _rows(c, rows, 0, 0, {"n": "net"})
    return c


# -- built ------------------------------------------------------------------------------

RACK = dict(c0=3.0, c1=8.0, r0=0.6, r1=4.6, top=22.0)


def _rack(iso: Iso, c: Canvas):
    """A 22-unit-tall rack against the back-right wall of the closet: patch panel,
    switch, a blank, a UPS; a paper label on every unit. Cables rise from the patch
    panel to the tray."""
    k = RACK
    iso.floor_shadow(k["c0"], k["r0"], k["c1"], k["r1"], grow=1.0)
    # cable bundle climbing from the rack's top to the tray
    for i, col in enumerate(("shirt-1", "sticky", "badge-green")):
        x, y = iso.pt(k["c0"] + 1.2 + i * 0.9, 1.2, k["top"])
        for dz in range(14):
            c.point(x, y - dz, col)
        c.point(x - 1, y - 13, "outline")
    f = iso.box(k["c0"], k["r0"], 0, k["c1"], k["r1"], k["top"], top="chair-dark",
                left="monitor-frame", right="outline")
    units = [  # (z0, z1, kind)
        (18.0, 21.0, "patch"),
        (14.0, 17.0, "switch"),
        (10.0, 13.0, "blank"),
        (2.0, 8.0, "ups"),
    ]

    def face(cc, z):
        for z0, z1, kind in units:
            if z0 <= z < z1 and k["c0"] + 0.4 <= cc < k["c1"] - 0.4:
                if cc < k["c0"] + 1.3 and z1 - 1.5 <= z < z1 - 0.5:
                    return "paper"  # the label
                if kind == "patch":
                    return ("shirt-1", "sticky", "badge-green", "paper")[int(cc * 2) % 4] \
                        if z1 - 2 <= z < z1 - 1 and cc >= k["c0"] + 1.5 and int(cc * 4) % 2 else "chair-dark"
                if kind == "switch":
                    return "badge-green" if z1 - 2 <= z < z1 - 1 and cc >= k["c0"] + 1.5 and int(cc * 2) % 2 else "chair-dark"
                if kind == "ups":
                    return "badge-green" if (z1 - 2 <= z < z1 - 1 and cc >= k["c1"] - 1.4) else "chair-mid"
                return "chair-mid"
        return None
    iso.paint(f, "L", k["r1"], face)


def _firewall(iso: Iso, c: Canvas):
    """Brick-faced box sitting on top of the rack. The visitor's dotted line ends here."""
    k = RACK
    z = k["top"]
    f = iso.box(k["c0"] + 0.4, k["r0"] + 0.6, z, k["c1"] - 0.4, k["r1"] - 0.2, z + 6,
                top="chair-mid", left="badge-red", right="shirt-3-dark")

    def bricks(cc, zz):
        row = int(zz - z)          # 0..5 from the bottom
        if row in (0, 3):
            return "wall-shadow"   # mortar courses
        off = 0.0 if row < 3 else 1.0
        if (cc + off) % 2.0 < 0.5:
            return "wall-shadow"   # head joints, running bond
        return None
    iso.paint(f, "L", k["r1"] - 0.2, bricks)
    iso.paint(f, "R", k["c1"] - 0.4, lambda rr, zz: "wall-trim" if int(zz - z) in (0, 3) else None)
    return {"net": iso.pt(k["c0"] + 2.5, k["r1"] - 0.2, z + 4)}


def _cable_tray(iso: Iso, c: Canvas):
    """A tray mounted high on the back-right wall, tileable along +c."""
    f = iso.box(0, 0, 33, 8, 2.2, 35, top="chair-dark", left="chair-mid",
                right="chair-dark", outline=None)
    for i, col in enumerate(("shirt-1", "sticky", "badge-green")):
        rr = 0.5 + i * 0.6
        x0, y0 = iso.pt(0, rr, 35.2)
        for kx in range(16):
            c.point(x0 + kx, y0 + kx // 2, col)
    iso.outline(set(f), "outline", "v")
    # a bracket
    x, y = iso.pt(4, 0.2, 33)
    c.point(x, y, "outline")
    c.point(x, y + 1, "outline")


def sla_board() -> Canvas:
    """Freestanding board by the support desk: OPEN:3 / AVG:1H, numbers in green."""
    l1, l2 = "OPEN:", "AVG:"
    w = max(glyphs.text_width(l1 + "3"), glyphs.text_width(l2 + "1H")) + 4
    h = 15
    c = Canvas(w, h + 9)
    c.rect(0, 0, w - 1, h - 1, "outline")
    c.rect(1, 1, w - 2, h - 2, "paper")
    glyphs.draw(c, l1, 2, 2, "outline")
    glyphs.draw(c, "3", 2 + glyphs.text_width(l1) + 1, 2, "shirt-2-dark")
    glyphs.draw(c, l2, 2, 8, "outline")
    glyphs.draw(c, "1H", 2 + glyphs.text_width(l2) + 1, 8, "shirt-2-dark")
    # easel legs + shadow
    for k in range(9):
        c.point(3 - k // 4, h + k, "outline")
        c.point(w - 4 + k // 4, h + k, "outline")
    c.rect(1, h + 8, w - 1, h + 8, "shadow")
    c.point(3 - 2, h + 8, "outline")
    c.point(w - 4 + 2, h + 8, "outline")
    return c


# -- registry ---------------------------------------------------------------------------

def build_all() -> dict:
    from ..vox import Sprite
    tag = tag_visitor()
    board = sla_board()
    w = wifi()
    return {
        # without
        "closet-shelf": make_anim(_closet_shelf, 2, ms=350),
        "box-fan": make(_box_fan),
        "mop-bucket": make(_mop_bucket),
        "cable-spill": make(_cable_spill),
        "cable-floor-c": make(_cable_c),
        "cable-floor-r": make(_cable_r),
        "cable-floor-turn": make(_cable_turn),
        "sign-caution": make(_sign_caution),
        "sofa": make(_sofa),
        "plant": make(_plant),
        "tag-visitor": Sprite(tag, (tag.w - 3, tag.h)),
        "wifi": Sprite(w, (3, w.h)),
        # built
        "rack": make(_rack),
        "firewall": make(_firewall),
        "cable-tray": make(_cable_tray),
        "sla-board": Sprite(board, (board.w // 2, board.h)),
    }
