# 01 — Requirements

`R` = requirement · `N` = non-goal · `G` = guardrail. MUST/SHOULD per RFC 2119.
Change any of these by writing a `04-DECISIONS.md` entry first.

## Functional

| ID | Requirement | Phase |
|---|---|---|
| R-01 | A headcount **slider** from 25 to 1,000+ that **snaps to seven bands** (`BANDS-AND-GAGS.md`). No free-text input required; a number readout accompanies it. | 1 |
| R-02 | The **building renders per band** as an isometric pixel-art scene assembled from a tileset. Floors, desks, rooms and (from band 5) additional buildings/sites change with the band. | 1 |
| R-03 | Each band shows its **gags** as distinct, visually legible scenes placed where the problem physically occurs (closet, front door, sales pit, top floor…). | 1 (static) / 2 (animated) |
| R-04 | Every gag is a **hotspot**. Tap/click pauses the scene, focuses the gag, and opens a **panel** with: what this is · when it hits (band + typical trigger) · what Josh did (dated, at which company, at what headcount) · the number attached · a one-line "what fixed looks like". | 1 |
| R-05 | Panel copy comes from a single **content data file** (`content/gags.json` or equivalent) generated from `docs/content/`. Copy is never hard-coded in components. | 1 |
| R-06 | A **switch** (`IT function: none / built`) re-renders the current band's building in its **built state**: each gag replaced by its fix, in place. Both states exist for every band. | 2 |
| R-07 | In the built state, **Josh is not shown doing the work**; a team is on the floor and the top-floor meeting chair is occupied. | 2 |
| R-08 | **Animated workers** (walk cycles, state poses) in both states; built-state workers visibly calmer. Animation is decorative — no requirement depends on it. | 2 |
| R-09 | From band 5, a **topology fork**: `one campus` vs `many offices`, with band-specific gags for each. Default: many offices. | 2 |
| R-10 | **URL state**: `?n=<headcount>&it=<none|built>&topo=<campus|offices>` fully reconstructs the view. Shareable and back-button safe. | 3 |
| R-11 | **Share image** generated client-side per state: the building, the three worst gags flagged, one line of copy, the URL. Downloadable and used as the OG image for that URL. | 3 |
| R-12 | **Contact** path is visible from every panel and from the punch list — one link, no form. | 1 |
| R-13 | A **day/night cycle** with the 3:47am on-call window as an ambient gag. | 3 (optional) |
| R-14 | A **text punch list** below the fold for the current band: ordered list of what breaks, each with its panel content. It is the accessible equivalent of the scene and MUST stay in sync with it (generated from the same data). Downloadable as a single page. | 1 |
| R-15 | A **"what already exists?"** refinement (checkboxes: SSO · security lead · ERP · real network · MDM) that hides the gags the visitor has already fixed and re-orders the punch list. | 3 |

## Non-functional

| ID | Requirement |
|---|---|
| R-20 | **Phone-first.** Designed and reviewed at 390px before any desktop work. The building must be legible at that width; pan/zoom is allowed, tiny hotspots are not (min 44px tap target). |
| R-21 | **No third-party requests.** No CDN, no web fonts from origin ≠ ours, no external scripts. Analytics, if any, first-party only. Verified by a test, not a grep (see joshgister PR #19 for why). |
| R-22 | **No backend, no accounts, no cookies.** Static assets on a Cloudflare Worker. Share image is generated in the browser. |
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
| R-33 | The current employer is **never named** in served content — not the name, logo or domain (D-014). Panels use the fixed descriptor in `TONE.md`. A build-time check greps the build output for the name (case-insensitive) and fails CI on a hit. the previous employer may be named. |

## Non-goals

| ID | Non-goal |
|---|---|
| N-01 | No LLM / chatbot / "ask my resume". The writing is the differentiator; nothing sits between the reader and it. |
| N-02 | No continuous building growth. Bands only. |
| N-03 | No procedural gag generation. Every gag is hand-written and hand-placed. |
| N-04 | No traditional resume page. The PDF is linked from the contact area; the site does not reproduce it. |
| N-05 | No user data captured. Not even the headcount they entered. |
| N-06 | No game mechanics (score, timer, win/lose). The slider and the switch are the whole interaction model. |

## Guardrails

| ID | Guardrail |
|---|---|
| G-01 | **Seven bands.** Adding an eighth requires a decision entry showing which gag list justifies it. |
| G-02 | **≤ 28 gags total** across all bands and both topologies, ≤ 5 per band per topology. |
| G-03 | **Stock/CC0 tiles and sprites through Phase 2.** Custom art is commissioned only after Phase 2 exit, against a locked gag list. |
| G-04 | **No code before Phase 0 sign-off.** The gag list and evidence ledger are approved by Josh first. |
| G-05 | Any public action (remote, DNS, deploy) is a separate, explicit ask to Josh. |
