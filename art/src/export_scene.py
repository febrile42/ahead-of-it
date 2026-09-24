"""PH1-08b: scene export (D-035/D-036).

Exports `public/sprites/scenes/<band>-<state>.json` + `index.json`, per the contract in
`docs/product/SCENE-FORMAT.md`. Reuses `layout.scene()` + `compose.resolve()` — the same
data `art/build.py` renders the whole-building previews from — so the exported `entries`
are the same list the previews are painted from (deliverable 1). This module never calls
`compose.render()` on the full, uncropped room and never changes `art/build.py`'s own
preview crop/scale logic, so `art/preview/<band>-<state>.png` stay byte-identical.

**Views (D-036).** `art/src/layout.py`'s band 80/150/220 composers draw one continuous
room that only grows *wider* (9 -> 12 -> 16 columns), not stacked floors — band 80's
"one floor, then two" and band 150's "three floors" in `docs/content/BANDS-AND-GAGS.md`
are narrative, not yet separate geometry. D-036's `ground`/`floor-2`/`street` labels are
therefore implemented here as **named crop rectangles** into that single plate (verified
empirically: there is a real ~16px gap in the floor tiles between the inset/road region
and the main plate, but *no* gap between the main plate's "ground" and "floor-2" gag
clusters — see the PH1-08b handback for the full account and why this is flagged as a
gap against D-036 rather than silently patched).

**Placeholders (bands 360-750).** No composer exists yet, so every placeholder band
re-exports band 220's views verbatim plus one small `placeholder: true` box per
undrawn gag, positioned by D-036 rule 4's view table (not by any real geometry — there
is none yet) in a reserved strip so 44px spacing holds.
"""
from __future__ import annotations

import json
import os

from PIL import Image

from .dsl import Canvas, save_png
from . import compose, layout
from .vox import dotted

_HERE = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT = os.path.dirname(os.path.dirname(_HERE))
SPRITES_DIR = os.path.join(_REPO_ROOT, "public", "sprites")
SCENES_DIR = os.path.join(SPRITES_DIR, "scenes")
THUMBS_DIR = os.path.join(SPRITES_DIR, "thumbs")

STATES = ("without", "built")
DRAWN_BANDS = (80, 150, 220)
UNDRAWN_BANDS = (360, 490, 610, 750)
ALL_BANDS = DRAWN_BANDS + UNDRAWN_BANDS
NEAREST_DRAWN = 220

# -- D-036 views: named crop rectangles (x0, y0, x1, y1) in the full band canvas ------
# `None` = the whole room (band 80's room is already <=360x240 native px).
VIEW_CROPS = {
    80: [("ground", None)],
    150: [
        ("street", (25, 60, 225, 260)),
        ("ground", (140, 10, 355, 240)),
        ("floor-2", (300, 60, 465, 300)),
    ],
    220: [
        ("street", (25, 60, 225, 260)),
        # `ground`/`floor-2` are wider than band 220 alone needs so the placeholder
        # bands (360-750, which reuse these crops) have a reserved strip for
        # `placeholder: true` boxes without exceeding the 240px height budget.
        ("ground", (140, 10, 470, 220)),
        ("floor-2", (300, 60, 525, 260)),
    ],
}
# Every drawn band >= 220 reuses band 220's crops (360-750 have no composer of their own).
VIEW_CROPS[360] = VIEW_CROPS[490] = VIEW_CROPS[610] = VIEW_CROPS[750] = VIEW_CROPS[220]

# The part of a gag that carries its D-036 primary hotspot. A dict means the primary
# location differs by state (the "before" and "after" are different objects).
HOME_PART = {
    "G1.1": "closet", "G1.2": "pit",
    "G2.1": {"without": "queue", "built": "helpdesk"},
    "G2.2": "cable", "G2.3": "lobby",
    "G3.2": "trolley", "G4.2": "desk", "G4.3": "desks",
    "G5.1": "handover", "G2.4": "room", "G7.3a": "board",
}

# D-036 rule 4's view assignment, for a gag's *primary* hotspot. Authoritative — used
# ahead of geometry, because the composers' physical layout doesn't reliably put a gag
# in the D-036-decided view (G2.3's lobby, for instance, sits physically close to the
# street/inset region even though D-036 calls it a `ground` gag). Non-primary parts of
# a multi-part gag (e.g. G3.2's `box`) are still placed by geometry (nearest crop
# centre): the table only pins down what "one primary hotspot, in its home view" (D-036
# rule 4) requires.
GAG_HOME_VIEW = {
    "G1.1": "ground", "G1.2": "ground", "G2.1": "ground", "G2.2": "ground",
    "G2.3": "ground", "G3.2": "ground", "G4.2": "floor-2", "G4.3": "floor-2",
    "G2.4": "floor-2", "G7.3a": "floor-2", "G5.1": "street",
}

# D-036 rule 4's view assignment for gags with no composer yet (no geometry to derive
# a view from, so the table is authoritative here).
PLACEHOLDER_VIEW = {
    "G5.3": "ground", "G5.4": "ground", "G7.3": "floor-2", "G5.6": "street",       # 360
    "G3.1": "ground", "G6.4": "street",                                            # 490
    "G4.1": "ground", "G5.2": "street", "G3.3": "floor-2", "G6.3": "street",       # 610
    "G6.1": "ground", "G6.2": "floor-2", "G7.1": "ground", "G7.2": "top",
    "G7.4": "floor-2",                                                             # 750
}
# Gags newly introduced at each undrawn band (cumulative — R-03a).
NEW_GAGS_AT = {
    360: ["G5.3", "G5.4", "G5.6", "G7.3"],
    490: ["G3.1", "G6.4"],
    610: ["G4.1", "G5.2", "G3.3", "G6.3"],
    750: ["G6.1", "G6.2", "G7.1", "G7.2", "G7.4"],
}

PLACEHOLDER_BOX = 32   # native px, square
PLACEHOLDER_PITCH = 48  # centre-to-centre; > 44 so the spacing check passes

# D-036 rule 1's canonical view order.
VIEW_ORDER = ["ground", "floor-2", "floor-3", "floor-4", "floor-5", "floor-6", "top", "street"]


def _sort_views(vlist: list) -> list:
    return sorted(vlist, key=lambda v: VIEW_ORDER.index(v["id"]))


# ---------------------------------------------------------------------------
# geometry helpers
# ---------------------------------------------------------------------------

def _bbox(lib: compose.Library, q: dict) -> tuple[int, int, int, int]:
    img = lib.image(q["sprite"], q.get("frame", "default"), q.get("index", 0))
    ax, ay = lib.anchor(q["sprite"])
    x0, y0 = q["x"] - ax, q["y"] - ay
    return x0, y0, x0 + img.width, y0 + img.height


def _resolve_band_state(lib: compose.Library, band: int, state: str):
    """(placements, lines) for a real (drawn) band x state: `layout.scene()` resolved
    through `compose.resolve()` — the entry list the whole-building preview is painted
    from. Skips `preview_only` manifest entries (style.md): those exist for the 4x
    judging sheet only and are never drawn by the site."""
    room = layout.ROOMS[band]
    resolved = compose.resolve(lib, layout.scene(band, state), room["origin"])
    placements, lines = [], []
    for q in resolved:
        if "line" in q:
            lines.append(q)
            continue
        if lib.manifest.get(q["sprite"], {}).get("preview_only"):
            continue
        placements.append(q)
    return placements, lines


def _view_for_rect(band: int, x0: int, y0: int, x1: int, y1: int) -> str:
    """Which named D-036 view a (gag, part)'s bbox belongs to: the crop whose *centre*
    is nearest the bbox's centre. The three crops overlap at their edges (they're
    windows into one continuous plate, not a partition of it — see the module
    docstring), so "which rect contains the point" is not well-defined near a seam;
    nearest-centre is."""
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    crops = VIEW_CROPS[band]
    if len(crops) == 1 and crops[0][1] is None:
        return crops[0][0]
    best, best_d = None, None
    for name, rect in crops:
        rx0, ry0, rx1, ry1 = rect
        rcx, rcy = (rx0 + rx1) / 2, (ry0 + ry1) / 2
        d = (rcx - cx) ** 2 + (rcy - cy) ** 2
        if best_d is None or d < best_d:
            best, best_d = name, d
    return best


# ---------------------------------------------------------------------------
# hotspots
# ---------------------------------------------------------------------------

def _gag_groups(lib: compose.Library, placements: list) -> dict:
    """{(gagId, part): [x0, y0, x1, y1]} — the union of opaque bounds of every
    placement sharing that gag + part (A1)."""
    groups: dict = {}
    for q in placements:
        gag = q.get("gag")
        if not gag:
            continue
        part = q.get("part", "main")
        x0, y0, x1, y1 = _bbox(lib, q)
        key = (gag, part)
        if key in groups:
            g = groups[key]
            g[0], g[1] = min(g[0], x0), min(g[1], y0)
            g[2], g[3] = max(g[2], x1), max(g[3], y1)
        else:
            groups[key] = [x0, y0, x1, y1]
    return groups


def _primary_part(gag: str, state: str, parts_present: set) -> str | None:
    if not parts_present:
        return None
    home = HOME_PART.get(gag)
    if isinstance(home, dict):
        home = home.get(state)
    if home in parts_present:
        return home
    return sorted(parts_present)[0]


def _hotspots_for_band(lib: compose.Library, band: int) -> dict:
    """{state: {(gag, part): [x0,y0,x1,y1]}}. If a gag has no placement at all in one
    state, its rect is copied from the other state — the tile geometry does not move
    between states, only which sprites are drawn on it (e.g. G2.2: the cable is gone in
    `built`, but the floor location is still there and still tappable)."""
    per_state = {}
    for state in STATES:
        placements, _ = _resolve_band_state(lib, band, state)
        per_state[state] = _gag_groups(lib, placements)
    gags = sorted({g for (g, _p) in per_state["without"]} | {g for (g, _p) in per_state["built"]})
    for gag in gags:
        for state, other in (("without", "built"), ("built", "without")):
            has = any(g == gag for (g, _p) in per_state[state])
            if not has:
                for (g, p), rect in per_state[other].items():
                    if g == gag:
                        per_state[state][(g, p)] = list(rect)
    return per_state


# ---------------------------------------------------------------------------
# view assembly
# ---------------------------------------------------------------------------

def _view_size(band: int, view_id: str, rect) -> tuple[int, int, int, int]:
    if rect is None:
        w, h = layout.ROOMS[band]["size"]
        return 0, 0, w, h
    return rect


def _entries_for_view(lib: compose.Library, placements: list, lines: list, band: int,
                       state: str, rect) -> list:
    x0, y0, x1, y1 = rect
    out = []
    order = 0
    for q in placements:
        bx0, by0, bx1, by1 = _bbox(lib, q)
        if bx1 <= x0 or bx0 >= x1 or by1 <= y0 or by0 >= y1:
            continue
        entry = {
            "sprite": q["sprite"], "frame": q.get("frame", "default"),
            "x": q["x"] - x0, "y": q["y"] - y0, "depth": round(q.get("depth", order), 3),
        }
        if q.get("gag"):
            entry["gagId"] = q["gag"]
            entry["part"] = q.get("part", "main")
        if "alpha" in q:
            entry["alpha"] = q["alpha"]
        out.append(entry)
        order += 1
    # band 80's "on the network" dotted lines: baked to one overlay sprite per view
    # that actually shows any of them (A3 — the painter draws images only).
    if lines:
        by_id = {p["id"]: p for p in placements if "id" in p}
        seg = []
        for ln in lines:
            try:
                p0 = _point_of(lib, by_id, ln["from"])
                p1 = _point_of(lib, by_id, ln["to"])
            except KeyError:
                continue
            seg.append((p0, p1, ln.get("colour", "net"), ln.get("halo", "outline")))
        seg = [(p0, p1, c, h) for (p0, p1, c, h) in seg
               if not (max(p0[0], p1[0]) <= x0 or min(p0[0], p1[0]) >= x1
                       or max(p0[1], p1[1]) <= y0 or min(p0[1], p1[1]) >= y1)]
        if seg:
            name = f"fx-net-{band}-{state}-{_slug(rect)}"
            _bake_overlay(lib, seg, x0, y0, x1 - x0, y1 - y0, name)
            out.append({"sprite": name, "frame": "default", "x": 0, "y": 0, "depth": 900,
                        "gagId": "G2.3", "part": "lobby"})
    return out


def _slug(rect) -> str:
    return "-".join(str(v) for v in rect)


def _point_of(lib, by_id, ref):
    t = by_id[ref["id"]]
    ax, ay = lib.anchor(t["sprite"])
    px, py = lib.point(t["sprite"], ref["point"])
    return (t["x"] - ax + px, t["y"] - ay + py)


_manifest_additions: dict = {}


def _bake_overlay(lib, segments, ox, oy, w, h, name):
    """Bake dotted-line segments (A3, style.md "On the network") into one palette-only
    overlay PNG, and register it under a manifest key so it resolves like any sprite."""
    c = Canvas(w, h)
    for (p0, p1, colour, halo) in segments:
        dotted(c, (p0[0] - ox, p0[1] - oy), (p1[0] - ox, p1[1] - oy), colour, halo=halo)
    fname = f"{name}.png"
    save_png(c, os.path.join(SPRITES_DIR, fname))
    _manifest_additions[name] = {
        "w": w, "h": h, "anchor": [0, 0],
        "frames": {"default": [{"file": fname, "duration": 0}]},
    }


# ---------------------------------------------------------------------------
# real (drawn) bands
# ---------------------------------------------------------------------------

def _views_for_band(lib: compose.Library, band: int) -> list:
    hotspots_by_state = _hotspots_for_band(lib, band)
    views_out = []
    for view_id, rect in VIEW_CROPS[band]:
        x0, y0, x1, y1 = _view_size(band, view_id, rect)
        w, h = x1 - x0, y1 - y0
        per_state = {}
        for state in STATES:
            placements, lines = _resolve_band_state(lib, band, state)
            entries = _entries_for_view(lib, placements, lines, band, state, (x0, y0, x1, y1))
            groups = hotspots_by_state[state]
            hs = []
            # which part is primary for each gag, in this state
            parts_by_gag: dict = {}
            for (gag, part) in groups:
                parts_by_gag.setdefault(gag, set()).add(part)
            primaries = {gag: _primary_part(gag, state, parts)
                        for gag, parts in parts_by_gag.items()}
            for (gag, part), (gx0, gy0, gx1, gy1) in groups.items():
                is_primary = primaries.get(gag) == part
                target = (GAG_HOME_VIEW.get(gag) if is_primary and gag in GAG_HOME_VIEW
                          else _view_for_rect(band, gx0, gy0, gx1, gy1))
                if target != view_id:
                    continue
                hs.append({
                    "gagId": gag, "part": part,
                    "x": gx0 - x0, "y": gy0 - y0, "w": gx1 - gx0, "h": gy1 - gy0,
                    "primary": is_primary,
                })
            per_state[state] = {"entries": entries, "hotspots": hs}
        views_out.append((view_id, w, h, per_state))
    return views_out


def export_band(lib: compose.Library, band: int, band_new_gags: set) -> dict:
    views = _views_for_band(lib, band)
    files = {}
    for state in STATES:
        vlist = []
        primaries_by_view = {}
        for view_id, w, h, per_state in views:
            hs = per_state[state]["hotspots"]
            if view_id != "ground" and not hs:
                continue  # D-036 rule 2: non-ground views only exist if they hold a primary
            n_primary_own = sum(1 for h_ in hs if h_["primary"] and h_["gagId"] in band_new_gags)
            primaries_by_view[view_id] = n_primary_own
            vlist.append({
                "id": view_id, "size": {"w": w, "h": h},
                "focus": {"x": 0, "y": 0, "w": w, "h": h},
                "entries": per_state[state]["entries"],
                "hotspots": hs,
            })
        if vlist:
            best = max(vlist, key=lambda v: primaries_by_view.get(v["id"], 0))
            for v in vlist:
                v["default"] = v is best
        doc = {"schema": 1, "band": band, "state": state, "views": _sort_views(vlist)}
        fname = f"{band}-{state}.json"
        with open(os.path.join(SCENES_DIR, fname), "w") as f:
            json.dump(doc, f, indent=2, sort_keys=False)
            f.write("\n")
        files[state] = fname
    return files


# ---------------------------------------------------------------------------
# placeholder bands (360-750): band 220's views + placeholder:true boxes
# ---------------------------------------------------------------------------

def export_placeholder_band(lib: compose.Library, band: int, cumulative_new: list) -> dict:
    base_views = _views_for_band(lib, NEAREST_DRAWN)
    by_view_gags: dict = {}
    for gag in cumulative_new:
        by_view_gags.setdefault(PLACEHOLDER_VIEW[gag], []).append(gag)

    files = {}
    for state in STATES:
        vlist = []
        seen_views = {v for v, _, _, _ in base_views} | set(by_view_gags)
        for view_id in ["ground"] + sorted(v for v in seen_views if v != "ground"):
            base = next(((w, h, ps) for (vid, w, h, ps) in base_views if vid == view_id), None)
            if base is None:
                w, h, entries, hs = 200, 120, [], []
            else:
                w, h, per_state = base
                entries = list(per_state[state]["entries"])
                # drawn gags keep exactly the real hotspot band 220 exported (D-036's
                # `default`/primary bookkeeping is scoped to a band's own new gags, and
                # these were some earlier band's own gags, not this one's)
                hs = [dict(h_) for h_ in per_state[state]["hotspots"]]
            gags_here = by_view_gags.get(view_id, [])
            if gags_here or hs:
                # one reserved row below the real content, as wide as the view allows
                # (up to the 360px budget) so `n` placeholder boxes fit in one row at
                # >= 44px spacing before a second row is ever needed.
                cols = max(1, min(len(gags_here), 360 // PLACEHOLDER_PITCH))
                content_bottom = max([h_["y"] + h_["h"] for h_ in hs], default=0)
                strip_y = content_bottom + 24
                if gags_here:
                    h = content_bottom  # entries beyond this are empty space; the
                    # reserved strip below is sized to what it actually needs, so the
                    # view stays inside the 240px budget instead of the whole crop's
                    # nominal (looser) height.
                for i, gag in enumerate(gags_here):
                    col, row = i % cols, i // cols
                    bx = 8 + col * PLACEHOLDER_PITCH
                    by = strip_y + row * PLACEHOLDER_PITCH
                    hs.append({
                        "gagId": gag, "part": "main",
                        "x": bx, "y": by, "w": PLACEHOLDER_BOX, "h": PLACEHOLDER_BOX,
                        "primary": True, "placeholder": True,
                    })
                    w = max(w, bx + PLACEHOLDER_BOX + 8)
                    h = max(h, by + PLACEHOLDER_BOX + 8)
                vlist.append({
                    "id": view_id, "size": {"w": w, "h": h},
                    "focus": {"x": 0, "y": 0, "w": w, "h": h},
                    "default": view_id == "ground",
                    "entries": entries, "hotspots": hs,
                })
        doc = {"schema": 1, "band": band, "state": state, "views": _sort_views(vlist)}
        fname = f"{band}-{state}.json"
        with open(os.path.join(SCENES_DIR, fname), "w") as f:
            json.dump(doc, f, indent=2, sort_keys=False)
            f.write("\n")
        files[state] = fname
    return files


# ---------------------------------------------------------------------------
# thumbnails (R-04) — drawn gags only; see the handback for undrawn ones
# ---------------------------------------------------------------------------

def _render_full_1x(lib: compose.Library, band: int, state: str) -> Image.Image:
    room = layout.ROOMS[band]
    resolved = compose.resolve(lib, layout.scene(band, state), room["origin"])
    c = compose.render(lib, resolved, room["size"])
    return c.img


def export_thumbs(lib: compose.Library) -> dict:
    thumbs = {}
    for band in DRAWN_BANDS:
        placements, _ = _resolve_band_state(lib, band, "without")
        groups = _gag_groups(lib, placements)
        parts_by_gag: dict = {}
        for (gag, part) in groups:
            parts_by_gag.setdefault(gag, set()).add(part)
        img = None
        for gag, parts in parts_by_gag.items():
            if gag in thumbs:
                continue
            part = _primary_part(gag, "without", parts)
            x0, y0, x1, y1 = groups[(gag, part)]
            m = 8
            room_w, room_h = layout.ROOMS[band]["size"]
            cx0, cy0 = max(x0 - m, 0), max(y0 - m, 0)
            cx1, cy1 = min(x1 + m, room_w), min(y1 + m, room_h)
            if img is None:
                img = _render_full_1x(lib, band, "without")
            crop = Canvas(cx1 - cx0, cy1 - cy0)
            crop.img = img.crop((cx0, cy0, cx1, cy1))
            fname = f"{gag}.png"
            save_png(crop, os.path.join(THUMBS_DIR, fname))
            thumbs[gag] = f"thumbs/{fname}"
    return thumbs


# ---------------------------------------------------------------------------
# orchestration
# ---------------------------------------------------------------------------

def export_all():
    os.makedirs(SCENES_DIR, exist_ok=True)
    os.makedirs(THUMBS_DIR, exist_ok=True)
    lib = compose.Library(SPRITES_DIR)

    index = {"schema": 1, "bands": {}, "beyond": "750", "thumbs": {}}

    cumulative = []
    for band in ALL_BANDS:
        if band in DRAWN_BANDS:
            own_gags = {g for g, part_map in HOME_PART.items()
                        if _band_of(g) == band}
            files = export_band(lib, band, own_gags)
        else:
            cumulative = cumulative + NEW_GAGS_AT[band]
            files = export_placeholder_band(lib, band, cumulative)
        index["bands"][str(band)] = files

    index["thumbs"] = export_thumbs(lib)

    # manifest additions (dotted-line overlay sprites) get merged into the shipped
    # manifest so `{sprite, frame}` references resolve (A2/the manifest check).
    if _manifest_additions:
        manifest_path = os.path.join(SPRITES_DIR, "manifest.json")
        with open(manifest_path) as f:
            manifest = json.load(f)
        manifest.update(_manifest_additions)
        with open(manifest_path, "w") as f:
            json.dump(manifest, f, indent=2, sort_keys=True)
            f.write("\n")

    with open(os.path.join(SCENES_DIR, "index.json"), "w") as f:
        json.dump(index, f, indent=2, sort_keys=False)
        f.write("\n")


_GAG_BAND = {
    "G1.1": 80, "G1.2": 80, "G2.1": 80, "G2.2": 80, "G2.3": 80,
    "G3.2": 150, "G4.2": 150, "G4.3": 150, "G5.1": 150,
    "G2.4": 220, "G7.3a": 220,
}


def _band_of(gag: str) -> int:
    return _GAG_BAND[gag]
