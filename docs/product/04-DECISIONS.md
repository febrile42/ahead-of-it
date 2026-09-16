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
