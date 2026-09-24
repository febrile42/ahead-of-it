// PH1-04 checklist (brief 3f): the accessible equivalent of the scene
// (R-14), below the fold, generated from the same content the canvas
// reads — never a second copy of the copy. Gains a translation column at
// the 'beyond' stop (R-14a). "Download" is a print stylesheet, no PDF lib.
import type { BandId, Gag } from '../content';
import { getBeyond, getGags } from '../content';
import { createContactLine } from './contact';

export interface ChecklistHandles {
  root: HTMLElement;
  render: (band: BandId) => void;
}

function gagRow(gag: Gag): HTMLElement {
  const li = document.createElement('li');
  li.className = 'checklist__item';

  const already = document.createElement('p');
  already.className = 'checklist__already';
  const strong = document.createElement('strong');
  strong.textContent = `${gag.strip.year} · ${gag.strip.headcount} — ${gag.title}. `;
  const alreadyText = document.createTextNode(gag.already);
  already.append(strong, alreadyText);

  const without = document.createElement('p');
  without.className = 'checklist__without';
  without.textContent = `Without it: ${gag.prevented}`;

  li.append(already, without);

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

export function createChecklist(): ChecklistHandles {
  const root = document.createElement('section');
  root.className = 'checklist';
  root.setAttribute('aria-label', 'Checklist: what was already in place');

  const heading = document.createElement('h2');
  heading.textContent = 'Checklist — what was already in place';

  const printButton = document.createElement('button');
  printButton.type = 'button';
  printButton.className = 'checklist__download';
  printButton.textContent = 'Download (print-friendly)';
  printButton.addEventListener('click', () => window.print());

  const list = document.createElement('ul');
  list.className = 'checklist__list';

  root.append(heading, printButton, list);

  function render(band: BandId) {
    list.replaceChildren();
    const tier = band === 'beyond' ? 750 : band;
    // gag.band is never 'beyond' in practice (see layout.ts's same note).
    const gags = getGags().filter((g) => (g.band === 'beyond' ? 750 : g.band) <= tier);
    for (const gag of gags) {
      list.append(gagRow(gag));
    }

    const existingTable = root.querySelector('.checklist__translation');
    existingTable?.remove();
    const existingBeyondPanel = root.querySelector('.checklist__beyond');
    existingBeyondPanel?.remove();

    if (band === 'beyond') {
      const beyond = getBeyond();
      const beyondSection = document.createElement('div');
      beyondSection.className = 'checklist__beyond';
      const p = document.createElement('p');
      p.textContent = beyond.panel.already;
      beyondSection.append(p, beyondTranslationTable());
      root.append(beyondSection);
    }

    const existingContact = root.querySelector('.contact-line');
    existingContact?.remove();
    root.append(createContactLine());
  }

  return { root, render };
}
