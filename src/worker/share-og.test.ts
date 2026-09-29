// D-057 item 6 (DIA-235): computeShareOg is plain TypeScript (a URL in, two
// strings out) — no Workers runtime, no HTMLRewriter, no ASSETS binding
// needed to exercise the band-mapping/URL-building rule itself.
import { describe, expect, it } from 'vitest';
import { computeShareOg } from './share-og';

const ORIGIN = 'https://example.test';

describe('computeShareOg (D-057 item 6)', () => {
  it('defaults to band 80 with no ?n= (same fallback as D-043)', () => {
    const og = computeShareOg(new URL(`${ORIGIN}/`), {});
    expect(og.image).toBe(`${ORIGIN}/share/80.png`);
    expect(og.url).toBe(`${ORIGIN}/?n=80`);
  });

  it('snaps an arbitrary ?n= to its nearest stop', () => {
    const og = computeShareOg(new URL(`${ORIGIN}/?n=600`), {});
    expect(og.image).toBe(`${ORIGIN}/share/610.png`);
    expect(og.url).toBe(`${ORIGIN}/?n=610`);
  });

  it('maps a value past 750 to the 1000 stop (nearestBand "beyond")', () => {
    const og = computeShareOg(new URL(`${ORIGIN}/?n=1000`), {});
    expect(og.image).toBe(`${ORIGIN}/share/1000.png`);
    expect(og.url).toBe(`${ORIGIN}/?n=1000`);
  });

  it('carries &it=none only for the without state', () => {
    const built = computeShareOg(new URL(`${ORIGIN}/?n=220&it=built`), {});
    expect(built.url).toBe(`${ORIGIN}/?n=220`);

    const without = computeShareOg(new URL(`${ORIGIN}/?n=220&it=none`), {});
    expect(without.url).toBe(`${ORIGIN}/?n=220&it=none`);
  });

  it('an invalid ?n= falls back to band 80, not a NaN path', () => {
    const og = computeShareOg(new URL(`${ORIGIN}/?n=not-a-number`), {});
    expect(og.image).toBe(`${ORIGIN}/share/80.png`);
  });

  it('appends the stop\'s ?v= hash when one is on record, to bust unfurler caches', () => {
    const og = computeShareOg(new URL(`${ORIGIN}/?n=80`), { '80': 'abc123' });
    expect(og.image).toBe(`${ORIGIN}/share/80.png?v=abc123`);
  });

  it('resolves against the request origin, not a hardcoded production domain (staging unfurls against staging)', () => {
    const og = computeShareOg(new URL('https://staging-ahead-of-it.example.workers.dev/?n=150'), {});
    expect(og.image).toBe('https://staging-ahead-of-it.example.workers.dev/share/150.png');
    expect(og.url).toBe('https://staging-ahead-of-it.example.workers.dev/?n=150');
  });
});
