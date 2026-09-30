// D-061 (DIA-262 decision, DIA-264): the "Share image" control's behaviour,
// amending D-057 item 7 — the control shares a *link*, not a file. The page
// URL `/?n=<stop>&it=none` already unfurls as the matching PNG through
// D-057 item 6's OG rewrite, so handing over the link gives the recipient
// the same picture and caption a downloaded file would, and a tap opens the
// live page instead of a dead end.
//
// Wired from src/main.ts onto index.html's static `#share-control` shell
// (S1 pattern, same as #punch-list-button); the visible label and
// accessible name are content.json's `ui.shareButton`/`ui.shareButtonName`
// (Product Lead, DIA-247), and the toast text is `ui.shareCopied`
// (DIA-263) — set once by main.ts, never invented here.
//
// `shareUrl`/`canShareLink`/`activateShare` below are the pure decision
// logic (vitest, no DOM — this repo's unit tests run in plain Node,
// src/ui/checklist.ts's own header/vitest.config.ts's comment explain why),
// the same split D-057 item 7's original `canShareFile` used. `syncShareHref`
// and `initShareControl` are the DOM wiring on top of it; tests/share-
// control.spec.ts (Playwright) is their coverage.
import { track } from '../analytics';
import { sceneBandForStop } from '../scene/share-image';
import type { ShareStop } from '../scene/share-image';
import { sceneSearchParams } from '../url-state';

export interface ShareControlOptions {
  /** Called once activation actually happens (Web Share resolved, or the
   * clipboard write succeeded) — the only place `track` fires, so a
   * dismissed share sheet or a failed clipboard write never counts as a
   * share. */
  onActivate?: () => void;
}

/** D-061 step 1: the exact `<origin>/?n=<stop>&it=none` link for `stop` —
 * R-10's own query string, built from url-state's own serializer
 * (`sceneSearchParams`) so it round-trips through `parseInitialSceneState`
 * exactly like every other write of that string. Always the *without*
 * state (R-11, D-022), whatever `stop` maps to. Takes `origin` as a plain
 * argument (rather than reading `location.origin` itself), the same reason
 * `parseInitialSceneState` takes `search` instead of reading
 * `window.location.search` — it keeps this unit-testable with no DOM. */
export function shareUrl(origin: string, stop: ShareStop): string {
  return `${origin}/?${sceneSearchParams(sceneBandForStop(stop), 'without')}`;
}

/** D-061 step 2's touch/Web-Share predicate — a pure check so it needs no
 * DOM/`matchMedia` to test, the same shape as the old `canShareFile(nav,
 * file)`. `pointerCoarse` is the caller's own
 * `matchMedia('(pointer: coarse)').matches` read. */
export function canShareLink(nav: Pick<Navigator, 'share'> | undefined, pointerCoarse: boolean): boolean {
  return pointerCoarse && typeof nav?.share === 'function';
}

function isAbort(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

export type ShareOutcome = 'shared' | 'copied' | 'aborted' | 'fallback';

/** D-061 steps 2-3, as one pure state machine: try Web Share on a touch
 * device first (`env.share`), otherwise (or on any non-abort failure) try
 * the clipboard (`env.copyText`). `'fallback'` covers every case neither
 * succeeds — clipboard unsupported (`env.copyText` absent) or its write
 * rejected — and means "the caller should let the link navigate", which is
 * harmless since it is the same page the anchor already points at.
 * `env.share`/`env.copyText` are plain functions, not `Navigator`/
 * `Clipboard` objects, so this needs no DOM to test either. */
export async function activateShare(
  url: string,
  env: { touch: boolean; share?: (opts: { url: string }) => Promise<void>; copyText?: (text: string) => Promise<void> }
): Promise<ShareOutcome> {
  if (env.touch && env.share) {
    try {
      await env.share({ url });
      return 'shared';
    } catch (err) {
      // AbortError is the visitor dismissing the share sheet — a
      // deliberate "no", not a failure, so nothing further happens.
      // Anything else (refused, unsupported at call time) falls through
      // to the clipboard path below.
      if (isAbort(err)) return 'aborted';
    }
  }
  if (!env.copyText) return 'fallback';
  try {
    await env.copyText(url);
    return 'copied';
  } catch {
    return 'fallback';
  }
}

/** Sets `anchor`'s `href` to `stop`'s share link — the no-script baseline
 * (D-061: "the anchor's href is the share URL, with no download
 * attribute"), a real working link even before any script runs, and even
 * for a visitor whose browser never fires the click handler below (a
 * screen reader's browse mode, `curl`, a middle-click into a new tab).
 * Exported so main.ts can call it on every band change, not just inside
 * `initShareControl`'s own click handler. */
export function syncShareHref(anchor: HTMLAnchorElement, stop: ShareStop): void {
  anchor.href = shareUrl(location.origin, stop);
}

/**
 * Wires an existing `<a href="/?n=<stop>&it=none">` shell element (S1:
 * index.html reserves it, this only fills in behaviour — no element is
 * created or appended here). `getStop()` reads whatever the caller
 * considers "current" at click time, so a slider drag between renders
 * can't hand over a stale link. `toast` is index.html's own reusable
 * `#share-toast` shell (S1, no CLS); `copiedMessage` is content.json's
 * `ui.shareCopied`, read once by main.ts the same way every other
 * static-chrome string is.
 *
 * With no script this is already a working link (the shell's own `href`
 * attribute); every enhancement below only ever adds a faster/better path
 * on top of `activateShare`'s `'fallback'` outcome, which just navigates
 * there directly — same destination either way.
 */
export function initShareControl(
  anchor: HTMLAnchorElement,
  getStop: () => ShareStop,
  toast: HTMLElement,
  copiedMessage: string,
  options: ShareControlOptions = {}
): void {
  syncShareHref(anchor, getStop());

  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  let toastFrame: number | undefined;
  /** D-061 step 4: shown near the control for ~2.5s; a second activation
   * resets this same timer rather than stacking a second toast — there is
   * only ever the one shell element. Positions itself from #share-control's
   * own rendered rect each time, since that element moves between
   * #view-nav and the rail at 1152px (main.ts's placeShareControl) — review
   * flagged the old fixed bottom-center spot as far from the control on a
   * phone.
   *
   * Text is cleared, then set a frame later (`requestAnimationFrame`,
   * cancelling and redoing a still-pending one so a rapid repeat click only
   * ever lands the last write): review, DIA-264 — most screen readers only
   * announce a role="status" region's text if that region was already
   * present/unhidden *before* the text changed, and a repeat click setting
   * the same text again isn't a change an AT will re-announce unless the
   * region visibly goes empty first. */
  const showToast = () => {
    const rect = anchor.getBoundingClientRect();
    toast.style.top = `${rect.bottom + 8}px`;
    toast.style.right = `${Math.max(8, window.innerWidth - rect.right)}px`;

    if (toastTimer !== undefined) clearTimeout(toastTimer);
    if (toastFrame !== undefined) cancelAnimationFrame(toastFrame);
    toast.textContent = '';
    toast.classList.remove('toast--visible');
    toastFrame = requestAnimationFrame(() => {
      toast.textContent = copiedMessage;
      toast.classList.add('toast--visible');
      toastFrame = undefined;
    });
    toastTimer = setTimeout(() => {
      toast.classList.remove('toast--visible');
      toast.textContent = '';
      toastTimer = undefined;
    }, 2500);
  };

  anchor.addEventListener('click', (event) => {
    // A modifier held down is the visitor asking the browser for its own
    // behaviour (open in a new tab/window) — defer to the href's own
    // no-script baseline rather than intercepting it.
    if (event.metaKey || event.ctrlKey || event.shiftKey) return;
    const url = shareUrl(location.origin, getStop());
    const touch = canShareLink(navigator, matchMedia('(pointer: coarse)').matches);
    // `preventDefault` and the `navigator.share()`/`navigator.clipboard`
    // *calls* both have to happen synchronously, right here, to still
    // count as inside this click's user activation.
    event.preventDefault();
    activateShare(url, {
      touch,
      share: touch ? (opts) => navigator.share(opts) : undefined,
      copyText: navigator.clipboard?.writeText ? (text) => navigator.clipboard.writeText(text) : undefined,
    }).then((outcome) => {
      if (outcome === 'shared' || outcome === 'copied') options.onActivate?.();
      if (outcome === 'copied') showToast();
      if (outcome === 'fallback') location.assign(url);
    });
  });
}

// share_image (D-016) is called from initShareControl's onActivate hook,
// not directly from this module — main.ts supplies `{ onActivate: () =>
// track('share_image') }` once the control is wired in (see this file's
// header). Importing `track` here (rather than leaving that entirely to
// main.ts) keeps the "only a real activation fires the event" rule local to
// the one place that knows the difference between a prefetch and a share.
export const trackShareImage = (): void => track('share_image');
