import { defineConfig } from 'vite';

// Vanilla TypeScript + Vite, no UI framework (D-009). Output goes to dist/,
// which is what wrangler.jsonc uploads as the Worker's assets directory.
export default defineConfig({
  build: {
    outDir: 'dist',
  },
});
