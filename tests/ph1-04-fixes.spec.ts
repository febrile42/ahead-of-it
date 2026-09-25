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
});
