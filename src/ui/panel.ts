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
import type { Chip, SceneLayout, ZoomLayout } from '../scene/layout';
import { placeChips } from '../scene/layout';
import { createContactLine } from './contact';
import { ui } from './strings';

const MIN_TAP_PX = 44;

export interface PanelOpenOptions {
  /** Set false to open without stealing focus (R-24 — the auto-opened Beyond panel must not move focus off the slider at its last stop). Defaults to true. */
  focus?: boolean;
  /** The element to return focus to when the panel closes (R-24 — a non-modal dialog returns focus to its invoker). */
  returnFocusTo?: HTMLElement;
  /** U-06 (DIA-194/195): set false for the auto-opened Beyond panel — the
   * "what works" keep-list's own rule is that it opens without trapping,
   * "the slider stays usable above the sheet" even on a phone. Every
   * hotspot-opened panel wants the default (true): modal on phone,
   * whatever `isModalWidth()` says at open() time. */
  modal?: boolean;
}

export interface PanelHandles {
  root: HTMLElement;
  open: (fields: PanelFields, thumbnailState: 'built' | 'without', options?: PanelOpenOptions) => void;
  close: () => void;
  isOpen: () => boolean;
  /** DIA-13: repoints B4's return-focus target without touching content or
   * live focus — for a re-render that rebuilds the hotspot layer out from
   * under an open panel's invoking button (F3.2). The invoker reference
   * `open()` was given is now a detached node; this swaps in its
   * replacement so a later Escape/close still lands somewhere real. */
  setReturnFocusTo: (el: HTMLElement | null) => void;
  /** U-06 (DIA-194/195): fires once per `open()` call, with whether *this*
   * open is modal (phone width AND `options.modal !== false`) — main.ts
   * uses this to make the rest of the page `inert`, only when true. */
  onOpen: (listener: (modal: boolean) => void) => void;
  /** U-05/U-06: fires once per `close()` call, however it was closed (the
   * close button, Escape, or a future outside-tap) — main.ts uses this to
   * undo the background `inert` and clear the tapped hotspot's selected
   * state, in one place regardless of the close path. */
  onClose: (listener: () => void) => void;
}

/** U-06: the panel is a modal dialog at ≤767px (a phone bottom sheet with
 * nothing else reachable underneath it) and a non-modal side panel from
 * 768px up (D-051 item 3's "side panel leaves the picture visible" stays
 * true there). Read live rather than cached, so a panel opened before a
 * resize still asks the right question at open() time. */
function isModalWidth(): boolean {
  return window.matchMedia('(max-width: 767px)').matches;
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
  //
  // DIA-65: the Beyond panel's fields (beyondPanelFields()) are a bare
  // PanelFields, not a Gag — there is no single hotspot/without-scene
  // moment for the exporter to have cropped a thumbnail from, and
  // `/sprites/thumbs/B.png` (or whatever its id is) never exists. Building
  // the frame there anyway just meant thumbImg.onerror hid it a frame
  // later, after the panel had already been laid out visible — a real,
  // measured layout shift (R-01b's auto-opened Beyond panel was the only
  // thing in the whole app that reached this path, hence only ever
  // caught reaching 'beyond'). `'band' in fields` is exactly the
  // distinction Gag vs. bare PanelFields already draws (build-content.ts).
  const preventedP = document.createElement('p');
  const preventedLabel = document.createElement('strong');
  preventedLabel.textContent = 'What it prevented:';
  preventedP.append(preventedLabel, document.createTextNode(` ${fields.prevented}`));
  if ('band' in fields) {
    const thumb = document.createElement('div');
    thumb.className = 'panel__thumb';
    thumb.setAttribute('aria-hidden', 'true');
    const thumbImg = document.createElement('img');
    thumbImg.src = `/sprites/thumbs/${fields.id}.png`;
    thumbImg.alt = '';
    thumbImg.width = 64;
    thumbImg.height = 48;
    // Fix round item 8 / review fix 5: no thumb exported for this gag yet
    // (public/sprites/thumbs/ is still incomplete pre-PH1-08b) shouldn't
    // show a browser's broken-image icon — hide the whole frame instead of
    // leaving a visibly broken box in a shipped panel.
    thumbImg.onerror = () => {
      thumb.hidden = true;
    };
    thumb.dataset.state = thumbnailState;
    thumb.append(thumbImg);
    prevented.append(thumb, preventedP);
  } else {
    prevented.append(preventedP);
  }

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
  // U-06: whether *this* open is modal — set once per open() call (below)
  // and read by the Tab-trap keydown handler, rather than recomputed from
  // isModalWidth() on every keystroke, so a viewport resize mid-open can't
  // make the trap disagree with whether main.ts actually made the
  // background inert for this same open.
  let modalNow = false;
  const openListeners: Array<(modal: boolean) => void> = [];
  const closeListeners: Array<() => void> = [];

  function close() {
    if (root.hidden) return;
    root.hidden = true;
    // U-06: closeListeners run first — main.ts's own listener lifts `inert`
    // off the rest of the page there, and B4's return-focus target usually
    // lives inside it. Focusing it first, while that ancestor is still
    // inert, is a silent no-op (an inert subtree holds no focusable
    // elements) that drops focus to <body> instead.
    for (const listener of closeListeners) listener();
    const target = returnFocusTo;
    returnFocusTo = null;
    target?.focus();
  }

  closeButton.addEventListener('click', close);

  /** U-06: every `a`/`button` inside the sheet, in DOM order — the panel's
   * own tab sequence to trap Tab/Shift+Tab within, while modal. */
  function focusableElements(): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));
  }

  // B4: Escape closes the panel regardless of which element currently has
  // focus (the invoking hotspot, the slider, or the close button itself),
  // so it has to listen at the document, not just within `root`.
  // U-06: while modal (≤767px), Tab/Shift+Tab from the sheet's first/last
  // focusable element wraps back inside it instead of escaping to whatever
  // sits behind the sheet — main.ts's own `inert` on the rest of the page
  // already keeps those out of the *browser's* tab order, this is what
  // still cycles the sheet's own ends into each other.
  document.addEventListener('keydown', (event) => {
    if (root.hidden) return;
    if (event.key === 'Escape') {
      close();
      return;
    }
    if (event.key !== 'Tab' || !modalNow) return;
    const items = focusableElements();
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  // U-08 (DIA-194/197): on phone, a tap outside the sheet left it open and
  // dropped focus to <body> (everything else is `inert` there — U-06 — so
  // the tap can't land on any real control). `pointerdown`, not `click`:
  // it fires before the hotspot's own `click` that calls open() below, so
  // the interaction that opens the panel is never mistaken for one outside
  // it. On desktop (non-modal) this is a no-op, matching the "what works"
  // keep-list's side panel that stays open behind a click elsewhere.
  document.addEventListener('pointerdown', (event) => {
    if (root.hidden || !modalNow) return;
    if (!root.contains(event.target as Node)) {
      // Chromium review round: close() re-focuses the invoking hotspot
      // synchronously, but the *same* touch gesture still has its
      // compatibility mousedown/click ahead of it — a mousedown on
      // whatever non-focusable element sits at this point (a <p>, the
      // canvas, …) is itself a browser default that blurs back to <body>.
      // preventDefault() here (for a touch-sourced pointerdown, per the
      // Pointer Events spec) cancels those compatibility events outright,
      // so the outside tap only ever dismisses the sheet — it can't also
      // land a click on whatever it happened to hit behind it.
      event.preventDefault();
      close();
    }
  });

  return {
    root,
    open(fields, thumbnailState, options = {}) {
      renderBeats(body, fields, thumbnailState);
      root.hidden = false;
      modalNow = options.modal !== false && isModalWidth();
      root.setAttribute('aria-modal', String(modalNow));
      returnFocusTo = options.returnFocusTo ?? null;
      // B4: reaching `beyond` with the keyboard must not steal focus off
      // the slider at its last stop — callers pass { focus: false } there.
      if (options.focus !== false) {
        closeButton.focus();
      }
      for (const listener of openListeners) listener(modalNow);
    },
    close,
    isOpen: () => !root.hidden,
    setReturnFocusTo(el) {
      returnFocusTo = el;
    },
    onOpen(listener) {
      openListeners.push(listener);
    },
    onClose(listener) {
      closeListeners.push(listener);
    },
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
 * DIA-65: the canvas's own on-screen box (css px, relative to
 * `.hotspots-layer`'s permanently-fixed origin — see main.ts's
 * `sizeAndPositionCanvas`). `#hotspots-layer` itself is never resized or
 * moved any more (a real Chromium run showed that even a fixed-top-left
 * resize of an *existing* element still scores as a layout shift), so every
 * hotspot button now carries the canvas's offset/scale itself, in pixels,
 * instead of relying on `%` positions resolved against a container box that
 * used to track the canvas exactly.
 */
export interface CanvasBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Positions `button` over the canvas from a rect in the layout's native units: centred on `rect.marker` when set (D-047), else on the rect's centre (B2); never smaller than 44 css px (R-20). Returns the centre, in the same buffer units as `rect`. */
function placeButton(
  button: HTMLButtonElement,
  rect: { x: number; y: number; w: number; h: number; marker?: { x: number; y: number } },
  layout: { bufferW: number; bufferH: number },
  canvasBox: CanvasBox
): { cx: number; cy: number } {
  button.style.position = 'absolute';
  // B2: position from the rect's centre, not its top-left corner —
  // `rect.x/y` is the top-left, so the point translate(-50%,-50%)
  // centres on has to be (x + w/2, y + h/2). D-047: a `marker` point (set
  // by the exporter, always inside this rect) overrides that centre for
  // the button and reticle only — `--obj-w/h` below still come from the
  // rect, so the reticle's frame size is unaffected.
  const cx = rect.marker ? rect.marker.x : rect.x + rect.w / 2;
  const cy = rect.marker ? rect.marker.y : rect.y + rect.h / 2;
  button.style.left = `${canvasBox.left + (cx / layout.bufferW) * canvasBox.width}px`;
  button.style.top = `${canvasBox.top + (cy / layout.bufferH) * canvasBox.height}px`;
  button.style.minWidth = `${MIN_TAP_PX}px`;
  button.style.minHeight = `${MIN_TAP_PX}px`;
  button.style.transform = 'translate(-50%, -50%)';
  // DIA-124: the object's own on-screen size, for the marker (style.css
  // `.hotspot::before/::after`) to frame the object rather than the 44px
  // hit box. Visual only — the button's hit area above is unchanged (R-20).
  button.style.setProperty('--obj-w', `${(rect.w / layout.bufferW) * canvasBox.width}px`);
  button.style.setProperty('--obj-h', `${(rect.h / layout.bufferH) * canvasBox.height}px`);
  return { cx, cy };
}

/**
 * DIA-244 (DIA-240 fix, wording from DIA-243 — Product Lead's call, not
 * sourced from content.json: this is screen-reader-only metadata, never
 * shown to a sighted visitor, so it doesn't go through the docs/content
 * pipeline any more than the hardcoded "Close panel" label above does).
 * Every part of a two-part (or, for G5.1's `without` state, three-part)
 * gag otherwise gets the identical aria-label (the gag's panel title
 * alone), so a screen reader announces the same name twice/thrice in a
 * row with nothing to tell the focus stops apart. Keyed by the hotspot's
 * own `part` id (from `hotspotId`'s `${gagId}#${part}` suffix — see
 * src/main.ts's `toSceneLayout` and src/scene/layout.ts's `Hotspot`) so a
 * gag+part not listed here — including every single-hotspot gag — falls
 * back to the bare title, unchanged from before this fix.
 */
const HOTSPOT_PART_SUFFIXES: Record<string, string> = {
  'G4.1#door': 'at the front door',
  'G4.1#deal': 'in the sales pit',
  'G6.4#door': 'at the badge reader',
  'G6.4#chair': 'at the door down the hall',
  'G6.3#shell': 'at the new building',
  'G6.3#map': 'on the map',
  'G5.1#handover': 'at the headquarters door',
  'G5.1#truck': 'on the line between offices',
  'G5.1#inset-door': "at the second office's door",
};

/** DIA-244: builds a hotspot's accessible name from its panel title plus,
 * when this exact gag+part has disambiguating wording, an em-dash suffix
 * (an em dash rather than a comma — G4.1's title already contains one,
 * and default screen-reader settings read the dash as a pause without
 * announcing it). `hotspot.hotspotId` is `${gagId}#${part}` for a
 * multi-part gag and bare `gagId` otherwise, so a single-hotspot gag
 * never matches a key here and keeps today's plain title. */
function hotspotAriaLabel(title: string, hotspotId: string, gagId: string): string {
  if (hotspotId === gagId) return title;
  const suffix = HOTSPOT_PART_SUFFIXES[hotspotId];
  return suffix ? `${title} — ${suffix}` : title;
}

/** PH3-03 (R-15, DIA-236): a hotspot's base accessible name — the same
 * DIA-244 title(+part-suffix) computation above — recomputed from a live
 * button's own `dataset` (rather than cached at render time) so
 * `applyHaveState` below can toggle `haveHotspotSuffix` on and off without
 * needing to remember what the "before" label was. */
export function baseHotspotAriaLabel(gagId: string, hotspotId: string): string {
  const title = panelFieldsFor(gagId)?.title ?? gagId;
  return hotspotAriaLabel(title, hotspotId, gagId);
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
  canvasBox: CanvasBox,
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
    // gag, checked by layout.test.ts's coverage test). DIA-244:
    // hotspotAriaLabel appends a per-part suffix when this gag has more
    // than one hotspot, so the parts don't collide on the same name.
    const title = panelFieldsFor(hotspot.gagId)?.title ?? hotspot.gagId;
    button.setAttribute('aria-label', hotspotAriaLabel(title, hotspot.hotspotId, hotspot.gagId));
    // U-05: main.ts's setHotspotSelected flips this to 'true' — and adds
    // .hotspot--selected's solid reticle — for as long as this hotspot's
    // own panel is open.
    button.setAttribute('aria-expanded', 'false');
    const { cx, cy } = placeButton(button, hotspot, layout, canvasBox);
    // Test-only (S4): the exact centre point in buffer units, so
    // tests/scene.spec.ts can assert the rendered button centre matches
    // within 1px without duplicating the layout math.
    button.dataset.cx = String(cx);
    button.dataset.cy = String(cy);
    button.addEventListener('click', () => onOpen(hotspot.gagId, button));
    container.append(button);
  }
}

/**
 * D-042a: a room has no gag hotspots; instead one "zoom in" <button> per
 * close-up. DIA-55: the button is a small label chip anchored on the
 * close-up's `rect` centre, not a button spanning the whole rect — a dense
 * room's rects overlap too much for spanning buttons to ever reach 44px
 * without covering each other (DIA-54; see src/scene/layout.ts's
 * `placeChips` doc comment for the full story). The chip is inserted first
 * so its real rendered size (label + CSS padding, already floored at 44px)
 * can be measured, then `placeChips` finds each one a position — its
 * anchor if that's free, else the nearest free spot — so two chips never
 * cover the same point regardless of how densely the room's close-ups are
 * packed.
 */
export function renderZoomTargets(
  container: HTMLElement,
  layout: ZoomLayout,
  canvasBox: CanvasBox,
  onZoom: (viewId: string, button: HTMLButtonElement) => void
): void {
  container.replaceChildren();
  container.dataset.bufferW = String(layout.bufferW);
  container.dataset.bufferH = String(layout.bufferH);

  const buttons = layout.targets.map((target) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hotspot hotspot--zoom';
    button.dataset.viewId = target.viewId;
    button.setAttribute('aria-label', ui('zoomIn', { label: target.label }));
    button.style.position = 'absolute';

    const caption = document.createElement('span');
    caption.className = 'hotspot__caption';
    caption.setAttribute('aria-hidden', 'true');
    caption.textContent = target.label;
    button.append(caption);

    button.addEventListener('click', () => onZoom(target.viewId, button));
    container.append(button);
    return button;
  });

  // DIA-65: chip placement works in the canvas's own box (css px), not the
  // (now permanently full-size) container's — `canvasBox` is main.ts's
  // sizeAndPositionCanvas result, the room's actual on-screen size,
  // regardless of the buffer's native-pixel units.
  const cssW = canvasBox.width || layout.bufferW;
  const cssH = canvasBox.height || layout.bufferH;

  const chips: Chip[] = layout.targets.map((target, i) => {
    const box = buttons[i].getBoundingClientRect();
    return {
      cx: ((target.x + target.w / 2) / layout.bufferW) * cssW,
      cy: ((target.y + target.h / 2) / layout.bufferH) * cssH,
      w: box.width,
      h: box.height,
    };
  });

  const positions = placeChips(chips, { w: cssW, h: cssH });

  buttons.forEach((button, i) => {
    const { x, y } = positions[i];
    button.style.left = `${canvasBox.left + x}px`;
    button.style.top = `${canvasBox.top + y}px`;
    button.style.transform = 'translate(-50%, -50%)';
    button.dataset.cx = String(x);
    button.dataset.cy = String(y);
  });
}

/**
 * PH3-03 (R-15, DIA-236): applies the "have" state to every real gag
 * hotspot currently in `container` — `.hotspot--have` (style.css swaps the
 * bracket reticle for a small badge, design note §4.4) plus the
 * `haveHotspotSuffix` accessible-name suffix (§6). Called after every
 * `renderHotspots` (a fresh layer has none of this yet) and again whenever
 * a box is ticked/unticked (main.ts's refine.onChange) — deliberately a
 * class/attribute patch, not a re-render: ticking must not move focus or
 * rebuild the layer (§6). A room view's zoom chips (`.hotspot--zoom`, no
 * `data-gag-id`) are untouched — §4.4: "Zoom chips... are unchanged". */
export function applyHaveState(container: HTMLElement, markedGagIds: ReadonlySet<string>): void {
  for (const button of container.querySelectorAll<HTMLButtonElement>('.hotspot[data-gag-id]')) {
    const gagId = button.dataset.gagId!;
    const hotspotId = button.dataset.hotspotId ?? gagId;
    const marked = markedGagIds.has(gagId);
    button.classList.toggle('hotspot--have', marked);
    const base = baseHotspotAriaLabel(gagId, hotspotId);
    button.setAttribute('aria-label', marked ? ui('haveHotspotSuffix', { title: base }) : base);
  }
}
