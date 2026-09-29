// D-061 (DIA-262 decision, DIA-264): share.ts's pure decision logic —
// shareUrl/canShareLink/activateShare need no DOM (this repo's unit tests
// run in plain Node, vitest.config.ts's own comment: no jsdom/happy-dom).
// initShareControl's DOM wiring (the click listener, the real toast
// element, `location`/`navigator`) is Playwright's job —
// tests/share-control.spec.ts.
import { describe, expect, it, vi } from 'vitest';
import { activateShare, canShareLink, shareUrl } from './share';

const ORIGIN = 'https://resume.joshgister.com';

describe('shareUrl (D-061 step 1)', () => {
  it('is always the without state of the stop, regardless of the visible toggle', () => {
    expect(shareUrl(ORIGIN, 80)).toBe(`${ORIGIN}/?n=80&it=none`);
    expect(shareUrl(ORIGIN, 610)).toBe(`${ORIGIN}/?n=610&it=none`);
  });

  it("the 1000 stop's link is 'beyond' (n=1000), the same alias sceneBandForStop uses", () => {
    expect(shareUrl(ORIGIN, 1000)).toBe(`${ORIGIN}/?n=1000&it=none`);
  });
});

describe('canShareLink (D-061 step 2)', () => {
  it('false with no navigator.share at all, even on a coarse pointer', () => {
    expect(canShareLink(undefined, true)).toBe(false);
    expect(canShareLink({} as Navigator, true)).toBe(false);
  });

  it('false when navigator.share exists but the pointer is not coarse (desktop mouse)', () => {
    const nav = { share: vi.fn() } as unknown as Navigator;
    expect(canShareLink(nav, false)).toBe(false);
  });

  it('true only when both a coarse pointer and navigator.share are present', () => {
    const nav = { share: vi.fn() } as unknown as Navigator;
    expect(canShareLink(nav, true)).toBe(true);
  });
});

describe('activateShare (D-061 steps 2-3): share / clipboard / clipboard-fail / abort', () => {
  const url = `${ORIGIN}/?n=80&it=none`;

  it('share: touch device, Web Share resolves — "shared", clipboard never touched', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const copyText = vi.fn();
    const outcome = await activateShare(url, { touch: true, share, copyText });
    expect(outcome).toBe('shared');
    expect(share).toHaveBeenCalledWith({ url });
    expect(copyText).not.toHaveBeenCalled();
  });

  it('abort: the visitor dismisses the share sheet — "aborted", clipboard never touched', async () => {
    const err = Object.assign(new Error('cancelled'), { name: 'AbortError' });
    const share = vi.fn().mockRejectedValue(err);
    const copyText = vi.fn();
    const outcome = await activateShare(url, { touch: true, share, copyText });
    expect(outcome).toBe('aborted');
    expect(copyText).not.toHaveBeenCalled();
  });

  it('clipboard: touch device, Web Share refused (non-abort) — falls through and copies', async () => {
    const share = vi.fn().mockRejectedValue(new Error('NotAllowedError'));
    const copyText = vi.fn().mockResolvedValue(undefined);
    const outcome = await activateShare(url, { touch: true, share, copyText });
    expect(outcome).toBe('copied');
    expect(copyText).toHaveBeenCalledWith(url);
  });

  it('clipboard: no touch/Web Share at all — goes straight to the clipboard', async () => {
    const copyText = vi.fn().mockResolvedValue(undefined);
    const outcome = await activateShare(url, { touch: false, copyText });
    expect(outcome).toBe('copied');
    expect(copyText).toHaveBeenCalledWith(url);
  });

  it('clipboard-fail: clipboard write rejected — "fallback" (caller lets the link navigate)', async () => {
    const copyText = vi.fn().mockRejectedValue(new Error('denied'));
    const outcome = await activateShare(url, { touch: false, copyText });
    expect(outcome).toBe('fallback');
  });

  it('clipboard-fail: no Clipboard API at all — "fallback" with no attempt made', async () => {
    const outcome = await activateShare(url, { touch: false });
    expect(outcome).toBe('fallback');
  });
});
