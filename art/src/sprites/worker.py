"""Worker: 16x24, 4 directions x 4-frame walk cycle (brief item 4).

Only `down`, `up` and `right` are hand-built (2 unique poses each: contact + passing;
the other 2 frames of each are the same pose with the leg/arm pair swapped — a
horizontal mirror of just the leg/arm region, not a full-sprite mirror). `left` is not
authored at all: it is `right`, fully mirrored (art/src/dsl.py Canvas.mirror_h),
per style.md's "Worker walk cycle" section.
"""
from ..dsl import Canvas

W, H = 16, 24
ANCHOR = (8, 24)


def _head(c: Canvas, face: bool):
    # hair cap
    c.outlined_rect(4, 1, 11, 3, "hair-1", "outline")
    if face:
        c.outlined_rect(5, 3, 10, 7, "skin-1", "outline")
        c.rect(4, 3, 5, 5, "hair-1")  # side fringe, left
        c.rect(10, 3, 11, 5, "hair-1")  # side fringe, right
        c.point(6, 5, "outline")  # eyes
        c.point(9, 5, "outline")
    else:
        # back of head: all hair, no face
        c.outlined_rect(4, 3, 11, 7, "hair-1", "outline")


def _torso(c: Canvas, bob: int):
    y0, y1 = 8 + bob, 15 + bob
    c.outlined_rect(4, y0, 11, y1, "shirt-1", "outline")
    c.rect(10, y0, 11, y1, "shirt-1-dark")  # right-shaded half


def _arm(c: Canvas, side: str, raised: bool, bob: int):
    y0 = (7 if raised else 9) + bob
    y1 = y0 + 5
    if side == "left":
        c.outlined_rect(2, y0, 3, y1, "shirt-1", "outline")
    else:
        c.outlined_rect(12, y0, 13, y1, "shirt-1-dark", "outline")


def _legs_front(c: Canvas, spread: int):
    # spread=0: together (contact); spread!=0: apart, sign gives which leg leads
    lx0, lx1 = 5 - max(spread, 0), 7 - max(spread, 0)
    rx0, rx1 = 8 + max(-spread, 0), 10 + max(-spread, 0)
    c.outlined_rect(lx0, 16, lx1, 21, "pants-1", "outline")
    c.outlined_rect(rx0, 16, rx1, 21, "pants-1", "outline")
    c.rect(lx0 - 1, 22, lx1 + 1, 23, "outline")
    c.rect(rx0 - 1, 22, rx1 + 1, 23, "outline")


def _front_back(face: bool, phase: int) -> Canvas:
    c = Canvas(W, H)
    bob = 1 if phase in (1, 3) else 0
    spread = {0: 0, 1: 2, 2: 0, 3: -2}[phase]
    raised_left = phase in (1,)
    raised_right = phase in (3,)
    _legs_front(c, spread)
    _arm(c, "left", raised_left, bob)
    _arm(c, "right", raised_right, bob)
    _torso(c, bob)
    _head(c, face)
    return c


def _side(phase: int) -> Canvas:
    """Right-facing profile. Head + torso stay put; the visible leg and arm swing
    fore/aft. Mirrored wholesale by build_all() to make `left`."""
    c = Canvas(W, H)
    bob = 1 if phase in (1, 3) else 0
    lead = {0: 0, 1: 2, 2: 0, 3: -2}[phase]  # +: forward leg leads, -: trailing leg leads

    # back leg (near-side, drawn first so front leg overlaps it correctly)
    bx0 = 7 - max(-lead, 0)
    c.outlined_rect(bx0, 16, bx0 + 2, 21, "pants-1", "outline")
    c.rect(bx0 - 1, 22, bx0 + 3, 23, "outline")

    # torso (side view, narrower)
    c.outlined_rect(6, 8 + bob, 11, 15 + bob, "shirt-1", "outline")
    c.rect(6, 8 + bob, 7, 15 + bob, "shirt-1-dark")

    # trailing arm, swings opposite the front leg
    ax0 = 10 + max(-lead, 0)
    c.outlined_rect(ax0, 9 + bob, ax0 + 1, 14 + bob, "shirt-1-dark", "outline")

    # head, profile — hair on top/back, face patch toward the front (right)
    c.outlined_rect(6, 1, 12, 7, "hair-1", "outline")
    c.rect(9, 3, 12, 6, "skin-1")
    c.point(11, 4, "outline")

    # front leg (far-side from body centre, walks in front of the torso)
    fx0 = 7 + max(lead, 0)
    c.outlined_rect(fx0, 16, fx0 + 2, 21, "pants-1", "outline")
    c.rect(fx0 - 1, 22, fx0 + 3, 23, "outline")

    return c


def build_all() -> dict:
    """Returns {direction: [frame0..frame3]} for all 4 directions."""
    down = [_front_back(True, p) for p in range(4)]
    up = [_front_back(False, p) for p in range(4)]
    right = [_side(p) for p in range(4)]
    left = [f.mirror_h() for f in right]
    return {"down": down, "up": up, "left": left, "right": right}
