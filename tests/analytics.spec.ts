// PH3-04 (DIA-230): the D-016 event set, exercised through real user
// actions against the built dist/ (same "exactly what would be deployed"
// contract as tests/smoke.spec.ts). The build under test here has no
// VITE_UMAMI_WEBSITE_ID (CI leaves it unset until DIA-226/230 resolve), so
// the "analytics on" tests below use the test-only
// window.__ANALYTICS_TEST_WEBSITE_ID__ override (src/analytics.ts) instead
// of a second build — the same "id configured" code path a real deploy
// with the id set would take.
//
// The real Umami tracker (whatever host ends up behind /u/*, per DIA-230's
// still-open "this Worker or the existing umami-proxy" question) isn't
// reachable from this workspace or this test run — `stubTracker` below
// fulfils GET /u/script.js locally with the minimal shape src/analytics.ts
// actually depends on (`window.umami.track`), which is enough to prove the
// client-side half of the contract: same-origin request, right event
// names, no extra properties.
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import * as H from './interaction-helpers';

const TEST_WEBSITE_ID = 'analytics-e2e-test-id';

async function stubTracker(page: Page): Promise<void> {
  await page.addInitScript((websiteId) => {
    (window as unknown as { __ANALYTICS_TEST_WEBSITE_ID__: string }).__ANALYTICS_TEST_WEBSITE_ID__ = websiteId;
  }, TEST_WEBSITE_ID);
  await page.route('**/u/script.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.__trackedEvents = [];
        window.umami = { track: (name) => window.__trackedEvents.push(name) };`,
    })
  );
}

async function trackedEvents(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __trackedEvents?: string[] }).__trackedEvents ?? []);
}

async function waitForEvent(page: Page, name: string): Promise<void> {
  await page.waitForFunction(
    (n) => ((window as unknown as { __trackedEvents?: string[] }).__trackedEvents ?? []).includes(n),
    name
  );
}

async function waitForEventCount(page: Page, count: number): Promise<void> {
  await page.waitForFunction(
    (n) => ((window as unknown as { __trackedEvents?: string[] }).__trackedEvents ?? []).length >= n,
    count
  );
}

test.describe('D-016 analytics — no website id configured (the DIA-226/230 default)', () => {
  test('no /u/* request is ever made, and no third-party host is contacted', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (r) => requests.push(r.url()));
    await H.openApp(page);
    await H.setBand(page, 150);
    await H.setState(page, 'without');
    await H.openFirstHotspot(page);

    expect(requests.some((u) => u.includes('/u/'))).toBe(false);
    for (const url of requests) {
      const { hostname } = new URL(url);
      expect(hostname === 'localhost' || hostname === '127.0.0.1', url).toBe(true);
    }
  });
});

test.describe('D-016 analytics — website id configured (R-17, R-21)', () => {
  test('band_change fires once per settled band, and only touches /u/* same-origin', async ({ page }) => {
    const offOrigin: string[] = [];
    page.on('request', (r) => {
      const { hostname } = new URL(r.url());
      if (hostname !== 'localhost' && hostname !== '127.0.0.1') offOrigin.push(r.url());
    });
    await H.openApp(page, { beforeGoto: stubTracker });

    await H.setBand(page, 150);
    await waitForEvent(page, 'band_change');

    expect(await trackedEvents(page)).toEqual(['band_change']);
    expect(offOrigin).toEqual([]);
  });

  test('gag_open fires when a hotspot opens the panel', async ({ page }) => {
    await H.openApp(page, { beforeGoto: stubTracker });
    await H.openFirstHotspot(page);
    await waitForEvent(page, 'gag_open');
    expect(await trackedEvents(page)).toEqual(['gag_open']);
  });

  test('switch_flip fires when the built/without toggle is used', async ({ page }) => {
    await H.openApp(page, { beforeGoto: stubTracker });
    await H.setState(page, 'without');
    await waitForEvent(page, 'switch_flip');
    expect(await trackedEvents(page)).toEqual(['switch_flip']);
  });

  test('punchlist_download fires when the checklist Download button is used', async ({ page }) => {
    await H.openApp(page, { beforeGoto: stubTracker });
    // F4.1 (tests/hostile-f1-f4.spec.ts) already proves this really calls
    // window.print(); stubbed here only so a headless run never blocks on
    // a real print dialog.
    await page.evaluate(() => {
      window.print = () => {};
    });
    await H.openPunchList(page);
    await page.locator('.checklist__download').click();
    await waitForEvent(page, 'punchlist_download');
    expect(await trackedEvents(page)).toEqual(['punchlist_download']);
  });

  test('contact_click fires for both the LinkedIn and email links, without leaving the page (R-12/R-21)', async ({
    page,
    context,
  }) => {
    // Same stub as F4.2 (tests/hostile-f1-f4.spec.ts) — R-21 applies to the
    // suite as much as to the app; this test must make no LinkedIn request.
    await context.route('**://*.linkedin.com/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<html><body>stub</body></html>' })
    );
    await H.openApp(page, { beforeGoto: stubTracker });

    const links = page.locator('.checklist > .contact-line a');
    await expect(links).toHaveCount(2);

    const [popup] = await Promise.all([context.waitForEvent('page'), links.first().click()]);
    await waitForEvent(page, 'contact_click');
    await popup.close();

    await links.nth(1).click({ force: true });
    await waitForEventCount(page, 2);

    expect(await trackedEvents(page)).toEqual(['contact_click', 'contact_click']);
  });
});
