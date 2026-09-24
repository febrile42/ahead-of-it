// PH1-09: the parsed shape of the art pipeline's scene files
// (docs/product/SCENE-FORMAT.md, D-035/D-036) plus a small cached loader.
//
// The web is a "dumb painter" — art (art/, Python) is the single source of
// what each band looks like, and exports one JSON file per band x state
// under public/sprites/scenes/. This module only parses and caches that
// JSON; src/scene/assembler.ts does the drawing.
import type { BandId } from '../content';

/** A single placement in paint order. `sprite`/`frame` are manifest keys
 * (never file names — SCENE-FORMAT "Rules" #1); `depth` is carried for
 * Phase 2 (walkers inserted between props) even though paint order alone
 * is enough to draw today. `frame` is a manifest frame *key* — a string,
 * strictly (fix round: the doc's own example used a bare integer, but the
 * manifest keys frames by name — `worker-queue` has `a-left`/`b-left`/…,
 * not `0`/`1`/`2`. `loadEntryImage` now throws on a frame key that isn't
 * one of that sprite's own frame keys — no `default`/first-key fallback. */
export interface SceneEntry {
  sprite: string;
  frame: string;
  x: number;
  y: number;
  depth: number;
  gagId?: string;
  part?: string;
  alpha?: number;
}

/** An explicit, art-authored hotspot rect (SCENE-FORMAT A1 — never derived
 * from sprite bounds in the web). `part` distinguishes the pieces of a
 * two-part gag (G4.1, G5.1, …); exactly one part per gag has
 * `primary: true`, and all parts of a gag open the same panel. */
export interface SceneHotspot {
  gagId: string;
  part?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  primary: boolean;
  /** No composer yet for this band: the web draws its own labelled box
   * instead of a sprite (SCENE-FORMAT "Placeholders"). */
  placeholder?: boolean;
}

/** One view (D-036): ids in {ground, floor-2…floor-6, top, street}. `size`
 * is the view's native pixel dimensions (w <= 360, h <= 240). `focus` is
 * what `.scene-wrap` scrolls to if the view is wider than the viewport. */
export interface SceneView {
  id: string;
  label: string;
  size: { w: number; h: number };
  focus: { x: number; y: number; w: number; h: number };
  default?: boolean;
  entries: SceneEntry[];
  hotspots: SceneHotspot[];
}

export interface SceneFile {
  schema: number;
  band: number;
  state: 'built' | 'without';
  views: SceneView[];
}

export interface SceneIndex {
  schema: number;
  bands: Record<string, { built: string; without: string }>;
  /** 'beyond' is an explicit alias of '750' (N-02) — a string band key, not a filename. */
  beyond: string;
  thumbs: Record<string, string>;
  /** Fix round: D-036 rule 7 (primary hotspots >= 44 native px apart)
   * fails on some real, already-shipped bands (band 80 has 5 known
   * pairs) — an art-pass fix, not a painter or contract-test bug. Each
   * pair is an unordered [gagId, gagId] tuple; the contract test skips
   * exactly these pairs (with a console note) and still fails any other
   * pair under 44px. Absent (or empty) on the fixture, which stays strict. */
  knownSpacingDebt?: Array<[string, string]>;
}

let indexPromise: Promise<SceneIndex> | null = null;

function fetchJson<T>(url: string): Promise<T> {
  return fetch(url).then((res) => {
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    return res.json() as Promise<T>;
  });
}

export function loadSceneIndex(): Promise<SceneIndex> {
  if (!indexPromise) {
    indexPromise = fetchJson<SceneIndex>('/sprites/scenes/index.json');
  }
  return indexPromise;
}

/** index.json's `bands` map is keyed by the numeric band as a string; 'beyond' resolves through `index.beyond` (N-02, never grows past 750). */
function bandKey(band: BandId): string {
  return band === 'beyond' ? '' : String(band);
}

const sceneCache = new Map<string, Promise<SceneFile>>();

/** Loads (and caches by file name) the scene file for `band` x `state`. */
export async function loadScene(band: BandId, state: 'built' | 'without'): Promise<SceneFile> {
  const index = await loadSceneIndex();
  const key = band === 'beyond' ? index.beyond : bandKey(band);
  const entry = index.bands[key];
  const fileName = entry?.[state];
  if (!fileName) {
    throw new Error(`sprites/scenes/index.json has no ${state} entry for band ${band}`);
  }
  let cached = sceneCache.get(fileName);
  if (!cached) {
    cached = fetchJson<SceneFile>(`/sprites/scenes/${fileName}`);
    sceneCache.set(fileName, cached);
  }
  return cached;
}

/** D-036 rule 6: default view = most primaries among the current band's gags, ties to the earlier view — already decided by the exporter and flagged `default: true`. Falls back to the first view defensively. */
export function defaultView(scene: SceneFile): SceneView {
  return scene.views.find((v) => v.default) ?? scene.views[0];
}

/** Looks up a view by id within a scene file, for the switcher / arrow-key navigation. */
export function findView(scene: SceneFile, id: string): SceneView | undefined {
  return scene.views.find((v) => v.id === id);
}
