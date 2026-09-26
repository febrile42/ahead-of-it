# 02 — Phases

Current phase: **1** (Josh's go, 2026-09-24). Phase 0 exited 2026-09-24 and was promoted to `main`. Live status: `docs/STATUS.md`; briefs: `docs/briefs/`. Phases exit on criteria, not dates. Owners: **J** = Josh,
**M** = mastermind (Opus session agent), **S** = sonnet subagents, **H** = haiku subagents,
**A** = pixel artist (Phase 3+).

## Phase 0 — Writing

*The product, in text.*

Deliverables
- `docs/content/BANDS-AND-GAGS.md` — seven bands, every gag, before/after, placement. (M, then J review)
- `docs/content/EVIDENCE.md` — receipt ledger; every `E-xx` cites a resume line or is confirmed by J. (M drafts, **J fills and confirms**)
- `docs/content/TONE.md` — humour and copy rules. (M)
- Panel copy for every gag, final voice. (M drafts; S may produce first-pass variants for M to edit; never below opus for final)
- `05-OPEN-QUESTIONS.md` answered by J, at minimum Q-1 (employer naming), Q-2 (name), Q-3 (topology fork).

Exit criteria
- J has approved the gag list with no `[JOSH: confirm]` left on any gag that ships in Phase 1.
- Every gag has an E-xx and every E-xx is resolved or explicitly deferred.
- Gag count ≤ 28; bands = 7.

## Phase 1 — Static prototype

*Prove the mechanic with stock art. Already shareable if it works.*

> **Progress (2026-09-26): conditionally met, pending hallway test (D-040).** Every
> deliverable below is merged on `develop` (the "building assembler" became the scene seam,
> D-035; gags are tapped in phone-scale close-ups, D-042). The art pipeline went in-house
> (D-024, D-034), and all seven bands plus the `1,000+` stop are final in both states
> (PH1-12). Exit criteria: bands placed and clickable at 390px ✅; staging preview works ✅;
> the hallway test (gag naming and toggle discoverability) is **deferred by Josh, not
> waived**, and is unrun; its kit is merged (PR #2). The internal picture review (DIA-70)
> rated three gags weak: G6.3 and G6.1 are redrawn and now read, and G3.1's redraw is
> landing (PR #39). None blocks Phase 2. Live state is in `docs/STATUS.md`.

Deliverables
- Repo scaffold: build tooling, `wrangler.jsonc` (assets-only Worker), CI for staging preview on `develop`. (S, brief from M)
- Content pipeline: `docs/content/*.md` → `content/gags.json` with schema validation. (S build, H validate)
- Tileset + sprite manifest from the in-house pipeline (or the $27 fallback, with licence file). (H inventory, S integrate)
- Building assembler: band → tile grid → canvas. Static per band. (S)
- Slider (R-01) snapping to Josh's headcount bands; year-labelled ticks; readout. (S)
- Both states static per band (built default, without on toggle — R-02/R-03/R-06). Hotspots + panel in D-021 order (R-04, R-05). (S)
- Checklist (R-14) generated from the same data. (S)
- Phone-first layout at 390px (R-20). (S, reviewed by M on a real phone screenshot)
- No-third-party test (R-21), the employer-name build check (R-33, D-014), and `noindex` (R-16). (S)
- ~~Art research brief (D-020)~~ done: `docs/research/ART-PACKS-2026-09.md`.
- **Art pipeline spike (D-024):** style-reference sheet, then five assets generated against it (floor, wall+window, desk+chair, worker walk cycle, badge reader), hand-cleaned. Go/no-go on in-house art. (S runs the pipeline, H slices/validates, M judges consistency — J sees the five before anything else is drawn)

Exit criteria
- All seven bands render with every gag placed and clickable at 390px.
- A stranger can identify what each gag *is* from the picture alone (M runs a 5-person hallway test with without-state screenshots; ≥ 4/5 per gag or the gag is redrawn).
- **Toggle discoverability:** in the same hallway test, ≥ 4/5 people find and flip "without" within 20 seconds unprompted (R-06a). If not, the nudge is redesigned before Phase 2.
- Staging preview URL works; nothing served outside the build output.

> **The two hallway-test criteria are deferred, not waived (D-040).** Josh has deferred
> *running* the test; the criteria above stand unchanged. Phase 1 therefore closes marked
> **conditionally met, pending hallway test** — said out loud here and in `STATUS.md`, never
> quietly ticked. The kit to run it is built and parked: `docs/hallway-test/` (protocol,
> generated scoring sheet, 390px without-state screenshots) and
> `tools/hallway-test/build-kit.mjs` to regenerate all of it. A gag that fails when the test
> is eventually run is redrawn — in-house, hours, not a re-commission.

## Phase 2 — The switch and the workers

> **Progress (2026-09-26): starting.** Briefs PH2-01…04 and D-043 are merged (PR #35);
> dispatch order is in `docs/briefs/README.md`, PH2-02 (`prefers-reduced-motion`) first.

Deliverables
- Toggle + nudge (R-06, R-06a, R-07) polished; **band-crossing moment**: when the slider crosses into a band, the new threat briefly appears *already handled* (Q-20 item 5). (S, copy by M)
- Animated workers, state poses, calmer built-state cycle (R-08). (S; H slices sheets)
- `prefers-reduced-motion` (R-24). (S)
- Performance budget met (R-23). (S measures, M signs)

Exit criteria
- Switch flip on every band at 390px under 100ms perceived; all fixes legible.
- Lighthouse performance ≥ 90 on mobile for band 1 and band 7.
- Gag list locked. **Now** custom art can be commissioned (G-03).

## Phase 3 — Share, polish, custom art

Deliverables
- URL state (R-10), share image + OG (R-11), refinement checkboxes (R-15), day/night (R-13), analytics events (R-17, D-016). (S)
- Art per D-024: remaining assets through the proven pipeline; stock/commission only where it failed.
- First-party analytics decision executed (Q-5). (S)
- Copy pass on every panel in final voice. (M)
- Public-facing name **"Ahead of It"** (D-010, decided) applied to title, share image, OG. (S)

Exit criteria
- "Occupancy" appears in no served string.
- Share image renders correctly in iMessage, Slack, LinkedIn, X previews (H checks).
- Public-facing name applied (D-010).
- J approves final art and copy.
- Six-pin map (Boston, Chicago, NYC, DC, Lawrence, Austin) at band 6+.

## Phase 4 — Launch

- GitHub remote (J approves), `main` promotion with merge commit, production deploy, smoke test.
- **Publicity gate (D-018):** ships `noindex`, unlinked. Making it discoverable or linking from joshgister.com requires a deliberate professionalism / resume-exposure review that J opens explicitly. Not part of launch.
- DNS: `resume.joshgister.com` moves from lime's `000-default` placeholder (`A 45.33.69.96`) to the Worker custom domain. **J approves the cutover explicitly.** Note in joshgister `CLAUDE.md` that the placeholder can be retired.
- Post-launch: one week of first-party numbers against `00-VISION.md` success section, then a retro entry in `04-DECISIONS.md`.

## What is explicitly *not* scheduled

Anything in `01-REQUIREMENTS.md` non-goals. If it comes up, it goes in `05-OPEN-QUESTIONS.md`
or a decision entry — not into a phase.
