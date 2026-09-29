// D-057 items 4-5 (DIA-235): the room/flag selection rule, checked against
// the real exported scene files (node:fs, same convention as
// scene-contract.test.ts — no fetch, no browser) and asserted against
// D-057's own table for every one of the eight share stops.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  EXPECTED_SHARE_ROOM_AND_FLAGS,
  ownGagIdsForStop,
  pickShareFlags,
  pickShareRoom,
  sceneBandForStop,
  SHARE_FLAG_FOOTPRINT_PX,
  SHARE_STOPS,
} from './share-image';
import type { SceneFile } from './scene';

const SCENES_DIR = path.join(import.meta.dirname, '../../public/sprites/scenes');
const MANIFEST_PATH = path.join(import.meta.dirname, '../../public/sprites/manifest.json');

function loadSceneFixture(band: number): SceneFile {
  return JSON.parse(readFileSync(path.join(SCENES_DIR, `${band}-without.json`), 'utf-8')) as SceneFile;
}

describe('share image room + flag selection (D-057 items 4-5)', () => {
  for (const stop of SHARE_STOPS) {
    it(`stop ${stop} matches D-057's table`, () => {
      const sceneBand = sceneBandForStop(stop);
      // 'beyond' resolves to band 750's file — public/sprites/scenes/index.json
      // aliases it there (N-02); load 750 directly since this test reads
      // files, not the fetch-based loadScene/loadSceneIndex.
      const scene = loadSceneFixture(sceneBand === 'beyond' ? 750 : sceneBand);
      const orderedGagIds = ownGagIdsForStop(stop);
      const ownGagIds = new Set(orderedGagIds);

      const room = pickShareRoom(scene, ownGagIds);
      const flags = pickShareFlags(scene, room, ownGagIds, orderedGagIds);

      const expected = EXPECTED_SHARE_ROOM_AND_FLAGS[stop];
      expect(room.id).toBe(expected.room);
      expect(flags.map((f) => f.gagId)).toEqual(expected.gagIds);
    });
  }

  it('never flags more than three gags', () => {
    for (const stop of SHARE_STOPS) {
      expect(EXPECTED_SHARE_ROOM_AND_FLAGS[stop].gagIds.length).toBeLessThanOrEqual(3);
    }
  });

  it('SHARE_FLAG_FOOTPRINT_PX matches the exported share-flag sprite (DIA-248)', () => {
    // Guards against the sprite being resized without updating the
    // duplicated constant pickShareFlags uses as its overlap radius
    // (share-image.ts's own header comment on this duplication).
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8')) as {
      'share-flag': { w: number; h: number };
    };
    const { w, h } = manifest['share-flag'];
    expect(SHARE_FLAG_FOOTPRINT_PX).toBeCloseTo(Math.hypot(w, h));
  });

  it('every flag point falls inside its room (sanity check on rect + marker math)', () => {
    for (const stop of SHARE_STOPS) {
      const sceneBand = sceneBandForStop(stop);
      const scene = loadSceneFixture(sceneBand === 'beyond' ? 750 : sceneBand);
      const orderedGagIds = ownGagIdsForStop(stop);
      const ownGagIds = new Set(orderedGagIds);
      const room = pickShareRoom(scene, ownGagIds);
      const flags = pickShareFlags(scene, room, ownGagIds, orderedGagIds);
      for (const flag of flags) {
        expect(flag.x).toBeGreaterThanOrEqual(0);
        expect(flag.y).toBeGreaterThanOrEqual(0);
        expect(flag.x).toBeLessThanOrEqual(room.size.w);
        expect(flag.y).toBeLessThanOrEqual(room.size.h);
      }
    }
  });
});
