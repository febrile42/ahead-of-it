from ..dsl import Canvas
from ..iso import diamond, TILE_W, TILE_H


def build() -> Canvas:
    c = Canvas(TILE_W, TILE_H)
    diamond(c, top="floor-top", left="floor-left", right="floor-right", outline="outline")
    return c


ANCHOR = (16, 16)
