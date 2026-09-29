// QA regression coverage for the DIA-194 review's remaining findings this
// brief closes out (DIA-197): U-08 (tap-outside, its own assertion already
// lives in tests/ux-review-dia194.spec.ts), U-10, U-11, U-12 (its own
// assertion lives in tests/closeup-nav.spec.ts), U-13, U-14, U-16, U-17 (its
// own assertions live in src/scene/bands.test.ts and
// tests/ux-review-dia194.spec.ts), U-19 (its own assertions live in
// src/scene/layout.test.ts). Each test here names the review's own
// acceptance criterion, not an implementation detail.
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import * as H from './interaction-helpers';
import { interceptFixtureScenes, sceneSourceDir } from './scene-source';

const content = JSON.parse(readFileSync(new URL('../src/content/content.json', import.meta.url), 'utf-8')) as {
  ui: {
    announceWithout: string;
    announceBuilt: string;
    loading: string;
    loadFailed: string;
    retry: string;
  };
};

// ---------------------------------------------------------------------------
// U-10: toggle drops aria-pressed, announces the new state once (DIA-194 U-10).
// ---------------------------------------------------------------------------

test.describe('U-10: the toggle names the action, not the state, and announces once', () => {
  test('the button never carries aria-pressed, in either state', async ({ page }) => {
    await H.openApp(page);
    const button = page.locator('.toggle__button');
    expect(await button.getAttribute('aria-pressed')).toBeNull();
    await button.click();
    expect(await button.getAttribute('aria-pressed')).toBeNull();
  });

  test('toggling to without announces the state once, in the existing live region', async ({ page }) => {
    await H.openApp(page);
    await page.locator('.toggle__button').click();
    await expect(page.locator('.slider__live')).toHaveText(content.ui.announceWithout);
  });

  test('toggling back to built announces the state once', async ({ page }) => {
    await H.openApp(page);
    const button = page.locator('.toggle__button');
    await button.click(); // built -> without
    await button.click(); // without -> built
    await expect(page.locator('.slider__live')).toHaveText(content.ui.announceBuilt);
  });

  // U-18 (DIA-194/196/197), folded into the same toggle.ts change: neither
  // state leaves the reserved subtitle/nudge slot empty.
  test('U-18: the tagline shows in both toggle states (no empty reserved slot)', async ({ page }) => {
    await H.openApp(page);
    const subtitle = page.locator('.toggle__subtitle');
    await expect(subtitle).toBeVisible();
    await page.locator('.toggle__button').click();
    await expect(subtitle).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// U-11: loading & failure states (DIA-194 U-11).
// ---------------------------------------------------------------------------

/** Re-serves the real scene file after an artificial delay — same technique
 * as tests/hostile-f1-f4.spec.ts's own `slowSceneFetches`, long enough here
 * to clear main.ts's 300ms "not yet painted" threshold reliably. */
async function slowScene(page: Page, delayMs: number): Promise<void> {
  await page.route('**/sprites/scenes/*.json', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    const fileName = new URL(route.request().url()).pathname.split('/').pop()!;
    const body = readFileSync(`${sceneSourceDir()}${fileName}`, 'utf-8');
    await route.fulfill({ contentType: 'application/json', body });
  });
}

test.describe('U-11: boot labels, a loading message, and a working failure/retry', () => {
  test('(a) "Whole floor" and the punch-list label are never blank while the scene is still loading', async ({
    page,
  }) => {
    await page.setViewportSize(H.PHONE);
    await interceptFixtureScenes(page);
    await slowScene(page, 600);
    await page.goto('/');
    // Before the scene fetch has resolved (render() has not committed yet —
    // no renderedToken), the static-shell labels are already filled from
    // content.json, not left blank.
    expect(await page.evaluate(() => document.body.dataset.renderedToken)).toBeUndefined();
    await expect(page.locator('.scene-stepper__floor')).not.toBeEmpty();
    await expect(page.locator('.punch-list-button__label')).not.toBeEmpty();
  });

  test('(b) "Loading the building…" appears after 300ms, not immediately', async ({ page }) => {
    await page.setViewportSize(H.PHONE);
    await interceptFixtureScenes(page);
    await slowScene(page, 600);
    await page.goto('/');

    await expect(page.locator('#scene-status')).toBeHidden();
    await expect(page.locator('.scene-status__message')).toHaveText(content.ui.loading, { timeout: 550 });
    await expect(page.locator('.scene-status__retry')).toBeHidden(); // quiet, not a spinner-and-button

    // Once the fetch resolves, the overlay clears and never blocks the scene.
    await H.waitForFirstRender(page);
    await expect(page.locator('#scene-status')).toBeHidden();
  });

  test('(c) a blocked scene shows the Content-owned failure sentence and a working retry', async ({ page }) => {
    await page.setViewportSize(H.PHONE);
    await interceptFixtureScenes(page);
    let blocked = true;
    await page.route('**/sprites/scenes/80-built.json', (route) => {
      if (blocked) return route.abort('failed');
      return route.fallback();
    });
    await page.goto('/');
    await expect(page.locator('.scene-status__message')).toHaveText(content.ui.loadFailed);
    const retry = page.locator('.scene-status__retry');
    await expect(retry).toBeVisible();
    await expect(retry).toHaveText(content.ui.retry);
    // R-14: the punch list stays usable while the scene has failed.
    expect(await page.locator('.checklist__item').count()).toBeGreaterThan(0);

    // U-11(c), first half: a repeated failure must keep focus on retry — it
    // is never rebuilt, only re-shown, so this locks in that nothing else
    // in render() accidentally moves focus off it. `.focus()` + Enter (not
    // `.click()`) so this is genuinely keyboard-driven on every engine,
    // including WebKit, which doesn't focus a button from a real click.
    await retry.focus();
    let prevToken = await H.currentRenderToken(page);
    await page.keyboard.press('Enter');
    await H.waitForNextRender(page, prevToken);
    await expect(page.locator('.scene-status__message')).toHaveText(content.ui.loadFailed);
    let focus = await H.settledFocusInfo(page);
    expect(H.focusIsLost(focus), 'a repeated failure must not drop focus to <body>').toBe(false);
    expect(focus.className).toContain('scene-status__retry');

    // U-11(c), second half: a successful retry hides the very button focus
    // is on (hideSceneStatus() -> [hidden] -> display:none) — focus must
    // land on the first room tab, not silently drop to <body>.
    blocked = false;
    prevToken = await H.currentRenderToken(page);
    await page.keyboard.press('Enter');
    await H.waitForNextRender(page, prevToken);
    await expect(page.locator('#scene-status')).toBeHidden();
    expect(await page.locator('.scene-views__button').count(), 'a real scene painted its room tabs').toBeGreaterThan(
      0
    );
    focus = await H.settledFocusInfo(page);
    expect(H.focusIsLost(focus), 'a successful retry must not drop focus to <body>').toBe(false);
    expect(focus.className).toContain('scene-views__button');
  });
});

// ---------------------------------------------------------------------------
// U-13: one :focus-visible ring on every interactive element (DIA-194 U-13).
// ---------------------------------------------------------------------------

test.describe('U-13: every control in the tab sequence shows the same focus ring', () => {
  test('the toggle, panel close, punch-list download and a contact link all draw a visible ring', async ({
    page,
  }) => {
    await H.openApp(page);

    // Keyboard-only throughout: a WebKit/Chromium `:focus-visible` heuristic
    // suppresses the ring after a *pointer* interaction until the next real
    // keydown, even for an element focused programmatically afterwards —
    // mixing in a `.click()` (e.g. tests/interaction-helpers.ts's own
    // `openPunchList`) would fail this test for a reason that has nothing
    // to do with the ring itself.
    async function ringDrawn(locator: ReturnType<Page['locator']>): Promise<boolean> {
      await locator.focus();
      return locator.evaluate((el) => {
        const style = getComputedStyle(el);
        return el.matches(':focus-visible') && style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
      });
    }

    expect(await ringDrawn(page.locator('.toggle__button')), 'toggle button').toBe(true);

    await H.openFirstHotspot(page, 'keyboard');
    expect(await ringDrawn(page.locator('.panel__close')), 'panel close').toBe(true);
    await H.pressEscape(page);

    await page.locator('#punch-list-button').focus();
    await page.keyboard.press('Enter');
    await page.locator("#punch-list-button[aria-expanded='true']").waitFor({ state: 'attached' });
    expect(await ringDrawn(page.locator('.checklist__download')), 'punch-list download').toBe(true);
    // Several `.contact-line a`s exist (the persistent one, the panel's,
    // the sheet's own) — `:visible` picks whichever one the page is
    // actually showing right now, same as a real visitor would reach.
    expect(await ringDrawn(page.locator('.contact-line a:visible').first()), 'a contact link').toBe(true);
  });
});

// ---------------------------------------------------------------------------
// U-14: at 768-1151, a single column capped at the scene's own 720px,
// centred (DIA-194 U-14). D-056 (DIA-217) replaces the >=1152 half of this
// with a two-column layout instead — see tests/desktop-two-column.spec.ts for
// that AC set (U-14a-h). The 1440x900 case below moved there with it; this
// file keeps only the still-single-column 768-1151 range.
// ---------------------------------------------------------------------------

test.describe('U-14: tablet layout (768-1151) caps the controls column at the scene width', () => {
  test('at 1024x900, the slider is exactly as wide as the scene, and #app is centred', async ({ page }) => {
    await H.openApp(page, { viewport: { width: 1024, height: 900 } });
    const [appBox, sliderBox, sceneBox] = await Promise.all([
      page.locator('#app').boundingBox(),
      page.locator('.slider').boundingBox(),
      page.locator('.scene-wrap').boundingBox(),
    ]);
    expect(appBox!.width).toBe(720);
    expect(appBox!.x).toBeCloseTo((1024 - 720) / 2, 0); // centred
    expect(sliderBox!.width).toBeCloseTo(sceneBox!.width, 0);
  });

  test('the lede reserves only what the copy needs at tablet width, not the phone worst case', async ({ page }) => {
    await H.openApp(page, { viewport: { width: 1024, height: 900 } });
    const introHeight = await page.locator('.app__intro').evaluate((el) => el.getBoundingClientRect().height);
    // The phone reservation (DIA-175) is 5 lines at ~1.3em; the same copy at
    // 720px (post-cap) wraps to 2 — well under half the phone worst case.
    const lineHeight = await page
      .locator('.app__intro')
      .evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
    expect(introHeight).toBeLessThan(lineHeight * 3);
  });
});

// ---------------------------------------------------------------------------
// U-16: an unlabelled tick mark at every stop, all 8 (DIA-194 U-16).
// ---------------------------------------------------------------------------

test.describe('U-16: every slider stop has a tick mark, not just the 4 labelled ones', () => {
  test('8 marks are present at 390px, and each labelled one still shows its year', async ({ page }) => {
    await H.openApp(page);
    await expect(page.locator('.slider__tick')).toHaveCount(8);
    // The 4 boundary bands keep their year/1,000+ label (S2); the AC only
    // asks for a mark at the other 4, not a label.
    const labelled = await page.locator('.slider__tick:not(.slider__tick--mark)').count();
    expect(labelled).toBe(4);
  });
});
