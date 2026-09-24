"""Worker poses added in PH1-07, built from the same blobs and roles as worker.py so
every look is a palette swap. Each pose is one manifest entry keyed by look (like
`worker-seated`); animated ones carry their frames under that key.

  worker-peel      G1.2 (band 80): standing at a colleague's desk, peeling the password
                   sticky note off their monitor. Desk canvas + anchor: paste over
                   `desk-postit` at the same point. Frame 1 erases the note from the
                   screen (it is in the worker's hand now).
"""
from __future__ import annotations

from ..dsl import Canvas
from . import desk as desk_mod
from .worker import (Fig, LOOKS, R, _shadow, _leg_side, _torso_side, _head_side,
                     _arm_side)

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
