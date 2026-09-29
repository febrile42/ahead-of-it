// PH3-03 step 2 (R-15, DIA-236): the "what do you already have?" refinement
// (design note `ahead-of-it-notes` docs/research/PH3-03-refinement-design.md,
// signed off DIA-229/DIA-238). A visitor who already has some of SSO, a
// security lead, an ERP, a real network or MDM can tick it — the checklist
// row it maps to (src/ui/checklist.ts) and, where the gag has one, its
// hotspot (src/ui/panel.ts's applyHaveState) both show "you're ahead of
// it", using the same box→gag map content.json carries (R-14, §3a).
//
// Not persisted anywhere (§5): no URL, no storage, no analytics — ticks
// live only in this module's own closure and are lost on reload.
import type { BandId, HaveBox, HaveBoxId } from '../content';
import { getGags, getHaveBoxes } from '../content';
import { ui } from './strings';
import type { UiKey } from './strings';

const HAVE_BOX_LABEL_KEY: Record<HaveBoxId, UiKey> = {
  sso: 'haveSso',
  securityLead: 'haveSecurityLead',
  erp: 'haveErp',
  network: 'haveNetwork',
  mdm: 'haveMdm',
};

function tierOf(band: BandId): number {
  return band === 'beyond' ? 750 : band;
}

/** Every gag id's own tier (its band, 'beyond' folded to 750 like
 * gagsThroughBand in checklist.ts) — computed once from content.json, the
 * one place band cumulation is decided (R-14). */
function buildGagTiers(): Map<string, number> {
  return new Map(getGags().map((g) => [g.id, tierOf(g.band)]));
}

/** §3: a box shows once any of its mapped gags' band is reached, and stays
 * shown afterward (both states are cumulative, R-03a) — a box with no
 * mapped gags (none in this content) never shows. Exported for the unit
 * test (brief step 2's "per band" coverage) and for `render` below. */
export function isBoxVisible(box: HaveBox, band: BandId, gagTiers: ReadonlyMap<string, number>): boolean {
  const tier = tierOf(band);
  return box.gagIds.some((id) => {
    const gagTier = gagTiers.get(id);
    return gagTier !== undefined && gagTier <= tier;
  });
}

/** Every gag id marked "have" by at least one box in `tickedBoxIds` — a row
 * (or hotspot) is marked if *any* ticked box maps to it (§3 rules: "no gag
 * maps to two boxes in the draft, but the code should not assume that").
 * Independent of band: a hidden box's earlier tick still marks its gag's
 * checklist row (§3, "Beyond has no hotspots... boxes mark rows only"). */
export function markedGagIdsFor(boxes: readonly HaveBox[], tickedBoxIds: ReadonlySet<HaveBoxId>): Set<string> {
  const marks = new Set<string>();
  for (const box of boxes) {
    if (!tickedBoxIds.has(box.id)) continue;
    for (const gagId of box.gagIds) marks.add(gagId);
  }
  return marks;
}

export interface RefineHandles {
  root: HTMLFieldSetElement;
  /** Shows/hides each box's option for `band` (§3's band table) — ticks are
   * untouched (§5: they persist across band changes). Never announces
   * anything on its own (§6: "Nothing is announced on band change"). */
  render: (band: BandId) => void;
  /** Every gag id currently marked "have", from every ticked box regardless
   * of whether that box is visible at the current band. */
  getMarkedGagIds: () => ReadonlySet<string>;
  /** Fires once per tick or untick, after the internal state has already
   * changed, with the new marked-gag-id set — main.ts uses this to update
   * the checklist rows, the hotspot badges and the one live announcement
   * (§6), all outside this module (it only owns the fieldset itself). */
  onChange: (listener: (markedGagIds: ReadonlySet<string>) => void) => void;
}

/** Builds the fieldset (§4.1): a legend, one helper line, then a two-column
 * grid of whole-row `<label>` options, one per R-15 box in its own fixed
 * order (content.json's `have`, already in that order). Ticking never moves
 * focus (§6) — this module only ever toggles classes/attributes and calls
 * `onChange` listeners, never `.focus()`. */
export function createRefineFieldset(): RefineHandles {
  const gagTiers = buildGagTiers();
  const boxes = getHaveBoxes();

  const root = document.createElement('fieldset');
  root.className = 'checklist__have';

  const legend = document.createElement('legend');
  legend.textContent = ui('haveLegend');
  root.append(legend);

  const help = document.createElement('p');
  help.className = 'checklist__have-help';
  help.textContent = ui('haveHelp');
  root.append(help);

  const grid = document.createElement('div');
  grid.className = 'checklist__have-grid';
  root.append(grid);

  const tickedBoxIds = new Set<HaveBoxId>();
  const listeners: Array<(markedGagIds: ReadonlySet<string>) => void> = [];
  const options = new Map<HaveBoxId, { label: HTMLLabelElement; box: HaveBox }>();

  function notify() {
    const marks = markedGagIdsFor(boxes, tickedBoxIds);
    for (const listener of listeners) listener(marks);
  }

  for (const box of boxes) {
    const label = document.createElement('label');
    label.className = 'checklist__have-option';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = box.id;
    input.addEventListener('change', () => {
      if (input.checked) tickedBoxIds.add(box.id);
      else tickedBoxIds.delete(box.id);
      notify();
    });

    const text = document.createElement('span');
    text.textContent = ui(HAVE_BOX_LABEL_KEY[box.id]);

    label.append(input, text);
    grid.append(label);
    options.set(box.id, { label, box });
  }

  return {
    root,
    render(band) {
      for (const { label, box } of options.values()) {
        label.hidden = !isBoxVisible(box, band, gagTiers);
      }
    },
    getMarkedGagIds: () => markedGagIdsFor(boxes, tickedBoxIds),
    onChange(listener) {
      listeners.push(listener);
    },
  };
}
