# Band-crossing moments: the beat table (PH2-03 step 1, D-045)

When the visitor drags *up* into a year band in the built state, that band's threat arrives
and meets what was already built. The rules (when it plays, ≤ 2.5 s, ends on the exported
built scene, cancels on any input, no moment under reduced motion) are in the
PH2-03 brief and are not repeated here. This file is the design
input for step 2 (Art Director) and step 3 (Web Engineer).

**Captions: none, in every band.** The default is no caption, and no band earned one (see
below). No served copy changes, so `content.json`, `PANELS.md` and the content pipeline are
untouched, and step 3 reserves no caption line.

## Where each beat plays

The default close-up is the view with `"default": true` in
`public/sprites/scenes/<band>-built.json`, which is where a slider change lands (D-042a).
Checked against the files on `develop` at `3882972`:

| Band | Default close-up | Primaries in it | Chosen gag | Its primary is in it? |
|---|---|---|---|---|
| 80 | n/a | n/a | **none** (landing on 80 is never a crossing) | n/a |
| 150 | `floor-2.1` Finance corner | G4.2 desk, G4.3 desks | **G4.2** | yes, `desk` |
| 220 | `floor-2.2` Conference room | G2.4 room, G7.3a board | **G2.4** (beat replaced) | yes, `room` |
| 360 | `ground.1` Closet | G1.1 closet, G3.2 trolley, G5.3 server | **none** (G5.3 dropped in step 2, below) | n/a |
| 490 | `ground.5` Helpdesk | G2.1 helpdesk, G3.1 desk | **G3.1** | yes, `desk` |
| 610 | `ground.3` Sales pit | G1.2 pit, G2.2 cable, G4.1 door | **G4.1** | yes, `door` |
| 750 | `ground.3` Sales pit | G1.2 pit, G4.1 door, G7.1 robot | **G7.1** | yes, `robot` |
| 1,000+ | n/a | n/a | **none** (not a year band, D-029) | n/a |

At 360, G5.3 is the only one of that band's gags in its default close-up. At 490, 610 and
750, the chosen gag is the only current-band primary there. So there was no choice to make
except at 150 (G4.3, two CRMs) and 220 (G7.3a, the hat), and in both the proposed gag
stays.

## The beats

Each beat is the gag's approved **Already** line in `BANDS-AND-GAGS.md`, played forward.
Nothing is claimed that the panel does not already say. The threat is an event, and nobody
in the building fails. The end frame is the exported built scene.

| Band | Gag · receipt | Beat (≤ 2.5 s) | Reuses | Art note: what makes it read cold at 390 px |
|---|---|---|---|---|
| 150 | G4.2 · E-20 | The hook drops in front of the finance worker's monitor, strikes the small shield, and pulls back up. The `REPORT` card lights as it withdraws. | `fishing-line`, `fishing-shield`, `card-report` (all in the end frame but the line) | The hook must travel far enough to read as a *descent*, starting from the ceiling edge of the crop and not from mid-air. The strike is one held frame (≥ 200 ms) before the retreat. The `REPORT` card is visible in the end frame, so it should flash on, not appear from nothing. |
| 220 | G2.4 · E-25, E-01 | The wall screen is dark. It lights with the remote face, the face waves, and the seated worker nearest the screen waves back. | `tv-live`, `camera-bar`, `worker-seated-wave-*`; one new frame: the screen dark | **Replaces the brief's dongle walker.** A dongle is 2–3 art px at 2 css px, so "walks in carrying a dongle, sees the camera bar, sits" has no readable object, and "sees" is an inner state the pixels can't show. Carrying a dongle into the built room also puts a without-state prop in the built state. The Already line is "the remote face moving, the wave returned", and the wave is the beat. The screen must go dark → face in one cut, not a fade. The wave back is by someone already seated (the same person in both states), not a new walker. |
| 360 | G5.3 · E-09 | A worker carries a box fan in toward the rack, stops at the `VIRTUALISED` badge, and carries it back out. | `box-fan`, `card-virtualised`, `rack`, a walking worker | This is the one I rate **at risk**. It reads only if the fan is recognisable, so carry it chest-high and make it the largest moving shape, the same box-fan sprite as G1.1 and G5.3 without. The stop has to be at the badge, and it has to be a pause (≥ 300 ms) and then a turn, not a bump. The walker must not cross G1.1's `closet` or G3.2's `trolley` hotspot, so enter from the right edge along the front of the room. If the CEO's picture review rates it below *reads*, 360 ships with no moment. |
| 490 | G3.1 · E-03 | The new hire walks in with a bag and sits at the desk that is already set. The laptop screen comes on as they sit. | the G3.1 desk (laptop, badge, coffee, one-page calendar), a walking worker | Without a cue it's "someone sits down". The screen coming on at the instant they sit is the beat: day one, already working. The walker is the seated worker in the end frame, so the same person is in both. The path must not cross G2.1's `helpdesk` hotspot or the queue. No number of any kind (D-012). |
| 610 | G4.1 · E-04 | The auditor walks up to the shut front door. It opens, and the `infosec` worker in the doorway shakes hands. In the pit, the `$` bubble stays gold. | `auditor` (walk, `wait`, `shake`), `front-door` (`shut`, `open`), `infosec` | This is Q-20's own example and the strongest beat. Hold the shut door a beat (≥ 300 ms) with the auditor waiting, so the open reads as an answer. The `$` bubble doesn't animate: the point is that it doesn't fade. The built scene's end frame already has `auditor` in `shake`, `front-door` `open` and `infosec` in the doorway, so the beat only has to walk up to it. The InfoSec person is the answer, not a new walker. |
| 750 | G7.1 · E-12 | The robot rolls in and stops at the small document gate. A document passes through the gate, and the badge turns to `APPROVED`. | `robot` (walk, `approved`), `doc-gate` | The order (gate first, then the badge) is the whole point of E-12: the tool and the policy arrived together. The robot must not eat, reach for or hold a document at any point, so the without joke never leaks into the built state. It enters from the right edge and doesn't cross G4.1's `door` or G1.2's `pit`. |

**360 was dropped in step 2 (PR #51, DIA-101).** No walker can reach the rack or the
`VIRTUALISED` badge without crossing G3.2's `trolley` or G1.1's `closet` hotspot, so the beat
can't be staged within the rules. Per this file's fallback, 360 ships with no moment and no
caption. Five beats ship: 150, 220, 490, 610, 750.

## Why no captions

- **150, 610, 750:** the picture already carries a word (`REPORT`, `AUDITOR`, `APPROVED`).
  A caption would just repeat it.
- **220, 490:** a caption would have to explain the joke ("the call connects",
  "day one, ready"). That is the picture needing the caption, which `TONE.md` and the brief
  treat as a broken picture, not a copy problem.
- **360:** a caption can't rescue a fan that doesn't read. The fallback is no moment, not
  words.
- Every caption I could source is a year and a role or tool that the panel states one tap
  away (for example "2023: an InfoSec Manager, before the auditor", E-04). It adds no fact,
  costs a reserved line of layout, and competes with the toggle for attention. A visitor
  who wants the receipt taps the object.

If step 2's review finds a moment that reads *only* with words, the rule is to cut the
moment, not to add a caption.
