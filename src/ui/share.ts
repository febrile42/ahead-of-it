// D-057 item 7 (PH3-02, DIA-235): the "Share image" control's behaviour.
//
// Not wired into index.html/main.ts yet — the control's visible label and
// accessible name are the Product Lead's (new visible text, per the D-057
// brief's own "Boundaries" section and item 7), and that string doesn't
// exist in content.json yet (DIA-247, filed alongside this build). Adding
// the static shell markup ahead of the real copy would mean either
// inventing a label (the nothing-invented rule) or shipping an unlabeled
// pill — this module is the ready-to-wire behaviour so that once DIA-247
// lands, plugging it in is a small, mechanical change: a static `<a>` shell
// in index.html's #view-nav (same S1 pattern as #punch-list-button) plus
// one `initShareControl(...)` call from main.ts's render().
//
// Always hands over the *without* image of the current stop, even from the
// built state (R-11, D-022) — callers pass the without-state href/filename
// regardless of the visible toggle state.
import { track } from '../analytics';
import type { ShareStop } from '../scene/share-image';

/** D-057 item 7: "a tap first tries `navigator.share({ files: [png] })`
 * where `navigator.canShare` accepts files" — a pure predicate so the
 * capability check itself needs no DOM/fetch to test. */
export function canShareFile(nav: Pick<Navigator, 'canShare' | 'share'> | undefined, file: File): boolean {
  return typeof nav?.canShare === 'function' && typeof nav.share === 'function' && nav.canShare({ files: [file] });
}

export interface ShareControlOptions {
  /** Called once activation actually happens (Web Share accepted, or the
   * plain link's default download begins) — the only place `track` fires,
   * so a prefetch or a refused/cancelled share never counts as a share. */
  onActivate?: () => void;
}

function shareFileName(stop: ShareStop): string {
  return `ahead-of-it-${stop}.png`;
}

/** Fetched once per stop, starting on the first `pointerdown`/`focus`
 * (D-057 item 7: "fetched on pointerdown/focus so the share call keeps its
 * user activation"). `navigator.share()` must be *called* synchronously
 * within the click handler's own call stack to count as still inside the
 * user gesture — fetching the PNG inside the click handler itself would
 * lose that activation on anything slower than an instant response, so
 * this only ever hands `initShareControl` an already-resolved `File`
 * (`resolved`); a click that lands before the fetch finishes falls through
 * to the plain link instead of waiting. */
class SharePrefetch {
  private pending = new Map<ShareStop, Promise<File>>();
  private resolved = new Map<ShareStop, File>();

  start(stop: ShareStop): void {
    if (this.pending.has(stop)) return;
    const request = fetch(`/share/${stop}.png`, { cache: 'force-cache' })
      .then((res) => {
        if (!res.ok) throw new Error(`/share/${stop}.png: ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        const file = new File([blob], shareFileName(stop), { type: 'image/png' });
        this.resolved.set(stop, file);
        return file;
      });
    this.pending.set(stop, request);
  }

  /** The prefetched file for `stop`, or `undefined` if it hasn't resolved
   * (or hasn't started) yet — never awaited, so a caller checking this from
   * inside a click handler stays synchronous. */
  get(stop: ShareStop): File | undefined {
    return this.resolved.get(stop);
  }
}

/**
 * Wires an existing `<a href="/share/<stop>.png" download="...">` shell
 * element (S1: index.html reserves it, this only fills in behaviour — no
 * element is created or appended here). `getStop()` reads whatever the
 * caller considers "current" at activation time, so a slider drag between
 * prefetch and click can't hand over a stale image.
 *
 * With no script this is already a working download link (the shell's own
 * `href`/`download` attributes); every enhancement below only ever adds a
 * faster/better path on top; a caught rejection or an unsupported
 * `navigator.share` always falls through to that plain link, unprevented.
 */
export function initShareControl(anchor: HTMLAnchorElement, getStop: () => ShareStop, options: ShareControlOptions = {}): void {
  const prefetch = new SharePrefetch();

  const syncHref = () => {
    const stop = getStop();
    anchor.href = `/share/${stop}.png`;
    anchor.download = shareFileName(stop);
  };
  syncHref();

  const startPrefetch = () => prefetch.start(getStop());
  anchor.addEventListener('pointerdown', startPrefetch);
  anchor.addEventListener('focus', startPrefetch);

  anchor.addEventListener('click', (event) => {
    syncHref();
    const stop = getStop();
    const file = prefetch.get(stop);

    // `preventDefault` and the `navigator.share()` *call* both have to
    // happen synchronously, right here, to still count as inside this
    // click's user activation (D-057 item 7) — a file that hasn't resolved
    // yet (a very fast tap, or a keyboard activation with no prior
    // pointerdown/focus prefetch) just falls through to the plain link
    // below, same as `!canShareFile`.
    if (!file || !canShareFile(navigator, file)) {
      options.onActivate?.();
      return;
    }

    event.preventDefault();
    navigator
      .share({ files: [file] })
      .then(() => options.onActivate?.())
      .catch((err: unknown) => {
        // AbortError is the visitor dismissing the share sheet — a
        // deliberate "no", not a failure, so it does nothing further
        // (forcing a download after they said no would be its own bad
        // surprise). Anything else (refused, unsupported at call time) is
        // D-057's "refused" case: fall back to the plain download.
        if (err instanceof Error && err.name === 'AbortError') return;
        // A synthetic click on `anchor` itself would re-enter this same
        // handler (same element, same listener) and try navigator.share()
        // again — a fresh, listener-less element gets the plain download
        // the preventDefault() above blocked, with no risk of looping.
        const fallback = document.createElement('a');
        fallback.href = anchor.href;
        fallback.download = anchor.download;
        fallback.rel = 'noopener';
        fallback.click();
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
