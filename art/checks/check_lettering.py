#!/usr/bin/env python3
"""DIA-133: no hotspot marker tick touches in-scene lettering, on a phone.

Reads the exported scene files as the web does: each close-up hotspot's reticle is
centred on its `marker` if it has one, else on its rect's centre, and framed from its
rect (art/src/lettering.py has the numbers). Lettering is every pixel that changes when
the sprites are rebuilt with blank glyphs. Fails on any tick touching a letter at a
phone scale (lettering.SCALES), past any named EXCEPTIONS allowance; lists, without
failing, the ones that touch only on desktop (lettering.DESKTOP).

Usage: python3 art/checks/check_lettering.py [--dump DIR]   (exit 1 on any breach)
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import sys

from PIL import Image

_HERE = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT = os.path.dirname(os.path.dirname(_HERE))
sys.path.insert(0, _REPO_ROOT)

from art.src import compose, export_scene, lettering  # noqa: E402

SCENES_DIR = os.path.join(export_scene.SPRITES_DIR, "scenes")

# Named exceptions: (band, state, gagId, part) -> (letter px allowed, only at scales
# below this). Anything past the allowance, or at any other scale, still fails.
# G7.3 hat stack: INFRA and the HOW TO card are 29 art px apart, and the reticle is 30
# tall on a 360 px phone, so no anchor clears both. Product Lead accepted one grazed
# pixel on 360-375 px phones rather than re-composing the back aisle (DIA-133, comment
# e3abb643-e5d2-404a-9ee2-1c24c49ef1f2). Those phones are scales 1.5 (dpr 2) and 5/3
# (dpr 3), hence "below 2.0"; at 2.0 (390-430 px) it must clear.
EXCEPTIONS = {("750", "without", "G7.3", "hats"): (1, 2.0)}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dump", help="write each lettered close-up's letter mask here")
    args = ap.parse_args()

    lib = compose.Library(export_scene.SPRITES_DIR)
    fails, tight, desktop, excepted, lettered, markers = [], [], [], [], 0, 0
    seen: set = set()
    with lettering.Blank(lib) as blank:
        for path in sorted(glob.glob(os.path.join(SCENES_DIR, "*-*.json"))):
            doc = json.load(open(path))
            for view in doc["views"]:
                if view["kind"] != "closeup" or not view["hotspots"]:
                    continue
                w, h = view["size"]["w"], view["size"]["h"]
                letters = lettering.letter_pixels(export_scene.paint_entries, lib, blank,
                                                  view["entries"], w, h)
                name = f"{doc['band']}-{doc['state']}-{view['id']}"
                for hs in view["hotspots"]:
                    markers += "marker" in hs
                    m = hs.get("marker")
                    if m and not (hs["x"] <= m["x"] <= hs["x"] + hs["w"]
                                  and hs["y"] <= m["y"] <= hs["y"] + hs["h"]):
                        fails.append(f"{name}: {hs['gagId']}#{hs['part']} marker is "
                                     f"outside its rect")
                if not letters:
                    continue
                lettered += 1
                if args.dump:
                    os.makedirs(args.dump, exist_ok=True)
                    img = Image.new("L", (w, h), 0)
                    for p in letters:
                        img.putpixel(p, 255)
                    img.save(os.path.join(args.dump, f"{name}.png"))
                for hs in view["hotspots"]:
                    r = (hs["x"], hs["y"], hs["x"] + hs["w"], hs["y"] + hs["h"])
                    c = lettering.centre(hs)
                    tag = f"{name}: {hs['gagId']}#{hs['part']}"
                    exc = EXCEPTIONS.get((str(doc["band"]), doc["state"], hs["gagId"],
                                          hs["part"]))
                    if exc:
                        seen.add((str(doc["band"]), doc["state"], hs["gagId"], hs["part"]))
                        allow, below = exc
                        lo = [s for s in lettering.SCALES if s < below]
                        hi = [s for s in lettering.SCALES if s >= below]
                        n_lo = len(lettering.touching(c, r, letters, lo, clear=0))
                        n_hi = len(lettering.touching(c, r, letters, hi, clear=0))
                        if n_lo > allow or n_hi:
                            fails.append(f"{tag} ticks touch {n_lo} lettering px below "
                                         f"{below:.2f} (allowed {allow}) and {n_hi} at or "
                                         f"above it (allowed 0), past its named exception")
                        else:
                            excepted.append(f"{tag} ({n_lo} px below {below:.2f}, "
                                            f"allowed {allow})")
                        continue
                    n = len(lettering.touching(c, r, letters, clear=0))
                    if n:
                        fails.append(f"{tag} ticks touch {n} lettering px on a phone")
                        continue
                    if lettering.touching(c, r, letters):
                        tight.append(tag)
                    n = len(lettering.touching(c, r, letters, lettering.DESKTOP))
                    if n:
                        desktop.append(f"{tag} ({n} px)")
    for key in sorted(set(EXCEPTIONS) - seen):
        fails.append(f"named exception {key} matches no lettered close-up hotspot: "
                     f"remove it")
    print(f"check_lettering: {lettered} lettered close-ups, {markers} hotspots with a "
          f"marker; phone scales {', '.join(f'{s:.2f}' for s in lettering.SCALES)}")
    for f in fails:
        print("  FAIL", f)
    for e in excepted:
        print("  named exception, within its allowance:", e)
    if tight:
        print(f"  under {lettering.CLEAR:g} css px of daylight on a phone, never on a "
              f"letter: {len(tight)}")
        for t in tight:
            print("    ", t)
    if desktop:
        print(f"  desktop only (2.1-4.0 css px per art px, reported, not enforced): "
              f"{len(desktop)}")
        for d in desktop:
            print("    ", d)
    if not fails:
        print("  OK: no marker tick touches lettering on a phone"
              + (", past the named exceptions above" if excepted else ""))
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
