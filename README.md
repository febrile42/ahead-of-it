# Ahead of It

A resume you can drag. Set a headcount slider to your own company's size and an isometric
pixel-art office building renders at that size, with the IT function Josh Gister built
already in place. Flip one switch and the same building re-renders **without** it, and
things go visibly wrong in the places they actually go wrong. Tap a problem to see a dated
panel: what was built, what it prevented, and what it was worth later.

**Live:** [resume.joshgister.com](https://resume.joshgister.com) (at launch; until then the
domain shows a placeholder and the site is deliberately `noindex`).

Phone-first at 390px. Vanilla TypeScript + Vite, no UI framework, served from a Cloudflare
Worker.

## How it's built

```
docs/content/*.md ──build-content──▶ src/content/content.json ─┐
                                                               ├─▶ Vite ─▶ dist/ ─▶ Cloudflare Worker (static assets)
art/ (Python + Pillow) ──export──▶ public/sprites/scenes/*.json ┘
```

- **Content is data, not code.** Every panel string, date, headcount and dollar figure lives
  in `docs/content/` (panels, evidence ledger, timeline, tone rules). `scripts/build-content.ts`
  parses it into `src/content/content.json` against `src/content/schema.json`, and the build
  fails if the committed JSON drifts from the Markdown. No figure is typed into the UI code.
- **The art ↔ web seam is one file format.** The art pipeline in `art/` draws every sprite
  deterministically from a locked palette and exports a scene file per band and state. The
  web side (`src/scene/`) is a deliberately dumb painter over that file. The contract is
  [`docs/product/SCENE-FORMAT.md`](docs/product/SCENE-FORMAT.md), and a Playwright test
  checks the canvas against the art pipeline's own reference render pixel for pixel.
- **UI without a framework** (D-009). `src/main.ts` owns state (band, toggle, current view)
  and wires small modules: `src/ui/` (slider, toggle, panel, checklist, contact) and
  `src/scene/` (scene loading, layout, painter, motion). Hotspots are real `<button>`s laid
  over the canvas, not hit-tested pixels.
- **Product docs** in [`docs/product/`](docs/product/) are the reasoning behind all of it:
  [vision](docs/product/00-VISION.md), [requirements](docs/product/01-REQUIREMENTS.md)
  (the `R-xx` ids cited in code and tests), [phases](docs/product/02-PHASES.md) and the
  [decision log](docs/product/04-DECISIONS.md) (`D-xxx`).

## How CI gates quality

`.github/workflows/ci.yml` runs `check` on every PR into `develop` and every push to
`develop`/`main`. Deploys run only after it passes: a staging preview from `develop`,
production from `main`.

| Requirement | Gate |
|---|---|
| **R-16** noindex until launch | The Playwright smoke test (`tests/smoke.spec.ts`) asserts the served page carries `noindex` at phone and desktop widths. |
| **R-21** no third-party requests | The same smoke test records every request the page makes and fails on any origin but our own, and on any off-origin `<link>`/`<script>`. A test, not a grep. |
| **R-23** performance budget | Lighthouse CI (mobile) must score ≥ 90 on performance, and the first band must transfer < 600 KB (`lighthouserc.cjs`, `budgets.json`). |
| **R-26** serving hygiene | `scripts/check-serving.sh` fails if `dist/` carries `.git*` files, a `docs/` directory, source art or any Markdown. |
| **R-33** neither employer is named | `scripts/check-employer.sh` scans `dist/` and every tracked file. The names come from an Actions secret, so the guard itself never contains them. |

Plus vitest unit tests (`src/**/*.test.ts`, `scripts/**/*.test.ts`) and Playwright e2e on
Chromium and WebKit (an iPhone profile, since iOS Safari is the primary target). The art
pipeline has its own gates: `art/checks/check_scenes.py` and `art/checks/check_palette.py`.

## Run it locally

Node 22 (`.nvmrc`).

```sh
npm ci
npm run dev        # live-reload dev server
npm run build      # content → JSON, Vite build to dist/, employer check
npm test           # vitest, then Playwright against `vite preview`
npm run check      # the full CI gate: build → tests → serving hygiene → Lighthouse
```

Playwright and Lighthouse need a Chromium (`npx playwright install chromium webkit`, then
point `CHROME_PATH` at its binary). The employer check reads `EMPLOYER_DENYLIST`
(comma-separated); without it, local builds skip that check with a warning and CI fails.

The art pipeline is Python 3 + Pillow: `python3 art/build.py` redraws every sprite and
re-exports the scene files (see [`art/README.md`](art/README.md)).

## License

Copyright © 2026 Joshua Gister. **All rights reserved.** The source is public so it can be
read; no licence is granted to use, copy, modify or distribute it. See [`LICENSE`](LICENSE).
