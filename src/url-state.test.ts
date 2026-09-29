import { describe, expect, it } from 'vitest';
import { DEFAULT_INITIAL_STATE, parseInitialSceneState } from './url-state';

describe('parseInitialSceneState (D-043 URL read)', () => {
  it('falls back to band 80, built with no params', () => {
    expect(parseInitialSceneState('')).toEqual(DEFAULT_INITIAL_STATE);
  });

  it('reads a band-750 built URL', () => {
    expect(parseInitialSceneState('?n=750&it=built')).toEqual({ band: 750, state: 'built', raw: 750 });
  });

  it('reads a band-750 without URL (it=none)', () => {
    expect(parseInitialSceneState('?n=750&it=none')).toEqual({ band: 750, state: 'without', raw: 750 });
  });

  it('snaps an arbitrary headcount to its nearest band, same as the slider', () => {
    expect(parseInitialSceneState('?n=500&it=built')).toEqual({ band: 490, state: 'built', raw: 500 });
    expect(parseInitialSceneState('?n=1000&it=built')).toEqual({ band: 'beyond', state: 'built', raw: 1000 });
  });

  // U-17 (DIA-194/197): the raw value survives even when it doesn't land
  // exactly on a band — the readout (src/scene/bands.ts formatReadout) is
  // what turns this into "~600 → 2023, ~610", not this parser.
  it('keeps the raw headcount distinct from the band it snaps to', () => {
    expect(parseInitialSceneState('?n=600&it=built')).toEqual({ band: 610, state: 'built', raw: 600 });
  });

  it('clamps an out-of-range raw to the slider bounds', () => {
    expect(parseInitialSceneState('?n=5000&it=built')).toEqual({ band: 'beyond', state: 'built', raw: 1000 });
    expect(parseInitialSceneState('?n=1&it=built')).toEqual({ band: 80, state: 'built', raw: 25 });
  });

  it('falls back band-only on a non-numeric n, keeping a valid it', () => {
    expect(parseInitialSceneState('?n=nope&it=none')).toEqual({ band: 80, state: 'without', raw: 80 });
  });

  it('falls back band-only on a zero or negative n', () => {
    expect(parseInitialSceneState('?n=0&it=built')).toEqual({ band: 80, state: 'built', raw: 80 });
    expect(parseInitialSceneState('?n=-5&it=built')).toEqual({ band: 80, state: 'built', raw: 80 });
  });

  it('falls back state-only on an invalid it, keeping a valid n', () => {
    expect(parseInitialSceneState('?n=750&it=nope')).toEqual({ band: 750, state: 'built', raw: 750 });
  });

  it('falls back both independently when both are invalid', () => {
    expect(parseInitialSceneState('?n=nope&it=nope')).toEqual(DEFAULT_INITIAL_STATE);
  });

  it('ignores unrelated params and stray whitespace', () => {
    expect(parseInitialSceneState('?foo=bar&n=220&it=built')).toEqual({ band: 220, state: 'built', raw: 220 });
  });
});
