# Scene format — the art → web contract (D-035)

The art pipeline (`art/`, Python, Opus-drawn) is the single source of what each band looks
like. It exports, per band × state, a **scene file**; the web (`src/scene/`, sonnet-built)
is a dumb painter that draws it. The art side paints its own previews *from the exported
file*, so the web canvas at scale 1 must match the art's per-view reference image
`art/preview/views/<band>-<state>-<viewId>@1x.png` pixel for pixel — a Playwright test, not
a promise. Those references are painted from the exported `entries`, and `check_scenes.py`
proves each one equals the art pipeline's own native render of that view's room, so the
chain art → export → web has no unchecked link. Each view is its own composed room (D-038),
not a crop. (The whole-plate `art/preview/band<N>-*.png` show a band's views side by side at
4× for art review; they are not parity goldens.)

Files: `public/sprites/scenes/index.json` and `public/sprites/scenes/<band>-<state>.json`
for band ∈ {80,150,220,360,490,610,750} and state ∈ {built,without}. `beyond` is an alias
of 750 in `index.json` (N-02). Thumbnails: `public/sprites/thumbs/<gagId>.png` cropped from
the without scene around the gag's primary hotspot (R-04).

```jsonc
// index.json
{ "schema": 1,
  "bands": { "80": { "built": "80-built.json", "without": "80-without.json" }, /* … */ },
  "beyond": "750",
  "thumbs": { "G1.1": "thumbs/G1.1.png", /* … */ } }

// <band>-<state>.json
{ "schema": 1, "band": 80, "state": "without",
  "views": [                                   // A4: several views from day one; 80 has one
    { "id": "ground", "label": "Ground floor", "size": { "w": 300, "h": 214 },
      "focus": { "x": 0, "y": 0, "w": 300, "h": 214 },   // what to scroll to if wider than viewport
      "default": true,                                     // holds the current band's gags
      "entries": [                                         // paint order = array order
        { "sprite": "floor", "frame": "default", "x": 0, "y": 100, "depth": 0 },
        { "sprite": "worker-queue", "frame": "b-left", "x": 180, "y": 120, "depth": 140,
          "gagId": "G2.1", "part": "queue-3", "alpha": 1.0 },
        { "sprite": "fx-net-80-without", "frame": "default", "x": 0, "y": 0, "depth": 900,
          "gagId": "G2.3" }                                // A3: procedural marks are baked overlays
      ],
      "hotspots": [                                        // A1: explicit rects, art-authored
        { "gagId": "G2.1", "part": "queue", "x": 170, "y": 96, "w": 64, "h": 48, "primary": true },
        { "gagId": "G4.1", "part": "door",  "x": 8,   "y": 60, "w": 32, "h": 40, "primary": true,
          "placeholder": false }
      ] } ] }
```

Rules
- `sprite`/`frame` reference **manifest keys**, never file names (A2). `frame` is always the
  frame-*name* string exactly as it appears in that sprite's `frames` object (`"default"`,
  `"green"`, `"a-left"`), never an index. No fallback: an unknown frame fails
  `check_scenes.py`, the contract test, and throws in the painter.
- **Paint order = array order.** The exporter emits it exactly as `compose.render` paints:
  `base` in list order, then `main` sorted by `(depth, order)`, then `over` in list order.
- Entries may extend past a view's rect (a road tile at `x: -8`); the canvas clips them.
  Hotspots and `focus` must lie inside the view.
- `depth` is kept on every entry so Phase 2 can insert walkers between props (A2).
- The painter draws **images only** (A3). Dotted lines, roads, links are overlay sprites
  (PNG-8, palette-checked), tagged with their gag.
- **Bands may re-compose a room (D-039).** In the art source a placement can carry
  `since` / `until`, so the ground floor and the street are laid out afresh from 360 rather
  than only added to. This never appears in a scene file: each `<band>-<state>.json` is
  complete and self-contained, and the painter must not assume a gag keeps its position, or
  a view its size, from one band to the next. Ground grows from 282 × 188 (220) to 346 × 220
  (360); HQ's footprint shrinks from 7 × 3 tiles to 4 × 3 (`hq-5`, then `hq-6` from 490).
  Every rule below applies to a re-composed room exactly as to any other, with no exemptions.
- **Cumulative (R-03a):** band N's scene contains every gag with band ≤ N in the matching
  state (re-placed, when the room was re-composed, never dropped). Emphasis is the art's
  decision: `alpha` (applied blindly by the painter) or a palette-true quiet variant.
- Two-part gags get one hotspot per part, one `primary: true`, and all of a gag's hotspots
  open the same panel. Which states are two-part follows `BANDS-AND-GAGS.md`: G3.2, G4.1
  and G2.4 in both states; G5.1 in `without` only (its built state is one picture — a solid
  link). A gag whose hotspots are all `placeholder` is exempt. Parts may sit in different
  views; only the primary must be in the gag's home view.
- **Placeholders:** bands with no composer yet export the nearest drawn room plus
  `placeholder: true` hotspots; the web draws its labelled box for those. No off-palette
  PNGs ever. If a scene *file* is missing altogether (it should never be, once exported),
  the web shows a plain "not drawn yet" panel rather than failing.
- **Views: rooms and close-ups (D-036, amended by D-042).** Every view carries
  `"kind": "room"` or `"kind": "closeup"`.
  - *Rooms* are the establishing shots: ids ∈ {ground, floor-2…floor-6, top, street} in
    that order; `w ≤ 360`, `h ≤ 240`; `ground` always, others only if they have at least one
    close-up; inset + map only in `street`. Rooms carry **no gag hotspots** (`hotspots: []`).
  - *Close-ups* are where the gags are tapped: `w ≤ 180`, `h ≤ 120` (3:2 preferred);
    id `<room>.<n>` from 1 (`ground.1`, `ground.2`, `floor-2.1`); `"parent": "<room id>"`;
    `"rect": {x, y, w, h}`, their position inside the parent room in native px. A close-up
    holds 1–3 primary hotspots. In array order a room's close-ups directly follow the room.
  - Each gag has exactly one primary **per file**, in a close-up whose parent is its home
    room (table in D-036). Non-primary parts may sit in other close-ups.
  - Primary centres are ≥ **24 native px** apart within a close-up (= 44 css px at the
    ≥ 1.9 css px per art px a close-up gets on a 360–430 px phone).
  - Default view = the close-up holding the most primaries of the current band's own gags;
    ties go to the earlier one.
  - `check_scenes.py` and the contract test fail the build on any breach. Pan/zoom is the
    escape valve, not the default.
  - Field names and the id scheme are proposed by D-042; the Web Engineer may counter them
    before the exporter merges.
- `focus` is the region to scroll to when a view is wider than the viewport. It must lie
  inside the view; it need not equal it (the exporter currently emits the full view).
- **No exceptions.** Since PH1-10 the 44 px rule and the two-part rule hold for every drawn
  band, and both sides enforce them without an exemption list (D-038). Under D-042 the
  spacing rule is 24 native px within a close-up. If art ever needs to
  ship a known violation, write a decision first and add a list that `check_scenes.py` and
  the contract test both read, warn on, and fail once stale.
- Painter scaling is chosen in **device** pixels on both axes, so a view never overflows the
  3:2 scene box (the Web Engineer may resize the box under D-042 item 7, provided a
  180 × 120 close-up paints at ≥ 1.9 css px per art px at 360 and 390 px, dpr 2 and 3): `s = max(1, min(floor(cssW·dpr / nativeW), floor(cssH·dpr / nativeH)))`;
  backing store `native·s`; CSS size `native·s/dpr`; the canvas is centred horizontally.
- `art/checks/check_scenes.py`: determinism, manifest references and frame keys, R-03a
  coverage both states, one primary per gag per file, hotspot bounds, 24 px close-up spacing
  (with no exceptions), `beyond` alias, per-view pixel parity against each room's own render,
  and each close-up equal to its parent room's render cropped at `rect` (D-042).
- **Review at true size (D-042).** Picture reviews use 390 px mocks at the painted scale,
  never the 4× plates.
