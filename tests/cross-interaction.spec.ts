// T7 / DIA-8 Part 2 — the cross-interaction matrix.
//
// The pre-existing suite is good at one interaction at a time: scene.spec.ts
// walks band x state, ph1-04-fixes.spec.ts walks the keyboard paths, cls and
// pixel-parity walk layout. Nothing walked them *in combination*, and a
// visitor does nothing else — they drag, tap, flip, scroll and rotate in one
// unbroken sequence.
//
// Axes: band (8) x state (2) x view (1-4 per band) x panel open/closed x
// viewport x input method (mouse/touch/keyboard). The full cross product is
// several thousand cases and mostly redundant, so this covers **all pairs
// that can disagree** plus the **triples where a third axis changes the
// answer** — which in this app is any triple containing a re-render, because
// every re-render does `replaceChildren()` on the layer the other two axes
// live in.
//
// Everything in this file passes today. The combinations that do NOT pass
// are in tests/hostile-f1-f4.spec.ts as labelled expected-failures; the two
// files are complements, and a combination must never appear in both.
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import * as H from './interaction-helpers';

const STATES = ['built', 'without'] as const;

/** Fails the test on any console error. src/main.ts only logs one on a scene
 * fetch failure, which no test here provokes, so any error is a real one. */
function failOnConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(String(error)));
  return errors;
}

/** R-01b: reaching the 1,000+ stop auto-opens the Beyond panel. Any test that
 * wants a *hotspot* panel there has to dismiss it first, or it would assert
 * against content it did not open. */
async function dismissAutoBeyondPanel(page: Page) {
  if (await H.panelIsOpen(page)) await H.pressEscape(page);
}

// ---------------------------------------------------------------------------
// PAIR: band x state. Every combination, panel opened and self-identifying.
// ---------------------------------------------------------------------------

test.describe('band x state x panel — every panel identifies itself and returns focus', () => {
  for (const band of H.BAND_ORDER) {
    for (const state of STATES) {
      test(`band ${band} / ${state}: panel opens, identifies itself (R-04a) and Escape returns focus (B4)`, async ({
        page,
      }) => {
        const errors = failOnConsoleErrors(page);
        await H.openApp(page); // 390px
        await H.setBand(page, band);
        await H.setState(page, state);
        await dismissAutoBeyondPanel(page);

        // Opened *after* every re-render in this test, so the invoking
        // hotspot is a live node — this is the clean baseline that F1's
        // expected-failures are the re-render-corrupted version of.
        const hotspot = H.hotspots(page).first();
        await expect(hotspot).toBeVisible();
        const gagId = (await hotspot.getAttribute('data-gag-id')) ?? '';
        await H.openFirstHotspot(page, 'mouse');

        // R-04a: YEAR · ~HEADCOUNT · DESCRIPTOR, rendered from content data.
        // Asserted structurally — the values themselves live in
        // docs/content/ and are never restated here (nothing invented).
        const strip = await H.panelStrip(page);
        expect(strip.split('·').length, `strip "${strip}" is not a 3-part R-04a strip`).toBe(3);
        for (const part of strip.split('·')) expect(part.trim().length).toBeGreaterThan(0);
        expect((await H.panelTitle(page)).trim().length).toBeGreaterThan(0);

        // R-04: the panel describes a gag the picture is currently showing.
        const visible = await H.hotspots(page).evaluateAll((els) =>
          els.map((el) => (el as HTMLElement).dataset.gagId ?? '')
        );
        expect(visible).toContain(gagId);

        // R-04: the prevented-beat thumbnail is the without-state one in
        // BOTH toggle states.
        expect(await page.locator('.panel__thumb').getAttribute('data-state')).toBe('without');

        // B4: with no re-render in between, Escape must land back on the
        // invoker. (The same assertion after a re-render is F1.2/F3.2.)
        await H.pressEscape(page);
        const focus = await H.settledFocusInfo(page);
        expect(focus.gagId, `focus after Escape was ${JSON.stringify(focus)}`).toBe(gagId);

        expect(errors).toEqual([]);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// TRIPLE: band x view x panel. A panel opened in a view belongs to that view.
// ---------------------------------------------------------------------------

test.describe('band x view x panel — each view opens its own gags', () => {
  for (const band of [150, 220, 360, 490, 610, 750] as const) {
    test(`band ${band}: every view's hotspots open a panel for a gag in that view`, async ({ page }) => {
      const errors = failOnConsoleErrors(page);
      await H.openApp(page);
      await H.setBand(page, band);
      const views = await H.viewIds(page);
      expect(views.length, `band ${band} rendered no view tabs`).toBeGreaterThan(1);

      for (const viewId of views) {
        await H.setView(page, viewId, 'mouse');
        expect(await H.currentView(page)).toBe(viewId);

        const gagIds = await H.hotspots(page).evaluateAll((els) =>
          els.map((el) => (el as HTMLElement).dataset.gagId ?? '')
        );
        expect(gagIds.length, `view ${viewId} of band ${band} has no hotspots`).toBeGreaterThan(0);

        const opened = await H.openFirstHotspot(page, 'mouse');
        expect(gagIds, `panel for ${opened} opened from view ${viewId} which does not contain it`).toContain(
          opened
        );
        // D-036: exactly one tab is ever selected, and it is the rendered one.
        await expect(page.locator('.scene-views__button[aria-selected="true"]')).toHaveCount(1);
        expect(
          await page.locator('.scene-views__button[aria-selected="true"]').getAttribute('data-view-id')
        ).toBe(viewId);
        await H.pressEscape(page);
      }
      expect(errors).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------
// PAIR: view x state. Flipping the toggle must not silently move the visitor
// to a different floor — they flipped "without", not "take me elsewhere".
// ---------------------------------------------------------------------------

test.describe('view x state — the selected view survives the toggle', () => {
  for (const band of [220, 610, 750] as const) {
    test(`band ${band}: every view stays selected across built <-> without`, async ({ page }) => {
      const errors = failOnConsoleErrors(page);
      await H.openApp(page);
      await H.setBand(page, band);
      const views = await H.viewIds(page);

      for (const viewId of views) {
        await H.setView(page, viewId, 'mouse');
        await H.setState(page, 'without');
        expect(await H.currentView(page), `toggling to "without" moved the visitor off ${viewId}`).toBe(
          viewId
        );
        await H.setState(page, 'built');
        expect(await H.currentView(page), `toggling back to "built" moved the visitor off ${viewId}`).toBe(
          viewId
        );
      }
      expect(errors).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------
// TRIPLE: band x view x viewport. Rotation and tablet/desktop must not lose
// the visitor's place or shrink a tap target below R-20's floor.
// ---------------------------------------------------------------------------

test.describe('band x view x viewport — resizing keeps the place and the tap targets', () => {
  for (const band of [80, 360, 750] as const) {
    test(`band ${band}: view survives phone -> tablet -> desktop -> phone, hotspots stay >=44px (R-20)`, async ({
      page,
    }) => {
      const errors = failOnConsoleErrors(page);
      await H.openApp(page);
      await H.setBand(page, band);
      const views = await H.viewIds(page);
      // Deepest view rather than the default — the default is the one every
      // other spec already lands on.
      const target = views[views.length - 1];
      await H.setView(page, target, 'mouse');
      const countAtPhone = await H.hotspots(page).count();

      for (const viewport of [H.TABLET, H.DESKTOP, { width: 390, height: 500 }, H.PHONE]) {
        await H.resizeTo(page, viewport.width, viewport.height);
        expect(
          await H.currentView(page),
          `resize to ${viewport.width}x${viewport.height} moved the visitor off view ${target}`
        ).toBe(target);
        expect(
          await H.hotspots(page).count(),
          `hotspot count changed on resize to ${viewport.width}px`
        ).toBe(countAtPhone);

        // R-20: a tap target never falls below 44px at any width, including
        // the short-viewport case where chooseScale is height-bound.
        const spots = H.hotspots(page);
        for (let i = 0; i < (await spots.count()); i += 1) {
          const box = await spots.nth(i).boundingBox();
          expect(box, `hotspot ${i} had no box at ${viewport.width}px`).not.toBeNull();
          expect(box!.width, `hotspot ${i} at ${viewport.width}px`).toBeGreaterThanOrEqual(44);
          expect(box!.height, `hotspot ${i} at ${viewport.width}px`).toBeGreaterThanOrEqual(44);
        }
      }
      expect(errors).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------
// PAIR: input method x panel. Touch, mouse and keyboard reach the same panel.
// ---------------------------------------------------------------------------

test.describe('input method x panel — touch, mouse and keyboard agree', () => {
  for (const via of ['mouse', 'touch', 'keyboard'] as const) {
    test(`a hotspot opens the same panel via ${via} (R-20/R-24)`, async ({ page, browser }) => {
      // Touch needs a context that actually reports hasTouch, otherwise
      // locator.tap() throws rather than exercising the touch path.
      const context =
        via === 'touch' ? await browser.newContext({ hasTouch: true, viewport: H.PHONE }) : null;
      const target = context ? await context.newPage() : page;
      try {
        await H.openApp(target);
        await H.setBand(target, 220);
        const gagId = (await H.hotspots(target).first().getAttribute('data-gag-id')) ?? '';

        await H.openFirstHotspot(target, via);

        expect(await H.panelIsOpen(target)).toBe(true);
        expect((await H.panelTitle(target)).trim().length).toBeGreaterThan(0);
        // B3: the hotspot's accessible name is the gag's title, not its id —
        // asserted here against the panel the same hotspot opens, so the two
        // can never drift apart.
        const ariaLabel = await target
          .locator(`.hotspot[data-gag-id="${gagId}"]`)
          .first()
          .getAttribute('aria-label');
        expect(ariaLabel).toBe(await H.panelTitle(target));
        expect(ariaLabel).not.toBe(gagId);
      } finally {
        await context?.close();
      }
    });
  }
});

// ---------------------------------------------------------------------------
// The keyboard slider, end to end (R-24) — and the live region it announces
// through, which no existing spec reads.
// ---------------------------------------------------------------------------

test.describe('keyboard: the slider is operable and announces every band (R-24)', () => {
  test('Home, End and the arrow keys reach the ends and announce them', async ({ page }) => {
    await H.openApp(page);
    const slider = page.locator('#headcount-slider');
    const live = page.locator('.slider__live');
    await slider.focus();

    await page.keyboard.press('End');
    await expect.poll(() => H.currentBand(page)).toBe('beyond');
    await expect(slider).toBeFocused(); // B4 — the last stop must not steal focus
    // S3: a screen reader must hear the formatted readout, not the raw value.
    expect(await slider.getAttribute('aria-valuetext')).toBe(await page.locator('.slider__readout').textContent());
    expect(((await live.textContent()) ?? '').trim().length).toBeGreaterThan(0);

    await H.pressEscape(page); // R-01b's auto-opened panel
    await expect(slider).toBeFocused();

    await page.keyboard.press('Home');
    await expect.poll(() => H.currentBand(page)).toBe('80');
    expect(await slider.getAttribute('aria-valuetext')).toBe(await page.locator('.slider__readout').textContent());

    // A real keyboard walk to a middle band — one `input` event per press,
    // which is the storm a drag produces, and it must land on the right band.
    await H.setBandByKeyboard(page, 360);
    await expect.poll(() => H.currentBand(page)).toBe('360');
    await expect(slider).toBeFocused();
  });

  test('the whole page is reachable by Tab without entering a hidden panel', async ({ page }) => {
    await H.openApp(page);
    // The panel is `hidden` when closed, so nothing inside it may be a tab
    // stop — a keyboard visitor must never tab into an invisible dialog.
    const reached: string[] = [];
    for (let i = 0; i < 30; i += 1) {
      await page.keyboard.press('Tab');
      const info = await H.focusInfo(page);
      if (info.tag === 'body') break;
      expect(info.visible, `Tab reached a non-visible element: ${JSON.stringify(info)}`).toBe(true);
      reached.push(info.className || info.tag);
    }
    expect(reached.some((c) => c.includes('hotspot'))).toBe(true);
    expect(reached.some((c) => c.includes('panel__close'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Focus after a re-render — the ledger. These are the cells that DO hold
// focus; the cells that lose it are hostile-f1-f4.spec.ts's expected failures.
// Together the two files are a complete statement of where focus goes after
// every one of the four things that trigger render().
// ---------------------------------------------------------------------------

test.describe('focus after a re-render — the cells that hold', () => {
  test('dragging the slider keeps focus on the slider', async ({ page }) => {
    await H.openApp(page);
    await page.locator('#headcount-slider').focus();
    await H.setBandByKeyboard(page, 220);
    const focus = await H.settledFocusInfo(page);
    expect(focus.id).toBe('headcount-slider');
  });

  test('the toggle keeps focus on itself across the re-render it causes', async ({ page }) => {
    await H.openApp(page);
    await H.setState(page, 'without', 'keyboard');
    const focus = await H.settledFocusInfo(page);
    expect(focus.className).toContain('toggle__button');
  });

  test('arrow keys on the view tab row move focus to the newly selected tab', async ({ page }) => {
    // src/main.ts's roving-tabindex handler re-focuses the tab after the
    // render completes. This is the ONE re-render path that restores focus
    // correctly — F1.4 is the Enter-key path through the same row, which
    // does not.
    await H.openApp(page);
    await H.setBand(page, 220);
    const tabs = page.locator('.scene-views__button');
    const selected = page.locator('.scene-views__button[aria-selected="true"]');
    await selected.focus();
    const before = await H.currentView(page);

    await H.pressViewArrow(page, 'ArrowRight');

    const focus = await H.settledFocusInfo(page);
    expect(H.focusIsLost(focus), `focus after ArrowRight was ${JSON.stringify(focus)}`).toBe(false);
    expect(focus.viewId).toBe(await H.currentView(page));
    expect(await H.currentView(page)).not.toBe(before);
    // D-036's roving tabindex: exactly one tab is in the tab order.
    expect(await tabs.evaluateAll((els) => els.filter((e) => (e as HTMLElement).tabIndex === 0).length)).toBe(1);
  });

  test('arrow keys wrap around the tab row without losing focus', async ({ page }) => {
    await H.openApp(page);
    await H.setBand(page, 750);
    const views = await H.viewIds(page);
    await page.locator('.scene-views__button[aria-selected="true"]').focus();
    // One full lap — the wrap at each end is the off-by-one most likely to
    // land focus on nothing.
    for (let i = 0; i < views.length + 1; i += 1) {
      await H.pressViewArrow(page, 'ArrowRight');
      const focus = await H.settledFocusInfo(page);
      expect(H.focusIsLost(focus), `lost focus on lap step ${i}: ${JSON.stringify(focus)}`).toBe(false);
      expect(focus.viewId).toBe(await H.currentView(page));
    }
  });
});

// ---------------------------------------------------------------------------
// R-14: the text punch list is the canonical fallback and must stay in sync
// with the picture across both other axes.
// ---------------------------------------------------------------------------

test.describe('checklist x band x state — the accessible equivalent stays in sync (R-14)', () => {
  test('the checklist grows with the band and is identical in both states', async ({ page }) => {
    await H.openApp(page);
    const counts: number[] = [];
    for (const band of H.NUMERIC_BANDS) {
      await H.setBand(page, band);
      await H.setState(page, 'built');
      const built = await page.locator('.checklist__item').count();
      await H.setState(page, 'without');
      const without = await page.locator('.checklist__item').count();
      // R-14: generated from the same content as the scene, and the toggle
      // is not part of that content — the two states must list the same
      // receipts.
      expect(without, `band ${band} listed different receipts per state`).toBe(built);
      counts.push(built);
    }
    // Monotonic: a bigger company was already past everything a smaller one had.
    for (let i = 1; i < counts.length; i += 1) {
      expect(counts[i], `band ${H.NUMERIC_BANDS[i]} listed fewer receipts than the band below`).toBeGreaterThanOrEqual(
        counts[i - 1]
      );
    }
    expect(counts[counts.length - 1]).toBeGreaterThan(counts[0]);
  });

  test('R-14a: the 1,000+ stop adds the translation table, and leaving removes it', async ({ page }) => {
    await H.openApp(page);
    await expect(page.locator('.checklist__translation')).toHaveCount(0);

    await H.setBand(page, 'beyond');
    await expect(page.locator('.checklist__translation')).toHaveCount(1);
    expect(await page.locator('.checklist__translation tbody tr').count()).toBeGreaterThan(0);

    // Sliding back down must take it away again — the same "nothing cleans
    // up after the band changes" class as F5, checked here because the
    // checklist DOES clean up and that must not regress.
    await H.setBand(page, 220);
    await expect(page.locator('.checklist__translation')).toHaveCount(0);
    await expect(page.locator('.checklist__beyond')).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// Degenerate viewports and environments.
// ---------------------------------------------------------------------------

test.describe('degenerate viewports and environments', () => {
  for (const viewport of [
    { name: 'narrower than phone-first', width: 320, height: 480 },
    { name: '200% browser zoom at 390px', width: 195, height: 422 },
    { name: 'very short (landscape phone)', width: 390, height: 260 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1280, height: 900 },
  ]) {
    test(`${viewport.name} (${viewport.width}x${viewport.height}) renders and stays tappable`, async ({
      page,
    }) => {
      const errors = failOnConsoleErrors(page);
      await H.openApp(page, { viewport });
      await H.setBand(page, 220);

      expect(await H.canvasShowsMissingScene(page)).toBe(false);
      const spots = H.hotspots(page);
      expect(await spots.count()).toBeGreaterThan(0);
      const box = await spots.first().boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44); // R-20
      expect(box!.height).toBeGreaterThanOrEqual(44);

      // The page itself must never scroll sideways — .scene-wrap is the only
      // thing allowed to, and only when the view is wider than it.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow, `the document scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(1);

      // A panel must still be openable and closable at this size.
      await H.openFirstHotspot(page, 'mouse');
      await expect(page.locator('.panel__close')).toBeVisible();
      await H.pressEscape(page);
      expect(errors).toEqual([]);
    });
  }

  test('prefers-reduced-motion renders the same scene (R-24)', async ({ page }) => {
    // Nothing in src/style.css animates or transitions yet (animation is
    // Phase 2/3, R-13), so R-24's reduced-motion clause is satisfied
    // vacuously today. Asserted rather than assumed: this test fails the
    // moment Phase 2 adds an animation that is not gated on the query, which
    // is exactly when someone would otherwise forget.
    await H.openApp(page, { reducedMotion: 'reduce' });
    await H.setBand(page, 220);
    expect(await H.hotspots(page).count()).toBeGreaterThan(0);

    const animating = await page.evaluate(() =>
      document.getAnimations().filter((a) => a.playState === 'running').length
    );
    expect(animating, 'something is animating under prefers-reduced-motion').toBe(0);
  });

  test('a zero-height scene container does not break the page', async ({ page }) => {
    // sizeAndPositionCanvas falls back to `window.innerWidth` / 240 when
    // .scene-wrap measures zero. Forcing that (a collapsed container is what
    // a print stylesheet or an ancestor `display:none` produces) must not
    // throw, blank the checklist, or divide by zero.
    const errors = failOnConsoleErrors(page);
    await H.openApp(page);
    await page.addStyleTag({ content: '.scene-wrap { height: 0 !important; }' });
    await H.actAndWaitForRender(page, async () => {
      await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    });

    const canvas = await page.locator('#scene-canvas').evaluate((c) => {
      const cv = c as HTMLCanvasElement;
      return { w: cv.width, h: cv.height };
    });
    expect(canvas.w).toBeGreaterThan(0);
    expect(canvas.h).toBeGreaterThan(0);
    expect(await page.locator('.checklist__item').count()).toBeGreaterThan(0); // R-14 survives
    expect(errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The first five seconds — the only sequence that is certain to happen.
// ---------------------------------------------------------------------------

test.describe('the first five seconds, end to end', () => {
  test('land, drag, read the nudge, flip, tap a gag, close, keep reading (390px)', async ({
    browser,
  }) => {
    // Run on a touch context because this is the phone path, and every step
    // uses the input a phone actually has.
    const context = await browser.newContext({ hasTouch: true, viewport: H.PHONE });
    const page = await context.newPage();
    const errors = failOnConsoleErrors(page);
    try {
      await H.openApp(page);
      await expect(page.locator('h1')).toHaveText('Ahead of It');

      // R-06a: the nudge appears once, after the first slider move — not before.
      const nudge = page.locator('.toggle__nudge');
      expect(await nudge.evaluate((el) => el.classList.contains('toggle__nudge--visible'))).toBe(false);
      await H.setBand(page, 220);
      expect(await nudge.evaluate((el) => el.classList.contains('toggle__nudge--visible'))).toBe(true);

      // ...and goes away once they have done the thing it asked for (m2).
      await H.setState(page, 'without', 'touch');
      expect(await nudge.evaluate((el) => el.classList.contains('toggle__nudge--visible'))).toBe(false);

      const gagId = await H.openFirstHotspot(page, 'touch');
      expect((await H.panelTitle(page)).trim().length).toBeGreaterThan(0);
      await page.screenshot({ path: 'tests/screenshots/first-five-seconds-band-220-without.png' });

      // Closing by the button, which is what a thumb reaches for.
      await page.locator('.panel__close').tap();
      await page.locator('.panel').waitFor({ state: 'hidden' });
      const focus = await H.settledFocusInfo(page);
      expect(focus.gagId, 'the close button must return focus to the tapped hotspot (B4)').toBe(gagId);

      // ...and the punch list is still there to read (R-14).
      expect(await page.locator('.checklist__item').count()).toBeGreaterThan(0);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
});
