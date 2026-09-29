// D-046/PH2-05: the page goes dark on `prefers-color-scheme: dark`, the
// building doesn't. `test.use({ colorScheme: 'dark' })` is Playwright's
// emulation of that OS preference — no in-page switch exists to drive
// instead (D-046 point 1). PHONE (interaction-helpers.ts) is the 390px
// viewport every feature is designed against first.
import { expect, test } from '@playwright/test';
import { PHONE, openApp, openFirstHotspot, openPunchList, setBand, setState } from './interaction-helpers';
import { contrastRatio } from './contrast';

test.describe('dark mode screenshots (D-046 acceptance)', () => {
  test.use({ colorScheme: 'dark' });

  for (const band of [80, 220, 750] as const) {
    for (const state of ['built', 'without'] as const) {
      test(`screenshot band ${band} / ${state}`, async ({ page }) => {
        await openApp(page, { viewport: PHONE });
        await setBand(page, band);
        await setState(page, state);
        await page.screenshot({ path: `tests/screenshots/dark/band-${band}-${state}.png` });
      });
    }
  }

  // DIA-159: the default first paint, no interaction yet — the state a
  // visitor's very first frame is in, before the punch-list/panel work below.
  test('screenshot: landing', async ({ page }) => {
    await openApp(page, { viewport: PHONE });
    await page.screenshot({ path: 'tests/screenshots/dark/landing.png' });
  });

  // DIA-159: the punch-list sheet was the fix's own regression target
  // (DIA-118 reopen) — a white sheet on a dark page is the bug this whole
  // issue exists to catch.
  test('screenshot: punch list open', async ({ page }) => {
    await openApp(page, { viewport: PHONE });
    await setBand(page, 80);
    await openPunchList(page);
    await page.screenshot({ path: 'tests/screenshots/dark/punch-list-open.png' });
  });

  test('screenshot: an open panel', async ({ page }) => {
    await openApp(page, { viewport: PHONE });
    await setBand(page, 80);
    await openFirstHotspot(page);
    await page.screenshot({ path: 'tests/screenshots/dark/panel.png' });
  });

  test('screenshot: the checklist', async ({ page }) => {
    await openApp(page, { viewport: PHONE });
    await setBand(page, 80);
    await page.locator('.checklist').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'tests/screenshots/dark/checklist.png' });
  });
});

test.describe('dark mode contrast (D-046 point 6, WCAG AA)', () => {
  test.use({ colorScheme: 'dark' });

  test('body text on the page is at least 4.5:1', async ({ page }) => {
    await openApp(page, { viewport: PHONE });
    const [color, background] = await page.evaluate(() => {
      const style = getComputedStyle(document.body);
      return [style.color, style.backgroundColor];
    });
    expect(contrastRatio(color, background)).toBeGreaterThanOrEqual(4.5);
  });

  test("the toggle's label is at least 4.5:1 on its fill", async ({ page }) => {
    // D-046 point 4: the toggle keeps its fills in both schemes, so this is
    // really a check that dark mode hasn't disturbed it (the fill/text pair
    // is themed independently of --ink — see src/style.css's --toggle-*
    // variables) rather than a check specific to dark mode.
    await openApp(page, { viewport: PHONE });
    const button = page.locator('.toggle__button');
    const [color, background] = await button.evaluate((el) => {
      const style = getComputedStyle(el);
      return [style.color, style.backgroundColor];
    });
    expect(contrastRatio(color, background)).toBeGreaterThanOrEqual(4.5);
  });

  test("the toggle's pressed label is at least 4.5:1 on its fill", async ({ page }) => {
    // D-052 (DIA-163): --toggle-text-pressed was #fff on --toggle-fill-pressed's
    // #ff3dae, 3.22:1 at 16px/700 (under the 18.66px bold large-text threshold,
    // so the 4.5:1 text gate applies, not the 3:1 one). Never rethemed (D-046
    // pt 4), so this must hold in both schemes — see the light-mode sibling
    // below.
    await openApp(page, { viewport: PHONE });
    await setState(page, 'without');
    const button = page.locator('.toggle__button');
    const [color, background] = await button.evaluate((el) => {
      const style = getComputedStyle(el);
      return [style.color, style.backgroundColor];
    });
    expect(contrastRatio(color, background)).toBeGreaterThanOrEqual(4.5);
  });

  test('a chrome focus ring is at least 3:1 on the page', async ({ page }) => {
    await openApp(page, { viewport: PHONE });
    const tab = page.locator('.scene-views__button').first();
    await tab.focus();
    const { ringDrawn, outlineColor, background } = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const style = getComputedStyle(el);
      return {
        // Without these, outlineColor falls back to currentColor and the
        // ratio below would measure the label, not the ring.
        ringDrawn: el.matches(':focus-visible') && style.outlineStyle !== 'none',
        outlineColor: style.outlineColor,
        background: getComputedStyle(document.body).backgroundColor,
      };
    });
    expect(ringDrawn).toBe(true);
    expect(contrastRatio(outlineColor, background)).toBeGreaterThanOrEqual(3);
  });

  test("the toggle's own focus ring is at least 3:1 on the page", async ({ page }) => {
    // DIA-214 manual QA pass: .toggle__button had no :focus-visible rule of
    // its own (unlike .scene-views__button above, .punch-list-button,
    // .hotspot and .scene-stepper button, which all set an explicit
    // `outline: 3px solid var(--accent)`), so it fell back to the UA's
    // `outline-color: auto`. Chromium's auto resolves near-white and passed;
    // WebKit's auto instead resolved to the button's own --toggle-text ink
    // (#000, D-046 point 4's fill never rethemes), which measured ~1.14:1
    // against --page-bg (#171310) — invisible to a Safari/iPhone keyboard
    // user (R-20) tabbing to the headline toggle in dark mode. Same failure
    // in both pressed and unpressed state, since both kept black text.
    // DIA-216 added the explicit .toggle__button:focus-visible rule (see
    // the sibling test above), so this now runs as a plain assertion.
    await openApp(page, { viewport: PHONE });
    const button = page.locator('.toggle__button');
    await button.focus();
    const { ringDrawn, outlineColor, background } = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const style = getComputedStyle(el);
      return {
        ringDrawn: el.matches(':focus-visible') && style.outlineStyle !== 'none',
        outlineColor: style.outlineColor,
        background: getComputedStyle(document.body).backgroundColor,
      };
    });
    expect(ringDrawn).toBe(true);
    expect(contrastRatio(outlineColor, background)).toBeGreaterThanOrEqual(3);
  });
});

test.describe('light mode contrast (D-046 point 6, WCAG AA)', () => {
  test.use({ colorScheme: 'light' });

  test("the toggle's pressed label is at least 4.5:1 on its fill", async ({ page }) => {
    // D-052 (DIA-163): the pressed-toggle failure (3.22:1) predated dark mode
    // and reproduced identically in light — --toggle-text-pressed is never
    // rethemed (D-046 pt 4). Sibling of the dark-mode test above; both must
    // pass since the token carries one value for both schemes.
    await openApp(page, { viewport: PHONE });
    await setState(page, 'without');
    const button = page.locator('.toggle__button');
    const [color, background] = await button.evaluate((el) => {
      const style = getComputedStyle(el);
      return [style.color, style.backgroundColor];
    });
    expect(contrastRatio(color, background)).toBeGreaterThanOrEqual(4.5);
  });
});
