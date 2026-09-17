# 02 — Phases

Current phase: **0**. Phases exit on criteria, not dates. Owners: **J** = Josh,
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

## Phase 2 — The switch and the workers

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
- **TODO: public-facing name chosen (D-010, Q-2)** and applied to title, share image, OG. (J decides, M applies)

Exit criteria
- Public-facing name decided; "Occupancy" appears in no served string.
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
