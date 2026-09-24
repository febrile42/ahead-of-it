"""Band 150 composite (PH1-07): HQ plus, for the first time, the inset office.

Placed through manifest anchors exactly as scene80 does (and via its `Scene`). HQ is
the band-80 shell (9 x 7 tiles) with the front door moved to the front-left edge so the
street is visible; the inset office is a second, smaller building down the road.

    closet ........ tiles (0..1, 0..1), band 80's closet in the same state (cumulative)
    G3.2 .......... trolley / laptop shelf on (2..3, 0), against the wall by the closet
                    door; the retail box on the CEO's desk in the far corner (8, 0)
    G4.2 .......... the finance desk (5, 0): line, hook and envelope / shield
    G4.3 .......... desk (4, 3) screen +r and turned desk (3, 4) screen +c: back to back,
                    the printouts person standing where their backs meet (4.55, 4.55)
    sales pit ..... desks (6, 3) (6, 5)
    G5.1 .......... HQ front door on the front-left edge of (1, 6); the road runs +r down
                    col 1 to (1, 10), turns, and ends at the inset's door on (-1, 10)
    inset office .. tiles (-3..-1, 9..11), door on its front-right edge at row 10
"""
from __future__ import annotations

from .dsl import Canvas
from .scene80 import Scene, _closet
from .vox import dotted  # noqa: F401  (kept for parity with scene80)

COLS, ROWS = 9, 7
SIZE = (420, 300)
ORIGIN = (230, 60)

INSET = dict(c0=-3, c1=-1, r0=9, r1=11)
DOOR_COL = 1
ROAD = [(1, 7, "road-r"), (1, 8, "road-r"), (1, 9, "road-r"), (1, 10, "road-turn"),
        (0, 10, "road-c")]
LINK = {"road-r": "link-r", "road-turn": "link-turn", "road-c": "link-c"}

FINANCE = (5, 0)
CEO = (8, 0)
CRM_A = (4, 3)      # screen faces +r
CRM_B = (3, 4)      # turned: screen faces +c
SALES = [(6, 3), (6, 5)]
INSET_DESK = (-2, 9)


def _structure(sc: Scene):
    s = sc.s
    at = sc.at
    for col in range(COLS):
        sc.paste(s["slab-l"].canvas, s["slab-l"].anchor, at(col, ROWS - 1))
    for row in range(ROWS):
        sc.paste(s["slab-r"].canvas, s["slab-r"].anchor, at(COLS - 1, row))
    for row in range(ROWS):
        for col in range(COLS):
            name = "floor-closet" if col <= 1 and row <= 1 else "floor-office"
            sc.paste(s[name].canvas, s[name].anchor, at(col, row))
    sc.paste(s["wall-corner"].canvas, s["wall-corner"].anchor, at(0, 0))
    for row in range(ROWS):
        name = "wall-back-l-window" if row in (3, 5) else "wall-back-l"
        if row == ROWS - 1:
            name = "wall-back-l-end"
        sc.paste(s[name].canvas, s[name].anchor, at(0, row))
    for col in range(COLS):
        name = "wall-back-r-window" if col in (3, 6) else "wall-back-r"
        if col == COLS - 1:
            name = "wall-back-r-end"
        sc.paste(s[name].canvas, s[name].anchor, at(col, 0))


def _front_door(sc: Scene):
    """A short run of cutaway front wall around the door, like the closet partitions."""
    r = ROWS - 1
    sc.tile("partition-c", DOOR_COL - 1, r, depth=DOOR_COL - 1 + r + 1.95)
    sc.tile("partition-c-door-open", DOOR_COL, r, depth=8.6)
    sc.tile("partition-c-end", DOOR_COL + 1, r, depth=DOOR_COL + 1 + r + 1.95)


def _inset(sc: Scene, state: str):
    s, at = sc.s, sc.at
    i = INSET
    for col in range(i["c0"], i["c1"] + 1):
        sc.paste(s["slab-l"].canvas, s["slab-l"].anchor, at(col, i["r1"]))
    for row in range(i["r0"], i["r1"] + 1):
        sc.paste(s["slab-r"].canvas, s["slab-r"].anchor, at(i["c1"], row))
    for row in range(i["r0"], i["r1"] + 1):
        for col in range(i["c0"], i["c1"] + 1):
            sc.paste(s["floor-office"].canvas, s["floor-office"].anchor, at(col, row))
    sc.paste(s["wall-corner"].canvas, s["wall-corner"].anchor, at(i["c0"], i["r0"]))
    for row in range(i["r0"], i["r1"] + 1):
        name = "wall-back-l-end" if row == i["r1"] else (
            "wall-back-l-window" if row == i["r0"] + 1 else "wall-back-l")
        sc.paste(s[name].canvas, s[name].anchor, at(i["c0"], row))
    for col in range(i["c0"], i["c1"] + 1):
        name = "wall-back-r-end" if col == i["c1"] else "wall-back-r-window"
        sc.paste(s[name].canvas, s[name].anchor, at(col, i["r0"]))
    # front partitions: the door is on the front-right edge, facing the road
    for col in range(i["c0"], i["c1"] + 1):
        name = "partition-c-end" if col == i["c1"] else "partition-c"
        sc.tile(name, col, i["r1"], depth=col + i["r1"] + 1.95)
    for row in range(i["r0"], i["r1"] + 1):
        name = {10: "partition-r-doorway"}.get(row, "partition-r")
        if row == i["r1"]:
            name = "partition-r-end"
        sc.tile(name, i["c1"], row, depth=i["c1"] + row + 1.95)
    sc.tile("desk", *INSET_DESK)
    if state == "built":
        sc.tile("worker-seated-b", *INSET_DESK, depth=sum(INSET_DESK) + 1.01)
    else:
        # on the step outside the door, at the kerb, checking the time
        w = s["worker-watch"]
        sc.fig(w.frames["b"][0], w.anchor, i["c1"] + 1.25, 10.3, depth=11.2)


def _card_on(sc: Scene, card_name: str, desk_name: str, col, row, depth, point="card"):
    card, d = sc.s[card_name], sc.s[desk_name]
    base = sc.at(col, row)
    pt = (base[0] - d.anchor[0] + d.points[point][0],
          base[1] - d.anchor[1] + d.points[point][1])
    sc.items.append((depth, len(sc.items), lambda: sc.paste(card.canvas, card.anchor, pt)))


def compose(sprites: dict, state: str) -> Canvas:
    assert state in ("without", "built")
    sc = Scene(sprites, SIZE, ORIGIN)
    s = sprites
    _structure(sc)
    for col, row, name in ROAD:
        sc.paste(s[name].canvas, s[name].anchor, sc.at(col, row))
    if state == "built":
        for col, row, name in ROAD:
            ln = s[LINK[name]]
            sc.paste(ln.canvas, ln.anchor, sc.at(col, row))
    _inset(sc, state)

    # cumulative: band 80's closet, as it was (the spilled cable is left out: the
    # trolley / shelf stands where it lay)
    _closet(sc, state)
    if state == "without":
        sc.items = [it for it in sc.items]  # (closet adds its own items)

    # G3.2
    sc.tile("trolley" if state == "without" else "laptop-shelf", 2, 0)
    if state == "without":
        t, n = s["trolley"], s["note-dave"]
        base = sc.at(2, 0)
        pt = (base[0] - t.anchor[0] + t.points["note"][0],
              base[1] - t.anchor[1] + t.points["note"][1])
        sc.items.append((3.05, len(sc.items), lambda: sc.paste(n.canvas, n.anchor, pt)))
    # the CEO is out; the box is waiting on the desk
    sc.tile("desk-retail-box" if state == "without" else "desk", *CEO)

    # G4.2
    sc.tile("desk", *FINANCE)
    if state == "without":
        sc.tile("fishing-line", *FINANCE, depth=sum(FINANCE) + 1.005)
        r = s["worker-reach"]
        sc.items.append((sum(FINANCE) + 1.01, len(sc.items),
                         lambda: sc.paste(r.frames["a"][0], r.anchor, sc.at(*FINANCE))))
    else:
        sc.tile("fishing-shield", *FINANCE, depth=sum(FINANCE) + 1.005)
        sc.tile("worker-seated-a", *FINANCE, depth=sum(FINANCE) + 1.01)
        _card_on(sc, "card-report", "desk", *FINANCE, depth=sum(FINANCE) + 1.02,
                 point="net")

    # G4.3
    a_name = "desk-sheet" if state == "without" else "desk"
    b_name = "desk-turned-sheet" if state == "without" else "desk-turned"
    sc.tile(a_name, *CRM_A)
    sc.tile("worker-seated-e", *CRM_A, depth=sum(CRM_A) + 1.01)
    sc.tile(b_name, *CRM_B)
    sc.tile("worker-seated-turned-" + ("a" if state == "without" else "c"), *CRM_B,
            depth=sum(CRM_B) + 1.01)
    if state == "without":
        _card_on(sc, "card-customers", a_name, *CRM_A, depth=12.0)
        _card_on(sc, "card-customers", b_name, *CRM_B, depth=12.0)
        p = s["worker-printouts"]
        sc.fig(p.frames["c"][0], p.anchor, 4.62, 4.62)
    else:
        b = s["sign-pipeline"]
        sc.fig(b.canvas, b.anchor, 4.62, 4.62)

    for (col, row), look in zip(SALES, ("b", "d")):
        sc.tile("desk", col, row)
        sc.tile(f"worker-seated-{look}", col, row, depth=col + row + 1.01)

    # G5.1
    _front_door(sc)
    if state == "without":
        # the handover in the doorway: HQ inside (depth below the frame), the courier
        # on the step outside (depth above it)
        g, cr = s["worker-give"], s["courier"]
        sc.fig(g.frames["e-left"][0], g.anchor, DOOR_COL + 0.95, ROWS - 0.45, depth=8.5)
        sc.fig(cr.frames["right"][0], cr.anchor, DOOR_COL + 0.45, ROWS + 0.3, depth=8.8)
        t = s["truck"]
        sc.tile("truck", DOOR_COL, 8, dy=4, depth=DOOR_COL + 9.5)
    sc.flush()
    return sc.c
