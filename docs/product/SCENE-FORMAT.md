# Scene format — the art → web contract (D-035)

The art pipeline (`art/`, Python, Opus-drawn) is the single source of what each band looks
like. It exports, per band × state, a **scene file**; the web (`src/scene/`, sonnet-built)
is a dumb painter that draws it. The art side paints its own previews *from the exported
file*, so the web canvas at scale 1 must match `art/preview/<band>-<state>@1x.png` pixel
for pixel — a Playwright test, not a promise.

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
        { "sprite": "floor", "frame": 0, "x": 0, "y": 100, "depth": 0 },
        { "sprite": "worker-queue", "frame": 2, "x": 180, "y": 120, "depth": 140,
          "gagId": "G2.1", "part": "queue-3", "alpha": 1.0 },
        { "sprite": "fx-net-80-without", "frame": 0, "x": 0, "y": 0, "depth": 900,
          "gagId": "G2.3" }                                // A3: procedural marks are baked overlays
      ],
      "hotspots": [                                        // A1: explicit rects, art-authored
        { "gagId": "G2.1", "part": "queue", "x": 170, "y": 96, "w": 64, "h": 48, "primary": true },
        { "gagId": "G4.1", "part": "door",  "x": 8,   "y": 60, "w": 32, "h": 40, "primary": true,
          "placeholder": false }
      ] } ] }
```

Rules
- `sprite`/`frame` reference **manifest keys**, never file names (A2). A check fails on any
  reference not in `manifest.json`.
- `depth` is kept on every entry so Phase 2 can insert walkers between props (A2).
- The painter draws **images only** (A3). Dotted lines, roads, links are overlay sprites
  (PNG-8, palette-checked), tagged with their gag.
- **Cumulative (R-03a):** band N's scene contains every gag with band ≤ N in the matching
  state. Emphasis is the art's decision: `alpha` (applied blindly by the painter) or a
  palette-true quiet variant.
- Two-part gags (G4.1 door+pit, G5.1 both doors, G3.2, G2.4) get one hotspot per part, one
  `primary: true`. All hotspots of a gag open the same panel.
- **Placeholders:** bands with no composer yet export the nearest drawn room plus
  `placeholder: true` hotspots; the web draws its labelled box for those. No off-palette
  PNGs ever.
- **Width budget:** each view is ≤ 390 native px wide (pending D-036 from the PH1-08a
  spike); primary hotspot centres ≥ 44 CSS px apart at phone scale; `check_scenes.py`
  fails the build otherwise. Pan/zoom is the escape valve, not the default.
- Painter scaling is chosen in **device** pixels: `s = max(1, floor(cssAvail·dpr / nativeW))`;
  backing store `native·s`; CSS size `native·s/dpr`.
- `art/checks/check_scenes.py`: determinism, manifest references, R-03a coverage both
  states, hotspot bounds, 44 px spacing, `beyond` alias.
