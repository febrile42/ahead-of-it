import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// PH1-09 acceptance: "pixel parity at scale 1 (getImageData vs
// art/preview/<band>-<state>@1x.png) for every drawn band once PH1-08b
// lands — against the fixture until then."
//
// Fix round item 4: views are crops of a bigger composed scene, so a
// single whole-building golden per band x state can't work once there's
// more than one view — PH1-08b writes one golden per *view*:
// art/preview/views/<band>-<state>-<viewId>@1x.png. This file diffs every
// view of every drawn band against its own golden. A band with no
// goldens at all (360+, placeholder-only until later art) is skipped
// with a named reason; a band that has *some* goldens but is missing one
// for a specific view fails loudly instead of being silently dropped.
//
// The comparison itself (`comparePixels`) never decodes PNGs in Node —
// it hands the golden file's bytes into the page as a data URL and lets
// the browser's own <img>/canvas decode and diff it against the live
// #scene-canvas, entirely with the Canvas API. That means this file adds
// no PNG-decoding dependency and needs no change to package.json.
const fixturesDir = fileURLToPath(new URL('./fixtures/', import.meta.url));
const scenesDir = fileURLToPath(new URL('../public/sprites/scenes/', import.meta.url));
const viewsGoldenDir = fileURLToPath(new URL('../art/preview/views/', import.meta.url));

interface ParityCase {
  label: string;
  band: number;
  state: 'built' | 'without';
  viewId: string;
  viewSize: { w: number; h: number };
  sceneFileName: string; // what the app fetches at /sprites/scenes/<sceneFileName>
  sceneBody: string;
  indexBody: string;
  goldenPath: string; // absolute path to the PNG to compare against — may not exist; the test itself asserts that and fails, doesn't skip
}

interface RawIndex {
  bands: Record<string, { built: string; without: string }>;
  beyond: string;
}

interface RawSceneFile {
  views: Array<{ id: string; size: { w: number; h: number } }>;
}

function fixtureCases(): ParityCase[] {
  const indexBody = readFileSync(`${fixturesDir}index.json`, 'utf-8');
  const cases: ParityCase[] = [];
  for (const state of ['built', 'without'] as const) {
    const sceneBody = readFileSync(`${fixturesDir}80-${state}.json`, 'utf-8');
    const scene = JSON.parse(sceneBody) as RawSceneFile;
    const view = scene.views[0];
    cases.push({
      label: `fixture band 80/${state} view "${view.id}"`,
      band: 80,
      state,
      viewId: view.id,
      viewSize: view.size,
      sceneFileName: `80-${state}.json`,
      sceneBody,
      indexBody,
      goldenPath: `${fixturesDir}80-${state}-golden.png`,
    });
  }
  return cases;
}

/**
 * The real thing, once PH1-08b lands: every view of every band that has
 * at least one golden under art/preview/views/ is a "drawn" band and
 * gets a case per view x state — missing a specific view's golden is a
 * hard failure there, not a skip. Bands with zero goldens at all (still
 * placeholder-only) are reported as named skips instead.
 */
function realCases(): { cases: ParityCase[]; skips: string[] } {
  if (!existsSync(`${scenesDir}index.json`)) return { cases: [], skips: [] };
  const indexBody = readFileSync(`${scenesDir}index.json`, 'utf-8');
  const index = JSON.parse(indexBody) as RawIndex;
  const goldenFiles = existsSync(viewsGoldenDir) ? readdirSync(viewsGoldenDir) : [];

  const bands = Object.keys(index.bands)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

  const cases: ParityCase[] = [];
  const skips: string[] = [];

  for (const band of bands) {
    const hasAnyGolden = goldenFiles.some((f: string) => f.startsWith(`${band}-`));
    if (!hasAnyGolden) {
      skips.push(`band ${band}: no goldens under art/preview/views/ — placeholder-only band, not drawn yet`);
      continue;
    }
    for (const state of ['built', 'without'] as const) {
      const fileName = index.bands[String(band)]?.[state];
      if (!fileName) continue; // the contract test is what enforces full coverage; this suite just describes what it finds
      const sceneBody = readFileSync(`${scenesDir}${fileName}`, 'utf-8');
      const scene = JSON.parse(sceneBody) as RawSceneFile;
      for (const view of scene.views) {
        cases.push({
          label: `band ${band}/${state} view "${view.id}"`,
          band,
          state,
          viewId: view.id,
          viewSize: view.size,
          sceneFileName: fileName,
          sceneBody,
          indexBody,
          goldenPath: `${viewsGoldenDir}${band}-${state}-${view.id}@1x.png`,
        });
      }
    }
  }
  return { cases, skips };
}

async function gotoAtScale1(page: Page, c: ParityCase) {
  // A viewport well within one native-width multiple keeps
  // chooseScale's `s = max(1, floor(cssAvail*dpr/nativeW))` at exactly 1
  // for this view's own native size (every D-036 view is <= 360 wide;
  // giving the wrap up to 300 css px and dpr 1 can't reach scale 2 for
  // anything up to 599px native).
  await page.setViewportSize({ width: 300, height: Math.max(700, c.viewSize.h + 400) });
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
  // Switch to the requested view if it isn't already the default —
  // src/main.ts's view switcher is a real tab row, one button per view.
  const currentView = await page.evaluate(() => document.body.dataset.view);
  if (currentView !== c.viewId) {
    const prevToken = await page.evaluate(() => document.body.dataset.renderedToken);
    await page.locator(`.scene-views__button[data-view-id="${c.viewId}"]`).click();
    await page.waitForFunction((prev) => document.body.dataset.renderedToken !== prev, prevToken);
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
        if (
          live[i] !== golden[i] ||
          live[i + 1] !== golden[i + 1] ||
          live[i + 2] !== golden[i + 2] ||
          live[i + 3] !== golden[i + 3]
        ) {
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

function runParityCase(c: ParityCase) {
  test(`${c.label} matches its golden at scale 1`, async ({ page }) => {
    // A drawn band missing a specific view's golden is a hard failure
    // (fix round item 4), not a skip — someone has to notice.
    expect(existsSync(c.goldenPath), `${c.label}: expected a golden at ${c.goldenPath}`).toBe(true);
    await gotoAtScale1(page, c);
    const result = await comparePixels(page, c.goldenPath);
    expect(result.canvasW, `${c.label}: canvas backing width == golden width (scale 1)`).toBe(result.goldenW);
    expect(result.canvasH, `${c.label}: canvas backing height == golden height (scale 1)`).toBe(result.goldenH);
    expect(result.diffPixels, `${c.label}: pixel-for-pixel match`).toBe(0);
  });
}

test.describe('pixel parity — tests/fixtures (hand-written, exercised now)', () => {
  for (const c of fixtureCases()) {
    runParityCase(c);
  }
});

test.describe('pixel parity — public/sprites/scenes (real, once PH1-08b lands)', () => {
  const { cases, skips } = realCases();
  if (cases.length === 0 && skips.length === 0) {
    test.skip('public/sprites/scenes: no scene files yet — nothing to compare', () => {});
  } else {
    for (const reason of skips) {
      test.skip(reason, () => {});
    }
    for (const c of cases) {
      runParityCase(c);
    }
  }
});
