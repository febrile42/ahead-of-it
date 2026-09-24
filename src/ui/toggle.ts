// PH1-04 toggle (brief 3d): built <-> without, TONE.md copy, and the
// static one-line nudge that appears once, after the first slider change
// (R-06a — animation/pulse is Phase 2; this is the static version).
//
// S1: the markup already exists in index.html (the static shell, reserved
// for CLS) — this module looks its pieces up by class and fills them in,
// it does not create or append them.
import { copy } from '../content';

export type SceneState = 'built' | 'without';

export interface ToggleHandles {
  button: HTMLButtonElement;
  nudge: HTMLElement;
  onChange: (listener: (state: SceneState) => void) => void;
  /** Reveals the nudge once (idempotent) — src/main.ts calls this after the first slider move. */
  showNudge: () => void;
  /** Hides the nudge once the visitor has toggled (m2 — its only job was getting them to). */
  hideNudge: () => void;
}

export function createToggle(container: HTMLElement, initial: SceneState = 'built'): ToggleHandles {
  const button = container.querySelector<HTMLButtonElement>('.toggle__button');
  const subtitle = container.querySelector<HTMLParagraphElement>('.toggle__subtitle');
  const nudge = container.querySelector<HTMLElement>('.toggle__nudge');
  if (!button || !subtitle || !nudge) {
    throw new Error('createToggle: index.html is missing the static toggle shell');
  }

  // "What he'd already built" toggle state's subtitle (TONE.md's OG
  // description doubles as this subtitle, per the brief's deliverable c).
  subtitle.textContent = copy.ogDescription;
  nudge.textContent = copy.nudge;

  let state: SceneState = initial;
  const listeners: Array<(state: SceneState) => void> = [];

  function render() {
    button!.textContent = state === 'built' ? copy.toggleToWithout : copy.toggleToBuilt;
    button!.setAttribute('aria-pressed', state === 'without' ? 'true' : 'false');
    subtitle!.hidden = state !== 'built';
  }

  button.addEventListener('click', () => {
    state = state === 'built' ? 'without' : 'built';
    render();
    for (const listener of listeners) listener(state);
  });

  render();

  return {
    button,
    nudge,
    onChange(listener) {
      listeners.push(listener);
    },
    showNudge() {
      // S1c: visibility, not `hidden` — the nudge's line stays reserved in
      // the layout so revealing it doesn't push the scene down.
      nudge!.classList.add('toggle__nudge--visible');
    },
    hideNudge() {
      nudge!.classList.remove('toggle__nudge--visible');
    },
  };
}
