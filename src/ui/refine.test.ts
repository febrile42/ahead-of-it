// PH3-03 step 2 (R-15, DIA-236): pure-logic coverage for the box→gag map —
// which boxes show at which band, and which gags a set of ticked boxes
// marks. createRefineFieldset() itself builds real DOM (a <fieldset> of
// checkboxes) and is covered by tests/refinement.spec.ts instead: this repo's
// unit tests run with no DOM (vitest.config.ts), Playwright covers anything
// that needs a real page.
import { describe, expect, it } from 'vitest';
import type { HaveBox } from '../content';
import { getGags, getHaveBoxes } from '../content';
import { isBoxVisible, markedGagIdsFor } from './refine';

// ---------------------------------------------------------------------------
// Pure logic, against a small synthetic map — independent of what the real
// content happens to rule, so a future content change to the real map
// doesn't have to touch these.
// ---------------------------------------------------------------------------

const BOX_A: HaveBox = { id: 'sso', gagIds: ['g-80'] };
const BOX_B: HaveBox = { id: 'network', gagIds: ['g-80', 'g-150'] };
const BOX_EMPTY: HaveBox = { id: 'mdm', gagIds: [] };

const GAG_TIERS = new Map([
  ['g-80', 80],
  ['g-150', 150],
  ['g-750', 750],
]);

describe('isBoxVisible', () => {
  it('is hidden below its earliest mapped gag\'s band', () => {
    expect(isBoxVisible(BOX_A, 80, GAG_TIERS)).toBe(true);
  });

  it('stays visible above that band (both states are cumulative, R-03a)', () => {
    expect(isBoxVisible(BOX_A, 610, GAG_TIERS)).toBe(true);
    expect(isBoxVisible(BOX_A, 'beyond', GAG_TIERS)).toBe(true);
  });

  it('shows from its earliest mapped gag when it maps to several', () => {
    expect(isBoxVisible(BOX_B, 80, GAG_TIERS)).toBe(true);
    expect(isBoxVisible(BOX_B, 150, GAG_TIERS)).toBe(true);
  });

  it('a box with no mapped gags is never visible', () => {
    expect(isBoxVisible(BOX_EMPTY, 80, GAG_TIERS)).toBe(false);
    expect(isBoxVisible(BOX_EMPTY, 'beyond', GAG_TIERS)).toBe(false);
  });

  it("'beyond' folds to 750, same as gagsThroughBand's own tier (checklist.ts)", () => {
    const box: HaveBox = { id: 'erp', gagIds: ['g-750'] };
    expect(isBoxVisible(box, 750, GAG_TIERS)).toBe(true);
    expect(isBoxVisible(box, 'beyond', GAG_TIERS)).toBe(true);
    expect(isBoxVisible(box, 610, GAG_TIERS)).toBe(false);
  });
});

describe('markedGagIdsFor', () => {
  const boxes = [BOX_A, BOX_B, BOX_EMPTY];

  it('nothing ticked marks nothing', () => {
    expect(markedGagIdsFor(boxes, new Set())).toEqual(new Set());
  });

  it('a ticked box marks every gag it maps to', () => {
    expect(markedGagIdsFor(boxes, new Set(['network']))).toEqual(new Set(['g-80', 'g-150']));
  });

  it('a row is marked if *any* ticked box maps to it — the §3 "no assuming exclusivity" rule', () => {
    // BOX_A and BOX_B both map g-80, on purpose — the map itself never does
    // this in the real content (§3a), but the code must not assume that.
    expect(markedGagIdsFor(boxes, new Set(['sso', 'network']))).toEqual(new Set(['g-80', 'g-150']));
  });

  it('unticking removes exactly that box\'s marks', () => {
    const withNetwork = markedGagIdsFor(boxes, new Set(['sso', 'network']));
    const ssoOnly = markedGagIdsFor(boxes, new Set(['sso']));
    expect(withNetwork.has('g-150')).toBe(true);
    expect(ssoOnly.has('g-150')).toBe(false);
    expect(ssoOnly.has('g-80')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Real content: pins the design note's own §3/§3a band table (DIA-236,
// ahead-of-it-notes docs/research/PH3-03-refinement-design.md) — a QA
// regression check that the shipped BANDS-AND-GAGS.md map still reads the
// way the ruling says it should, band by band (brief step 2's own "a unit
// test per band" ask).
// ---------------------------------------------------------------------------

describe('the real content.json box→gag map, per band (design note §3/§3a)', () => {
  const boxes = getHaveBoxes();
  const gagTiers = new Map(getGags().map((g) => [g.id, g.band === 'beyond' ? 750 : g.band]));

  function visibleAt(band: Parameters<typeof isBoxVisible>[1]): string[] {
    return boxes.filter((b) => isBoxVisible(b, band, gagTiers)).map((b) => b.id);
  }

  it('band 80: SSO and the network box only', () => {
    expect(visibleAt(80)).toEqual(['sso', 'network']);
  });

  it('bands 150/220/360/490: + ERP and MDM, security lead still hidden', () => {
    for (const band of [150, 220, 360, 490] as const) {
      expect(visibleAt(band), `band ${band}`).toEqual(['sso', 'erp', 'network', 'mdm']);
    }
  });

  it('bands 610/750/beyond: all five', () => {
    for (const band of [610, 750, 'beyond'] as const) {
      expect(visibleAt(band), `band ${band}`).toEqual(['sso', 'securityLead', 'erp', 'network', 'mdm']);
    }
  });

  it('ticking SSO at band 80 marks exactly G1.2 (the brief\'s own e2e case, step 2)', () => {
    expect(markedGagIdsFor(boxes, new Set(['sso']))).toEqual(new Set(['G1.2']));
  });

  it('no gag id is marked by two boxes (§3a: "the code should not assume that stays true" — it does, today)', () => {
    const seen = new Map<string, string>();
    for (const box of boxes) {
      for (const gagId of box.gagIds) {
        expect(seen.has(gagId), `gag ${gagId} mapped by both ${seen.get(gagId)} and ${box.id}`).toBe(false);
        seen.set(gagId, box.id);
      }
    }
  });

  it('every mapped gag id is a real gag in content.json', () => {
    const gagIds = new Set(getGags().map((g) => g.id));
    for (const box of boxes) {
      for (const gagId of box.gagIds) {
        expect(gagIds.has(gagId), `box ${box.id} references unknown gag ${gagId}`).toBe(true);
      }
    }
  });
});
