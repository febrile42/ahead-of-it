// PH1-04: wires the slider, toggle, canvas scene, hotspots, panel and
// checklist together. Each piece is a separate module under src/scene and
// src/ui; this file only owns the glue — state (band, toggle state) and
// re-render calls.
import { getAmbientHover, getBands } from './content';
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

  const slider = createSlider(band);
  sliderRoot.append(slider.root);

  const toggle = createToggle(state);
  toggleRoot.append(toggle.root);

  const panel = createPanel();
  panelRoot.append(panel.root);

  const checklist = createChecklist();
  checklistRoot.append(checklist.root);

  // G3.A, the ambient 3:47am window (R-13, Phase 3) — hover text only, no
  // panel, exactly as BANDS-AND-GAGS.md specifies. Attached to the scene
  // wrapper itself since there is no dedicated sprite for it yet.
  sceneWrap.title = getAmbientHover();

  function sizeCanvas() {
    const scale = chooseScale(window.innerWidth, BUFFER_W);
    canvas!.width = BUFFER_W * scale;
    canvas!.height = BUFFER_H * scale;
    canvas!.style.width = `${BUFFER_W * scale}px`;
    canvas!.style.height = `${BUFFER_H * scale}px`;
    hotspotsLayer!.style.width = `${BUFFER_W * scale}px`;
    hotspotsLayer!.style.height = `${BUFFER_H * scale}px`;
  }

  function openPanel(gagId: string) {
    const fields = panelFieldsFor(gagId);
    if (!fields) return;
    panel.open(fields, 'without'); // R-04: the prevented-beat thumbnail is always the without-state scene
  }

  async function render() {
    sizeCanvas();
    const layout = computeLayout(band, state);
    await renderScene(canvas!, layout);
    renderHotspots(hotspotsLayer!, layout, openPanel);
    checklist.render(band);
  }

  slider.onChange((newBand) => {
    band = newBand;
    if (!hasMovedSlider) {
      hasMovedSlider = true;
      toggle.showNudge(); // R-06a: the static nudge, once, after the first slider move.
    }
    if (band === 'beyond') {
      // R-01b: the Beyond band opens its panel automatically.
      panel.open(beyondPanelFields(), 'without');
    }
    void render();
  });

  toggle.onChange((newState) => {
    state = newState;
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
