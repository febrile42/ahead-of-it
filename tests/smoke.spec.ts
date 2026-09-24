import { expect, test } from '@playwright/test';

// R-21/R-16/R-26 (PH1-05): every route the app exposes, crawled at phone
// and desktop widths. Only '/' exists today — CLAUDE.md's "phone-first"
// rule and D-018 apply to whatever gets added later, so this list is the
// single place a new route needs to be registered for these checks to
// cover it.
const ROUTES = ['/'];

// R-14 companion viewports: 390px is the phone-first design width
// (CLAUDE.md), 1280px is the desktop check.
const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 900 },
];

for (const route of ROUTES) {
  for (const viewport of VIEWPORTS) {
    test(`${route} @ ${viewport.name} (${viewport.width}px): 200, no third-party requests, noindex, no external link/script`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      // R-21: no third-party requests. A grep of the source isn't enough —
      // see joshgister PR #19, where Cloudflare injected an analytics
      // beacon at the edge that never appears in the repo. This
      // intercepts every request the real browser makes while loading the
      // page and fails on any host that isn't the local preview server.
      const offOrigin: string[] = [];
      page.on('request', (request) => {
        const { hostname } = new URL(request.url());
        if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
          offOrigin.push(request.url());
        }
      });

      const response = await page.goto(route);
      expect(response?.status()).toBe(200);

      if (route === '/') {
        await expect(page.locator('h1')).toHaveText('Ahead of It');
        await expect(page).toHaveTitle("Ahead of It — Josh Gister's résumé");
      }

      // R-16/D-018: unlisted until the Phase 4 publicity gate opens. The
      // `X-Robots-Tag` header is asserted separately in
      // tests/serving-headers.test.ts — `vite preview` does not apply
      // public/_headers (that's a Cloudflare static-assets feature), so a
      // live request here can only ever see the meta tag, not the header.
      const robotsMeta = page.locator('meta[name="robots"]');
      await expect(robotsMeta).toHaveCount(1);
      const robotsContent = (await robotsMeta.getAttribute('content')) ?? '';
      expect(robotsContent.toLowerCase()).toContain('noindex');

      // R-21: belt-and-suspenders with the request interception above —
      // no <link>/<script> may point off-origin even if the browser never
      // ends up firing the request (e.g. an unused preload/prefetch hint).
      const externalRefs = await page.evaluate(() => {
        const offenders: string[] = [];
        const isExternal = (value: string | null) => {
          if (!value) return false;
          if (value.startsWith('/') || value.startsWith('./') || value.startsWith('../')) {
            return false;
          }
          try {
            const url = new URL(value, window.location.href);
            return url.hostname !== window.location.hostname;
          } catch {
            return false;
          }
        };
        document.querySelectorAll('link[href]').forEach((el) => {
          const href = el.getAttribute('href');
          if (isExternal(href)) offenders.push(`link[href="${href}"]`);
        });
        document.querySelectorAll('script[src]').forEach((el) => {
          const src = el.getAttribute('src');
          if (isExternal(src)) offenders.push(`script[src="${src}"]`);
        });
        return offenders;
      });
      expect(externalRefs).toEqual([]);

      expect(offOrigin).toEqual([]);
    });
  }
}
