// DIA-257 (supersedes DIA-240/DIA-244's per-part accessible names): a
// two-part gag used to render one reticle per part, and every part opened
// the same panel — so G4.1's AUDITOR sign and its "$" bubble read as two
// separate hotspots with a duplicate description. Only the primary part
// now gets a button (src/main.ts's toSceneLayout); the other part stays
// drawn as scenery.
//
// The case list is read straight from the served scene export (not
// hard-coded gag ids) so it covers a two-part gag the moment its data adds
// a part, with no change here — the same pattern hotspot-marker.spec.ts's
// findMarkerDemo() uses.
import { expect, test } from '@playwright/test';
import * as H from './interaction-helpers';
import { readBandSceneFile } from './scene-source';
import type { SceneView } from './scene-source';

interface MultiPartCase {
  band: Exclude<H.BandId, 'beyond'>;
  state: 'built' | 'without';
  view: SceneView;
  gagId: string;
  parts: number;
  primaries: number;
}

/** Every (band, state, close-up) where two or more hotspots share a gagId
 * and at least one of them is real art, not just a `placeholder` box. */
function findMultiPartCases(): MultiPartCase[] {
  const cases: MultiPartCase[] = [];
  for (const band of H.numericTestableBands()) {
    for (const state of ['built', 'without'] as const) {
      const scene = readBandSceneFile(band, state);
      for (const view of scene?.views ?? []) {
        if (view.kind !== 'closeup') continue;
        const byGag = new Map<string, typeof view.hotspots>();
        for (const h of view.hotspots) byGag.set(h.gagId, [...(byGag.get(h.gagId) ?? []), h]);
        for (const [gagId, hs] of byGag) {
          if (hs.length > 1 && hs.some((h) => !h.placeholder)) {
            cases.push({ band, state, view, gagId, parts: hs.length, primaries: hs.filter((h) => h.primary).length });
          }
        }
      }
    }
  }
  return cases;
}

const cases = findMultiPartCases();

test.describe('two-part gag hotspots: one reticle per gag (DIA-257)', () => {
  // Guards the suite against a scene export that stops exercising this
  // shape — at that point this file should be revisited, not pass empty.
  test('the current scene export still has at least one multi-part gag in one close-up', () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  for (const c of cases) {
    test(`${c.gagId} @ band ${c.band}/${c.state}, "${c.view.label}" (${c.parts} parts)`, async ({ page }) => {
      await H.openApp(page);
      await H.setBand(page, c.band);
      await H.setState(page, c.state);
      await H.gotoCloseupView(page, c.view.id);

      await expect(page.locator(`.hotspot[data-gag-id="${c.gagId}"]`)).toHaveCount(c.primaries);
    });
  }
});
