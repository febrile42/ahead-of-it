"""Room compositions as data (PH1-07): every band x state scene is a list of placements
that `compose.py` renders from the manifest and the shipped PNGs. PH1-08 can dump
`scene(band, state)` to JSON as it stands.

**Cumulative (R-03a, D-026).** The building grows; nothing in it moves. Band 150's plate
is band 80's 9 x 7 extended to 12 columns, later bands' further; every band-80 placement
keeps its tile in every later band. `scene(B, state)` is every placement whose `band`
<= B and whose `states` include `state`.

**Quieter.** An earlier band's items stay on screen at their *minimum legible form*: a
placement's `quiet` says what happens to it when the band being shown is later than its
own — "drop" (secondary actors and crowd members beyond the few that tell the joke;
preview-only callouts) or a dict of overrides. The current band's items are full-size.
Concretely: the DEV queue shrinks from six to three (the laptop overhead stays); the
note-peeler, the cable-stepper, the VISITOR callout, the person at the support desk and
the walker on the cleared floor drop; band 150's doorstep handover is marked to drop
from band 220 (the van on the road and the worker checking a watch still tell G5.1).

Billboard labels (notes, cards) go in the "over" layer, after the network lines, so
text always reads (style.md "On the network").

Coordinates: `tile` = [col, row] (anchor on the tile's front vertex), `floor` =
[fc, fr] continuous floor (tile (i, j) spans i..i+1). See compose.py for the rest.
"""
from __future__ import annotations

BOTH = ("without", "built")
W = ("without",)
B = ("built",)

# -- rooms ------------------------------------------------------------------------------

ROOMS = {
    80: dict(cols=9, rows=7, size=(300, 214), origin=(134, 84),
             back_l={3: "wall-back-l-window", 5: "wall-back-l-door"}, back_r_windows=(3, 5, 7)),
    150: dict(cols=12, rows=7, size=(520, 340), origin=(260, 80),
              back_l={3: "wall-back-l-window", 5: "wall-back-l-door"},
              back_r_windows=(3, 5, 7, 10)),
}


def _t(sprite, col, row, **kw):
    return dict(sprite=sprite, tile=[col, row], **kw)


def _f(sprite, fc, fr, **kw):
    return dict(sprite=sprite, floor=[fc, fr], **kw)


def structure(band: int, state: str) -> list:
    """The shell: slab edges, floor, back walls (and the band-80 cable tray, built)."""
    r = ROOMS[band]
    cols, rows = r["cols"], r["rows"]
    out = []
    for col in range(cols):
        out.append(_t("slab-l", col, rows - 1, layer="base"))
    for row in range(rows):
        out.append(_t("slab-r", cols - 1, row, layer="base"))
    for row in range(rows):
        for col in range(cols):
            name = "floor-closet" if col <= 1 and row <= 1 else "floor-office"
            out.append(_t(name, col, row, layer="base"))
    out.append(_t("wall-corner", 0, 0, layer="base"))
    for row in range(rows):
        name = "wall-back-l-end" if row == rows - 1 else r["back_l"].get(row, "wall-back-l")
        out.append(_t(name, 0, row, layer="base"))
    for col in range(cols):
        name = "wall-back-r-window" if col in r["back_r_windows"] else "wall-back-r"
        if col == cols - 1:
            name = "wall-back-r-end"
        out.append(_t(name, col, 0, layer="base"))
    if state == "built":
        for col in range(cols):
            out.append(_t("cable-tray", col, 0, layer="base"))
    return out


# -- band 80 ----------------------------------------------------------------------------

B80_DESKS = [(4, 3), (6, 3), (4, 5), (6, 5)]


def _band80() -> list:
    P = []
    # G1.1 the closet (and its cutaway partitions, both states)
    P += [
        _t("closet-shelf", 0, 0, depth=0.6, states=W, id="router"),
        _t("mop-bucket", 0, 1, depth=1.5, states=W),
        _t("box-fan", 1, 1, dx=-10, dy=-3, depth=2.2, states=W),
        _t("cable-spill", 2, 0, depth=2.6, states=W),
        _t("rack", 0, 0, depth=0.8, states=B),
        _t("firewall", 0, 0, depth=0.81, states=B, id="firewall"),
        _t("partition-c", 0, 1, depth=2.05),
        _t("partition-c", 1, 1, depth=3.05),
        _t("partition-r-door-open", 1, 0, depth=2.5, states=W),
        _t("partition-r-door-closed", 1, 0, depth=2.5, states=B),
        _t("partition-r-end", 1, 1, depth=3.1),
    ]
    # G1.2 the sales pit: post-its / padlocks; the note-peeler at (6, 3)
    seated = {"without": {(4, 3): "a", (6, 5): "d"},
              "built": {(4, 3): "a", (6, 3): "c", (4, 5): "e", (6, 5): "d"}}
    for (col, row) in B80_DESKS:
        P.append(_t("desk-postit", col, row, states=W, id=f"desk80-{col}-{row}"))
        P.append(_t("desk-padlock", col, row, states=B))
        for st in BOTH:
            if (col, row) in seated[st]:
                P.append(_t("worker-seated", col, row, frame=seated[st][(col, row)],
                            depth=col + row + 1.01, states=(st,)))
        if (col, row) == (6, 3):
            P.append(_t("worker-peel", col, row, frame="e", depth=col + row + 1.01,
                        states=W, quiet="drop"))
    # G2.1 the developer's desk and the queue
    P += [
        _t("desk-dev", 3, 0, states=W, id="desk-dev"),
        _t("desk-dev-built", 3, 0, states=B),
        _t("worker-seated", 3, 0, frame="b", depth=4.01),
    ]
    queue = [("worker-c", "idle-left"), ("worker-queue", "a-left"), ("worker-e", "idle-left"),
             ("worker-d", "idle-left"), ("worker-b", "idle-left"), ("worker-c", "idle-left")]
    for i, (spr, fr) in enumerate(queue):
        P.append(_f(spr, 4.95 + i * 0.62, 1.65, frame=fr, states=W,
                    quiet="drop" if i >= 3 else "keep"))
    # G2.2 the taped floor cable and the sign; someone stepping over it
    P += [
        _t("cable-floor-r", 1, 2, depth=3.0, states=W),
        _t("cable-floor-r", 1, 3, depth=4.0, states=W),
        _t("cable-floor-turn", 1, 4, depth=5.0, states=W),
    ]
    P += [_t("cable-floor-c", col, 4, depth=col + 4.0, states=W) for col in range(2, 9)]
    P += [
        _t("sign-caution", 7, 4, dx=-10, dy=-2, depth=11.6, states=W),
        _f("worker-c", 8.05, 4.55, frame="step-right", states=W, quiet="drop"),
    ]
    # G2.1 built: the support desk, its board, someone being helped; the cleared floor
    P += [
        _t("desk", 1, 5, states=B),
        _t("worker-seated", 1, 5, frame="e", depth=7.01, states=B),
        _f("sla-board", 1.45, 4.4, depth=5.85, states=B),
        _f("worker", 2.35, 5.95, frame="idle-left", states=B, quiet="drop"),
        _f("worker-c", 8.05, 4.55, frame="right", states=B, quiet="drop"),
    ]
    # G2.3 the lobby and the visitor
    P += [
        _t("sofa", 0, 2, depth=3.5),
        _t("plant", 0, 6, depth=6.4),
        _f("visitor", 0.95, 3.05, depth=3.9, id="visitor"),
    ]
    # on the network: without, to the router and every desk; built, to the firewall only
    for tgt in ["router"] + [f"desk80-{c}-{r}" for (c, r) in B80_DESKS] + ["desk-dev"]:
        P.append(dict(line="dotted", layer="over", states=W,
                      **{"from": {"id": "visitor", "point": "net"},
                         "to": {"id": tgt, "point": "net"}}))
    P.append(dict(line="dotted", layer="over", states=B,
                  **{"from": {"id": "visitor", "point": "net"},
                     "to": {"id": "firewall", "point": "net"}}))
    P.append(dict(sprite="tag-visitor", attach={"id": "visitor", "offset": [-3, -25]},
                  layer="over", quiet="drop"))
    for p in P:
        p.setdefault("band", 80)
    return P


# -- band 150: the plate grows to 12 columns; the inset office down the road -----------

GROUND = 5          # px: the street is a slab's thickness below the floor
INSET = dict(c0=-2, c1=0, r0=9, r1=11)
FRONT_DOOR = 2      # HQ's front door: the front-left edge of tile (2, 6)


def _inset() -> list:
    i = INSET
    P = []
    for col in range(i["c0"], i["c1"] + 1):
        P.append(_t("slab-l", col, i["r1"], layer="base"))
    for row in range(i["r0"], i["r1"] + 1):
        P.append(_t("slab-r", i["c1"], row, layer="base"))
    for row in range(i["r0"], i["r1"] + 1):
        for col in range(i["c0"], i["c1"] + 1):
            P.append(_t("floor-office", col, row, layer="base"))
    P.append(_t("wall-corner", i["c0"], i["r0"], layer="base"))
    for row in range(i["r0"], i["r1"] + 1):
        name = "wall-back-l-end" if row == i["r1"] else (
            "wall-back-l-window" if row == i["r0"] + 1 else "wall-back-l")
        P.append(_t(name, i["c0"], row, layer="base"))
    for col in range(i["c0"], i["c1"] + 1):
        name = "wall-back-r-end" if col == i["c1"] else "wall-back-r-window"
        P.append(_t(name, col, i["r0"], layer="base"))
    for col in range(i["c0"], i["c1"] + 1):
        name = "partition-c-end" if col == i["c1"] else "partition-c"
        P.append(_t(name, col, i["r1"], depth=col + i["r1"] + 1.95))
    for row in range(i["r0"], i["r1"] + 1):
        name = "partition-r-end" if row == i["r1"] else (
            "partition-r-doorway" if row == 10 else "partition-r")
        P.append(_t(name, i["c1"], row, depth=i["c1"] + row + 1.95))
    P.append(_t("desk", -1, 9))
    P.append(_t("worker-seated", -1, 9, frame="b", depth=9.01, states=B))
    # without: on the step outside the door, at the kerb, checking the time
    P.append(_f("worker-watch", i["c1"] + 1.25, 10.3, frame="b", dy=GROUND, depth=11.2,
                states=W))
    return P


def _band150() -> list:
    P = []
    # G3.2: the trolley parked across the closet door / the shelf against the wall
    # beside the developer; the shop box on the CEO's desk (far corner)
    P += [
        _t("trolley", 2, 0, states=W, id="trolley", depth=3.5),
        dict(sprite="note-dave", attach={"id": "trolley", "point": "note"}, states=W,
             layer="over"),
        _t("laptop-shelf", 4, 0, states=B),
        _t("desk-retail-box", 11, 0, states=W),
        _t("desk", 11, 0, states=B),
    ]
    # G4.2: the finance desk
    P += [
        _t("desk", 9, 0, id="finance"),
        _t("fishing-line", 9, 0, depth=10.005, states=W),
        _t("worker-reach", 9, 0, frame="a", depth=10.01, states=W),
        _t("fishing-shield", 9, 0, depth=10.005, states=B),
        _t("worker-seated", 9, 0, frame="a", depth=10.01, states=B),
        dict(sprite="card-report", attach={"id": "finance", "point": "net"}, states=B,
             layer="over"),
    ]
    # G4.3: two desks back to back, screens +r and +c, someone where their backs meet
    P += [
        _t("desk-sheet", 11, 4, states=W, id="crm-a"),
        _t("desk", 11, 4, states=B),
        _t("worker-seated", 11, 4, frame="e", depth=16.01),
        _t("desk-turned-sheet", 10, 5, states=W, id="crm-b"),
        _t("desk-turned", 10, 5, states=B),
        _t("worker-seated-turned", 10, 5, frame="a", depth=16.01, states=W),
        _t("worker-seated-turned", 10, 5, frame="c", depth=16.01, states=B),
        dict(sprite="card-customers", attach={"id": "crm-a", "point": "card"},
             states=W, layer="over"),
        dict(sprite="card-customers", attach={"id": "crm-b", "point": "card"},
             states=W, layer="over"),
        _f("worker-printouts", 11.62, 5.62, frame="c", states=W),
        _f("sign-pipeline", 11.62, 5.62, states=B),
    ]
    # G5.1: the front door, the handover, the road, the van / the link
    d = FRONT_DOOR
    P += [
        _t("partition-c", d - 1, 6, depth=d - 1 + 6 + 1.95),
        _t("partition-c-door-open", d, 6, depth=d + 7.6),
        _t("partition-c-end", d + 1, 6, depth=d + 1 + 6 + 1.95),
        # HQ inside (depth under the door frame), the courier outside (over it)
        _f("worker-give", d + 0.95, 6.55, frame="e-left", depth=d + 7.5, states=W,
           quiet="drop"),
        _f("courier", d + 0.45, 7.3, frame="right", depth=d + 7.8, states=W, quiet="drop"),
    ]
    road = [(d, 7, "road-r"), (d, 8, "road-r"), (d, 9, "road-r"), (d, 10, "road-turn"),
            (d - 1, 10, "road-c")]
    link = {"road-r": "link-r", "road-turn": "link-turn", "road-c": "link-c"}
    P += [_t(n, c, r, dy=GROUND, layer="base") for (c, r, n) in road]
    P += [_t(link[n], c, r, dy=GROUND, layer="base", states=B) for (c, r, n) in road]
    P.append(_t("truck", d, 8, dy=4 + GROUND, depth=d + 9.5, states=W))
    P += _inset()
    for p in P:
        p.setdefault("band", 150)
    return P


PLACEMENTS = {80: _band80(), 150: _band150()}


def scene(band: int, state: str) -> list:
    """Every placement on screen at `band` in `state`, quieter rules applied, shell
    first. This list is the scene (PH1-08 exports it)."""
    out = structure(band, state)
    for b, items in sorted(PLACEMENTS.items()):
        if b > band:
            continue
        for p in items:
            if state not in p.get("states", BOTH):
                continue
            if b < band:
                q = p.get("quiet", "keep")
                if q == "drop":
                    continue
                if isinstance(q, dict):
                    p = dict(p, **q)
            out.append(p)
    return out
