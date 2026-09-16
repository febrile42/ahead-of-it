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
- Tileset + sprite manifest from a CC0/licensed isometric pack, with licence file. (H inventory, S integrate)
- Building assembler: band → tile grid → canvas. Static per band. (S)
- Slider (R-01) snapping to bands; band readout. (S)
- Hotspots + panel (R-04, R-05). Static gag markers (no animation). (S)
- Punch list (R-14) generated from the same data. (S)
- Phone-first layout at 390px (R-20). (S, reviewed by M on a real phone screenshot)
- No-third-party test (R-21). (S)

Exit criteria
- All seven bands render with every gag placed and clickable at 390px.
- A stranger can identify what each gag *is* from the picture alone (M runs a 5-person hallway test with screenshots; ≥ 4/5 per gag or the gag is redrawn).
- Staging preview URL works; nothing served outside the build output.

## Phase 2 — The switch and the workers

Deliverables
- Built state for every band (R-06, R-07). (S, copy by M)
- Animated workers, state poses, calmer built-state cycle (R-08). (S; H slices sheets)
- Topology fork (R-09). (S)
- `prefers-reduced-motion` (R-24). (S)
- Performance budget met (R-23). (S measures, M signs)

Exit criteria
- Switch flip on every band at 390px under 100ms perceived; all fixes legible.
- Lighthouse performance ≥ 90 on mobile for band 1 and band 7.
- Gag list locked. **Now** custom art can be commissioned (G-03).

## Phase 3 — Share, polish, custom art

Deliverables
- URL state (R-10), share image + OG (R-11), refinement checkboxes (R-15), day/night (R-13). (S)
- Custom tileset and sprites replacing stock, against the locked list. (A, brief from M with reference screenshots)
- First-party analytics decision executed (Q-5). (S)
- Copy pass on every panel in final voice. (M)

Exit criteria
- Share image renders correctly in iMessage, Slack, LinkedIn, X previews (H checks).
- J approves final art and copy.

## Phase 4 — Launch

- GitHub remote (J approves), `main` promotion with merge commit, production deploy, smoke test.
- DNS: `resume.joshgister.com` moves from lime's `000-default` placeholder (`A 45.33.69.96`) to the Worker custom domain. **J approves the cutover explicitly.** Note in joshgister `CLAUDE.md` that the placeholder can be retired.
- Post-launch: one week of first-party numbers against `00-VISION.md` success section, then a retro entry in `04-DECISIONS.md`.

## What is explicitly *not* scheduled

Anything in `01-REQUIREMENTS.md` non-goals. If it comes up, it goes in `05-OPEN-QUESTIONS.md`
or a decision entry — not into a phase.
