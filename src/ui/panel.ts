// PH1-04 panel (brief 3e): bottom sheet on phone, side panel >=768px — a
// single markup structure, the split handled by CSS (src/style.css), not
// duplicated JS. Order is fixed by D-021 / TONE.md: strip -> already ->
// prevented (with a without-state thumbnail) -> worth it later (if any) ->
// the one contact line. Hotspots are real <button>s positioned from the
// same SceneLayout the canvas draws from, so the picture and the buttons
// can never disagree, sized >=44px regardless of the canvas's own pixel
// scale (R-20).
import type { Gag, PanelFields } from '../content';
import { getBeyond, getGags } from '../content';
import type { SceneLayout } from '../scene/layout';
import { createContactLine } from './contact';

const MIN_TAP_PX = 44;

export interface PanelHandles {
  root: HTMLElement;
  open: (fields: PanelFields, thumbnailState: 'built' | 'without') => void;
  close: () => void;
  isOpen: () => boolean;
}

function renderBeats(container: HTMLElement, fields: PanelFields, thumbnailState: 'built' | 'without') {
  container.replaceChildren();

  const strip = document.createElement('p');
  strip.className = 'panel__strip';
  strip.textContent = `${fields.strip.year} · ${fields.strip.headcount} · ${fields.strip.descriptor}`;

  const title = document.createElement('h2');
  title.className = 'panel__title';
  title.textContent = fields.title;

  const already = document.createElement('section');
  already.className = 'panel__beat panel__beat--already';
  const alreadyH = document.createElement('h3');
  alreadyH.textContent = 'What was already built';
  const alreadyP = document.createElement('p');
  alreadyP.textContent = fields.already;
  already.append(alreadyH, alreadyP);

  const prevented = document.createElement('section');
  prevented.className = 'panel__beat panel__beat--prevented';
  const preventedH = document.createElement('h3');
  preventedH.textContent = 'What it prevented';
  // A without-state thumbnail (R-04): the same placeholder treatment the
  // main scene uses, not a second canvas render — see src/scene/assembler.ts
  // for why placeholders are the honest choice until PH1-06 lands.
  const thumb = document.createElement('div');
  thumb.className = `panel__thumb panel__thumb--${thumbnailState}`;
  thumb.setAttribute('aria-hidden', 'true');
  thumb.textContent = fields.id;
  const preventedP = document.createElement('p');
  preventedP.textContent = fields.prevented;
  prevented.append(preventedH, thumb, preventedP);

  container.append(strip, title, already, prevented);

  if (fields.worthLater) {
    const worth = document.createElement('section');
    worth.className = 'panel__beat panel__beat--worth';
    const worthH = document.createElement('h3');
    worthH.textContent = 'Worth it later';
    const worthP = document.createElement('p');
    worthP.textContent = fields.worthLater;
    worth.append(worthH, worthP);
    container.append(worth);
  }

  container.append(createContactLine());
}

export function createPanel(): PanelHandles {
  const root = document.createElement('aside');
  root.className = 'panel';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'false');
  root.setAttribute('aria-label', 'Panel');

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'panel__close';
  closeButton.textContent = 'Close';
  closeButton.setAttribute('aria-label', 'Close panel');

  const body = document.createElement('div');
  body.className = 'panel__body';

  root.append(closeButton, body);

  function close() {
    root.hidden = true;
  }

  closeButton.addEventListener('click', close);

  return {
    root,
    open(fields, thumbnailState) {
      renderBeats(body, fields, thumbnailState);
      root.hidden = false;
      closeButton.focus();
    },
    close,
    isOpen: () => !root.hidden,
  };
}

/** Looks up the panel content (PanelFields) for a hotspot's gagId, or the Beyond panel for 'beyond'. */
export function panelFieldsFor(gagId: string): PanelFields | undefined {
  const gag: Gag | undefined = getGags().find((g) => g.id === gagId);
  return gag;
}

export function beyondPanelFields(): PanelFields {
  return getBeyond().panel;
}

/**
 * Renders one real <button> per hotspot in `layout`, absolutely positioned
 * over the canvas from the same coordinates the assembler drew from, each
 * at least 44x44 CSS px (R-20) regardless of the canvas's internal scale.
 * `onOpen` receives the gag id (never the part-qualified hotspotId — both
 * parts of a two-part gag open the same panel, per the brief).
 */
export function renderHotspots(
  container: HTMLElement,
  layout: SceneLayout,
  onOpen: (gagId: string) => void
): void {
  container.replaceChildren();
  for (const hotspot of layout.hotspots) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `hotspot hotspot--${hotspot.emphasis}`;
    button.dataset.gagId = hotspot.gagId;
    button.dataset.hotspotId = hotspot.hotspotId;
    button.setAttribute('aria-label', `Open panel for ${hotspot.gagId}`);
    button.style.position = 'absolute';
    button.style.left = `${(hotspot.x / layout.bufferW) * 100}%`;
    button.style.top = `${(hotspot.y / layout.bufferH) * 100}%`;
    button.style.minWidth = `${MIN_TAP_PX}px`;
    button.style.minHeight = `${MIN_TAP_PX}px`;
    button.style.transform = 'translate(-50%, -50%)';
    button.addEventListener('click', () => onOpen(hotspot.gagId));
    container.append(button);
  }
}
