// PH1-04 tile-grid building assembler — the canvas half (brief 3b).
//
// Consumes computeLayout()'s pure output (src/scene/layout.ts) and draws
// it: real floor/wall/desk/worker sprites from the PH1-02 manifest dress
// the building generically; every gag placement is a labelled placeholder
// (coloured block + gag id) *except* G6.4, which reuses the real
// badge-reader-green/red sprites because they already encode built/without
// for that exact gag ("the badge that doesn't").
//
// Placeholder colours are deliberately outside art/palette.json (a hot
// magenta/cyan pair with a dashed outline) so they read as scaffolding,
// never mistaken for finished art — "obviously placeholders" per the
// brief's boundary. R-03a's de-emphasis treatment: earlier-band items are
// already boxed 20% smaller by computeLayout(); this module additionally
// draws them at 55% opacity. Both rules apply identically in both states.
import type { SceneLayout } from './layout';
import { HQ_ORIGIN, INSET_ORIGIN, STREET_Y } from './layout';
import { loadManifest, loadSpriteFrame } from './sprites';
import type { SpriteManifest } from './sprites';

const PLACEHOLDER_WITHOUT = '#FF3DAE';
const PLACEHOLDER_BUILT = '#22C7B8';
const PLACEHOLDER_TEXT = '#0B0B0B';

const HQ_FLOOR_TILE_COLS = 5;
const INSET_FLOOR_TILE_COLS = 3;

function drawSprite(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  anchor: [number, number],
  x: number,
  y: number
) {
  ctx.drawImage(image, x - anchor[0], y - anchor[1], image.width, image.height);
}

async function drawFloorAndWalls(
  ctx: CanvasRenderingContext2D,
  manifest: SpriteManifest,
  layout: SceneLayout
) {
  const floor = await loadSpriteFrame(manifest, 'floor');
  const wall = await loadSpriteFrame(manifest, 'wall');
  const desk = await loadSpriteFrame(manifest, 'desk');
  const worker = await loadSpriteFrame(manifest, 'worker', 'down');

  for (const tile of layout.tiles) {
    const cols = tile.tower === 'hq' ? HQ_FLOOR_TILE_COLS : INSET_FLOOR_TILE_COLS;
    for (let col = 0; col < cols; col += 1) {
      const x = tile.x + col * (floor.entry.w / 2);
      const y = tile.y + col * (floor.entry.h / 2);
      drawSprite(ctx, floor.image, floor.entry.anchor, x, y);
    }
    // Back wall at the floor's left edge.
    drawSprite(ctx, wall.image, wall.entry.anchor, tile.x, tile.y);
    // A little generic staffing: one desk + one (static) worker per floor,
    // not tied to any gag — real assets, decorative only (R-07/R-08's
    // animation is Phase 2; this is a single static frame).
    const deskCol = Math.floor(cols / 2);
    const deskX = tile.x + deskCol * (floor.entry.w / 2) + 4;
    const deskY = tile.y + deskCol * (floor.entry.h / 2) - 2;
    drawSprite(ctx, desk.image, desk.entry.anchor, deskX, deskY);
    drawSprite(ctx, worker.image, worker.entry.anchor, deskX + 10, deskY + 2);
  }

  if (layout.hasStreet) {
    // The street between HQ and the inset office (from 150), drawn as a
    // simple dotted ground line using floor tiles at reduced opacity.
    ctx.save();
    ctx.globalAlpha = 0.5;
    const startX = HQ_ORIGIN.x + 90;
    const endX = INSET_ORIGIN.x;
    for (let x = startX; x < endX; x += 10) {
      ctx.fillStyle = '#8F5A34';
      ctx.fillRect(x, STREET_Y + 6, 4, 2);
    }
    ctx.restore();
  }

  if (layout.hasMap) {
    ctx.save();
    ctx.strokeStyle = '#1A1410';
    ctx.fillStyle = '#EAFBFF';
    const box = { x: layout.bufferW - 60, y: 2, w: 56, h: 40 };
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.strokeRect(box.x, box.y, box.w, box.h);
    ctx.fillStyle = '#1A1410';
    ctx.font = '6px monospace';
    ctx.fillText('MAP', box.x + 4, box.y + 8);
    ctx.fillStyle = '#D9432C';
    for (const pin of layout.mapPins) {
      ctx.beginPath();
      ctx.arc(pin.x, pin.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

async function drawHotspot(
  ctx: CanvasRenderingContext2D,
  manifest: SpriteManifest,
  layout: SceneLayout,
  hotspot: SceneLayout['hotspots'][number]
) {
  ctx.save();
  ctx.globalAlpha = hotspot.emphasis === 'quiet' ? 0.55 : 1;

  if (hotspot.spriteKind === 'badge-reader') {
    const frameKey = layout.state === 'built' ? 'green' : 'red';
    const sprite = await loadSpriteFrame(manifest, 'badge-reader', frameKey);
    const scale = Math.max(0.6, hotspot.w / sprite.entry.w);
    ctx.translate(hotspot.x, hotspot.y);
    ctx.scale(scale, scale);
    ctx.drawImage(sprite.image, 0, 0);
    ctx.restore();
    return;
  }

  const color = layout.state === 'built' ? PLACEHOLDER_BUILT : PLACEHOLDER_WITHOUT;
  ctx.fillStyle = color;
  ctx.fillRect(hotspot.x, hotspot.y, hotspot.w, hotspot.h);
  ctx.setLineDash([2, 2]);
  ctx.strokeStyle = '#1A1410';
  ctx.strokeRect(hotspot.x, hotspot.y, hotspot.w, hotspot.h);
  ctx.setLineDash([]);
  ctx.fillStyle = PLACEHOLDER_TEXT;
  ctx.font = '6px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(hotspot.gagId, hotspot.x + hotspot.w / 2, hotspot.y + hotspot.h / 2 + 2);
  ctx.restore();
}

/** Draws `layout` onto `canvas`'s 2D context at 1 logical px = 1 canvas-space unit (the caller applies the integer viewport scale via ctx transform or CSS). */
export async function renderScene(canvas: HTMLCanvasElement, layout: SceneLayout): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, layout.bufferW, layout.bufferH);

  // Sky/ground backdrop.
  ctx.fillStyle = '#EAFBFF';
  ctx.fillRect(0, 0, layout.bufferW, layout.bufferH);
  ctx.fillStyle = '#D9C9A3';
  ctx.fillRect(0, layout.bufferH - 20, layout.bufferW, 20);

  const manifest = await loadManifest();
  await drawFloorAndWalls(ctx, manifest, layout);
  for (const hotspot of layout.hotspots) {
    await drawHotspot(ctx, manifest, layout, hotspot);
  }
}

/** Integer scale factor for the viewport (R-25: pixelated, integer scaling only). */
export function chooseScale(viewportWidth: number, bufferWidth: number): number {
  return Math.max(1, Math.floor(viewportWidth / bufferWidth));
}
