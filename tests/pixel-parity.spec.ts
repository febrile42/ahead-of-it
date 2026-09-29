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
  viewKind: 'room' | 'closeup';
  viewParent?: string;
  viewSize: { w: number; h: number };
  sceneFileName: string; // what the app fetches at /sprites/scenes/<sceneFileName>
  sceneBody: string;
  indexBody: string;
  goldenPath: string; // absolute path to the PNG to compare against — may not exist; the test itself asserts that and fails, doesn't skip
}

interface RawIndex {
  schema?: number;
  bands: Record<string, { built: string; without: string }>;
  beyond: string;
}

interface RawSceneFile {
  views: Array<{ id: string; kind: 'room' | 'closeup'; parent?: string; size: { w: number; h: number } }>;
}

/**
 * D-042: a golden is named `<band>-<state>-<viewId>@1x.png` — one per room
 * AND per close-up (fix round item 4's per-view naming, unchanged by this
 * brief), matching art/preview/views/'s real convention so the fixture and
 * real cases below share one golden-path scheme.
 */
function casesForScene(opts: {
  band: number;
  state: 'built' | 'without';
  sceneFileName: string;
  sceneBody: string;
  indexBody: string;
  goldenPath: (viewId: string) => string;
}): ParityCase[] {
  const scene = JSON.parse(opts.sceneBody) as RawSceneFile;
  return scene.views.map((view) => ({
    label: `band ${opts.band}/${opts.state} view "${view.id}"`,
    band: opts.band,
    state: opts.state,
    viewId: view.id,
    viewKind: view.kind,
    viewParent: view.parent,
    viewSize: view.size,
    sceneFileName: opts.sceneFileName,
    sceneBody: opts.sceneBody,
    indexBody: opts.indexBody,
    goldenPath: opts.goldenPath(view.id),
  }));
}

function fixtureCases(): ParityCase[] {
  const indexBody = readFileSync(`${fixturesDir}index.json`, 'utf-8');
  const cases: ParityCase[] = [];
  for (const state of ['built', 'without'] as const) {
    const sceneFileName = `80-${state}.json`;
    const sceneBody = readFileSync(`${fixturesDir}${sceneFileName}`, 'utf-8');
    cases.push(
      ...casesForScene({
        band: 80,
        state,
        sceneFileName,
        sceneBody,
        indexBody,
        goldenPath: (viewId) => `${fixturesDir}80-${state}-${viewId}@1x.png`,
      })
    );
  }
  return cases;
}

/**
 * The real thing, once the D-042 exporter lands: every view (room and
 * close-up alike) of every band that has at least one golden under
 * art/preview/views/ is a "drawn" band and gets a case per view x state —
 * missing a specific view's golden is a hard failure there, not a skip.
 * Bands with zero goldens at all (still placeholder-only) are reported as
 * named skips instead. Gated on schema 2 like scene-source.ts's
 * `hasRealScenes()` — public/sprites/scenes/ is schema 1 until the exporter
 * lands, and the painter refuses it ("not drawn yet"), so testing it here
 * against a schema-2-shaped golden would fail on the wrong axis.
 */
function realCases(): { cases: ParityCase[]; skips: string[] } {
  if (!existsSync(`${scenesDir}index.json`)) return { cases: [], skips: [] };
  const indexBody = readFileSync(`${scenesDir}index.json`, 'utf-8');
  const index = JSON.parse(indexBody) as RawIndex;
  if (index.schema !== 2) {
    return { cases: [], skips: ['public/sprites/scenes: still schema 1 — the D-042 exporter has not landed yet'] };
  }
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
      cases.push(
        ...casesForScene({
          band,
          state,
          sceneFileName: fileName,
          sceneBody,
          indexBody,
          goldenPath: (viewId) => `${viewsGoldenDir}${band}-${state}-${viewId}@1x.png`,
        })
      );
    }
  }
  return { cases, skips };
}

async function gotoAtScale1(page: Page, c: ParityCase) {
  // A viewport well within one native-size multiple on both axes keeps
  // chooseScale's two-axis `s = max(1, min(floor(cssAvailW*dpr/nativeW),
  // floor(cssAvailH*dpr/nativeH)))` at exactly 1 for this view's own
  // native size (every D-036 view is <= 360x240; giving the wrap up to
  // 300 css px wide / native height + 400 tall at dpr 1 can't reach
  // scale 2 on either axis for anything up to 599px native). This math is
  // dpr-1-only by construction, so it needs the page's own dpr pinned to
  // 1 too (DIA-18) — the webkit-iphone project's `iPhone 14` descriptor
  // carries deviceScaleFactor: 3, and chooseScale correctly picks a
  // higher scale there since it *is* dpr-aware (R-25); goldens were
  // captured at dpr 1, so the test's job is to hold dpr at 1, not to
  // redo chooseScale's own math here — see the file-level `test.use`
  // below, which is the only place dpr can actually be pinned
  // (deviceScaleFactor is a context-creation option, not something a
  // live page can change).
  // PH2-02/R-24: goldens are the rest pose (t = 0), so this suite must stay
  // valid once PH2-01 adds animation — emulating reduced motion up front
  // means a future animated entry paints its rest pose here exactly as it
  // does today, with no change to this file when that lands.
  await page.emulateMedia({ reducedMotion: 'reduce' });
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
    // U-10 (DIA-194/197): aria-pressed removed from the toggle; data-state
    // carries which fill (and now which state) it is in instead.
    const state = await page.locator('.toggle__button').getAttribute('data-state');
    if (state !== 'without') {
      const prevToken = await page.evaluate(() => document.body.dataset.renderedToken);
      await page.locator('.toggle__button').click();
      await page.waitForFunction((prev) => document.body.dataset.renderedToken !== prev, prevToken);
    }
  }
  await gotoView(page, c);
}

/** Clicks `locator` and waits for the render it causes. */
async function clickAndWaitForRender(page: Page, locator: ReturnType<Page['locator']>) {
  const prevToken = await page.evaluate(() => document.body.dataset.renderedToken);
  await locator.click();
  await page.waitForFunction((prev) => document.body.dataset.renderedToken !== prev, prevToken);
}

/**
 * Reaches `c.viewId` — a room (its own tab) or a close-up (reached through
 * its room's tab, then a click on that room's "zoom in" button) — from
 * wherever the app currently is. Mirrors src/main.ts's actual navigation
 * (D-042a, amended by D-051 item 2): there is no direct per-view tab any
 * more, so a close-up not currently on screen is always one room-tab click
 * (which lands on the room overview itself, D-051) plus at most one
 * zoom-in click away.
 */
async function gotoView(page: Page, c: ParityCase) {
  if ((await page.evaluate(() => document.body.dataset.view)) === c.viewId) return;
  if (c.viewParent) {
    const currentRoom = await page.evaluate(() => document.body.dataset.room);
    if (currentRoom !== c.viewParent) {
      await clickAndWaitForRender(page, page.locator(`.scene-views__button[data-view-id="${c.viewParent}"]`));
    }
    if ((await page.evaluate(() => document.body.dataset.view)) === c.viewId) return;
    // D-051: the room tab click above already lands on the room overview
    // itself (item 2, was the room's default close-up) — "whole floor" is
    // only needed here if we somehow aren't on it yet.
    if ((await page.evaluate(() => document.body.dataset.view !== document.body.dataset.room))) {
      await clickAndWaitForRender(page, page.locator('.scene-stepper__floor'));
    }
    await clickAndWaitForRender(page, page.locator(`.hotspot--zoom[data-view-id="${c.viewId}"]`));
  } else {
    // A room with no parent: reach it from its own default close-up via
    // "whole floor" (there is no way to land on a room overview directly).
    const currentRoom = await page.evaluate(() => document.body.dataset.room);
    if (currentRoom !== c.viewId) {
      await clickAndWaitForRender(page, page.locator(`.scene-views__button[data-view-id="${c.viewId}"]`));
    }
    if ((await page.evaluate(() => document.body.dataset.view)) === c.viewId) return;
    await clickAndWaitForRender(page, page.locator('.scene-stepper__floor'));
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

// DIA-18: every golden under tests/fixtures/ and art/preview/views/ was
// captured at dpr 1, and gotoAtScale1's viewport math (above) only holds
// chooseScale at scale 1 when dpr is 1 too. Pinning it here — the one
// place Playwright lets a test override a project's context options —
// keeps this file's own "scale 1" contract project-independent, instead
// of every project's device descriptor (e.g. webkit-iphone's `iPhone 14`,
// deviceScaleFactor: 3) leaking into which scale chooseScale picks.
test.use({ deviceScaleFactor: 1 });

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
