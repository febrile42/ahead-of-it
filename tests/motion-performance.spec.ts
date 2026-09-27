// PH2-01 Part B (docs/briefs/PH2-01-workers.md, DIA-100): "no long task >
// 50ms at 4x throttle" — the ticker's own repaint work (resolveViewAt +
// motionChanged + a canvas redraw), under the same CDP CPU-throttling
// technique tests/cls.spec.ts already uses for real (not simulated)
// throttling. Chromium only (`newCDPSession` is a Chromium-only API — see
// cls.spec.ts's own rationale, which applies unchanged here).
import { expect, test } from '@playwright/test';
import * as H from './interaction-helpers';

test.describe('PH2-01 Part B: no long task during animation at 4x CPU throttle', () => {
  test('10s of animation produces no task over 50ms', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'CDP throttling is Chromium-only; not testable on WebKit');

    // Installed before navigation so it catches every long task from first
    // paint onward (same ordering cls.spec.ts uses for its own observer).
    await page.addInitScript(() => {
      const w = window as unknown as { __longTasks: Array<{ start: number; duration: number }> };
      w.__longTasks = [];
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          w.__longTasks.push({ start: entry.startTime, duration: entry.duration });
        }
      });
      observer.observe({ type: 'longtask', buffered: true });
    });

    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    await H.openApp(page);
    await H.setBand(page, H.numericTestableBands()[0]);

    // Mark the start of the observation window so a long task from initial
    // page load / navigation (not this brief's concern) doesn't count.
    const windowStart = await page.evaluate(() => performance.now());
    await page.waitForTimeout(10_000);

    const longTasks = await page.evaluate(
      (start) =>
        (window as unknown as { __longTasks: Array<{ start: number; duration: number }> }).__longTasks.filter(
          (t) => t.start >= start
        ),
      windowStart
    );

    expect(
      longTasks,
      `long tasks > 50ms during 10s of animation at 4x CPU throttle: ${JSON.stringify(longTasks)}`
    ).toEqual([]);
  });
});
