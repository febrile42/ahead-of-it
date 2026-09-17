# 00 — Vision

**Internal name:** Occupancy (a facilities word and a headcount word). Public-facing name: **TODO** (D-010).
**URL:** resume.joshgister.com
**Owner:** Joshua Gister. **Author of this doc:** Claude (Opus), acting as PM, 2026-09-16.

## One sentence

A pixel-art office building at the visitor's headcount, showing what Josh had already
built by the time his company was that size — and, one toggle away, what it would have
looked like without him.

**Thesis (D-021):** prevention, not diagnosis. The site illustrates what Josh did; the
humour lives in the "without" state and is what makes a recruiter share it.

## The rare fact this is built from

Josh built the IT function from zero **twice** — a web/IT organisation at the previous employer
(4 → 80 on the web team; a 300-person, nine-building campus) and the entire IT function at
the current employer (0 → an 11-person org supporting 750+ people, six offices, a $3B+ balance sheet) —
and **stayed long enough to be graded on the founding decisions**. Nineteen years, two
companies. Most IT leaders have 2–3 year tenures and never see their bets mature.

That gives him two things almost nobody in the field can show: **receipts** (outcomes,
years later, in numbers) and **pattern recognition** (what breaks next at a given size).
It also gives him something no cloud-native IT director has: **buildings**. Structured
cabling, badge access, intrusion detection, AV, 100k and 200k sq ft facilities — plus the
identity, SaaS, security and AI-governance layers on top. The building in this product is
literally his. That is the "unique for a reason" test, and it is why this idea survived
and twelve others didn't (`docs/brainstorm/`).

## Who it's for

1. **Recruiters** (primary). Distracted, on a phone, between two other candidates. Need a
   reason to pick up the phone and a thing they can forward to a hiring manager that makes
   them look good.
2. **Hiring managers / CTO / COO / CEO** of 100–1,000 person companies. Need to see
   themselves in it — "that's us" — and then see judgment, not a task list.
3. **Founders and operators who will never hire him** but will share it, because it is
   about their company, not about him.

## What a visitor does

- **30 seconds:** drags the slider to their headcount, sees a calm building with things
  already in place, flips to "without", laughs at two gags, screenshots it. Leaves knowing
  "this person had this handled at my size, before it was a problem."
- **3 minutes:** clicks four gags, reads four panels, downloads the punch list for their
  headcount, opens the contact link. Leaves with the one open question only a conversation
  answers: *what would you do at ours, specifically?*

## Principles (non-negotiable)

1. **It is about the visitor's company, and the argument is prevention.** The building
   at their scale shows what Josh had *already* built by then. The gags show what that
   prevented. The resume never appears as a list.
2. **Content is the product.** The art is the invitation; the panels are the argument. A
   visitor who never clicks gets a calm building and one toggle; a visitor who clicks once
   gets an executive. Phase 0 is writing, and no code is written until it is signed off.
   **The "without" toggle must be encouraged** (D-022) — it is where the humour and the
   share live; if people don't flip it, the site is a brochure.
3. **Nothing invented.** Every receipt is on the resume or confirmed by Josh. See
   `CLAUDE.md`. Exaggeration lives in the pixels, never in the panel text.
4. **Failures are systemic, never personal.** The developer-who-became-IT is a hero. The
   worker under the invoices is a victim of a missing function. Nobody in the building is
   stupid. See `docs/content/TONE.md`.
5. **Curated, banded, capped.** Seven bands **at Josh's real headcounts** (D-023), ~25
   gags, snap-to-band slider. Every band has receipts by construction. The caps are the
   guardrail against art scope creep.
6. **Phone-first, no third parties, no backend.** Same ethos as joshgister.com.
7. **Josh is not shown fixing things.** In the built state the team is on the floor and he
   is in the top-floor meeting. That is the resume's thesis (built, handed off, trusted at
   the strategy table) delivered as a sight gag.

## Success

Primary: **inbound conversations that reference the site.** Everything else is a proxy.

Secondary (first-party analytics only, if enabled — see open questions):
- share-image generations and `?n=` URL loads that didn't originate from the site itself;
- panel opens per session (target: median ≥ 2);
- punch-list downloads;
- **toggle-to-"without" rate per session — the primary engagement metric** (D-022). If it
  is under ~50%, the nudge is failing and nothing else matters until it's fixed.

Anti-metrics: a session that ends on the slider without a click means the gags are not
legible; fix legibility before adding anything.
