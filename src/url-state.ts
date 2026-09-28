// D-043: R-10's URL *read* side, pulled forward to Phase 2 so a Lighthouse
// navigation can land on band 750, not just band 80. `?n=<headcount>&it=<none|built>`
// are R-10's own parameter names — Phase 3 extends this with the write side
// (history, sharing, OG), it does not replace it.
//
// Nothing here writes the URL. A missing or invalid value for either
// parameter falls back to today's default for that parameter alone (band
// 80, built) with no error shown — the two parameters are independent, so
// `?it=none` with no `n` still gives band 80, without.
import { nearestBand } from './scene/bands';
import type { BandId } from './content';
import type { SceneState } from './ui/toggle';

export interface InitialSceneState {
  band: BandId;
  state: SceneState;
}

export const DEFAULT_INITIAL_STATE: InitialSceneState = { band: 80, state: 'built' };

function parseBand(raw: string | null): BandId {
  if (raw === null) return DEFAULT_INITIAL_STATE.band;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_INITIAL_STATE.band;
  return nearestBand(n);
}

function parseState(raw: string | null): SceneState {
  if (raw === 'built') return 'built';
  if (raw === 'none') return 'without';
  return DEFAULT_INITIAL_STATE.state;
}

/** Reads R-10's `n`/`it` params from a location.search string (e.g. `window.location.search`). */
export function parseInitialSceneState(search: string): InitialSceneState {
  const params = new URLSearchParams(search);
  return {
    band: parseBand(params.get('n')),
    state: parseState(params.get('it')),
  };
}
