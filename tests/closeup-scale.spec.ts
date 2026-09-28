// D-042/D-042a acceptance: a 180x120 close-up — the whole reason for
// close-ups over a 360x240 room at phone width (SCENE-FORMAT "Views: rooms
// and close-ups") — must paint at >= 1.9 css px per art px, not the ~1.0 a
// room gets squeezed to at 360-390px. Below 1.9 a gag's own detail (the
// thing the tap is about) stops being legible, per DIA-39's sign-off.
//
// chooseScale (src/scene/assembler.ts) always returns an integer device-px
// scale, so "is an integer number of device pixels per art px" is asserted
// too, not just assumed from reading that function.
import { expect, test } from '@playwright/test';
import { interceptFixtureScenes } from './scene-source';

const CLOSEUP_NATIVE = { w: 180, h: 120 };
const MIN_CSS_PX_PER_ART_PX = 1.9;

const PROFILES = [
  { width: 360, deviceScaleFactor: 2 },
  { width: 390, deviceScaleFactor: 2 },
  { width: 360, deviceScaleFactor: 3 },
  { width: 390, deviceScaleFactor: 3 },
  // The tightest cases DIA-39 checked by hand: neither a round css width
  // nor a round dpr, so floor() has the least room to spare.
  { width: 375, deviceScaleFactor: 2 },
  { width: 360, deviceScaleFactor: 2.625 },
];

test.describe('close-up scale (D-042 acceptance): >= 1.9 css px per art px', () => {
  for (const profile of PROFILES) {
    test(`${profile.width} css width, dpr ${profile.deviceScaleFactor}: the default 180x120 close-up clears 1.9x`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width: profile.width, height: 900 },
        deviceScaleFactor: profile.deviceScaleFactor,
      });
      const page = await context.newPage();
      try {
        await interceptFixtureScenes(page);
        await page.goto('/');
        await page.waitForFunction(() => document.body.dataset.renderedToken !== undefined);

        // D-051: a fresh load now opens on the room, not the close-up —
        // "Whole floor" toggles into it (main.ts's toggleWholeFloor falls
        // back to the same close-up defaultView(scene) picks, the exact one
        // this test measures, when there is no prior close-up to return to).
        if (await page.evaluate(() => document.body.dataset.view === document.body.dataset.room)) {
          const prevToken = await page.evaluate(() => document.body.dataset.renderedToken);
          await page.locator('.scene-stepper__floor').click();
          await page.waitForFunction(
            (prev) => document.body.dataset.renderedToken !== prev,
            prevToken
          );
        }

        // Band 80's default view is a 180x120 close-up (tests/fixtures/
        // 80-built.json's "ground.2") — asserted so this test fails loudly,
        // not silently on the wrong view, the moment that stops being true.
        const canvas = await page.locator('#scene-canvas').evaluate((el) => ({
          width: (el as HTMLCanvasElement).width,
          height: (el as HTMLCanvasElement).height,
          cssWidth: el.getBoundingClientRect().width,
          cssHeight: el.getBoundingClientRect().height,
        }));

        expect(canvas.width % CLOSEUP_NATIVE.w, 'canvas backing width is not a whole multiple of the native width').toBe(0);
        expect(canvas.height % CLOSEUP_NATIVE.h, 'canvas backing height is not a whole multiple of the native height').toBe(0);
        const devicePxPerArtPx = canvas.width / CLOSEUP_NATIVE.w;
        expect(devicePxPerArtPx, 'height axis disagrees with width axis on the device-px scale').toBe(
          canvas.height / CLOSEUP_NATIVE.h
        );

        const cssPxPerArtPx = canvas.cssWidth / CLOSEUP_NATIVE.w;
        expect(
          cssPxPerArtPx,
          `${profile.width}x${profile.deviceScaleFactor}: ${cssPxPerArtPx.toFixed(3)} css px per art px`
        ).toBeGreaterThanOrEqual(MIN_CSS_PX_PER_ART_PX);
      } finally {
        await context.close();
      }
    });
  }
});
