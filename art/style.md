# Style-reference sheet (PH1-02 art spike)

Locked after this spike (D-024). Every later asset is generated *against* this file, not
against another asset.

## Geometry

- **Floor tile:** 32w × 16h canvas, a 2:1 isometric diamond (standard "true isometric"
  screen projection, not engineering/dimetric). The diamond's four vertices sit at
  `(16,0)` top, `(32,8)` right, `(16,16)` bottom, `(0,8)` left, inset 1px for the outline.
- **Wall segment:** 32w × 48h canvas — an 8px-tall diamond cap (same width as the floor
  tile, so a wall's footprint lines up with the tile under it) sitting on top of a 40px
  vertical face. Windows are cut into the vertical face.
- **Desk group (desk + chair + monitor):** 32w × 32h canvas, drawn as a small isometric
  box (top face + two visible side faces) with the chair to the front-left and the
  monitor on the back-right corner of the desk.
- **Worker:** 16w × 24h canvas, fixed by brief. Chibi proportions (~2.5 heads tall).
- **Badge reader:** 12w × 20h canvas, wall-mounted panel prop.

## Rendering rules

- **1px outline**, always `outline` (`#1A1410`), on every silhouette edge. No other
  colour is used for line work.
- **Light from top-left.** Every extruded surface gets a lighter tone on the
  top/left-facing plane and a darker tone on the bottom/right-facing plane. This is why
  the palette carries paired tones (`floor-top`/`floor-left`/`floor-right`,
  `wall`/`wall-shadow`, `desk-wood`/`desk-wood-dark`, `shirt-1`/`shirt-1-dark`).
- **Integer scaling only.** Sprites are authored and shipped at 1× (native pixel
  resolution). Preview images are upscaled by a whole-number factor (4×) using
  nearest-neighbour resampling — never smoothing, never a fractional scale.
- **No anti-aliasing.** Every fill is a flat, exact palette colour; edges are hard steps,
  not blended. This is also how the palette-only check can be a strict equality test.
- **Palette-only.** Every non-transparent pixel in every shipped PNG must be one of the
  named colours in `art/palette.json` (24 from the spike + 8 added in PH1-06 = 32, the
  cap). Transparent pixels are the only exception. Colours are reused across materials
  where the value fits (the green shirt is `badge-green`, blond/auburn hair is
  `desk-wood`, white labels are `paper`); a new colour is added only when nothing close
  exists.

## Shadows (PH1-06)

Every sprite that **stands on the floor** carries its own ground-contact shadow, baked
into the PNG and drawn *before* the object so the object sits on it. Wall-mounted props
(badge reader, SLA board, cable tray) and floor-flush pieces (tiles, a taped cable) do
not.

- **One colour:** `shadow` (`#8E7A55`), a flat tone darker than every floor tone. No
  dithering, no alpha — it's a pixel like any other.
- **Direction:** light is top-left, so shadow falls toward screen down-right (world +c).
- **Characters:** a flat 2:1 ellipse under the feet — 7 / 11 / 9 px wide on the three
  rows 21–23 — centred 1 px right of the body's centre line. Feet stand on it; a lifted
  foot (walk passing frame, step-over) shows floor colour between foot and shadow.
- **Furniture / boxes:** the footprint grown 1–1.5 world units toward +c and ~0.5
  toward +r (`vox.Iso.floor_shadow`). It shows as a band down the right side and a
  sliver along the front, and fills the floor visible *under* open furniture (between
  desk legs, under a chair).

## World units (PH1-06, `art/src/vox.py`)

New geometry is built in world units rather than screen pixels: one floor tile is 8 × 8
units, `+c` runs screen down-right, `+r` screen down-left, `+z` up, and
`screen = origin + (2·(c − r), (c + r) − z)`. Boxes are rasterised by inverse projection
(which face is under each pixel centre), so every edge is the standard two-across,
one-down stair and a one-tile box covers exactly the floor-tile diamond. Faces: top
(brightest), `+r` face ("left", lit), `+c` face ("right", shaded) — the same three-tone
rule as before. Screen content, stickers and labels on a face are painted in that face's
own coordinates (`Iso.paint`) so they skew with it; text that must be *read* (`DEV`,
`CAUTION`, `VISITOR`, the SLA board) is billboarded flat instead, in the 3 × 5 glyph set
in `art/src/glyphs.py`. No font files, ever.

## Anchors

Every sprite's placement point is **bottom-center of its canvas**: `(w/2, h)`. This is
the point where the object visually touches the floor tile beneath it (the diamond's
front/south vertex for floor-tile-shaped sprites, the feet for the worker, the base of
the panel for the badge reader). The isometric grid places a tile's anchor at
`screen = origin + ((col - row) * 16, (col + row) * 8)`; every other sprite on that tile
is pasted so its own anchor lands on that same screen point, which is how a 48px-tall
wall and a 16px-tall floor tile stack correctly on one grid cell without per-asset
fudge factors.

| Sprite | Canvas | Anchor (px) |
|---|---|---|
| floor tile | 32×16 | (16, 16) |
| wall segment | 32×48 | (16, 48) |
| desk group (every variant) | 32×40 | (16, 40) |
| worker (per frame) | 16×24 | (8, 24) |
| badge reader | 12×20 | (6, 20) |
| worker-seated (per look) | 32×40 | (16, 40) — same as the desk; paste on top of it |
| worker-queue (per look/facing) | 16×32 | (8, 32) |
| visitor | 16×24 | (8, 24) — on the floor in front of the sofa seat |

**PH1-06 props and room pieces** (walls, partitions, closet, sofa, rack …) are cropped to
their pixels, so their canvases vary. The rule is unchanged in meaning: the manifest
`anchor` is the screen point of the **front vertex of the tile the sprite is placed on**
— exactly what `iso.iso_to_screen(col, row)` returns — even when that point is below the
drawn pixels (a wall on a tile's back edge, a firewall on top of a rack). Multi-tile
props (the sofa, the shelving) anchor on their rear-most tile. Billboards not tied to a
tile (`tag-visitor`, `sla-board`, `wifi`) anchor where they touch what they belong to:
the tag's tail tip, the board's feet. Entries may also carry `points`, e.g.
`"net": [x, y]` — where a network line attaches, in the sprite's own pixels.

## On the network (PH1-06, G2.3)

"This device is on the network" is a dotted line in `net` (magenta — the only colour in
the palette nothing else uses), 1 px dots, one lit pixel every 3 along the dominant
axis, each with a 1 px `outline` pixel under it so it reads on floor and wall alike
(`vox.dotted`). Lines run from one sprite's `net` point to another's and are drawn over
everything except billboard labels. Without: the visitor's laptop to the router and to
every monitor. Built: the visitor's laptop to the firewall, and it stops there.

DIA-5: the lines start at `wifi-card`, a paper callout with the Wi-Fi fan on it in `net`,
its tail on the laptop, in both states. It names the dots; where they end is the gag.
The same dotted line is how the street's link crosses the open ground between HQ's plot
and the inset office's (`link-hop-r`, `link-hop-c`): off the road, the link is the
network.

## Cutaway rooms (PH1-06)

Back walls are full height (40 units). Walls that would hide a room's contents — the
closet's front partitions — are cut away at 7 units, with a dark (`chair-dark`) cut
top: the dollhouse convention, and the architectural sign that the wall continues up.

**Upper floors (DIA-5).** Every view but `ground` stands on the storey below it:
`slab-l-upper` / `slab-r-upper` are the slab plus 15 units of exterior wall with one
window per tile, HQ's window from `street.py`, cut off square. That is what says
"upstairs"; a room with only a slab reads as a second ground floor.

**The street is two plots (DIA-5).** HQ's plot and the inset office's plot each have
their own slab, with open ground between them (`ROOMS["street"]["plates"]`). The road
leaves one plot and arrives at the other; on one shared plate the inset read as HQ's
annex. HQ's plot runs a column past the block on its shaded side, where the block
throws most of a tile of shadow (`floor_shadow(grow=7)`): a 2-unit rim read as floating.

## Looks and poses (PH1-06)

| look | shirt / shade | trousers | skin | hair |
|---|---|---|---|---|
| a (`worker`) | `shirt-1` / `shirt-1-dark` | `pants-1` | `skin-1` | `hair-1`, short |
| b | `badge-green` / `shirt-2-dark` | `desk-wood-dark` | `skin-2` | `outline` (black), short |
| c | `badge-red` / `shirt-3-dark` | `pants-1` | `skin-3` | `hair-1`, long |
| d | `paper` / `wall-shadow` | `shirt-1-dark` | `skin-1` | `desk-wood` (auburn), long |
| e | `badge-green` / `shirt-2-dark` | `pants-1` | `skin-3` | `outline`, long |

Each look ships the walk cycle plus `idle-{down,up,left,right}` and
`step-{right,left}`. `worker-queue` (laptop overhead) and `worker-seated` are separate
entries keyed by look because their canvases differ.

## Worker walk cycle

4 directions (`down`, `up`, `left`, `right`) × 4 frames, rebuilt in PH1-06 so all three
authored views share the same four beats:

| frame | beat | legs | arms | body |
|---|---|---|---|---|
| 0 | contact | one foot forward, the other back (front view: back heel up 1 px) | opposite arm forward, the other back | down 1 px |
| 1 | passing | the back foot lifted 2 px as it swings through | neutral | up |
| 2 | contact | mirrored | mirrored | down 1 px |
| 3 | passing | mirrored | neutral | up |

Front/back arms swing by *length* (forward 7 rows with the hand showing, back 4 rows,
hand hidden) — a 3 px difference, matching the side view's ±2 px leg travel. `left` is
still not authored: it is `right` mirrored horizontally (`Canvas.mirror_h`).

The worker is built from outlined *blobs* (`art/src/sprites/worker.py`), with colours
as roles (`t` shirt, `s` skin, `h` hair …) resolved per look, which is how outfits and
hair/skin variants are palette swaps rather than redraws.

## Animated props and preview-only sprites (PH1-07)

A prop can carry an animation next to its still: the manifest entry keeps `default` (the
still, for anything that doesn't animate) and gains a named key whose frames all share
the still's canvas size and anchor, each with a `duration` in ms (`vox.make_anim`).
`closet-shelf` has `blink` (the router's LEDs, 2 × 350 ms). An entry marked
`"preview_only": true` (`tag-visitor`) exists for the 4× previews and is not drawn by the
site renderer.

## Legibility at 1× (PH1-07)

A gag's key object must read at native size, not only in the 4× preview:

- **The router** sits on *top* of the closet shelving, the darkest and widest thing there
  (22 px), four antennas silhouetted against the wall, every cable in the closet
  converging on its port row.
- **The visitor** wears a dark jacket nobody on staff wears and an oversized name-tag
  sticker: red band, `VIS` in the 3 × 5 glyphs on white, 11 × 7 px. The `VISITOR` callout
  above the sofa is preview-only.
- **`worker-peel`** (G1.2): a standing worker at a colleague's desk, arm stretched to the
  monitor (frame 0), then holding the note up to read it (frame 1, which also paints the
  clean screen back over the note). Same 32 × 40 canvas and anchor as the desk; paste over
  `desk-postit`.

## Band 150 (PH1-07)

- **Turned props.** `vox.SwapIso` draws the same world-unit code with c and r exchanged,
  so a desk can face +c (`desk-turned`, `desk-turned-sheet`, `worker-seated-turned`).
  Colours stay screen-side and shadows still fall toward +c: the light does not turn.
  Nothing readable is painted on a turned face (it would run right-to-left).
- **Cards on monitors.** Desks carry a `card` point (middle of the monitor's top edge).
  `card-customers` hangs from it; `card-report` is a button centred on the `net` point
  (mid-screen). Cards are billboarded 3 × 5 glyph text, like `DEV`.
- **Glyphs.** `M` is now 5 wide (3-wide read as `H`); added `(`, `)`, `Q`, `X` and `>`
  (drawn as an arrow, for `CRM>ERP>HRIS`). `?` has a flat top.
- **The street.** `road-r`, `road-c`, `road-turn` tile like the band-80 floor cable:
  asphalt with a white dashed centre line (the "dotted line" the truck drives on).
  `link-r/-c/-turn` lay the built state's solid `net` link along the same centre line and
  `blink` a packet (2 × 300 ms). A dashed road is not the network; a solid magenta line is.
- **Doorways.** `partition-c-door-open` (HQ's front door, front-left edge) and
  `partition-r-doorway` (the inset office's, front-right edge) keep the cut walls but stand
  a full-height frame, so the opening reads as a door. People in a doorway are depth-sorted
  by hand: the one inside below the frame, the one outside above it.
- **Poses.** `worker-reach` (seated, arm up at the bait), `worker-printouts` (26 × 24,
  a sheet in each hand, looking left then right), `worker-give` (24 × 24, profile, padded
  envelope out; `<look>-left/-right`), `courier` (same canvas; brown uniform and cap),
  `worker-watch` (forearm across the chest, eyes down, then up). All in `poses.py`.

## Band 220 (PH1-07)

- **The plate grows, nothing moves** (R-03a). `layout.py` holds every room as data; band
  220 is band 150's plate extended to 16 columns. Earlier bands' items keep their tiles
  and drop to their minimum legible form (`quiet`); the current band's gags are full.
- **Glass is cut away** like any wall that would hide a room: aluminium sill, panes to
  11 units with a frosted band and one glint, a `glass-highlight` cut top. Only thin
  things stand full height: the room's front corner posts (`glass-c-corner`,
  `glass-c-end`) and the door frame (`glass-r-door`). Full-height glass with glints
  made the people inside unreadable.
- **The conference room** (12..15, 0..2): without, four workers from behind
  (`worker-huddle`, one `-dongle` with an adapter held up) at the table's two ends so
  the single laptop and its cable up to the frozen, pixelated face (`tv-frozen`, spinner
  `blink`) stay visible; built, four seated, `camera-bar` over `tv-live` (`talk`).
- **G7.3a** stands on open floor in front of the new bay, clear of the glass and of
  G4.3: `whiteboard-requests` (FEATURE / REQUESTS / OWNER:?) with `sales` (shirt, red
  tie) and `engineer` (grey hoodie, headphones) pointing at each other across it;
  built, `whiteboard-owned` and `worker-hat` (`<look>-left`: marker hand on screen left;
  the body mirrors, the hat text is drawn after so it never does).
- **Depth by hand.** Long props break the col + row sort; anything outside the glass
  keeps fc + fr > 19 so it draws after the front glass.
- **Glyphs.** `W` is 5 wide (3-wide read as `H`), as `M`.

## Rooms, not crops (PH1-10)

- **One view, one room** (D-036, D-037 item 8). `ground` is HQ's ground floor (10 x 7);
  `floor-2` is the room one storey up (8 x 7 at 150, grown to 12 x 7 at 220 for the
  glass room); `street` is an exterior pavement plate (10 x 8) with HQ, the road and
  the inset office on it. Each has its own walls, floor and slab (or kerb), and the
  canvas is fitted to the room with 2 px clear all round.
- **Ground floor, re-spaced for 44 px** (D-036 rule 7): closet in the back corner, the
  lobby sofa and the front door on the back-left wall, the developer and the queue down
  the back-right wall (the built support desk stands where the queue stood), the pit
  mid-floor, the taped cable across the front with its sign and a step-over, and clear
  floor outside the closet door for band 150's trolley.
- **The street.** HQ is a block (`hq-3` at 150, `hq-4` at 220: ground storey 28
  units, 20 per storey above, flat roof behind a parapet, no sign or name) with its
  front door (`hq-door`, `open` / `closed`, an awning) on the front-left face; the road
  runs out of the door toward the viewer and round to the inset office's doorway.
- **Trolley (G3.2).** Chrome wire — a light grid over a basket full of dark laptops,
  so it reads as wire, not a box — raised on a chassis (rails, legs, a castor at each
  corner, daylight under it), two lids open and leaning back, the handle and its red
  grip at the +c end where only floor is behind it, the note low on the near side.
- **Cable (G2.2).** One continuous 2 px blue cable, outlined, with short grey tape
  strips about every 6 px (`TAPE_EVERY`), routed across open floor well inside the
  slab; the step-over straddles it at the crossing, beside the CAUTION sign.
- **G2.4.** Conference-size TV (22 x 19 units) in both rooms; faces drawn at screen
  aspect (a face unit is 2 px wide, 1 px tall), freeze blocks square on screen. Both
  ends of the stalled call are frozen mid-wave: the conference TV shows the inset's
  person (red), `tv-frozen-inset` shows HQ's (green). In the inset, nobody stands in
  front of the screen; `worker-wave` (profile, near arm up, mouth open) stands beside
  it. Built: `tv-live-inset` under `camera-bar`, and `worker-seated-wave` on a bare
  `chair` facing it. The adapter is `sticky` yellow.
- **G4.2.** The finance desk stands a tile off the wall; a long rod angles down over
  the wall top; the line ends in a J-hook (ring eye, shank, bend, barbed point) with
  the envelope hanging from its bend above the screen, and `worker-reach`'s arm is a
  2 px diagonal up to it. Arm hooks in `seated_frame` draw on the desk canvas.
- **G1.2.** Post-its are outlined paper squares stuck on the monitor's corners and
  overhanging its edge, never screen pixels; `worker-peel` takes the bottom-left one
  (`NOTE_PEEL`).
- **The hat (G7.3a).** A rounded red crown, a white band with PRODUCT in the glyphs,
  a brim wider than both, set on the crown of the head so the face shows (38 x 36);
  the wearer stands clear of the board's OWNER: line.

## Bands 360 and 490 (PH1-11)

- **A band may re-compose a room.** Nine ground-floor primaries by 490 do not fit band
  80's 10 x 7 room at 44 px, so from 360 `ground` is a new 12 x 9 picture
  (`layout._ground360`). Placements carry `since` / `until` (the old room's items stop at
  360, the new room's start there) and keep their own `band`, so every earlier gag is
  re-placed in its quiet form and 80-220 stay pixel-identical. The street is re-composed
  the same way (`_street360`): HQ is a narrower block (`hq-5`, `hq-6`: 4 x 3 tiles) at
  the plate's back-right so six storeys fit 240 px and nothing on the left is behind it;
  the inset office grows to 5 x 5.
- **Ground floor from 360.** The closet runs down the back-left wall: router at the back
  (G1.1), `MAIN / SERVER` tower with two stacked fans and `DO NOT / TURN OFF` at the front
  (G5.3, the callback). The phone row stands beside it on the back-right wall; phones sit
  where a monitor would, so a seated worker never hides one, and their cords run in front
  of the chairs to one knot outside the closet door. The coin box's user stands at the
  row's end in profile (the gesture is the joke). The pit is mid-floor, the lobby by the
  front door, the trolley beside the closet, the taped cable in one run
  (`cable-tape-360`) round the front-left, the new hire (490) in the front-right corner.
- **Labels that are the joke are billboards,** in the 3 x 5 glyphs: `MAIN SERVER`,
  `DO NOT TURN OFF`, `-33%`, `VIRTUALISED`, the five hats, `FINAL` / `FINAL2` /
  `FINAL-real` (lowercase `r e a l` and `-`, `%` added to `glyphs.py`), `WELCOME!`.
- **G7.3** walks the aisle along floor-2's back-left wall (the room gains a row): without,
  one manager, arms out for balance, under five stacked hats; built, five people in the
  same aisle, one hat each (the PRODUCT hat at the whiteboard drops at 360: it walked).
- **G3.1** is a monitorless desk with a cubicle panel for the calendar; the new hire
  wears a maroon coat and a yellow knitted hat, so "still dressed to leave" reads from
  behind; the `WELCOME!` tag hangs to the right of the calendar, never over it.
- **G6.4** uses two segments of the inset's +c partition, a plain one between them: the
  badge door shut with its reader on the back post (the tapper stands beside it, not in
  front of the door), and the next door swung out into the street with a chair holding it.
- **Polish.** `note-dave` hangs on a string from the trolley's grip (anchor = string
  top); the frozen screens' spinner sits on a dark disc, eight dots with a fading tail.
