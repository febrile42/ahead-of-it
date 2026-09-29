// Shared by every Playwright spec that needs scene-file data: picks the
// real export if it exists, the hand-written fixture otherwise, and
// never masks one with the other (fix round item 2 — a merge that lands
// the real public/sprites/scenes/ must make these specs start asserting
// real geometry with no code change here).
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';

const realDir = fileURLToPath(new URL('../public/sprites/scenes/', import.meta.url));
const fixturesDir = fileURLToPath(new URL('./fixtures/', import.meta.url));

export interface SceneIndex {
  bands: Record<string, { built: string; without: string }>;
  beyond: string;
}

export interface SceneHotspot {
  gagId: string;
  part?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  primary?: boolean;
  placeholder?: boolean;
  /** D-047 (DIA-133): an exporter-set point, inside this hotspot's own
   * rect, that the web centres the button/reticle on instead of the
   * rect's own centre — set only where the rect's centre would put a
   * tick on sign lettering. */
  marker?: { x: number; y: number };
}

/** PH2-01 Part B (SCENE-FORMAT § Motion): just enough of an entry for specs
 * to tell whether it can actually be seen — `x`/`y` are in the *view's own*
 * coordinates (never offset for a close-up), so an entry the room shares
 * with a close-up but that falls outside that close-up's crop is present in
 * the exported array but paints nothing there (the canvas clips it, same as
 * any other out-of-bounds draw). */
export interface SceneEntry {
  x: number;
  y: number;
  motion?: unknown;
}

export interface SceneView {
  id: string;
  kind: 'room' | 'closeup';
  parent?: string;
  label: string;
  size: { w: number; h: number };
  rect?: { x: number; y: number; w: number; h: number };
  default?: boolean;
  entries: SceneEntry[];
  hotspots: SceneHotspot[];
}

export interface SceneFile {
  band: number;
  state: 'built' | 'without';
  views: SceneView[];
}

/** True once the D-042 exporter has landed: `public/sprites/scenes/` exists AND is schema 2. While it is schema 1 the painter refuses it ("not drawn yet"), so the specs run on the hand-written fixtures instead — and start asserting the real export the moment it is schema 2, with no change here. */
export function hasRealScenes(): boolean {
  if (!existsSync(`${realDir}index.json`)) return false;
  return (JSON.parse(readFileSync(`${realDir}index.json`, 'utf-8')) as { schema?: number }).schema === 2;
}

export function sceneSourceDir(): string {
  return hasRealScenes() ? realDir : fixturesDir;
}

export function readIndex(): SceneIndex {
  return JSON.parse(readFileSync(`${sceneSourceDir()}index.json`, 'utf-8')) as SceneIndex;
}

export function readSceneFile(fileName: string): SceneFile {
  return JSON.parse(readFileSync(`${sceneSourceDir()}${fileName}`, 'utf-8')) as SceneFile;
}

/**
 * Serves the hand-written band-80 and band-750 fixtures at the real `/sprites/scenes/…`
 * URLs the app fetches — but ONLY when the real export doesn't exist yet.
 * When it does, this is a no-op and every request hits the dev/preview
 * server's actual public/sprites/scenes/ directory: a merge that lands
 * PH1-08b's output must never have it masked by the fixture.
 */
export async function interceptFixtureScenes(page: Page): Promise<void> {
  if (hasRealScenes()) return;
  const index = readFileSync(`${fixturesDir}index.json`, 'utf-8');
  await page.route('**/sprites/scenes/index.json', (route) =>
    route.fulfill({ contentType: 'application/json', body: index })
  );
  for (const fileName of ['80-built.json', '80-without.json', '750-built.json', '750-without.json']) {
    const body = readFileSync(`${fixturesDir}${fileName}`, 'utf-8');
    await page.route(`**/sprites/scenes/${fileName}`, (route) =>
      route.fulfill({ contentType: 'application/json', body })
    );
  }
}

/** Reads the scene file for `band`/`state`, or undefined for a band this
 * index has no entry (or no file for that state) for yet — same "not drawn
 * yet" case `expectedHotspotCount` treats as zero. */
export function readBandSceneFile(band: number | 'beyond', state: 'built' | 'without'): SceneFile | undefined {
  const index = readIndex();
  const key = band === 'beyond' ? index.beyond : String(band);
  const entry = index.bands[key];
  const fileName = entry?.[state];
  return fileName ? readSceneFile(fileName) : undefined;
}

/** Whichever view a fresh load of `scene` lands on (mirrors src/main.ts's
 * `defaultView` fallback: the marked `default` view, else the first
 * close-up, else the first view at all). */
function pickDefaultView(scene: SceneFile): SceneView | undefined {
  return scene.views.find((v) => v.default) ?? scene.views.find((v) => v.kind === 'closeup') ?? scene.views[0];
}

/** DIA-257: the hotspots the app actually turns into buttons — only
 * primaries (src/main.ts's toSceneLayout); a two-part gag's other part is
 * scenery. */
export function renderedHotspots(view: SceneView): SceneHotspot[] {
  return view.hotspots.filter((h) => h.primary);
}

/**
 * The hotspot count the app will actually render for `band`/`state`:
 * whichever view is `default` in that band's scene file (mirrors
 * src/scene/scene.ts's defaultView + src/main.ts resetting
 * currentViewId on band change). A band absent from the index (no scene
 * file at all yet) renders the "not drawn yet" placeholder — 0 hotspots.
 * A band whose only hotspots are `placeholder: true` still counts them
 * (SCENE-FORMAT's placeholder mechanism draws real, clickable hotspots,
 * just with a labelled box instead of art).
 */
export function expectedHotspotCount(band: number | 'beyond', state: 'built' | 'without'): number {
  const scene = readBandSceneFile(band, state);
  const view = scene && pickDefaultView(scene);
  return view ? renderedHotspots(view).length : 0;
}

/** Every gagId with a hotspot in `band`/`state`'s *default* view — the view
 * a fresh load or a slider change to that band actually lands on. DIA-56:
 * a real schema-2 export's default view is a close-up, not necessarily the
 * one holding any particular gag, so a spec choosing "a gag not on the
 * band-750 screen" must check this instead of assuming it. */
export function defaultViewGagIds(band: number | 'beyond', state: 'built' | 'without'): string[] {
  const scene = readBandSceneFile(band, state);
  const view = scene && pickDefaultView(scene);
  return view ? renderedHotspots(view).map((h) => h.gagId) : [];
}

/** Every gagId with a hotspot anywhere in `band`/`state`'s scene, across
 * every view (not just the default one). */
export function allGagIds(band: number | 'beyond', state: 'built' | 'without'): string[] {
  const scene = readBandSceneFile(band, state);
  return scene ? scene.views.flatMap((v) => renderedHotspots(v).map((h) => h.gagId)) : [];
}

/** The view holding `gagId`'s hotspot in `band`/`state`'s scene, if any —
 * the lookup `showGag` (interaction-helpers.ts) needs to walk the stepper
 * to a specific gag regardless of which close-up now holds it. */
export function findGagView(
  band: number | 'beyond',
  state: 'built' | 'without',
  gagId: string
): SceneView | undefined {
  const scene = readBandSceneFile(band, state);
  return scene?.views.find((v) => renderedHotspots(v).some((h) => h.gagId === gagId));
}

/** True if `view` has at least one `motion` entry positioned inside its own
 * bounds — an entry the exporter carried into a close-up for depth/z-order
 * reasons but that falls outside its crop still has `motion`, but never
 * paints there, so a spec asserting "this view visibly animates" needs this
 * check, not just "has a motion entry" (PH2-01 Part B, DIA-100). */
function hasVisibleMotion(view: SceneView): boolean {
  return view.entries.some((e) => e.motion && e.x >= 0 && e.x < view.size.w && e.y >= 0 && e.y < view.size.h);
}

/**
 * The close-up a spec should actually animate against for `band`/`state`:
 * the band's default view if it visibly animates, else the first close-up
 * (in stepper order) that does. `undefined` if no close-up in this scene has
 * any visible motion at all (not expected for real content — every band's
 * default view does today — but a spec should fail loudly on that rather
 * than silently asserting against a still picture).
 */
export function firstVisiblyAnimatedCloseup(band: number | 'beyond', state: 'built' | 'without'): string | undefined {
  const scene = readBandSceneFile(band, state);
  if (!scene) return undefined;
  const closeupViews = scene.views.filter((v) => v.kind === 'closeup');
  const def = pickDefaultView(scene);
  if (def && hasVisibleMotion(def)) return def.id;
  return closeupViews.find(hasVisibleMotion)?.id;
}

/** Every band this index.json actually has a scene file for (both states) — used to scope per-view pixel parity to bands that are actually drawn. */
export function drawnBands(): number[] {
  const index = readIndex();
  return Object.keys(index.bands)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
}
