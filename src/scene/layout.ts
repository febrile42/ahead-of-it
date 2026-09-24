// PH1-04 tile-grid building assembler — the pure, DOM-free half (brief 3b).
//
// computeLayout(band, state) turns a band + toggle state into a list of
// draw instructions: floor/wall tiles per tower, and one hotspot per gag
// placement part. It never touches the DOM or canvas so it is directly
// unit-testable (src/scene/layout.test.ts). src/scene/assembler.ts is the
// thin canvas-drawing layer that consumes this output, and src/ui/panel.ts
// positions real <button> hotspots from the same `hotspots` array so the
// buttons and the picture never disagree.
import { getGags } from '../content';
import type { BandId, Gag } from '../content';
import { isAtLeast } from './bands';
import { floorCountForBand, mapPinCount, GAG_PLACEMENTS, SLOTS } from './slots';
import type { SlotId, Tower } from './slots';

/**
 * Logical pixel-art raster buffer, before any integer viewport scale
 * (R-25). Wider than a phone viewport on purpose — see the comment above
 * SLOTS in slots.ts: cell spacing is sized for a real 44px tap target at
 * 1x, which makes the whole scene wider than 390px. .scene-wrap scrolls
 * horizontally at narrow widths (R-20 allows pan for this reason).
 */
export const BUFFER_W = 680;
export const BUFFER_H = 520;

export const FLOOR_HEIGHT = 50;
export const HQ_ORIGIN = { x: 20, y: 380 };
export const INSET_ORIGIN = { x: 500, y: 380 };
export const STREET_ORIGIN = { x: 420, y: 400 };

export type Emphasis = 'current' | 'quiet';
export type SpriteKind = 'badge-reader' | 'placeholder';

export interface Hotspot {
  /** `${gag.id}` for single-part gags, `${gag.id}#${index}` for multi-part ones (G4.1, G5.1). */
  hotspotId: string;
  gagId: string;
  slot: SlotId;
  x: number;
  y: number;
  w: number;
  h: number;
  emphasis: Emphasis;
  spriteKind: SpriteKind;
}

export interface FloorTile {
  tower: Tower;
  floorIndex: number;
  x: number;
  y: number;
}

export interface MapPin {
  index: number;
  x: number;
  y: number;
}

export interface SceneLayout {
  band: BandId;
  state: 'built' | 'without';
  bufferW: number;
  bufferH: number;
  hqFloors: number;
  hasInset: boolean;
  hasStreet: boolean;
  hasMap: boolean;
  hasTop: boolean;
  tiles: FloorTile[];
  mapPins: MapPin[];
  hotspots: Hotspot[];
}

function towerOrigin(tower: Tower): { x: number; y: number } {
  if (tower === 'inset') return INSET_ORIGIN;
  if (tower === 'street') return STREET_ORIGIN;
  if (tower === 'overlay') return { x: BUFFER_W - 130, y: 10 };
  return HQ_ORIGIN;
}

/** Floor tiles for every tower/floor visible at this band, back-to-front (bottom floor first). */
function computeTiles(band: BandId): { tiles: FloorTile[]; hasInset: boolean; hasTop: boolean } {
  const tiles: FloorTile[] = [];
  const hqFloors = floorCountForBand(band);
  for (let f = 0; f < hqFloors; f += 1) {
    tiles.push({ tower: 'hq', floorIndex: f, x: HQ_ORIGIN.x, y: HQ_ORIGIN.y - f * FLOOR_HEIGHT });
  }
  const hasInset = isAtLeast(band, 150);
  if (hasInset) {
    tiles.push({ tower: 'inset', floorIndex: 0, x: INSET_ORIGIN.x, y: INSET_ORIGIN.y });
  }
  const hasTop = isAtLeast(band, 610);
  return { tiles, hasInset, hasTop };
}

function computeMapPins(band: BandId): MapPin[] {
  const count = mapPinCount(band);
  const origin = towerOrigin('overlay');
  const pins: MapPin[] = [];
  for (let i = 0; i < count; i += 1) {
    pins.push({ index: i, x: origin.x + 14 + (i % 3) * 30, y: origin.y + 20 + Math.floor(i / 3) * 24 });
  }
  return pins;
}

function cellPosition(slot: SlotId, cell: number): { x: number; y: number; w: number; h: number } {
  const info = SLOTS[slot];
  const origin = towerOrigin(info.tower);
  const col = cell % info.subGrid.cols;
  const row = Math.floor(cell / info.subGrid.cols);
  const floorY = info.tower === 'hq' ? -info.floorIndex * FLOOR_HEIGHT : 0;
  return {
    x: origin.x + info.anchor.x + col * info.subGrid.cellW,
    y: origin.y + info.anchor.y + row * info.subGrid.cellH + floorY,
    w: info.subGrid.cellW - 2,
    h: info.subGrid.cellH - 2,
  };
}

/**
 * Every gag active at `band` (R-03a: cumulative — a gag's band <= the
 * current band) gets a hotspot. Gags whose own band is strictly earlier
 * than the current band are de-emphasised: R-03a's "earlier bands' items
 * rendered at reduced prominence" is implemented here as opacity 0.55 and
 * an 80% box, applied identically in both states. Beyond reuses exactly
 * the 750 set (no growth past 750 — brief item 3a / N-02).
 */
function computeHotspots(band: BandId): Hotspot[] {
  const gags: Gag[] = getGags();
  const currentTier = band === 'beyond' ? 750 : band;
  const hotspots: Hotspot[] = [];
  for (const gag of gags) {
    // gag.band is always numeric in practice (no gag carries band: 'beyond'
    // — that band is the separate Beyond panel), but the type is shared
    // with BandId, hence the narrowing cast rather than a direct compare.
    const gagTier = gag.band === 'beyond' ? 750 : gag.band;
    if (gagTier > currentTier) continue; // not built yet at this band
    const parts = GAG_PLACEMENTS[gag.id];
    if (!parts) continue; // defensive: every real gag id has an entry, checked by a test
    const emphasis: Emphasis = gagTier === currentTier ? 'current' : 'quiet';
    parts.forEach((part, index) => {
      const pos = cellPosition(part.slot, part.cell);
      const scale = emphasis === 'current' ? 1 : 0.8;
      const w = pos.w * scale;
      const h = pos.h * scale;
      hotspots.push({
        hotspotId: parts.length > 1 ? `${gag.id}#${index}` : gag.id,
        gagId: gag.id,
        slot: part.slot,
        x: pos.x + (pos.w - w) / 2,
        y: pos.y + (pos.h - h) / 2,
        w,
        h,
        emphasis,
        spriteKind: gag.id === 'G6.4' ? 'badge-reader' : 'placeholder',
      });
    });
  }
  return hotspots;
}

export function computeLayout(band: BandId, state: 'built' | 'without'): SceneLayout {
  const { tiles, hasInset, hasTop } = computeTiles(band);
  const hasMap = isAtLeast(band, 490);
  return {
    band,
    state,
    bufferW: BUFFER_W,
    bufferH: BUFFER_H,
    hqFloors: floorCountForBand(band),
    hasInset,
    hasStreet: hasInset, // the street exists exactly when there's somewhere for it to lead (150+)
    hasMap,
    hasTop,
    tiles,
    mapPins: hasMap ? computeMapPins(band) : [],
    hotspots: computeHotspots(band),
  };
}
