# 00 — Vision

**Internal name:** Occupancy (a facilities word and a headcount word). Public-facing name: **TODO** (D-010).
**URL:** resume.joshgister.com
**Owner:** Joshua Gister. **Author of this doc:** Claude (Opus), acting as PM, 2026-09-16.

## One sentence

A pixel-art office building that grows with a headcount slider, breaks in the specific
places companies of that size actually break, and — on one switch — gets fixed the way
Josh actually fixed it, twice.

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

- **30 seconds:** drags the slider, watches the building grow, laughs at two gags, flips
  the switch, screenshots it. Leaves knowing "this person builds IT functions for companies
  at my stage and has done it before."
- **3 minutes:** clicks four gags, reads four panels, downloads the punch list for their
  headcount, opens the contact link. Leaves with the one open question only a conversation
  answers: *what would you do at ours, specifically?*

## Principles (non-negotiable)

1. **It is about the visitor's company.** Josh's resume appears only as evidence attached
   to the visitor's problem. Never as a list.
2. **Content is the product.** The art is the invitation; the panels are the argument. A
   visitor who never clicks gets a delightful toy; a visitor who clicks once gets an
   executive. Phase 0 is writing, and no code is written until it is signed off.
3. **Nothing invented.** Every receipt is on the resume or confirmed by Josh. See
   `CLAUDE.md`. Exaggeration lives in the pixels, never in the panel text.
4. **Failures are systemic, never personal.** The developer-who-became-IT is a hero. The
   worker under the invoices is a victim of a missing function. Nobody in the building is
   stupid. See `docs/content/TONE.md`.
5. **Curated, banded, capped.** Seven bands, ~25 gags, snap-to-band slider. Companies break
   in steps; so does the building. The caps are the guardrail against art scope creep.
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
- switch flips per session (if people don't flip it, the switch is not discoverable).

Anti-metrics: a session that ends on the slider without a click means the gags are not
legible; fix legibility before adding anything.
