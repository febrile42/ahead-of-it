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

export interface PanelOpenOptions {
  /** Set false to open without stealing focus (R-24 — the auto-opened Beyond panel must not move focus off the slider at its last stop). Defaults to true. */
  focus?: boolean;
  /** The element to return focus to when the panel closes (R-24 — a non-modal dialog returns focus to its invoker). */
  returnFocusTo?: HTMLElement;
}

export interface PanelHandles {
  root: HTMLElement;
  open: (fields: PanelFields, thumbnailState: 'built' | 'without', options?: PanelOpenOptions) => void;
  close: () => void;
  isOpen: () => boolean;
}

const PANEL_TITLE_ID = 'panel-title';

function renderBeats(container: HTMLElement, fields: PanelFields, thumbnailState: 'built' | 'without') {
  container.replaceChildren();

  const strip = document.createElement('p');
  strip.className = 'panel__strip';
  strip.textContent = `${fields.strip.year} · ${fields.strip.headcount} · ${fields.strip.descriptor}`;

  const title = document.createElement('h2');
  title.id = PANEL_TITLE_ID;
  title.className = 'panel__title';
  title.textContent = fields.title;

  const already = document.createElement('section');
  already.className = 'panel__beat panel__beat--already';
  const alreadyH = document.createElement('h3');
  alreadyH.textContent = 'What was already built';
  const alreadyP = document.createElement('p');
  alreadyP.textContent = fields.already;
  already.append(alreadyH, alreadyP);

  // "What it prevented" and "Worth it later" are written to follow an
  // *inline* bold label ("**What it prevented:** at your size…" — see
  // PANELS.md and TONE.md's sample panel), not a heading followed by a
  // stand-alone paragraph. Rendering them as separate <h3>s made the copy
  // read as a typo on every panel (review B5) — the label goes inside the
  // paragraph instead.
  const prevented = document.createElement('section');
  prevented.className = 'panel__beat panel__beat--prevented';
  // R-04 / PH1-09: a real without-state thumbnail, cropped by the art
  // exporter from the without scene around the gag's primary hotspot
  // (SCENE-FORMAT "Files": public/sprites/thumbs/<gagId>.png) — no
  // longer the PH1-04 coloured placeholder div. `thumbnailState` is
  // always 'without' in practice (R-04: the panel always shows what was
  // prevented), kept as a param so a future built-state thumbnail is a
  // one-line change here.
  const thumb = document.createElement('div');
  thumb.className = 'panel__thumb';
  thumb.setAttribute('aria-hidden', 'true');
  const thumbImg = document.createElement('img');
  thumbImg.src = `/sprites/thumbs/${fields.id}.png`;
  thumbImg.alt = '';
  thumbImg.width = 64;
  thumbImg.height = 48;
  thumb.dataset.state = thumbnailState;
  thumb.append(thumbImg);
  const preventedP = document.createElement('p');
  const preventedLabel = document.createElement('strong');
  preventedLabel.textContent = 'What it prevented:';
  preventedP.append(preventedLabel, document.createTextNode(` ${fields.prevented}`));
  prevented.append(thumb, preventedP);

  container.append(strip, title, already, prevented);

  if (fields.worthLater) {
    const worth = document.createElement('section');
    worth.className = 'panel__beat panel__beat--worth';
    const worthP = document.createElement('p');
    const worthLabel = document.createElement('strong');
    worthLabel.textContent = 'Worth it later:';
    worthP.append(worthLabel, document.createTextNode(` ${fields.worthLater}`));
    worth.append(worthP);
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
  // m1: labelled by the panel's own title h2 (renderBeats gives it
  // PANEL_TITLE_ID), not a generic "Panel" string.
  root.setAttribute('aria-labelledby', PANEL_TITLE_ID);

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'panel__close';
  closeButton.textContent = 'Close';
  closeButton.setAttribute('aria-label', 'Close panel');

  const body = document.createElement('div');
  body.className = 'panel__body';

  root.append(closeButton, body);

  // B4: return focus to whichever element opened the panel (a hotspot
  // button, or the slider for the auto-opened Beyond panel) on close,
  // whether closed via the close button or Escape.
  let returnFocusTo: HTMLElement | null = null;

  function close() {
    if (root.hidden) return;
    root.hidden = true;
    const target = returnFocusTo;
    returnFocusTo = null;
    target?.focus();
  }

  closeButton.addEventListener('click', close);

  // B4: Escape closes the panel regardless of which element currently has
  // focus (the invoking hotspot, the slider, or the close button itself),
  // so it has to listen at the document, not just within `root`.
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !root.hidden) {
      close();
    }
  });

  return {
    root,
    open(fields, thumbnailState, options = {}) {
      renderBeats(body, fields, thumbnailState);
      root.hidden = false;
      returnFocusTo = options.returnFocusTo ?? null;
      // B4: reaching `beyond` with the keyboard must not steal focus off
      // the slider at its last stop — callers pass { focus: false } there.
      if (options.focus !== false) {
        closeButton.focus();
      }
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
  onOpen: (gagId: string, button: HTMLButtonElement) => void
): void {
  container.replaceChildren();
  // Exposed for tests/scene.spec.ts's centering assertion (S4/B2): the
  // buffer size the hotspot rects below are expressed in, so a test can
  // recover the CSS-px scale factor independently of chooseScale().
  container.dataset.bufferW = String(layout.bufferW);
  container.dataset.bufferH = String(layout.bufferH);
  for (const hotspot of layout.hotspots) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `hotspot hotspot--${hotspot.emphasis}`;
    button.dataset.gagId = hotspot.gagId;
    button.dataset.hotspotId = hotspot.hotspotId;
    // B3: the accessible name is the gag's panel title, not its id — a
    // screen-reader user should hear "A helpdesk with an owner", not
    // "G2.1". panelFieldsFor falls back to the id defensively (it should
    // never actually be missing — every hotspot's gagId comes from a real
    // gag, checked by layout.test.ts's coverage test).
    const title = panelFieldsFor(hotspot.gagId)?.title ?? hotspot.gagId;
    button.setAttribute('aria-label', title);
    button.style.position = 'absolute';
    // B2: position from the rect's centre, not its top-left corner —
    // `hotspot.x/y` is the top-left, so the point translate(-50%,-50%)
    // centres on has to be (x + w/2, y + h/2).
    const cx = hotspot.x + hotspot.w / 2;
    const cy = hotspot.y + hotspot.h / 2;
    button.style.left = `${(cx / layout.bufferW) * 100}%`;
    button.style.top = `${(cy / layout.bufferH) * 100}%`;
    button.style.minWidth = `${MIN_TAP_PX}px`;
    button.style.minHeight = `${MIN_TAP_PX}px`;
    button.style.transform = 'translate(-50%, -50%)';
    // Test-only (S4): the exact centre point in buffer units, so
    // tests/scene.spec.ts can assert the rendered button centre matches
    // within 1px without duplicating the layout math.
    button.dataset.cx = String(cx);
    button.dataset.cy = String(cy);
    button.addEventListener('click', () => onOpen(hotspot.gagId, button));
    container.append(button);
  }
}
