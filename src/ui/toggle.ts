// PH1-04 toggle (brief 3d): built <-> without, TONE.md copy, and the
// static one-line nudge that appears once, after the first slider change
// (R-06a — animation/pulse is Phase 2; this is the static version).
import { copy } from '../content';

export type SceneState = 'built' | 'without';

export interface ToggleHandles {
  root: HTMLElement;
  button: HTMLButtonElement;
  nudge: HTMLElement;
  onChange: (listener: (state: SceneState) => void) => void;
  /** Reveals the nudge once (idempotent) — src/main.ts calls this after the first slider move. */
  showNudge: () => void;
}

export function createToggle(initial: SceneState = 'built'): ToggleHandles {
  const root = document.createElement('div');
  root.className = 'toggle';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'toggle__button';

  const subtitle = document.createElement('p');
  subtitle.className = 'toggle__subtitle';
  // "What he'd already built" toggle state's subtitle (TONE.md's OG
  // description doubles as this subtitle, per the brief's deliverable c).
  subtitle.textContent = copy.ogDescription;

  const nudge = document.createElement('p');
  nudge.className = 'toggle__nudge';
  nudge.hidden = true;
  nudge.textContent = copy.nudge;

  root.append(button, subtitle, nudge);

  let state: SceneState = initial;
  const listeners: Array<(state: SceneState) => void> = [];

  function render() {
    button.textContent = state === 'built' ? copy.toggleToWithout : copy.toggleToBuilt;
    button.setAttribute('aria-pressed', state === 'without' ? 'true' : 'false');
    subtitle.hidden = state !== 'built';
  }

  button.addEventListener('click', () => {
    state = state === 'built' ? 'without' : 'built';
    render();
    for (const listener of listeners) listener(state);
  });

  render();

  return {
    root,
    button,
    nudge,
    onChange(listener) {
      listeners.push(listener);
    },
    showNudge() {
      nudge.hidden = false;
    },
  };
}
