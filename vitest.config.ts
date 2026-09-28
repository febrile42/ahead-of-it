import { defineConfig } from 'vitest/config';

// Unit tests only run against plain TypeScript (no DOM), so the default
// "node" environment is enough and keeps us inside the dependency allowlist
// (no jsdom/happy-dom). Playwright covers anything that needs a real page.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
});
