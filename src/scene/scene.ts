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

/** The only schema this painter draws (D-042a): a file of any other schema
 * takes the "not drawn yet" path instead of half-rendering. */
export const SCENE_SCHEMA = 2;

/** One view (D-036, D-042): a `room` (id in {ground, floor-2…floor-6, top,
 * street}, w <= 360, h <= 240, an establishing shot with no gag hotspots)
 * or a `closeup` (id `<room>.<n>`, w <= 180, h <= 120, where gags are
 * tapped). `size` is the view's native pixel dimensions and the only thing
 * the painter reads to draw it; `rect` — a close-up's place inside its
 * parent room, in the parent's coordinates — is read only to position the
 * room's "zoom in" buttons. A close-up's entries, hotspots and `focus` are
 * in its own coordinates, so no offset is ever applied. `focus` is what
 * `.scene-wrap` scrolls to if the view is wider than the viewport. */
export interface SceneView {
  id: string;
  kind: 'room' | 'closeup';
  parent?: string;
  rect?: { x: number; y: number; w: number; h: number };
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
    cached = fetchJson<SceneFile>(`/sprites/scenes/${fileName}`).then((scene) => {
      if (scene.schema !== SCENE_SCHEMA) {
        throw new Error(`sprites/scenes/${fileName}: schema ${scene.schema}, this painter draws schema ${SCENE_SCHEMA}`);
      }
      return scene;
    });
    sceneCache.set(fileName, cached);
  }
  return cached;
}

/** Rooms, in array order (establishing shots; no gag hotspots). */
export function rooms(scene: SceneFile): SceneView[] {
  return scene.views.filter((v) => v.kind === 'room');
}

/** Every close-up in array order — the navigation order, never re-sorted (D-042a). */
export function closeups(scene: SceneFile): SceneView[] {
  return scene.views.filter((v) => v.kind === 'closeup');
}

/** The close-ups whose parent is `roomId`, in array order. */
export function closeupsOf(scene: SceneFile, roomId: string): SceneView[] {
  return scene.views.filter((v) => v.kind === 'closeup' && v.parent === roomId);
}

/** The room a view belongs to: itself for a room, its `parent` for a close-up. */
export function roomOf(scene: SceneFile, view: SceneView): SceneView | undefined {
  return view.kind === 'room' ? view : scene.views.find((v) => v.kind === 'room' && v.id === view.parent);
}

/** Primary hotspots across `candidates` (a room's tab count: what there is to tap in it). */
export function primaryCount(candidates: SceneView[]): number {
  return candidates.reduce((n, v) => n + v.hotspots.filter((h) => h.primary).length, 0);
}

/** D-042 item 6: of `candidates`, the close-up holding the most primaries of the band's own gags (`ownGagIds`); ties go to the earlier one. Computed by the web from the file, so it does not depend on the file's `default` flag (which is only for a band's first paint). */
export function mostOwnPrimaries(candidates: SceneView[], ownGagIds: ReadonlySet<string>): SceneView | undefined {
  let best: SceneView | undefined;
  let bestCount = -1;
  for (const view of candidates) {
    const count = view.hotspots.filter((h) => h.primary && ownGagIds.has(h.gagId)).length;
    if (count > bestCount) {
      best = view;
      bestCount = count;
    }
  }
  return best;
}

/** D-042 item 6: a band's first paint is the close-up with the most of its own primaries, which the exporter flags `default: true` (exactly one per file, always a close-up — the contract test proves it is the one the rule picks). Falls back to the first close-up defensively. */
export function defaultView(scene: SceneFile): SceneView {
  return scene.views.find((v) => v.default) ?? closeups(scene)[0] ?? scene.views[0];
}

/** Looks up a view by id within a scene file, for the switcher / arrow-key navigation. */
export function findView(scene: SceneFile, id: string): SceneView | undefined {
  return scene.views.find((v) => v.id === id);
}
