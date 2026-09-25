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
import { getBands } from './content';
import type { BandId } from './content';
import { chooseScale, renderScene } from './scene/assembler';
import type { Hotspot, SceneLayout } from './scene/layout';
import { defaultView, findView, loadScene } from './scene/scene';
import type { SceneFile, SceneView } from './scene/scene';
import { createChecklist } from './ui/checklist';
import { beyondPanelFields, createPanel, panelFieldsFor, renderHotspots } from './ui/panel';
import type { SceneState } from './ui/toggle';
import { createSlider } from './ui/slider';
import { createToggle } from './ui/toggle';
import './style.css';

const sliderRoot = document.querySelector<HTMLDivElement>('#slider-root');
const toggleRoot = document.querySelector<HTMLDivElement>('#toggle-root');
const sceneWrap = document.querySelector<HTMLDivElement>('#scene-wrap');
const canvas = document.querySelector<HTMLCanvasElement>('#scene-canvas');
const hotspotsLayer = document.querySelector<HTMLDivElement>('#hotspots-layer');
const panelRoot = document.querySelector<HTMLDivElement>('#panel-root');
const checklistRoot = document.querySelector<HTMLDivElement>('#checklist-root');

if (sliderRoot && toggleRoot && sceneWrap && canvas && hotspotsLayer && panelRoot && checklistRoot) {
  let band: BandId = 80;
  let state: SceneState = 'built';
  let hasMovedSlider = false;
  let currentViewId: string | null = null;

  // S1: slider and toggle markup already lives in index.html's static
  // shell (CLS) — these fill it in rather than creating/appending it.
  const slider = createSlider(sliderRoot, band);
  const toggle = createToggle(toggleRoot, state);

  const panel = createPanel();
  panelRoot.append(panel.root);

  const checklist = createChecklist();
  checklistRoot.append(checklist.root);

  // PH1-09: the view switcher (D-036 — a tab row, one per view) and the
  // "scroll for more" hint (SCENE-FORMAT: views wider than the viewport
  // scroll to `focus`) aren't in index.html's static shell — they don't
  // exist until a scene file says how many views there are. Both are
  // inserted synchronously here, before any `await`, so they land in the
  // same frame as everything else the static shell already reserves
  // (S1) rather than shifting anything in on a later tick.
  const viewsRow = document.createElement('div');
  viewsRow.className = 'scene-views';
  viewsRow.setAttribute('role', 'tablist');
  viewsRow.setAttribute('aria-label', 'Building view');
  sceneWrap.before(viewsRow);

  const scrollHint = document.createElement('p');
  scrollHint.className = 'scene-scroll-hint';
  scrollHint.textContent = 'Scroll to see the rest →';
  sceneWrap.after(scrollHint);

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

  function renderViewSwitcher(scene: SceneFile, active: SceneView) {
    viewsRow.replaceChildren();
    // Always shown, even for a single-view scene (band 80 has exactly
    // one — SCENE-FORMAT) — a one-tab row is harmless and keeps the
    // switcher's reserved height constant across bands (see .scene-views
    // in style.css), so switching bands never trips CLS on this row.
    for (const view of scene.views) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'scene-views__button';
      button.setAttribute('role', 'tab');
      button.dataset.viewId = view.id;
      button.setAttribute('aria-selected', String(view.id === active.id));
      button.tabIndex = view.id === active.id ? 0 : -1;
      const count = view.hotspots.filter((h) => h.primary).length;
      button.textContent = `${view.label} (${count})`;
      button.addEventListener('click', () => {
        if (view.id === currentViewId) return;
        currentViewId = view.id;
        void render();
      });
      viewsRow.append(button);
    }
    // Roving-tabindex arrow-key navigation across the tab row (standard
    // tablist keyboard pattern): Left/Right move focus and switch views
    // without leaving the switcher.
    viewsRow.onkeydown = (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      const buttons = Array.from(viewsRow.querySelectorAll<HTMLButtonElement>('.scene-views__button'));
      const from = buttons.findIndex((b) => b.dataset.viewId === currentViewId);
      if (from === -1) return;
      event.preventDefault();
      const delta = event.key === 'ArrowRight' ? 1 : -1;
      const to = (from + delta + buttons.length) % buttons.length;
      currentViewId = buttons[to].dataset.viewId ?? null;
      void render().then(() => {
        viewsRow.querySelector<HTMLButtonElement>(`[data-view-id="${CSS.escape(String(currentViewId))}"]`)?.focus();
      });
    };
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
    // CLS: .scene-wrap's aspect-ratio (style.css) stays fixed at D-036's
    // worst case, 360/240 — the widest/tallest any view can ever be — for
    // the life of the page, rather than being narrowed to each loaded
    // view's own ratio. A view smaller than that leaves empty space
    // instead of shrinking the box, which is what keeps this element's
    // contribution to CLS at zero after the first paint (deliberately
    // over reserving over the alternative of a later shift).

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
    viewsRow.replaceChildren();
    hotspotsLayer!.replaceChildren();
  }

  async function render() {
    const token = (renderToken += 1);
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
      return;
    }

    const view = (currentViewId && findView(scene, currentViewId)) || defaultView(scene);
    currentViewId = view.id;
    renderViewSwitcher(scene, view);
    sizeAndPositionCanvas(view);
    await renderScene(canvas!, view, state);
    if (token !== renderToken) return; // superseded by a newer render — drop this stale paint
    renderHotspots(hotspotsLayer!, toSceneLayout(view), openPanel);
    checklist.render(band);
    // Test hooks: tests/scene.spec.ts and the pixel-parity spec await
    // renderedToken changing instead of sleeping a fixed timeout, and
    // only ever see a render that actually committed (not a stale,
    // dropped one).
    document.body.dataset.renderedToken = String(token);
    document.body.dataset.band = String(band);
    document.body.dataset.view = view.id;
  }

  slider.onChange((newBand) => {
    const wasBeyond = band === 'beyond';
    band = newBand;
    currentViewId = null; // a new band picks its own default view
    if (!hasMovedSlider) {
      hasMovedSlider = true;
      toggle.showNudge(); // R-06a: the static nudge, once, after the first slider move.
    }
    if (band === 'beyond') {
      // R-01b: the Beyond band opens its panel automatically. B4: it must
      // not steal focus off the slider at its last stop, and Escape
      // should return focus there too.
      panel.open(beyondPanelFields(), 'without', { focus: false, returnFocusTo: slider.input });
    } else if (wasBeyond) {
      // F5 (DIA-12): the auto-opened Beyond panel is only ever true for
      // the 'beyond' band — leaving it must close the panel rather than
      // let it keep announcing '1,000+' over whatever band is now
      // rendered (R-04a self-identifying panels, R-14 text/visual sync).
      panel.close();
    }
    void render();
  });

  toggle.onChange((newState) => {
    state = newState;
    toggle.hideNudge(); // m2: the nudge's only job was getting them to toggle once.
    void render();
  });

  window.addEventListener('resize', () => {
    void render();
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
