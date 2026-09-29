// D-057 item 7 (PH3-02, DIA-235): #share-control's two behaviours that
// src/ui/share.test.ts's unit test can't reach (no DOM there) and
// desktop-two-column.spec.ts doesn't cover (it checks where the panel docks
// relative to the control and its tab-order stop, not the control's own
// href or its DOM position) — DIA-248 review.
import { expect, test } from '@playwright/test';
import * as H from './interaction-helpers';

test.describe('D-057 item 7: the share control link follows the current band', () => {
  test('href/download update as the slider moves, even into the built state', async ({ page }) => {
    await H.openApp(page);
    for (const [band, stop] of [
      [150, 150],
      [610, 610],
      ['beyond', 1000],
    ] as const) {
      await H.setBand(page, band);
      const { href, download } = await page.locator('#share-control').evaluate((el) => {
        const a = el as HTMLAnchorElement;
        return { href: a.getAttribute('href'), download: a.getAttribute('download') };
      });
      expect(href, `band ${band}`).toBe(`/share/${stop}.png`);
      expect(download, `band ${band}`).toBe(`ahead-of-it-${stop}.png`);
    }

    // R-11/D-022: hands over the *without* image even once the toggle is
    // built — the control's href never switches with it.
    await H.setState(page, 'built');
    const hrefBuilt = await page.locator('#share-control').getAttribute('href');
    expect(hrefBuilt).toBe('/share/1000.png');
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
