#!/usr/bin/env python3
"""PH2-01 "calmer is measured": the mean changed-pixel fraction a second over 5 s, per
band x state, on each file's default view at native scale, played by the art side's
reference player (`motion.paint_at`, the contract's arithmetic) at the painter's 12
repaints a second. Prints a markdown table and exits 1 unless built < without on every
band. The web side's browser measurement (PH2-01 Part B) is the acceptance number; this
is the art side's check that the poses are calmer before they ever reach a browser.

Usage: python3 art/checks/motion_report.py
"""
from __future__ import annotations

import json
import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT = os.path.dirname(os.path.dirname(_HERE))
sys.path.insert(0, _REPO_ROOT)

from art.src import compose, export_scene, motion  # noqa: E402

SCENES_DIR = os.path.join(export_scene.SPRITES_DIR, "scenes")
SECONDS, FPS = 5, 12


def changed_rate(lib, view) -> float:
    w, h = view["size"]["w"], view["size"]["h"]
    prev, changed = None, 0
    for t in range(0, SECONDS * 1000 + 1, 1000 // FPS):
        img = motion.paint_at(lib, view["entries"], w, h, t).tobytes()
        if prev is not None:
            changed += sum(1 for i in range(0, len(img), 4) if img[i:i + 4] != prev[i:i + 4])
        prev = img
    return changed / (w * h) / SECONDS


def main():
    lib = compose.Library(export_scene.SPRITES_DIR)
    ok = True
    print("| band | default view | built | without | built < without |")
    print("|---|---|---|---|---|")
    for band in export_scene.DRAWN_BANDS:
        rates, ids = {}, {}
        for state in export_scene.STATES:
            with open(os.path.join(SCENES_DIR, f"{band}-{state}.json")) as f:
                view = next(v for v in json.load(f)["views"] if v.get("default"))
            rates[state], ids[state] = changed_rate(lib, view), view["id"]
        calmer = rates["built"] < rates["without"]
        ok &= calmer
        print(f"| {band} | {ids['built']} | {rates['built']:.4f} | {rates['without']:.4f} "
              f"| {'yes' if calmer else 'NO'} |")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
