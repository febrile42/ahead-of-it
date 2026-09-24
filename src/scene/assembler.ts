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
import { loadEntryImage, loadManifest } from './sprites';
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

/**
 * Draws `view` onto `canvas`. The caller sizes the canvas's own
 * width/height to `view.size.{w,h} * scale` (an integer device-pixel
 * scale — R-25, see chooseScale below) before calling this; the scale is
 * recovered from that ratio so the draw calls below stay in the view's
 * own native-pixel units.
 */
export async function renderScene(
  canvas: HTMLCanvasElement,
  view: SceneView,
  state: 'built' | 'without'
): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const scale = canvas.width / view.size.w || 1;
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, view.size.w, view.size.h);

  const manifest: SpriteManifest = await loadManifest();

  // A3: the painter draws images only — paint order is array order, as
  // exported (the art side's own preview is painted from the same list).
  for (const entry of view.entries) {
    const { image, entry: spriteEntry } = await loadEntryImage(manifest, entry.sprite, entry.frame);
    drawSprite(ctx, image, spriteEntry.anchor, entry.x, entry.y, entry.alpha);
  }

  for (const hotspot of view.hotspots) {
    if (hotspot.placeholder) {
      drawPlaceholderHotspot(ctx, state, hotspot);
    }
  }
}

/**
 * Integer device-pixel scale per SCENE-FORMAT: `s = max(1, floor(cssAvail
 * * dpr / nativeW))`; the caller then sizes the canvas's backing store to
 * `native * s` and its CSS size to `native * s / dpr` (R-25 — pixelated,
 * integer scaling only, DPR-aware unlike PH1-04's chooseScale, m7).
 */
export function chooseScale(cssAvailWidth: number, nativeWidth: number, dpr: number): number {
  return Math.max(1, Math.floor((cssAvailWidth * dpr) / nativeWidth));
}
