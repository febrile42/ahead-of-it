#!/usr/bin/env node
// D-057 item 1 (PH3-02, DIA-235): `npm run share:render` — renders the
// eight share PNGs with the site's own painter and commits them, like the
// scene files, so `npm run build` needs no browser. `--check` (`npm run
// check:share-images`) is D-057 item 2's e2e guard instead: it re-renders
// all eight in memory and fails, byte for byte, against the committed
// files, printing "run npm run share:render" per that item's own wording,
// without writing anything.
//
// Not a Playwright spec under tests/ (D-057 item 2 calls this "the e2e
// suite"): playwright.config.ts's webServer only ever serves dist/ (`vite
// preview`), and dev/share-render.html/.ts are deliberately not a build
// input (item 1: "never reaches dist/"), so tests/ has no way to reach
// them. This script already drives the one server that can (see below);
// wiring the same drive logic into that fixed webServer would mean
// building dev/share-render.ts into dist/ just to satisfy a test, which
// duplicates the artefact D-057 item 1 says must not exist.
//
// dev/share-render.html is not a Vite build input (never reaches dist/);
// this script serves it with Vite's own dev server (`vite`, already a
// devDependency — no new dependency added) so dev/share-render.ts's
// TypeScript imports of src/scene/** resolve exactly as they do for the
// real app, then drives it with Playwright's Chromium (`@playwright/test`,
// already installed for the e2e suite — no new dependency either).
//
// Blocked today: dev/share-render.ts throws on the first stop that needs a
// flag ("unknown sprite \"share-flag\""), because DIA-246 (Art Director)
// hasn't exported share-flag/share-caption/share-url yet. Running this
// script now (either mode) is expected to fail there — that failure is the
// real, current state of the build, not a bug in this script.
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CHECK_MODE = process.argv.includes('--check');

// Mirrors src/scene/share-image.ts's SHARE_STOPS. Duplicated, not imported:
// this script runs under plain `node` (no tsx/ts-node — see scripts/
// run-build-content.mjs's header on why this repo avoids that), and
// share-image.ts pulls in src/content/index.ts's content.json import chain,
// which isn't worth a transpile step just for this one literal.
// share-image.test.ts is the guard against these two ever drifting apart.
const SHARE_STOPS = [80, 150, 220, 360, 490, 610, 750, 1000];

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = join(ROOT, 'public/share');
const HASHES_PATH = join(ROOT, 'src/worker/share-hashes.json');
// D-057 item 1: "≤ 300 KB (a budget in budgets.json, well under the 5 MB
// unfurl limit)". LHCI's budgets.json only ever asserts against pages it
// navigates to (`/`, `?n=750`), never a standalone asset the visitor
// fetches on demand, so the actual gate lives here instead — asserted
// right after each PNG is written, not left as an unenforced number in a
// file Lighthouse would silently skip over.
const MAX_BYTES = 300 * 1024;

async function renderOne(page, stop) {
  await page.evaluate((n) => window.__shareRender__.render(n), stop);
  const dataUrl = await page.$eval('#share-canvas', (c) => c.toDataURL('image/png'));
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Buffer.from(base64, 'base64');
}

async function main() {
  if (!CHECK_MODE) mkdirSync(OUT_DIR, { recursive: true });

  // configFile: false / plugins: [] — this page isn't the app (vite.config.ts's
  // prerenderIntro plugin expects the app's own #app-intro shell and 500s on
  // anything else, dev/share-render.html included); serving it needs nothing
  // beyond Vite's default TS/ESM transform.
  const server = await createServer({ root: ROOT, configFile: false, plugins: [], server: { port: 0 } });
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address === 'string') throw new Error('render-share-images: dev server did not report a port');
  const baseUrl = `http://localhost:${address.port}`;

  const browser = await chromium.launch();
  const hashes = {};
  try {
    const page = await browser.newPage();
    // Surfaces dev/share-render.ts's own errors (an "unknown sprite" throw,
    // today) as this script's own failure, with the browser-side stack
    // intact, instead of a silent hang or an opaque page.evaluate timeout.
    page.on('pageerror', (err) => {
      throw err;
    });
    await page.goto(`${baseUrl}/dev/share-render.html`);

    let mismatched = 0;
    for (const stop of SHARE_STOPS) {
      const png = await renderOne(page, stop);
      if (png.byteLength > MAX_BYTES) {
        throw new Error(`render-share-images: share/${stop}.png is ${png.byteLength} bytes, over the ${MAX_BYTES}-byte budget (D-057 item 1)`);
      }
      const path = join(OUT_DIR, `${stop}.png`);
      const hash = createHash('sha256').update(png).digest('hex').slice(0, 8);

      if (CHECK_MODE) {
        const committed = existsSync(path) ? readFileSync(path) : null;
        if (!committed || !committed.equals(png)) {
          console.error(`check:share-images — public/share/${stop}.png does not match the painter's current output — run npm run share:render`);
          mismatched += 1;
          continue;
        }
        console.log(`check:share-images — public/share/${stop}.png matches (${png.byteLength} bytes)`);
        continue;
      }

      writeFileSync(path, png);
      hashes[String(stop)] = hash;
      console.log(`share:render — public/share/${stop}.png (${png.byteLength} bytes, hash ${hash})`);
    }

    if (CHECK_MODE) {
      if (mismatched > 0) {
        throw new Error(`check:share-images — ${mismatched} of ${SHARE_STOPS.length} share image(s) are stale — run npm run share:render`);
      }
      return;
    }
  } finally {
    await browser.close();
    await server.close();
  }

  writeFileSync(HASHES_PATH, `${JSON.stringify(hashes, null, 2)}\n`);
  console.log(`share:render — wrote ${Object.keys(hashes).length} hashes to ${HASHES_PATH}`);

  // Defensive: every stop should have produced exactly one file, no stragglers.
  const written = readdirSync(OUT_DIR).filter((f) => f.endsWith('.png'));
  if (written.length !== SHARE_STOPS.length) {
    throw new Error(`render-share-images: expected ${SHARE_STOPS.length} PNGs in ${OUT_DIR}, found ${written.length}`);
  }
  for (const f of written) {
    if (statSync(join(OUT_DIR, f)).size === 0) throw new Error(`render-share-images: ${f} is empty`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
