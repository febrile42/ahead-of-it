// PH1-04 slider (brief 3c): a real range input, snapped to the seven bands
// plus 'beyond' (R-01, R-01b). Snapping math lives in src/scene/bands.ts
// (pure, tested); this module is the DOM wiring only.
//
// S1: the markup already exists in index.html (the static shell, reserved
// for CLS) — this module looks its pieces up by class/id and fills them
// in, it does not create or append them.
import { copy, getBand } from '../content';
import type { BandId } from '../content';
import { BAND_ORDER, NUMERIC_BANDS, SLIDER_MAX, SLIDER_MIN, formatAnnouncement, formatReadout, nearestBand } from '../scene/bands';

export interface SliderHandles {
  input: HTMLInputElement;
  onChange: (listener: (band: BandId, raw: number) => void) => void;
}

// S2: 2018/2019/2020 crowd and overlap at 390px (measured 23-49, 49-75,
// 74-101px), and showing every band leaves no room to right-align the
// 1,000+ stop without it overflowing the viewport. Label only the
// boundary bands; the readout carries the rest.
const LABELED_TICKS: ReadonlySet<BandId> = new Set([80, 360, 750]);

function percentFor(value: number): number {
  return ((value - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100;
}

/** Fills in the static slider shell from index.html and wires its behaviour. Does not create or attach any elements. */
export function createSlider(container: HTMLElement, initialBand: BandId = 80): SliderHandles {
  const labelEl = container.querySelector<HTMLLabelElement>('.slider__label');
  const readoutEl = container.querySelector<HTMLParagraphElement>('.slider__readout');
  const inputEl = container.querySelector<HTMLInputElement>('#headcount-slider');
  const ticksEl = container.querySelector<HTMLDivElement>('.slider__ticks');
  const liveEl = container.querySelector<HTMLParagraphElement>('.slider__live');
  if (!labelEl || !readoutEl || !inputEl || !ticksEl || !liveEl) {
    throw new Error('createSlider: index.html is missing the static slider shell');
  }
  // Re-bound as non-null so the nested update() closure below (which
  // TypeScript doesn't narrow across) still type-checks.
  const label = labelEl;
  const readout = readoutEl;
  const input = inputEl;
  const ticks = ticksEl;
  const live = liveEl;

  // B6: the label is content, not a component literal (R-05) — TONE.md's
  // copy.sliderLabel is "at your scale", and if a "Headcount —" prefix is
  // wanted that has to go into TONE.md first (mastermind call).
  label.textContent = copy.sliderLabel;

  input.min = String(SLIDER_MIN);
  input.max = String(SLIDER_MAX);
  input.step = '1';
  const initialInfo = getBand(initialBand);
  input.value = String(
    initialBand === 'beyond' ? SLIDER_MAX : Number(initialInfo?.people?.replace(/[^0-9]/g, '') || initialBand)
  );

  ticks.replaceChildren();
  for (const band of NUMERIC_BANDS) {
    if (!LABELED_TICKS.has(band)) continue;
    const tick = document.createElement('span');
    tick.className = 'slider__tick';
    if (band === NUMERIC_BANDS[0]) tick.classList.add('slider__tick--first');
    tick.style.left = `${percentFor(band)}%`;
    const info = getBand(band);
    tick.textContent = info?.year ?? String(band);
    ticks.append(tick);
  }
  // S2: the 1,000+ stop sits at the very top of the range — anchoring it
  // by its right edge (rather than centring on left:100%) keeps it inside
  // the viewport instead of overflowing to 393px and scrolling the page.
  const beyondTick = document.createElement('span');
  beyondTick.className = 'slider__tick slider__tick--beyond';
  beyondTick.textContent = '1,000+';
  ticks.append(beyondTick);

  const listeners: Array<(band: BandId, raw: number) => void> = [];
  let lastBand: BandId | null = null;

  function update(raw: number, announce: boolean) {
    const band = nearestBand(raw);
    readout.textContent = formatReadout(raw, band);
    // S3: a screen reader otherwise reads the raw slider value ("437")
    // instead of the formatted readout.
    input.setAttribute('aria-valuetext', formatReadout(raw, band));
    if (band !== lastBand) {
      lastBand = band;
      if (announce) live.textContent = formatAnnouncement(band);
      for (const listener of listeners) listener(band, raw);
    }
  }

  input.addEventListener('input', () => update(Number(input.value), true));
  update(Number(input.value), false);

  return {
    input,
    onChange(listener) {
      listeners.push(listener);
    },
  };
}

export { BAND_ORDER };
