import { describe, expect, it } from 'vitest';
import { DEFAULT_INITIAL_STATE, LIST_HASH, panelHash, parseInitialSceneState, sceneSearchParams } from './url-state';

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

describe('sceneSearchParams (PH3-01 URL write)', () => {
  it('writes a numeric band, built, with the band\'s own canonical n', () => {
    expect(sceneSearchParams(490, 'built')).toBe('n=490&it=built');
  });

  it('writes without state as it=none, matching the read side', () => {
    expect(sceneSearchParams(220, 'without')).toBe('n=220&it=none');
  });

  it('writes beyond as the slider max, never the literal string', () => {
    expect(sceneSearchParams('beyond', 'built')).toBe('n=1000&it=built');
  });

  it('round-trips through parseInitialSceneState for every band and state', () => {
    const bands = [80, 150, 220, 360, 490, 610, 750, 'beyond'] as const;
    for (const band of bands) {
      for (const state of ['built', 'without'] as const) {
        const written = parseInitialSceneState(`?${sceneSearchParams(band, state)}`);
        expect(written.band).toBe(band);
        expect(written.state).toBe(state);
      }
    }
  });
});

describe('panelHash/LIST_HASH (PH3-01/U-09 overlay hash)', () => {
  it('builds a panel hash from a gag id', () => {
    expect(panelHash('G2.1')).toBe('#panel=G2.1');
  });

  it('encodes a gag id that needs it, so the hash stays a single URL component', () => {
    expect(panelHash('a b#c')).toBe('#panel=a%20b%23c');
  });

  it('the punch-list hash is a fixed literal, never employer text', () => {
    expect(LIST_HASH).toBe('#list');
  });
});
