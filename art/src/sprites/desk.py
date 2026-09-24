from ..dsl import Canvas
from ..iso import iso_box

W, H = 32, 32
ANCHOR = (16, H)


def build() -> Canvas:
    c = Canvas(W, H)

    _chair(c)
    _desk(c)
    _monitor(c)
    return c


DESK_CX, DESK_BY, DESK_HW, DESK_HH, DESK_HEIGHT = 19, 29, 8, 4, 8


def _desk(c: Canvas):
    iso_box(
        c, cx=DESK_CX, by=DESK_BY, hw=DESK_HW, hh=DESK_HH, height=DESK_HEIGHT,
        top="desk-wood", left="desk-wood", right="desk-wood-dark", outline="outline",
    )


def _monitor(c: Canvas):
    # stands right at the desk's back corner, on top of the desk surface
    back_y = DESK_BY - 2 * DESK_HH - DESK_HEIGHT
    iso_box(
        c, cx=DESK_CX, by=back_y, hw=2, hh=1, height=6,
        top="monitor-frame", left="monitor-screen", right="monitor-frame",
        outline="outline",
    )


def _chair(c: Canvas):
    # a small stool-like chair, clear of the desk's footprint, drawn first (behind)
    iso_box(
        c, cx=6, by=29, hw=4, hh=2, height=9,
        top="chair-mid", left="chair-mid", right="chair-dark", outline="outline",
    )
