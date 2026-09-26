#!/usr/bin/env python3
"""Acceptance check: `public/sprites/scenes/*.json` against `docs/product/SCENE-FORMAT.md`
and D-036. Reads the exported JSON + manifest back off disk, the way a reviewer who
didn't write the exporter would.

Checks (schema 2, D-042 — rooms + close-ups; the split with the web's contract test is
the last bullets of SCENE-FORMAT.md "Views: rooms and close-ups"):
  1. determinism      — re-running the exporter reproduces byte-identical JSON + PNGs.
  2. manifest refs     — every `{sprite, frame}` an entry names resolves to a real
                         manifest key/frame (A2).
  3. coverage          — every gag with band <= N has >= 1 hotspot in both states of N.
  4. views             — `schema: 2`; rooms in D-036 order, `ground` first, each directly
                         followed by its close-ups; a non-`ground` room has >= 1 close-up;
                         rooms <= 360x240 with `hotspots: []`; close-ups <= 180x120,
                         id `<room>.<n>` from 1, `parent` = the room they follow, integer
                         `rect` inside the parent, `size` == rect w/h, 1-3 primaries;
                         `focus` inside its view; `label` non-empty and <= 24 chars;
                         exactly one `default`, on the close-up the D-042 rule picks;
                         `built` and `without` share the skeleton (ids, kinds, parents,
                         labels, order).
  5. hotspot bounds     — every hotspot rect sits inside its view's canvas.
  6. one primary        — exactly one primary hotspot per gag per file, in a close-up
                         whose parent is the gag's D-036 home room.
  7. spacing            — primary hotspot centres >= 24 native px apart within a close-up
                         (D-042), no exceptions.
  7b. two-part         — G3.2, G4.1, G2.4 (both states) and G5.1 (without) have >= 2
                         hotspots wherever they are drawn (SCENE-FORMAT.md).
  8. beyond alias       — index.json's `beyond` points at band 750; `schema: 2`.
  9. pixel parity       — for every drawn band x state: each room's exported `entries`,
                         painted in array order (the contract's painter: anchor-adjusted,
                         clipped), reproduce that room as `compose.render` draws it from
                         the layout data, byte-for-byte in RGBA; and each close-up's
                         entries reproduce that same render cropped at its `rect` (D-042).
                         The reference is re-derived from the layout, never read back
                         from the export — the "web == art" guarantee D-035 promises.

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
SPACING_MIN = 24          # D-042: within a close-up
CLOSEUP_MAX = (180, 120)
ROOM_MAX = (360, 240)
LABEL_MAX = 24
# SCENE-FORMAT.md "Two-part gags": the states in which each is drawn in two places.
TWO_PART = {"G3.2": ("without", "built"), "G4.1": ("without", "built"),
            "G2.4": ("without", "built"), "G5.1": ("without",)}

failures: list[str] = []
warnings: list[str] = []


def fail(msg: str):
    failures.append(msg)


def load_json(path):
    with open(path) as f:
        return json.load(f)


def check_pixel_parity():
    """D-035's real guarantee: for every drawn band x state, painting a room's exported
    `entries` in array order — exactly the contract's painter (anchor-adjusted, clipped
    to the view canvas) — reproduces the room as `compose.render` draws it straight from
    `layout`, byte-for-byte in RGBA and at the same size; and painting a close-up's
    entries reproduces that same render cropped at the close-up's `rect` (D-042).
    Independent of the exported JSON: the reference is re-derived from the layout data."""
    lib = compose.Library(SPRITES_DIR)
    for band in export_scene.DRAWN_BANDS:
        for state in export_scene.STATES:
            path = os.path.join(SCENES_DIR, f"{band}-{state}.json")
            doc = load_json(path)
            renders = {}
            for v in doc["views"]:
                w, h = v["size"]["w"], v["size"]["h"]
                painted = export_scene.paint_entries(lib, v["entries"], w, h)
                room_id = v["id"] if v.get("kind") == "room" else v.get("parent")
                if room_id not in renders:
                    renders[room_id] = export_scene.render_view(lib, band, state, room_id)
                reference = renders[room_id]
                if v.get("kind") == "closeup":
                    r = v["rect"]
                    reference = reference.crop((r["x"], r["y"], r["x"] + r["w"],
                                                r["y"] + r["h"]))
                if reference.size != (w, h):
                    fail(f"{band}-{state}.json:{v['id']} — view is {w}x{h} but its "
                         f"reference is {reference.size[0]}x{reference.size[1]}")
                    continue
                if painted.tobytes() != reference.tobytes():
                    diffs = sum(1 for a, b in zip(painted.getdata(), reference.getdata())
                                if a != b)
                    what = "its room" if v.get("kind") == "room" else "its room cropped at rect"
                    fail(f"{band}-{state}.json:{v['id']} — pixel parity: painted view "
                         f"!= compose.render of {what} ({diffs} pixels differ of {w * h})")


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

    if index.get("schema") != 2:
        fail(f"index.json — schema {index.get('schema')!r}, want 2 (D-042)")
    if index.get("beyond") != "750":
        fail(f"beyond alias — index.json says beyond={index.get('beyond')!r}, want '750'")

    bands = index.get("bands", {})
    expected_bands = {"80", "150", "220", "360", "490", "610", "750"}
    if set(bands) != expected_bands:
        fail(f"index.json bands — got {sorted(bands)}, want {sorted(expected_bands)}")

    extra = set(index) - {"schema", "bands", "beyond", "thumbs"}
    if extra:
        # e.g. a spacing-debt list: rule 7 has no exceptions any more (PH1-10)
        fail(f"index.json has unexpected keys {sorted(extra)}")

    # cumulative gag -> introducing band, from src/content/content.json (ground truth)
    content = load_json(os.path.join(_REPO_ROOT, "src", "content", "content.json"))
    gag_band = {g["id"]: g["band"] for g in content["gags"]}
    home = {**export_scene.PLACEHOLDER_VIEW, **export_scene.GAG_HOME_VIEW}   # D-036 table
    skeletons: dict = {}

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
            if doc.get("schema") != 2:
                fail(f"{fname} — schema {doc.get('schema')!r}, want 2 (D-042)")
            views = doc.get("views", [])
            view_ids = [v["id"] for v in views]
            skeletons[(band, state)] = [(v.get("id"), v.get("kind"), v.get("parent"),
                                         v.get("label")) for v in views]

            if not views or views[0].get("id") != "ground" or views[0].get("kind") != "room":
                fail(f"{fname} — first view must be the 'ground' room (D-036 rule 2)")
            if len(view_ids) != len(set(view_ids)):
                fail(f"{fname} — duplicate view ids: {view_ids}")
            rooms = [v["id"] for v in views if v.get("kind") == "room"]
            order_idx = [VIEW_ORDER.index(r) if r in VIEW_ORDER else -1 for r in rooms]
            if -1 in order_idx or order_idx != sorted(order_idx):
                fail(f"{fname} — rooms not D-036 ids in D-036 order: {rooms}")

            # structure: each room directly followed by its close-ups, numbered from 1
            room_sizes: dict = {}
            current, n_expected, n_closeups = None, 0, {}
            for v in views:
                kind = v.get("kind")
                if kind == "room":
                    current, n_expected = v["id"], 1
                    room_sizes[current] = (v["size"]["w"], v["size"]["h"])
                    n_closeups[current] = 0
                elif kind == "closeup":
                    want = f"{current}.{n_expected}"
                    if v["id"] != want or v.get("parent") != current:
                        fail(f"{fname}:{v['id']} — close-up out of place: want id {want!r} "
                             f"with parent {current!r}, got parent {v.get('parent')!r}")
                    n_expected += 1
                    if current in n_closeups:
                        n_closeups[current] += 1
                else:
                    fail(f"{fname}:{v['id']} — kind {kind!r}, want 'room' or 'closeup'")
            for r, n in n_closeups.items():
                if n == 0 and r != "ground":
                    fail(f"{fname}:{r} — room has no close-up (D-042)")

            defaults = [v for v in views if v.get("default")]
            if len(defaults) != 1 or defaults[0].get("kind") != "closeup":
                fail(f"{fname} — {len(defaults)} default views, want exactly 1 close-up")
            else:
                own = {g for g, b in gag_band.items() if b == band}

                def n_own(v):
                    return sum(1 for h_ in v["hotspots"]
                               if h_.get("primary") and h_["gagId"] in own)
                best = None
                for v in views:
                    if v.get("kind") == "closeup" and (best is None or n_own(v) > n_own(best)):
                        best = v
                if defaults[0] is not best:
                    fail(f"{fname} — default is {defaults[0]['id']}, but the D-042 rule "
                         f"picks {best['id']}")

            doc_primaries: dict = {}
            for v in views:
                vid, size, kind = v["id"], v["size"], v.get("kind")
                w, h = size["w"], size["h"]
                hs = v.get("hotspots", [])
                if kind == "room":
                    if w > ROOM_MAX[0] or h > ROOM_MAX[1]:
                        fail(f"{fname}:{vid} — room {w}x{h} exceeds {ROOM_MAX} (D-036 rule 3)")
                    if hs != []:
                        fail(f"{fname}:{vid} — a room carries hotspots (D-042: none)")
                elif kind == "closeup":
                    if w > CLOSEUP_MAX[0] or h > CLOSEUP_MAX[1]:
                        fail(f"{fname}:{vid} — close-up {w}x{h} exceeds {CLOSEUP_MAX}")
                    r = v.get("rect") or {}
                    pw, ph = room_sizes.get(v.get("parent"), (0, 0))
                    vals = [r.get(k) for k in ("x", "y", "w", "h")]
                    if not all(isinstance(q, int) for q in vals):
                        fail(f"{fname}:{vid} — rect {r} not all integers")
                    elif r["x"] < 0 or r["y"] < 0 or r["x"] + r["w"] > pw or r["y"] + r["h"] > ph:
                        fail(f"{fname}:{vid} — rect {r} not inside parent {pw}x{ph}")
                    elif (r["w"], r["h"]) != (w, h):
                        fail(f"{fname}:{vid} — size {w}x{h} != rect {r['w']}x{r['h']}")
                    n_prim = sum(1 for h_ in hs if h_.get("primary"))
                    if not 1 <= n_prim <= 3:
                        fail(f"{fname}:{vid} — {n_prim} primaries, want 1-3 (D-042)")

                focus = v.get("focus", {})
                fx, fy = focus.get("x"), focus.get("y")
                fw, fh = focus.get("w"), focus.get("h")
                if None in (fx, fy, fw, fh) or fx < 0 or fy < 0 or fx + fw > w or fy + fh > h:
                    fail(f"{fname}:{vid} — focus {focus} not in bounds of view {w}x{h}")

                label = v.get("label")
                if not isinstance(label, str) or not label.strip() or len(label) > LABEL_MAX:
                    fail(f"{fname}:{vid} — label {label!r} empty or over {LABEL_MAX} chars")

                # manifest refs (A2)
                for e in v.get("entries", []):
                    spr = e.get("sprite")
                    if spr not in manifest:
                        fail(f"{fname}:{vid} — entry sprite {spr!r} not in manifest.json")
                        continue
                    frame = e.get("frame", "default")
                    # mastermind ruling: `frame` is always a manifest frame-name
                    # string (e.g. "default", "green", "a-left"), never an integer index
                    if not isinstance(frame, str):
                        fail(f"{fname}:{vid} — {spr!r} frame {frame!r} is not a "
                             f"manifest frame-name string (mastermind ruling)")
                    elif frame not in manifest[spr]["frames"]:
                        fail(f"{fname}:{vid} — {spr!r} has no frame {frame!r}")

                # hotspot bounds
                primary_pts = []
                for h_ in hs:
                    x0, y0, hw, hh = h_["x"], h_["y"], h_["w"], h_["h"]
                    if x0 < 0 or y0 < 0 or x0 + hw > w or y0 + hh > h:
                        fail(f"{fname}:{vid} — hotspot {h_['gagId']}/{h_['part']} "
                             f"[{x0},{y0},{x0+hw},{y0+hh}] out of bounds {w}x{h}")
                    if h_.get("primary"):
                        primary_pts.append((h_["gagId"], x0 + hw / 2, y0 + hh / 2))
                        doc_primaries.setdefault(h_["gagId"], []).append(v.get("parent"))

                for (ga, xa, ya), (gb, xb, yb) in itertools.combinations(primary_pts, 2):
                    d = math.hypot(xa - xb, ya - yb)
                    if d < SPACING_MIN:
                        fail(f"{fname}:{vid} — primary hotspots {ga}/{gb} only "
                             f"{d:.1f}px apart (< {SPACING_MIN}, D-042)")

            # exactly one primary per gag per file, under its home room (D-036 rule 4)
            for gag, parents in doc_primaries.items():
                if len(parents) != 1:
                    fail(f"{fname} — {gag} has {len(parents)} primary hotspots, want 1")
                elif parents[0] != home.get(gag, parents[0]):
                    fail(f"{fname} — {gag}'s primary is under {parents[0]!r}, but its "
                         f"home room is {home[gag]!r}")

            # two-part gags (SCENE-FORMAT.md): >= 2 hotspots, unless all placeholder
            for gag, states in TWO_PART.items():
                hs_g = [h_ for v in views for h_ in v.get("hotspots", []) if h_["gagId"] == gag]
                if state in states and hs_g and not all(h_.get("placeholder") for h_ in hs_g) \
                        and len(hs_g) < 2:
                    fail(f"{fname} — two-part gag {gag} has {len(hs_g)} hotspot(s), want >= 2")

            # coverage (R-03a): every gag due by this band has >=1 hotspot in this state
            missing = due_gags - {gid for v in views for h_ in v.get("hotspots", [])
                                   for gid in [h_["gagId"]]}
            if missing:
                fail(f"{fname} — gags due by band {band} with no hotspot: {sorted(missing)}")

        # both states share the skeleton, so the toggle keeps the visitor's place
        if skeletons.get((band, "without")) != skeletons.get((band, "built")):
            fail(f"band {band} — built and without differ in view ids/kinds/parents/"
                 f"labels/order (D-042a)")

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
    print("PASS — scene export checks (schema 2): rooms + close-ups, skeleton, default, "
          "manifest refs, coverage, bounds, spacing, beyond alias, pixel parity "
          "(rooms and close-up crops), determinism.")


if __name__ == "__main__":
    main()
