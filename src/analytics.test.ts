// PH3-04 (DIA-230): plain-TypeScript, no-DOM tests (vitest.config.ts keeps
// unit tests out of jsdom/happy-dom) — the DOM-touching half of
// src/analytics.ts (script injection, queued events) is exercised for real
// in tests/analytics.spec.ts instead. This file covers the pure gate logic
// and, via a source scan, that the six D-016 events are exactly what's
// fired and never carry a second argument (N-05).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ANALYTICS_EVENTS, isTrackingEnabled } from './analytics';
import type { AnalyticsEvent } from './analytics';

describe('isTrackingEnabled (R-17)', () => {
  it('is false with no website id', () => {
    expect(isTrackingEnabled(null, false)).toBe(false);
    expect(isTrackingEnabled(undefined, false)).toBe(false);
    expect(isTrackingEnabled('', false)).toBe(false);
  });

  it('is false when Do Not Track / GPC is set, even with a website id', () => {
    expect(isTrackingEnabled('site-123', true)).toBe(false);
  });

  it('is true only with a website id and no privacy signal', () => {
    expect(isTrackingEnabled('site-123', false)).toBe(true);
  });
});

describe('ANALYTICS_EVENTS (D-016)', () => {
  it('is exactly the six D-016 events', () => {
    expect([...ANALYTICS_EVENTS].sort()).toEqual(
      ['band_change', 'contact_click', 'gag_open', 'punchlist_download', 'share_image', 'switch_flip'].sort()
    );
  });
});

// A directory walk (not a fixed file list) so a future new call site is
// covered automatically rather than silently skipped.
function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue;
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) out.push(...walkTsFiles(full));
    else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

describe('track() call sites (N-05 / D-016)', () => {
  const srcDir = join(import.meta.dirname, '.');
  const files = walkTsFiles(srcDir);
  // Matches a bare `track('literal')` / `track("literal")` — the negative
  // lookbehind excludes `window.umami?.track(event)` (analytics.ts's own
  // dispatch into the third-party tracker, where `event` is necessarily a
  // variable, not a call site this scan cares about). Deliberately does not
  // match `track(someVariable)` or a template literal, which is the point:
  // a call site that isn't a plain string literal could smuggle band data
  // through (N-05) and must fail this scan.
  const CALL = /(?<!\.)\btrack\(\s*(.*?)\s*\)/g;
  const LITERAL = /^'([^']*)'$|^"([^"]*)"$/;

  const found: Array<{ file: string; arg: string }> = [];
  for (const file of files) {
    // Comments (including this file's own doc comments about `track(...)`)
    // aren't call sites — stripped the same way scripts/print-worker-name.mjs
    // strips wrangler.jsonc's JSONC comments: no string literal in this
    // codebase contains "//", so a per-line strip is safe.
    const text = readFileSync(file, 'utf8')
      .split('\n')
      .map((line) => line.replace(/\/\/.*$/, ''))
      .join('\n');
    for (const match of text.matchAll(CALL)) {
      const arg = match[1];
      // analytics.ts's own declaration site (`function track(event:
      // AnalyticsEvent)`) isn't a call — a real call's argument is never a
      // typed parameter (":") or has a second argument (",").
      if (!arg || arg.includes(',') || arg.includes(':')) continue;
      found.push({ file, arg });
    }
  }

  it('found at least one call site (the scan itself is not vacuous)', () => {
    expect(found.length).toBeGreaterThan(0);
  });

  it('every track() call site passes a plain string literal', () => {
    for (const { file, arg } of found) {
      expect(LITERAL.test(arg), `${file}: track(${arg}) is not a plain string literal`).toBe(true);
    }
  });

  it('every literal is one of the six D-016 events', () => {
    for (const { file, arg } of found) {
      const literal = arg.slice(1, -1);
      expect(ANALYTICS_EVENTS as readonly string[], `${file}: track(${arg})`).toContain(literal);
    }
  });

  it('every event except share_image (no caller until PH3-02) has a call site', () => {
    const called = new Set(found.map(({ arg }) => arg.slice(1, -1)));
    const pending: AnalyticsEvent[] = ['share_image'];
    for (const event of ANALYTICS_EVENTS) {
      if (pending.includes(event)) continue;
      expect(called.has(event), `no track('${event}') call site found`).toBe(true);
    }
  });
});
