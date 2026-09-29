// D-061 (amends D-057 item 7, DIA-262/DIA-264): #share-control shares a
// link, not a file. src/ui/share.test.ts's unit tests cover the pure
// share/clipboard/abort/fallback decision (no DOM there); this file covers
// what needs a real page — the control's href/DOM position (unchanged from
// D-057 item 7's own coverage) and the clipboard-copy/toast/deep-link
// behaviour DIA-248 review flagged as e2e-only.
import { expect, test } from '@playwright/test';
import * as H from './interaction-helpers';

test.describe("D-061: the share control's link follows the current band", () => {
  test('href updates as the slider moves, even into the built state', async ({ page }) => {
    await H.openApp(page);
    for (const [band, stop] of [
      [150, 150],
      [610, 610],
      ['beyond', 1000],
    ] as const) {
      await H.setBand(page, band);
      const href = await page.locator('#share-control').getAttribute('href');
      expect(href, `band ${band}`).toBe(`${new URL(page.url()).origin}/?n=${stop}&it=none`);
    }

    // R-11/D-022: hands over the *without* link even once the toggle is
    // built — the control's href never switches with it.
    await H.setState(page, 'built');
    const hrefBuilt = await page.locator('#share-control').getAttribute('href');
    expect(hrefBuilt).toBe(`${new URL(page.url()).origin}/?n=1000&it=none`);
  });

  test('no download attribute — this is a page link, not a file (D-061)', async ({ page }) => {
    await H.openApp(page);
    expect(await page.locator('#share-control').getAttribute('download')).toBeNull();
  });
});

test.describe('D-061: clicking the control copies the link and shows the toast', () => {
  test('writes /?n=<stop>&it=none to the clipboard and shows the toast (non-touch path)', async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'clipboard permission grants are only reliable on chromium in CI');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await H.openApp(page);
    await H.setBand(page, 610);

    await page.locator('#share-control').click();

    const toast = page.locator('#share-toast');
    await expect(toast).toBeVisible();
    expect(await toast.getAttribute('aria-live')).toBe('polite');

    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toBe(`${new URL(page.url()).origin}/?n=610&it=none`);
  });

  test('a second click resets the toast timer instead of stacking a second one', async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'clipboard permission grants are only reliable on chromium in CI');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await H.openApp(page);

    const control = page.locator('#share-control');
    await control.click();
    await expect(page.locator('#share-toast')).toBeVisible();
    await control.click();
    // Still one toast element, still visible — no stack, no crash.
    await expect(page.locator('.toast')).toHaveCount(1);
    await expect(page.locator('#share-toast')).toBeVisible();
  });
});

test.describe('D-061: a shared link lands on the without state it names', () => {
  test('/?n=610&it=none opens straight into band 610, without', async ({ page }) => {
    // Establishes the fixture-scene route interception (D-042) before the
    // deep-link navigation below, the same order tests/url-state.spec.ts's
    // own "reloading a URL the page wrote" test uses.
    await H.openApp(page);
    await page.goto('/?n=610&it=none');
    await H.waitForFirstRender(page);
    expect(await H.currentBand(page)).toBe('610');
    expect(await H.currentState(page)).toBe('without');
  });
});

test.describe('D-057 item 7: the share control moves between #view-nav and the rail at 1152px', () => {
  test('below 1152px it sits in the view-nav row; at/above it moves into the rail under the toggle', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'webkit-iphone pins a 390px touch device, not a >=1152 desktop surface');

    await H.openApp(page, { viewport: { width: 1024, height: 900 } });
    await expect(page.locator('#view-nav #share-control')).toHaveCount(1);

    await page.setViewportSize({ width: 1440, height: 900 });
    // main.ts debounces its resize handler 150ms before updateDesktopLayout() runs.
    await page.waitForTimeout(250);
    await expect(page.locator('#view-nav #share-control')).toHaveCount(0);
    const previousSiblingId = await page.locator('#share-control').evaluate((el) => el.previousElementSibling?.id);
    expect(previousSiblingId).toBe('toggle-root');

    await page.setViewportSize({ width: 1024, height: 900 });
    await page.waitForTimeout(250);
    await expect(page.locator('#view-nav #share-control')).toHaveCount(1);
  });
});
