# 04 — Decisions

Append-only. Format: ID · date · decision · why · consequences. Superseded entries are
marked, never deleted.

---

**D-001 · 2026-09-16 · The concept is Occupancy.**
Chosen over twelve alternatives (`docs/brainstorm/IDEAS-2026-09-15.md`) because it is the
only format that could not be built from a typical IT leader's resume: it requires having
provisioned real buildings *and* run the abstract layers, twice, long enough to have receipts.
Consequence: the building is the spine; every other idea survives only as a gag inside it.

**D-002 · 2026-09-16 · Bands, not continuous growth.**
Seven snap bands. Companies break in steps; continuous growth would require procedural art
and would lie. Consequence: G-01, G-02, N-02.

**D-003 · 2026-09-16 · Stock art through Phase 2; custom art only against a locked list.**
Inverts the usual art-project failure (spend the budget before knowing the joke).
Consequence: G-03; Phase 1 will look generic and that is accepted.

**D-004 · 2026-09-16 · No LLM anywhere in the product.**
The writing is the differentiator. A model between the reader and it removes the thing
that is distinctive, and "ask my resume" is now a genre. Consequence: N-01; R-15 is
checkbox-driven, not free text.

**D-005 · 2026-09-16 · Cloudflare Worker, assets-only, own custom domain.**
Mirrors joshgister.com: same deploy model, same no-third-party rule, same branch flow, same
serving-hygiene lesson (lime served `.git` publicly until 2026-09-13). Consequence: R-21,
R-22, R-26; DNS cutover from lime's placeholder is a Phase 4 public action.

**D-006 · 2026-09-16 · Phase 0 is writing, and no code precedes sign-off.**
Content is the product; the site is the delivery mechanism. Consequence: G-04. The
scaffold commit contains docs only.

**D-007 · 2026-09-16 · Josh is never shown fixing anything.**
In the built state the team works and he is in the top-floor meeting. It is the resume's
actual thesis (built → handed off → trusted at the strategy table) as a sight gag, and it
pre-empts the "cute undercuts gravitas" risk. Consequence: R-07.

**D-008 · 2026-09-16 · Mastermind/worker split is mandatory.**
Session agent owns judgment and review; implementation is delegated by brief to sonnet,
mechanical work to haiku; content voice never below opus. Consequence: `CLAUDE.md`
"You are the mastermind" section and the routing table in 03.

**D-009 · (pending) · Rendering: vanilla canvas vs PixiJS.**
Proposed: vanilla canvas; switch only on measured failure at Phase 2. Decide at Phase 1 start.

**D-010 · 2026-09-16 · "Occupancy" is the internal name only.**
Josh: keep it for the repo, docs and briefs; the public-facing name is **TODO** and must be
chosen before Phase 3 exit (the share image and OG copy carry it — R-11). Until then no
user-visible string uses "Occupancy". Consequence: Q-2 reworded; Phase 3 gets the item.

**D-011 · 2026-09-16 · The engagement-survey ranking does not appear on the site.**
Josh: "leave this fact for resume." G7.4 is cut, E-15 is `withheld`. Do not re-ask.

**D-012 · 2026-09-16 · Onboarding is described, never quantified.**
No before/after time-to-provision measure exists (E-21) and none will be implied. G3.1's
panel describes the automation function's scope (E-03) and stops there. Consequence of R-30.

**D-013 · 2026-09-16 · The +33% capacity and the campus fiber are separate claims.**
the previous employer' +33% was WAN capacity (E-11); the nine buildings were linked by private
fiber (E-23). G5.1 uses E-23 only. Never attach the percentage to the fiber.

**D-014 · 2026-09-16 · The current employer is never named on the site.**
Josh: don't name the current employer; it's findable on LinkedIn by anyone curious. Served content uses
one fixed descriptor — **"a $3B+ clean-energy company"** on first mention in a panel,
"the company" after — and never the name, the logo, or the domain. City names and years
may stay: Josh accepts that the combination is identifying; the rule is about not
*saying* it. the previous employer is named (assumption A-1, reversible). A build-time check
fails CI if the string appears in the output (R-33). Internal docs may use the name freely.

**D-015 · 2026-09-16 · Many offices only. No campus topology.**
Josh: "the analogy for a campus is close enough to self-evident to avoid the double work.
If we have to choose, many offices is always preferred." R-09 is removed; R-10 drops the
`topo` parameter; band 5 becomes *The second office* with an inset in another city. G5.1
is reframed (Q-17). the previous employer receipts still apply — the problems are the same,
the building count isn't.

**D-016 · 2026-09-16 · First-party Umami with a modest event set.**
Via the existing `/u/*` proxy pattern (Worker `umami-proxy`), same as joshgister.com. Events:
`band_change`, `gag_open`, `switch_flip`, `punchlist_download`, `share_image`,
`contact_click`. Nothing identifying, no headcount value recorded (N-05 stands: we log
*that* the band changed, not *to what*). R-21 still holds — the proxy is first-party.

**D-017 · 2026-09-16 · No solar roof.**
Josh: not worth adding a roof for the nod; reconsider only if the chosen art already has a
roof that can flip. Dropped from R-xx; Q-9 closed.

**D-018 · 2026-09-16 · `noindex` at launch; publicity is a separate gate.**
The site ships unlisted (meta robots noindex, no sitemap, not linked from joshgister.com).
Before making it discoverable or linking it, a deliberate pass on professionalism and how
much of the resume is exposed. Added to Phase 4 as a gate that Josh opens explicitly.
The share image carries the URL regardless — unlisted, not secret.

**D-019 · 2026-09-16 · Contact = LinkedIn + crawler-obfuscated email. No form, no calendar, no PDF.**
R-12 updated. Email is assembled client-side (never a plain `mailto:` in the HTML source);
LinkedIn is a plain link. N-04 stands and the PDF is not linked at all.

**D-020 · 2026-09-16 · Art: stock preferred; investigate what < $100 buys.**
Phase 3 custom-art line becomes a Phase 1 research brief: survey commercially-licensed
isometric office / pixel-office packs under $100 (itch.io, Kenney, GameDev Market,
CraftPix), report licence terms, tile/sprite counts and gaps against the gag list. Decide
after. Commissioning is off the table unless research finds nothing usable.

**D-010 (amended) · 2026-09-16 · Public-name candidates.**
Josh proposes **"What Breaks Next"** (primary) and **"Load Bearing"** (alternative).
Mastermind recommendation: *What Breaks Next* — it is a promise to the visitor, it names the
mechanic, and it is already the share text. *Load Bearing* is the better title and the
worse first impression: it means nothing to a recruiter until explained. Awaiting Josh's
confirmation (Q-15). Not applied to any served string yet.

**D-014 (amended) · 2026-09-16 · Neither employer is named.**
Josh: "Drop the previous employer — keep the companies generic. The details live in my real
resume or LinkedIn." Assumption A-1 reversed. Descriptors in `TONE.md`; the CI check greps
for both names.

**D-020 (amended) · 2026-09-16 · Research result reframes the art question.**
Stock packs under $100 cover the building and generic furniture (~35% of gags), not the
gag-defining props, which exist in no pack because they are bespoke by definition. Plan:
Phase 1 builds on the ~$27 pixel_Salvaje pair (after Josh re-verifies the licence on the
live page and buys it — money and purchase are his actions) with placeholder props; the
prop question is Q-19. The single most-reused missing prop is the badge reader (three bands).

**D-021 · 2026-09-16 · The thesis is prevention, not diagnosis.**
Josh: "I don't want to focus on 'here's what breaks' — the goal is 'here's how Josh avoided
things breaking (so you should hire him).'" The visitor's company is still the subject,
but the argument is *what Josh had already built by the time the company was their size*.
Consequences are structural (default state, band definition, panel order, share copy) and
are proposed under Q-20 rather than applied silently. Supersedes the "what breaks next"
framing in 00-VISION principle 1 and the Q-15 name candidates built on it.

**D-022 · 2026-09-16 · Default state is built; the "without" state is the share.**
Josh: "for a resume it feels ok to illustrate what Josh has done — and keep the humor for
what makes the recruiter share it with friends. We want to encourage people to toggle to
see the gags." So: the visitor lands on the calm, built building; the toggle to "without"
is prominent and nudged (R-06a); the share image is the *without* state with the credential
as caption. Supersedes R-06's original default.

**D-023 · 2026-09-16 · Bands are Josh's real headcounts.**
80 · 150 · 220 · 360 · 490 · 610 · 750 (2018–2024+). The visitor's number snaps to the
nearest. Every band has receipts by construction; Q-14 is dissolved — each gag sits where
its receipt happened. Gag IDs (G1.1 …) are kept stable and no longer encode the band.
Supersedes D-002's round-number bands (still seven).

**D-024 · 2026-09-16 · Art is generated in-house first.**
Josh: "Let's try to generate all the assets ourselves. I will purchase stock or commission
only if we have trouble doing it ourselves." Reverses 03-RESOURCING's "don't generate final
art with image models" and D-020's stock-first plan. Mitigation for the known failure mode
(inconsistency across a tileset): one fixed palette, one tile size, one style-reference
sheet generated first and every later asset generated *against* it, hand-cleaned in a
pixel editor; a Phase 1 spike proves or disproves the pipeline on five assets before
anything else is drawn. Stock ($27 pair) and commissioning remain the fallbacks, in that order.

**D-025 · 2026-09-16 · G5.6 and G7.4 accepted; G5.5 merged into G2.4.**
Q-13: (a), own gag; the 2012 picture is workstations, portable hard drives and consumer
NAS. Q-17: KM gag approved; offices were VPN-linked from 2019, so G5.1 gains a current-
company receipt (E-27) and moves to band 150. Q-18: campus descriptor accepted. With every
year known, gags are re-placed (v5); G5.5's cross-city frozen face is the same joke as
G2.4's dongle meeting under offices-only, so they merge at band 220.

**D-026 · 2026-09-16 · Both states are cumulative; each band emphasises its own.**
At band N the built state shows everything built through year N (it is a résumé; nothing
un-happens). The "without" state likewise shows every gag through N, but *this band's* gags
at full size and earlier ones quieter, so that thin years (220, 490) still read as busy
buildings and band 750 stays legible. R-03a.

**D-027 · 2026-09-24 · The six panel forks.**
F-1 keep G5.3 and G5.6 both · F-2 keep G6.1 and G6.2 separate, cross-linked · F-3 the
first build (E-18) gets one line in G7.3 · F-4 "Build it, then make sure it doesn't need
you" is the OG description and the built-state toggle subtitle · F-5 G7.1's present-tense
beat stays · F-6 G2.4 gains a real Worth-it-later: the 2020 move home needed no AV
project (E-28). Trim order in `BANDS-AND-GAGS.md` stands; F-1 means G5.3/G5.6 are not a
merge candidate unless art forces it.

**D-010 (decided) · 2026-09-24 · Public-facing name: "Ahead of It".**
Hook on the share image and OG title, always framed *Ahead of It — Josh Gister's résumé*.
Tagline (D-027): *Build it, then make sure it doesn't need you.* Slider label: *at your
scale.* "Occupancy" stays internal. Phase 3 naming gate is satisfied.

**D-028 · 2026-09-24 · Band 220 gets a second gag: G7.3a, the PRODUCT hat goes on.**
Q-23. Product had an owner (Director of Product, two PMs, 2020) before there was a product
team; the hat walks off at 360 in G7.3. 26 gags + ambient; cap 28.

**D-029 · 2026-09-24 · A "Beyond" stop past 750 for large-org readers.**
Josh: the site is about what he did, and a recruiter from a larger org must not be left
with "we already have all that". Target seat: **the from-zero seat inside a big company**
(acquisitions, new regions, new business units, new tool categories). Past 750 the slider
has one more stop, `1,000+`; the building stops growing; one panel (PANELS.md "B") turns
the copy to the reader's organisation and the checklist gains a translation column
mapping each receipt to its large-org equivalent. Not a year band (G-01 unaffected).
R-01b, R-14a.

**D-030 · 2026-09-24 · The certification target is not stated.**
ISO 27001 / SOC 2 was targeted in 2023 and later dropped. G4.1 keeps the function, the
policy framework and audit readiness — all real — and the "what it prevented" is about
having a program to show, not a certificate. Nothing on the site implies certification.

**D-031 · 2026-09-24 · Panel facts, round 3.** SSO+MFA 2018 and passwordless 2025 (E-29);
contractors on the same JML (E-30); Lawrence is the one office with servers/OT; guest Wi-Fi
segmented from 2018; Boston cabled before move-in; rooms standardised by function from
2018, kit unified 2023; DR restore tested at setup; $500K+ mostly recurring; fiber
2014–17; 40%/33% by 2014; facilities 2015–17; SVP reporting since H2 2022; Librarian role
since 2020, under IT 2026; email security = Exchange ATP + Area 1 via MSSP; badge removal
a manual offboarding step. All folded into PANELS.md v4.

**D-032 · 2026-09-24 · GitHub remote: `febrile42/ahead-of-it`, private.**
Josh's explicit yes via AskUserQuestion. Private because internal docs name both employers
and carry the headcount timeline. `develop` is the default branch (PRs target it); `main`
is promoted with merge commits. The Cloudflare secrets for CI are not yet set — that is a
Phase 4 step alongside the custom domain.

**D-033 · 2026-09-24 · Phase 1 started.** Briefs PH1-01…05 in `docs/briefs/`. PH1-01 and
PH1-02 running in parallel worktrees; 03 after 01; 04 after 01–03; 05 after 04.

**D-034 · 2026-09-24 · In-house art confirmed; sprite work routes to Opus 5.5.**
The PH1-02 spike passed (deterministic, palette-locked, coherent). Josh: "Continue in-house.
Ensure you are using Opus 5.5 for art style and animation as it is superior." So: the
pipeline stays (`art/`), and every sprite-drawing or animation brief is executed by `opus`,
not sonnet. Known weaknesses to fix first: desk/chair silhouette, front-view stride, no
ground shadows. Stock/commission fallbacks remain on paper only.

**D-035 · 2026-09-24 · The art pipeline exports scene files; the web is a dumb painter.**
PH1-04's scene was a flat elevation of floor strips, not the isometric room the art pass
draws (R-02). Rather than port composition to TypeScript, the art side exports per
band × state a placement list with explicit hotspot rects, depth, manifest-keyed
sprite/frame references, baked overlay sprites for procedural marks, and `views[]` from
day one; the art paints its own previews from that export, so the web canvas must match
pixel-for-pixel (a test). Contract: `docs/product/SCENE-FORMAT.md`. Cumulative composition
(R-03a) is the art side's job. Split: PH1-08a spike (opus), PH1-08b export (sonnet, after
PH1-07), PH1-09 painter (sonnet, after PH1-04 fixes). PH1-04's interaction plumbing merges
with fixes; its `slots/layout/assembler` are replaced.

**D-036 · 2026-09-24 · Views: option A, one view per gag-carrying floor, ≤ 360 px wide.**
Decided on the PH1-08a mocks (`art/spike/A-750.png` vs `B-750.png`;
`docs/research/FLOOR-CONVENTION-2026-09.md`). Rule, enforced by `check_scenes.py`:
1. View ids ∈ {ground, floor-2 … floor-6, top, street}, unique, in that order.
2. `ground` always exists; any other view only if it holds ≥ 1 primary hotspot.
3. `w ≤ 360`, `h ≤ 240` native px (not 390: at 390 a worker shrinks to 8–12 CSS px on
   360/375-wide phones); `focus` = the full view.
4. Each gag has exactly one primary hotspot, in its home view: ground G1.1 G1.2 G2.1 G2.2
   G2.3 G3.1 G3.2 G4.1 G5.3 G5.4 G6.1 G7.1 · floor-2 G2.4 G3.3 G4.2 G4.3 G6.2 G7.3 G7.3a
   G7.4 · top G7.2 · street G5.1 G5.2 G5.6 G6.3 G6.4.
5. Inset office and map live only in `street`; map pins are non-primary G6.3 entries.
6. Default view = the one with the most primaries among the current band's own gags; ties
   to the earlier view.
7. Primary hotspot centres ≥ 44 native px apart within a view.
The web switcher is a tab row with per-view gag counts (as mocked); B's exterior stacked
building is optional Phase 2 polish for that switcher. Consequence: PH1-07's 430/494 px
rooms for 150/220 must be re-cut into views by PH1-08b (street takes the inset).

**D-037 · 2026-09-24 · Scene contract rulings from the PH1-08b/09 integration.**
Found by merging the export and the painter in a scratch tree and running both sides'
checks against real data. They amend D-035/D-036 where noted; `SCENE-FORMAT.md` carries
the detail.
1. `frame` is the manifest frame-*name* string, never an index, with no fallback (the
   contract's own example used integers; the manifest never did).
2. Parity goldens are per view (`art/preview/views/<band>-<state>-<view>@1x.png`), painted
   from the export and proven equal to the full-plate render's crop. Whole-plate previews
   stay art-review images. Amends D-035's "match `art/preview/<band>-<state>@1x.png`".
3. D-036 rule 3's "`focus` = the full view" is loosened to "`focus` inside the view", so
   a view wider than a phone can scroll to its point of interest.
4. D-036 rule 4 counts per file: one primary per gag in its home view, at most one per
   view. Other parts may sit in other views (G3.2's box on `floor-2`).
5. Two-part is per state, per `BANDS-AND-GAGS.md`: G5.1 is two-part only in `without`.
   All-placeholder gags are exempt.
6. Painter scale uses both axes (`min` of width and height scales), so no view overflows
   the fixed 360:240 scene box. Amends D-035's width-only formula.
7. Rule failures that need art are **listed debt**, not tolerated silently and not faked
   by moving hotspots: `knownSpacingDebt` (5 band-80 pairs under rule 7) and
   `TWO_PART_ART_DEBT` (G2.4's inset part). Each list fails the build once stale.
   PH1-10 clears both.
8. Views must be whole rooms, not crops of one plate (the gap PH1-08b reported). Until
   PH1-10 lands, staging shows cropped rooms.

**D-038 · 2026-09-24 · Views are composed rooms; scene rules have no exceptions.**
PH1-10 replaced one wide plate per band, sliced into views by hand-placed crops, with one
composed room per D-036 view: `ground`, a separate room per upper storey, and `street` as
HQ's exterior with the road and the inset office. Amends D-037 items 2, 7 and 8:
1. The per-view parity reference is each room's own native render, not a crop of a plate.
2. Band 80 has `ground` only: none of its gags lives in the street (D-036 rule 2).
3. The spacing and two-part debt lists are cleared, and the mechanism goes with them: rule 7
   and the two-part rule have no exemptions on either side. A future exception needs a
   decision first.
4. HQ's storey count in `street` follows the floors `BANDS-AND-GAGS.md` narrates (3 at 150,
   4 at 220). That is scenery, not a receipt.
5. G2.4's second part is staged as one call: the inset office's screen shows the HQ worker
   frozen mid-wave, with an inset worker beside it waving back. That is the drawable reading
   of "a worker on each side waving".

**D-039 · 2026-09-25 · A band may re-compose a room, not only add to it.**
Recorded after the fact: PH1-11 (`5be5870`, merged as DIA-29) introduced the mechanism, and
the D-038 rule that a view is a *composed room* had no answer for a room that stops fitting.
At 360 the ground floor could not seat nine primary hotspots 44 px apart (D-036 rule 7, no
exceptions per D-038) by adding to the 220 room, so the room itself was re-laid.
1. **Mechanism (`art/src/layout.py`).** A placement may carry `since` and `until`, in
   headcount-band units: it is on screen only when `since <= band < until`. `scene()` applies
   the window before the quiet rules, so it is a filter on *which room*, not on how loud.
   Band 80's ground floor and 150/220's ground and street placements end at `until=360`; the
   360 ground and street are placed with `since=360`; HQ is `hq-5` for `360 <= band < 490`
   and `hq-6` from 490.
2. **What stays true.** R-03a: band N still holds every gag with band <= N in the matching
   state; a re-composed gag is re-placed, never dropped. Quiet rules still key on the
   placement's own `band`, so a band-80 gag re-placed in the 360 room is quieted like any
   earlier-band gag. D-038's "no exceptions" is untouched: every re-composed room passes the
   44 px and two-part rules on its own (closest ground pair at 360: G1.1/G5.3, 47 px).
3. **Consequence for content and evidence.** The same gag can sit somewhere else in a later
   band, and a view's size can change (ground 282 x 188 at 220, 346 x 220 at 360; HQ's
   footprint goes from 7 x 3 tiles at 150/220, `hq-3`/`hq-4`, to 4 x 3, `hq-5`/`hq-6`, from
   360). That is scenery, not a receipt (D-038 item 4). `BANDS-AND-GAGS.md` "Where" is the
   *home view* (D-036), not a coordinate; where the two differ, the home view wins.
4. **Consequence for the exporter.** `since`/`until` are art-side only. They are resolved
   when the scene is built and are **not written to the scene files**. The exporter emits a
   plain, complete `entries` list per band x state x view.
5. **Consequence for the painter: none, deliberately.** The web reads scene files and never
   sees a window (D-035). It must not learn to compare bands, cache a room across bands, or
   assume a gag's hotspot is where it was at the previous band. Each band's file is
   self-contained. Hotspots are derived from the file being painted, so buttons follow the
   re-composed room automatically.
6. **Guardrail.** Any use of `since`/`until` to hide an art-rule failure rather than to fit a
   larger room is an exception under D-038 item 3 and needs its own decision.

**D-040 · 2026-09-25 · The hallway test is deferred, not dropped; the kit ships now.**
The Phase 1 exit criterion stands as written in `02-PHASES.md`: a stranger names what each
gag is from the without-state picture (≥ 4/5 per gag, or that gag is redrawn), and ≥ 4/5
find and flip the toggle within 20 seconds unprompted (R-06a). **Josh has deferred running
it.** Two reasons, both on the record: running it needs real strangers and his time
(`STATUS.md`, "Needs Josh"), and on `develop` today 15 of the 26 gags are still placeholder
boxes, so a run now could not close the criterion for them whatever it found.
Consequences:
1. **Phase 1 closes marked *conditionally met, pending hallway test*, said out loud** in
   `STATUS.md` and `02-PHASES.md` — never quietly ticked. The criterion is not amended and
   not waived; it is unrun.
2. The kit is built and parked: `docs/hallway-test/` (README, protocol, generated scoring
   sheet, results template, 390 px without-state screenshots) plus
   `tools/hallway-test/build-kit.mjs`, which regenerates the sheet, the manifest and every
   screenshot from the repo. Running the test later is prep-free: refresh, print, run.
3. **Re-running the capture is how bands arrive.** Gags whose primary hotspot is still a
   placeholder are skipped and listed in `manifest.json`'s `pendingArt`; when the art lands
   they appear with no change to the kit. A results write-up must state which gags a run
   did not cover.
4. **A gag that later fails is redrawn, not renegotiated.** The art pipeline is in-house
   (`art/`, Opus-drawn), so a redraw against a concrete note is hours of one agent's work,
   not a re-commission — which is what makes deferring this gate cheap rather than risky.
   The note is the participants' verbatim answers: what the picture read *as*.
5. The kit operationalises the two thresholds so the sheet and the protocol cannot drift:
   "a couple of seconds" for a gag = **5 s**, the toggle = **20 s**, five participants,
   pass at four. Those numbers live in one place, `build-kit.mjs`, and are printed on the
   sheet. Changing them needs a decision.
6. The toggle half feeds Phase 2's nudge work. If the test runs *after* that polish ships, a
   weak result means reworking it rather than discovering the problem, and the write-up must
   say which of the two it is.

**D-041 · 2026-09-25 · Three 360/490 "without" lines follow the art that reads.**
Three rounds of picture review at 390px (DIA-9, DIA-21, DIA-28) showed that three locked
"without" lines could not be drawn legibly as written. `BANDS-AND-GAGS.md` now describes
what is drawn. (D-039 is held for the room re-composition rule and D-040 for the
hallway-test kit, both still on open branches.) No receipt, date or figure changes.
1. **G3.1:** the coat and the `WELCOME!` balloon are removed. A worn coat changes the hire's
   torso colour between states, which breaks the rule that a person must not change across
   the toggle. With the coat off the hire, nowhere in that corner reads. The absence is
   carried by an outline where the laptop should be.
2. **G5.4:** the bill on the wall carries **no figure**. `−33%` is E-10, the saving VoIP
   delivered. It belongs only to the "already" state, and E-10 never gives a base figure to
   print instead. What carries the gag is the roll: a bill that will not stop.
3. **G5.3:** "everyone freezes" is replaced by the drawn beat, one figure backing away with
   their hands up.
Deferred to the Phase 1 polish list, not rated weak: the G6.4 camera dome, the §5 closet
density, `DAVE?` on the trolley body, and the G5.1 truck reading as a crate.

**D-042 · 2026-09-25 · Phone-scale close-up views; rooms become establishing shots.**
Josh flagged on DIA-36 that the art is too small on phones, and the Art Director measured
it: inside the 360:240 box a 390 px phone paints current rooms at 1.0–1.33 css px per art
px, so a 24 px person is about 4 mm tall. Reviews had been judging 4× plates. Gags per room
grow with the band (750: 12 on ground), and at 1× a 12-gag room cannot "read cold at 390 in
under 2 s". Proposal: DIA-36 document `proposal`. Accepted with one change (item 1: 180 × 120,
not 195 × 130). Amends D-036 rules 2, 4, 6 and 7 and D-038 item 1:
1. **Close-ups.** A close-up view is at most **180 × 120 native px** and holds **1–3
   primary hotspots**. 195 × 130 lands on exactly 2 css px per art px only from 390 px up;
   at 360/375 px it drops to 1.5. 180 × 120 lands on 1.9–2.33 on every phone 360–430 px
   wide at dpr 2, 2.625 and 3. That is the size the art is judged at.
2. **Rooms stay.** Each D-036 room (`ground`, `floor-2`…, `top`, `street`) is kept as the
   establishing view for its close-ups. A room exists only if it has at least one
   close-up. Rooms carry **no gag hotspots**, because at 1× they would be tap targets
   millimetres apart. How a visitor gets from a room to its close-ups is the web's call
   (item 7).
3. **Sprites unchanged.** A close-up is a rectangle cut from its parent room's own
   native render, not a new drawing. Its parity golden is that crop, and `check_scenes.py`
   proves it equals the room render at `rect`. This is D-038's "each room's own render", not
   the plate cropping D-038 retired.
4. **Primaries.** Each gag has exactly one primary per file. It sits in a close-up whose
   parent is the gag's home room (D-036 rule 4's table now names home *rooms*).
   Non-primary parts may sit in other close-ups.
5. **Spacing.** The rule is **44 css px** between primary centres on a 360–430 px phone.
   In a close-up (≥ 1.9 css px per art px) that is **≥ 24 native px**, and `check_scenes.py`
   and the contract test both enforce it with no exceptions (D-038 item 3 stands).
6. **Default view.** The close-up holding the most of the current band's own primaries,
   ties to the earlier one. First paint must be readable at true size. The room is one
   step away.
7. **Web's call, within limits.** Navigation (tabs grouped by room, tapping a room to
   enter, or both), transitions and the scene box size belong to the Web Engineer. The
   limits: a 180 × 120 close-up paints at ≥ 1.9 css px per art px at 360 and 390 px, dpr 2
   and 3 (a Playwright assertion); about 10 close-ups at 750 stay reachable at 390 px by
   touch and keyboard; the R-14 text list stays in sync. The contract fields
   (`SCENE-FORMAT.md`: `kind`, `parent`, `rect`, id scheme) are proposed here, and the Web
   Engineer can counter before the exporter merges.
8. **Review at true size.** Every picture review (the "reads cold" test, legibility passes,
   the hallway test) uses 390 px mocks at the real painted scale, never 4× plates.
9. **Consequences.** The DIA-3 hold is lifted: 610/750 rooms are composed so that their
   gags fall into clusters of ≤ 3 that each fit 180 × 120 at 24 px spacing. 80–490 are
   re-exported, not redrawn. The exporter and `check_scenes.py` belong to the Art Director.
   The painter, navigation and contract test belong to the Web Engineer. Both are merged
   together in a scratch worktree before either lands on `develop` (the CLAUDE.md
   integration rule).

**D-042a · 2026-09-25 · Web sign-off on the close-up contract, and the navigation ruling
(DIA-39; Web Engineer, within D-042 item 7).**
Contract: `kind`, `parent`, `rect` and the `<room>.<n>` ids are accepted as proposed.
Counters, all written into `SCENE-FORMAT.md`: (1) `schema` becomes 2, and the painter
refuses any other value; (2) a close-up's entries, hotspots and `focus` are in the
close-up's own coordinates and the painter applies no offset, so the painter stays dumb;
(3) both states of a band share their view skeleton (ids, kinds, parents, labels, order)
so the toggle keeps the visitor's place; (4) every view has a label of at most 24
characters, reviewed once by the Product & Content Lead; (5) exactly one `default`, on a
close-up. The contract test and `check_scenes.py` are split by who can see what: the test
owns everything readable from the JSON, the script owns everything that needs a PNG;
spacing and one-primary are checked by both, on purpose.
Navigation, all three of D-042's options in layers, none of them hidden behind another:
1. **Room tabs**, one line, horizontally scrollable, never wrapping (a wrapping row grew
   with the band and would shift the page). Choosing a room lands on that room's default
   close-up, not on the establishing shot, so a tap never leaves the visitor on a picture
   with nothing to tap.
2. **A stepper under the scene**: previous, "label · n of N", next, over all close-ups in
   array order, crossing room boundaries. It alone reaches every gag; the tabs are
   shortcuts. At either end it is `aria-disabled`, not `disabled`, so focus is not lost.
3. **Whole floor**: a persistent control that shows the room's establishing shot. There
   each of its close-ups is a "zoom in" button over the picture, drawn from the same array
   (never a second list), so the picture and the buttons cannot disagree.
Transition: a straight cut, no animation; a zoom from `rect` is possible later because a
close-up is a crop of its room, but that belongs to the Phase 2 animation pass. No swipe
gesture (it fights page scroll). The scene box does not shrink: it is 3:2 at every view,
because a 180 × 120 close-up at 2 css px and a 360 × 240 room at 1 css px fill it exactly,
which also holds CLS at zero. It is the full viewport width up to 430 px (this is what makes
1.9 css px per art px true at 360 px: a padded 328 px box would give 1.5) and capped at
720 px from 768 px. The R-14 checklist is by band and by gag, not by view, so it stays in
sync by construction; the contract test's "every due gag has one primary in a close-up"
is what keeps every gag on the list also reachable in the picture.

**D-043 · 2026-09-26 · R-10's read side moves to Phase 2, so band 750 can be measured
(DIA-72; CEO, on the PH2-04 brief).**
Lighthouse scores only a navigation, and every load lands on band 80, so the Phase 2 exit
criterion "Lighthouse ≥ 90 on band 1 and band 7" could not be measured as worded. Rather
than amend the criterion to a timespan without a score, the page now *reads* R-10's own
parameters on load: `?n=<headcount>&it=<none|built>` sets the initial band and state. A
missing or invalid value falls back to band 80, built, silently. Nothing *writes* the URL
in Phase 2: history, the back button, sharing, OG tags and the share image stay in Phase 3
under R-10 as written. The parameter names are R-10's, so Phase 3 extends this rather than
replacing it. Useful beyond Lighthouse too: QA and the hallway kit can land on a band
directly. Built by PH2-04 as its own commit.

**D-044 · 2026-09-26 · G6.3's "already" line follows the art that reads.**
The 390px picture review (DIA-70, DIA-73) found the camera dome over the new shell's door
unreadable on the pale frame. It came out (PR #36), as G6.4's did at 490 in the polish pass
(DIA-37). This follows D-041's rule: a locked line describes what is drawn.
`BANDS-AND-GAGS.md` now does. No receipt, date or figure changes: E-05 and E-11 are as they
were, and the badge reader and camera bar are still drawn.
1. **G6.3 Already:** "the new shell has cable trays, a badge reader, ~~a camera dome~~ and a
   room with a camera bar; the worker in the doorway holds a clipboard with everything
   ticked."

**D-045 · 2026-09-26 · Band-crossing moments: six beats, no captions (PH2-03 step 1, DIA-82;
Product & Content Lead, for CEO sign-off).**
The beat table is `docs/content/MOMENTS.md`. Each chosen gag's primary is in its band's
default close-up (checked against the `"default": true` view in each `<band>-built.json`).
1. **150 G4.2, 360 G5.3, 490 G3.1, 610 G4.1, 750 G7.1:** the brief's proposed gags stand,
   with art notes. 360 is rated at risk. If it doesn't read, the band ships with no moment.
2. **220 G2.4: the beat is replaced, the gag is kept.** The dongle walker is dropped. A
   dongle is too small to read at 2 css px, "sees the camera bar" can't be drawn, and it
   would carry a without-state prop into the built state. The new beat is the Already
   line's own "the remote face moving, the wave returned": the screen lights, the face
   waves, and a seated worker waves back.
3. **No captions in any band.** Where the picture already has a word (`REPORT`,
   `AUDITOR`, `APPROVED`), a caption repeats it. Where it doesn't, a caption would be
   explaining the joke. Any caption we can source restates what the panel says one tap
   away. So no served copy changes, `PANELS.md` and `content.json` are untouched, and step
   3 reserves no caption line. A moment that reads only with words is cut, not captioned.
No receipt, date or figure is added. Every beat plays a locked Already line forward.
**Signed off by the CEO, 2026-09-26 (DIA-89).** Every close-up, primary and reused sprite
checked against `develop`. Two notes for step 2: 490's "screen comes on" needs a screen-off
laptop frame, which the table doesn't list; and 360's fan is the threat arriving and leaving,
so it is not the dongle problem, but it must never be set down in the built room.
