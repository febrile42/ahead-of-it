"""Close-ups as data (D-042, DIA-36): which gags each room's close-ups hold, and what
the visitor reads on each one's tab.

A room is the establishing shot; the close-ups are where gags are tapped. Each is a crop
of its parent room, CLOSEUP_W x CLOSEUP_H native px, which paints at >= 1.9 css px per
art px on a 360-430 px phone. This module says only *which* gags share a crop and what
the crop is called; `export_scene` derives the rect from the drawn hotspots (so the crop
can never miss its gag) and fails if a cluster doesn't fit.

Per room, the close-up list as it stands from a band on: [(from_band, [spec, ...])]. A
spec is `(label, gags)`:
- `label` names a place, never a person or employer (served copy, <= 24 chars; the
  Product & Content Lead reviews the table once, DIA-42).
- `gags` lists every gag whose hotspots this close-up carries in this room: each one's
  primary if its home view is this room (1-3 per close-up), and any secondary part drawn
  in this room (G3.2's box on floor 2, G2.4's inset conference room on the street).

Rect rule: the crop is centred on the union, across both states, of the listed gags'
hotspots in this room, then clamped inside the room. One rect for both states, so the
toggle diffs the same pixels (the building doesn't move; only the function does).

Order is navigation order. Places recur band to band under the same label, so a visitor
who moves the slider finds the closet where the closet was.
"""
from __future__ import annotations

CLOSEUP_W, CLOSEUP_H = 180, 120   # D-042 as ruled on DIA-38

CLOSEUPS = {
    "ground": [
        (80, [
            ("Closet", ["G1.1"]),
            ("Lobby", ["G2.3"]),
            ("Sales pit", ["G1.2", "G2.2"]),
            ("Helpdesk", ["G2.1"]),
        ]),
        (150, [
            ("Closet", ["G1.1", "G3.2"]),
            ("Lobby", ["G2.3"]),
            ("Sales pit", ["G1.2", "G2.2"]),
            ("Helpdesk", ["G2.1"]),
        ]),
        # PH1-11 re-composed the ground floor: the second fan joins the closet, the
        # phones get the call-centre row
        (360, [
            ("Closet", ["G5.3", "G1.1", "G3.2"]),
            ("Lobby", ["G2.3"]),
            ("Sales pit", ["G1.2", "G2.2"]),
            ("Call-centre row", ["G5.4"]),
            ("Helpdesk", ["G2.1"]),
        ]),
        (490, [
            ("Closet", ["G5.3", "G1.1", "G3.2"]),
            ("Lobby", ["G2.3"]),
            ("Sales pit", ["G1.2", "G2.2"]),
            ("Call-centre row", ["G5.4"]),
            ("Helpdesk", ["G2.1", "G3.1"]),
        ]),
        # PH1-12: the auditor's front door opens off the pit (the deal is the pit's)
        (610, [
            ("Closet", ["G5.3", "G1.1", "G3.2"]),
            ("Lobby", ["G2.3"]),
            ("Sales pit", ["G1.2", "G2.2", "G4.1"]),
            ("Call-centre row", ["G5.4"]),
            ("Helpdesk", ["G2.1", "G3.1"]),
        ]),
        # PH1-12: the robot works the open floor by the pit; the lobby takes the cable
        # (it runs from the lobby) to make room; the balloons get the back desks
        (750, [
            ("Closet", ["G5.3", "G1.1", "G3.2"]),
            ("Lobby", ["G2.3", "G2.2"]),
            ("Sales pit", ["G1.2", "G4.1", "G7.1"]),
            ("Call-centre row", ["G5.4"]),
            ("Back desks", ["G6.1"]),
            ("Helpdesk", ["G2.1", "G3.1"]),
        ]),
    ],
    "floor-2": [
        (150, [
            ("Finance corner", ["G4.2", "G4.3", "G3.2"]),
        ]),
        (220, [
            ("Finance corner", ["G4.2", "G4.3", "G3.2"]),
            ("Conference room", ["G2.4", "G7.3a"]),
        ]),
        (360, [
            ("Back aisle", ["G7.3"]),
            ("Finance corner", ["G4.2", "G4.3", "G3.2"]),
            ("Conference room", ["G2.4", "G7.3a"]),
        ]),
        # PH1-12: floor 2 re-composed at 12x9; the org chart hangs over the back aisle
        (610, [
            ("Back aisle", ["G7.3", "G3.3"]),
            ("Finance corner", ["G4.2", "G4.3", "G3.2"]),
            ("Conference room", ["G2.4", "G7.3a"]),
        ]),
        # PH1-12: the procedure hunt joins the back aisle; the org chart goes with the
        # finance desk under it, and the avalanche buries the finance corner's desks
        (750, [
            ("Back aisle", ["G7.3", "G7.4"]),
            ("Back wall", ["G3.3", "G4.2"]),
            ("Finance corner", ["G4.3", "G6.2", "G3.2"]),
            ("Conference room", ["G2.4", "G7.3a"]),
        ]),
    ],
    "top": [
        (750, [
            ("Boardroom", ["G7.2"]),
        ]),
    ],
    "street": [
        (150, [
            ("Pavement", ["G5.1"]),
        ]),
        (220, [
            ("Pavement", ["G5.1", "G2.4"]),
        ]),
        # PH1-11: HQ moves back-right, the other office grows on the left
        (360, [
            ("Other office", ["G5.6", "G2.4"]),
            ("Pavement", ["G5.1"]),
        ]),
        (490, [
            ("Other office", ["G5.6", "G6.4", "G2.4"]),
            ("Pavement", ["G5.1"]),
        ]),
        # PH1-12: the other office's far wing (G5.2, and the call screen moved into it);
        # the new empty shell (G6.3) stands on the pavement, beside the handover
        (610, [
            ("Other office", ["G5.6", "G6.4"]),
            ("Far wing", ["G5.2", "G2.4"]),
            ("Pavement", ["G6.3", "G5.1"]),
        ]),
    ],
}


def closeups(view: str, band: int) -> list:
    """[(label, gags)] for `view` at `band`, in navigation order ([] if none yet)."""
    best: list = []
    for b, specs in CLOSEUPS.get(view, []):
        if b <= band:
            best = specs
    return best
