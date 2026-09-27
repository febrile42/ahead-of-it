// PH2-01 Part B (docs/product/SCENE-FORMAT.md § Motion, DIA-81/DIA-86): pure
// resolution of a scene entry's painted frame and position at time `t` (ms
// since the current scene file was first painted). No DOM, no async — the
// ticker (src/main.ts) calls this once per tick to decide whether anything
// changed before repainting the canvas, and src/scene/assembler.ts calls it
// again to know exactly what to draw at that `t`. Kept out of scene.ts (data
// shapes) and assembler.ts (canvas calls) so it stays testable with plain
// vitest — everything here is arithmetic over plain objects.
import type { SceneEntry, SceneView, WalkLeg } from './scene';
import type { SpriteFrame, SpriteManifest, SpriteManifestEntry } from './sprites';

export interface ResolvedFrame {
  frameKey: string;
  fileIndex: number;
  x: number;
  y: number;
}

/** SCENE-FORMAT "Rest pose = today's export": an entry with no `motion`, or
 * one that hasn't reached its `motion.start` yet, paints its `frame`'s first
 * file at its own `(x, y)` — exactly what a painter with no motion support
 * draws today. */
function restPose(entry: SceneEntry): ResolvedFrame {
  return { frameKey: entry.frame, fileIndex: 0, x: entry.x, y: entry.y };
}

/** SCENE-FORMAT "In-place loop": `τ = floor(u) mod total` selects the file
 * whose cumulative-duration range `[acc, acc + duration)` contains it. A key
 * with one file, or any file with `duration` 0, is still — the art checks
 * forbid shipping that combination with `motion` — so `total` is never 0 in
 * practice; the 0 fallback below is defensive, not a case this hits. */
function inPlaceFileIndex(frames: readonly SpriteFrame[], u: number): number {
  const total = frames.reduce((sum, frame) => sum + frame.duration, 0);
  if (total <= 0) return 0;
  const tau = Math.floor(u) % total;
  let acc = 0;
  for (let i = 0; i < frames.length; i += 1) {
    acc += frames[i].duration;
    if (tau < acc) return i;
  }
  return frames.length - 1;
}

/** SCENE-FORMAT "Walker": walks `legs` in array order from `(startX,
 * startY)`, returning the leg `tau` (unscaled ms since `motion.start`) falls
 * into, plus the anchor position within it — the leg's own start for a hold
 * leg, or the floored linear interpolation toward `to` for a move leg. */
function walkerPosition(
  legs: readonly WalkLeg[],
  startX: number,
  startY: number,
  tau: number
): { leg: WalkLeg; x: number; y: number } {
  let acc = 0;
  let fromX = startX;
  let fromY = startY;
  for (const leg of legs) {
    const duration = leg.ms ?? leg.hold ?? 0;
    if (tau < acc + duration) {
      if (leg.to && leg.ms !== undefined) {
        const p = (tau - acc) / leg.ms;
        return {
          leg,
          x: fromX + Math.floor((leg.to[0] - fromX) * p),
          y: fromY + Math.floor((leg.to[1] - fromY) * p),
        };
      }
      return { leg, x: fromX, y: fromY };
    }
    acc += duration;
    if (leg.to) {
      fromX = leg.to[0];
      fromY = leg.to[1];
    }
  }
  // Unreachable while the legs sum to > 0 and close the loop (check_scenes.py
  // proves both for every exported walker) — falls back to holding at the
  // last known point rather than throwing on a malformed file.
  const last = legs[legs.length - 1];
  return { leg: last, x: fromX, y: fromY };
}

/**
 * Resolves `entry`'s painted frame and position at time `t`. Returns the
 * rest pose for an entry with no `motion` and for any entry before its
 * `motion.start` — which, combined with the in-place/walker math below
 * naturally mapping `t = 0` to file 0 / the entry's own `(x, y)` regardless
 * of `start`, is what makes "rest pose = today's export" hold at `t = 0`
 * unconditionally, not just for the `start > 0` values the exporter
 * currently derives.
 */
export function resolveEntryAt(entry: SceneEntry, manifestEntry: SpriteManifestEntry, t: number): ResolvedFrame {
  const motion = entry.motion;
  if (!motion || t < motion.start) return restPose(entry);
  const rate = motion.rate ?? 1;
  const u = (t - motion.start) * rate;

  if (!motion.walk) {
    const frames = manifestEntry.frames[entry.frame] ?? [];
    return { frameKey: entry.frame, fileIndex: inPlaceFileIndex(frames, u), x: entry.x, y: entry.y };
  }

  const totalMs = motion.walk.reduce((sum, leg) => sum + (leg.ms ?? leg.hold ?? 0), 0);
  if (totalMs <= 0) return restPose(entry);
  // Unscaled — "rate speeds the legs' frames, never the path".
  const tau = (t - motion.start) % totalMs;
  const { leg, x, y } = walkerPosition(motion.walk, entry.x, entry.y, tau);
  const frames = manifestEntry.frames[leg.frame] ?? [];
  return { frameKey: leg.frame, fileIndex: inPlaceFileIndex(frames, u), x, y };
}

/** One resolution per entry in `view.entries`, in the same order — `null`
 * for an entry with no `motion` (it never changes, so the ticker has nothing
 * to compare it against). An entry whose `sprite` isn't in `manifest` isn't
 * drawn either way (the same gap `assembler.ts` already has); resolved as
 * rest pose here so a bad reference is still comparable instead of silently
 * dropped from the change check. */
export function resolveViewAt(view: SceneView, manifest: SpriteManifest, t: number): (ResolvedFrame | null)[] {
  return view.entries.map((entry) => {
    if (!entry.motion) return null;
    const manifestEntry = manifest[entry.sprite];
    return manifestEntry ? resolveEntryAt(entry, manifestEntry, t) : restPose(entry);
  });
}

/** Whether the ticker needs to repaint: some entry's resolved frame or
 * position differs from the last resolution it repainted for. A length
 * mismatch (a different view) or a missing baseline (`b === null`, the
 * first check after a scene/view change) always counts as changed. */
export function motionChanged(
  a: readonly (ResolvedFrame | null)[],
  b: readonly (ResolvedFrame | null)[] | null
): boolean {
  if (!b || a.length !== b.length) return true;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];
    if (x === null && y === null) continue;
    if (x === null || y === null) return true;
    if (x.frameKey !== y.frameKey || x.fileIndex !== y.fileIndex || x.x !== y.x || x.y !== y.y) return true;
  }
  return false;
}
