import { expect, test } from '@playwright/test';

// PH1-04 review acceptance: keyboard behaviour at the slider's last stop
// and the panel (B4), and a screenshot of the G2.1 panel showing the
// inline beat labels (B5) instead of the old "What it prevented" heading
// followed by a lowercase-led paragraph.

const VIEWPORT = { width: 390, height: 900 };

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
