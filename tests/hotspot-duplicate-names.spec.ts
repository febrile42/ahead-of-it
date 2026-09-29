// DIA-240 (PANELS-REVIEW.md PH3-06 finding #15, from DIA-232's read-in-place
// pass): a two-part gag renders one real <button> per part
// (src/ui/panel.ts's renderHotspots), and every part's aria-label is today
// just the gag's panel title (B3) with no per-part disambiguation — so a
// screen-reader user tabbing through a close-up that holds both parts hears
// the exact same name twice (or three times) in a row, with nothing to tell
// the focus stops apart. Both parts legitimately open the same panel
// (SCENE-FORMAT.md's two-part rule, D-036) — QA's ruling is that only the
// *name*, not the destination, needs to differ, so this suite fails on the
// name collision without asserting anything about where a click ends up.
//
// The case list below is read straight from the served scene export (not
// hard-coded gag ids) so it starts covering a two-part gag the moment its
// data adds or drops a part, with no change here — the same pattern
// hotspot-marker.spec.ts's findMarkerDemo() uses.
import { expect, test } from '@playwright/test';
import * as H from './interaction-helpers';
import { readBandSceneFile } from './scene-source';
import type { SceneHotspot, SceneView } from './scene-source';

interface DuplicateNameCase {
  band: Exclude<H.BandId, 'beyond'>;
  state: 'built' | 'without';
  view: SceneView;
  gagId: string;
  hotspots: SceneHotspot[];
}

/** Every (band, state, close-up) where two or more hotspots share a gagId —
 * a two-part (or three-part, see G5.1's `without` state) gag — and at least
 * one of them is real art, not just a `placeholder` box (SCENE-FORMAT.md
 * exempts an all-placeholder gag from the two-part rule entirely). */
function findDuplicateNameCases(): DuplicateNameCase[] {
  const cases: DuplicateNameCase[] = [];
  for (const band of H.numericTestableBands()) {
    for (const state of ['built', 'without'] as const) {
      const scene = readBandSceneFile(band, state);
      for (const view of scene?.views ?? []) {
        if (view.kind !== 'closeup') continue;
        const byGag = new Map<string, SceneHotspot[]>();
        for (const h of view.hotspots) {
          const group = byGag.get(h.gagId) ?? [];
          group.push(h);
          byGag.set(h.gagId, group);
        }
        for (const [gagId, hs] of byGag) {
          if (hs.length > 1 && hs.some((h) => !h.placeholder)) {
            cases.push({ band, state, view, gagId, hotspots: hs });
          }
        }
      }
    }
  }
  return cases;
}

const cases = findDuplicateNameCases();

test.describe('two-part gag hotspots: every focus stop has its own accessible name (DIA-240)', () => {
  // Guards the suite itself against a scene export that stops exercising
  // this shape (e.g. every two-part gag gets consolidated to one hotspot) —
  // at that point this file should be revisited, not silently pass empty.
  test('the current scene export still has at least one two-part gag to check', () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  for (const c of cases) {
    test(`${c.gagId} @ band ${c.band}/${c.state}, "${c.view.label}" (${c.hotspots.length} parts: ${c.hotspots
      .map((h) => h.part)
      .join(', ')})`, async ({ page }) => {
      await H.openApp(page);
      await H.setBand(page, c.band);
      await H.setState(page, c.state);
      await H.showGag(page, c.gagId);

      const buttons = page.locator(`.hotspot[data-gag-id="${c.gagId}"]`);
      await expect(buttons).toHaveCount(c.hotspots.length);

      const labels = await buttons.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));

      for (const label of labels) {
        expect(label, 'every hotspot must have a non-empty accessible name (R-24)').toBeTruthy();
      }
      // The actual defect: today every part of a two-part gag gets the
      // same aria-label (the gag's panel title verbatim), so this set
      // collapses to size 1 no matter how many parts there are.
      expect(
        new Set(labels).size,
        `expected ${labels.length} distinct accessible names for "${c.gagId}"'s parts, got: ${JSON.stringify(
          labels
        )}`
      ).toBe(labels.length);
    });
  }
});
