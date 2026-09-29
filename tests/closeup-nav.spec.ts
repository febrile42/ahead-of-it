// D-042a navigation coverage the DIA-46 review found missing from the rest
// of the suite (review items 1, 2, 4, 6 — 5 is in tests/hostile-f1-f4.spec.ts,
// 3 is in tests/cls.spec.ts).
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import * as H from './interaction-helpers';
import { interceptFixtureScenes, readIndex, readSceneFile } from './scene-source';

const BAND = 750;
const VIEWPORT = { width: 390, height: 900 };

function loadBandScene(band: number, state: 'built' | 'without') {
  const index = readIndex();
  const entry = index.bands[String(band)];
  return readSceneFile(entry[state]);
}

/** forEachCloseup's rewind-then-walk, but forcing every step through the
 * keyboard path (focus + Enter/Space) instead of the default mouse click —
 * item 1's "by click and by keyboard" half. */
async function walkByKeyboard(page: Page, key: 'Enter' | ' '): Promise<string[]> {
  if ((await H.currentView(page)) === (await H.currentRoomId(page))) {
    await H.toggleWholeFloor(page, 'keyboard');
  }
  while (!(await H.stepperInfo(page)).prevDisabled) {
    await H.step(page, -1, 'keyboard');
  }
  const ids: string[] = [];
  for (;;) {
    ids.push((await H.currentView(page)) ?? '');
    const button = page.locator('.scene-stepper__next');
    if ((await button.getAttribute('aria-disabled')) === 'true') break;
    const prev = await H.currentRenderToken(page);
    await button.focus();
    await page.keyboard.press(key);
    await H.waitForNextRender(page, prev);
  }
  return ids;
}

test.describe('close-up reachability (DIA-46 item 1)', () => {
  test('band 750: the stepper walk by click visits every close-up exactly once, in file order', async ({ page }) => {
    await H.openApp(page);
    await H.setBand(page, BAND);
    const scene = loadBandScene(BAND, 'built');
    const expected = scene.views.filter((v) => v.kind === 'closeup').map((v) => v.id);

    const visited = await H.walkCloseupIds(page);
    expect(visited).toEqual(expected);

    const stepper = await H.stepperInfo(page);
    expect(stepper.nextDisabled).toBe(true);
    // Never the native `disabled` attribute (main.ts keeps it aria-only so
    // focus is never dropped at an end) — Playwright's own isDisabled()
    // treats aria-disabled as disabled too, so the DOM attribute itself is
    // the only way to tell the two apart.
    expect(await page.locator('.scene-stepper__next').getAttribute('disabled')).toBeNull();
  });

  test('band 750: the stepper walk by keyboard (Enter) visits every close-up exactly once, in the same order', async ({
    page,
  }) => {
    await H.openApp(page);
    await H.setBand(page, BAND);
    const scene = loadBandScene(BAND, 'built');
    const expected = scene.views.filter((v) => v.kind === 'closeup').map((v) => v.id);

    const visited = await walkByKeyboard(page, 'Enter');
    expect(visited).toEqual(expected);
  });

  test('band 750: the stepper walk by keyboard (Space) visits every close-up exactly once, in the same order', async ({
    page,
  }) => {
    await H.openApp(page);
    await H.setBand(page, BAND);
    const scene = loadBandScene(BAND, 'built');
    const expected = scene.views.filter((v) => v.kind === 'closeup').map((v) => v.id);

    const visited = await walkByKeyboard(page, ' ');
    expect(visited).toEqual(expected);
  });

  test('band 750: every room tab lands on that room\'s own room view (D-051 item 2)', async ({ page }) => {
    // Amends D-042a's original navigation item 1 ("a tab lands on the
    // room's default close-up, so a tap never strands the visitor on a
    // picture with nothing to tap") — a room view is now full of "zoom in"
    // tiles to tap, so the reason no longer holds (D-051).
    await H.openApp(page);
    await H.setBand(page, BAND);
    const scene = loadBandScene(BAND, 'built');
    const rooms = scene.views.filter((v) => v.kind === 'room');

    for (const room of rooms) {
      await H.setRoom(page, room.id, 'mouse');
      expect(await H.currentView(page), `room tab ${room.id}`).toBe(room.id);
    }
  });
});

test.describe('zoom-in hit areas (DIA-46 item 4): unobscured, >= 44 css px, never overlapping', () => {
  test('band 750: every room\'s zoom-in buttons clear 44 css px and do not overlap', async ({ page }) => {
    await H.openApp(page);
    await H.setBand(page, BAND);
    const rooms = await H.roomIds(page);

    for (const roomId of rooms) {
      await H.setRoom(page, roomId, 'mouse');
      if ((await H.currentView(page)) !== roomId) {
        await H.toggleWholeFloor(page, 'mouse');
      }

      const buttons = page.locator('.hotspot--zoom');
      const count = await buttons.count();
      expect(count, `room ${roomId} has no zoom-in buttons`).toBeGreaterThan(0);

      const boxes = await buttons.evaluateAll((els) =>
        els.map((el) => {
          const r = (el as HTMLElement).getBoundingClientRect();
          const caption = el.querySelector('.hotspot__caption')?.getBoundingClientRect();
          return {
            viewId: (el as HTMLElement).dataset.viewId ?? '',
            x: r.x,
            y: r.y,
            w: r.width,
            h: r.height,
            captionX: caption ? caption.x + caption.width / 2 : r.x + r.width / 2,
            captionY: caption ? caption.y + caption.height / 2 : r.y + r.height / 2,
          };
        })
      );

      for (const box of boxes) {
        expect(box.w, `${roomId}/${box.viewId} width`).toBeGreaterThanOrEqual(44);
        expect(box.h, `${roomId}/${box.viewId} height`).toBeGreaterThanOrEqual(44);
      }

      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const a = boxes[i];
          const b = boxes[j];
          const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
          const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
          expect(
            overlapX > 0 && overlapY > 0,
            `${roomId}: ${a.viewId} and ${b.viewId} zoom-in buttons overlap`
          ).toBe(false);
        }
      }

      for (const box of boxes) {
        const hit = await page.evaluate(
          ({ x, y }) => {
            const el = document.elementFromPoint(x, y) as HTMLElement | null;
            return el?.closest('.hotspot--zoom')?.getAttribute('data-view-id') ?? null;
          },
          { x: box.captionX, y: box.captionY }
        );
        expect(hit, `${roomId}: caption of ${box.viewId} resolves to a different button`).toBe(box.viewId);
      }
    }
  });
});

test.describe('focus after each control (DIA-46 item 2): connected, visible, and the specific target the brief names', () => {
  test('stepper next/prev: focus stays on the control just pressed', async ({ page }) => {
    await H.openApp(page);
    await H.setBand(page, BAND);
    await H.step(page, 1, 'keyboard');
    let focus = await H.settledFocusInfo(page);
    expect(H.focusIsLost(focus), JSON.stringify(focus)).toBe(false);
    expect(focus.className).toContain('scene-stepper__next');

    await H.step(page, -1, 'keyboard');
    focus = await H.settledFocusInfo(page);
    expect(H.focusIsLost(focus), JSON.stringify(focus)).toBe(false);
    expect(focus.className).toContain('scene-stepper__prev');
  });

  test('room tab: focus stays on the tab just activated', async ({ page }) => {
    await H.openApp(page);
    await H.setBand(page, BAND);
    const rooms = await H.roomIds(page);
    const current = await H.currentRoomId(page);
    const target = rooms.find((r) => r !== current)!;
    await H.setRoom(page, target, 'keyboard');
    const focus = await H.settledFocusInfo(page);
    expect(H.focusIsLost(focus), JSON.stringify(focus)).toBe(false);
    expect(focus.viewId).toBe(target);
  });

  test('zoom-in: focus moves to the whole-floor control (main.ts pendingFocus kind "floor")', async ({ page }) => {
    await H.openApp(page);
    await H.setBand(page, BAND);
    if ((await H.currentView(page)) !== (await H.currentRoomId(page))) {
      await H.toggleWholeFloor(page, 'mouse');
    }
    const viewId = await page.locator('.hotspot--zoom').first().getAttribute('data-view-id');
    await H.zoomInto(page, viewId!, 'keyboard');
    const focus = await H.settledFocusInfo(page);
    expect(H.focusIsLost(focus), JSON.stringify(focus)).toBe(false);
    expect(focus.className).toContain('scene-stepper__floor');
  });

  test('whole floor (leaving a room): focus moves to the zoom-in button of the close-up just left', async ({ page }) => {
    await H.openApp(page);
    await H.setBand(page, BAND);
    // D-054/U-04: a band change now keeps view kind, so a fresh load's room
    // (D-051 item 1) survives it — get onto a close-up first, the state
    // this test (leaving one via "Whole floor") actually needs.
    await H.ensureCloseup(page);
    const leftId = await H.currentView(page);
    await H.toggleWholeFloor(page, 'keyboard');
    const focus = await H.settledFocusInfo(page);
    expect(H.focusIsLost(focus), JSON.stringify(focus)).toBe(false);
    expect(focus.className).toContain('hotspot--zoom');
    expect(focus.viewId).toBe(leftId);
  });

  test('toggle: focus stays on the toggle across the re-render it causes', async ({ page }) => {
    await H.openApp(page);
    await H.setBand(page, BAND);
    await H.setState(page, 'without', 'keyboard');
    const focus = await H.settledFocusInfo(page);
    expect(H.focusIsLost(focus), JSON.stringify(focus)).toBe(false);
    expect(focus.className).toContain('toggle__button');
  });
});

test.describe('390px screenshots at dpr 2 (DIA-46 item 6): default close-up and room view, both states, band 750', () => {
  for (const state of ['built', 'without'] as const) {
    test(`band 750 / ${state}: close-up and room view`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
      const page = await context.newPage();
      try {
        await interceptFixtureScenes(page);
        await page.goto('/');
        await H.waitForFirstRender(page);
        await H.setBand(page, BAND);
        await H.setState(page, state);
        await page.screenshot({ path: `tests/screenshots/band-750-${state}-closeup-dpr2.png` });

        await H.toggleWholeFloor(page, 'mouse');
        await page.screenshot({ path: `tests/screenshots/band-750-${state}-room-dpr2.png` });
      } finally {
        await context.close();
      }
    });
  }
});
