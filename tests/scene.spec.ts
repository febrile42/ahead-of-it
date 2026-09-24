import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// Duplicated rather than imported from src/scene/bands: that module pulls
// in src/content/content.json, and Playwright's own Node ESM loader (this
// file runs directly under Node, not through Vite) needs an import
// attribute Node's loader doesn't supply for a plain `import x from
// './y.json'` — Vite handles that for the app bundle, Playwright doesn't
// for test files. The eight bands are stable (D-023/D-029; see
// src/scene/bands.ts's BAND_ORDER, which this must keep matching).
type BandId = 80 | 150 | 220 | 360 | 490 | 610 | 750 | 'beyond';
const BAND_ORDER: readonly BandId[] = [80, 150, 220, 360, 490, 610, 750, 'beyond'];

// content.json itself is plain JSON, so readFileSync + JSON.parse sidesteps
// the same import-attribute problem without needing a second copy of the
// content (m6 — the joined email literal used to live here as a string).
const content = JSON.parse(readFileSync(new URL('../src/content/content.json', import.meta.url), 'utf-8')) as {
  gags: Array<{ id: string; band: BandId }>;
  copy: { contact: { email: { user: string; domain: string } } };
};

// PH1-09/D-035: hotspot geometry is no longer computed in the web (that
// was src/scene/slots.ts, deleted) — it comes straight from the art
// pipeline's exported scene file (docs/product/SCENE-FORMAT.md). PH1-08b
// hasn't landed, so public/sprites/scenes/ doesn't exist in this
// worktree: `interceptFixtureScenes` serves the hand-written band-80
// fixture (tests/fixtures/) at the same URLs the app fetches in
// production. Every other band has no scene file at all yet, which is
// expected to render the "not drawn yet" placeholder (src/main.ts's
// renderMissingScene) rather than crash — see the band-loop tests below.
const FIXTURE_INDEX = JSON.parse(
  readFileSync(new URL('./fixtures/index.json', import.meta.url), 'utf-8')
) as { bands: Record<string, { built: string; without: string }> };

const FIXTURE_SCENES: Record<string, unknown> = {
  '80-built.json': JSON.parse(readFileSync(new URL('./fixtures/80-built.json', import.meta.url), 'utf-8')),
  '80-without.json': JSON.parse(readFileSync(new URL('./fixtures/80-without.json', import.meta.url), 'utf-8')),
};

async function interceptFixtureScenes(page: Page) {
  await page.route('**/sprites/scenes/index.json', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(FIXTURE_INDEX) });
  });
  for (const [fileName, body] of Object.entries(FIXTURE_SCENES)) {
    await page.route(`**/sprites/scenes/${fileName}`, async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    });
  }
  // Everything else under sprites/scenes/ (every band but 80) has no
  // fixture and no real export yet — let the request fall through to the
  // dev/preview server, where it 404s (same-origin) and src/main.ts's
  // renderMissingScene takes over.
}

function fixtureHotspotCount(band: BandId, state: 'built' | 'without'): number {
  if (band !== 80) return 0; // no fixture for any other band yet — the placeholder draws zero hotspots
  const scene = FIXTURE_SCENES[`80-${state}.json`] as { views: Array<{ hotspots: unknown[] }> };
  return scene.views[0].hotspots.length;
}

// PH1-09 acceptance: every band x both states renders at 390px without
// crashing; where a scene file exists (band 80, via the fixture), every
// hotspot is present, focusable, >=44px and centred on its rect; bands
// with no scene file yet render the placeholder with zero hotspots
// (expected — see the fixture comment above). Toggling changes the
// canvas; no request leaves origin. Also generates the three required
// screenshots (80/150/750, both states) under tests/screenshots/.

const VIEWPORT = { width: 390, height: 900 };

/** S4/S5: awaits main.ts's render() actually committing a new paint (its token changing), rather than a fixed sleep standing in for it. */
async function waitForNextRender(page: Page, prevToken: string | undefined) {
  await page.waitForFunction((prev) => {
    const token = document.body.dataset.renderedToken;
    return token !== undefined && token !== prev;
  }, prevToken);
}

async function currentRenderToken(page: Page): Promise<string | undefined> {
  return page.evaluate(() => document.body.dataset.renderedToken);
}

/** Drives the slider to `band` via its DOM value, same as a real drag would settle on, and waits for the render it triggers (if any — setting the band that's already current renders nothing, by design). */
async function setBand(page: Page, band: BandId) {
  const before = await page.evaluate(() => document.body.dataset.band);
  if (before === String(band)) return; // already there — no render will fire, nothing to wait for
  const prev = await currentRenderToken(page);
  const raw = band === 'beyond' ? 1000 : band;
  await page.locator('#headcount-slider').evaluate((el, value) => {
    const input = el as HTMLInputElement;
    input.value = String(value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, raw);
  await waitForNextRender(page, prev);
}

async function setState(page: Page, state: 'built' | 'without') {
  const button = page.locator('.toggle__button');
  const pressed = await button.getAttribute('aria-pressed');
  const isWithout = pressed === 'true';
  if ((state === 'without') !== isWithout) {
    const prev = await currentRenderToken(page);
    await button.click();
    await waitForNextRender(page, prev);
  }
}

test.describe('no third-party requests (R-21)', () => {
  test('loading the app makes no off-origin requests', async ({ page }) => {
    const offOrigin: string[] = [];
    page.on('request', (request) => {
      const { hostname } = new URL(request.url());
      if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
        offOrigin.push(request.url());
      }
    });
    await interceptFixtureScenes(page);
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await page.waitForFunction(() => document.body.dataset.renderedToken !== undefined);
    expect(offOrigin).toEqual([]);
  });
});

test.describe('every band x both states (PH1-09 acceptance)', () => {
  for (const band of BAND_ORDER) {
    for (const state of ['built', 'without'] as const) {
      test(`band ${band} / ${state} renders with every hotspot focusable and centred`, async ({ page }) => {
        await interceptFixtureScenes(page);
        await page.setViewportSize(VIEWPORT);
        await page.goto('/');
        await page.waitForFunction(() => document.body.dataset.renderedToken !== undefined);
        await setBand(page, band);
        await setState(page, state);

        const layerHandle = page.locator('#hotspots-layer');
        const hotspots = page.locator('.hotspot');
        await expect(hotspots).toHaveCount(fixtureHotspotCount(band, state));

        const bufferW = Number(await layerHandle.getAttribute('data-buffer-w'));
        const count = await hotspots.count();
        for (let i = 0; i < count; i += 1) {
          const button = hotspots.nth(i);
          await button.focus();
          await expect(button).toBeFocused();

          // Recomputed per hotspot: focusing an off-screen hotspot
          // auto-scrolls .scene-wrap (the horizontally-scrolling
          // container — see src/style.css), which moves
          // #hotspots-layer relative to the viewport along with it.
          const layerBox = await layerHandle.boundingBox();
          expect(layerBox).not.toBeNull();
          const scale = layerBox!.width / bufferW;

          const box = await button.boundingBox();
          expect(box?.width).toBeGreaterThanOrEqual(44);
          expect(box?.height).toBeGreaterThanOrEqual(44);

          // B2/S4: the button's rendered centre must match the hotspot
          // rect's centre (data-cx/cy, in buffer units) within 1px, not
          // just be positioned "somewhere".
          const expectCx = Number(await button.getAttribute('data-cx'));
          const expectCy = Number(await button.getAttribute('data-cy'));
          const actualCx = box!.x - layerBox!.x + box!.width / 2;
          const actualCy = box!.y - layerBox!.y + box!.height / 2;
          expect(Math.abs(actualCx - expectCx * scale)).toBeLessThanOrEqual(1);
          expect(Math.abs(actualCy - expectCy * scale)).toBeLessThanOrEqual(1);
        }
      });
    }
  }
});

test.describe('toggling changes the canvas', () => {
  test('built and without states render different pixels', async ({ page }) => {
    await interceptFixtureScenes(page);
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await page.waitForFunction(() => document.body.dataset.renderedToken !== undefined);
    await setBand(page, 80);
    await setState(page, 'built');
    const builtHash = await page.locator('#scene-canvas').evaluate((c) => (c as HTMLCanvasElement).toDataURL());

    await setState(page, 'without');
    const withoutHash = await page.locator('#scene-canvas').evaluate((c) => (c as HTMLCanvasElement).toDataURL());

    expect(builtHash).not.toBe(withoutHash);
  });
});

test.describe('email is never a joined string in the page', () => {
  test('the mailto link is assembled but the raw address never appears as page text', async ({ page }) => {
    // m6: built from content.json's split fields, not a literal — the
    // literal is exactly what this test exists to make sure never leaks.
    const { user, domain } = content.copy.contact.email;
    const assembled = `${user}@${domain}`;

    await interceptFixtureScenes(page);
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await page.waitForFunction(() => document.body.dataset.renderedToken !== undefined);
    await setBand(page, 80);
    await page.locator('.hotspot').first().click();
    await page.waitForTimeout(150); // the panel opening has no render token of its own — it's a DOM show, not a scene render
    const href = await page.locator('.contact-line a').nth(1).getAttribute('href');
    expect(href).toBe(`mailto:${assembled}`);

    const bodyText = await page.locator('body').innerText();
    expect(bodyText.includes(assembled)).toBe(false);
  });
});

test.describe('screenshots (acceptance: bands 80/150/750, both states)', () => {
  // Only band 80 has a scene file (the fixture); 150 and 750 render the
  // "not drawn yet" placeholder — expected until PH1-08b lands, and
  // exactly what the opus reviewer should see when reading these against
  // art/preview/.
  for (const band of [80, 150, 750] as const) {
    for (const state of ['built', 'without'] as const) {
      test(`screenshot band ${band} / ${state}`, async ({ page }) => {
        await interceptFixtureScenes(page);
        await page.setViewportSize(VIEWPORT);
        await page.goto('/');
        await page.waitForFunction(() => document.body.dataset.renderedToken !== undefined);
        await setBand(page, band);
        await setState(page, state);
        await page.screenshot({ path: `tests/screenshots/band-${band}-${state}.png` });
      });
    }
  }
});
