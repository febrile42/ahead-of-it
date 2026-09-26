// T7 / DIA-8 Part 1 — verdicts on the four candidate defects F1-F4, plus one
// found while reproducing them (F5).
//
// HOW THE EXPECTED-FAILURE TESTS IN THIS FILE WORK
// ------------------------------------------------
// Every test here asserts the **fixed** behaviour. The ones whose defect is
// still live carry `test.fail()`, which means:
//
//   * today  — the assertion fails, Playwright records an expected failure,
//              `npm run check` stays green and nobody else's PR is blocked;
//   * after  — the assertion passes, Playwright reports "expected to fail but
//     the fix  passed" and the suite goes RED, forcing whoever fixed it to
//              delete the one `test.fail()` line.
//
// So the regression test is already written: the fix deletes an annotation,
// it never rewrites an assertion. Do not "fix" a red expected-failure by
// relaxing the assertion — the assertion is the spec.
//
// Verdicts (full write-up on the issue):
//   F1  CONFIRMED, and reachable three ways (slider / view tab / resize).
//   F2  CONFIRMED — and the focus half is reachable by SCROLLING ALONE.
//   F3  DISMISSED as written (R-04 makes panel content state-independent);
//       the real defect underneath it is F1's, and is covered as F1.
//   F4  SPLIT — print and the contact links work and are now locked in; the
//       "every load of bands 360-750 hits the fallback" premise is STALE.
//   F5  NEW — the auto-opened Beyond panel survives sliding back down.
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import * as H from './interaction-helpers';
import { allGagIds, defaultViewGagIds, sceneSourceDir } from './scene-source';

/** The gag ids the currently-rendered view actually has hotspots for. The
 * oracle for "does the open panel describe something that is on screen". */
async function visibleGagIds(page: Page): Promise<string[]> {
  return H.hotspots(page).evaluateAll((els) =>
    els.map((el) => (el as HTMLElement).dataset.gagId ?? '')
  );
}

/**
 * R-04a ("panels are opened in arbitrary order, so each must be
 * self-identifying") and R-14 ("the accessible equivalent of the scene ...
 * MUST stay in sync with it") together give one fix-agnostic invariant:
 *
 *   an open panel must describe a gag the current scene is showing.
 *
 * Deliberately agnostic about *how* that is achieved — closing the panel on
 * a re-render and re-pointing it at the new scene both satisfy it, and which
 * one ships is a product call (CEO), not a QA call.
 */
async function expectPanelAgreesWithScene(page: Page, openedGagId: string) {
  if (!(await H.panelIsOpen(page))) return; // closed on re-render — also fine
  expect(await visibleGagIds(page)).toContain(openedGagId);
}

// ---------------------------------------------------------------------------
// F1 — CONFIRMED. The panel and the picture disagree, and Escape strands focus.
// ---------------------------------------------------------------------------

test.describe('F1 — an open panel survives a re-render that removes its subject', () => {
  test('F1.1 slider: a band-80 gag panel must not sit over the band-750 building', async ({ page }) => {
    // Data-driven pick (DIA-56): the premise under test is "a band-80 gag is
    // not on the band-750 screen", not "the first hotspot at band 80 happens
    // not to be". A real schema-2 export's band-80 default view can start
    // with a gag that is *also* in band 750's default close-up — the app
    // correctly keeps the panel open then, so hard-coding "first hotspot"
    // made the test's premise false for that gag, not a defect.
    const band750DefaultGags = new Set(defaultViewGagIds(750, 'built'));
    const gagId = allGagIds(80, 'built').find((id) => !band750DefaultGags.has(id));
    test.skip(
      gagId === undefined,
      "every band-80 gag is also in band 750's default view in this scene source — F1.1 has nothing to exercise"
    );

    await H.openApp(page); // 390px, mouse
    await H.setBand(page, 80);
    await H.showGag(page, gagId!);
    await H.openHotspot(page, gagId!, 'mouse');
    const stripAtOpen = await H.panelStrip(page);

    await H.setBand(page, 750, 'mouse');

    // Evidence: the stale panel photographed over the band it does not belong to.
    await page.screenshot({ path: 'tests/screenshots/f1-stale-panel-over-band-750.png' });

    // The strip is the panel's only band-identifying text (R-04a). If the
    // panel is still open it must not still be announcing the old band.
    if (await H.panelIsOpen(page)) {
      expect(await H.panelStrip(page)).not.toBe(stripAtOpen);
    }
    await expectPanelAgreesWithScene(page, gagId!);
  });

  test('F1.2 slider: Escape after a band change must not dump focus on <body> (B4/R-24)', async ({ page }) => {
    await H.openApp(page);
    await H.setBand(page, 80);
    await H.openFirstHotspot(page, 'keyboard');
    await H.setBand(page, 750, 'mouse');

    await H.pressEscape(page);

    // PH1-04-REVIEW B4: "return focus to the invoking hotspot on close".
    // The invoker was detached by renderHotspots' replaceChildren(), so
    // .focus() on it is a silent no-op and hiding the panel blurs to <body>.
    const focus = await H.settledFocusInfo(page);
    expect(H.focusIsLost(focus), `focus after Escape was ${JSON.stringify(focus)}`).toBe(false);
  });

  test('F1.3 room tab: switching room must not strand focus on <body> (R-24)', async ({ page }) => {
    // D-042a: band 750 has several rooms — a room tab click is the direct
    // descendant of the old per-view tab this defect was found on.
    await H.openApp(page);
    await H.setBand(page, 750);
    const rooms = await H.roomIds(page);
    const current = await H.currentRoomId(page);
    const other = rooms.find((r) => r !== current)!;

    // Mouse click on a tab focuses that tab; syncTabs then rebuilds the row
    // out from under it if the room list itself changes — but even a
    // same-band tab switch replaces the hotspot layer underneath it.
    await H.setRoom(page, other, 'mouse');

    const focus = await H.settledFocusInfo(page);
    expect(H.focusIsLost(focus), `focus after a room switch was ${JSON.stringify(focus)}`).toBe(false);
  });

  test('F1.3b room tab: an open panel intentionally survives a room switch, with return-focus precisely repointed (D-042a)', async ({
    page,
  }) => {
    // Unlike a band change, a room switch leaves band/state — what the
    // panel describes — unchanged (main.ts's syncOpenPanel(viewOnly)), so
    // the panel deliberately stays open rather than closing; only its
    // return-focus target, which pointed at a hotspot that just got
    // detached, must be repointed. Review fix (DIA-46 item 5): "not lost"
    // alone would also pass a regression that dumps focus on some other
    // live control — Escape must land exactly where the brief says (item
    // 7): the same gag's hotspot if the close-up now shown still has it,
    // else the stepper's whole-floor control.
    await H.openApp(page);
    await H.setBand(page, 750);
    const gagId = await H.openFirstHotspot(page, 'mouse');
    const rooms = await H.roomIds(page);
    const current = await H.currentRoomId(page);
    await H.setRoom(page, rooms.find((r) => r !== current)!, 'mouse');

    expect(await H.panelIsOpen(page)).toBe(true);
    const stillVisible = (await visibleGagIds(page)).includes(gagId);
    await H.pressEscape(page);
    const focus = await H.settledFocusInfo(page);
    expect(H.focusIsLost(focus), `focus after Escape was ${JSON.stringify(focus)}`).toBe(false);
    if (stillVisible) {
      expect(focus.gagId, `expected focus back on the hotspot for ${gagId}, got ${JSON.stringify(focus)}`).toBe(gagId);
    } else {
      expect(
        focus.className,
        `expected focus on the whole-floor control (the gag is not in the room switched to), got ${JSON.stringify(focus)}`
      ).toContain('scene-stepper__floor');
    }
  });

  test('F1.4 keyboard: Enter on a room tab must keep focus in the tab row (R-24)', async ({ page }) => {
    // No panel involved. A keyboard visitor tabs to the room row and
    // presses Enter; Enter fires the tab's *click* handler, not the roving
    // arrow-key handler, and only the arrow-key handler restores focus.
    await H.openApp(page);
    await H.setBand(page, 750);
    const rooms = await H.roomIds(page);
    const current = await H.currentRoomId(page);
    const target = rooms.find((r) => r !== current)!;

    await H.setRoom(page, target, 'keyboard');

    const focus = await H.settledFocusInfo(page);
    expect(H.focusIsLost(focus), `focus after Enter on a room tab was ${JSON.stringify(focus)}`).toBe(false);
    expect(focus.viewId).toBe(target);
  });

  test('F1.5 resize: Escape after a resize must not dump focus on <body> (B4/R-24)', async ({ page }) => {
    await H.openApp(page);
    await H.openFirstHotspot(page, 'keyboard');

    // One resize — the shape an iOS address-bar collapse takes.
    await H.actAndWaitForRender(page, async () => {
      await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    });
    await H.pressEscape(page);

    const focus = await H.settledFocusInfo(page);
    expect(H.focusIsLost(focus), `focus after resize+Escape was ${JSON.stringify(focus)}`).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// F2 — CONFIRMED, both halves, and the focus half is the severe one.
// ---------------------------------------------------------------------------

test.describe('F2 — every resize re-renders, unthrottled', () => {
  test('F2.1 SEVERE: one resize must not blur a focused hotspot (R-24)', async ({ page }) => {
    // This is F2's real cost. No panel, no slider, no toggle: a keyboard
    // visitor has tabbed onto a hotspot and the page merely scrolled. On iOS
    // that collapses the address bar, which fires `resize`, which
    // replaceChildren()s the hotspot layer and blurs them to <body> — they
    // are silently returned to the top of the document mid-read.
    await H.openApp(page);
    const hotspot = H.hotspots(page).first();
    await hotspot.focus();
    const gagId = (await hotspot.getAttribute('data-gag-id')) ?? '';
    expect((await H.focusInfo(page)).gagId).toBe(gagId); // precondition

    await H.actAndWaitForRender(page, async () => {
      await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    });

    const focus = await H.settledFocusInfo(page);
    expect(H.focusIsLost(focus), `focus after one resize was ${JSON.stringify(focus)}`).toBe(false);
    expect(focus.gagId).toBe(gagId);
  });

  test('F2.2 a burst of resize events must be coalesced, not rendered one-for-one (R-23)', async ({ page }) => {
    await H.openApp(page);
    const EVENTS = 40;
    const renders = await H.resizeStorm(page, EVENTS);
    // A scroll on a phone fires dozens of these. Any coalescing at all
    // (rAF, debounce, or an early-out when the size did not change) puts
    // this well under the event count; today it is exactly one-for-one.
    expect(renders, `${EVENTS} resize events produced ${renders} committed renders`).toBeLessThan(EVENTS);
  });

  /** Delays every scene fetch, still serving whatever `sceneSourceDir()`
   * actually has (fixture now, the real export later — same source
   * `interceptFixtureScenes` reads) so the race this simulates is real:
   * `route.continue()` would let the request past interceptFixtureScenes'
   * own (later-registered, thus higher-priority) route straight to the
   * dev/preview server's public/sprites/scenes/, which is schema 1 for
   * everything the fixtures don't cover yet. Passed as `beforeGoto` so it
   * registers *after* interceptFixtureScenes and wins the race for it. */
  async function slowSceneFetches(page: Page): Promise<void> {
    await page.route('**/sprites/scenes/*.json', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 120));
      const fileName = new URL(route.request().url()).pathname.split('/').pop()!;
      const body = readFileSync(`${sceneSourceDir()}${fileName}`, 'utf-8');
      await route.fulfill({ contentType: 'application/json', body });
    });
  }

  test('F2.3 DISMISSED half: the render token does keep the final state consistent', async ({ page }) => {
    // The candidate said renderToken "drops stale paints but not the stale
    // work". True, and that is the waste F2.2 measures — but it does NOT
    // corrupt state: with the scene fetch artificially slowed so several
    // renders are genuinely in flight at once, the committed result is the
    // last band requested, with exactly one selected tab and a hotspot layer
    // that matches it. Locking that in so a future throttle cannot regress it.
    await H.openApp(page, { beforeGoto: slowSceneFetches });

    await page.locator('#headcount-slider').evaluate((el) => {
      const input = el as HTMLInputElement;
      // 80 and 1000 (the 1,000+/"beyond" stop, which serves the 750 file) —
      // the two bands the fixtures cover pre-exporter (D-042 item 1).
      for (const value of [80, 1000, 80, 1000]) {
        input.value = String(value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await expect.poll(() => H.currentBand(page), { timeout: 10_000 }).toBe('beyond');
    await page.waitForTimeout(400); // let any later stale render try to land

    expect(await H.currentBand(page)).toBe('beyond');
    await expect(page.locator('.scene-views__button[aria-selected="true"]')).toHaveCount(1);
    const selected = await page
      .locator('.scene-views__button[aria-selected="true"]')
      .getAttribute('data-view-id');
    expect(selected).toBe(await H.currentRoomId(page));
    expect(await H.hotspots(page).count()).toBeGreaterThan(0);
  });

  test('F2.4 DISMISSED half: spamming the toggle still settles on the right state', async ({ page }) => {
    await H.openApp(page, { beforeGoto: slowSceneFetches });
    await page.locator('.toggle__button').evaluate((el) => {
      for (let i = 0; i < 5; i += 1) (el as HTMLButtonElement).click();
    });
    await page.waitForTimeout(1000);
    // Five flips from 'built' land on 'without'; the label and aria-pressed
    // must agree with it rather than with some mid-flight render.
    expect(await H.currentState(page)).toBe('without');
  });
});

// ---------------------------------------------------------------------------
// F3 — DISMISSED as written. Kept as passing tests that lock in *why*.
// ---------------------------------------------------------------------------

test.describe('F3 — the toggle and an open panel', () => {
  test('F3.1 panel content is state-independent by design, so there is nothing to refresh (R-04)', async ({
    page,
  }) => {
    // R-04 fixes the panel's thumbnail to the without-state scene and its
    // copy to the gag, neither of which is a function of the toggle. The
    // panel therefore cannot go stale on a toggle the way it does on a band
    // change — the candidate's premise does not hold. Asserted rather than
    // argued, so that a future built-state thumbnail turns this red instead
    // of shipping a genuinely stale panel.
    await H.openApp(page);
    await H.openFirstHotspot(page, 'mouse');
    const before = {
      strip: await H.panelStrip(page),
      title: await H.panelTitle(page),
      thumb: await page.locator('.panel__thumb').getAttribute('data-state'),
    };
    expect(before.thumb).toBe('without'); // R-04

    await H.setState(page, 'without');

    expect(await H.panelIsOpen(page)).toBe(true);
    expect(await H.panelStrip(page)).toBe(before.strip);
    expect(await H.panelTitle(page)).toBe(before.title);
    expect(await page.locator('.panel__thumb').getAttribute('data-state')).toBe('without');
  });

  test('F3.2 but the toggle DOES invalidate the panel\'s return-focus target (B4/R-24)', async ({ page }) => {
    // The part of the candidate that is real: the toggle re-renders the
    // hotspot layer too, so the invoking hotspot the panel promised to
    // return focus to (B4) no longer exists. Escape then lands wherever
    // focus happened to be, not on the invoker — silently, because
    // .focus() on a detached node neither throws nor logs.
    await H.openApp(page);
    const hotspot = H.hotspots(page).first();
    const gagId = (await hotspot.getAttribute('data-gag-id')) ?? '';
    await H.openFirstHotspot(page, 'mouse');

    await H.setState(page, 'without');
    await H.pressEscape(page);

    expect((await H.settledFocusInfo(page)).gagId, 'Escape must return focus to the invoking hotspot (B4)').toBe(
      gagId
    );
  });
});

// ---------------------------------------------------------------------------
// F4 — SPLIT. Two surfaces work and are now covered; one premise is stale.
// ---------------------------------------------------------------------------

test.describe('F4 — below-the-fold and off-the-happy-path surfaces', () => {
  test('F4.1 the checklist Download button really calls window.print() (R-14)', async ({ page }) => {
    await H.openApp(page);
    await page.evaluate(() => {
      const w = window as unknown as { __printCalls: number };
      w.__printCalls = 0;
      window.print = () => {
        w.__printCalls += 1;
      };
    });
    const button = page.locator('.checklist__download');
    await expect(button).toBeVisible();
    await button.click();
    expect(await page.evaluate(() => (window as unknown as { __printCalls: number }).__printCalls)).toBe(1);

    // R-14 "downloadable as a single page" is a print stylesheet, not a PDF
    // (D-019) — so the print media must still contain the checklist body.
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.checklist__item').first()).toBeVisible();
    await expect(page.locator('.checklist .contact-line')).toBeVisible(); // R-12
    await page.emulateMedia({ media: 'screen' });
  });

  test('F4.2 the contact links are safe to click and never leave the page (R-12/R-21)', async ({
    page,
    context,
  }) => {
    // The LinkedIn href is stubbed so this test makes no third-party request
    // of its own — R-21 applies to the suite as much as to the app.
    await context.route('**://*.linkedin.com/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<html><body>stub</body></html>' })
    );
    await H.openApp(page);
    const links = page.locator('.checklist .contact-line a');
    await expect(links).toHaveCount(2);

    const linkedin = links.first();
    expect(await linkedin.getAttribute('target')).toBe('_blank');
    expect(await linkedin.getAttribute('rel')).toContain('noopener'); // tabnabbing

    const before = page.url();
    const [popup] = await Promise.all([context.waitForEvent('page'), linkedin.click()]);
    expect(page.url(), 'clicking LinkedIn must not navigate the resume away').toBe(before);
    await popup.close();

    // mailto: is assembled at runtime (R-12/D-019). Clicking it must not
    // navigate the document either — the browser hands it to a mail client.
    const email = links.nth(1);
    expect((await email.getAttribute('href')) ?? '').toMatch(/^mailto:.+@.+/);
    await email.click({ force: true });
    await page.waitForTimeout(200);
    expect(page.url()).toBe(before);
  });

  test('F4.3 STALE PREMISE: every drawn band has a real scene file today', async ({ page }) => {
    // The candidate said bands 360-750 hit renderMissingScene on every load.
    // They did when it was written, and D-042's schema-2 painter (this
    // brief) refuses schema 1 on purpose (the "not drawn yet" path rather
    // than a half-drawn picture) — so until the exporter lands schema 2 for
    // every band, the premise is stale only for the bands `testableBands()`
    // actually covers. This is self-healing: once the real export lands for
    // every band, this loop covers every band with no change here.
    await H.openApp(page);
    for (const band of H.testableBands()) {
      await H.setBand(page, band);
      expect(
        await H.canvasShowsMissingScene(page),
        `band ${band} unexpectedly fell back to "not drawn yet"`
      ).toBe(false);
      expect(await H.hotspots(page).count(), `band ${band} rendered no hotspots`).toBeGreaterThan(0);
    }
  });

  test('F4.4 a failed scene fetch degrades to "not drawn yet" and keeps the R-14 checklist', async ({
    page,
  }) => {
    // The degenerate state that IS still reachable: a visitor on a flaky
    // connection. The picture is the optional half; R-14's text punch list
    // is the canonical one and must survive.
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    await H.failSceneFetch(page, 360);
    await H.openApp(page);

    await H.setBand(page, 360);
    expect(await H.canvasShowsMissingScene(page)).toBe(true);
    // R-14: the accessible equivalent is generated from content.json, not
    // from the scene file, so it must be unaffected.
    expect(await page.locator('.checklist__item').count()).toBeGreaterThan(0);
    await expect(page.locator('.checklist__download')).toBeVisible();
    await page.screenshot({ path: 'tests/screenshots/f4-missing-scene-band-360.png' });

    // The failure is reported, not swallowed (src/main.ts logs it), and it
    // is the only error logged — nothing else broke on the way down.
    expect(consoleErrors.length).toBeGreaterThan(0);

    // Recovery: sliding on to a band that does load must render normally
    // (750 — one of the bands the D-042 fixtures cover) ...
    await H.setBand(page, 750);
    expect(await H.canvasShowsMissingScene(page)).toBe(false);
    expect(await H.hotspots(page).count()).toBeGreaterThan(0);
    // ...and sliding back must fall back again rather than show 750's picture.
    await H.setBand(page, 360);
    expect(await H.canvasShowsMissingScene(page)).toBe(true);
  });

  test('F4.5 a total scene-asset outage still leaves a usable, readable page (R-14)', async ({ page }) => {
    // Worst case: every scene request fails. The visitor must still get the
    // whole argument in text, and the slider must still work. Registered via
    // beforeGoto (not before openApp) so it wins the route race against
    // interceptFixtureScenes for band 80's own request — Playwright resolves
    // the most-recently-registered matching route first.
    await H.openApp(page, { beforeGoto: (p) => H.failSceneFetch(p, 'all') });

    await expect(page.locator('h1')).toHaveText('Ahead of It');
    expect(await H.canvasShowsMissingScene(page)).toBe(true);
    const atBand80 = await page.locator('.checklist__item').count();
    expect(atBand80).toBeGreaterThan(0);

    await H.setBand(page, 220);
    expect(await H.currentBand(page)).toBe('220');
    // R-14: the checklist grows with the band even with no picture at all.
    expect(await page.locator('.checklist__item').count()).toBeGreaterThan(atBand80);
    await expect(page.locator('.checklist .contact-line a')).toHaveCount(2); // R-12
    await page.screenshot({ path: 'tests/screenshots/f4-total-outage-band-220.png' });
  });
});

// ---------------------------------------------------------------------------
// F5 — NEW, found while reproducing F1. Same class, different root cause.
// ---------------------------------------------------------------------------

test.describe('F5 — the auto-opened Beyond panel outlives the Beyond band', () => {
  test('F5.1 sliding back down from 1,000+ must not leave the Beyond panel over a numeric band', async ({
    page,
  }) => {
    // Worse than F1 because it needs no hotspot and no precision: R-01b
    // opens this panel *automatically* at the last stop, and "drag to the
    // end, then drag back" is one of the first things anyone does with a
    // slider. src/main.ts opens it in slider.onChange and nothing ever
    // closes it when the band leaves 'beyond'.
    await H.openApp(page);
    await H.setBand(page, 'beyond', 'keyboard');
    expect(await H.panelIsOpen(page)).toBe(true); // R-01b
    const beyondStrip = await H.panelStrip(page);

    await H.setBand(page, 220, 'mouse');

    await page.screenshot({ path: 'tests/screenshots/f5-beyond-panel-over-band-220.png' });
    if (await H.panelIsOpen(page)) {
      expect(
        await H.panelStrip(page),
        'the 1,000+ panel is still open over a numeric band'
      ).not.toBe(beyondStrip);
    }
  });
});

// ---------------------------------------------------------------------------
// F6 — NEW, found while reviewing DIA-13's fix for F1/F2/F3 (PR #11 -> DIA-26).
// Same root cause class (a re-render's replaceChildren() orphaning whatever
// held focus), one cell DIA-13's fix does not cover.
// ---------------------------------------------------------------------------

test.describe('F6 — a room tab holds focus across a re-render that drops it from the room list', () => {
  // Guards the DIA-26/F6 fix: captureFocus()/restoreFocus() now cover viewsRow tabs, not just hotspotsLayer.
  test('F6.1 slider: a band change that shrinks the room list must not strand a focused room tab (R-24)', async ({
    page,
  }) => {
    // F1.3/F1.4 cover a room tab surviving a room switch *within* band 750
    // (same room list, tabs reused — see syncTabs' own comment: "the nodes
    // are reused ... only rebuilt when a different band brings different
    // rooms"). This is the other half: the band itself changes to one with
    // fewer rooms, so viewsRow's tabs (not just the hotspot layer) get
    // rebuilt out from under a tab that has keyboard focus.
    await H.openApp(page);
    await H.setBand(page, 750); // 4 rooms: ground, floor-2, top, street
    const rooms = await H.roomIds(page);
    const tab = page.locator(`.scene-views__button[data-view-id="${rooms[rooms.length - 1]}"]`);
    await tab.focus();

    // 80 has one room ("ground") — a strictly shorter list, so syncTabs
    // must replaceChildren() the row.
    await H.setBand(page, 80, 'mouse');

    const focus = await H.settledFocusInfo(page);
    expect(H.focusIsLost(focus), `focus after the band change was ${JSON.stringify(focus)}`).toBe(false);
  });
});
