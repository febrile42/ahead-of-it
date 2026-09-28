// DIA-160 (DIA-118 reopen): tests/dark-mode.spec.ts's contrast check samples
// three elements (body text, the toggle label, one focus ring). That sample
// missed DIA-131's punch-list button/sheet going in with a hardcoded `#fff`
// background (1.00-1.18:1 against `--ink` text in dark mode, see D-046/D-047)
// because nothing walked the actual DOM. This spec replaces the sample with a
// sweep: every element carrying a direct text node, in both colour schemes,
// at two viewports, across five states a visitor actually reaches, checked
// against WCAG 2.x AA (4.5:1, or 3:1 for large text) plus a 3:1 floor for
// control (button) borders against the page background.
//
// Deliberately not scoped to "known good" elements or an allowlist — the
// entire point is to catch a background/foreground pair nobody thought to
// sample, the same way DIA-131's punch list slipped through the old test.
import { expect, test } from '@playwright/test';
import { openApp, openFirstHotspot, openPunchList, setBand, setState } from './interaction-helpers';

const VIEWPORTS = [
  { label: '390x844', width: 390, height: 844 },
  { label: '1280x800', width: 1280, height: 800 },
] as const;

const COLOR_SCHEMES = ['light', 'dark'] as const;

type SweepState = 'landing' | 'without' | 'punch-list-open' | 'gag-panel-open' | 'band-1000-plus';

const STATES: SweepState[] = ['landing', 'without', 'punch-list-open', 'gag-panel-open', 'band-1000-plus'];

async function reachState(page: import('@playwright/test').Page, state: SweepState): Promise<void> {
  switch (state) {
    case 'landing':
      return;
    case 'without':
      await setState(page, 'without');
      return;
    case 'punch-list-open':
      await openPunchList(page);
      return;
    case 'gag-panel-open':
      await openFirstHotspot(page);
      return;
    case 'band-1000-plus':
      await setBand(page, 'beyond');
      return;
  }
}

/**
 * Runs entirely inside the page (must be self-contained: no closures over
 * outer-scope values, only `document`/`getComputedStyle`, per
 * `page.evaluate`'s serialization boundary).
 *
 * Text pass: every `body *` with a direct, non-empty text-node child.
 * Resolves the effective background by walking up to the first ancestor
 * whose own `background-color` has alpha > .5 (mirrors the product lead's
 * audit script) — an element painted on a transparent/near-transparent
 * background is judged against whatever a visitor would actually see behind
 * it, not its own (invisible) declared background.
 *
 * Large-text exemption (WCAG 2.x): >=24px any weight, or >=18.66px
 * (~14pt) at font-weight >=700 (matches CSS `font-weight: bold`, 700).
 *
 * Border pass: every visible page-chrome button/input/[role=button]/
 * [role=tab] (scene-painted `.hotspot`s excluded — see the loop below) with
 * a >=1px border, checked against the same effective background the text
 * pass uses (WCAG 1.4.11's "adjacent colour" is whatever is actually behind
 * the boundary, e.g. a raised panel/sheet surface, not always document.body).
 */
function sweepPage(): {
  textFailures: Array<{
    selector: string;
    text: string;
    fg: string;
    bg: string;
    ratio: number;
    threshold: number;
    fontSize: string;
    fontWeight: string;
  }>;
  borderFailures: Array<{ selector: string; border: string; bg: string; ratio: number }>;
} {
  type RGBA = { r: number; g: number; b: number; a: number };

  function parseColor(value: string): RGBA | null {
    const match = value.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/);
    if (!match) return null;
    return {
      r: Number(match[1]),
      g: Number(match[2]),
      b: Number(match[3]),
      a: match[4] !== undefined ? Number(match[4]) : 1,
    };
  }

  function luminance(c: RGBA): number {
    const channel = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
  }

  function ratio(a: RGBA, b: RGBA): number {
    const la = luminance(a);
    const lb = luminance(b);
    const [hi, lo] = la > lb ? [la, lb] : [lb, la];
    return (hi + 0.05) / (lo + 0.05);
  }

  function rgbString(c: RGBA): string {
    return `rgb(${c.r}, ${c.g}, ${c.b})`;
  }

  /** Alpha-composites `fg` over opaque `bg` — a `rgba()` border/text colour
   * renders as this blend, not as its own raw r/g/b, so a ratio computed
   * against the raw channel values (ignoring alpha) understates how much a
   * translucent colour actually washes out against what's behind it. */
  function composite(fg: RGBA, bg: RGBA): RGBA {
    return {
      r: fg.r * fg.a + bg.r * (1 - fg.a),
      g: fg.g * fg.a + bg.g * (1 - fg.a),
      b: fg.b * fg.a + bg.b * (1 - fg.a),
      a: 1,
    };
  }

  function effectiveBackground(el: Element): RGBA {
    for (let e: Element | null = el; e; e = e.parentElement) {
      const c = parseColor(getComputedStyle(e).backgroundColor);
      if (c && c.a > 0.5) return c;
    }
    return parseColor(getComputedStyle(document.body).backgroundColor) ?? { r: 255, g: 255, b: 255, a: 1 };
  }

  function isLargeText(fontSizePx: string, fontWeight: string): boolean {
    const px = parseFloat(fontSizePx);
    const weight = parseInt(fontWeight, 10) || 400;
    if (px >= 24) return true;
    return px >= 18.66 && weight >= 700;
  }

  function describeEl(el: Element): string {
    const id = el.id ? `#${el.id}` : '';
    const raw = typeof (el as HTMLElement).className === 'string' ? (el as HTMLElement).className : '';
    const cls = raw.trim().length ? `.${raw.trim().split(/\s+/).join('.')}` : '';
    return `${el.tagName.toLowerCase()}${id}${cls}`;
  }

  function isHiddenAncestry(el: Element): boolean {
    return el.closest('.sr-only, [hidden], .checklist__panel--collapsed') !== null;
  }

  const textFailures: ReturnType<typeof sweepPage>['textFailures'] = [];
  for (const el of document.querySelectorAll('body *')) {
    const hasDirectText = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? '').trim().length > 0);
    if (!hasDirectText) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (cs.clip === 'rect(0px, 0px, 0px, 0px)') continue;
    if (isHiddenAncestry(el)) continue;

    const fg = parseColor(cs.color);
    if (!fg) continue;
    const bg = effectiveBackground(el);
    // Composited, not raw fg: a few rules here use rgba() text colour
    // (e.g. opacity-based muted text), and the raw channel values alone
    // would understate how much that washes out against `bg`. This does
    // not additionally flatten ancestor `opacity` (a CSS property on the
    // element itself, distinct from an rgba() alpha channel) — a known,
    // documented gap shared with the audit script this sweep replaces.
    const cr = ratio(composite(fg, bg), bg);
    const large = isLargeText(cs.fontSize, cs.fontWeight);
    const threshold = large ? 3 : 4.5;
    if (cr < threshold) {
      textFailures.push({
        selector: describeEl(el),
        text: (el.textContent ?? '').trim().slice(0, 60),
        fg: cs.color,
        bg: rgbString(bg),
        ratio: Math.round(cr * 100) / 100,
        threshold,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
      });
    }
  }

  const borderFailures: ReturnType<typeof sweepPage>['borderFailures'] = [];
  for (const el of document.querySelectorAll('button, input, [role="button"], [role="tab"]')) {
    // Scene-painted hotspots are excluded: they are not page chrome, their
    // border sits over the canvas/mat (not "the page"), and D-047
    // deliberately compensates their low-contrast dashed border with a
    // box-shadow halo in dark mode — a boundary this computed-style check
    // cannot see (box-shadow is not `border`), so including them here would
    // flag a known, already-mitigated design choice as a false positive.
    if (el.classList.contains('hotspot')) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (isHiddenAncestry(el)) continue;
    const widths = [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth].map(parseFloat);
    if (Math.max(...widths) < 1) continue;
    const borderColor = parseColor(cs.borderTopColor);
    if (!borderColor || borderColor.a <= 0) continue;
    // Against what's *outside* the control (starting the walk at the
    // parent, not the element itself) — WCAG 1.4.11 asks whether the
    // boundary is distinguishable from what's adjacent to it. Starting at
    // `el` (as the text pass does, correctly, for its own foreground/
    // background pair) would instead measure the border against the
    // element's own fill, which is a different question and false-positives
    // on any control whose *selected* fill happens to equal --ink (e.g.
    // `.scene-views__button[aria-selected='true']`) — its border is drawn
    // in that same colour by design, and the element trivially "fails"
    // against itself while remaining perfectly visible against the page.
    const bg = effectiveBackground(el.parentElement ?? el);
    const cr = ratio(composite(borderColor, bg), bg);
    if (cr < 3) {
      borderFailures.push({
        selector: describeEl(el),
        border: cs.borderTopColor,
        bg: rgbString(bg),
        ratio: Math.round(cr * 100) / 100,
      });
    }
  }

  return { textFailures, borderFailures };
}

function formatReport(
  result: ReturnType<typeof sweepPage>,
  context: { colorScheme: string; viewport: string; state: string }
): string {
  const lines: string[] = [`[${context.colorScheme} @ ${context.viewport} / ${context.state}]`];
  for (const f of result.textFailures) {
    lines.push(
      `  TEXT ${f.ratio}:1 (need ${f.threshold}:1, ${f.fontSize} / ${f.fontWeight}) <${f.selector}> fg ${f.fg} bg ${f.bg} "${f.text}"`
    );
  }
  for (const f of result.borderFailures) {
    lines.push(`  BORDER ${f.ratio}:1 (need 3:1) <${f.selector}> border ${f.border} bg ${f.bg}`);
  }
  return lines.join('\n');
}

for (const colorScheme of COLOR_SCHEMES) {
  test.describe(`contrast sweep, ${colorScheme}`, () => {
    test.use({ colorScheme });

    for (const viewport of VIEWPORTS) {
      for (const state of STATES) {
        test(`${viewport.label} / ${state}`, async ({ page }) => {
          await openApp(page, { viewport: { width: viewport.width, height: viewport.height } });
          await reachState(page, state);

          const result = await page.evaluate(sweepPage);
          const total = result.textFailures.length + result.borderFailures.length;
          const report = formatReport(result, { colorScheme, viewport: viewport.label, state });

          expect(total, total > 0 ? report : undefined).toBe(0);
        });
      }
    }
  });
}
