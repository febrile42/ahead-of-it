// Guards render-share-images.mjs's duplicated SHARE_STOPS literal (see its
// own header comment for why it isn't imported directly) against drifting
// from src/scene/share-image.ts's real one.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SHARE_STOPS } from '../src/scene/share-image';

describe('render-share-images.mjs SHARE_STOPS (duplicated literal)', () => {
  it('matches src/scene/share-image.ts\'s SHARE_STOPS', () => {
    const source = readFileSync(new URL('./render-share-images.mjs', import.meta.url), 'utf-8');
    const match = source.match(/const SHARE_STOPS = (\[[^\]]*\]);/);
    expect(match, 'render-share-images.mjs: SHARE_STOPS literal not found').not.toBeNull();
    const duplicated = JSON.parse(match![1]);
    expect(duplicated).toEqual([...SHARE_STOPS]);
  });
});
