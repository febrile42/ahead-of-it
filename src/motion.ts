// PH2-02 (R-24, R-08, R-06a): the one gate every moving thing on the page
// reads before it moves. Anything that plays back sprite frames, times a
// visual change, or drives a CSS animation/transition must ask
// `motionGate().isReduced()` (or subscribe for a runtime flip) instead of
// deciding for itself. When it says `true`, paint the rest pose — the
// exported frame at t = 0, which is already what today's painter draws
// (src/scene/sprites.ts's `loadEntryImage`/`loadSpriteFrame` only ever
// resolve the first frame; Phase 2 animation work must gate *before*
// advancing past it) — and never start a timer, rAF loop, or CSS animation.
// Text is never motion: a caption that accompanies a motion still shows.
// See docs/product/SCENE-FORMAT.md's painter section for the full rule.
const QUERY = '(prefers-reduced-motion: reduce)';

export type MotionListener = (reduced: boolean) => void;

/** The subset of `MediaQueryList` this module needs — narrow enough that a
 * unit test can hand it a plain object instead of a real `matchMedia()`
 * result (vitest runs with no DOM, D-009/vitest.config.ts). */
export interface MotionQuery {
  matches: boolean;
  addEventListener(type: 'change', listener: (event: { matches: boolean }) => void): void;
  removeEventListener(type: 'change', listener: (event: { matches: boolean }) => void): void;
}

export interface MotionGate {
  /** True when motion should be suppressed right now. */
  isReduced(): boolean;
  /** Notified whenever the OS preference changes at runtime (a visitor can
   * flip it with the tab open — no reload). Returns an unsubscribe function. */
  subscribe(listener: MotionListener): () => void;
}

export function createMotionGate(query: MotionQuery): MotionGate {
  let reduced = query.matches;
  const listeners = new Set<MotionListener>();

  query.addEventListener('change', (event) => {
    reduced = event.matches;
    for (const listener of listeners) listener(reduced);
  });

  return {
    isReduced: () => reduced,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

let singleton: MotionGate | null = null;

/** The shared, page-wide gate, created lazily against the real
 * `matchMedia()` on first use — importing this module never touches
 * `window` itself, so it stays safe to import from vitest (node
 * environment, no DOM). */
export function motionGate(): MotionGate {
  if (!singleton) singleton = createMotionGate(window.matchMedia(QUERY));
  return singleton;
}
