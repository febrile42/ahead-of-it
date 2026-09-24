# Art pipeline (PH1-02 spike)

## Language: Python + Pillow, not TypeScript

The brief allowed either, with TypeScript (`npx tsx`) as the default and Python as an
argued exception. Python won here for one reason: **PH1-01 hasn't merged**, so there is
no `package.json` in this worktree, and `npx tsx` would need to fetch `tsx` from the
npm registry on first run — a network dependency this spike doesn't need and the
boundaries section asks to avoid ("keep the build self-contained"). Python 3 + Pillow
are already present in this environment (checked before starting: `python3 -c "import
PIL"` succeeded, no install step), so the build has zero setup and zero network calls.
Nothing else about the choice matters — the DSL, the palette-only enforcement and the
determinism story below would look identical in TypeScript with `canvas`/`pngjs`. If
PH1-01 lands and the team would rather have one build language, porting `art/src/` is
small (a few hundred lines, no clever Python-only tricks) — that's a fair follow-up,
not a redo.

## Run it

```bash
python3 art/build.py                 # renders public/sprites/*.png + manifest.json
                                      # and art/preview/{room,sheet,sheet@4x}.png
                                      # and art/preview/band80-{without,built}.png
python3 art/checks/check_palette.py  # independent palette-only verification
```

No dependencies beyond the stdlib and Pillow (`pip install pillow`, already present
here).

## How the pieces fit

- `art/palette.json` — 32 named colours (24 from the spike + 8 from PH1-06; 32 is the
  cap, enforced by `dsl.py` and `checks/check_palette.py`) + a `_comment`. Locked
  (D-024).
- `art/style.md` — tile geometry, anchors, lighting rule. Read this before adding a
  sprite; it explains the bottom-center anchor convention build.py relies on.
- `art/src/dsl.py` — `Canvas` (an RGBA drawing surface restricted to primitives that
  never anti-alias: `rect`, `polygon`, `line`, `diag_line`, `outlined_rect`,
  `mirror_h`) plus `from_rows()`, the "string rows with palette letters" DSL the brief
  asked for. `save_png()` converts to true PNG-8 against the *fixed* palette (not an
  adaptive one) — so "palette-only" is structural, not just checked after the fact:
  `Canvas.verify_palette_only()` raises before anything non-palette can reach disk.
- `art/src/iso.py` — the isometric helpers: `diamond()` (the floor-tile primitive),
  `extrude_wall()` (caps a diamond with a vertical face — walls, and the same
  technique underlies `iso_box()` for desk/monitor/chair), `iso_to_screen()` +
  `place()` (grid math for the room composite).
- `art/src/sprites/*.py` — one module per asset, each exporting `build()` (or
  `build_all()` for the worker, `build(state)` for the badge reader) and an `ANCHOR`.
- `art/src/vox.py` (PH1-06) — world-unit iso boxes rasterised by inverse projection,
  face painting (`Iso.paint`), ground shadows, the dotted network line, and `make()`,
  which crops a prop and records its anchor and named points.
- `art/src/glyphs.py` (PH1-06) — the 3×5 pixel font for `DEV`, `CAUTION`, `VISITOR`
  and the SLA board. No font files.
- `art/src/sprites/room.py`, `band80.py` (PH1-06) — room structure and band-80 props,
  both states; `band150.py`, `band220.py` (PH1-07) likewise.
- `art/src/layout.py` (PH1-07) — every band x state room as *data*: a list of
  placements (manifest key, frame, tile or floor point, depth, layer, gag band). Later
  bands contain every earlier band's placements, quieter (R-03a); `scene(band, state)`
  is the list PH1-08b exports. `art/src/compose.py` renders it from `manifest.json` and
  the shipped PNGs alone, the way the site's painter will.
- `art/build.py` — orchestrates: builds every sprite, writes 1x PNGs to
  `public/sprites/`, writes `manifest.json`, composes the preview images.

## Add a sprite in ≤ 10 lines

Geometric props (boxes, tiles) — reuse `iso_box`/`diamond`/`extrude_wall`:

```python
from ..dsl import Canvas
from ..iso import iso_box

ANCHOR = (16, 32)

def build() -> Canvas:
    c = Canvas(32, 32)
    iso_box(c, cx=16, by=30, hw=8, hh=4, height=10,
            top="desk-wood", left="desk-wood", right="desk-wood-dark", outline="outline")
    return c
```

Hand-authored silhouettes (characters, small props) — use `from_rows`:

```python
from ..dsl import from_rows
ROWS = ["....", ".oo.", ".ss.", "...."]
MAPPING = {".": None, "o": "outline", "s": "skin-1"}
def build(): return from_rows(ROWS, MAPPING)
```

Then register it in `art/build.py` (one `save_png(...)` call and one manifest entry)
and re-run `python3 art/build.py`. Every colour used must already be a name in
`art/palette.json`, or `save_png` raises `KeyError`/`ValueError` before it writes
anything.

## Determinism and palette-only — verified, not assumed

```
$ python3 art/build.py && sha256sum public/sprites/*.png art/preview/*.png | sort > /tmp/sha1.txt
$ python3 art/build.py && sha256sum public/sprites/*.png art/preview/*.png | sort > /tmp/sha2.txt
$ diff /tmp/sha1.txt /tmp/sha2.txt
(no output — identical)

$ python3 art/checks/check_palette.py
PASS  public/sprites/badge-reader-green.png
... (169 files)
All 169 PNGs are palette-only (32 colours + transparency).
```

Determinism holds because the build has no randomness, no timestamps, no metadata
(`save_png` writes flat PNG-8 with `optimize=False`, no `pnginfo`) and no dependency on
filesystem iteration order (sprite lists are written explicitly, not globbed).
Palette-only holds structurally (`Canvas.verify_palette_only()` runs on every save) and
is re-checked independently by `art/checks/check_palette.py` reading the PNGs back off
disk, the way a reviewer would.
