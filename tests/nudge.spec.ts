// QA (DIA-11): the R-06a nudge, across the toggle x slider ordering pairs.
//
// The nudge's whole job is to get the visitor from `built` into `without`
// once (R-06a; the PH1-04 review item m2 — "the nudge stays
// visible after the visitor has already toggled ... hide it on first
// toggle"). src/main.ts shows it on the first slider move guarded only by
// `hasMovedSlider`, and src/ui/toggle.ts's hideNudge is the only thing
// that hides it. Neither guard knows about the other, so the *order* of
// the visitor's first two actions changes the outcome — which is what
// these tests pin down.
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { interceptFixtureScenes } from './scene-source';

// R-24: phone first. Everything here is asserted at the primary target
// width, because the nudge is the first line under the toggle at 390px.
const VIEWPORT = { width: 390, height: 900 };

const NUDGE = '.toggle__nudge';
const VISIBLE = new RegExp('(^|\\s)toggle__nudge--visible(\\s|$)');

async function load(page: Page): Promise<void> {
  await page.setViewportSize(VIEWPORT);
  await interceptFixtureScenes(page);
  await page.goto('/');
  await page.waitForFunction(() => document.body.dataset.renderedToken !== undefined);
}

/** Drags the slider to `value` the way a visitor does — a real `input` event, not a property set. */
async function setSlider(page: Page, value: number): Promise<void> {
  await page.locator('#headcount-slider').fill(String(value));
}

async function expectNudgeHidden(page: Page): Promise<void> {
  await expect(page.locator(NUDGE)).not.toHaveClass(VISIBLE);
}

async function expectNudgeVisible(page: Page): Promise<void> {
  await expect(page.locator(NUDGE)).toHaveClass(VISIBLE);
}

test.describe('R-06a nudge', () => {
  test('is not shown before the visitor has done anything', async ({ page }) => {
    await load(page);
    // S1c: the line is reserved in the layout either way, so "hidden"
    // here means the class is off, not that the element is gone.
    await expect(page.locator(NUDGE)).toHaveCount(1);
    await expectNudgeHidden(page);
  });

  test('appears on the first slider move, while still in the built state', async ({ page }) => {
    await load(page);
    await setSlider(page, 360);
    await expectNudgeVisible(page);
    await expect(page.locator('.toggle__button')).toHaveAttribute('aria-pressed', 'false');
  });

  test('is hidden again once the visitor toggles (m2)', async ({ page }) => {
    await load(page);
    await setSlider(page, 360);
    await expectNudgeVisible(page);
    await page.locator('.toggle__button').click();
    await expectNudgeHidden(page);
  });

  // DIA-11. The failing case: toggle *first*, slider *second*. `hideNudge()`
  // runs against a nudge that was never shown, so nothing latches, and the
  // first slider move then shows it — telling a visitor who is already
  // looking at the without state to go and see the without state.
  test('stays hidden when the visitor toggles before their first slider move', async ({ page }) => {
    await load(page);

    await page.locator('.toggle__button').click();
    await expect(page.locator('.toggle__button')).toHaveAttribute('aria-pressed', 'true');
    await expectNudgeHidden(page);

    await setSlider(page, 360);

    await expectNudgeHidden(page);
  });

  // The same defect under a drag rather than a single jump: `input` fires
  // once per band crossed, so the nudge must not appear on any of them.
  test('stays hidden across a whole drag after the visitor has toggled', async ({ page }) => {
    await load(page);
    await page.locator('.toggle__button').click();

    for (const value of [150, 220, 360, 490, 610, 750, 1000]) {
      await setSlider(page, value);
      await expectNudgeHidden(page);
    }
  });

  // DIA-17: the fix takes the first-toggle latch (nudgeSpent in
  // src/main.ts), so a toggle to without and back to built before the
  // first slider move also spends the nudge — R-06a is "once per
  // session", not "once per built-state visit".
  test('stays hidden after the visitor has toggled there and back', async ({ page }) => {
    await load(page);
    const button = page.locator('.toggle__button');
    await button.click();
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'false');

    await setSlider(page, 360);
    await expectNudgeHidden(page);
  });
});
