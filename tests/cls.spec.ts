import { expect, test } from '@playwright/test';
import * as H from './interaction-helpers';
import { interceptFixtureScenes } from './scene-source';

// PH1-09/D-035: the default band (80) needs a real scene file to measure
// CLS/scroll against something other than the "not drawn yet" placeholder.
// `interceptFixtureScenes` (tests/scene-source.ts) only serves the
// hand-written fixture when public/sprites/scenes/ doesn't exist yet — it
// never masks a real export.

// PH1-04 review S1/S2: everything above the canvas (slider, readout,
// ticks, toggle, tagline) used to be built by JS into empty roots, and the
// canvas started at the browser default 300x150 before main.ts sized it —
// together a measured 0.2147 CLS at 4x CPU / 1.6 Mbps throttling, even
// though the Lighthouse lab run (simulated throttling, Lantern) passed
// with CLS 0 because the bundle ran before first paint under simulation.
// Real throttling — CDP CPU + network emulation on a real Chromium — is
// the only way to catch this, hence its own file. The pinned CHROME_PATH
// binary (so this shares one Chromium with Lighthouse in CI) lives on the
// `chromium` project in playwright.config.ts, not a file-level test.use
// here — a file-level override applied to every test in this file
// regardless of project, so under `webkit-iphone` it launched the Chrome
// binary through WebKit's launch protocol and crashed (DIA-15 follow-up).

const VIEWPORT = { width: 390, height: 844 };

test.describe('CLS under throttling (PH1-04 review S1)', () => {
  test('cumulative layout shift stays under 0.1 at 390px, 4x CPU / 1.6 Mbps', async ({ page, browserName }) => {
    // DIA-18: newCDPSession is a Chromium-only API (line 16-18's own
    // rationale for real CDP throttling already assumes Chromium) — on
    // the webkit-iphone project this throws before the test can even
    // start, which isn't a DPR/rendering bug, just the wrong engine for
    // this technique. There's no WebKit equivalent to emulate CPU/network
    // throttling from Playwright, so skip rather than fake a result.
    test.skip(browserName !== 'chromium', 'CDP throttling is Chromium-only; not testable on WebKit');
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

// Review fix (DIA-46 item 3): the test above only measures first load. The
// brief's own acceptance line is "switching views and bands measures 0" —
// sizeAndPositionCanvas keeps .scene-wrap's box, the tab row and the
// stepper row at a constant height across every view/band/state (D-042a),
// so this locks that in rather than leaving it merely true by inspection.
//
// DIA-51 review: every step here is a click or keypress, so a plain
// hadRecentInput filter can never fail on a real click-driven shift —
// Chrome itself marks the toggle's own layout-shift entry hadRecentInput:
// true and the guard below used to throw it away, even though the tagline
// collapsing and the scene jumping 29px is fully visible to whoever pressed
// the button. Counting every entry, unfiltered, is what actually caught it.
test.describe('CLS across view and band switches stays 0 (DIA-46 item 3)', () => {
  test('stepping, whole floor, a room tab, the toggle, and band 750<->80 all measure zero shift', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __clsValue: number };
      w.__clsValue = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as unknown as { value: number };
          w.__clsValue += shift.value;
        }
      });
      observer.observe({ type: 'layout-shift', buffered: true });
    });

    await interceptFixtureScenes(page);
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await page.waitForFunction(() => document.body.dataset.renderedToken !== undefined);
    await page.waitForTimeout(300); // let the first-load shift (covered above) settle before measuring deltas

    async function clsOf(action: () => Promise<unknown>, label: string): Promise<void> {
      await page.evaluate(() => {
        (window as unknown as { __clsValue: number }).__clsValue = 0;
      });
      await action();
      await page.waitForTimeout(300);
      const cls = await page.evaluate(() => (window as unknown as { __clsValue: number }).__clsValue);
      expect(cls, `${label}: expected 0 layout shift, measured ${cls}`).toBe(0);
    }

    await H.setBand(page, 750);
    await clsOf(() => H.step(page, 1), 'stepping to the next close-up');
    await clsOf(() => H.toggleWholeFloor(page), 'entering the room view');
    const rooms = await H.roomIds(page);
    const current = await H.currentRoomId(page);
    const otherRoom = rooms.find((r) => r !== current) ?? rooms[0];
    await clsOf(() => H.setRoom(page, otherRoom), `switching to room tab ${otherRoom}`);
    await clsOf(() => H.setState(page, 'without'), 'toggling to the without state');
    await clsOf(() => H.setBand(page, 80), 'switching band 750 -> 80');
    await clsOf(() => H.setBand(page, 750), 'switching band 80 -> 750');
    await clsOf(() => H.setState(page, 'built'), 'toggling back to the built state');
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

// Fix round item 7 / review fix 4: chooseScale now takes the *smaller* of
// the width- and height-derived integer scales, so a view can't earn a
// scale on width alone that makes it taller than .scene-wrap's own
// 360:240-capped box — which would otherwise force an internal vertical
// scrollbar inside the scene (as opposed to the page-level horizontal
// scroll case above, which is allowed). Checked at three real device
// profiles named in the fix-round brief.
test.describe('no internal vertical scroll inside .scene-wrap (fix round item 7)', () => {
  const profiles = [
    { label: '360 CSS width, DPR 3', width: 360, deviceScaleFactor: 3 },
    { label: '390 CSS width, DPR 3', width: 390, deviceScaleFactor: 3 },
    { label: '412 CSS width, DPR 2.625', width: 412, deviceScaleFactor: 2.625 },
  ];

  for (const profile of profiles) {
    test(`${profile.label}: .scene-wrap has no internal vertical overflow`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: profile.width, height: 900 },
        deviceScaleFactor: profile.deviceScaleFactor,
      });
      const page = await context.newPage();
      try {
        await interceptFixtureScenes(page);
        await page.goto('/');
        await page.waitForFunction(() => document.body.dataset.renderedToken !== undefined);

        const overflow = await page.locator('#scene-wrap').evaluate((el) => ({
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
        }));
        expect(
          overflow.scrollHeight,
          `${profile.label}: scene-wrap scrollHeight (${overflow.scrollHeight}) should not exceed its clientHeight (${overflow.clientHeight})`
        ).toBeLessThanOrEqual(overflow.clientHeight);
      } finally {
        await context.close();
      }
    });
  }
});
