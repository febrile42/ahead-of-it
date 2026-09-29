// D-057 items 4-5 (PH3-02, DIA-235): pure selection logic for the share
// image's picture — which room to paint and which of the band's own gags
// get a flag mark. No canvas, no manifest lookups (those need the
// share-flag/-caption/-url sprites the Art Director hasn't exported yet,
// DIA-246) — this module only reads the same scene files and content.json
// the painter already reads, so it is fully testable today.
import { getGagsForBand } from '../content';
import type { BandId } from '../content';
import { closeupsOf, rooms } from './scene';
import type { SceneFile, SceneHotspot, SceneView } from './scene';

/** The eight share stops (D-057 item 1): the seven numeric bands plus the
 * `1,000+` stop, named `1000` for its file/URL/sprite-frame key even though
 * it is `nearestBand`'s `'beyond'`. */
export const SHARE_STOPS = [80, 150, 220, 360, 490, 610, 750, 1000] as const;
export type ShareStop = (typeof SHARE_STOPS)[number];

/** The `BandId` whose scene file a stop paints. The `1000` stop paints
 * band 750's scene (D-057 item 1, N-02: 'beyond' is an explicit alias of
 * 750 in `public/sprites/scenes/index.json`), so this is `'beyond'`, not a
 * distinct file. */
export function sceneBandForStop(stop: ShareStop): BandId {
  return stop === 1000 ? 'beyond' : stop;
}

/** The inverse of `sceneBandForStop`: the share stop a band's URL/OG image
 * maps to (D-057 item 6, the Worker's request-rewrite). `nearestBand`'s
 * `'beyond'` is the `1000` stop. */
export function shareStopForBand(band: BandId): ShareStop {
  return band === 'beyond' ? 1000 : band;
}

/** The band whose own gags a stop's flags are drawn from. The `1000` stop
 * has no gags of its own in content.json ('beyond' owns none — it is a
 * scene alias, not a gag band) so it reuses 750's, matching D-057's table
 * row "750, 1000 | ground | G6.1, G7.1". */
export function ownGagIdsForStop(stop: ShareStop): string[] {
  const band: Exclude<BandId, 'beyond'> = stop === 1000 ? 750 : stop;
  return getGagsForBand(band).map((gag) => gag.id);
}

interface RoomPrimary {
  gagId: string;
  closeup: SceneView;
  hotspot: SceneHotspot;
}

/** Every primary hotspot across `room`'s own close-ups whose gag is in
 * `ownGagIds`, one entry per hotspot (a two-part gag's non-primary part is
 * excluded by `primary`, so this never double-counts a gag within one
 * close-up; a gag repeated across close-ups is deduped by the callers
 * below, which is also what "first" means for `pickShareFlags`). */
function primariesInRoom(scene: SceneFile, room: SceneView, ownGagIds: ReadonlySet<string>): RoomPrimary[] {
  const out: RoomPrimary[] = [];
  for (const closeup of closeupsOf(scene, room.id)) {
    for (const hotspot of closeup.hotspots) {
      if (hotspot.primary && ownGagIds.has(hotspot.gagId)) {
        out.push({ gagId: hotspot.gagId, closeup, hotspot });
      }
    }
  }
  return out;
}

/** D-057 item 4: the room holding the most of the stop's own gags' primary
 * hotspots, counted once per gag across all its close-ups. Ties go to
 * navigation order — `rooms()` preserves the scene file's own array order,
 * and this only replaces `best` on a strict improvement, so the earlier
 * room wins a tie. */
export function pickShareRoom(scene: SceneFile, ownGagIds: ReadonlySet<string>): SceneView {
  const candidates = rooms(scene);
  let best = candidates[0];
  let bestCount = -1;
  for (const room of candidates) {
    const count = new Set(primariesInRoom(scene, room, ownGagIds).map((p) => p.gagId)).size;
    if (count > bestCount) {
      best = room;
      bestCount = count;
    }
  }
  return best;
}

export interface ShareFlag {
  gagId: string;
  /** The flag's point in `room`'s own coordinates (D-057 item 5): the
   * close-up's `rect.x/y` plus the primary hotspot's `marker`, or the
   * hotspot rect's centre when it has none. */
  x: number;
  y: number;
}

/** D-057 item 5: up to three flags for `room` — the band's own gags, in
 * content.json order (`orderedGagIds`), first three. A later gag whose
 * point lands within `minSeparation` room-px of an earlier flag's is
 * dropped ("if two flags would overlap, the later gag is dropped").
 * `minSeparation` defaults to 0 (disabled): the real threshold depends on
 * `share-flag`'s exported footprint, which DIA-246 hasn't supplied yet, and
 * no current stop's own gags actually land close enough for it to matter
 * (share-image.test.ts checks all eight against D-057's own table without
 * it). Pass a real value once the sprite's size is known. */
export function pickShareFlags(
  scene: SceneFile,
  room: SceneView,
  ownGagIds: ReadonlySet<string>,
  orderedGagIds: readonly string[],
  minSeparation = 0
): ShareFlag[] {
  const byGag = new Map<string, RoomPrimary>();
  for (const primary of primariesInRoom(scene, room, ownGagIds)) {
    if (!byGag.has(primary.gagId)) byGag.set(primary.gagId, primary);
  }

  const flags: ShareFlag[] = [];
  for (const gagId of orderedGagIds) {
    if (flags.length >= 3) break;
    const primary = byGag.get(gagId);
    if (!primary) continue;
    const { closeup, hotspot } = primary;
    if (!closeup.rect) continue; // defensive only — every room-parented close-up has one (SCENE-FORMAT)
    const local = hotspot.marker ?? { x: hotspot.x + hotspot.w / 2, y: hotspot.y + hotspot.h / 2 };
    const point: ShareFlag = { gagId, x: closeup.rect.x + local.x, y: closeup.rect.y + local.y };
    const overlaps = minSeparation > 0 && flags.some((f) => Math.hypot(f.x - point.x, f.y - point.y) < minSeparation);
    if (overlaps) continue;
    flags.push(point);
  }
  return flags;
}

/** D-057's own table (item 5), the documented expected output of the rule
 * above for every stop — asserted verbatim in share-image.test.ts. A
 * Product Lead override is a one-line amendment to the decision and this
 * table together, not a change to the selection rule itself. */
export const EXPECTED_SHARE_ROOM_AND_FLAGS: Record<ShareStop, { room: string; gagIds: string[] }> = {
  80: { room: 'ground', gagIds: ['G1.1', 'G1.2', 'G2.1'] },
  150: { room: 'floor-2', gagIds: ['G4.2', 'G4.3'] },
  220: { room: 'floor-2', gagIds: ['G2.4', 'G7.3a'] },
  360: { room: 'ground', gagIds: ['G5.3', 'G5.4'] },
  490: { room: 'ground', gagIds: ['G3.1'] },
  610: { room: 'street', gagIds: ['G5.2', 'G6.3'] },
  750: { room: 'ground', gagIds: ['G6.1', 'G7.1'] },
  1000: { room: 'ground', gagIds: ['G6.1', 'G7.1'] },
};
