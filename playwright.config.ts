import { defineConfig } from '@playwright/test';

// Smoke-tests the built dist/ via `vite preview`, not the dev server, so
// this exercises exactly what would be deployed. R-21: no third-party
// requests — enforced in tests/smoke.spec.ts by intercepting every request.
// The port is env-overridable (default unchanged at 4173, so CI behaves
// exactly as before) because `--strictPort` plus `reuseExistingServer: false`
// makes two checkouts of this repo — two git worktrees, or two concurrent CI
// jobs on one runner — fail each other's e2e run with "4173 is already used".
// `PREVIEW_PORT=4273 npm run test:e2e` gives a worktree its own server.
const PORT = Number(process.env.PREVIEW_PORT ?? 4173);
const ORIGIN = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: ORIGIN,
  },
  webServer: {
    // `npx` rather than a bare `vite` so the local binary resolves the same
    // way `npm run preview` (which this otherwise duplicates) resolves it.
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: ORIGIN,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
