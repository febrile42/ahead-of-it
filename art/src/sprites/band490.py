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
from ..vox import Iso, Sprite, make, make_anim
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


def _desk_bare(iso: Iso, c: Canvas, laptop=False):
    d = desk_mod.DESK
    cal = _panel(iso)
    iso.floor_shadow(d["c0"], d["r0"] + 0.6, d["c1"], d["r1"], grow=1.0, grow_r=0.5)
    ch, b = desk_mod.CHAIR, desk_mod.BACKREST
    iso.floor_shadow(ch["c0"] + 0.5, ch["r0"] + 0.5, ch["c1"] - 0.5, b["r1"] - 0.4,
                     grow=1.0, grow_r=0.3)
    desk_mod._desk(iso)
    top = d["top"] + d["slab"]
    if laptop:
        # the laptop, open, screen toward the chair; a badge on its lanyard; a coffee
        iso.box(3.4, 1.6, top, 6.8, 3.6, top + 0.6, top="chair-mid", left="badge-body",
                right="chair-dark")
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


COAT_LOOK = dict(t="shirt-3-dark", T="hair-1", p="pants-1", s="skin-2", h="hair-1",
                 style="short")


def coat_frame() -> Canvas:
    """Seated from behind at the bare desk with the coat still on: a maroon coat, the
    collar turned up, a yellow knitted hat with a bobble (dressed for outside), a bag
    on the floor by the chair."""
    LOOKS["_coat"] = COAT_LOOK            # a look for this pose only (not in LOOK_NAMES)

    def hook(body):
        # seated_frame shifts the body by (1, 10): the head spans rows 11..17
        for x in range(5, 12):             # the turned-up collar, around the nape
            body.put(x + 1, 8 + 10, "T")
        body.put(5 + 1, 7 + 10, "T")
        body.put(10 + 1, 7 + 10, "T")
        # a knitted winter hat, pulled down, a bobble on top: dressed to go outside
        body.blob(R(4 + 1, 1 + 10, 11 + 1, 3 + 10), lambda p: "Y" if p[1] != 12 else "b",
                  ring=True)
        body.blob(R(7 + 1, -1 + 10, 8 + 1, 0 + 10), "Y", ring=True)
    LOOKS["_coat"] = dict(COAT_LOOK, b="desk-wood")
    c = seated_frame("_coat", arm=hook)
    del LOOKS["_coat"]
    # the bag at the chair's foot
    iso = Iso(c)
    iso.box(4.6, 6.2, 0, 6.6, 7.6, 3.0, top="hair-1", left="desk-wood-dark",
            right="hair-1")
    return c


BALLOON_W, BALLOON_H = 56, 44
BALLOON_ANCHOR = (8, 44)


def balloon_frames() -> list[Canvas]:
    """A red balloon tied to the desk's corner (the anchor), the string rising to it, a
    `WELCOME!` tag hung on the string. Frame 0 sagging (smaller, lower, a crease),
    frame 1 sunk further, the tag nearly on the desk."""
    text = "WELCOME!"
    tw = glyphs.text_width(text)
    out = []
    for i in range(2):
        c = Canvas(BALLOON_W, BALLOON_H)
        drop = 6 if i == 0 else 13
        bx, by = 21, 4 + drop                     # balloon centre
        rw, rh = (5, 6) if i == 0 else (4, 4)
        pts = set()
        for y in range(by - rh, by + rh + 1):
            for x in range(bx - rw, bx + rw + 1):
                if ((x - bx) / (rw + 0.3)) ** 2 + ((y - by) / (rh + 0.3)) ** 2 <= 1.0:
                    pts.add((x, y))
        for (x, y) in pts:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if (x + dx, y + dy) not in pts:
                    c.point(x + dx, y + dy, "outline")
        for (x, y) in pts:
            c.point(x, y, "badge-red")
        c.point(bx - rw + 2, by - rh + 2, "paper")                 # the shine
        c.point(bx - rw + 2, by - rh + 3, "paper")
        c.point(bx + 1, by + 1, "shirt-3-dark")                    # a crease: going soft
        c.point(bx + 2, by, "shirt-3-dark")
        if i == 1:
            c.point(bx - 1, by + 2, "shirt-3-dark")
        c.point(bx, by + rh + 1, "shirt-3-dark")                   # the knot
        # the string, from the knot down to the desk corner at the anchor, slack
        sx0, sy0 = bx, by + rh + 2
        sx1, sy1 = BALLOON_ANCHOR[0], BALLOON_H - 1
        n = max(1, sy1 - sy0)
        for k in range(n + 1):
            t = k / n
            x = round(sx0 + (sx1 - sx0) * t + (2 if 0.3 < t < 0.7 else 0))
            c.point(x, sy0 + k, "outline")
        # the tag, hung from the string just under the balloon
        ty = sy0 + 3
        tx = max(0, min(BALLOON_W - tw - 4, bx - 6))
        c.rect(tx, ty, tx + tw + 3, ty + 8, "outline")
        c.rect(tx + 1, ty + 1, tx + tw + 2, ty + 7, "paper")
        glyphs.draw(c, text, tx + 2, ty + 2, "badge-red")
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


def _door_badge(iso: Iso, c: Canvas, green: bool):
    _jambs_and_frame(iso)
    _door_leaf_closed(iso)
    # the reader on the outside of the frame's back post, big enough to read: a dark
    # box, a lit panel (red: no; green: yes). The tapper stands beside it, not in
    # front of the door, so the shut door stays in view.
    x, y = iso.right_px(8 + PART_T, 1.2, 15.0)
    c.rect(x - 1, y - 3, x + 3, y + 4, "outline")
    c.rect(x, y - 2, x + 2, y + 3, "chair-dark")
    col = "badge-green" if green else "badge-red"
    c.rect(x, y - 2, x + 2, y - 1, col)
    c.point(x + 1, y + 1, "badge-body")
    return {"reader": (x + 1, y)}


def _door_propped(iso: Iso, c: Canvas, propped: bool):
    _jambs_and_frame(iso)
    if not propped:
        _door_leaf_closed(iso)
        return
    # the leaf swung out into the street from its hinge on the back post, and an office
    # chair wedged against it on the pavement, holding it open: through the doorway
    # you see the office floor
    iso.box(8.6, 1.1, 0, 15.0, 1.7, DOOR_H + 0.8, top="desk-wood", left="desk-wood",
            right="desk-wood-dark")
    _chair_at(iso, 8.4, -2.4, back=True)


def camera_dome() -> Canvas:
    rows = [
        ".ooooo.",
        "oBBBBBo",
        "oBoooBo",
        ".oKKKo.",
        "..ooo..",
    ]
    c = Canvas(7, 5)
    _rows(c, rows, 0, 0, {"o": "outline", "B": "badge-body", "K": "chair-dark"})
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
        "camera-dome": Sprite(dome, (3, 0)),
        "chair-back": make(lambda iso, c: _chair_at(iso, 0.0, back=True)),
    }
