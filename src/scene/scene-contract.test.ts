// Schema-2 contract tests over the art pipeline's exported scene files
// (docs/product/SCENE-FORMAT.md, D-035/D-036, amended by D-042/D-042a).
// Reads only the exported JSON; no Python, no PNGs.
//
// Every rule is a small named checker that throws (vitest `expect`) so the
// same function runs over the real files, over the fixtures, and over a
// mutated fixture in a negative test. There are no exemption lists (D-038):
// a rule that must bend needs a decision first.
//
// The real directory public/sprites/scenes is still schema 1 until the
// D-042 exporter lands (DIA-3); that suite is skipped, visibly, until its
// index.json says `schema: 2`, and then runs strict with no edits here.
// tests/fixtures (hand-written, tests/fixtures/generate_d042.py) always runs.
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

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface SceneView {
  id: string;
  kind: 'room' | 'closeup';
  parent?: string;
  label: string;
  size: { w: number; h: number };
  rect?: Rect;
  focus: Rect;
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
// D-036/D-042: room ids, in this order (subset allowed, `ground` always present).
const ROOM_ORDER = ['ground', 'floor-2', 'floor-3', 'floor-4', 'floor-5', 'floor-6', 'top', 'street'];
const ROOM_MAX = { w: 360, h: 240 };
const CLOSEUP_MAX = { w: 180, h: 120 };
const LABEL_MAX = 24;
const MIN_PRIMARY_GAP = 24; // native px between primary centres inside a close-up (D-042)

// SCENE-FORMAT "Two-part gags": which *state(s)* each is two-part in.
// docs/content/BANDS-AND-GAGS.md G5.1: the built state is one picture (a
// solid link), so it is only two-part `without`. The rest are two-part in both.
const TWO_PART_GAGS: Record<string, 'both' | 'built' | 'without'> = {
  'G3.2': 'both',
  'G4.1': 'both',
  'G5.1': 'without',
  'G2.4': 'both',
};

// D-036 rule 4's table (docs/product/04-DECISIONS.md), read by D-042 as each
// gag's home ROOM: its single primary sits in a close-up whose parent is this
// room. Non-primary parts of a two-part gag may sit in any other close-up.
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

function tierOf(band: BandId): number {
  return band === 'beyond' ? 750 : band;
}

/** Every gag with band <= `tier` (R-03a: cumulative composition), 'beyond' pinned to 750 (N-02). */
function gagsAtOrBefore(tier: number): string[] {
  return content.gags.filter((g) => tierOf(g.band) <= tier).map((g) => g.id);
}

/** Gags introduced AT `tier` (their content.json band, 'beyond' pinned to 750). */
function ownGagsOf(tier: number): Set<string> {
  return new Set(content.gags.filter((g) => tierOf(g.band) === tier).map((g) => g.id));
}

function rooms(scene: SceneFile): SceneView[] {
  return scene.views.filter((v) => v.kind === 'room');
}

function closeups(scene: SceneFile): SceneView[] {
  return scene.views.filter((v) => v.kind === 'closeup');
}

function inside(inner: Rect, w: number, h: number): boolean {
  return inner.x >= 0 && inner.y >= 0 && inner.x + inner.w <= w && inner.y + inner.h <= h;
}

/** Rule 1: header. `schema === 2`, a real band, a real state. */
function checkHeader(scene: SceneFile, label: string) {
  expect(scene.schema, `${label}: schema`).toBe(2);
  expect(NUMERIC_BANDS as readonly number[], `${label}: band`).toContain(scene.band);
  expect(['built', 'without'], `${label}: state`).toContain(scene.state);
  expect(scene.views.length, `${label}: at least one view`).toBeGreaterThan(0);
}

/** Rule 2: every view has a known `kind` and a non-empty label of at most 24 chars. */
function checkKindsAndLabels(scene: SceneFile, label: string) {
  for (const view of scene.views) {
    const vlabel = `${label} view "${view.id}"`;
    expect(['room', 'closeup'], `${vlabel}: kind`).toContain(view.kind);
    // The nav renders the label verbatim: a missing one is "undefined" on screen.
    expect(typeof view.label, `${vlabel}: label is a string`).toBe('string');
    expect(view.label.trim().length, `${vlabel}: label is non-empty`).toBeGreaterThan(0);
    expect(view.label.length, `${vlabel}: label <= ${LABEL_MAX} chars`).toBeLessThanOrEqual(LABEL_MAX);
  }
}

/**
 * Rule 3: id scheme and array order (D-042). Rooms are ground, floor-2..6,
 * top, street in that order; close-ups are `<room>.<n>`, n from 1 and
 * contiguous, with `parent` equal to the id prefix and naming the room
 * directly before them in the array; every room is followed by at least one.
 */
function checkIdScheme(scene: SceneFile, label: string) {
  const views = scene.views;
  const ids = views.map((v) => v.id);
  expect(ids, `${label}: view ids unique`).toEqual([...new Set(ids)]);
  expect(views[0].id, `${label}: 'ground' is the first view`).toBe('ground');
  expect(views[0].kind, `${label}: 'ground' is a room`).toBe('room');

  const roomIds = rooms(scene).map((v) => v.id);
  expect(roomIds, `${label}: room ids are a subset of ${ROOM_ORDER.join(', ')}, in that order`).toEqual(
    ROOM_ORDER.filter((id) => roomIds.includes(id))
  );

  const seenRooms: string[] = [];
  let current: string | undefined;
  let count = 0;
  views.forEach((v, i) => {
    const vlabel = `${label} view "${v.id}"`;
    if (v.kind === 'room') {
      expect(v.parent, `${vlabel}: a room has no parent`).toBeUndefined();
      expect(v.rect, `${vlabel}: a room has no rect`).toBeUndefined();
      seenRooms.push(v.id);
      current = v.id;
      count = 0;
      const next = views[i + 1];
      expect(
        next?.kind === 'closeup' && next.parent === v.id,
        `${vlabel}: room has at least one close-up directly after it`
      ).toBe(true);
    } else {
      const m = /^(.+)\.([1-9]\d*)$/.exec(v.id);
      expect(m, `${vlabel}: close-up id is "<room>.<n>", n >= 1`).not.toBeNull();
      expect(v.parent, `${vlabel}: parent equals the id prefix`).toBe(m![1]);
      expect(seenRooms, `${vlabel}: parent names a room that precedes it`).toContain(v.parent);
      expect(v.parent, `${vlabel}: directly follows its own room (array order)`).toBe(current);
      count += 1;
      expect(Number(m![2]), `${vlabel}: n is contiguous from 1 within its room`).toBe(count);
      expect(v.rect, `${vlabel}: a close-up has a rect`).toBeDefined();
    }
  });
}

/** Rule 4: rooms carry no hotspots and are at most 360 x 240. */
function checkRooms(scene: SceneFile, label: string) {
  for (const room of rooms(scene)) {
    const vlabel = `${label} room "${room.id}"`;
    expect(room.hotspots, `${vlabel}: rooms carry no gag hotspots`).toEqual([]);
    expect(room.size.w, `${vlabel}: width <= ${ROOM_MAX.w}`).toBeLessThanOrEqual(ROOM_MAX.w);
    expect(room.size.h, `${vlabel}: height <= ${ROOM_MAX.h}`).toBeLessThanOrEqual(ROOM_MAX.h);
  }
}

/**
 * Rule 5: close-up geometry. <= 180 x 120, `size` = `rect` w/h, `rect` an
 * integer rect inside the parent's size, 1-3 primaries per close-up.
 */
function checkCloseups(scene: SceneFile, label: string) {
  for (const c of closeups(scene)) {
    const vlabel = `${label} close-up "${c.id}"`;
    expect(c.size.w, `${vlabel}: width <= ${CLOSEUP_MAX.w}`).toBeLessThanOrEqual(CLOSEUP_MAX.w);
    expect(c.size.h, `${vlabel}: height <= ${CLOSEUP_MAX.h}`).toBeLessThanOrEqual(CLOSEUP_MAX.h);
    const rect = c.rect;
    expect(rect, `${vlabel}: has a rect`).toBeDefined();
    if (!rect) continue;
    expect(rect.w, `${vlabel}: size.w equals rect.w`).toBe(c.size.w);
    expect(rect.h, `${vlabel}: size.h equals rect.h`).toBe(c.size.h);
    for (const k of ['x', 'y', 'w', 'h'] as const) {
      expect(Number.isInteger(rect[k]), `${vlabel}: rect.${k} is an integer`).toBe(true);
    }
    const parent = rooms(scene).find((r) => r.id === c.parent);
    expect(parent, `${vlabel}: parent "${c.parent}" is a room in this file`).toBeDefined();
    if (parent) {
      expect(inside(rect, parent.size.w, parent.size.h), `${vlabel}: rect lies inside parent "${parent.id}"`).toBe(true);
    }
    const primaries = c.hotspots.filter((h) => h.primary).length;
    expect(primaries, `${vlabel}: 1-3 primary hotspots (found ${primaries})`).toBeGreaterThanOrEqual(1);
    expect(primaries, `${vlabel}: 1-3 primary hotspots (found ${primaries})`).toBeLessThanOrEqual(3);
  }
}

/** Hotspots and `focus` lie inside their own view, in that view's local coordinates. */
function checkBounds(scene: SceneFile, label: string) {
  for (const view of scene.views) {
    const vlabel = `${label} view "${view.id}"`;
    // `focus` need not be the whole view, only inside it.
    expect(inside(view.focus, view.size.w, view.size.h), `${vlabel}: focus lies inside the view`).toBe(true);
    for (const h of view.hotspots) {
      expect(inside(h, view.size.w, view.size.h), `${vlabel}: hotspot "${h.gagId}" lies inside the view`).toBe(true);
    }
  }
}

/**
 * Rule 6: exactly one `default: true`, on a close-up, and it is the close-up
 * holding the most primaries of the band's OWN gags (content.json band ===
 * file band, 'beyond' = 750); ties go to the earlier one in array order.
 */
function checkDefaultView(scene: SceneFile, label: string) {
  const defaults = scene.views.filter((v) => v.default);
  expect(defaults.length, `${label}: exactly one default view`).toBe(1);
  expect(defaults[0].kind, `${label}: the default view is a close-up`).toBe('closeup');

  const own = ownGagsOf(scene.band);
  let best: SceneView | undefined;
  let bestCount = -1;
  for (const c of closeups(scene)) {
    const n = c.hotspots.filter((h) => h.primary && own.has(h.gagId)).length;
    if (n > bestCount) {
      best = c;
      bestCount = n;
    }
  }
  expect(
    defaults[0].id,
    `${label}: default should be "${best?.id}" (${bestCount} own primaries, ties to the earlier), found "${defaults[0].id}"`
  ).toBe(best?.id);
}

/** Rule 7: `built` and `without` of a band share ids, kinds, parents, labels and array order. */
function skeletonOf(scene: SceneFile) {
  return scene.views.map((v) => ({ id: v.id, kind: v.kind, parent: v.parent ?? null, label: v.label }));
}

function checkSkeleton(built: SceneFile, without: SceneFile, label: string) {
  expect(skeletonOf(without), `${label}: built and without share a skeleton`).toEqual(skeletonOf(built));
}

/**
 * Rule 8: R-03a coverage, both directions, and the home-room rule. Every gag
 * due at the band has exactly ONE primary hotspot across the file, in a
 * close-up whose parent is its home room; nothing that is not yet due is
 * present (any hotspot). Non-primary parts may sit in any close-up.
 */
function checkCoverageAndHome(scene: SceneFile, label: string) {
  const due = new Set(gagsAtOrBefore(tierOf(scene.band as BandId)));
  const present = new Set(scene.views.flatMap((v) => v.hotspots.map((h) => h.gagId)));
  for (const gagId of present) {
    expect(due.has(gagId), `${label}: scene has a gag (${gagId}) not yet due at band ${scene.band}`).toBe(true);
  }
  for (const gagId of due) {
    const primaryViews = scene.views.flatMap((v) => v.hotspots.filter((h) => h.gagId === gagId && h.primary).map(() => v));
    expect(primaryViews.length, `${label}: due gag ${gagId} has exactly one primary hotspot across the file`).toBe(1);
    const homeRoom = HOME_VIEW[gagId];
    // A missing entry is a gap in this test's data, not an export bug.
    expect(homeRoom, `${label}: gag "${gagId}" has a HOME_VIEW entry (test data gap)`).toBeDefined();
    const v = primaryViews[0];
    expect(
      v.kind === 'closeup' && v.parent === homeRoom,
      `${label}: gag "${gagId}"'s primary is in a close-up of its home room "${homeRoom}", found in "${v.id}"`
    ).toBe(true);
  }
}

/**
 * Rule 9: two-part gags (state-aware) have >= 2 hotspots, exactly one
 * primary, every hotspot carrying a `part`. No exemption of any kind: a
 * placeholder hotspot is held to the same rule (D-038).
 */
function checkTwoPartGags(scene: SceneFile, label: string) {
  const allHotspots = scene.views.flatMap((v) => v.hotspots);
  for (const [gagId, stateRule] of Object.entries(TWO_PART_GAGS)) {
    if (stateRule !== 'both' && stateRule !== scene.state) continue; // not two-part in this state
    const parts = allHotspots.filter((h) => h.gagId === gagId);
    if (parts.length === 0) continue; // not yet due at this band (checkCoverageAndHome owns that)
    expect(parts.length, `${label}: two-part gag ${gagId} has >= 2 hotspots`).toBeGreaterThanOrEqual(2);
    expect(parts.filter((p) => p.primary).length, `${label}: two-part gag ${gagId} has exactly one primary`).toBe(1);
    expect(parts.every((p) => Boolean(p.part)), `${label}: two-part gag ${gagId}'s hotspots all carry a "part"`).toBe(true);
  }
}

/** Rule 10: primary hotspot centres are >= 24 native px apart within a close-up (D-042). */
function checkSpacing(scene: SceneFile, label: string) {
  for (const view of scene.views) {
    const primaries = view.hotspots.filter((h) => h.primary);
    for (let i = 0; i < primaries.length; i += 1) {
      for (let j = i + 1; j < primaries.length; j += 1) {
        const a = primaries[i];
        const b = primaries[j];
        const dist = Math.hypot(a.x + a.w / 2 - (b.x + b.w / 2), a.y + a.h / 2 - (b.y + b.h / 2));
        expect(
          dist,
          `${label} view "${view.id}": primary hotspots "${a.gagId}" and "${b.gagId}" are >= ${MIN_PRIMARY_GAP}px apart`
        ).toBeGreaterThanOrEqual(MIN_PRIMARY_GAP);
      }
    }
  }
}

/**
 * Rule 11 (A2): every entry names a real manifest sprite and one of its own
 * frame keys (a string, never an index), no fallback, matching
 * src/scene/sprites.ts. Entries may overhang a view: no bounds check.
 */
function checkEntries(scene: SceneFile, label: string) {
  for (const view of scene.views) {
    const vlabel = `${label} view "${view.id}"`;
    for (const entry of view.entries) {
      const spriteEntry = manifest[entry.sprite];
      expect(spriteEntry, `${vlabel}: entry sprite "${entry.sprite}" exists in manifest.json`).toBeDefined();
      expect(typeof entry.frame, `${vlabel}: entry "${entry.sprite}" frame is a string`).toBe('string');
      if (spriteEntry) {
        expect(
          entry.frame in spriteEntry.frames,
          `${vlabel}: entry frame "${entry.sprite}"/"${entry.frame}" is one of that sprite's manifest frame keys`
        ).toBe(true);
      }
    }
  }
}

/** Everything a single scene file must satisfy on its own (rules 1-6, 8-11). */
function checkSceneFile(scene: SceneFile, label: string) {
  checkHeader(scene, label);
  checkKindsAndLabels(scene, label);
  checkIdScheme(scene, label);
  checkRooms(scene, label);
  checkCloseups(scene, label);
  checkBounds(scene, label);
  checkDefaultView(scene, label);
  checkCoverageAndHome(scene, label);
  checkTwoPartGags(scene, label);
  checkSpacing(scene, label);
  checkEntries(scene, label);
}

/**
 * Rule 12: index.json. `beyond` is an explicit alias of 750 (N-02) and 750
 * must exist. `strict`: all 7 bands x 2 states named (the fixtures are
 * deliberately partial: bands 80 and 750).
 */
function checkIndex(index: SceneIndex, label: string, options: { strict: boolean }) {
  expect(index.schema, `${label}: index schema`).toBe(2);
  expect(index.beyond, `${label}: beyond is an explicit alias of 750 (N-02)`).toBe('750');
  const wanted = options.strict ? NUMERIC_BANDS : ([750] as const);
  for (const band of wanted) {
    const entry = index.bands[String(band)];
    expect(entry, `${label}: index.json has a bands["${band}"] entry`).toBeDefined();
    expect(entry?.built, `${label}: band ${band} built file`).toBeTruthy();
    expect(entry?.without, `${label}: band ${band} without file`).toBeTruthy();
  }
}

function readJson<T>(dir: string, fileName: string): T {
  return JSON.parse(readFileSync(path.join(dir, fileName), 'utf-8')) as T;
}

/**
 * `strict`: the real public/sprites/scenes directory must have every one of
 * the 7 bands x 2 states on disk and `beyond` resolving: no silent partial
 * coverage. tests/fixtures is deliberately partial (bands 80 and 750) and
 * stays non-strict.
 */
function runContractSuite(dirLabel: string, dir: string, options: { strict: boolean }) {
  const indexPath = path.join(dir, 'index.json');

  if (!existsSync(indexPath)) {
    it.skip(`${dirLabel}: no index.json yet, skipped, not silently passed`, () => {});
    return;
  }

  const index = readJson<SceneIndex>(dir, 'index.json');

  if (index.schema !== 2 && options.strict) {
    it.skip(
      `${dirLabel}: still schema 1 - awaiting the D-042 exporter (DIA-3); skipped, not silently passed`,
      () => {}
    );
    return;
  }

  it(`${dirLabel}: index.json (schema 2, beyond aliases 750${options.strict ? ', all 7 bands' : ''})`, () => {
    checkIndex(index, dirLabel, options);
  });

  it(`${dirLabel}: every file the index names exists on disk`, () => {
    for (const [band, entry] of Object.entries(index.bands)) {
      for (const state of ['built', 'without'] as const) {
        expect(existsSync(path.join(dir, entry[state])), `${dirLabel}: band ${band} ${state} file ${entry[state]} exists`).toBe(
          true
        );
      }
    }
  });

  const sceneFiles = readdirSync(dir).filter((f: string) => f.endsWith('.json') && f !== 'index.json');
  it(`${dirLabel}: at least one scene file next to index.json`, () => {
    expect(sceneFiles.length).toBeGreaterThan(0);
  });

  for (const fileName of sceneFiles) {
    it(`${dirLabel}/${fileName}: every per-file rule`, () => {
      checkSceneFile(readJson<SceneFile>(dir, fileName), `${dirLabel}/${fileName}`);
    });
  }

  for (const [band, entry] of Object.entries(index.bands)) {
    it(`${dirLabel}: band ${band} built and without share a skeleton`, () => {
      const built = readJson<SceneFile>(dir, entry.built);
      const without = readJson<SceneFile>(dir, entry.without);
      expect(built.band, `${entry.built}: band matches its index key`).toBe(Number(band));
      expect(without.band, `${entry.without}: band matches its index key`).toBe(Number(band));
      expect(built.state, `${entry.built}: state`).toBe('built');
      expect(without.state, `${entry.without}: state`).toBe('without');
      checkSkeleton(built, without, `${dirLabel} band ${band}`);
    });
  }
}

describe('scene contract: public/sprites/scenes (the real thing)', () => {
  runContractSuite('public/sprites/scenes', new URL('../../public/sprites/scenes', import.meta.url).pathname, {
    strict: true,
  });
});

describe('scene contract: tests/fixtures (schema 2, hand-written; bands 80 and 750)', () => {
  runContractSuite('tests/fixtures', new URL('../../tests/fixtures', import.meta.url).pathname, { strict: false });
});

// ---------------------------------------------------------------------------
// Negative tests: each rule fails on a mutated copy of a real fixture.
// ---------------------------------------------------------------------------

const FIXTURES = new URL('../../tests/fixtures', import.meta.url).pathname;
// Each call re-reads the file, so every test gets its own deep copy.
const fx = (name: string): SceneFile => readJson<SceneFile>(FIXTURES, `${name}.json`);
const fxIndex = (): SceneIndex => readJson<SceneIndex>(FIXTURES, 'index.json');
const view = (scene: SceneFile, id: string): SceneView => {
  const v = scene.views.find((x) => x.id === id);
  if (!v) throw new Error(`fixture has no view ${id}`);
  return v;
};
/** Assign a deliberately ill-typed value: the mutation is the point. */
const poke = (obj: object, key: string, value: unknown) => {
  (obj as Record<string, unknown>)[key] = value;
};
const prim = (over: Partial<SceneHotspot>): SceneHotspot => ({
  gagId: 'G9.9',
  x: 0,
  y: 0,
  w: 10,
  h: 10,
  primary: true,
  ...over,
});

describe('positive: unmutated fixtures pass every checker', () => {
  for (const name of ['80-built', '80-without', '750-built', '750-without']) {
    it(name, () => {
      const s = fx(name);
      expect(() => checkHeader(s, name)).not.toThrow();
      expect(() => checkKindsAndLabels(s, name)).not.toThrow();
      expect(() => checkIdScheme(s, name)).not.toThrow();
      expect(() => checkRooms(s, name)).not.toThrow();
      expect(() => checkCloseups(s, name)).not.toThrow();
      expect(() => checkBounds(s, name)).not.toThrow();
      expect(() => checkDefaultView(s, name)).not.toThrow();
      expect(() => checkCoverageAndHome(s, name)).not.toThrow();
      expect(() => checkTwoPartGags(s, name)).not.toThrow();
      expect(() => checkSpacing(s, name)).not.toThrow();
      expect(() => checkEntries(s, name)).not.toThrow();
      expect(() => checkSceneFile(s, name)).not.toThrow();
    });
  }
  it('both states of each band share a skeleton', () => {
    expect(() => checkSkeleton(fx('80-built'), fx('80-without'), '80')).not.toThrow();
    expect(() => checkSkeleton(fx('750-built'), fx('750-without'), '750')).not.toThrow();
  });
  it('the fixture index passes non-strict', () => {
    expect(() => checkIndex(fxIndex(), 'index', { strict: false })).not.toThrow();
  });
  it('every gag in content.json has a HOME_VIEW entry (so the home-room rule cannot silently skip one)', () => {
    for (const g of content.gags) expect(HOME_VIEW[g.id], `HOME_VIEW["${g.id}"]`).toBeDefined();
  });
});

describe('negative: schema, band, state (rule 1)', () => {
  it('schema 1 fails', () => {
    const s = fx('80-built');
    s.schema = 1;
    expect(() => checkHeader(s, 't')).toThrow();
  });
  it('an unknown band fails', () => {
    const s = fx('80-built');
    s.band = 100;
    expect(() => checkHeader(s, 't')).toThrow();
  });
  it('an unknown state fails', () => {
    const s = fx('80-built');
    poke(s, 'state', 'both');
    expect(() => checkHeader(s, 't')).toThrow();
  });
});

describe('negative: kinds and labels (rule 2)', () => {
  it('a missing kind fails', () => {
    const s = fx('80-built');
    delete (view(s, 'ground.1') as { kind?: string }).kind;
    expect(() => checkKindsAndLabels(s, 't')).toThrow();
  });
  it('a bad kind fails', () => {
    const s = fx('80-built');
    poke(view(s, 'ground.1'), 'kind', 'view');
    expect(() => checkKindsAndLabels(s, 't')).toThrow();
  });
  it('a 25-char label fails and 24 passes', () => {
    const s = fx('80-built');
    view(s, 'ground.1').label = 'x'.repeat(25);
    expect(() => checkKindsAndLabels(s, 't')).toThrow();
    view(s, 'ground.1').label = 'x'.repeat(24);
    expect(() => checkKindsAndLabels(s, 't')).not.toThrow();
  });
  it('an empty or blank label fails', () => {
    const s = fx('80-built');
    view(s, 'ground').label = '';
    expect(() => checkKindsAndLabels(s, 't')).toThrow();
    view(s, 'ground').label = '   ';
    expect(() => checkKindsAndLabels(s, 't')).toThrow();
  });
  it('a missing label fails', () => {
    const s = fx('80-built');
    delete (view(s, 'ground') as { label?: string }).label;
    expect(() => checkKindsAndLabels(s, 't')).toThrow();
  });
});

describe('negative: id scheme and array order (rule 3)', () => {
  it('ground.2 before ground.1 fails', () => {
    const s = fx('80-built');
    s.views = [s.views[0], s.views[2], s.views[1]];
    expect(() => checkIdScheme(s, 't')).toThrow();
  });
  it('ground.0 fails', () => {
    const s = fx('80-built');
    view(s, 'ground.1').id = 'ground.0';
    expect(() => checkIdScheme(s, 't')).toThrow();
  });
  it('a gap in the numbering fails', () => {
    const s = fx('80-built');
    view(s, 'ground.2').id = 'ground.3';
    expect(() => checkIdScheme(s, 't')).toThrow();
  });
  it('an id that is not <room>.<n> fails', () => {
    const s = fx('80-built');
    view(s, 'ground.1').id = 'closet';
    expect(() => checkIdScheme(s, 't')).toThrow();
  });
  it('a duplicate id fails', () => {
    const s = fx('80-built');
    view(s, 'ground.2').id = 'ground.1';
    expect(() => checkIdScheme(s, 't')).toThrow();
  });
  it('parent that differs from the id prefix fails', () => {
    const s = fx('750-built');
    view(s, 'floor-2.1').parent = 'ground';
    expect(() => checkIdScheme(s, 't')).toThrow();
  });
  it('parent naming a later room fails', () => {
    const s = fx('750-built');
    // floor-2.1 (parent floor-2) moved to sit just before the floor-2 room, after ground's close-ups.
    const i = s.views.findIndex((v) => v.id === 'floor-2.1');
    const [moved] = s.views.splice(i, 1);
    s.views.splice(s.views.findIndex((v) => v.id === 'floor-2'), 0, moved);
    expect(() => checkIdScheme(s, 't')).toThrow();
  });
  it('parent naming a room that does not exist fails', () => {
    const s = fx('80-built');
    const c = view(s, 'ground.1');
    c.id = 'floor-9.1';
    c.parent = 'floor-9';
    expect(() => checkIdScheme(s, 't')).toThrow();
  });
  it('a room without a close-up fails', () => {
    const s = fx('750-built');
    s.views = s.views.filter((v) => v.parent !== 'top');
    expect(() => checkIdScheme(s, 't')).toThrow();
  });
  it('a close-up placed before its room fails', () => {
    const s = fx('750-built');
    const i = s.views.findIndex((v) => v.id === 'top');
    [s.views[i], s.views[i + 1]] = [s.views[i + 1], s.views[i]];
    expect(() => checkIdScheme(s, 't')).toThrow();
  });
  it("a room's close-ups separated from it by another room fail", () => {
    const s = fx('750-built');
    const top = s.views.findIndex((v) => v.id === 'top');
    const street = s.views.findIndex((v) => v.id === 'street');
    // top, street, top.1, street.1, street.2: top.1 no longer follows its room.
    const [t, t1, st, st1, st2] = [s.views[top], s.views[top + 1], s.views[street], s.views[street + 1], s.views[street + 2]];
    s.views.splice(top, 5, t, st, t1, st1, st2);
    expect(() => checkIdScheme(s, 't')).toThrow();
  });
  it('rooms out of D-036 order fail', () => {
    const s = fx('750-built');
    const top = s.views.findIndex((v) => v.id === 'top');
    const street = s.views.findIndex((v) => v.id === 'street');
    const topBlock = s.views.slice(top, top + 2);
    const streetBlock = s.views.slice(street, street + 3);
    s.views.splice(top, 5, ...streetBlock, ...topBlock);
    expect(() => checkIdScheme(s, 't')).toThrow();
  });
  it('an unknown room id fails', () => {
    const s = fx('750-built');
    view(s, 'top').id = 'roof';
    for (const v of s.views) if (v.parent === 'top') v.parent = 'roof';
    view(s, 'top.1').id = 'roof.1';
    expect(() => checkIdScheme(s, 't')).toThrow();
  });
  it('ground not first fails', () => {
    const s = fx('750-built');
    const f2 = s.views.filter((v) => v.id.startsWith('floor-2'));
    const rest = s.views.filter((v) => !v.id.startsWith('floor-2'));
    s.views = [...f2, ...rest];
    expect(() => checkIdScheme(s, 't')).toThrow();
  });
  it('a room with a parent or a rect fails', () => {
    const s = fx('80-built');
    view(s, 'ground').parent = 'ground';
    expect(() => checkIdScheme(s, 't')).toThrow();
    const s2 = fx('80-built');
    view(s2, 'ground').rect = { x: 0, y: 0, w: 300, h: 214 };
    expect(() => checkIdScheme(s2, 't')).toThrow();
  });
  it('a close-up without a rect or without a parent fails', () => {
    const s = fx('80-built');
    delete view(s, 'ground.1').rect;
    expect(() => checkIdScheme(s, 't')).toThrow();
    const s2 = fx('80-built');
    delete view(s2, 'ground.1').parent;
    expect(() => checkIdScheme(s2, 't')).toThrow();
  });
});

describe('negative: rooms (rule 4)', () => {
  it('a room with a hotspot fails', () => {
    const s = fx('80-built');
    view(s, 'ground').hotspots.push(prim({ gagId: 'G1.1' }));
    expect(() => checkRooms(s, 't')).toThrow();
  });
  it('a room wider than 360 or taller than 240 fails', () => {
    const s = fx('750-built');
    view(s, 'ground').size.w = 361;
    expect(() => checkRooms(s, 't')).toThrow();
    const s2 = fx('750-built');
    view(s2, 'ground').size.h = 241;
    expect(() => checkRooms(s2, 't')).toThrow();
  });
});

describe('negative: close-up geometry (rule 5)', () => {
  it('a close-up 181 wide fails', () => {
    const s = fx('750-built');
    const c = view(s, 'ground.1');
    c.size.w = 181;
    c.rect!.w = 181;
    expect(() => checkCloseups(s, 't')).toThrow();
  });
  it('a close-up 121 tall fails', () => {
    const s = fx('750-built');
    const c = view(s, 'ground.1');
    c.size.h = 121;
    c.rect!.h = 121;
    expect(() => checkCloseups(s, 't')).toThrow();
  });
  it('size != rect fails', () => {
    const s = fx('750-built');
    view(s, 'ground.1').size.w = 170;
    expect(() => checkCloseups(s, 't')).toThrow();
    const s2 = fx('750-built');
    view(s2, 'ground.1').rect!.h = 100;
    expect(() => checkCloseups(s2, 't')).toThrow();
  });
  it('a rect outside the parent fails (right edge, bottom edge, negative origin)', () => {
    const right = fx('750-built');
    view(right, 'ground.2').rect!.x = 181; // 181 + 180 > 360
    expect(() => checkCloseups(right, 't')).toThrow();
    const bottom = fx('750-built');
    view(bottom, 'ground.3').rect!.y = 121;
    expect(() => checkCloseups(bottom, 't')).toThrow();
    const neg = fx('750-built');
    view(neg, 'ground.1').rect!.x = -1;
    expect(() => checkCloseups(neg, 't')).toThrow();
  });
  it('a rect that lands exactly on the parent edge passes', () => {
    const s = fx('750-built');
    expect(view(s, 'ground.2').rect!.x + 180).toBe(360);
    expect(() => checkCloseups(s, 't')).not.toThrow();
  });
  it('a non-integer rect fails', () => {
    const s = fx('750-built');
    view(s, 'ground.2').rect!.x = 100.5;
    expect(() => checkCloseups(s, 't')).toThrow();
  });
  it('4 primaries in a close-up fails; 3 passes', () => {
    const s = fx('80-built');
    expect(view(s, 'ground.2').hotspots.filter((h) => h.primary).length).toBe(3);
    expect(() => checkCloseups(s, 't')).not.toThrow();
    view(s, 'ground.2').hotspots.push(prim({ x: 100, y: 100 }));
    expect(() => checkCloseups(s, 't')).toThrow();
  });
  it('0 primaries in a close-up fails', () => {
    const s = fx('80-built');
    for (const h of view(s, 'ground.1').hotspots) h.primary = false;
    expect(() => checkCloseups(s, 't')).toThrow();
  });
});

describe('negative: hotspots and focus inside their view (local coordinates)', () => {
  it('a hotspot hanging off the right or bottom edge fails', () => {
    const s = fx('80-built');
    const h = view(s, 'ground.1').hotspots[0];
    h.x = 180 - h.w + 1;
    expect(() => checkBounds(s, 't')).toThrow();
    const s2 = fx('80-built');
    const h2 = view(s2, 'ground.1').hotspots[0];
    h2.y = 120 - h2.h + 1;
    expect(() => checkBounds(s2, 't')).toThrow();
  });
  it('a hotspot at negative coordinates fails', () => {
    const s = fx('80-built');
    view(s, 'ground.1').hotspots[0].x = -1;
    expect(() => checkBounds(s, 't')).toThrow();
  });
  it('a hotspot in parent coordinates (rect offset not removed) fails', () => {
    const s = fx('80-built');
    const c = view(s, 'ground.2'); // rect.x = 120
    c.hotspots[0].x += c.rect!.x + 100;
    expect(() => checkBounds(s, 't')).toThrow();
  });
  it('focus outside the view fails', () => {
    const s = fx('80-built');
    view(s, 'ground.1').focus = { x: 10, y: 0, w: 180, h: 120 };
    expect(() => checkBounds(s, 't')).toThrow();
    const s2 = fx('80-built');
    view(s2, 'ground').focus = { x: 0, y: 0, w: 300, h: 215 };
    expect(() => checkBounds(s2, 't')).toThrow();
  });
  it('a focus narrower than the view is legal', () => {
    const s = fx('80-built');
    view(s, 'ground.1').focus = { x: 10, y: 10, w: 100, h: 60 };
    expect(() => checkBounds(s, 't')).not.toThrow();
  });
});

describe('negative: the default view (rule 6)', () => {
  it('two defaults fail', () => {
    const s = fx('80-built');
    view(s, 'ground.1').default = true;
    expect(() => checkDefaultView(s, 't')).toThrow();
  });
  it('zero defaults fail', () => {
    const s = fx('80-built');
    delete view(s, 'ground.2').default;
    expect(() => checkDefaultView(s, 't')).toThrow();
  });
  it('a default on a room fails (alone, or alongside the close-up default)', () => {
    const s = fx('80-built');
    delete view(s, 'ground.2').default;
    view(s, 'ground').default = true;
    expect(() => checkDefaultView(s, 't')).toThrow();
    const s2 = fx('80-built');
    view(s2, 'ground').default = true;
    expect(() => checkDefaultView(s2, 't')).toThrow();
  });
  it('a default on the wrong close-up (not the one with the most own primaries) fails', () => {
    const s = fx('750-built'); // ground.4 holds 2 own-band primaries; the rest hold 1 or 0
    delete view(s, 'ground.4').default;
    view(s, 'ground.1').default = true;
    expect(() => checkDefaultView(s, 't')).toThrow();
  });
  it("only the band's OWN gags count: a close-up full of older gags does not win", () => {
    const s = fx('750-built');
    // ground.1 has 3 primaries (all band <= 80); ground.4 holds 2 own ones and still wins.
    expect(view(s, 'ground.1').hotspots.filter((h) => h.primary).length).toBe(3);
    expect(() => checkDefaultView(s, 't')).not.toThrow();
  });
  it('a tie goes to the EARLIER close-up: later marked default fails, earlier passes', () => {
    const s = fx('80-built');
    // Remove one own primary from ground.2 so ground.1 and ground.2 tie 2-2.
    const g2 = view(s, 'ground.2');
    g2.hotspots = g2.hotspots.filter((h) => h.gagId !== 'G2.3');
    expect(() => checkDefaultView(s, 't')).toThrow(); // ground.2 (later) is marked default
    delete g2.default;
    view(s, 'ground.1').default = true;
    expect(() => checkDefaultView(s, 't')).not.toThrow();
  });
});

describe('negative: both states share a skeleton (rule 7)', () => {
  const pair = () => ({ built: fx('750-built'), without: fx('750-without') });
  it('a differing label fails', () => {
    const { built, without } = pair();
    view(without, 'ground.1').label = 'Other';
    expect(() => checkSkeleton(built, without, 't')).toThrow();
  });
  it('a differing kind fails', () => {
    const { built, without } = pair();
    poke(view(without, 'top'), 'kind', 'closeup');
    expect(() => checkSkeleton(built, without, 't')).toThrow();
  });
  it('a differing parent fails', () => {
    const { built, without } = pair();
    view(without, 'floor-2.1').parent = 'ground';
    expect(() => checkSkeleton(built, without, 't')).toThrow();
  });
  it('a differing id fails', () => {
    const { built, without } = pair();
    view(without, 'street.2').id = 'street.9';
    expect(() => checkSkeleton(built, without, 't')).toThrow();
  });
  it('a differing array order fails', () => {
    const { built, without } = pair();
    [without.views[1], without.views[2]] = [without.views[2], without.views[1]];
    expect(() => checkSkeleton(built, without, 't')).toThrow();
  });
  it('a missing or extra view fails', () => {
    const { built, without } = pair();
    without.views.pop();
    expect(() => checkSkeleton(built, without, 't')).toThrow();
  });
  it('rect, size, entries and default may differ per state', () => {
    const { built, without } = pair();
    const c = view(without, 'ground.2');
    c.rect = { x: 170, y: 0, w: 170, h: 110 };
    c.size = { w: 170, h: 110 };
    c.entries = [];
    c.default = true;
    delete view(without, 'ground.4').default;
    expect(() => checkSkeleton(built, without, 't')).not.toThrow();
  });
});

describe('negative: coverage and the home room (rule 8)', () => {
  it('a due gag missing fails', () => {
    const s = fx('80-built');
    for (const c of closeups(s)) c.hotspots = c.hotspots.filter((h) => h.gagId !== 'G1.1');
    expect(() => checkCoverageAndHome(s, 't')).toThrow();
  });
  it('a due gag with only a non-primary hotspot fails', () => {
    const s = fx('80-built');
    for (const h of view(s, 'ground.1').hotspots) if (h.gagId === 'G1.1') h.primary = false;
    expect(() => checkCoverageAndHome(s, 't')).toThrow();
  });
  it('a not-yet-due gag present fails (any hotspot, primary or not)', () => {
    const s = fx('80-built');
    view(s, 'ground.1').hotspots.push(prim({ gagId: 'G3.2', part: 'a', x: 100, y: 100 }));
    expect(() => checkCoverageAndHome(s, 't')).toThrow();
    const s2 = fx('80-built');
    view(s2, 'ground.1').hotspots.push(prim({ gagId: 'G3.2', part: 'b', x: 100, y: 100, primary: false }));
    expect(() => checkCoverageAndHome(s2, 't')).toThrow();
  });
  it('a gag with two primaries fails (same close-up or across close-ups)', () => {
    const s = fx('80-built');
    view(s, 'ground.1').hotspots.push(prim({ gagId: 'G1.1', x: 150, y: 90 }));
    expect(() => checkCoverageAndHome(s, 't')).toThrow();
    const s2 = fx('80-built');
    view(s2, 'ground.2').hotspots.push(prim({ gagId: 'G1.1', x: 150, y: 90 }));
    expect(() => checkCoverageAndHome(s2, 't')).toThrow();
  });
  it('a primary in a close-up of the wrong home room fails', () => {
    const s = fx('750-built');
    // G7.2's home is `top`; put its primary in ground.4 instead.
    const moved = view(s, 'top.1').hotspots.splice(0, 1)[0];
    moved.x = 100;
    moved.y = 100;
    view(s, 'ground.4').hotspots.push(moved);
    expect(() => checkCoverageAndHome(s, 't')).toThrow();
  });
  it('a primary in a room (which has no hotspots) fails', () => {
    const s = fx('80-built');
    const moved = view(s, 'ground.1').hotspots.splice(0, 1)[0];
    view(s, 'ground').hotspots.push(moved);
    expect(() => checkCoverageAndHome(s, 't')).toThrow();
  });
  it('a non-primary part in another room\'s close-up is fine for this rule', () => {
    const s = fx('750-built');
    // G3.2 part b sits in ground.3 with its primary; park it in floor-2.3.
    const g3 = view(s, 'ground.3');
    const part = g3.hotspots.find((h) => h.gagId === 'G3.2' && !h.primary)!;
    g3.hotspots = g3.hotspots.filter((h) => h !== part);
    view(s, 'floor-2.3').hotspots.push({ ...part, x: 100, y: 100 });
    expect(() => checkCoverageAndHome(s, 't')).not.toThrow();
  });
  it('a due gag with no HOME_VIEW entry is a test-data gap, not a pass', () => {
    const s = fx('80-built');
    const saved = HOME_VIEW['G1.1'];
    delete HOME_VIEW['G1.1'];
    try {
      expect(() => checkCoverageAndHome(s, 't')).toThrow();
    } finally {
      HOME_VIEW['G1.1'] = saved;
    }
  });
  it("'beyond' gags are pinned to 750", () => {
    expect(gagsAtOrBefore(750)).toHaveLength(content.gags.length);
    expect(gagsAtOrBefore(610).length).toBeLessThan(content.gags.length);
  });
});

describe('negative: two-part gags (rule 9)', () => {
  it('a two-part gag with one hotspot fails', () => {
    const s = fx('750-built');
    const g3 = view(s, 'ground.3');
    g3.hotspots = g3.hotspots.filter((h) => !(h.gagId === 'G3.2' && !h.primary));
    expect(() => checkTwoPartGags(s, 't')).toThrow();
  });
  it('a two-part gag with two primaries fails; with no primary fails', () => {
    const s = fx('750-built');
    for (const h of view(s, 'ground.3').hotspots) if (h.gagId === 'G4.1') h.primary = true;
    expect(() => checkTwoPartGags(s, 't')).toThrow();
    const s2 = fx('750-built');
    for (const h of view(s2, 'ground.3').hotspots) if (h.gagId === 'G4.1') h.primary = false;
    expect(() => checkTwoPartGags(s2, 't')).toThrow();
  });
  it('a two-part hotspot without a `part` fails', () => {
    const s = fx('750-built');
    delete view(s, 'ground.3').hotspots.find((h) => h.gagId === 'G3.2' && !h.primary)!.part;
    expect(() => checkTwoPartGags(s, 't')).toThrow();
  });
  it('a placeholder-only two-part gag is NOT exempt (D-038)', () => {
    const s = fx('750-built');
    const g3 = view(s, 'ground.3');
    g3.hotspots = g3.hotspots.filter((h) => !(h.gagId === 'G4.1' && !h.primary));
    for (const h of g3.hotspots) if (h.gagId === 'G4.1') h.placeholder = true;
    expect(() => checkTwoPartGags(s, 't')).toThrow();
  });
  it('placeholder hotspots get no leniency from the bounds rule either', () => {
    const s = fx('750-built');
    const g3 = view(s, 'ground.3');
    const h = g3.hotspots.find((x) => x.gagId === 'G5.3')!;
    h.placeholder = true;
    h.x = 500;
    expect(() => checkBounds(s, 't')).toThrow();
  });
  it('G5.1 is single-part in built and two-part in without', () => {
    const built = fx('750-built');
    // The generator emits one G5.1 hotspot in built: legal.
    expect(built.views.flatMap((v) => v.hotspots).filter((h) => h.gagId === 'G5.1')).toHaveLength(1);
    expect(() => checkTwoPartGags(built, 't')).not.toThrow();
    const without = fx('750-without');
    const st = view(without, 'street.1');
    st.hotspots = st.hotspots.filter((h) => !(h.gagId === 'G5.1' && !h.primary));
    expect(() => checkTwoPartGags(without, 't')).toThrow();
  });
});

describe('negative: primary spacing (rule 10)', () => {
  const withGap = (gap: number): SceneFile => {
    const s = fx('80-built');
    view(s, 'ground.1').hotspots = [
      { gagId: 'G1.1', x: 0, y: 0, w: 10, h: 10, primary: true }, // centre (5, 5)
      { gagId: 'G1.2', x: gap, y: 0, w: 10, h: 10, primary: true }, // centre (gap + 5, 5)
    ];
    return s;
  };
  it('centres 23 px apart fail', () => {
    expect(() => checkSpacing(withGap(23), 't')).toThrow();
  });
  it('centres exactly 24 px apart pass', () => {
    expect(() => checkSpacing(withGap(24), 't')).not.toThrow();
  });
  it('the distance is between centres, not edge to edge', () => {
    const s = fx('80-built');
    const c = view(s, 'ground.1');
    c.hotspots = [
      { gagId: 'G1.1', x: 0, y: 0, w: 40, h: 40, primary: true }, // overlapping boxes...
      { gagId: 'G1.2', x: 24, y: 0, w: 40, h: 40, primary: true }, // ...centres exactly 24 apart
    ];
    expect(() => checkSpacing(s, 't')).not.toThrow();
    c.hotspots[1].x = 23;
    expect(() => checkSpacing(s, 't')).toThrow();
  });
  it('the distance is Euclidean: a diagonal of 22.6 fails, 24.04 passes', () => {
    const s = fx('80-built');
    const c = view(s, 'ground.1');
    c.hotspots = [
      { gagId: 'G1.1', x: 0, y: 0, w: 10, h: 10, primary: true },
      { gagId: 'G1.2', x: 16, y: 16, w: 10, h: 10, primary: true }, // hypot(16,16) = 22.6
    ];
    expect(() => checkSpacing(s, 't')).toThrow();
    c.hotspots[1].x = 17;
    c.hotspots[1].y = 17; // hypot(17,17) = 24.04
    expect(() => checkSpacing(s, 't')).not.toThrow();
  });
  it('non-primary parts do not count towards spacing', () => {
    const s = fx('80-built');
    view(s, 'ground.1').hotspots.push({ gagId: 'G1.1', part: 'b', x: 1, y: 1, w: 10, h: 10, primary: false });
    expect(() => checkSpacing(s, 't')).not.toThrow();
  });
});

describe('negative: entries reference the manifest (rule 11)', () => {
  it('an unknown sprite fails', () => {
    const s = fx('80-built');
    view(s, 'ground.1').entries[0].sprite = 'no-such-sprite';
    expect(() => checkEntries(s, 't')).toThrow();
  });
  it('an unknown frame fails (no fallback)', () => {
    const s = fx('80-built');
    view(s, 'ground.1').entries[0].frame = 'no-such-frame';
    expect(() => checkEntries(s, 't')).toThrow();
  });
  it('a numeric frame index fails', () => {
    const s = fx('80-built');
    poke(view(s, 'ground.1').entries[0], 'frame', 0);
    expect(() => checkEntries(s, 't')).toThrow();
  });
  it('entries overhanging a view are fine', () => {
    const s = fx('80-built');
    view(s, 'ground.1').entries[0].x = -500;
    expect(() => checkEntries(s, 't')).not.toThrow();
  });
});

describe('negative: index.json (rule 12)', () => {
  it('schema 1 fails', () => {
    const i = fxIndex();
    i.schema = 1;
    expect(() => checkIndex(i, 't', { strict: false })).toThrow();
  });
  it("beyond other than '750' fails", () => {
    const i = fxIndex();
    i.beyond = '610';
    expect(() => checkIndex(i, 't', { strict: false })).toThrow();
  });
  it('a missing band 750 fails even non-strict (beyond must resolve)', () => {
    const i = fxIndex();
    delete i.bands['750'];
    expect(() => checkIndex(i, 't', { strict: false })).toThrow();
  });
  it('strict demands all 7 bands; non-strict does not', () => {
    const i = fxIndex();
    expect(() => checkIndex(i, 't', { strict: false })).not.toThrow();
    expect(() => checkIndex(i, 't', { strict: true })).toThrow();
    const full = fxIndex();
    for (const b of NUMERIC_BANDS) full.bands[String(b)] = { built: `${b}-built.json`, without: `${b}-without.json` };
    expect(() => checkIndex(full, 't', { strict: true })).not.toThrow();
  });
  it('an empty file name for a state fails', () => {
    const i = fxIndex();
    i.bands['750'].without = '';
    expect(() => checkIndex(i, 't', { strict: false })).toThrow();
  });
});
