"""Band 490 props (PH1-11), both states. `docs/content/BANDS-AND-GAGS.md` §490.

Without
  G3.1  desk-bare           the new hire's desk: no monitor, nothing on it, a cubicle
                            panel behind it with a calendar point
        calendar-flip       a wall calendar on that panel, pages tearing off and flying
                            (`flip`, 3 frames)
        worker-coat         seated from behind with the coat still on, collar up
        balloon-welcome     a red balloon tied to the desk, a `WELCOME!` tag on its
                            string, sagging (`deflate`, 2 frames: sagging, sunk)
  G6.4  inset-door-badge    the inset office's door, shut, the reader red (`red`) /
                            green (`green`)
        inset-door-propped  the next door, propped open with an office chair
                            (`propped`) / shut, like a door (`closed`)
        worker-badge        profile, badge held out to the reader (2-frame tap)

Built
  G3.1  desk-laptop         laptop open, a badge on a lanyard, a coffee; calendar-one
  G6.4  camera-dome         a small dome over the door; chair-back (a chair at a desk)
"""
from __future__ import annotations

from ..dsl import Canvas
from ..vox import Iso, Sprite, dotted, make, make_anim
from .. import glyphs
from . import desk as desk_mod
from .band80 import _rows
from .band150 import _card
from .band220 import _chair_at
from .worker import Fig, LOOKS, R, seated_frame
from .poses import _standing_right
from .room import PART_H, PART_T

# -- G3.1: the empty desk ------------------------------------------------------------------

PANEL = dict(c0=0.3, c1=7.7, r0=0.0, r1=0.6, top=30.0)


def _panel(iso: Iso):
    """A fabric cubicle panel along the back of the desk's tile, taller than a seated
    head, for the calendar."""
    p = PANEL
    f = iso.box(p["c0"], p["r0"], 0, p["c1"], p["r1"], p["top"], top="wall-trim",
                left="badge-body", right="chair-mid")
    iso.paint(f, "L", p["r1"], lambda c, z: "chair-mid" if z >= p["top"] - 1.2 else None)
    return iso.left_px(p["r1"], (p["c0"] + p["c1"]) / 2 - 0.8, 17.0)


# The laptop's footprint on the desk top, in world units. The built state fills it;
# the without state draws its outline and nothing else.
LAPTOP = dict(c0=3.4, c1=6.8, r0=1.6, r1=3.6)


def _absent_laptop(iso: Iso, c: Canvas, z: float):
    """A ghost rectangle on the desktop with exactly the built laptop's footprint.

    A bare brown desk reads as "a desk" — it has no way of telling you that something
    is missing, because nothing missing has a silhouette. An outline does: it is the one
    mark that says *the thing that should be here isn't*, and it turns the empty desktop
    from scenery into the subject. Drawn in `paper` with an `outline` halo under it, not
    in `net` magenta, which this pipeline reserves for network lines: `paper` is the
    brightest mark on the desk and the halo keeps it from dissolving where it crosses
    the desk's own edge.

    **Continuous, not dashed** (DIA-21). The previous pass dashed it two on, two off, on
    the theory that a solid rectangle would read as a mat. At 1x the drawn rectangle is
    only about 10 x 6 px, so dashing broke it into 2 px runs and it arrived as four or
    five stray pale pixels on brown — noise, not a shape. A 1 px continuous outline at
    the same footprint is still far too thin to read as a sheet of paper, and it is the
    only treatment at this size that resolves into a rectangle at all."""
    lp = LAPTOP
    corners = [iso.pt(lp["c0"], lp["r0"], z), iso.pt(lp["c1"], lp["r0"], z),
               iso.pt(lp["c1"], lp["r1"], z), iso.pt(lp["c0"], lp["r1"], z)]
    for p0, p1 in zip(corners, corners[1:] + corners[:1]):
        dotted(c, p0, p1, colour="paper", on=1, period=1, halo="outline")


def _desk_bare(iso: Iso, c: Canvas, laptop=False):
    d = desk_mod.DESK
    cal = _panel(iso)
    iso.floor_shadow(d["c0"], d["r0"] + 0.6, d["c1"], d["r1"], grow=1.0, grow_r=0.5)
    ch, b = desk_mod.CHAIR, desk_mod.BACKREST
    iso.floor_shadow(ch["c0"] + 0.5, ch["r0"] + 0.5, ch["c1"] - 0.5, b["r1"] - 0.4,
                     grow=1.0, grow_r=0.3)
    desk_mod._desk(iso)
    top = d["top"] + d["slab"]
    if not laptop:
        _absent_laptop(iso, c, top)
    if laptop:
        # the laptop, open, screen toward the chair; a badge on its lanyard; a coffee.
        # Its base is LAPTOP exactly — the same rectangle the without state dashes.
        lp = LAPTOP
        iso.box(lp["c0"], lp["r0"], top, lp["c1"], lp["r1"], top + 0.6, top="chair-mid",
                left="badge-body", right="chair-dark")
        lid = iso.box(3.4, 1.2, top, 6.8, 1.7, top + 4.6, top="chair-dark",
                      left="monitor-frame", right="outline")
        iso.paint(lid, "L", 1.7, lambda cc, z: "monitor-screen"
                  if 3.8 <= cc < 6.4 and top + 0.8 <= z < top + 4.0 else None)
        iso.box(1.0, 2.6, top, 2.8, 3.6, top + 0.3, top="paper", left="paper",
                right="wall-shadow", outline="outline")          # the badge
        x0, y0 = iso.pt(1.0, 2.6, top + 0.3)
        for k in range(5):
            c.point(x0 - 1 - k // 2, y0 - 1 + k, "shirt-1")      # its lanyard
        iso.box(0.9, 1.0, top, 2.1, 2.2, top + 2.4, top="hair-1", left="paper",
                right="wall-shadow")                              # the coffee
    desk_mod._chair(iso)
    desk_mod.backrest(iso)
    return {"cal": cal}


def calendar_frames() -> list[Canvas]:
    """A wall calendar: red header with two binding rings, a grid of days on white.
    Pages tear off the top and fly up and away; three frames of the flight. Anchor:
    the calendar's bottom centre (its pages fly above and to the right of it)."""
    W, H = 30, 30
    cw, chh = 15, 16
    x0, y0 = 2, H - chh

    def base(c: Canvas, flipping: bool):
        c.rect(x0, y0, x0 + cw - 1, y0 + chh - 1, "outline")
        c.rect(x0 + 1, y0 + 1, x0 + cw - 2, y0 + chh - 2, "paper")
        c.rect(x0 + 1, y0 + 1, x0 + cw - 2, y0 + 4, "badge-red")
        for bx in (x0 + 4, x0 + cw - 5):
            c.point(bx, y0, "badge-body")
            c.point(bx, y0 - 1, "outline")
        if not flipping:
            return
        for gy in range(y0 + 6, y0 + chh - 2, 2):
            for gx in range(x0 + 2, x0 + cw - 2, 2):
                c.point(gx, gy, "wall-shadow")

    def page(c: Canvas, px, py, tilt):
        """A torn-off page in flight, 7 x 6, with its red strip, tipped by `tilt`."""
        for dx in range(7):
            yy = py + (dx * tilt) // 6
            c.point(px + dx, yy - 1, "outline")
            c.point(px + dx, yy, "badge-red")
            for dy in range(1, 5):
                c.point(px + dx, yy + dy, "paper" if (dx + dy) % 3 else "wall-shadow")
            c.point(px + dx, yy + 5, "outline")
        for dy in range(-1, 6):
            c.point(px - 1, py + dy, "outline")
            c.point(px + 7, py + dy + tilt, "outline")

    out = []
    for i in range(3):
        c = Canvas(W, H)
        base(c, True)
        # a page mid-tear, curling off the top, then two already in the air
        flights = [(x0 + 4 + 2 * i, y0 - 6 - 2 * i, 2), (x0 + 12 + 2 * i, y0 - 12 - 2 * i, -2),
                   (x0 + 19 + i, y0 - 2 - i, 1)]
        for k, (px, py, t) in enumerate(flights):
            if i == 2 and k == 2:
                continue
            if 0 <= px and px + 8 < W and 1 <= py:
                page(c, px, py, t)
        out.append(c)
    return out


def calendar_one() -> Canvas:
    """Built: the same calendar, one page, today ringed in green."""
    W, H = 30, 30
    c = Canvas(W, H)
    cw, chh = 15, 16
    x0, y0 = 2, H - chh
    c.rect(x0, y0, x0 + cw - 1, y0 + chh - 1, "outline")
    c.rect(x0 + 1, y0 + 1, x0 + cw - 2, y0 + chh - 2, "paper")
    c.rect(x0 + 1, y0 + 1, x0 + cw - 2, y0 + 4, "badge-red")
    for bx in (x0 + 4, x0 + cw - 5):
        c.point(bx, y0, "badge-body")
        c.point(bx, y0 - 1, "outline")
    for gy in range(y0 + 6, y0 + chh - 2, 2):
        for gx in range(x0 + 2, x0 + cw - 2, 2):
            c.point(gx, gy, "wall-shadow")
    for (dx, dy) in ((5, 7), (6, 7), (7, 7), (4, 8), (8, 8), (5, 9), (6, 9), (7, 9)):
        c.point(x0 + dx, y0 + dy, "shirt-2-dark")
    return c


# The new hire is `LOOKS["e"]` in **both** states. The previous pass gave the without
# state its own look — different shirt, different hair, a yellow bobble hat — so
# flipping the toggle swapped one person for another and the A/B comparison stopped
# being about onboarding at all. One person, one seat; only the desk changes.
HIRE_LOOK = "e"


# -- the coat, and why it is no longer in the picture -------------------------------------
#
# `BANDS-AND-GAGS.md` §490 G3.1 says "a new hire sitting at a bare desk **with their coat
# on**", and the previous pass drew exactly that: a maroon torso under a yellow knitted
# hat. The picture review (DIA-9) rated the whole gag *doesn't read — reads inverted* and
# asked for the coat to come off the person, because at 1x the hat read as a crown and the
# joke landed on the hire instead of on the desk (`TONE.md`: systemic, never personal).
#
# A worn coat also cannot survive the review's drift finding. The hire has to be the *same
# person* in both states, and a coat that is on in one state and off in the other changes
# their torso colour — which is precisely the swap the A/B comparison cannot take.
#
# Off the person, there is nowhere in this 40 px corner for it to read: the chair back sits
# between the camera and the hire, so a coat on it lands on their shoulders and reads as
# clothing again; the cubicle panel is 15 px wide and the calendar is 15 px wide; and a
# fourth maroon mass on the desk top fights the dashed rectangle, which is the cue that
# actually carries the gag. So the coat is out, the bag at their feet stays, and the corner
# says it with three objects instead of four. This contradicts a locked content line and is
# flagged on DIA-2 for the Product & Content Lead and CEO rather than changed quietly.


def coat_frame() -> Canvas:
    """The hire in their own seat, with their bag still packed at their feet.

    The figure is `seated_frame(HIRE_LOOK)` — pixel-for-pixel the sprite the built
    state paints at this desk — so flipping the toggle cannot swap the person. Only the
    bag is added, and the desk beneath them changes; that is the whole diff, which is
    the only way the A/B comparison means anything."""
    c = seated_frame(HIRE_LOOK)
    iso = Iso(c)
    iso.box(4.6, 6.2, 0, 6.6, 7.6, 3.0, top="hair-1", left="desk-wood-dark",
            right="hair-1")
    return c


BALLOON_W, BALLOON_H = 21, 13
BALLOON_ANCHOR = (1, 12)           # the desk corner the string is tied to, on its left


def balloon_frames() -> list[Canvas]:
    """The balloon, down. Two frames of a slow settle (`deflate`); anchor: the desk
    corner its string is tied to.

    The previous pass drew a taut round balloon floating above a red `WELCOME!` plate,
    and that is a party — the picture argued the opposite of the gag, which is that
    nobody arranged anything. The plate is gone, and with it the only piece of copy in
    this corner: the picture has to carry it alone, and a legible sign that says the
    wrong thing beats no sign only in the sense that it is worse.

    Deflated reads at 1x by **shape**, not by shade: taut is *taller than it is wide*
    with a hard highlight, slack is *wider than it is tall* with a dented crown, three
    dark crease lines and no highlight at all. It lies on the desk rather than floating,
    so there is nothing above the desk line, and its string is a limp S that has already
    given up instead of a taut diagonal."""
    out = []
    for i in range(2):
        c = Canvas(BALLOON_W, BALLOON_H)
        bx = 13
        rw, rh = 6, 3 - i                         # wider than tall: the slack read
        by = 10 - rh                              # it lies *on* the desk, not above it
        pts = set()
        for y in range(by - rh, by + rh + 1):
            for x in range(bx - rw, bx + rw + 1):
                if ((x - bx) / (rw + 0.3)) ** 2 + ((y - by) / (rh + 0.4)) ** 2 <= 1.0:
                    pts.add((x, y))
        # the slump: one shallow dent, off-centre. A symmetrical dip in the middle
        # reads as a heart, which is the one shape this corner must not produce.
        pts -= {(bx + dx, by - rh) for dx in (1, 2, 3)}
        pts -= {(bx + 2, by - rh + 1)}
        for (x, y) in pts:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if (x + dx, y + dy) not in pts:
                    c.point(x + dx, y + dy, "outline")
        for (x, y) in pts:
            c.point(x, y, "badge-red")
        for k, cx in enumerate((bx - 3, bx + 1, bx + 4)):          # the creases
            for y in range(by - rh + 1 + (k == 1), by + rh):
                if (cx, y) in pts:
                    c.point(cx, y, "shirt-3-dark")
        # the puckered neck and knot, at the balloon's lower left
        c.point(bx - rw - 1, by + rh, "shirt-3-dark")
        c.point(bx - rw - 2, by + rh, "outline")
        # the string: a limp S down to the desk corner the balloon is still tied to
        sx, sy = bx - rw - 2, by + rh
        ax, ay = BALLOON_ANCHOR
        n = max(1, sx - ax)
        for k in range(n + 1):
            t = k / n
            y = round(sy + (ay - sy) * t + (1.5 if t < 0.45 else -1.2 if t > 0.75 else 0))
            c.point(sx - k, max(0, min(BALLOON_H - 1, y)), "outline")
        out.append(c)
    return out


# -- G6.4: the badge that doesn't ------------------------------------------------------------

DOOR_H = 26.0


def _jambs_and_frame(iso: Iso):
    """The cut partition either side of a doorway on the tile's front-right edge
    (c = 8, r 1.5 .. 6.5), and a full-height frame so the opening reads as a door."""
    for r0, r1 in ((0, 1.5), (6.5, 8)):
        f = iso.box(8, r0, 0, 8 + PART_T, r1, PART_H, top="chair-dark", left="wall",
                    right="wall-shadow", outline=None)
        iso.outline(set(f), "outline")
    for r0 in (1.1, 6.5):
        iso.box(8, r0, 0, 8 + PART_T, r0 + 0.5, DOOR_H + 1, top="wall-trim",
                left="badge-body", right="wall-trim")
    iso.box(8, 1.1, DOOR_H + 1, 8 + PART_T, 6.9, DOOR_H + 3, top="wall-trim",
            left="badge-body", right="wall-trim")


def _door_leaf_closed(iso: Iso):
    f = iso.box(8.1, 1.6, 0, 8.7, 6.5, DOOR_H + 0.8, top="desk-wood", left="desk-wood",
                right="desk-wood-dark")
    iso.paint(f, "R", 8.7, lambda r, z: "sticky" if 2.2 <= r < 2.9 and 12 <= z < 13.2 else None)


# The reader's verdict, 7 x 7, as a shape rather than a hue. DIA-21 measured the old
# reader at 3 px and ruled that "built→without changes three pixels from green to red"
# is not a signal at 1x, calibrating against `DAVE?` — which reads — as roughly an order
# of magnitude more area. A colour swap also says nothing to a red-green colour-blind
# visitor, and the one thing this picture cannot afford is a diff they cannot see.
READER_CROSS = ("XX...XX", "XXX.XXX", ".XXXXX.", "..XXX..",
                ".XXXXX.", "XXX.XXX", "XX...XX")
READER_TICK = ("......X", ".....XX", "X...XX.", "XX.XX..",
               "XXXXX..", ".XXX...", "..X....")


def _door_badge(iso: Iso, c: Canvas, green: bool):
    _jambs_and_frame(iso)
    _door_leaf_closed(iso)
    # the reader on the outside of the frame's back post: a dark chassis, a lit panel
    # carrying a cross or a tick, and a keypad bar under it. The tapper stands beside
    # it, not in front of the door, so the shut door stays in view.
    x, y = iso.right_px(8 + PART_T, 1.2, 15.0)
    c.rect(x - 2, y - 8, x + 6, y + 5, "outline")
    c.rect(x - 1, y - 7, x + 5, y + 4, "chair-dark")
    col = "badge-green" if green else "badge-red"
    c.rect(x - 1, y - 7, x + 5, y - 1, "outline")           # the panel's bezel
    for dy, row in enumerate(READER_TICK if green else READER_CROSS):
        for dx, ch in enumerate(row):
            if ch == "X":
                c.point(x - 1 + dx, y - 7 + dy, col)
    for ky in (y + 1, y + 3):                               # the keypad below it
        for kx in (x, x + 2, x + 4):
            c.point(kx, ky, "badge-body")
    return {"reader": (x + 2, y - 4)}


# The office chair, drawn so it reads as an *office* chair and not a dark lump: a
# five-spoke star base with a castor on each tip (the jagged floor-level cross is the
# cue that survives at 1x — a solid plinth reads as a box), a thin gas column with a
# gap of pavement showing either side of it, then the seat pan and the backrest. The
# same drawing serves both states of G6.4 — at the desk when the function is there, in
# the doorway when it isn't — so the visitor diffs one chair that moved, not two props.
CHAIR_CX, CHAIR_CR = 2.5, 6.0          # the column's axis, in desk.CHAIR's frame
# Four spokes rather than five: at this size the two rear spokes of a real star base
# fall behind the seat and cost silhouette without adding read. +c and -c project to
# down-right / up-left, +r and -r to down-left / up-right, so these four give the
# four-armed floor cross that says "castors".
STAR = ((2.4, 0.0), (-2.4, 0.0), (0.0, 2.1), (0.0, -2.1))
# Taller and narrower than desk.BACKREST, which is 5 units of back over 3.4 of width
# and reads as a wing rather than a chair. Rising clear of the seat is what makes the
# silhouette say "chair"; its top face stays dark so the lit seat pan below it is the
# only bright horizontal in the prop.
CHAIR_SEAT_Z = 5.0
BACK_Z = (6.4, 14.0)


def _office_chair(iso: Iso, dc: float, dr: float = 0.0, back=True, facing="away"):
    """desk.CHAIR's footprint and seat height, shifted by dc/dr world units.

    `facing="away"` is the chair pushed in at a desk: the back is the near edge, the
    way you see a chair you are standing behind. `facing="near"` turns it a half-turn
    so the back is the far edge and the seat pan is in front of it — the only
    orientation in which a chair standing on its own, with nothing beside it to say
    what it is, reads as a chair at 1x."""
    ch = desk_mod.CHAIR
    cx, cr = CHAIR_CX + dc, CHAIR_CR + dr
    iso.floor_shadow(cx - 1.8, cr - 1.4, cx + 1.8, cr + 1.4, grow=0.8, grow_r=0.3)
    base = {}
    for sc, sr in STAR:                        # spokes, then a castor on each tip
        base.update(iso.box(min(cx, cx + sc) - 0.25, min(cr, cr + sr) - 0.25, 1.1,
                            max(cx, cx + sc) + 0.25, max(cr, cr + sr) + 0.25, 1.9,
                            top="chair-mid", left="chair-dark", right="chair-dark",
                            outline=None))
        base.update(iso.box(cx + sc - 0.4, cr + sr - 0.4, 0, cx + sc + 0.4,
                            cr + sr + 0.4, 1.4, top="chair-dark", left="chair-dark",
                            right="chair-dark", outline=None))
    iso.outline(set(base), "outline")          # one silhouette for the whole base
    iso.box(cx - 0.5, cr - 0.5, 1.9, cx + 0.5, cr + 0.5, CHAIR_SEAT_Z,  # the gas column
            top="chair-mid", left="chair-dark", right="chair-dark")
    iso.box(ch["c0"] + dc, ch["r0"] + dr, CHAIR_SEAT_Z, ch["c1"] + dc, ch["r1"] + dr,
            CHAIR_SEAT_Z + 1.4, top="chair-mid", left="chair-dark", right="chair-dark",
            edge="outline")
    if back:
        br = (ch["r1"] + dr) if facing == "away" else (ch["r0"] - 0.6 + dr)
        iso.box(ch["c0"] + dc, br, CHAIR_SEAT_Z + 1.4, ch["c1"] + dc, br + 0.8,
                BACK_Z[1], top="chair-dark", left="chair-mid", right="chair-dark")


# The leaf is hinged on the **near** post and swings out into +c, away from the camera
# along -r. That is the opposite hand to the badge door, and it is chosen for the
# projection, not for the architecture: see `_door_propped`.
HINGE = (8.4, 6.4)
LEAF_LEN, LEAF_T = 4.9, 0.6
AJAR_DEG = 28.0


def _ajar_leaf(iso: Iso, deg: float, steps: int = 6):
    """The door leaf part-open, and the world position of its free edge.

    There is no rotation in this projection, so the swung leaf is stepped: `steps`
    axis-aligned boxes walking out in +c as they run along -r from the hinge, each one
    overlapping the next so their union is a solid slanted plane. They are outlined once
    as a single silhouette — outline each box and the leaf reads as a stack of slats.

    One number governs how open the door is, and it is tightly constrained. +c projects
    down-right and -r projects up-right by the same amount, so a leaf at 45 degrees
    projects to a *vertical line* — edge-on, no plane at all. Legibility therefore falls
    off either side of 45 and is best near 0 (shut) and 90 (flat open). 28 is as far
    open as this leaf can go while still reading as a door rather than a plank.
    """
    import math
    th = math.radians(deg)
    pts = [(HINGE[0] + LEAF_LEN * t / steps * math.sin(th),
            HINGE[1] - LEAF_LEN * t / steps * math.cos(th)) for t in range(steps + 1)]
    leaf: dict = {}
    for (c0, r0), (c1, r1) in zip(pts, pts[1:]):
        leaf.update(iso.box(c0, r0, 0, c1 + LEAF_T, r1, DOOR_H + 0.8, top="desk-wood",
                            left="desk-wood", right="desk-wood-dark", outline=None))
    iso.outline(set(leaf), "outline")
    return pts[-1]


def _door_propped(iso: Iso, c: Canvas, propped: bool):
    _jambs_and_frame(iso)
    if not propped:
        _door_leaf_closed(iso)
        return
    # The leaf barely ajar, and the chair jammed against its free edge.
    #
    # The previous pass swung the leaf a full quarter-turn, flat out into the street,
    # with the chair standing on the pavement beside the opening. DIA-21 held the gag at
    # *weak* for exactly that and was right: the causal read — this chair is what is
    # holding this door open — needs the two objects touching. A door already wide open
    # does not need holding, and a chair parked next to it is not a gag.
    #
    # Getting both at once is a projection problem, and the hand of the hinge is what
    # solves it. Hinged on the *far* post, a barely-open leaf puts its free edge at high
    # r — which projects down-left, straight into the near jamb post. The chair then
    # lands in the one part of this prop that is already dark and already occluded, and
    # `chair-mid` on the post's `badge-body` face is a one-value step: the chair stops
    # being a chair, which is the note DIA-21 had just passed. Hinged on the **near**
    # post the leaf swings the other way, its free edge sits at low r and high c, and
    # that projects down-*right* onto open pale pavement. Same door, same angle, and the
    # chair's star base gets the light ground it needs to silhouette against.
    #
    # So: the leaf covers most of the doorway, the office floor shows through the wedge
    # left at the far post, and the chair stands at the leaf's free edge with its back
    # against it, out on the pavement where all of it reads.
    free = _ajar_leaf(iso, AJAR_DEG)
    _office_chair(iso, free[0] + 1.25 - CHAIR_CX, free[1] - 0.15 - CHAIR_CR,
                  back=True, facing="near")


def camera_dome() -> Canvas:
    """DIA-5 (D-041): the dome on a bracket off the door frame's right-hand post, a pale
    housing over a dark lens. Flat on the lintel it sat against the dark door leaf and
    read as a smudge, and anywhere above the lintel it lands on the person working
    behind the door; out here it has the pale room behind it and its own outline.
    Anchor: the bracket's tip, where it meets the post."""
    rows = [
        "..ooooooo.",
        ".oPPPPPPPo",
        "ooWWWWWWWo",
        "..oKKKKKo.",
        "...oKGKo..",
        "....ooo...",
    ]
    c = Canvas(10, 6)
    _rows(c, rows, 0, 0, {"o": "outline", "P": "paper", "W": "wall-shadow",
                          "K": "chair-dark", "G": "glass-highlight"})
    return c


BADGE_W, BADGE_H = 24, 24
BADGE_ANCHOR = (12, 24)


def badge_frames(look_name: str) -> dict:
    """Profile, the near arm straight out, a white badge with a blue stripe held up to
    the reader; frame 1 taps it again (arm a pixel further, badge a pixel higher).
    `<look>-left` / `-right`."""
    look = LOOKS[look_name]
    right = []
    for i in range(2):
        f = Fig(BADGE_W, BADGE_H)
        body = _standing_right(look)
        for (x, y), r in body.px.items():
            f.put(x + 4, y, r)
        n = 6 + i
        arm = {(x, y) for x in range(13, 13 + n) for y in (10, 11)}
        f.blob(arm, lambda p: "s" if p[0] >= 13 + n - 2 else "t", ring="outer")
        bx, by = 13 + n, 6 - i
        f.blob(R(bx, by, bx + 3, by + 5), lambda p: "l" if p[1] == by + 1 else "V",
               ring=True)
        right.append(f.to_canvas(dict(look, l="shirt-1")))
    return {f"{look_name}-right": right, f"{look_name}-left": [c.mirror_h() for c in right]}


# -- registry --------------------------------------------------------------------------------

def build_all() -> dict:
    bare = make(lambda iso, c: _desk_bare(iso, c), size=96)
    lap = make(lambda iso, c: _desk_bare(iso, c, laptop=True), size=96)
    cal = calendar_frames()
    one = calendar_one()
    red = make(lambda iso, c: _door_badge(iso, c, False))
    green = make(lambda iso, c: _door_badge(iso, c, True))
    assert (red.w, red.h, red.anchor) == (green.w, green.h, green.anchor)
    red.anims = {"red": ([red.canvas], 0), "green": ([green.canvas], 0)}
    prop = make(lambda iso, c: _door_propped(iso, c, True))
    shut = make(lambda iso, c: _door_propped(iso, c, False))
    # one canvas for both frames: paste the smaller onto the larger's canvas
    if (shut.w, shut.h) != (prop.w, prop.h):
        cv = Canvas(prop.w, prop.h)
        cv.img.alpha_composite(shut.canvas.img, (prop.anchor[0] - shut.anchor[0],
                                                 prop.anchor[1] - shut.anchor[1]))
        shut_cv = cv
    else:
        shut_cv = shut.canvas
    prop.anims = {"propped": ([prop.canvas], 0), "closed": ([shut_cv], 0)}
    dome = camera_dome()
    return {
        "desk-bare": bare,
        "desk-laptop": lap,
        "calendar-flip": Sprite(cal[0], (9, 30), anims={"flip": (cal, 260)}),
        "calendar-one": Sprite(one, (9, 30)),
        "inset-door-badge": red,
        "inset-door-propped": prop,
        "camera-dome": Sprite(dome, (0, 2)),
        "chair-back": make(lambda iso, c: _office_chair(iso, 0.0, back=True)),
    }
