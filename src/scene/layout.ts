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
