// D-043: R-10's URL *read* side, pulled forward to Phase 2 so a Lighthouse
// navigation can land on band 750, not just band 80. `?n=<headcount>&it=<none|built>`
// are R-10's own parameter names. PH3-01 (below) adds the write side: the
// query string to replaceState with, and the hash an open panel/punch-list
// pushes — parseInitialSceneState itself is unchanged, still read-only and
// still never looks at the hash (the brief's own ruling: history-only).
//
// A missing or invalid value for either read-side parameter falls back to
// today's default for that parameter alone (band 80, built) with no error
// shown — the two parameters are independent, so `?it=none` with no `n`
// still gives band 80, without.
import { nearestBand, rawValueForBand, SLIDER_MAX, SLIDER_MIN } from './scene/bands';
import type { BandId } from './content';
import type { SceneState } from './ui/toggle';

export interface InitialSceneState {
  band: BandId;
  state: SceneState;
  // U-17 (DIA-194/197): the slider's own initial raw value, not just the
  // band it snaps to — a deep link that doesn't land exactly on a band
  // (`?n=600`) must still show "~600 → 2023, ~610" (the band's own number
  // repeated), not lose the 600 and read as if the link had said 610.
  raw: number;
}

export const DEFAULT_INITIAL_STATE: InitialSceneState = {
  band: 80,
  state: 'built',
  raw: rawValueForBand(80),
};

/** Clamped to the slider's own range so the readout never shows a number
 * further out than the thumb itself can represent (`rawValueForBand`'s own
 * doc comment: the slider's raw value and 'beyond' both cap at SLIDER_MAX). */
function parseRaw(raw: string | null): number | null {
  if (raw === null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, n));
}

function parseState(raw: string | null): SceneState {
  if (raw === 'built') return 'built';
  if (raw === 'none') return 'without';
  return DEFAULT_INITIAL_STATE.state;
}

/** Reads R-10's `n`/`it` params from a location.search string (e.g. `window.location.search`). */
export function parseInitialSceneState(search: string): InitialSceneState {
  const params = new URLSearchParams(search);
  const raw = parseRaw(params.get('n'));
  return {
    band: raw === null ? DEFAULT_INITIAL_STATE.band : nearestBand(raw),
    state: parseState(params.get('it')),
    raw: raw ?? DEFAULT_INITIAL_STATE.raw,
  };
}

// PH3-01: R-10's *write* side. `sceneSearchParams` is the pure part (unit
// tested below it in url-state.test.ts) — the actual `history.replaceState`
// call lives in main.ts, alongside the band/state variables it reads, the
// same way sizeAndPositionCanvas and friends do for other DOM-only work.
// Always written with the band's own canonical raw value (`rawValueForBand`,
// not the slider's continuous drag position) — round, shareable numbers
// (`n=490`) that `parseInitialSceneState` above round-trips back to the same
// band exactly, never a mid-drag value nobody asked to share.

/** The exact `n=<headcount>&it=<none|built>` query string for `history.replaceState` to write for `band`/`state` — D-043's own param names, so this round-trips through `parseInitialSceneState` above. */
export function sceneSearchParams(band: BandId, state: SceneState): string {
  const params = new URLSearchParams();
  params.set('n', String(rawValueForBand(band)));
  params.set('it', state === 'without' ? 'none' : 'built');
  return params.toString();
}

// U-09: the hash written while an overlay (a gag panel or the punch-list
// sheet) is open — history-only, per the CEO's ruling on this brief's open
// question: never read back on load (parseInitialSceneState above never
// looks at location.hash), so a forwarded link with one of these still
// lands on the plain view. R-33: no employer text in either — a gag id
// never carries one (content/*.json), and 'list' is a fixed literal.
/** The hash for an open gag panel, e.g. `#panel=G2.1`. */
export function panelHash(gagId: string): string {
  return `#panel=${encodeURIComponent(gagId)}`;
}

/** The hash for the open punch-list sheet (D-048). */
export const LIST_HASH = '#list';
