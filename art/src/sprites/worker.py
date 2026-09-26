"""Worker: 16x24 chibi, 4 directions x 4-frame walk, plus idle / step / queue / seated
poses and five looks (PH1-06 redraw).

Built from *blobs*: each body part is a set of fill pixels that gets its own 1 px
outline ring, drawn back to front, so a part in front (an arm, the head) draws a clean
dark seam where it overlaps a part behind. Colours are *roles* (`t` shirt, `s` skin …)
resolved per look at the end, which is what makes palette-swapped outfits free.

Walk cycle (all three authored views use the same four beats):
  0 contact  — one foot forward, the other back; body lowest (bob 1); arms opposite
  1 passing  — the back foot lifted 2 px as it swings through; body highest
  2 contact  — mirrored
  3 passing  — mirrored
`left` is still `right` mirrored wholesale (style.md "Worker walk cycle").

Shadow: every standing frame carries its own ground-contact shadow (style.md
"Shadows"): a flat `shadow` ellipse under the feet, offset 1 px right (light from the
top-left), drawn first so the feet sit on it. A lifted foot shows daylight above it.
"""
from __future__ import annotations

from ..dsl import Canvas
from ..vox import Iso, SwapIso
from . import desk as desk_mod

W, H = 16, 24
ANCHOR = (8, 24)

QUEUE_W, QUEUE_H = 16, 32
QUEUE_ANCHOR = (8, 32)

# role -> palette name for everything that doesn't vary by look
FIXED = {
    "o": "outline", "e": "outline", "k": "outline", "w": "shadow",
    "L": "monitor-frame", "l": "chair-mid", "G": "monitor-screen", "X": "badge-red",
    "V": "paper", "Y": "sticky", "g": "wall-shadow", "n": "net",
    "b": "desk-wood",
}

LOOKS = {
    # name: shirt, shirt shade, trousers, skin, hair, hairstyle
    "a": dict(t="shirt-1", T="shirt-1-dark", p="pants-1", s="skin-1", h="hair-1", style="short"),
    "b": dict(t="badge-green", T="shirt-2-dark", p="desk-wood-dark", s="skin-2", h="outline", style="short"),
    "c": dict(t="badge-red", T="shirt-3-dark", p="pants-1", s="skin-3", h="hair-1", style="long"),
    "d": dict(t="paper", T="wall-shadow", p="shirt-1-dark", s="skin-1", h="desk-wood", style="long"),
    "e": dict(t="badge-green", T="shirt-2-dark", p="pants-1", s="skin-3", h="outline", style="long"),
}
LOOK_NAMES = list(LOOKS)

N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))


def R(x0, y0, x1, y1):
    return {(x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)}


class Fig:
    def __init__(self, w=W, h=H):
        self.w, self.h = w, h
        self.px: dict = {}

    def put(self, x, y, role):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[(x, y)] = role

    def blob(self, pts, role, ring=True):
        """ring=True: full outline ring (cuts a seam into whatever is behind);
        ring="outer": outline only onto empty pixels (silhouette, no seam);
        ring=False: no outline."""
        pts = set(pts)
        if ring:
            for (x, y) in pts:
                for dx, dy in N4:
                    q = (x + dx, y + dy)
                    if q in pts:
                        continue
                    if ring == "outer" and self.px.get(q, "o") != "o":
                        continue
                    self.put(q[0], q[1], "o")
        for p in pts:
            self.put(p[0], p[1], role(p) if callable(role) else role)

    def shift(self, dx, dy):
        self.px = {(x + dx, y + dy): r for (x, y), r in self.px.items()}

    def to_canvas(self, look: dict) -> Canvas:
        c = Canvas(self.w, self.h)
        for (x, y), role in sorted(self.px.items()):
            name = FIXED.get(role) or look[role]
            c.point(x, y, name)
        return c


# -- shared parts -------------------------------------------------------------

def _shadow(f: Fig, cx=9, y=22):
    f.blob(R(cx - 5, y, cx + 5, y) | R(cx - 4, y + 1, cx + 4, y + 1) | R(cx - 3, y - 1, cx + 3, y - 1),
           "w", ring=False)


def _head_front(f: Fig, style: str, b: int):
    pts = R(5, 1, 10, 1) | R(4, 2, 11, 6) | R(5, 7, 10, 7)
    if style == "long":
        pts |= R(3, 4, 4, 10) | R(11, 4, 12, 10)

    def role(p):
        x, y = p
        if y <= 3 or x <= 4 or x >= 11:
            return "h"
        if y == 4 and x in (5, 10):
            return "h"
        if y == 5 and x in (6, 9):
            return "e"
        return "s"
    f.blob({(x, y + b) for x, y in pts}, lambda p: role((p[0], p[1] - b)))


def _head_back(f: Fig, style: str, b: int):
    pts = R(5, 1, 10, 1) | R(4, 2, 11, 6) | R(5, 7, 10, 7)
    if style == "long":
        pts |= R(4, 7, 11, 10)

    def role(p):
        x, y = p
        if style == "short" and y == 7 and 6 <= x <= 9:
            return "s"  # nape
        return "h"
    f.blob({(x, y + b) for x, y in pts}, lambda p: role((p[0], p[1] - b)))


def _head_side(f: Fig, style: str, b: int):
    """Profile facing right."""
    pts = R(5, 1, 9, 1) | R(4, 2, 10, 6) | R(5, 7, 9, 7) | {(11, 5)}
    if style == "long":
        pts |= R(3, 4, 5, 10)

    def role(p):
        x, y = p
        if y <= 3:
            return "h"
        if x <= 6 - (1 if y >= 6 else 0) and not (y == 7 and x >= 6):
            return "h"
        if (x, y) == (9, 4) or (x, y) == (8, 4):
            return "h"  # fringe
        if (x, y) == (9, 5):
            return "e"
        return "s"
    f.blob({(x, y + b) for x, y in pts}, lambda p: role((p[0], p[1] - b)))


def _torso_front(f: Fig, b: int):
    pts = R(4, 9 + b, 11, 15 + b)

    def role(p):
        x, y = p
        if y == 15 + b:
            return "p"
        if (x in (6, 7, 8, 9)) and y == 9 + b:
            return "s" if x in (7, 8) else "t"  # open collar
        return "T" if x >= 10 else "t"
    f.blob(pts, role)


def _arm_front(f: Fig, side: str, length: int, b: int, hand=True):
    """length: rows of arm below the shoulder (neutral 6; forward 7; back 4)."""
    x0 = 1 if side == "left" else 13
    y0, y1 = 9 + b, 9 + b + length - 1
    shade = "t" if side == "left" else "T"

    def role(p):
        return "s" if (hand and p[1] == y1) else shade
    f.blob(R(x0, y0, x0 + 1, y1), role)


def _leg_front(f: Fig, side: str, lift: int, b: int):
    x0 = 4 if side == "left" else 9
    top = 16 + b
    foot = 22 - lift
    pts = R(x0, top, x0 + 2, foot)
    f.blob(pts, lambda p: "k" if p[1] == foot else "p")


def _front(view: str, look: dict, lift_l: int, lift_r: int, arm_l: int, arm_r: int,
           b: int) -> Fig:
    f = Fig()
    _shadow(f)
    _leg_front(f, "left", lift_l, b)
    _leg_front(f, "right", lift_r, b)
    _torso_front(f, b)
    if view == "down":
        _arm_front(f, "left", arm_l, b)
        _arm_front(f, "right", arm_r, b)
        _head_front(f, look["style"], b)
    else:
        # from behind, the arm that swings *back* is the one nearer the viewer
        _arm_front(f, "left", arm_l, b)
        _arm_front(f, "right", arm_r, b)
        _head_back(f, look["style"], b)
    return f


# side view ---------------------------------------------------------------

ARM_SIDE = {
    0: [(9, 7), (10, 7), (11, 7), (12, 7), (13, 7), (14, 7)],
    1: [(9, 7), (10, 7), (11, 8), (12, 8), (13, 9), (14, 9)],     # forward
    -1: [(9, 7), (10, 7), (11, 6), (12, 6), (13, 5), (14, 5)],    # back
}

LEG_SIDE = {
    # (rows 17.. as x of the leg's left pixel), then the foot row's x
    "stand": ([7, 7, 7, 7, 7], 22),
    "fwd": ([7, 7, 8, 8, 9], 22),
    "back": ([7, 7, 6, 6, 5], 22),
    "lift": ([7, 8, 8], 20),
    "knee": ([8, 9, 10, 11], 21),   # step-over: thigh up, shin forward
}


def _arm_side(f: Fig, swing: int, b: int, role="T", dy=0, ring="outer"):
    pts = set()
    for y, x in ARM_SIDE[swing]:
        pts |= {(x, y + b + dy), (x + 1, y + b + dy)}
    last = max(y for y, _ in ARM_SIDE[swing]) + b + dy
    f.blob(pts, lambda p: "s" if p[1] == last else role, ring=ring)


def _leg_side(f: Fig, kind: str, b: int, role="p"):
    xs, foot = LEG_SIDE[kind]
    pts = set()
    top = 16 + b
    for i, x in enumerate(xs):
        pts |= {(x, 17 + i), (x + 1, 17 + i)}
    pts |= {(xs[0], top), (xs[0] + 1, top)}
    fx = xs[-1]
    pts |= {(fx, foot), (fx + 1, foot), (fx + 2, foot)}
    f.blob(pts, lambda p: "k" if p[1] == foot else role)


def _torso_side(f: Fig, b: int):
    pts = R(5, 9 + b, 10, 15 + b)
    f.blob(pts, lambda p: "p" if p[1] == 15 + b else ("T" if p[0] >= 10 else "t"))


def _side(look: dict, near: str, far: str, near_arm: int, b: int) -> Fig:
    f = Fig()
    _shadow(f, cx=9)
    _arm_side(f, -near_arm if near_arm else 0, b, role="T", ring=True)  # far arm, behind
    _leg_side(f, far, b, role="T" if False else "p")
    _torso_side(f, b)
    _leg_side(f, near, b)
    _head_side(f, look["style"], b)
    _arm_side(f, near_arm, b)
    return f


# -- public builders ----------------------------------------------------------

FRONT_BEATS = [  # lift_l, lift_r, arm_l, arm_r, bob
    (0, 1, 4, 7, 1),   # contact: left foot planted forward, right heel up; right arm forward
    (0, 2, 6, 6, 0),   # passing: right foot swings through
    (1, 0, 7, 4, 1),   # contact, mirrored
    (2, 0, 6, 6, 0),   # passing, mirrored
]
SIDE_BEATS = [  # near leg, far leg, near arm swing, bob
    ("fwd", "back", -1, 1),
    ("stand", "lift", 0, 0),
    ("back", "fwd", 1, 1),
    ("lift", "stand", 0, 0),
]


def walk_frames(look_name: str = "a") -> dict:
    look = LOOKS[look_name]
    down = [_front("down", look, *beat).to_canvas(look) for beat in FRONT_BEATS]
    up = [_front("up", look, *beat).to_canvas(look) for beat in FRONT_BEATS]
    right = [_side(look, *beat).to_canvas(look) for beat in SIDE_BEATS]
    left = [f.mirror_h() for f in right]
    return {"down": down, "up": up, "left": left, "right": right}


def idle_frames(look_name: str = "a") -> dict:
    look = LOOKS[look_name]
    down = _front("down", look, 0, 0, 6, 6, 0).to_canvas(look)
    up = _front("up", look, 0, 0, 6, 6, 0).to_canvas(look)
    right = _side(look, "stand", "stand", 0, 0).to_canvas(look)
    return {"idle-down": [down], "idle-up": [up], "idle-right": [right],
            "idle-left": [right.mirror_h()]}


def step_frames(look_name: str = "a") -> dict:
    """Stepping over something on the floor (G2.2's taped cable): near knee high,
    arms out for balance."""
    look = LOOKS[look_name]
    f = Fig()
    _shadow(f, cx=9)
    _arm_side(f, 1, 0, role="T", ring=True)
    _leg_side(f, "back", 0)
    _torso_side(f, 0)
    _leg_side(f, "knee", 0)
    _head_side(f, look["style"], 0)
    _arm_side(f, -1, 0)
    right = f.to_canvas(look)
    return {"step-right": [right], "step-left": [right.mirror_h()]}


def shuffle_frames(look_name: str = "a") -> dict:
    """PH2-01: standing in a queue, shifting weight: the near foot eases forward with a
    1 px dip, then the far heel lifts. Played between long `idle-*` holds (G2.1)."""
    look = LOOKS[look_name]
    a = _side(look, "fwd", "stand", 0, 1).to_canvas(look)
    b = _side(look, "stand", "lift", 0, 0).to_canvas(look)
    return {"shuffle-a-right": [a], "shuffle-b-right": [b],
            "shuffle-a-left": [a.mirror_h()], "shuffle-b-left": [b.mirror_h()]}


def build_all() -> dict:
    """The spike's contract: {direction: [frame0..frame3]} for the default look."""
    return walk_frames("a")


def look_frames(look_name: str) -> dict:
    frames = dict(walk_frames(look_name))
    frames.update(idle_frames(look_name))
    frames.update(step_frames(look_name))
    frames.update(shuffle_frames(look_name))
    return frames


# -- queue: a laptop held overhead like a broken appliance ---------------------

def queue_frame(look_name: str, facing: str = "left") -> Canvas:
    """Standing in line, a dead laptop raised over the head, a wisp of smoke off it.
    Authored facing right, mirrored for left. 16x32, anchor (8, 32)."""
    look = LOOKS[look_name]
    f = Fig(QUEUE_W, QUEUE_H)
    body = Fig()
    _shadow(body, cx=9)
    # far arm up behind the head
    body.blob(R(5, 1, 6, 9), lambda p: "s" if p[1] <= 1 else "T")
    _leg_side(body, "back", 0)
    _torso_side(body, 0)
    _leg_side(body, "stand", 0)
    _head_side(body, look["style"], 0)
    # near arm up past the nose, elbow slightly out
    body.blob(R(11, 1, 12, 7) | R(10, 8, 11, 10), lambda p: "s" if p[1] <= 1 else "t",
              ring="outer")
    body.shift(0, 8)
    f.px.update({k: v for k, v in body.px.items() if 0 <= k[1] < QUEUE_H})
    # the laptop: open, screen toward the viewer, a red X where the desktop should be
    f.blob(R(3, 1, 13, 6), lambda p: "G" if 4 <= p[0] <= 12 and 2 <= p[1] <= 5 else "L")
    for (x, y) in ((7, 2), (8, 3), (9, 4), (10, 5), (10, 2), (9, 3), (8, 4), (7, 5)):
        f.put(x, y, "X")
    f.blob(R(2, 7, 14, 8), lambda p: "l" if p[1] == 7 else "L")
    # smoke
    for (x, y) in ((14, 0), (15, 1), (1, 0), (0, 1)):
        f.put(x, y, "g")
    c = f.to_canvas(look)
    return c.mirror_h() if facing == "left" else c


# -- seated at a desk -----------------------------------------------------------

def seated_frame(look_name: str, turned: bool = False, arm=None, beat=None) -> Canvas:
    """A worker in the desk group's chair, seen from behind, hands on the desk.
    Same 32x40 canvas and anchor as `desk`: paste it at the same point, over any desk
    variant. The chair's backrest is redrawn over the worker's lower back.

    `beat` (PH2-01 typing, style.md "Motion"): "l" / "r" drops that upper arm a pixel
    (a key pressed), "n" dips the head a pixel (a glance at the keyboard). None is the
    rest pose, unchanged."""
    look = LOOKS[look_name]
    f = Fig(desk_mod.W, desk_mod.H)
    body = Fig()
    _torso_front(body, 0)
    # arms reach forward onto the desk: from behind, only the upper arms show,
    # angled in toward the keyboard
    body.blob(R(2, 10, 3, 14) if beat == "l" else R(2, 9, 3, 13), "t")
    body.blob(R(12, 10, 13, 14) if beat == "r" else R(12, 9, 13, 13), "T")
    _head_back(body, look["style"], 1 if beat == "n" else 0)
    # place hips on the seat: chair centre (c 2.5, r 6) -> screen x 9; seat top y ~28.
    # A turned desk (PH1-07) has its chair at (c 6, r 2.5): x 23, same height; the back
    # view is symmetric, so the same body just moves across.
    body.shift(9 - 8 + (14 if turned else 0), 28 - 15 - 3)
    if arm is not None:
        # the hook draws in desk-canvas pixels, so an arm may reach past the 16 px body
        # (PH1-10: it was silently clipped at x = 16)
        body.w, body.h = desk_mod.W, desk_mod.H
        arm(body)  # a pose hook: add a raised arm etc. in the shifted body's pixels
    f.px.update({k: v for k, v in body.px.items() if 0 <= k[0] < f.w and 0 <= k[1] < f.h})
    c = f.to_canvas(look)
    desk_mod.backrest(SwapIso(c) if turned else Iso(c))
    return c


# -- the visitor on the lobby sofa (G2.3) -----------------------------------------

VISITOR_W, VISITOR_H = 16, 24
VISITOR_ANCHOR = (8, 24)
VISITOR_NET = (13, 16)  # top-right corner of the laptop lid, clear of the sticker


# The visitor dresses differently from the staff (a dark jacket), so the sticker's white
# and red read against it. Not in LOOKS: nobody else wears it.
VISITOR_LOOK = dict(t="pants-1", T="chair-dark", p="pants-1", s="skin-1", h="desk-wood",
                    style="long")


def visitor_sticker(f: Fig, x0: int, y0: int):
    """A name-tag sticker that reads at 1x (PH1-07): red band on top, `VIS` in the 3x5
    glyphs on white. 11 x 7 px — deliberately oversized for the chest, the way a comic
    draws the one thing it needs you to read."""
    from ..glyphs import GLYPHS
    for x in range(x0, x0 + 11):
        f.put(x, y0, "X")
        for y in range(y0 + 1, y0 + 7):
            f.put(x, y, "V")
    gx = x0 + 1
    for ch in "VIS":
        rows = GLYPHS[ch]
        for dy, row in enumerate(rows):
            for dx, px in enumerate(row):
                if px == "#":
                    f.put(gx + dx, y0 + 1 + dy, "k")
        gx += len(rows[0]) + 1


def visitor_frame(look_name: str | None = None) -> Canvas:
    """Seated on the sofa, facing the viewer, laptop open on the lap (we see the lid,
    its screen glowing onto the visitor) and a `VIS` name-tag sticker on the chest.
    Anchor = the front edge of the sofa seat under the visitor's feet."""
    look = LOOKS[look_name] if look_name else VISITOR_LOOK
    f = Fig(VISITOR_W, VISITOR_H)
    # lower legs + shoes, hanging from the seat edge
    for x0 in (4, 9):
        f.blob(R(x0, 19, x0 + 2, 22), lambda p: "k" if p[1] == 22 else "p")
    _torso_front(f, 0)
    _arm_front(f, "left", 6, 0, hand=False)
    _arm_front(f, "right", 6, 0, hand=False)
    _head_front(f, look["style"], 0)
    visitor_sticker(f, 3, 9)
    # the laptop lid on the lap, back toward us, screen light spilling round its top
    f.blob(R(3, 17, 12, 19), "l")
    for x in range(4, 12):
        f.put(x, 16, "G")
    f.put(7, 18, "V")  # the lid logo
    f.put(8, 18, "V")
    # hands on the keys either side of the lid
    f.blob(R(1, 16, 1, 17), "s")
    f.blob(R(14, 16, 14, 17), "s")
    return f.to_canvas(look)
