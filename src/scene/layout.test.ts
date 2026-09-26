// Review fix (DIA-46 item 4): unit coverage for resolveZoomOverlaps in
// isolation from rendering, using the exact overlaps the review measured in
// tests/fixtures — band 80's ground.1/ground.2 (60x26 art px) and band 750's
// street.1/street.2 (46x4 art px).
import { describe, expect, it } from 'vitest';
import { resolveZoomOverlaps } from './layout';

function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return ox > 0 && oy > 0;
}

describe('resolveZoomOverlaps', () => {
  it('leaves non-overlapping rects untouched', () => {
    const targets = [
      { viewId: 'a', label: 'A', x: 0, y: 0, w: 180, h: 120 },
      { viewId: 'b', label: 'B', x: 180, y: 0, w: 180, h: 120 },
    ];
    expect(resolveZoomOverlaps(targets)).toEqual(targets);
  });

  it('splits band 80 ground.1/ground.2 (60x26 art px overlap) with no overlap left', () => {
    const targets = [
      { viewId: 'ground.1', label: 'Ground, one', x: 0, y: 0, w: 180, h: 120 },
      { viewId: 'ground.2', label: 'Ground, two', x: 120, y: 94, w: 180, h: 120 },
    ];
    const [a, b] = resolveZoomOverlaps(targets);
    expect(overlaps(a, b)).toBe(false);
    // overlapY (26) < overlapX (60): splits on y, so x/w are untouched and
    // the two boxes now meet edge-to-edge instead of overlapping by 26px.
    expect(a.w).toBe(180);
    expect(b.w).toBe(180);
    expect(a.y + a.h).toBeCloseTo(b.y, 5);
  });

  it('splits band 750 street.1/street.2 (46x4 art px overlap) with no overlap left', () => {
    const targets = [
      { viewId: 'street.1', label: 'Street, one', x: 0, y: 0, w: 180, h: 120 },
      { viewId: 'street.2', label: 'Street, two', x: 134, y: 116, w: 180, h: 120 },
    ];
    const [a, b] = resolveZoomOverlaps(targets);
    expect(overlaps(a, b)).toBe(false);
    // overlapX (46) > overlapY (4): splits on y, so x/w are untouched and
    // the two boxes now meet edge-to-edge instead of overlapping by 4px.
    expect(a.x).toBe(targets[0].x);
    expect(a.w).toBe(targets[0].w);
    expect(b.x).toBe(targets[1].x);
    expect(b.w).toBe(targets[1].w);
    expect(a.y + a.h).toBeCloseTo(b.y, 5);
  });

  it('preserves id and label through the transform', () => {
    const targets = [
      { viewId: 'ground.1', label: 'Ground, one', x: 0, y: 0, w: 180, h: 120 },
      { viewId: 'ground.2', label: 'Ground, two', x: 120, y: 94, w: 180, h: 120 },
    ];
    const [a, b] = resolveZoomOverlaps(targets);
    expect(a.viewId).toBe('ground.1');
    expect(a.label).toBe('Ground, one');
    expect(b.viewId).toBe('ground.2');
    expect(b.label).toBe('Ground, two');
  });

  it('resolves every pair in a three-way chain (best effort, no crash)', () => {
    const targets = [
      { viewId: 'a', label: 'A', x: 0, y: 0, w: 100, h: 100 },
      { viewId: 'b', label: 'B', x: 90, y: 0, w: 100, h: 100 },
      { viewId: 'c', label: 'C', x: 180, y: 0, w: 100, h: 100 },
    ];
    const resolved = resolveZoomOverlaps(targets);
    expect(overlaps(resolved[0], resolved[1])).toBe(false);
    expect(overlaps(resolved[1], resolved[2])).toBe(false);
  });
});
