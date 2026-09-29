// D-057 items 1-5 (PH3-02, DIA-235): composes one share image (1200x630)
// onto #share-canvas for scripts/render-share-images.mjs to capture.
//
// `share-flag`, `share-caption` and `share-url` (DIA-246, Art Director) are
// in public/sprites/manifest.json with the `shareScale` this reads. Room
// selection, layout and flag points are real and already covered by
// src/scene/share-image.test.ts.
import { renderScene } from '../src/scene/assembler';
import { loadEntryImage, loadManifest } from '../src/scene/sprites';
import type { SpriteManifestEntry } from '../src/scene/sprites';
import { loadScene } from '../src/scene/scene';
import { ownGagIdsForStop, pickShareFlags, pickShareRoom, sceneBandForStop } from '../src/scene/share-image';
import type { ShareStop } from '../src/scene/share-image';

const CARD_W = 1200;
const CARD_H = 630;
const PICTURE_W = 752; // D-057 item 4: picture region, x 0-752
const ROOM_SCALE = 2;
const MAT_COLOR = '#fff'; // D-046: the building never goes dark — style.css's light --page-bg

/** D-057 item 5: "shareScale" is recorded per manifest entry once the Art
 * Director exports these sprites (SCENE-FORMAT § Share sprites); it isn't
 * in the manifest type yet (src/scene/sprites.ts's SpriteManifestEntry),
 * so this reads it defensively rather than widening that shared type for a
 * field only this dev page uses today. */
function shareScaleOf(entry: SpriteManifestEntry): number {
  return (entry as unknown as { shareScale?: number }).shareScale ?? 1;
}

async function renderShareImage(stop: ShareStop): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>('#share-canvas');
  if (!canvas) throw new Error('share-render: #share-canvas not found');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('share-render: 2d context unavailable');

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = MAT_COLOR;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  const sceneBand = sceneBandForStop(stop);
  const scene = await loadScene(sceneBand, 'without');
  const orderedGagIds = ownGagIdsForStop(stop);
  const ownGagIds = new Set(orderedGagIds);
  const room = pickShareRoom(scene, ownGagIds);
  const flags = pickShareFlags(scene, room, ownGagIds, orderedGagIds);

  // D-057 item 4: the room "at integer scale 2 ... centred" within the
  // picture region — rendered to its own offscreen canvas (renderScene
  // always paints from its own view's (0,0)) then composited at an offset.
  const roomCanvas = document.createElement('canvas');
  roomCanvas.width = room.size.w * ROOM_SCALE;
  roomCanvas.height = room.size.h * ROOM_SCALE;
  await renderScene(roomCanvas, room, 'without');

  const offsetX = Math.round((PICTURE_W - roomCanvas.width) / 2);
  const offsetY = Math.round((CARD_H - roomCanvas.height) / 2);
  ctx.drawImage(roomCanvas, offsetX, offsetY);

  // D-057 item 5: up to three flags, each drawn at scale 2 with its own
  // anchor on the gag's point (room-local coords + this composite's offset).
  const manifest = await loadManifest();
  for (const flag of flags) {
    const { image, entry } = await loadEntryImage(manifest, 'share-flag', 'default');
    const scale = shareScaleOf(entry);
    const x = offsetX + flag.x * ROOM_SCALE;
    const y = offsetY + flag.y * ROOM_SCALE;
    ctx.drawImage(image, x - entry.anchor[0] * scale, y - entry.anchor[1] * scale, image.width * scale, image.height * scale);
  }

  // D-057 item 3-4: caption + URL, right region (x 768-1168), letters as
  // sprites (never canvas text — A3, PH1-06). The caption sprite's own
  // source string is asserted equal to content.json's copy.shareCaption by
  // the art check, not here; this only draws it by key.
  const wordsLeft = 768;
  const { image: captionImage, entry: captionEntry } = await loadEntryImage(manifest, 'share-caption', 'default');
  const captionScale = shareScaleOf(captionEntry);
  const captionY = CARD_H / 2 - (captionImage.height * captionScale) / 2 - 20;
  ctx.drawImage(captionImage, wordsLeft, captionY, captionImage.width * captionScale, captionImage.height * captionScale);

  const { image: urlImage, entry: urlEntry } = await loadEntryImage(manifest, 'share-url', String(stop));
  const urlScale = shareScaleOf(urlEntry);
  const urlY = captionY + captionImage.height * captionScale + 16;
  ctx.drawImage(urlImage, wordsLeft, urlY, urlImage.width * urlScale, urlImage.height * urlScale);
}

// scripts/render-share-images.mjs drives this via page.evaluate — kept off
// `window` under a single namespaced key so it can't collide with anything
// a future dev page on this same origin adds.
declare global {
  interface Window {
    __shareRender__?: { render: typeof renderShareImage };
  }
}
window.__shareRender__ = { render: renderShareImage };
