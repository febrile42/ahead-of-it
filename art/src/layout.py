"""Room compositions as data (PH1-07, re-cut into rooms by PH1-10): every band x state
scene is a set of **views** (D-036), each a whole room drawn on its own canvas, each a
list of placements that `compose.py` renders from the manifest and the shipped PNGs.

**Views are rooms, not crops (PH1-10, D-037 item 8).** `ground` is HQ's ground-floor
room, `floor-2` the room one storey up, `street` the exterior: HQ's front door, the road
and the inset office on one pavement plate. Each has its own walls (or kerb), floor and
slab, and its canvas is fitted to what is drawn in it (`view_frame`), so no view edge
ever cuts a person or a desk. A placement says which view it lives in (`view`, default
`ground`); each gag's primary part lives in its D-036 home view.

**Cumulative (R-03a, D-026).** The building grows; nothing in it moves. A view's room
may grow in a later band (floor-2 gains a glass conference room at 220), but every
placement keeps its tile in every later band. `scene(B, state)` is every placement whose
`band` <= B and whose `states` include `state`, grouped by view.

**Quieter.** An earlier band's items stay on screen at their *minimum legible form*: a
placement's `quiet` says what happens to it when the band being shown is later than its
own — "drop" (secondary actors and crowd members beyond the few that tell the joke;
preview-only callouts) or a dict of overrides. The current band's items are full-size.

Billboard labels (notes, cards) go in the "over" layer, after the network lines, so
text always reads (style.md "On the network").

Coordinates: `tile` = [col, row] (anchor on the tile's front vertex), `floor` =
[fc, fr] continuous floor (tile (i, j) spans i..i+1), both in the view's own grid. See
compose.py for the rest.
"""
from __future__ import annotations

BOTH = ("without", "built")
W = ("without",)
B = ("built",)

# D-036 rule 1's canonical order.
VIEW_ORDER = ["ground", "floor-2", "floor-3", "floor-4", "floor-5", "floor-6", "top", "street"]

# -- rooms ------------------------------------------------------------------------------
# Per view, the room as it stands from a band on: [(from_band, spec)]. `kind` "room" is an
# interior (back walls, floor, slab); "street" is the exterior pavement plate (kerb and
# slab, no walls — the buildings on it are placements).

ROOMS = {
    "ground": [
        (80, dict(kind="room", cols=10, rows=7, closet=True, tray=True,
                  back_l={4: "wall-back-l-door"},
                  back_r_windows=(3, 7, 9))),
        # PH1-11: re-composed for nine primaries (see _ground360)
        (360, dict(kind="room", cols=12, rows=9, closet=(1, 4), tray=True,
                   back_l={5: "wall-back-l-door"},
                   back_r_windows=(6, 10))),
    ],
    "floor-2": [
        (150, dict(kind="room", cols=8, rows=7,
                   back_l={2: "wall-back-l-window", 4: "wall-back-l-window"},
                   back_r_windows=(3, 7))),
        (220, dict(kind="room", cols=12, rows=7,
                   back_l={2: "wall-back-l-window", 4: "wall-back-l-window"},
                   back_r_windows=(3, 7))),
        # PH1-11: a row deeper, so the aisle along the back-left wall (G7.3) runs clear
        (360, dict(kind="room", cols=12, rows=8,
                   back_l={2: "wall-back-l-window", 4: "wall-back-l-window"},
                   back_r_windows=(3, 7))),
    ],
    "street": [
        (150, dict(kind="street", cols=10, rows=8)),
        # PH1-11: HQ moves to the back-right as a taller, narrower block; the inset
        # office on the left grows to 5 x 5 (G5.6 and, at 490, G6.4 live in it)
        (360, dict(kind="street", cols=11, rows=8)),
    ],
}

MARGIN = 2          # px of clear canvas around everything drawn in a view


def room(view: str, band: int) -> dict | None:
    """The room `view` is at `band`, or None if it doesn't exist yet."""
    best = None
    for b, spec in ROOMS.get(view, []):
        if b <= band:
            best = spec
    return best


def _t(sprite, col, row, **kw):
    return dict(sprite=sprite, tile=[col, row], **kw)


def _f(sprite, fc, fr, **kw):
    return dict(sprite=sprite, floor=[fc, fr], **kw)


def structure(view: str, band: int, state: str) -> list:
    """The shell of one view: slab edges, floor, back walls (interiors); or the pavement
    plate and its slab (the street)."""
    r = room(view, band)
    cols, rows = r["cols"], r["rows"]
    out = []
    for col in range(cols):
        out.append(_t("slab-l", col, rows - 1, layer="base"))
    for row in range(rows):
        out.append(_t("slab-r", cols - 1, row, layer="base"))
    if r["kind"] == "street":
        for row in range(rows):
            for col in range(cols):
                out.append(_t("pavement", col, row, layer="base"))
        return out
    for row in range(rows):
        for col in range(cols):
            cl = r.get("closet")
            if cl is True:
                cl = (1, 1)
            closet = bool(cl) and col <= cl[0] and row <= cl[1]
            out.append(_t("floor-closet" if closet else "floor-office", col, row,
                          layer="base"))
    out.append(_t("wall-corner", 0, 0, layer="base"))
    for row in range(rows):
        name = "wall-back-l-end" if row == rows - 1 else r["back_l"].get(row, "wall-back-l")
        out.append(_t(name, 0, row, layer="base"))
    for col in range(cols):
        name = "wall-back-r-window" if col in r["back_r_windows"] else "wall-back-r"
        if col == cols - 1:
            name = "wall-back-r-end"
        out.append(_t(name, col, 0, layer="base"))
    if state == "built" and r.get("tray"):
        for col in range(cols):
            out.append(_t("cable-tray", col, 0, layer="base"))
    return out


# -- band 80 ----------------------------------------------------------------------------

B80_DESKS = [(6, 3), (8, 3), (6, 5), (8, 5)]
DEV = (5, 0)          # the developer's desk, back-right wall
HELP = (8, 1)         # built: the support desk, where the queue stood


def _band80() -> list:
    """PH1-10 (item 1): re-spaced so every primary is >= 44 px from every other at 1x
    (D-036 rule 7) — the closet in the back corner, the lobby on the back-left wall by
    the front door, the developer and the queue along the back-right wall, the pit in
    the middle, the taped cable in front of it, and clear floor by the closet door for
    band 150's trolley."""
    P = []
    # G1.1 the closet (and its cutaway partitions, both states). Only the closet's own
    # contents are gag-tagged; the partitions and the cable spilling out past them are
    # structural/scenery.
    P += [
        _t("closet-shelf", 0, 0, depth=0.6, states=W, id="router", gag="G1.1", part="closet"),
        _t("mop-bucket", 0, 1, depth=1.5, states=W, gag="G1.1", part="closet"),
        _t("box-fan", 1, 1, dx=-10, dy=-3, depth=2.2, states=W, gag="G1.1", part="closet"),
        _t("cable-spill", 2, 0, depth=2.6, states=W),
        _t("rack", 0, 0, depth=0.8, states=B, gag="G1.1", part="closet"),
        _t("firewall", 0, 0, depth=0.81, states=B, id="firewall", gag="G1.1", part="closet"),
        _t("partition-c", 0, 1, depth=2.05),
        _t("partition-c", 1, 1, depth=3.05),
        _t("partition-r-door-open", 1, 0, depth=2.5, states=W),
        _t("partition-r-door-closed", 1, 0, depth=2.5, states=B),
        _t("partition-r-end", 1, 1, depth=3.1),
    ]
    # G1.2 the sales pit: post-its / padlocks; the note-peeler at the back-left desk.
    peel_at = B80_DESKS[1]
    seated = {"without": {B80_DESKS[0]: "a", B80_DESKS[3]: "d"},
              "built": dict(zip(B80_DESKS, "aced"))}
    for (col, row) in B80_DESKS:
        P.append(_t("desk-notes", col, row, states=W, id=f"desk80-{col}-{row}",
                    gag="G1.2", part="pit"))
        P.append(_t("desk-padlock", col, row, states=B, gag="G1.2", part="pit"))
        for st in BOTH:
            if (col, row) in seated[st]:
                P.append(_t("worker-seated", col, row, frame=seated[st][(col, row)],
                            depth=col + row + 1.01, states=(st,), gag="G1.2", part="pit"))
        if (col, row) == peel_at:
            P.append(_t("worker-peel", col, row, frame="e", depth=col + row + 1.01,
                        states=W, quiet="drop", gag="G1.2", part="pit"))
    # G2.1 the developer's desk and the queue down the back-right wall
    dc, dr = DEV
    P += [
        _t("desk-dev", dc, dr, states=W, id="desk-dev", gag="G2.1", part="queue"),
        # desk-dev-built and its occupant carry no gag tag: G2.1's built-state story is
        # the helpdesk group below, not this desk.
        _t("desk-dev-built", dc, dr, states=B),
        _t("worker-seated", dc, dr, frame="b", depth=dc + dr + 1.01),
    ]
    queue = [("worker-c", "idle-left"), ("worker-queue", "a-left"), ("worker-e", "idle-left"),
             ("worker-d", "idle-left"), ("worker-b", "idle-left"), ("worker-c", "idle-left")]
    for i, (spr, fr) in enumerate(queue):
        P.append(_f(spr, dc + 0.95 + i * 0.62, 1.65, frame=fr, states=W,
                    quiet="drop" if i >= 3 else "keep", gag="G2.1", part="queue"))
    # G2.2 the taped floor cable (PH1-10 fix round: off the slab edge, where it read as
    # a border): out of the closet door, down the open floor between the lobby and the
    # trolley's spot, then across the open floor to the first pit desk. Someone straddles
    # it where the walkway crosses, the CAUTION sign at the crossing. The cable tiles
    # are plain scenery (a hotspot that long would sit on G1.2's).
    P += [_t("cable-tape-r", 2, row, depth=row + 3.0, states=W) for row in range(1, 5)]
    P += [_t("cable-tape-turn", 2, 5, depth=7.5, states=W)]
    P += [_t("cable-tape-c", col, 5, depth=col + 5.5, states=W) for col in range(3, 6)]
    P += [
        _t("sign-caution", 4, 5, dx=-6, dy=-5, depth=9.2, states=W, gag="G2.2", part="cable"),
        _f("worker-c", 5.4, 5.55, frame="step-right", depth=11.0, states=W, quiet="drop",
           gag="G2.2", part="cable"),
    ]
    # G2.1 built: the support desk where the queue stood, its board, someone being
    # helped
    hc, hr = HELP
    P += [
        _t("desk", hc, hr, states=B, gag="G2.1", part="helpdesk"),
        _t("worker-seated", hc, hr, frame="e", depth=hc + hr + 1.01, states=B,
           gag="G2.1", part="helpdesk"),
        _f("sla-board", hc + 0.45, hr - 0.6, depth=hc + hr - 0.15, states=B,
           gag="G2.1", part="helpdesk"),
        _f("worker", hc + 1.35, hr + 0.95, frame="idle-left", states=B, quiet="drop",
           gag="G2.1", part="helpdesk"),
    ]
    # G2.3 the lobby and the visitor
    P += [
        _t("sofa", 0, 2, depth=3.5, gag="G2.3", part="lobby"),
        _t("plant", 0, 6, depth=6.4),
        _f("visitor", 0.95, 3.05, depth=3.9, id="visitor", gag="G2.3", part="lobby"),
    ]
    # on the network: without, to the router and every desk; built, to the firewall only
    for tgt in ["router"] + [f"desk80-{c}-{r}" for (c, r) in B80_DESKS] + ["desk-dev"]:
        P.append(dict(line="dotted", layer="over", states=W, gag="G2.3", part="lobby",
                      **{"from": {"id": "visitor", "point": "net"},
                         "to": {"id": tgt, "point": "net"}}))
    P.append(dict(line="dotted", layer="over", states=B, gag="G2.3", part="lobby",
                  **{"from": {"id": "visitor", "point": "net"},
                     "to": {"id": "firewall", "point": "net"}}))
    P.append(dict(sprite="tag-visitor", attach={"id": "visitor", "offset": [-3, -25]},
                  layer="over", quiet="drop", gag="G2.3", part="lobby"))
    for p in P:
        p.setdefault("band", 80)
        p.setdefault("view", "ground")
        p.setdefault("until", 360)       # PH1-11: the ground floor is re-composed at 360
    return P


# -- band 150: floor 2 (finance, the CRMs, the CEO's desk); the street ------------------

# The street plate (10 x 8): HQ stands along the back, c 3..10, r 0..3, its front door on
# the front-left face at c 5..6; the road runs out of the door toward the viewer, turns,
# and reaches the inset office (c 0..3, r 5..8) at its front-right doorway.
HQ = dict(c0=3, c1=10, r0=0, r1=3)
HQ_DOOR = 5          # the door is on the front-left face of tile (HQ_DOOR, r1 - 1)
INSET = dict(c0=0, c1=2, r0=5, r1=7)


def _inset(band: int) -> list:
    i = INSET
    P = []
    for row in range(i["r0"], i["r1"] + 1):
        for col in range(i["c0"], i["c1"] + 1):
            P.append(_t("floor-office", col, row, layer="base"))
    P.append(_t("wall-corner", i["c0"], i["r0"], layer="base"))
    for row in range(i["r0"], i["r1"] + 1):
        name = "wall-back-l-end" if row == i["r1"] else (
            "wall-back-l-window" if row == i["r0"] + 1 else "wall-back-l")
        P.append(_t(name, i["c0"], row, layer="base"))
    for col in range(i["c0"], i["c1"] + 1):
        # plain: band 220's screen (G2.4) fills this wall; the window is on the other
        name = "wall-back-r-end" if col == i["c1"] else "wall-back-r"
        P.append(_t(name, col, i["r0"], layer="base"))
    for col in range(i["c0"], i["c1"] + 1):
        name = "partition-c-end" if col == i["c1"] else "partition-c"
        P.append(_t(name, col, i["r1"], depth=col + i["r1"] + 1.95))
    for row in range(i["r0"], i["r1"] + 1):
        name = "partition-r-end" if row == i["r1"] else (
            "partition-r-doorway" if row == i["r0"] + 1 else "partition-r")
        P.append(_t(name, i["c1"], row, depth=i["c1"] + row + 1.95))
    P.append(_t("desk", i["c0"], i["r1"]))
    P.append(_t("worker-seated", i["c0"], i["r1"], frame="b",
                depth=i["c0"] + i["r1"] + 1.01, states=B))
    # without: on the step outside the door, at the kerb, checking the time
    # at 220 (quieter) she waits further down the kerb, clear of the doorway and of
    # G2.4's inset scene
    P.append(_f("worker-watch", i["c1"] + 1.25, i["r0"] + 1.3, frame="b", depth=i["r0"] + 5.2,
                states=W, gag="G5.1", part="inset-door", primary=False,
                quiet=dict(floor=[i["c1"] + 2.6, i["r0"] + 2.3], depth=i["r0"] + 7.9)))
    return P


def _band150() -> list:
    P = []
    # G3.2: the trolley parked on clear floor outside the closet door / the shelf
    # against the wall beside the developer (ground); the shop box on the CEO's desk
    # (floor 2). PH1-10 item 2: nothing under or behind the trolley but floor.
    P += [
        _t("trolley", 3, 2, states=W, id="trolley", gag="G3.2", part="trolley"),
        dict(sprite="note-dave", attach={"id": "trolley", "point": "note"}, states=W,
             layer="over", gag="G3.2", part="trolley"),
        _t("laptop-shelf", 3, 0, states=B, gag="G3.2", part="trolley"),
    ]
    F2 = "floor-2"
    P += [
        _t("desk-retail-box", 1, 0, states=W, view=F2, gag="G3.2", part="box",
           primary=False),
        # built: the CEO's laptop came the managed way; the same desk is G3.2's
        # second part in both states (SCENE-FORMAT: G3.2 is two-part in both)
        _t("desk", 1, 0, states=B, view=F2, gag="G3.2", part="box", primary=False),
    ]
    # G4.2: the finance desk, a tile off the back wall so the line hangs in open air
    fc_, fr_ = 5, 1
    P += [
        _t("desk", fc_, fr_, id="finance", view=F2, gag="G4.2", part="desk"),
        _t("fishing-line", fc_, fr_, depth=fc_ + fr_ + 1.005, states=W, view=F2, gag="G4.2", part="desk"),
        _t("worker-reach", fc_, fr_, frame="a", depth=fc_ + fr_ + 1.01, states=W, view=F2, gag="G4.2",
           part="desk"),
        _t("fishing-shield", fc_, fr_, depth=fc_ + fr_ + 1.005, states=B, view=F2, gag="G4.2", part="desk"),
        _t("worker-seated", fc_, fr_, frame="a", depth=fc_ + fr_ + 1.01, states=B, view=F2, gag="G4.2",
           part="desk"),
        dict(sprite="card-report", attach={"id": "finance", "point": "net"}, states=B,
             layer="over", view=F2, gag="G4.2", part="desk"),
    ]
    # G4.3: two desks back to back, screens +r and +c, someone where their backs meet
    cc, cr = 5, 4
    P += [
        _t("desk-sheet", cc, cr, states=W, id="crm-a", view=F2, gag="G4.3", part="desks"),
        _t("desk", cc, cr, states=B, view=F2, gag="G4.3", part="desks"),
        _t("worker-seated", cc, cr, frame="e", depth=cc + cr + 1.01, view=F2, gag="G4.3",
           part="desks"),
        _t("desk-turned-sheet", cc - 1, cr + 1, states=W, id="crm-b", view=F2, gag="G4.3",
           part="desks"),
        _t("desk-turned", cc - 1, cr + 1, states=B, view=F2, gag="G4.3", part="desks"),
        _t("worker-seated-turned", cc - 1, cr + 1, frame="a", depth=cc + cr + 1.01,
           states=W, view=F2, gag="G4.3", part="desks"),
        _t("worker-seated-turned", cc - 1, cr + 1, frame="c", depth=cc + cr + 1.01,
           states=B, view=F2, gag="G4.3", part="desks"),
        dict(sprite="card-customers", attach={"id": "crm-a", "point": "card"},
             states=W, layer="over", view=F2, gag="G4.3", part="desks"),
        dict(sprite="card-customers", attach={"id": "crm-b", "point": "card"},
             states=W, layer="over", view=F2, gag="G4.3", part="desks"),
        _f("worker-printouts", cc + 0.62, cr + 1.62, frame="c", states=W, view=F2,
           gag="G4.3", part="desks"),
        _f("sign-pipeline", cc + 0.62, cr + 1.62, states=B, view=F2, gag="G4.3",
           part="desks"),
    ]
    # the rest of the floor: two desks, people at them
    for (col, row), look in (((2, 3), "c"), ((2, 5), "b")):
        P.append(_t("desk", col, row, view=F2))
        P.append(_t("worker-seated", col, row, frame=look, depth=col + row + 1.01, view=F2))
    # G5.1 (street): HQ, its front door, the handover, the road, the van / the link
    S = "street"
    d, dr = HQ_DOOR, HQ["r1"]
    P += [
        _t("hq-3", HQ["c1"] - 1, HQ["r1"] - 1, depth=1.0, view=S),
        _t("hq-door", d, dr - 1, frame="open", depth=1.1, states=W, view=S,
           gag="G5.1", part="handover"),
        _t("hq-door", d, dr - 1, frame="closed", depth=1.1, states=B, view=S,
           gag="G5.1", part="handover"),
        # HQ in the doorway, the courier outside on the step
        _f("worker-give", d + 0.95, dr - 0.1, frame="e-left", depth=dr + d + 0.5, states=W,
           quiet="drop", view=S, gag="G5.1", part="handover"),
        _f("courier", d + 0.45, dr + 0.65, frame="right", depth=dr + d + 0.8, states=W,
           quiet="drop", view=S, gag="G5.1", part="handover"),
    ]
    road = [(d, dr, "road-r"), (d, dr + 1, "road-r"), (d, dr + 2, "road-r"),
            (d, dr + 3, "road-turn"), (d - 1, dr + 3, "road-c"), (d - 2, dr + 3, "road-c")]
    link = {"road-r": "link-r", "road-turn": "link-turn", "road-c": "link-c"}
    P += [_t(n, c, r, layer="base", view=S) for (c, r, n) in road]
    P += [_t(link[n], c, r, layer="base", states=B, view=S) for (c, r, n) in road]
    P.append(_t("truck", d, dr + 1, dy=4, depth=d + dr + 2.5, states=W, view=S,
                gag="G5.1", part="truck", primary=False))
    P += [dict(p, view=S) for p in _inset(150)]
    for p in P:
        p.setdefault("band", 150)
        p.setdefault("view", "ground")
        if p["view"] in ("ground", "street"):
            p.setdefault("until", 360)   # PH1-11: re-composed at 360 (_ground360 etc.)
    return P


# -- band 220: floor 2 grows four columns; a glass conference room in the corner --------

GLASS = dict(c0=8, c1=11, r0=0, r1=2)
WB = (10.3, 5.2)      # the whiteboard's feet


def _band220() -> list:
    g = GLASS
    F2 = "floor-2"
    P = []
    # G2.4: the room, the TV, the table
    P += [
        _t("tv-frozen", g["c0"] + 1, 0, depth=0.5, states=W, gag="G2.4", part="room"),
        _t("tv-live", g["c0"] + 1, 0, depth=0.5, states=B, gag="G2.4", part="room"),
        _t("camera-bar", g["c0"] + 1, 0, depth=0.6, states=B, gag="G2.4", part="room"),
        _t("conf-table", g["c0"], 1, states=B, gag="G2.4", part="room"),
        _t("conf-huddle", g["c0"], 1, states=W, gag="G2.4", part="room"),
    ]
    for col, look in zip(range(g["c0"], g["c1"] + 1), "aced"):
        P.append(_t("worker-seated", col, 1, frame=look, depth=col + 2.01, states=B,
                    gag="G2.4", part="room"))
    # two at each end of the table, the gap left open so the one laptop shows
    c0 = g["c0"]
    for (fc, fr), fr_key in (((c0 + 0.85, 2.3), "a"), ((c0 + 1.4, 2.45), "c-dongle"),
                             ((c0 + 2.75, 2.4), "e"), ((c0 + 3.3, 2.25), "d")):
        P.append(_f("worker-huddle", fc, fr, frame=fr_key, states=W, gag="G2.4", part="room"))
    for row in range(g["r0"], g["r1"] + 1):
        P.append(_t("glass-r-door" if row == 1 else "glass-r", g["c0"] - 1, row,
                    depth=g["c0"] - 1 + row + 1.95))
    for col in range(g["c0"], g["c1"] + 1):
        name = {g["c0"]: "glass-c-corner", g["c1"]: "glass-c-end"}.get(col, "glass-c")
        P.append(_t(name, col, g["r1"], depth=col + g["r1"] + 1.95))
    # G7.3a: out on the open floor in front of the new bay, clear of the glass: the
    # whiteboard between them, the two pointing at each other across it / the hat
    P += [
        _f("whiteboard-requests", WB[0], WB[1], states=W, id="wb", gag="G7.3a", part="board"),
        _f("whiteboard-owned", WB[0], WB[1], states=B, gag="G7.3a", part="board"),
        _f("sales", WB[0] - 1.0, WB[1] + 0.9, frame="point-right", states=W,
           gag="G7.3a", part="board"),
        _f("engineer", WB[0] + 1.2, WB[1] - 0.6, frame="point-left", states=W,
           gag="G7.3a", part="board"),
        # PH1-11: the PRODUCT hat walks off at 360 (G7.3), so she leaves the board
        _f("worker-hat", WB[0] + 2.1, WB[1] - 0.2, frame="e-left", states=B, quiet="drop",
           gag="G7.3a", part="board"),
    ]
    # more of the floor: a desk in the new bay
    P.append(_t("desk", 7, 4))
    P.append(_t("worker-seated", 7, 4, frame="a", depth=12.01))
    for p in P:
        p.setdefault("band", 220)
        p.setdefault("view", F2)
    # the street: HQ is a storey taller
    S = "street"
    i = INSET
    tv = (i["c0"], i["r0"])                # conference size, centred on the back wall
    P += [
        _t("hq-4", HQ["c1"] - 1, HQ["r1"] - 1, depth=1.0, view=S, band=220),
        # G2.4's second part (PH1-10), in the inset office. Without: the same call from
        # the other end — HQ's person frozen mid-wave on the screen, and the inset's
        # person beside it, side on, waving back into the stall. Nobody stands in front
        # of the screen. Built: the inset's own kit, camera bar over a live face.
        _t("tv-frozen-inset", *tv, depth=i["r0"] + 1.5, states=W, view=S, band=220,
           gag="G2.4", part="inset", primary=False),
        _f("worker-wave", i["c0"] + 0.3, i["r0"] + 0.95, frame="c-right", states=W,
           view=S, band=220, gag="G2.4", part="inset", primary=False),
        _t("tv-live-inset", *tv, depth=i["r0"] + 1.5, states=B, view=S, band=220,
           gag="G2.4", part="inset", primary=False),
        _t("camera-bar", *tv, depth=i["r0"] + 1.6, states=B, view=S, band=220,
           gag="G2.4", part="inset", primary=False),
        # built: someone on the call, facing the screen, the wave returned
        _t("chair", i["c0"] + 1, i["r0"] + 1, states=B, view=S, band=220,
           gag="G2.4", part="inset", primary=False),
        _t("worker-seated-wave", i["c0"] + 1, i["r0"] + 1, frame="a",
           depth=i["c0"] + i["r0"] + 3.01, states=B, view=S, band=220,
           gag="G2.4", part="inset", primary=False),
    ]
    for p in P:
        if p["view"] == S:
            p.setdefault("until", 360)   # PH1-11: the street is re-composed at 360
    return P


# -- band 360: the ground floor, re-composed ----------------------------------------------

# PH1-11. Nine ground-floor primaries by 490 (D-036 rule 4) don't fit band 80's 10 x 7
# room at >= 44 px, so from 360 the ground floor is a new, bigger picture (12 x 9): the
# closet runs down the back-left wall with the router at the back and the main server
# at the front (G5.3 is a callback to G1.1: the same closet, again), the phone row
# along the back-right wall beside it with its cords knotted into the closet door, the
# developer and his queue further along that wall, the pit in the middle, the lobby by
# the front door on the back-left wall, the trolley and the taped cable on the open
# floor between them, and the front row for band 490's new hire. Every earlier gag is
# re-placed here in its quiet form (the `band` it keeps says how quiet).

CL = dict(c1=1, r1=4, door=2)          # the closet: cols 0..1, rows 0..4, door on row 2
G_DEV = (8, 0)
G_HELP = (10, 1)
G_PIT = [(6, 4), (8, 4), (6, 6), (8, 6)]
PHONES = [3, 4, 5]                     # the phone row, back-right wall, row 0
LOBBY = 6                              # the sofa's rear tile row; the door is on row 5


def _ground360() -> list:
    P = []
    # the closet's cutaway partitions: the front (+r) edge, and the +c edge with its door
    for col in range(CL["c1"] + 1):
        P.append(_t("partition-c", col, CL["r1"], depth=col + CL["r1"] + 1.95, band=80))
    for row in range(CL["r1"] + 1):
        if row == CL["door"]:
            P.append(_t("partition-r-door-open", CL["c1"], row, depth=CL["c1"] + row + 1.9,
                        states=W, band=80))
            P.append(_t("partition-r-door-closed", CL["c1"], row,
                        depth=CL["c1"] + row + 1.9, states=B, band=80))
        else:
            name = "partition-r-end" if row == CL["r1"] else "partition-r"
            P.append(_t(name, CL["c1"], row, depth=CL["c1"] + row + 1.95, band=80))
    # G1.1, at the back of the closet
    P += [
        _t("closet-shelf", 0, 0, depth=0.6, states=W, id="router", gag="G1.1",
           part="closet", band=80),
        _t("mop-bucket", 0, 1, depth=1.5, states=W, gag="G1.1", part="closet", band=80),
        _t("box-fan", 1, 1, dx=-10, dy=-3, depth=2.2, states=W, gag="G1.1",
           part="closet", band=80),
        _t("cable-spill", CL["c1"] + 1, CL["door"], depth=CL["door"] + 2.6, states=W,
           band=80),
        _t("rack", 0, 0, depth=0.8, states=B, gag="G1.1", part="closet", band=80),
        _t("firewall", 0, 0, depth=0.81, states=B, id="firewall", gag="G1.1",
           part="closet", band=80),
    ]
    # G5.3, at the front of the same closet: the main server, two fans on it, the sign
    P += [
        _f("sign-dnto", 0.12, 2.2, dy=-25, depth=3.2, states=W, gag="G5.3",
           part="server"),
        _t("server-tower", 0, 3, states=W, id="tower", gag="G5.3", part="server"),
        dict(sprite="label-main-server", attach={"id": "tower", "point": "label"},
             states=W, gag="G5.3", part="server"),
        _t("box-fan-l", 1, 3, dx=-2, depth=5.0, states=W, gag="G5.3", part="server"),
        _t("box-fan-l", 1, 3, dx=-2, dy=-12, depth=5.01, states=W, gag="G5.3",
           part="server"),
        _t("rack", 0, 3, depth=3.8, states=B, id="rack2", gag="G5.3", part="server"),
        _f("card-virtualised", 0.12, 4.75, dy=-30, depth=3.2, states=B, gag="G5.3",
           part="server"),
        _f("icon-dr", 0.12, 2.35, dy=-24, depth=3.1, states=B, gag="G5.3",
           part="server"),
    ]
    # G5.4, the phone row: two phones and the coin box, the cords knotted into the
    # closet door / headsets, no cords, the receipt on the wall
    looks = {3: "c", 4: "d"}
    for col in PHONES:
        if col in looks:
            P.append(_t("desk-phone", col, 0, states=W, gag="G5.4", part="phones"))
            P.append(_t("worker-seated", col, 0, frame=looks[col], depth=col + 1.01,
                        states=W, gag="G5.4", part="phones"))
        else:
            P.append(_t("desk-coinphone", col, 0, states=W, gag="G5.4", part="phones"))
            P.append(_f("worker-coin", col + 1.55, 0.5, frame="b-left", depth=col + 1.8,
                        states=W, gag="G5.4", part="phones"))
        P.append(_t("desk", col, 0, states=B, gag="G5.4", part="phones"))
        P.append(_t("worker-seated-headset", col, 0, frame="cbd"[col - PHONES[0]],
                    depth=col + 1.01, states=B, gag="G5.4", part="phones"))
    P += [
        _t("phone-knot", CL["c1"] + 1, 1, depth=3.4, layer="main", states=W, gag="G5.4",
           part="phones"),
        _f("receipt-33", 4.55, 0.02, dy=-25, depth=0.5, states=B, gag="G5.4",
           part="phones"),
    ]
    # G2.1, the developer and his queue further along the back-right wall
    dc, dr = G_DEV
    P += [
        _t("desk-dev", dc, dr, states=W, id="desk-dev", gag="G2.1", part="queue", band=80),
        _t("desk-dev-built", dc, dr, states=B, band=80),
        _t("worker-seated", dc, dr, frame="b", depth=dc + dr + 1.01, band=80),
    ]
    queue = [("worker-c", "idle-left"), ("worker-queue", "a-left"), ("worker-e", "idle-left"),
             ("worker-d", "idle-left"), ("worker-b", "idle-left"), ("worker-c", "idle-left")]
    for i, (spr, fr) in enumerate(queue):
        P.append(_f(spr, dc + 0.95 + i * 0.62, 1.65, frame=fr, states=W,
                    quiet="drop" if i >= 3 else "keep", gag="G2.1", part="queue", band=80))
    hc, hr = G_HELP
    P += [
        _t("desk", hc, hr, states=B, gag="G2.1", part="helpdesk", band=80),
        _t("worker-seated", hc, hr, frame="e", depth=hc + hr + 1.01, states=B,
           gag="G2.1", part="helpdesk", band=80),
        _f("sla-board", hc + 0.45, hr - 0.6, depth=hc + hr - 0.15, states=B,
           gag="G2.1", part="helpdesk", band=80),
    ]
    # G1.2, the pit
    seated = {"without": {G_PIT[0]: "a", G_PIT[3]: "d", G_PIT[2]: "c"},
              "built": dict(zip(G_PIT, "aced"))}
    for (col, row) in G_PIT:
        P.append(_t("desk-notes", col, row, states=W, id=f"pit-{col}-{row}",
                    gag="G1.2", part="pit", band=80))
        P.append(_t("desk-padlock", col, row, states=B, gag="G1.2", part="pit", band=80))
        for st in BOTH:
            if (col, row) in seated[st]:
                P.append(_t("worker-seated", col, row, frame=seated[st][(col, row)],
                            depth=col + row + 1.01, states=(st,), gag="G1.2", part="pit",
                            band=80))
    # G2.3, the lobby by the front door
    P += [
        _t("sofa", 0, LOBBY, depth=LOBBY + 1.5, gag="G2.3", part="lobby", band=80),
        _t("plant", 0, 8, depth=8.4, band=80),
        _f("visitor", 0.95, LOBBY + 1.05, depth=LOBBY + 1.9, id="visitor", gag="G2.3",
           part="lobby", band=80),
    ]
    for tgt in ["router"] + [f"pit-{c}-{r}" for (c, r) in G_PIT]:
        P.append(dict(line="dotted", layer="over", states=W, gag="G2.3", part="lobby",
                      band=80, **{"from": {"id": "visitor", "point": "net"},
                                  "to": {"id": tgt, "point": "net"}}))
    P.append(dict(line="dotted", layer="over", states=B, gag="G2.3", part="lobby", band=80,
                  **{"from": {"id": "visitor", "point": "net"},
                     "to": {"id": "firewall", "point": "net"}}))
    # G3.2, the trolley on open floor beside the closet / the shelf in its place
    P += [
        _t("trolley", 3, 4, states=W, id="trolley", gag="G3.2", part="trolley", band=150),
        dict(sprite="note-dave", attach={"id": "trolley", "point": "note"}, states=W,
             layer="over", gag="G3.2", part="trolley", band=150),
        _t("laptop-shelf", 3, 4, states=B, gag="G3.2", part="trolley", band=150),
    ]
    # G2.2, the taped cable: out under the closet's front wall, down past the lobby,
    # along the front of the room and up into the pit; the sign at the corner
    P += [
        _t("cable-tape-360", 1, 5, layer="base", states=W, band=80),
        _t("sign-caution", 4, 8, dx=-4, dy=-2, depth=13.2, states=W, gag="G2.2",
           part="cable", band=80),
        _f("worker-c", 3.2, 8.5, frame="step-right", depth=14.0, states=W, quiet="drop",
           gag="G2.2", part="cable", band=80),
    ]
    for p in P:
        p.setdefault("band", 360)
        p["since"] = 360
        p["view"] = "ground"
    return P


# -- band 360: floor 2's corridor (G7.3) -------------------------------------------------

WALL_C = 0.95         # floor-2: the aisle along the back-left wall, clear of every desk


def _band360() -> list:
    """G7.3 walks the aisle along floor-2's back-left wall (the "first-floor corridor"),
    well clear of the CRM desks' cards: without, one manager under five hats; built,
    five people in the same aisle with one hat each."""
    F2 = "floor-2"
    P = [
        _f("worker-hats", WALL_C + 0.2, 5.3, frame="wobble", view=F2, gag="G7.3",
           part="hats"),
    ]
    # built: five hats on five heads; the original manager (look a) keeps INFRA
    for k, (label, look) in enumerate((("product", "e"), ("sec", "b"), ("infra", "a"),
                                       ("dev", "d"), ("support", "c"))):
        P.append(_f("worker-onehat", WALL_C, 2.0 + 1.45 * k, frame=f"{look}-{label}",
                    states=B, view=F2, gag="G7.3", part="hats"))
    for p in P:
        p.setdefault("band", 360)
        p.setdefault("states", W)
    return P


# -- band 360: the street, re-composed ---------------------------------------------------

HQ2 = dict(anchor=(10, 2), door=(8, 2))     # hq-5 / hq-6: c 7..10, r 0..2
INSET2 = dict(c0=0, c1=4, r0=3, r1=7)       # 5 x 5, doorway on the +c side at row 4
INSET2_DOOR = 4
BADGE_ROW, PROPPED_ROW = 6, 7               # G6.4's two doors, same +c side (490)
G56 = (0, 6)                                # G5.6's desk: back-left wall, under a window


def _street360() -> list:
    S = "street"
    i = INSET2
    P = []
    # HQ: five storeys at 360, six at 490 (the storeys narrated in BANDS-AND-GAGS.md)
    P.append(_t("hq-5", *HQ2["anchor"], depth=1.0, band=360, until=490))
    P.append(_t("hq-6", *HQ2["anchor"], depth=1.0, band=490, since=490))
    # G5.1: HQ's door (the handover itself went quiet at 220), the road, the truck / link
    d, dr = HQ2["door"]
    P += [
        _t("hq-door", d, dr, frame="open", depth=1.1, states=W, gag="G5.1",
           part="handover", band=150),
        _t("hq-door", d, dr, frame="closed", depth=1.1, states=B, gag="G5.1",
           part="handover", band=150),
    ]
    road = [(d, dr + 1, "road-r"), (d, dr + 2, "road-turn")] + \
           [(cc, dr + 2, "road-c") for cc in range(d - 1, i["c1"], -1)]
    link = {"road-r": "link-r", "road-turn": "link-turn", "road-c": "link-c"}
    P += [_t(n, c, r, layer="base", band=150) for (c, r, n) in road]
    P += [_t(link[n], c, r, layer="base", states=B, band=150) for (c, r, n) in road]
    P.append(_t("truck", d - 2, dr + 2, dx=0, dy=3, depth=d + dr + 2.5, states=W,
                gag="G5.1", part="truck", primary=False, band=150))
    # the inset office: floor, back walls (a window on the back-right for the NAS), the
    # cutaway front partitions with the doorway the road reaches
    for row in range(i["r0"], i["r1"] + 1):
        for col in range(i["c0"], i["c1"] + 1):
            P.append(_t("floor-office", col, row, layer="base", band=150))
    P.append(_t("wall-corner", i["c0"], i["r0"], layer="base", band=150))
    for row in range(i["r0"], i["r1"] + 1):
        name = "wall-back-l-end" if row == i["r1"] else (
            "wall-back-l-window" if row == G56[1] - 2 else "wall-back-l")
        P.append(_t(name, i["c0"], row, layer="base", band=150))
    for col in range(i["c0"], i["c1"] + 1):
        name = "wall-back-r-end" if col == i["c1"] else (
            "wall-back-r-window" if col == i["c1"] - 1 else "wall-back-r")
        P.append(_t(name, col, i["r0"], layer="base", band=150))
    for col in range(i["c0"], i["c1"] + 1):
        name = "partition-c-end" if col == i["c1"] else "partition-c"
        P.append(_t(name, col, i["r1"], depth=col + i["r1"] + 1.95, band=150))
    for row in range(i["r0"], i["r1"] + 1):
        if row == INSET2_DOOR:
            name = "partition-r-doorway"
        elif row in (BADGE_ROW, PROPPED_ROW):
            continue                      # drawn per band below
        else:
            name = "partition-r"
        P.append(_t(name, i["c1"], row, depth=i["c1"] + row + 1.95, band=150))
    for row in (BADGE_ROW, PROPPED_ROW):
        name = "partition-r-end" if row == i["r1"] else "partition-r"
        P.append(_t(name, i["c1"], row, depth=i["c1"] + row + 1.95, band=150, until=490))
    # a desk under the back-right window, someone at it (both states)
    P.append(_t("desk", i["c1"] - 1, i["r0"], band=150))
    P.append(_t("worker-seated", i["c1"] - 1, i["r0"], frame="b",
                depth=i["c1"] - 1 + i["r0"] + 1.01, band=150))
    # G2.4's inset part: the screen on the back-right wall, the waver beside it / the
    # camera bar, the wave returned from a chair
    tv = (i["c0"], i["r0"])
    P += [
        _t("tv-frozen-inset", *tv, depth=i["r0"] + 1.5, states=W, band=220, gag="G2.4",
           part="inset", primary=False),
        _f("worker-wave", i["c0"] + 0.3, i["r0"] + 0.95, frame="c-right", states=W,
           band=220, gag="G2.4", part="inset", primary=False),
        _t("tv-live-inset", *tv, depth=i["r0"] + 1.5, states=B, band=220, gag="G2.4",
           part="inset", primary=False),
        _t("camera-bar", *tv, depth=i["r0"] + 1.6, states=B, band=220, gag="G2.4",
           part="inset", primary=False),
        _t("chair", i["c0"] + 1, i["r0"] + 1, states=B, band=220, gag="G2.4",
           part="inset", primary=False),
        _t("worker-seated-wave", i["c0"] + 1, i["r0"] + 1, frame="a",
           depth=i["c0"] + i["r0"] + 3.01, states=B, band=220, gag="G2.4", part="inset",
           primary=False),
    ]
    # G5.6: the desk by the window, the drives on it, someone under it, the NAS on the
    # sill / the same desk, a storage icon on its screen, its owner sitting up
    dc, drr = G56
    P += [
        _t("desk-drives", dc, drr, states=W, id="drives-desk", gag="G5.6", part="data",
           band=360),
        dict(sprite="drives-final", attach={"id": "drives-desk", "point": "drives"},
             states=W, layer="over", gag="G5.6", part="data", band=360),
        _t("worker-under", dc, drr, frame="hunt", depth=dc + drr + 1.02, states=W,
           gag="G5.6", part="data", band=360),
        _t("nas", i["c0"], drr - 2, dy=-18, depth=drr - 0.8, layer="main",
           states=W, gag="G5.6", part="data", band=360),
        _t("desk", dc, drr, states=B, id="data-desk", gag="G5.6", part="data", band=360),
        _t("worker-seated", dc, drr, frame="d", depth=dc + drr + 1.01, states=B,
           gag="G5.6", part="data", band=360),
        dict(sprite="icon-storage", attach={"id": "data-desk", "point": "net"}, states=B,
             layer="over", gag="G5.6", part="data", band=360),
    ]
    for p in P:
        p.setdefault("band", 360)
        p["since"] = max(360, p.get("since", 360))
        p["view"] = S
    return P


PLACEMENTS = {80: _band80(), 150: _band150(), 220: _band220(),
              360: _ground360() + _band360() + _street360()}

# A later band's building replaces an earlier one's (HQ gains a storey): the earlier
# sprite is superseded rather than drawn twice.
SUPERSEDES = {"hq-4": "hq-3"}


def views(band: int) -> list:
    """The views that exist at `band`, in D-036 order."""
    return [v for v in VIEW_ORDER if room(v, band) is not None]


def scene(band: int, state: str) -> dict:
    """{view: placements} on screen at `band` in `state`, quieter rules applied, shell
    first. These lists are the scene (export_scene.py exports them)."""
    out = {v: structure(v, band, state) for v in views(band)}
    items = []
    for b, group in sorted(PLACEMENTS.items()):
        if b > band:
            continue
        for p in group:
            if state not in p.get("states", BOTH):
                continue
            # PH1-11: a band may re-compose a room (the ground floor from 360); what
            # the old room held stops at `until`, the new room starts at `since`
            if not (p.get("since", 0) <= band < p.get("until", 10 ** 6)):
                continue
            if p.get("band", b) < band:
                q = p.get("quiet", "keep")
                if q == "drop":
                    continue
                if isinstance(q, dict):
                    p = dict(p, **q)
            items.append(p)
    gone = {SUPERSEDES[p["sprite"]] for p in items if p.get("sprite") in SUPERSEDES}
    for p in items:
        if p.get("sprite") in gone:
            continue
        v = p.get("view", "ground")
        if v not in out:
            raise ValueError(f"placement {p.get('sprite')} is in view {v!r}, which does "
                             f"not exist at band {band}")
        out[v].append(p)
    return out
