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

test.describe('PR #16 review B1: the query stays live while a non-modal panel is open (U-06)', () => {
  // At >=768px the panel doesn't trap input (U-06) — the slider/toggle stay
  // usable while it's open. Before this fix, `writeSceneQuery()` (main.ts)
  // kept replacing the *panel's own* history entry while it was open, so the
  // entry the visitor lands back on after closing it (pushed before the
  // panel opened) still held whatever `n`/`it` were at that time.
  test('closing the panel with the close button leaves the latest toggle state, not the pre-panel one', async ({
    page,
  }) => {
    await H.openApp(page, { viewport: H.DESKTOP });

    const gagId = await H.openFirstHotspot(page);
    expect(page.url()).toContain(`#panel=${encodeURIComponent(gagId)}`);

    await H.setState(page, 'without');
    expect(await H.panelIsOpen(page)).toBe(true); // still open — non-modal, the toggle didn't close it

    await page.locator('.panel__close').click();
    await page.waitForFunction(() => location.hash === '');

    expect(page.url()).toContain('it=none');
  });

  test('closing the panel with a real Back press leaves the latest toggle state, not the pre-panel one', async ({
    page,
  }) => {
    await H.openApp(page, { viewport: H.DESKTOP });

    const gagId = await H.openFirstHotspot(page);
    expect(page.url()).toContain(`#panel=${encodeURIComponent(gagId)}`);

    await H.setState(page, 'without');
    expect(await H.panelIsOpen(page)).toBe(true);

    await page.goBack();
    await page.locator('.panel').waitFor({ state: 'hidden' });

    expect(page.url()).toContain('it=none');
  });

  test('the panel auto-closing on a band change (syncOpenPanel) leaves the latest band, not the pre-panel one', async ({
    page,
  }) => {
    await H.openApp(page, { viewport: H.DESKTOP });

    const gagId = await H.openFirstHotspot(page);
    expect(page.url()).toContain(`#panel=${encodeURIComponent(gagId)}`);

    // Band 220 has no fixture scene, so this gag's own hotspot is gone from
    // the rebuilt view — syncOpenPanel (main.ts) closes the panel itself,
    // the third of the three close paths B1 named (not the close button or
    // a Back press, both already covered above and by the pre-existing
    // U-09 specs).
    await H.setBand(page, 220);
    await page.waitForFunction(() => location.hash === '');

    expect(await H.panelIsOpen(page)).toBe(false);
    expect(page.url()).toContain('n=220');
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

test('PR #16 review N1: dragging to beyond while a gag panel is open drops that panel\'s overlay entry', async ({
  page,
}) => {
  await H.openApp(page, { viewport: H.DESKTOP });

  await H.openFirstHotspot(page);
  expect(page.url()).toContain('#panel=');

  await H.setBand(page, 'beyond');
  expect(await H.panelIsOpen(page)).toBe(true); // the Beyond panel, swapped in over the gag panel
  // The dropped entry's own history.back() (closeOverlayEntry, called from the
  // 'beyond' branch) lands asynchronously, same as every other close path here.
  await page.waitForFunction(() => location.hash === '');
  expect(new URL(page.url()).hash).toBe(''); // the gag panel's own entry must not survive the swap

  // One Back should now leave the page, same as the plain auto-open case above —
  // not close a panel that no longer owns a history entry.
  await page.goBack();
  expect(page.url()).toBe('about:blank');
});

// DIA-234 QA verification of PH3-01 found this while probing combinations the
// brief's own item 5 doesn't cover: item 5 only names "tapping a second
// hotspot" (gag panel -> gag panel), where showGag reuses the same DOM panel,
// so there is never a second overlay to leave open. `openOverlay`/
// `closeOverlayEntry` (main.ts) track history generically for "an open gag
// panel or the punch-list sheet" and treat opening either while the other's
// entry is live as one replace (item 5's own comment: "same push-or-replace
// rule as a gag panel") — but nothing ever calls panel.close() when the
// checklist opens, or checklist.close() when a hotspot opens a panel, only
// at >=768px where U-06 leaves both reachable (a 390px visitor can't reach
// this: the open panel makes the rest of the page inert, covering the
// punch-list button). The result: both the gag panel and the punch-list
// sheet end up simultaneously "open" (panel.isOpen() / checklist.isOpen()
// both true), the earlier one merely hidden under the later one's fixed-
// position sheet — and its own Close button stays in the Tab order despite
// being invisible under the sheet on top of it.
test.describe('desktop-only gap: opening one overlay does not close the other (found verifying PH3-01)', () => {
  test('opening the punch-list while a gag panel is open leaves the panel open underneath it', async ({ page }) => {
    await H.openApp(page, { viewport: H.DESKTOP });
    await H.openFirstHotspot(page);

    await H.openPunchList(page);

    expect(await H.punchListIsOpen(page)).toBe(true);
    expect(await H.panelIsOpen(page)).toBe(false); // FAILS today: still true, hidden under the sheet
  });

  test('opening a gag panel while the punch-list is open leaves the list open underneath it', async ({ page }) => {
    await H.openApp(page, { viewport: H.DESKTOP });
    await H.openPunchList(page);

    await H.openFirstHotspot(page);

    expect(await H.panelIsOpen(page)).toBe(true);
    expect(await H.punchListIsOpen(page)).toBe(false); // FAILS today: still true, hidden under the panel
  });

  test('the gag panel\'s Close button is not reachable by Tab while the punch-list sheet covers it', async ({
    page,
  }) => {
    await H.openApp(page, { viewport: H.DESKTOP });
    await H.openFirstHotspot(page);
    await H.openPunchList(page);

    const tabbedClassNames: string[] = [];
    for (let i = 0; i < 20; i += 1) {
      await page.keyboard.press('Tab');
      tabbedClassNames.push((await page.evaluate(() => (document.activeElement as HTMLElement)?.className)) ?? '');
    }

    // FAILS today: '.panel__close' shows up in the tab order even though the
    // checklist sheet visually covers it — a keyboard user lands on a button
    // they cannot see, for a panel the visitor never closed.
    expect(tabbedClassNames.some((c) => c.includes('panel__close'))).toBe(false);
  });
});
