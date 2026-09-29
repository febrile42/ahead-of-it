// PH3-04 (DIA-230) / DIA-254 go-live: the /u/* first-party proxy D-016
// calls for ("Via the existing /u/* proxy pattern... same as
// joshgister.com"). joshgister.com's repo wasn't reachable from this
// workspace to copy its exact setup from (docs/briefs/PH3-04-analytics.md,
// notes repo) — this is Umami's own documented reverse-proxy contract
// instead (docs.umami.is/docs/tracker-configuration, .../bypass-ad-
// blockers): GET /u/script.js mirrors {UMAMI_HOST}/script.js, POST
// /u/api/send mirrors {UMAMI_HOST}/api/send (the path src/analytics.ts's
// `data-host-url` sends events to).
//
// DIA-226/DIA-254: Josh gave the website id and left the proxy location to
// CEO, who ruled this Worker (same-origin on every host served — staging,
// prod, and the future custom domain — and it deploys/tests with the app,
// with no cross-repo route coupling). `proxyCollect` forwards the client's
// `User-Agent` and `CF-Connecting-IP` (as `X-Forwarded-For`) upstream, the
// pattern in Umami's reverse-proxy docs, so visitor/device/bot counts are
// right; nothing else (no cookies) is forwarded. Umami derives a salted
// session hash and a geo lookup from the IP and doesn't store it raw, so
// D-016's privacy line holds.
//
// `UMAMI_HOST` is now set (wrangler.jsonc `vars`) — Josh supplied the
// tracker host on DIA-254, so both routes proxy for real instead of 404ing.
//
// Adding a Worker script changes wrangler.jsonc from assets-only
// (docs/product/03-RESOURCING.md) to assets + this script; everything that
// isn't /u/* or `/` still resolves exactly as before, because Cloudflare
// only invokes a Worker's fetch handler for a request that didn't already
// match a static file (developers.cloudflare.com/workers/static-assets/
// binding) *unless* `run_worker_first` names the path (wrangler.jsonc lists
// `/`, for D-057 below); the one case that reaches this handler without
// matching a route below (env.ASSETS.fetch) reapplies that same
// not_found_handling itself.
//
// D-057 (PH3-02, DIA-235): `/` also runs through this Worker so each `?n=`
// stop gets its own `og:image`/`twitter:image`/`og:url` — unfurlers run no
// JavaScript, so the static index.html's own tags can only ever be right
// for one band (80). `computeShareOg` (src/worker/share-og.ts) is the pure
// half of this (URL in, two strings out, fully unit-tested); this file only
// adds the HTMLRewriter plumbing, which needs the real Workers runtime to
// exercise (see src/worker/index.test.ts's header — same "not available in
// this environment" limit PH3-04 hit; the src/worker/share-og.test.ts and
// the minimal-shim rewrite test below are what this environment can run).

/// <reference lib="webworker" />
// Ambient — this repo's tsconfig.json doesn't include
// @cloudflare/workers-types (no tsc --noEmit step exists yet to need the
// full package, PH1-03's src/content/index.ts makes the same call), and DOM
// lib has no HTMLRewriter. Only the narrow surface this file actually calls.
declare global {
  interface Element {
    setAttribute(name: string, value: string): Element;
  }
  interface HTMLRewriterElementContentHandlers {
    element?(element: Element): void;
  }
  class HTMLRewriter {
    on(selector: string, handlers: HTMLRewriterElementContentHandlers): this;
    transform(response: Response): Response;
  }
}

import { computeShareOg } from './share-og';
import shareHashes from './share-hashes.json';

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  UMAMI_HOST?: string;
}

const SCRIPT_PATH = '/u/script.js';
const COLLECT_PATH = '/u/api/send';

class SetContentAttribute implements HTMLRewriterElementContentHandlers {
  constructor(private readonly value: string) {}
  element(element: Element): void {
    element.setAttribute('content', this.value);
  }
}

/** D-057 item 6: rewrites the OG/Twitter image and the canonical OG URL to
 * match `?n=`/`?it=`'s resolved stop. Only these three meta tags change —
 * `og:image:alt` is the caption verbatim and doesn't vary by band, so the
 * static value already in index.html is correct for every stop. */
function rewriteShareOg(html: Response, og: { image: string; url: string }): Response {
  return new HTMLRewriter()
    .on('meta[property="og:image"]', new SetContentAttribute(og.image))
    .on('meta[name="twitter:image"]', new SetContentAttribute(og.image))
    .on('meta[property="og:url"]', new SetContentAttribute(og.url))
    .transform(html);
}

/** D-057 item 6: "If anything throws, it returns the static HTML
 * untouched" — `assetResponse` is fetched once and only cloned into the
 * rewriter, so a throw inside `rewriteShareOg` (or `computeShareOg`) still
 * leaves the original, unread response available to return as-is. */
async function serveIndexWithShareOg(request: Request, env: Env): Promise<Response> {
  const assetResponse = await env.ASSETS.fetch(request);
  try {
    const og = computeShareOg(new URL(request.url), shareHashes);
    return rewriteShareOg(assetResponse.clone(), og);
  } catch {
    return assetResponse;
  }
}

// Rebuilding the response rather than returning `upstream` directly keeps
// this proxy from forwarding anything upstream-specific (Set-Cookie, CF-*)
// that would make a same-origin request look like it's carrying
// third-party state.
async function proxyScript(env: Env): Promise<Response> {
  if (!env.UMAMI_HOST) return new Response('Not found', { status: 404 });
  const upstream = await fetch(`${env.UMAMI_HOST}/script.js`);
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

// DIA-254: forwards exactly two request-identifying headers upstream —
// `User-Agent` and the visitor's real IP (Cloudflare's `CF-Connecting-IP`,
// sent as `X-Forwarded-For` per Umami's reverse-proxy docs) — because
// without them Umami can't tell visitors, devices or bots apart. Nothing
// else (cookies included) is read off `request.headers` here, so no other
// request state crosses this boundary.
function collectHeaders(request: Request): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': request.headers.get('Content-Type') ?? 'application/json',
  };
  const userAgent = request.headers.get('User-Agent');
  if (userAgent) headers['User-Agent'] = userAgent;
  const clientIp = request.headers.get('CF-Connecting-IP');
  if (clientIp) headers['X-Forwarded-For'] = clientIp;
  return headers;
}

async function proxyCollect(request: Request, env: Env): Promise<Response> {
  if (!env.UMAMI_HOST) return new Response('Not found', { status: 404 });
  const upstream = await fetch(`${env.UMAMI_HOST}/api/send`, {
    method: 'POST',
    headers: collectHeaders(request),
    body: await request.text(),
  });
  // Never cached — this is a write, not an asset.
  return new Response(upstream.body, { status: upstream.status });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === SCRIPT_PATH && request.method === 'GET') {
      return proxyScript(env);
    }

    if (url.pathname === COLLECT_PATH && request.method === 'POST') {
      return proxyCollect(request, env);
    }

    if (url.pathname === '/' && request.method === 'GET') {
      return serveIndexWithShareOg(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
