// DIA-131 (D-048, from the DIA-125 plan document): the punch list stops
// looking like page overflow under the scene. Sighted visitors open it on
// demand from a `Punch list (n)` button in the view-nav row; assistive
// tech and print always get the full list, whether the sheet is open or
// not. This file asserts exactly that contract — src/ui/checklist.ts and
// index.html/style.css are the implementation, tests/hostile-f1-f4.spec.ts
// and tests/cross-interaction.spec.ts already cover the pre-existing R-14
// content-parity assertions this doesn't repeat.
import { expect, test } from '@playwright/test';
import * as H from './interaction-helpers';

const PHONE = { width: 390, height: 844 };

test.describe('punch-list button: open/close (D-048)', () => {
  test('collapsed by default; the nav button opens it and the sheet\'s own header closes it (DIA-135)', async ({
    page,
  }) => {
    await H.openApp(page);

    // Item 1: nothing under the scene except the contact line — the sheet
    // itself must not be sighted-visible before it's opened.
    expect(await H.punchListIsOpen(page)).toBe(false);
    await expect(page.locator('#punch-list-button')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.checklist__panel')).toHaveClass(/checklist__panel--collapsed/);

    await H.openPunchList(page);
    expect(await H.punchListIsOpen(page)).toBe(true);
    await expect(page.locator('#punch-list-button')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.checklist__panel')).toHaveClass(/checklist__panel--open/);
    await expect(page.locator('.checklist__download')).toBeVisible();

    // DIA-135: closing goes through the sheet's own header close button now,
    // not a second tap on the nav button — see closePunchList's own comment
    // for why (DIA-132's fix stopped keeping the nav button reachable above
    // the open sheet on a phone).
    await H.closePunchList(page);
    expect(await H.punchListIsOpen(page)).toBe(false);
    await expect(page.locator('#punch-list-button')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.checklist__panel')).toHaveClass(/checklist__panel--collapsed/);
  });

  test('the button is >=44px and outside the canvas', async ({ page }) => {
    await H.openApp(page);
    const box = await page.locator('#punch-list-button').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);

    const canvasBox = await page.locator('#scene-canvas').boundingBox();
    expect(canvasBox).not.toBeNull();
    // The button sits in its own row above the canvas, never overlapping it.
    expect(box!.y + box!.height).toBeLessThanOrEqual(canvasBox!.y);
  });
});

test.describe('punch-list button label: n per band (D-048 item 2)', () => {
  test('n matches the rendered list and grows monotonically with the band, in both states', async ({ page }) => {
    await H.openApp(page);
    const counts: number[] = [];
    for (const band of H.NUMERIC_BANDS) {
      await H.setBand(page, band);
      for (const state of ['built', 'without'] as const) {
        await H.setState(page, state);
        const buttonN = await H.punchListButtonCount(page);
        const itemCount = await page.locator('.checklist__item').count();
        expect(buttonN, `band ${band}/${state} button label`).toBe(itemCount);
      }
      counts.push(await H.punchListButtonCount(page));
    }
    for (let i = 1; i < counts.length; i += 1) {
      expect(counts[i], `band ${H.NUMERIC_BANDS[i]} listed fewer than the band below`).toBeGreaterThanOrEqual(
        counts[i - 1]
      );
    }

    await H.setBand(page, 'beyond');
    expect(await H.punchListButtonCount(page)).toBe(counts[counts.length - 1]);
  });

  test('the label updates immediately on slider input, without opening the sheet', async ({ page }) => {
    await H.openApp(page);
    const at80 = await H.punchListButtonCount(page);
    await H.setBand(page, 750);
    const at750 = await H.punchListButtonCount(page);
    expect(at750).toBeGreaterThan(at80);
    expect(await H.punchListIsOpen(page)).toBe(false); // the count updates without ever opening it
  });
});

test.describe('tab order: collapsed vs open (D-048 item 4)', () => {
  test('collapsed: the sheet\'s own links/buttons are out of the tab order', async ({ page }) => {
    await H.openApp(page);
    expect(await H.punchListIsOpen(page)).toBe(false);
    await expect(page.locator('.checklist__download')).toHaveAttribute('tabindex', '-1');
    const sheetLinks = page.locator('.checklist__panel .contact-line a');
    for (const link of await sheetLinks.all()) {
      await expect(link).toHaveAttribute('tabindex', '-1');
    }

    // The persistent, always-visible contact line (item 1) is never
    // suppressed — it's outside .checklist__panel entirely.
    const persistentLinks = page.locator('.checklist > .contact-line a');
    for (const link of await persistentLinks.all()) {
      await expect(link).not.toHaveAttribute('tabindex', '-1');
    }
  });

  test('open: the sheet\'s links/buttons rejoin the tab order', async ({ page }) => {
    await H.openApp(page);
    await H.openPunchList(page);
    await expect(page.locator('.checklist__download')).not.toHaveAttribute('tabindex', '-1');
    const sheetLinks = page.locator('.checklist__panel .contact-line a');
    for (const link of await sheetLinks.all()) {
      await expect(link).not.toHaveAttribute('tabindex', '-1');
    }
  });

  test('a band change while collapsed keeps newly-rendered rows out of the tab order', async ({ page }) => {
    await H.openApp(page);
    await H.setBand(page, 750); // more rows than band 80 had
    await expect(page.locator('.checklist__download')).toHaveAttribute('tabindex', '-1');
  });
});

test.describe('accessibility tree: the list is always present, even collapsed (D-048 item 4)', () => {
  test('the checklist region is reachable by accessible role+name while collapsed', async ({ page }) => {
    await H.openApp(page);
    expect(await H.punchListIsOpen(page)).toBe(false);
    // getByRole resolves against the same accessibility tree a screen
    // reader reads — a match here proves the collapsed sheet (a labelled
    // <section>, implicit role "region") is really in that tree, not just
    // in the DOM (R-24).
    const region = page.getByRole('region', { name: 'Checklist: what was already in place' });
    await expect(region).toBeAttached();
    expect(await region.locator('.checklist__item').count()).toBeGreaterThan(0);
  });

  test('the sheet\'s rows are still in the DOM (not display:none, not a closed <details>) while collapsed', async ({
    page,
  }) => {
    await H.openApp(page);
    expect(await H.punchListIsOpen(page)).toBe(false);
    expect(await page.locator('.checklist__item').count()).toBeGreaterThan(0);
    // Never display:none (that removes the a11y-tree presence checked
    // above) and never a native <details> (a closed one drops from the
    // tree too).
    await expect(page.locator('.checklist__panel')).not.toBeHidden();
    expect(await page.locator('details.checklist__panel').count()).toBe(0);
  });
});

test.describe('print (D-048 item 5): the full list prints whether open or closed', () => {
  test('collapsed: print media still shows every row', async ({ page }) => {
    await H.openApp(page);
    await H.setBand(page, 750);
    expect(await H.punchListIsOpen(page)).toBe(false);
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.checklist__item').first()).toBeVisible();
    expect(await page.locator('.checklist__item').count()).toBeGreaterThan(0);
    await page.emulateMedia({ media: 'screen' });
  });

  test('open: print media still shows every row (not the fixed-position sheet chrome)', async ({ page }) => {
    await H.openApp(page);
    await H.setBand(page, 750);
    await H.openPunchList(page);
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.checklist__item').first()).toBeVisible();
    expect(
      await page.locator('.checklist__panel').evaluate((el) => getComputedStyle(el).position)
    ).toBe('static');
    await page.emulateMedia({ media: 'screen' });
  });
});

test.describe('DIA-132 QA: the trigger button must not obscure the open sheet (phone width)', () => {
  test('at 390px, tapping the visual centre of Download reaches Download, not the still-visible trigger', async ({
    page,
  }) => {
    await H.openApp(page, { viewport: PHONE });
    await H.openPunchList(page);

    // Item 3 of D-048 puts Download "at top" of the open sheet. DIA-132
    // failed this on 58e809f because the trigger button was kept above the
    // sheet (z-index 21 > the sheet's 20) so it stayed reachable to close
    // the sheet — but on a phone the sheet is a bottom sheet and the
    // trigger sits in normal flow just above the canvas, which on a 390px
    // screen lands inside the sheet's own opened bounds, so the
    // higher-z-index trigger intercepted taps meant for Download. DIA-135's
    // fix gives the open sheet its own header close button instead, so the
    // trigger no longer needs to paint above it at all.
    const triggerBox = await page.locator('#punch-list-button').boundingBox();
    const downloadBox = await page.locator('.checklist__download').boundingBox();
    expect(triggerBox).not.toBeNull();
    expect(downloadBox).not.toBeNull();

    const dlCenter = {
      x: downloadBox!.x + downloadBox!.width / 2,
      y: downloadBox!.y + downloadBox!.height / 2,
    };
    const elementAtCenter = await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.closest('.checklist__download, #punch-list-button')?.id ||
        document.elementFromPoint(x, y)?.closest('.checklist__download, #punch-list-button')?.className ||
        null,
      dlCenter
    );
    expect(
      elementAtCenter,
      `expected Download's own visual centre (${dlCenter.x}, ${dlCenter.y}) to hit Download, not the trigger button — got "${elementAtCenter}". Boxes: trigger=${JSON.stringify(triggerBox)} download=${JSON.stringify(downloadBox)}`
    ).toContain('checklist__download');
  });
});

test.describe('DIA-135: the open sheet gets its own header and close control', () => {
  test('the header shows the same Punch list (n) title as the trigger, and Download is the first action under it', async ({
    page,
  }) => {
    await H.openApp(page, { viewport: PHONE });
    await H.openPunchList(page);

    const triggerLabel = (await page.locator('.punch-list-button__label').textContent()) ?? '';
    await expect(page.locator('.checklist__header-title')).toHaveText(triggerLabel);

    // Requirement 4: Download stays the first action under the header —
    // i.e. the header's own close button precedes it, but nothing else
    // (no re-inserted heading, no other control) sits between them.
    const firstActionAfterHeader = await page
      .locator('.checklist__panel')
      .evaluate((panel) => panel.querySelector('.checklist__header')?.nextElementSibling?.className ?? null);
    expect(firstActionAfterHeader).toBe('checklist__download');
  });

  test('the header close button closes the sheet and returns focus to the trigger', async ({ page }) => {
    await H.openApp(page, { viewport: PHONE });
    await H.openPunchList(page);

    await page.locator('.checklist__close').click();

    expect(await H.punchListIsOpen(page)).toBe(false);
    await expect(page.locator('.checklist__panel')).toHaveClass(/checklist__panel--collapsed/);
    const focus = await H.settledFocusInfo(page);
    expect(focus.id).toBe('punch-list-button');
  });

  test('Escape closes the sheet and returns focus to the trigger', async ({ page }) => {
    await H.openApp(page, { viewport: PHONE });
    await H.openPunchList(page);

    await H.pressEscape(page);

    expect(await H.punchListIsOpen(page)).toBe(false);
    await expect(page.locator('.checklist__panel')).toHaveClass(/checklist__panel--collapsed/);
    const focus = await H.settledFocusInfo(page);
    expect(focus.id).toBe('punch-list-button');
  });

  test('the header close button is a real >=44px button, same look as the tap panel\'s own close', async ({
    page,
  }) => {
    await H.openApp(page, { viewport: PHONE });
    await H.openPunchList(page);

    const closeButton = page.locator('.checklist__close');
    await expect(closeButton).toHaveText('Close');
    await expect(closeButton).toHaveAttribute('aria-label', /close/i);
    const box = await closeButton.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test('at >=768px (desktop drawer), the trigger stays clear of the open sheet and can still toggle it closed', async ({
    page,
  }) => {
    await H.openApp(page, { viewport: { width: 1024, height: 800 } });
    await H.openPunchList(page);

    // The drawer sits on the right, the trigger stays in the view-nav row on
    // the left — dropping the trigger's old z-index override (DIA-135) must
    // not have introduced an overlap where none existed before.
    const triggerBox = await page.locator('#punch-list-button').boundingBox();
    const panelBox = await page.locator('.checklist__panel').boundingBox();
    expect(triggerBox).not.toBeNull();
    expect(panelBox).not.toBeNull();
    expect(triggerBox!.x + triggerBox!.width).toBeLessThanOrEqual(panelBox!.x);

    // Requirement 2: "The trigger keeps aria-expanded and still toggles
    // when it's reachable (desktop drawer)."
    await page.locator('#punch-list-button').click();
    expect(await H.punchListIsOpen(page)).toBe(false);
    await expect(page.locator('.checklist__panel')).toHaveClass(/checklist__panel--collapsed/);
  });

  // DIA-136 QA re-review: the brief's tab order requirement is close ->
  // Download -> rows' links -> contact. Gag rows carry no links of their
  // own (only a lazy-loaded <img>), so with the sheet's real DOM the
  // reachable sequence is close -> Download -> the sheet's own contact
  // line (LinkedIn, then the email link) — this walks it for real with the
  // keyboard rather than only asserting tabindex attributes (which the
  // 'tab order: collapsed vs open' describe block above already covers).
  test('open: real Tab/Shift+Tab order is close, Download, then the sheet\'s contact links', async ({ page }) => {
    await H.openApp(page, { viewport: PHONE });
    await H.openPunchList(page);

    // Opening the sheet focuses Download directly (setOpen's own
    // printButton.focus()) — Shift+Tab once must land back on Close, i.e.
    // Close precedes Download in the tab order.
    let focus = await H.settledFocusInfo(page);
    expect(focus.className).toBe('checklist__download');

    await page.keyboard.press('Shift+Tab');
    focus = await H.settledFocusInfo(page);
    expect(focus.className).toBe('checklist__close');

    // Forward from Close: Download, then straight to the sheet's own
    // contact line's two <a> links (LinkedIn, then "Talk to Josh") — no
    // gag-row control sits in between, because rows have none.
    await page.keyboard.press('Tab');
    focus = await H.settledFocusInfo(page);
    expect(focus.tag).toBe('button');
    expect(focus.className).toBe('checklist__download');

    await page.keyboard.press('Tab');
    focus = await H.settledFocusInfo(page);
    expect(focus.tag).toBe('a');

    await page.keyboard.press('Tab');
    focus = await H.settledFocusInfo(page);
    expect(focus.tag).toBe('a');
  });
});

test.describe('thumbnails stay deferred until opened (DIA-205)', () => {
  // The collapsed sheet hides via the standard sr-only pattern (width/
  // height:1px + overflow:hidden, style.css's `.checklist__panel--
  // collapsed`). Chromium can't tell how far an image inside a zero-size
  // clipped ancestor is from the viewport, so it loads it immediately
  // rather than honouring `loading="lazy"` — that fired every row's
  // thumbnail fetch on every page load (up to 16 at band 750), competing
  // with the fetches that gate the intro paragraph's own paint (the LCP
  // element) for bandwidth and decode time, and pushed LCP over budget on
  // CI. checklist.ts now assigns each `<img>` its real `src` explicitly
  // (loadPendingThumbs) instead of trusting that heuristic.
  test('band 750 requests no /sprites/thumbs/ before the punch list is opened', async ({ page }) => {
    const thumbRequests: string[] = [];
    page.on('request', (req) => {
      const path = new URL(req.url()).pathname;
      if (path.startsWith('/sprites/thumbs/')) thumbRequests.push(path);
    });

    await H.openApp(page, { viewport: PHONE });
    await H.setBand(page, 750);
    // `waitForLoadState('networkidle')` resolves immediately once the page
    // has already reached that state, so it doesn't actually wait out any
    // fetches the band change might still be about to fire — settle two
    // animation frames instead, which is when the eager-load bug's fetches
    // landed pre-fix.
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );

    expect(thumbRequests, `unexpected eager thumbnail fetches: ${thumbRequests.join(', ')}`).toEqual([]);

    // Opening the sheet is what should actually load them — proves this
    // isn't accidentally suppressing every thumbnail fetch outright. Poll
    // rather than trust `networkidle`/a fixed wait: the lazy fetches fire a
    // frame or so after `src` is assigned, not synchronously with the click.
    await H.openPunchList(page);
    await expect.poll(() => thumbRequests.length).toBeGreaterThan(0);
  });
});

test.describe('screenshots (acceptance: collapsed, and open at 150 and 1,000+)', () => {
  test('collapsed at 390px', async ({ page }) => {
    await H.openApp(page, { viewport: PHONE });
    await page.screenshot({ path: 'tests/screenshots/punch-list-collapsed.png' });
  });

  test('open at band 150', async ({ page }) => {
    await H.openApp(page, { viewport: PHONE });
    await H.setBand(page, 150);
    await H.openPunchList(page);
    await page.screenshot({ path: 'tests/screenshots/punch-list-open-150.png' });
  });

  test('open at 1,000+', async ({ page }) => {
    await H.openApp(page, { viewport: PHONE });
    await H.setBand(page, 'beyond');
    await H.pressEscape(page); // R-01b auto-opens the Beyond gag panel; close it for a clean shot
    await H.openPunchList(page);
    await expect(page.locator('.checklist__translation')).toBeVisible(); // R-14a
    await page.screenshot({ path: 'tests/screenshots/punch-list-open-beyond.png' });
  });
});
