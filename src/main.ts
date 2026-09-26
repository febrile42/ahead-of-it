// PH1-04/PH1-09: wires the slider, toggle, canvas scene, hotspots, panel
// and checklist together. Each piece is a separate module under src/scene
// and src/ui; this file only owns the glue — state (band, toggle state,
// current view), scene loading and re-render calls.
//
// D-035 replaced the PH1-04 elevation (`computeLayout`) with a "dumb
// painter" over an art-exported scene file (docs/product/SCENE-FORMAT.md):
// `loadScene(band, state)` fetches it, `renderScene` draws its current
// view's `entries`, and `toSceneLayout` adapts its `hotspots` into the
// shape src/ui/panel.ts already knows how to turn into real <button>s.
import { getBands, getGags } from './content';
import type { BandId } from './content';
import { chooseScale, renderScene } from './scene/assembler';
import type { Hotspot, SceneLayout, ZoomLayout } from './scene/layout';
import {
  closeups,
  closeupsOf,
  defaultView,
  findView,
  loadScene,
  mostOwnPrimaries,
  primaryCount,
  roomOf,
  rooms,
} from './scene/scene';
import type { SceneFile, SceneView } from './scene/scene';
import { createChecklist } from './ui/checklist';
import { beyondPanelFields, createPanel, panelFieldsFor, renderHotspots, renderZoomTargets } from './ui/panel';
import { ui } from './ui/strings';
import type { SceneState } from './ui/toggle';
import { createSlider } from './ui/slider';
import { createToggle } from './ui/toggle';
import './style.css';

const sliderRoot = document.querySelector<HTMLDivElement>('#slider-root');
const toggleRoot = document.querySelector<HTMLDivElement>('#toggle-root');
const viewsRow = document.querySelector<HTMLDivElement>('#scene-views');
const sceneWrap = document.querySelector<HTMLDivElement>('#scene-wrap');
const stepper = document.querySelector<HTMLDivElement>('#scene-stepper');
const canvas = document.querySelector<HTMLCanvasElement>('#scene-canvas');
const hotspotsLayer = document.querySelector<HTMLDivElement>('#hotspots-layer');
const panelRoot = document.querySelector<HTMLDivElement>('#panel-root');
const checklistRoot = document.querySelector<HTMLDivElement>('#checklist-root');

if (sliderRoot && toggleRoot && viewsRow && sceneWrap && stepper && canvas && hotspotsLayer && panelRoot && checklistRoot) {
  let band: BandId = 80;
  let state: SceneState = 'built';
  let hasMovedSlider = false;
  let currentViewId: string | null = null;
  // D-042a: the scene last drawn (both states share a skeleton, so it is
  // valid for either), what the nav handlers step over without waiting on
  // a render; and the close-up "whole floor" was entered from, so the same
  // control can take the visitor back to where they were.
  let currentScene: SceneFile | null = null;
  let roomFromId: string | null = null;
  // Focus and live-region text to apply once the render that follows a
  // navigation commits. A stale render leaves them pending for the newer
  // one; only a committed paint consumes them.
  let pendingFocus: { kind: 'floor' } | { kind: 'zoomOf'; viewId: string } | null = null;
  let pendingAnnounce: string | null = null;
  // DIA-13: the gagId of the hotspot whose panel is currently open, or null
  // when the open panel isn't hotspot-sourced (the auto-opened Beyond panel)
  // or no panel is open. render() uses this to tell whether an open panel
  // still describes something the just-rebuilt hotspot layer is showing.
  let openPanelGagId: string | null = null;
  // `${band}/${state}` of the last committed paint: a render with the same
  // key only changed the view (or the size), so an open panel still holds.
  let lastPaintKey: string | null = null;

  // S1: slider and toggle markup already lives in index.html's static
  // shell (CLS) — these fill it in rather than creating/appending it.
  const slider = createSlider(sliderRoot, band);
  const toggle = createToggle(toggleRoot, state);

  const panel = createPanel();
  panelRoot.append(panel.root);

  const checklist = createChecklist();
  checklistRoot.append(checklist.root);

  // The "scroll for more" hint (SCENE-FORMAT: a view wider than the
  // viewport scrolls to `focus`) only matters below ~360px now that a
  // close-up is 180 native px. It reserves its own line and is inserted
  // synchronously, before any `await`, so it lands in the same frame as
  // the static shell (S1).
  const scrollHint = document.createElement('p');
  scrollHint.className = 'scene-scroll-hint';
  scrollHint.textContent = 'Scroll to see the rest →';
  stepper.after(scrollHint);

  const prevButton = stepper.querySelector<HTMLButtonElement>('.scene-stepper__prev');
  const nextButton = stepper.querySelector<HTMLButtonElement>('.scene-stepper__next');
  const stepperLabel = stepper.querySelector<HTMLParagraphElement>('.scene-stepper__label');
  const floorButton = stepper.querySelector<HTMLButtonElement>('.scene-stepper__floor');
  // The existing live region (slider.ts writes band changes to it); a
  // navigation announces its own view here.
  const liveRegion = sliderRoot.querySelector<HTMLParagraphElement>('.slider__live');
  if (!prevButton || !nextButton || !stepperLabel || !floorButton || !liveRegion) {
    throw new Error('index.html static shell is missing the stepper controls');
  }

  // S6: G3.A's ambient hover on the *whole* scene was noise (a tooltip on
  // every hover anywhere on the canvas) for a Phase-3, optional (R-13)
  // gag with no sprite of its own yet. Removed until a window sprite
  // exists to hang the hover on specifically.

  /** Adapts a SCENE-FORMAT view's `hotspots[]` into the `Hotspot[]` shape
   * src/ui/panel.ts's `renderHotspots` already draws real <button>s from
   * (docs/briefs/PH1-04-REVIEW.md §b — that seam is why panel.ts didn't
   * need to change). */
  function toSceneLayout(view: SceneView): SceneLayout {
    const hotspots: Hotspot[] = view.hotspots.map((h) => ({
      hotspotId: h.part ? `${h.gagId}#${h.part}` : h.gagId,
      gagId: h.gagId,
      x: h.x,
      y: h.y,
      w: h.w,
      h: h.h,
      emphasis: 'current',
    }));
    return { bufferW: view.size.w, bufferH: view.size.h, hotspots };
  }

  /** D-042 item 6: the band's own gags — a room's default close-up is the one holding the most of their primaries. */
  function ownGagIds(): Set<string> {
    const tier = band === 'beyond' ? 750 : band;
    return new Set(getGags().filter((g) => (g.band === 'beyond' ? 750 : g.band) === tier).map((g) => g.id));
  }

  /** Where a room tab, and the whole-floor control leaving a room, land: never on an establishing shot with nothing to tap. */
  function roomDefault(scene: SceneFile, roomId: string): SceneView | undefined {
    return mostOwnPrimaries(closeupsOf(scene, roomId), ownGagIds());
  }

  function announceView(scene: SceneFile, view: SceneView): string {
    const room = roomOf(scene, view);
    if (view.kind === 'room') return ui('announceRoom', { room: view.label });
    const all = closeups(scene);
    return ui('announce', {
      room: room?.label ?? '',
      label: view.label,
      n: all.indexOf(view) + 1,
      total: all.length,
    });
  }

  /** Switches view. View selection happens here, in state, before any `await` in render(): a repeated identical request is a no-op, and a stale render's paint is dropped without its work being redone. */
  function selectView(
    viewId: string,
    intent: { focus?: typeof pendingFocus } = {}
  ) {
    if (viewId === currentViewId || !currentScene) return;
    const view = findView(currentScene, viewId);
    if (!view) return;
    currentViewId = view.id;
    pendingFocus = intent.focus ?? null;
    pendingAnnounce = announceView(currentScene, view);
    void render();
  }

  function selectRoom(roomId: string) {
    if (!currentScene) return;
    const target = roomDefault(currentScene, roomId);
    if (target) selectView(target.id);
  }

  /** Steps over every close-up in array order, crossing rooms (D-042a). At either end it does nothing but say so: `aria-disabled`, never `disabled`, so focus is not lost. */
  function step(delta: 1 | -1) {
    if (!currentScene) return;
    const view = currentViewId ? findView(currentScene, currentViewId) : undefined;
    if (!view || view.kind !== 'closeup') return; // in a room view there is no "next"
    const all = closeups(currentScene);
    const to = all[all.indexOf(view) + delta];
    if (to) selectView(to.id);
    else liveRegion!.textContent = ui(delta === 1 ? 'atEnd' : 'atStart');
  }

  function toggleWholeFloor() {
    if (!currentScene || !currentViewId) return;
    const view = findView(currentScene, currentViewId);
    if (!view) return;
    if (view.kind === 'closeup') {
      roomFromId = view.id;
      // The close-up just left is one step away in the room: put focus on
      // its "zoom in" button (looked up by id after the render, never held).
      if (view.parent) selectView(view.parent, { focus: { kind: 'zoomOf', viewId: view.id } });
      return;
    }
    const back = roomFromId && findView(currentScene, roomFromId)?.parent === view.id ? findView(currentScene, roomFromId) : undefined;
    const target = back ?? roomDefault(currentScene, view.id);
    if (target) selectView(target.id);
  }

  prevButton.addEventListener('click', () => step(-1));
  nextButton.addEventListener('click', () => step(1));
  floorButton.addEventListener('click', toggleWholeFloor);

  function makeTab(roomId: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'scene-views__button';
    button.setAttribute('role', 'tab');
    button.dataset.viewId = roomId;
    button.addEventListener('click', () => selectRoom(roomId));
    return button;
  }

  /** Room tabs, one line, one per room. Persistent within a band: the nodes are reused (so a click, an arrow key or the toggle keeps focus) and only rebuilt when a different band brings different rooms. */
  function syncTabs(scene: SceneFile, activeRoomId: string | undefined) {
    const roomList = rooms(scene);
    const existing = Array.from(viewsRow!.querySelectorAll<HTMLButtonElement>('.scene-views__button'));
    if (existing.length !== roomList.length || existing.some((b, i) => b.dataset.viewId !== roomList[i].id)) {
      viewsRow!.replaceChildren(...roomList.map((room) => makeTab(room.id)));
    }
    const tabs = Array.from(viewsRow!.querySelectorAll<HTMLButtonElement>('.scene-views__button'));
    for (const [i, room] of roomList.entries()) {
      const tab = tabs[i];
      const count = primaryCount(closeupsOf(scene, room.id));
      const selected = room.id === activeRoomId;
      tab.textContent = ui('roomTab', { room: room.label, count });
      tab.setAttribute('aria-label', ui('roomTabName', { room: room.label, count }));
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }
    // Keep the selected tab in view without moving the page (a one-line row
    // scrolls sideways at 750, where there are more rooms than fit).
    const active = tabs.find((t) => t.dataset.viewId === activeRoomId);
    if (active) {
      const left = active.offsetLeft;
      const right = left + active.offsetWidth;
      if (left < viewsRow!.scrollLeft) viewsRow!.scrollLeft = left;
      else if (right > viewsRow!.scrollLeft + viewsRow!.clientWidth) viewsRow!.scrollLeft = right - viewsRow!.clientWidth;
    }
  }

  // Roving-tabindex arrow-key navigation across the tab row (standard
  // tablist keyboard pattern): Left/Right (and Home/End) move to a room's
  // default close-up and focus its tab, without leaving the row.
  viewsRow.onkeydown = (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = Array.from(viewsRow.querySelectorAll<HTMLButtonElement>('.scene-views__button'));
    const from = tabs.findIndex((t) => t === document.activeElement);
    if (from === -1) return;
    event.preventDefault();
    const last = tabs.length - 1;
    const to =
      event.key === 'Home' ? 0 : event.key === 'End' ? last : (from + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[to].focus();
    selectRoom(tabs[to].dataset.viewId ?? '');
  };

  /** The stepper row: "label · n of N" between previous and next, and the whole-floor toggle. */
  function syncStepper(scene: SceneFile, view: SceneView) {
    const all = closeups(scene);
    const index = all.indexOf(view);
    prevButton!.setAttribute('aria-label', ui('previous'));
    nextButton!.setAttribute('aria-label', ui('next'));
    prevButton!.setAttribute('aria-disabled', String(index <= 0));
    nextButton!.setAttribute('aria-disabled', String(index === -1 || index === all.length - 1));
    stepperLabel!.textContent =
      view.kind === 'room' ? ui('announceRoom', { room: view.label }) : ui('position', { label: view.label, n: index + 1, total: all.length });
    floorButton!.textContent = ui('wholeFloor');
    floorButton!.setAttribute('aria-pressed', String(view.kind === 'room'));
    floorButton!.setAttribute('aria-disabled', 'false');
  }

  /** Sizes the canvas + hotspots layer in device pixels per SCENE-FORMAT's
   * two-axis `s = max(1, min(floor(cssAvailW*dpr/nativeW),
   * floor(cssAvailH*dpr/nativeH)))` (fix round item 7 / review fix 4 —
   * scaling on width alone could grow a view taller than `.scene-wrap`'s
   * own box and force an internal vertical scroll), scrolls to the
   * view's `focus` rect (with the "scroll for more" hint) when the view
   * is wider than what fits, and centres the canvas horizontally when it
   * isn't. */
  function sizeAndPositionCanvas(view: SceneView) {
    const dpr = window.devicePixelRatio || 1;
    const cssAvailW = sceneWrap!.clientWidth || window.innerWidth;
    const cssAvailH = sceneWrap!.clientHeight || 240;
    const scale = chooseScale(cssAvailW, cssAvailH, view.size.w, view.size.h, dpr);
    const backingW = view.size.w * scale;
    const backingH = view.size.h * scale;
    const cssW = backingW / dpr;
    const cssH = backingH / dpr;
    canvas!.width = backingW;
    canvas!.height = backingH;
    canvas!.style.width = `${cssW}px`;
    canvas!.style.height = `${cssH}px`;
    hotspotsLayer!.style.width = `${cssW}px`;
    hotspotsLayer!.style.height = `${cssH}px`;
    // CLS: .scene-wrap stays 3:2 and the same size for every view
    // (D-042a) — a 180x120 close-up at 2 css px per art px and a 360x240
    // room at 1 both fill it, and anything smaller sits centred in it —
    // so switching view, band or state never moves the page.

    const overflowsX = cssW > cssAvailW + 0.5;
    scrollHint.classList.toggle('scene-scroll-hint--visible', overflowsX);
    if (overflowsX) {
      const focusScale = cssW / view.size.w;
      sceneWrap!.scrollLeft = view.focus.x * focusScale;
      sceneWrap!.scrollTop = view.focus.y * focusScale;
      canvas!.style.marginLeft = '0px';
      hotspotsLayer!.style.left = '0px';
    } else {
      sceneWrap!.scrollLeft = 0;
      sceneWrap!.scrollTop = 0;
      // Centre horizontally when the view is narrower than the wrap
      // (review fix 4) — canvas and hotspotsLayer move together so
      // hotspot buttons (positioned as % of the layer) stay aligned
      // with the picture under them.
      const offsetLeft = Math.max(0, (cssAvailW - cssW) / 2);
      canvas!.style.marginLeft = `${offsetLeft}px`;
      hotspotsLayer!.style.left = `${offsetLeft}px`;
    }
  }

  function openPanel(gagId: string, source: HTMLElement) {
    const fields = panelFieldsFor(gagId);
    if (!fields) return;
    openPanelGagId = gagId;
    // R-04: the prevented-beat thumbnail is always the without-state
    // scene. B4: closing returns focus to the hotspot that opened it.
    panel.open(fields, 'without', { returnFocusTo: source });
  }

  // S5: render() is async (it fetches the scene file and awaits sprite
  // loads) and isn't otherwise serialised — a fast slider drag can start
  // a second render before the first's paint lands, interleaving two
  // states on the canvas. Each call takes a token; if a newer render
  // started before this one's await resolves, its paint is stale and
  // gets dropped.
  let renderToken = 0;

  /** No scene file for this band x state yet (PH1-08b hasn't landed for
   * it, or at all — public/sprites/scenes/ doesn't exist in this
   * worktree). SCENE-FORMAT's own placeholder mechanism (a drawn room
   * plus `placeholder: true` hotspots) is data *inside* a scene file the
   * exporter emits; this is the one level up from that — no file at
   * all — so it draws a plain "not drawn yet" box instead of throwing
   * and leaving the page broken. */
  const MISSING_SCENE_SIZE = { w: 270, h: 184 };

  // DIA-13: renderHotspots and renderViewSwitcher both rebuild their layer
  // with replaceChildren() on every render() — the slider, the toggle, a
  // view-tab click/Enter and resize all call render(). That silently
  // detaches whatever was focused (a hotspot button, a view tab) and
  // orphans any open panel's B4 return-focus target. captureFocus() reads
  // the pre-render identity of a focused hotspot (not the node itself
  // — the node is about to die); restoreFocus() finds its replacement in
  // the freshly rebuilt layer and focuses that instead.
  type FocusCapture = { kind: 'hotspot'; hotspotId: string } | { kind: 'zoom'; viewId: string } | null;

  function captureFocus(): FocusCapture {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return null;
    if (hotspotsLayer!.contains(active)) {
      const { hotspotId, viewId } = active.dataset;
      if (hotspotId) return { kind: 'hotspot', hotspotId };
      return viewId ? { kind: 'zoom', viewId } : null;
    }
    return null;
  }

  function restoreFocus(captured: FocusCapture) {
    if (!captured) return;
    const selector =
      captured.kind === 'hotspot'
        ? `[data-hotspot-id="${CSS.escape(captured.hotspotId)}"]`
        : `[data-view-id="${CSS.escape(captured.viewId)}"]`;
    hotspotsLayer!.querySelector<HTMLButtonElement>(selector)?.focus();
  }

  /** F1.1/F1.3b/F3.2: an open panel is only valid while its gag still has a
   * hotspot in the just-rebuilt view. If it does, repoint B4's return-focus
   * target at the new button (the old one was just detached). If it
   * doesn't, the panel is describing something no longer on screen (R-04a)
   * — close it, first repointing return-focus at the slider so a visitor
   * who had the panel focused doesn't land on <body> (R-24).
   * D-042a: a render that only changes the view (stepper, tab, whole floor)
   * leaves the band and state the panel describes untouched, so the panel
   * stays; Escape then returns to the hotspot if the close-up now shown has
   * it, else to the stepper's whole-floor control. */
  function syncOpenPanel(viewOnly: boolean) {
    if (!panel.isOpen() || !openPanelGagId) return;
    const button = hotspotsLayer!.querySelector<HTMLButtonElement>(
      `[data-gag-id="${CSS.escape(openPanelGagId)}"]`
    );
    if (button) {
      panel.setReturnFocusTo(button);
    } else if (viewOnly) {
      panel.setReturnFocusTo(floorButton);
    } else {
      panel.setReturnFocusTo(slider.input);
      panel.close();
      openPanelGagId = null;
    }
  }

  /** The room's "zoom in" targets: each close-up's `rect`, from the same array the stepper walks. */
  function toZoomLayout(scene: SceneFile, room: SceneView): ZoomLayout {
    return {
      bufferW: room.size.w,
      bufferH: room.size.h,
      targets: closeupsOf(scene, room.id).flatMap((c) =>
        c.rect ? [{ viewId: c.id, label: c.label, ...c.rect }] : []
      ),
    };
  }

  function renderMissingScene() {
    sizeAndPositionCanvas({
      size: MISSING_SCENE_SIZE,
      focus: { x: 0, y: 0, ...MISSING_SCENE_SIZE },
    } as SceneView);
    const ctx = canvas!.getContext('2d');
    if (ctx) {
      const scaleX = canvas!.width / MISSING_SCENE_SIZE.w;
      ctx.setTransform(scaleX, 0, 0, scaleX, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#eafbff';
      ctx.fillRect(0, 0, MISSING_SCENE_SIZE.w, MISSING_SCENE_SIZE.h);
      ctx.fillStyle = '#1a1410';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('not drawn yet', MISSING_SCENE_SIZE.w / 2, MISSING_SCENE_SIZE.h / 2);
    }
    viewsRow!.replaceChildren();
    hotspotsLayer!.replaceChildren();
    currentScene = null;
    stepperLabel!.textContent = '';
    for (const button of [prevButton!, nextButton!, floorButton!]) button.setAttribute('aria-disabled', 'true');
  }

  async function render() {
    const token = (renderToken += 1);
    // DIA-13: captured before anything below touches the DOM — the layers
    // that are about to be rebuilt are exactly the ones that can hold focus.
    const focusCapture = captureFocus();
    let scene: SceneFile | null = null;
    try {
      scene = await loadScene(band, state);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`no scene file for band ${band}/${state} yet`, err);
    }
    if (token !== renderToken) return; // superseded — drop this stale scene fetch too

    if (!scene) {
      renderMissingScene();
      checklist.render(band);
      document.body.dataset.renderedToken = String(token);
      document.body.dataset.band = String(band);
      document.body.dataset.view = '';
      document.body.dataset.room = '';
      return;
    }

    // Toggle and re-render keep the current view id (both states share the
    // skeleton, D-042a); a slider change reset it to null; a missing id
    // falls back to the band's default close-up.
    const view = (currentViewId && findView(scene, currentViewId)) || defaultView(scene);
    currentViewId = view.id;
    currentScene = scene;
    syncTabs(scene, roomOf(scene, view)?.id);
    syncStepper(scene, view);
    sizeAndPositionCanvas(view);
    await renderScene(canvas!, view, state);
    if (token !== renderToken) return; // superseded by a newer render — drop this stale paint
    if (view.kind === 'room') {
      renderZoomTargets(hotspotsLayer!, toZoomLayout(scene, view), (viewId) =>
        selectView(viewId, { focus: { kind: 'floor' } })
      );
    } else {
      renderHotspots(hotspotsLayer!, toSceneLayout(view), openPanel);
    }
    restoreFocus(focusCapture);
    const paintKey = `${band}/${state}`;
    syncOpenPanel(paintKey === lastPaintKey);
    lastPaintKey = paintKey;
    if (pendingFocus) {
      // Looked up now, in the freshly built layer — a zoom-in button the
      // visitor just activated no longer exists, and a held reference
      // would silently drop focus to <body>.
      const target =
        pendingFocus.kind === 'zoomOf'
          ? hotspotsLayer!.querySelector<HTMLButtonElement>(`[data-view-id="${CSS.escape(pendingFocus.viewId)}"]`)
          : null;
      (target ?? floorButton!).focus();
      pendingFocus = null;
    }
    if (pendingAnnounce !== null) {
      liveRegion!.textContent = pendingAnnounce;
      pendingAnnounce = null;
    }
    checklist.render(band);
    // Test hooks: tests/scene.spec.ts and the pixel-parity spec await
    // renderedToken changing instead of sleeping a fixed timeout, and
    // only ever see a render that actually committed (not a stale,
    // dropped one).
    document.body.dataset.renderedToken = String(token);
    document.body.dataset.band = String(band);
    document.body.dataset.view = view.id;
    document.body.dataset.room = roomOf(scene, view)?.id ?? '';
  }

  slider.onChange((newBand) => {
    const wasBeyond = band === 'beyond';
    band = newBand;
    currentViewId = null; // a new band picks its own default view
    roomFromId = null;
    pendingFocus = null;
    pendingAnnounce = null;
    if (!hasMovedSlider) {
      hasMovedSlider = true;
      toggle.showNudge(); // R-06a: the static nudge, once, after the first slider move.
    }
    if (band === 'beyond') {
      // R-01b: the Beyond band opens its panel automatically. B4: it must
      // not steal focus off the slider at its last stop, and Escape
      // should return focus there too. Not hotspot-sourced, so it is never
      // syncOpenPanel()'s concern (DIA-13).
      openPanelGagId = null;
      panel.open(beyondPanelFields(), 'without', { focus: false, returnFocusTo: slider.input });
    } else if (wasBeyond) {
      // F5 (DIA-12): the auto-opened Beyond panel is only ever true for
      // the 'beyond' band — leaving it must close the panel rather than
      // let it keep announcing '1,000+' over whatever band is now
      // rendered (R-04a self-identifying panels, R-14 text/visual sync).
      openPanelGagId = null;
      panel.close();
    }
    void render();
  });

  toggle.onChange((newState) => {
    state = newState;
    toggle.hideNudge(); // m2: the nudge's only job was getting them to toggle once.
    void render();
  });

  // F2.2 (DIA-14): unthrottled, resize fired one full render per event — a
  // phone scroll collapsing the address bar or a desktop window drag can
  // produce dozens in a row (R-23). Debounce to one render per burst: each
  // event resets the timer, so render() only runs once the resizing has
  // actually stopped, and the eventual call still picks up whatever the
  // final size is.
  let resizeDebounce: ReturnType<typeof setTimeout> | undefined;
  window.addEventListener('resize', () => {
    clearTimeout(resizeDebounce);
    resizeDebounce = setTimeout(() => void render(), 150);
  });

  // Sanity: every band this build knows about must exist in content.json
  // (defensive — content.json is generated and validated at build time,
  // but a stale dev cache shouldn't silently render an empty scene).
  if (getBands().length === 0) {
    // eslint-disable-next-line no-console
    console.error('content.json has no bands — run `npm run build` first.');
  }

  void render();
}
