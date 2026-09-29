import { describe, expect, it } from 'vitest';
import { BAND_ORDER, formatReadout, isAtLeast, nearestBand, rawValueForBand } from './bands';

describe('nearestBand (R-01 slider snapping)', () => {
  it('snaps low values to the first band', () => {
    expect(nearestBand(25)).toBe(80);
    expect(nearestBand(0)).toBe(80);
  });

  it('snaps exactly to a band at its own value', () => {
    expect(nearestBand(80)).toBe(80);
    expect(nearestBand(150)).toBe(150);
    expect(nearestBand(490)).toBe(490);
    expect(nearestBand(750)).toBe(750);
  });

  it('snaps to the nearer neighbour either side of a midpoint', () => {
    // midpoint(80,150) = 115
    expect(nearestBand(114)).toBe(80);
    expect(nearestBand(115)).toBe(150);
    // midpoint(220,360) = 290
    expect(nearestBand(289)).toBe(220);
    expect(nearestBand(290)).toBe(360);
  });

  it('snaps to beyond past the last threshold (R-01b)', () => {
    // midpoint(750, 1000) = 875
    expect(nearestBand(874)).toBe(750);
    expect(nearestBand(875)).toBe('beyond');
    expect(nearestBand(1000)).toBe('beyond');
    expect(nearestBand(5000)).toBe('beyond');
  });
});

describe('BAND_ORDER / isAtLeast', () => {
  it('has all seven bands plus beyond, in ascending order', () => {
    expect(BAND_ORDER).toEqual([80, 150, 220, 360, 490, 610, 750, 'beyond']);
  });

  it('treats beyond as at-or-after every numeric threshold', () => {
    expect(isAtLeast('beyond', 750)).toBe(true);
    expect(isAtLeast('beyond', 80)).toBe(true);
  });

  it('compares numeric bands correctly', () => {
    expect(isAtLeast(220, 150)).toBe(true);
    expect(isAtLeast(150, 220)).toBe(false);
    expect(isAtLeast(150, 150)).toBe(true);
  });
});

describe('rawValueForBand (U-01, DIA-194/195)', () => {
  it('round-trips every band id through nearestBand', () => {
    for (const band of BAND_ORDER) {
      expect(nearestBand(rawValueForBand(band))).toBe(band);
    }
  });

  it('gives the numeric band its own id as the raw value', () => {
    expect(rawValueForBand(750)).toBe(750);
    expect(rawValueForBand(80)).toBe(80);
  });

  it("gives 'beyond' the slider's own max, never a parsed display string", () => {
    expect(rawValueForBand('beyond')).toBe(1000);
  });
});

describe('formatReadout', () => {
  it('matches the brief\'s worked example shape', () => {
    expect(formatReadout(400, 490)).toBe('~400 → 2022, ~490');
  });

  it('falls back to "Beyond" with no year/band at the beyond stop', () => {
    expect(formatReadout(1200, 'beyond')).toBe('~1200 → Beyond');
  });

  it('rounds the raw value', () => {
    expect(formatReadout(399.6, 490)).toBe('~400 → 2022, ~490');
  });
});
