// D-056 (DIA-217/U-14): from 1152px, two columns — a 368px rail (h1, lede,
// slider, toggle) and a 720px main column (room tabs + punch-list button,
// scene, stepper, contact line), with the tap panel and punch-list sheet
// docking in the rail under the toggle. Acceptance criteria U-14a-h are
// DIA-215's spec document, quoted in the brief (docs/briefs in the notes
// repo) verbatim. U-14g (no box changes below 1152) is covered by the
// throwaway probe script's diff, not here — see the PR/issue for that run.
//
// Chromium only: the webkit-iphone project pins Playwright's `iPhone 14`
// device descriptor (390px, touch), which isn't a meaningful >=1152 desktop
// surface even with the viewport overridden — see the per-test skip below.
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import * as H from './interaction-helpers';
import { interceptFixtureScenes } from './scene-source';

/** Lands directly on a viewport/path combination — mirrors
 * band-crossing-moment.spec.ts's openAppAt, generalised to an arbitrary
 * viewport and query string instead of always phone width. */
async function openAt(page: Page, viewport: { width: number; height: number }, path = '/'): Promise<void> {
  await page.setViewportSize(viewport);
  await interceptFixtureScenes(page);
  await page.goto(path);
  await H.waitForFirstRender(page);
}

const U14A_VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
  { width: 1152, height: 648 },
];

const U14A_PATHS = ['/', '/?n=750', '/?n=1000', '/?it=none'];

async function assertAboveTheFold(page: Page, innerHeight: number): Promise<void> {
  const selectors = [
    '#headcount-slider',
    '.toggle__button',
    '#scene-views',
    '#punch-list-button',
    '#scene-wrap',
    '#scene-stepper',
  ];
  for (const selector of selectors) {
    const bottom = await page.locator(selector).evaluate((el) => el.getBoundingClientRect().bottom);
    expect(bottom, `${selector} bottom vs innerHeight ${innerHeight}`).toBeLessThanOrEqual(innerHeight);
  }
  const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  expect(scrollHeight).toBeLessThanOrEqual(innerHeight + 1);
}

test.describe('D-056 U-14a: every landing control is above the fold, no scroll', () => {
  for (const viewport of U14A_VIEWPORTS) {
    for (const path of U14A_PATHS) {
      test(`${viewport.width}x${viewport.height} ${path}`, async ({ page, browserName }) => {
        test.skip(browserName !== 'chromium', 'webkit-iphone pins a 390px touch device, not a >=1152 desktop surface');
        await openAt(page, viewport, path);
        await assertAboveTheFold(page, viewport.height);
      });
    }
  }
});

test.describe('D-056 U-14b: the scene box is unchanged (D-042a)', () => {
  test('scene-wrap is 720x480 at 1152px', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'webkit-iphone pins a 390px touch device, not a >=1152 desktop surface');
    await openAt(page, { width: 1152, height: 900 });
    const box = await page.locator('#scene-wrap').boundingBox();
    expect(box!.width).toBeCloseTo(720, 0);
    expect(box!.height).toBeCloseTo(480, 0);
  });

  test('at ?n=750, dpr 1, the room canvas is >= 2 css px per art px', async ({ browser }) => {
    // The scene-wrap box is fixed at 720 css px wide (D-042a, unchanged by
    // D-056); at band 750's actual room width (348 native px, D-036's cap is
    // a ceiling, not every room's exact size — src/main.ts's chooseScale
    // floors to the nearest *integer* device-px scale), that should paint at
    // 2x here, matching the close-up's own 1.9x floor with room to spare
    // (tests/closeup-scale.spec.ts).
    const context = await browser.newContext({ viewport: { width: 1152, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    try {
      await openAt(page, { width: 1152, height: 900 }, '/?n=750');
      // A fresh load opens on the room (D-051 item 1) — no need to navigate
      // to it explicitly, only to avoid ensureCloseup zooming past it.
      const scale = await page.evaluate(() => {
        const canvas = document.querySelector('#scene-canvas') as HTMLCanvasElement;
        const bufferW = Number(document.querySelector('#hotspots-layer')!.getAttribute('data-buffer-w'));
        return canvas.getBoundingClientRect().width / bufferW;
      });
      expect(scale).toBeGreaterThanOrEqual(2);
    } finally {
      await context.close();
    }
  });
});

test.describe('D-056 U-14c: the rail and the scene column do not intersect', () => {
  test('at 1152px, the rail and scene-wrap boxes are disjoint, the tabs row shares scene-wrap\'s left edge, and the stepper starts within 8px of the scene\'s bottom', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'webkit-iphone pins a 390px touch device, not a >=1152 desktop surface');
    await openAt(page, { width: 1152, height: 900 });
    const [toggleBox, tabsBox, sceneBox, stepperBox] = await Promise.all([
      page.locator('#toggle-root').boundingBox(),
      page.locator('#scene-views').boundingBox(),
      page.locator('#scene-wrap').boundingBox(),
      page.locator('#scene-stepper').boundingBox(),
    ]);
    // Disjoint: the rail's rightmost edge (approximated by the toggle, the
    // widest rail item at 368px) never reaches the scene's left edge.
    expect(toggleBox!.x + toggleBox!.width).toBeLessThanOrEqual(sceneBox!.x);
    expect(tabsBox!.x).toBeCloseTo(sceneBox!.x, 0);
    expect(stepperBox!.y).toBeLessThanOrEqual(sceneBox!.y + sceneBox!.height + 8);
  });

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 1152, height: 648 },
  ]) {
    test(`at ${viewport.width}x${viewport.height}, the tabs row top matches the h1 top (±2px)`, async ({
      page,
      browserName,
    }) => {
      test.skip(browserName !== 'chromium', 'webkit-iphone pins a 390px touch device, not a >=1152 desktop surface');
      await openAt(page, viewport);
      const [h1Box, tabsBox] = await Promise.all([
        page.locator('h1').boundingBox(),
        page.locator('#scene-views').boundingBox(),
      ]);
      expect(Math.abs(h1Box!.y - tabsBox!.y)).toBeLessThanOrEqual(2);
    });
  }
});

test.describe('D-056 U-14d: an open panel docks in the rail, never over the scene, slider or toggle', () => {
  const CASES: Array<{ width: number; height: number }> = [
    { width: 1440, height: 900 },
    { width: 1152, height: 560 }, // short-viewport case, D-056 point 5
    { width: 1280, height: 500 }, // short-viewport case, D-056 point 5
  ];

  for (const viewport of CASES) {
    test(`${viewport.width}x${viewport.height}: a gag panel`, async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'webkit-iphone pins a 390px touch device, not a >=1152 desktop surface');
      await openAt(page, viewport, '/?n=750');
      await H.openFirstHotspot(page);
      await assertPanelDocked(page, '.panel');
    });

    test(`${viewport.width}x${viewport.height}: the punch-list sheet`, async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'webkit-iphone pins a 390px touch device, not a >=1152 desktop surface');
      await openAt(page, viewport, '/?n=750');
      await H.openPunchList(page);
      await assertPanelDocked(page, '#checklist-panel');
    });
  }

  async function assertPanelDocked(page: Page, selector: string): Promise<void> {
    const [panelBox, sceneBox, sliderCentre, toggleCentre, dockAnchorBottom] = await Promise.all([
      page.locator(selector).boundingBox(),
      page.locator('#scene-wrap').boundingBox(),
      page.locator('#headcount-slider').evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }),
      page.locator('.toggle__button').evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }),
      // #share-control, not #toggle-root/.toggle__button: D-057 (PH3-02)
      // added the "Share image" control to the rail directly under the
      // toggle, and the panel/checklist now dock under *it* instead —
      // matching src/main.ts's own updateDesktopLayout(), which computes
      // toggleBottomDoc from the share control's own bottom edge once it's
      // in the rail. D-057 item 7 explicitly accepts this: "the height
      // below which a docked panel makes the page scroll moves from about
      // 610px to about 660px."
      page.locator('#share-control').evaluate((el) => el.getBoundingClientRect().bottom),
    ]);
    expect(panelBox!.x).toBeLessThanOrEqual(sceneBox!.x);
    expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(sceneBox!.x);
    const [sliderHit, toggleHit] = await Promise.all([
      page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return el?.closest('#slider-root input') !== null || el?.tagName === 'INPUT';
      }, sliderCentre),
      page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('.toggle__button') !== null, toggleCentre),
    ]);
    expect(sliderHit).toBe(true);
    expect(toggleHit).toBe(true);
    // DIA-218: the docked `top` must track the dock anchor's *current*
    // viewport-relative bottom edge (clamped at >=0), not a value cached
    // from the last resize/layout pass — this is what actually
    // distinguishes "the panel happens to still overlap nothing" from "the
    // panel is docked".
    expect(Math.abs(panelBox!.y - Math.max(0, dockAnchorBottom))).toBeLessThanOrEqual(1.5);
  }

  const SHORT_VIEWPORTS = CASES.slice(1); // the two D-056 point 5 short-viewport cases

  /** Two rAFs: the scroll listener itself only schedules one (it drops a
   * second 'scroll' event that arrives before the first's rAF has run), so
   * one tick is enough for applyPanelTop() to have run — the second is
   * slack against the page.evaluate() round-trip landing mid-frame. */
  async function settleAfterScroll(page: Page): Promise<void> {
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  }

  for (const viewport of SHORT_VIEWPORTS) {
    test(`${viewport.width}x${viewport.height}: scrolling before opening still docks a gag panel under the toggle (DIA-218)`, async ({
      page,
      browserName,
    }) => {
      test.skip(browserName !== 'chromium', 'webkit-iphone pins a 390px touch device, not a >=1152 desktop surface');
      await openAt(page, viewport, '/?n=750');
      // Scrolls to the page's own max — the document is short enough
      // (D-056 point 5) that the toggle stays on screen throughout.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await H.openFirstHotspot(page);
      await assertPanelDocked(page, '.panel');
    });

    // DIA-218 review: `updateDesktopLayout()` only ran at setup and on
    // resize, so a scroll that happens *after* a panel/sheet is already
    // open (no resize involved) left the docked `top` wherever it was
    // computed — opening a fresh sheet/panel from a still-scrolled page
    // (the tests above) isn't the only way to hit this: opening the
    // checklist sheet in particular resets scrollY to 0 as a side effect
    // (H.openPunchList's click brings focus into view), which happened to
    // mask the bug for "scroll first, then open" — scrolling *after* open
    // does not have that confound and reproduces it directly.
    test(`${viewport.width}x${viewport.height}: opening a gag panel, then scrolling, keeps it docked under the toggle (DIA-218)`, async ({
      page,
      browserName,
    }) => {
      test.skip(browserName !== 'chromium', 'webkit-iphone pins a 390px touch device, not a >=1152 desktop surface');
      await openAt(page, viewport, '/?n=750');
      await H.openFirstHotspot(page);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await settleAfterScroll(page);
      await assertPanelDocked(page, '.panel');
    });

    test(`${viewport.width}x${viewport.height}: opening the punch-list sheet, then scrolling, keeps it docked under the toggle (DIA-218)`, async ({
      page,
      browserName,
    }) => {
      test.skip(browserName !== 'chromium', 'webkit-iphone pins a 390px touch device, not a >=1152 desktop surface');
      await openAt(page, viewport, '/?n=750');
      await H.openPunchList(page);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await settleAfterScroll(page);
      await assertPanelDocked(page, '#checklist-panel');
    });
  }

  test('the Beyond panel opened via the keyboard at 1,000+ does not obscure the focused slider (WCAG 2.4.11)', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'webkit-iphone pins a 390px touch device, not a >=1152 desktop surface');
    await openAt(page, { width: 1440, height: 900 });
    await H.setBand(page, 'beyond', 'keyboard');
    await H.waitForPanelOpen(page);
    const focused = await page.evaluate(() => document.activeElement?.id);
    expect(focused).toBe('headcount-slider');
    const sliderRect = await page.locator('#headcount-slider').evaluate((el) => el.getBoundingClientRect());
    const cx = sliderRect.x + sliderRect.width / 2;
    const cy = sliderRect.y + sliderRect.height / 2;
    const hitsSlider = await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.id === 'headcount-slider',
      { x: cx, y: cy }
    );
    expect(hitsSlider).toBe(true);
  });
});

test.describe('D-056 U-14e: tab order at >=1152 follows the rail then the main column', () => {
  test('slider, toggle, share control, room tab, punch list, hotspots, then the stepper', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'webkit-iphone pins a 390px touch device, not a >=1152 desktop surface');
    await openAt(page, { width: 1440, height: 900 }, '/?n=750');
    const order: string[] = [];
    // D-057 (PH3-02): the share control is a rail item (moved there by
    // updateDesktopLayout(), right after #toggle-root in DOM order — tab
    // order follows DOM order, not float visual position), so it takes its
    // place among the rail's own tab stops, before the main column's.
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return 'BODY';
        if (el.id) return `#${el.id}`;
        return el.className.split(' ')[0] ?? el.tagName;
      });
      order.push(info);
      expect(info).not.toBe('BODY');
    }
    expect(order[0]).toBe('#headcount-slider');
    expect(order[1]).toBe('toggle__button');
    expect(order[2]).toBe('#share-control');
    expect(order[3]).toBe('scene-views__button');
    expect(order[4]).toBe('#punch-list-button');
    expect(order[5]).toBe('hotspot');
  });
});

test.describe('D-056 U-14f: the tabs row never needs to scroll at >=1152', () => {
  for (const n of [750, 1000]) {
    test(`?n=${n}`, async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'webkit-iphone pins a 390px touch device, not a >=1152 desktop surface');
      await openAt(page, { width: 1440, height: 900 }, `/?n=${n}`);
      // DIA-65 precedent: CI's Chromium can resolve `system-ui, sans-serif`
      // a few px wider than any local measurement (never reproduces on this
      // sandbox's own fonts). Report the actual box so a CI-only failure
      // says how much margin is missing instead of just true/false.
      const { scrollWidth, clientWidth } = await page
        .locator('#scene-views')
        .evaluate((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
      expect(scrollWidth, `scrollWidth=${scrollWidth} clientWidth=${clientWidth}`).toBeLessThanOrEqual(
        clientWidth + 0.5,
      );
    });
  }
});

test.describe('D-056 U-14h: the tagline stays on one line in the rail at 1440', () => {
  test('the toggle subtitle does not wrap to a second line', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'webkit-iphone pins a 390px touch device, not a >=1152 desktop surface');
    // U-18 (DIA-194/197): the subtitle/tagline shows in both toggle states
    // from first load, no interaction needed to reveal it.
    await openAt(page, { width: 1440, height: 900 });
    // The element's own box always reports the full 2-line reserved slot
    // height (.toggle__message's grid-area stretch, DIA-176) regardless of
    // how many lines the text itself actually takes — a Range over the text
    // node's own line boxes is what actually answers "did this wrap".
    const { lineCount, scrollWidth, clientWidth } = await page.locator('.toggle__subtitle').evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return { lineCount: range.getClientRects().length, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
    });
    // See the U-14f case above for why this reports the box on failure.
    expect(lineCount, `scrollWidth=${scrollWidth} clientWidth=${clientWidth}`).toBe(1);
  });
});

test.describe('D-056: opening the panel or the punch-list sheet at >=1152 moves nothing in the main column', () => {
  test('scene-wrap, the tabs row and the stepper keep identical boxes before and after opening', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'webkit-iphone pins a 390px touch device, not a >=1152 desktop surface');
    await openAt(page, { width: 1440, height: 900 }, '/?n=750');
    const before = await page.evaluate(() => {
      const rect = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
      const r = (b: DOMRect) => ({ x: b.x, y: b.y, width: b.width, height: b.height });
      return { tabs: r(rect('#scene-views')), scene: r(rect('#scene-wrap')), stepper: r(rect('#scene-stepper')) };
    });
    await H.openFirstHotspot(page);
    const afterOpen = await page.evaluate(() => {
      const rect = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
      const r = (b: DOMRect) => ({ x: b.x, y: b.y, width: b.width, height: b.height });
      return { tabs: r(rect('#scene-views')), scene: r(rect('#scene-wrap')), stepper: r(rect('#scene-stepper')) };
    });
    expect(afterOpen).toEqual(before);

    await page.keyboard.press('Escape');
    await page.locator('.panel').waitFor({ state: 'hidden' });
    const afterClose = await page.evaluate(() => {
      const rect = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
      const r = (b: DOMRect) => ({ x: b.x, y: b.y, width: b.width, height: b.height });
      return { tabs: r(rect('#scene-views')), scene: r(rect('#scene-wrap')), stepper: r(rect('#scene-stepper')) };
    });
    expect(afterClose).toEqual(before);
  });
});
