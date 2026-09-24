// PH1-04 slot map (brief addendum, 2026-09-24).
//
// This file is content, not code (brief's own words): every gag id from
// content.json is mapped, once, onto a fixed building slot and a stable
// pixel anchor, so that hotspots never move once placed. Positions were
// chosen by this brief's author for legibility at 390px, not derived from
// BANDS-AND-GAGS.md's prose beyond the slot table itself — the doc gives
// "you choose, keep stable" latitude for exact grid placement.
//
// Coordinate system: a fixed logical raster buffer BUFFER_W x BUFFER_H
// (see src/scene/layout.ts), pixel-art scale 1, before any integer scale
// factor is applied for the viewport (R-25). Every slot lives in one of
// four "towers": the HQ building (multi-floor, grows 80->750), the inset
// office (single floor, appears 150+), the street between them (150+), or
// a screen-space overlay (the map, 490+, not part of either building).
import type { BandId } from '../content';

export type SlotId =
  | 'closet'
  | 'door'
  | 'pit'
  | 'finance'
  | 'conf'
  | 'corridor'
  | 'top'
  | 'inset'
  | 'map'
  | 'outside';

export type Tower = 'hq' | 'inset' | 'street' | 'overlay';

export interface SlotInfo {
  id: SlotId;
  label: string;
  /** Earliest band this slot's geography exists from (per the brief's slot map table). */
  introducedAt: Exclude<BandId, 'beyond'>;
  tower: Tower;
  /** 0-indexed floor within its tower's own stack (ignored for 'street'/'overlay'). */
  floorIndex: number;
  /** Anchor of this slot's sub-cell grid, in logical buffer pixels. */
  anchor: { x: number; y: number };
  /** How many gag hotspots this slot has room for, laid out left-to-right, wrapping. */
  subGrid: { cols: number; cellW: number; cellH: number };
}

export const SLOTS: Record<SlotId, SlotInfo> = {
  closet: {
    id: 'closet',
    label: 'The closet',
    introducedAt: 80,
    tower: 'hq',
    floorIndex: 0,
    anchor: { x: 8, y: 4 },
    subGrid: { cols: 1, cellW: 18, cellH: 14 },
  },
  door: {
    id: 'door',
    label: 'Front door',
    introducedAt: 80,
    tower: 'hq',
    floorIndex: 0,
    anchor: { x: 30, y: 4 },
    subGrid: { cols: 2, cellW: 18, cellH: 14 },
  },
  pit: {
    id: 'pit',
    label: 'Sales pit',
    introducedAt: 80,
    tower: 'hq',
    floorIndex: 0,
    anchor: { x: 70, y: 4 },
    subGrid: { cols: 4, cellW: 18, cellH: 14 },
  },
  conf: {
    id: 'conf',
    label: 'Conference room',
    introducedAt: 80,
    tower: 'hq',
    floorIndex: 1,
    anchor: { x: 8, y: 4 },
    subGrid: { cols: 2, cellW: 18, cellH: 14 },
  },
  corridor: {
    id: 'corridor',
    label: 'First-floor corridor',
    introducedAt: 150,
    tower: 'hq',
    floorIndex: 1,
    anchor: { x: 48, y: 4 },
    subGrid: { cols: 3, cellW: 18, cellH: 14 },
  },
  finance: {
    id: 'finance',
    label: 'Finance corner',
    introducedAt: 80,
    tower: 'hq',
    floorIndex: 1,
    anchor: { x: 106, y: 4 },
    subGrid: { cols: 3, cellW: 18, cellH: 14 },
  },
  top: {
    id: 'top',
    label: 'Top floor',
    introducedAt: 610,
    tower: 'hq',
    floorIndex: 6,
    anchor: { x: 40, y: 4 },
    subGrid: { cols: 1, cellW: 18, cellH: 14 },
  },
  inset: {
    id: 'inset',
    label: 'Inset office',
    introducedAt: 150,
    tower: 'inset',
    floorIndex: 0,
    anchor: { x: 4, y: 4 },
    subGrid: { cols: 3, cellW: 18, cellH: 14 },
  },
  outside: {
    id: 'outside',
    label: 'Outside, between the two front doors',
    introducedAt: 150,
    tower: 'street',
    floorIndex: 0,
    anchor: { x: 0, y: 0 },
    subGrid: { cols: 2, cellW: 20, cellH: 14 },
  },
  map: {
    id: 'map',
    label: 'The map',
    introducedAt: 490,
    tower: 'overlay',
    floorIndex: 0,
    anchor: { x: 4, y: 4 },
    subGrid: { cols: 1, cellW: 18, cellH: 14 },
  },
};

export interface GagPlacementPart {
  slot: SlotId;
  /** Index into the slot's subGrid (col = cell % cols, row = floor(cell / cols)). */
  cell: number;
}

/**
 * Every gag id from content.json -> one or two placement parts. Two parts
 * only for the gags the brief calls out by name as spanning two slots:
 * G4.1 (door + pit) and G5.1 (outside, both front doors — modelled as two
 * cells of the 'outside' slot, one per building). Every other gag's prose
 * `where` names one location or a boundary between two; where it's a
 * boundary (e.g. G4.3 "sales pit / finance corner boundary") this table
 * picks one side and keeps it stable, per the brief's discretion.
 */
export const GAG_PLACEMENTS: Record<string, GagPlacementPart[]> = {
  // 80
  'G1.1': [{ slot: 'closet', cell: 0 }],
  'G1.2': [{ slot: 'pit', cell: 0 }],
  'G2.1': [{ slot: 'pit', cell: 1 }],
  'G2.2': [{ slot: 'pit', cell: 2 }],
  'G2.3': [{ slot: 'door', cell: 0 }],
  // 150
  'G3.2': [{ slot: 'closet', cell: 1 }],
  'G4.2': [{ slot: 'finance', cell: 0 }],
  'G4.3': [{ slot: 'finance', cell: 1 }],
  'G5.1': [
    { slot: 'outside', cell: 0 },
    { slot: 'outside', cell: 1 },
  ],
  // 220
  'G2.4': [{ slot: 'conf', cell: 0 }],
  'G7.3a': [{ slot: 'conf', cell: 1 }],
  // 360
  'G5.3': [{ slot: 'closet', cell: 2 }],
  'G5.4': [{ slot: 'pit', cell: 3 }],
  'G5.6': [{ slot: 'inset', cell: 0 }],
  'G7.3': [{ slot: 'corridor', cell: 0 }],
  // 490
  'G3.1': [{ slot: 'pit', cell: 4 }],
  'G6.4': [{ slot: 'inset', cell: 1 }],
  // 610
  'G3.3': [{ slot: 'corridor', cell: 1 }],
  'G4.1': [
    { slot: 'door', cell: 1 },
    { slot: 'pit', cell: 5 },
  ],
  'G5.2': [{ slot: 'inset', cell: 2 }],
  'G6.3': [{ slot: 'map', cell: 0 }],
  // 750
  'G6.1': [{ slot: 'pit', cell: 6 }],
  'G6.2': [{ slot: 'finance', cell: 2 }],
  'G7.1': [{ slot: 'pit', cell: 7 }],
  'G7.2': [{ slot: 'top', cell: 0 }],
  'G7.4': [{ slot: 'corridor', cell: 2 }],
};

/** Floor count for a given band (0-indexed floors go 0..count-1). Beyond does not grow (brief). */
const FLOOR_COUNT: Record<Exclude<BandId, 'beyond'>, number> = {
  80: 2,
  150: 3,
  220: 4,
  360: 5,
  490: 6,
  610: 7,
  750: 7,
};

export function floorCountForBand(band: BandId): number {
  return band === 'beyond' ? FLOOR_COUNT[750] : FLOOR_COUNT[band];
}

/** Map pins: 0 before 490, 3 from 490 (Boston/Chicago/Lawrence), 6 from 610 (+Austin/NYC/DC). */
export function mapPinCount(band: BandId): number {
  const tier = band === 'beyond' ? 750 : band;
  if (tier < 490) return 0;
  if (tier < 610) return 3;
  return 6;
}
