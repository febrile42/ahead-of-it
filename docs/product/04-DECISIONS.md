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
