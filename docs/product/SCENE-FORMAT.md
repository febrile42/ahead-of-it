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
{ "schema": 2,
  "bands": { "80": { "built": "80-built.json", "without": "80-without.json" }, /* … */ },
  "beyond": "750",
  "thumbs": { "G1.1": "thumbs/G1.1.png", /* … */ } }

// <band>-<state>.json            (schema 2, D-042: rooms + close-ups)
{ "schema": 2, "band": 80, "state": "without",
  "views": [                                   // array order = navigation order
    { "id": "ground", "kind": "room", "label": "Ground floor",
      "size": { "w": 300, "h": 214 },
      "focus": { "x": 0, "y": 0, "w": 300, "h": 214 },   // what to scroll to if wider than viewport
      "entries": [ /* the whole room, room coordinates */ ],
      "hotspots": [] },                                    // rooms carry no gag hotspots
    { "id": "ground.1", "kind": "closeup", "parent": "ground", "label": "Helpdesk",
      "rect": { "x": 150, "y": 84, "w": 180, "h": 120 },   // where it sits in the parent, parent coordinates
      "size": { "w": 180, "h": 120 },                      // always equals rect.w/h
      "focus": { "x": 0, "y": 0, "w": 180, "h": 120 },     // close-up coordinates
      "default": true,                                     // exactly one per file, always a close-up
      "entries": [                                         // paint order = array order; CLOSE-UP coordinates
        { "sprite": "floor", "frame": "default", "x": -150, "y": 16, "depth": 0 },
        { "sprite": "worker-queue", "frame": "b-left", "x": 30, "y": 36, "depth": 140,
          "gagId": "G2.1", "part": "queue-3", "alpha": 1.0 },
        { "sprite": "fx-net-80-without", "frame": "default", "x": -150, "y": -84, "depth": 900,
          "gagId": "G2.3" }                                // A3: procedural marks are baked overlays
      ],
      "hotspots": [                                        // A1: explicit rects, art-authored, CLOSE-UP coordinates
        { "gagId": "G2.1", "part": "queue", "x": 20, "y": 12, "w": 64, "h": 48, "primary": true },
        { "gagId": "G4.1", "part": "door",  "x": 130, "y": 60, "w": 32, "h": 40, "primary": true,
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
  `"kind": "room"` or `"kind": "closeup"`, and `schema` is **2**. The painter refuses any
  other schema (the "not drawn yet" path), so a schema-1 file can never half-render.
  - *Rooms* are the establishing shots: ids ∈ {ground, floor-2…floor-6, top, street} in
    that order; `w ≤ 360`, `h ≤ 240`; `ground` always, others only if they have at least one
    close-up; inset + map only in `street`. Rooms carry **no gag hotspots** (`hotspots: []`).
    Their `entries` are the whole room in room coordinates.
  - *Close-ups* are where the gags are tapped: `w ≤ 180`, `h ≤ 120` (3:2 preferred);
    id `<room>.<n>` from 1 (`ground.1`, `ground.2`, `floor-2.1`); `"parent": "<room id>"`;
    `"rect": {x, y, w, h}`, integers, their position inside the parent room in the
    parent's native px, wholly inside the parent's `size`. `size` is always equal to
    `rect.w`/`rect.h` (the painter reads `size`, never `rect`, to draw a close-up).
    A close-up holds 1–3 primary hotspots. In array order a room's close-ups directly
    follow the room; the array order is the navigation order and the web never re-sorts it.
  - **Coordinates.** A close-up's `entries`, `hotspots` and `focus` are in the close-up's
    **own** coordinates: origin at the top-left of its `rect`. The exporter does the
    translation (an entry that started at parent `(x, y)` is emitted at `(x − rect.x,
    y − rect.y)`, negative when it overhangs) and the painter applies no offset. `rect` is
    read by the web for one purpose only: to draw a room's "zoom in" targets over the
    room picture, derived from the same array the close-ups come from.
  - **Labels.** Every view has a non-empty `label` of at most 24 characters. Close-up labels
    are read by visitors, so they are served copy: they name a place ("Helpdesk"), never a
    person or employer, and the Product & Content Lead reviews the table once.
  - **Both states of a band share a skeleton.** `built` and `without` of the same band
    have the same view ids, `kind`s, `parent`s, labels and array order, so the toggle keeps
    the visitor where they are. `rect`, `size` and the entries may differ per state (a
    gag can move between the two states' compositions), and so may `default`.
  - Exactly one view per file has `"default": true` and it is a close-up: the one holding
    the most primaries of the current band's own gags; ties go to the earlier one.
  - Each gag has exactly one primary **per file**, in a close-up whose parent is its home
    room (table in D-036). Non-primary parts may sit in other close-ups (never in a room,
    which has no hotspots).
  - Primary centres are ≥ **24 native px** apart within a close-up (= 44 css px at the
    ≥ 1.9 css px per art px a close-up gets on a 360–430 px phone).
  - Thumbnails (`index.json` `thumbs`) are cropped by the exporter from the `without`
    close-up that holds the gag's primary; the web reads them as opaque files.
  - `check_scenes.py` and the contract test fail the build on any breach; the split
    between them is in the last bullet of this section. Pan/zoom is the escape valve, not
    the default.
  - The field names and id scheme were proposed by D-042 and signed off by the Web Engineer
    on 2026-09-25 (DIA-39) with the counters above: `schema: 2`, the coordinate rule, the
    label rule, the shared skeleton across states, and exactly one `default`.
- `focus` is the region to scroll to when a view is wider than the viewport. It must lie
  inside the view; it need not equal it (the exporter currently emits the full view).
- **No exceptions.** Since PH1-10 the 44 px rule and the two-part rule hold for every drawn
  band, and both sides enforce them without an exemption list (D-038). Under D-042 the
  spacing rule is 24 native px within a close-up. If art ever needs to
  ship a known violation, write a decision first and add a list that `check_scenes.py` and
  the contract test both read, warn on, and fail once stale.
- Painter scaling is chosen in **device** pixels on both axes, so a view never overflows the
  3:2 scene box: `s = max(1, min(floor(cssW·dpr / nativeW), floor(cssH·dpr / nativeH)))`;
  backing store `native·s`; CSS size `native·s/dpr`; the canvas is centred horizontally.
  The scene box stays **3:2 and never changes size** between views (D-042 item 7): a
  180 × 120 close-up at s = 2 css px and a 360 × 240 room at s = 1 css px both fill the same
  box exactly, so switching view costs no layout shift. On a phone (≤ 430 css px) the box is
  the full viewport width; from 768 px it is capped at 720 css px wide.
- **Motion gate (PH2-02, R-24/R-08/R-06a).** Anything that plays back sprite frames, times a
  visual change, or drives a CSS animation/transition — a walker in the `depth` slot above,
  the band-crossing moment, a nudge pulse, Phase 3's day/night — asks `src/motion.ts`'s
  `motionGate().isReduced()` (or subscribes for a runtime flip) before it moves, never
  deciding for itself. When it answers `true` the painter paints the rest pose: the exported
  frame at t = 0, which is already all `loadEntryImage`/`loadSpriteFrame` (src/scene/
  sprites.ts) ever resolve, so this rule needs no separate "still" asset. A caption that
  accompanies a motion is never itself motion and keeps showing regardless. Animation stays
  decorative (R-08): no requirement may come to depend on it running.
- `art/checks/check_scenes.py` (needs the render pipeline and the PNGs; owned by the Art
  Director): determinism, manifest references and frame keys, R-03a coverage both states,
  `beyond` alias, per-view pixel parity against each room's own render, each close-up equal
  to its parent room's render cropped at `rect` (D-042), and the geometry rules it can also
  check for free: one primary per gag per file, hotspot bounds, 24 px close-up spacing with
  no exceptions.
- `src/scene/scene-contract.test.ts` (reads only the exported JSON; owned by the Web
  Engineer; runs in `npm run test:unit` with no Python): everything the painter and the
  navigation rely on. `schema: 2`; `kind` values; the id scheme and that `parent` names a
  preceding room and matches the id prefix; array order (rooms in D-036 order with their
  close-ups directly after, `ground` first, no room without a close-up); rooms have
  `hotspots: []`; close-up `size ≤ 180 × 120`, `size` equals `rect`, `rect` is integer and
  inside the parent; 1–3 primaries per close-up; exactly one `default`, on a close-up, and
  it is the one the rule picks; labels present and ≤ 24 characters; both states share the
  skeleton; every gag due at the band has its one primary in a close-up under its home
  room; hotspots and `focus` inside their view; 24 px spacing; two-part rules. Spacing and
  one-primary are deliberately checked twice, independently, in two languages (D-042 item 5).
  Neither check re-implements the other's pixel work: only `check_scenes.py` reads PNGs.
- The Playwright suite owns what only a browser can show: canvas parity with
  `art/preview/views/<band>-<state>-<viewId>@1x.png` for every view including close-ups;
  a 180 × 120 close-up painting at ≥ 1.9 css px per art px at 360 and 390 px, dpr 2 and 3;
  every close-up reachable by touch and by keyboard; hotspots ≥ 44 css px.
- **Review at true size (D-042).** Picture reviews use 390 px mocks at the painted scale,
  never the 4× plates.

## Motion (PH2-01)

Status: proposed by the Art Director on 2026-09-26 (DIA-81) and signed off by the Web
Engineer the same day (DIA-86), with one addition: the exact frame-selection rule for
in-place loops (below). A walker avoids every hotspot rect, not only primaries, which
answers DIA-86's question: a two-part gag's second part is a gag too, and a person crossing
it would hide it.

**Schema: stays 2, and the fields are additive and optional.** The painter already ignores
entry fields it does not know (`assembler.ts` reads `sprite`, `frame`, `x`, `y`, `alpha`), and
every entry keeps its rest pose in the fields it has today. So a file with motion, painted
by today's painter, paints today's picture exactly. No lockstep merge; Part A can land
first. A painter that plays motion must treat an absent `motion` as "still".

**Rest pose = today's export.** At `t = 0`, and whenever motion is off (reduced motion,
tab hidden, out of view, or a painter that does not play it), every entry paints its
`sprite`/`frame`'s *first* file at its own `x`, `y`. That is what the painter draws now, so
every pixel-parity golden and every picture review stays valid, and no golden changes.

**Time.** `t` is ms since the current scene file was first painted. The toggle, the slider
and a band change reset it to 0; switching views inside one file does not (a room and its
close-ups share one clock, so zooming in shows the same moment). All arithmetic below is
integer-exact given `t`, so two painters at the same `t` paint the same pixels.

```jsonc
// an in-place loop (most animation)
{ "sprite": "auditor", "frame": "wait", "x": 212, "y": 96, "depth": 150,
  "gagId": "G4.1", "part": "auditor",
  "motion": { "start": 420 } }                  // start ≥ 0, ms; optional "rate"

// an ambient walker
{ "sprite": "worker-c", "frame": "down", "x": 60, "y": 150, "depth": 210,
  "motion": { "start": 900,
              "walk": [                          // closed loop, back to (x, y)
                { "frame": "right", "to": [96, 168], "ms": 4500 },
                { "frame": "down",  "hold": 1800 },          // idle beat in place
                { "frame": "left",  "to": [60, 150], "ms": 4500 } ] } }
```

- **`motion` absent** → still, forever (today's behaviour).
- **`motion.start`** (int ms, ≥ 0, default 0): the entry holds its rest pose until
  `t ≥ start`. The exporter derives it deterministically (a hash of band, state, view id
  and the entry's array index) so that twenty workers do not tick in lockstep, and so that
  three `build.py` runs stay byte-identical.
- **`motion.rate`** (optional, one of 0.5, 1, 1.5, 2; default 1): multiplies the frame
  clock, so a hurried walker's legs move faster than a calm one's. It never changes the
  manifest.
- **In-place loop** (no `walk`): let `u = (t − start) · rate`. The frames of
  `sprite.frames[frame]` play in order, each for its manifest `duration`, and wrap.
  Exactly: let `total` be the sum of the key's file durations and `τ = floor(u) mod total`;
  walking the key's files in order and accumulating their durations, the file whose
  half-open cumulative range `[acc, acc + duration)` contains `τ` is the one painted. Before
  `start` (`t < start`) the first file is painted. A key
  with one file, or any file with `duration` 0, makes the entry still (the checks forbid
  shipping that combination with `motion`). Every frame of a key shares canvas and anchor
  (`style.md`), so the entry never moves and never leaves its hotspot.
- **Walker** (`walk` present): an ordered list of legs, starting from the entry's
  `(x, y)`. A *move* leg `{frame, to: [x, y], ms}` goes in a straight line from the
  previous point to `to` over `ms`; a *hold* leg `{frame, hold}` stands still for `hold` ms.
  Let `τ = (t − start) mod Σms`. In the current leg, with `p = elapsed / ms`, the anchor is
  at `(x₀ + floor((x₁ − x₀)·p), y₀ + floor((y₁ − y₀)·p))`, and the leg's `frame` key cycles
  as an in-place loop, scaled by `rate`, with `u` measured from `start` (not from the leg's
  own start), so a walker's step cycle never restarts at a corner. `elapsed` and `τ` are in
  unscaled ms: `rate` speeds the legs' frames, never the path. The last leg must end where the entry starts, so
  the loop is seamless. Ping-pong is not a mode: a return leg needs its own facing (`left`
  back after `right`), so it is written as legs.
  - Why legs, not `points + speed`: a walker changes facing per segment and pauses, and
    both are art decisions. The exporter can still author them from a speed.
  - Speeds: the art keeps walkers at ≤ 12 native px/s calm (built) and ≤ 24 hurried
    (without), so at the painter's 12 repaints/s a step is 1–2 px and never jumps.
- **Paint order is fixed: array order, including for walkers.** The painter does not
  re-sort on a tick (D-035: the painter stays dumb). The exporter only authors paths along
  which one fixed position in the order is correct, and `check_scenes.py` proves it by
  sampling every walker every 100 ms of its loop and comparing the painter-order render
  with the pipeline's own depth-sorted render of the same moment, pixel for pixel.
- **Who may move.** Only entries with no `gagId` may carry `walk`. A gag's parts animate in
  place or not at all, so a gag's key object never leaves its hotspot rect. A walker's
  swept box (the union of its sprite box over the whole path) never intersects any
  hotspot rect, primary or not, in any view, with no exemptions (D-038 item 3).
- **Same person across the toggle (D-041 item 1).** A given person has the same `sprite`
  (look) in `built` and `without`; `frame`, `motion` and position may differ. Poses
  differ, outfits do not.
- **Close-ups (D-042 item 3).** A close-up is a crop of its room, in time as well as in
  space. The exporter copies a room entry's `motion` into the close-up, translating every
  `to` by `(−rect.x, −rect.y)` as it does `x`, `y`; `start` and `rate` are copied unchanged.
  A walker is included in a close-up if its swept box meets the close-up `rect`, even if its
  rest pose does not. The painter applies no offset and resolves nothing.
- **What the checks add** (Art Director's `check_scenes.py` and the Part A haiku pass):
  every `motion.walk` frame names a real key of that sprite; every file of an animated key
  has `duration > 0` and the key's shared canvas and anchor; loops close; `start` and
  `rate` are in range; the paint-order proof above; walkers never meet a hotspot;
  a close-up at any sampled `t` equals its parent room's render at that `t` cropped at
  `rect`; and at `t = 0` every view equals today's golden. The contract test
  (`scene-contract.test.ts`, Web Engineer) can check all of these except the pixel ones
  from the JSON alone.
- **What the painter owns (Part B).** One ticker, ≤ 12 repaints/s, only when some visible
  entry's frame or position changed; stops when motion is off, the tab is hidden or the
  box is out of view, and resumes from the current `t` without replaying a backlog. A tick
  repaints the canvas only, never the DOM.
