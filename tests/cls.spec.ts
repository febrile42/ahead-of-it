import { expect, test, type Page } from '@playwright/test';
import * as H from './interaction-helpers';
import { interceptFixtureScenes } from './scene-source';

/** Records every layout-shift entry's raw sources (node identity + rect
 * delta), not just the summed value, so a CI failure's assertion message
 * can show *what* moved without anyone needing to reproduce it first. */
async function installClsObserver(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as {
      __clsValue: number;
      __clsSources: Array<{ node: string; prev: unknown; curr: unknown }>;
    };
    w.__clsValue = 0;
    w.__clsSources = [];
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as unknown as {
          value: number;
          sources?: Array<{ node?: Element; previousRect: unknown; currentRect: unknown }>;
        };
        w.__clsValue += shift.value;
        for (const source of shift.sources ?? []) {
          const node = source.node;
          w.__clsSources.push({
            node: node ? `${node.id ? `#${node.id}` : ''}${node.className ? `.${node.className}` : node.tagName}` : '(unknown)',
            prev: source.previousRect,
            curr: source.currentRect,
          });
        }
      }
    });
    observer.observe({ type: 'layout-shift', buffered: true });
  });
}

/** DIA-65 CI flake: a fixed wall-clock settle (`waitForTimeout`) assumes
 * every render's layout-shift entries land within that window. A congested
 * CI runner breaks that assumption — reproduced under CDP CPU throttling
 * (1x-16x): the always-present, already-covered first-load shift landed
 * late enough that a fixed 300/500ms settle missed it, so it got counted
 * against whichever step read `__clsValue` next instead of the step that
 * actually caused it (`band 750: room-tab switch to floor-2` in CI's case).
 * Polling for the value to stop changing across real animation frames
 * removes the wall-clock dependency entirely — it waits exactly as long as
 * the browser needs to finish dispatching entries, on any machine speed. */
async function settleCls(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const w = window as unknown as { __clsValue: number };
        let stableFrames = 0;
        let last = w.__clsValue;
        let frames = 0;
        function tick() {
          frames += 1;
          if (w.__clsValue === last) {
            stableFrames += 1;
          } else {
            stableFrames = 0;
            last = w.__clsValue;
          }
          // DIA-65 CI flake round 2: the dispatch of a layout-shift entry
          // is queued on the same main-thread task queue as rAF, so a
          // congested thread delays both together — but the margin still
          // needs to be wide enough that dispatch reliably wins the race
          // against a handful of otherwise-idle rAF ticks. 12 consecutive
          // unchanged frames (~200ms at 60fps, proportionally longer under
          // load, since each "frame" only advances once the thread is
          // actually free) replaces the original 5; the 480-frame cap is
          // still just a safety valve against a genuinely still-shifting
          // page, not a real-world limit.
          if (stableFrames >= 12 || frames >= 480) {
            resolve(w.__clsValue);
            return;
          }
          requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      })
  );
}

async function clsSources(page: Page): Promise<string> {
  const sources = await page.evaluate(
    () => (window as unknown as { __clsSources: unknown[] }).__clsSources
  );
  return sources.length ? ` — sources: ${JSON.stringify(sources)}` : '';
}

// PH1-09/D-035: the default band (80) needs a real scene file to measure
// CLS/scroll against something other than the "not drawn yet" placeholder.
// `interceptFixtureScenes` (tests/scene-source.ts) only serves the
// hand-written fixture when public/sprites/scenes/ doesn't exist yet — it
// never masks a real export.

// PH1-04 review S1/S2: everything above the canvas (slider, readout,
// ticks, toggle, tagline) used to be built by JS into empty roots, and the
// canvas started at the browser default 300x150 before main.ts sized it —
// together a measured 0.2147 CLS at 4x CPU / 1.6 Mbps throttling, even
// though the Lighthouse lab run (simulated throttling, Lantern) passed
// with CLS 0 because the bundle ran before first paint under simulation.
// Real throttling — CDP CPU + network emulation on a real Chromium — is
// the only way to catch this, hence its own file. The pinned CHROME_PATH
// binary (so this shares one Chromium with Lighthouse in CI) lives on the
// `chromium` project in playwright.config.ts, not a file-level test.use
// here — a file-level override applied to every test in this file
// regardless of project, so under `webkit-iphone` it launched the Chrome
// binary through WebKit's launch protocol and crashed (DIA-15 follow-up).

const VIEWPORT = { width: 390, height: 844 };

test.describe('CLS under throttling (PH1-04 review S1)', () => {
  test('cumulative layout shift stays under 0.1 at 390px, 4x CPU / 1.6 Mbps', async ({ page, browserName }) => {
    // DIA-18: newCDPSession is a Chromium-only API (line 16-18's own
    // rationale for real CDP throttling already assumes Chromium) — on
    // the webkit-iphone project this throws before the test can even
    // start, which isn't a DPR/rendering bug, just the wrong engine for
    // this technique. There's no WebKit equivalent to emulate CPU/network
    // throttling from Playwright, so skip rather than fake a result.
    test.skip(browserName !== 'chromium', 'CDP throttling is Chromium-only; not testable on WebKit');
    const client = await page.context().newCDPSession(page);
    await client.send('Network.enable');
    // ~1.6 Mbps down / 750 Kbps up, 150ms latency — the review's own
    // throttling profile.
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    // Installed before navigation so it catches every shift from first
    // paint onward, not just ones after the test script gets control back.
    await page.addInitScript(() => {
      const w = window as unknown as { __clsValue: number };
      w.__clsValue = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as unknown as { hadRecentInput: boolean; value: number };
          if (!shift.hadRecentInput) {
            w.__clsValue += shift.value;
          }
        }
      });
      observer.observe({ type: 'layout-shift', buffered: true });
    });

    await interceptFixtureScenes(page);
    await page.setViewportSize(VIEWPORT);
    await page.goto('/', { timeout: 60_000 });
    await page.waitForFunction(() => document.body.dataset.renderedToken !== undefined, { timeout: 60_000 });
    // A little past first render so any trailing shift settles before we
    // read the total (the review notes even an excluded, input-driven
    // shift "still jumps" visually, so this window is intentionally short).
    await page.waitForTimeout(500);

    const cls = await page.evaluate(() => (window as unknown as { __clsValue: number }).__clsValue);
    expect(cls).toBeLessThan(0.1);
  });
});

// DIA-83 review round 2: the throttled test above asserts <0.1, a threshold
// wide enough to hide the real, unthrottled, non-simulated shift Lighthouse's
// raised `cumulative-layout-shift <= 0` gate caught (0.01145 on #scene-wrap,
// every gated URL, CI's own Chromium — a font-fallback-driven wrap, not a
// timing race, so no throttling is needed to reproduce it: the offending
// text either wraps to an extra line on the page's actual font or it
// doesn't). This asserts exactly 0 at normal speed, on the exact three URLs
// Lighthouse gates (`lighthouserc.cjs`'s `collect.url`) via D-043's URL read
// — so a future regression here fails a fast unthrottled Playwright run
// instead of only a 3-run Lighthouse CI step ~15 minutes later.
test.describe('CLS is exactly 0 on first load, unthrottled (DIA-83 review round 2)', () => {
  for (const [label, path] of [
    ['band 80 (default)', '/'],
    ['band 750, built', '/?n=750&it=built'],
    ['band 750, without', '/?n=750&it=none'],
  ] as const) {
    test(`${label}: first paint through settle measures 0 layout shift`, async ({ page }) => {
      await installClsObserver(page);
      await interceptFixtureScenes(page);
      await page.setViewportSize(VIEWPORT);
      await page.goto(path);
      await page.waitForFunction(() => document.body.dataset.renderedToken !== undefined);
      const cls = await settleCls(page);
      expect(cls, `first load (${label}): expected 0 layout shift, measured ${cls}${await clsSources(page)}`).toBe(0);
    });
  }
});

// DIA-175: the 390px CLS gate above never exercised the narrowest
// phone-first target. At 320px content.json's actual intro copy wraps to a
// 5th line, one more than .app__intro's min-height used to reserve
// (style.css), so the block grew after first paint on that width alone —
// a real, measured shift the 390px-only run could never catch. Same three
// Lighthouse-gated URLs as the block above, just at 320px.
const VIEWPORT_320 = { width: 320, height: 844 };
test.describe('CLS is exactly 0 on first load at 320px, unthrottled (DIA-175)', () => {
  for (const [label, path] of [
    ['band 80 (default)', '/'],
    ['band 750, built', '/?n=750&it=built'],
    ['band 750, without', '/?n=750&it=none'],
  ] as const) {
    test(`${label}: first paint through settle measures 0 layout shift at 320px`, async ({ page }) => {
      await installClsObserver(page);
      await interceptFixtureScenes(page);
      await page.setViewportSize(VIEWPORT_320);
      await page.goto(path);
      await page.waitForFunction(() => document.body.dataset.renderedToken !== undefined);
      const cls = await settleCls(page);
      expect(cls, `first load at 320px (${label}): expected 0 layout shift, measured ${cls}${await clsSources(page)}`).toBe(0);
    });
  }
});

// Review fix (DIA-46 item 3): the test above only measures first load. The
// brief's own acceptance line is "switching views and bands measures 0" —
// sizeAndPositionCanvas keeps .scene-wrap's box, the tab row and the
// stepper row at a constant height across every view/band/state (D-042a),
// so this locks that in rather than leaving it merely true by inspection.
//
// DIA-51 review: every step here is a click or keypress, so a plain
// hadRecentInput filter can never fail on a real click-driven shift —
// Chrome itself marks the toggle's own layout-shift entry hadRecentInput:
// true and the guard below used to throw it away, even though the tagline
// collapsing and the scene jumping 29px is fully visible to whoever pressed
// the button. Counting every entry, unfiltered, is what actually caught it.
test.describe('CLS across view and band switches stays 0 (DIA-46 item 3)', () => {
  test('stepping, whole floor, a room tab, the toggle, and band 750<->80 all measure zero shift', async ({ page }) => {
    await installClsObserver(page);

    await interceptFixtureScenes(page);
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await page.waitForFunction(() => document.body.dataset.renderedToken !== undefined);
    await settleCls(page); // let the first-load shift (covered above) settle before measuring deltas

    async function clsOf(action: () => Promise<unknown>, label: string): Promise<void> {
      await page.evaluate(() => {
        (window as unknown as { __clsValue: number; __clsSources: unknown[] }).__clsValue = 0;
        (window as unknown as { __clsValue: number; __clsSources: unknown[] }).__clsSources = [];
      });
      await action();
      const cls = await settleCls(page);
      expect(cls, `${label}: expected 0 layout shift, measured ${cls}${await clsSources(page)}`).toBe(0);
    }

    await H.setBand(page, 750);
    await clsOf(() => H.step(page, 1), 'stepping to the next close-up');
    await clsOf(() => H.toggleWholeFloor(page), 'entering the room view');
    const rooms = await H.roomIds(page);
    const current = await H.currentRoomId(page);
    const otherRoom = rooms.find((r) => r !== current) ?? rooms[0];
    await clsOf(() => H.setRoom(page, otherRoom), `switching to room tab ${otherRoom}`);
    await clsOf(() => H.setState(page, 'without'), 'toggling to the without state');
    await clsOf(() => H.setBand(page, 80), 'switching band 750 -> 80');
    await clsOf(() => H.setBand(page, 750), 'switching band 80 -> 750');
    await clsOf(() => H.setState(page, 'built'), 'toggling back to the built state');
  });
});

// DIA-65: the test above only exercised band 750's own close-up<->room and
// tab switches, plus band 750<->80. `#hotspots-layer` was resized *and*
// repositioned (`style.left`) to track the canvas's centred box on every
// view change (src/main.ts's sizeAndPositionCanvas) — any view that doesn't
// fill the full .scene-wrap box moves the layer's own left edge, and Chrome
// counts that as a shift regardless of hadRecentInput (DIA-51 review, same
// as above). This covers it for *every* band the app can currently draw
// (`numericTestableBands()` — whatever `tests/fixtures/` or a landed real
// export currently provides, so this starts asserting more bands the moment
// more scene files land, no change needed here), both directions of a
// close-up<->room switch, a room-tab switch, and a full walk of every
// adjacent band pair in both directions (including the bands that only ever
// render the "not drawn yet" placeholder — that placeholder box must not
// move either).
test.describe('CLS is exactly 0 across every band/view switch (DIA-65)', () => {
  test('close-up<->room, a room-tab switch per drawn band, and every adjacent band pair (forward and back) measure zero shift', async ({
    page,
  }) => {
    await installClsObserver(page);

    await interceptFixtureScenes(page);
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await page.waitForFunction(() => document.body.dataset.renderedToken !== undefined);
    await settleCls(page); // let the first-load shift (covered above) settle before measuring deltas

    async function clsOf(action: () => Promise<unknown>, label: string): Promise<void> {
      await page.evaluate(() => {
        (window as unknown as { __clsValue: number; __clsSources: unknown[] }).__clsValue = 0;
        (window as unknown as { __clsValue: number; __clsSources: unknown[] }).__clsSources = [];
      });
      await action();
      const cls = await settleCls(page);
      expect(cls, `${label}: expected 0 layout shift, measured ${cls}${await clsSources(page)}`).toBe(0);
    }

    for (const band of H.numericTestableBands()) {
      await clsOf(() => H.setBand(page, band), `band ${band}: switching to it`);
      // D-051: band 80's own fresh load can land on the room view (every
      // other band already lands on its close-up via setBand's fallback) —
      // normalise to a close-up first so the labelled sequence below is
      // accurate for every band, not just measured as net-zero by accident.
      await H.ensureCloseup(page);
      await clsOf(() => H.toggleWholeFloor(page), `band ${band}: close-up -> room`);
      await clsOf(() => H.toggleWholeFloor(page), `band ${band}: room -> close-up`);
      const rooms = await H.roomIds(page);
      const current = await H.currentRoomId(page);
      const otherRoom = rooms.find((r) => r !== current) ?? rooms[0];
      await clsOf(() => H.setRoom(page, otherRoom), `band ${band}: room-tab switch to ${otherRoom}`);
    }

    for (const band of H.BAND_ORDER) {
      await clsOf(() => H.setBand(page, band), `band walk forward -> ${band}`);
    }
    for (const band of [...H.BAND_ORDER].reverse()) {
      await clsOf(() => H.setBand(page, band), `band walk backward -> ${band}`);
    }
  });
});

// DIA-176: the without state left ~80px of dead space under the toggle —
// .toggle__subtitle only ever renders in built, and .toggle__nudge is a
// one-shot that's usually already spent, but both permanently reserve
// worst-case-2-lines forever (DIA-51/DIA-83), so their box can never
// shrink or collapse per state or session history without reintroducing
// the exact shift those two fixes eliminated (confirmed against this
// suite's own unfiltered CLS observer — DIA-46 item 3 measures every real
// layout-shift entry, not just ones a `hadRecentInput` filter would keep).
//
// Round 1 only tightened the constant spacing around the reservation and
// left the review round unconvinced (still ~95px of blank space reading as
// a hole on the landing frame). Round 2 (this test) instead removes the
// double-reservation: .toggle__subtitle and .toggle__nudge never render at
// once (src/ui/toggle.ts hides the subtitle whenever the nudge is visible),
// so style.css's .toggle__message overlaps both on one grid cell — the
// reserved height becomes max(subtitle, nudge) instead of their sum, a
// constant in every state exactly like before, just half the size.
test.describe('the toggle has no dead space under it once reserved lines are blank (DIA-176)', () => {
  test('.toggle keeps a constant height across built, without, and nudge-visible', async ({ page }) => {
    await interceptFixtureScenes(page);
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await page.waitForFunction(() => document.body.dataset.renderedToken !== undefined);

    const heightOf = (selector: string) =>
      page.evaluate((sel) => document.querySelector(sel)!.getBoundingClientRect().height, selector);

    const builtHeight = await heightOf('#toggle-root');
    // Toggled with a real click, same as a visitor's first tap — never
    // having moved the slider first, so the nudge is still in its
    // never-shown, fully-reserved state (the worst case for this element).
    await H.setState(page, 'without');
    const withoutHeight = await heightOf('#toggle-root');
    expect(withoutHeight, '.toggle-root must not resize when the subtitle blanks out').toBe(builtHeight);

    await H.setState(page, 'built');
    await page.locator('#headcount-slider').fill('360'); // R-06a: first slider move shows the nudge
    const nudgeVisibleHeight = await heightOf('#toggle-root');
    expect(nudgeVisibleHeight, '.toggle-root must not resize when the nudge takes the subtitle place').toBe(
      builtHeight
    );

    // The reserved slot itself must be sized to one item (max), never two
    // stacked — this is the regression this round of DIA-176 fixes. The
    // pre-fix layout stacked two calc(1.2em * 2) boxes plus two margins,
    // which measured ~80px on top of the button; a single shared slot at
    // 1rem font-size measures ~38-40px depending on the platform's exact
    // font metrics (DIA-83) — bounding it well under the old double-height
    // catches a reversion without pinning a brittle exact pixel value.
    const messageHeight = await heightOf('.toggle__message');
    expect(messageHeight, '.toggle__message must reserve one item, not two stacked').toBeLessThan(50);

    // The gap is now bounded by the toggle's own bottom padding plus a 1px
    // divider — not that plus a whole second blank reserved line on top,
    // which is what made it read as dead space.
    const [paddingBottom, borderBottomWidth] = await page.evaluate(() => {
      const style = getComputedStyle(document.querySelector('.toggle')!);
      return [parseFloat(style.paddingBottom), parseFloat(style.borderBottomWidth)];
    });
    expect(paddingBottom, 'DIA-176 tightened .toggle bottom padding to 0.5rem (8px)').toBe(8);
    expect(borderBottomWidth, 'DIA-176 gives the reserved space a visible boundary instead of reading as empty').toBe(
      1
    );

    const gap = await page.evaluate(() => {
      const toggleRoot = document.querySelector('#toggle-root')!.getBoundingClientRect();
      const sceneViews = document.querySelector('#scene-views')!.getBoundingClientRect();
      return sceneViews.top - toggleRoot.bottom;
    });
    expect(gap, 'scene-views should sit directly against .toggle-root, no extra gap beyond it').toBe(0);
  });

  // Review round 2: the one path where `state === 'built'` (subtitle's own
  // trigger) and the nudge can both want to show is the R-10 `?it=built`
  // deep link, landed in built, then the visitor moves the slider. The
  // subtitle must yield to the nudge rather than both painting into the
  // same grid cell at once.
  test('deep-linked into built: the nudge takes the shared slot instead of overlapping the subtitle', async ({
    page,
  }) => {
    await interceptFixtureScenes(page);
    await page.setViewportSize(VIEWPORT);
    await page.goto('/?n=80&it=built');
    await page.waitForFunction(() => document.body.dataset.renderedToken !== undefined);

    await expect(page.locator('.toggle__button')).toHaveAttribute('data-state', 'built');
    const subtitleVisibleBefore = await page
      .locator('.toggle__subtitle')
      .evaluate((el) => getComputedStyle(el).visibility);
    expect(subtitleVisibleBefore, 'subtitle renders normally in built, before the nudge has any reason to show').toBe(
      'visible'
    );

    await page.locator('#headcount-slider').fill('360');

    const [subtitleVisibility, subtitleAriaHidden, nudgeVisibility] = await Promise.all([
      page.locator('.toggle__subtitle').evaluate((el) => getComputedStyle(el).visibility),
      page.locator('.toggle__subtitle').getAttribute('aria-hidden'),
      page.locator('.toggle__nudge').evaluate((el) => getComputedStyle(el).visibility),
    ]);
    expect(subtitleVisibility, 'the subtitle must yield the shared slot to the nudge').toBe('hidden');
    expect(subtitleAriaHidden, 'a visually hidden subtitle must also be hidden from assistive tech').toBe('true');
    expect(nudgeVisibility, 'the nudge takes the slot the subtitle just gave up').toBe('visible');

    // Once the visitor toggles, the nudge is spent for the session and the
    // subtitle goes back to depending on state alone (still built here).
    await H.setState(page, 'without');
    await H.setState(page, 'built');
    const [subtitleVisibilityAfter, nudgeVisibilityAfter] = await Promise.all([
      page.locator('.toggle__subtitle').evaluate((el) => getComputedStyle(el).visibility),
      page.locator('.toggle__nudge').evaluate((el) => getComputedStyle(el).visibility),
    ]);
    expect(subtitleVisibilityAfter, 'the subtitle returns once the nudge is spent').toBe('visible');
    expect(nudgeVisibilityAfter, 'the nudge stays spent for the rest of the session').toBe('hidden');
  });
});

test.describe('no page-level horizontal scroll at 390px (PH1-04 review S2)', () => {
  test('documentElement.scrollWidth equals the viewport width', async ({ page }) => {
    await interceptFixtureScenes(page);
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await page.waitForFunction(() => document.body.dataset.renderedToken !== undefined);

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBe(VIEWPORT.width);
  });
});

// Fix round item 7 / review fix 4: chooseScale now takes the *smaller* of
// the width- and height-derived integer scales, so a view can't earn a
// scale on width alone that makes it taller than .scene-wrap's own
// 360:240-capped box — which would otherwise force an internal vertical
// scrollbar inside the scene (as opposed to the page-level horizontal
// scroll case above, which is allowed). Checked at three real device
// profiles named in the fix-round brief.
test.describe('no internal vertical scroll inside .scene-wrap (fix round item 7)', () => {
  const profiles = [
    { label: '360 CSS width, DPR 3', width: 360, deviceScaleFactor: 3 },
    { label: '390 CSS width, DPR 3', width: 390, deviceScaleFactor: 3 },
    { label: '412 CSS width, DPR 2.625', width: 412, deviceScaleFactor: 2.625 },
  ];

  for (const profile of profiles) {
    test(`${profile.label}: .scene-wrap has no internal vertical overflow`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: profile.width, height: 900 },
        deviceScaleFactor: profile.deviceScaleFactor,
      });
      const page = await context.newPage();
      try {
        await interceptFixtureScenes(page);
        await page.goto('/');
        await page.waitForFunction(() => document.body.dataset.renderedToken !== undefined);

        const overflow = await page.locator('#scene-wrap').evaluate((el) => ({
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
        }));
        expect(
          overflow.scrollHeight,
          `${profile.label}: scene-wrap scrollHeight (${overflow.scrollHeight}) should not exceed its clientHeight (${overflow.clientHeight})`
        ).toBeLessThanOrEqual(overflow.clientHeight);
      } finally {
        await context.close();
      }
    });
  }
});
