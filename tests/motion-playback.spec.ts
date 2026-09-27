// PH2-01 Part B (docs/briefs/PH2-01-workers.md § Part B, DIA-100): the
// painter plays the SCENE-FORMAT § Motion contract with one rAF ticker that
// repaints the canvas only — never the DOM (the DIA-13 root cause) — and
// stops on the three hard-stop conditions the brief names. This file is the
// acceptance list's "New Playwright spec with motion on" line plus the
// stop/reset lines that follow it; tests/reduced-motion.spec.ts (unchanged)
// already covers the "motion off" side.
import { expect, test } from '@playwright/test';
import * as H from './interaction-helpers';
import { firstVisiblyAnimatedCloseup } from './scene-source';

/** Same technique as reduced-motion.spec.ts: an exact data-URL fingerprint
 * of the visible canvas, so "did it change" is a plain string inequality. */
async function canvasSnapshot(page: import('@playwright/test').Page): Promise<string> {
  return page.locator('#scene-canvas').evaluate((c) => (c as HTMLCanvasElement).toDataURL());
}

async function repaintCount(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => Number(document.body.dataset.repaintCount ?? '0'));
}

test.describe('motion plays: canvas changes, hotspot layer inert, focus and panel survive', () => {
  for (const band of H.testableBands()) {
    for (const state of ['built', 'without'] as const) {
      test(`band ${band} / ${state}: canvas animates; 0 hotspot-layer mutations in 5s; focus and panel survive`, async ({
        page,
      }) => {
        await H.openApp(page); // no reducedMotion option => 'no-preference': motion plays
        await H.setBand(page, band);
        await H.setState(page, state);

        // Not every close-up's *default* view visibly animates — a scene's
        // `entries` array can carry a motion entry whose (x, y) falls
        // outside this particular close-up's own crop (present for another
        // view's sake), which paints nothing here regardless of its frame.
        // Land on a close-up known to have visible motion instead of
        // assuming the default one does.
        const animatedViewId = firstVisiblyAnimatedCloseup(band, state);
        expect(animatedViewId, `${band}/${state}: no close-up in this scene has any visible motion`).toBeDefined();
        await H.gotoCloseupView(page, animatedViewId!);

        // PH2-03 (DIA-113): setBand's very first band change is a genuine
        // rising crossing, and a moment-bearing band's crossing owns the
        // canvas for up to 2.5s before its own ambient motion's `t = 0`
        // even starts (SCENE-FORMAT § Band-crossing moment: "the view's own
        // motion clock does not run" while one plays). This test is about
        // *ambient* motion never going still, which tests/band-crossing-
        // moment.spec.ts already covers on its own — let any one-off moment
        // finish first so it isn't mistaken for the thing under test here.
        await page.waitForFunction(() => document.body.dataset.momentPlaying !== 'true');

        const first = H.hotspots(page).first();
        const gagId = await first.getAttribute('data-gag-id');
        await first.focus();

        // Installed only after the hotspot layer's own last mutation (the
        // focus() call above doesn't mutate it) — so every mutation this
        // observer sees from here on can only be a tick's, if the ticker
        // ever breaks its "canvas only" rule.
        await page.evaluate(() => {
          const layer = document.querySelector('#hotspots-layer')!;
          const w = window as unknown as { __hotspotMutations: number };
          w.__hotspotMutations = 0;
          new MutationObserver((records) => {
            w.__hotspotMutations += records.length;
          }).observe(layer, { childList: true, subtree: true, attributes: true, characterData: true });
        });

        // Warm-up: a scene's entries stagger their `motion.start` up to
        // ~1.4s apart (SCENE-FORMAT: derived from a hash, precisely so
        // twenty workers don't tick in lockstep) — sampling immediately
        // risks two snapshots landing on either side of a cycle that
        // happens to return to its own rest-pose file (e.g. an in-place
        // loop's file 4 is byte-identical to its file 0), which is a real
        // coincidence, not evidence motion stopped. Waiting for most
        // entries to already be mid-cycle before the first snapshot makes
        // that coincidence far less likely, and taking three snapshots
        // instead of two (requiring only *one* of the two gaps to differ)
        // makes it vanishingly unlikely across every entry landing on its
        // own rest-pose file at both ends of both gaps at once.
        await page.waitForTimeout(1500);
        const snapshot0 = await canvasSnapshot(page);
        await page.waitForTimeout(1000);
        const snapshot1 = await canvasSnapshot(page);
        await page.waitForTimeout(1000);
        const snapshot2 = await canvasSnapshot(page);
        expect(
          snapshot1 === snapshot0 && snapshot2 === snapshot1,
          `${band}/${state}: canvas should have changed at least once across three 1s-apart captures while motion plays`
        ).toBe(false);

        const focusAfterMotion = await H.focusInfo(page);
        expect(focusAfterMotion.gagId, `${band}/${state}: a focused hotspot must keep focus while a tick repaints`).toBe(
          gagId
        );

        // Now open its panel and let motion keep running for the rest of
        // the 5s window — a tick touching the DOM would either drop this
        // panel (DIA-13) or (since it targets the hotspot layer, not the
        // panel) show up in the mutation count above.
        await first.press('Enter');
        await H.waitForPanelOpen(page);
        const stripAtOpen = await H.panelStrip(page);

        await page.waitForTimeout(1500); // total observation window since the MutationObserver was installed: 5s

        const mutations = await page.evaluate(() => (window as unknown as { __hotspotMutations: number }).__hotspotMutations);
        expect(mutations, `${band}/${state}: the hotspot layer must not mutate during 5s of animation`).toBe(0);
        expect(await H.panelIsOpen(page), `${band}/${state}: the open panel should still be open`).toBe(true);
        expect(
          await H.panelStrip(page),
          `${band}/${state}: the open panel must not go stale while animation plays underneath it`
        ).toBe(stripAtOpen);
      });
    }
  }
});

test.describe('the ticker stops on its three hard-stop conditions', () => {
  test('stops repainting while document.hidden, resumes once visible again', async ({ page }) => {
    await H.openApp(page);
    await H.setBand(page, H.testableBands()[0]);
    await page.waitForTimeout(400); // let a few ticks land
    const beforeHidden = await repaintCount(page);
    expect(beforeHidden, 'the ticker should already have repainted at least once').toBeGreaterThan(0);

    // No Playwright API backgrounds a real tab — this is the standard
    // technique for exercising `document.hidden`/`visibilitychange` app
    // code without one (the same shape a real backgrounded tab produces).
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const atHidden = await repaintCount(page);
    await page.waitForTimeout(1200);
    const stillHidden = await repaintCount(page);
    expect(stillHidden, '0 repaints while document.hidden').toBe(atHidden);

    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(600);
    const afterResume = await repaintCount(page);
    expect(afterResume, 'the ticker resumes once the tab is visible again').toBeGreaterThan(stillHidden);
  });

  test('stops repainting when the scene box scrolls out of the viewport, resumes when scrolled back', async ({
    page,
  }) => {
    await H.openApp(page);
    await H.setBand(page, H.testableBands()[0]);
    await page.waitForTimeout(400);
    const beforeScroll = await repaintCount(page);
    expect(beforeScroll, 'the ticker should already have repainted at least once').toBeGreaterThan(0);

    await page.evaluate(() => {
      const spacer = document.createElement('div');
      spacer.id = '__motion-test-spacer';
      spacer.style.height = '3000px';
      document.body.prepend(spacer);
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(500); // let the IntersectionObserver callback land
    const atOffscreen = await repaintCount(page);
    await page.waitForTimeout(1200);
    const stillOffscreen = await repaintCount(page);
    expect(stillOffscreen, 'no further repaints while the scene box is off-screen').toBe(atOffscreen);

    await page.evaluate(() => document.querySelector('#scene-wrap')!.scrollIntoView());
    await page.waitForTimeout(600);
    const afterScrollBack = await repaintCount(page);
    expect(afterScrollBack, 'the ticker resumes once the scene box is back in the viewport').toBeGreaterThan(
      stillOffscreen
    );
  });

  test('reduced motion (runtime flip) stops the ticker and repaints the rest pose immediately', async ({ page }) => {
    await H.openApp(page);
    await H.setBand(page, H.testableBands()[0]);
    await page.waitForTimeout(400);
    expect(await repaintCount(page)).toBeGreaterThan(0);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.body.dataset.reducedMotion === 'true');
    const atReduced = await repaintCount(page);
    await page.waitForTimeout(1200);
    expect(await repaintCount(page), 'no further ticker repaints once reduced motion is on').toBe(atReduced);
  });
});

test.describe('the toggle and the slider reset t to 0 for the new scene', () => {
  test('toggle resets sceneStartTime', async ({ page }) => {
    await H.openApp(page);
    await H.setBand(page, H.numericTestableBands()[0]);
    await page.waitForTimeout(1000); // let real time pass so this isn't a no-op comparison

    const before = await page.evaluate(() => Number(document.body.dataset.sceneStartTime));
    await H.setState(page, 'without');
    const after = await page.evaluate(() => Number(document.body.dataset.sceneStartTime));
    expect(after, 'the toggle must reset t (sceneStartTime) for the new scene file').toBeGreaterThan(before);
  });

  test('slider resets sceneStartTime on a band change', async ({ page }) => {
    await H.openApp(page);
    const [first, second] = H.numericTestableBands();
    await H.setBand(page, first);
    await page.waitForTimeout(1000);

    const before = await page.evaluate(() => Number(document.body.dataset.sceneStartTime));
    await H.setBand(page, second);
    const after = await page.evaluate(() => Number(document.body.dataset.sceneStartTime));
    expect(after, 'the slider must reset t (sceneStartTime) for the new scene file').toBeGreaterThan(before);
  });

  test('a view-only navigation ("whole floor") does not reset sceneStartTime', async ({ page }) => {
    await H.openApp(page);
    await H.setBand(page, H.numericTestableBands()[0]);
    await page.waitForTimeout(300);

    const before = await page.evaluate(() => Number(document.body.dataset.sceneStartTime));
    // Always causes a render (interaction-helpers.ts's own doc comment), so
    // this exercises a real render() call, not a no-op.
    await H.toggleWholeFloor(page);
    const after = await page.evaluate(() => Number(document.body.dataset.sceneStartTime));
    expect(after, 'switching views inside one scene file must not reset t').toBe(before);
  });
});
