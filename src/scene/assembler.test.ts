// Review fixes R1/R2 (DIA-100 PR #48): renderScene must resolve every
// entry's image before it touches the canvas (R1 — no clear-then-await
// flicker window), and must not draw at all once its caller says it's stale
// (R2 — an older paint can't land after a newer one and stomp it). Both are
// invisible to the Playwright pixel-parity/motion specs (they only ever see
// the *settled* canvas), so they're pinned here instead: a stub ctx plus a
// controllable image-load promise let the test see what happens *during*
// the await, not just after.
import { describe, expect, it, vi } from 'vitest';
import { renderScene } from './assembler';
import type { SceneView } from './scene';

vi.mock('./sprites', () => ({
  loadManifest: vi.fn(async () => ({})),
  loadEntryImage: vi.fn(),
  loadFrameFile: vi.fn(),
}));

const sprites = await import('./sprites');

const STUB_SPRITE_ENTRY = { anchor: [0, 0] as [number, number], w: 1, h: 1, frames: {} };

function fakeCanvas(calls: string[]) {
  const ctx = {
    imageSmoothingEnabled: false,
    save: vi.fn(),
    restore: vi.fn(),
    setTransform: vi.fn(() => calls.push('setTransform')),
    clearRect: vi.fn(() => calls.push('clearRect')),
    drawImage: vi.fn(() => calls.push('drawImage')),
    globalAlpha: 1,
  };
  const canvas = {
    width: 100,
    height: 100,
    getContext: () => ctx,
  };
  return { canvas: canvas as unknown as HTMLCanvasElement, ctx };
}

function viewWith(entries: SceneView['entries']): SceneView {
  return {
    id: 'v',
    kind: 'closeup',
    label: 'v',
    size: { w: 100, h: 100 },
    focus: { x: 0, y: 0, w: 100, h: 100 },
    entries,
    hotspots: [],
  };
}

describe('renderScene: R1 atomic paint', () => {
  it('never clears or draws the canvas before every entry image has resolved', async () => {
    const calls: string[] = [];
    const { canvas } = fakeCanvas(calls);

    let releaseSlowImage!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseSlowImage = resolve;
    });
    vi.mocked(sprites.loadEntryImage).mockImplementation(async (_manifest, sprite) => {
      if (sprite === 'slow') await gate;
      return { image: {} as HTMLImageElement, entry: STUB_SPRITE_ENTRY };
    });

    const view = viewWith([
      { sprite: 'fast', frame: 'a', x: 0, y: 0, depth: 0 },
      { sprite: 'slow', frame: 'a', x: 0, y: 0, depth: 1 },
    ]);

    const paint = renderScene(canvas, view, 'built');
    // Let the microtask queue drain without releasing the gate: the "fast"
    // image resolved a while ago, but the view as a whole hasn't — nothing
    // should have touched the canvas yet.
    await Promise.resolve();
    await Promise.resolve();
    expect(calls, 'no canvas call should happen while any entry image is still loading').toEqual([]);

    releaseSlowImage();
    const painted = await paint;

    expect(painted).toBe(true);
    expect(calls[0], 'setTransform/clearRect must come first, once every image is ready').toBe('setTransform');
    expect(calls[1]).toBe('clearRect');
    expect(calls.slice(2)).toEqual(['drawImage', 'drawImage']);
  });
});

describe('renderScene: R2 staleness guard', () => {
  it('skips the canvas entirely, and reports not-painted, when isStale is true once images resolve', async () => {
    const calls: string[] = [];
    const { canvas, ctx } = fakeCanvas(calls);
    vi.mocked(sprites.loadEntryImage).mockResolvedValue({ image: {} as HTMLImageElement, entry: STUB_SPRITE_ENTRY });

    const view = viewWith([{ sprite: 'a', frame: 'a', x: 0, y: 0, depth: 0 }]);
    const painted = await renderScene(canvas, view, 'built', undefined, () => true);

    expect(painted).toBe(false);
    expect(ctx.clearRect).not.toHaveBeenCalled();
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('paints normally when isStale is false', async () => {
    const calls: string[] = [];
    const { canvas, ctx } = fakeCanvas(calls);
    vi.mocked(sprites.loadEntryImage).mockResolvedValue({ image: {} as HTMLImageElement, entry: STUB_SPRITE_ENTRY });

    const view = viewWith([{ sprite: 'a', frame: 'a', x: 0, y: 0, depth: 0 }]);
    const painted = await renderScene(canvas, view, 'built', undefined, () => false);

    expect(painted).toBe(true);
    expect(ctx.clearRect).toHaveBeenCalledTimes(1);
    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
  });
});
