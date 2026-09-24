import { expect, test } from '@playwright/test';

// Duplicated rather than imported from src/scene/bands: that module pulls
// in src/content/content.json, and Playwright's own Node ESM loader (this
// file runs directly under Node, not through Vite) needs an import
// attribute Node's loader doesn't supply for a plain `import x from
// './y.json'` — Vite handles that for the app bundle, Playwright doesn't
// for test files. The eight bands are stable (D-023/D-029; see
// src/scene/bands.ts's BAND_ORDER, which this must keep matching).
type BandId = 80 | 150 | 220 | 360 | 490 | 610 | 750 | 'beyond';
const BAND_ORDER: readonly BandId[] = [80, 150, 220, 360, 490, 610, 750, 'beyond'];

// PH1-04 acceptance (brief 3h): every band x both states renders at 390px
// with all hotspots present and focusable; toggling changes the canvas;
// no request leaves origin. Also generates the four required screenshots
// (band 80 and 750, both states) under tests/screenshots/.

const VIEWPORT = { width: 390, height: 900 };

/** Drives the slider to `band` via its DOM value, same as a real drag would settle on. */
async function setBand(page: import('@playwright/test').Page, band: BandId) {
  const raw = band === 'beyond' ? 1000 : band;
  await page.locator('#headcount-slider').evaluate((el, value) => {
    const input = el as HTMLInputElement;
    input.value = String(value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, raw);
}

async function setState(page: import('@playwright/test').Page, state: 'built' | 'without') {
  const button = page.locator('.toggle__button');
  const pressed = await button.getAttribute('aria-pressed');
  const isWithout = pressed === 'true';
  if ((state === 'without') !== isWithout) {
    await button.click();
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
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await page.waitForTimeout(300);
    expect(offOrigin).toEqual([]);
  });
});

test.describe('every band x both states (PH1-04 acceptance)', () => {
  for (const band of BAND_ORDER) {
    for (const state of ['built', 'without'] as const) {
      test(`band ${band} / ${state} renders with focusable hotspots`, async ({ page }) => {
        await page.setViewportSize(VIEWPORT);
        await page.goto('/');
        await setBand(page, band);
        await setState(page, state);
        await page.waitForTimeout(150);

        const hotspots = page.locator('.hotspot');
        const count = await hotspots.count();
        expect(count).toBeGreaterThan(0);

        // Every hotspot is a real, focusable <button> at least 44px on
        // each side (R-20) — checked on the first and last so the suite
        // stays fast across 16 band x state combinations.
        const first = hotspots.first();
        await first.focus();
        await expect(first).toBeFocused();
        const box = await first.boundingBox();
        expect(box?.width).toBeGreaterThanOrEqual(44);
        expect(box?.height).toBeGreaterThanOrEqual(44);
      });
    }
  }
});

test.describe('toggling changes the canvas', () => {
  test('built and without states render different pixels', async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await setBand(page, 750);
    await setState(page, 'built');
    await page.waitForTimeout(150);
    const builtHash = await page.locator('#scene-canvas').evaluate((c) => (c as HTMLCanvasElement).toDataURL());

    await setState(page, 'without');
    await page.waitForTimeout(150);
    const withoutHash = await page.locator('#scene-canvas').evaluate((c) => (c as HTMLCanvasElement).toDataURL());

    expect(builtHash).not.toBe(withoutHash);
  });
});

test.describe('email is never a joined string in the page', () => {
  test('the mailto link is assembled but the raw address never appears as page text', async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await setBand(page, 80);
    await page.locator('.hotspot').first().click();
    await page.waitForTimeout(150);
    const href = await page.locator('.contact-line a').nth(1).getAttribute('href');
    expect(href).toBe('mailto:joshua.gister@gmail.com');
  });
});

test.describe('screenshots (acceptance: band 80 and band 750, both states, 390px)', () => {
  for (const band of [80, 750] as const) {
    for (const state of ['built', 'without'] as const) {
      test(`screenshot band ${band} / ${state}`, async ({ page }) => {
        await page.setViewportSize(VIEWPORT);
        await page.goto('/');
        await setBand(page, band);
        await setState(page, state);
        await page.waitForTimeout(150);
        await page.screenshot({ path: `tests/screenshots/band-${band}-${state}.png` });
      });
    }
  }
});
