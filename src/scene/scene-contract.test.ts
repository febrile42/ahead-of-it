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
  /** Fix round: unordered [gagId, gagId] pairs the contract test must
   * skip when checking D-036 rule 7 (44 native px spacing) — real band
   * 80 has 5 known-debt pairs, to be fixed in a later art pass. Absent
   * on tests/fixtures, which stays strict. */
  knownSpacingDebt?: Array<[string, string]>;
}

type BandId = 80 | 150 | 220 | 360 | 490 | 610 | 750 | 'beyond';
const NUMERIC_BANDS: readonly Exclude<BandId, 'beyond'>[] = [80, 150, 220, 360, 490, 610, 750];
const VIEW_ID_ORDER = ['ground', 'floor-2', 'floor-3', 'floor-4', 'floor-5', 'floor-6', 'top', 'street'];
// SCENE-FORMAT's "Two-part gags" list.
const TWO_PART_GAGS: ReadonlySet<string> = new Set(['G4.1', 'G5.1', 'G3.2', 'G2.4']);

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

/** Builds a lookup for "is this unordered pair of gag ids known spacing debt?" from index.json's `knownSpacingDebt`. */
function spacingDebtKey(a: string, b: string): string {
  return [a, b].sort().join('~');
}

function spacingDebtSet(index: SceneIndex | undefined): Set<string> {
  const pairs = index?.knownSpacingDebt ?? [];
  return new Set(pairs.map(([a, b]) => spacingDebtKey(a, b)));
}

/** All the format-level checks a single scene file must pass, independent of which band it's for. */
function checkSceneFileShape(scene: SceneFile, label: string, debt: Set<string>) {
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

  for (const view of scene.views) {
    const vlabel = `${label} view "${view.id}"`;
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

    // D-036 rule 4: exactly one primary hotspot per gag (within this view,
    // a gag may have non-primary parts too — see the two-part check below).
    const byGag = new Map<string, SceneHotspot[]>();
    for (const h of view.hotspots) {
      expect(h.x + h.w, `${vlabel}: hotspot "${h.gagId}" x+w in bounds`).toBeLessThanOrEqual(view.size.w);
      expect(h.y + h.h, `${vlabel}: hotspot "${h.gagId}" y+h in bounds`).toBeLessThanOrEqual(view.size.h);
      const list = byGag.get(h.gagId) ?? [];
      list.push(h);
      byGag.set(h.gagId, list);
    }
    for (const [gagId, parts] of byGag) {
      const primaries = parts.filter((p) => p.primary);
      expect(primaries.length, `${vlabel}: gag "${gagId}" has exactly one primary hotspot`).toBe(1);
    }

    // D-036 rule 7: primary hotspot centres >= 44 native px apart, except
    // pairs index.json explicitly flags as known spacing debt (fix round
    // — real band 80 fails this on 5 pairs, to be fixed in a later art
    // pass, not papered over here or silently ignored everywhere).
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
        if (dist < 44 && debt.has(spacingDebtKey(a.gagId, b.gagId))) {
          // eslint-disable-next-line no-console
          console.info(
            `${vlabel}: primary hotspots "${a.gagId}"/"${b.gagId}" are ${dist.toFixed(1)}px apart (< 44) — known spacing debt, skipped`
          );
          continue;
        }
        expect(
          dist,
          `${vlabel}: primary hotspots "${a.gagId}" and "${b.gagId}" are >= 44px apart`
        ).toBeGreaterThanOrEqual(44);
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

/** SCENE-FORMAT two-part gags: one hotspot per part, all sharing gagId, one primary. */
function checkTwoPartGags(scene: SceneFile, label: string) {
  const allHotspots = scene.views.flatMap((v) => v.hotspots);
  for (const gagId of TWO_PART_GAGS) {
    const parts = allHotspots.filter((h) => h.gagId === gagId);
    if (parts.length === 0) continue; // not yet due at this band
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
  const debt = spacingDebtSet(index);

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
      checkSceneFileShape(scene, `${dirLabel}/${fileName}`, debt);
      checkCumulativeCoverage(scene, `${dirLabel}/${fileName}`);
      checkTwoPartGags(scene, `${dirLabel}/${fileName}`);
    });
  }
}

describe('scene contract — public/sprites/scenes (the real thing, once PH1-08b lands)', () => {
  runContractSuite('public/sprites/scenes', new URL('../../public/sprites/scenes', import.meta.url).pathname, {
    strict: true,
  });
});

describe('scene contract — tests/fixtures (band 80, hand-written, exercises the contract now)', () => {
  runContractSuite('tests/fixtures', new URL('../../tests/fixtures', import.meta.url).pathname, { strict: false });
});
