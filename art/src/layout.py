"""Room compositions as data (PH1-07, re-cut into rooms by PH1-10): every band x state
scene is a set of **views** (D-036), each a whole room drawn on its own canvas, each a
list of placements that `compose.py` renders from the manifest and the shipped PNGs.

**Views are rooms, not crops (PH1-10, D-037 item 8).** `ground` is HQ's ground-floor
room, `floor-2` the room one storey up, `street` the exterior: HQ's front door, the road
and the inset office, on two plots with open ground between (DIA-5). Each has its own walls (or kerb), floor and
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
        # PH1-12: re-composed for eight primaries by 750 (see _floor2_610): a row
        # deeper; the org chart (G3.3) takes the back wall's first window
        (610, dict(kind="room", cols=12, rows=9,
                   back_l={2: "wall-back-l-window", 4: "wall-back-l-window"},
                   back_r_windows=(7,))),
    ],
    # PH1-12: the top floor appears with G7.2 (D-036: `top` only once it holds a primary)
    "top": [
        (750, dict(kind="room", cols=7, rows=5,
                   back_l={1: "wall-back-l-window", 3: "wall-back-l-window"},
                   back_r_windows=(1, 3))),
    ],
    # DIA-5: two plots, not one plate. HQ's block and the inset office's stood on one
    # pavement, so the inset read as HQ's annex, "part of the same room"; now each has
    # its own plot and slab with open ground between, and the road leaves one plot and
    # arrives at the other. HQ's plot also runs a column past the building on its shaded
    # (+c) side, so its cast shadow has pavement to fall on (item 2).
    "street": [
        (150, dict(kind="street", cols=11, rows=9,
                   plates=[dict(c0=3, c1=10, r0=0, r1=4),      # HQ
                           dict(c0=0, c1=5, r0=6, r1=8)])),    # the inset office
        # PH1-11: HQ moves to the back-right as a taller, narrower block; the inset
        # office on the left grows to 5 x 5 (G5.6 and, at 490, G6.4 live in it)
        (360, dict(kind="street", cols=12, rows=8,
                   plates=[dict(c0=7, c1=11, r0=0, r1=5),
                           dict(c0=0, c1=5, r0=3, r1=7)])),
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
    if r["kind"] == "street":
        for pl in r["plates"]:
            for col in range(pl["c0"], pl["c1"] + 1):
                out.append(_t("slab-l", col, pl["r1"], layer="base"))
            for row in range(pl["r0"], pl["r1"] + 1):
                out.append(_t("slab-r", pl["c1"], row, layer="base"))
            for row in range(pl["r0"], pl["r1"] + 1):
                for col in range(pl["c0"], pl["c1"] + 1):
                    out.append(_t("pavement", col, row, layer="base"))
        return out
    # DIA-5 item 3: an upper floor stands on the storey below, and shows it
    sl, sr = ("slab-l", "slab-r") if view == "ground" else ("slab-l-upper", "slab-r-upper")
    for col in range(cols):
        out.append(_t(sl, col, rows - 1, layer="base"))
    for row in range(rows):
        out.append(_t(sr, cols - 1, row, layer="base"))
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


def _wifi(**kw) -> dict:
    """DIA-5 item 1: the Wi-Fi fan over the visitor's laptop, both states, so the magenta
    dots read as *this laptop's Wi-Fi* before anyone asks where they go. Over the lines,
    like every label."""
    return dict(sprite="wifi-card", attach={"id": "visitor", "offset": [7, -12]}, layer="over",
                gag="G2.3", part="lobby", **kw)


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
    P.append(_wifi())
    for p in P:
        p.setdefault("band", 80)
        p.setdefault("view", "ground")
        p.setdefault("until", 360)       # PH1-11: the ground floor is re-composed at 360
    return P


# -- band 150: floor 2 (finance, the CRMs, the CEO's desk); the street ------------------

# The street (11 x 9, two plots): HQ stands along the back of its plot, c 3..9, r 0..2,
# its front door on the front-left face at c 5..6; the road runs out of the door toward
# the viewer and off the plot's front edge. Across a row of open ground it comes back
# onto the inset office's plot (office c 0..2, r 6..8), turns, and reaches its
# front-right doorway.
HQ = dict(c0=3, c1=10, r0=0, r1=3)
HQ_DOOR = 5          # the door is on the front-left face of tile (HQ_DOOR, r1 - 1)
INSET = dict(c0=0, c1=2, r0=6, r1=8)
GAP_150 = (5, 5)     # the open ground the road crosses between the plots


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
    road = [(d, dr, "road-r"), (d, dr + 1, "road-r"),                 # HQ's plot
            (d, dr + 3, "road-r"), (d, dr + 4, "road-turn"),            # the inset's
            (d - 1, dr + 4, "road-c"), (d - 2, dr + 4, "road-c")]
    link = {"road-r": "link-r", "road-turn": "link-turn", "road-c": "link-c"}
    P += [_t(n, c, r, layer="base", view=S) for (c, r, n) in road]
    P += [_t(link[n], c, r, layer="base", states=B, view=S) for (c, r, n) in road]
    # built: across the open ground the link goes on as a network line (the VPN);
    # without, nothing crosses it but the truck
    P.append(_t("link-hop-r", *GAP_150, layer="base", states=B, view=S))
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
        # the chair stays in both states. G2.4's diff is the screen and the pose — a
        # frozen call and someone standing at it, or a live one and the wave returned
        # from the chair — and the chair vanishing as well was read as the building
        # changing between states (DIA-9 drift 2). Standing next to your own empty
        # chair is what you do when the call has died, so nothing is lost.
        _t("chair", i["c0"] + 1, i["r0"] + 1, view=S, band=220,
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
        # depth 6.3, not 3.2: at 3.2 a closet upright sorted in front of the sign and
        # took a column out of the final F, the same way the fan's wind streaks were
        # eating MAIN SERVER's R. A sign taped to a cutaway wall should never be behind
        # anything in the room it labels.
        _f("sign-dnto", 0.12, 2.2, dy=-25, depth=6.3, states=W, gag="G5.3",
           part="server"),
        _t("server-tower", 0, 3, states=W, id="tower", gag="G5.3", part="server"),
        dict(sprite="label-main-server", attach={"id": "tower", "point": "label"},
             states=W, gag="G5.3", part="server"),
        # quiet after 360 (DIA-5, D-041): at 490 the fan on its crate beside the tower
        # merged tower, crate and the shelf behind into one pile; the face-on fan out
        # front carries "kept alive by fans" on its own (DIA-9)
        _t("box-fan-l", 1, 3, dx=-2, depth=5.0, states=W, quiet="drop", gag="G5.3",
           part="server"),
        # The second fan comes off its crate and out onto the open floor, face-on and
        # half again the size (DIA-9: "weak — something is wrong in that closet reads,
        # it is being kept alive by household fans does not"). Two 3/4-turned grey
        # squares inside an alcove of crates, shelves and a tower were simply more
        # boxes; a circle out in the open is the one silhouette nothing else in this
        # corner can be mistaken for, and being outside the closet it has pale floor
        # behind it instead of clutter.
        _t("box-fan-face", 2, 5, dx=-9, depth=8.0, states=W, gag="G5.3", part="server"),
        # ...and the beat that was written down but never drawn: the person who touched
        # it. Mid-step backing away, both hands up, facing the tower. ~12 px, and it is
        # the difference between "a corner with machines in it" and "nobody in this
        # building may touch that".
        # not `quiet="drop"`: the crowd extras around a gag can thin out at later bands,
        # but this figure *is* the gag's read, and at 490 the fan was left standing on
        # open floor with nobody recoiling from it
        _f("worker-flinch", 2, 5, dx=15, dy=15, frame="c-left", depth=8.1, states=W,
           gag="G5.3", part="server"),
        _t("rack", 0, 3, depth=3.8, states=B, id="rack2", gag="G5.3", part="server"),
        _f("card-virtualised", 0.12, 4.3, dy=-28, depth=3.2, states=B, gag="G5.3",
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
        # `c`, `d`, `b` — not `c`, `b`, `d`. The without row seats `c` and `d` at the
        # first two desks and sends the third person to the coin phone, so the built row
        # has to seat `c` and `d` at those same two desks or the toggle changes a
        # bystander's shirt at desk two for no reason the picture gives (DIA-21 §3).
        # With this order only `b` moves, which is the story: one person got up.
        P.append(_t("worker-seated-headset", col, 0, frame="cdb"[col - PHONES[0]],
                    depth=col + 1.01, states=B, gag="G5.4", part="phones"))
    P += [
        _t("phone-knot", CL["c1"] + 1, 1, depth=3.4, layer="main", states=W, gag="G5.4",
           part="phones"),
        _f("receipt-33", 4.55, 0.02, dy=-25, depth=0.5, states=B, gag="G5.4",
           part="phones"),
        # the same receipt, unspooled: the primary read for G5.4 (DIA-9). It hangs on
        # the clear stretch of back-right wall past the last phone desk — the phones
        # themselves stay, but they are no longer being asked to carry the gag — and
        # pools on the open floor in front of it, where nothing else is drawn.
        _f("receipt-runaway", 6.85, 1.05, depth=7.6, states=W, gag="G5.4",
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
    # One look per seat, and the same four people in both states. The previous pass held
    # two maps and they disagreed at G_PIT[2]: that chair was look "e" in built and look
    # "c" in without, so flipping the toggle changed a bystander's hair and shirt, and a
    # viewer who sees people swapped stops believing the two pictures are the same
    # building (DIA-9 drift 1). It also left one chair empty in without only — which at
    # band 80 is the colleague whose sticky note is being peeled, but the peeler goes
    # quiet at 360, so at this band the empty chair explained nothing. Here G1.2 is
    # carried entirely by the monitors: sticky notes, or padlocks. Nothing else moves.
    PIT_LOOK = dict(zip(G_PIT, "aced"))
    for (col, row) in G_PIT:
        P.append(_t("desk-notes", col, row, states=W, id=f"pit-{col}-{row}",
                    gag="G1.2", part="pit", band=80))
        P.append(_t("desk-padlock", col, row, states=B, gag="G1.2", part="pit", band=80))
        P.append(_t("worker-seated", col, row, frame=PIT_LOOK[(col, row)],
                    depth=col + row + 1.01, gag="G1.2", part="pit", band=80))
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
    P.append(_wifi(band=80))
    # G3.2, the trolley on open floor beside the closet / the shelf in its place
    P += [
        _t("trolley", 3, 4, states=W, id="trolley", gag="G3.2", part="trolley", band=150),
        dict(sprite="note-dave-r", attach={"id": "trolley", "point": "note-tip"},
             states=W, layer="over", gag="G3.2", part="trolley", band=150),
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
GAP_360 = (6, 4)                            # DIA-5: open ground between the two plots
BADGE_ROW, PROPPED_ROW = 5, 7               # G6.4's two doors, same +c side (490)
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
    # DIA-5: the road leaves HQ's plot at its back-left edge (c 7) and comes back onto
    # the inset office's plot at c 5; GAP_360 between is open ground
    road = [(d, dr + 1, "road-r"), (d, dr + 2, "road-turn")] + \
           [(cc, dr + 2, "road-c") for cc in range(d - 1, i["c1"], -1) if cc != GAP_360[0]]
    link = {"road-r": "link-r", "road-turn": "link-turn", "road-c": "link-c"}
    P += [_t(n, c, r, layer="base", band=150) for (c, r, n) in road]
    P += [_t(link[n], c, r, layer="base", states=B, band=150) for (c, r, n) in road]
    P.append(_t("link-hop-c", *GAP_360, layer="base", states=B, band=150))
    P.append(_t("truck-c", d - 1, dr + 2, dy=1, depth=d + dr + 2.5, states=W,
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
        # (from 490 G6.4's doors take these two segments)
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
        # both states — see the note on the same placement in the band-220 street
        _t("chair", i["c0"] + 1, i["r0"] + 1, band=220, gag="G2.4",
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


# -- band 490: the new hire (ground), the badge that doesn't (street) ---------------------

NEW_HIRE = (11, 6)          # the front row's end, clear of the pit and the queue


def _band490() -> list:
    c, r = NEW_HIRE
    P = [
        # G3.1 without: a bare desk, the coat still on, the calendar shedding pages, the
        # balloon going soft / a laptop, a badge, a coffee, one calendar page
        _t("desk-bare", c, r, states=W, id="hire-desk", gag="G3.1", part="desk"),
        dict(sprite="calendar-flip", frame="flip", attach={"id": "hire-desk", "point": "cal"},
             states=W, gag="G3.1", part="desk"),
        _t("worker-coat", c, r, depth=c + r + 1.01, states=W, gag="G3.1", part="desk"),
        # the balloon lies on the *floor*, in front of the desk beside the hire's bag —
        # not on the desktop. On the slab it landed inside the grey cubicle column's
        # silhouette at 1x and read as a red drawer belonging to the calendar unit, and
        # a desk with a red mass on it is not a bare desk (DIA-21). Down here it is a
        # thing on the floor that nobody picked up, the desktop is left genuinely empty
        # so the ghost rectangle is the only mark on it, and the two cues stop competing.
        _f("balloon-welcome", c - 0.45, r + 1.45, frame="deflate",
           depth=c + r + 2.4, states=W, gag="G3.1", part="desk"),
        _t("desk-laptop", c, r, states=B, id="hire-desk-b", gag="G3.1", part="desk"),
        dict(sprite="calendar-one", attach={"id": "hire-desk-b", "point": "cal"},
             states=B, gag="G3.1", part="desk"),
        _t("worker-seated", c, r, frame="e", depth=c + r + 1.01, states=B, gag="G3.1",
           part="desk"),
    ]
    for p in P:
        p.setdefault("band", 490)
        p["since"] = 490
        p["view"] = "ground"
    i = INSET2
    S = []
    # G6.4: the inset office's door, shut, the reader red, someone tapping a badge at it;
    # the next door propped open with an office chair / the reader green, the door
    # shut, the chair back at a desk. No camera dome: DIA-37 rated it "doesn't read"
    # twice over, and the green reader and the returned chair already carry "built".
    S += [
        _t("inset-door-badge", i["c1"], BADGE_ROW, frame="red", depth=i["c1"] + BADGE_ROW + 1.95,
           states=W, gag="G6.4", part="door"),
        _t("inset-door-badge", i["c1"], BADGE_ROW, frame="green",
           depth=i["c1"] + BADGE_ROW + 1.95, states=B, gag="G6.4", part="door"),
        _t("inset-door-propped", i["c1"], PROPPED_ROW, frame="propped",
           depth=i["c1"] + PROPPED_ROW + 1.95, states=W, gag="G6.4", part="door"),
        _t("inset-door-propped", i["c1"], PROPPED_ROW, frame="closed",
           depth=i["c1"] + PROPPED_ROW + 1.95, states=B, gag="G6.4", part="door"),
        _f("worker-badge", i["c1"] + 1.55, BADGE_ROW + 0.08, frame="c-left",
           depth=i["c1"] + BADGE_ROW + 3.0, gag="G6.4", part="door"),
        # the desk the chair came from (chairless: `desk-drives` is the plain desk
        # without its chair); built, the chair is back at it
        _t("desk-drives", 2, i["r1"] - 1, band=490),
        _t("chair-back", 2, i["r1"] - 1, states=B, gag="G6.4", part="chair", primary=False),
    ]
    for p in S:
        p.setdefault("band", 490)
        p["since"] = 490
        p["view"] = "street"
    return P + S


# -- band 610: the auditor at the door (ground) --------------------------------------------

# PH1-12. The front door stands in the ground floor's cut front-left edge, the one wall
# of the room the camera sees both sides of, clear of the pit and of the cable's run: the
# auditor waits outside it on a stoop, in full view, with the shut leaf between him and
# the room. The pit worker nearest the door carries G4.1's second part — the deal
# thinking about itself, and going grey.
G41_DOOR = (8, 8)
G41_PIT = G_PIT[3]                          # (8, 6): the pit's front-right desk


def _ground610() -> list:
    dc, dr = G41_DOOR
    P = [
        _t("stoop", dc, dr + 1, layer="base"),
        _t("front-door", dc, dr, frame="shut", depth=dc + dr + 1.95, states=W,
           gag="G4.1", part="door"),
        _t("front-door", dc, dr, frame="open", depth=dc + dr + 1.95, states=B,
           gag="G4.1", part="door"),
        _f("auditor", dc + 0.55, dr + 1.55, frame="wait", depth=dc + dr + 2.5, states=W,
           gag="G4.1", part="door"),
        _f("auditor", dc + 0.55, dr + 1.55, frame="shake", depth=dc + dr + 2.5, states=B,
           gag="G4.1", part="door"),
        _f("infosec", dc + 0.5, dr + 0.8, depth=dc + dr + 2.2, states=B, gag="G4.1",
           part="door"),
        # the thought floats up-left of the thinker's head into the pit's central aisle,
        # the one clear patch of floor among the four desks
        _t("bubble-deal", *G41_PIT, frame="fade", dx=-12, dy=-31, layer="over",
           states=W, gag="G4.1", part="deal"),
        _t("bubble-deal", *G41_PIT, frame="gold", dx=-12, dy=-31, layer="over",
           states=B, gag="G4.1", part="deal"),
    ]
    for p in P:
        p.setdefault("band", 610)
        p["since"] = 610
        p["view"] = "ground"
    return P


# -- band 610: floor 2, re-composed ------------------------------------------------------

# PH1-12. By 750 floor 2 holds eight primaries (D-036: G2.4 G3.3 G4.2 G4.3 G6.2 G7.3
# G7.3a G7.4). The 360 room has no wall left for the org chart that the hats do not walk
# in front of, and no floor for the renewal slope or the procedure chain, so from 610 it
# is a row deeper and a few things move. Everything is re-placed from the earlier bands'
# own placements, so each keeps its sprite, state, band and quiet rule; only its tile
# changes:
#   - the org chart (G3.3) on the back wall's first two tiles, where the CEO's desk was;
#   - the CEO's desk and its box (G3.2) a tile off the wall under it, in place of a
#     plain desk;
#   - the finance desk and its line (G4.2) one tile along, so the chart and the hook
#     are two objects, not one;
#   - the whiteboard and its two (G7.3a) forward and right, off the finance corner's
#     front, where the renewal slope lands at 750;
#   - the five hats (G7.3, built) back along the corridor, leaving its front end for the
#     procedure chain (G7.4) at 750.
F2_MOVES = {
    "G4.2": (1, 0),
    "G7.3a": (0.9, 0.6),
}
F2_BOX = (2, 3)                    # G3.2's desk, and the plain desk it replaces
F2_HATS_ROW0, F2_HATS_STEP = 1.4, 1.2


def _moved(p: dict, dc: float, dr: float) -> dict:
    q = dict(p)
    if "tile" in q:
        q["tile"] = [q["tile"][0] + dc, q["tile"][1] + dr]
    if "floor" in q:
        q["floor"] = [q["floor"][0] + dc, q["floor"][1] + dr]
    if "depth" in q:
        q["depth"] = q["depth"] + dc + dr
    return q


def _floor2_610(old: list) -> list:
    """Floor 2 from 610: the earlier floor-2 placements (`old`), moved per F2_MOVES and
    the notes above, plus G3.3's chart."""
    P = []
    for p in old:
        if p.get("view") != "floor-2":
            continue
        q = dict(p)
        q.pop("until", None)
        g, spr = q.get("gag"), q.get("sprite")
        if g in F2_MOVES:
            q = _moved(q, *F2_MOVES[g])
        elif g == "G3.2":
            q = _moved(q, F2_BOX[0] - q["tile"][0], F2_BOX[1] - q["tile"][1])
        elif g == "G7.3" and spr == "worker-onehat":
            k = round((q["floor"][1] - 2.0) / 1.45)
            q["floor"] = [q["floor"][0], F2_HATS_ROW0 + F2_HATS_STEP * k]
        elif g is None and q.get("tile") == list(F2_BOX):
            continue                    # the plain desk (and its sitter) the CEO's replaces
        P.append(q)
    F2 = "floor-2"
    P += [
        # G3.3: the org chart, pinned to the back wall above the CEO's desk
        _f("poster-org", 2.35, 0.02, dy=1, frame="one-box", depth=0.4, states=W,
           view=F2, band=610, gag="G3.3", part="chart"),
        _f("poster-org", 2.35, 0.02, dy=1, frame="tree", depth=0.4, states=B,
           view=F2, band=610, gag="G3.3", part="chart"),
    ]
    for q in P:
        q["since"] = 610
    return P


# -- band 610: the street, re-composed ------------------------------------------------------

# PH1-12. G5.2 happens in the inset office's "far wing", and there is no wing: from 610 the
# inset office runs two tiles further back (r 1..7), and its back-left corner is the wing:
# a filing cabinet in the corner, three desks, a window over them. The call screen
# (G2.4's inset part) moves back and two tiles right with the back wall, so the raised
# arms never cross it and the call reads exactly as before. G6.3's new building stands
# on the open pavement at the front right, drawn the way the inset office is (walls cut to
# stubs, so its empty inside shows), the moving truck beside it and the map of offices on
# a post between the inset office and HQ.
INSET3 = dict(c0=0, c1=4, r0=1, r1=7)
TV3 = (2, 1)                                     # the call screen's tile (was (0, 3))
WING_WINDOW = 1                                  # back wall column with the window
WING_CAB = (0, 1)
WING_DESKS = {"b": (1, 1), "a": (0, 2), "c": (1, 3)}
G63_SHELL = (7, 5)                               # its back tile; it covers c 7..9, r 5..7
G63_TRUCK = (10, 6)
G63_MAP = (6.2, 2.2)                             # within one 120 px close-up of the shell
INSET_SHELL = {"floor-office", "wall-corner", "wall-back-l", "wall-back-l-window",
               "wall-back-l-end", "wall-back-r", "wall-back-r-window", "wall-back-r-end"}


def _street610(old: list) -> list:
    i = INSET3
    P = []
    for p in old:
        if p.get("view") != "street":
            continue
        q = dict(p)
        q.pop("until", None)
        if q.get("sprite") in INSET_SHELL:
            continue                        # the inset's floor and walls: re-drawn below
        if q.get("tile") == [3, 3] and q.get("sprite") in ("desk", "worker-seated"):
            continue                        # the old window desk: the wing has the window now
        if q.get("gag") == "G2.4":
            q = _moved(q, TV3[0] - INSET2["c0"], TV3[1] - INSET2["r0"])
        P.append(q)
    # the inset office's floor and back walls, two rows deeper
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
            "wall-back-r-window" if col == WING_WINDOW else "wall-back-r")
        P.append(_t(name, col, i["r0"], layer="base", band=150))
    for row in range(i["r0"], INSET2["r0"]):
        P.append(_t("partition-r", i["c1"], row, depth=i["c1"] + row + 1.95, band=150))
    # G5.2, the far wing. Without: the one whose desk is under the window up on their
    # chair with a phone at full stretch, the other two holding theirs up beside them, and
    # a consumer router on the filing cabinet in the corner, blinking. Built: all three
    # at their desks, an access point on each wall, the cabinet just a cabinet.
    W52 = dict(band=610, gag="G5.2", part="wing")
    for who, (dc, dr) in WING_DESKS.items():
        P.append(_t("desk-drives" if who == "b" else "desk", dc, dr, **W52))
        P.append(_t("worker-seated", dc, dr, frame=who, depth=dc + dr + 1.01, states=B,
                    **W52))
    bc, br = WING_DESKS["b"]
    ac, ar = WING_DESKS["a"]
    cc, cr = WING_DESKS["c"]
    P += [
        _t("chair-back", bc, br, states=B, **W52),
        _t("cabinet-router", *WING_CAB, frame="router", states=W, **W52),
        _t("cabinet-router", *WING_CAB, frame="bare", states=B, **W52),
        # c's chair, dragged out, and c up on it: c is the frontmost of the three, so
        # nothing stands in front of the chair (DIA-3 review: on b, at the back, a and c
        # hid the chair and b hid the router)
        _f("worker-phone-up", bc + 0.85, br + 1.1, frame="b", depth=bc + br + 2.0,
           states=W, **W52),
        _f("worker-phone-up", ac + 0.7, ar + 1.1, frame="a", depth=ac + ar + 2.0,
           states=W, **W52),
        _f("chair-stand", cc + 1.0, cr + 0.3, depth=cc + cr + 1.45, states=W, **W52),
        _f("worker-phone-up", cc + 1.0, cr + 0.3, dy=-13, frame="c", depth=cc + cr + 1.5,
           states=W, **W52),
        _f("ap-disc", WING_WINDOW + 0.5, i["r0"] + 0.02, dy=-34, depth=0.3, states=B,
           **W52),
        _f("ap-disc", i["c0"] + 0.02, 5.5, dy=-34, depth=0.3, states=B, band=610),
    ]
    # G6.3: the shell (empty / fitted), its banner, the one in the doorway with a single
    # cable / a ticked clipboard; the moving truck; the map with its six pins
    sc, sr = G63_SHELL
    P += [
        _t("shell", sc, sr, frame="empty", depth=sc + sr + 0.5, states=W, band=610,
           gag="G6.3", part="shell"),
        _t("shell", sc, sr, frame="fitted", depth=sc + sr + 0.5, states=B, band=610,
           gag="G6.3", part="shell"),
        _f("worker-cable", sc + 0.9, sr + 2.9, frame="d-cable", depth=sc + sr + 6.0,
           states=W, band=610, gag="G6.3", part="shell"),
        _f("worker-cable", sc + 0.9, sr + 2.9, frame="d-ticks", depth=sc + sr + 6.0,
           states=B, band=610, gag="G6.3", part="shell"),
        _f("banner-sqft", sc + 2.2, sr + 3.02, dy=-1, depth=sc + sr + 6.1, band=610,
           gag="G6.3", part="shell"),
        _t("moving-truck", *G63_TRUCK, depth=G63_TRUCK[0] + G63_TRUCK[1] + 1.5, band=610,
           gag="G6.3", part="shell"),
        _f("map-pins", *G63_MAP, frame="pins", depth=G63_MAP[0] + G63_MAP[1], band=610,
           gag="G6.3", part="map", primary=False),
    ]
    for q in P:
        q["since"] = 610
        q["view"] = "street"
        q.setdefault("band", 610)
    return P


# -- band 750: SaaS balloons and the robot (ground) ----------------------------------------

# PH1-12. By 750 the ground floor holds twelve primaries. The two new ones go where the
# 44 px rule leaves room and where their gag lives: the robot on the open floor at the
# pit's front corner (G7.1), and — without — the balloons that got away bunched against
# the ceiling at the far end of the back wall, with one more over every working head in
# the room (G6.1: "everywhere"; only the ceiling bunch is tappable, the rest are the
# room). Built, the handful of shared balloons is tethered to a PORTFOLIO board on the
# back wall.
# DIA-74: the near-twins ride over the two front pit desks, (6, 4) and (8, 4), side by
# side in the foreground of the Back desks close-up (one sprite, G6_TWINS); every other
# head gets its own colour.
G6_TWINS = (6, 4)
HEAD_BALLOONS = [                      # (tile or floor point, dx, dy, brand)
    (("t", 6, 6), -7, -30, "yellow-ring"), (("t", 8, 6), -3, -30, "orange-bar"),
    (("t", 3, 0), -7, -30, "blue-plus"), (("t", 4, 0), -7, -30, "green-tri"),
    (("t", 8, 0), -7, -30, "cyan-sq"), (("t", 11, 6), -7, -30, "grey-check"),
    (("f", 8.95, 1.65), 0, -23, "pink-dot"),
]
G71 = (11.6, 3.8)                      # the robot's feet


def _ground750() -> list:
    P = []
    for (kind, a, b), dx, dy, brand in HEAD_BALLOONS:
        mk = _t if kind == "t" else _f
        P.append(mk("balloon-head", a, b, frame=brand, dx=dx, dy=dy, layer="over",
                    states=W))
    P.append(_t("balloon-twins", *G6_TWINS, dx=-7, dy=-30, layer="over", states=W))
    P += [
        _f("balloons-ceiling", 11.05, 0.05, dy=-10, frame="drift", depth=0.5, states=W,
           gag="G6.1", part="balloons"),
        _f("portfolio-board", 7.15, 0.02, dy=-10, depth=0.5, states=B, gag="G6.1",
           part="balloons"),
    ]
    rc, rr = G71
    P += [
        _f("robot", rc, rr, frame="eat", states=W, gag="G7.1", part="robot"),
        _f("robot", rc, rr, frame="approved", states=B, gag="G7.1", part="robot"),
        _f("doc-gate", rc - 1.4, rr + 0.3, states=B, gag="G7.1", part="robot"),
        # the one handing it things: the card (without, up into the robot's open hand) /
        # a sheet into the gate (built). Out to the robot's left, a step back, so the
        # robot's broad chest never hides them (DIA-3 review). Not tagged: the robot is
        # the gag, and one hotspot over both would be mostly empty floor.
        _f("worker-card", rc - 2.25, rr + 0.375, frame="a-card", states=W),
        _f("worker-card", rc - 2.25, rr + 0.375, frame="a-doc", states=B),
    ]
    for p in P:
        p.setdefault("band", 750)
        p["since"] = 750
        p["view"] = "ground"
    return P


# -- band 750: the renewal avalanche and the procedure (floor 2) ---------------------------

# PH1-12. G6.2 buries the desk in front of the finance corner (the plain desk at (7, 4)
# that has stood there since 220, in the gap the 610 re-composition left between the
# finance desk, the CRM desks and the whiteboard). G7.4 runs along the front of the
# corridor: the one with the page asks the next, who points at a third, who points at the
# locked cabinet at the corridor's end, under the wiki's sign.
G62_DESK = (7, 4)
G74 = dict(cab=(0, 8), c=(1.5, 8.45), b=(3.0, 8.5), a=(4.5, 8.45), lib=(1, 7))


def _floor2_750() -> list:
    F2 = "floor-2"
    dc, dr = G62_DESK
    P = [
        _t("finance-panel", dc, dr, depth=dc + dr + 0.9, id="fin-panel", gag="G6.2",
           part="slope"),
        _t("paper-slope", dc, dr, depth=dc + dr + 1.5, states=W, id="slope", gag="G6.2",
           part="slope"),
        dict(sprite="card-autorenewed", attach={"id": "slope", "point": "top"},
             offset=None, states=W, layer="over", gag="G6.2", part="slope"),
        dict(sprite="calendar-renewals", attach={"id": "fin-panel", "point": "cal",
             "offset": None}, states=B, gag="G6.2", part="slope"),
    ]
    # attach by point, then nudge: the calendar left of centre, the receipt right
    P[-1]["attach"] = {"id": "fin-panel", "point": "cal"}
    P[2]["attach"] = {"id": "slope", "point": "top"}
    for q in P:
        q.pop("offset", None)
    P += [dict(sprite="frame-receipt", attach={"id": "fin-panel", "point": "cal"},
               states=B, gag="G6.2", part="slope", nudge=[14, -2])]
    P[3]["nudge"] = [-10, 0]
    g = G74
    P += [
        _t("cabinet-locked", *g["cab"], frame="locked", states=W, gag="G7.4", part="chain"),
        _t("cabinet-locked", *g["cab"], frame="open", states=B, gag="G7.4", part="chain"),
        _f("wiki-sign", 0.03, 7.35, dy=-29, frame="cobwebs", depth=0.3, states=W,
           gag="G7.4", part="chain"),
        _f("wiki-sign", 0.03, 7.35, dy=-29, frame="clean", depth=0.3, states=B,
           gag="G7.4", part="chain"),
        _f("worker-point", *g["c"], frame="e-point", states=W, gag="G7.4", part="chain"),
        _f("worker-point", *g["b"], frame="c-point", states=W, gag="G7.4", part="chain"),
        _f("worker-point", *g["b"], frame="c-idle", states=B, gag="G7.4", part="chain"),
        _f("worker-card", *g["a"], frame="d-doc-left", id="asker", gag="G7.4",
           part="chain"),
        dict(sprite="card-howto", frame="confused", attach={"id": "asker",
             "offset": [1, -24]}, states=W, layer="over", gag="G7.4", part="chain"),
        dict(sprite="card-howto", frame="current", attach={"id": "asker",
             "offset": [1, -24]}, states=B, layer="over", gag="G7.4", part="chain"),
        # built: the librarian, at a desk with a sign on it
        _t("desk", *g["lib"], states=B, id="lib-desk", gag="G7.4", part="chain"),
        _t("worker-seated", *g["lib"], frame="e", depth=sum(g["lib"]) + 1.01, states=B,
           gag="G7.4", part="chain"),
        dict(sprite="sign-library", attach={"id": "lib-desk", "point": "card"}, states=B,
             layer="over", gag="G7.4", part="chain"),
    ]
    for q in P:
        q.setdefault("band", 750)
        q["since"] = 750
        q["view"] = F2
    return P


# -- band 750: the top floor (G7.2) --------------------------------------------------------

# PH1-12. The top floor, all glass at the front, one boardroom table: two chairs on the
# far side under the windows, three on the near side with their backs to us, and one at
# the head. Five people. DIA-3 picture review: the empty chair is the head chair at the
# whiteboard end — the seat facing NEXT 3 YEARS — pulled well out and turned to face us,
# in a pool of light, and its TECHNOLOGY card stands on that chair's back (re-review: on
# the table it read as the near row's name tag). Built, Josh is in that same chair under
# the same card (D-007: the only place he appears).
BOARD = (2, 2)                     # the table's tile: it runs c 2..5, near seats on row 2
NEAR = ("c", "d", "a")             # near seats, backs to us
FAR = {0: "b", 1: "e"}             # far seats facing us


def _top750() -> list:
    from .sprites.band750 import HEAD
    T = "top"
    rm = ROOMS["top"][0][1]
    cols, rows = rm["cols"], rm["rows"]
    tc, tr = BOARD
    M = dict(gag="G7.2", part="meeting")
    P = []
    # the glass front: the room's two cut front edges are glass, not open
    for col in range(cols):
        name = {0: "glass-c-corner", cols - 1: "glass-c-end"}.get(col, "glass-c")
        P.append(_t(name, col, rows - 1, depth=col + rows + 0.95))
    for row in range(rows - 1):
        P.append(_t("glass-r", cols - 1, row, depth=cols + row + 0.95))
    P += [
        _f("whiteboard-next", 5.6, 0.02, dy=-17, depth=0.4, **M),
        _t("boardroom-far", tc, tr, depth=tc + tr - 0.5, **M),
    ]
    far_r = tr - 9.6 / 8
    for k, look in FAR.items():
        P.append(_f("worker-seated-front", tc + (2.5 + 8 * k) / 8, far_r, frame=look,
                    depth=tc + tr - 0.2, **M))
    P.append(_t("boardroom-table", tc, tr, depth=tc + tr + 0.9, **M))
    # the head chair, clear of the table's end, and Josh on it (built)
    P += [
        _t("boardroom-chair-head", tc, tr, frame="empty", depth=tc + tr + 0.92, states=W,
           **M),
        _t("boardroom-chair-head", tc, tr, frame="taken", depth=tc + tr + 0.92, states=B,
           **M),
        _f("worker-seated-josh", tc + HEAD["c"] / 8, tr + (HEAD["r"] + 2.6) / 8,
           depth=tc + tr + 0.94, states=B, **M),
    ]
    # the nameplate, a reserved card standing on the head chair's back, centred over it
    # and well clear of the near row's last head (built: it stands over Josh)
    P.append(_f("nameplate-tech", tc + 25.0 / 8, tr - 4.0 / 8, dx=14, dy=-11,
                depth=tc + tr + 0.96, **M))
    for k, look in enumerate(NEAR):
        # a half tile along: the near seats sit between the far ones
        P.append(_t("worker-seated", tc + k, tr, frame=look, dx=8, dy=4,
                    depth=tc + k + tr + 1.5, **M))
    for q in P:
        q.setdefault("band", 750)
        q["since"] = 750
        q["view"] = T
    return P


def _until(group: list, view: str, band: int) -> list:
    """Stop an earlier band's placements in `view` at `band` (the view is re-composed
    there and re-places them)."""
    for p in group:
        if p.get("view", "ground") == view:
            p.setdefault("until", band)
    return group


PLACEMENTS = {80: _band80(), 150: _band150(), 220: _band220(),
              360: _ground360() + _band360() + _street360(), 490: _band490()}
_F2_OLD = [dict(p) for b in (150, 220, 360) for p in PLACEMENTS[b]
           if p.get("view") == "floor-2"]
for _b in (150, 220, 360):
    _until(PLACEMENTS[_b], "floor-2", 610)
_ST_OLD = [dict(p) for b in (360, 490) for p in PLACEMENTS[b]
           if p.get("view") == "street" and p.get("until", 10 ** 6) > 610]
for _b in (360, 490):
    _until(PLACEMENTS[_b], "street", 610)
PLACEMENTS[610] = _ground610() + _floor2_610(_F2_OLD) + _street610(_ST_OLD)
PLACEMENTS[750] = _ground750() + _floor2_750() + _top750()

# PH2-01 Part A2 (DIA-94, approved on DIA-94/DIA-95): the only people with no gag, so
# the only people who walk (motion.WALKS). Same look and path in both states; each
# stands at rest at the end the picture review asked for. Floor points are exact
# 1/16 px multiples so the anchor lands on a whole pixel.
#   W1, ground 80..220: by the plant, facing the room; paces toward the pit and stops
#       >= 12 px short of G2.2's cable (DIA-95).
#   W2, street 150..750: on the shaded pavement past HQ's right face, at its back end,
#       away from G5.1's door (DIA-95). The 150/220 plot ends a column earlier.
W1 = _f("worker-d", 1.34375, 6.65625, frame="idle-down", band=80, until=360)
W2 = [_f("worker-b", 10.09375, 0.40625, frame="idle-down", view="street", band=150,
         until=360),
      _f("worker-b", 11.09375, 0.40625, frame="idle-down", view="street", band=360,
         since=360)]
PLACEMENTS[80].append(W1)
PLACEMENTS[150].append(W2[0])
PLACEMENTS[360].append(W2[1])

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
