// PH2-01 Part B (docs/briefs/PH2-01-workers.md, DIA-100): "calmer is
// measured, not asserted." For each of the seven bands, this measures the
// changed-pixel fraction a second over 5s at 390px on the band's default
// view, for both states, and asserts built < without. Each test logs its
// own markdown table row (`npx playwright test tests/motion-calmness.spec.ts
// --project=chromium`) — collect them into the PR description's table;
// nothing here writes a file, since the acceptance line only requires the
// number to exist and be checked.
import { expect, test } from '@playwright/test';
import * as H from './interaction-helpers';

/**
 * Review fix R3 (DIA-100 PR #48): the original version of this function
 * snapshotted the canvas six times, 1s apart, and compared each pair — that
 * measures whether any mover happens to be on a different frame at those
 * six specific instants, not how much motion happened in between. A 2×
 * walker or a 1.5× typist counts the same as a 1× one as long as it lands on
 * a different frame at each 1s mark, and whether a fast-cycling loop's
 * changes land inside or straddle the 1s grid is sampling-phase luck, not a
 * property of the content — which is exactly how bands 150 and 220 (review:
 * identical motion mix, one 6 typists at rate 1 + one walker at rate 1, the
 * other 3 typists at rate 1.5 + two idle loops + one walker at rate 2) could
 * land on opposite sides of the assertion.
 *
 * Fixed by sampling at the ticker's own repaint cadence (12/s, the brief's
 * cap — `MIN_REPAINT_INTERVAL_MS` in src/main.ts) for the full 5s window,
 * summing the changed-pixel fraction between *every* consecutive pair, and
 * dividing by the window's length in seconds. Sampling at (at least) the
 * cadence anything can actually change on screen means no change lands
 * between two samples unseen — the aliasing the six-sample version had.
 */
async function changedPixelFractionPerSecond(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const canvas = document.querySelector('#scene-canvas') as HTMLCanvasElement;
        const ctx = canvas.getContext('2d')!;
        const w = canvas.width;
        const h = canvas.height;
        const totalPixels = w * h;
        const windowMs = 5000;
        const intervalMs = 1000 / 12; // matches the ticker's own repaint cap
        const start = performance.now();
        let previous: Uint8ClampedArray | null = null;
        let changedFractionSum = 0;

        function snap() {
          const data = ctx.getImageData(0, 0, w, h).data;
          if (previous) {
            let changed = 0;
            for (let p = 0; p < data.length; p += 4) {
              if (
                data[p] !== previous[p] ||
                data[p + 1] !== previous[p + 1] ||
                data[p + 2] !== previous[p + 2] ||
                data[p + 3] !== previous[p + 3]
              ) {
                changed += 1;
              }
            }
            changedFractionSum += changed / totalPixels;
          }
          previous = data.slice();
          if (performance.now() - start < windowMs) {
            setTimeout(snap, intervalMs);
          } else {
            resolve(changedFractionSum / (windowMs / 1000));
          }
        }
        snap();
      })
  );
}

test.describe('PH2-01 Part B: calmer is measured, not asserted', () => {
  for (const band of H.numericTestableBands()) {
    test(`band ${band}: built is calmer than without (changed-pixel fraction/s over 5s, 390px)`, async ({
      page,
    }) => {
      await H.openApp(page); // 390px default viewport (H.PHONE), motion on
      await H.setBand(page, band);

      // Warm-up (see tests/motion-playback.spec.ts for the same fix, same
      // cause): the toggle/slider reset t to 0, and a scene's entries'
      // `motion.start` values, though individually staggered, cluster
      // within the first ~1.5s — measuring from t = 0 catches every one of
      // them crossing its threshold in the same early window, an artifact
      // of when the clock started, not a real difference in how calm the
      // steady state is.
      await H.setState(page, 'built');
      await page.waitForTimeout(1500);
      const built = await changedPixelFractionPerSecond(page);

      await H.setState(page, 'without');
      await page.waitForTimeout(1500);
      const without = await changedPixelFractionPerSecond(page);

      // eslint-disable-next-line no-console
      console.log(`| ${band} | ${built.toFixed(5)} | ${without.toFixed(5)} |`);

      expect(built, `band ${band}: built (${built}) should be calmer than without (${without})`).toBeLessThan(
        without
      );
    });
  }
});
