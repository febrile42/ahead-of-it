// D-057 item 6 (PH3-02, DIA-235): the per-URL OG rewrite's own data — which
// `og:image`/`twitter:image`/`og:url` a request's `?n=`/`?it=` resolve to.
// Pure (a URL in, two strings out), so it needs no Workers runtime
// (HTMLRewriter, ASSETS) to test — src/worker/index.ts is the only place
// that touches those.
import { parseInitialSceneState } from '../url-state';
import { shareStopForBand } from '../scene/share-image';

export interface ShareOg {
  /** Absolute, e.g. `https://example.test/share/80.png?v=<hash>` (no `?v=` when `hashes` has none for the stop). */
  image: string;
  /** Absolute, e.g. `https://example.test/?n=80` or `...?n=80&it=none`. */
  url: string;
}

/** `hashes` is `public/share/hashes.json` — a short content hash per stop,
 * written by `npm run share:render`, that busts unfurlers' own URL-keyed
 * image cache when a share PNG changes (D-057 item 6, "Cache"). */
export type ShareHashes = Partial<Record<string, string>>;

/**
 * Resolves `url`'s `?n=`/`?it=` the same way the page itself does
 * (`parseInitialSceneState` — a missing or invalid `n` gives band 80, same
 * as D-043's own fallback), then maps to the share stop and builds both
 * meta values from `url.origin` so staging unfurls against staging with no
 * configuration (D-057 item 6, "Absolute https URLs").
 */
export function computeShareOg(url: URL, hashes: ShareHashes): ShareOg {
  const initial = parseInitialSceneState(url.search);
  const stop = shareStopForBand(initial.band);
  const hash = hashes[String(stop)];
  const image = `${url.origin}/share/${stop}.png${hash ? `?v=${hash}` : ''}`;

  const ogUrlParams = new URLSearchParams({ n: String(stop) });
  // "`&it=none` only when the request asked for it" — the without state.
  if (initial.state === 'without') ogUrlParams.set('it', 'none');

  return { image, url: `${url.origin}/?${ogUrlParams.toString()}` };
}
