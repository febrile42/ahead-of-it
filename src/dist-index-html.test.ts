// DIA-210 (D-051 follow-up): regression test for vite.config.ts's
// prerenderIntro plugin. #app-intro is the LCP element on every URL (CI LHR
// artifacts, DIA-205); this asserts the *built* dist/index.html carries the
// lede as static text, byte for byte against the same ui('intro') accessor
// src/main.ts reads, so a future edit to either side fails loudly instead of
// silently reintroducing the FCP/LCP paint gap this brief closed.
//
// Reads dist/, not index.html (see src/index-html.test.ts for the source
// shell) — dist/index.html is what transformIndexHtml actually produced, and
// what wrangler.jsonc serves.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ui } from './ui/strings';

const DIST_INDEX_HTML = new URL('../dist/index.html', import.meta.url);

// Mirrors vite.config.ts's escapeHtml exactly (only & < > need escaping in
// text-node content) so this test compares the same string the plugin read,
// not an accidentally-already-equal one.
function unescapeHtml(text: string): string {
  return text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

describe('dist/index.html (DIA-210: #app-intro prerendered at build time)', () => {
  it('has the lede filled in statically, matching ui(\'intro\') byte for byte', () => {
    if (!existsSync(DIST_INDEX_HTML)) {
      throw new Error("dist-index-html.test: 'dist/index.html' does not exist — run the build first (npm run build).");
    }
    const html = readFileSync(DIST_INDEX_HTML, 'utf-8');
    const match = html.match(/<p class="app__intro" id="app-intro">([^]*?)<\/p>/);
    expect(match, '#app-intro tag not found in dist/index.html').not.toBeNull();
    expect(unescapeHtml(match![1])).toBe(ui('intro'));
  });
});
