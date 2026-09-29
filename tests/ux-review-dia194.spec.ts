// QA regression tests for the DIA-194 UX review's P1 findings (DIA-198),
// commissioned by section 4's "QA Lead (regression tests)" list: U-01, U-02,
// U-03, U-05/U-06, U-07, U-08. Each assertion names the review's own
// acceptance criterion, not an implementation detail, so it stays valid
// whichever way the Web P1 PR (DIA-195) shapes the fix.
//
// Same convention as tests/hostile-f1-f4.spec.ts: every test here asserts
// the FIXED behaviour. A finding still open at HEAD carries `test.fail()`
// with a one-line pointer to the cause, so `npm run check` stays green until
// DIA-195 lands and then goes red — the signal for whoever's PR fixed it to
// delete that one line. A finding already true today (nothing to fix) is a
// plain passing test, locking in the correct case so a future regression
// cannot reopen it silently.
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import * as H from './interaction-helpers';
import { interceptFixtureScenes } from './scene-source';

const content = JSON.parse(readFileSync(new URL('../src/content/content.json', import.meta.url), 'utf-8')) as {
  bands: Array<{ id: number; year: string; people: string }>;
};

function bandInfo(id: number) {
  const info = content.bands.find((b) => b.id === id);
  if (!info) throw new Error(`no band ${id} in content.json`);
  return info;
}

/** Lands directly on a `?n=&it=` URL (D-043's read side) at 390x844 — a
 * genuine fresh load, not a slider drag from band 80. Same shape as
 * tests/landing.spec.ts's own `openAppAt`, generalised to the full query
 * string U-01 needs (`?n=1000` has no band id of its own). */
async function openAppAtQuery(page: Page, query: string): Promise<void> {
  await page.setViewportSize(H.PHONE);
  await interceptFixtureScenes(page);
  await page.goto(`/${query}`);
  await H.waitForFirstRender(page);
}

// ---------------------------------------------------------------------------
// U-01: the slider's initial value comes from the band id, never a number
// parsed out of the band's display copy (DIA-194 U-01).
// ---------------------------------------------------------------------------

test.describe('U-01: every ?n= band round-trips to the matching slider value and readout', () => {
  const NUMERIC_BANDS = [80, 150, 220, 360, 490, 610, 750] as const;

  for (const band of NUMERIC_BANDS) {
    test(`?n=${band} sets the slider to ${band} and the readout to band ${band}'s own year/people`, async ({
      page,
    }) => {
      await openAppAtQuery(page, `?n=${band}&it=built`);

      expect(await H.currentBand(page), 'the rendered scene').toBe(String(band));
      await expect(page.locator('#headcount-slider'), 'slider value').toHaveValue(String(band));
      const info = bandInfo(band);
      await expect(page.locator('.slider__readout')).toHaveText(`~${band} → ${info.year}, ${info.people}`);
      expect(await H.panelIsOpen(page), 'no stray Beyond panel on a plain numeric deep link').toBe(false);
    });
  }

  test('?n=1000 opens on the Beyond stop, not a numeric band', async ({ page }) => {
    await openAppAtQuery(page, '?n=1000&it=built');
    expect(await H.currentBand(page)).toBe('beyond');
    await expect(page.locator('#headcount-slider')).toHaveValue('1000');
    await expect(page.locator('.slider__readout')).toHaveText('~1000 → Beyond');
  });
});

// ---------------------------------------------------------------------------
// U-02: the slider's touch target is at least 44px tall, and a tap within
// that band moves the value (DIA-194 U-02).
// ---------------------------------------------------------------------------

test.describe('U-02: the slider has a 44px touch target at 390px', () => {
  test("the input's own hit area is at least 44 css px tall", async ({ page }) => {
    await H.openApp(page, { viewport: H.PHONE });
    const box = await page.locator('#headcount-slider').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test('a touch tap 20px above or below the track centre still moves the value', async ({ browser }) => {
    const context = await browser.newContext({ hasTouch: true, viewport: H.PHONE });
    const p = await context.newPage();
    try {
      await H.openApp(p);
      const slider = p.locator('#headcount-slider');
      const box = (await slider.boundingBox())!;
      const initialValue = await slider.inputValue();
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;

      for (const dy of [-20, 20]) {
        // Reset to the initial band before each tap so the two offsets are
        // independent trials, not a compounding drag.
        await slider.evaluate((el, v) => {
          (el as HTMLInputElement).value = v;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }, initialValue);
        await p.touchscreen.tap(cx, cy + dy);
        const after = await slider.inputValue();
        expect(after, `tap ${dy}px from the track centre should move the value`).not.toBe(initialValue);
      }
    } finally {
      await context.close();
    }
  });
});

// ---------------------------------------------------------------------------
// U-03: arrow keys step between bands, not one person at a time; Home/End
// are the two ends of the band list (DIA-194 U-03).
// ---------------------------------------------------------------------------

test.describe('U-03: the keyboard slider steps between bands', () => {
  test('7 ArrowRight presses from a fresh load visit every band, then Beyond, announcing each once', async ({
    page,
  }) => {
    await H.openApp(page); // fresh load: band 80, per src/main.ts's DEFAULT_INITIAL_STATE
    const slider = page.locator('#headcount-slider');
    const live = page.locator('.slider__live');
    await slider.focus();

    const stops = [150, 220, 360, 490, 610, 750, 'beyond'] as const;
    for (const expected of stops) {
      const prevAnnouncement = (await live.textContent()) ?? '';
      await page.keyboard.press('ArrowRight');
      await expect.poll(() => H.currentBand(page), { timeout: 2000 }).toBe(String(expected));
      const announcement = (await live.textContent()) ?? '';
      expect(announcement.length, `live region should announce band ${expected}`).toBeGreaterThan(0);
      expect(announcement, 'each crossing announces once, so the text must actually change').not.toBe(
        prevAnnouncement
      );
    }
  });

  test('Home returns to band 80 with its own readout, not the slider minimum', async ({ page }) => {
    await H.openApp(page);
    await H.setBand(page, 750);
    const slider = page.locator('#headcount-slider');
    await slider.focus();
    await page.keyboard.press('Home');
    await expect.poll(() => H.currentBand(page)).toBe('80');
    await expect(page.locator('.slider__readout')).toHaveText('~80 → 2018, ~80');
  });
});

// ---------------------------------------------------------------------------
// U-05 / U-06: the phone panel leaves the tapped hotspot visible, and traps
// focus while open (DIA-194 U-05, U-06).
// ---------------------------------------------------------------------------

test.describe('U-05: the phone sheet does not cover the hotspot it explains (390px)', () => {
  test("the tapped hotspot's box stays fully above the sheet's top edge", async ({ page }) => {
    await H.openApp(page, { viewport: H.PHONE });
    await H.setBand(page, 750); // review's own repro band — a dense, busy scene
    await H.ensureCloseup(page);
    const gagId = await H.openFirstHotspot(page);

    const hotspotBox = await page.locator(`.hotspot[data-gag-id="${gagId}"]`).boundingBox();
    const panelBox = await page.locator('.panel').boundingBox();
    expect(hotspotBox, 'hotspot must still have a box once the panel is open').not.toBeNull();
    expect(panelBox).not.toBeNull();
    expect(hotspotBox!.y + hotspotBox!.height, "hotspot's bottom edge vs. the sheet's top edge").toBeLessThanOrEqual(
      panelBox!.y
    );
  });

  test('the strip and title are visible without scrolling the sheet (keep, do not regress)', async ({ page }) => {
    // Already true today — the strip and title render first inside
    // `.panel__body`, at the sheet's own top, so they're on screen the
    // instant it opens. The review's actual U-05 defect is the scene being
    // covered (the test above); this one locks in the part that already works.
    await H.openApp(page, { viewport: H.PHONE });
    await H.ensureCloseup(page);
    await H.openFirstHotspot(page);

    const stripBox = await page.locator('.panel__strip').boundingBox();
    const titleBox = await page.locator('.panel__title').boundingBox();
    expect(stripBox).not.toBeNull();
    expect(titleBox).not.toBeNull();
    expect(stripBox!.y, 'strip top within the viewport').toBeGreaterThanOrEqual(0);
    expect(titleBox!.y + titleBox!.height, 'title bottom within the viewport').toBeLessThanOrEqual(H.PHONE.height);
  });
});

test.describe('U-06: the open panel traps Tab at 390px (DIA-194 U-06)', () => {
  test('10 Tab presses from Close never land outside the sheet', async ({ page }) => {
    await H.openApp(page, { viewport: H.PHONE });
    await H.ensureCloseup(page);
    await H.openFirstHotspot(page, 'keyboard'); // lands focus on the Close button

    for (let i = 1; i <= 10; i += 1) {
      await page.keyboard.press('Tab');
      const insidePanel = await page.evaluate(() => {
        const active = document.activeElement;
        const panel = document.querySelector('.panel');
        return !!panel && !!active && panel.contains(active);
      });
      expect(insidePanel, `Tab press ${i} should stay inside the open sheet`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// U-07: the collapsed punch list adds no scroll extent (DIA-194 U-07).
// ---------------------------------------------------------------------------

test.describe('U-07: the collapsed punch list adds no blank scroll (390px, band 750)', () => {
  test('document.documentElement.scrollHeight stays within 32px of the last visible content', async ({ page }) => {
    await H.openApp(page, { viewport: H.PHONE });
    await H.setBand(page, 750);
    expect(await H.punchListIsOpen(page), 'the list starts collapsed').toBe(false);

    const contactBox = await page.locator('.checklist > .contact-line').first().boundingBox();
    expect(contactBox, 'the persistent contact line under the scene').not.toBeNull();
    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(scrollHeight).toBeLessThanOrEqual(contactBox!.y + contactBox!.height + 32);
  });

  test('every checklist item stays in the accessibility tree while collapsed (keep, do not regress)', async ({
    page,
  }) => {
    await H.openApp(page, { viewport: H.PHONE });
    await H.setBand(page, 750);
    expect(await H.punchListIsOpen(page)).toBe(false);

    const items = page.locator('.checklist__item');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      await expect(items.nth(i)).toBeAttached();
    }
  });
});

// ---------------------------------------------------------------------------
// U-08: tapping outside an open panel never drops focus onto <body>
// (DIA-194 U-08).
// ---------------------------------------------------------------------------

test.describe('U-08: focus never lands on <body> around a panel interaction (390px)', () => {
  test('tapping outside an open panel keeps focus on something real', async ({ browser, browserName }) => {
    // Cause: there is no outside-tap handler at all yet (main.ts never
    // listens for a pointerdown outside `.panel`), so a tap that lands on
    // a non-focusable element blurs whatever had focus with nothing to take
    // its place — the review's own repro tapped (200,100), on Chromium.
    // WebKit does not refocus <body> the same way on a tap outside every
    // focusable element, so this is chromium-only until DIA-195 gives both
    // engines an explicit outside-tap behaviour.
    test.fail(browserName === 'chromium', 'DIA-194 U-08: tapping outside the panel drops focus to <body> on Chromium');

    const context = await browser.newContext({ hasTouch: true, viewport: H.PHONE });
    const p = await context.newPage();
    try {
      await H.openApp(p);
      await H.ensureCloseup(p);
      await H.openFirstHotspot(p, 'touch');
      expect(await H.panelIsOpen(p)).toBe(true);

      await p.touchscreen.tap(200, 100); // outside the sheet (sheet top is y>=253 at 390x844)

      const focus = await H.settledFocusInfo(p);
      expect(H.focusIsLost(focus), `focus ended up lost (tag=${focus.tag}) after tapping outside the panel`).toBe(
        false
      );
    } finally {
      await context.close();
    }
  });
});
