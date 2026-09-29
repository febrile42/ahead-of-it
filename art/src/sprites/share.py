"""PH3-02 (D-057 items 3 and 5): the share image's flag, caption and URL.

SCENE-FORMAT "Share sprites". The web draws each at its entry's `shareScale` and does no
other sizing, so the sizes the spec asks for (in 1200 x 630 image px) are met here:

- `share-flag` marks a flagged gag in a `without` room. It is drawn over any floor, wall
  or street, so it is outlined and then ringed in `paper`, which carries it off light
  and dark surfaces alike. The pennant is the badge reader's red, the failure colour, lit
  from the top-left over its own darker shade.
  The anchor is the pole's tip, one past the bottom row, like `tag-visitor`'s tail
  (style.md).
- `share-caption` letters `copy.shareCaption`, read from content.json at build time so
  it is verbatim by construction, wrapped greedily to 400 image px at its scale.
- `share-url` letters `resume.joshgister.com/?n=<n>&it=none`, one frame per stop.

All lettering is `face.py` in `outline` ink on transparency, for the light mat.
"""
from __future__ import annotations

import json
import os

from ..dsl import Canvas, from_rows
from .. import face

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)))))
CONTENT = os.path.join(_REPO_ROOT, "src", "content", "content.json")

STOPS = ("80", "150", "220", "360", "490", "610", "750", "1000")
URL = "resume.joshgister.com/?n={n}&it=none"

# the words panel is 400 image px wide (D-057 item 4)
MAX_W = 400
FLAG_SCALE = 2          # D-057 item 5
CAPTION_SCALE = 6       # cap 7 art px -> 42 image px (>= 36)
URL_SCALE = 2           # cap 7 art px -> 14 image px (>= 10)
LEAD = 2                # art px between one line's descenders and the next line's caps
INK = "outline"

FLAG_MAP = {"O": "outline", "H": "paper", "R": "badge-red", "D": "shirt-3-dark"}
# The mark, outline and fill: a 1 px pole with a pennant lit from the top-left. `halo`
# rings it in `paper` so it separates from red shirts, the red sofa and dark props alike.
FLAG_MARK = [
    "OOOO........",
    "ORRROOO.....",
    "ORRRRRROO...",
    "ORRRRRRRROO.",
    "ORRRRRRRRRRO",
    "ODDDDDDDDDDO",
    "ODDDDDDDDOO.",
    "ODDDDDDOO...",
    "ODDDOOO.....",
    "OOOO........",
    "O...........",
    "O...........",
    "O...........",
    "O...........",
    "O...........",
    "O...........",
    "O...........",
    "O...........",
]


def halo(rows: list[str], ring: str = "H") -> list[str]:
    """`rows` padded by 1 px and ringed (8-neighbour) with `ring`, except below the last
    row: the pole's tip stays the mark's lowest pixel."""
    w = len(rows[0]) + 2
    grid = [["."] * w for _ in range(len(rows) + 1)]
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != ".":
                grid[y + 1][x + 1] = ch
    ink = {(x, y) for y, r in enumerate(grid) for x, ch in enumerate(r) if ch not in ".H"}
    for x, y in ink:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and ny < len(grid) and grid[ny][nx] == ".":
                    grid[ny][nx] = ring
    return ["".join(r) for r in grid]


FLAG_ROWS = halo(FLAG_MARK)
# the tip: the pole's last pixel, anchored one past it like `tag-visitor`'s tail (style.md)
FLAG_ANCHOR = (1, len(FLAG_ROWS))


def caption_text() -> str:
    with open(CONTENT, encoding="utf-8") as f:
        return json.load(f)["copy"]["shareCaption"]


def url_text(n: str) -> str:
    return URL.format(n=n)


def letter(lines: list[str]) -> Canvas:
    """Lines of `face` text, left-aligned, on a canvas cropped to the line boxes."""
    pitch = face.HEIGHT + LEAD
    cv = Canvas(max(face.text_width(t) for t in lines), pitch * (len(lines) - 1) + face.HEIGHT)
    for i, t in enumerate(lines):
        face.draw(cv, t, 0, i * pitch, INK)
    return cv


def flag() -> Canvas:
    return from_rows(FLAG_ROWS, FLAG_MAP)


def caption() -> Canvas:
    return letter(face.wrap(caption_text(), MAX_W // CAPTION_SCALE))


def urls() -> dict[str, Canvas]:
    frames = {n: letter([url_text(n)]) for n in STOPS}
    # one entry, one canvas size: each URL left-aligned on the widest one's canvas
    w = max(cv.w for cv in frames.values())
    out = {}
    for n, cv in frames.items():
        pad = Canvas(w, cv.h)
        pad.paste(cv, 0, 0)
        out[n] = pad
    return out
