// D-042a: the close-up navigation's visitor-read strings. They live in
// docs/content/TONE.md §"Navigation copy" and reach the page as
// content.json's `ui` block (brief D042-W item 8) — nothing here is
// written in the source.
//
// Until the Product & Content Lead's `ui` block is merged (DIA-42), each
// key falls back to a `TODO-UI:<key>` placeholder so the controls are
// still wired and testable; src/ui/strings.test.ts fails while any
// placeholder is in use, so an unsourced string can never ship.
import contentJson from '../content/content.json';

export const UI_KEYS = [
  'wholeFloor',
  'previous',
  'next',
  'position',
  'zoomIn',
  'atStart',
  'atEnd',
  'roomTab',
  'roomTabName',
  'announce',
  'announceRoom',
] as const;

export type UiKey = (typeof UI_KEYS)[number];

export const PLACEHOLDER_PREFIX = 'TODO-UI:';

const sourced = (contentJson as unknown as { ui?: Partial<Record<UiKey, string>> }).ui ?? {};

/** Fills `{name}` placeholders from `values`; an unknown one stays visible rather than vanishing. */
export function fillTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in values ? String(values[name]) : whole));
}

/** The copy for `key` with its placeholders filled from `values`. */
export function ui(key: UiKey, values: Record<string, string | number> = {}): string {
  return fillTemplate(sourced[key] ?? `${PLACEHOLDER_PREFIX}${key}`, values);
}

/** The keys still on a placeholder (empty once content.json carries the full `ui` block). */
export function unsourcedKeys(): UiKey[] {
  return UI_KEYS.filter((key) => typeof sourced[key] !== 'string' || sourced[key] === '');
}
