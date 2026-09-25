"""Band 360 props (PH1-11), both states. `docs/content/BANDS-AND-GAGS.md` §360.

Same conventions as band80.py: every prop is a `vox.Sprite` anchored on the front vertex
of the tile it is placed on; billboards anchor where they touch what they belong to.

Without
  G5.3  server-tower        a beige tower PC on the closet floor, `MAIN / SERVER` on a
                            paper label taped to its top edge
        box-fan-l           `box-fan` turned a quarter (aims -c, up-left on screen)
        sign-dnto           `DO NOT / TURN OFF`, a paper sign taped to the closet wall
  G5.4  desk-phone          a desk with a corded desk phone on it
        desk-coinphone      a desk with a coin box on it (the phone takes coins), a
                            stack of coins beside it, no chair (someone is standing)
        worker-coin         from behind, arm up, a gold coin at the slot
        phone-knot          every phone cord on the floor, into one knot, into the
                            closet door
  G5.6  (street; see band360 street props below)
  G7.3  worker-hats         the manager walking carefully under five stacked hats,
                            `INFRA` `SEC` `SUPPORT` `DEV` `PRODUCT`, arms out (2-frame
                            wobble)

Built
  G5.3  rack (band80) + card-virtualised + icon-dr (a second little rack under a roof,
        offsite)
  G5.4  worker-seated-headset, receipt-33 (`-33%` on a till receipt, taped to the wall)
  G7.3  worker-onehat       one hat each, `<look>-<LABEL>`
"""
from __future__ import annotations

import math

from ..dsl import Canvas
from ..vox import Iso, SwapIso, Sprite, make, make_anim
from .. import glyphs
from . import desk as desk_mod
from .band80 import _thick, _rows
from .band150 import _card
from .worker import (Fig, LOOKS, R, _shadow, _leg_front, _torso_front, _head_front,
                     _arm_front, seated_frame)


# -- G5.3 without: the main server ------------------------------------------------------

TOWER = dict(c0=1.5, c1=6.5, r0=0.8, r1=7.4, top=20.0)


def _server_tower(iso: Iso, c: Canvas):
    """A beige desktop tower standing on the closet floor: the company's MAIN SERVER.
    The front (+r face, lit) has two drive bays and a green power light."""
    t = TOWER
    iso.floor_shadow(t["c0"], t["r0"], t["c1"], t["r1"], grow=1.0)
    f = iso.box(t["c0"], t["r0"], 0, t["c1"], t["r1"], t["top"], top="wall",
                left="wall-shadow", right="wall-trim")

    def front(cc, z):
        if 13.0 <= z < 15.0 and t["c0"] + 0.6 <= cc < t["c1"] - 0.6:
            return "chair-mid"                              # the 5.25" bay
        if 10.5 <= z < 11.5 and t["c0"] + 0.6 <= cc < t["c1"] - 1.8:
            return "chair-mid"                              # the floppy slot
        if 3.0 <= z < 4.0 and t["c1"] - 1.4 <= cc < t["c1"] - 0.6:
            return "badge-green"                            # power light
        if 1.0 <= z < 8.0 and (z - 1.0) % 2.0 < 0.6 and t["c0"] + 0.6 <= cc < t["c1"] - 2.0:
            return "badge-body"                             # vent slots
        return None
    iso.paint(f, "L", t["r1"], front)
    # the label is taped over the front, its bottom edge a little above the floor
    return {"label": iso.pt((t["c0"] + t["c1"]) / 2, t["r1"] - 1.0, t["top"] - 1.0)}


def main_server_label() -> Canvas:
    """Hand-lettered, two lines, taped to the tower's top edge like the DEV card.

    The plate is sized off the *longer* line plus a two-pixel margin on each side of
    the paper, not one: at `+ 4` the final R of SERVER landed on the border column and
    the letter lost its leg, so the sign read `SERVEI` at 1x. Both lines are centred,
    so neither can drift into the frame again if the wording ever changes."""
    l1, l2 = "MAIN", "SERVER"
    w = max(glyphs.text_width(l1), glyphs.text_width(l2)) + 6
    h = 15
    c = Canvas(w, h + 1)
    c.rect(0, 0, w - 1, h - 1, "outline")
    c.rect(1, 1, w - 2, h - 2, "paper")
    for line, y in ((l1, 2), (l2, 8)):
        glyphs.draw(c, line, (w - glyphs.text_width(line)) // 2, y, "outline")
    c.point(2, h, "wall-shadow")
    c.point(w - 3, h, "wall-shadow")
    return c


def sign_dnto() -> Canvas:
    """DO NOT / TURN OFF: a sign in red capitals, taped up by its corners.

    On **yellow** paper, not white. This sign and `label-main-server` hang about 9 px
    apart on the same pale wall, and two white plates with black borders at that spacing
    fuse into one bright smear at 1x (DIA-9). Nothing else in this alcove can be moved
    far enough to open the gap, so the two plates are separated by field colour instead:
    a red-on-yellow warning next to a black-on-white label reads as two signs at a
    glance, and red on yellow is what a hand-made warning is actually written on."""
    l1, l2 = "DO NOT", "TURN OFF"
    w = glyphs.text_width(l2) + 4
    h = 15
    c = Canvas(w, h)
    c.rect(0, 0, w - 1, h - 1, "outline")
    c.rect(1, 1, w - 2, h - 2, "sticky")
    glyphs.draw(c, l1, (w - glyphs.text_width(l1)) // 2, 2, "badge-red")
    glyphs.draw(c, l2, 2, 8, "badge-red")
    for x, y in ((1, 1), (w - 2, 1)):
        c.point(x, y, "wall-shadow")                        # tape
    return c


def _box_fan_l(iso: Iso, c: Canvas):
    """`box-fan` turned a quarter: the grille faces -c (up-left on screen), the wind
    streaks head that way. Drawn in swapped axes so the light stays top-left."""
    s = SwapIso(c, (iso.ox, iso.oy))
    s.floor_shadow(0.5, 2.0, 6.0, 5.5, grow=1.0)
    s.box(0.5, 2.0, 0, 6.0, 5.5, 4, top="desk-wood", left="desk-wood",
          right="desk-wood-dark", edge="desk-wood-dark")
    f = s.box(0.5, 3.2, 4, 6.0, 4.4, 12.0, top="chair-mid", left="chair-mid",
              right="chair-dark")

    def grille(cc, z):
        dc, dz = (cc - 3.25) * 1.1, (z - 8.0) * 0.8
        d = (dc * dc + dz * dz) ** 0.5
        if d < 0.8:
            return "badge-body"
        if d < 2.6:
            return "wall-shadow" if int(d * 1.6) % 2 else "chair-dark"
        return None
    s.paint(f, "L", 4.4, grille)
    for i, (cc, z) in enumerate(((1.6, 13.0), (3.4, 14.5), (5.2, 12.5))):
        x, y = s.pt(cc, 3.0, z)
        for k in range(4 + (i == 1)):
            c.point(x - k * 2, y - 2 * k, "glass-highlight")
            c.point(x - k * 2 - 1, y - 2 * k - 1, "glass-highlight")


FAN_R = 8.0              # the guard: a 16px disc at 1x


def _box_fan_face(iso: Iso, c: Canvas):
    """The same household fan, turned face-on to camera and drawn half again the size
    of `box-fan-l`, standing on open floor clear of the tower.

    Everything else in that alcove — the tower, the crates, the cable shelf, the rack —
    is a rectangle, so a **circle** is the one silhouette that cannot be read as another
    box. Two 3/4-turned grey squares 13px wide is what the alcove had, and at 1x they
    were more boxes.

    Screen-space circle on an isometric stand: the guard genuinely faces the camera, so
    it is not projected. The foot and column matter — a disc lying loose on a floor is a
    ball, and that is exactly what the first attempt drew.

    Two things about the guard were got wrong before they were got right, and both are
    worth keeping written down. It has to be **pale** (`paper`), because a dark disc at
    16 px is a football whatever is drawn on it. And the blades have to be filled
    **wedges**, not radial lines: four black lines from the centre of a white circle cut
    it into four white panels with black seams, which is a football again. A blade has
    area. Four wedges of 38 degrees, all swept the same way, read as one thing caught
    mid-rotation, and nothing else in the room is round."""
    iso.floor_shadow(2.2, 2.4, 5.8, 4.6, grow=1.0)
    iso.box(2.6, 2.6, 0, 5.4, 4.4, 1.6, top="chair-mid", left="chair-dark",
            right="chair-dark", edge="chair-dark")                    # the foot
    iso.box(3.6, 3.2, 1.6, 4.4, 3.8, 9.0, top="chair-mid", left="chair-mid",
            right="chair-dark")                                       # the column
    cx, cy = iso.pt(4.0, 3.5, 9.0)
    cy -= int(FAN_R) - 1                     # the guard sits on top, the column showing
    n = int(FAN_R) + 2
    for y in range(-n, n + 1):
        for x in range(-n, n + 1):
            d = (x * x + y * y) ** 0.5
            if d > FAN_R + 0.9:
                continue
            if d > FAN_R - 0.6:
                col = "outline"                            # the rim, and its silhouette
            elif x + y > FAN_R * 0.9:
                col = "wall-shadow"                        # light from the top left
            else:
                col = "paper"
            c.point(cx + x, cy + y, col)
    # Four blades, as filled wedges rather than lines. Lines were the first attempt and
    # they were wrong twice over: four black diagonals from the centre of a white disc
    # cut it into four white panels with black seams, which at 1x is a football, and a
    # blade has area — the thing that says "fan" is a dark shape sweeping round a hub,
    # not a spoke. Each wedge covers 38 degrees of its quadrant, all four swept the same
    # way, so the disc reads as caught mid-rotation.

    for y in range(-n, n + 1):
        for x in range(-n, n + 1):
            d = (x * x + y * y) ** 0.5
            if not 2.0 <= d <= FAN_R - 2.4:
                continue
            a = math.degrees(math.atan2(y, x)) % 90.0
            if a <= 38.0:
                c.point(cx + x, cy + y, "chair-dark" if a > 6.0 else "chair-mid")
    for y in range(-2, 3):                                 # the hub
        for x in range(-2, 3):
            if x * x + y * y <= 5:
                c.point(cx + x, cy + y, "outline")
    for i, (dx, dy) in enumerate(((-2, -5), (-4, 1), (-3, -2))):   # the wind, up-left
        for k in range(3 + (i == 2)):
            c.point(cx + dx - n - k * 2, cy + dy - 2 * k, "glass-highlight")
            c.point(cx + dx - n - k * 2 - 1, cy + dy - 2 * k - 1, "glass-highlight")


# -- G5.3 built ----------------------------------------------------------------------

def card_virtualised() -> Canvas:
    return _card("VIRTUALISED", fill="badge-green", ink="paper", tape=False, pad=1)


def icon_dr() -> Canvas:
    """The offsite copy, as a small framed picture: a second little rack under a roof
    far away (a hill line), a green light on it. No words."""
    rows = [
        "ooooooooooooooo",
        "opppppppppppppo",
        "opppppooopppppo",
        "oppppoKKKoppppo",
        "opppoKKKKKopppo",
        "oppppkGkkoppppo",
        "oppppkkkkoppppo",
        "oppppkGkkoppppo",
        "oggggkkkkoggggo",
        "ogggggggggggggo",
        "ooooooooooooooo",
    ]
    c = Canvas(15, len(rows))
    _rows(c, rows, 0, 0, {"o": "outline", "p": "glass", "K": "badge-red",
                           "k": "chair-dark", "G": "badge-green", "g": "shirt-2-dark"})
    return c


# -- G5.4 without: the phone bill --------------------------------------------------------

# the phone sits where a monitor would (the right-hand end of the desk), so a seated
# worker never hides it; its cord drops off the desk's front edge to the floor at
# CORD_FOOT (world units in the desk's own tile), where `phone-knot` picks it up
PHONE = dict(c0=4.0, c1=7.2, r0=1.0, r1=3.6)
CORD_FOOT = (5.2, 4.6)


def _desk_phone_on(iso: Iso, c: Canvas):
    """A chunky corded desk phone: a dark body with a light keypad, and — the part that
    has to carry the read at 1x — the handset sitting *across* the body in its cradle,
    raised clear of it, with a bulge at each end and a dip between them. That notched
    top edge is the whole silhouette: a slab with a keypad on it reads as a laptop, a
    slab with a handset on it reads as a telephone. A coiled cord loops off the desk's
    front edge to the floor, where `phone-knot` picks it up."""
    top = desk_mod.DESK["top"] + desk_mod.DESK["slab"]
    p = PHONE
    f = iso.box(p["c0"], p["r0"], top, p["c1"], p["r1"], top + 1.4, top="chair-dark",
                left="monitor-frame", right="outline")
    iso.paint(f, "T", top + 1.4, lambda a, b: "paper"
              if p["c0"] + 0.4 <= a < p["c1"] - 0.4 and 2.4 <= b < 3.4
              and int(a * 2) % 2 == 0 else None)                     # keypad
    # The handset, across the back of the body in its cradle: earpiece, bar, mouthpiece,
    # the ends taller than the middle. Light on the dark body — at 1x the notched pale
    # bar is the only thing that separates a telephone from any other small dark box.
    for c0, c1, h in ((0.0, 1.6, 3.4), (1.6, 2.8, 2.5), (2.8, 4.4, 3.4)):
        iso.box(p["c0"] + c0, p["r0"] - 0.2, top + 1.4, p["c0"] + c1, p["r0"] + 1.4,
                top + h, top="wall-trim", left="chair-mid", right="chair-dark")
    iso.paint(f, "L", p["r1"], lambda a, z: "badge-red"
              if p["c1"] - 1.0 <= a < p["c1"] - 0.5 and z >= top + 0.6 else None)  # line lit
    # the coiled cord: out of the handset's end, down the desk front, to the floor
    pts = [(p["c0"] + 0.9, p["r1"], top + 1.0), (p["c0"] + 1.2, 4.3, top + 0.4)]
    for k in range(7):
        z = top - 1.2 * (k + 1)
        pts.append((p["c0"] + 1.2 + (0.5 if k % 2 else -0.3), 4.3 + 0.04 * k, max(z, 0.3)))
    pts.append((CORD_FOOT[0], CORD_FOOT[1], 0.3))
    _thick(iso, pts, "chair-dark", width=1)


def _desk_no_monitor(iso: Iso, chair=True):
    d = desk_mod.DESK
    iso.floor_shadow(d["c0"], d["r0"], d["c1"], d["r1"], grow=1.0, grow_r=0.5)
    if chair:
        ch, b = desk_mod.CHAIR, desk_mod.BACKREST
        iso.floor_shadow(ch["c0"] + 0.5, ch["r0"] + 0.5, ch["c1"] - 0.5, b["r1"] - 0.4,
                         grow=1.0, grow_r=0.3)
    desk_mod._desk(iso)
    if chair:
        desk_mod._chair(iso)
        desk_mod.backrest(iso)


def desk_phone() -> Canvas:
    c = Canvas(desk_mod.W, desk_mod.H)
    iso = Iso(c)
    _desk_no_monitor(iso)
    _desk_phone_on(iso, c)
    return c


COINBOX = dict(c0=4.6, c1=7.4, r0=1.0, r1=3.6)


def desk_coinphone() -> Canvas:
    """The phone takes coins. The previous pass drew this as a pale upright slab and it
    read, unmistakably, as a monitor — a workstation, the opposite of the gag. What
    makes a payphone a payphone at 1x is not the keypad or the slot, both of which are
    sub-pixel here: it is the dark narrow body with a handset **hanging off its side on
    a cord**, which no monitor has. So: a dark box, narrower than a screen and taller,
    the handset hung vertically clear of the left edge so it breaks the silhouette, a
    coiled cord between them, a gold coin slot, and a stack of coins on the desk. No
    chair — its user is standing at the end of the desk, feeding it."""
    c = Canvas(desk_mod.W, desk_mod.H)
    iso = Iso(c)
    _desk_no_monitor(iso, chair=False)
    top = desk_mod.DESK["top"] + desk_mod.DESK["slab"]
    b = COINBOX
    f = iso.box(b["c0"], b["r0"], top, b["c1"], b["r1"], top + 14.0, top="chair-mid",
                left="monitor-frame", right="chair-dark")

    def front(cc, z):
        if top + 11.0 <= z < top + 12.0 and b["c0"] + 0.6 <= cc < b["c1"] - 0.6:
            return "sticky"                                   # the coin slot, lit gold
        if top + 5.0 <= z < top + 9.0 and b["c0"] + 0.6 <= cc < b["c1"] - 0.6:
            return "chair-dark" if int(cc * 2) % 2 or int(z) % 2 else "wall-trim"  # keypad
        if top + 0.8 <= z < top + 2.6 and b["c0"] + 0.8 <= cc < b["c1"] - 0.8:
            return "outline"                                  # the coin return
        return None
    iso.paint(f, "L", b["r1"], front)
    # the handset, hung vertically on a hook clear of the box's left edge
    for z0, z1, out in ((4.2, 6.0, 0.6), (6.0, 9.6, 0.0), (9.6, 11.4, 0.6)):
        iso.box(b["c0"] - 2.7 - out, b["r0"] + 0.5, top + z0, b["c0"] - 1.4,
                b["r1"] - 0.5, top + z1, top="wall-trim", left="wall-trim",
                right="chair-mid")
    # its coiled cord, looping from the handset's foot back into the box
    hx = b["c0"] - 2.0
    coil = [(hx, b["r1"] - 0.8, top + 3.2)]
    for k in range(5):
        coil.append((hx + 0.3 + (0.8 if k % 2 else -0.2), b["r1"] - 0.8,
                     top + 3.6 - 0.9 * k))
    coil.append((b["c0"] + 0.2, b["r1"] - 0.8, top + 0.6))
    _thick(iso, coil, "chair-dark", width=1)
    # a stack of coins at the front left of the desk
    for k in range(5):
        iso.box(0.6, 2.4, top + k * 0.8, 1.8, 3.6, top + k * 0.8 + 0.8, top="sticky",
                left="sticky", right="desk-wood", outline=None)
    pts = set()
    for (x, y), ff in iso.box_faces(0.6, 2.4, top, 1.8, 3.6, top + 4.0).items():
        pts.add((x, y))
    iso.outline(pts, "outline")
    pts = [(b["c0"] - 0.5, b["r1"] - 0.6, top + 0.4), (b["c0"] + 0.4, 4.3, top - 1.0)]
    for k in range(6):
        pts.append((b["c0"] + 0.9 + (0.5 if k % 2 else -0.3), 4.3, max(top - 2.0 - 1.2 * k, 0.3)))
    pts.append((CORD_FOOT[0], CORD_FOOT[1], 0.3))
    _thick(iso, pts, "chair-dark", width=1)
    return c


COIN_W, COIN_H = 26, 26
COIN_ANCHOR = (13, 26)


def coin_frames(look_name: str) -> dict:
    """Profile at the end of the desk, reaching up to the coin box's slot with a gold
    coin (frame 0), then pushing it in (frame 1). `<look>-left` / `-right`."""
    from .poses import _standing_right
    look = LOOKS[look_name]
    right = []
    for i in range(2):
        f = Fig(COIN_W, COIN_H)
        body = _standing_right(look)
        for (x, y), r in body.px.items():
            f.put(x + 5, y + 2, r)
        # the near arm, up and forward to the slot, the coin between finger and thumb
        n = 6 if i == 0 else 7
        arm = set()
        for k in range(n):
            arm |= {(14 + k, 11 - k), (15 + k, 11 - k), (14 + k, 12 - k)}
        f.blob(arm, lambda p: "s" if p[0] >= 11 + n else "t", ring="outer")
        cx, cy = 14 + n, 11 - n - 3
        f.blob(R(cx, cy, cx + 2, cy + 2), "Y", ring=True)            # the coin
        f.put(cx + 1, cy + 1, "b")
        right.append(f.to_canvas(dict(look, b="desk-wood")))
    return {f"{look_name}-right": right, f"{look_name}-left": [c.mirror_h() for c in right]}


def _phone_knot(iso: Iso, c: Canvas):
    """Anchored on the floor tile just outside the closet door. Every phone cord comes
    in from its desk along the floor in front of the chairs, they tangle into one
    knot, and the knot's tail goes through the door into the closet."""
    knot = (5.0, 4.0)
    cols = ("wall-trim", "badge-body", "wall-trim")
    for k, col in enumerate(cols):
        fx = (1 + k) * 8.0 + CORD_FOOT[0]          # desks at the knot tile's c + 1 ..
        fy = -8.0 + CORD_FOOT[1]
        lane = 1.4 + 1.4 * k                        # each cord its own lane, then together
        pts = [(fx, fy), (fx - 0.6, lane), (knot[0] + 3.0, lane + 0.4), knot]
        kinked = []
        for (a, b), (a2, b2) in zip(pts, pts[1:]):
            n = max(2, int(max(abs(a2 - a), abs(b2 - b)) / 1.6))
            for j in range(n):
                t = j / n
                w = 0.35 if j % 2 else -0.35
                kinked.append((a + (a2 - a) * t + w, b + (b2 - b) * t - w))
        kinked.append(knot)
        _thick(iso, kinked, col, width=1)
    # one fat bundle out of the knot, through the door, into the closet
    _thick(iso, [knot, (1.0, 11.0), (-4.0, 12.5)], "badge-body", width=2)
    # the knot: a tangle of loops, bigger than any cord should make
    kx, ky = iso.pt(knot[0], knot[1], 0.4)
    ball = [
        "....ooooo....",
        "..ooAoBoAoo..",
        ".oBAAoBBAoBo.",
        "oAoBAoAoBAoAo",
        "oBAoBAoBoAoBo",
        "oAoBoAoBAoBAo",
        ".oBAoBAoBAoo.",
        "..ooAoBoAoo..",
        "....ooooo....",
    ]
    _rows(c, ball, kx - 6, ky - 7, {"o": "outline", "A": "wall-trim", "B": "badge-body"})


# -- G5.4 built ------------------------------------------------------------------------

def headset_frames(look_name: str) -> list[Canvas]:
    """Seated from behind wearing a headset: the band over the crown, a cup over each
    ear, no cord."""
    def hook(body):
        # head sits at body rows 1..7 shifted by seated_frame's (1, 10): the band arcs
        # over the crown, the cups sit either side
        for (x, y) in ((4, 0), (5, -1), (6, -1), (7, -1), (8, -1), (9, -1), (10, -1),
                       (11, 0)):
            body.put(x + 1, y + 10, "o")
        body.blob(R(3 + 1, 3 + 10, 4 + 1, 5 + 10), "L", ring=True)
        body.blob(R(11 + 1, 3 + 10, 12 + 1, 5 + 10), "L", ring=True)
    return [seated_frame(look_name, arm=hook)]


def receipt_33() -> Canvas:
    """A till receipt taped to the wall: a long paper strip, a few grey lines, and the
    number in green, -33%. Zigzag torn bottom."""
    text = "-33%"
    tw = glyphs.text_width(text)
    w = tw + 6
    h = 24
    c = Canvas(w, h + 2)
    c.rect(0, 0, w - 1, h - 1, "outline")
    c.rect(1, 1, w - 2, h - 1, "paper")
    for y in (3, 5, 7):
        c.rect(3, y, w - 4 - (y % 3), y, "wall-shadow")
    glyphs.draw(c, text, 3, 11, "shirt-2-dark")
    c.rect(2, 18, w - 3, 18, "outline")
    c.rect(3, 20, w - 6, 20, "wall-shadow")
    for x in range(w):                                      # torn edge
        c.point(x, h - 1 + (x % 2), "outline")
        if x % 2 == 0 and 0 < x < w - 1:
            c.point(x, h - 1, "paper")
    c.point(1, 0, "wall-shadow")
    c.point(w - 2, 0, "wall-shadow")
    return c


RUNAWAY_W, RUNAWAY_H = 46, 62
RUNAWAY_ANCHOR = (7, 61)


def receipt_runaway() -> Canvas:
    """G5.4 without, the *primary* read: the phone bill, unspooled.

    The previous pass drew the phones. DIA-9 rated it **doesn't read** — "a black smear
    speckled with white and pale blue on the floor next to a yellow `DAVE?` sign. No
    phone, no bill, no coins" — and the fix is to stop drawing the phones and draw the
    bill. The built state already owns the right object with a proven 1x silhouette:
    `receipt-33`, the short till receipt with the torn perforated edge and `-33%` on it.
    So the two states rhyme on one object instead of arguing about two: one receipt that
    ends, and one that will not stop.

    A long pale ribbon on a beige floor is the strongest silhouette this room has left —
    nothing else here is a continuous curve, everything else is a box or a person. The
    printed head stays the width of the built receipt so it reads as the same object;
    below the tear-off the roll narrows to 5 px and falls, wavering, then loses its way
    on the floor in three loose loops that double back over each other.

    **No digits, and that is deliberate** (DIA-21, ruled blocking). The previous pass put
    `-33%` on this head in red — the built receipt's figure, recoloured. That is E-10,
    the saving VoIP *delivered*, so on the wall of the room where VoIP was never built it
    states the opposite of the gag; and reusing one number across both states spends the
    pair's only figure on a hue change. The honest replacement is not a different number:
    E-10 gives the saving and never the base, so there is no sourced "before" to print
    and this project does not invent one. The head carries ruled line items and a total
    rule instead — enough to say *itemised bill*, with the length of the roll doing the
    joke, which is what it was always doing.

    Drawn in screen space, not isometric: it is paper, it does not have a footprint, and
    a projected ribbon at this size reads as a ramp."""
    hw, hh = glyphs.text_width("-33%") + 6, 21            # the built receipt's width
    hx = RUNAWAY_W - hw - 2
    c = Canvas(RUNAWAY_W, RUNAWAY_H)
    c.rect(hx, 0, hx + hw - 1, hh - 1, "outline")
    c.rect(hx + 1, 1, hx + hw - 2, hh - 1, "paper")
    # line items: a description rule on the left, its amount flush right, ragged lengths
    for k, y in enumerate((3, 5, 7, 9, 11, 13)):
        c.rect(hx + 2, y, hx + 2 + 4 + (k * 5) % 6, y, "wall-shadow")
        c.rect(hx + hw - 4 - (2 + (k * 3) % 4), y, hx + hw - 3, y, "wall-shadow")
    # the total: the one heavy horizontal on the head, so it reads as a bill and not as
    # a blank strip of paper. The rule is drawn; the figure under it is not.
    c.rect(hx + 2, 16, hx + hw - 3, 16, "outline")
    c.rect(hx + hw - 9, 18, hx + hw - 3, 18, "outline")
    for x in range(hx + 1, hx + hw - 1):                  # the perforation it tore at
        if x % 2 == 0:
            c.point(x, hh - 1, "wall-shadow")
    # the roll below the tear-off: a 5 px ribbon down the wall, then loose on the floor
    spine = [(hx + hw // 2, hh), (hx + hw // 2 - 2, hh + 8), (hx + hw // 2, hh + 15),
             (hx + hw // 2 - 5, hh + 20),
             (26, hh + 23), (17, hh + 24), (11, hh + 26), (17, hh + 29), (26, hh + 30),
             (30, hh + 32), (21, hh + 34), (12, hh + 36), (7, hh + 38)]
    pts: set = set()
    for (x0, y0), (x1, y1) in zip(spine, spine[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for k in range(n + 1):
            x = x0 + round((x1 - x0) * k / n)
            y = y0 + round((y1 - y0) * k / n)
            for dx in range(-2, 3):
                if 0 <= x + dx < RUNAWAY_W and 0 <= y < RUNAWAY_H:
                    pts.add((x + dx, y))
    for (x, y) in pts:
        c.point(x, y, "paper")
    for (x, y) in sorted(pts):
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if (x + dx, y + dy) not in pts and 0 <= x + dx < RUNAWAY_W \
                    and 0 <= y + dy < RUNAWAY_H and not (y + dy < hh and hx <= x + dx):
                c.point(x + dx, y + dy, "outline")
    for (x, y) in sorted(pts):                            # faint print on the roll
        if y % 5 == 0 and (x + y) % 3 == 0:
            c.point(x, y, "wall-shadow")
    return c


# -- G7.3: ten hats -------------------------------------------------------------------

HAT_LABELS = ["INFRA", "SEC", "SUPPORT", "DEV", "PRODUCT"]   # bottom to top
HAT_BRIMS = {"INFRA": "shirt-1", "SEC": "badge-red", "SUPPORT": "badge-green",
             "DEV": "sticky", "PRODUCT": "badge-red"}
HATS_W, HATS_H = 40, 72
HATS_ANCHOR = (20, 72)
HATS_MS = 380


def _hat(f: Fig, cx: int, brim_y: int, label: str, brim_role: str):
    """One hat, centred on cx, its brim's top row at brim_y: a white band with the label
    in the 3x5 glyphs, a coloured crown line on top, a brim wider than the band. Returns
    the band's top row (where the next hat sits)."""
    from ..glyphs import GLYPHS, text_width
    tw = text_width(label)
    bw = tw + 4
    x0 = cx - bw // 2
    x1 = x0 + bw - 1
    band = R(x0, brim_y - 7, x1, brim_y - 1)
    crown = R(x0 + 1, brim_y - 8, x1 - 1, brim_y - 8)
    brim = R(x0 - 2, brim_y, x1 + 2, brim_y)
    f.blob(crown | band | brim, lambda p: "V" if p in band else brim_role, ring=True)
    gx = x0 + 2
    for ch in label:
        for dy, row in enumerate(GLYPHS[ch]):
            for dx, px in enumerate(row):
                if px == "#":
                    f.put(gx + dx, brim_y - 6 + dy, "k")
        gx += len(GLYPHS[ch][0]) + 1
    return brim_y - 9


def hats_frames() -> list[Canvas]:
    """The IT manager, front view, arms out for balance, stepping carefully, under a
    stack of five hats that leans one way then the other."""
    look = dict(LOOKS["a"], t="shirt-1", T="shirt-1-dark")
    roles = {"shirt-1": "t", "badge-red": "X", "badge-green": "G2", "sticky": "Y"}
    out = []
    for i, lean in enumerate((1, -1)):
        f = Fig(HATS_W, HATS_H)
        body = Fig()
        _shadow(body)
        _leg_front(body, "left", 1 if i == 0 else 0, 0)
        _leg_front(body, "right", 0 if i == 0 else 1, 0)
        _torso_front(body, 0)
        _head_front(body, look["style"], 0)
        # eyes up, at the hats
        body.px[(6, 5)] = body.px[(9, 5)] = "s"
        body.px[(6, 4)] = body.px[(9, 4)] = "e"
        ox, oy = (HATS_W - 16) // 2, HATS_H - 24
        for (x, y), r in body.px.items():
            f.put(x + ox, y + oy, r)
        # arms straight out to the sides, hands open: balancing
        f.blob(R(ox - 5, oy + 9, ox + 3, oy + 10), lambda p: "s" if p[0] <= ox - 4 else "t",
               ring="outer")
        f.blob(R(ox + 12, oy + 9, ox + 20, oy + 10), lambda p: "s" if p[0] >= ox + 19 else "T",
               ring="outer")
        by = oy + 2
        for k, label in enumerate(HAT_LABELS):
            role = {"shirt-1": "t", "badge-red": "X", "badge-green": "Z", "sticky": "Y"}[
                HAT_BRIMS[label]]
            by = _hat(f, HATS_W // 2 + (lean * k * k) // 4, by, label, role)
        out.append(f.to_canvas(dict(look, Z="badge-green")))
    return out


ONEHAT_W, ONEHAT_H = 36, 36
ONEHAT_ANCHOR = (18, 36)


def onehat_frame(look_name: str, label: str) -> Canvas:
    """Front view, standing easy, one hat: the built state of G7.3."""
    look = LOOKS[look_name]
    f = Fig(ONEHAT_W, ONEHAT_H)
    body = Fig()
    _shadow(body)
    _leg_front(body, "left", 0, 0)
    _leg_front(body, "right", 0, 0)
    _torso_front(body, 0)
    _arm_front(body, "left", 6, 0)
    _arm_front(body, "right", 6, 0)
    _head_front(body, look["style"], 0)
    ox, oy = (ONEHAT_W - 16) // 2, ONEHAT_H - 24
    for (x, y), r in body.px.items():
        f.put(x + ox, y + oy, r)
    role = {"shirt-1": "B", "badge-red": "X", "badge-green": "Z", "sticky": "Y"}[
        HAT_BRIMS[label]]
    _hat(f, ONEHAT_W // 2, oy + 2, label, role)
    return f.to_canvas(dict(look, B="shirt-1", Z="badge-green"))


# -- G5.6: data everywhere (the inset office, street) --------------------------------------

def drives_final() -> Canvas:
    """Three portable drives stacked on a desk, each hand-labelled: FINAL on top, FINAL2,
    FINAL-real at the bottom. Billboarded so the labels read; anchor: bottom centre."""
    labels = ["FINAL", "FINAL2", "FINAL-real"]            # top to bottom
    widths = [glyphs.text_width(t) + 6 for t in labels]
    w = max(widths) + 4
    step, dh = 11, 12
    h = step * (len(labels) - 1) + dh
    c = Canvas(w, h)
    offs = [3, -2, 0]                                      # stacked a little askew
    bodies = ("chair-dark", "shirt-1-dark", "badge-red")
    for k, (t, dw) in enumerate(zip(labels, widths)):
        y0 = k * step
        x0 = max(0, min(w - dw, (w - dw) // 2 + offs[k]))
        c.rect(x0, y0, x0 + dw - 1, y0 + dh - 1, "outline")
        c.rect(x0 + 1, y0 + 1, x0 + dw - 2, y0 + dh - 2, bodies[k])     # the drive
        c.point(x0 + dw - 3, y0 + 2, "badge-green")                      # its light
        c.rect(x0 + 2, y0 + 3, x0 + dw - 3, y0 + dh - 3, "paper")       # masking tape
        glyphs.draw(c, t, x0 + 3, y0 + 4, "outline")
    return c


def under_frames() -> list[Canvas]:
    """Desk canvas + anchor (paste over a chairless desk): someone on hands and knees
    under it, hunting for a drive — shoes and trousers out toward us, the back of a
    shirt disappearing under the desk top, a torch beam lighting the floor under it.
    Frame 1 wiggles the feet."""
    out = []
    for i in range(2):
        f = Fig(desk_mod.W, desk_mod.H)
        # the torch's pool of light under the desk
        for (x, y) in ((6, 29), (7, 29), (8, 29), (9, 30), (5, 30), (6, 30), (7, 30),
                       (8, 30)):
            f.put(x, y, "Y")
        # the back, low and flat, going in under the desk top (desk top at y ~ 24)
        f.blob(R(9, 27, 18, 30), lambda p: "t" if p[0] < 17 else "T", ring="outer")
        # hips and legs, folded, out toward the viewer
        f.blob(R(17, 29, 21, 32), "p", ring="outer")
        f.blob(R(17, 33, 19, 36), "p", ring="outer")
        f.blob(R(20, 33, 22, 35), "p", ring="outer")
        dy = 1 if i else 0
        f.blob(R(17, 37, 19, 37 - dy), "k", ring=False)
        f.blob(R(21, 36, 23, 36 + dy), "k", ring=False)
        # floor shadow under the knees
        for x in range(15, 25):
            if (x, 38) not in f.px:
                f.put(x, 38, "w")
        out.append(f.to_canvas(dict(LOOKS["d"], t="shirt-1", T="shirt-1-dark")))
    return out


def desk_drives() -> Canvas:
    """The plain desk without its chair (pushed away so someone can crawl under)."""
    c = Canvas(desk_mod.W, desk_mod.H)
    iso = Iso(c)
    d = desk_mod.DESK
    iso.floor_shadow(d["c0"], d["r0"], d["c1"], d["r1"], grow=1.0, grow_r=0.5)
    desk_mod._desk(iso)
    faces = desk_mod._monitor(iso, desk_mod.MON)
    desk_mod._screen(iso, faces, "plain", desk_mod.MON)
    return c


def drives_point():
    """Where the drive stack stands on the desk top: its left end, clear of the monitor."""
    iso = Iso(Canvas(desk_mod.W, desk_mod.H))
    top = desk_mod.DESK["top"] + desk_mod.DESK["slab"]
    return iso.pt(1.8, 3.0, top)


NAS_MS = 300


def _nas(iso: Iso, c: Canvas, frame: int):
    """A consumer NAS: a small white two-bay box, blinking, standing on a windowsill of
    the back-left wall (its front faces +c). Anchored on the tile against that wall;
    layout raises it to the sill."""
    f = iso.box(0.3, 2.2, 0, 2.8, 5.8, 5.5, top="paper", left="wall-shadow",
                right="badge-body")
    lit = ("badge-green", "sticky") if frame == 0 else ("sticky", "badge-green")

    def front(r, z):
        if 3.5 <= z < 4.5 and 2.6 <= r < 3.4:
            return lit[0]
        if 3.5 <= z < 4.5 and 4.2 <= r < 5.0:
            return lit[1]
        if 0.8 <= z < 2.6 and 2.6 <= r < 5.4 and int(r * 2) % 3:
            return "chair-mid"                     # the two bays
        return None
    iso.paint(f, "R", 2.8, front)


def icon_storage() -> Canvas:
    """Built: one storage icon on the screen — a stack of three disks, green."""
    rows = [
        ".ooooooo.",
        "oGGGGGGGo",
        "oggggggGo",
        "ooooooooo",
        "oGGGGGGGo",
        "oggggggGo",
        "ooooooooo",
        "oGGGGGGGo",
        "oggggggGo",
        ".ooooooo.",
    ]
    c = Canvas(9, len(rows))
    _rows(c, rows, 0, 0, {"o": "outline", "G": "badge-green", "g": "shirt-2-dark"})
    return c


# -- registry ---------------------------------------------------------------------------

def _desk_sprite(cv: Canvas) -> Sprite:
    return Sprite(cv, desk_mod.ANCHOR, {"net": desk_mod.net_point(),
                                        "card": desk_mod.card_point()})


def build_all() -> dict:
    lab = main_server_label()
    dn = sign_dnto()
    virt = card_virtualised()
    dr = icon_dr()
    rc = receipt_33()
    run = receipt_runaway()
    dfin = drives_final()
    ist = icon_storage()
    return {
        "server-tower": make(_server_tower),
        "label-main-server": Sprite(lab, (lab.w // 2, lab.h)),
        "sign-dnto": Sprite(dn, (dn.w // 2, dn.h)),
        "box-fan-l": make(_box_fan_l),
        "box-fan-face": make(_box_fan_face),
        "card-virtualised": Sprite(virt, (virt.w // 2, virt.h)),
        "icon-dr": Sprite(dr, (dr.w // 2, dr.h)),
        "desk-phone": _desk_sprite(desk_phone()),
        "desk-coinphone": _desk_sprite(desk_coinphone()),
        "phone-knot": make(_phone_knot),
        "receipt-33": Sprite(rc, (rc.w // 2, rc.h)),
        "receipt-runaway": Sprite(run, RUNAWAY_ANCHOR),
        "drives-final": Sprite(dfin, (dfin.w // 2, dfin.h)),
        "desk-drives": Sprite(desk_drives(), desk_mod.ANCHOR, {"drives": drives_point(),
                                                              "net": desk_mod.net_point()}),
        "nas": make_anim(_nas, 2, ms=NAS_MS),
        "icon-storage": Sprite(ist, (ist.w // 2, ist.h // 2)),
    }
