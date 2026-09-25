import { defineConfig, devices } from '@playwright/test';

// Smoke-tests the built dist/ via `vite preview`, not the dev server, so
// this exercises exactly what would be deployed. R-21: no third-party
// requests — enforced in tests/smoke.spec.ts by intercepting every request.
//
// The port is env-overridable (default unchanged at 4173, so CI behaves
// exactly as before) because `--strictPort` plus `reuseExistingServer: false`
// makes two checkouts of this repo — two git worktrees, or two concurrent CI
// jobs on one runner — fail each other's e2e run with "4173 is already used".
// `PREVIEW_PORT=4273 npm run test:e2e` gives a worktree its own server.
const PORT = Number(process.env.PREVIEW_PORT ?? 4173);
const ORIGIN = `http://localhost:${PORT}`;

// DIA-15: iOS Safari is the primary real-world target (CLAUDE.md, R-20) and
// was previously untested — every test ran on Chromium only. `webkit` here
// uses Playwright's own WebKit build, which is the closest engine-level
// proxy for iOS Safari available in CI (there is no way to run the real
// iOS Safari/WebKit binary on a Linux runner). The `iPhone 14` descriptor
// pins the default viewport to 390px, matching the site's phone-first
// design width, and carries real touch/DPR/UA behaviour that plain
// `devices['Desktop Safari']` would not exercise.
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: ORIGIN,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'webkit-iphone',
      use: { ...devices['iPhone 14'] },
    },
  ],
  webServer: {
    // `npx` rather than a bare `vite` so the local binary resolves the same
    // way `npm run preview` (which this otherwise duplicates) resolves it.
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: ORIGIN,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
