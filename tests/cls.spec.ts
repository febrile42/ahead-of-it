import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// PH1-09/D-035: the default band (80) needs a real scene file to measure
// CLS/scroll against something other than the "not drawn yet" placeholder
// — public/sprites/scenes/ doesn't exist yet (PH1-08b hasn't landed), so
// this serves the hand-written fixture at the URL the app actually
// fetches. See tests/scene.spec.ts for the fuller version of this shim.
async function interceptFixtureScenes(page: Page) {
  const index = readFileSync(new URL('./fixtures/index.json', import.meta.url), 'utf-8');
  const built = readFileSync(new URL('./fixtures/80-built.json', import.meta.url), 'utf-8');
  await page.route('**/sprites/scenes/index.json', (route) =>
    route.fulfill({ contentType: 'application/json', body: index })
  );
  await page.route('**/sprites/scenes/80-built.json', (route) =>
    route.fulfill({ contentType: 'application/json', body: built })
  );
}

// PH1-04 review S1/S2: everything above the canvas (slider, readout,
// ticks, toggle, tagline) used to be built by JS into empty roots, and the
// canvas started at the browser default 300x150 before main.ts sized it —
// together a measured 0.2147 CLS at 4x CPU / 1.6 Mbps throttling, even
// though the Lighthouse lab run (simulated throttling, Lantern) passed
// with CLS 0 because the bundle ran before first paint under simulation.
// Real throttling — CDP CPU + network emulation on a real Chromium — is
// the only way to catch this, hence its own file and its own (optionally
// pinned) browser executable.
test.use({
  launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
});

const VIEWPORT = { width: 390, height: 844 };

test.describe('CLS under throttling (PH1-04 review S1)', () => {
  test('cumulative layout shift stays under 0.1 at 390px, 4x CPU / 1.6 Mbps', async ({ page }) => {
    const client = await page.context().newCDPSession(page);
    await client.send('Network.enable');
    // ~1.6 Mbps down / 750 Kbps up, 150ms latency — the review's own
    // throttling profile.
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    // Installed before navigation so it catches every shift from first
    // paint onward, not just ones after the test script gets control back.
    await page.addInitScript(() => {
      const w = window as unknown as { __clsValue: number };
      w.__clsValue = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as unknown as { hadRecentInput: boolean; value: number };
          if (!shift.hadRecentInput) {
            w.__clsValue += shift.value;
          }
        }
      });
      observer.observe({ type: 'layout-shift', buffered: true });
    });

    await interceptFixtureScenes(page);
    await page.setViewportSize(VIEWPORT);
    await page.goto('/', { timeout: 60_000 });
    await page.waitForFunction(() => document.body.dataset.renderedToken !== undefined, { timeout: 60_000 });
    // A little past first render so any trailing shift settles before we
    // read the total (the review notes even an excluded, input-driven
    // shift "still jumps" visually, so this window is intentionally short).
    await page.waitForTimeout(500);

    const cls = await page.evaluate(() => (window as unknown as { __clsValue: number }).__clsValue);
    expect(cls).toBeLessThan(0.1);
  });
});

test.describe('no page-level horizontal scroll at 390px (PH1-04 review S2)', () => {
  test('documentElement.scrollWidth equals the viewport width', async ({ page }) => {
    await interceptFixtureScenes(page);
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await page.waitForFunction(() => document.body.dataset.renderedToken !== undefined);

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBe(VIEWPORT.width);
  });
});
