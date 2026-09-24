"""Band 80 composite (PH1-06): one room, two states, same layout.

Everything is placed through each sprite's manifest anchor — `iso.iso_to_screen(col,
row)` for tile props, a continuous floor point for people — exactly as PH1-04 will, so
this file doubles as a check that the anchors are right.

Layout (9 x 7 tiles; col runs down-right, row down-left):

    closet ........ tiles (0..1, 0..1): cutaway partitions, door on its +c side
    DEV desk ...... tile (3, 0), nearest the closet; the queue runs along row ~1.4
    queue lane .... row 2 is kept clear for the line at DEV
    sales pit ..... desks at (4,3) (6,3) (4,5) (6,5)
    floor cable ... out of the closet front, along +r at col 1.5, then +c along row 4.5
    lobby ......... sofa on (0,2)-(0,3), front door in the back-left wall at (0,5)
    support desk .. (built only) tile (1,5), by the door, SLA board beside it
"""
from __future__ import annotations

from .dsl import Canvas
from . import iso
from .vox import dotted

COLS, ROWS = 9, 7
SIZE = (300, 214)
ORIGIN = (134, 84)

DESKS = [(4, 3), (6, 3), (4, 5), (6, 5)]
DEV_DESK = (3, 0)
SUPPORT_DESK = (1, 5)


def at(col, row):
    return iso.iso_to_screen(col, row, ORIGIN)


def floor_pt(fc, fr):
    """Screen point of a continuous floor position (tile (i, j) spans i..i+1)."""
    return (ORIGIN[0] + round((fc - fr) * 16), ORIGIN[1] + round((fc + fr - 2) * 8))


class Scene:
    def __init__(self, sprites):
        self.s = sprites
        self.c = Canvas(*SIZE)
        self.items = []  # (depth, order, fn)

    def paste(self, canvas, anchor, pt):
        self.c.paste(canvas, pt[0] - anchor[0], pt[1] - anchor[1])

    def tile(self, name, col, row, depth=None, dx=0, dy=0):
        spr = self.s[name]
        pt = at(col, row)
        pt = (pt[0] + dx, pt[1] + dy)
        d = col + row + 1 if depth is None else depth
        self.items.append((d, len(self.items), lambda: self.paste(spr.canvas, spr.anchor, pt)))
        return pt

    def fig(self, canvas, anchor, fc, fr, depth=None):
        pt = floor_pt(fc, fr)
        d = fc + fr if depth is None else depth
        self.items.append((d, len(self.items), lambda: self.paste(canvas, anchor, pt)))
        return pt

    def flush(self):
        for _, _, fn in sorted(self.items, key=lambda t: (t[0], t[1])):
            fn()
        self.items = []


def _structure(sc: Scene, state: str):
    s = sc.s
    # floor slab edges first (they hang below the front tiles), then the floor
    for col in range(COLS):
        sc.paste(s["slab-l"].canvas, s["slab-l"].anchor, at(col, ROWS - 1))
    for row in range(ROWS):
        sc.paste(s["slab-r"].canvas, s["slab-r"].anchor, at(COLS - 1, row))
    for row in range(ROWS):
        for col in range(COLS):
            name = "floor-closet" if col <= 1 and row <= 1 else "floor-office"
            sc.paste(s[name].canvas, s[name].anchor, at(col, row))
    # back walls
    sc.paste(s["wall-corner"].canvas, s["wall-corner"].anchor, at(0, 0))
    for row in range(ROWS):
        name = {5: "wall-back-l-door", 3: "wall-back-l-window"}.get(row, "wall-back-l")
        if row == ROWS - 1:
            name = "wall-back-l-end"
        sc.paste(s[name].canvas, s[name].anchor, at(0, row))
    for col in range(COLS):
        name = "wall-back-r-window" if col in (3, 5, 7) else "wall-back-r"
        if col == COLS - 1:
            name = "wall-back-r-end"
        sc.paste(s[name].canvas, s[name].anchor, at(col, 0))
    if state == "built":
        for col in range(COLS):
            sc.paste(s["cable-tray"].canvas, s["cable-tray"].anchor, at(col, 0))


def _closet(sc: Scene, state: str):
    if state == "without":
        sc.tile("closet-shelf", 0, 0, depth=0.6)
        sc.tile("mop-bucket", 0, 1, depth=1.5)
        sc.tile("box-fan", 1, 1, dx=-10, dy=-3, depth=2.2)
        sc.tile("cable-spill", 2, 0, depth=2.6)
        door = "partition-r-door-open"
    else:
        sc.tile("rack", 0, 0, depth=0.8)
        sc.tile("firewall", 0, 0, depth=0.81)
        door = "partition-r-door-closed"
    sc.tile("partition-c", 0, 1, depth=2.05)
    sc.tile("partition-c", 1, 1, depth=3.05)
    sc.tile(door, 1, 0, depth=2.5)
    sc.tile("partition-r-end", 1, 1, depth=3.1)


def compose(sprites: dict, state: str) -> Canvas:
    assert state in ("without", "built")
    sc = Scene(sprites)
    s = sprites
    _structure(sc, state)
    _closet(sc, state)
    net_targets = []

    # the sales pit
    seated = {"without": {(4, 3): "a", (6, 5): "d"},
              "built": {(4, 3): "a", (6, 3): "c", (4, 5): "e", (6, 5): "d"}}[state]
    desk_name = "desk-postit" if state == "without" else "desk-padlock"
    for (col, row) in DESKS:
        pt = sc.tile(desk_name, col, row)
        spr = s[desk_name]
        net_targets.append((pt[0] - spr.anchor[0] + spr.points["net"][0],
                            pt[1] - spr.anchor[1] + spr.points["net"][1]))
        if (col, row) in seated:
            sc.tile(f"worker-seated-{seated[(col, row)]}", col, row, depth=col + row + 1.01)

    # the developer's desk, nearest the closet
    dev = "desk-dev" if state == "without" else "desk-dev-built"
    pt = sc.tile(dev, *DEV_DESK)
    net_targets.append((pt[0] - s[dev].anchor[0] + s[dev].points["net"][0],
                        pt[1] - s[dev].anchor[1] + s[dev].points["net"][1]))
    sc.tile("worker-seated-b", *DEV_DESK, depth=sum(DEV_DESK) + 1.01)

    if state == "without":
        # the queue at DEV: six people, one with a dead laptop held overhead
        queue = [("c", "idle"), ("a", "laptop"), ("e", "idle"), ("d", "idle"),
                 ("b", "idle"), ("c", "idle")]
        for i, (look, kind) in enumerate(queue):
            fc, fr = 4.95 + i * 0.62, 1.65
            if kind == "laptop":
                q = s["worker-queue"]
                sc.fig(q.frames[f"{look}-left"], q.anchor, fc, fr)
            else:
                w = s[f"worker-{look}"]
                sc.fig(w.frames["idle-left"], w.anchor, fc, fr)
        # the taped floor cable, and someone stepping over it
        for row in (2, 3):
            sc.tile("cable-floor-r", 1, row, depth=row + 1.0)
        sc.tile("cable-floor-turn", 1, 4, depth=5.0)
        for col in range(2, COLS):
            sc.tile("cable-floor-c", col, 4, depth=col + 4.0)
        sc.tile("sign-caution", 7, 4, dx=-10, dy=-2, depth=11.6)
        w = s["worker-c"]
        sc.fig(w.frames["step-right"], w.anchor, 8.05, 4.55)
    else:
        # the support desk by the front door, its board, one person being helped
        sc.tile("desk", *SUPPORT_DESK)
        sc.tile("worker-seated-e", *SUPPORT_DESK, depth=sum(SUPPORT_DESK) + 1.01)
        b = s["sla-board"]
        sc.fig(b.canvas, b.anchor, 1.45, 4.4, depth=5.85)
        w = s["worker-a"]
        sc.fig(w.frames["idle-left"], w.anchor, 2.35, 5.95)
        # and someone walking where the cable was, on a clear floor
        w = s["worker-c"]
        sc.fig(w.frames["right"][0], w.anchor, 8.05, 4.55)

    # the lobby: sofa, plant, the visitor
    sc.tile("sofa", 0, 2, depth=3.5)
    sc.tile("plant", 0, 6, depth=6.4)
    vis = s["visitor"]
    vpt = sc.fig(vis.canvas, vis.anchor, 0.95, 3.05, depth=3.9)
    laptop = (vpt[0] - vis.anchor[0] + vis.points["net"][0],
              vpt[1] - vis.anchor[1] + vis.points["net"][1])

    sc.flush()

    # "on the network": dotted lines from the visitor's laptop
    if state == "without":
        shelf_pt = at(0, 0)
        sh = s["closet-shelf"]
        router = (shelf_pt[0] - sh.anchor[0] + sh.points["net"][0],
                  shelf_pt[1] - sh.anchor[1] + sh.points["net"][1])
        for tgt in [router] + net_targets:
            dotted(sc.c, laptop, tgt, "net", halo="outline")
    else:
        fw_pt = at(0, 0)
        fw = s["firewall"]
        wall_pt = (fw_pt[0] - fw.anchor[0] + fw.points["net"][0],
                   fw_pt[1] - fw.anchor[1] + fw.points["net"][1])
        dotted(sc.c, laptop, wall_pt, "net", halo="outline")

    tag = s["tag-visitor"]
    sc.paste(tag.canvas, tag.anchor, (vpt[0] - 3, vpt[1] - 25))
    return sc.c
