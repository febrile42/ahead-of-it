"""Badge reader prop, red/green states (brief item 5). Hand-authored with the row DSL
(art/src/dsl.py from_rows) rather than drawing primitives — small enough to be safe to
author by hand, and demonstrates the DSL path the brief asks for alongside the
primitive-based sprites."""
from ..dsl import from_rows

W, H = 12, 20
ANCHOR = (6, 20)

_MAPPING_BASE = {
    ".": None,
    "o": "outline",
    "b": "badge-body",
    "s": "outline",  # card slot: a dark slit, reuses outline rather than a new colour
}

_ROWS = [
    "............",
    "..oooooooo..",
    "..obbbbbbo..",
    "..obbLLbbo..",
    "..obbLLbbo..",
    "..obbbbbbo..",
    "..obbbbbbo..",
    "..obbbbbbo..",
    "..obssssbo..",
    "..obbbbbbo..",
    "..obbbbbbo..",
    "..obbbbbbo..",
    "..oooooooo..",
    "............",
    ".....oo.....",
    ".....oo.....",
    "............",
    "............",
    "............",
    "............",
]


def build(state: str):
    assert state in ("red", "green")
    mapping = dict(_MAPPING_BASE)
    mapping["L"] = "badge-red" if state == "red" else "badge-green"
    return from_rows(_ROWS, mapping)
