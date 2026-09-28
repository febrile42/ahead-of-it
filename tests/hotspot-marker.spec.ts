// DIA-134 (spec: DIA-124, tools/hotspot-mocks/SPEC.md on febrile42/hotspot-affordance):
// the corner-bracket marker is two `::before`/`::after` pseudo-elements on
// `.hotspot`, `pointer-events: none`, sized from `--obj-w`/`--obj-h` (set by
// src/ui/panel.ts's placeButton). This suite covers exactly the three
// acceptance checks the brief called out: the marker must not shrink the
// real 44px hit box (R-20), it must go still under reduced motion (R-24),
// and a quiet marker must keep full opacity, just shorter arms (R-03a).
// The last describe block covers D-047 (DIA-133): an exporter-set
// `marker` point re-centres the button and reticle without touching the
// rect that sizes the reticle and drives walker/moment exclusion.
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import * as H from './interaction-helpers';
import { readBandSceneFile } from './scene-source';
import type { SceneHotspot } from './scene-source';

/** Reads a computed style property off a real pseudo-element, not the
 * element itself — `getComputedStyle(el, '::after')` is how the DOM asks
 * for that, and pseudo-elements have no handle of their own to hand back. */
async function pseudoStyle(locator: Locator, pseudo: '::before' | '::after', prop: string): Promise<string> {
  return locator.evaluate(
    (el, { pseudo, prop }) => getComputedStyle(el, pseudo).getPropertyValue(prop),
    { pseudo, prop }
  );
}

async function firstRealHotspot(page: Page): Promise<Locator> {
  // `.hotspot--zoom` room chips match `.hotspot` too (they share the base
  // class for the 44px-button rules) but are excluded from the marker
  // entirely (`:not(.hotspot--zoom)` in src/style.css) — a close-up's gag
  // hotspots are what the marker actually draws on.
  const band = H.testableBands()[0];
  await H.setBand(page, band);
  await H.setState(page, 'built');
  // D-051: a fresh session's first render can land on the room's
  // whole-floor overview (openingView) rather than a close-up, and
  // `setBand`/`setState` are no-ops when the target is already current —
  // so a room view can still be on screen here. A room only has
  // `.hotspot--zoom` chips, never a real gag hotspot, so step into a
  // close-up first (same check `showGag`/`gotoCloseupView` use below).
  if ((await H.currentView(page)) === (await H.currentRoomId(page))) {
    await H.toggleWholeFloor(page);
  }
  return page.locator('.hotspot:not(.hotspot--zoom)').first();
}

test.describe('hotspot marker: hit area unchanged (R-20)', () => {
  test('the 44px button box is untouched by the marker pseudo-elements', async ({ page }) => {
    await H.openApp(page);
    const hotspot = await firstRealHotspot(page);

    const box = await hotspot.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);

    // The marker frame itself is clamped to 28-40px per the spec — smaller
    // than the 44px button whenever the object is small, proving the two
    // boxes are independent (the marker sizes off --obj-w/--obj-h, not off
    // MIN_TAP_PX) rather than the marker having grown to match the button.
    const afterWidth = Number((await pseudoStyle(hotspot, '::after', 'width')).replace('px', ''));
    const afterHeight = Number((await pseudoStyle(hotspot, '::after', 'height')).replace('px', ''));
    expect(afterWidth).toBeGreaterThanOrEqual(28);
    expect(afterWidth).toBeLessThanOrEqual(40);
    expect(afterHeight).toBeGreaterThanOrEqual(28);
    expect(afterHeight).toBeLessThanOrEqual(40);
  });
});

test.describe('hotspot marker: reduced motion (R-24)', () => {
  test('no-preference: the one-shot breathe animation is attached', async ({ page }) => {
    await H.openApp(page, { reducedMotion: 'no-preference' });
    const hotspot = await firstRealHotspot(page);

    expect(await pseudoStyle(hotspot, '::before', 'animation-name')).toBe('hs-breathe');
    expect(await pseudoStyle(hotspot, '::after', 'animation-name')).toBe('hs-breathe');
  });

  test('reduce: no animation on either pseudo-element, and none reach document.getAnimations()', async ({
    page,
  }) => {
    await H.openApp(page, { reducedMotion: 'reduce' });
    const hotspot = await firstRealHotspot(page);

    expect(await pseudoStyle(hotspot, '::before', 'animation-name')).toBe('none');
    expect(await pseudoStyle(hotspot, '::after', 'animation-name')).toBe('none');

    const running = await page.evaluate(
      () => document.getAnimations().filter((a) => a.playState === 'running').length
    );
    expect(running).toBe(0);
  });
});

test.describe('hotspot marker: quiet variant (R-03a)', () => {
  test('a quiet marker keeps full opacity — shorter arms, never faded', async ({ page }) => {
    await H.openApp(page);
    const hotspot = await firstRealHotspot(page);

    // Nothing in the app currently marks a hotspot quiet (src/scene/layout.ts:
    // emphasis is fixed at 'current' now that R-03a's de-emphasis moved into
    // the art). This asserts the CSS contract DIA-134 owns directly, so the
    // rule is already correct for whenever a caller adds the class back.
    const [buttonOpacity, beforeOpacity, afterOpacity, currentArm, quietArm] = await hotspot.evaluate((el) => {
      // --hs-arm is set directly on .hotspot/.hotspot--quiet (not just
      // inherited by the pseudo-elements), so reading it off the real
      // element is the direct check, with no pseudo-element/custom-property
      // interaction quirks to worry about across engines.
      const getArm = () => getComputedStyle(el).getPropertyValue('--hs-arm').trim();
      const before = getArm();
      el.classList.add('hotspot--quiet');
      const opacities = [
        getComputedStyle(el).opacity,
        getComputedStyle(el, '::before').opacity,
        getComputedStyle(el, '::after').opacity,
      ];
      const after = getArm();
      el.classList.remove('hotspot--quiet');
      return [...opacities, before, after];
    });

    expect(buttonOpacity).toBe('1');
    expect(beforeOpacity).toBe('1');
    expect(afterOpacity).toBe('1');
    expect(currentArm).toBe('10px');
    expect(quietArm).toBe('6px');
  });
});

/** A close-up view that has at least one hotspot with a `marker` and at
 * least one without — read straight from the currently-served scene data
 * (not hard-coded), so this suite starts asserting real marker geometry
 * the moment febrile42/hotspot-anchors' export lands on develop (D-047,
 * DIA-133), with no change here, the same way tests/scene-source.ts's own
 * `hasRealScenes()` toggle already works for this file's other suites. */
interface MarkerDemo {
  band: ReturnType<typeof H.numericTestableBands>[number];
  state: 'built' | 'without';
  roomId: string;
  viewId: string;
  withMarker: SceneHotspot & { marker: { x: number; y: number } };
  withoutMarker: SceneHotspot & { x: number; y: number; w: number; h: number };
}

function hotspotId(h: SceneHotspot): string {
  return h.part ? `${h.gagId}#${h.part}` : h.gagId;
}

function findMarkerDemo(): MarkerDemo | undefined {
  for (const band of H.numericTestableBands()) {
    for (const state of ['built', 'without'] as const) {
      const scene = readBandSceneFile(band, state);
      for (const view of scene?.views ?? []) {
        if (view.kind !== 'closeup' || !view.parent) continue;
        const withMarker = view.hotspots.find((h) => h.marker);
        const withoutMarker = view.hotspots.find(
          (h): h is SceneHotspot & { x: number; y: number; w: number; h: number } =>
            !h.marker && h.x !== undefined && h.y !== undefined && h.w !== undefined && h.h !== undefined
        );
        if (withMarker?.marker && withoutMarker) {
          return {
            band,
            state,
            roomId: view.parent,
            viewId: view.id,
            withMarker: { ...withMarker, marker: withMarker.marker },
            withoutMarker,
          };
        }
      }
    }
  }
  return undefined;
}

test.describe('hotspot marker: D-047 marker point overrides the rect centre', () => {
  const demo = findMarkerDemo();
  test.skip(!demo, 'no scene data with a D-047 marker yet (lands with febrile42/hotspot-anchors, DIA-133)');

  async function gotoDemoView(page: Page): Promise<void> {
    if (!demo) return;
    await H.openApp(page);
    await H.setBand(page, demo.band);
    await H.setState(page, demo.state);
    await H.setRoom(page, demo.roomId);
    await H.gotoCloseupView(page, demo.viewId);
  }

  test('a hotspot with a marker centres the button (and hit area) on it, scaled', async ({ page }) => {
    if (!demo) return;
    await gotoDemoView(page);

    const button = page.locator(`[data-hotspot-id="${hotspotId(demo.withMarker)}"]`);
    await expect(button).toHaveCount(1);

    // The dataset centre (buffer units) is what placeButton actually used —
    // confirms it read the marker, not the rect, before checking geometry.
    expect(Number(await button.getAttribute('data-cx'))).toBeCloseTo(demo.withMarker.marker.x, 5);
    expect(Number(await button.getAttribute('data-cy'))).toBeCloseTo(demo.withMarker.marker.y, 5);

    const box = await button.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);

    const canvasBox = await page.locator('#scene-canvas').boundingBox();
    const bufferW = Number(await page.locator('#hotspots-layer').getAttribute('data-buffer-w'));
    expect(canvasBox).not.toBeNull();
    const scale = canvasBox!.width / bufferW;

    const actualCx = box!.x - canvasBox!.x + box!.width / 2;
    const actualCy = box!.y - canvasBox!.y + box!.height / 2;
    expect(Math.abs(actualCx - demo.withMarker.marker.x * scale)).toBeLessThanOrEqual(1);
    expect(Math.abs(actualCy - demo.withMarker.marker.y * scale)).toBeLessThanOrEqual(1);
  });

  test('a hotspot without a marker still centres on its rect', async ({ page }) => {
    if (!demo) return;
    await gotoDemoView(page);

    const button = page.locator(`[data-hotspot-id="${hotspotId(demo.withoutMarker)}"]`);
    await expect(button).toHaveCount(1);

    const expectCx = demo.withoutMarker.x + demo.withoutMarker.w / 2;
    const expectCy = demo.withoutMarker.y + demo.withoutMarker.h / 2;
    expect(Number(await button.getAttribute('data-cx'))).toBeCloseTo(expectCx, 5);
    expect(Number(await button.getAttribute('data-cy'))).toBeCloseTo(expectCy, 5);

    const box = await button.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });
});
