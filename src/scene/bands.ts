// PH1-04: band ordering, slider snapping and the readout string.
//
// Pure functions only (no DOM) so vitest can exercise them directly — see
// src/scene/bands.test.ts. src/ui/slider.ts is the DOM layer that calls
// into this module; it owns no snapping logic of its own.
import { getBand } from '../content';
import type { BandId } from '../content';

/** The seven numeric bands in ascending order, then 'beyond' (R-01, R-01b, D-023, D-029). */
export const BAND_ORDER: readonly BandId[] = [80, 150, 220, 360, 490, 610, 750, 'beyond'];

/** The numeric bands only — 'beyond' has no headcount, it is a stop past the last one. */
export const NUMERIC_BANDS = [80, 150, 220, 360, 490, 610, 750] as const;

/** Slider raw-value bounds (R-01: "range ~25 to 1,000+"). */
export const SLIDER_MIN = 25;
export const SLIDER_MAX = 1000;

/**
 * The midpoint between each pair of adjacent numeric bands, used as the
 * snapping threshold: a raw value below THRESHOLDS[i] belongs to
 * NUMERIC_BANDS[i]. The value above the last threshold (between 750 and the
 * 1,000+ stop) snaps to 'beyond'.
 */
function thresholds(): number[] {
  const t: number[] = [];
  for (let i = 0; i < NUMERIC_BANDS.length - 1; i += 1) {
    t.push((NUMERIC_BANDS[i] + NUMERIC_BANDS[i + 1]) / 2);
  }
  // Last threshold: midpoint between the final real band (750) and the
  // top of the slider's range, which is where the 1,000+ stop lives.
  t.push((NUMERIC_BANDS[NUMERIC_BANDS.length - 1] + SLIDER_MAX) / 2);
  return t;
}

const THRESHOLDS = thresholds();

/**
 * Snaps an arbitrary raw headcount (from the slider's continuous input) to
 * the nearest band (R-01). Values at or below the first band snap to it;
 * values at or above the last threshold snap to 'beyond' (R-01b).
 */
export function nearestBand(raw: number): BandId {
  for (let i = 0; i < NUMERIC_BANDS.length; i += 1) {
    if (raw < THRESHOLDS[i]) {
      return NUMERIC_BANDS[i];
    }
  }
  return 'beyond';
}

/** Index of a band within BAND_ORDER (0..7), for comparisons and iteration. */
export function bandIndex(band: BandId): number {
  return BAND_ORDER.indexOf(band);
}

/**
 * True when `band` is at or after `threshold` in the fixed band order.
 * 'beyond' is always at-or-after every numeric threshold (it never grows
 * past what 750 already has — see src/scene/slots.ts — but geography that
 * exists at 750 must still show as present at 'beyond').
 */
export function isAtLeast(band: BandId, threshold: Exclude<BandId, 'beyond'>): boolean {
  return bandIndex(band) >= bandIndex(threshold);
}

/**
 * The readout string (brief 3c): "~N → YEAR, ~BAND", e.g. "~400 → 2022,
 * ~490". At the 'beyond' stop there is no year or snapped headcount to
 * show (content.json's band.year/people are null there), so the format
 * collapses to "~N → Beyond".
 */
export function formatReadout(raw: number, band: BandId): string {
  const rounded = Math.round(raw);
  if (band === 'beyond') {
    return `~${rounded} → Beyond`;
  }
  const info = getBand(band);
  const year = info?.year ?? String(band);
  const people = info?.people ?? `~${band}`;
  return `~${rounded} → ${year}, ${people}`;
}

/** aria-live announcement text: shorter than the readout, band-focused. */
export function formatAnnouncement(band: BandId): string {
  const info = getBand(band);
  if (band === 'beyond' || !info) {
    return 'Beyond — 1,000+, the from-zero seat inside a big company.';
  }
  return `${info.year} — ${info.people} people. ${info.title}.`;
}
