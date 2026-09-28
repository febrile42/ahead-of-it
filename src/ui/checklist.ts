// PH1-04 checklist (brief 3f), reworked by DIA-131 (D-048, from DIA-129:
// docs/product/04-DECISIONS.md, DIA-125 plan document) into an on-demand
// sheet: the accessible equivalent of the scene, generated from the same
// content the canvas reads — never a second copy of the copy. Sighted
// visitors open it from the `Punch list (n)` button in the view-nav row
// (index.html); screen readers and print always get it (R-14, R-24). Gains
// a translation column at the 'beyond' stop (R-14a). "Download" is a print
// stylesheet, no PDF lib.
import type { BandId, Gag } from '../content';
import { getBeyond, getGags } from '../content';
import { createContactLine } from './contact';

export interface ChecklistHandles {
  root: HTMLElement;
  /** Rebuilds the list for `band` and returns the gag count, so the nav
   * button's `Punch list (n)` label is always the length of the list it
   * describes — one source of truth, never a second count computed
   * elsewhere. */
  render: (band: BandId) => number;
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
}

function gagRow(gag: Gag): HTMLElement {
  const li = document.createElement('li');
  li.className = 'checklist__item';

  // R-04-style without-state thumbnail (public/sprites/thumbs/<gagId>.png,
  // the same file panel.ts's prevented-beat crops from) — a row now shows
  // the picture it's the text equivalent of, not just the words.
  const thumb = document.createElement('div');
  thumb.className = 'checklist__thumb';
  thumb.setAttribute('aria-hidden', 'true');
  const thumbImg = document.createElement('img');
  thumbImg.src = `/sprites/thumbs/${gag.id}.png`;
  thumbImg.alt = '';
  thumbImg.width = 64;
  thumbImg.height = 48;
  // The sheet is visually hidden until opened (D-048) — up to 26 of these
  // fire on a single render() while it's collapsed. `loading="lazy"` skips
  // the fetch until the row is actually in the viewport (i.e. the sheet is
  // open), instead of downloading and decoding every thumbnail nobody may
  // ever see.
  thumbImg.loading = 'lazy';
  thumbImg.decoding = 'async';
  thumbImg.onerror = () => {
    thumb.hidden = true;
  };
  thumb.append(thumbImg);

  const already = document.createElement('p');
  already.className = 'checklist__already';
  const strong = document.createElement('strong');
  strong.textContent = `${gag.strip.year} · ${gag.strip.headcount} — ${gag.title}. `;
  const alreadyText = document.createTextNode(gag.already);
  already.append(strong, alreadyText);

  const without = document.createElement('p');
  without.className = 'checklist__without';
  without.textContent = `Without it: ${gag.prevented}`;

  li.append(thumb, already, without);

  // m4: R-14 asks for "each with its panel content" — Already and Without
  // were here, Worth it later wasn't, so the text checklist fell out of
  // sync with the visual panel for gags that have one.
  if (gag.worthLater) {
    const worth = document.createElement('p');
    worth.className = 'checklist__worth';
    worth.textContent = `Worth it later: ${gag.worthLater}`;
    li.append(worth);
  }

  return li;
}

function beyondTranslationTable(): HTMLElement {
  const beyond = getBeyond();
  const table = document.createElement('table');
  table.className = 'checklist__translation';

  const caption = document.createElement('caption');
  caption.textContent = 'At 1,000+, translated (R-14a)';
  table.append(caption);

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  const th1 = document.createElement('th');
  th1.textContent = 'Receipt';
  const th2 = document.createElement('th');
  th2.textContent = 'At 1,000+ this is';
  headRow.append(th1, th2);
  thead.append(headRow);
  table.append(thead);

  const tbody = document.createElement('tbody');
  for (const row of beyond.translation) {
    const tr = document.createElement('tr');
    const td1 = document.createElement('td');
    td1.textContent = row.receipt;
    const td2 = document.createElement('td');
    td2.textContent = row.atScale;
    tr.append(td1, td2);
    tbody.append(tr);
  }
  table.append(tbody);
  return table;
}

/** Every `<a>`/`<button>` inside `panel` follows the panel's own open state
 * (D-048/R-24): tabbable when open, out of the tab order while collapsed —
 * so a keyboard visitor tabbing past the view-nav row never lands on a
 * control that isn't visibly there. The panel itself is never
 * `aria-hidden` and never `display:none` (that would drop it from the
 * accessibility tree too, which is exactly what R-14/R-24 forbid) — only
 * these descendants' *sequential* reachability changes. */
function setPanelTabbable(panel: HTMLElement, tabbable: boolean) {
  for (const el of panel.querySelectorAll<HTMLElement>('a, button')) {
    if (tabbable) el.removeAttribute('tabindex');
    else el.setAttribute('tabindex', '-1');
  }
}

/**
 * DIA-131 (D-048, from DIA-129/DIA-125's plan document): the checklist is
 * no longer always visible under the scene. `trigger` (index.html's
 * `#punch-list-button`, a persistent static-shell node, never rebuilt by a
 * render — unlike a hotspot button, it needs none of panel.ts's B4
 * detached-node handling) is the single labelled entry point that opens
 * and closes it; `triggerLabel` is the span inside it this module writes
 * the `Punch list (n)` text into, so the count can never drift from the
 * list it describes (`render`'s return value is that same count).
 *
 * The returned `root` holds two things, in order: a contact line that's
 * always visible under the scene (R-12 "visible from every panel and the
 * punch list" — item 1 of the plan: nothing else sits there), and
 * `.checklist__panel`, which is always in the DOM and the accessibility
 * tree (R-24) but visually hidden — a clip pattern, not `display:none` and
 * not a closed `<details>` — until `trigger` opens it. Opened, the panel is
 * a sheet in the tap-panel's own style (src/style.css); its own foot is a
 * second contact line, so print and an open sheet both end the same way
 * panel.ts's gag panels do.
 */
export function createChecklist(trigger: HTMLButtonElement, triggerLabel: HTMLElement): ChecklistHandles {
  const root = document.createElement('div');
  root.className = 'checklist';

  const persistentContact = createContactLine();
  root.append(persistentContact);

  const panel = document.createElement('section');
  panel.id = 'checklist-panel';
  panel.className = 'checklist__panel checklist__panel--collapsed';
  panel.setAttribute('aria-label', 'Checklist: what was already in place');

  // DIA-135 (D-048 review, DIA-132 FAIL): the sheet gets its own header and
  // close control instead of leaning on `trigger` staying visually on top
  // of it — that was the thing burying the Download button underneath.
  // The title mirrors `trigger`'s own `Punch list (n)` label (render()
  // keeps both in sync from the one gags.length), not a second, differently
  // worded heading.
  const header = document.createElement('div');
  header.className = 'checklist__header';

  const headerTitle = document.createElement('h2');
  headerTitle.className = 'checklist__header-title';

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  // Shares panel.ts's .panel__close look via a CSS rule that names both
  // classes (style.css) rather than this literal class name — the gag
  // panel and the punch-list sheet are different surfaces, and several
  // pre-existing specs locate `.panel__close` unscoped, assuming it is
  // the gag panel's one close button.
  closeButton.className = 'checklist__close';
  closeButton.textContent = 'Close';
  closeButton.setAttribute('aria-label', 'Close punch list');
  closeButton.addEventListener('click', () => setOpen(false));

  header.append(headerTitle, closeButton);

  const printButton = document.createElement('button');
  printButton.type = 'button';
  printButton.className = 'checklist__download';
  printButton.textContent = 'Download (print-friendly)';
  printButton.addEventListener('click', () => window.print());

  const list = document.createElement('ul');
  list.className = 'checklist__list';

  panel.append(header, printButton, list);
  root.append(panel);

  let open = false;

  function render(band: BandId): number {
    list.replaceChildren();
    const tier = band === 'beyond' ? 750 : band;
    // gag.band is never 'beyond' in practice (see layout.ts's same note).
    const gags = getGags().filter((g) => (g.band === 'beyond' ? 750 : g.band) <= tier);
    for (const gag of gags) {
      list.append(gagRow(gag));
    }

    const existingTable = panel.querySelector('.checklist__translation');
    existingTable?.remove();
    const existingBeyondPanel = panel.querySelector('.checklist__beyond');
    existingBeyondPanel?.remove();

    if (band === 'beyond') {
      const beyond = getBeyond();
      const beyondSection = document.createElement('div');
      beyondSection.className = 'checklist__beyond';
      const p = document.createElement('p');
      p.textContent = beyond.panel.already;
      beyondSection.append(p, beyondTranslationTable());
      panel.append(beyondSection);
    }

    // Foot: the sheet's own contact line (item 3 of the plan) — distinct
    // from `persistentContact` above, which stays visible even while this
    // whole panel is collapsed.
    const existingContact = panel.querySelector('.contact-line');
    existingContact?.remove();
    panel.append(createContactLine());

    setPanelTabbable(panel, open);
    const label = `Punch list (${gags.length})`;
    triggerLabel.textContent = label;
    headerTitle.textContent = label;
    return gags.length;
  }

  function setOpen(next: boolean) {
    if (open === next) return;
    open = next;
    panel.classList.toggle('checklist__panel--open', open);
    panel.classList.toggle('checklist__panel--collapsed', !open);
    trigger.setAttribute('aria-expanded', String(open));
    setPanelTabbable(panel, open);
    if (open) {
      printButton.focus();
    } else {
      trigger.focus();
    }
  }

  trigger.addEventListener('click', () => setOpen(!open));

  // Same Escape convention as the gag panel (panel.ts) — closes regardless
  // of which element currently has focus, and only while this panel (not
  // some other open surface) is the one that's open.
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && open) {
      setOpen(false);
    }
  });

  return {
    root,
    render,
    open: () => setOpen(true),
    close: () => setOpen(false),
    isOpen: () => open,
  };
}
