// PH2-04 step 2 (DIA-83): the Playwright half of the perf harness. R-23
// (first meaningful render < 1.5s, first band < 600KB, sprites lazy-load
// per band) and the Phase 2 exit criterion "switch flip on every band at
// 390px under 100ms perceived". lighthouserc.cjs covers the lab-simulated
// numbers (LCP, transfer, CLS); this file covers what only a real browser
// under real CPU throttling can measure — the click-to-commit latency of
// the built/without toggle, and confirms band 80 never fetches a scene or
// sprite that only a larger band uses.
//
// Step 3 (fixing whatever this catches) is out of scope here — it waits on
// PH2-01..03 merging, since it is their motion cost being measured. This
// file only has to prove the harness works and report today's numbers.
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import * as H from './interaction-helpers';
import { hasRealScenes, readIndex, sceneSourceDir } from './scene-source';

const VIEWPORT = { width: 390, height: 844 };

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Click-to-commit latency of the built/without toggle, measured entirely
 * in-page with `performance.now()` so no Playwright IPC round-trip is
 * counted against the app's own budget. `document.body.dataset.renderedToken`
 * is the existing render-commit signal every other spec in this suite
 * already relies on (tests/cls.spec.ts, tests/interaction-helpers.ts) — the
 * brief's own boundaries reserve src/** edits for the D-043 URL read and
 * for named harness fixes, so this reuses that hook instead of adding a
 * new `performance.mark` call to src/main.ts.
 */
async function measureToggleFlip(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const button = document.querySelector<HTMLButtonElement>('.toggle__button')!;
        const prevToken = document.body.dataset.renderedToken;
        const observer = new MutationObserver(() => {
          const token = document.body.dataset.renderedToken;
          if (token !== undefined && token !== prevToken) {
            observer.disconnect();
            resolve(performance.now() - start);
          }
        });
        observer.observe(document.body, { attributes: true, attributeFilter: ['data-rendered-token'] });
        const start = performance.now();
        button.click();
      })
  );
}

test.describe('switch-flip timing under 4x CPU throttle (PH2-04 step 2)', () => {
  test('every drawn band flips both ways in under 100ms (median of 5)', async ({ page, browserName }) => {
    // DIA-18/cls.spec.ts: CDP CPU throttling is a Chromium-only API.
    test.skip(browserName !== 'chromium', 'CDP throttling is Chromium-only; not testable on WebKit');
    test.skip(!hasRealScenes(), 'needs the real schema-2 export to measure a real toggle cost');

    const client = await page.context().newCDPSession(page);
    await client.send('Network.enable');
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    await H.openApp(page, { viewport: VIEWPORT });

    const rows: Array<{ band: string; direction: string; median: number; samples: number[] }> = [];

    for (const band of H.testableBands()) {
      await H.setBand(page, band);
      if ((await H.currentState(page)) !== 'built') await H.setState(page, 'built');

      const toWithout: number[] = [];
      const toBuilt: number[] = [];
      for (let i = 0; i < 5; i += 1) {
        toWithout.push(await measureToggleFlip(page));
        toBuilt.push(await measureToggleFlip(page));
      }
      rows.push({ band: String(band), direction: 'built → without', median: median(toWithout), samples: toWithout });
      rows.push({ band: String(band), direction: 'without → built', median: median(toBuilt), samples: toBuilt });
    }

    // Acceptance line: "the perf spec's table (band × direction → median
    // ms) is in the PR". Printed here so a CI run's log carries it too.
    // eslint-disable-next-line no-console
    console.log(
      ['\nswitch-flip median ms (4x CPU throttle, 390px)', 'band\tdirection\tmedian ms\tsamples']
        .concat(rows.map((r) => `${r.band}\t${r.direction}\t${r.median.toFixed(1)}\t${r.samples.map((s) => s.toFixed(1)).join(', ')}`))
        .join('\n')
    );

    for (const row of rows) {
      expect(
        row.median,
        `band ${row.band} ${row.direction}: median ${row.median.toFixed(1)}ms, samples [${row.samples.map((s) => s.toFixed(1)).join(', ')}]`
      ).toBeLessThan(100);
    }
  });
});

// ---------------------------------------------------------------------------
// lazy per band
// ---------------------------------------------------------------------------

interface RawSceneEntry {
  sprite: string;
}
interface RawSceneView {
  entries?: RawSceneEntry[];
}
interface RawSceneFile {
  views: RawSceneView[];
}
interface SpriteManifestEntry {
  frames: Record<string, Array<{ file: string }>>;
}

function spriteNamesIn(file: RawSceneFile): Set<string> {
  const names = new Set<string>();
  for (const view of file.views) {
    for (const entry of view.entries ?? []) names.add(entry.sprite);
  }
  return names;
}

function readRawScene(fileName: string): RawSceneFile {
  return JSON.parse(readFileSync(`${sceneSourceDir()}${fileName}`, 'utf-8')) as RawSceneFile;
}

test.describe('lazy per band (PH2-04 step 2 / R-23)', () => {
  test('band 80 fetches no scene file or sprite that only a larger band uses', async ({ page }) => {
    test.skip(!hasRealScenes(), 'needs the real schema-2 export to compare against');

    const index = readIndex();
    const higherBandFiles = Object.entries(index.bands)
      .filter(([band]) => band !== '80')
      .flatMap(([, files]) => [files.built, files.without]);

    const band80Sprites = new Set([
      ...spriteNamesIn(readRawScene(index.bands['80'].built)),
      ...spriteNamesIn(readRawScene(index.bands['80'].without)),
    ]);
    const higherOnlySprites = new Set<string>();
    for (const file of higherBandFiles) {
      for (const name of spriteNamesIn(readRawScene(file))) {
        if (!band80Sprites.has(name)) higherOnlySprites.add(name);
      }
    }

    const manifest = JSON.parse(readFileSync('public/sprites/manifest.json', 'utf-8')) as Record<
      string,
      SpriteManifestEntry
    >;
    const higherOnlyFiles = new Set<string>();
    for (const name of higherOnlySprites) {
      for (const frames of Object.values(manifest[name]?.frames ?? {})) {
        for (const frame of frames) higherOnlyFiles.add(frame.file);
      }
    }

    const requestedPaths: string[] = [];
    page.on('request', (req) => {
      requestedPaths.push(new URL(req.url()).pathname);
    });

    await H.openApp(page, { viewport: VIEWPORT });
    await page.waitForLoadState('networkidle');

    for (const file of higherBandFiles) {
      expect(
        requestedPaths.some((p) => p.endsWith(`/sprites/scenes/${file}`)),
        `band 80's load fetched ${file}, a band-> 80 scene file`
      ).toBe(false);
    }
    for (const file of higherOnlyFiles) {
      expect(
        requestedPaths.some((p) => p.endsWith(`/sprites/${file}`)),
        `band 80's load fetched ${file}, a sprite only a band > 80 uses`
      ).toBe(false);
    }
  });
});
