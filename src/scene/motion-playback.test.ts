// PH2-01 Part B: the motion-playback math is pure and has no DOM
// dependency, so it is fully covered here rather than only through
// Playwright — SCENE-FORMAT.md's own arithmetic (in-place loop wrap, walker
// leg interpolation, before-start rest pose) is worth pinning down exactly,
// not just "something moves eventually".
import { describe, expect, it } from 'vitest';
import { motionChanged, resolveEntryAt, resolveViewAt } from './motion-playback';
import type { SceneEntry, SceneView } from './scene';
import type { SpriteManifest, SpriteManifestEntry } from './sprites';

function entry(overrides: Partial<SceneEntry> = {}): SceneEntry {
  return { sprite: 's', frame: 'idle', x: 10, y: 20, depth: 1, ...overrides };
}

function manifestEntry(frames: SpriteManifestEntry['frames']): SpriteManifestEntry {
  return { anchor: [0, 0], w: 8, h: 8, frames };
}

describe('resolveEntryAt: no motion', () => {
  it('always paints the rest pose', () => {
    const e = entry();
    const m = manifestEntry({ idle: [{ file: 'a.png', duration: 100 }] });
    expect(resolveEntryAt(e, m, 0)).toEqual({ frameKey: 'idle', fileIndex: 0, x: 10, y: 20 });
    expect(resolveEntryAt(e, m, 99999)).toEqual({ frameKey: 'idle', fileIndex: 0, x: 10, y: 20 });
  });
});

describe('resolveEntryAt: in-place loop', () => {
  const frames = {
    wait: [
      { file: 'a.png', duration: 300 },
      { file: 'b.png', duration: 200 },
    ],
  };
  const m = manifestEntry(frames);

  it('holds the rest pose before start', () => {
    const e = entry({ frame: 'wait', motion: { start: 500 } });
    expect(resolveEntryAt(e, m, 0)).toEqual({ frameKey: 'wait', fileIndex: 0, x: 10, y: 20 });
    expect(resolveEntryAt(e, m, 499)).toEqual({ frameKey: 'wait', fileIndex: 0, x: 10, y: 20 });
  });

  it('cycles through the key files by cumulative duration once started', () => {
    const e = entry({ frame: 'wait', motion: { start: 100 } });
    // u = t - 100. total = 500. file 0 covers [0,300), file 1 covers [300,500).
    expect(resolveEntryAt(e, m, 100).fileIndex).toBe(0); // u=0
    expect(resolveEntryAt(e, m, 399).fileIndex).toBe(0); // u=299
    expect(resolveEntryAt(e, m, 400).fileIndex).toBe(1); // u=300
    expect(resolveEntryAt(e, m, 599).fileIndex).toBe(1); // u=499
    expect(resolveEntryAt(e, m, 600).fileIndex).toBe(0); // u=500 -> wraps to 0
  });

  it('position never moves for an in-place loop', () => {
    const e = entry({ frame: 'wait', motion: { start: 0 } });
    for (const t of [0, 250, 999]) {
      const r = resolveEntryAt(e, m, t);
      expect([r.x, r.y]).toEqual([10, 20]);
    }
  });

  it('rate scales the frame clock, not the wrap point in wall time', () => {
    const e1 = entry({ frame: 'wait', motion: { start: 0, rate: 2 } });
    // rate 2: u = t*2. file 1 starts at u=300 => t=150.
    expect(resolveEntryAt(e1, m, 149).fileIndex).toBe(0);
    expect(resolveEntryAt(e1, m, 150).fileIndex).toBe(1);
  });

  it('a single-file key is always file 0 (still)', () => {
    const single = manifestEntry({ idle: [{ file: 'a.png', duration: 400 }] });
    const e = entry({ frame: 'idle', motion: { start: 0 } });
    expect(resolveEntryAt(e, single, 12345).fileIndex).toBe(0);
  });
});

describe('resolveEntryAt: walker', () => {
  const frames = {
    right: [
      { file: 'r0.png', duration: 200 },
      { file: 'r1.png', duration: 200 },
    ],
    down: [{ file: 'd0.png', duration: 100 }],
  };
  const m = manifestEntry(frames);
  const walk = {
    start: 0,
    walk: [
      { frame: 'right', to: [60, 20] as [number, number], ms: 500 },
      { frame: 'down', hold: 300 },
      { frame: 'right', to: [10, 20] as [number, number], ms: 500 }, // back to start
    ],
  };

  it('holds the rest pose before start', () => {
    const e = entry({ motion: { ...walk, start: 1000 } });
    expect(resolveEntryAt(e, m, 999)).toEqual({ frameKey: 'idle', fileIndex: 0, x: 10, y: 20 });
  });

  it('interpolates position along a move leg, floored', () => {
    const e = entry({ motion: walk });
    // leg 0: (10,20) -> (60,20) over 500ms. At t=250 (p=0.5): x = 10 + floor(50*0.5) = 35.
    const r = resolveEntryAt(e, m, 250);
    expect(r.x).toBe(35);
    expect(r.y).toBe(20);
    expect(r.frameKey).toBe('right');
  });

  it('holds position during a hold leg', () => {
    const e = entry({ motion: walk });
    // leg 0 ends at t=500 at (60,20); leg 1 (hold 300ms) covers [500,800).
    const r = resolveEntryAt(e, m, 650);
    expect(r.x).toBe(60);
    expect(r.y).toBe(20);
    expect(r.frameKey).toBe('down');
  });

  it('loops back to the entry origin seamlessly', () => {
    const e = entry({ motion: walk });
    // total = 500 + 300 + 500 = 1300. t=1300 wraps to tau=0 -> leg 0 start (10,20).
    const r = resolveEntryAt(e, m, 1300);
    expect(r.x).toBe(10);
    expect(r.y).toBe(20);
  });

  it('the frame clock (u) is continuous across legs, not reset per leg', () => {
    const e = entry({ motion: walk });
    // Same leg's key ("right") is used in leg 0 [0,500) and leg 2 [800,1300).
    // u = t - start (rate 1) is the *global* clock, so t=250 and t=1050
    // (250ms into leg 2) select the same fileIndex only if u wraps within
    // "right"'s own 400ms total at the same offset mod 400: 250 % 400 = 250,
    // 1050 % 400 = 250 too — both fall in file index 1 ([200,400)).
    expect(resolveEntryAt(e, m, 250).fileIndex).toBe(1);
    expect(resolveEntryAt(e, m, 1050).fileIndex).toBe(1);
  });
});

describe('resolveViewAt / motionChanged', () => {
  const manifest: SpriteManifest = {
    s: manifestEntry({ idle: [{ file: 'a.png', duration: 100 }], wait: [
      { file: 'w0.png', duration: 200 },
      { file: 'w1.png', duration: 200 },
    ] }),
  };

  function view(entries: SceneEntry[]): SceneView {
    return {
      id: 'v',
      kind: 'closeup',
      label: 'V',
      size: { w: 100, h: 100 },
      focus: { x: 0, y: 0, w: 100, h: 100 },
      entries,
      hotspots: [],
    };
  }

  it('resolves null for entries with no motion', () => {
    const v = view([entry({ frame: 'idle' })]);
    expect(resolveViewAt(v, manifest, 500)).toEqual([null]);
  });

  it('resolves a value for entries with motion', () => {
    const v = view([entry({ frame: 'wait', motion: { start: 0 } })]);
    const resolved = resolveViewAt(v, manifest, 250);
    expect(resolved[0]).toEqual({ frameKey: 'wait', fileIndex: 1, x: 10, y: 20 });
  });

  it('motionChanged: true with no baseline', () => {
    expect(motionChanged([null], null)).toBe(true);
  });

  it('motionChanged: false when every resolution is identical', () => {
    const a = [{ frameKey: 'wait', fileIndex: 0, x: 1, y: 2 }, null];
    const b = [{ frameKey: 'wait', fileIndex: 0, x: 1, y: 2 }, null];
    expect(motionChanged(a, b)).toBe(false);
  });

  it('motionChanged: true when a resolved value differs', () => {
    const a = [{ frameKey: 'wait', fileIndex: 0, x: 1, y: 2 }];
    const b = [{ frameKey: 'wait', fileIndex: 1, x: 1, y: 2 }];
    expect(motionChanged(a, b)).toBe(true);
  });

  it('motionChanged: true on a length mismatch (a different view)', () => {
    expect(motionChanged([null], [null, null])).toBe(true);
  });
});
