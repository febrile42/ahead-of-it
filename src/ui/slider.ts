// PH1-04 slider (brief 3c): a real range input, snapped to the seven bands
// plus 'beyond' (R-01, R-01b). Snapping math lives in src/scene/bands.ts
// (pure, tested); this module is the DOM wiring only.
import { getBand } from '../content';
import type { BandId } from '../content';
import { BAND_ORDER, NUMERIC_BANDS, SLIDER_MAX, SLIDER_MIN, formatAnnouncement, formatReadout, nearestBand } from '../scene/bands';

export interface SliderHandles {
  root: HTMLElement;
  input: HTMLInputElement;
  onChange: (listener: (band: BandId, raw: number) => void) => void;
}

function percentFor(value: number): number {
  return ((value - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100;
}

/** Builds the slider control and returns its root element + a subscribe hook. Does not attach it to the page. */
export function createSlider(initialBand: BandId = 80): SliderHandles {
  const root = document.createElement('div');
  root.className = 'slider';

  const label = document.createElement('label');
  label.className = 'slider__label';
  label.htmlFor = 'headcount-slider';
  // copy.sliderLabel = "at your scale" (TONE.md); index.html sets the
  // static fallback text, this mirrors it so the label is never blank
  // before content.json's copy loads (it's a synchronous import, so in
  // practice it never is, but the id/text is duplicated here on purpose —
  // see src/main.ts for the copy-driven version).
  label.textContent = 'Headcount — at your scale';

  const readout = document.createElement('p');
  readout.className = 'slider__readout';
  readout.setAttribute('aria-hidden', 'true'); // the live region below carries the a11y announcement

  const input = document.createElement('input');
  input.type = 'range';
  input.id = 'headcount-slider';
  input.min = String(SLIDER_MIN);
  input.max = String(SLIDER_MAX);
  input.step = '1';
  const initialInfo = getBand(initialBand);
  input.value = String(
    initialBand === 'beyond' ? SLIDER_MAX : Number(initialInfo?.people?.replace(/[^0-9]/g, '') || initialBand)
  );

  const ticks = document.createElement('div');
  ticks.className = 'slider__ticks';
  ticks.setAttribute('aria-hidden', 'true');
  for (const band of NUMERIC_BANDS) {
    const tick = document.createElement('span');
    tick.className = 'slider__tick';
    tick.style.left = `${percentFor(band)}%`;
    const info = getBand(band);
    tick.textContent = info?.year ?? String(band);
    ticks.append(tick);
  }
  // The 1,000+ stop's tick sits at the top of the range.
  const beyondTick = document.createElement('span');
  beyondTick.className = 'slider__tick slider__tick--beyond';
  beyondTick.style.left = '100%';
  beyondTick.textContent = '1,000+';
  ticks.append(beyondTick);

  const live = document.createElement('p');
  live.className = 'slider__live sr-only';
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('role', 'status');

  root.append(label, readout, input, ticks, live);

  const listeners: Array<(band: BandId, raw: number) => void> = [];
  let lastBand: BandId | null = null;

  function update(raw: number, announce: boolean) {
    const band = nearestBand(raw);
    readout.textContent = formatReadout(raw, band);
    if (band !== lastBand) {
      lastBand = band;
      if (announce) live.textContent = formatAnnouncement(band);
      for (const listener of listeners) listener(band, raw);
    }
  }

  input.addEventListener('input', () => update(Number(input.value), true));
  update(Number(input.value), false);

  return {
    root,
    input,
    onChange(listener) {
      listeners.push(listener);
    },
  };
}

export { BAND_ORDER };
