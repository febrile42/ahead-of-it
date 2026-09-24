import { describe, expect, it } from 'vitest';
import { getGags } from '../content';
import { BAND_ORDER } from './bands';
import { BUFFER_H, BUFFER_W, computeLayout } from './layout';
import { GAG_PLACEMENTS } from './slots';
import type { BandId } from '../content';

const NUMERIC_BANDS: Exclude<BandId, 'beyond'>[] = [80, 150, 220, 360, 490, 610, 750];
const STATES: Array<'built' | 'without'> = ['built', 'without'];

describe('GAG_PLACEMENTS content coverage', () => {
  it('has a placement entry for every gag in content.json, and no orphans', () => {
    const gagIds = getGags().map((g) => g.id);
    for (const id of gagIds) {
      expect(GAG_PLACEMENTS[id], `missing placement for ${id}`).toBeDefined();
    }
    for (const id of Object.keys(GAG_PLACEMENTS)) {
      expect(gagIds, `placement for unknown gag ${id}`).toContain(id);
    }
  });
});

describe('computeLayout — slot placement (R-02, R-03, R-03a)', () => {
  it('band 80 shows exactly its own five gags at full prominence, none quiet', () => {
    const layout = computeLayout(80, 'built');
    const gagIds = new Set(layout.hotspots.map((h) => h.gagId));
    expect(gagIds).toEqual(new Set(['G1.1', 'G1.2', 'G2.1', 'G2.2', 'G2.3']));
    expect(layout.hotspots.every((h) => h.emphasis === 'current')).toBe(true);
  });

  it('is cumulative (R-03a): band 750 includes every gag from every earlier band', () => {
    const layout = computeLayout(750, 'built');
    const gagIds = new Set(layout.hotspots.map((h) => h.gagId));
    expect(gagIds).toEqual(new Set(getGags().map((g) => g.id)));
  });

  it('de-emphasises earlier-band items and keeps the current band at full prominence', () => {
    const layout = computeLayout(220, 'built');
    const byGag = new Map(layout.hotspots.map((h) => [h.gagId, h]));
    // G2.4 and G7.3a are band 220 (current); G1.1 is band 80 (earlier).
    expect(byGag.get('G2.4')?.emphasis).toBe('current');
    expect(byGag.get('G7.3a')?.emphasis).toBe('current');
    expect(byGag.get('G1.1')?.emphasis).toBe('quiet');
    const current = byGag.get('G2.4')!;
    const quiet = byGag.get('G1.1')!;
    expect(quiet.w).toBeLessThan(current.w);
    expect(quiet.h).toBeLessThan(current.h);
  });

  it('beyond reuses exactly the 750 set — no growth past 750 (N-02, brief item a)', () => {
    const at750 = computeLayout(750, 'built');
    const atBeyond = computeLayout('beyond', 'built');
    expect(atBeyond.hqFloors).toBe(at750.hqFloors);
    expect(atBeyond.hasInset).toBe(at750.hasInset);
    expect(atBeyond.hasTop).toBe(at750.hasTop);
    expect(atBeyond.mapPins.length).toBe(at750.mapPins.length);
    const beyondGagIds = new Set(atBeyond.hotspots.map((h) => h.gagId));
    const at750GagIds = new Set(at750.hotspots.map((h) => h.gagId));
    expect(beyondGagIds).toEqual(at750GagIds);
  });

  it('gives two-part gags one hotspot per part, both pointing at the same gag', () => {
    const layout = computeLayout(750, 'built');
    const g41 = layout.hotspots.filter((h) => h.gagId === 'G4.1');
    const g51 = layout.hotspots.filter((h) => h.gagId === 'G5.1');
    expect(g41).toHaveLength(2);
    expect(g51).toHaveLength(2);
    expect(new Set(g41.map((h) => h.slot))).toEqual(new Set(['door', 'pit']));
    expect(new Set(g51.map((h) => h.slot))).toEqual(new Set(['outside']));
    expect(g41[0].hotspotId).not.toBe(g41[1].hotspotId);
  });

  it('the inset office, top floor and map appear exactly at their introduced band', () => {
    expect(computeLayout(80, 'built').hasInset).toBe(false);
    expect(computeLayout(150, 'built').hasInset).toBe(true);
    expect(computeLayout(490, 'built').hasTop).toBe(false);
    expect(computeLayout(610, 'built').hasTop).toBe(true);
    expect(computeLayout(360, 'built').hasMap).toBe(false);
    expect(computeLayout(490, 'built').hasMap).toBe(true);
  });

  it('floor count grows monotonically through 750 and then holds at beyond', () => {
    let prev = 0;
    for (const band of NUMERIC_BANDS) {
      const layout = computeLayout(band, 'built');
      expect(layout.hqFloors).toBeGreaterThanOrEqual(prev);
      prev = layout.hqFloors;
    }
    expect(computeLayout('beyond', 'built').hqFloors).toBe(prev);
  });

  it('every hotspot sits within the logical buffer for every band and state', () => {
    for (const band of BAND_ORDER) {
      for (const state of STATES) {
        const layout = computeLayout(band, state);
        for (const h of layout.hotspots) {
          expect(h.x).toBeGreaterThanOrEqual(-5); // small negative slop from de-emphasis shrink is fine
          expect(h.y).toBeGreaterThanOrEqual(-5);
          expect(h.x + h.w).toBeLessThanOrEqual(BUFFER_W + 5);
          expect(h.y + h.h).toBeLessThanOrEqual(BUFFER_H + 5);
        }
      }
    }
  });

  it('built and without states place every hotspot identically (only the sprite differs)', () => {
    for (const band of BAND_ORDER) {
      const built = computeLayout(band, 'built');
      const without = computeLayout(band, 'without');
      expect(built.hotspots.map((h) => ({ id: h.hotspotId, x: h.x, y: h.y }))).toEqual(
        without.hotspots.map((h) => ({ id: h.hotspotId, x: h.x, y: h.y }))
      );
    }
  });

  it('G6.4 is the one gag that uses the real badge-reader sprite, not a placeholder', () => {
    const layout = computeLayout(750, 'built');
    const byGag = new Map(layout.hotspots.map((h) => [h.gagId, h]));
    expect(byGag.get('G6.4')?.spriteKind).toBe('badge-reader');
    expect(byGag.get('G1.1')?.spriteKind).toBe('placeholder');
  });
});
