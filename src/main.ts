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
  openingView,
  primaryCount,
  roomOf,
  rooms,
} from './scene/scene';
import type { SceneFile, SceneView } from './scene/scene';
import { bandIndex } from './scene/bands';
import { createChecklist, gagsThroughBand } from './ui/checklist';
import type { CanvasBox } from './ui/panel';
import { beyondPanelFields, createPanel, panelFieldsFor, renderHotspots, renderZoomTargets } from './ui/panel';
import { ui } from './ui/strings';
import type { SceneState } from './ui/toggle';
import { createSlider } from './ui/slider';
import { createToggle } from './ui/toggle';
import { motionGate } from './motion';
import { LIST_HASH, panelHash, parseInitialSceneState, sceneSearchParams } from './url-state';
import { motionChanged, resolveViewAt } from './scene/motion-playback';
import type { ResolvedFrame } from './scene/motion-playback';
import { loadManifest } from './scene/sprites';
import type { SpriteManifest } from './scene/sprites';
import './style.css';

const appRoot = document.querySelector<HTMLDivElement>('#app');
const introEl = document.querySelector<HTMLParagraphElement>('#app-intro');
const sliderRoot = document.querySelector<HTMLDivElement>('#slider-root');
const toggleRoot = document.querySelector<HTMLDivElement>('#toggle-root');
const viewsRow = document.querySelector<HTMLDivElement>('#scene-views');
const viewNav = document.querySelector<HTMLDivElement>('#view-nav');
const sceneWrap = document.querySelector<HTMLDivElement>('#scene-wrap');
const stepper = document.querySelector<HTMLDivElement>('#scene-stepper');
let canvas = document.querySelector<HTMLCanvasElement>('#scene-canvas');
const hotspotsLayer = document.querySelector<HTMLDivElement>('#hotspots-layer');
const panelRoot = document.querySelector<HTMLDivElement>('#panel-root');
const checklistRoot = document.querySelector<HTMLDivElement>('#checklist-root');
const punchListButton = document.querySelector<HTMLButtonElement>('#punch-list-button');

if (
  appRoot &&
  introEl &&
  sliderRoot &&
  toggleRoot &&
  viewsRow &&
  viewNav &&
  sceneWrap &&
  stepper &&
  canvas &&
  hotspotsLayer &&
  panelRoot &&
  checklistRoot &&
  punchListButton
) {
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
  let pendingFocus: { kind: 'firstHotspot' } | { kind: 'zoomOf'; viewId: string } | null = null;
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
  // Test hook (tests/band-crossing-moment.spec.ts): whether a band-crossing
  // moment is currently playing.
  document.body.dataset.momentPlaying = 'false';
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

  // PH2-03 (DIA-113): the band the last
  // *committed* render actually painted — distinct from `band` (this
  // render's target, which during a fast drag can race ahead of what has
  // actually finished painting, S5). Comparing against this, not `band`'s
  // previous value, is what makes "starts after the slider settles" true:
  // only the one render that survives the stale-token check as a real
  // commit ever reaches the crossing check below. `null` until the first
  // commit, so first load is never a crossing.
  let lastCommittedBand: BandId | null = null;
  interface ActiveMoment {
    momentView: SceneView;
    ms: number;
    committedAt: number;
  }
  // The band-crossing moment currently playing, if any (SCENE-FORMAT § Band-
  // crossing moment). The ticker paints `momentView.entries` instead of the
  // real view's for `ms` real milliseconds from `committedAt`, then hands
  // back to the view at its own t = 0 (sceneStartTime reset, below).
  let activeMoment: ActiveMoment | null = null;
  // Bands whose moment has already played this session — D-045: once per
  // band per session, in memory only, never written to storage or the URL.
  const playedMomentBands = new Set<string>();

  /** Any input cancels a playing moment "at once, with a cut and no queued
   * remainder" (the brief's rule) — called synchronously from the slider,
   * toggle and panel handlers, and from selectView, before render() (or,
   * for the panel, before anything) runs. Clearing `previousResolved` too
   * means the very next tick treats whatever it paints next as a fresh
   * baseline rather than comparing it against the moment's last frame. */
  function cancelActiveMoment() {
    if (!activeMoment) return;
    activeMoment = null;
    previousResolved = null;
    document.body.dataset.momentPlaying = 'false';
  }

  // D-051/DIA-210: index.html's prerenderIntro Vite plugin already fills
  // this from the same ui('intro') string at build/dev-serve time, so it
  // paints at FCP instead of waiting on this module (CI LHR: this was the
  // #app-intro LCP element's whole render delay). This is only a fallback
  // for a static-shell context the plugin didn't run against — it must
  // never overwrite an already-painted lede with an identical string
  // (that would be a second paint, not a fix).
  if (!introEl.textContent) {
    introEl.textContent = ui('intro');
  }

  // S1: slider and toggle markup already lives in index.html's static
  // shell (CLS) — these fill it in rather than creating/appending it.
  const slider = createSlider(sliderRoot, band, initial.raw);
  const toggle = createToggle(toggleRoot, state);

  const panel = createPanel();
  panelRoot.append(panel.root);

  // U-06 (DIA-194/195): every top-level piece of the page other than the
  // panel itself, so a modal open (≤767px) can make all of it `inert` —
  // unreachable by Tab and hidden from the accessibility tree — leaving
  // only the sheet's own contents behind. `#app`'s own children, not
  // `#app` itself, because `panelRoot` is one of those children too;
  // marking `#app` inert would take the panel down with it.
  const pageContent = Array.from(document.querySelectorAll<HTMLElement>('#app > *')).filter(
    (el) => el !== panelRoot
  );
  panel.onOpen((modal) => {
    for (const el of pageContent) el.inert = modal;
  });
  panel.onClose(() => {
    for (const el of pageContent) el.inert = false;
  });

  // U-05: the hotspot whose panel is currently open, so its reticle draws
  // solid and it announces `aria-expanded="true"` for as long as that's
  // true (DIA-13: the button itself doesn't survive a re-render, so this is
  // repointed by syncOpenPanel below, the same way B4's return-focus target is).
  let selectedHotspotButton: HTMLButtonElement | null = null;
  function setHotspotSelected(button: HTMLButtonElement | null) {
    if (selectedHotspotButton && selectedHotspotButton !== button) {
      selectedHotspotButton.classList.remove('hotspot--selected');
      selectedHotspotButton.setAttribute('aria-expanded', 'false');
    }
    selectedHotspotButton = button;
    if (button) {
      button.classList.add('hotspot--selected');
      button.setAttribute('aria-expanded', 'true');
    }
  }

  panel.onClose(() => setHotspotSelected(null));
  // U-05: undo scrollHotspotAboveSheet's temporary scroll room, whether or
  // not this particular open actually needed it — harmless no-op either way.
  panel.onClose(() => document.body.classList.remove('panel-scroll-space'));

  // DIA-131: the punch-list button's label span lives inside its own
  // static-shell markup (index.html) — checklist.ts writes `Punch list (n)`
  // into it on every render(), from the same count the sheet lists.
  const punchListLabel = punchListButton.querySelector<HTMLSpanElement>('.punch-list-button__label');
  if (!punchListLabel) {
    throw new Error('index.html static shell is missing the punch list button label');
  }
  const checklist = createChecklist(punchListButton, punchListLabel);
  checklistRoot.append(checklist.root);
  // U-11(a) (DIA-194/197): the "Punch list (n)" label is generated from
  // content.json's own gag list, not the scene file, so it does not need to
  // wait on render()'s scene fetch to be correct. Sets *only* the label
  // text here (never blank while a slow load is in flight) — deliberately
  // not `checklist.render(band)`, which builds the list DOM with
  // `loading="lazy"` thumbnails DIA-114 found WebKit fetches all at once if
  // they exist before the page's first layout/paint pass.
  punchListLabel.textContent = `Punch list (${gagsThroughBand(band).length})`;

  // PH3-01 (R-10 write side, U-09 "Back closes an open panel"):
  //
  // - `writeSceneQuery()` keeps `n`/`it` (D-043's own names) current with
  //   `history.replaceState` on every visitor-driven band/state change —
  //   never `pushState`, so dragging through all eight stops and flipping
  //   the toggle twice collapses into the one entry already there
  //   (`history.length` unchanged, brief item 1).
  // - `overlayHash` tracks the one hash entry *we* pushed or replaced for
  //   an open gag panel or the punch-list sheet (`openOverlay`, item 2) —
  //   null when no overlay owns an entry, which is also true for the
  //   auto-opened Beyond panel (slider.onChange below never calls
  //   openOverlay for it): that panel must not grow history at all, or
  //   dragging to 'beyond' would need two Backs to leave, not one.
  // - Closing that overlay any way other than Back (`panel.onClose` /
  //   `checklist.onClose`, which fire for the close button, Escape and the
  //   outside-tap alike, item 4) pops the entry with `history.back()` so
  //   the stack never holds a stale "panel open" entry once the visitor has
  //   already closed it themselves.
  // - A real Back press pops that same entry on its own; the `popstate`
  //   listener below just has to notice the entry is gone and close
  //   whichever overlay is still visibly open (item 3) — through the exact
  //   same `panel.close()`/`checklist.close()` calls Escape already uses,
  //   so focus-return and the live announcement are identical either way.
  //   `consumingOwnBack` tells the two triggers (our own `history.back()`
  //   call vs. a real Back press) apart, so neither one double-acts on the
  //   other's half of the round trip.
  function writeSceneQuery() {
    const query = sceneSearchParams(band, state);
    history.replaceState(history.state, '', `?${query}${window.location.hash}`);
  }

  let overlayHash: string | null = null;
  let consumingOwnBack = false;

  function openOverlay(hash: string) {
    if (overlayHash) {
      history.replaceState(history.state, '', hash); // item 5: switching straight to another overlay replaces, no second push
    } else {
      history.pushState(null, '', hash);
    }
    overlayHash = hash;
  }

  function closeOverlayEntry() {
    if (!overlayHash) return;
    overlayHash = null;
    consumingOwnBack = true;
    history.back();
  }

  panel.onClose(closeOverlayEntry);
  checklist.onClose(closeOverlayEntry);
  checklist.onOpen(() => openOverlay(LIST_HASH)); // item 2/5: same push-or-replace rule as a gag panel

  window.addEventListener('popstate', () => {
    if (consumingOwnBack) {
      consumingOwnBack = false;
      return;
    }
    if (!overlayHash) return; // Back with nothing of ours open — let the browser leave/navigate normally
    overlayHash = null;
    if (panel.isOpen()) panel.close();
    if (checklist.isOpen()) checklist.close();
  });

  // D-056 (DIA-217/U-14): two things at >=1152 that src/style.css's own
  // `@media (min-width: 1152px)` block can't finish on its own — both
  // documented there, restated briefly here:
  //
  // 1. The tap panel and the punch-list sheet dock in the rail under the
  //    toggle instead of the viewport's right edge (CSS sets
  //    `position: fixed; bottom: 0` there — everything but `left`/`top`).
  //    `left` is the rail's own left edge, which #app's `margin: 0 auto`
  //    centring only gives as `(100vw - 1120px) / 2` — a value that
  //    drifts by half a scrollbar's width whenever one is present (the
  //    short-viewport case, D-056 point 5). `top` is the toggle's own
  //    bottom edge, which depends on real rendered text metrics the same
  //    way DIA-83/DIA-65 found "normal" line-height never quite matches a
  //    hand-computed sum.
  // 2. The room tabs (#scene-views, an in-flow block in CSS, `margin-left:
  //    400px` with the rest of the main column) need to leave room for the
  //    punch-list button (#view-nav, `position: absolute;
  //    right: 0` — it comes after the tabs in DOM, so a float on it could
  //    never make the *earlier* tabs row avoid it, see the CSS comment).
  //    The button's rendered width isn't a fixed number either — content
  //    ("Punch list (n)") sizes it, and this codebase has already hit CI
  //    rendering a fallback font a few px wider than any local measurement
  //    (DIA-65's `.scene-stepper__floor` reservation).
  //
  // Both need the real layout, not a computed guess — reading them here is
  // the one reliable source for either. Gated by matchMedia so this is a
  // no-op below 1152 (nothing here overrides that breakpoint's own CSS),
  // and re-run on the same debounced resize the render() call below
  // already uses — mirrors the existing `(max-width: 767px)` pattern
  // already in this file (see isModalWidth in src/ui/panel.ts).
  //
  // DIA-218 review: `top` docks the panel/sheet under the toggle as of
  // *this* call. `getBoundingClientRect().bottom` is viewport-relative, and
  // `.panel`'s `position: fixed` never re-reads it — so the moment scrollY
  // changes (a scroll, or a reload that restores a non-zero scroll
  // position) without another resize, the docked `top` is stale: covering
  // the toggle if the page ends up scrolled less than it was at measurement
  // time, floating well below it if scrolled more (U-14d, D-056 item 5).
  // `rect.bottom + scrollY` is the toggle's bottom edge in *document*
  // coordinates, which doesn't change under scrolling — caching that once
  // per layout pass and re-deriving `top = docBottom - scrollY` on every
  // scroll event keeps the docked position correct continuously, without
  // forcing a `getBoundingClientRect()` layout read on every scroll frame.
  const checklistPanelEl = checklistRoot.querySelector<HTMLElement>('#checklist-panel');
  const desktopLayoutQuery = window.matchMedia('(min-width: 1152px)');
  let toggleBottomDoc = 0;
  function applyPanelTop() {
    if (!desktopLayoutQuery.matches) return;
    const top = `${Math.max(0, toggleBottomDoc - window.scrollY)}px`;
    panel.root.style.top = top;
    if (checklistPanelEl) checklistPanelEl.style.top = top;
  }
  function updateDesktopLayout() {
    if (!desktopLayoutQuery.matches) {
      panel.root.style.removeProperty('left');
      panel.root.style.removeProperty('top');
      checklistPanelEl?.style.removeProperty('left');
      checklistPanelEl?.style.removeProperty('top');
      viewsRow!.style.removeProperty('width');
      return;
    }
    const left = `${appRoot!.getBoundingClientRect().left}px`;
    toggleBottomDoc = toggleRoot!.getBoundingClientRect().bottom + window.scrollY;
    panel.root.style.left = left;
    if (checklistPanelEl) checklistPanelEl.style.left = left;
    applyPanelTop();
    viewsRow!.style.width = `${720 - viewNav!.getBoundingClientRect().width}px`;
  }
  updateDesktopLayout();
  // rAF-throttled: scroll can fire many times per frame (momentum
  // scrolling), applyPanelTop() only needs to run once per paint. Passive
  // since it never calls preventDefault(). Gated inside applyPanelTop()
  // itself (desktopLayoutQuery.matches), the same pattern as resize below.
  let scrollTicking = false;
  window.addEventListener(
    'scroll',
    () => {
      if (scrollTicking) return;
      scrollTicking = true;
      requestAnimationFrame(() => {
        applyPanelTop();
        scrollTicking = false;
      });
    },
    { passive: true }
  );
  // DIA-218: same belt-and-suspenders re-derive as openPanel()'s own call —
  // createChecklist() below owns the click listener that actually opens the
  // sheet, so this is a second, independent listener on the same button.
  punchListButton.addEventListener('click', applyPanelTop);

  // The "scroll for more" hint (SCENE-FORMAT: a view wider than the
  // viewport scrolls to `focus`) only matters below ~360px now that a
  // close-up is 180 native px. It reserves its own line and is inserted
  // synchronously, before any `await`, so it lands in the same frame as
  // the static shell (S1).
  const scrollHint = document.createElement('p');
  scrollHint.className = 'scene-scroll-hint';
  scrollHint.textContent = 'Scroll to see the rest →';
  stepper.after(scrollHint);

  // DIA-122: (re)computed once a paint's real DOM is settled — after the
  // hotspot/zoom-chip layer, not just sizeAndPositionCanvas's own canvas
  // math. A chip is a >=44px button centred on its rect's point (R-20),
  // so one anchored near a small view's edge can itself extend past the
  // canvas's own box (renderZoomTargets's placeChips already has to hunt
  // it a free spot for exactly this reason) — `#scene-wrap`'s *actual*
  // scrollable extent then includes that overhang, which the canvas's
  // cssW/cssH alone would not have accounted for. Reading scrollWidth/
  // Height here instead keeps this in lockstep with what maxScroll()
  // below actually scrolls.
  function updatePanAffordance() {
    const overflowsX = sceneWrap!.scrollWidth > sceneWrap!.clientWidth + 0.5;
    const overflowsY = sceneWrap!.scrollHeight > sceneWrap!.clientHeight + 0.5;
    sceneWrap!.classList.toggle('scene-wrap--pannable', overflowsX || overflowsY);
    // Hands whichever axis does *not* overflow back to the browser's own
    // default (page scroll on Y in the common X-only case) instead of
    // letting our own pointer handling race a native gesture recogniser
    // that isn't going to do anything on that axis anyway — D-042a's "no
    // swipe gesture" rule (panning never changes view) holds regardless,
    // since setupScenePan() below only ever writes scrollLeft/scrollTop.
    sceneWrap!.style.touchAction = overflowsX && overflowsY ? 'none' : overflowsX ? 'pan-y' : overflowsY ? 'pan-x' : '';
  }

  // DIA-122: one-finger touch drag and mouse click-hold-drag pan an
  // overflowing view (updatePanAffordance's overflowsX/overflowsY above —
  // R-20's "pan/zoom is allowed"). Neither input had this natively: a real
  // mouse has no native drag-to-pan on `overflow: auto` at all (only its
  // own, often-invisible-on-this-layout scrollbar drag), and Playwright's
  // `webkit-iphone` project (playwright.config.ts) — the closest available
  // proxy for the iOS Safari this site actually targets — has no CDP
  // touch-input path the way Chromium does, and a JS-dispatched synthetic
  // `TouchEvent` never reaches WebKit's own native scroll-gesture
  // recogniser (untrusted events don't feed it), so a close-up's overflow
  // could never be exercised by this repo's e2e suite by relying on the
  // browser's own touch scrolling. Pointer Events unify both real inputs
  // under one implementation instead, with the tap-vs-pan threshold
  // acceptance criterion 3 needs either way. `sceneWrap` itself (unlike
  // `canvas`) is never replaced or moved by a render (DIA-65), so these
  // listeners are attached once, here, and outlive every re-render.
  function setupScenePan() {
    const PAN_THRESHOLD_PX = 6;
    let activePointerId: number | null = null;
    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let startScrollTop = 0;
    let panned = false;
    let suppressNextClick = false;

    function maxScroll() {
      return {
        x: Math.max(0, sceneWrap!.scrollWidth - sceneWrap!.clientWidth),
        y: Math.max(0, sceneWrap!.scrollHeight - sceneWrap!.clientHeight),
      };
    }

    sceneWrap!.addEventListener('pointerdown', (event) => {
      // 0 is touch/pen contact as well as a mouse's primary button — a
      // right/middle mouse button (1/2) is left to its own native menu/
      // behaviour, not hijacked into a pan.
      if (event.button !== 0 || activePointerId !== null) return;
      const { x: maxX, y: maxY } = maxScroll();
      if (maxX <= 0 && maxY <= 0) return;
      activePointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      startScrollLeft = sceneWrap!.scrollLeft;
      startScrollTop = sceneWrap!.scrollTop;
      panned = false;
      // Deliberately NOT captured here yet — a real browser retargets the
      // eventual `click` to whatever element holds capture at the time,
      // not just pointermove/pointerup, so capturing on every pointerdown
      // (most of them a tap, never a pan) would misdirect the tap-with-
      // no-movement click acceptance criterion 3 requires, away from the
      // hotspot button and into this handler's own suppression check —
      // which would then let it through unsuppressed, but at the wrong
      // target, so it would never reach the button's own listener either.
      // Capture is set below, lazily, only once pointermove confirms an
      // actual pan.
    });

    sceneWrap!.addEventListener('pointermove', (event) => {
      if (event.pointerId !== activePointerId) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (!panned) {
        if (Math.abs(dx) < PAN_THRESHOLD_PX && Math.abs(dy) < PAN_THRESHOLD_PX) return;
        const { x: maxX, y: maxY } = maxScroll();
        const wantsHorizontal = Math.abs(dx) >= Math.abs(dy);
        const engage = (maxX > 0 && maxY > 0) || (wantsHorizontal ? maxX > 0 : maxY > 0);
        if (!engage) {
          // Criterion 4 / D-042a: the dominant drag direction has no room
          // to pan on this element (a vertical drag when only X
          // overflows, or vice versa) — bow out (never captured, so the
          // browser's own default, which touch-action already allows on
          // the other axis, simply proceeds).
          activePointerId = null;
          return;
        }
        panned = true;
        sceneWrap!.classList.add('scene-wrap--panning');
        // Captured only now that this is confirmed to be a real pan, not
        // a tap — a mouse drag that leaves the box, or a finger that
        // leaves the viewport's slice of an overflowing view, keeps
        // delivering pointermove/pointerup here regardless.
        sceneWrap!.setPointerCapture(event.pointerId);
      }
      // Assigning scrollLeft/scrollTop past either end already clamps in
      // every browser; the explicit Math.min/max here is acceptance
      // criterion 7 stated in code, not a second clamp doing real work.
      const { x: maxX, y: maxY } = maxScroll();
      if (maxX > 0) sceneWrap!.scrollLeft = Math.min(maxX, Math.max(0, startScrollLeft - dx));
      if (maxY > 0) sceneWrap!.scrollTop = Math.min(maxY, Math.max(0, startScrollTop - dy));
      event.preventDefault();
    });

    function endPan(event: PointerEvent) {
      if (event.pointerId !== activePointerId) return;
      // A real pan's own pointerup still fires a `click` right after on
      // whatever it ends on — the one thing acceptance criterion 3
      // forbids (a moved drag must never also open the hotspot/zoom
      // button it happened to end over).
      if (panned) suppressNextClick = true;
      activePointerId = null;
      panned = false;
      sceneWrap!.classList.remove('scene-wrap--panning');
    }
    sceneWrap!.addEventListener('pointerup', endPan);
    sceneWrap!.addEventListener('pointercancel', endPan);

    // Capture phase: runs before a hotspot/zoom button's own bubble-phase
    // click listener (src/ui/panel.ts's renderHotspots/renderZoomTargets),
    // so a real pan can veto the button's click before its own handler
    // (openPanel / zoomInto) ever sees it.
    sceneWrap!.addEventListener(
      'click',
      (event) => {
        if (!suppressNextClick) return;
        suppressNextClick = false;
        event.stopPropagation();
        event.preventDefault();
      },
      true
    );

    // R-14 (DIA-165): a keyboard visitor tabbing to a hotspot/zoom chip
    // that overflows this box needs it scrolled into view. Chromium's and
    // WebKit's own "scroll the newly focused element into view" step only
    // fires when the element has *zero* pixels already inside the
    // scrollport — a chip that's merely clipped at an edge (the realistic
    // case; a chip this close to a room's default view is rarely fully
    // off-screen) never triggers either engine's native behaviour, so it
    // silently never scrolls. `{ block: 'nearest', inline: 'nearest' }`
    // scrolls only the axis actually clipped, by only as much as needed,
    // and is a no-op once the target is already fully visible.
    sceneWrap!.addEventListener('focusin', (event) => {
      (event.target as HTMLElement).scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  }
  setupScenePan();

  const prevButton = stepper.querySelector<HTMLButtonElement>('.scene-stepper__prev');
  const nextButton = stepper.querySelector<HTMLButtonElement>('.scene-stepper__next');
  const stepperLabel = stepper.querySelector<HTMLParagraphElement>('.scene-stepper__label');
  const floorButton = stepper.querySelector<HTMLButtonElement>('.scene-stepper__floor');
  // The existing live region (slider.ts writes band changes to it); a
  // navigation announces its own view here.
  const liveRegion = sliderRoot.querySelector<HTMLParagraphElement>('.slider__live');
  const sceneStatus = sceneWrap.querySelector<HTMLDivElement>('.scene-status');
  const sceneStatusMessage = sceneWrap.querySelector<HTMLParagraphElement>('.scene-status__message');
  const sceneStatusRetry = sceneWrap.querySelector<HTMLButtonElement>('.scene-status__retry');
  if (
    !prevButton ||
    !nextButton ||
    !stepperLabel ||
    !floorButton ||
    !liveRegion ||
    !sceneStatus ||
    !sceneStatusMessage ||
    !sceneStatusRetry
  ) {
    throw new Error('index.html static shell is missing the stepper controls');
  }
  // U-11(a): "Whole floor" is static per-session copy (TONE.md), not
  // computed from the scene — filling it before the first render()'s scene
  // fetch means it is never blank while a slow load is in flight. syncStepper
  // (below) still sets it on every render(), which is fine — same string.
  floorButton.textContent = ui('wholeFloor');

  /** U-11(b)/(c): the loading/failure overlay over the canvas. `retry`
   * re-runs the given callback (rebound on every show — a stale retry
   * closure from an earlier band would otherwise re-request the wrong
   * one). Hidden has no retry action, so the button stays hidden then. */
  function showSceneStatus(message: string, retry: (() => void) | null) {
    sceneStatusMessage!.textContent = message;
    sceneStatusRetry!.hidden = !retry;
    sceneStatusRetry!.textContent = retry ? ui('retry') : '';
    sceneStatusRetry!.onclick = retry;
    sceneStatus!.hidden = false;
  }
  function hideSceneStatus() {
    sceneStatus!.hidden = true;
  }

  // S6: G3.A's ambient hover on the *whole* scene was noise (a tooltip on
  // every hover anywhere on the canvas) for a Phase-3, optional (R-13)
  // gag with no sprite of its own yet. Removed until a window sprite
  // exists to hang the hover on specifically.

  /** Adapts a SCENE-FORMAT view's `hotspots[]` into the `Hotspot[]` shape
   * src/ui/panel.ts's `renderHotspots` already draws real <button>s from
   * (the PH1-04 review §b — that seam is why panel.ts didn't
   * need to change). */
  function toSceneLayout(view: SceneView): SceneLayout {
    const hotspots: Hotspot[] = view.hotspots.map((h) => ({
      hotspotId: h.part ? `${h.gagId}#${h.part}` : h.gagId,
      gagId: h.gagId,
      x: h.x,
      y: h.y,
      w: h.w,
      h: h.h,
      marker: h.marker,
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
    // PH2-03: a moment plays only in the view the visitor landed on — leaving
    // it (a tab, the stepper, "whole floor", a zoom-in) cancels it, both
    // because the brief says any navigation input does and because the
    // canvas is about to be resized/replaced for a different view's own
    // dimensions (sizeAndPositionCanvas), which the moment's paint list is
    // not sized for.
    cancelActiveMoment();
    currentViewId = view.id;
    pendingFocus = intent.focus ?? null;
    pendingAnnounce = announceView(currentScene, view);
    void render();
  }

  /** D-051 item 2: a room tab lands on the room view itself, not (as
   * D-042a originally had it) the close-up with the most primaries — a
   * room view is now full of "zoom in" tiles to tap, so a tap no longer
   * strands the visitor on a picture with nothing to tap. */
  function selectRoom(roomId: string) {
    selectView(roomId);
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
    // D-051 item 4: the room view's *visible* stepper text is the landing
    // hint, not the live-region announcement — announceView (below) still
    // writes ui('announceRoom', ...) to the live region on every view change.
    stepperLabel!.textContent =
      view.kind === 'room' ? ui('roomHint') : ui('position', { label: view.label, n: index + 1, total: all.length });
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

  // U-05 (DIA-194/195): scrolling the *scene* to the viewport top (the
  // previous fix) only clears the sheet for a hotspot in the scene's own
  // top ~50vh — on a tall/busy scene (the review's band-750 repro) a
  // hotspot further down still ends up under it. Scroll by exactly what
  // the tapped hotspot itself needs instead, with a small margin so its
  // reticle isn't flush against the sheet's edge.
  const PANEL_SHEET_MARGIN_PX = 8;

  function scrollHotspotAboveSheet(source: HTMLElement) {
    const sheetTop = window.innerHeight / 2; // .panel's own 50vh cap, style.css
    const needed = source.getBoundingClientRect().bottom - (sheetTop - PANEL_SHEET_MARGIN_PX);
    if (needed <= 0) return;
    // The scene can sit close enough to the document's own end (little
    // checklist/contact-line content below it) that there isn't ~50vh of
    // real document left to scroll through — pad the document temporarily
    // so the scroll below actually has room to land, same idea as opening
    // a mobile keyboard reflowing the page. Removed again on close.
    const maxScrollY = document.documentElement.scrollHeight - window.innerHeight;
    if (needed > maxScrollY - window.scrollY) {
      document.body.classList.add('panel-scroll-space');
    }
    window.scrollBy({ top: needed, left: 0 });
  }

  function openPanel(gagId: string, source: HTMLElement) {
    const fields = panelFieldsFor(gagId);
    if (!fields) return;
    cancelActiveMoment(); // PH2-03: opening a panel cancels a playing moment at once.
    openPanelGagId = gagId;
    if (source instanceof HTMLButtonElement) setHotspotSelected(source);
    // Desktop's side panel never covers the scene, so this only runs below
    // the same 767px breakpoint U-06 uses for making the sheet modal.
    if (window.matchMedia('(max-width: 767px)').matches) {
      scrollHotspotAboveSheet(source);
    }
    // DIA-218: a scroll event between the last layout pass and this click
    // is already caught by the scroll listener above, but re-deriving here
    // too means the docked top is never one rAF frame behind the open.
    applyPanelTop();
    // R-04: the prevented-beat thumbnail is always the without-state
    // scene. B4: closing returns focus to the hotspot that opened it.
    panel.open(fields, 'without', { returnFocusTo: source });
    openOverlay(panelHash(gagId)); // PH3-01/U-09: item 2 (push) or item 5 (replace, switching from another open panel)
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
    const target = hotspotsLayer!.querySelector<HTMLButtonElement>(selector);
    if (target) {
      target.focus();
    } else if (captured.kind === 'hotspot') {
      // PH2-03 (DIA-113): fires whenever the just-rebuilt hotspot layer no
      // longer has a button for the captured id — most commonly a band
      // crossing, which brings a completely different gag set (unlike an
      // in-band view change, where an open panel already has its own
      // return-focus fallback via syncOpenPanel), but not exclusive to it.
      // Falling back to the slider, the same as the 'tab' case above, keeps
      // a keyboard visitor from being silently dumped on <body> (R-24) by
      // whatever input deleted their focused hotspot out from under them.
      slider.input.focus();
    }
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
      setHotspotSelected(button); // U-05: repoint the solid-reticle state at the button's freshly rebuilt replacement.
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
    updatePanAffordance();
  }

  async function render() {
    renderInFlight = true;
    const token = (renderToken += 1);
    // DIA-13: captured before anything below touches the DOM — the layers
    // that are about to be rebuilt are exactly the ones that can hold focus.
    const focusCapture = captureFocus();
    // U-11(c): sceneStatusRetry is outside both layers captureFocus() checks,
    // so a successful retry's own hideSceneStatus() (below) — which sets
    // `hidden`, i.e. `display: none` (style.css) — silently blurs it to
    // <body> unless something refocuses on the other side of the fetch.
    const retryFocused = document.activeElement === sceneStatusRetry;
    // PH2-04 step 3 (DIA-114, CEO ruling on DIA-88): checklist.render(band)
    // used to run here, ahead of loadScene/renderScene below, to unblock the
    // checklist section's own <h2> — band 750's LCP element at the time.
    // D-048 ("punch list on demand", #59) landed on develop after that fix
    // and made the whole checklist panel visually hidden until a visitor
    // opens it (`checklist__panel--collapsed`), so its <h2> is no longer an
    // LCP candidate at all — the original justification is moot. Worse,
    // rendering it this early broke the panel's own lazy-loading: its per-gag
    // thumbnails (checklist.ts) rely on `loading="lazy"` deferring their
    // fetch because the panel is already laid out and clipped by the time
    // they're inserted. Inserted this early — before the page's first
    // layout/paint pass — WebKit couldn't tell they were off-screen and
    // fetched all of them (up to 26) immediately, which is a real
    // regression against this same perf goal. Reverted to running after the
    // scene/sprite work, same as before DIA-114.
    let scene: SceneFile | null = null;
    // U-11(b): "Loading the building…" only after 300ms — most loads never
    // paint it. Cleared in `finally` regardless of outcome or staleness;
    // the token check inside still guards against a stale render showing
    // a loading message for a band a newer render has already moved past.
    const loadingTimer = window.setTimeout(() => {
      if (token === renderToken) showSceneStatus(ui('loading'), null);
    }, 300);
    try {
      scene = await loadScene(band, state);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`no scene file for band ${band}/${state} yet`, err);
    } finally {
      window.clearTimeout(loadingTimer);
    }
    if (token !== renderToken) return; // superseded — drop this stale scene fetch too; the newer render owns renderInFlight now

    if (!scene) {
      renderMissingScene();
      // U-11(c): replaces the canvas-drawn "not drawn yet" text (never
      // reachable by a screen reader) with a Content-owned sentence and a
      // working retry — the punch list (filled above, independent of the
      // scene) stays usable either way.
      showSceneStatus(ui('loadFailed'), () => void render());
      checklist.render(band);
      document.body.dataset.renderedToken = String(token);
      document.body.dataset.band = String(band);
      document.body.dataset.view = '';
      document.body.dataset.room = '';
      renderInFlight = false;
      return;
    }
    hideSceneStatus();

    // Toggle, tab, stepper, whole-floor and resize renders all keep (or, for
    // a tab/stepper/whole-floor change, already reset by selectView() to)
    // the id they want — `currentViewId && findView(scene, currentViewId)`
    // below finds it in the same band's scene every time. A slider change is
    // the one case `currentViewId` is left holding the *previous* band's
    // view id (main.ts's slider.onChange, deliberately un-nulled) —
    // `isBandChange` below is what tells the two apart.
    //
    // D-054 (amends D-051 item 3, U-04): a band change keeps the *kind* of
    // view the visitor is in, not the literal close-up. `previousView`
    // looks the outgoing id up in `currentScene` (the previous band's scene
    // — still not yet reassigned below) before anything here decides where
    // to land: a room-kind exit ("Whole floor" pressed), same as this
    // session's first commit (`lastCommittedBand === null`: a fresh load or
    // a `?n=` deep link, D-043), opens the new band's own opening room. A
    // close-up exit tries that same id in the *new* band's scene first
    // (D-036 close-up ids are stable across bands), falling back to the new
    // band's own default close-up only if it isn't there.
    //
    // A room id (`ground`, `floor-2`, …) is deliberately never looked up
    // this way even though D-036 shares those across bands too: the room
    // that happens to share this band's outgoing room id is not necessarily
    // its *opening* room (D-051 item 1), so a room-kind exit always uses
    // `openingView`, never `findView`.
    const isBandChange = lastCommittedBand !== null && band !== lastCommittedBand;
    const previousView = isBandChange && currentScene && currentViewId ? findView(currentScene, currentViewId) : undefined;
    // PH2-03/D-054 item 3: a genuine rising crossing into a moment-bearing
    // band always lands on the moment's own close-up, overriding the
    // kind-preserving `view` choice below — real content grows monotonically
    // (every band's close-up ids are a superset of the previous band's,
    // content/*.json), so "falling back to the new band's default close-up
    // only if [the outgoing id] isn't there" (this rule's own original
    // phrasing) can never actually happen: the outgoing id is always still
    // there. Gating this on `previousView?.kind !== 'room'` keeps D-054's
    // actual fix intact — a room-kind exit (U-04's own bug: stranding a
    // whole-floor visitor in an unrelated close-up) still always lands on
    // `openingView`, never the moment — since the moment "plays nowhere
    // else" (SCENE-FORMAT § Band-crossing moment) and a visitor who hasn't
    // yet drilled into a close-up isn't the audience for one either.
    const momentEligible =
      isBandChange &&
      state === 'built' &&
      band !== 'beyond' && // D-029: 1,000+ is an alias of 750, never a crossing of its own
      bandIndex(band) > bandIndex(lastCommittedBand!) &&
      !motion.isReduced() && // the brief's rule: reduced motion plays no moment at all
      !playedMomentBands.has(String(band)) &&
      !!scene.moment &&
      previousView?.kind !== 'room';
    const view =
      lastCommittedBand === null || previousView?.kind === 'room'
        ? openingView(scene)
        : momentEligible
          ? findView(scene, scene.moment!.view)!
          : (currentViewId && findView(scene, currentViewId)) || defaultView(scene);
    currentViewId = view.id;
    currentScene = scene;
    syncTabs(scene, roomOf(scene, view)?.id);
    syncStepper(scene, view);
    const canvasBox = sizeAndPositionCanvas(view);
    // PH2-03 (DIA-113, CEO review on PR #56): decided *before* the paint
    // below, not after. Deciding it afterward painted the real view first —
    // for a built-state close-up that already shows the "after" pose (the
    // sign lit, the door open) — and only handed off to the moment on the
    // ticker's next tick, which flashed that golden end frame on screen for
    // a rAF or two and gave the punchline away before the beat. Every
    // condition here only reads state already settled by this point in the
    // function; the mutations that follow (`playedMomentBands.add`,
    // `activeMoment = ...`) still wait for the stale-render check below,
    // same as before. `momentEligible` already forced `view` onto
    // `scene.moment.view` above, so this is just that same decision.
    const crossingMoment = momentEligible ? scene.moment! : null;
    // SCENE-FORMAT § Motion "rest pose = today's export": motion off
    // (reduced-motion, or the tab currently hidden) paints the rest pose,
    // same as a painter with no motion support — every pixel-parity golden
    // stays valid. Otherwise this paints the *current* moment, not t = 0, so
    // a tab/stepper/resize render never jumps the animation backwards. A
    // moment about to start is the one exception: this commit paints its
    // own t = 0 directly, never the real view's rest pose.
    const activeT = motion.isReduced() || document.hidden ? undefined : performance.now() - sceneStartTime;
    const paintView: SceneView = crossingMoment ? { ...view, entries: crossingMoment.entries } : view;
    const paintT = crossingMoment ? 0 : activeT;
    const myGeneration = (paintGeneration += 1);
    // N1: an unknown-frame throw from renderScene (a bad scene/manifest
    // reference) must still clear renderInFlight, or the ticker skips every
    // repaint for the rest of the session. try/finally, not a plain catch,
    // so the stale-render early-returns below (which deliberately leave
    // renderInFlight for the newer render to own) are unaffected — only an
    // actual throw takes this path.
    let threw = true;
    try {
      await renderScene(canvas!, paintView, state, paintT, () => paintGeneration !== myGeneration);
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

    // PH2-03 (DIA-113): a genuine rising crossing into a new band, in the
    // built state, lands here — the one place a fast drag's stale renders
    // never reach (S5's token check above already returned for them), which
    // is what "starts after the slider settles" means in practice.
    if (crossingMoment) {
      playedMomentBands.add(String(band));
      activeMoment = {
        momentView: paintView, // already painted at t = 0 by the commit above
        ms: crossingMoment.ms,
        committedAt: performance.now(),
      };
      document.body.dataset.momentPlaying = 'true';
    }
    lastCommittedBand = band;
    if (view.kind === 'room') {
      renderZoomTargets(hotspotsLayer!, toZoomLayout(scene, view), canvasBox, (viewId) =>
        // U-12 (DIA-194/197): a zoom-in used to land focus on "Whole floor"
        // (it comes after the hotspots in DOM order), forcing a keyboard
        // visitor to Shift+Tab back past the stepper to reach anything in
        // the close-up they just opened.
        selectView(viewId, { focus: { kind: 'firstHotspot' } })
      );
    } else {
      renderHotspots(hotspotsLayer!, toSceneLayout(view), canvasBox, openPanel);
    }
    updatePanAffordance();
    restoreFocus(focusCapture);
    if (retryFocused) {
      // U-11(c): a successful retry hid the button focus was just on — land
      // on the first room tab (freshest thing to explore), or "Whole floor"
      // if the scene has none, rather than dropping to <body> (R-24).
      const firstTab = viewsRow!.querySelector<HTMLButtonElement>('.scene-views__button');
      (firstTab ?? floorButton!).focus();
    }
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
          // U-12: the close-up's first hotspot, in the same DOM order
          // renderHotspots just built it in.
          : hotspotsLayer!.querySelector<HTMLButtonElement>('[data-hotspot-id]');
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
    cancelActiveMoment(); // PH2-03: moving the slider cancels a playing moment at once.
    const wasBeyond = band === 'beyond';
    band = newBand;
    // D-054/U-04: `currentViewId` is deliberately left set, not nulled —
    // render() below reads it (still holding the view being left, since
    // nothing else touches it between here and the render() that follows)
    // to decide whether this band change keeps a close-up's own id or
    // opens the new band's opening room instead. A visitor dragging fast
    // across several bands before any of them commits still fires this
    // listener once per band; leaving `currentViewId` alone here (rather
    // than nulling it per call) is what keeps that decision correct
    // regardless of how many intermediate bands never get painted (S5).
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
      // syncOpenPanel()'s concern (DIA-13). U-06: `modal: false` — the
      // "what works" keep-list's own rule is that this one opens without
      // trapping, so the slider stays usable above the sheet.
      openPanelGagId = null;
      applyPanelTop(); // DIA-218: keep the docked top fresh for this auto-open too.
      panel.open(beyondPanelFields(), 'without', { focus: false, returnFocusTo: slider.input, modal: false });
    } else if (wasBeyond) {
      // F5 (DIA-12): the auto-opened Beyond panel is only ever true for
      // the 'beyond' band — leaving it must close the panel rather than
      // let it keep announcing '1,000+' over whatever band is now
      // rendered (R-04a self-identifying panels, R-14 text/visual sync).
      openPanelGagId = null;
      panel.close();
    }
    writeSceneQuery(); // R-10 item 1: replaceState only, never a push, however many bands this drag crossed
    void render();
  });

  toggle.onChange((newState) => {
    cancelActiveMoment(); // PH2-03: flipping the toggle cancels a playing moment at once.
    state = newState;
    // U-10 (DIA-194/197): the toggle's own name is the action, not the
    // state (aria-pressed removed, src/ui/toggle.ts) — announce the new
    // state once, in the existing polite live region.
    liveRegion!.textContent = ui(newState === 'without' ? 'announceWithout' : 'announceBuilt');
    nudgeSpent = true; // DIA-17: latch on the first toggle, shown or not (R-06a: once per session).
    toggle.hideNudge(); // m2: the nudge's only job was getting them to toggle once.
    // PH2-01 Part B: the toggle picks a new scene file — reset t to 0 for it.
    sceneStartTime = performance.now();
    document.body.dataset.sceneStartTime = String(sceneStartTime);
    previousResolved = null;
    writeSceneQuery(); // R-10 item 1
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
    // PH2-03 (DIA-113, CEO review): a resize renders the *real* current
    // view at its own size — cut a playing moment first, the same as every
    // other input, or the next tick would resume painting the moment's
    // paint list (sized for the pre-resize canvas) on top of the freshly
    // resized one, a one-frame flash of the wrong picture.
    resizeDebounce = setTimeout(() => {
      cancelActiveMoment();
      updateDesktopLayout();
      void render();
    }, 150);
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

  /** Repaints `viewLike` at `t` if the tick throttle allows it and something
   * visible actually changed since the last repaint — the shared body both
   * a normal tick and a playing moment's tick use, so the two only differ in
   * which paint list and which clock they hand it (below). */
  function paintTick(now: number, viewLike: SceneView, t: number) {
    if (renderInFlight || tickRepaintInFlight || !manifestCache || now - lastRepaintAt < MIN_REPAINT_INTERVAL_MS) return;
    const resolved = resolveViewAt(viewLike, manifestCache, t);
    if (!motionChanged(resolved, previousResolved)) return;
    previousResolved = resolved;
    lastRepaintAt = now;
    tickRepaintCount += 1;
    // Test hook (tests/motion-playback.spec.ts): a repaint the ticker
    // itself made, distinct from render()'s own renderedToken stamp.
    document.body.dataset.repaintCount = String(tickRepaintCount);
    tickRepaintInFlight = true;
    const myGeneration = paintGeneration;
    void renderScene(canvas!, viewLike, state, t, () => paintGeneration !== myGeneration)
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

  function tick(now: number) {
    rafHandle = null;
    if (!tickerActive()) return; // a hard-stop condition fired; whoever clears it calls ensureTickerRunning() again

    if (activeMoment) {
      const m = now - activeMoment.committedAt;
      if (m >= activeMoment.ms) {
        // SCENE-FORMAT § Band-crossing moment: "at m >= ms ... the painter
        // discards the block and paints the view as usual", and "the
        // handover is to the view at t = 0" — reset sceneStartTime (the
        // same reset the toggle/slider already do for a new scene) so
        // ambient motion resumes fresh instead of jumping to whatever real
        // time has elapsed since the scene loaded.
        activeMoment = null;
        document.body.dataset.momentPlaying = 'false';
        sceneStartTime = now;
        document.body.dataset.sceneStartTime = String(sceneStartTime);
        previousResolved = null;
        // Falls through to the normal tick below, which now sees t = 0.
      } else {
        paintTick(now, activeMoment.momentView, m);
        rafHandle = requestAnimationFrame(tick);
        return;
      }
    }

    if (currentScene && currentViewId) {
      const view = findView(currentScene, currentViewId);
      if (view) paintTick(now, view, now - sceneStartTime);
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
      // PH2-03 (DIA-113, CEO review): the brief's rule is that reduced
      // motion plays no moment at all — flipping it on mid-moment must stop
      // one already playing, not just stop the ticker that was painting it.
      // cancelActiveMoment() also clears `data-moment-playing`, which
      // otherwise stayed 'true' forever (the ticker that would have flipped
      // it false on hand-off never runs again while reduced motion holds).
      cancelActiveMoment(); // also resets previousResolved (see its own doc comment)
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
