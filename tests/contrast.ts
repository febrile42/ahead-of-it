// WCAG 2.x relative-luminance contrast ratio, shared by tests/dark-mode.spec.ts.
// Takes browser-computed colours (`getComputedStyle(...).color` etc., always
// `rgb(r, g, b)` or `rgba(r, g, b, a)` once the page has laid out) rather
// than the CSS source values, so this checks what the browser actually
// painted, not what style.css merely declares.

function parseRgb(value: string): [number, number, number] {
  const match = value.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
  if (!match) throw new Error(`contrast.ts: not an rgb()/rgba() colour: "${value}"`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two `rgb()`/`rgba()` strings, e.g. what
 * `getComputedStyle` returns for `color`/`backgroundColor`/`outlineColor`. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(parseRgb(a));
  const lb = relativeLuminance(parseRgb(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
