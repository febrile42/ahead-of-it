// PH1-09 contract tests over the art pipeline's exported scene files
// (docs/product/SCENE-FORMAT.md, D-035/D-036). This is the rewrite the
// PH1-04 review called for (§b): layout.test.ts's coverage/cumulative/
// two-part/beyond-equals-750 assertions, reaimed at the scene-file
// contract instead of the deleted computeLayout().
//
// PH1-08b (the art-side export) hasn't landed yet, so `public/sprites/
// scenes/*.json` doesn't exist. Two describe blocks below run the exact
// same validators: one over the real directory (skipped, explicitly and
// visibly — not a silent pass — until files exist there), one over the
// hand-written fixture in tests/fixtures/ so the contract itself is
// exercised now. Once PH1-08b lands, the first block starts running with
// no changes needed here.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import contentJson from '../content/content.json';

interface SceneHotspot {
  gagId: string;
  part?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  primary: boolean;
  placeholder?: boolean;
}

interface SceneEntry {
  sprite: string;
  frame: string;
  x: number;
  y: number;
  depth: number;
  gagId?: string;
  part?: string;
  alpha?: number;
}

interface SceneView {
  id: string;
  label: string;
  size: { w: number; h: number };
  focus: { x: number; y: number; w: number; h: number };
  default?: boolean;
  entries: SceneEntry[];
  hotspots: SceneHotspot[];
}

interface SceneFile {
  schema: number;
  band: number;
  state: 'built' | 'without';
  views: SceneView[];
}

interface SceneIndex {
  schema: number;
  bands: Record<string, { built: string; without: string }>;
  beyond: string;
  thumbs: Record<string, string>;
}

type BandId = 80 | 150 | 220 | 360 | 490 | 610 | 750 | 'beyond';
const NUMERIC_BANDS: readonly Exclude<BandId, 'beyond'>[] = [80, 150, 220, 360, 490, 610, 750];
const VIEW_ID_ORDER = ['ground', 'floor-2', 'floor-3', 'floor-4', 'floor-5', 'floor-6', 'top', 'street'];
// SCENE-FORMAT's "Two-part gags" list — which *state(s)* each one is
// actually two-part in. Per docs/content/BANDS-AND-GAGS.md G5.1: the
// built state is one picture (a solid link, both workers at desks — no
// second location), so it's only two-part `without`. The other three
// are two-part in both states.
const TWO_PART_GAGS: Record<string, 'both' | 'built' | 'without'> = {
  'G3.2': 'both',
  'G4.1': 'both',
  'G5.1': 'without',
  'G2.4': 'both',
};

// D-036 rule 4's table (docs/product/04-DECISIONS.md): each gag's *home*
// view — the one its single primary hotspot must sit in. G3.2 and G2.4
// are two-part (their non-primary "part" can sit in a different view —
// G3.2's box on the CEO's desk is `ground`, its trolley-by-the-closet
// primary is also `ground`; G2.4's screen is `floor-2` alongside its
// conference-room primary) but the *primary* is always the home view.
const HOME_VIEW: Record<string, string> = {
  'G1.1': 'ground',
  'G1.2': 'ground',
  'G2.1': 'ground',
  'G2.2': 'ground',
  'G2.3': 'ground',
  'G3.1': 'ground',
  'G3.2': 'ground',
  'G4.1': 'ground',
  'G5.3': 'ground',
  'G5.4': 'ground',
  'G6.1': 'ground',
  'G7.1': 'ground',
  'G2.4': 'floor-2',
  'G3.3': 'floor-2',
  'G4.2': 'floor-2',
  'G4.3': 'floor-2',
  'G6.2': 'floor-2',
  'G7.3': 'floor-2',
  'G7.3a': 'floor-2',
  'G7.4': 'floor-2',
  'G7.2': 'top',
  'G5.1': 'street',
  'G5.2': 'street',
  'G5.6': 'street',
  'G6.3': 'street',
  'G6.4': 'street',
};

const content = contentJson as unknown as {
  gags: Array<{ id: string; band: BandId }>;
};

const manifest = JSON.parse(
  readFileSync(new URL('../../public/sprites/manifest.json', import.meta.url), 'utf-8')
) as Record<string, { frames: Record<string, unknown> }>;

/** Every gag with band <= `tier` (R-03a: cumulative composition), 'beyond' pinned to 750 (N-02). */
function gagsAtOrBefore(tier: number): string[] {
  return content.gags.filter((g) => (g.band === 'beyond' ? 750 : g.band) <= tier).map((g) => g.id);
}

function tierOf(band: BandId): number {
  return band === 'beyond' ? 750 : band;
}


/** All the format-level checks a single scene file must pass, independent of which band it's for. */
function checkSceneFileShape(scene: SceneFile, label: string) {
  expect(scene.schema, `${label}: schema`).toBe(1);
  expect(NUMERIC_BANDS as readonly number[], `${label}: band`).toContain(scene.band);
  expect(['built', 'without'], `${label}: state`).toContain(scene.state);
  expect(scene.views.length, `${label}: at least one view`).toBeGreaterThan(0);

  const ids = scene.views.map((v) => v.id);
  expect(ids, `${label}: view ids unique`).toEqual([...new Set(ids)]);
  expect(ids, `${label}: 'ground' view always present`).toContain('ground');
  for (const id of ids) {
    expect(VIEW_ID_ORDER, `${label}: view id "${id}" is a known D-036 id`).toContain(id);
  }
  // D-036 rule 1: known ids appear in a fixed order (not necessarily every id present).
  const orderedPresent = VIEW_ID_ORDER.filter((id) => ids.includes(id));
  expect(ids, `${label}: view order matches D-036`).toEqual(orderedPresent);

  const defaults = scene.views.filter((v) => v.default);
  expect(defaults.length, `${label}: exactly one default view`).toBe(1);

  // D-036 rule 4 is "each gag has exactly one primary hotspot, in its
  // home view" — counted per *file*, across every view, not per view
  // (fix round: real band >= 150 legitimately has G3.2's primary in
  // `ground` and its non-primary "box" part in `floor-2` — the earlier
  // per-view "exactly one" check flagged floor-2 as missing a primary
  // it was never supposed to have). Collected here across the view loop
  // below, checked once after it against HOME_VIEW.
  const primariesByGag = new Map<string, Array<{ viewId: string; hotspot: SceneHotspot }>>();

  for (const view of scene.views) {
    const vlabel = `${label} view "${view.id}"`;
    // A missing/empty label is an export bug, not something the painter
    // should paper over — src/main.ts's view switcher renders it
    // verbatim (`${view.label} (${count})`) with no fallback, so a
    // missing label here means "undefined (N)" on the actual tab row.
    // Caught by reading the combined-tree screenshots; this is the
    // contract test that should have caught it first.
    expect(typeof view.label, `${vlabel}: label is a string`).toBe('string');
    expect(view.label.trim().length, `${vlabel}: label is non-empty`).toBeGreaterThan(0);
    // D-036 rule 3: w <= 360, h <= 240 native px.
    expect(view.size.w, `${vlabel}: width <= 360`).toBeLessThanOrEqual(360);
    expect(view.size.h, `${vlabel}: height <= 240`).toBeLessThanOrEqual(240);
    // `focus` is "what to scroll to if wider than viewport" — it need not
    // be the full view (a zoomed-in region is exactly the point for a
    // view that's wider than any phone), just within its bounds.
    expect(view.focus.x + view.focus.w, `${vlabel}: focus rect x-bound within view`).toBeLessThanOrEqual(
      view.size.w
    );
    expect(view.focus.y + view.focus.h, `${vlabel}: focus rect y-bound within view`).toBeLessThanOrEqual(
      view.size.h
    );

    // A2/A1: every entry must reference a real manifest sprite+frame.
    // `frame` is strict (fix round): a scene entry's frame key must be
    // one of that sprite's own manifest frame keys, no "default" or
    // first-key fallback — matches src/scene/sprites.ts#loadEntryImage,
    // which now throws rather than silently drawing the wrong pose.
    for (const entry of view.entries) {
      const spriteEntry = manifest[entry.sprite];
      expect(spriteEntry, `${vlabel}: entry sprite "${entry.sprite}" exists in manifest.json`).toBeDefined();
      expect(typeof entry.frame, `${vlabel}: entry "${entry.sprite}" frame is a string`).toBe('string');
      if (spriteEntry) {
        const hasFrame = entry.frame in spriteEntry.frames;
        expect(
          hasFrame,
          `${vlabel}: entry frame "${entry.sprite}"/"${entry.frame}" is one of that sprite's manifest frame keys`
        ).toBe(true);
      }
      // Entries may legitimately extend past the view rect (e.g. a road
      // sprite anchored at x=-8 that the canvas just clips) — no bounds
      // check here. Hotspots and `focus`, which drive real layout
      // (button placement, scroll-to), still get one below.
    }

    // Per-view part of D-036 rule 4: a gag may have AT MOST one primary
    // in any single view (never two primaries for the same gag in the
    // same view) — the "exactly one, total" half of the rule is checked
    // per file, after this loop, via primariesByGag.
    const byGag = new Map<string, SceneHotspot[]>();
    for (const h of view.hotspots) {
      expect(h.x + h.w, `${vlabel}: hotspot "${h.gagId}" x+w in bounds`).toBeLessThanOrEqual(view.size.w);
      expect(h.y + h.h, `${vlabel}: hotspot "${h.gagId}" y+h in bounds`).toBeLessThanOrEqual(view.size.h);
      const list = byGag.get(h.gagId) ?? [];
      list.push(h);
      byGag.set(h.gagId, list);
      if (h.primary) {
        const list2 = primariesByGag.get(h.gagId) ?? [];
        list2.push({ viewId: view.id, hotspot: h });
        primariesByGag.set(h.gagId, list2);
      }
    }
    for (const [gagId, parts] of byGag) {
      const primaries = parts.filter((p) => p.primary);
      expect(primaries.length, `${vlabel}: gag "${gagId}" has at most one primary hotspot in this view`).toBeLessThanOrEqual(1);
    }

    // D-036 rule 7 (D-038): primary hotspot centres >= 44 native px apart.
    // Rule has no exceptions.
    const primaries = view.hotspots.filter((h) => h.primary);
    for (let i = 0; i < primaries.length; i += 1) {
      for (let j = i + 1; j < primaries.length; j += 1) {
        const a = primaries[i];
        const b = primaries[j];
        const acx = a.x + a.w / 2;
        const acy = a.y + a.h / 2;
        const bcx = b.x + b.w / 2;
        const bcy = b.y + b.h / 2;
        const dist = Math.hypot(acx - bcx, acy - bcy);
        expect(
          dist,
          `${vlabel}: primary hotspots "${a.gagId}" and "${b.gagId}" are >= 44px apart`
        ).toBeGreaterThanOrEqual(44);
      }
    }
  }

  // File-level half of D-036 rule 4: every gag present anywhere in this
  // file (any view, primary or not) has exactly one primary hotspot
  // across the whole file, and it sits in that gag's D-036 home view.
  // (A two-part gag's non-primary part(s) can be in a different view —
  // that's fine, and not checked here.)
  const allGagIds = new Set(scene.views.flatMap((v) => v.hotspots.map((h) => h.gagId)));
  for (const gagId of allGagIds) {
    const primaries = primariesByGag.get(gagId) ?? [];
    expect(primaries.length, `${label}: gag "${gagId}" has exactly one primary hotspot across the file`).toBe(1);
    if (primaries.length === 1) {
      const homeView = HOME_VIEW[gagId];
      expect(homeView, `${label}: gag "${gagId}" has a D-036 home view entry (test data gap, not an export bug)`).toBeDefined();
      if (homeView) {
        expect(
          primaries[0].viewId,
          `${label}: gag "${gagId}"'s primary is in its D-036 home view "${homeView}", found in "${primaries[0].viewId}"`
        ).toBe(homeView);
      }
    }
  }
}

/** R-03a: band N's scene contains every gag with band <= N, in the matching state. */
function checkCumulativeCoverage(scene: SceneFile, label: string) {
  const tier = tierOf(scene.band as BandId);
  const expected = new Set(gagsAtOrBefore(tier));
  const present = new Set(scene.views.flatMap((v) => v.hotspots.map((h) => h.gagId)));
  for (const gagId of expected) {
    expect(present.has(gagId), `${label}: cumulative coverage missing gag ${gagId}`).toBe(true);
  }
  for (const gagId of present) {
    expect(expected.has(gagId), `${label}: scene has a gag (${gagId}) not yet due at band ${scene.band}`).toBe(true);
  }
}

/**
 * SCENE-FORMAT two-part gags: one hotspot per part, all sharing gagId,
 * one primary. Two exemptions, both ruled on by the mastermind after
 * the combined-tree run (a third, the art-debt list for G2.4's undrawn
 * inset part, was cleared by PH1-10):
 *
 * - A gag whose hotspots are ALL `placeholder: true` (undrawn for this
 *   band) exports one placeholder box, not real two-part geometry yet —
 *   the rule doesn't apply.
 * - TWO_PART_GAGS is per-state (G5.1 is only two-part `without`).
 */
function checkTwoPartGags(scene: SceneFile, label: string) {
  const allHotspots = scene.views.flatMap((v) => v.hotspots);
  for (const [gagId, stateRule] of Object.entries(TWO_PART_GAGS)) {
    if (stateRule !== 'both' && stateRule !== scene.state) continue; // not two-part in this state
    const parts = allHotspots.filter((h) => h.gagId === gagId);
    if (parts.length === 0) continue; // not yet due at this band
    if (parts.every((p) => p.placeholder)) continue; // undrawn — one placeholder box, not real two-part geometry yet

    expect(parts.length, `${label}: two-part gag ${gagId} has >= 2 hotspots`).toBeGreaterThanOrEqual(2);
    expect(parts.filter((p) => p.primary).length, `${label}: two-part gag ${gagId} has exactly one primary`).toBe(1);
    const partNames = parts.map((p) => p.part);
    expect(partNames.every(Boolean), `${label}: two-part gag ${gagId}'s hotspots all carry a "part"`).toBe(true);
  }
}

function readScene(dir: string, fileName: string): SceneFile {
  return JSON.parse(readFileSync(path.join(dir, fileName), 'utf-8')) as SceneFile;
}

/**
 * `strict`: the real public/sprites/scenes directory must have every one
 * of the 7 bands x 2 states present and `beyond` resolving — no silent
 * partial coverage (fix round). tests/fixtures is deliberately partial
 * (band 80 only, until PH1-08b lands for the rest) and stays non-strict.
 */
function runContractSuite(dirLabel: string, dir: string, options: { strict: boolean }) {
  const indexPath = path.join(dir, 'index.json');

  if (!existsSync(indexPath)) {
    it.skip(`${dirLabel}: no index.json yet (PH1-08b hasn't landed) — skipped, not silently passed`, () => {});
    return;
  }

  const index = JSON.parse(readFileSync(indexPath, 'utf-8')) as SceneIndex;

  it(`${dirLabel}: index.json — beyond is an explicit alias of 750 (N-02)`, () => {
    expect(index.beyond).toBe('750');
    if (options.strict || index.bands['750']) {
      expect(index.bands['750'], `${dirLabel}: band 750 present so 'beyond' resolves`).toBeDefined();
      expect(index.bands['750'].built).toBeTruthy();
      expect(index.bands['750'].without).toBeTruthy();
    }
  });

  if (options.strict) {
    it(`${dirLabel}: all 7 bands x 2 states are present (no silent partial coverage)`, () => {
      for (const band of NUMERIC_BANDS) {
        const entry = index.bands[String(band)];
        expect(entry, `${dirLabel}: index.json has a bands["${band}"] entry`).toBeDefined();
        if (entry) {
          expect(entry.built, `${dirLabel}: band ${band} built file`).toBeTruthy();
          expect(entry.without, `${dirLabel}: band ${band} without file`).toBeTruthy();
          expect(existsSync(path.join(dir, entry.built)), `${dirLabel}: ${entry.built} exists on disk`).toBe(true);
          expect(existsSync(path.join(dir, entry.without)), `${dirLabel}: ${entry.without} exists on disk`).toBe(
            true
          );
        }
      }
    });
  }

  const sceneFiles = readdirSync(dir).filter((f: string) => f.endsWith('.json') && f !== 'index.json');
  expect(sceneFiles.length, `${dirLabel}: at least one scene file next to index.json`).toBeGreaterThan(0);

  for (const fileName of sceneFiles) {
    it(`${dirLabel}/${fileName}: format, coverage, two-part, hotspot spacing`, () => {
      const scene = readScene(dir, fileName);
      checkSceneFileShape(scene, `${dirLabel}/${fileName}`);
      checkCumulativeCoverage(scene, `${dirLabel}/${fileName}`);
      checkTwoPartGags(scene, `${dirLabel}/${fileName}`);
    });
  }
}

// Cheap regression coverage for the bug this fix round found: a two-part
// gag's primary living in its D-036 home view while a non-primary part
// sits in a different view is VALID (real band >= 150's G3.2), but two
// primaries for the same gag anywhere in the file is not. Synthetic
// scene files, not the fixture or real data, so both the good and the
// broken shape can be exercised directly.
function makeTwoViewScene(hotspotsByView: { ground: SceneHotspot[]; 'floor-2': SceneHotspot[] }): SceneFile {
  const size = { w: 300, h: 200 };
  const focus = { x: 0, y: 0, w: 300, h: 200 };
  return {
    schema: 1,
    band: 150,
    state: 'built',
    views: [
      { id: 'ground', label: 'Ground floor', size, focus, default: true, entries: [], hotspots: hotspotsByView.ground },
      { id: 'floor-2', label: 'Floor 2', size, focus, entries: [], hotspots: hotspotsByView['floor-2'] },
    ],
  };
}

describe('D-036 rule 4 regression: primary count is per file, not per view', () => {
  it('a two-part gag with its primary in its home view and a non-primary part elsewhere is valid', () => {
    const scene = makeTwoViewScene({
      ground: [{ gagId: 'G3.2', part: 'trolley', x: 0, y: 0, w: 10, h: 10, primary: true }],
      'floor-2': [{ gagId: 'G3.2', part: 'box', x: 0, y: 0, w: 10, h: 10, primary: false }],
    });
    expect(() => checkSceneFileShape(scene, 'regression')).not.toThrow();
  });

  it('two primaries for the same gag across different views is invalid', () => {
    const scene = makeTwoViewScene({
      ground: [{ gagId: 'G3.2', part: 'trolley', x: 0, y: 0, w: 10, h: 10, primary: true }],
      'floor-2': [{ gagId: 'G3.2', part: 'box', x: 0, y: 0, w: 10, h: 10, primary: true }],
    });
    expect(() => checkSceneFileShape(scene, 'regression')).toThrow();
  });

  it("a primary outside the gag's D-036 home view is invalid", () => {
    const scene = makeTwoViewScene({
      ground: [],
      'floor-2': [{ gagId: 'G3.2', part: 'trolley', x: 0, y: 0, w: 10, h: 10, primary: true }],
    });
    expect(() => checkSceneFileShape(scene, 'regression')).toThrow();
  });
});

function makeOneViewScene(state: 'built' | 'without', hotspots: SceneHotspot[]): SceneFile {
  const size = { w: 300, h: 200 };
  const focus = { x: 0, y: 0, w: 300, h: 200 };
  return {
    schema: 1,
    band: 220,
    state,
    views: [{ id: 'ground', label: 'Ground floor', size, focus, default: true, entries: [], hotspots }],
  };
}

// Cheap regression coverage for the exemptions the mastermind ruled on
// after the combined-tree run found 11 checkTwoPartGags failures:
// per-state applicability (G5.1) and the placeholder exemption (G4.1 at
// 610/750). The G2.4 art-debt exemption was deleted when PH1-10 drew the
// inset part; a lone G2.4 hotspot is now simply invalid.
describe('checkTwoPartGags exemptions (fix round 3)', () => {
  it("G5.1 is single-part in 'built' (docs/content/BANDS-AND-GAGS.md: one picture, a solid link)", () => {
    const scene = makeOneViewScene('built', [{ gagId: 'G5.1', x: 0, y: 0, w: 10, h: 10, primary: true }]);
    expect(() => checkTwoPartGags(scene, 'r')).not.toThrow();
  });

  it("G5.1 is still two-part in 'without' — a single hotspot there is invalid", () => {
    const scene = makeOneViewScene('without', [{ gagId: 'G5.1', x: 0, y: 0, w: 10, h: 10, primary: true }]);
    expect(() => checkTwoPartGags(scene, 'r')).toThrow();
  });

  it('G5.1 with both parts in without is valid', () => {
    const scene = makeOneViewScene('without', [
      { gagId: 'G5.1', part: 'door-a', x: 0, y: 0, w: 10, h: 10, primary: true },
      { gagId: 'G5.1', part: 'door-b', x: 50, y: 0, w: 10, h: 10, primary: false },
    ]);
    expect(() => checkTwoPartGags(scene, 'r')).not.toThrow();
  });

  it('a two-part gag with only a placeholder hotspot is exempt (undrawn, not real two-part geometry yet)', () => {
    const scene = makeOneViewScene('built', [
      { gagId: 'G4.1', x: 0, y: 0, w: 10, h: 10, primary: true, placeholder: true },
    ]);
    expect(() => checkTwoPartGags(scene, 'r')).not.toThrow();
  });

  it('G2.4 with one (non-placeholder) hotspot fails', () => {
    const scene = makeOneViewScene('built', [{ gagId: 'G2.4', x: 0, y: 0, w: 10, h: 10, primary: true }]);
    expect(() => checkTwoPartGags(scene, 'r')).toThrow();
  });

  it('G2.4 with both parts (conference room + inset office) is valid', () => {
    const scene = makeOneViewScene('built', [
      { gagId: 'G2.4', part: 'room', x: 0, y: 0, w: 10, h: 10, primary: true },
      { gagId: 'G2.4', part: 'inset', x: 50, y: 0, w: 10, h: 10, primary: false },
    ]);
    expect(() => checkTwoPartGags(scene, 'r')).not.toThrow();
  });
});

describe('scene contract — public/sprites/scenes (the real thing, once PH1-08b lands)', () => {
  runContractSuite('public/sprites/scenes', new URL('../../public/sprites/scenes', import.meta.url).pathname, {
    strict: true,
  });
});

describe('scene contract — tests/fixtures (band 80, hand-written, exercises the contract now)', () => {
  runContractSuite('tests/fixtures', new URL('../../tests/fixtures', import.meta.url).pathname, { strict: false });
});
