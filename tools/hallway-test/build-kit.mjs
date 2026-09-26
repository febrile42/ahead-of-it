#!/usr/bin/env node
// Hallway-test kit builder (D-040). Regenerates everything in
// docs/hallway-test/ that is derived from the product: the printable
// scoring sheet, the 390 px "without" screenshots, the per-gag crops and
// the manifest that says what was captured and when.
//
// Why a script and not a manual export: the test is a Phase 1 exit
// criterion that has been deferred, and bands land over time. Re-running
// this after new art lands drops the missing bands in without anyone
// rebuilding the kit — placeholder gags are skipped and listed, and stop
// being skipped the moment the art side exports a real hotspot for them.
//
// D-042/D-042a: rooms are establishing shots with no gag hotspots of
// their own; a gag's primary hotspot lives in one of the room's close-ups.
// The band screen (`A-band-<band>-<room>.png`) is the room, reached via
// the site's own "whole floor" control; the gag crop (`B-gag-<id>.png`)
// is the close-up that holds its primary, reached by walking the site's
// own stepper — the same two controls a hallway-test participant has.
//
// Usage (from the repo root):
//   npm run build                       # dist/ is what preview serves
//   node tools/hallway-test/build-kit.mjs
//
//   --sheet-only      regenerate the scoring sheet + manifest, no browser
//   --base-url URL    use a server that is already running
//   --out DIR         output dir (default docs/hallway-test)
//
// Needs the Playwright chromium browser for screenshots; --sheet-only
// needs nothing but node and the repo.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

// D-023/D-029: the seven real bands. `beyond` is an alias of 750 (N-02)
// and introduces no gag of its own, so it is not a scored sheet — see
// the Beyond capture at the end of `capture()`.
const BANDS = [80, 150, 220, 360, 490, 610, 750];

// 390 px is the phone-first design width (CLAUDE.md); 3x is a real
// phone's pixel ratio and makes the prints hold up at arm's length.
const VIEWPORT = { width: 390, height: 844 };
const DEVICE_SCALE_FACTOR = 3;

// The kit's operationalisation of the two thresholds in 02-PHASES.md /
// D-040. They live here so the sheet and the protocol can never drift
// from each other.
const GAG_SECONDS = 5;
const TOGGLE_SECONDS = 20;
const PARTICIPANTS = 5;
const PASS_AT = 4;

function parseArgs(argv) {
  const args = { sheetOnly: false, baseUrl: null, out: path.join(repoRoot, 'docs/hallway-test') };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--sheet-only') args.sheetOnly = true;
    else if (arg === '--base-url') args.baseUrl = argv[++i];
    else if (arg === '--out') args.out = path.resolve(repoRoot, argv[++i]);
    else throw new Error(`unknown argument: ${arg}`);
  }
  return args;
}

const jsonCache = new Map();
function readJson(relative) {
  if (!jsonCache.has(relative)) {
    jsonCache.set(relative, JSON.parse(readFileSync(path.join(repoRoot, relative), 'utf-8')));
  }
  return jsonCache.get(relative);
}

/** `G4.1` + part `door` -> `G4.1#door`, matching src/ui/panel.ts's hotspotId. */
function hotspotIdOf(hotspot) {
  return hotspot.part ? `${hotspot.gagId}#${hotspot.part}` : hotspot.gagId;
}

/**
 * Reads every band's without-state scene file once and returns:
 * - `gags` — one row per gag (band order), naming the close-up its
 *   primary hotspot lives in (SCENE-FORMAT: rooms carry no hotspots, so
 *   this is always a `kind: "closeup"` view) and whether that hotspot is
 *   still a placeholder.
 * - `sheets` — one row per room (the establishing shots), in band then
 *   array order.
 * - `closeupOrder` — band -> ordered array of close-up view ids, the
 *   same order the site's own stepper walks (D-042a: "array order is the
 *   navigation order"). The capture step uses this only to know how many
 *   times to press "next", never to address a view directly.
 */
function loadSceneData() {
  const content = readJson('src/content/content.json');
  const sheets = [];
  const closeupOrder = new Map();
  const gagRows = [];

  for (const band of BANDS) {
    const scene = readJson(`public/sprites/scenes/${band}-without.json`);
    const rooms = scene.views.filter((v) => v.kind === 'room');
    const closeups = scene.views.filter((v) => v.kind === 'closeup');
    closeupOrder.set(band, closeups.map((v) => v.id));

    for (const room of rooms) {
      const roomCloseups = closeups.filter((c) => c.parent === room.id);
      sheets.push({
        band,
        viewId: room.id,
        viewLabel: room.label,
        size: room.size,
        image: `screenshots/A-band-${band}-${room.id}.png`,
        primaries: roomCloseups.reduce((n, c) => n + c.hotspots.filter((h) => h.primary).length, 0),
      });
    }
  }

  for (const gag of content.gags) {
    const scene = readJson(`public/sprites/scenes/${gag.band}-without.json`);
    let found = null;
    for (const view of scene.views) {
      if (view.kind !== 'closeup') continue;
      for (const hotspot of view.hotspots) {
        if (hotspot.gagId === gag.id && hotspot.primary) found = { view, hotspot };
      }
    }
    // SCENE-FORMAT guarantees exactly one primary per gag per file, in a
    // close-up (rooms have none); if that ever stops being true the kit
    // should fail loudly rather than print a sheet with a hole in it.
    if (!found) throw new Error(`gag ${gag.id} has no primary hotspot in a close-up of ${gag.band}-without.json`);
    gagRows.push({
      id: gag.id,
      band: gag.band,
      title: gag.title,
      // The facilitator's answer key — the drawn joke, in the art's own
      // words (docs/content/BANDS-AND-GAGS.md, locked). Never read aloud.
      without: gag.without,
      where: gag.where,
      viewId: found.view.id,
      viewLabel: found.view.label,
      hotspotId: hotspotIdOf(found.hotspot),
      rect: { x: found.hotspot.x, y: found.hotspot.y, w: found.hotspot.w, h: found.hotspot.h },
      placeholder: Boolean(found.hotspot.placeholder),
      image: null,
    });
  }
  gagRows.sort((a, b) => a.band - b.band || a.id.localeCompare(b.id, 'en'));
  return { gags: gagRows, sheets, closeupOrder };
}

// ---------------------------------------------------------------- shots

async function waitForServer(baseUrl, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const response = await fetch(baseUrl, { method: 'GET' });
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    if (Date.now() > deadline) throw new Error(`preview server never answered on ${baseUrl}`);
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}

async function withPreviewServer(baseUrl, run) {
  if (baseUrl) return run(baseUrl);
  if (!existsSync(path.join(repoRoot, 'dist/index.html'))) {
    throw new Error('dist/ is missing — run `npm run build` first, or pass --base-url');
  }
  const url = 'http://localhost:4173';
  const server = spawn('npm', ['run', 'preview'], { cwd: repoRoot, stdio: 'ignore' });
  try {
    await waitForServer(url);
    return await run(url);
  } finally {
    server.kill('SIGTERM');
  }
}

async function waitForRender(page, previousToken) {
  await page.waitForFunction(
    (prev) => document.body.dataset.renderedToken !== undefined && document.body.dataset.renderedToken !== prev,
    previousToken
  );
}

const renderToken = (page) => page.evaluate(() => document.body.dataset.renderedToken);

/** Same route a real drag settles on (tests/scene.spec.ts uses this too). `band` is a number or the literal 'beyond' (R-01b's extra slider stop). */
async function setBand(page, band) {
  const current = await page.evaluate(() => document.body.dataset.band);
  if (current === String(band)) return;
  const before = await renderToken(page);
  await page.locator('#headcount-slider').evaluate((el, value) => {
    const input = el;
    // 'beyond' isn't a numeric slider value — it's whatever sits at the
    // top of the range (src/ui/slider.ts sets input.max to it).
    input.value = value === 'beyond' ? input.max : String(value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, band);
  await waitForRender(page, before);
}

async function setState(page, state) {
  const button = page.locator('.toggle__button');
  const isWithout = (await button.getAttribute('aria-pressed')) === 'true';
  if ((state === 'without') === isWithout) return;
  const before = await renderToken(page);
  await button.click();
  await waitForRender(page, before);
}

/** Rewinds to the first close-up in stepper (= navigation) order, so a full forward walk visits every close-up in the band exactly once. Bounded by `maxSteps` as a safety net against an infinite loop if the stepper's boundary markup ever changes shape. */
async function gotoFirstCloseup(page, maxSteps) {
  const prev = page.locator('.scene-stepper__prev');
  for (let i = 0; i < maxSteps; i += 1) {
    if ((await prev.getAttribute('aria-disabled')) === 'true') return;
    const before = await renderToken(page);
    await prev.click();
    await waitForRender(page, before);
  }
  throw new Error('gotoFirstCloseup: never reached the start — stepper markup may have changed');
}

async function stepNext(page) {
  const before = await renderToken(page);
  await page.locator('.scene-stepper__next').click();
  await waitForRender(page, before);
}

/** The stepper's "whole floor" control: from a close-up it shows the parent room; from that room it returns to the same close-up (main.ts's `toggleWholeFloor`). Used both ways below — entering a room to shoot it, then leaving the same way to resume the stepper walk exactly where it left off. */
async function toggleWholeFloor(page) {
  const before = await renderToken(page);
  await page.locator('.scene-stepper__floor').click();
  await waitForRender(page, before);
}

/** The phone screen from the top of the page down to the bottom of the
 * scene, and no further. The cut is deliberate: below the scene sits the
 * R-14 checklist, which spells out in words exactly what every gag is.
 * A participant who can read that is not judging the picture any more. */
async function captureScreen(page, outFile) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const wrapBox = await page.locator('.scene-wrap').boundingBox();
  const height = Math.min(wrapBox.y + wrapBox.height, VIEWPORT.height);
  await page.screenshot({ path: outFile, clip: { x: 0, y: 0, width: VIEWPORT.width, height } });
}

/** The full phone viewport — used only for the Beyond capture, whose subject (the auto-opened panel) is a `position: fixed` overlay rather than part of `.scene-wrap`. */
async function captureViewport(page, outFile) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: outFile, clip: { x: 0, y: 0, width: VIEWPORT.width, height: VIEWPORT.height } });
}

/** Crop the phone screen around one gag's primary hotspot, scrolling the
 * scene wrap so the hotspot is actually on screen first. Sized from the
 * art-authored rect, with a floor so a small rect still prints big
 * enough to judge. Only valid while the close-up named by `gag.viewId`
 * is the one on screen — the capture loop guarantees that by walking the
 * stepper in order and cropping before it steps past a view. */
async function captureGagCrop(page, gag, outFile) {
  const canvasBox = await page.locator('#scene-canvas').boundingBox();
  const wrapBox = await page.locator('.scene-wrap').boundingBox();
  const bufferW = Number(await page.locator('#hotspots-layer').getAttribute('data-buffer-w'));
  const scale = canvasBox.width / bufferW;

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('.scene-wrap').evaluate(
    (wrap, { left, top }) => {
      wrap.scrollLeft = left;
      wrap.scrollTop = top;
    },
    {
      left: (gag.rect.x + gag.rect.w / 2) * scale - wrapBox.width / 2,
      top: (gag.rect.y + gag.rect.h / 2) * scale - wrapBox.height / 2,
    }
  );

  const button = page.locator(`.hotspot[data-hotspot-id="${gag.hotspotId}"]`);
  const box = await button.boundingBox();
  if (!box) throw new Error(`${gag.id}: primary hotspot ${gag.hotspotId} is not rendered`);
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  const MIN_CROP = 160; // CSS px — ~5 cm printed at 3x
  let width = Math.min(Math.max(gag.rect.w * scale, MIN_CROP), wrapBox.width);
  let height = Math.min(Math.max(gag.rect.h * scale, MIN_CROP), wrapBox.height);
  const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
  const clip = {
    x: clamp(centre.x - width / 2, wrapBox.x, wrapBox.x + wrapBox.width - width),
    y: clamp(centre.y - height / 2, wrapBox.y, wrapBox.y + wrapBox.height - height),
    width,
    height,
  };
  await page.screenshot({ path: outFile, clip });
}

const BEYOND_IMAGE = 'screenshots/A-beyond-panel.png';

async function capture(gags, sheets, closeupOrder, outDir, baseUrl) {
  const { chromium } = await import('@playwright/test');
  const shotsDir = path.join(outDir, 'screenshots');
  // Stale images are worse than missing ones: a band that has been
  // redrawn must not leave last month's picture behind.
  if (existsSync(shotsDir)) rmSync(shotsDir, { recursive: true });
  mkdirSync(shotsDir, { recursive: true });

  const skipped = [];
  await withPreviewServer(baseUrl, async (url) => {
    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: DEVICE_SCALE_FACTOR,
    });
    const page = await context.newPage();
    await page.goto(url);
    await page.waitForFunction(() => document.body.dataset.renderedToken !== undefined);

    for (const band of BANDS) {
      // Back to built before moving the slider, then into without: the
      // nudge ("Now see what this looks like without him") is revealed by
      // the first slider move and only cleared by a toggle click, so
      // changing band while already in without leaves that line sitting
      // over a picture that is already the without state. Harmless on the
      // site, wrong in a test image — a participant should not be told to
      // do something the picture says has been done.
      await setState(page, 'built');
      await setBand(page, band);
      await setState(page, 'without');

      const order = closeupOrder.get(band);
      await gotoFirstCloseup(page, order.length + 1);

      const capturedRooms = new Set();
      for (let i = 0; i < order.length; i += 1) {
        const viewId = await page.evaluate(() => document.body.dataset.view);
        const roomId = await page.evaluate(() => document.body.dataset.room);
        if (viewId !== order[i]) {
          throw new Error(`expected close-up ${order[i]} at step ${i} of band ${band}, the app is showing ${viewId}`);
        }

        if (!capturedRooms.has(roomId)) {
          capturedRooms.add(roomId);
          const sheet = sheets.find((s) => s.band === band && s.viewId === roomId);
          if (!sheet) throw new Error(`no room sheet for ${band}/${roomId}`);
          // "whole floor" from a close-up shows its parent room; pressed
          // again it returns to the exact close-up it was pressed from
          // (main.ts's `roomFromId`), so the stepper walk below resumes
          // undisturbed.
          await toggleWholeFloor(page);
          await captureScreen(page, path.join(outDir, sheet.image));
          await toggleWholeFloor(page);
        }

        for (const gag of gags.filter((g) => g.band === band && g.viewId === viewId)) {
          if (gag.placeholder) {
            skipped.push(gag.id);
            continue;
          }
          const file = `screenshots/B-gag-${gag.id}.png`;
          await captureGagCrop(page, gag, path.join(outDir, file));
          gag.image = file;
        }

        if (i < order.length - 1) await stepNext(page);
      }
    }

    // The 1,000+ stop (D-029, N-02): not a gag, not scored — the panel
    // opens itself over whatever the slider was last showing. Captured
    // for the facilitator's own context only; PROTOCOL.md and the sheet
    // do not ask a participant to name anything in it.
    await setBand(page, 'beyond');
    await captureViewport(page, path.join(outDir, BEYOND_IMAGE));

    await browser.close();
  });
  return skipped;
}

// ---------------------------------------------------------------- sheet

const GENERATED_BY = 'tools/hallway-test/build-kit.mjs';

function scoringSheet(gags, sheets, manifest) {
  const columns = Array.from({ length: PARTICIPANTS }, (_, i) => `P${i + 1}`);
  const out = [];
  const push = (...lines) => out.push(...lines);

  push(
    '# Hallway test — scoring sheet',
    '',
    `*Generated by \`${GENERATED_BY}\` on ${manifest.generatedAt} from ${manifest.commit}.`,
    'Do not hand-edit: re-run the script instead, or your edits vanish the next time a band',
    'lands. Fill in a **printed copy** (or a duplicate), not this file.*',
    '',
    `Read \`PROTOCOL.md\` first. Thresholds: a gag passes when **${PASS_AT} of ${PARTICIPANTS}** people name what is`,
    `wrong within **${GAG_SECONDS} seconds**; the toggle passes when **${PASS_AT} of ${PARTICIPANTS}** find and flip it`,
    `within **${TOGGLE_SECONDS} seconds**, unprompted.`,
    '',
    '---',
    '',
    '## Part B — the toggle (R-06a). Run this FIRST, on a phone, before any picture.',
    '',
    'Hand them the phone on the **built** state at the band nearest their own company size.',
    'Say only the words in `PROTOCOL.md` §2. Start the timer when they take the phone. Stop it',
    'when the picture changes to the without state. Do not point, do not hint, do not answer',
    '"what am I looking for?" with anything but "whatever you like".',
    '',
    `| P | Band shown | Found + flipped within ${TOGGLE_SECONDS}s? | Seconds | What they touched first | What they said |`,
    '|---|---|---|---|---|---|',
    ...columns.map((c) => `| ${c} |  | Y / N |  |  |  |`),
    '',
    `**Tally:** ____ / ${PARTICIPANTS} found it. Pass = ${PASS_AT}. If it fails, the nudge is redesigned`,
    'before Phase 2 (02-PHASES exit criteria) — file it to the Art Director and CEO, not to the',
    'copy. Note in the write-up whether Phase 2\'s nudge polish had already shipped when you ran',
    'this: if it had, a weak result means reworking that polish, not discovering it.',
    '',
    '---',
    '',
    '## Part A — the gags. One block per gag. Show only the image named in the block.',
    '',
    'The "key" line is **yours**, never theirs. Say nothing but `PROTOCOL.md` §3. Write down what',
    'they actually said, in their words — "the wifi is rubbish" and "nobody is looking after that"',
    'are different answers and the difference is the whole point.',
    '',
    `Scoring one cell: **Y** = they named the thing that is wrong within ${GAG_SECONDS} seconds, in any words.`,
    '**N** = silence, a guess about something else in the frame, or "I don\'t know". Describing the',
    'objects without the problem ("a desk with people around it") is **N**.',
    ''
  );

  let currentBand = null;
  for (const gag of gags) {
    if (gag.band !== currentBand) {
      currentBand = gag.band;
      const bandViews = sheets.filter((s) => s.band === currentBand);
      push(
        `### Band ${currentBand} — context sheet`,
        '',
        `Before this band's gags, show the whole screen for ${bandViews.length} room${
          bandViews.length === 1 ? '' : 's'
        }, ${GAG_SECONDS * 4}s each, and write`,
        'down anything they point at unprompted (that is the discovery signal — it is not scored):',
        '',
        ...bandViews.map((s) => `- \`${s.image}\` — ${s.viewLabel}`),
        '',
        'Unprompted, they said: ______________________________________________',
        ''
      );
    }
    push(`#### ${gag.id} — ${gag.viewLabel}`, '');
    if (gag.placeholder) {
      push(
        '> **Not drawn yet.** At capture time this gag was still a placeholder box, so there is no',
        '> picture to judge. Leave the row blank, re-run the kit once the art lands, and score it',
        '> then. It does not count for or against the band.',
        ''
      );
      continue;
    }
    push(
      `Show: \`${gag.image}\``,
      '',
      `*Key (do not read aloud): ${gag.without}*`,
      '',
      `| P | Named it in ${GAG_SECONDS}s? | What they said (verbatim) |`,
      '|---|---|---|',
      ...columns.map((c) => `| ${c} | Y / N |  |`),
      '',
      `Tally ____ / ${PARTICIPANTS} → **PASS** (≥ ${PASS_AT}) / **REDRAW**`,
      ''
    );
  }

  push(
    '---',
    '',
    '## Transcribe here when you are done',
    '',
    '| Gag | Band | View | Score | Pass? |',
    '|---|---|---|---|---|',
    ...gags.map(
      (g) =>
        `| ${g.id} | ${g.band} | ${g.viewLabel} | ${g.placeholder ? '— not drawn yet' : `___ / ${PARTICIPANTS}`} | ${
          g.placeholder ? 'n/a' : ' '
        } |`
    ),
    '',
    `Gags scored: ${gags.filter((g) => !g.placeholder).length} of ${gags.length}.`,
    gags.some((g) => g.placeholder)
      ? `Pending art: ${gags.filter((g) => g.placeholder).map((g) => g.id).join(', ')}.`
      : 'Every gag has art.',
    '',
    `Not scored, shown for context only if you like: \`${BEYOND_IMAGE}\` — the 1,000+ stop's`,
    'own panel (D-029). It carries no gag and is not part of either tally.',
    '',
    'Then fill in `RESULTS-TEMPLATE.md` and hand it to CEO. Anything under',
    `${PASS_AT}/${PARTICIPANTS} goes to the Art Director as a redraw with the verbatim answers attached — the`,
    'answers say what the picture is reading *as*, which is the note.',
    ''
  );
  return `${out.join('\n')}\n`;
}

// ----------------------------------------------------------------- main

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { gags, sheets, closeupOrder } = loadSceneData();
  mkdirSync(args.out, { recursive: true });

  let skipped = gags.filter((g) => g.placeholder).map((g) => g.id);
  if (args.sheetOnly) {
    // Keep whatever images are on disk: a sheet-only run after an edit to
    // the protocol should not silently orphan a capture.
    const shotsDir = path.join(args.out, 'screenshots');
    const present = existsSync(shotsDir) ? new Set(readdirSync(shotsDir)) : new Set();
    for (const gag of gags) {
      const file = `screenshots/B-gag-${gag.id}.png`;
      if (present.has(path.basename(file))) gag.image = file;
    }
  } else {
    skipped = await capture(gags, sheets, closeupOrder, args.out, args.baseUrl);
  }

  const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: repoRoot }).toString().trim();
  const manifest = {
    generatedAt: new Date().toISOString().slice(0, 10),
    commit,
    generatedBy: GENERATED_BY,
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    thresholds: { participants: PARTICIPANTS, passAt: PASS_AT, gagSeconds: GAG_SECONDS, toggleSeconds: TOGGLE_SECONDS },
    bandSheets: sheets,
    gags: gags.map(({ id, band, viewId, viewLabel, placeholder, image }) => ({
      id,
      band,
      viewId,
      viewLabel,
      placeholder,
      image,
    })),
    pendingArt: skipped,
    // D-029/N-02: the 1,000+ stop, not a gag and never part of pendingArt
    // — it has no primary hotspot to be a placeholder for.
    beyond: { image: BEYOND_IMAGE, scored: false },
  };
  writeFileSync(path.join(args.out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(path.join(args.out, 'SCORING-SHEET.md'), scoringSheet(gags, sheets, manifest));

  const scored = gags.length - skipped.length;
  console.log(
    `hallway kit: ${sheets.length} room sheets, ${scored} of ${gags.length} gags with art` +
      (skipped.length ? `, pending art: ${skipped.join(', ')}` : '') +
      ', plus the Beyond stop'
  );
  console.log(`  -> ${path.relative(repoRoot, args.out)}/SCORING-SHEET.md, manifest.json${args.sheetOnly ? '' : ', screenshots/'}`);
}

main().catch((error) => {
  console.error(`hallway kit failed: ${error.message}`);
  process.exit(1);
});
