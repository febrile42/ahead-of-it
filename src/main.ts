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
import type { CanvasBox } from './ui/panel';
import { beyondPanelFields, createPanel, panelFieldsFor, renderHotspots, renderZoomTargets } from './ui/panel';
import { ui } from './ui/strings';
import type { SceneState } from './ui/toggle';
import { createSlider } from './ui/slider';
import { createToggle } from './ui/toggle';
import { motionGate } from './motion';
import { parseInitialSceneState } from './url-state';
import { motionChanged, resolveViewAt } from './scene/motion-playback';
import type { ResolvedFrame } from './scene/motion-playback';
import { loadManifest } from './scene/sprites';
import type { SpriteManifest } from './scene/sprites';
import './style.css';

const sliderRoot = document.querySelector<HTMLDivElement>('#slider-root');
const toggleRoot = document.querySelector<HTMLDivElement>('#toggle-root');
const viewsRow = document.querySelector<HTMLDivElement>('#scene-views');
const sceneWrap = document.querySelector<HTMLDivElement>('#scene-wrap');
const stepper = document.querySelector<HTMLDivElement>('#scene-stepper');
let canvas = document.querySelector<HTMLCanvasElement>('#scene-canvas');
const hotspotsLayer = document.querySelector<HTMLDivElement>('#hotspots-layer');
const panelRoot = document.querySelector<HTMLDivElement>('#panel-root');
const checklistRoot = document.querySelector<HTMLDivElement>('#checklist-root');

if (sliderRoot && toggleRoot && viewsRow && sceneWrap && stepper && canvas && hotspotsLayer && panelRoot && checklistRoot) {
  // D-043: R-10's read side, pulled forward so a Lighthouse navigation can
  // land on any band (not just 80) — `?n=<headcount>&it=<none|built>`.
  // Nothing writes the URL; a missing/invalid value falls back per-param.
  const initial = parseInitialSceneState(window.location.search);
  let band: BandId = initial.band;
  let state: SceneState = initial.state;
  let hasMovedSlider = false;
  // R-06a/m2: the nudge's only job is getting the visitor to toggle once —
  // once they have (in either direction), it is spent for the session,
  // independent of whether it was ever shown (DIA-11/DIA-17).
  let nudgeSpent = false;
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

  // PH2-01 Part B (SCENE-FORMAT § Motion): `t` is ms since the current scene
  // file was first painted — real elapsed time, so pausing/resuming the
  // ticker (below) never needs to "catch up" a backlog, it just resumes
  // computing from `performance.now() - sceneStartTime`. Reset only by the
  // toggle and the slider (a new scene file); a view-only render (tab,
  // stepper, resize) leaves it running, so zooming in shows the same moment.
  let sceneStartTime = performance.now();
  // Test hook (tests/motion-playback.spec.ts): lets a spec confirm the
  // toggle/slider actually reset t to 0 for the new scene, without reaching
  // into a closure Playwright can't see.
  document.body.dataset.sceneStartTime = String(sceneStartTime);
  // True for the span of an in-flight render() (including its awaits) — the
  // ticker skips a tick's canvas repaint while this holds, so a tick and a
  // full render() (which also paints the canvas, mid-DOM-rebuild) can never
  // write to the same canvas concurrently.
  let renderInFlight = false;
  // Review fix R2 (DIA-100 PR #48): bumped every time render() or the
  // reduced-motion rest pose is about to paint the canvas — either one
  // supersedes any older canvas paint still resolving its images (a tick's,
  // or another of these). renderScene checks this (via the `isStale`
  // closure each caller below builds) *after* its images resolve and
  // *before* it draws, so a paint that started before a newer authoritative
  // one can never land after it and stomp it — `tickRepaintInFlight`
  // (below) only serialises ticks against each other, not against these.
  let paintGeneration = 0;
  // The last resolution the ticker actually repainted for, so it can tell
  // "nothing visible changed" apart from "something did" (motionChanged).
  // Reset whenever a full render() commits, since that already repainted
  // the (possibly new) current view at its own `t`.
  let previousResolved: (ResolvedFrame | null)[] | null = null;

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

  /** Room tabs, one line, one per room. Persistent within a band when the labels don't change (so a click, an arrow key or the toggle keeps focus); rebuilt — as brand-new nodes, never resized in place — when a different band brings different rooms *or* the same rooms with a different close-up count (DIA-65: two bands can share a room id but not its label text, and a `flex: 0 0 auto` button that changes width in place shifts every tab after it). */
  function syncTabs(scene: SceneFile, activeRoomId: string | undefined) {
    const roomList = rooms(scene);
    const labels = roomList.map((room) => ui('roomTab', { room: room.label, count: primaryCount(closeupsOf(scene, room.id)) }));
    const existing = Array.from(viewsRow!.querySelectorAll<HTMLButtonElement>('.scene-views__button'));
    const needsRebuild =
      existing.length !== roomList.length ||
      existing.some((b, i) => b.dataset.viewId !== roomList[i].id || b.textContent !== labels[i]);
    if (needsRebuild) {
      viewsRow!.replaceChildren(...roomList.map((room) => makeTab(room.id)));
    }
    const tabs = Array.from(viewsRow!.querySelectorAll<HTMLButtonElement>('.scene-views__button'));
    for (const [i, room] of roomList.entries()) {
      const tab = tabs[i];
      const count = primaryCount(closeupsOf(scene, room.id));
      const selected = room.id === activeRoomId;
      tab.textContent = labels[i];
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

  /** Sizes the canvas in device pixels per SCENE-FORMAT's two-axis
   * `s = max(1, min(floor(cssAvailW*dpr/nativeW),
   * floor(cssAvailH*dpr/nativeH)))` (fix round item 7 / review fix 4 —
   * scaling on width alone could grow a view taller than `.scene-wrap`'s
   * own box and force an internal vertical scroll), scrolls to the
   * view's `focus` rect (with the "scroll for more" hint) when the view
   * is wider than what fits, and centres the canvas horizontally when it
   * isn't. Returns the canvas's own box (in css px, relative to
   * `.scene-wrap`) so the caller can place hotspot buttons over it —
   * DIA-65: `#hotspots-layer` itself is never resized or repositioned
   * (see `.hotspots-layer` in style.css: it permanently spans all of
   * `.scene-wrap`, which is the one thing D-042a already keeps constant
   * across every view/band/state). A real Chromium run confirmed that
   * resizing an *existing* element — even one whose top-left never moves —
   * still scores as a layout shift; only a box that never changes at all
   * scores zero. Moving the size/offset math from the layer's own CSS box
   * into each hotspot button's pixel position (panel.ts's `CanvasBox`
   * parameter) keeps the layer's box permanently invariant instead.
   *
   * The canvas itself can't take the same "never changes" trick — its box
   * genuinely needs to be a different size for a room vs. a close-up — so
   * a live #scene-canvas would still register the resize as a shift even
   * with the centring math removed. A browser's layout-shift tracking only
   * ever diffs a node against *its own* previous frame, so it never charges
   * a freshly-inserted node (nothing to diff against, DIA-65). Swapping in
   * a brand-new canvas already sized and positioned correctly — instead of
   * mutating the live one in place — sidesteps the resize entirely. */
  function sizeAndPositionCanvas(view: SceneView): CanvasBox {
    const dpr = window.devicePixelRatio || 1;
    const cssAvailW = sceneWrap!.clientWidth || window.innerWidth;
    const cssAvailH = sceneWrap!.clientHeight || 240;
    const scale = chooseScale(cssAvailW, cssAvailH, view.size.w, view.size.h, dpr);
    const backingW = view.size.w * scale;
    const backingH = view.size.h * scale;
    const cssW = backingW / dpr;
    const cssH = backingH / dpr;
    const fresh = document.createElement('canvas');
    fresh.id = canvas!.id;
    canvas!.replaceWith(fresh);
    canvas = fresh;
    canvas.width = backingW;
    canvas.height = backingH;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
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
      return { left: 0, top: 0, width: cssW, height: cssH };
    }
    sceneWrap!.scrollLeft = 0;
    sceneWrap!.scrollTop = 0;
    // Centre horizontally when the view is narrower than the wrap (review
    // fix 4) — the offset is now baked into each hotspot button's own left
    // (panel.ts), not into a shared layer position, so canvas and hotspots
    // stay aligned without either one moving as a DOM node.
    const offsetLeft = Math.max(0, (cssAvailW - cssW) / 2);
    canvas!.style.marginLeft = `${offsetLeft}px`;
    return { left: offsetLeft, top: 0, width: cssW, height: cssH };
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
  // the freshly rebuilt layer and focuses that instead. DIA-26/F6: a room
  // tab in #scene-views is rebuilt by syncTabs() the same way and is
  // covered too — Safari doesn't focus a range input on drag (R-20), so a
  // tab-focused visitor who drags the slider into a different band's room
  // list would otherwise lose focus to <body>.
  type FocusCapture =
    | { kind: 'hotspot'; hotspotId: string }
    | { kind: 'zoom'; viewId: string }
    | { kind: 'tab'; viewId: string }
    | null;

  function captureFocus(): FocusCapture {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return null;
    if (hotspotsLayer!.contains(active)) {
      const { hotspotId, viewId } = active.dataset;
      if (hotspotId) return { kind: 'hotspot', hotspotId };
      return viewId ? { kind: 'zoom', viewId } : null;
    }
    if (viewsRow!.contains(active) && active.dataset.viewId) {
      return { kind: 'tab', viewId: active.dataset.viewId };
    }
    return null;
  }

  function restoreFocus(captured: FocusCapture) {
    if (!captured) return;
    if (captured.kind === 'tab') {
      const tabs = Array.from(viewsRow!.querySelectorAll<HTMLButtonElement>('.scene-views__button'));
      const same = tabs.find((t) => t.dataset.viewId === captured.viewId);
      const selected = tabs.find((t) => t.getAttribute('aria-selected') === 'true');
      (same ?? selected ?? slider.input).focus();
      return;
    }
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
    renderInFlight = true;
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
    if (token !== renderToken) return; // superseded — drop this stale scene fetch too; the newer render owns renderInFlight now

    if (!scene) {
      renderMissingScene();
      checklist.render(band);
      document.body.dataset.renderedToken = String(token);
      document.body.dataset.band = String(band);
      document.body.dataset.view = '';
      document.body.dataset.room = '';
      renderInFlight = false;
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
    const canvasBox = sizeAndPositionCanvas(view);
    // SCENE-FORMAT § Motion "rest pose = today's export": motion off
    // (reduced-motion, or the tab currently hidden) paints the rest pose,
    // same as a painter with no motion support — every pixel-parity golden
    // stays valid. Otherwise this paints the *current* moment, not t = 0, so
    // a tab/stepper/resize render never jumps the animation backwards.
    const activeT = motion.isReduced() || document.hidden ? undefined : performance.now() - sceneStartTime;
    const myGeneration = (paintGeneration += 1);
    // N1: an unknown-frame throw from renderScene (a bad scene/manifest
    // reference) must still clear renderInFlight, or the ticker skips every
    // repaint for the rest of the session. try/finally, not a plain catch,
    // so the stale-render early-returns below (which deliberately leave
    // renderInFlight for the newer render to own) are unaffected — only an
    // actual throw takes this path.
    let threw = true;
    try {
      await renderScene(canvas!, view, state, activeT, () => paintGeneration !== myGeneration);
      threw = false;
    } finally {
      if (threw) renderInFlight = false;
    }
    if (token !== renderToken) return; // superseded by a newer render — drop this stale paint; the newer render owns renderInFlight now
    // A fresh baseline for the ticker, matching whatever view/t this commit
    // just painted — otherwise the next tick would compare against a
    // previous view's resolutions (wrong indices) or repaint a frame
    // identical to what's already on screen.
    previousResolved = null;
    renderInFlight = false;
    if (view.kind === 'room') {
      renderZoomTargets(hotspotsLayer!, toZoomLayout(scene, view), canvasBox, (viewId) =>
        selectView(viewId, { focus: { kind: 'floor' } })
      );
    } else {
      renderHotspots(hotspotsLayer!, toSceneLayout(view), canvasBox, openPanel);
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
    // A committed paint is the only thing that can make the ticker's
    // "should it run" answer change (a new scene loaded, or a still-missing
    // one) — pick that back up here rather than duplicating the condition
    // at every call site that triggers a render.
    ensureTickerRunning();
  }

  slider.onChange((newBand) => {
    const wasBeyond = band === 'beyond';
    band = newBand;
    currentViewId = null; // a new band picks its own default view
    roomFromId = null;
    pendingFocus = null;
    pendingAnnounce = null;
    // PH2-01 Part B: the slider picks a new scene file — reset t to 0 for it
    // (SCENE-FORMAT § Motion). Done here, synchronously with the change,
    // not inside the async render() that follows. N2 (review, PR #48): the
    // spec's "since first painted" is technically a few ms later than this
    // (render()'s scene fetch + image loads haven't happened yet) — harmless
    // at today's fetch latency, since every entry's own `motion.start` is
    // already staggered well past it, but noted in case that ever changes.
    sceneStartTime = performance.now();
    document.body.dataset.sceneStartTime = String(sceneStartTime);
    previousResolved = null;
    if (!hasMovedSlider) {
      hasMovedSlider = true;
      if (!nudgeSpent) {
        toggle.showNudge(); // R-06a: the static nudge, once, after the first slider move.
      }
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
    nudgeSpent = true; // DIA-17: latch on the first toggle, shown or not (R-06a: once per session).
    toggle.hideNudge(); // m2: the nudge's only job was getting them to toggle once.
    // PH2-01 Part B: the toggle picks a new scene file — reset t to 0 for it.
    sceneStartTime = performance.now();
    document.body.dataset.sceneStartTime = String(sceneStartTime);
    previousResolved = null;
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

  // PH2-02 (R-24): the one gate every moving thing on the page reads before
  // it moves — its state is exposed on the body, alongside the
  // render-token/band/view/room hooks above, so a runtime OS-preference
  // flip is observable without a reload.
  const motion = motionGate();
  document.body.dataset.reducedMotion = String(motion.isReduced());

  // PH2-01 Part B: one rAF ticker for the whole page (SCENE-FORMAT § Motion
  // "what the painter owns"). It repaints the canvas only, via renderScene —
  // never render() — so a tick can never touch the hotspot layer, the tab
  // row or the panel (the DIA-13 root cause this exists to keep from coming
  // back). Capped at 12 repaints/s, and only when some visible entry's
  // resolved frame or position actually changed.
  const MIN_REPAINT_INTERVAL_MS = 1000 / 12;
  let manifestCache: SpriteManifest | null = null;
  void loadManifest().then((loaded) => {
    manifestCache = loaded;
  });
  // Starts false: the IntersectionObserver below always fires once on
  // `observe()` with the real initial state, so the ticker never assumes
  // it's in view before that callback lands.
  let sceneInView = false;
  let rafHandle: number | null = null;
  let lastRepaintAt = 0;
  let tickRepaintCount = 0;
  // A tick's repaint is async (renderScene awaits loadManifest/image
  // decodes — the first time a given file plays, that's a real, uncached
  // decode). Without this guard two ticks' renderScene calls can overlap
  // and settle out of order, leaving an *earlier* t's frame painted last —
  // the canvas looks frozen even though repaintCount keeps climbing. This
  // serialises tick repaints the same way `renderInFlight` already
  // serialises against a full render().
  let tickRepaintInFlight = false;

  /** Whether the ticker should keep scheduling itself at all — the three
   * hard-stop conditions the brief names (motion off, tab hidden, scene box
   * out of the viewport), plus "no scene loaded yet". Anything else that can
   * momentarily block a repaint (an in-flight render(), the 12/s throttle)
   * is handled inside `tick` itself so the loop keeps running through it. */
  function tickerActive(): boolean {
    return !motion.isReduced() && !document.hidden && sceneInView && currentScene !== null;
  }

  function stopTicker() {
    if (rafHandle !== null) {
      cancelAnimationFrame(rafHandle);
      rafHandle = null;
    }
  }

  function ensureTickerRunning() {
    if (rafHandle === null && tickerActive()) {
      rafHandle = requestAnimationFrame(tick);
    }
  }

  function tick(now: number) {
    rafHandle = null;
    if (!tickerActive()) return; // a hard-stop condition fired; whoever clears it calls ensureTickerRunning() again
    if (
      !renderInFlight &&
      !tickRepaintInFlight &&
      manifestCache &&
      currentScene &&
      currentViewId &&
      now - lastRepaintAt >= MIN_REPAINT_INTERVAL_MS
    ) {
      const view = findView(currentScene, currentViewId);
      if (view) {
        const t = now - sceneStartTime;
        const resolved = resolveViewAt(view, manifestCache, t);
        if (motionChanged(resolved, previousResolved)) {
          previousResolved = resolved;
          lastRepaintAt = now;
          tickRepaintCount += 1;
          // Test hook (tests/motion-playback.spec.ts): a repaint the ticker
          // itself made, distinct from render()'s own renderedToken stamp.
          document.body.dataset.repaintCount = String(tickRepaintCount);
          tickRepaintInFlight = true;
          const myGeneration = paintGeneration;
          void renderScene(canvas!, view, state, t, () => paintGeneration !== myGeneration)
            .then((painted) => {
              // N3: a render() or the reduced-motion rest pose started (and
              // painted) while this tick's images were still resolving —
              // renderScene dropped this tick's paint as stale, so the
              // baseline above is for a frame that never actually landed on
              // screen. Clear it so the *next* tick compares against
              // whatever really is on screen (previousResolved === null
              // always repaints, per motionChanged) instead of concluding
              // "nothing changed" against a resolution nobody drew.
              if (!painted) previousResolved = null;
            })
            .finally(() => {
              tickRepaintInFlight = false;
            });
        }
      }
    }
    rafHandle = requestAnimationFrame(tick);
  }

  // The scene box's own viewport intersection — `.scene-wrap` (never
  // replaced, unlike #scene-canvas, so it's a stable node to observe).
  new IntersectionObserver(
    (observed) => {
      sceneInView = observed[observed.length - 1]?.isIntersecting ?? false;
      if (sceneInView) ensureTickerRunning();
      else stopTicker();
    },
    { threshold: 0 }
  ).observe(sceneWrap);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopTicker();
    else ensureTickerRunning();
  });

  motion.subscribe((reduced) => {
    document.body.dataset.reducedMotion = String(reduced);
    if (reduced) {
      stopTicker();
      previousResolved = null;
      // SCENE-FORMAT § Motion: "motion off" must show the rest pose
      // immediately, not whatever frame the ticker last painted — a canvas
      // repaint only (never render()), so this never touches focus/DOM.
      // Review fix R2: bump paintGeneration *before* calling renderScene so
      // a tick's paint that was already resolving its images when reduced
      // motion fired can't land after this rest pose and undo it —
      // stopTicker() only stops scheduling the *next* tick, it doesn't
      // cancel one already in flight.
      if (currentScene && currentViewId) {
        const view = findView(currentScene, currentViewId);
        if (view) {
          const myGeneration = (paintGeneration += 1);
          void renderScene(canvas!, view, state, undefined, () => paintGeneration !== myGeneration);
        }
      }
    } else {
      ensureTickerRunning();
    }
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
