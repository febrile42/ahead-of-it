import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { interceptFixtureScenes } from './scene-source';

const G2_1_THUMB_PATH = fileURLToPath(new URL('../public/sprites/thumbs/G2.1.png', import.meta.url));

// PH1-04 review acceptance: keyboard behaviour at the slider's last stop
// and the panel (B4), and a screenshot of the G2.1 panel showing the
// inline beat labels (B5) instead of the old "What it prevented" heading
// followed by a lowercase-led paragraph.

const VIEWPORT = { width: 390, height: 900 };

// PH1-09/D-035: G2.1's hotspot comes from an art-exported scene file
// (docs/product/SCENE-FORMAT.md). `interceptFixtureScenes`
// (tests/scene-source.ts) only serves the hand-written band-80 fixture
// when public/sprites/scenes/ doesn't exist yet — it never masks a real
// export.

test.describe('keyboard: slider End and panel Escape (B4)', () => {
  test('End keeps focus on the slider even though it auto-opens the Beyond panel', async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await page.waitForFunction(() => document.body.dataset.renderedToken !== undefined);

    const slider = page.locator('#headcount-slider');
    await slider.focus();
    await page.keyboard.press('End');
    await page.waitForTimeout(150);

    await expect(slider).toBeFocused();
    await expect(page.locator('.panel')).not.toBeHidden();
  });

  test('Escape closes the Beyond panel and returns focus to the slider', async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await page.waitForFunction(() => document.body.dataset.renderedToken !== undefined);

    const slider = page.locator('#headcount-slider');
    await slider.focus();
    await page.keyboard.press('End');
    await page.waitForTimeout(150);
    await expect(page.locator('.panel')).not.toBeHidden();

    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);

    await expect(page.locator('.panel')).toBeHidden();
    await expect(slider).toBeFocused();
  });

  test('Escape closes a hotspot-opened panel and returns focus to that hotspot', async ({ page }) => {
    await interceptFixtureScenes(page);
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await page.waitForFunction(() => document.body.dataset.renderedToken !== undefined);

    const hotspot = page.locator('[data-gag-id="G2.1"]');
    await hotspot.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    await expect(page.locator('.panel')).not.toBeHidden();

    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);

    await expect(page.locator('.panel')).toBeHidden();
    await expect(hotspot).toBeFocused();
  });
});

test.describe('panel copy (B5): inline beat labels', () => {
  test('screenshot band 80 / G2.1 panel', async ({ page }) => {
    await interceptFixtureScenes(page);
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await page.waitForFunction(() => document.body.dataset.renderedToken !== undefined);

    await page.locator('[data-gag-id="G2.1"]').click();
    await page.waitForTimeout(150);

    // "What it prevented" and "Worth it later" are inline <strong> labels
    // inside the paragraph, not stand-alone <h3>s (B5) — matching
    // PANELS.md / TONE.md's sample panel: "**What it prevented:** …".
    const preventedStrong = page.locator('.panel__beat--prevented strong');
    await expect(preventedStrong).toHaveText('What it prevented:');
    await expect(page.locator('.panel__beat--prevented h3')).toHaveCount(0);

    const worthStrong = page.locator('.panel__beat--worth strong');
    await expect(worthStrong).toHaveText('Worth it later:');
    await expect(page.locator('.panel__beat--worth h3')).toHaveCount(0);

    await page.screenshot({ path: 'tests/screenshots/panel-G2.1.png' });
  });
});

test.describe('panel thumbnail (fix round item 8 / review fix 5)', () => {
  test('a missing thumb hides the frame instead of showing a broken image', async ({ page }) => {
    // Made deterministic (fix round item 2 of the second pass): this
    // used to rely on public/sprites/thumbs/G2.1.png not existing in
    // this worktree, which broke the moment PH1-08b started shipping
    // real thumbs. A forced 404 exercises the same onerror path
    // regardless of whether the real file exists here or not.
    await page.route('**/sprites/thumbs/G2.1.png', (route) => route.fulfill({ status: 404, body: '' }));
    await interceptFixtureScenes(page);
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await page.waitForFunction(() => document.body.dataset.renderedToken !== undefined);

    await page.locator('[data-gag-id="G2.1"]').click();
    const thumb = page.locator('.panel__thumb');
    const img = thumb.locator('img');
    await expect(img).toHaveAttribute('src', '/sprites/thumbs/G2.1.png');

    // thumbImg.onerror (panel.ts) should hide the whole frame once the
    // forced 404 fires.
    await expect(thumb).toBeHidden();
    // `naturalWidth === 0` is the DOM's own signal that the <img> never
    // successfully decoded a bitmap — asserting on it, not just the CSS
    // hidden state, rules out "hidden but actually loaded fine".
    expect(await img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(0);
  });

  test('a real thumb is shown, not hidden', async ({ page }) => {
    // Only meaningful once PH1-08b has actually shipped this file — an
    // explicit, named skip otherwise (not a silent pass and not a
    // failure against a worktree that legitimately doesn't have it yet).
    test.skip(
      !existsSync(G2_1_THUMB_PATH),
      'public/sprites/thumbs/G2.1.png does not exist in this worktree yet (PH1-08b hasn\'t shipped it here)'
    );

    await interceptFixtureScenes(page);
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await page.waitForFunction(() => document.body.dataset.renderedToken !== undefined);

    await page.locator('[data-gag-id="G2.1"]').click();
    const thumb = page.locator('.panel__thumb');
    const img = thumb.locator('img');
    await expect(img).toHaveAttribute('src', '/sprites/thumbs/G2.1.png');

    await expect(thumb).toBeVisible();
    await expect(img).toBeVisible();
    // `toBeVisible()` only proves the <img> box is laid out; the bitmap can
    // still be decoding, so a single read of naturalWidth races the decode and
    // returns 0 under load. Poll — same assertion, no race. A thumb that
    // genuinely never loads still fails, once the poll times out.
    await expect
      .poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
  });

  // DIA-22 regression guard, and the suite's only slow-asset case.
  //
  // The test above only flakes under CPU load, which is why the race survived
  // this long: on an idle machine the decode usually wins and a synchronous
  // read of naturalWidth looks correct. What that test cannot show is that
  // the losing state is reachable at all. This one does, deterministically —
  // it holds the response open and asserts, in that window, the exact state
  // the flake reported: frame laid out and visible, naturalWidth still 0.
  // That is the proof the race is real and not a broken thumbnail.
  //
  // Do not read the final assertion as a trap for a reintroduced synchronous
  // read. Once the response is released the decode is fast enough that a
  // synchronous read there still passes about 4 times in 5 (measured), which
  // is precisely the intermittency this issue is about. The poll is correct
  // because the window above exists, not because a sleep makes it fail.
  //
  // It also pins real phone behaviour (R-20). panel.ts hides the frame only
  // from `onerror`, so while the thumbnail is still in flight the frame must
  // stay laid out: a visitor on a slow connection must not watch it collapse
  // and reflow the copy underneath it.
  test('a real thumb still appears when the PNG arrives slowly', async ({ page }) => {
    test.skip(
      !existsSync(G2_1_THUMB_PATH),
      'public/sprites/thumbs/G2.1.png does not exist in this worktree yet (PH1-08b hasn\'t shipped it here)'
    );

    // Held until this test says so, rather than for a fixed number of
    // milliseconds: a sleep would just be a second, slower race, and a
    // de-flaking test that is itself timing-dependent is worth nothing.
    let releaseThumb: () => void = () => {};
    const thumbHeld = new Promise<void>((resolve) => {
      releaseThumb = resolve;
    });
    await page.route('**/sprites/thumbs/G2.1.png', async (route) => {
      await thumbHeld;
      await route.continue();
    });
    await interceptFixtureScenes(page);
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await page.waitForFunction(() => document.body.dataset.renderedToken !== undefined);

    await page.locator('[data-gag-id="G2.1"]').click();
    const thumb = page.locator('.panel__thumb');
    const img = thumb.locator('img');

    // Mid-flight: the bitmap has not arrived, so the frame is reserved but
    // empty. Not hidden — `hidden` here would mean panel.ts had mistaken a
    // slow load for a missing file.
    await expect(thumb).toBeVisible();
    expect(await img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(0);

    // After it lands, the same frame shows a real decoded bitmap.
    releaseThumb();
    await expect
      .poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    await expect(thumb).toBeVisible();
  });
});
