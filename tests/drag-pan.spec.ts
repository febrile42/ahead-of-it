// DIA-122: drag-to-pan an overflowing view (R-20 "pan/zoom is allowed",
// D-042a "no swipe gesture" — panning never changes the current view).
//
// Reproducing genuine overflow needs a viewport/dpr combination where
// sizeAndPositionCanvas's chooseScale (src/scene/assembler.ts) is forced
// down to its scale=1 floor while a room's real native size (D-042a rooms
// vary; see public/sprites/scenes/*.json) is still bigger than what's
// available at that floor. `deviceScaleFactor: 1` plus a narrow viewport is
// the smallest real reproduction; a close-up's own 180x120 has the exact
// 3:2 aspect `.scene-wrap` itself is capped at (D-036), so it never forces
// this floor at any realistic width — only a room's own (less uniform)
// aspect ratio does. Two distinct rooms are used deliberately:
//   - band 750's default room overflows *both* axes at 320px (a >=44px
//     zoom-in chip near an edge can itself push scrollHeight past the
//     canvas's own box — see updatePanAffordance's doc comment in
//     src/main.ts), covering criteria 1, 2, 3, 6, 7.
//   - band 150's "street" room overflows *only* X at 300px, covering
//     criterion 4 (a vertical drag must still be free to scroll the page).
// Both geometries are asserted before use, so a future content regeneration
// that changes these rooms' sizes fails here loudly instead of passing
// this spec vacuously.
import { expect, test } from '@playwright/test';
import * as H from './interaction-helpers';

const BOTH_OVERFLOW_VIEWPORT = { width: 320, height: 700 };
const X_ONLY_VIEWPORT = { width: 300, height: 700 };
const FITS_VIEWPORT = H.PHONE;
const BAND = 750;

test.describe('drag-to-pan an overflowing view (DIA-122)', () => {
  // Real, low dpr is what actually produces the overflow this spec needs
  // (see header comment) — every test in this file wants that regardless
  // of which project (chromium / webkit-iphone) runs it.
  test.use({ deviceScaleFactor: 1 });

  test('mouse: press-hold-drag pans both axes, grab/grabbing cursor tracks it, and panning clamps to the image', async ({
    page,
  }) => {
    await H.openApp(page, { viewport: BOTH_OVERFLOW_VIEWPORT });
    await H.setBand(page, BAND);
    await H.toggleWholeFloor(page);

    const wrap = page.locator('#scene-wrap');
    const geo = await wrap.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    expect(geo.scrollWidth, 'expected this room to overflow X at this viewport').toBeGreaterThan(geo.clientWidth);
    expect(geo.scrollHeight, 'expected this room to overflow Y at this viewport').toBeGreaterThan(geo.clientHeight);

    // criterion 2: grab cursor while idle and pannable
    expect(await wrap.evaluate((el) => el.classList.contains('scene-wrap--pannable'))).toBe(true);
    expect(await wrap.evaluate((el) => getComputedStyle(el).cursor)).toBe('grab');

    const box = (await wrap.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx - 60, cy - 40, { steps: 10 });
    // criterion 2: grabbing cursor while the drag is in progress
    expect(await wrap.evaluate((el) => getComputedStyle(el).cursor)).toBe('grabbing');
    await page.mouse.up();

    // criterion 1: the drag actually panned both axes
    const after = await wrap.evaluate((el) => ({ scrollLeft: el.scrollLeft, scrollTop: el.scrollTop }));
    expect(after.scrollLeft).toBeGreaterThan(0);
    expect(after.scrollTop).toBeGreaterThan(0);
    // released back to a plain grab, not stuck grabbing
    expect(await wrap.evaluate((el) => getComputedStyle(el).cursor)).toBe('grab');

    // criterion 7: dragging well past the edge clamps to it rather than
    // overscrolling into empty space. DIA-165 (first attempt): derived a
    // single overshoot from the room's measured scroll range, then clamped
    // the *target coordinate* to stay inside the viewport so Chromium
    // wouldn't drop an out-of-viewport synthetic move. That target clamp is
    // exactly the bug: one gesture's delivered dx can never exceed
    // `viewport edge - cx`, a property of the viewport with no relationship
    // to the room's actual scroll range — on a room/viewport combination
    // where the range exceeds that reachable dx, the drag lands short and
    // the scroll position never reaches 0 (observed in CI: `Received: 21`,
    // i.e. still short of the clamp). Repeating the same viewport-safe drag
    // — each one a fresh gesture, so each delivers up to `viewport edge -
    // cx` more — removes the dependency on the room's size entirely:
    // however large the remaining distance is, enough repeats of a fixed,
    // safely-on-screen step closes it, and the loop's own bound still fails
    // the test loudly (rather than hanging) if it somehow can't.
    const viewport = page.viewportSize()!;
    const targetX = viewport.width - 10;
    const targetY = viewport.height - 10;
    let clamped = { scrollLeft: -1, scrollTop: -1 };
    for (let i = 0; i < 8; i++) {
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(targetX, targetY, { steps: 10 });
      await page.mouse.up();
      clamped = await wrap.evaluate((el) => ({ scrollLeft: el.scrollLeft, scrollTop: el.scrollTop }));
      if (clamped.scrollLeft === 0 && clamped.scrollTop === 0) break;
    }
    expect(clamped.scrollLeft).toBe(0);
    expect(clamped.scrollTop).toBe(0);
  });

  test('mouse: a tap with no movement still zooms in; a drag past the threshold does not, even starting on the chip', async ({
    page,
  }) => {
    await H.openApp(page, { viewport: BOTH_OVERFLOW_VIEWPORT });
    await H.setBand(page, BAND);
    await H.toggleWholeFloor(page);
    const roomId = await H.currentRoomId(page);

    const chip = page.locator('.hotspot--zoom').first();
    const box = (await chip.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    // criterion 3, first half: zero movement still opens/zooms
    const prevToken = await H.currentRenderToken(page);
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.up();
    await H.waitForNextRender(page, prevToken);
    expect(await H.currentView(page)).not.toBe(roomId);

    await H.toggleWholeFloor(page);
    const chip2 = page.locator('.hotspot--zoom').first();
    const box2 = (await chip2.boundingBox())!;
    const cx2 = box2.x + box2.width / 2;
    const cy2 = box2.y + box2.height / 2;

    // criterion 3, second half: a drag past the ~6px threshold that ends
    // on the same chip must pan, not zoom into it (D-042a: it must also
    // never change view via a "swipe")
    await page.mouse.move(cx2, cy2);
    await page.mouse.down();
    await page.mouse.move(cx2 - 30, cy2, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(150);
    expect(await H.currentView(page)).toBe(roomId);
  });

  test('mouse: a vertical drag on a view that only overflows X bows out, leaving the page free to scroll', async ({
    page,
  }) => {
    await H.openApp(page, { viewport: X_ONLY_VIEWPORT });
    await H.setBand(page, 150);
    await H.setRoom(page, 'street');
    if ((await H.currentView(page)) !== 'street') await H.toggleWholeFloor(page);

    const wrap = page.locator('#scene-wrap');
    const geo = await wrap.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      touchAction: getComputedStyle(el).touchAction,
    }));
    expect(geo.scrollWidth, 'expected this room to overflow X at this viewport').toBeGreaterThan(geo.clientWidth);
    expect(geo.scrollHeight, 'expected this room to fit Y at this viewport').toBeLessThanOrEqual(
      geo.clientHeight + 1
    );
    // touch-action hands the axis with no overflow back to the browser's
    // own default (D-042a's own rationale for setupScenePan's bow-out path)
    expect(geo.touchAction).toBe('pan-y');

    const box = (await wrap.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy - 40, { steps: 8 }); // purely vertical
    await page.mouse.up();
    // criterion 4: our own JS never touched scrollTop for this gesture —
    // a real device is free to scroll the page instead
    expect(await wrap.evaluate((el) => el.scrollTop)).toBe(0);
  });

  test('a view that fits gets no pan cursor and no pannable class', async ({ page }) => {
    await H.openApp(page, { viewport: FITS_VIEWPORT });
    await H.setBand(page, 80);
    const wrap = page.locator('#scene-wrap');
    expect(await wrap.evaluate((el) => el.classList.contains('scene-wrap--pannable'))).toBe(false);
    expect(await wrap.evaluate((el) => getComputedStyle(el).cursor)).not.toBe('grab');
  });

  test('keyboard: focusing an off-screen hotspot still scrolls it into view (unaffected by the pan controller)', async ({
    page,
  }) => {
    await H.openApp(page, { viewport: BOTH_OVERFLOW_VIEWPORT });
    await H.setBand(page, BAND);
    await H.toggleWholeFloor(page);

    // DIA-165: `.hotspot--zoom.last()` (DOM order, from placeChips's own
    // layout pass) was assumed to always be the chip this room's overflow
    // pushes past the fold — true only by coincidence of this room's exact
    // geometry. Measured directly, only *one* of its six chips actually
    // sits past `.scene-wrap`'s right edge, by single-digit px, and it is
    // not the last one in DOM order — a scale/placement rounding difference
    // as small as those few px (a different machine's Chromium, not a
    // different browser, per the develop-CI failures this replaced) moves
    // which chip that is, or removes the overflow for that chip entirely,
    // either of which makes `.last()` assert on a chip already fully
    // visible and pass vacuously, or land back here failing on a *different*
    // chip than the one it printed. Finding whichever chip the *current*
    // render actually pushed off-screen — rather than betting on DOM order —
    // keeps this test meaningful (and still failing loudly, per this file's
    // header, if a content regen ever makes none of them overflow) without
    // depending on exactly how many px of overflow this room/viewport/scale
    // combination happens to produce on whatever machine runs it.
    const wrapBox = (await page.locator('#scene-wrap').boundingBox())!;
    const chips = page.locator('.hotspot--zoom');
    const rects = await chips.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()));
    const offScreenIndex = rects.findIndex(
      (r) => r.left < wrapBox.x - 1 || r.right > wrapBox.x + wrapBox.width + 1
    );
    expect(offScreenIndex, 'expected at least one zoom chip to overflow .scene-wrap at this viewport').not.toBe(-1);

    const target = chips.nth(offScreenIndex);
    await target.focus();
    const inView = await target.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const wrapRect = document.querySelector('#scene-wrap')!.getBoundingClientRect();
      return r.left >= wrapRect.left - 1 && r.right <= wrapRect.right + 1;
    });
    expect(inView, 'focused hotspot should have scrolled into .scene-wrap').toBe(true);
  });

  test('touch: a one-finger drag pans, including one starting on a hotspot, without firing its click', async ({
    page,
  }) => {
    await H.openApp(page, { viewport: BOTH_OVERFLOW_VIEWPORT });
    await H.setBand(page, BAND);
    await H.toggleWholeFloor(page);
    const roomId = await H.currentRoomId(page);
    const wrap = page.locator('#scene-wrap');

    const chip = page.locator('.hotspot--zoom').first();
    const box = (await chip.boundingBox())!;
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    // criterion 1 (touch, starting on a hotspot) + criterion 3 (must not
    // also zoom in)
    await H.pointerDrag(page, { x: startX, y: startY }, { x: startX - 40, y: startY - 20 }, { pointerType: 'touch' });

    const after = await wrap.evaluate((el) => ({ scrollLeft: el.scrollLeft, scrollTop: el.scrollTop }));
    expect(after.scrollLeft).toBeGreaterThan(0);
    expect(after.scrollTop).toBeGreaterThan(0);
    expect(await H.currentView(page)).toBe(roomId);
  });
});
