// D-042a / brief D042-W item 8: every visitor-read string of the close-up
// navigation is sourced from content.json's `ui` block, none from the source.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PLACEHOLDER_PREFIX, UI_KEYS, fillTemplate, ui, unsourcedKeys } from './strings';

describe('close-up navigation strings (D-042a)', () => {
  it('content.json carries every ui key (fails while the DIA-42 block is unmerged)', () => {
    expect(unsourcedKeys(), 'keys still on a TODO-UI placeholder').toEqual([]);
  });

  it('no served string is a placeholder', () => {
    for (const key of UI_KEYS) {
      expect(ui(key, { label: 'x', room: 'y', n: 1, total: 2, count: 3 }), key).not.toContain(PLACEHOLDER_PREFIX);
    }
  });

  it('fills {placeholders}, leaving unknown ones visible rather than dropping them', () => {
    expect(fillTemplate('{room}: {label}, {n} of {total}', { room: 'R', label: 'L', n: 2, total: 5 })).toBe('R: L, 2 of 5');
    expect(fillTemplate('{label} · {n}', { label: 'L' })).toBe('L · {n}');
  });

  it('the source names no ui string of its own: every key is read through ui(), never a literal', () => {
    for (const file of ['../main.ts', './panel.ts']) {
      const source = readFileSync(new URL(file, import.meta.url), 'utf-8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      const literals = source.match(/(['"`])(?:(?!\1)[^\\\n])*\1/g) ?? [];
      const offending = literals.filter((l) => /whole floor|zoom in|no more close-ups|no earlier close-ups/i.test(l));
      expect(offending, `${file} string literals`).toEqual([]);
    }
  });
});
