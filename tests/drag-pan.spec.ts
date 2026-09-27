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
    // overscrolling into empty space — 150px is more than enough headroom
    // over this room's ~28x7px max scroll range, but still lands on-screen
    // (unlike an extreme synthetic offset, which Chromium silently drops
    // mid-gesture instead of delivering the intermediate pointermoves).
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 150, cy + 150, { steps: 10 });
    await page.mouse.up();
    const clamped = await wrap.evaluate((el) => ({ scrollLeft: el.scrollLeft, scrollTop: el.scrollTop }));
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
    const last = page.locator('.hotspot--zoom').last();
    await last.focus();
    const inView = await last.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const wrap = document.querySelector('#scene-wrap')!.getBoundingClientRect();
      return r.left >= wrap.left - 1 && r.right <= wrap.right + 1;
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
