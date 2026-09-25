# Occupancy — resume.joshgister.com

> "Occupancy" is the internal project name. Public-facing name: **Ahead of It** (`docs/product/04-DECISIONS.md` D-010).

A dynamic, non-traditional resume for Joshua Gister. Drag a headcount slider; a pixel-art
isometric office building grows to that size and things go visibly wrong in the places they
actually go wrong. Click a problem to see what it is, when it hits, and exactly where and how
Josh already solved it. Flip one switch and the same building re-renders with the IT function
built — every fixed object a real decision he made.

**Status:** Phase 1 (static prototype). **Start at `docs/STATUS.md`**, then `CLAUDE.md`.

Agents: [`CLAUDE.md`](CLAUDE.md) is the operating guide. The vision is `docs/product/00-VISION.md`.

## Run locally

Node 22 (`.nvmrc`; Node 20 works for everything except `wrangler`). Install with `npm ci`
(on a machine whose system npm is 9.x, use `npx npm@11 ci`).

- `npm run dev`: live-reload dev server.
- `npm run build`: builds to `dist/`, regenerates `src/content/content.json` from
  `docs/content/` (fails on drift), and runs the employer-name check.
- `npm test`: vitest, then Playwright against `vite preview`.
- `npm run check`: build → tests → `check:serving` → Lighthouse (mobile). This is the full
  gate CI runs. Playwright and Lighthouse need a Chromium: set `CHROME_PATH` to its binary.

## Art pipeline

Python + Pillow, in `art/` (read `art/README.md` and `art/style.md`). `python3 art/build.py`
draws every sprite, exports the per-band scene files to `public/sprites/scenes/`, and writes
the previews to `art/preview/`. `python3 art/checks/check_scenes.py` and
`art/checks/check_palette.py` gate it. The contract between art and web is
`docs/product/SCENE-FORMAT.md`.

## CI and deploy

`.github/workflows/ci.yml` runs the checks on every PR into `develop` and every push to
`develop`/`main`. Deploy jobs run only after the checks pass: a staging preview on `develop`
and production on `main`, both as a Cloudflare Worker with static assets (`wrangler.jsonc`).
Deploys need the repository's Cloudflare secrets, which are not set yet. See
`docs/STATUS.md` for what still needs Josh.
