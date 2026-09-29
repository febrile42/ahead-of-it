// D-057 item 7 (DIA-235): canShareFile is the one pure piece of
// src/ui/share.ts's behaviour (a capability check, no DOM needed); the rest
// (event wiring, navigator.share's own activation-preserving call, the
// AbortError/refused split) needs a real browser and is Playwright's job —
// see tests/share-control.spec.ts.
import { describe, expect, it, vi } from 'vitest';
import { canShareFile } from './share';

const FILE = new File(['x'], 'ahead-of-it-80.png', { type: 'image/png' });

describe('canShareFile (D-057 item 7)', () => {
  it('false with no navigator.share/canShare at all (most desktop browsers)', () => {
    expect(canShareFile(undefined, FILE)).toBe(false);
    expect(canShareFile({} as Navigator, FILE)).toBe(false);
  });

  it('false when canShare exists but refuses this file (e.g. an unsupported type)', () => {
    const nav = { canShare: vi.fn(() => false), share: vi.fn() } as unknown as Navigator;
    expect(canShareFile(nav, FILE)).toBe(false);
    expect(nav.canShare).toHaveBeenCalledWith({ files: [FILE] });
  });

  it('true when canShare accepts the file and share exists', () => {
    const nav = { canShare: vi.fn(() => true), share: vi.fn() } as unknown as Navigator;
    expect(canShareFile(nav, FILE)).toBe(true);
  });

  it('false when canShare accepts it but share itself is missing (partial/spoofed support)', () => {
    const nav = { canShare: vi.fn(() => true) } as unknown as Navigator;
    expect(canShareFile(nav, FILE)).toBe(false);
  });
});
