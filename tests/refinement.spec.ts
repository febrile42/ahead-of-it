// PH3-03 step 2 (R-15, DIA-236): the "what do you already have?" refinement
// (design note `ahead-of-it-notes` docs/research/PH3-03-refinement-design.md,
// signed off DIA-229/DIA-238). A visitor who already has some of what a gag
// prevented can tick it, marking the checklist row and (where the gag has
// one) dimming its hotspot to a small ✓ badge. Not persisted anywhere (§5):
// no URL, no storage, no analytics.
//
// The real box→gag map (BANDS-AND-GAGS.md §"Refinement map (R-15)"): SSO →
// G1.2 (band 80), security lead → G4.1 (610), ERP → G4.3 (150), a real
// network → G2.2/G2.3/G5.1/G5.2 (first at 80), MDM → G3.2 (150). G1.2 and
// G2.2 are both in the Sales pit close-up at band 80 (src/ui/refine.test.ts
// pins the same map's per-band visibility from the pure-logic side).
import { expect, test } from '@playwright/test';
import * as H from './interaction-helpers';

const haveOption = (page: import('@playwright/test').Page, boxId: string) =>
  page.locator(`.checklist__have-option:has(input[value="${boxId}"])`);

const haveCheckbox = (page: import('@playwright/test').Page, boxId: string) =>
  page.locator(`.checklist__have-option input[value="${boxId}"]`);

async function tick(page: import('@playwright/test').Page, boxId: string): Promise<void> {
  await haveCheckbox(page, boxId).check();
}

async function untick(page: import('@playwright/test').Page, boxId: string): Promise<void> {
  await haveCheckbox(page, boxId).uncheck();
}

test.describe('placement (design note §2/§8 item 1)', () => {
  test('no checkbox is visible with the sheet closed; the fieldset is first under Download when open', async ({
    page,
  }) => {
    await H.openApp(page);
    expect(await H.punchListIsOpen(page)).toBe(false);
    // D-048 item 4: the sheet (and this fieldset inside it) is always
    // attached and in the accessibility tree, just clipped to nothing —
    // an sr-only clip pattern, not display:none (style.css
    // `.checklist__panel--collapsed`) — while collapsed. That clip is the
    // real "not sighted-visible" oracle here, same as punch-list.spec.ts's
    // own collapsed-sheet assertion; a plain visibility check doesn't
    // detect a 1x1px-clipped ancestor as hidden.
    await expect(page.locator('.checklist__panel')).toHaveClass(/checklist__panel--collapsed/);

    await H.openPunchList(page);
    const have = page.locator('.checklist__have');
    await expect(have).toBeVisible();
    const download = page.locator('.checklist__download');
    // The fieldset is the element immediately after Download, and nothing
    // (no toggle-adjacent block) sits between them.
    const order = await page.evaluate(() => {
      const panel = document.querySelector('.checklist__panel');
      return Array.from(panel?.children ?? []).map((el) => el.className);
    });
    const downloadIndex = order.findIndex((c) => c.includes('checklist__download'));
    const haveIndex = order.findIndex((c) => c.includes('checklist__have'));
    expect(haveIndex).toBe(downloadIndex + 1);
    await expect(download).toBeVisible();
  });
});

test.describe('band visibility (design note §3 band table)', () => {
  test('band 80: SSO and network only', async ({ page }) => {
    await H.openApp(page);
    await H.setBand(page, 80);
    await H.openPunchList(page);
    await expect(haveOption(page, 'sso')).toBeVisible();
    await expect(haveOption(page, 'network')).toBeVisible();
    await expect(haveOption(page, 'securityLead')).toBeHidden();
    await expect(haveOption(page, 'erp')).toBeHidden();
    await expect(haveOption(page, 'mdm')).toBeHidden();
  });

  test('band 150: + ERP and MDM, security lead still hidden', async ({ page }) => {
    await H.openApp(page);
    await H.setBand(page, 150);
    await H.openPunchList(page);
    for (const id of ['sso', 'erp', 'network', 'mdm']) {
      await expect(haveOption(page, id), id).toBeVisible();
    }
    await expect(haveOption(page, 'securityLead')).toBeHidden();
  });

  test('band 610: all five', async ({ page }) => {
    await H.openApp(page);
    await H.setBand(page, 610);
    await H.openPunchList(page);
    for (const id of ['sso', 'securityLead', 'erp', 'network', 'mdm']) {
      await expect(haveOption(page, id), id).toBeVisible();
    }
  });

  test('a hidden box keeps its tick: MDM ticked at 150, hidden at 80, shown ticked again at 150, and its row stays marked throughout', async ({
    page,
  }) => {
    await H.openApp(page);
    await H.setBand(page, 150);
    await H.openPunchList(page);
    await tick(page, 'mdm');
    await expect(haveCheckbox(page, 'mdm')).toBeChecked();
    const g32Row = page.locator('.checklist__item[data-gag-id="G3.2"]');
    await expect(g32Row).toHaveClass(/checklist__item--have/);

    await H.setBand(page, 80);
    await expect(haveOption(page, 'mdm')).toBeHidden();
    // G3.2 doesn't exist in the band-80 list at all (it's not yet in the
    // cumulative punch list there) — nothing to assert on its row.

    await H.setBand(page, 150);
    await expect(haveOption(page, 'mdm')).toBeVisible();
    await expect(haveCheckbox(page, 'mdm')).toBeChecked();
    await expect(g32Row).toHaveClass(/checklist__item--have/);
  });
});

test.describe("the brief's own case (step 2): tick SSO at band 80", () => {
  test('marks G1.2\'s row and count, badges its hotspot, leaves G2.2 alone — then unticking restores everything', async ({
    page,
  }) => {
    await H.openApp(page);
    await H.setBand(page, 80);
    await H.showGag(page, 'G1.2');

    const g12 = page.locator('.hotspot[data-gag-id="G1.2"]');
    const g22 = page.locator('.hotspot[data-gag-id="G2.2"]');
    await expect(g12).not.toHaveClass(/hotspot--have/);
    const g12LabelBefore = await g12.getAttribute('aria-label');

    await H.openPunchList(page);
    const countBefore = await H.punchListButtonCount(page); // 5 at band 80
    await tick(page, 'sso');

    const g12Row = page.locator('.checklist__item[data-gag-id="G1.2"]');
    await expect(g12Row).toHaveClass(/checklist__item--have/);
    await expect(g12Row.locator('.checklist__tag')).toBeVisible();
    await expect(page.locator('.punch-list-button__label')).toHaveText(`Punch list (${countBefore - 1} left)`);
    await expect(page.locator('.checklist__header-title')).toHaveText(`Punch list (${countBefore - 1} left)`);

    await H.closePunchList(page);
    await expect(g12).toHaveClass(/hotspot--have/);
    await expect(g22).not.toHaveClass(/hotspot--have/);
    const g12LabelMarked = await g12.getAttribute('aria-label');
    expect(g12LabelMarked).toBe(`${g12LabelBefore} — you're ahead of it`);
    // Still tappable, same hit area, panel still opens (§8 item 5).
    const box = await g12.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await g12.click();
    await H.waitForPanelOpen(page);
    expect(await H.panelTitle(page)).not.toBe('');
    await page.keyboard.press('Escape');

    // Same in the without state (§8 item 3's "This is the same in the
    // without state").
    await H.setState(page, 'without');
    await expect(g12).toHaveClass(/hotspot--have/);

    // Untick: everything reverts.
    await H.setState(page, 'built');
    await H.openPunchList(page);
    await untick(page, 'sso');
    await expect(g12Row).not.toHaveClass(/checklist__item--have/);
    await expect(g12Row.locator('.checklist__tag')).toBeHidden();
    await expect(page.locator('.punch-list-button__label')).toHaveText(`Punch list (${countBefore})`);
    await H.closePunchList(page);
    await expect(g12).not.toHaveClass(/hotspot--have/);
    expect(await g12.getAttribute('aria-label')).toBe(g12LabelBefore);
  });
});

test.describe('no persistence (§5, §8 item 6)', () => {
  test('ticking touches no URL, storage or reload state', async ({ page }) => {
    await H.openApp(page);
    await H.setBand(page, 80);
    await H.openPunchList(page);

    const before = await page.evaluate(() => ({
      search: location.search,
      localStorageLength: localStorage.length,
      sessionStorageLength: sessionStorage.length,
    }));

    await tick(page, 'sso');
    await tick(page, 'network');

    const after = await page.evaluate(() => ({
      search: location.search,
      localStorageLength: localStorage.length,
      sessionStorageLength: sessionStorage.length,
    }));
    expect(after).toEqual(before);

    await page.reload();
    await H.waitForFirstRender(page);
    await H.openPunchList(page);
    await expect(haveCheckbox(page, 'sso')).not.toBeChecked();
    await expect(haveCheckbox(page, 'network')).not.toBeChecked();
  });
});

test.describe('keyboard (§6, §8 item 8)', () => {
  test('Space toggles the focused box without moving focus; the live region announces once', async ({ page }) => {
    await H.openApp(page);
    await H.setBand(page, 80);
    await H.openPunchList(page);

    const sso = haveCheckbox(page, 'sso');
    await sso.focus();
    await expect(sso).toBeFocused();
    await page.keyboard.press('Space');
    await expect(sso).toBeChecked();
    await expect(sso).toBeFocused(); // ticking never moves focus

    const live = page.locator('.slider__live');
    await expect(live).toHaveText('4 left on the punch list');

    await page.keyboard.press('Space');
    await expect(sso).not.toBeChecked();
    await expect(sso).toBeFocused();
    await expect(live).toHaveText('5 left on the punch list');
  });

  test('the fieldset is a named group, reachable and exposed while the sheet is open', async ({ page }) => {
    await H.openApp(page);
    await H.openPunchList(page);
    await expect(page.getByRole('group', { name: 'What do you already have?' })).toBeVisible();
  });
});

test.describe('reduced motion (§6, §8 item 10)', () => {
  test('no animation runs on tick or untick', async ({ page }) => {
    await H.openApp(page, { reducedMotion: 'reduce' });
    await H.setBand(page, 80);
    await H.showGag(page, 'G1.2');
    await H.openPunchList(page);

    await tick(page, 'sso');
    expect(await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length)).toBe(
      0,
    );

    await untick(page, 'sso');
    expect(await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length)).toBe(
      0,
    );
  });
});

test.describe('nothing on the art (§8 item 4)', () => {
  test('no opacity/filter/mix-blend-mode is added on the scene wrap, canvas or any sprite', async ({ page }) => {
    await H.openApp(page);
    await H.setBand(page, 80);
    await H.showGag(page, 'G1.2');
    await H.openPunchList(page);
    await tick(page, 'sso');
    await H.closePunchList(page);

    const styles = await page.evaluate(() => {
      const els = [document.querySelector('.scene-wrap'), document.querySelector('#scene-canvas')];
      return els.map((el) => {
        if (!el) return null;
        const cs = getComputedStyle(el);
        return { opacity: cs.opacity, filter: cs.filter, mixBlendMode: cs.mixBlendMode };
      });
    });
    for (const s of styles) {
      expect(s).not.toBeNull();
      expect(s!.opacity).toBe('1');
      expect(s!.filter).toBe('none');
      expect(s!.mixBlendMode).toBe('normal');
    }
  });
});
