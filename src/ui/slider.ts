// PH1-04 slider (brief 3c): a real range input, snapped to the seven bands
// plus 'beyond' (R-01, R-01b). Snapping math lives in src/scene/bands.ts
// (pure, tested); this module is the DOM wiring only.
//
// S1: the markup already exists in index.html (the static shell, reserved
// for CLS) — this module looks its pieces up by class/id and fills them
// in, it does not create or append them.
import { copy, getBand } from '../content';
import type { BandId } from '../content';
import {
  BAND_ORDER,
  NUMERIC_BANDS,
  SLIDER_MAX,
  SLIDER_MIN,
  formatAnnouncement,
  formatReadout,
  nearestBand,
  rawValueForBand,
} from '../scene/bands';

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

/** Fills in the static slider shell from index.html and wires its behaviour. Does not create or attach any elements.
 * `initialRaw` (U-17, DIA-194/197) is the slider's actual starting value — a `?n=` deep link that doesn't land
 * exactly on a band (e.g. 600) — defaulting to the band's own raw value when the caller has no finer number. */
export function createSlider(
  container: HTMLElement,
  initialBand: BandId = 80,
  initialRaw: number = rawValueForBand(initialBand)
): SliderHandles {
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
  // U-01 (DIA-194/195): see rawValueForBand's own doc comment. U-17
  // (DIA-194/197): initialRaw carries a `?n=` deep link's own number when it
  // doesn't land exactly on initialBand, so the readout below can show it.
  input.value = String(initialRaw);

  ticks.replaceChildren();
  for (const band of NUMERIC_BANDS) {
    const tick = document.createElement('span');
    // U-16 (DIA-194/197): every stop gets a mark; only the four boundary
    // bands (plus 'beyond' below) keep a year label — S2's crowding/overlap
    // reasoning for *labels* still holds, it just no longer means the other
    // four stops go unmarked entirely.
    tick.className = LABELED_TICKS.has(band) ? 'slider__tick' : 'slider__tick slider__tick--mark';
    if (band === NUMERIC_BANDS[0]) tick.classList.add('slider__tick--first');
    tick.style.left = `${percentFor(band)}%`;
    if (LABELED_TICKS.has(band)) {
      const info = getBand(band);
      tick.textContent = info?.year ?? String(band);
    }
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

  // U-03 (DIA-194/195): the native range's default key handling moves the
  // raw value by one *unit* per Arrow/PageUp/PageDown press (90 presses to
  // cross from 80 to the next band) and Home/End go to SLIDER_MIN/MAX (25 /
  // 1000), not the first/last band. preventDefault() on keydown suppresses
  // that default entirely (range inputs change value from their keydown
  // handler, not a later keyup/input), so every key path below is this
  // module's own band-stepping, and a real drag (the 'input' listener
  // above) is untouched — it stays continuous.
  const STEP_KEYS = new Set(['ArrowRight', 'ArrowUp', 'PageUp', 'ArrowLeft', 'ArrowDown', 'PageDown', 'Home', 'End']);
  input.addEventListener('keydown', (event) => {
    if (!STEP_KEYS.has(event.key)) return;
    event.preventDefault();
    const atIndex = BAND_ORDER.indexOf(nearestBand(Number(input.value)));
    const lastIndex = BAND_ORDER.length - 1;
    const toIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? lastIndex
          : event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'PageUp'
            ? Math.min(lastIndex, atIndex + 1)
            : Math.max(0, atIndex - 1);
    const toBand = BAND_ORDER[toIndex];
    const toRaw = rawValueForBand(toBand);
    input.value = String(toRaw);
    update(toRaw, true);
  });

  update(Number(input.value), false);

  return {
    input,
    onChange(listener) {
      listeners.push(listener);
    },
  };
}

export { BAND_ORDER };
