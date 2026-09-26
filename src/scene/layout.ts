// PH1-09: what survives of the PH1-04 tile-grid assembler after D-035
// (docs/briefs/PH1-04-REVIEW.md §b) — just the `Hotspot` / `SceneLayout`
// shape src/ui/panel.ts renders real <button>s from, so panel.ts stays
// untouched by the scene-file switch. Geometry now comes straight from
// the art-authored scene file (src/scene/scene.ts's `SceneView.hotspots`)
// instead of being computed here — `computeLayout`, `computeTiles` and
// `cellPosition` are deleted, and so is src/scene/slots.ts (geography is
// the art side's job now).
export interface Hotspot {
  /** `gagId` for single-part gags, `${gagId}#${part}` for multi-part ones (G4.1, G5.1, …) — mirrors SceneHotspot.part. */
  hotspotId: string;
  gagId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** PH1-04's per-hotspot de-emphasis ("quiet" earlier-band items, boxed
   * smaller + 55% opacity) is gone: R-03a's emphasis is now the art
   * side's call, baked into the picture (SceneEntry.alpha or a quiet
   * sprite variant), not a second JS-side shrink. Always 'current' —
   * kept only so src/ui/panel.ts's `hotspot--${emphasis}` class stays
   * untouched (out of this brief's boundary). */
  emphasis: 'current';
}

/** The minimal shape src/ui/panel.ts's `renderHotspots` actually reads:
 * the view's native pixel size (hotspot x/y/w/h are expressed in it, same
 * as the old bufferW/H) and the hotspot list. */
export interface SceneLayout {
  bufferW: number;
  bufferH: number;
  hotspots: Hotspot[];
}

/** D-042a: a room's "zoom in" target — the close-up's `rect` in the room's coordinates. Derived from the same array the close-ups come from, so the picture and the buttons cannot disagree. */
export interface ZoomTarget {
  viewId: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What `renderZoomTargets` reads: the room's native size and its close-ups' rects. */
export interface ZoomLayout {
  bufferW: number;
  bufferH: number;
  targets: ZoomTarget[];
}

/** DIA-55: a zoom-in chip's anchor and measured footprint, all in css px —
 * `cx`/`cy` is the close-up rect's centre (converted from buffer units by
 * the caller), `w`/`h` is the chip's own rendered size (its label plus
 * padding, already clamped to the 44px minimum by CSS before it is
 * measured). Order matches the room's close-ups array. */
export interface Chip {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

/** A chip's placed centre, in the same css-px space as its `Chip.cx/cy`. */
export interface ChipPosition {
  x: number;
  y: number;
}

const CHIP_SEARCH_STEP = 6;

function clampChipCentre(chip: Chip, bounds: { w: number; h: number }): ChipPosition {
  const halfW = chip.w / 2;
  const halfH = chip.h / 2;
  const x = chip.w <= bounds.w ? Math.min(Math.max(chip.cx, halfW), bounds.w - halfW) : bounds.w / 2;
  const y = chip.h <= bounds.h ? Math.min(Math.max(chip.cy, halfH), bounds.h - halfH) : bounds.h / 2;
  return { x, y };
}

function chipsIntersect(
  a: { x: number; y: number; w: number; h: number },
  bx: number,
  by: number,
  bw: number,
  bh: number
): boolean {
  const ax0 = a.x - a.w / 2;
  const ax1 = a.x + a.w / 2;
  const ay0 = a.y - a.h / 2;
  const ay1 = a.y + a.h / 2;
  const bx0 = bx - bw / 2;
  const bx1 = bx + bw / 2;
  const by0 = by - bh / 2;
  const by1 = by + bh / 2;
  return ax0 < bx1 && bx0 < ax1 && ay0 < by1 && by0 < ay1;
}

/**
 * Replaces `resolveZoomOverlaps` (DIA-46 item 4) + panel.ts's old
 * rect-spanning zoom-in button. That combination split a room's close-up
 * rects on overlap, then `placeButton`'s 44px minimum regrew the resulting
 * slivers straight back into their neighbours (DIA-54/DIA-55) — a dense
 * room like band 750's `ground` (six 180x120 close-ups on a 348x220 room)
 * always lost. The zoom-in target is now a small label chip anchored on
 * the rect's centre instead of a button spanning the whole rect, so its
 * footprint is its own text size, not a slice of a shrinking rect.
 *
 * Places each chip (in array order) at its anchor, clamped into `bounds`;
 * if that overlaps an already-placed chip, searches an expanding square
 * ring around the anchor (deterministic, no randomness) for the nearest
 * free position that is inside bounds and clear of every chip placed so
 * far. If none exists within the search radius, places it at the clamped
 * anchor anyway and logs a warning — better an overlap a visitor can still
 * read part of than a chip flung off the picture.
 */
export function placeChips(chips: readonly Chip[], bounds: { w: number; h: number }): ChipPosition[] {
  const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
  const positions: ChipPosition[] = [];
  const maxRadius = (bounds.w + bounds.h) * 2;

  for (const chip of chips) {
    const clamped = clampChipCentre(chip, bounds);
    const isFree = (x: number, y: number) => !placed.some((p) => chipsIntersect(p, x, y, chip.w, chip.h));

    let found: ChipPosition | null = isFree(clamped.x, clamped.y) ? clamped : null;

    for (let radius = CHIP_SEARCH_STEP; !found && radius <= maxRadius; radius += CHIP_SEARCH_STEP) {
      for (let dy = -radius; !found && dy <= radius; dy += CHIP_SEARCH_STEP) {
        const onHorizontalEdge = Math.abs(dy) === radius;
        const dxs = onHorizontalEdge
          ? Array.from({ length: Math.floor((2 * radius) / CHIP_SEARCH_STEP) + 1 }, (_, i) => -radius + i * CHIP_SEARCH_STEP)
          : [-radius, radius];
        for (const dx of dxs) {
          const candidate = clampChipCentre({ ...chip, cx: clamped.x + dx, cy: clamped.y + dy }, bounds);
          if (isFree(candidate.x, candidate.y)) {
            found = candidate;
            break;
          }
        }
      }
    }

    const final = found ?? clamped;
    if (!found) {
      // eslint-disable-next-line no-console
      console.warn(`placeChips: no free position found for chip at (${chip.cx}, ${chip.cy}); leaving it overlapping`);
    }
    placed.push({ x: final.x, y: final.y, w: chip.w, h: chip.h });
    positions.push(final);
  }

  return positions;
}
