// PH1-04: wires the slider, toggle, canvas scene, hotspots, panel and
// checklist together. Each piece is a separate module under src/scene and
// src/ui; this file only owns the glue — state (band, toggle state) and
// re-render calls.
import { getBands } from './content';
import type { BandId } from './content';
import { chooseScale, renderScene } from './scene/assembler';
import { BUFFER_H, BUFFER_W, computeLayout } from './scene/layout';
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

  // S1: slider and toggle markup already lives in index.html's static
  // shell (CLS) — these fill it in rather than creating/appending it.
  const slider = createSlider(sliderRoot, band);
  const toggle = createToggle(toggleRoot, state);

  const panel = createPanel();
  panelRoot.append(panel.root);

  const checklist = createChecklist();
  checklistRoot.append(checklist.root);

  // S6: G3.A's ambient hover on the *whole* scene was noise (a tooltip on
  // every hover anywhere on the canvas) for a Phase-3, optional (R-13)
  // gag with no sprite of its own yet. Removed until a window sprite
  // exists to hang the hover on specifically.

  function sizeCanvas() {
    const scale = chooseScale(window.innerWidth, BUFFER_W);
    canvas!.width = BUFFER_W * scale;
    canvas!.height = BUFFER_H * scale;
    canvas!.style.width = `${BUFFER_W * scale}px`;
    canvas!.style.height = `${BUFFER_H * scale}px`;
    hotspotsLayer!.style.width = `${BUFFER_W * scale}px`;
    hotspotsLayer!.style.height = `${BUFFER_H * scale}px`;
  }

  function openPanel(gagId: string, source: HTMLElement) {
    const fields = panelFieldsFor(gagId);
    if (!fields) return;
    // R-04: the prevented-beat thumbnail is always the without-state
    // scene. B4: closing returns focus to the hotspot that opened it.
    panel.open(fields, 'without', { returnFocusTo: source });
  }

  // S5: render() is async (renderScene awaits sprite loads) and isn't
  // otherwise serialised — a fast slider drag can start a second render
  // before the first's paint lands, interleaving two states on the
  // canvas. Each call takes a token; if a newer render started before
  // this one's await resolves, its paint is stale and gets dropped.
  let renderToken = 0;

  async function render() {
    const token = (renderToken += 1);
    sizeCanvas();
    const layout = computeLayout(band, state);
    await renderScene(canvas!, layout);
    if (token !== renderToken) return; // superseded by a newer render — drop this stale paint
    renderHotspots(hotspotsLayer!, layout, openPanel);
    checklist.render(band);
    // Test hooks: tests/scene.spec.ts awaits renderedToken changing
    // instead of sleeping a fixed timeout, and only ever sees a render
    // that actually committed (not a stale, dropped one). `band` lets a
    // test tell "nothing changed, no render was needed" apart from "a
    // render should have happened but didn't".
    document.body.dataset.renderedToken = String(token);
    document.body.dataset.band = String(band);
  }

  slider.onChange((newBand) => {
    band = newBand;
    if (!hasMovedSlider) {
      hasMovedSlider = true;
      toggle.showNudge(); // R-06a: the static nudge, once, after the first slider move.
    }
    if (band === 'beyond') {
      // R-01b: the Beyond band opens its panel automatically. B4: it must
      // not steal focus off the slider at its last stop, and Escape
      // should return focus there too.
      panel.open(beyondPanelFields(), 'without', { focus: false, returnFocusTo: slider.input });
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
