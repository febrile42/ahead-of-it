"""A 3x5 pixel font for in-scene labels (`DEV`, `CAUTION`, `VISITOR`, the SLA board).

Brief PH1-06: text in the pixels is drawn as glyphs, never with a font file. Each glyph
is 5 rows of 3 characters ('#' = ink); `I`, `1`, `:` and space are narrower, `N`
is 4 wide (a 3-wide N reads as a lowercase n) and `M`, `W` 5 (3-wide, both read as H). Letters are
separated by one blank column. Only what the art needs is defined; `draw` raises on
anything else so a typo can't silently render as a gap.
"""
from __future__ import annotations

from .dsl import Canvas

GLYPHS = {
    "A": [".#.", "#.#", "###", "#.#", "#.#"],
    "B": ["##.", "#.#", "##.", "#.#", "##."],
    "C": [".##", "#..", "#..", "#..", ".##"],
    "D": ["##.", "#.#", "#.#", "#.#", "##."],
    "E": ["###", "#..", "##.", "#..", "###"],
    "F": ["###", "#..", "##.", "#..", "#.."],
    "G": [".##", "#..", "#.#", "#.#", ".##"],
    "H": ["#.#", "#.#", "###", "#.#", "#.#"],
    "I": ["#", "#", "#", "#", "#"],
    "K": ["#.#", "#.#", "##.", "#.#", "#.#"],
    "L": ["#..", "#..", "#..", "#..", "###"],
    "M": ["#...#", "##.##", "#.#.#", "#...#", "#...#"],   # PH1-07: 3-wide read as H
    "N": ["#..#", "##.#", "#.##", "#..#", "#..#"],
    "O": [".#.", "#.#", "#.#", "#.#", ".#."],
    "P": ["##.", "#.#", "##.", "#..", "#.."],
    "R": ["##.", "#.#", "##.", "#.#", "#.#"],
    "S": [".##", "#..", ".#.", "..#", "##."],
    "T": ["###", ".#.", ".#.", ".#.", ".#."],
    "U": ["#.#", "#.#", "#.#", "#.#", "###"],
    "V": ["#.#", "#.#", "#.#", ".#.", ".#."],
    "W": ["#...#", "#...#", "#.#.#", "##.##", "#...#"],   # PH1-07: 3-wide read as H
    "Y": ["#.#", "#.#", ".#.", ".#.", ".#."],
    "0": [".#.", "#.#", "#.#", "#.#", ".#."],
    "1": [".#", "##", ".#", ".#", ".#"],
    "2": ["##.", "..#", ".#.", "#..", "###"],
    "3": ["##.", "..#", ".#.", "..#", "##."],
    "4": ["#.#", "#.#", "###", "..#", "..#"],
    "5": ["###", "#..", "##.", "..#", "##."],
    "6": [".##", "#..", "##.", "#.#", ".#."],
    "7": ["###", "..#", ".#.", ".#.", ".#."],
    "8": [".#.", "#.#", ".#.", "#.#", ".#."],
    "9": [".#.", "#.#", ".##", "..#", "##."],
    ":": [".", "#", ".", "#", "."],
    "!": ["#", "#", "#", ".", "#"],
    "?": ["###", "..#", ".##", "...", ".#."],
    " ": ["..", "..", "..", "..", ".."],
    # PH1-07
    "(": [".#", "#.", "#.", "#.", ".#"],
    ")": ["#.", ".#", ".#", ".#", "#."],
    ">": ["..#..", "...#.", "#####", "...#.", "..#.."],   # an arrow: CRM>ERP>HRIS
    "Q": [".#.", "#.#", "#.#", "#.#", ".##"],
    "X": ["#.#", "#.#", ".#.", "#.#", "#.#"],
}

HEIGHT = 5


def text_width(text: str) -> int:
    return sum(len(GLYPHS[ch][0]) for ch in text) + max(len(text) - 1, 0)


def draw(canvas: Canvas, text: str, x: int, y: int, colour: str):
    """Draw `text` with its top-left at (x, y)."""
    for ch in text:
        if ch not in GLYPHS:
            raise KeyError(f"no glyph for {ch!r}")
        rows = GLYPHS[ch]
        for dy, row in enumerate(rows):
            for dx, px in enumerate(row):
                if px == "#":
                    canvas.point(x + dx, y + dy, colour)
        x += len(rows[0]) + 1
