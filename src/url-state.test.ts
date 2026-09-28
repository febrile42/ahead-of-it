import { describe, expect, it } from 'vitest';
import { DEFAULT_INITIAL_STATE, parseInitialSceneState } from './url-state';

describe('parseInitialSceneState (D-043 URL read)', () => {
  it('falls back to band 80, built with no params', () => {
    expect(parseInitialSceneState('')).toEqual(DEFAULT_INITIAL_STATE);
  });

  it('reads a band-750 built URL', () => {
    expect(parseInitialSceneState('?n=750&it=built')).toEqual({ band: 750, state: 'built' });
  });

  it('reads a band-750 without URL (it=none)', () => {
    expect(parseInitialSceneState('?n=750&it=none')).toEqual({ band: 750, state: 'without' });
  });

  it('snaps an arbitrary headcount to its nearest band, same as the slider', () => {
    expect(parseInitialSceneState('?n=500&it=built')).toEqual({ band: 490, state: 'built' });
    expect(parseInitialSceneState('?n=1000&it=built')).toEqual({ band: 'beyond', state: 'built' });
  });

  it('falls back band-only on a non-numeric n, keeping a valid it', () => {
    expect(parseInitialSceneState('?n=nope&it=none')).toEqual({ band: 80, state: 'without' });
  });

  it('falls back band-only on a zero or negative n', () => {
    expect(parseInitialSceneState('?n=0&it=built')).toEqual({ band: 80, state: 'built' });
    expect(parseInitialSceneState('?n=-5&it=built')).toEqual({ band: 80, state: 'built' });
  });

  it('falls back state-only on an invalid it, keeping a valid n', () => {
    expect(parseInitialSceneState('?n=750&it=nope')).toEqual({ band: 750, state: 'built' });
  });

  it('falls back both independently when both are invalid', () => {
    expect(parseInitialSceneState('?n=nope&it=nope')).toEqual(DEFAULT_INITIAL_STATE);
  });

  it('ignores unrelated params and stray whitespace', () => {
    expect(parseInitialSceneState('?foo=bar&n=220&it=built')).toEqual({ band: 220, state: 'built' });
  });
});
