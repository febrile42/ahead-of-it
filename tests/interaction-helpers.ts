// Shared drivers for the cross-interaction specs (T7 / DIA-8).
//
// The pre-existing specs each re-declare their own `setBand`/`setState`
// against a single interaction at a time. This module is the combination
// layer: the same state transitions, but reachable by each *input method*
// a visitor actually has (touch, mouse, keyboard), plus the two oracles
// the one-at-a-time specs never assert — **where focus went** after a
// re-render, and **what the open panel is currently claiming** while the
// picture underneath it changes.
//
// Nothing here asserts. Specs do. Keeping the drivers assertion-free is
// what lets the same driver be used by a test that expects the current
// (buggy) behaviour and by the regression test that expects the fixed one.
import type { Locator, Page } from '@playwright/test';
import { drawnBands as drawnNumericBands, findGagView, interceptFixtureScenes } from './scene-source';

/** Duplicated from src/scene/bands.ts for the same reason tests/scene.spec.ts
 * duplicates it: this file runs under Playwright's own Node ESM loader, which
 * cannot `import` src/content/content.json without an import attribute Vite
 * supplies for the app bundle and Playwright does not. D-023/D-029. */
export type BandId = 80 | 150 | 220 | 360 | 490 | 610 | 750 | 'beyond';
export const BAND_ORDER: readonly BandId[] = [80, 150, 220, 360, 490, 610, 750, 'beyond'];
export const NUMERIC_BANDS = [80, 150, 220, 360, 490, 610, 750] as const;
export type SceneState = 'built' | 'without';

/**
 * Bands that actually have a scene file to paint right now — the fixtures
 * (80, 750) until the D-042 exporter lands real schema-2 files for the rest,
 * the real export after (scene-source.ts's `drawnBands`, same source
 * pixel-parity.spec.ts reads). A spec that needs an actual rendered picture
 * (hotspots, a tab row, a stepper) should iterate this instead of
 * BAND_ORDER/NUMERIC_BANDS, so it starts covering every band the moment the
 * real export does, with no change here — a band with no scene file at all
 * renders the "not drawn yet" placeholder, which has nothing to interact with.
 */
export function testableBands(): BandId[] {
  const nums = drawnNumericBands();
  const bands: BandId[] = [...nums] as BandId[];
  if (nums.includes(750)) bands.push('beyond'); // fixtures/index.json points "beyond" at the 750 file
  return bands;
}

/** `testableBands()` without 'beyond' — for specs that need a plain numeric
 * band to switch views/rooms/close-ups within (750 already covers what
 * 'beyond' would, since both serve the same file). */
export function numericTestableBands(): Exclude<BandId, 'beyond'>[] {
  return drawnNumericBands() as Exclude<BandId, 'beyond'>[];
}

/** R-20's phone-first design width. Every spec in this pass starts here. */
export const PHONE = { width: 390, height: 844 };
export const TABLET = { width: 768, height: 1024 };
export const DESKTOP = { width: 1280, height: 900 };

/** How a visitor reached a state. The distinction matters because the
 * keyboard path is the only one with a focus contract to break (R-24). */
export type InputMethod = 'mouse' | 'touch' | 'keyboard';

// ---------------------------------------------------------------------------
// render-token plumbing
// ---------------------------------------------------------------------------

/** src/main.ts stamps `body[data-rendered-token]` only for renders that
 * actually committed (S5) — awaiting it changing is the only non-flaky way
 * to know a re-render finished, and it never observes a dropped stale paint. */
export async function currentRenderToken(page: Page): Promise<string | undefined> {
  return page.evaluate(() => document.body.dataset.renderedToken);
}

export async function waitForFirstRender(page: Page): Promise<void> {
  await page.waitForFunction(() => document.body.dataset.renderedToken !== undefined);
}

export async function waitForNextRender(page: Page, prevToken: string | undefined): Promise<void> {
  await page.waitForFunction((prev) => {
    const token = document.body.dataset.renderedToken;
    return token !== undefined && token !== prev;
  }, prevToken);
}

/** Runs `action`, then waits for the re-render it is expected to cause.
 * Reads the token *before* acting so a fast render cannot be missed. */
export async function actAndWaitForRender(page: Page, action: () => Promise<void>): Promise<void> {
  const prev = await currentRenderToken(page);
  await action();
  await waitForNextRender(page, prev);
}

/** The panel opening is a DOM show, not a scene render — it has no token of
 * its own, so specs wait on the panel's own visibility instead of sleeping. */
export async function waitForPanelOpen(page: Page): Promise<void> {
  await page.locator('.panel').waitFor({ state: 'visible' });
}

// ---------------------------------------------------------------------------
// opening the page
// ---------------------------------------------------------------------------

export interface OpenOptions {
  viewport?: { width: number; height: number };
  /** Passed straight to page.emulateMedia — for the prefers-reduced-motion pass. */
  reducedMotion?: 'reduce' | 'no-preference';
  /**
   * Extra `page.route` setup to run after `interceptFixtureScenes` but
   * before navigation — Playwright resolves the *most recently registered*
   * matching route first, so a route meant to override the fixture (e.g.
   * `failSceneFetch` on a fixture-covered band) must be added here, not
   * before calling `openApp`, or the fixture route wins instead.
   */
  beforeGoto?: (page: Page) => Promise<void>;
}

export async function openApp(page: Page, options: OpenOptions = {}): Promise<void> {
  const viewport = options.viewport ?? PHONE;
  if (options.reducedMotion) await page.emulateMedia({ reducedMotion: options.reducedMotion });
  await page.setViewportSize(viewport);
  // D-042: serves the schema-2 fixtures until the exporter's schema-2 scenes
  // are in public/ (a no-op after that).
  await interceptFixtureScenes(page);
  await options.beforeGoto?.(page);
  await page.goto('/');
  await waitForFirstRender(page);
}

// ---------------------------------------------------------------------------
// band
// ---------------------------------------------------------------------------

function rawFor(band: BandId): number {
  // 1000 is SLIDER_MAX (src/scene/bands.ts) — the 1,000+ stop, R-01b.
  return band === 'beyond' ? 1000 : band;
}

export async function currentBand(page: Page): Promise<string | undefined> {
  return page.evaluate(() => document.body.dataset.band);
}

/**
 * Settles the slider on `band`.
 *
 * `mouse`/`touch` set the input's value and dispatch `input`, which is what
 * a real drag settles on (a synthetic drag over a 390px-wide range input
 * cannot land on an exact band reliably). `keyboard` uses real key presses,
 * so it also exercises the arrow/Home/End path R-24 requires — and, unlike
 * the value-set path, it fires `input` once *per key*, which is the event
 * storm a real drag produces.
 *
 * Returns false when the band was already current, because no render fires
 * then and there is nothing to wait for (src/ui/slider.ts only notifies
 * listeners when the snapped band actually changes).
 */
export async function setBand(page: Page, band: BandId, via: InputMethod = 'mouse'): Promise<boolean> {
  if ((await currentBand(page)) === String(band)) return false;
  const prev = await currentRenderToken(page);
  if (via === 'keyboard') {
    await setBandByKeyboard(page, band);
  } else {
    await page.locator('#headcount-slider').evaluate((el, value) => {
      const input = el as HTMLInputElement;
      input.value = String(value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, rawFor(band));
  }
  await waitForNextRender(page, prev);
  return true;
}

/** Walks the slider to `band` with Home/End + arrow keys only — no value
 * assignment. This is the path a keyboard visitor actually takes.
 *
 * U-03 (DIA-194/195): src/ui/slider.ts's own keydown handler now
 * `preventDefault()`s the native range behaviour and moves exactly one
 * *band* per Home/End/Arrow/Page press (Home -> the first band, End -> the
 * last), not one raw unit — so this presses the BAND_ORDER index distance
 * from Home (always index 0) rather than the old raw-value distance. */
export async function setBandByKeyboard(page: Page, band: BandId): Promise<void> {
  const slider = page.locator('#headcount-slider');
  await slider.focus();
  if (band === 'beyond') {
    await page.keyboard.press('End');
    return;
  }
  await page.keyboard.press('Home');
  const toIndex = BAND_ORDER.indexOf(band);
  for (let i = 0; i < toIndex; i += 1) {
    await page.keyboard.press('ArrowRight');
  }
}

// ---------------------------------------------------------------------------
// state (the built <-> without toggle)
// ---------------------------------------------------------------------------

export async function currentState(page: Page): Promise<SceneState> {
  const pressed = await page.locator('.toggle__button').getAttribute('aria-pressed');
  return pressed === 'true' ? 'without' : 'built';
}

/** Flips the toggle to `state`. Returns false when already there (no render). */
export async function setState(page: Page, state: SceneState, via: InputMethod = 'mouse'): Promise<boolean> {
  if ((await currentState(page)) === state) return false;
  const button = page.locator('.toggle__button');
  const prev = await currentRenderToken(page);
  if (via === 'keyboard') {
    await button.focus();
    await page.keyboard.press('Enter');
  } else if (via === 'touch') {
    await button.tap();
  } else {
    await button.click();
  }
  await waitForNextRender(page, prev);
  return true;
}

// ---------------------------------------------------------------------------
// views (D-042a): a room (the tab row's establishing shot, no gag hotspots)
// or a close-up (where gags are tapped, reached by the stepper or a room's
// "zoom in" buttons). `currentView` is whichever of the two is on screen;
// `currentRoomId` is always the room it belongs to (itself, for a room).
// ---------------------------------------------------------------------------

export async function currentView(page: Page): Promise<string | undefined> {
  return page.evaluate(() => document.body.dataset.view);
}

export async function currentRoomId(page: Page): Promise<string | undefined> {
  return page.evaluate(() => document.body.dataset.room);
}

/** The room tab row's ids, in array order — one per room, never a close-up. */
export async function roomIds(page: Page): Promise<string[]> {
  return page.locator('.scene-views__button').evaluateAll((els) =>
    els.map((el) => (el as HTMLElement).dataset.viewId ?? '')
  );
}

/** Switches to `roomId` through the tab row — lands on that room's own
 * establishing shot (D-051 item 2; was the room's default close-up, D-042
 * item 6, before D-051 amended it). `keyboard` presses Enter on the focused
 * tab (the tab's *click* handler, not the roving-tabindex keydown handler)
 * — the two are different code paths in
 * src/main.ts and only one of them restores focus. */
export async function setRoom(page: Page, roomId: string, via: InputMethod = 'mouse'): Promise<boolean> {
  // Not currentRoomId(page) === roomId — that's also true from one of the
  // room's own close-ups (D-051: no-op there would skip a real transition
  // to the room's own establishing shot, which a tab click always causes).
  if ((await currentView(page)) === roomId) return false;
  const tab = page.locator(`.scene-views__button[data-view-id="${roomId}"]`);
  if ((await tab.count()) === 0) return false;
  const prev = await currentRenderToken(page);
  if (via === 'keyboard') {
    await tab.focus();
    await page.keyboard.press('Enter');
  } else if (via === 'touch') {
    await tab.tap();
  } else {
    await tab.click();
  }
  await waitForNextRender(page, prev);
  return true;
}

/** Moves one tab along the room row with the arrow keys — src/main.ts's
 * roving-tabindex handler, which is a separate path from a tab click. */
export async function pressRoomArrow(page: Page, key: 'ArrowLeft' | 'ArrowRight'): Promise<void> {
  const prev = await currentRenderToken(page);
  await page.keyboard.press(key);
  await waitForNextRender(page, prev);
}

/** `force` bypasses Playwright's actionability check, which treats
 * `aria-disabled="true"` as not-enabled and otherwise retries a click for
 * the full test timeout — main.ts deliberately never sets the native
 * `disabled` attribute on the stepper's ends (so focus is never lost
 * there), and a real click or Enter on one of them does reach the handler
 * (it just no-ops but for the live-region announcement), so the force is
 * standing in for a real visitor's tap, not cheating past a broken state. */
async function activate(locator: Locator, via: InputMethod, force = false): Promise<void> {
  if (via === 'keyboard') {
    await locator.focus();
    await locator.press('Enter');
  } else if (via === 'touch') {
    await locator.tap({ force });
  } else {
    await locator.click({ force });
  }
}

export interface StepperInfo {
  prevDisabled: boolean;
  nextDisabled: boolean;
  label: string;
  wholeFloor: boolean;
}

/** The stepper's current state: "label · n of N" plus which ends are
 * reachable. Both ends are `aria-disabled`, never `disabled` (main.ts never
 * drops focus at the boundary), so this reads that attribute, not `:disabled`. */
export async function stepperInfo(page: Page): Promise<StepperInfo> {
  const stepper = page.locator('#scene-stepper');
  return {
    prevDisabled: (await stepper.locator('.scene-stepper__prev').getAttribute('aria-disabled')) === 'true',
    nextDisabled: (await stepper.locator('.scene-stepper__next').getAttribute('aria-disabled')) === 'true',
    label: (await stepper.locator('.scene-stepper__label').textContent()) ?? '',
    wholeFloor: (await stepper.locator('.scene-stepper__floor').getAttribute('aria-pressed')) === 'true',
  };
}

/** Presses the stepper's previous (`delta -1`) or next (`delta 1`). Returns
 * whether a render actually fired — false at an end (aria-disabled, a no-op
 * that only updates the live region) or while a room view is showing (D-042a:
 * there is no "next" close-up from an establishing shot). */
export async function step(page: Page, delta: -1 | 1, via: InputMethod = 'mouse'): Promise<boolean> {
  const button = page.locator(delta === 1 ? '.scene-stepper__next' : '.scene-stepper__prev');
  if ((await button.getAttribute('aria-disabled')) === 'true') {
    await activate(button, via, true);
    return false;
  }
  const prev = await currentRenderToken(page);
  await activate(button, via);
  await waitForNextRender(page, prev);
  return true;
}

/** Toggles the "whole floor" control: from a close-up to its room, or from a
 * room back to wherever "whole floor" was entered from (main.ts's
 * `roomFromId`, falling back to the room's default close-up). Always causes
 * a render — from either kind of view there is always somewhere to go once
 * a scene has loaded. */
export async function toggleWholeFloor(page: Page, via: InputMethod = 'mouse'): Promise<void> {
  const button = page.locator('.scene-stepper__floor');
  const prev = await currentRenderToken(page);
  await activate(button, via);
  await waitForNextRender(page, prev);
}

/** Clicks a room's "zoom in" button for `closeupId` — present only while
 * that close-up's room view is on screen (renderZoomTargets). */
export async function zoomInto(page: Page, closeupId: string, via: InputMethod = 'mouse'): Promise<void> {
  const button = page.locator(`.hotspot--zoom[data-view-id="${closeupId}"]`);
  const prev = await currentRenderToken(page);
  await activate(button, via);
  await waitForNextRender(page, prev);
}

/**
 * Walks every close-up of the current band in array order via the stepper —
 * across every room, not just the current one (D-042a: the stepper's order
 * is `closeups(scene)`, never room-scoped) — calling `atEachCloseup` while
 * stopped on each one. Rewinds to the start first, so it is safe to call
 * from wherever the visitor currently is, including a room view. Leaves the
 * visitor on the last close-up.
 */
export async function forEachCloseup(
  page: Page,
  atEachCloseup: (closeupId: string) => Promise<void>
): Promise<void> {
  // A room view has no "previous"/"next" (main.ts's step() no-ops there) —
  // land on one of its close-ups first via "whole floor".
  await ensureCloseup(page);
  while (!(await stepperInfo(page)).prevDisabled) {
    await step(page, -1);
  }
  for (;;) {
    await atEachCloseup((await currentView(page)) ?? '');
    const moved = await step(page, 1);
    if (!moved) break;
  }
}

/** `forEachCloseup`, collecting the ids visited instead of acting on each. */
export async function walkCloseupIds(page: Page): Promise<string[]> {
  const ids: string[] = [];
  await forEachCloseup(page, async (id) => {
    ids.push(id);
  });
  return ids;
}

// ---------------------------------------------------------------------------
// hotspots and the panel
// ---------------------------------------------------------------------------

export function hotspots(page: Page): Locator {
  return page.locator('.hotspot');
}

/** If the current view is its own room's establishing shot — no gag
 * hotspots, only "zoom in" tiles (D-051) — zooms into that room's default
 * close-up via "Whole floor", same fallback main.ts's own toggleWholeFloor
 * already uses. A no-op once already on a close-up. D-051 item 1 means a
 * fresh load can land on a room now, so any spec that wants a gag hotspot
 * (rather than a zoom-in tile, which is also `.hotspot` in the DOM — see
 * src/ui/panel.ts) must call this first instead of assuming one is on
 * screen. */
export async function ensureCloseup(page: Page): Promise<void> {
  if ((await currentView(page)) === (await currentRoomId(page))) {
    await toggleWholeFloor(page);
  }
}

/** Opens the panel from the first hotspot of the current view via `via`, and
 * returns the gag id it opened (so a spec can assert the panel's own strip
 * still belongs to it after the picture changes underneath). */
export async function openFirstHotspot(page: Page, via: InputMethod = 'mouse'): Promise<string> {
  await ensureCloseup(page);
  const first = hotspots(page).first();
  const gagId = (await first.getAttribute('data-gag-id')) ?? '';
  if (via === 'keyboard') {
    await first.focus();
    await page.keyboard.press('Enter');
  } else if (via === 'touch') {
    await first.tap();
  } else {
    await first.click();
  }
  await waitForPanelOpen(page);
  return gagId;
}

export async function openHotspot(page: Page, gagId: string, via: InputMethod = 'mouse'): Promise<void> {
  const hotspot = page.locator(`.hotspot[data-gag-id="${gagId}"]`).first();
  if (via === 'keyboard') {
    await hotspot.focus();
    await page.keyboard.press('Enter');
  } else if (via === 'touch') {
    await hotspot.tap();
  } else {
    await hotspot.click();
  }
  await waitForPanelOpen(page);
}

/**
 * Brings the close-up holding `gagId`'s hotspot on screen, then leaves the
 * visitor there. No-op if it is already visible.
 *
 * DIA-56: a real schema-2 export's default view is a close-up, not
 * necessarily the one holding whatever gag a spec cares about (an older
 * single-view-per-band fixture made that assumption safe; it no longer is).
 * A spec that needs to act on a specific gag should call this instead of
 * assuming the band's current view already has it.
 *
 * Every hotspot lives on a close-up — a room view renders zoom targets, not
 * hotspots (src/main.ts's render()) — so landing on any close-up of the
 * current band/state and walking the stepper's full order (which crosses
 * rooms, same as `forEachCloseup`) reaches every gag regardless of which
 * room it belongs to.
 */
export async function showGag(page: Page, gagId: string): Promise<void> {
  const alreadyVisible = await hotspots(page).evaluateAll(
    (els, id) => els.some((el) => (el as HTMLElement).dataset.gagId === id),
    gagId
  );
  if (alreadyVisible) return;

  const band = await currentBand(page);
  const state = await currentState(page);
  if (band === undefined) throw new Error('showGag: no band rendered yet');
  const target = findGagView(band === 'beyond' ? 'beyond' : Number(band), state, gagId);
  if (!target) {
    throw new Error(`showGag: no hotspot for gag "${gagId}" in the current band (${band}) / ${state} scene`);
  }

  await ensureCloseup(page);
  while (!(await stepperInfo(page)).prevDisabled) {
    await step(page, -1);
  }
  for (;;) {
    if ((await currentView(page)) === target.id) return;
    const moved = await step(page, 1);
    if (!moved) break;
  }
  throw new Error(`showGag: walked every close-up but never reached view "${target.id}" for gag "${gagId}"`);
}

/**
 * Brings close-up `viewId` on screen, then leaves the visitor there — the
 * same walk `showGag` does, but keyed on a view id already known to the
 * caller instead of resolved from a gagId (PH2-01 Part B, DIA-100: a spec
 * that needs a specific *view*, not a specific gag's view, e.g. to land on
 * whichever close-up actually animates for a band).
 */
export async function gotoCloseupView(page: Page, viewId: string): Promise<void> {
  if ((await currentView(page)) === viewId) return;
  await ensureCloseup(page);
  while (!(await stepperInfo(page)).prevDisabled) {
    await step(page, -1);
  }
  for (;;) {
    if ((await currentView(page)) === viewId) return;
    const moved = await step(page, 1);
    if (!moved) break;
  }
  throw new Error(`gotoCloseupView: walked every close-up but never reached view "${viewId}"`);
}

export async function panelIsOpen(page: Page): Promise<boolean> {
  return page.locator('.panel').evaluate((el) => !(el as HTMLElement).hidden);
}

/** R-04a: every panel opens with a self-identifying `YEAR · ~HEADCOUNT ·
 * DESCRIPTOR` strip. That makes the strip the oracle for "which band's gag
 * is this panel actually showing" — it is the only band-identifying text in
 * the panel, and it is exactly what goes stale if the picture re-renders
 * underneath an open panel. */
export async function panelStrip(page: Page): Promise<string> {
  return (await page.locator('.panel__strip').textContent()) ?? '';
}

export async function panelTitle(page: Page): Promise<string> {
  return (await page.locator('.panel__title').textContent()) ?? '';
}

// ---------------------------------------------------------------------------
// punch list (DIA-131): the `Punch list (n)` disclosure button and its sheet
// ---------------------------------------------------------------------------

/** The nav button's own `aria-expanded`, not the sheet's clip class — the
 * two are kept in sync by src/ui/checklist.ts's setOpen, so either is a
 * valid oracle, but the button is the one a visitor's assistive tech
 * actually announces. */
export async function punchListIsOpen(page: Page): Promise<boolean> {
  return (await page.locator('#punch-list-button').getAttribute('aria-expanded')) === 'true';
}

/** Opens the sheet via its one entry point if not already open.
 *
 * DIA-135 QA nit: `#checklist-panel` is never `display:none` even while
 * collapsed (D-048/R-24 keeps it in the a11y tree — see the
 * `.checklist__panel--collapsed` clip pattern in style.css), so
 * Playwright's own `state: 'visible'` wait resolves against the collapsed
 * panel too and can't tell the two states apart. `aria-expanded` (the same
 * oracle `punchListIsOpen` reads) is the real signal. */
export async function openPunchList(page: Page): Promise<void> {
  if (await punchListIsOpen(page)) return;
  await page.locator('#punch-list-button').click();
  await page.locator("#punch-list-button[aria-expanded='true']").waitFor({ state: 'attached' });
}

/** Closes the sheet via its own header close button (DIA-135) if open.
 *
 * Before DIA-135, this re-clicked `trigger` to toggle it closed. DIA-135
 * deliberately stopped keeping `trigger` painted above the open sheet (that
 * was DIA-132's bug: it buried the sheet's own Download button on a phone),
 * so on a phone `trigger` sits *under* the open sheet and is not reliably
 * clickable from it any more — the header's own close button is now the
 * one close path guaranteed reachable at every viewport. */
export async function closePunchList(page: Page): Promise<void> {
  if (!(await punchListIsOpen(page))) return;
  await page.locator('.checklist__close').click();
}

/** The `n` the button's own label carries — parsed from its rendered text
 * rather than duplicating checklist.ts's count, so a spec fails if the two
 * ever drift apart. */
export async function punchListButtonCount(page: Page): Promise<number> {
  const text = (await page.locator('.punch-list-button__label').textContent()) ?? '';
  const match = text.match(/\((\d+)\)/);
  return match ? Number(match[1]) : NaN;
}

// ---------------------------------------------------------------------------
// focus: the oracle nothing in the existing suite checks after a re-render
// ---------------------------------------------------------------------------

export interface FocusInfo {
  /** Lowercased tag name. 'body' means focus was lost — a keyboard visitor
   * is silently dumped to the top of the document. */
  tag: string;
  className: string;
  gagId: string | null;
  viewId: string | null;
  id: string | null;
  /** False when activeElement is no longer in the document — the symptom of
   * .focus() having been called on a node a replaceChildren() detached. */
  connected: boolean;
  /** False when activeElement exists but is not rendered (it or an ancestor
   * is `hidden`/`display:none`). Chromium blurs such an element
   * asynchronously, so for one frame after the panel is hidden focus is
   * still *on* the hidden close button — an invisible focus holder is
   * already lost focus, it just has not landed on <body> yet. */
  visible: boolean;
}

export async function focusInfo(page: Page): Promise<FocusInfo> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return {
      tag: (el?.tagName ?? 'none').toLowerCase(),
      className: el?.className ?? '',
      gagId: el?.dataset?.gagId ?? null,
      viewId: el?.dataset?.viewId ?? null,
      id: el?.id ? el.id : null,
      connected: el ? el.isConnected : false,
      visible: el ? el.getClientRects().length > 0 : false,
    };
  });
}

/**
 * Focus moves asynchronously after a DOM change (hiding an ancestor of the
 * focused node blurs it on a later tick), so a single read right after an
 * action can catch focus mid-flight. This polls until two consecutive reads
 * agree, which is the state a visitor actually ends up in.
 */
export async function settledFocusInfo(page: Page): Promise<FocusInfo> {
  let previous = JSON.stringify(await focusInfo(page));
  for (let i = 0; i < 20; i += 1) {
    await page.waitForTimeout(50);
    const next = await focusInfo(page);
    const serialised = JSON.stringify(next);
    if (serialised === previous) return next;
    previous = serialised;
  }
  return focusInfo(page);
}

/** True when focus is on nothing a visitor can see or act on — `<body>`,
 * `<html>`, nowhere, or an element that is detached or not rendered. This is
 * the shape "focus was lost" takes in a browser: `.focus()` on a detached
 * node is a silent no-op, so nothing throws and nothing logs. */
export function focusIsLost(info: FocusInfo): boolean {
  if (info.tag === 'body' || info.tag === 'html' || info.tag === 'none') return true;
  return !info.connected || !info.visible;
}

export async function pressEscape(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await page.locator('.panel').waitFor({ state: 'hidden' });
}

// ---------------------------------------------------------------------------
// resize
// ---------------------------------------------------------------------------

/**
 * One resize, awaited through to the re-render it causes. src/main.ts's
 * resize listener calls render() unconditionally, so a render always follows.
 */
export async function resizeTo(page: Page, width: number, height: number): Promise<void> {
  const prev = await currentRenderToken(page);
  await page.setViewportSize({ width, height });
  await waitForNextRender(page, prev);
}

/**
 * The iOS address-bar storm: scrolling collapses the browser chrome, which
 * fires `resize` with the *width unchanged* and the height stepping by a few
 * px at a time. Dispatched as real `resize` events on window rather than
 * viewport changes, because that is the shape of the event a visitor's scroll
 * produces and it is the only way to fire a burst faster than a render can
 * finish. Returns how many renders actually committed.
 */
export async function resizeStorm(page: Page, count: number): Promise<number> {
  const before = Number((await currentRenderToken(page)) ?? '0');
  await page.evaluate((n) => {
    for (let i = 0; i < n; i += 1) window.dispatchEvent(new Event('resize'));
  }, count);
  // Let every queued render settle; the token only advances for committed
  // paints, so this measures work that landed, not events fired.
  await page.waitForFunction(
    (prev) => {
      const token = Number(document.body.dataset.renderedToken ?? '0');
      return token > prev;
    },
    before,
    { timeout: 10_000 }
  );
  await page.waitForTimeout(250); // let any trailing renders of the burst land
  const after = Number((await currentRenderToken(page)) ?? '0');
  return after - before;
}

// ---------------------------------------------------------------------------
// degenerate states
// ---------------------------------------------------------------------------

/**
 * Forces src/main.ts's `renderMissingScene` "not drawn yet" fallback for one
 * band by failing its scene fetch, and clears the module-level scene cache
 * so the block is not masked by an already-resolved promise.
 *
 * Must be called before `openApp`. Every band now has a real scene file
 * (public/sprites/scenes/), so an offline/404 fetch is the only way this
 * path is still reachable — which is precisely the degenerate state worth a
 * test: a visitor on a flaky connection.
 */
export async function failSceneFetch(page: Page, band: number | 'all'): Promise<void> {
  const pattern = band === 'all' ? '**/sprites/scenes/*.json' : `**/sprites/scenes/${band}-*.json`;
  await page.route(pattern, (route) => route.abort('failed'));
}

// ---------------------------------------------------------------------------
// drag-to-pan (DIA-122)
// ---------------------------------------------------------------------------

/**
 * Dispatches a Pointer Events drag sequence (down -> N moves -> up) from
 * `from` to `to`, against whatever real element sits at each point along
 * the way. src/main.ts's setupScenePan listens for exactly these events, so
 * this exercises the app's own pan controller rather than a browser's
 * native scroll gesture — deliberately, and the only reliable way to do it:
 * Playwright's `page.touchscreen` is tap-only (no drag primitive), and
 * WebKit (the `webkit-iphone` project's engine, this repo's iOS Safari
 * proxy) has no CDP touch-input path the way Chromium does, so neither
 * project has a native "swipe" this could drive instead. A dispatched
 * PointerEvent reaches a real `addEventListener` exactly like a trusted
 * one — only a browser's *own* default action (native scroll-gesture
 * recognition) requires a trusted event, and the app under test
 * deliberately does not rely on that (see setupScenePan's own doc
 * comment), so this exercises the real code path a device would use, not
 * a bypass of it.
 */
export async function pointerDrag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  options: { pointerType?: 'touch' | 'mouse'; steps?: number } = {}
): Promise<void> {
  const { pointerType = 'touch', steps = 10 } = options;
  await page.evaluate(
    ({ from, to, pointerType, steps }) => {
      const pointerId = pointerType === 'touch' ? 2 : 1;
      function fire(type: string, x: number, y: number, buttons: number) {
        const el = document.elementFromPoint(x, y);
        el?.dispatchEvent(
          new PointerEvent(type, {
            pointerId,
            pointerType,
            clientX: x,
            clientY: y,
            button: 0,
            buttons,
            bubbles: true,
            cancelable: true,
            isPrimary: true,
          })
        );
      }
      fire('pointerdown', from.x, from.y, 1);
      for (let i = 1; i <= steps; i += 1) {
        const x = from.x + ((to.x - from.x) * i) / steps;
        const y = from.y + ((to.y - from.y) * i) / steps;
        fire('pointermove', x, y, 1);
      }
      fire('pointerup', to.x, to.y, 0);
    },
    { from, to, pointerType, steps }
  );
}

/** The "not drawn yet" box src/main.ts paints when no scene file loads. */
export async function canvasShowsMissingScene(page: Page): Promise<boolean> {
  // renderMissingScene() empties both the tab row and the hotspot layer and
  // stamps an empty view id — that triple is its signature, and it is
  // distinguishable from every real scene (all of which have >=1 tab).
  const [view, tabs, spots] = await Promise.all([
    currentView(page),
    page.locator('.scene-views__button').count(),
    hotspots(page).count(),
  ]);
  return view === '' && tabs === 0 && spots === 0;
}
