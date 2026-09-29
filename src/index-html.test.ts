// index.html has no templating step (see its own comments), so a few
// values are necessarily hand-mirrored from other sources of truth. These
// tests are the drift guard the review asked for in each case, so a future
// edit to either side fails loudly instead of silently diverging.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { copy } from './content';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf-8');

// PH1-09/D-035: canvas sizing no longer comes from a static BUFFER_W/H
// constant (src/scene/layout.ts's computeLayout was deleted along with
// the elevation it laid out) — it now comes from whichever scene file's
// current view is loaded, at runtime, per SCENE-FORMAT's device-pixel
// scale rule (src/main.ts's sizeAndPositionCanvas). index.html is out of
// this brief's boundary, so its static width/height attributes stay as
// PH1-04 left them; they only matter pre-JS (an explicit width/height
// stops the browser's 300x150 default from being the first paint), and
// get overwritten by the first render() regardless.
describe('index.html static shell (S1: CLS canvas reservation)', () => {
  it('the canvas has explicit width/height attributes (avoids the 300x150 default before JS runs)', () => {
    const match = html.match(/<canvas id="scene-canvas" width="(\d+)" height="(\d+)"/);
    expect(match, 'index.html canvas tag not found or missing width/height attributes').not.toBeNull();
    const [, width, height] = match!;
    expect(Number(width)).toBeGreaterThan(0);
    expect(Number(height)).toBeGreaterThan(0);
  });
});

describe('index.html OG/meta copy (m5)', () => {
  it('<title> and og:title match content.json copy.ogTitle', () => {
    expect(html).toContain(`<title>${copy.ogTitle}</title>`);
    expect(html).toContain(`<meta property="og:title" content="${copy.ogTitle}" />`);
  });

  it('the description meta and og:description match content.json copy.ogDescription', () => {
    expect(html).toContain(`<meta name="description" content="${copy.ogDescription}" />`);
    expect(html).toContain(`<meta property="og:description" content="${copy.ogDescription}" />`);
  });

  // D-057 item 6: og:image:alt doesn't vary by band (every share image uses
  // the same caption), so it's hand-copied here like ogTitle/ogDescription
  // above rather than something src/worker/index.ts rewrites per `?n=`.
  it('og:image:alt matches content.json copy.shareCaption', () => {
    expect(html).toContain(`<meta property="og:image:alt" content="${copy.shareCaption}" />`);
  });

  it('the static og:image/twitter:image/og:url fallback (band 80) is an absolute production URL, per the unfurl size rules', () => {
    expect(html).toContain('<meta property="og:image" content="https://resume.joshgister.com/share/80.png" />');
    expect(html).toContain('<meta property="og:image:width" content="1200" />');
    expect(html).toContain('<meta property="og:image:height" content="630" />');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
    expect(html).toContain('<meta name="twitter:image" content="https://resume.joshgister.com/share/80.png" />');
    expect(html).toContain('<meta property="og:url" content="https://resume.joshgister.com/?n=80" />');
  });
});
