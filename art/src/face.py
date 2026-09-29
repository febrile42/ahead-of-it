"""PH3-02 (D-057 item 3): the mixed-case face for the share image's caption and URL.

The in-scene font (`glyphs.py`, 3x5) is capitals plus a handful of lowercase letters on a
4-row x-height: legible as a sign on a wall, not as a sentence. The share image letters a
full sentence and a URL, so it gets its own face, still glyphs and never a font file.

Cap height 7, x-height 5 (rows 2-6), descenders 2 (rows 7-8), so every glyph is 9 rows.
Lowercase and capitals are 4 wide where the letter survives it; `m`, `w`, `x` and `&` are
5, and `i`, `l`, `j`, `.`, `,` are narrower. Letters are separated by one blank column; a
space is 2 wide, so a word gap is 4 and never reads as a letter gap. Only what the share
sprites need is defined; `draw` raises on anything else, like `glyphs.draw`.
"""
from __future__ import annotations

from .dsl import Canvas

CAP = 7
DESC = 2
HEIGHT = CAP + DESC

_G = {
    # capitals
    "B": ["###.", "#..#", "#..#", "###.", "#..#", "#..#", "###."],
    "J": ["..##", "...#", "...#", "...#", "...#", "#..#", ".##."],
    # lowercase (rows 0-1 are ascender space)
    "a": ["....", "....", ".##.", "...#", ".###", "#..#", ".###"],
    "c": ["....", "....", ".###", "#...", "#...", "#...", ".###"],
    "d": ["...#", "...#", ".###", "#..#", "#..#", "#..#", ".###"],
    "e": ["....", "....", ".##.", "#..#", "####", "#...", ".###"],
    "f": [".##", "#..", "###", "#..", "#..", "#..", "#.."],
    "g": ["....", "....", ".###", "#..#", "#..#", "#..#", ".###", "...#", ".##."],
    "h": ["#...", "#...", "###.", "#..#", "#..#", "#..#", "#..#"],
    "i": ["#", ".", "#", "#", "#", "#", "#"],
    "j": [".#", "..", ".#", ".#", ".#", ".#", ".#", ".#", "#."],
    "l": ["#.", "#.", "#.", "#.", "#.", "#.", ".#"],
    "m": [".....", ".....", "####.", "#.#.#", "#.#.#", "#.#.#", "#.#.#"],
    "n": ["....", "....", "###.", "#..#", "#..#", "#..#", "#..#"],
    "o": ["....", "....", ".##.", "#..#", "#..#", "#..#", ".##."],
    "p": ["....", "....", "###.", "#..#", "#..#", "#..#", "###.", "#...", "#..."],
    "r": ["....", "....", "#.##", "##..", "#...", "#...", "#..."],
    "s": ["....", "....", ".###", "#...", ".##.", "...#", "###."],
    "t": [".#.", ".#.", "###", ".#.", ".#.", ".#.", "..#"],
    "u": ["....", "....", "#..#", "#..#", "#..#", "#..#", ".###"],
    "w": [".....", ".....", "#...#", "#...#", "#.#.#", "#.#.#", ".#.#."],
    "x": [".....", ".....", "#...#", ".#.#.", "..#..", ".#.#.", "#...#"],
    "y": ["....", "....", "#..#", "#..#", "#..#", "#..#", ".###", "...#", ".##."],
    "z": ["....", "....", "####", "..#.", ".#..", "#...", "####"],
    # digits
    "0": [".##.", "#..#", "#..#", "#..#", "#..#", "#..#", ".##."],
    "1": [".#.", "##.", ".#.", ".#.", ".#.", ".#.", "###"],
    "2": [".##.", "#..#", "...#", "..#.", ".#..", "#...", "####"],
    "3": ["###.", "...#", "...#", ".##.", "...#", "...#", "###."],
    "4": ["#..#", "#..#", "#..#", "####", "...#", "...#", "...#"],
    "5": ["####", "#...", "###.", "...#", "...#", "#..#", ".##."],
    "6": [".##.", "#...", "#...", "###.", "#..#", "#..#", ".##."],
    "7": ["####", "...#", "..#.", "..#.", ".#..", ".#..", ".#.."],
    "8": [".##.", "#..#", "#..#", ".##.", "#..#", "#..#", ".##."],
    "9": [".##.", "#..#", "#..#", ".###", "...#", "...#", ".##."],
    # punctuation
    " ": ["..", "..", "..", "..", "..", "..", ".."],
    ".": [".", ".", ".", ".", ".", ".", "#"],
    ",": ["..", "..", "..", "..", "..", ".#", ".#", "#."],
    "/": ["..#", "..#", ".#.", ".#.", ".#.", "#..", "#.."],
    "?": [".##.", "#..#", "...#", "..#.", ".#..", "....", ".#.."],
    "=": ["....", "....", "....", "####", "....", "####", "...."],
    "&": [".##..", "#..#.", "#.#..", ".#...", "#.#.#", "#..#.", ".##.#"],
}

# every glyph padded to HEIGHT rows, so a descender-less glyph is blank below the line
GLYPHS = {ch: rows + ["." * len(rows[0])] * (HEIGHT - len(rows)) for ch, rows in _G.items()}
assert all(len(set(map(len, r))) == 1 and len(r) == HEIGHT for r in GLYPHS.values())


def text_width(text: str) -> int:
    return sum(len(GLYPHS[ch][0]) for ch in text) + max(len(text) - 1, 0)


def wrap(text: str, width: int) -> list[str]:
    """Greedy word wrap: each line as many whole words as fit in `width` px."""
    lines: list[str] = []
    for word in text.split(" "):
        if lines and text_width(lines[-1] + " " + word) <= width:
            lines[-1] += " " + word
        else:
            if text_width(word) > width:
                raise ValueError(f"{word!r} is wider than {width} px")
            lines.append(word)
    return lines


def draw(canvas: Canvas, text: str, x: int, y: int, colour: str):
    """Draw `text` with the top of its cap height at (x, y)."""
    for ch in text:
        if ch not in GLYPHS:
            raise KeyError(f"no glyph for {ch!r}")
        rows = GLYPHS[ch]
        for dy, row in enumerate(rows):
            for dx, px in enumerate(row):
                if px == "#":
                    canvas.point(x + dx, y + dy, colour)
        x += len(rows[0]) + 1
