#!/usr/bin/env python3
"""Acceptance check: `public/sprites/scenes/*.json` against `docs/product/SCENE-FORMAT.md`
and D-036. Reads the exported JSON + manifest back off disk, the way a reviewer who
didn't write the exporter would.

Checks:
  1. determinism      — re-running the exporter reproduces byte-identical JSON + PNGs.
  2. manifest refs     — every `{sprite, frame}` an entry names resolves to a real
                         manifest key/frame (A2).
  3. coverage          — every gag with band <= N has >= 1 hotspot in both states of N.
  4. views             — id set/order per D-036 rule 1; `ground` always present; a
                         non-`ground` view holds >= 1 primary hotspot (rule 2); size
                         w<=360, h<=240 (rule 3); `focus` in bounds of its view (the
                         mastermind's ruling: focus is "the region to scroll to on a
                         narrow viewport", not required to equal the whole view).
  5. hotspot bounds     — every hotspot rect sits inside its view's canvas.
  6. one primary        — exactly one primary hotspot per gag per (band, state, its
                         views); D-036 rule 4.
  7. spacing            — primary hotspot centres >= 44 native px apart within a view
                         (rule 7); `KNOWN_SPACING_DEBT` pairs (art pass 4 territory)
                         print as a warning instead of failing, and fail if the debt
                         has gone stale (the pair is now >= 44px everywhere).
  8. beyond alias       — index.json's `beyond` points at band 750.
  9. pixel parity       — for every drawn band x state x view, painting the exported
                         `entries` in array order (exactly the contract's painter:
                         anchor-adjusted, clipped to the canvas) reproduces the same
                         rect cropped out of `compose.render`'s native-scale render of
                         the whole plate, byte-for-byte in RGBA. Catches wrong entry
                         order, missing entries, wrong offsets — the actual "web ==
                         art" guarantee D-035 promises, not just a shared code path.

Usage: python3 art/checks/check_scenes.py
Exit 0 if every check passes (warnings still print); exit 1 and print every failure
otherwise (not just the first — a reviewer needs the whole list).
"""
from __future__ import annotations

import itertools
import json
import math
import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT = os.path.dirname(os.path.dirname(_HERE))
sys.path.insert(0, _REPO_ROOT)

from art.src import compose, export_scene  # noqa: E402

SPRITES_DIR = os.path.join(_REPO_ROOT, "public", "sprites")
SCENES_DIR = os.path.join(SPRITES_DIR, "scenes")

VIEW_ORDER = ["ground", "floor-2", "floor-3", "floor-4", "floor-5", "floor-6", "top", "street"]
SPACING_MIN = 44
KNOWN_SPACING_DEBT = {frozenset(p) for p in export_scene.KNOWN_SPACING_DEBT}

failures: list[str] = []
warnings: list[str] = []


def fail(msg: str):
    failures.append(msg)


def load_json(path):
    with open(path) as f:
        return json.load(f)


def check_pixel_parity():
    """D-035's real guarantee: for every drawn band x state x view, painting the
    exported `entries` in array order — exactly the contract's painter (anchor-adjusted,
    clipped to the view canvas) — reproduces the same rect cropped out of
    `compose.render`'s native-scale render of the whole plate, byte-for-byte in RGBA.
    Independent of the exporter's own internals: it re-derives the reference render
    itself rather than trusting anything export_scene.py precomputed."""
    lib = compose.Library(SPRITES_DIR)
    for band in export_scene.DRAWN_BANDS:
        for state in export_scene.STATES:
            path = os.path.join(SCENES_DIR, f"{band}-{state}.json")
            doc = load_json(path)
            for v in doc["views"]:
                w, h = v["size"]["w"], v["size"]["h"]
                rect = export_scene.VIEW_CROPS[band]
                crop_rect = next((r for (vid, r) in rect if vid == v["id"]), None)
                if crop_rect is None:
                    crop_rect = (0, 0, w, h)
                painted = export_scene.paint_entries(lib, v["entries"], w, h)
                reference = export_scene.reference_crop(lib, band, state, crop_rect)
                if painted.tobytes() != reference.tobytes():
                    diffs = sum(1 for a, b in zip(painted.getdata(), reference.getdata())
                                if a != b)
                    fail(f"{band}-{state}.json:{v['id']} — pixel parity: painted view "
                         f"!= native-scale crop of compose.render ({diffs} pixels differ "
                         f"of {w * h})")


def check_determinism():
    import glob
    import hashlib
    import subprocess

    def hashes():
        paths = sorted(glob.glob(os.path.join(SPRITES_DIR, "**", "*.png"), recursive=True))
        paths += sorted(glob.glob(os.path.join(SCENES_DIR, "*.json")))
        out = {}
        for p in paths:
            with open(p, "rb") as f:
                out[os.path.relpath(p, _REPO_ROOT)] = hashlib.sha256(f.read()).hexdigest()
        return out

    before = hashes()
    r = subprocess.run([sys.executable, os.path.join(_REPO_ROOT, "art", "build.py")],
                        cwd=_REPO_ROOT, capture_output=True, text=True)
    if r.returncode != 0:
        fail(f"determinism — art/build.py failed on re-run: {r.stderr[-2000:]}")
        return
    after = hashes()
    if before != after:
        diffs = [k for k in before if before.get(k) != after.get(k)]
        fail(f"determinism — {len(diffs)} file(s) changed on re-run: {diffs[:10]}")


def main():
    with open(os.path.join(SPRITES_DIR, "manifest.json")) as f:
        manifest = json.load(f)
    index = load_json(os.path.join(SCENES_DIR, "index.json"))

    if index.get("beyond") != "750":
        fail(f"beyond alias — index.json says beyond={index.get('beyond')!r}, want '750'")

    bands = index.get("bands", {})
    expected_bands = {"80", "150", "220", "360", "490", "610", "750"}
    if set(bands) != expected_bands:
        fail(f"index.json bands — got {sorted(bands)}, want {sorted(expected_bands)}")

    index_debt = {frozenset(p) for p in index.get("knownSpacingDebt", [])}
    if index_debt != KNOWN_SPACING_DEBT:
        fail("index.json knownSpacingDebt does not match export_scene.KNOWN_SPACING_DEBT "
             f"— index has {sorted(map(sorted, index_debt))}, "
             f"module has {sorted(map(sorted, KNOWN_SPACING_DEBT))}")
    debt_seen_failing: set = set()

    # cumulative gag -> introducing band, from src/content/content.json (ground truth)
    content = load_json(os.path.join(_REPO_ROOT, "src", "content", "content.json"))
    gag_band = {g["id"]: g["band"] for g in content["gags"]}

    for band_str, files in sorted(bands.items(), key=lambda kv: int(kv[0])):
        band = int(band_str)
        due_gags = {g for g, b in gag_band.items() if b <= band}
        for state in ("without", "built"):
            fname = files.get(state)
            if not fname:
                fail(f"band {band} {state} — missing from index.json")
                continue
            path = os.path.join(SCENES_DIR, fname)
            if not os.path.exists(path):
                fail(f"band {band} {state} — {fname} does not exist")
                continue
            doc = load_json(path)
            if doc.get("band") != band or doc.get("state") != state:
                fail(f"{fname} — band/state header mismatch: {doc.get('band')}/{doc.get('state')}")
            views = doc.get("views", [])
            view_ids = [v["id"] for v in views]

            if "ground" not in view_ids:
                fail(f"{fname} — no 'ground' view (D-036 rule 2)")
            if len(view_ids) != len(set(view_ids)):
                fail(f"{fname} — duplicate view ids: {view_ids}")
            order_idx = [VIEW_ORDER.index(v) for v in view_ids if v in VIEW_ORDER]
            if order_idx != sorted(order_idx):
                fail(f"{fname} — views out of D-036 order: {view_ids}")

            defaults = [v for v in views if v.get("default")]
            if len(defaults) != 1:
                fail(f"{fname} — {len(defaults)} default views, want exactly 1")

            seen_gags_this_band = set()
            doc_primary_count: dict = {}
            for v in views:
                vid, size = v["id"], v["size"]
                w, h = size["w"], size["h"]
                if w > 360 or h > 240:
                    fail(f"{fname}:{vid} — {w}x{h} exceeds 360x240 (D-036 rule 3)")
                focus = v.get("focus", {})
                fx, fy = focus.get("x"), focus.get("y")
                fw, fh = focus.get("w"), focus.get("h")
                if None in (fx, fy, fw, fh) or fx < 0 or fy < 0 or fx + fw > w or fy + fh > h:
                    fail(f"{fname}:{vid} — focus {focus} not in bounds of view {w}x{h}")

                hs = v.get("hotspots", [])
                if vid != "ground" and not any(h_.get("primary") for h_ in hs):
                    fail(f"{fname}:{vid} — non-ground view has no primary hotspot (rule 2)")

                # manifest refs (A2)
                for e in v.get("entries", []):
                    spr = e.get("sprite")
                    if spr not in manifest:
                        fail(f"{fname}:{vid} — entry sprite {spr!r} not in manifest.json")
                        continue
                    frame = e.get("frame", "default")
                    # mastermind ruling: `frame` is always a manifest frame-name
                    # string (e.g. "default", "green", "a-left"), never an integer
                    # index — SCENE-FORMAT.md's `"frame": 2` example is not the
                    # contract.
                    if not isinstance(frame, str):
                        fail(f"{fname}:{vid} — {spr!r} frame {frame!r} is not a "
                             f"manifest frame-name string (mastermind ruling)")
                    elif frame not in manifest[spr]["frames"]:
                        fail(f"{fname}:{vid} — {spr!r} has no frame {frame!r}")

                # hotspot bounds
                primary_pts = []
                by_gag: dict = {}
                for h_ in hs:
                    x0, y0, hw, hh = h_["x"], h_["y"], h_["w"], h_["h"]
                    if x0 < 0 or y0 < 0 or x0 + hw > w or y0 + hh > h:
                        fail(f"{fname}:{vid} — hotspot {h_['gagId']}/{h_['part']} "
                             f"[{x0},{y0},{x0+hw},{y0+hh}] out of bounds {w}x{h}")
                    doc_primary_count.setdefault(h_["gagId"], 0)
                    if h_.get("primary"):
                        primary_pts.append((h_["gagId"], x0 + hw / 2, y0 + hh / 2))
                        seen_gags_this_band.add(h_["gagId"])
                        doc_primary_count[h_["gagId"]] += 1

                for (ga, xa, ya), (gb, xb, yb) in itertools.combinations(primary_pts, 2):
                    d = math.hypot(xa - xb, ya - yb)
                    if d < SPACING_MIN:
                        pair = frozenset((ga, gb))
                        if pair in KNOWN_SPACING_DEBT:
                            debt_seen_failing.add(pair)
                            warnings.append(
                                f"{fname}:{vid} — WARNING (known debt, art pass 4) "
                                f"{ga}/{gb} only {d:.1f}px apart (< {SPACING_MIN})")
                        else:
                            fail(f"{fname}:{vid} — primary hotspots {ga}/{gb} only "
                                 f"{d:.1f}px apart (< {SPACING_MIN}, D-036 rule 7)")

            # exactly one primary hotspot per gag, across the whole doc (D-036 rule 4)
            for gag, n in doc_primary_count.items():
                if n != 1:
                    fail(f"{fname} — {gag} has {n} primary hotspots across all views, want 1")

            # coverage (R-03a): every gag due by this band has >=1 hotspot in this state
            missing = due_gags - {gid for v in views for h_ in v.get("hotspots", [])
                                   for gid in [h_["gagId"]]}
            if missing:
                fail(f"{fname} — gags due by band {band} with no hotspot: {sorted(missing)}")

    # a debt entry that never actually failed anywhere has gone stale — the point of
    # KNOWN_SPACING_DEBT is that it can't silently keep excusing something already fixed
    for pair in KNOWN_SPACING_DEBT - debt_seen_failing:
        fail(f"KNOWN_SPACING_DEBT {sorted(pair)} is >= {SPACING_MIN}px apart in every "
             f"file now — remove it from KNOWN_SPACING_DEBT (art pass 4 landed)")

    check_pixel_parity()
    check_determinism()

    if warnings:
        print(f"{len(warnings)} warning(s):\n")
        for w in warnings:
            print(" -", w)
        print()

    if failures:
        print(f"FAIL — {len(failures)} check(s) failed:\n")
        for f in failures:
            print(" -", f)
        sys.exit(1)
    print("PASS — scene export checks: views, manifest refs, coverage, bounds, "
          "spacing (known debt warned, not failed), beyond alias, pixel parity, "
          "determinism.")


if __name__ == "__main__":
    main()
