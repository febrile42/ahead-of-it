# Tone

Two registers, kept strictly apart.

## The pixels: warm, comic, specific

- Every gag is legible from the picture alone. If it needs a caption to be funny, it is
  not a gag yet.
- **Nobody in the building is stupid.** Failures are systemic. The developer with a queue
  at his desk is a hero doing two jobs. The finance person under the invoices is a victim
  of a function that doesn't exist. The worker feeding documents to the robot is being
  productive with the tools available. We laugh at the *situation*, never at the person.
- Exaggeration is allowed and encouraged here: a box fan in a closet, a fish on a line,
  a moving truck at a 100k sq ft shell. This is where the cartoon lives.
- The built state is not smug. Workers relax; nobody high-fives. The fix is boring on
  purpose, because good infrastructure looks boring.

## The panels: dry, precise, about the reader

- Second person, present tense, addressed to the visitor's company: "Around this size,
  the first enterprise customer asks for a SOC 2 report." Never "I did X" as the opener.
- **The strip** (R-04a) carries year · headcount · descriptor for every panel, so prose
  need not repeat them — but the Already still states the year and headcount in words
  where they are the point.
- **Vary the prevention opener.** Not "at this size" every time: "by now", "by 150",
  "around now", "the week after you sign the lease", "with a second office". Put the reader
  in it — "your", "you" — in at least half of them.
- **The Already names a choice, not a purchase.** "I chose not to have a server room"
  beats "I deployed M365". Where the sources give an alternative, say what it was.
- Structure, always in this order (D-021):
  1. **Already built** — the lead. Year, headcount, what Josh did, the number. Past tense;
     first person allowed here and only here. Every number traces to an `E-xx`. This is
     the line that makes the built-state object legible.
  2. **What it prevented** — the gag, in one or two plain sentences, addressed to the
     visitor's company: "Around this size, the first enterprise customer asks for a SOC 2
     report." Honest confidence: "usually", "around". Never "you will".
  3. **Worth it later** — where a later receipt exists (six offices on the 2018 identity
     decision; 29 rooms on the first two), one sentence. Where none exists, omit — do not
     manufacture a payoff.
- **Employer descriptors (D-014, amended): neither company is named.** Fixed phrases,
  first mention in a panel → thereafter:
  - current, panels dated 2023 or later: *"a $3B+ clean-energy company"* → *"the company"*
  - current, panels dated before 2023 (it was not $3B+ then): *"a clean-energy company,
    now $3B+"* → *"the company"*. Both forms are deliberate (mastermind ruling
    2026-09-16; the 2026-09-24 panel check's "wrong descriptor" finding was a false positive).
  - previous: *"a $200M company on a nine-building campus"* → *"the campus"*
  Cities and years are fine. Panels that cite both in one breath say "at the campus
  company in 2013, and again at the clean-energy company in 2019".
- No adjectives about Josh. "Transformational" is banned. The receipt does the work.
- Numbers are written as on the resume; do not round up, do not add precision that isn't
  there. "$500,000+" not "half a million". "99.96%+" not "four nines".
- Length: ≤ 110 words per panel. A recruiter is on a phone.
- One contact link at the bottom of every panel (R-12). No CTA copy beyond "Talk to Josh".

## Sample panel (voice reference) — G4.1, the auditor at the door · band 610 / 2023

> **A security function, before the auditor arrived.**
> In 2023, at ~600 people, I hired an Information Security Manager and stood up the policy
> framework, audit readiness and cross-department compliance workflows, targeting ISO 27001
> and SOC 2 inside 18–24 months. A Security Analyst followed in 2025. `[E-04]`
>
> **What it prevented:** around this size an enterprise prospect's procurement team asks
> for a SOC 2 report before they'll sign, and the honest answer — with no program and no
> one whose job it is — is "no". The deal dies in procurement, not in the budget.
>
> **Worth it later:** the second audit is cheaper than the first. *(Only if true;
> otherwise omit this beat.)*
>
> Talk to Josh →

(98 words. "Transformational" appears nowhere.)

## Toggle and share copy (D-022)

- Toggle, built → without: **"See it without him"**. Without → built: **"What he'd already built"**.
- Nudge (once, after the first slider move): *"Now see what this looks like without him."*
- Share caption: *"By the time the company was your size, Josh had already fixed this."*
- OG title: *Ahead of It — Josh Gister's résumé* (D-010, decided 2026-09-24). Slider label: *at your scale*.
- **Contact (R-12, D-019; Josh 2026-09-24):** email `joshua.gister@gmail.com` — assembled
  client-side, never a plain `mailto:` in the source. LinkedIn: `https://www.linkedin.com/in/joshgister/`.
- **OG description / tagline (F-4, D-027):** *Build it, then make sure it doesn't need you.*
  Also the subtitle under the toggle, in **both** states (D-053). The nudge takes that slot
  while it shows; otherwise the tagline is there, so the slot is never empty.

## Page state copy (D-053)

What the page says about its own state: the toggle, loading, a failed load, and the slider
readout (DIA-194 U-10, U-11, U-17). Plain signposts, like §Navigation copy. They add no
date, headcount or figure of their own and name no employer (D-014). `{n}` is the visitor's
number as the readout shows it today, and `{year}` is the band's year. Served as
`content.json` `ui.<key>` once the pipeline knows the keys.

| key | copy | where |
|---|---|---|
| `announceWithout` | `Showing the building without him` | Live region, once, when the toggle switches to "without". The button's own name stays the action (§Toggle and share copy). |
| `announceBuilt` | `Showing what he'd already built` | Live region, once, when the toggle switches back to built. |
| `loading` | `Loading the building…` | Centred on the mat colour in the scene box, 300 ms into a load that hasn't painted. Quiet, not a spinner. |
| `loadFailed` | `The building didn't load. Everything in it is in the punch list.` | In the scene box when the scene or its sprites fail to load. Replaces "not drawn yet" for the visitor. |
| `retry` | `Try again` | Button under `loadFailed`; re-requests the scene. |
| `readoutAtBand` | `~{n} → {year}` | The slider readout when the visitor's number equals the band's headcount (first paint at 80 reads `~80 → 2018`, not `~80 → 2018, ~80`). Otherwise the readout is unchanged. |

## Share control copy (D-057)

The "Share image" control (D-057 item 7): a secondary pill that always hands over the
**without** picture of the current stop, from either state. The visible label says which
picture it is, in the toggle's own words, so from the built state it also points at the
toggle. The accessible name starts with the visible label (WCAG 2.5.3) and adds what the
visitor gets. It adds no date, headcount or figure and names no employer (D-014). Served as
`content.json` `ui.<key>`.

| key | copy | where |
|---|---|---|
| `shareButton` | `Share it without him` | Visible pill text, below 1152 px in `#view-nav` opposite the punch list, from 1152 px in the rail under the toggle's message slot. |
| `shareButtonName` | `Share it without him: a picture of this building` | Accessible name (`aria-label`) of the same control. |

## Landing copy (D-051)

The page's own introduction (DIA-161). It is plain and says what the page is and what to do
first. It adds no date, headcount or figure and names no employer (D-014). The toggle sits
directly under the slider and keeps its own words, so the lede does not repeat "without
him". These are served as `content.json` `ui.<key>` once the pipeline knows the keys.

| key | copy | where |
|---|---|---|
| `intro` | `Josh Gister's résumé, as a building. Slide to your company's headcount: everything you can tap was already in place by the time his company was that size.` | Lede paragraph under the `h1`, above the slider. Height is reserved in the static shell. |
| `roomHint` | `Tap an area to zoom in` | Visible stepper text in the room view, replacing the `{room}: whole floor` text there. The room is already named on the active tab. `announceRoom` is unchanged. |

## Navigation copy (D-042a)

The close-up navigation's strings (brief D042-W item 8). Plain, short, functional: these
are signposts, not jokes, and they never mention Josh or an employer. `{placeholders}` are
filled by the web: `{room}` a room's label, `{label}` a close-up's label (both from the
scene file, ≤ 24 chars, reviewed separately), `{n}` a close-up's position and `{total}` the
band's close-up count in array order, `{count}` the gags whose one primary is in that room.
Wording avoids plurals that break at 1. Served as `content.json` `ui.<key>`.

| key | copy | where |
|---|---|---|
| `wholeFloor` | `Whole floor` | Stepper-row control that toggles the room view; one label, state via `aria-pressed`. |
| `previous` | `Previous close-up` | Accessible name of `‹`. |
| `next` | `Next close-up` | Accessible name of `›`. |
| `position` | `{label} · {n} of {total}` | Visible stepper text. |
| `zoomIn` | `Zoom in: {label}` | Accessible name of each room-view "zoom in" button. |
| `atStart` | `No earlier close-ups` | Live region, when `‹` is pressed at the first close-up. |
| `atEnd` | `No more close-ups` | Live region, when `›` is pressed at the last close-up. |
| `roomTab` | `{room} ({count})` | Visible room tab text. |
| `roomTabName` | `{room}: {count} to tap` | Accessible name of a room tab. |
| `announce` | `{room}: {label}, {n} of {total}` | Live region, on every close-up change. |
| `announceRoom` | `{room}: whole floor` | Live region, on entering the room view. |
