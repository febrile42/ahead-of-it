// PH1-09 painter — the canvas half. D-035 replaced the PH1-04 tile-grid
// elevation (floor strips, generic desk/worker, coloured labelled boxes
// for every gag) with a "dumb painter": the art pipeline exports a scene
// file per band x state (docs/product/SCENE-FORMAT.md) and this module
// draws exactly what it says, in order, nothing invented.
//
// What's kept from PH1-04 (docs/briefs/PH1-04-REVIEW.md §b): the
// labelled-box code, now drawn only for hotspots the exporter has
// explicitly flagged `placeholder: true` — bands with no composer yet
// (SCENE-FORMAT "Placeholders"). Everything else (floor strips, street
// dots, the map box, generic desk/worker filler) is gone; that geography
// is now real sprite entries in the scene file.
import type { SceneView } from './scene';
import { resolveEntryAt } from './motion-playback';
import { loadEntryImage, loadFrameFile, loadManifest } from './sprites';
import type { SpriteManifest } from './sprites';

const PLACEHOLDER_WITHOUT = '#FF3DAE';
const PLACEHOLDER_BUILT = '#22C7B8';
const PLACEHOLDER_TEXT = '#0B0B0B';

function drawSprite(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  anchor: [number, number],
  x: number,
  y: number,
  alpha?: number
) {
  if (alpha !== undefined) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(image, x - anchor[0], y - anchor[1], image.width, image.height);
    ctx.restore();
    return;
  }
  ctx.drawImage(image, x - anchor[0], y - anchor[1], image.width, image.height);
}

/** SCENE-FORMAT "Placeholders": no composer yet for this hotspot's gag, so
 * the web draws its own labelled box instead of a (nonexistent) sprite —
 * the same "obviously placeholder" treatment PH1-04 used everywhere,
 * scoped down to just the bands that still need it. */
function drawPlaceholderHotspot(
  ctx: CanvasRenderingContext2D,
  state: 'built' | 'without',
  hotspot: SceneView['hotspots'][number]
) {
  ctx.save();
  ctx.fillStyle = state === 'built' ? PLACEHOLDER_BUILT : PLACEHOLDER_WITHOUT;
  ctx.fillRect(hotspot.x, hotspot.y, hotspot.w, hotspot.h);
  ctx.setLineDash([2, 2]);
  ctx.strokeStyle = '#1A1410';
  ctx.strokeRect(hotspot.x, hotspot.y, hotspot.w, hotspot.h);
  ctx.setLineDash([]);
  ctx.fillStyle = PLACEHOLDER_TEXT;
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(hotspot.gagId, hotspot.x + hotspot.w / 2, hotspot.y + hotspot.h / 2 + 2);
  ctx.restore();
}

interface ResolvedDraw {
  image: HTMLImageElement;
  anchor: [number, number];
  x: number;
  y: number;
  alpha?: number;
}

/** Resolves one entry's image and position — no canvas access, so every
 * entry can load concurrently (Promise.all in renderScene below) instead of
 * one `await` per entry serialising the whole view behind each other's image
 * decode. */
async function resolveDraw(entry: SceneView['entries'][number], manifest: SpriteManifest, t?: number): Promise<ResolvedDraw> {
  if (t !== undefined && entry.motion) {
    const manifestEntry = manifest[entry.sprite];
    if (manifestEntry) {
      const resolved = resolveEntryAt(entry, manifestEntry, t);
      const { image } = await loadFrameFile(manifest, entry.sprite, resolved.frameKey, resolved.fileIndex);
      return { image, anchor: manifestEntry.anchor, x: resolved.x, y: resolved.y, alpha: entry.alpha };
    }
  }
  const { image, entry: spriteEntry } = await loadEntryImage(manifest, entry.sprite, entry.frame);
  return { image, anchor: spriteEntry.anchor, x: entry.x, y: entry.y, alpha: entry.alpha };
}

/**
 * Draws `view` onto `canvas`. The caller sizes the canvas's own
 * width/height to `view.size.{w,h} * scale` (an integer device-pixel
 * scale — R-25, see chooseScale below) before calling this; the scale is
 * recovered from that ratio so the draw calls below stay in the view's
 * own native-pixel units.
 *
 * `t` (PH2-01 Part B, SCENE-FORMAT § Motion) is ms since the current scene
 * file was first painted. Omitted (or an entry with no `motion`), an entry
 * paints exactly what it painted before this parameter existed — its
 * `frame`'s first file at its own `(x, y)` — which is what keeps every
 * existing caller and every pixel-parity golden byte-identical. Passed, an
 * entry with `motion` paints `resolveEntryAt`'s frame/position for that `t`
 * instead; this is the only place that resolution feeds into an actual
 * paint (src/main.ts's ticker calls it to *decide whether to*, but always
 * repaints by calling back in here).
 *
 * `isStale` (review fix R1/R2, DIA-100 PR #48): every image is resolved
 * first (an entry's first play of a given file is a real, uncached decode),
 * *then* `isStale` is checked, and only if it says no does the function
 * touch the canvas at all — `setTransform`/`clearRect`/every `drawImage`
 * run back-to-back with no `await` between them, so the canvas never shows
 * a cleared-but-not-yet-redrawn frame (R1: the old code cleared first, then
 * awaited each entry's image in turn) and a paint that started before a
 * newer one (a `render()`, a reduced-motion rest pose) can never land after
 * it and stomp it (R2). Returns whether it actually painted, so a caller
 * that skipped a stale paint can tell "nothing changed" apart from "this
 * result is void" (N3).
 */
export async function renderScene(
  canvas: HTMLCanvasElement,
  view: SceneView,
  state: 'built' | 'without',
  t?: number,
  isStale?: () => boolean
): Promise<boolean> {
  const manifest: SpriteManifest = await loadManifest();

  // A3/D-035: the painter draws images only, in array order, as exported
  // (the art side's own preview is painted from the same list) — a moving
  // entry never changes that order, only which file and (x, y) it paints.
  // Promise.all preserves that order regardless of which image resolves
  // first.
  const draws = await Promise.all(view.entries.map((entry) => resolveDraw(entry, manifest, t)));

  if (isStale?.()) return false;

  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  const scale = canvas.width / view.size.w || 1;
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, view.size.w, view.size.h);

  for (const draw of draws) {
    drawSprite(ctx, draw.image, draw.anchor, draw.x, draw.y, draw.alpha);
  }

  for (const hotspot of view.hotspots) {
    if (hotspot.placeholder) {
      drawPlaceholderHotspot(ctx, state, hotspot);
    }
  }
  return true;
}

/**
 * Integer device-pixel scale, on both axes (fix round item 7 — review
 * fix 4): `s = max(1, min(floor(cssAvailW*dpr/nativeW),
 * floor(cssAvailH*dpr/nativeH)))`. Taking the *smaller* of the two axis
 * scales is what stops a view from overflowing `.scene-wrap` vertically
 * — `.scene-wrap`'s box is capped at the D-036 360:240 aspect ratio
 * (style.css), so a view whose height would want scale 2 but whose
 * width only earns scale 1 has to render at scale 1 on both axes, not
 * grow past the box on one of them. The caller then sizes the canvas's
 * backing store to `native * s` and its CSS size to `native * s / dpr`
 * (R-25 — pixelated, integer scaling only, DPR-aware unlike PH1-04's
 * chooseScale, m7).
 */
export function chooseScale(
  cssAvailWidth: number,
  cssAvailHeight: number,
  nativeWidth: number,
  nativeHeight: number,
  dpr: number
): number {
  const scaleW = Math.floor((cssAvailWidth * dpr) / nativeWidth);
  const scaleH = Math.floor((cssAvailHeight * dpr) / nativeHeight);
  return Math.max(1, Math.min(scaleW, scaleH));
}
