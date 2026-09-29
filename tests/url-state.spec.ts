// PH3-01 (R-10 write side, U-09 "Back closes an open panel"): the URL bar
// tells the truth about the current band/state via `history.replaceState`
// (src/url-state.ts's sceneSearchParams, D-043's read side already covers
// reading it back), and opening a gag panel or the punch-list sheet pushes
// one history entry so a phone visitor's hardware Back closes the sheet
// instead of leaving the site — src/main.ts's `openOverlay`/`closeOverlayEntry`
// /`popstate` listener. QA Lead's device check (DIA-234) covers real iOS
// Safari/Android Chrome; this file is Chromium + Playwright's WebKit proxy
// (playwright.config.ts) only.
import { expect, test } from '@playwright/test';
import * as H from './interaction-helpers';

test.describe('R-10 write side: history.replaceState keeps n/it current', () => {
  test('never pushes for a slider drag or a toggle flip', async ({ page }) => {
    await H.openApp(page);
    const before = await page.evaluate(() => history.length);

    // A drag across every stop, both directions, plus the toggle twice —
    // the brief's own acceptance wording ("history.length grew by 0").
    for (const band of H.BAND_ORDER) {
      await H.setBand(page, band);
    }
    await H.setState(page, 'without');
    await H.setState(page, 'built');

    expect(await page.evaluate(() => history.length)).toBe(before);
    expect(new URL(page.url()).hash).toBe('');

    // One Back leaves the site (or the referrer) — nothing was ever pushed.
    await page.goBack();
    expect(page.url()).toBe('about:blank');
  });

  test('reloading a URL the page wrote reproduces the band and state (R-10)', async ({ page }) => {
    await H.openApp(page);
    await H.setBand(page, 220);
    await H.setState(page, 'without');
    const written = page.url();
    expect(written).toContain('n=220');
    expect(written).toContain('it=none');

    await page.goto(written);
    await H.waitForFirstRender(page);
    expect(await H.currentBand(page)).toBe('220');
    expect(await H.currentState(page)).toBe('without');
  });
});

test.describe('U-09: Back closes an open gag panel', () => {
  test('at 390: Back closes it, the query is unchanged, the page is not left', async ({ page }) => {
    await H.openApp(page);
    const beforeOpen = page.url();

    const gagId = await H.openFirstHotspot(page);
    expect(await H.panelIsOpen(page)).toBe(true);
    expect(page.url()).toBe(`${beforeOpen}#panel=${encodeURIComponent(gagId)}`);

    await page.goBack();
    await page.locator('.panel').waitFor({ state: 'hidden' });

    expect(await H.panelIsOpen(page)).toBe(false);
    expect(page.url()).toBe(beforeOpen); // query unchanged, hash gone, still on the page
  });

  test('focus returns to the hotspot that opened it, same as Esc (B4)', async ({ page }) => {
    await H.openApp(page);
    const gagId = await H.openFirstHotspot(page, 'keyboard');

    await page.goBack();
    await page.locator('.panel').waitFor({ state: 'hidden' });

    const focus = await H.settledFocusInfo(page);
    expect(focus.gagId).toBe(gagId);
  });

  test('Close button then Back leaves in one press — no stale history entry (item 4)', async ({ page }) => {
    await H.openApp(page);
    const appUrl = page.url();

    await H.openFirstHotspot(page);
    expect(page.url()).toContain('#panel=');

    await page.locator('.panel__close').click();
    await page.locator('.panel').waitFor({ state: 'hidden' });
    // The close button's own history.back() (item 4) runs asynchronously —
    // wait for it to land before the visitor's own Back press below.
    await page.waitForFunction(() => location.hash === '');
    expect(page.url()).toBe(appUrl);

    await page.goBack();
    expect(page.url()).toBe('about:blank');
  });

  test('Esc then Back also leaves in one press (item 4 applies to every close path)', async ({ page }) => {
    await H.openApp(page);
    const appUrl = page.url();

    await H.openFirstHotspot(page);
    await H.pressEscape(page);
    await page.waitForFunction(() => location.hash === '');
    expect(page.url()).toBe(appUrl);

    await page.goBack();
    expect(page.url()).toBe('about:blank');
  });

  test('reloading a URL with a panel hash open lands with no panel open (CEO ruling: hash is history-only)', async ({
    page,
  }) => {
    await H.openApp(page);
    await H.openFirstHotspot(page);
    const withHash = page.url();
    expect(withHash).toContain('#panel=');

    await page.goto(withHash);
    await H.waitForFirstRender(page);
    expect(await H.panelIsOpen(page)).toBe(false);
  });

  test('switching straight to a second panel replaces the hash, not a second push (item 5)', async ({ page }) => {
    // Non-modal side panel only (U-06) — needs desktop width so the first
    // panel being open doesn't make the second hotspot `inert`.
    await H.openApp(page, { viewport: H.DESKTOP });
    await H.ensureCloseup(page);

    // Walks the stepper (crossing rooms, same order showGag uses) until it
    // finds a close-up with two real gag hotspots — not a fixed gag id pair,
    // since which close-up holds which gags is exporter content, not
    // something this brief owns (SCENE-FORMAT).
    const gagHotspots = page.locator('.hotspot[data-gag-id]');
    for (let guard = 0; (await gagHotspots.count()) < 2; guard += 1) {
      if (guard > 20 || !(await H.step(page, 1))) {
        throw new Error('no close-up with two gag hotspots found to test switching between panels');
      }
    }

    const firstId = await gagHotspots.nth(0).getAttribute('data-gag-id');
    const secondId = await gagHotspots.nth(1).getAttribute('data-gag-id');

    const before = await page.evaluate(() => history.length);
    await H.openHotspot(page, firstId!);
    expect(page.url()).toContain(`#panel=${encodeURIComponent(firstId!)}`);

    await H.openHotspot(page, secondId!);
    expect(page.url()).toContain(`#panel=${encodeURIComponent(secondId!)}`);
    expect(await page.evaluate(() => history.length)).toBe(before + 1); // replaced, not a second push

    await page.goBack();
    await page.locator('.panel').waitFor({ state: 'hidden' });
  });
});

test.describe('U-09: Back closes the open punch-list sheet (D-048)', () => {
  test('at 390: Back closes it, the query is unchanged, the page is not left', async ({ page }) => {
    await H.openApp(page);
    const beforeOpen = page.url();

    await H.openPunchList(page);
    expect(page.url()).toBe(`${beforeOpen}#list`);

    await page.goBack();
    expect(await H.punchListIsOpen(page)).toBe(false);
    expect(page.url()).toBe(beforeOpen);
  });

  test('Close button then Back leaves in one press (item 4)', async ({ page }) => {
    await H.openApp(page);
    const appUrl = page.url();

    await H.openPunchList(page);
    await H.closePunchList(page);
    await page.waitForFunction(() => location.hash === '');
    expect(page.url()).toBe(appUrl);

    await page.goBack();
    expect(page.url()).toBe('about:blank');
  });
});

test('the 1,000+ auto-opened panel never pushes a history entry (it is not gag-panel-initiated)', async ({ page }) => {
  await H.openApp(page);
  const before = await page.evaluate(() => history.length);
  await H.setBand(page, 'beyond');
  expect(await H.panelIsOpen(page)).toBe(true); // R-01b: opens automatically
  expect(new URL(page.url()).hash).toBe(''); // ...but item 2 only covers a hotspot/punch-list open
  expect(await page.evaluate(() => history.length)).toBe(before);
});
