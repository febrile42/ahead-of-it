// D-043: R-10's URL *read* side, pulled forward to Phase 2 so a Lighthouse
// navigation can land on band 750, not just band 80. `?n=<headcount>&it=<none|built>`
// are R-10's own parameter names — Phase 3 extends this with the write side
// (history, sharing, OG), it does not replace it.
//
// Nothing here writes the URL. A missing or invalid value for either
// parameter falls back to today's default for that parameter alone (band
// 80, built) with no error shown — the two parameters are independent, so
// `?it=none` with no `n` still gives band 80, without.
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
