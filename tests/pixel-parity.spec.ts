import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// PH1-09 acceptance: "pixel parity at scale 1 (getImageData vs
// art/preview/<band>-<state>@1x.png) for every drawn band once PH1-08b
// lands — against the fixture until then."
//
// The comparison itself (`comparePixels`) never decodes PNGs in Node —
// it hands the golden file's bytes into the page as a data URL and lets
// the browser's own <img>/canvas decode and diff it against the live
// #scene-canvas, entirely with the Canvas API. That means this file adds
// no PNG-decoding dependency and needs no change to package.json.
//
// Two sources run through the same `runParitySuite`, so swapping the
// first one in once PH1-08b lands needs no rewrite here:
//   1. public/sprites/scenes/*.json vs art/preview/<band>-<state>@1x.png
//      — skipped explicitly (not silently green) until both exist.
//   2. tests/fixtures/80-{built,without}.json vs a golden PNG rendered
//      once from this same fixture and checked in
//      (tests/fixtures/80-{built,without}-golden.png) — "tested against
//      the fixture" per the brief, since no real art export exists yet.
const fixturesDir = fileURLToPath(new URL('./fixtures/', import.meta.url));
const scenesDir = fileURLToPath(new URL('../public/sprites/scenes/', import.meta.url));
const artPreviewDir = fileURLToPath(new URL('../art/preview/', import.meta.url));

interface ParityCase {
  label: string;
  band: number;
  state: 'built' | 'without';
  sceneFileName: string; // what the app fetches at /sprites/scenes/<sceneFileName>
  sceneBody: string;
  indexBody: string;
  goldenPath: string; // absolute path to the PNG to compare against
}

function fixtureCases(): ParityCase[] {
  const indexBody = readFileSync(`${fixturesDir}index.json`, 'utf-8');
  const cases: ParityCase[] = [];
  for (const state of ['built', 'without'] as const) {
    cases.push({
      label: `fixture band 80/${state}`,
      band: 80,
      state,
      sceneFileName: `80-${state}.json`,
      sceneBody: readFileSync(`${fixturesDir}80-${state}.json`, 'utf-8'),
      indexBody,
      goldenPath: `${fixturesDir}80-${state}-golden.png`,
    });
  }
  return cases;
}

/** The real thing, once PH1-08b lands: every public/sprites/scenes/<band>-<state>.json paired with art/preview/<band>-<state>@1x.png. Empty (and the suite skips, loudly) until both exist. */
function realCases(): ParityCase[] {
  if (!existsSync(`${scenesDir}index.json`)) return [];
  const indexBody = readFileSync(`${scenesDir}index.json`, 'utf-8');
  const files = readdirSync(scenesDir).filter((f: string) => f.endsWith('.json') && f !== 'index.json');
  const cases: ParityCase[] = [];
  for (const file of files) {
    const golden = `${artPreviewDir}${file.replace('.json', '@1x.png')}`;
    if (!existsSync(golden)) continue;
    const scene = JSON.parse(readFileSync(`${scenesDir}${file}`, 'utf-8')) as {
      band: number;
      state: 'built' | 'without';
    };
    cases.push({
      label: `public/sprites/scenes/${file}`,
      band: scene.band,
      state: scene.state,
      sceneFileName: file,
      sceneBody: readFileSync(`${scenesDir}${file}`, 'utf-8'),
      indexBody,
      goldenPath: golden,
    });
  }
  return cases;
}

async function gotoAtScale1(page: Page, c: ParityCase) {
  // A viewport well within one native-width multiple keeps
  // chooseScale's `s = max(1, floor(cssAvail*dpr/nativeW))` at exactly 1
  // regardless of the fixture's own native size (band 80 is 270px wide;
  // 300 CSS px of available width and dpr 1 can't reach scale 2 for
  // anything up to 599px native).
  await page.setViewportSize({ width: 300, height: 700 });
  await page.route('**/sprites/scenes/index.json', (route) =>
    route.fulfill({ contentType: 'application/json', body: c.indexBody })
  );
  await page.route(`**/sprites/scenes/${c.sceneFileName}`, (route) =>
    route.fulfill({ contentType: 'application/json', body: c.sceneBody })
  );
  await page.goto('/');
  await page.waitForFunction(() => document.body.dataset.renderedToken !== undefined);

  const before = await page.evaluate(() => document.body.dataset.band);
  if (before !== String(c.band)) {
    const prevToken = await page.evaluate(() => document.body.dataset.renderedToken);
    await page.locator('#headcount-slider').evaluate((el, value) => {
      const input = el as HTMLInputElement;
      input.value = String(value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, c.band);
    await page.waitForFunction((prev) => document.body.dataset.renderedToken !== prev, prevToken);
  }
  if (c.state === 'without') {
    const pressed = await page.locator('.toggle__button').getAttribute('aria-pressed');
    if (pressed !== 'true') {
      const prevToken = await page.evaluate(() => document.body.dataset.renderedToken);
      await page.locator('.toggle__button').click();
      await page.waitForFunction((prev) => document.body.dataset.renderedToken !== prev, prevToken);
    }
  }
}

/** Decodes `goldenPath` and #scene-canvas's live pixels in the *same*
 * browser canvas context (nearest-neighbour, no smoothing) and diffs
 * them byte for byte — entirely client-side, no Node PNG decoder. */
async function comparePixels(page: Page, goldenPath: string) {
  const b64 = readFileSync(goldenPath).toString('base64');
  return page.evaluate(async (dataB64) => {
    const img = new Image();
    const loaded = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('golden image failed to decode'));
    });
    img.src = `data:image/png;base64,${dataB64}`;
    await loaded;

    const off = document.createElement('canvas');
    off.width = img.naturalWidth;
    off.height = img.naturalHeight;
    const octx = off.getContext('2d')!;
    octx.imageSmoothingEnabled = false;
    octx.drawImage(img, 0, 0);
    const golden = octx.getImageData(0, 0, off.width, off.height).data;

    const canvas = document.querySelector('#scene-canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const sameSize = canvas.width === off.width && canvas.height === off.height;
    let diffPixels = 0;
    if (sameSize) {
      const live = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 0; i < live.length; i += 4) {
        if (live[i] !== golden[i] || live[i + 1] !== golden[i + 1] || live[i + 2] !== golden[i + 2] || live[i + 3] !== golden[i + 3]) {
          diffPixels += 1;
        }
      }
    }
    return {
      goldenW: off.width,
      goldenH: off.height,
      canvasW: canvas.width,
      canvasH: canvas.height,
      sameSize,
      diffPixels,
    };
  }, b64);
}

function runParitySuite(sourceLabel: string, cases: ParityCase[]) {
  test.describe(`pixel parity — ${sourceLabel}`, () => {
    if (cases.length === 0) {
      test.skip(`${sourceLabel}: no scene files + art/preview goldens to compare yet`, () => {});
      return;
    }
    for (const c of cases) {
      test(`${c.label} matches its golden at scale 1`, async ({ page }) => {
        await gotoAtScale1(page, c);
        const result = await comparePixels(page, c.goldenPath);
        expect(result.canvasW, `${c.label}: canvas backing width == golden width (scale 1)`).toBe(result.goldenW);
        expect(result.canvasH, `${c.label}: canvas backing height == golden height (scale 1)`).toBe(result.goldenH);
        expect(result.diffPixels, `${c.label}: pixel-for-pixel match`).toBe(0);
      });
    }
  });
}

runParitySuite('public/sprites/scenes (real, once PH1-08b lands)', realCases());
runParitySuite('tests/fixtures (hand-written, exercised now)', fixtureCases());
