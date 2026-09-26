"""Band 750 props (PH1-12), both states. `docs/content/BANDS-AND-GAGS.md` §750.

Ground floor
  G6.1  balloon-head     one balloon on a string, a logo on it, over somebody's head.
                         One frame per brand (`blue-plus`, `green-tri` …), each its own
                         colour
        balloon-twins    the two that are *almost* the same: two red balloons touching,
                         one wedge mirrored, strings down to two neighbouring pit desks
        balloons-ceiling without: the ones that got away, bunched against the ceiling
                         (`drift`, 2 frames)
        portfolio-board  built: a small PORTFOLIO board on the wall, the handful of
                         shared balloons tethered to it
  G7.1  robot            a cheerful robot, whole: antenna, screen head, broad chest, arms,
                         legs. `eat` (without: UNVETTED on its chest badge, a stamped
                         paper stack at its mouth, a hand up for the card, 2 frames) /
                         `approved` (built: APPROVED on the same badge, a policy page
                         hung under it, arms at its sides)
        worker-card      profile, arm out: the company card up into the robot's hand
                         (`<look>-card`, without) / a sheet into the gate (`<look>-doc`)
        doc-gate         built: the small gate the papers pass through first
"""
from __future__ import annotations

from ..dsl import Canvas
from ..vox import Iso, Sprite, make
from .. import glyphs
from .band80 import _rows
from .band610 import _union, _per_look
from .worker import Fig, LOOKS, R, _shadow, _leg_side, _torso_side, _head_side, _arm_side
from .poses import _place, _standing_right


# -- G6.1: SaaS balloons --------------------------------------------------------------------

# (fill, shade, logo) per brand. Logos are marks in `paper`: nobody's real logo (D-014),
# just enough that every balloon is a *different* product, each in its own colour.
# DIA-74: the one exception is the pair that says "twice". `red-wedge` / `red-wedge2` are
# the only red balloons in the building, same body, the same solid 5 x 5 wedge, one of
# them mirrored: at 390px the eye finds the only matching colours in the room, then the flip.
# (The first cut was two blues one 3 x 3 pixel apart, over the back row, beside a cyan;
# the picture review couldn't find them.)
BRANDS = {
    "red-wedge": ("badge-red", "shirt-3-dark",
                  ["#....", "###..", "#####", "###..", "#...."]),
    "red-wedge2": ("badge-red", "shirt-3-dark",
                   ["....#", "..###", "#####", "..###", "....#"]),
    "blue-plus": ("shirt-1", "shirt-1-dark", ["#.#", ".#.", "#.#"]),
    "green-tri": ("badge-green", "shirt-2-dark", ["...", ".#.", "###"]),
    "yellow-ring": ("sticky", "desk-wood", ["###", "#.#", "###"]),
    "orange-bar": ("desk-wood", "desk-wood-dark", ["...", "###", "..."]),
    "cyan-sq": ("glass", "glass-dark", ["##.", "##.", "..."]),
    "grey-check": ("badge-body", "chair-mid", ["..#", "#.#", ".#."]),
    "pink-dot": ("net", "shirt-3-dark", ["...", ".#.", "..."]),
    "dkgreen-x": ("shirt-2-dark", "pants-1", ["#.#", "...", "#.#"]),
    "slate-bars": ("pants-1", "outline", ["#.#", "#.#", "#.#"]),
}
BAL_W, BAL_H = 9, 20
BAL_ANCHOR = (4, 20)            # the string's end, just over the head it belongs to


def _balloon(c: Canvas, x0: int, y0: int, brand: str, string: int = 0):
    """One balloon, 9 x 10 with its knot, top-left at (x0, y0), plus `string` px of
    string down from the knot."""
    fill, shade, logo = BRANDS[brand]
    body = ["..ooooo..", ".offfffo.", "offfffffo", "offfffffo", "offfffffo",
            "offfffffo", ".offfffo.", "..offfo..", "...ooo...", "....k...."]
    for dy, row in enumerate(body):
        for dx, ch in enumerate(row):
            if ch == "o" or ch == "k":
                c.point(x0 + dx, y0 + dy, "outline")
            elif ch == "f":
                c.point(x0 + dx, y0 + dy, fill)
    for (dx, dy) in ((6, 4), (6, 5), (5, 6), (6, 3)):
        c.point(x0 + dx, y0 + dy, shade)
    big = len(logo) == 5                                 # the twins' 5 x 5 wedge
    if not big:
        c.point(x0 + 2, y0 + 2, "paper")                 # the shine (the wedge fills it)
    lx, ly = (2, 1) if big else (3, 3)
    for dy, row in enumerate(logo):
        for dx, ch in enumerate(row):
            if ch == "#":
                c.point(x0 + lx + dx, y0 + ly + dy, "paper")
    for k in range(string):
        c.point(x0 + 4 + (1 if 3 <= k % 8 < 5 else 0), y0 + 10 + k, "outline")


TWINS = ("red-wedge", "red-wedge2")


def balloon_head() -> Sprite:
    frames = {}
    for brand in BRANDS:
        if brand in TWINS:
            continue
        c = Canvas(BAL_W, BAL_H)
        _balloon(c, 0, 0, brand, string=BAL_H - 10)
        frames[brand] = ([c], 0)
    first = next(iter(frames.values()))[0][0]
    return Sprite(first, BAL_ANCHOR, anims=frames)


# The pair is one sprite, not two heads' balloons: two desks apart on the iso diagonal the
# reds read as two separate balloons, so they drift together to the same height between
# the desks and touch, each string leaning back down to its own head. Anchor: the far
# head's string end (tile (6, 4) in the layout); the near head is one pit desk on, +2
# columns = (+32, +16) px.
TWIN_HEAD = (32, 16)
TWIN_TOP = -22                     # balloon tops over the far head's string end
TWIN_X = (7, 16)                   # the two balloons' left edges, from the far head


def twin_balloons() -> Sprite:
    ax, ay = 2, 24                                          # the far head's string end
    bx, by = ax + TWIN_HEAD[0], ay + TWIN_HEAD[1]
    c = Canvas(bx + 3, by + 1)
    for (x, head, brand, lift) in ((TWIN_X[0], (ax, ay), TWINS[0], 0),
                                   (TWIN_X[1], (bx, by), TWINS[1], 1)):
        x0, y0 = ax + x, ay + TWIN_TOP + lift
        c.diag_line(x0 + 4, y0 + 10, head[0], head[1], "outline")
        _balloon(c, x0, y0, brand, string=0)
    return Sprite(c, (ax, ay))


CEIL_W, CEIL_H = 44, 34
CEIL_ANCHOR = (22, 34)
# the ones that got away, bunched against the ceiling: (x, y, brand), back row first.
# Nine colours, none repeated and none red (DIA-74: red is the twins', and a pair in
# here would muddy the pair over the desks). The pile says "too many"; the twins say
# "twice".
CEIL = [(2, 0, "cyan-sq"), (10, 1, "orange-bar"), (18, 0, "grey-check"),
        (26, 1, "pink-dot"), (34, 0, "slate-bars"),
        (6, 6, "green-tri"), (14, 7, "blue-plus"), (22, 6, "dkgreen-x"),
        (30, 7, "yellow-ring")]


def ceiling_frames() -> list[Canvas]:
    """Nine balloons pressed up against the ceiling, strings trailing, nobody holding
    any of them. Frame 1 lets the front row sag a pixel."""
    out = []
    for i in range(2):
        c = Canvas(CEIL_W, CEIL_H)
        for (x, y, brand) in CEIL:
            front = y >= 5
            yy = y + (1 if (front and i) else 0)
            _balloon(c, x, yy, brand, string=CEIL_H - yy - 10 - (x % 7))
        out.append(c)
    return out


def portfolio_board() -> Canvas:
    """Built: a small board titled PORTFOLIO, one line per shared tool with a tick, and
    the handful of shared balloons tied to its top corner, tethered short."""
    tw = glyphs.text_width("PORTFOLIO")
    w, h = tw + 6, 24
    c = Canvas(w + 12, h + 22)
    ox, oy = 0, 22
    c.rect(ox, oy, ox + w - 1, oy + h - 1, "outline")
    c.rect(ox + 1, oy + 1, ox + w - 2, oy + h - 2, "paper")
    glyphs.draw(c, "PORTFOLIO", ox + 3, oy + 2, "outline")
    for k in range(4):
        y = oy + 9 + k * 3
        for (dx, dy) in ((0, 0), (1, 1), (2, 0), (3, -1)):
            c.point(ox + 3 + dx, y + dy, "shirt-2-dark")
        for x in range(ox + 9, ox + w - 4 - (k * 3) % 7):
            c.point(x, y, "badge-body")
    # three shared balloons, tied to the board's top-right corner on short strings
    kx, ky = ox + w - 2, oy
    for (bx, by, brand) in ((w - 7, 0, "blue-plus"), (w + 2, 2, "green-tri"),
                            (w - 1, 8, "yellow-ring")):
        _balloon(c, bx, by, brand, string=0)
        x0, y0 = bx + 4, by + 10
        n = max(1, ky - y0)
        for k in range(n):
            c.point(x0 + ((kx - x0) * k) // n, y0 + k, "outline")
    return c


# -- G7.1: the unvetted robot -----------------------------------------------------------------

# DIA-3 picture review: the first robot read as "two stacked signs with a small monitor
# head" — the CONFIDENTIAL folder and the lanyard badge covered its body. Now the robot is
# a whole silhouette (antenna, screen head, a broad chest, two arms, two legs) standing
# clear of the desks, and the badge is *painted on the chest*, the one place a label that
# wide belongs to the body. The chest is sized to the wider of the two words, so UNVETTED
# and APPROVED sit in exactly the same place and read as a pair.
ROBOT_W, ROBOT_H = 60, 46
ROBOT_ANCHOR = (30, 46)
ROBOT_MS = 300
_RCX = 30
_HEAD = (4, 16)                    # head top / bottom rows
_BODY = (19, 36)                   # chest top / bottom rows
_CHEST = 19                        # chest half-width, outline included


def _stack(c: Canvas, x0: int, y0: int):
    """A small stack of papers, 11 x 9: four sheets, offset, the top one with two lines
    of type and a red boxed stamp (the shape of CONFIDENTIAL, which is too long a word to
    stay small; the panel names it)."""
    for (dx, dy) in ((3, 3), (2, 2), (1, 1), (0, 0)):
        c.rect(x0 + dx, y0 + dy, x0 + dx + 10, y0 + dy + 6, "outline")
        c.rect(x0 + dx + 1, y0 + dy + 1, x0 + dx + 9, y0 + dy + 5, "paper")
    c.rect(x0 + 2, y0 + 2, x0 + 8, y0 + 2, "badge-body")
    c.rect(x0 + 1, y0 + 3, x0 + 9, y0 + 5, "badge-red")
    c.rect(x0 + 2, y0 + 4, x0 + 8, y0 + 4, "paper")


def _robot_body(c: Canvas, light: str):
    cx, H = _RCX, ROBOT_H
    c.rect(cx - 15, H - 2, cx + 15, H - 1, "shadow")
    for lx in (cx - 11, cx + 6):                                    # legs and feet
        c.rect(lx, _BODY[1], lx + 5, H - 5, "outline")
        c.rect(lx + 1, _BODY[1] + 1, lx + 4, H - 5, "badge-body")
        c.rect(lx - 1, H - 5, lx + 6, H - 2, "outline")
        c.rect(lx, H - 4, lx + 5, H - 3, "chair-mid")
    by0, by1 = _BODY
    c.rect(cx - _CHEST, by0, cx + _CHEST, by1, "outline")              # chest
    c.rect(cx - _CHEST + 1, by0 + 1, cx + _CHEST - 1, by1 - 1, "wall")
    c.rect(cx + _CHEST - 4, by0 + 1, cx + _CHEST - 1, by1 - 1, "wall-shadow")
    for (x, y) in ((cx - _CHEST, by0), (cx + _CHEST, by0), (cx - _CHEST, by1),
                   (cx + _CHEST, by1)):
        c.img.putpixel((x, y), (0, 0, 0, 0))
    c.rect(cx - 3, _HEAD[1], cx + 3, by0, "outline")                  # neck
    c.rect(cx - 2, _HEAD[1] + 1, cx + 2, by0 - 1, "chair-mid")
    hy0, hy1 = _HEAD
    c.rect(cx - 10, hy0, cx + 10, hy1, "outline")                     # head
    c.rect(cx - 9, hy0 + 1, cx + 9, hy1 - 1, "wall")
    for (x, y) in ((cx - 10, hy0), (cx + 10, hy0), (cx - 10, hy1), (cx + 10, hy1)):
        c.img.putpixel((x, y), (0, 0, 0, 0))
    c.rect(cx - 8, hy0 + 2, cx + 8, hy1 - 2, "monitor-frame")
    c.rect(cx, 1, cx, hy0 - 1, "outline")                             # antenna
    c.rect(cx - 1, 0, cx + 1, 1, "outline")
    c.point(cx, 0, light)
    for ex in (cx - 6, cx + 3):                                       # happy eyes
        for (dx, dy) in ((0, 1), (1, 0), (2, 1)):
            c.point(ex + dx, hy0 + 4 + dy, "monitor-screen")


def _chest(c: Canvas, text: str, ink: str):
    """The chest badge: a paper plate with a coloured band, the word in the 3x5 glyphs."""
    cx, by0 = _RCX, _BODY[0]
    w = glyphs.text_width("UNVETTED") + 4
    x0 = cx - w // 2
    c.rect(x0, by0 + 3, x0 + w - 1, by0 + 12, "outline")
    c.rect(x0 + 1, by0 + 4, x0 + w - 2, by0 + 11, "paper")
    c.rect(x0 + 1, by0 + 4, x0 + w - 2, by0 + 4, ink)
    glyphs.draw(c, text, cx - glyphs.text_width(text) // 2, by0 + 6, ink)


def _arm(c: Canvas, pts: list, hand: tuple):
    """A 2 px arm along `pts` (shoulder first), ringed, and a 3 x 3 hand at the end."""
    px = set()
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for k in range(n + 1):
            x, y = x0 + round((x1 - x0) * k / n), y0 + round((y1 - y0) * k / n)
            px |= {(x, y), (x + 1, y), (x, y + 1), (x + 1, y + 1)}
    hx, hy = hand
    hpx = {(hx + a, hy + b) for a in range(3) for b in range(3)}
    allp = px | hpx
    for (x, y) in allp:
        for a in (-1, 0, 1):
            for b in (-1, 0, 1):
                if (x + a, y + b) not in allp:
                    c.point(x + a, y + b, "outline")
    for (x, y) in px:
        c.point(x, y, "badge-body")
    for (x, y) in hpx:
        c.point(x, y, "chair-mid")


def robot_frames() -> dict:
    """A friendly robot, front view, standing: antenna, a rounded screen head with two
    happy arc eyes, a broad chest, two arms, two legs.
    Without: the badge on its chest reads UNVETTED and the antenna light is red; its
    mouth is open on a sheet from a small stamped stack of papers held up in the right
    hand (frame 1 chews), and the left hand is up, open, for the company card the
    worker beside it is handing over.
    Built: the same chest badge reads APPROVED, the light is green, the mouth smiles,
    the arms are at its sides and a tiny policy page hangs under the badge.

    Cheerful on purpose: the robot is not the villain, and neither is the person who
    hands it the card (TONE.md). What's missing is the policy."""
    out = {}
    cx = _RCX
    hy0, hy1 = _HEAD
    by0, by1 = _BODY
    for key, n in (("eat", 2), ("approved", 1)):
        frames = []
        for i in range(n):
            c = Canvas(ROBOT_W, ROBOT_H)
            if key == "eat":
                _robot_body(c, "badge-red")
                _chest(c, "UNVETTED", "badge-red")
                # the left arm up and out to the side, the hand open for the card
                _arm(c, [(cx - _CHEST, by0 + 3), (cx - _CHEST - 5, by0),
                         (cx - _CHEST - 7, by0 - 4)], (cx - _CHEST - 10, by0 - 7))
                # the right arm bent up to the mouth, the stack in the hand
                _arm(c, [(cx + _CHEST - 1, by0 + 3), (cx + _CHEST + 3, by0),
                         (cx + _CHEST + 3, hy1 - 2), (cx + 14, hy1 - 4)],
                     (cx + 12, hy1 - 5))
                # the open mouth, chewing (frame 1 shuts it a pixel), and one sheet off
                # the stack going in at its corner
                c.rect(cx - 6, hy0 + 7 + i, cx + 2, hy0 + 11, "outline")
                c.rect(cx - 5, hy0 + 8 + i, cx + 1, hy0 + 10, "badge-red")
                c.rect(cx - 1, hy0 + 8, cx + 10, hy0 + 10, "outline")
                c.rect(cx, hy0 + 9, cx + 9, hy0 + 9, "paper")
                _stack(c, cx + 9, hy1 - 6)
            else:
                _robot_body(c, "badge-green")
                _chest(c, "APPROVED", "shirt-2-dark")
                for (dx, dy) in ((-3, 0), (-2, 1), (-1, 1), (0, 1), (1, 1), (2, 1), (3, 0)):
                    c.point(cx + dx, hy0 + 8 + dy, "monitor-screen")
                for side in (-1, 1):                                 # arms at its sides
                    sx = cx + side * (_CHEST + 1) - (1 if side < 0 else 0)
                    _arm(c, [(sx, by0 + 3), (sx, by1 - 5)], (sx - 1 + side, by1 - 4))
                # the policy page, hung under the badge
                c.point(cx, by0 + 13, "outline")
                c.rect(cx - 3, by0 + 14, cx + 3, by1 + 1, "outline")
                c.rect(cx - 2, by0 + 15, cx + 2, by1, "paper")
                for y in range(by0 + 16, by1, 2):
                    c.rect(cx - 1, y, cx + 1, y, "badge-body")
            frames.append(c)
        out[key] = frames
    return out


CARD_W, CARD_H = 24, 24
CARD_ANCHOR = (8, 24)


def card_frames(look_name: str) -> dict:
    """Profile, standing, the near arm out at chest height. Without: the company card
    held out between finger and thumb — a gold card with a dark stripe, drawn bigger than
    life so it reads. Built: a sheet of paper, held out to the gate."""
    look = LOOKS[look_name]
    out = {}
    for key in ("card", "doc"):
        f = Fig(CARD_W, CARD_H)
        _place(f, _standing_right(look), 0, 0)
        if key == "card":
            # reaching up and out: the card goes to the robot's free hand at head height,
            # clear of the folder it is eating
            arm = {(9, 10), (10, 10), (10, 9), (11, 9), (11, 8), (12, 8), (12, 7), (13, 7),
                   (13, 6), (14, 6), (14, 5), (15, 5)}
            hand = {(15, 4), (16, 4), (15, 3), (16, 3)}
            f.blob(arm | hand, lambda p: "s" if p in hand else "t", ring="outer")
            f.blob(R(16, 0, 21, 3), lambda p: "L" if p[1] == 1 else "Y")
        else:
            arm = {(x, y) for x in range(10, 16) for y in (11, 12)}
            hand = {(16, 11), (17, 11), (16, 12), (17, 12)}
            f.blob(arm | hand, lambda p: "s" if p in hand else "t", ring="outer")
            f.blob(R(17, 5, 21, 11), lambda p: "g" if p[1] in (7, 9) and p[0] < 21 else "V")
        cv = f.to_canvas(look)
        out[f"{look_name}-{key}"] = [cv]
        out[f"{look_name}-{key}-left"] = [cv.mirror_h()]
    return out


def _gate(iso: Iso, c: Canvas):
    """Built: the gate — a small grey box on a stand with a slot on top and a green
    light; a sheet half through it."""
    iso.floor_shadow(2.0, 2.5, 6.0, 5.5, grow=0.6, grow_r=0.3)
    iso.box(3.4, 3.4, 0, 4.6, 4.6, 6.0, top="chair-mid", left="badge-body", right="chair-dark")
    f = iso.box(2.0, 2.5, 6.0, 6.0, 5.5, 11.0, top="chair-mid", left="badge-body",
                right="chair-dark")
    iso.paint(f, "L", 5.5, lambda cc, z: "badge-green" if 4.8 <= cc < 5.6 and 8.6 <= z < 9.6 else None)
    iso.box(2.8, 3.6, 11.0, 5.2, 4.0, 15.0, top="paper", left="paper", right="wall-shadow")


# -- floor 2, G6.2: the renewal avalanche ------------------------------------------------------

def _h(*a) -> int:
    """A fixed hash for placing sheet marks: no randomness, so builds stay identical."""
    v = 2166136261
    for x in a:
        v = ((v ^ (int(x * 16) & 0xFFFF)) * 16777619) & 0xFFFFFFFF
    return v


SLOPE_MARKS = ("badge-red", "shirt-1", "badge-green", "sticky", "desk-wood", "glass-dark")


def _paper_slope(iso: Iso, c: Canvas):
    """An avalanche of paper over a desk and the person at it: a lumpy heap highest
    against the back of the desk, sliding down and out across the floor toward the
    viewer and to the right, loose sheets fanned at its foot. Every sheet carries a logo
    (a coloured mark) and a date (a dark dash). A hand with a pen comes up out of the top.
    Built as a heightfield of paper stacks so the slope is uneven, not terraced; the
    lumps come from a fixed hash, so every build is identical. Anchored on the desk's
    tile."""
    iso.floor_shadow(-2.5, -1.0, 12.0, 14.5, grow=1.2, grow_r=0.5)
    step = 1.5
    cells = []
    cc = -2.5
    while cc < 12.0:
        rr = -1.0
        while rr < 14.5:
            peak = 23.0 - 1.35 * max(0.0, rr - 1.0) - 0.9 * abs(cc - 3.5)
            z = peak + (_h(cc, rr) % 5) - 2.0
            if z > 0.6:
                cells.append((cc, rr, min(z, 24.0)))
            rr += step
        cc += step
    cells.sort(key=lambda t: (t[0] + t[1], t[0]))
    for (cc, rr, z) in cells:
        f = iso.box(cc, rr, 0, cc + step, rr + step, z, top="paper", left="paper",
                    right="wall-shadow", outline=None)

        def sides(u, zz):
            return "wall-shadow" if int(zz * 2) % 3 == 0 else None
        iso.paint(f, "L", rr + step, sides)
        iso.paint(f, "R", cc + step, lambda r_, zz: "badge-body" if int(zz * 2) % 3 == 0 else None)
        h = _h(cc, rr, 7)
        if h % 3 == 0:
            iso.paint(f, "T", z, lambda a, b_, h=h: SLOPE_MARKS[h % len(SLOPE_MARKS)]
                      if abs(a - cc - 0.6) < 0.35 and abs(b_ - rr - 0.6) < 0.35 else None)
        elif h % 3 == 1:
            iso.paint(f, "T", z, lambda a, b_: "outline"
                      if abs(b_ - rr - 0.7) < 0.2 and cc + 0.3 <= a < cc + 1.2 else None)
    allpx = set()
    for (cc, rr, z) in cells:
        allpx |= set(iso.box_faces(cc, rr, 0, cc + step, rr + step, z))
    iso.outline(allpx, "outline")
    # loose sheets fanned out at the foot of the slope
    for (cc, rr) in ((11.5, 11.0), (8.0, 15.0), (1.0, 14.8), (12.6, 6.5), (4.5, 16.0)):
        iso.box(cc, rr, 0, cc + 2.4, rr + 1.8, 0.4, top="paper", left="paper",
                right="wall-shadow")
    # the hand and the pen, up out of the slope's left flank. DIA-3 review: at the top
    # the AUTO-RENEWED card covered it; here it stands clear against the paper.
    x, y = iso.pt(1.0, 7.0, 13.0)
    for k in range(7):                                      # the forearm, a cuff at its base
        c.point(x, y - k, "outline")
        c.point(x + 1, y - k, "shirt-1" if k < 2 else "skin-1")
        c.point(x + 2, y - k, "shirt-1" if k < 2 else "skin-1")
        c.point(x + 3, y - k, "outline")
    hx, hy = x + 1, y - 8                                   # the fist
    c.rect(hx - 1, hy - 2, hx + 3, hy + 1, "outline")
    c.rect(hx, hy - 1, hx + 2, hy, "skin-1")
    for k in range(6):                                      # the pen, held up
        c.point(hx + 3 + k // 2, hy - 2 - k, "shirt-1-dark")
        c.point(hx + 4 + k // 2, hy - 2 - k, "outline")
    c.point(hx + 5, hy - 8, "outline")
    return {"top": iso.pt(7.0, 3.0, 22.0)}


def card_autorenewed() -> Canvas:
    l1, l2 = "AUTO-", "RENEWED"
    w = glyphs.text_width(l2) + 4
    c = Canvas(w, 14)
    c.rect(0, 0, w - 1, 13, "outline")
    c.rect(1, 1, w - 2, 12, "paper")
    glyphs.draw(c, l1, 2, 2, "badge-red")
    glyphs.draw(c, l2, 2, 8, "badge-red")
    return c


def _finance_panel(iso: Iso, c: Canvas):
    """A fabric cubicle panel behind a desk (band 490's), for the built state's wall
    things: the renewal calendar and the framed receipt."""
    from .band490 import PANEL
    p = PANEL
    iso.box(p["c0"], p["r0"], 0, p["c1"], p["r1"], p["top"] + 6, top="wall-trim",
            left="badge-body", right="chair-mid")
    return {"cal": iso.left_px(p["r1"], (p["c0"] + p["c1"]) / 2, 18.0)}


def renewal_calendar() -> Canvas:
    """Built: a tidy renewal calendar — twelve month boxes, a few with one green tick,
    none overflowing."""
    c = Canvas(21, 17)
    c.rect(0, 0, 20, 16, "outline")
    c.rect(1, 1, 19, 15, "paper")
    c.rect(1, 1, 19, 3, "shirt-2-dark")
    for k in range(12):
        x, y = 2 + (k % 4) * 5, 5 + (k // 4) * 4
        c.rect(x, y, x + 3, y + 2, "wall-shadow")
        if k in (1, 4, 6, 10):
            c.point(x + 1, y + 1, "shirt-2-dark")
            c.point(x + 2, y, "shirt-2-dark")
    return c


def frame_receipt() -> Canvas:
    """Built: a framed receipt, `$500,000+` over `2024` (E-07)."""
    l1, l2 = "$500,000+", "2024"
    w = glyphs.text_width(l1) + 6
    c = Canvas(w, 17)
    c.rect(0, 0, w - 1, 16, "desk-wood-dark")
    c.rect(1, 1, w - 2, 15, "desk-wood")
    c.rect(2, 2, w - 3, 14, "paper")
    glyphs.draw(c, l1, 3, 3, "shirt-2-dark")
    glyphs.draw(c, l2, (w - glyphs.text_width(l2)) // 2, 9, "outline")
    return c


# -- floor 2, G7.4: where's the procedure? ----------------------------------------------------

def card_howto(built: bool) -> Canvas:
    """The page in the asker's hand, billboarded. Without: HOW TO / DO THE / THING /
    (v3?). Built: v1 · / current."""
    lines = ["v1 \u00b7", "current"] if built else ["HOW TO", "DO THE", "THING", "(v3?)"]
    w = max(glyphs.text_width(t) for t in lines) + 4
    h = 6 * len(lines) + 2
    c = Canvas(w, h)
    c.rect(0, 0, w - 1, h - 1, "outline")
    c.rect(1, 1, w - 2, h - 2, "paper")
    for k, t in enumerate(lines):
        glyphs.draw(c, t, 2, 2 + 6 * k, "shirt-2-dark" if built else "outline")
    if not built:
        c.point(w - 3, h - 3, "badge-red")
    return c


POINT_W, POINT_H = 24, 24
POINT_ANCHOR = (8, 24)


def point_frames(look_name: str) -> dict:
    """Profile, the near arm straight out, index finger extended: that way. Plus an
    idle (`<look>-idle`, built: nothing to point at)."""
    look = LOOKS[look_name]
    out = {}
    for key in ("point", "idle"):
        f = Fig(POINT_W, POINT_H)
        _place(f, _standing_right(look), 0, 0)
        if key == "point":
            f.blob({(x, y) for x in range(10, 18) for y in (10, 11)},
                   lambda p: "s" if p[0] >= 16 else "t", ring="outer")
            f.blob({(18, 10)}, "s", ring="outer")
        else:
            _arm_side(f, 0, 0)
        cv = f.to_canvas(look)
        out[f"{look_name}-{key}-right"] = [cv]
        out[f"{look_name}-{key}"] = [cv.mirror_h()]
    return out


def _cabinet_tall(iso: Iso, c: Canvas, locked: bool):
    """A four-drawer filing cabinet against the corridor wall (its front faces +c).
    Without: a chain through every handle and a padlock on it. Built: a drawer out,
    files showing."""
    iso.floor_shadow(0.8, 1.0, 6.0, 7.0, grow=0.8, grow_r=0.3)
    f = iso.box(0.8, 1.0, 0, 6.0, 7.0, 26.0, top="wall-shadow", left="badge-body",
                right="chair-mid")

    def drawers(r, z):
        if any(abs(z - zz) < 0.35 for zz in (6.5, 13.0, 19.5)):
            return "chair-dark"
        if 3.4 <= r < 4.6 and any(zz + 3.0 <= z < zz + 3.8 for zz in (0.0, 6.5, 13.0, 19.5)):
            return "wall-trim"
        return None
    iso.paint(f, "R", 6.0, drawers)
    if locked:
        pts = [iso.right_px(6.0, 4.0, zz + 3.4) for zz in (19.5, 13.0, 6.5, 0.0)]
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            for y in range(y0, y1 + 1):
                c.point(x0 + (1 if (y // 2) % 2 else 0), y, "badge-body")
                c.point(x0 - 1 + (1 if (y // 2) % 2 else 0), y, "outline")
        x, y = iso.right_px(6.0, 4.0, 10.0)
        c.rect(x - 2, y - 1, x + 2, y + 4, "outline")
        c.rect(x - 1, y, x + 1, y + 3, "sticky")
        c.point(x, y + 2, "outline")
        c.rect(x - 1, y - 3, x + 1, y - 1, "outline")
    else:
        d = iso.box(6.0, 1.6, 13.4, 9.0, 6.4, 19.0, top="wall-shadow", left="badge-body",
                    right="chair-mid")
        for k, col in enumerate(("sticky", "paper", "sticky", "paper")):
            iso.box(6.3 + 0.6 * k, 2.0, 19.0, 6.7 + 0.6 * k, 6.0, 21.0, top=col, left=col,
                    right="wall-shadow", outline=None)


def wiki_sign(clean: bool) -> Canvas:
    """A little sign on the corridor wall pointing at the wiki: WIKI and a W screen
    icon. Without, one grey web across the top-right corner and a spider hanging off it
    (DIA-3 review: beige webs on the paper vanished at 2x, and a web on the left
    corner broke up the W); built, clean."""
    w, h = 25, 16
    c = Canvas(w, h)
    c.rect(0, 0, w - 1, h - 1, "outline")
    c.rect(1, 1, w - 2, h - 2, "paper")
    glyphs.draw(c, "WIKI", 3, 3, "shirt-1")
    c.rect(3, 10, 9, 13, "outline")
    c.rect(4, 11, 8, 12, "monitor-screen")
    if not clean:
        web = [(x, 1) for x in range(18, 24)] + [(23, y) for y in range(1, 8)]
        web += [(23 - k, 1 + k) for k in range(6)]                        # the radials
        web += [(20, 2), (21, 3), (22, 4)]                                # inner arc
        web += [(18, 2), (18, 3), (19, 4), (19, 5), (20, 6), (21, 6), (22, 7)]  # outer
        for p in web:
            c.point(*p, "badge-body")
        for y in range(7, 10):                                            # the thread
            c.point(19, y, "badge-body")
        c.rect(18, 10, 20, 11, "outline")                                 # the spider
        for x in (17, 21):
            c.point(x, 9, "outline")
            c.point(x, 12, "outline")
    else:
        for (dx, dy) in ((0, 0), (1, 1), (2, 0), (3, -1)):
            c.point(13 + dx, 12 + dy, "shirt-2-dark")
    return c


def sign_library() -> Canvas:
    tw = glyphs.text_width("LIBRARY")
    c = Canvas(tw + 4, 10)
    c.rect(0, 0, tw + 3, 8, "outline")
    c.rect(1, 1, tw + 2, 7, "shirt-1-dark")
    glyphs.draw(c, "LIBRARY", 2, 2, "paper")
    c.point(2, 9, "outline")
    c.point(tw + 1, 9, "outline")
    return c


# -- top floor, G7.2: the empty chair -----------------------------------------------------

# The one person on the site who is Josh (D-007) — here only, in the built state, in the
# meeting. No likeness is drawn or claimed: a sixth look, so he is nobody else in the
# building.
JOSH_LOOK = dict(t="shirt-1-dark", T="pants-1", p="pants-1", s="skin-1", h="hair-1",
                 style="short")


def josh_front() -> Canvas:
    """Josh at the head of the table, facing us, in the chair that is empty without him.
    No table in front of him, so he is drawn whole: the seated front body, then his lap
    and legs down to the floor."""
    LOOKS["j"] = JOSH_LOOK
    try:
        top = seated_front_frame("j")
    finally:
        del LOOKS["j"]
    c = Canvas(SEATED_FRONT_W, JOSH_H)
    c.paste(top, 0, 0)
    y0 = SEATED_FRONT_H - 3
    c.rect(3, y0, 12, y0 + 2, "outline")                  # the lap
    c.rect(4, y0, 11, y0 + 1, JOSH_LOOK["p"])
    for x0 in (4, 8):                                     # shins and shoes
        c.rect(x0 - 1, y0 + 2, x0 + 4, JOSH_H - 1, "outline")
        c.rect(x0, y0 + 2, x0 + 3, JOSH_H - 3, JOSH_LOOK["p"])
    c.point(7, y0 + 3, "outline")
    c.point(8, y0 + 3, "outline")
    return c


FAR_DC = (0.0, 8.0)                # far seats, world units along the table
NEAR_DC = (4.0, 12.0, 20.0)        # near seats, staggered, so no back hides a far seat
TABLE = dict(c0=0.3, c1=25.7, r0=-6.5, r1=4.0)
# DIA-3 picture review: the sixth chair — the empty one — stands at the head of the
# table, at the whiteboard end (the seat facing NEXT 3 YEARS is the one nobody is in),
# pulled well out from the table and turned to face us, so it reads as vacated rather
# than spare. Seat centre, world units in the table's frame:
HEAD = dict(c=33.0, r=-1.25)


def _far_chair(iso: Iso, dc: float, dr: float = 0.0):
    from .desk import CHAIR
    iso.box(CHAIR["c0"] + dc, -11.2 + dr, 0, CHAIR["c1"] + dc, -8.2 + dr, CHAIR["seat"] + 1.5,
            top="chair-mid", left="chair-dark", right="chair-dark")
    iso.box(CHAIR["c0"] + dc, -12.2 + dr, CHAIR["seat"] + 1.5, CHAIR["c1"] + dc, -11.3 + dr,
            CHAIR["seat"] + 13.0, top="chair-mid", left="chair-mid", right="chair-dark")


def _far_chairs(iso: Iso, c: Canvas):
    """The chairs on the far side of the table, facing us. The table hides their seats;
    their backs stand up tall behind whoever sits in them."""
    for dc in FAR_DC:
        _far_chair(iso, dc)


def _light_spot(iso: Iso, cc: float, rr: float, rc: float = 6.0, rw: float = 6.0):
    """A pool of light on the floor, an ellipse in world units around (cc, rr), in the
    palest warm colour: the room's spotlight on the one seat that matters."""
    pts = set()
    steps = int(max(rc, rw) * 4)
    for i in range(-steps, steps + 1):
        for j in range(-steps, steps + 1):
            dc, dr = i / 4, j / 4
            if (dc / rc) ** 2 + (dr / rw) ** 2 <= 1.0:
                pts.add(iso.pt(cc + dc, rr + dr, 0))
    for (x, y) in pts:
        iso.c.point(x, y, "wall")


def _head_chair(iso: Iso, c: Canvas, spot: bool):
    """The chair at the head of the table: a far-side chair (back to the windows, seat
    facing us) standing clear of the table's end. Without: empty, in a pool of light.
    Built: the same chair, same place, no spotlight — Josh is in it."""
    from .desk import CHAIR
    if spot:
        _light_spot(iso, HEAD["c"], HEAD["r"])
    _far_chair(iso, HEAD["c"] - (CHAIR["c0"] + CHAIR["c1"]) / 2, HEAD["r"] + 9.7)


def _boardroom_table(iso: Iso, c: Canvas):
    """The table and the three near chairs' seats (their backs come with whoever sits in
    them, as at a desk)."""
    from .desk import DESK
    from .band220 import _chair_at
    t = TABLE
    top = DESK["top"]
    iso.floor_shadow(t["c0"], t["r0"], t["c1"], t["r1"], grow=1.0, grow_r=0.5)
    for cc in (t["c0"] + 1.5, t["c1"] - 3.5):
        iso.box(cc, t["r0"] + 1.5, 0, cc + 2.0, t["r1"] - 1.5, top, top="desk-wood-dark",
                left="desk-wood-dark", right="hair-1")
    iso.box(t["c0"], t["r0"], top, t["c1"], t["r1"], top + 1.5, top="desk-wood",
            left="desk-wood-dark", right="desk-wood-dark")
    for (cc, rr) in ((5.0, 1.0), (13.0, 1.5), (21.0, 0.8), (1.5, -4.5), (17.5, -4.0)):
        iso.box(cc, rr, top + 1.5, cc + 2.2, rr + 1.6, top + 1.8, top="paper", left="paper",
                right="wall-shadow", outline=None)
    for dc in NEAR_DC:
        _chair_at(iso, dc, back=False)


SEATED_FRONT_W, SEATED_FRONT_H = 16, 18
JOSH_H = SEATED_FRONT_H + 6        # Josh at the head seat, legs and all
SEATED_FRONT_ANCHOR = (8, 18)


def seated_front_frame(look_name: str) -> Canvas:
    """Across the table, facing us: head and shoulders over the table top, forearms on
    it. The table (drawn after) hides everything below the chest."""
    from .worker import _torso_front, _head_front
    look = LOOKS[look_name]
    f = Fig(SEATED_FRONT_W, SEATED_FRONT_H)
    body = Fig()
    _torso_front(body, 0)
    body.blob(R(2, 9, 3, 14), "t")
    body.blob(R(12, 9, 13, 14), "T")
    _head_front(body, look["style"], 0)
    _place(f, body, 0, 1)
    return f.to_canvas(look)


def whiteboard_next() -> Canvas:
    """The boardroom whiteboard: NEXT 3 YEARS and a roadmap under it — three year
    columns, a line of milestones climbing across them, an arrow off the end."""
    tw = glyphs.text_width("NEXT 3 YEARS")
    w, h = tw + 6, 28
    c = Canvas(w, h)
    c.rect(0, 0, w - 1, h - 1, "outline")
    c.rect(1, 1, w - 2, h - 2, "badge-body")
    c.rect(2, 2, w - 3, h - 3, "paper")
    glyphs.draw(c, "NEXT 3 YEARS", 3, 3, "outline")
    for k in range(1, 3):
        x = 2 + k * (w - 4) // 3
        for y in range(10, h - 3, 2):
            c.point(x, y, "wall-shadow")
    pts = [(5, h - 6), (w // 3, h - 10), (2 * w // 3, h - 13), (w - 7, h - 17)]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        c.diag_line(x0, y0, x1, y1, "shirt-1")
    for (x, y) in pts:
        c.rect(x - 1, y - 1, x + 1, y + 1, "badge-red")
    x, y = pts[-1]
    for k in range(3):
        c.point(x + 2 + k, y - 1 - k // 2, "shirt-1")
    return c


NAMEPLATE_H = 12


def nameplate() -> Canvas:
    """The seat's reserved card, standing on the head chair's back on two short legs:
    TECHNOLOGY on a white plate. DIA-3 re-review: on the table it floated over the near
    row's last head and read as that person's name tag; on the chair it can only be the
    chair's. Anchor: between the legs' feet, on the chair back's top edge."""
    tw = glyphs.text_width("TECHNOLOGY")
    w = tw + 4
    c = Canvas(w, NAMEPLATE_H)
    c.rect(0, 0, tw + 3, 8, "outline")
    c.rect(1, 1, tw + 2, 7, "paper")
    glyphs.draw(c, "TECHNOLOGY", 2, 2, "outline")
    for x in (w // 2 - 3, w // 2 + 3):
        c.rect(x, 9, x, NAMEPLATE_H - 1, "outline")
    return c


# -- registry --------------------------------------------------------------------------------

def build_all() -> dict:
    rb = robot_frames()
    ceil = ceiling_frames()
    board = portfolio_board()
    return {
        "balloon-head": balloon_head(),
        "balloon-twins": twin_balloons(),
        "balloons-ceiling": Sprite(ceil[0], CEIL_ANCHOR, anims={"drift": (ceil, 800)}),
        "portfolio-board": Sprite(board, (board.w // 2 - 6, board.h)),
        "robot": Sprite(rb["eat"][0], ROBOT_ANCHOR,
                        anims={"eat": (rb["eat"], ROBOT_MS), "approved": (rb["approved"], 0)}),
        "worker-card": _per_look(card_frames, CARD_ANCHOR, 0),
        "doc-gate": make(_gate),
        # floor 2
        "paper-slope": make(_paper_slope, size=160),
        "card-autorenewed": Sprite(card_autorenewed(), (card_autorenewed().w // 2, 14)),
        "finance-panel": make(_finance_panel),
        "calendar-renewals": Sprite(renewal_calendar(), (10, 17)),
        "frame-receipt": Sprite(frame_receipt(), (frame_receipt().w // 2, 17)),
        "card-howto": _union(
            confused=Sprite(card_howto(False), (card_howto(False).w // 2, card_howto(False).h)),
            current=Sprite(card_howto(True), (card_howto(True).w // 2, card_howto(True).h))),
        "worker-point": _per_look(point_frames, POINT_ANCHOR, 0),
        "cabinet-locked": _union(locked=make(lambda iso, c: _cabinet_tall(iso, c, True)),
                                 open=make(lambda iso, c: _cabinet_tall(iso, c, False))),
        "wiki-sign": Sprite(wiki_sign(False), (12, 16),
                            anims={"cobwebs": ([wiki_sign(False)], 0),
                                   "clean": ([wiki_sign(True)], 0)}),
        "sign-library": Sprite(sign_library(), (sign_library().w // 2, 10)),
        # top floor
        "boardroom-far": make(_far_chairs, size=160),
        "boardroom-table": make(_boardroom_table, size=160),
        "boardroom-chair-head": _union(
            empty=make(lambda iso, c: _head_chair(iso, c, True), size=200),
            taken=make(lambda iso, c: _head_chair(iso, c, False), size=200)),
        "worker-seated-front": _per_look(lambda lk: {lk: [seated_front_frame(lk)]},
                                         SEATED_FRONT_ANCHOR, 0),
        "worker-seated-josh": Sprite(josh_front(), (SEATED_FRONT_W // 2, JOSH_H)),
        "whiteboard-next": Sprite(whiteboard_next(), (whiteboard_next().w // 2, 28)),
        "nameplate-tech": Sprite(nameplate(), (nameplate().w // 2, NAMEPLATE_H)),
    }
