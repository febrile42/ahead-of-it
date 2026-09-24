import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

// R-16/D-018: `X-Robots-Tag: noindex, nofollow` must reach every response,
// not just the HTML `<meta name="robots">` tag (crawlers that fetch
// non-HTML routes, or that ignore body meta tags, only see the header).
// It is set by public/_headers, which Cloudflare's static-assets serving
// applies at the edge — see wrangler.jsonc's "assets" block. `vite
// preview` is a plain static file server and does NOT interpret
// `_headers` (that parsing is Cloudflare/Pages-specific), so a live
// request against the local preview server can never observe this
// header — confirmed empirically: `curl -D - http://localhost:4173/`
// against a `vite preview` server shows no X-Robots-Tag. This test
// therefore verifies the *source of truth for the header*, public/_headers
// itself, rather than faking an HTTP assertion that would pass locally for
// the wrong reason. tests/smoke.spec.ts covers the equivalent `<meta>` tag
// live, in a real browser, for every route/viewport.
test('public/_headers applies X-Robots-Tag: noindex, nofollow to every route', () => {
  const headersPath = fileURLToPath(new URL('../public/_headers', import.meta.url));
  const contents = readFileSync(headersPath, 'utf8');

  const lines = contents.split('\n').map((line) => line.replace(/\r$/, ''));

  // Find the block whose path pattern is the catch-all "/*" (must come
  // before any narrower block wins for a given path — Cloudflare's
  // _headers format applies the *first* matching block per header name,
  // so scoping this to "/*" also guarantees it's not shadowed later).
  const catchAllIndex = lines.findIndex((line) => line.trim() === '/*');
  expect(catchAllIndex, 'public/_headers must have a "/*" catch-all block').toBeGreaterThanOrEqual(
    0,
  );

  const blockLines: string[] = [];
  for (let i = catchAllIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === '' || !line.startsWith(' ')) break;
    blockLines.push(line.trim());
  }

  const robotsLine = blockLines.find((line) => /^X-Robots-Tag\s*:/i.test(line));
  expect(robotsLine, 'the "/*" block must set X-Robots-Tag').toBeTruthy();

  const value = robotsLine!.split(':').slice(1).join(':').trim().toLowerCase();
  expect(value).toContain('noindex');
  expect(value).toContain('nofollow');
});
