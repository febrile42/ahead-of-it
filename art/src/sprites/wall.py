from ..dsl import Canvas
from ..iso import extrude_wall, TILE_W

FACE_H = 40
CANVAS_H = 8 + FACE_H  # cap + face
ANCHOR = (16, CANVAS_H)


def build() -> Canvas:
    c = Canvas(TILE_W, CANVAS_H)
    extrude_wall(
        c, face_h=FACE_H,
        fill="wall", shadow="wall-shadow",
        cap_top="glass-highlight", cap_left="wall", cap_right="wall-shadow",
        outline="outline", trim="wall-trim",
    )
    _window(c)
    return c


def _window(c: Canvas):
    # window sits in the lit (left) portion of the face, centred over it
    x0, y0, x1, y1 = 6, 14, 19, 29
    c.rect(x0, y0, x1, y1, "glass-dark")
    c.rect(x0, y0, x1 - 4, y1 - 4, "glass")
    c.rect(x0 + 1, y0 + 1, x0 + 3, y0 + 3, "glass-highlight")
    # frame
    c.line([(x0 - 1, y0 - 1), (x1 + 1, y0 - 1)], "wall-trim", width=1)
    c.line([(x0 - 1, y1 + 1), (x1 + 1, y1 + 1)], "wall-trim", width=1)
    c.line([(x0 - 1, y0 - 1), (x0 - 1, y1 + 1)], "wall-trim", width=1)
    c.line([(x1 + 1, y0 - 1), (x1 + 1, y1 + 1)], "wall-trim", width=1)
    # mullion cross
    midx = (x0 + x1) // 2
    midy = (y0 + y1) // 2
    c.line([(midx, y0), (midx, y1)], "wall-trim", width=1)
    c.line([(x0, midy), (x1, midy)], "wall-trim", width=1)
    # outline over the whole frame
    c.line([(x0 - 1, y0 - 1), (x1 + 1, y0 - 1)], "outline", width=1)
    c.line([(x0 - 1, y1 + 1), (x1 + 1, y1 + 1)], "outline", width=1)
    c.line([(x0 - 1, y0 - 1), (x0 - 1, y1 + 1)], "outline", width=1)
    c.line([(x1 + 1, y0 - 1), (x1 + 1, y1 + 1)], "outline", width=1)
