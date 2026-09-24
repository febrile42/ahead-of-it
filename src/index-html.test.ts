// index.html has no templating step (see its own comments), so a few
// values are necessarily hand-mirrored from other sources of truth. These
// tests are the drift guard the review asked for in each case, so a future
// edit to either side fails loudly instead of silently diverging.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { copy } from './content';
import { BUFFER_H, BUFFER_W } from './scene/layout';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf-8');

describe('index.html static shell (S1: CLS canvas reservation)', () => {
  it('the canvas width/height attributes match src/scene/layout.ts BUFFER_W/BUFFER_H', () => {
    const match = html.match(/<canvas id="scene-canvas" width="(\d+)" height="(\d+)"/);
    expect(match, 'index.html canvas tag not found or missing width/height attributes').not.toBeNull();
    const [, width, height] = match!;
    expect(Number(width)).toBe(BUFFER_W);
    expect(Number(height)).toBe(BUFFER_H);
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
});
