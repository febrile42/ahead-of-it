// DIA-248: wrangler only reads `run_worker_first` when it's nested inside
// `assets` — at the top level it's silently ignored ("Unexpected fields
// found in top-level field: run_worker_first"), the Worker never runs for
// `/`, and every shared link previews as band 80 forever (D-057, DIA-235).
// src/worker/index.test.ts can't catch this: it calls the Worker directly
// and skips the routing decision that keeps it from being reached at all.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const CONFIG_PATH = path.join(import.meta.dirname, '../../wrangler.jsonc');

// Same strip-comments approach as scripts/print-worker-name.mjs: wrangler.jsonc
// has no string values containing "//", so a per-line strip is safe here.
function readWranglerConfig(): Record<string, unknown> {
  const raw = readFileSync(CONFIG_PATH, 'utf8');
  const stripped = raw
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  return JSON.parse(stripped) as Record<string, unknown>;
}

describe('wrangler.jsonc (DIA-248)', () => {
  it('nests run_worker_first inside assets, not at the top level', () => {
    const config = readWranglerConfig();
    expect(config.run_worker_first).toBeUndefined();
    const assets = config.assets as Record<string, unknown>;
    expect(assets.run_worker_first).toEqual(['/']);
  });
});
