// PH2-03 step 3 (DIA-113, docs/briefs/PH2-03-band-crossing.md): plays each
// band's `moment` block (docs/content/MOMENTS.md, D-045) with PH2-01's
// ticker (tests/motion-playback.spec.ts), under the brief's rules — built
// only, a genuine rising crossing, once per band per session, never on
// first load or `1,000+`, cut at once by any input, never under reduced
// motion. No band ships a caption (MOMENTS.md), so there is nothing to
// assert about reserved caption layout here.
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import * as H from './interaction-helpers';
import { interceptFixtureScenes } from './scene-source';

async function canvasSnapshot(page: Page): Promise<string> {
  return page.locator('#scene-canvas').evaluate((c) => (c as HTMLCanvasElement).toDataURL());
}

/** src/main.ts stamps this synchronously inside the render() commit that
 * starts or cancels a moment, and inside the tick() callback that ends one
 * naturally — never guessed at from the canvas alone. */
async function momentPlaying(page: Page): Promise<boolean> {
  return page.evaluate(() => document.body.dataset.momentPlaying === 'true');
}

/** Lands directly on `band`/`state` via D-043's URL read side (`?n=&it=`)
 * instead of dragging the slider there — the only way to get a genuine
 * "first load" (no prior committed band for the crossing check to compare
 * against) at a band other than 80, and the cleanest way to reset between
 * scenarios within one test without a slider drag that could itself count
 * as a crossing. */
async function openAppAt(page: Page, band: number | 'beyond', state: H.SceneState = 'built'): Promise<void> {
  await page.setViewportSize(H.PHONE);
  await interceptFixtureScenes(page); // no-op once the real schema-2 export exists (scene-source.ts)
  const n = band === 'beyond' ? 1000 : band;
  const it = state === 'built' ? 'built' : 'none';
  await page.goto(`/?n=${n}&it=${it}`);
  await H.waitForFirstRender(page);
}

/**
 * The rest-pose "golden" a moment hands off to at its end (SCENE-FORMAT
 * § Band-crossing moment: "the handover is to the view at t = 0, which is
 * the golden"). A fresh load under reduced motion paints exactly that frame
 * unconditionally (src/main.ts's `activeT` gate), on the very page/context
 * under test — so the viewport, device and DPR are identical to whatever
 * this test later crosses into, which a second browser context (a different
 * default DPR under the webkit-iphone project) would not guarantee. Leaves
 * the page loaded at `band`/'built' under reduced motion; the caller must
 * re-open the app for the actual scenario afterward.
 */
async function goldenSnapshot(page: Page, band: number | 'beyond'): Promise<string> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openAppAt(page, band, 'built');
  const snapshot = await canvasSnapshot(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  return snapshot;
}

test.describe('band-crossing moment: a genuine rising crossing in the built state', () => {
  test('80 -> 150 built: plays within 500ms of the commit, settles byte-identical to the golden by 2.5s, keeps focus', async ({
    page,
  }) => {
    // Captured first, on this same page/context (see goldenSnapshot's own
    // doc comment), then the page is reset to band 80 for the real scenario.
    const golden = await goldenSnapshot(page, 150);
    await openAppAt(page, 80, 'built');
    expect(await momentPlaying(page), 'first load is never a crossing').toBe(false);

    const atCommit = await canvasSnapshot(page);
    await H.setBand(page, 150); // a genuine rising crossing, built state
    expect(await momentPlaying(page), '150 has a moment (docs/content/MOMENTS.md)').toBe(true);

    // A hotspot focused once the crossing lands must keep focus for the
    // whole of the moment — the ticker paints the moment to the canvas only,
    // same DIA-13 invariant tests/motion-playback.spec.ts already proves for
    // ordinary motion.
    const hotspot = H.hotspots(page).first();
    const gagId = await hotspot.getAttribute('data-gag-id');
    await hotspot.focus();

    await page.waitForTimeout(500);
    expect(await momentPlaying(page), 'the moment (ms=2000) should still be playing at 500ms').toBe(true);
    const duringMoment = await canvasSnapshot(page);
    expect(duringMoment, 'the canvas should have changed within 500ms of the crossing committing').not.toBe(atCommit);
    const focusDuring = await H.focusInfo(page);
    expect(focusDuring.gagId, 'a hotspot focused during the moment must keep focus').toBe(gagId);

    await page.waitForFunction(() => document.body.dataset.momentPlaying === 'false', undefined, { timeout: 5000 });

    // The exact golden frame is a single tick wide (ambient motion in the
    // same view resumes the instant the moment hands off) — poll briefly
    // rather than sampling once, since a snapshot literally exactly at the
    // hand-off frame's tick is racing the ticker/CI, not a real 2.5s window
    // the picture is expected to sit still in.
    let settled = false;
    for (let i = 0; i < 15 && !settled; i += 1) {
      if ((await canvasSnapshot(page)) === golden) settled = true;
      else await page.waitForTimeout(20);
    }
    expect(settled, 'the canvas must settle byte-identical to the golden by 2.5s').toBe(true);
  });

  test('80 -> 150 built: the first painted frame is the moment, never the golden (regression, CEO review on PR #56)', async ({
    page,
  }) => {
    // The commit that starts a moment must paint the moment's own t = 0
    // frame directly. Painting the real (already-"after") view first and
    // only handing off to the moment on a later tick flashed the golden end
    // frame — sign lit, door open, whichever this band's moment ends on —
    // on screen for a rAF or two before the moment's first frame replaced
    // it. `H.setBand` only resolves once the crossing's own render() has
    // committed (via renderedToken), so there is no tick's gap between that
    // await returning and sampling the canvas here for an intermediate
    // golden frame to land in — a snapshot taken any later couldn't tell a
    // one-frame flash apart from the real thing.
    const golden = await goldenSnapshot(page, 150);
    await openAppAt(page, 80, 'built');
    await H.setBand(page, 150);
    expect(await momentPlaying(page)).toBe(true);

    const firstFrame = await canvasSnapshot(page);
    expect(firstFrame, 'the first frame after a crossing commits must not be the golden end frame').not.toBe(golden);
  });

  test('a hotspot focused before the crossing keeps focus (never stranded on <body>)', async ({ page }) => {
    // A genuine band change replaces the entire hotspot layer with a
    // different band's gags — the focused hotspot's own id can never exist
    // in the new band, so "keeps focus" means landing back on the slider
    // (src/main.ts's restoreFocus fallback, R-24), not literally the same
    // button.
    await openAppAt(page, 80, 'built');
    const hotspot = H.hotspots(page).first();
    await hotspot.focus();
    expect((await H.focusInfo(page)).gagId).not.toBeNull(); // precondition

    // 'mouse' sets the slider's value and dispatches `input` directly
    // (interaction-helpers.ts) without itself focusing anything — unlike
    // the 'keyboard' driver, which must focus the slider first to press
    // keys on it. Only this path leaves the hotspot as the actually-focused
    // element right up to the moment the band commits, which is what makes
    // this a real test of restoreFocus's fallback rather than a no-op.
    await H.setBand(page, 150, 'mouse');

    const focus = await H.settledFocusInfo(page);
    expect(H.focusIsLost(focus), `focus after the crossing was ${JSON.stringify(focus)}`).toBe(false);
  });

  test.describe('every other band with a moment plays once, ends within its ms budget', () => {
    const pairs: Array<{ from: H.BandId; to: H.BandId }> = [
      { from: 150, to: 220 },
      { from: 220, to: 490 },
      { from: 490, to: 610 },
      { from: 610, to: 750 },
    ];
    for (const { from, to } of pairs) {
      test(`${from} -> ${to} built`, async ({ page }) => {
        await openAppAt(page, from, 'built');
        expect(await momentPlaying(page)).toBe(false);
        await H.setBand(page, to);
        expect(await momentPlaying(page), `${to} should have a moment (docs/content/MOMENTS.md)`).toBe(true);
        await page.waitForFunction(() => document.body.dataset.momentPlaying === 'false', undefined, {
          timeout: 5000,
        });
      });
    }
  });
});

test.describe('band-crossing moment: every way the brief says nothing plays', () => {
  test('first load lands directly on a moment-bearing band: nothing plays', async ({ page }) => {
    await openAppAt(page, 150, 'built');
    expect(await momentPlaying(page)).toBe(false);
  });

  test('150 -> 80 (a down-move): nothing plays', async ({ page }) => {
    await openAppAt(page, 150, 'built'); // first load at 150 — no crossing yet
    await H.setBand(page, 80);
    expect(await momentPlaying(page)).toBe(false);
  });

  test('220 -> 150 (a down-move into a band that does have a moment): nothing plays', async ({ page }) => {
    await openAppAt(page, 220, 'built');
    await H.setBand(page, 150);
    expect(await momentPlaying(page), 'a down-move must never play, even into a moment-bearing band').toBe(false);
  });

  test('150 -> 220 while in the without state: nothing plays', async ({ page }) => {
    await openAppAt(page, 150, 'without');
    await H.setBand(page, 220);
    expect(await H.currentState(page)).toBe('without');
    expect(await momentPlaying(page)).toBe(false);
  });

  test('crossing into 1,000+ (beyond, an alias of 750): nothing plays', async ({ page }) => {
    await openAppAt(page, 610, 'built');
    await H.setBand(page, 'beyond');
    expect(await H.currentBand(page)).toBe('beyond');
    expect(await momentPlaying(page), "1,000+ is not a year band (D-029) and never crosses on its own").toBe(false);
  });

  test('220 -> 360 (a band with no moment at all): nothing plays', async ({ page }) => {
    await openAppAt(page, 220, 'built');
    await H.setBand(page, 360);
    expect(await momentPlaying(page), '360 has no moment block (dropped in DIA-101)').toBe(false);
  });

  test('crossing a band a second time: nothing plays', async ({ page }) => {
    await openAppAt(page, 80, 'built');
    await H.setBand(page, 150);
    expect(await momentPlaying(page), 'the first crossing into 150 should play').toBe(true);
    await page.waitForFunction(() => document.body.dataset.momentPlaying === 'false', undefined, { timeout: 5000 });

    await H.setBand(page, 80); // back down
    expect(await momentPlaying(page)).toBe(false);
    await H.setBand(page, 150); // up again — same band, same session
    expect(await momentPlaying(page), '150 already played once this session').toBe(false);
  });
});

test.describe('band-crossing moment: any input cuts it at once', () => {
  test('toggling mid-moment cuts to the without scene in one commit, without losing focus', async ({ page }) => {
    await openAppAt(page, 80, 'built');
    await H.setBand(page, 150);
    expect(await momentPlaying(page)).toBe(true);
    await page.waitForTimeout(300); // well inside the 2000ms moment

    await H.setState(page, 'without'); // the toggle — awaits the render it causes
    expect(await momentPlaying(page), 'toggling must cancel the moment at once').toBe(false);
    expect(await H.currentState(page)).toBe('without');

    // A mouse-driven toggle naturally focuses the toggle button itself
    // (tests/cross-interaction.spec.ts's own "the toggle keeps focus on
    // itself" case) — the invariant this moment feature must not break is
    // that focus lands *somewhere live*, not on <body>.
    const focusAfter = await H.focusInfo(page);
    expect(H.focusIsLost(focusAfter), `focus after the toggle was ${JSON.stringify(focusAfter)}`).toBe(false);

    // The cut is the *next* render's own paint (the without scene, no
    // moment) — waiting longer must not resurrect the cancelled moment.
    await page.waitForTimeout(400);
    expect(await momentPlaying(page)).toBe(false);
  });

  test('moving the slider mid-moment cancels it at once', async ({ page }) => {
    await openAppAt(page, 80, 'built');
    await H.setBand(page, 150);
    expect(await momentPlaying(page)).toBe(true);
    await page.waitForTimeout(300);

    await H.setBand(page, 220); // a further rising crossing while 150's moment is still playing
    // 220 is itself a fresh crossing and has its own moment (docs/content/MOMENTS.md) —
    // the assertion here is that 150's moment was cut, not merged or queued;
    // 220 starting its own is the expected, unrelated side effect.
    expect(await H.currentBand(page)).toBe('220');
  });

  test('opening a panel mid-moment cancels it at once', async ({ page }) => {
    await openAppAt(page, 80, 'built');
    await H.setBand(page, 150);
    expect(await momentPlaying(page)).toBe(true);
    await page.waitForTimeout(300);

    await H.openHotspot(page, 'G4.2');
    expect(await momentPlaying(page), 'opening a panel must cancel a playing moment at once').toBe(false);
    expect(await H.panelIsOpen(page)).toBe(true);
  });

  test('resizing mid-moment cuts it at once (regression, CEO review on PR #56)', async ({ page }) => {
    // A resize repaints the *real* current view at its own (post-resize)
    // size. Without cancelling the moment first, the ticker's next tick
    // resumed painting the moment's paint list — sized for the pre-resize
    // canvas — on top of the freshly resized one: a one-frame flash of the
    // wrong picture.
    await openAppAt(page, 80, 'built');
    await H.setBand(page, 150);
    expect(await momentPlaying(page)).toBe(true);
    await page.waitForTimeout(300);

    await H.resizeTo(page, H.PHONE.width, H.PHONE.height - 40); // the iOS address-bar collapse shape
    expect(await momentPlaying(page), 'a resize must cancel a playing moment at once').toBe(false);
  });
});

test.describe('band-crossing moment: reduced motion', () => {
  test('80 -> 150 built, reduced motion: nothing plays, canvas stays still', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openAppAt(page, 80, 'built');
    await H.setBand(page, 150);
    expect(await momentPlaying(page), 'the brief’s rule: reduced motion plays no moment').toBe(false);

    const first = await canvasSnapshot(page);
    await page.waitForTimeout(2500);
    expect(await momentPlaying(page)).toBe(false);
    expect(await canvasSnapshot(page), 'reduced motion: the canvas must not change on its own').toBe(first);
  });

  test('reduced motion flipping on mid-moment stops it at once (regression, CEO review on PR #56)', async ({
    page,
  }) => {
    // A runtime OS-preference flip (PH2-02, R-24) mid-moment must behave
    // exactly like a fresh load under reduced motion: no moment, and the
    // rest pose on screen. Without cancelActiveMoment() in this branch, the
    // ticker stopped but `activeMoment`/`data-moment-playing` never cleared
    // — silently leaving momentPlaying() reporting 'true' forever.
    await openAppAt(page, 80, 'built');
    await H.setBand(page, 150);
    expect(await momentPlaying(page)).toBe(true);
    await page.waitForTimeout(300);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.body.dataset.reducedMotion === 'true');
    expect(await momentPlaying(page), 'flipping reduced motion on must stop a playing moment at once').toBe(false);

    const first = await canvasSnapshot(page);
    await page.waitForTimeout(500);
    expect(await momentPlaying(page)).toBe(false);
    expect(await canvasSnapshot(page), 'reduced motion: the canvas must not change on its own').toBe(first);
  });
});
