import { defineConfig } from '@playwright/test';

// Smoke-tests the built dist/ via `vite preview`, not the dev server, so
// this exercises exactly what would be deployed. R-21: no third-party
// requests — enforced in tests/smoke.spec.ts by intercepting every request.
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
