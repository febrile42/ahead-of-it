# 01 — Requirements

`R` = requirement · `N` = non-goal · `G` = guardrail. MUST/SHOULD per RFC 2119.
Change any of these by writing a `04-DECISIONS.md` entry first.

## Functional

| ID | Requirement | Phase |
|---|---|---|
| R-01 | A headcount **slider** (range ~25 to 1,000+) that **snaps to seven bands at Josh's real headcounts** — 80 · 150 · 220 · 360 · 490 · 610 · 750 (D-023). Ticks are labelled with the year. The readout shows the visitor's number, the snapped band, and the year: "~400 → 2022, ~490". | 1 |
| R-02 | The **building renders per band** as an isometric pixel-art scene assembled from a tileset, **in its built state by default** (D-022). Floors, desks, rooms and (from 360) an inset office change with the band. | 1 |
| R-03 | In the **"without" state**, each band shows its **gags** as distinct, visually legible scenes placed where the problem physically occurs. In the built state the same spots show the **fix** (the "already" object). | 1 (static) / 2 (animated) |
| R-04 | Every fix/gag pair is a **hotspot** in both states. The **panel** order is (D-021): **what Josh had already built** (dated, headcount, the number) → **what it prevented** (the gag, "typically around this size", with a thumbnail of the without-state scene) → **what it was worth later** (the receipt years on, where one exists). | 1 |
| R-05 | Panel copy comes from a single **content data file** (`content/gags.json` or equivalent) generated from `docs/content/`. Copy is never hard-coded in components. | 1 |
| R-06 | A **toggle** re-renders the current band between **built** (default) and **without**. Both states exist for every band. Label is copy, not a control name — e.g. *"See it without him"* / *"Back to what was built"* (final wording in `TONE.md`). | 2 |
| R-06a | The toggle is **encouraged** (D-022): visually prominent, nudged once per session (e.g. a brief pulse or a one-line hint after the first slider move), and the share image comes from the without state. Discoverability is tested (Phase 1 exit). | 2 |
| R-07 | In the built state, **Josh is not shown doing the work**; a team is on the floor and the top-floor meeting chair is occupied. | 2 |
| R-08 | **Animated workers** (walk cycles, state poses) in both states; built-state workers visibly calmer. Animation is decorative — no requirement depends on it. | 2 |
| R-09 | ~~Topology fork~~ **Removed (D-015).** Many offices only; band 5+ shows HQ plus an inset office in another city; band 6+ a map with six pins. | — |
| R-10 | **URL state**: `?n=<headcount>&it=<none|built>` fully reconstructs the view. Shareable and back-button safe. | 3 |
| R-11 | **Share image** generated client-side: the **without-state** building for the current band with up to three gags flagged, captioned with the credential — *"By the time the company was your size, Josh had already fixed this."* — plus the URL. Downloadable and used as the OG image for that URL (D-022). | 3 |
| R-12 | **Contact** is visible from every panel and the punch list: a LinkedIn link and a crawler-obfuscated email (assembled client-side, never plain in the source). No form, no calendar, no PDF (D-019). | 1 |
| R-13 | A **day/night cycle** with the 3:47am on-call window as an ambient gag. | 3 (optional) |
| R-16 | **`noindex`** meta + no sitemap at launch; not linked from joshgister.com until the Phase 4 publicity gate opens (D-018). | 1 |
| R-17 | **First-party analytics** via the `/u/*` Umami proxy with exactly the D-016 event set; no values that identify the visitor or record their headcount. | 3 |
| R-14 | A **text checklist** below the fold for the current band: *what was already in place at this size* (the fixes, each with its panel content), with the "without" description under each. It is the accessible equivalent of the scene and MUST stay in sync with it (generated from the same data). Downloadable as a single page. | 1 |
| R-15 | A **"what do you already have?"** refinement (checkboxes: SSO · security lead · ERP · real network · MDM) that marks those items as done in the checklist and dims their hotspots. | 3 |

## Non-functional

| ID | Requirement |
|---|---|
| R-20 | **Phone-first.** Designed and reviewed at 390px before any desktop work. The building must be legible at that width; pan/zoom is allowed, tiny hotspots are not (min 44px tap target). |
| R-21 | **No third-party requests.** No CDN, no web fonts from origin ≠ ours, no external scripts. Analytics, if any, first-party only. Verified by a test, not a grep (see joshgister PR #19 for why). |
| R-22 | **No backend, no accounts, no cookies.** Static assets on a Cloudflare Worker (plus the existing first-party analytics proxy). Share image is generated in the browser. |
| R-23 | **Performance budget:** first meaningful render < 1.5s on a mid-range phone over 4G; total transfer for first band < 600 KB; sprite sheets lazy-load per band. |
| R-24 | **Accessibility:** punch list is screen-reader complete; slider is keyboard operable and announces the band; hotspots are focusable buttons; `prefers-reduced-motion` disables animation and the day/night cycle. |
| R-25 | **Pixel rendering:** `image-rendering: pixelated`, integer scaling, no blur. |
| R-26 | **Serving hygiene:** only `public/` (or the build output) is uploaded. `.git`, docs, source never served. Same rule and same reason as joshgister.com. |

## Content

| ID | Requirement |
|---|---|
| R-30 | Every receipt in panel copy is traceable to an `E-xx` in `EVIDENCE.md`, which cites a resume line or carries Josh's explicit confirmation. Unconfirmed receipts do not ship. |
| R-31 | Bands state their confidence honestly ("companies around this size usually…"); copy never predicts a specific visitor's future. |
| R-32 | Tone per `TONE.md`: failures are systemic, workers are never the joke, panel text is dry and precise. |
| R-33 | **Neither employer is named** in served content — not names, logos or domains (D-014, amended). Panels use the fixed descriptors in `TONE.md`. A build-time check greps the build output for both names (case-insensitive) and fails CI on a hit. |

## Non-goals

| ID | Non-goal |
|---|---|
| N-01 | No LLM / chatbot / "ask my resume". The writing is the differentiator; nothing sits between the reader and it. |
| N-02 | No continuous building growth. Bands only, at Josh's headcounts. |
| N-03 | No procedural gag generation. Every gag is hand-written and hand-placed. |
| N-04 | No traditional resume page. The PDF is linked from the contact area; the site does not reproduce it. |
| N-05 | No user data captured. Not even the headcount they entered. |
| N-06 | No game mechanics (score, timer, win/lose). The slider and the switch are the whole interaction model. |

## Guardrails

| ID | Guardrail |
|---|---|
| G-01 | **Seven bands, one per year of receipts** (D-023). Adding one requires a new year of receipts, not a round number. |
| G-02 | **≤ 28 gags total** across all bands, ≤ 5 per band. |
| G-03 | **Stock/CC0 tiles and sprites through Phase 2.** Custom art is commissioned only after Phase 2 exit, against a locked gag list. |
| G-04 | **No code before Phase 0 sign-off.** The gag list and evidence ledger are approved by Josh first. |
| G-05 | Any public action (remote, DNS, deploy) is a separate, explicit ask to Josh. |
