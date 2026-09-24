// Lighthouse CI config for PH1-05 (R-23 performance budget, Phase 1 exit
// criteria). Runs against `vite preview` (the exact build output that would
// be deployed — same reasoning as playwright.config.ts). CHROME_PATH must
// point at a local Chromium binary; never `playwright install` on this
// machine (see docs/briefs/PH1-05-checks.md) — CI installs its own.
//
// No third-party dependency in the *check* itself (R-21 is about the served
// site, but a check that phones home would be its own violation): upload
// target is "filesystem" only, never "temporary-public-storage" or a
// LHCI server.
if (!process.env.CHROME_PATH) {
  throw new Error(
    'lighthouserc.cjs: CHROME_PATH is not set. Point it at a local Chromium binary ' +
      '(see docs/briefs/PH1-05-checks.md) — Lighthouse CI must not download its own.',
  );
}

module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:4173/'],
      startServerCommand: 'npm run preview',
      startServerReadyPattern: 'Local:',
      startServerReadyTimeout: 30000,
      // 3 runs, LHCI asserts on the median — shared CI runners are noisy
      // enough that a single run flakes on performance score/timing.
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
      assertions: {
        // R-23: performance >= 80 on a mobile-emulated run.
        'categories:performance': ['error', { minScore: 0.8 }],
        // R-23: total transfer for the first band < 600 KB. Mirrors
        // budgets.json's "total" resourceSizes budget (600 KB); asserted
        // directly here too because Lighthouse's own budget audit is
        // informative (no pass/fail score) and LHCI can't assert on it.
        'resource-summary:total:size': ['error', { maxNumericValue: 600 * 1024 }],
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
