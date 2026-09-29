// D051-W acceptance (DIA-162, D-051): a cold visitor lands on the whole
// floor, under a two-line introduction, and can still reach a close-up two
// ways — a tile, or the stepper. Amends D-042 item 6 and D-042a nav item 1.
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import * as H from './interaction-helpers';
import { interceptFixtureScenes } from './scene-source';

// Not `import ... from '../src/content/content.json'` — Playwright's own
// Node ESM loader has no import attribute for a plain JSON import (same
// reason tests/scene.spec.ts and tests/closeup-nav.spec.ts read it this way).
const content = JSON.parse(readFileSync(new URL('../src/content/content.json', import.meta.url), 'utf-8')) as {
  ui: { intro: string; roomHint: string };
};

const PHONE = { width: 390, height: 844 };

/** Lands directly on `band`'s built state via D-043's URL read side
 * (`?n=&it=`) — a genuine fresh load, not a slider drag from band 80. */
async function openAppAt(page: Page, band: number): Promise<void> {
  await page.setViewportSize(PHONE);
  await interceptFixtureScenes(page); // no-op once the real schema-2 export exists (scene-source.ts)
  await page.goto(`/?n=${band}&it=built`);
  await H.waitForFirstRender(page);
}

test.describe('D-051: a fresh load opens on the whole floor, under an introduction', () => {
  for (const band of [80, 360, 750]) {
    test(`band ${band}: fresh load is the room view, "Whole floor" pressed, lede shown`, async ({ page }) => {
      await openAppAt(page, band);

      expect(await H.currentView(page), 'first paint should be a room, not a close-up').toBe(
        await H.currentRoomId(page)
      );
      expect((await H.stepperInfo(page)).wholeFloor).toBe(true);
      expect(await page.locator('#app-intro').textContent()).toBe(content.ui.intro);
    });
  }

  test('band 80: tapping a tile lands on that close-up', async ({ page }) => {
    await openAppAt(page, 80);
    const tile = page.locator('.hotspot--zoom').first();
    const viewId = await tile.getAttribute('data-view-id');
    const prev = await H.currentRenderToken(page);
    await tile.click();
    await H.waitForNextRender(page, prev);
    expect(await H.currentView(page)).toBe(viewId);
  });

  test('band 750: a room tab lands on that room\'s own room view', async ({ page }) => {
    await openAppAt(page, 750);
    const rooms = await H.roomIds(page);
    const current = await H.currentRoomId(page);
    const other = rooms.find((r) => r !== current);
    expect(other, 'band 750 fixture has only one room').toBeDefined();
    await H.setRoom(page, other!, 'mouse');
    expect(await H.currentView(page)).toBe(other);
    expect(await H.currentRoomId(page)).toBe(other);
  });

  test('DIA-210: #app-intro is prerendered static HTML — present with JavaScript disabled', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.setViewportSize(PHONE);
    await page.goto('/');
    expect(await page.locator('#app-intro').textContent()).toBe(content.ui.intro);
    await context.close();
  });

  test('the room hint replaces the stepper text in a room view, and the live region still announces a room switch', async ({
    page,
  }) => {
    await openAppAt(page, 750);
    expect((await H.stepperInfo(page)).label).toBe(content.ui.roomHint);

    // The visible stepper text changed (item 4), but announceRoom (used for
    // the live region on every view change, main.ts's announceView) is
    // untouched by this decision — only reachable once there is a second
    // room to switch to.
    const rooms = await H.roomIds(page);
    const current = await H.currentRoomId(page);
    const other = rooms.find((r) => r !== current);
    test.skip(other === undefined, 'band 750 fixture has only one room');
    await H.setRoom(page, other!, 'mouse');
    const live = (await page.locator('.slider__live').textContent()) ?? '';
    expect(live.length, 'the live region should announce the new room').toBeGreaterThan(0);
  });
});
