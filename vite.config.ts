import { defineConfig, type Plugin } from 'vite';
import { ui } from './src/ui/strings.ts';

const APP_INTRO_TAG = /(<p class="app__intro" id="app-intro">)(\s*)(<\/p>)/;

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// DIA-210 (D-051 follow-up): #app-intro is the LCP element on every URL
// (CI LHR artifacts, DIA-205) — filling it from src/main.ts only once that
// module runs adds ~300ms of avoidable render delay past FCP. This
// prerenders the exact same ui('intro') string index.html's static shell
// already reserves layout for, at build time (transformIndexHtml also runs
// in dev serve), so the lede paints with the first byte of markup instead
// of waiting on the bundle. Reads the same src/ui/strings.ts accessor
// main.ts calls — never hand-copy the string (nothing-invented rule).
function prerenderIntro(): Plugin {
  return {
    name: 'occupancy:prerender-intro',
    transformIndexHtml(html) {
      const text = escapeHtml(ui('intro'));
      if (!APP_INTRO_TAG.test(html)) {
        throw new Error('prerenderIntro: index.html is missing <p class="app__intro" id="app-intro"></p>');
      }
      return html.replace(APP_INTRO_TAG, `$1${text}$3`);
    },
  };
}

// Vanilla TypeScript + Vite, no UI framework (D-009). Output goes to dist/,
// which is what wrangler.jsonc uploads as the Worker's assets directory.
export default defineConfig({
  plugins: [prerenderIntro()],
  build: {
    outDir: 'dist',
  },
});
