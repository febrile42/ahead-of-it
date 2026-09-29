// DIA-195 — the seven P1 fixes from the DIA-194 UX review (document
// `review`, develop@7974c4a). Each U-xx below is that row's own AC; the
// bug it fixes and the receipts are on the review, not restated here.
import { expect, test } from '@playwright/test';
import * as H from './interaction-helpers';
import { findGagView, readBandSceneFile } from './scene-source';

// ---------------------------------------------------------------------------
// U-01 — the slider's initial raw value comes from the band id, not a parse
// of its display copy (band 750's "~650→750" used to strip to "650750",
// clamped to SLIDER_MAX, which snapped the thumb to 'beyond' instead of 750).
// ---------------------------------------------------------------------------

test.describe('U-01: initial slider value from the band id', () => {
  test('a fresh load (band 80) sets the input to 80, not a parsed default', async ({ page }) => {
    await H.openApp(page);
    await expect(page.locator('#headcount-slider')).toHaveValue('80');
  });

  test('?n=750 sets the input to 750, not a clamped 1000', async ({ page }) => {
    await H.openApp(page);
    await page.goto('/?n=750');
    await H.waitForFirstRender(page);
    await expect(page.locator('#headcount-slider')).toHaveValue('750');
    expect(await H.currentBand(page)).toBe('750');
  });

  test('a deep link past every band (?n=5000) sets the input to SLIDER_MAX for beyond', async ({ page }) => {
    await H.openApp(page);
    await page.goto('/?n=5000');
    await H.waitForFirstRender(page);
    await expect(page.locator('#headcount-slider')).toHaveValue('1000');
    expect(await H.currentBand(page)).toBe('beyond');
  });
});

// ---------------------------------------------------------------------------
// U-02 — the slider's own box is a real 44px hit area (R-20), not the
// browser's ~16px unstyled default.
// ---------------------------------------------------------------------------

test.describe('U-02: 44px slider hit area', () => {
  test('the range input\'s own box is at least 44px tall', async ({ page }) => {
    await H.openApp(page);
    const box = await page.locator('#headcount-slider').boundingBox();
    expect(box?.height, `slider hit area was ${box?.height}px`).toBeGreaterThanOrEqual(44);
  });
});

// ---------------------------------------------------------------------------
// U-03 — Home/End/Arrow/Page keys step between bands, not raw slider units.
// ---------------------------------------------------------------------------

test.describe('U-03: keyboard band-stepping', () => {
  /** Each key press fires a render (src/ui/slider.ts's update() calls the
   * onChange listeners synchronously, but the render() they trigger is
   * async) — reading document.body.dataset.band right after the keypress
   * can catch it mid-flight, so every assertion below waits for the render
   * the press causes first. */
  async function pressAndWait(page: import('@playwright/test').Page, key: string) {
    await H.actAndWaitForRender(page, () => page.keyboard.press(key));
  }

  test('Home lands on the first band (80), End on 1,000+', async ({ page }) => {
    await H.openApp(page);
    await page.locator('#headcount-slider').focus();
    await pressAndWait(page, 'End');
    expect(await H.currentBand(page)).toBe('beyond');
    await pressAndWait(page, 'Home');
    expect(await H.currentBand(page)).toBe('80');
  });

  test('ArrowRight/PageUp move exactly one band forward, ArrowLeft/PageDown one band back', async ({ page }) => {
    await H.openApp(page);
    await page.locator('#headcount-slider').focus();
    await pressAndWait(page, 'ArrowRight');
    expect(await H.currentBand(page)).toBe('150');
    await pressAndWait(page, 'PageUp');
    expect(await H.currentBand(page)).toBe('220');
    await pressAndWait(page, 'PageDown');
    expect(await H.currentBand(page)).toBe('150');
    await pressAndWait(page, 'ArrowLeft');
    expect(await H.currentBand(page)).toBe('80');
  });

  test('a single ArrowRight from 80 does not take 90 presses to move (regression: raw-unit stepping)', async ({
    page,
  }) => {
    await H.openApp(page);
    await page.locator('#headcount-slider').focus();
    await pressAndWait(page, 'ArrowRight');
    // The native default moves the raw value by 1 (81/1000), which still
    // snaps to band 80 — this fails on that regression and passes on the
    // fixed one-band-per-press behaviour.
    expect(await H.currentBand(page)).not.toBe('80');
  });
});

// ---------------------------------------------------------------------------
// U-04 / D-054 (amends D-051 item 3) — a band change keeps the *kind* of
// view the visitor is in: a whole-floor exit lands on the new band's own
// opening room; a close-up exit stays on its own id if the new band's scene
// still has it, else falls back to that band's default close-up.
// ---------------------------------------------------------------------------

test.describe('U-04 / D-054: a band change keeps the kind of view', () => {
  test('a whole-floor exit opens the new band on its own opening room, not a close-up', async ({ page }) => {
    await H.openApp(page);
    await H.setBand(page, 80);
    // Land on band 80's room view (D-051 item 1's landing, or reached via
    // "whole floor" if a fresh load happened to start on a close-up).
    if ((await H.currentView(page)) !== (await H.currentRoomId(page))) {
      await H.toggleWholeFloor(page);
    }
    expect(await H.currentView(page)).toBe(await H.currentRoomId(page));

    await H.setBand(page, 750, 'mouse');

    expect(
      await H.currentView(page),
      'a whole-floor exit must land on the new band\'s own opening room'
    ).toBe(await H.currentRoomId(page));
  });

  test('a close-up whose id also exists in the new band stays on it', async ({ page }) => {
    // ground.1 is a real id in both the 80 and 750 fixtures (D-036 close-up
    // ids are stable across bands) but is neither band's `default` view, so
    // this is exercising D-054's own id-preservation branch, not the
    // pre-existing default-view fallback.
    await H.openApp(page);
    await H.setBand(page, 80);
    await H.gotoCloseupView(page, 'ground.1');

    await H.setBand(page, 750, 'mouse');

    expect(await H.currentView(page)).toBe('ground.1');
  });

  test('a close-up whose id does not exist in the new band falls back to that band\'s default close-up', async ({
    page,
  }) => {
    await H.openApp(page);
    await H.setBand(page, 750);
    // floor-2.1 exists only in band 750's scene (band 80 has no floor-2 room
    // at all), so a change down to 80 cannot preserve it.
    await H.gotoCloseupView(page, 'floor-2.1');

    await H.setBand(page, 80, 'mouse');

    const band80Scene = readBandSceneFile(80, 'built');
    const defaultId = band80Scene?.views.find((v) => v.default)?.id;
    expect(defaultId, 'band 80 fixture has no default view to assert against').toBeDefined();
    expect(await H.currentView(page)).toBe(defaultId);
  });

  test('a gag panel open on a close-up that survives the band change keeps describing the same gag', async ({
    page,
  }) => {
    // Cross-check against src/main.ts's syncOpenPanel: D-054 choosing to
    // stay on the same close-up id must not, by itself, invalidate an open
    // panel for a gag that close-up still has in the new band.
    await H.openApp(page);
    await H.setBand(page, 80);
    const view = findGagView(80, 'built', 'G1.1');
    test.skip(view?.id !== 'ground.1', 'fixture layout changed — G1.1 is no longer on ground.1');
    await H.gotoCloseupView(page, 'ground.1');
    await H.openHotspot(page, 'G1.1', 'mouse');

    await H.setBand(page, 750, 'mouse');

    expect(await H.panelIsOpen(page)).toBe(true);
    expect(await H.panelTitle(page)).not.toBe('');
  });
});

// ---------------------------------------------------------------------------
// U-05 — the phone sheet is capped at 50vh, the tapped hotspot scrolls above
// its edge, and the hotspot itself carries a selected state while its panel
// is open.
// ---------------------------------------------------------------------------

test.describe('U-05: phone sheet, scroll-into-view, selected hotspot', () => {
  test('the open panel is capped at 50vh on a phone', async ({ page }) => {
    await H.openApp(page); // 390x844
    await H.openFirstHotspot(page, 'mouse');
    const box = await page.locator('.panel').boundingBox();
    expect(box, 'panel has no box while open').not.toBeNull();
    expect(box!.height, `panel height ${box!.height} exceeds 50vh (${H.PHONE.height / 2})`).toBeLessThanOrEqual(
      H.PHONE.height / 2 + 1
    );
  });

  test('opening a hotspot scrolls the scene as close to the viewport top as the page allows', async ({ page }) => {
    // Band 750 (the tallest scene) so there is real scroll headroom to
    // measure against — band 80's page may be too short for scene-wrap's
    // own top to ever reach the viewport top regardless of this fix.
    await H.openApp(page);
    await H.setBand(page, 750);
    await H.ensureCloseup(page);
    const { targetTop, maxScroll } = await page.evaluate(() => {
      const el = document.querySelector('#scene-wrap')!;
      return {
        targetTop: el.getBoundingClientRect().top + window.scrollY,
        maxScroll: document.documentElement.scrollHeight - window.innerHeight,
      };
    });
    const expectedScrollY = Math.max(0, Math.min(targetTop, maxScroll));

    await H.openFirstHotspot(page, 'mouse');

    const scrollY = await page.evaluate(() => window.scrollY);
    expect(
      scrollY,
      `expected scrollY >= ${expectedScrollY} (scene-wrap's own top, clamped to the page's scroll range), got ${scrollY}`
    ).toBeGreaterThanOrEqual(expectedScrollY - 5);
  });

  test('the tapped hotspot carries a selected state while its panel is open, cleared on close', async ({ page }) => {
    await H.openApp(page);
    await H.ensureCloseup(page);
    const hotspot = H.hotspots(page).first();
    await hotspot.click();
    await H.waitForPanelOpen(page);
    await expect(hotspot).toHaveClass(/hotspot--selected/);
    await expect(hotspot).toHaveAttribute('aria-expanded', 'true');

    await H.pressEscape(page);
    await expect(hotspot).not.toHaveClass(/hotspot--selected/);
    await expect(hotspot).toHaveAttribute('aria-expanded', 'false');
  });
});

// ---------------------------------------------------------------------------
// U-06 — the panel is a modal dialog (Tab-trapped, background inert) at
// <=767px; the auto-opened Beyond panel is the one deliberate exception.
// ---------------------------------------------------------------------------

test.describe('U-06: panel modal + inert on phone', () => {
  test('a hotspot panel makes the rest of the page inert and traps Tab', async ({ page }) => {
    await H.openApp(page);
    await H.ensureCloseup(page);
    await H.openFirstHotspot(page, 'mouse');

    await expect(page.locator('.panel')).toHaveAttribute('aria-modal', 'true');
    // The slider sits outside the panel — while modal, it must be
    // unreachable by a real click (inert), not merely deprioritised.
    await expect(page.locator('#slider-root')).toHaveJSProperty('inert', true);

    // Shift+Tab from the panel's first focusable element wraps to its last,
    // rather than escaping into the (inert) page behind it.
    await page.locator('.panel button, .panel a').first().focus();
    await page.keyboard.press('Shift+Tab');
    const active = await page.evaluate(() => document.activeElement?.closest('.panel') !== null);
    expect(active, 'Shift+Tab from the sheet\'s first control must stay inside the panel').toBe(true);
  });

  test('closing the panel lifts inert off the rest of the page', async ({ page }) => {
    await H.openApp(page);
    await H.ensureCloseup(page);
    await H.openFirstHotspot(page, 'mouse');
    await H.pressEscape(page);

    await expect(page.locator('#slider-root')).toHaveJSProperty('inert', false);
    await expect(page.locator('#headcount-slider')).toBeEnabled();
  });

  test('the auto-opened Beyond panel stays non-modal so the slider remains usable', async ({ page }) => {
    await H.openApp(page);
    await H.setBand(page, 750);
    await H.setBand(page, 'beyond');

    await expect(page.locator('.panel')).toHaveAttribute('aria-modal', 'false');
    await expect(page.locator('#slider-root')).toHaveJSProperty('inert', false);
  });
});

// ---------------------------------------------------------------------------
// U-07 — the collapsed checklist uses the same visually-hidden pattern as
// the rest of the page (never a fixed 1x1px box with no positioned
// ancestor), so it stops contributing ~2,200px of blank scroll below the
// contact line.
// ---------------------------------------------------------------------------

test.describe('U-07: collapsed checklist adds no scroll extent', () => {
  test('the page does not scroll ~2,200px past its own content while the checklist is collapsed', async ({
    page,
  }) => {
    await H.openApp(page);
    await expect(page.locator('.checklist__panel')).toHaveClass(/checklist__panel--collapsed/);

    const { scrollHeight, contactBottom } = await page.evaluate(() => {
      const contact = document.querySelector('.contact');
      return {
        scrollHeight: document.documentElement.scrollHeight,
        contactBottom: contact ? contact.getBoundingClientRect().bottom + window.scrollY : document.body.scrollHeight,
      };
    });
    expect(
      scrollHeight - contactBottom,
      `page scrolls ${scrollHeight - contactBottom}px past the contact line while the checklist is collapsed`
    ).toBeLessThan(100);
  });
});
