// PH3-04 (DIA-230): the /u/* first-party proxy D-016 calls for ("Via the
// existing /u/* proxy pattern... same as joshgister.com"). joshgister.com's
// repo wasn't reachable from this workspace to copy its exact setup from
// (docs/briefs/PH3-04-analytics.md, notes repo) — this is Umami's own
// documented reverse-proxy contract instead (docs.umami.is/docs/tracker-
// configuration, .../bypass-ad-blockers): GET /u/script.js mirrors
// {UMAMI_HOST}/script.js, POST /u/api/send mirrors {UMAMI_HOST}/api/send
// (the path src/analytics.ts's `data-host-url` sends events to).
//
// `UMAMI_HOST` is an unset Worker var today — DIA-230's brief needs Josh
// for both the Umami website id and *which* Worker should own this route
// (this one, or the existing joshgister.com `umami-proxy`). Until either
// question is answered, both routes 404 — a real, verifiable no-op rather
// than a guess at infrastructure this workspace can't reach or test.
//
// Adding a Worker script changes wrangler.jsonc from assets-only
// (docs/product/03-RESOURCING.md) to assets + this script; everything that
// isn't /u/* still resolves exactly as before, because Cloudflare only
// invokes a Worker's fetch handler for a request that didn't already match
// a static file (developers.cloudflare.com/workers/static-assets/binding),
// and the one case that reaches this handler without matching /u/* below
// (env.ASSETS.fetch) reapplies that same not_found_handling itself.

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  UMAMI_HOST?: string;
}

const SCRIPT_PATH = '/u/script.js';
const COLLECT_PATH = '/u/api/send';

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

async function proxyCollect(request: Request, env: Env): Promise<Response> {
  if (!env.UMAMI_HOST) return new Response('Not found', { status: 404 });
  const upstream = await fetch(`${env.UMAMI_HOST}/api/send`, {
    method: 'POST',
    headers: { 'Content-Type': request.headers.get('Content-Type') ?? 'application/json' },
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

    return env.ASSETS.fetch(request);
  },
};
