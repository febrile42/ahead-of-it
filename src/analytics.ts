// PH3-04 (DIA-230): first-party analytics, the D-016 event set (R-17).
// D-016: "Via the existing /u/* proxy pattern (Worker umami-proxy), same as
// joshgister.com." That repo wasn't reachable from this workspace when this
// was built (docs/briefs/PH3-04-analytics.md, notes repo), so the tracker
// contract below is Umami's own documented reverse-proxy shape
// (docs.umami.is/docs/tracker-configuration, .../bypass-ad-blockers), not
// copied from joshgister.com — say so in review.
//
// The Umami **website id** is build-time config (VITE_UMAMI_WEBSITE_ID, an
// env/repo variable — see vite-env.d.ts), never source. Unset, `track()`
// never touches the DOM and never makes a request: that is what keeps this
// mergeable before Josh supplies the id (DIA-226). Do Not Track / Global
// Privacy Control are checked before the tracker script is even requested —
// the strongest form of "respect" available, since it means the one
// request that could identify a visiting session is never made at all.
export type AnalyticsEvent =
  | 'band_change'
  | 'gag_open'
  | 'switch_flip'
  | 'punchlist_download'
  | 'share_image'
  | 'contact_click';

// The exact D-016 event set. src/analytics.test.ts asserts every literal
// `track(...)` call site in src/ uses one of these names and nothing else —
// N-05 ("no headcount value") holds structurally, because `track` takes no
// second argument a call site could smuggle a band or count through.
export const ANALYTICS_EVENTS: readonly AnalyticsEvent[] = [
  'band_change',
  'gag_open',
  'switch_flip',
  'punchlist_download',
  'share_image',
  'contact_click',
];

// Served first-party under /u/* on this Worker's own origin (R-21) — see
// src/worker/index.ts for the proxy side of this contract. `HOST_PATH` is
// passed as `data-host-url` because Umami's tracker otherwise resolves the
// collect endpoint from the script's *origin* only (dropping the `/u`
// prefix), which would put `/api/send` outside this Worker's `/u/*` route.
const SCRIPT_SRC = '/u/script.js';
const HOST_PATH = '/u';

declare global {
  interface Window {
    umami?: { track: (event: string) => void };
    // Test-only override (tests/analytics.spec.ts) — same convention as
    // main.ts's other e2e hooks (document.body.dataset.renderedToken etc.):
    // lets a Playwright test exercise the "id configured" path against the
    // one build CI already produced, without a second build.
    __ANALYTICS_TEST_WEBSITE_ID__?: string;
  }
  interface Navigator {
    // Not yet in TypeScript's DOM lib; Chrome/Firefox/Safari all expose it.
    readonly globalPrivacyControl?: boolean;
  }
}

/** Pure predicate — unit-tested directly (no DOM needed): a website id must be present and neither privacy signal set. */
export function isTrackingEnabled(websiteId: string | null | undefined, doNotTrack: boolean): boolean {
  return Boolean(websiteId) && !doNotTrack;
}

function getWebsiteId(): string | null {
  const configured = window.__ANALYTICS_TEST_WEBSITE_ID__ ?? import.meta.env.VITE_UMAMI_WEBSITE_ID;
  return configured ? configured : null;
}

function isDoNotTrack(): boolean {
  return navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true;
}

let scriptRequested = false;
let scriptReady = false;
const queue: AnalyticsEvent[] = [];

function fire(event: AnalyticsEvent): void {
  window.umami?.track(event);
}

function loadTracker(websiteId: string): void {
  if (scriptRequested) return;
  scriptRequested = true;
  const script = document.createElement('script');
  script.src = SCRIPT_SRC;
  script.defer = true;
  script.dataset.websiteId = websiteId;
  script.dataset.hostUrl = `${window.location.origin}${HOST_PATH}`;
  // D-016's six events are fired explicitly below; Umami's own
  // pageview/click/path-change auto-tracking would add events outside
  // that set (and, for click-tracking, potentially properties beyond a
  // stop-independent name).
  script.dataset.autoTrack = 'false';
  // Belt-and-suspenders with isDoNotTrack() above: that check stops the
  // script from ever being requested; this stops the tracker's own
  // internal calls too, in case a future auto-track option is turned back
  // on without re-deriving this list.
  script.dataset.doNotTrack = 'true';
  script.addEventListener('load', () => {
    scriptReady = true;
    for (const event of queue.splice(0)) fire(event);
  });
  document.head.append(script);
}

/** Fires one of the D-016 events. A no-op with no website id configured, or when Do Not Track / GPC is set (R-17). */
export function track(event: AnalyticsEvent): void {
  const websiteId = getWebsiteId();
  if (!isTrackingEnabled(websiteId, isDoNotTrack())) return;
  loadTracker(websiteId!);
  if (scriptReady) fire(event);
  else queue.push(event);
}

// share_image (D-016) has no caller yet — PH3-02 (share image) hasn't
// landed. Once it has, its click handler calls `track('share_image')`
// directly; no separate hook is needed here.
