// PH2-02 (R-24/R-08/R-06a): the one motion gate every moving thing on the
// page must read. Nothing animates yet (that's PH2-01/Phase 3), so this
// suite's job today is to prove the gate itself is real and wired in — not
// to find motion, since there is none — and to stay true once something
// does move behind it.
import { expect, test } from '@playwright/test';
import * as H from './interaction-helpers';

// H.openApp defaults to H.PHONE (390 × 844, R-20's phone-first width) —
// nothing here needs a different viewport.

/** No running CSS/Web Animations under reduced motion, on any band/state. */
async function runningAnimationCount(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length);
}

/** A cheap, deterministic fingerprint of the visible canvas — a data URL is
 * exact (no sampling), and comparing strings avoids pulling in a PNG diff
 * dependency for what is really just an equality check. */
async function canvasSnapshot(page: import('@playwright/test').Page): Promise<string> {
  return page.locator('#scene-canvas').evaluate((c) => (c as HTMLCanvasElement).toDataURL());
}

test.describe('prefers-reduced-motion: still and silent on every band × state', () => {
  for (const band of H.testableBands()) {
    for (const state of ['built', 'without'] as const) {
      test(`band ${band} / ${state}: no running animation, canvas unchanged 2s apart`, async ({ page }) => {
        await H.openApp(page, { reducedMotion: 'reduce' });
        await H.setBand(page, band);
        await H.setState(page, state);

        expect(await runningAnimationCount(page), 'nothing should be animating under reduced motion').toBe(0);

        const first = await canvasSnapshot(page);
        await page.waitForTimeout(2000);
        const second = await canvasSnapshot(page);

        expect(second, `${band}/${state}: canvas changed with no visitor action, 2s apart`).toBe(first);
        expect(await runningAnimationCount(page), 'nothing should have started animating either').toBe(0);
      });
    }
  }
});

test.describe('prefers-reduced-motion: runtime flip (no reload)', () => {
  test('emulateMedia flips the gate and fires its subscribers without navigating', async ({ page }) => {
    await H.openApp(page, { reducedMotion: 'no-preference' });
    expect(await page.evaluate(() => document.body.dataset.reducedMotion)).toBe('false');

    // A marker that only survives if the page never reloads/navigates —
    // proof that the flip below is the same module instance reacting live,
    // not a fresh page load that happened to start under the new setting.
    await page.evaluate(() => {
      (window as unknown as { __noReloadMarker: boolean }).__noReloadMarker = true;
    });

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.body.dataset.reducedMotion === 'true');

    expect(await page.evaluate(() => (window as unknown as { __noReloadMarker?: boolean }).__noReloadMarker)).toBe(
      true
    );

    // Flip back, for good measure — the subscription isn't one-shot.
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForFunction(() => document.body.dataset.reducedMotion === 'false');
  });
});
