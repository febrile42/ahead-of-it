# Occupancy — resume.joshgister.com

> "Occupancy" is the internal project name. Public-facing name: **Ahead of It** (`docs/product/04-DECISIONS.md` D-010).

A dynamic, non-traditional resume for Joshua Gister. Drag a headcount slider; a pixel-art
isometric office building grows to that size and things go visibly wrong in the places they
actually go wrong. Click a problem to see what it is, when it hits, and exactly where and how
Josh already solved it. Flip one switch and the same building re-renders with the IT function
built — every fixed object a real decision he made.

**Status:** Phase 1 (static prototype). See `docs/STATUS.md` and `docs/product/02-PHASES.md`.

Start with [`CLAUDE.md`](CLAUDE.md), then `docs/product/00-VISION.md`.

## Run locally

Node 22 (`.nvmrc`). `npm ci` · `npm run dev` for a live-reload dev server · `npm run build`
builds to `dist/` and runs the employer-name check · `npm test` runs vitest then the
Playwright smoke test against `vite preview` · `npm run check` runs build + test, the same
gate CI will eventually run.
