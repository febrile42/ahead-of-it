// Lighthouse CI config for PH1-05 (R-23 performance budget, Phase 1 exit
// criteria). Runs against `vite preview` (the exact build output that would
// be deployed — same reasoning as playwright.config.ts). CHROME_PATH must
// point at a local Chromium binary; never `playwright install` on this
// machine (see PH1-05) — CI installs its own.
//
// No third-party dependency in the *check* itself (R-21 is about the served
// site, but a check that phones home would be its own violation): upload
// target is "filesystem" only, never "temporary-public-storage" or a
// LHCI server.
if (!process.env.CHROME_PATH) {
  throw new Error(
    'lighthouserc.cjs: CHROME_PATH is not set. Point it at a local Chromium binary ' +
      '(see PH1-05) — Lighthouse CI must not download its own.',
  );
}

// DIA-91: honour PREVIEW_PORT (same env var playwright.config.ts already
// reads) so a worktree or CI job with its own port doesn't collide with a
// preview server already listening on 4173 elsewhere. `npm run preview`
// inherits this process's env, so it picks up the same port.
const PORT = Number(process.env.PREVIEW_PORT ?? 4173);

module.exports = {
  ci: {
    collect: {
      // D-043 (PH2-04 step 2): the URL read lets a navigation land on band
      // 750 too, not just the default band 80 at `/`. LHCI applies the same
      // assertions to every collected URL, so both bands are budget-checked.
      // DIA-91: use PREVIEW_PORT here too so this doesn't collide with a
      // preview server already listening on 4173 in another worktree/CI job.
      url: [
        `http://localhost:${PORT}/`,
        `http://localhost:${PORT}/?n=750&it=built`,
        `http://localhost:${PORT}/?n=750&it=none`,
      ],
      startServerCommand: 'npm run preview',
      // Match the host, not "Local:": vite colours its banner, and the reset code
      // lands between "Local" and ":", so /Local:/ never matched and every run
      // burned the full ready timeout with a WARNING (DIA-4).
      startServerReadyPattern: 'localhost',
      startServerReadyTimeout: 30000,
      // 3 runs; `assert.aggregationMethod` below makes LHCI assert on the
      // median instead of its 'optimistic' default — shared CI runners are
      // noisy enough that a single run flakes on performance score/timing.
      numberOfRuns: 3,
      settings: {
        chromePath: process.env.CHROME_PATH,
        // GitHub's Ubuntu 24.04 runners disable unprivileged user namespaces, so
        // Chromium's sandbox can't start there ("No usable sandbox!"). Playwright
        // already passes --no-sandbox; do the same, but only on CI.
        chromeFlags: process.env.CI ? '--no-sandbox' : '',
        formFactor: 'mobile',
        throttlingMethod: 'simulate',
        screenEmulation: {
          mobile: true,
          width: 390,
          height: 844,
          deviceScaleFactor: 2,
          disabled: false,
        },
        onlyCategories: ['performance'],
        budgetPath: './budgets.json',
      },
    },
    assert: {
      // Median across the 3 runs, not LHCI's 'optimistic' (best-run)
      // default — the stricter choice, so this is not a weakening.
      aggregationMethod: 'median-run',
      assertions: {
        // PH2-04 step 2 (Phase 2 exit criteria): performance >= 90 on a
        // mobile-emulated run, band 80 and band 750 alike.
        'categories:performance': ['error', { minScore: 0.9 }],
        // R-23: total transfer for the first band < 600 KB. Mirrors
        // budgets.json's "total" resourceSizes budget (600 KB); asserted
        // directly here too because Lighthouse's own budget audit is
        // informative (no pass/fail score) and LHCI can't assert on it.
        'resource-summary:total:size': ['error', { maxNumericValue: 600 * 1024 }],
        // R-23's "first meaningful render < 1.5s on a mid-range phone over
        // 4G" doesn't map to one Lighthouse audit directly; LCP is the
        // closest standard proxy for when the scene is visibly painted.
        'largest-contentful-paint': ['error', { maxNumericValue: 1500 }],
        // Phase 2 adds motion (PH2-01..03); it must not cost layout
        // stability. CLS 0 on every measured band.
        'cumulative-layout-shift': ['error', { maxNumericValue: 0 }],
      },
    },
    upload: {
      // Local filesystem report only — no LHCI server, no
      // temporary-public-storage. The check must not depend on any
      // external service to pass or fail.
      target: 'filesystem',
      outputDir: './.lighthouseci',
    },
  },
};
