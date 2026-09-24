"""Worker poses added in PH1-07, built from the same blobs and roles as worker.py so
every look is a palette swap. Each pose is one manifest entry keyed by look (like
`worker-seated`); animated ones carry their frames under that key.

  worker-printouts G4.3 (band 150): standing between the two CRM desks, a printout in
                   each hand, looking from one to the other (2 frames). 26 x 24.
  worker-give      G5.1 (band 150): profile, arm out, handing over a padded envelope
                   with a hard-drive bulge. `<look>-left` / `-right`. 24 x 24.
  courier          G5.1: the courier, brown uniform and cap, hand out for it. Same
                   canvas and keys as worker-give (one look).
  worker-watch     G5.1: front view at the inset office's door, forearm up, checking
                   a watch (frame 0), then looking up the road (frame 1).
  sales, engineer  G7.3a (band 220): two outfits that say which side they're on (shirt
                   and tie; hoodie and headphones), pointing at each other across the
                   whiteboard. `point-right` / `point-left`, 2-frame jab each. 20 x 24.
  worker-huddle    G2.4: seen from behind, hunched over the table's one laptop;
                   `<look>` and `<look>-dongle` (an arm up, holding an adapter).
  worker-wave      G2.4 (band 220, PH1-10): profile, beside a screen, the near arm up
                   waving at it, mouth open (2 frames). `<look>-right` / `-left`. 16 x 24.
  worker-hat       G7.3a built: front view, a marker raised to the board, wearing the
                   `PRODUCT` hat — a paper band far wider than the head. 32 x 34.
  worker-reach     G4.2 (band 150): seated at the finance desk, reaching up for the
                   envelope on the hook. Desk canvas + anchor.
  worker-peel      G1.2 (band 80): standing at a colleague's desk, peeling the password
                   sticky note off their monitor. Desk canvas + anchor: paste over
                   `desk-postit` at the same point. Frame 1 erases the note from the
                   screen (it is in the worker's hand now).
"""
from __future__ import annotations

from ..dsl import Canvas
from . import desk as desk_mod
from .worker import (Fig, LOOKS, R, _shadow, _leg_side, _torso_side, _head_side,
                     _arm_side, _leg_front, _torso_front, _head_front)

PEEL_MS = 600


def _place(dst: Fig, src: Fig, dx: int, dy: int):
    for (x, y), role in src.px.items():
        dst.put(x + dx, y + dy, role)


def _standing_right(look: dict, far_arm: bool = True) -> Fig:
    """A right-facing profile, feet together, no near arm yet (the pose adds it)."""
    f = Fig()
    _shadow(f, cx=9)
    if far_arm:
        _arm_side(f, 0, 0, role="T", ring=True)
    _leg_side(f, "stand", 0)
    _torso_side(f, 0)
    _leg_side(f, "stand", 0)
    _head_side(f, look["style"], 0)
    return f


# -- G1.2: peeling the note ----------------------------------------------------

# where the standing worker goes on the desk canvas: in front of the desk, just right
# of the (pushed-back) chair, far enough left that the head clears the screen
PEEL_OFFSET = (3, 12)


def _screen_patch() -> dict:
    """Pixels where `desk-postit` differs from the plain desk: the note. Frame 1 paints
    the plain desk's colours back over them."""
    plain, postit = desk_mod.build("plain"), desk_mod.build("postit")
    out = {}
    for y in range(plain.h):
        for x in range(plain.w):
            a, b = plain.img.getpixel((x, y)), postit.img.getpixel((x, y))
            if a != b:
                out[(x, y)] = a
    return out


def peel_frames(look_name: str) -> list[Canvas]:
    look = LOOKS[look_name]
    frames = []
    patch = _screen_patch()
    for i in range(2):
        f = Fig(desk_mod.W, desk_mod.H)
        body = _standing_right(look)
        _place(f, body, *PEEL_OFFSET)
        if i == 0:
            # near arm stretched up across to the screen, fingertips on the note
            arm = {(12, 21), (13, 21), (13, 20), (14, 20), (15, 20), (15, 19), (16, 19),
                   (17, 19), (17, 18), (18, 18), (19, 17), (19, 16), (20, 16), (20, 17)}
            f.blob(arm, lambda p: "s" if p[0] >= 19 else "t", ring="outer")
            f.put(21, 13, "Y")   # the note's corner, lifting off the glass
            f.put(22, 13, "o")
        else:
            # note pulled off and held up in front of the face: reading it
            arm = {(12, 21), (13, 21), (13, 20), (14, 20), (14, 19), (15, 19), (15, 18),
                   (16, 18)}
            f.blob(arm, lambda p: "s" if p[0] >= 15 else "t", ring="outer")
            f.blob(R(15, 14, 18, 16), "Y")
            f.put(16, 15, "o")   # the password, scribbled
            f.put(17, 15, "o")
        c = f.to_canvas(look)
        if i == 1:
            for (x, y), rgba in patch.items():
                if c.img.getpixel((x, y))[3] == 0 and rgba[3]:
                    c.img.putpixel((x, y), rgba)
        frames.append(c)
    return frames


# -- G4.2: reaching for the bait -----------------------------------------------------

REACH_MS = 500


def reach_frames(look_name: str) -> list[Canvas]:
    """Seated from behind, the right arm going up toward the envelope that dangles in
    front of the screen (fishing-line's `bait`); frame 1 is the fingertips on it."""
    from .worker import seated_frame
    arms = [
        # arm straight up past the head, silhouetted against the wall
        {(13, y) for y in range(13, 20)} | {(14, y) for y in range(12, 20)} | {(15, 11), (15, 12)},
        # ... and leaning in, fingertips on the envelope's corner
        {(13, y) for y in range(15, 20)} | {(14, y) for y in range(13, 20)}
        | {(15, 13), (15, 12), (16, 12), (16, 13)},
    ]
    out = []
    for arm in arms:
        top = min(y for _, y in arm)

        def hook(body, arm=arm, top=top):
            body.blob(arm, lambda p: "s" if p[1] <= top + 1 and p[0] >= 15 else "T", ring="outer")
        out.append(seated_frame(look_name, arm=hook))
    return out


# -- G4.3: two printouts ---------------------------------------------------------------

PRINTOUTS_W, PRINTOUTS_H = 26, 24
PRINTOUTS_ANCHOR = (13, 24)
PRINTOUTS_MS = 700


def _printout(f: Fig, x0, y0):
    """A sheet of paper with a table on it, 5 x 6, top-left at (x0, y0)."""
    pts = R(x0, y0, x0 + 4, y0 + 5)
    f.blob(pts, lambda p: "g" if (p[1] - y0) in (1, 3) and p[0] > x0 else "V")
    f.put(x0 + 1, y0 + 1, "k")   # the header's first cell, inked


def printouts_frames(look_name: str) -> list[Canvas]:
    """Front view. Frame 0 looks at the left sheet (held higher), frame 1 the right."""
    look = LOOKS[look_name]
    out = []
    for side in (0, 1):
        f = Fig(PRINTOUTS_W, PRINTOUTS_H)
        body = Fig()
        _shadow(body)
        _leg_front(body, "left", 0, 0)
        _leg_front(body, "right", 0, 0)
        _torso_front(body, 0)
        _head_front(body, look["style"], 0)
        # eyes: toward the sheet being read
        body.px[(6, 5)] = body.px[(9, 5)] = "s"
        dx = -1 if side == 0 else 1
        body.px[(6 + dx, 5)] = body.px[(9 + dx, 5)] = "e"
        _place(f, body, 5, 0)
        ly, ry = (9, 11) if side == 0 else (11, 9)
        # arms out to both sides, hands at the sheets
        f.blob({(6, 9), (6, 10), (5, 10), (5, 11), (4, 11), (4, ly + 2), (3, ly + 2)} |
               {(4, y) for y in range(min(11, ly + 2), max(11, ly + 2) + 1)},
               lambda p: "s" if p[1] == ly + 2 and p[0] == 3 else "t", ring="outer")
        f.blob({(19, 9), (19, 10), (20, 10), (20, 11), (21, 11), (21, ry + 2), (22, ry + 2)} |
               {(21, y) for y in range(min(11, ry + 2), max(11, ry + 2) + 1)},
               lambda p: "s" if p[1] == ry + 2 and p[0] == 22 else "T", ring="outer")
        _printout(f, 0 - 1 + 1, ly - 1)
        _printout(f, 21, ry - 1)
        f.put(3, ly + 2, "s")
        f.put(22, ry + 2, "s")
        out.append(f.to_canvas(look))
    return out


# -- G5.1: the overnight envelope --------------------------------------------------------

GIVE_W, GIVE_H = 24, 24
GIVE_ANCHOR = (12, 24)
WATCH_MS = 900

# brown uniform and cap; light skin so the face reads against the uniform
COURIER_LOOK = dict(t="desk-wood", T="desk-wood-dark", p="desk-wood-dark", s="skin-1",
                    h="hair-1", style="short")


def _mailer(f: Fig, x0, y0):
    """A padded envelope, 6 x 5, with the rectangular bulge of a hard drive in it."""
    f.blob(R(x0, y0, x0 + 5, y0 + 4), lambda p: "Y")
    for x in range(x0 + 1, x0 + 5):
        f.put(x, y0 + 1, "b")
        f.put(x, y0 + 3, "b")
    f.put(x0 + 1, y0 + 2, "b")
    f.put(x0 + 4, y0 + 2, "b")


def _give_right(look: dict, envelope: bool, cap: bool) -> Canvas:
    f = Fig(GIVE_W, GIVE_H)
    body = _standing_right(look)
    if cap:
        # a courier's cap: crown over the hair, brim out over the face
        for (x, y) in list(body.px):
            if y <= 3 and body.px[(x, y)] not in ("o", "e"):
                body.px[(x, y)] = "T"
        body.blob({(9, 3), (10, 3), (11, 3), (12, 3)}, "T", ring="outer")
    _place(f, body, 4, 0)
    # the near arm, straight out in front at chest height
    arm = {(x, y) for x in range(13, 19) for y in (11, 12)}
    f.blob(arm, lambda p: "s" if p[0] >= 18 else "t", ring="outer")
    if envelope:
        _mailer(f, 17, 8)
        f.put(18, 12, "s")   # fingers under it
    return f


def give_frames(look_name: str) -> dict:
    look = LOOKS[look_name]
    right = _give_right(look, envelope=True, cap=False).to_canvas(
        dict(look, b="desk-wood"))
    return {f"{look_name}-right": [right], f"{look_name}-left": [right.mirror_h()]}


def courier_frames() -> dict:
    right = _give_right(COURIER_LOOK, envelope=False, cap=True).to_canvas(COURIER_LOOK)
    return {"right": [right], "left": [right.mirror_h()]}


def watch_frames(look_name: str) -> list[Canvas]:
    """Front view. The screen-left forearm comes up across the chest, watch face on the
    wrist; frame 0 eyes down on it, frame 1 eyes up the road."""
    from .worker import _arm_front
    look = LOOKS[look_name]
    out = []
    for i in range(2):
        f = Fig()
        _shadow(f)
        _leg_front(f, "left", 0, 0)
        _leg_front(f, "right", 0, 0)
        _torso_front(f, 0)
        _arm_front(f, "right", 6, 0)
        _head_front(f, look["style"], 0)
        if i == 0:
            f.px[(6, 5)] = f.px[(9, 5)] = "s"
            f.px[(6, 6)] = f.px[(9, 6)] = "e"
        # upper arm down the side, forearm up across the chest to the wrist
        f.blob(R(1, 9, 2, 11), "t", ring="outer")               # upper arm
        f.blob(R(2, 11, 8, 12), "s", ring=True)                  # bare forearm across
        f.put(6, 11, "Y")    # the watch face on the wrist
        f.put(7, 11, "Y")
        out.append(f.to_canvas(look))
    return out


# -- G7.3a / G2.4 (band 220) -------------------------------------------------------------

POINT_W, POINT_H = 20, 24
POINT_ANCHOR = (8, 24)
POINT_MS = 350

SALES_LOOK = dict(t="paper", T="wall-shadow", p="pants-1", s="skin-1", h="hair-1",
                  style="short")
ENGINEER_LOOK = dict(t="chair-mid", T="chair-dark", p="shirt-1-dark", s="skin-3",
                     h="desk-wood", style="short")


def _point_right(look: dict, kind: str, jab: int) -> Canvas:
    f = Fig(POINT_W, POINT_H)
    body = _standing_right(look)
    if kind == "sales":
        for y in range(10, 15):                  # the tie
            body.px[(8, y)] = "X"
        body.px[(9, 10)] = "X"
    else:
        # headphones: a band over the crown, a cup over the ear
        for (x, y) in ((4, 1), (5, 0), (6, 0), (7, 0), (8, 0), (9, 1)):
            body.put(x, y, "o")
        body.blob(R(5, 4, 6, 6), "L", ring=True)
    _place(f, body, 0, 0)
    # the pointing arm, straight out at shoulder height, index finger extended
    x1 = 17 + jab
    f.blob({(x, y) for x in range(10, x1) for y in (10, 11)},
           lambda p: "s" if p[0] >= x1 - 2 else "t", ring="outer")
    f.blob({(x1, 10)}, "s", ring="outer")
    return f.to_canvas(look)


def point_frames(kind: str) -> dict:
    look = SALES_LOOK if kind == "sales" else ENGINEER_LOOK
    right = [_point_right(look, kind, j) for j in (0, 1)]
    return {"point-right": right, "point-left": [c.mirror_h() for c in right]}


def huddle_frames(look_name: str) -> dict:
    """From behind, leaning in over the table: head dropped a pixel, shoulders up,
    arms forward out of sight. `-dongle`: one arm up, an adapter in the hand."""
    from .worker import _head_back, _arm_front
    look = LOOKS[look_name]
    out = {}
    for dongle in (False, True):
        f = Fig()
        _shadow(f)
        _leg_front(f, "left", 0, 0)
        _leg_front(f, "right", 0, 0)
        _torso_front(f, 1)
        _arm_front(f, "left", 4, 1, hand=False)
        if not dongle:
            _arm_front(f, "right", 4, 1, hand=False)
        _head_back(f, look["style"], 2)
        if dongle:
            f.blob(R(13, 2, 14, 10), lambda p: "s" if p[1] <= 3 else "T", ring="outer")
            f.blob(R(12, 0, 15, 2), "Y", ring=True)    # the adapter, held up (yellow)
        out[look_name + ("-dongle" if dongle else "")] = [f.to_canvas(look)]
    return out


WAVE_MS = 280


def wave_side_frames(look_name: str) -> dict:
    """G2.4 (PH1-10 fix round): profile, standing beside a screen and waving at it —
    the near arm straight up with the hand open, mouth open mid-"can you hear me?".
    Frame 0 hand up, frame 1 tipped forward. `<look>-right` / `<look>-left`."""
    look = LOOKS[look_name]
    right = []
    for i in range(2):
        f = _standing_right(look)
        f.put(10, 6, "X")                                   # the open mouth
        f.put(10, 7, "e")
        tip = 12 if i == 0 else 13
        arm = {(8, 10), (9, 10), (9, 9), (10, 9), (10, 8), (11, 8)}
        for y in range(3, 8):
            x = 11 if y >= 6 else tip - (1 if y >= 5 and i == 1 else 0)
            arm |= {(x, y), (x + 1, y)}
        hand = {(tip, 1), (tip + 1, 1), (tip, 2), (tip + 1, 2)}
        f.blob(arm | hand, lambda p: "s" if p in hand else "T", ring="outer")
        right.append(f.to_canvas(look))
    return {look_name + "-right": right, look_name + "-left": [c.mirror_h() for c in right]}


HAT_W, HAT_H = 38, 36
HAT_ANCHOR = (19, 36)


def hat_frame(look_name: str, side: str = "right") -> Canvas:
    """Front view at the whiteboard, marker hand up by the board (screen `side`), and
    the hat (PH1-10 item 4): a real hat silhouette — a rounded red crown, a white band
    reading PRODUCT in the 3x5 glyphs, and a brim wider than both — far bigger than the
    head, the comic size of a thing everyone can now see. The body mirrors; the hat is
    drawn after, so its text never does."""
    from ..glyphs import GLYPHS, text_width
    from .worker import _arm_front
    look = LOOKS[look_name]
    f = Fig(HAT_W, HAT_H)
    body = Fig()
    _shadow(body)
    _leg_front(body, "left", 0, 0)
    _leg_front(body, "right", 0, 0)
    _torso_front(body, 0)
    _arm_front(body, "left", 6, 0)
    _head_front(body, look["style"], 0)
    bx = (HAT_W - 16) // 2
    oy = HAT_H - 24
    _place(f, body, bx, oy)
    # marker arm up and out toward the board on the right
    ax = bx + 13
    f.blob({(ax, oy + 9), (ax + 1, oy + 9), (ax + 1, oy + 8), (ax + 2, oy + 8),
            (ax + 2, oy + 7), (ax + 3, oy + 7), (ax + 3, oy + 6), (ax + 4, oy + 6)},
           lambda p: "s" if p[0] >= ax + 3 else "T", ring="outer")
    f.put(ax + 5, oy + 5, "X")                # the marker cap
    if side == "left":
        f.px = {(HAT_W - 1 - x, y): r for (x, y), r in f.px.items()}
    # the hat, sitting low on the head: brim at the brow
    text = "PRODUCT"
    tw = text_width(text)
    band_w = tw + 4
    x0 = (HAT_W - band_w) // 2
    x1 = x0 + band_w - 1
    brim_y = oy + 1
    band = R(x0, brim_y - 7, x1, brim_y - 1)                # the band: 7 rows
    crown = (R(x0 + 3, brim_y - 11, x1 - 3, brim_y - 11)    # a rounded dome above it
             | R(x0 + 1, brim_y - 10, x1 - 1, brim_y - 10)
             | R(x0, brim_y - 9, x1, brim_y - 8))
    brim = R(x0 - 3, brim_y, x1 + 3, brim_y + 1)
    f.blob(crown | band | brim, lambda p: "V" if p in band else "X", ring=True)
    for x in range(x0 - 3, x1 + 4):                          # the brim's underside
        f.put(x, brim_y + 1, "k" if x in (x0 - 3, x1 + 3) else "X")
    for x in range(x0 + 2, x1 - 1):                          # a glint on the dome
        if x < x0 + 6:
            f.put(x, brim_y - 9, "V")
    gx = x0 + 2
    for ch in text:
        for dy, row in enumerate(GLYPHS[ch]):
            for dx, px in enumerate(row):
                if px == "#":
                    f.put(gx + dx, brim_y - 6 + dy, "k")
        gx += len(GLYPHS[ch][0]) + 1
    return f.to_canvas(look)
