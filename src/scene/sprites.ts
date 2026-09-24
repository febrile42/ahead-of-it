// PH1-04: loads public/sprites/manifest.json (PH1-02) and the PNGs it
// names, with a tiny in-memory cache so re-renders (toggle, slider) don't
// re-fetch. Browser-only (uses fetch/Image) — not exercised by vitest,
// covered instead by the Playwright suite (tests/scene.spec.ts).
export interface SpriteFrame {
  duration: number;
  file: string;
}

export interface SpriteManifestEntry {
  anchor: [number, number];
  frames: Record<string, SpriteFrame[]>;
  h: number;
  w: number;
}

export type SpriteManifest = Record<string, SpriteManifestEntry>;

let manifestPromise: Promise<SpriteManifest> | null = null;

export function loadManifest(): Promise<SpriteManifest> {
  if (!manifestPromise) {
    manifestPromise = fetch('/sprites/manifest.json').then((res) => {
      if (!res.ok) throw new Error(`sprites/manifest.json: ${res.status}`);
      return res.json() as Promise<SpriteManifest>;
    });
  }
  return manifestPromise;
}

const imageCache = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(file: string): Promise<HTMLImageElement> {
  let cached = imageCache.get(file);
  if (!cached) {
    cached = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`failed to load sprite ${file}`));
      img.src = `/sprites/${file}`;
    });
    imageCache.set(file, cached);
  }
  return cached;
}

/** Resolves the first frame's image for `name`'s `frameKey` animation (defaults to whatever the manifest has first). */
export async function loadSpriteFrame(
  manifest: SpriteManifest,
  name: string,
  frameKey?: string
): Promise<{ image: HTMLImageElement; entry: SpriteManifestEntry }> {
  const entry = manifest[name];
  if (!entry) throw new Error(`unknown sprite "${name}" in manifest`);
  const key = frameKey && entry.frames[frameKey] ? frameKey : Object.keys(entry.frames)[0];
  const frames = entry.frames[key];
  const image = await loadImage(frames[0].file);
  return { image, entry };
}
