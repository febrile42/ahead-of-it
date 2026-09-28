// DIA-55: resolveZoomOverlaps (DIA-46 item 4) + panel.ts's old rect-spanning
// zoom-in button are gone — a room's "zoom in" target is now a label chip
// anchored on the close-up rect's centre, deconflicted here by placeChips
// instead of by splitting rects that a 44px minimum then regrew into each
// other (DIA-54). See src/scene/layout.ts's placeChips doc comment.
import { describe, expect, it, vi } from 'vitest';
import type { Chip } from './layout';
import { placeChips } from './layout';

function overlaps(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
): boolean {
  const ax0 = a.x - a.w / 2;
  const ax1 = a.x + a.w / 2;
  const ay0 = a.y - a.h / 2;
  const ay1 = a.y + a.h / 2;
  const bx0 = b.x - b.w / 2;
  const bx1 = b.x + b.w / 2;
  const by0 = b.y - b.h / 2;
  const by1 = b.y + b.h / 2;
  return ax0 < bx1 && bx0 < ax1 && ay0 < by1 && by0 < ay1;
}

function insideBounds(x: number, y: number, w: number, h: number, bounds: { w: number; h: number }): boolean {
  const halfW = w / 2;
  const halfH = h / 2;
  const withinX = w <= bounds.w ? x - halfW >= -1e-6 && x + halfW <= bounds.w + 1e-6 : true;
  const withinY = h <= bounds.h ? y - halfH >= -1e-6 && y + halfH <= bounds.h + 1e-6 : true;
  return withinX && withinY;
}

// A small seeded PRNG (mulberry32) so the property test is reproducible
// across runs and CI machines without pulling in a dependency.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomChipSet(rng: () => number): { chips: Chip[]; bounds: { w: number; h: number } } {
  const bounds = { w: 300 + rng() * 130, h: 180 + rng() * 100 };
  const count = 1 + Math.floor(rng() * 10);
  const chips: Chip[] = [];
  for (let i = 0; i < count; i += 1) {
    // Modest chip footprint (a one-line label chip, never below the 44px
    // tap minimum): comfortably under bounds area even at 10 chips, so a
    // free position should always exist and the property holds for every
    // seed — the dedicated "no free position" test below covers the case
    // where it can't.
    chips.push({
      cx: rng() * bounds.w,
      cy: rng() * bounds.h,
      w: 44 + rng() * 40,
      h: 44,
    });
  }
  return { chips, bounds };
}

describe('placeChips', () => {
  it('places 200 seeded random chip sets with no overlap, inside bounds, order and count preserved, deterministically', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const rng = mulberry32(seed);
      const { chips, bounds } = randomChipSet(rng);

      const positions = placeChips(chips, bounds);
      const rerun = placeChips(chips, bounds);

      expect(positions.length).toBe(chips.length);
      expect(positions).toEqual(rerun); // deterministic: same input -> same output

      const boxes = positions.map((p, i) => ({ x: p.x, y: p.y, w: chips[i].w, h: chips[i].h }));
      for (const box of boxes) {
        expect(insideBounds(box.x, box.y, box.w, box.h, bounds), `seed ${seed}`).toBe(true);
      }
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          expect(overlaps(boxes[i], boxes[j]), `seed ${seed}: chip ${i} and ${j} overlap`).toBe(false);
        }
      }
    }
  });

  it('leaves a single chip at its anchor (already free)', () => {
    const [pos] = placeChips([{ cx: 50, cy: 50, w: 60, h: 44 }], { w: 300, h: 200 });
    expect(pos).toEqual({ x: 50, y: 50 });
  });

  it('clamps a chip whose anchor is outside bounds', () => {
    const [pos] = placeChips([{ cx: -10, cy: 500, w: 60, h: 44 }], { w: 300, h: 200 });
    expect(pos.x).toBeCloseTo(30, 5); // half-width (30) from the left edge
    expect(pos.y).toBeCloseTo(178, 5); // half-height (22) from the bottom edge
  });

  it('moves a second chip off an occupied anchor to the nearest free spot', () => {
    const chips: Chip[] = [
      { cx: 100, cy: 100, w: 60, h: 44 },
      { cx: 100, cy: 100, w: 60, h: 44 }, // identical anchor -> must move
    ];
    const positions = placeChips(chips, { w: 300, h: 200 });
    const boxes = positions.map((p) => ({ ...p, w: 60, h: 44 }));
    expect(overlaps(boxes[0], boxes[1])).toBe(false);
    expect(positions[0]).toEqual({ x: 100, y: 100 }); // first keeps its anchor
  });

  it('warns and leaves the chip at its clamped anchor when no free position exists', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      // Five chips, each nearly as big as the whole 120x120 room: no
      // arrangement of five fits without at least one overlap.
      const chips: Chip[] = Array.from({ length: 5 }, () => ({ cx: 60, cy: 60, w: 100, h: 100 }));
      const positions = placeChips(chips, { w: 120, h: 120 });

      expect(positions.length).toBe(5);
      expect(warn).toHaveBeenCalled();

      const boxes = positions.map((p) => ({ ...p, w: 100, h: 100 }));
      let anyOverlap = false;
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          if (overlaps(boxes[i], boxes[j])) anyOverlap = true;
        }
      }
      expect(anyOverlap, 'at least one pair must still overlap — this is the escape hatch, not a fix').toBe(true);
    } finally {
      warn.mockRestore();
    }
  });

  // DIA-54: the real band-750 `ground` room (six 180x120 art-px close-ups on
  // a 348x220 art-px room) is the scene that broke resolveZoomOverlaps +
  // placeButton's 44px regrow (DIA-55 has the
  // reproduction). At a 390px-wide phone viewport, chooseScale picks an
  // integer scale of 1 for this room (floor(390/348) = 1), so buffer units
  // and css px coincide 1:1 here and the rects below can be used directly as
  // css-px anchors/bounds without a conversion step.
  it('band 750 ground room: six real close-up rects at 390px width place with no overlap', () => {
    const GROUND_RECTS = [
      { viewId: 'ground.1', label: 'Closet', x: 33, y: 4, w: 180, h: 120 },
      { viewId: 'ground.2', label: 'Lobby', x: 0, y: 57, w: 180, h: 120 },
      { viewId: 'ground.3', label: 'Sales pit', x: 123, y: 90, w: 180, h: 120 },
      { viewId: 'ground.4', label: 'Call-centre row', x: 115, y: 9, w: 180, h: 120 },
      { viewId: 'ground.5', label: 'Back desks', x: 168, y: 25, w: 180, h: 120 },
      { viewId: 'ground.6', label: 'Helpdesk', x: 168, y: 82, w: 180, h: 120 },
    ] as const;
    const bounds = { w: 348, h: 220 };

    // A chip's real width is measured from the rendered DOM in panel.ts;
    // here it is estimated from the label with a fixed line-height plus
    // ~7px/char, floored at the 44px tap minimum on both axes — the same
    // shape of input placeChips gets in the browser, without needing jsdom
    // layout to measure real text.
    const chips: Chip[] = GROUND_RECTS.map((r) => ({
      cx: r.x + r.w / 2,
      cy: r.y + r.h / 2,
      w: Math.max(44, r.label.length * 7 + 16),
      h: 44,
    }));

    const positions = placeChips(chips, bounds);
    const boxes = positions.map((p, i) => ({ x: p.x, y: p.y, w: chips[i].w, h: chips[i].h }));

    for (const box of boxes) {
      expect(insideBounds(box.x, box.y, box.w, box.h, bounds)).toBe(true);
    }
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        expect(
          overlaps(boxes[i], boxes[j]),
          `${GROUND_RECTS[i].viewId} and ${GROUND_RECTS[j].viewId} zoom-in chips overlap`
        ).toBe(false);
      }
    }
  });
});
