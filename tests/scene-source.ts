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
  primary?: boolean;
  placeholder?: boolean;
}

export interface SceneView {
  id: string;
  kind: 'room' | 'closeup';
  parent?: string;
  label: string;
  size: { w: number; h: number };
  rect?: { x: number; y: number; w: number; h: number };
  default?: boolean;
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
  const index = readIndex();
  const key = band === 'beyond' ? index.beyond : String(band);
  const entry = index.bands[key];
  if (!entry) return 0;
  const fileName = entry[state];
  if (!fileName) return 0;
  const scene = readSceneFile(fileName);
  const view = scene.views.find((v) => v.default) ?? scene.views.find((v) => v.kind === 'closeup') ?? scene.views[0];
  return view ? view.hotspots.length : 0;
}

/** Every band this index.json actually has a scene file for (both states) — used to scope per-view pixel parity to bands that are actually drawn. */
export function drawnBands(): number[] {
  const index = readIndex();
  return Object.keys(index.bands)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
}
