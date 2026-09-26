"""PH1-08b scene export (D-035/D-036), re-aimed at rooms by PH1-10.

Exports `public/sprites/scenes/<band>-<state>.json` + `index.json`, per the contract in
`docs/product/SCENE-FORMAT.md`. Reuses `layout.scene()` + `compose.resolve()` — the same
data `art/build.py` renders its review previews from — so the exported `entries` are the
list each view is painted from.

**Rooms and close-ups (PH1-10, then D-042).** `layout.scene(band, state)` returns one
placement list per D-036 room — `ground`, `floor-2`, `street` — each a whole room (or,
for `street`, the whole exterior plate). A room's canvas is fitted to what is drawn in it
across *both* states (`compose.fit`), so the two states overlay pixel for pixel and no
room edge cuts anything. Rooms are establishing shots and carry no hotspots. Each room is
followed by its close-ups (`closeups.py`): 180 x 120 crops of the room, one rect for both
states, centred on the gags they hold, whose entries and hotspots are translated into the
close-up's own coordinates (SCENE-FORMAT.md "Views: rooms and close-ups").

**Placeholders (bands 490-750, then 610-750 once 490 is drawn).** No composer exists
yet, so every placeholder band re-exports the nearest drawn band's views verbatim plus one `placeholder: true` box per undrawn gag in
its D-036 home view, placed where the room is emptiest and >= 48 px from every other
primary (`_place_placeholders`), grouped into "Not drawn yet" close-ups of their own. A
room that band 490 doesn't have yet (`top`) is an empty canvas holding only its boxes.
"""
from __future__ import annotations

import json
import os

from PIL import Image

from .dsl import Canvas, save_png
from . import closeups, compose, layout
from .closeups import CLOSEUP_W, CLOSEUP_H
from .vox import dotted

_HERE = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT = os.path.dirname(os.path.dirname(_HERE))
SPRITES_DIR = os.path.join(_REPO_ROOT, "public", "sprites")
SCENES_DIR = os.path.join(SPRITES_DIR, "scenes")
THUMBS_DIR = os.path.join(SPRITES_DIR, "thumbs")
PREVIEW_VIEWS_DIR = os.path.join(_REPO_ROOT, "art", "preview", "views")

STATES = ("without", "built")
DRAWN_BANDS = (80, 150, 220, 360, 490, 610, 750)
UNDRAWN_BANDS = ()
ALL_BANDS = DRAWN_BANDS + UNDRAWN_BANDS
NEAREST_DRAWN = 750
MAX_W, MAX_H = 360, 240          # D-036 rule 3

# The part of a gag that carries its D-036 primary hotspot. A dict means the primary
# location differs by state (the "before" and "after" are different objects).
HOME_PART = {
    "G1.1": "closet", "G1.2": "pit",
    "G2.1": {"without": "queue", "built": "helpdesk"},
    "G2.2": "cable", "G2.3": "lobby",
    "G3.2": "trolley", "G4.2": "desk", "G4.3": "desks",
    "G5.1": "handover", "G2.4": "room", "G7.3a": "board",
    # PH1-11
    "G5.3": "server", "G5.4": "phones", "G5.6": "data", "G7.3": "hats",
    "G3.1": "desk", "G6.4": "door",
    # PH1-12
    "G4.1": "door", "G3.3": "chart", "G5.2": "wing", "G6.3": "shell",
    "G6.1": "balloons", "G6.2": "slope", "G7.1": "robot", "G7.2": "meeting",
    "G7.4": "chain",
}

# D-036 rule 4: the view a gag's *primary* hotspot must be in. Not used to move
# anything — the layout puts each primary part in its home view's room, and the export
# fails if it didn't.
GAG_HOME_VIEW = {
    "G1.1": "ground", "G1.2": "ground", "G2.1": "ground", "G2.2": "ground",
    "G2.3": "ground", "G3.2": "ground", "G4.2": "floor-2", "G4.3": "floor-2",
    "G2.4": "floor-2", "G7.3a": "floor-2", "G5.1": "street",
    "G5.3": "ground", "G5.4": "ground", "G7.3": "floor-2", "G5.6": "street",
    "G3.1": "ground", "G6.4": "street",
    "G4.1": "ground", "G3.3": "floor-2", "G5.2": "street", "G6.3": "street",
    "G6.1": "ground", "G6.2": "floor-2", "G7.1": "ground", "G7.2": "top",
    "G7.4": "floor-2",
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
NEW_GAGS_AT: dict = {}

PLACEHOLDER_BOX = 32   # native px, square
PLACEHOLDER_GAP = 48   # min centre distance to any other primary; > 44 (rule 7)

VIEW_ORDER = layout.VIEW_ORDER


def _view_label(view_id: str) -> str:
    """SCENE-FORMAT.md requires a human `label` on every view (the tab row reads it
    directly — without it the site showed "undefined (N)")."""
    if view_id == "ground":
        return "Ground floor"
    if view_id == "top":
        return "Top floor"
    if view_id == "street":
        return "Street"
    if view_id.startswith("floor-"):
        return f"Floor {view_id.split('-', 1)[1]}"
    raise ValueError(f"no label rule for view id {view_id!r}")


# ---------------------------------------------------------------------------
# views: each a room, fitted to its own contents
# ---------------------------------------------------------------------------

def _site_only(lib: compose.Library, placements: list) -> list:
    """Drop `preview_only` manifest entries (style.md): those exist for the 4x judging
    sheet only and are never drawn by the site."""
    return [p for p in placements
            if "line" in p or not lib.manifest.get(p["sprite"], {}).get("preview_only")]


def view_frame(lib: compose.Library, band: int, view: str):
    """(origin, (w, h)) of `view` at `band`: the room fitted to everything drawn in it
    in either state, plus layout.MARGIN. Fails if the room breaks D-036 rule 3."""
    lists = [_site_only(lib, layout.scene(band, s)[view]) for s in STATES]
    origin, size = compose.fit(lib, lists, layout.MARGIN)
    if size[0] > MAX_W or size[1] > MAX_H:
        raise ValueError(f"band {band} view {view}: room is {size[0]}x{size[1]}, over "
                         f"D-036's {MAX_W}x{MAX_H} — make the room smaller")
    return origin, size


def resolve_view(lib: compose.Library, band: int, state: str, view: str, origin):
    """(placements, lines) for one view: the room's placements resolved at its origin."""
    resolved = compose.resolve(lib, _site_only(lib, layout.scene(band, state)[view]), origin)
    placements = [q for q in resolved if "line" not in q]
    lines = [q for q in resolved if "line" in q]
    return placements, lines


def render_view(lib: compose.Library, band: int, state: str, view: str) -> Image.Image:
    """The room at native scale, *as the site draws it* (no preview-only sprites),
    straight from `layout` + `compose` — never from the exported JSON. This is the
    ground truth the exported view must reproduce pixel for pixel (check_scenes.py)
    and what thumbnails are cut from."""
    origin, size = view_frame(lib, band, view)
    resolved = compose.resolve(lib, _site_only(lib, layout.scene(band, state)[view]), origin)
    return compose.render(lib, resolved, size).img


# ---------------------------------------------------------------------------
# hotspots
# ---------------------------------------------------------------------------

def _bbox(lib: compose.Library, q: dict) -> tuple[int, int, int, int]:
    """Opaque bounds of one placed sprite."""
    img = lib.image(q["sprite"], q.get("frame", "default"), q.get("index", 0))
    ax, ay = lib.anchor(q["sprite"])
    bb = img.getchannel("A").getbbox() or (0, 0, img.width, img.height)
    x0, y0 = q["x"] - ax, q["y"] - ay
    return x0 + bb[0], y0 + bb[1], x0 + bb[2], y0 + bb[3]


def _gag_groups(lib: compose.Library, placements: list) -> dict:
    """{(gagId, part): [x0, y0, x1, y1]} — the union of opaque bounds of every
    placement sharing that gag + part (A1)."""
    groups: dict = {}
    for q in placements:
        gag = q.get("gag")
        if not gag:
            continue
        key = (gag, q.get("part", "main"))
        x0, y0, x1, y1 = _bbox(lib, q)
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


def _hotspots_for_band(lib: compose.Library, band: int, frames: dict) -> dict:
    """{state: {(view, gag, part): [x0,y0,x1,y1]}} in each view's own coordinates. If a
    gag has no placement at all in one state, its rects are copied from the other state
    — the tiles don't move between states, only which sprites are drawn on them (G2.2:
    the cable is gone in `built`, but the spot is still there and still tappable)."""
    per_state = {}
    for state in STATES:
        groups = {}
        for view in layout.views(band):
            placements, _ = resolve_view(lib, band, state, view, frames[view][0])
            for (gag, part), rect in _gag_groups(lib, placements).items():
                groups[(view, gag, part)] = rect
        per_state[state] = groups
    for state, other in (("without", "built"), ("built", "without")):
        have = {g for (_v, g, _p) in per_state[state]}
        for (v, g, p), rect in list(per_state[other].items()):
            if g not in have:
                per_state[state][(v, g, p)] = list(rect)
    return per_state


# ---------------------------------------------------------------------------
# entries
# ---------------------------------------------------------------------------

def _entries_for_view(lib: compose.Library, placements: list, lines: list, band: int,
                      state: str, view: str, size) -> list:
    """Entries in true paint order — the same bucketing `compose.render` uses: `base`
    (list order), then `main` (sorted by `(depth, order)`), then `over` (list order) —
    so a painter that just draws the array in order (as the contract says the web
    painter does) reproduces the same picture."""
    base, main, over = [], [], []
    for q in placements:
        entry = {
            "sprite": q["sprite"], "frame": q.get("frame", "default"),
            "x": q["x"], "y": q["y"],
            "depth": round(q.get("depth", q.get("order", 0)), 3),
        }
        if q.get("gag"):
            entry["gagId"] = q["gag"]
            entry["part"] = q.get("part", "main")
        if "alpha" in q:
            entry["alpha"] = q["alpha"]
        layer = q.get("layer", "main")
        if layer == "base":
            base.append(entry)
        elif layer == "over":
            over.append((q.get("order", 0), entry))
        else:
            main.append((entry["depth"], q.get("order", 0), entry))
    main.sort(key=lambda t: (t[0], t[1]))

    # "on the network" dotted lines: baked to one overlay sprite per view (A3 — the
    # painter draws images only), inserted into `over` at the *first* line's own
    # `order`, which reproduces `compose.render`'s interleaving of lines with other
    # over-layer sprites (cards, notes).
    if lines:
        by_id = {p["id"]: p for p in placements if "id" in p}
        seg, orders = [], []
        for ln in lines:
            p0 = _point_of(lib, by_id, ln["from"])
            p1 = _point_of(lib, by_id, ln["to"])
            seg.append((p0, p1, ln.get("colour", "net"), ln.get("halo", "outline")))
            orders.append(ln.get("order", 0))
        name = f"fx-net-{band}-{state}-{view}"
        _bake_overlay(seg, size[0], size[1], name)
        gags = {(ln.get("gag"), ln.get("part", "main")) for ln in lines}
        bake_entry = {"sprite": name, "frame": "default", "x": 0, "y": 0, "depth": 900}
        if len(gags) == 1:
            g, part = gags.pop()
            if g:
                bake_entry["gagId"], bake_entry["part"] = g, part
        over.append((min(orders), bake_entry))

    over.sort(key=lambda t: t[0])
    return base + [e for (_d, _o, e) in main] + [e for (_o, e) in over]


def _point_of(lib, by_id, ref):
    t = by_id[ref["id"]]
    ax, ay = lib.anchor(t["sprite"])
    px, py = lib.point(t["sprite"], ref["point"])
    return (t["x"] - ax + px, t["y"] - ay + py)


_manifest_additions: dict = {}
# (band, gag) -> (room id, close-up rect) of the gag's primary in `without`: thumbs
_primary_closeup: dict = {}


def _bake_overlay(segments, w, h, name):
    """Bake dotted-line segments (A3, style.md "On the network") into one palette-only
    overlay PNG the size of the view, registered under a manifest key so it resolves
    like any sprite."""
    c = Canvas(w, h)
    for (p0, p1, colour, halo) in segments:
        dotted(c, p0, p1, colour, halo=halo)
    fname = f"{name}.png"
    save_png(c, os.path.join(SPRITES_DIR, fname))
    _manifest_additions[name] = {
        "w": w, "h": h, "anchor": [0, 0],
        "frames": {"default": [{"file": fname, "duration": 0}]},
    }


# ---------------------------------------------------------------------------
# a band as a model: rooms (entries per state) + every gag part's rect in room coords
# ---------------------------------------------------------------------------

def _band_model(lib: compose.Library, band: int) -> dict:
    """{"rooms": [(view_id, w, h, {state: entries})], "groups": {state: {(view, gag,
    part): [x0, y0, x1, y1]}}, "primaries": {state: {gag: part}}}, all in each room's
    own coordinates. Fails if a primary is drawn outside its D-036 home room."""
    frames = {v: view_frame(lib, band, v) for v in layout.views(band)}
    groups = _hotspots_for_band(lib, band, frames)
    rooms = []
    for view_id in layout.views(band):
        origin, (w, h) = frames[view_id]
        per_state = {}
        for state in STATES:
            placements, lines = resolve_view(lib, band, state, view_id, origin)
            per_state[state] = _entries_for_view(lib, placements, lines, band, state,
                                                 view_id, (w, h))
        rooms.append((view_id, w, h, per_state))
    primaries = {}
    for state in STATES:
        parts_by_gag: dict = {}
        for (_v, gag, part) in groups[state]:
            parts_by_gag.setdefault(gag, set()).add(part)
        primaries[state] = {g: _primary_part(g, state, ps) for g, ps in parts_by_gag.items()}
        for (v, gag, part) in groups[state]:
            if primaries[state][gag] == part and GAG_HOME_VIEW.get(gag, v) != v:
                raise ValueError(f"band {band} {state}: {gag}'s primary part {part!r} is "
                                 f"drawn in {v}, but its D-036 home view is "
                                 f"{GAG_HOME_VIEW[gag]}")
    return {"rooms": rooms, "groups": groups, "primaries": primaries,
            "placeholder": set()}


# ---------------------------------------------------------------------------
# close-ups (D-042): crops of their parent room, in their own coordinates
# ---------------------------------------------------------------------------

def _closeup_rect(band: int, view_id: str, label: str, boxes: list, room_w: int,
                  room_h: int) -> dict:
    """A CLOSEUP_W x CLOSEUP_H rect centred on the union of `boxes` (both states), then
    clamped inside the room. Fails if the cluster can't fit: re-cluster in closeups.py."""
    if not boxes:
        raise ValueError(f"band {band} {view_id} close-up {label!r} holds nothing drawn")
    x0 = min(b[0] for b in boxes)
    y0 = min(b[1] for b in boxes)
    x1 = max(b[2] for b in boxes)
    y1 = max(b[3] for b in boxes)
    cw, ch = min(CLOSEUP_W, room_w), min(CLOSEUP_H, room_h)
    if x1 - x0 > cw or y1 - y0 > ch:
        raise ValueError(f"band {band} {view_id} close-up {label!r}: its gags span "
                         f"{x1 - x0}x{y1 - y0}, over {cw}x{ch} — split the cluster")
    rx = max(0, min((x0 + x1 - cw) // 2, room_w - cw))
    ry = max(0, min((y0 + y1 - ch) // 2, room_h - ch))
    return {"x": rx, "y": ry, "w": cw, "h": ch}


def _entry_bounds(lib: compose.Library, e: dict):
    m = lib.manifest.get(e["sprite"]) or _manifest_additions[e["sprite"]]
    ax, ay = m["anchor"]
    return e["x"] - ax, e["y"] - ay, e["x"] - ax + m["w"], e["y"] - ay + m["h"]


def _crop_entries(lib: compose.Library, entries: list, rect: dict) -> list:
    """The room's entries that paint anything inside `rect`, translated into the
    close-up's own coordinates (negative where they overhang), paint order kept."""
    out = []
    rx, ry, rw, rh = rect["x"], rect["y"], rect["w"], rect["h"]
    for e in entries:
        x0, y0, x1, y1 = _entry_bounds(lib, e)
        if x1 <= rx or y1 <= ry or x0 >= rx + rw or y0 >= ry + rh:
            continue
        out.append({**e, "x": e["x"] - rx, "y": e["y"] - ry})
    return out


def _clip(r, rect):
    """Room-coord rect `r` clipped to `rect`, in close-up coords, or None if outside."""
    rx, ry = rect["x"], rect["y"]
    x0, y0 = max(r[0], rx), max(r[1], ry)
    x1, y1 = min(r[2], rx + rect["w"]), min(r[3], ry + rect["h"])
    if x0 >= x1 or y0 >= y1:
        return None
    return x0 - rx, y0 - ry, x1 - rx, y1 - ry


def _closeup_specs(band: int, view_id: str, model: dict) -> list:
    """[(label, gags)] for one room: the art's clusters (closeups.py), plus, on a
    placeholder band, the placeholder boxes' own clusters."""
    specs = list(closeups.closeups(view_id, model.get("closeup_band", band)))
    specs += model.get("placeholder_specs", {}).get(view_id, [])
    return specs


def _build_views(lib: compose.Library, band: int, model: dict, own_gags: set) -> dict:
    """{state: views[]} — each room followed directly by its close-ups (D-042)."""
    groups, primaries = model["groups"], model["primaries"]
    out = {s: [] for s in STATES}
    claimed = set()
    for view_id, w, h, entries_by_state in model["rooms"]:
        specs = _closeup_specs(band, view_id, model)
        if view_id != "ground" and not specs:
            raise ValueError(f"band {band}: room {view_id} has no close-up (D-042) — it "
                             f"should not exist yet")
        rects = []
        for label, gags in specs:
            if len(label) > 24:
                raise ValueError(f"close-up label {label!r} is over 24 characters")
            boxes = [r for s in STATES for (v, g, _p), r in groups[s].items()
                     if v == view_id and g in gags]
            rects.append(_closeup_rect(band, view_id, label, boxes, w, h))
        for state in STATES:
            out[state].append({
                "id": view_id, "kind": "room", "label": _view_label(view_id),
                "size": {"w": w, "h": h}, "focus": {"x": 0, "y": 0, "w": w, "h": h},
                "entries": entries_by_state[state], "hotspots": [],
            })
            for n, ((label, gags), rect) in enumerate(zip(specs, rects), start=1):
                cid = f"{view_id}.{n}"
                hs = []
                for (v, g, p), r in groups[state].items():
                    if v != view_id or g not in gags:
                        continue
                    is_primary = primaries[state].get(g) == p
                    c = _clip(r, rect)
                    if c is None:
                        raise ValueError(f"band {band} {state}: {g}/{p} is outside "
                                         f"close-up {cid} ({label})")
                    if is_primary and (c[2] - c[0], c[3] - c[1]) != (r[2] - r[0], r[3] - r[1]):
                        raise ValueError(f"band {band} {state}: {g}'s primary is cut by "
                                         f"close-up {cid}'s rect")
                    h_ = {"gagId": g, "part": p, "x": c[0], "y": c[1],
                          "w": c[2] - c[0], "h": c[3] - c[1], "primary": is_primary}
                    if (v, g, p) in model["placeholder"]:
                        h_["placeholder"] = True
                    hs.append(h_)
                    claimed.add((state, v, g, p))
                    if is_primary and state == "without":
                        _primary_closeup[(band, g)] = (view_id, rect)
                hs.sort(key=lambda h_: (h_["gagId"], h_["part"]))
                n_prim = sum(1 for h_ in hs if h_["primary"])
                if not 1 <= n_prim <= 3:
                    raise ValueError(f"band {band} {state}: close-up {cid} ({label}) holds "
                                     f"{n_prim} primaries, want 1-3 (D-042)")
                out[state].append({
                    "id": cid, "kind": "closeup", "parent": view_id, "label": label,
                    "rect": dict(rect), "size": {"w": rect["w"], "h": rect["h"]},
                    "focus": {"x": 0, "y": 0, "w": rect["w"], "h": rect["h"]},
                    "entries": _crop_entries(lib, entries_by_state[state], rect),
                    "hotspots": hs,
                })
    for state in STATES:
        missed = [k for k in groups[state] if (state,) + k not in claimed]
        if missed:
            raise ValueError(f"band {band} {state}: gag parts in no close-up: {missed} — "
                             f"add them to a cluster in closeups.py")
        _mark_default(out[state], own_gags)
    return out


def _write_doc(band: int, state: str, vlist: list) -> str:
    doc = {"schema": 2, "band": band, "state": state, "views": vlist}
    fname = f"{band}-{state}.json"
    with open(os.path.join(SCENES_DIR, fname), "w") as f:
        json.dump(doc, f, indent=2, sort_keys=False)
        f.write("\n")
    return fname


def _mark_default(vlist: list, own_gags: set):
    """D-042: the close-up with the most primaries among the band's own gags; ties to
    the earlier one (vlist is in navigation order). Rooms are never the default."""
    def n(v):
        return sum(1 for h_ in v["hotspots"] if h_["primary"] and h_["gagId"] in own_gags)
    best = None
    for v in vlist:
        if v["kind"] == "closeup" and (best is None or n(v) > n(best)):
            best = v
    for v in vlist:
        if v is best:
            v["default"] = True
        else:
            v.pop("default", None)


def _write_band(lib: compose.Library, band: int, model: dict, own_gags: set) -> dict:
    views = _build_views(lib, band, model, own_gags)
    return {state: _write_doc(band, state, views[state]) for state in STATES}


def export_band(lib: compose.Library, band: int, band_new_gags: set) -> dict:
    return _write_band(lib, band, _band_model(lib, band), band_new_gags)


# ---------------------------------------------------------------------------
# placeholder bands: the nearest drawn band's rooms and close-ups, plus
# placeholder:true boxes in close-ups of their own
# ---------------------------------------------------------------------------

def _place_placeholders(img: Image.Image | None, w: int, h: int, hotspots: list,
                        gags: list):
    """Place one PLACEHOLDER_BOX square per gag in a w x h view: >= PLACEHOLDER_GAP
    from every primary centre (real and already placed), preferring the emptiest part of
    the room (fewest opaque pixels under the box) and never over a real hotspot if it
    can be helped. If the room is full, the canvas grows downward (never cropping it)
    within D-036's 240 px. Returns (boxes, w, h)."""
    B, G = PLACEHOLDER_BOX, PLACEHOLDER_GAP
    alpha = img.getchannel("A") if img is not None else None
    centres = [(h_["x"] + h_["w"] / 2, h_["y"] + h_["h"] / 2) for h_ in hotspots
               if h_.get("primary")]
    rects = [(h_["x"], h_["y"], h_["x"] + h_["w"], h_["y"] + h_["h"]) for h_ in hotspots]
    boxes = []
    for gag in gags:
        while True:
            best = None
            for y in range(4, h - B - 3, 4):
                for x in range(4, w - B - 3, 4):
                    cx, cy = x + B / 2, y + B / 2
                    if any((cx - px) ** 2 + (cy - py) ** 2 < G * G for px, py in centres):
                        continue
                    over = sum(1 for (a, b, c, d) in rects
                               if x < c and x + B > a and y < d and y + B > b)
                    ink = 0
                    if alpha is not None and y + B <= alpha.height and x + B <= alpha.width:
                        ink = sum(1 for v in alpha.crop((x, y, x + B, y + B)).getdata() if v)
                    score = (over, ink, y, x)
                    if best is None or score < best[0]:
                        best = (score, x, y)
            if best is not None:
                break
            if h + G > MAX_H:
                raise ValueError(f"no room for placeholder {gag} in a {w}x{h} view")
            h += G
        _s, x, y = best
        boxes.append({"gagId": gag, "part": "main", "x": x, "y": y, "w": B, "h": B,
                      "primary": True, "placeholder": True})
        centres.append((x + B / 2, y + B / 2))
        rects.append((x, y, x + B, y + B))
    return boxes, w, h


def _cluster_boxes(boxes: list) -> list:
    """Greedy, in placement order: up to 3 placeholder boxes per close-up whose union
    fits CLOSEUP_W x CLOSEUP_H."""
    clusters: list = []
    for b in boxes:
        for c in clusters:
            xs = [q["x"] for q in c + [b]] + [q["x"] + q["w"] for q in c + [b]]
            ys = [q["y"] for q in c + [b]] + [q["y"] + q["h"] for q in c + [b]]
            if len(c) < 3 and max(xs) - min(xs) <= CLOSEUP_W and max(ys) - min(ys) <= CLOSEUP_H:
                c.append(b)
                break
        else:
            clusters.append([b])
    return clusters


def export_placeholder_band(lib: compose.Library, band: int, cumulative_new: list,
                            base: dict, own_gags: set) -> dict:
    by_view_gags: dict = {}
    for gag in cumulative_new:
        by_view_gags.setdefault(PLACEHOLDER_VIEW[gag], []).append(gag)

    groups = {s: dict(base["groups"][s]) for s in STATES}
    primaries = {s: dict(base["primaries"][s]) for s in STATES}
    rooms_in = {v: (w, h, es) for (v, w, h, es) in base["rooms"]}
    view_ids = [v for v in VIEW_ORDER if v in rooms_in or v in by_view_gags]
    rooms, placeholder, specs = [], set(), {}
    for view_id in view_ids:
        if view_id in rooms_in:
            w, h, entries = rooms_in[view_id]
            img = paint_entries(lib, entries["without"], w, h)
        else:
            w, h, entries, img = 200, 120, {s: [] for s in STATES}, None
        real = [{"x": r[0], "y": r[1], "w": r[2] - r[0], "h": r[3] - r[1],
                 "primary": base["primaries"]["without"].get(g) == p}
                for (v, g, p), r in base["groups"]["without"].items() if v == view_id]
        boxes, w, h = _place_placeholders(img, w, h, real, by_view_gags.get(view_id, []))
        for b in boxes:
            key = (view_id, b["gagId"], "main")
            for s in STATES:
                groups[s][key] = [b["x"], b["y"], b["x"] + b["w"], b["y"] + b["h"]]
                primaries[s][b["gagId"]] = "main"
            placeholder.add(key)
        specs[view_id] = [("Not drawn yet", [b["gagId"] for b in c])
                          for c in _cluster_boxes(boxes)]
        rooms.append((view_id, w, h, entries))
    model = {"rooms": rooms, "groups": groups, "primaries": primaries,
             "placeholder": placeholder, "placeholder_specs": specs,
             "closeup_band": NEAREST_DRAWN}
    return _write_band(lib, band, model, own_gags)


# ---------------------------------------------------------------------------
# the reference painter — exactly what the contract says the web painter does:
# draw `entries` in array order, sprite anchor handling identical to `compose.paste`,
# clipped to the view's canvas. Used both to write art/preview/views/*.png (so there
# is something to look at) and, independently, by check_scenes.py's parity check.
# ---------------------------------------------------------------------------

def paint_entries(lib: compose.Library, entries: list, w: int, h: int) -> Image.Image:
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for e in entries:
        sprite_img = lib.image(e["sprite"], e.get("frame", "default"), e.get("index", 0))
        ax, ay = lib.anchor(e["sprite"])
        x0, y0 = e["x"] - ax, e["y"] - ay
        x1, y1 = x0 + sprite_img.width, y0 + sprite_img.height
        cx0, cy0 = max(x0, 0), max(y0, 0)
        cx1, cy1 = min(x1, w), min(y1, h)
        if cx0 >= cx1 or cy0 >= cy1:
            continue
        piece = sprite_img.crop((cx0 - x0, cy0 - y0, cx1 - x0, cy1 - y0))
        alpha = e.get("alpha", 1.0)
        if alpha != 1.0:
            piece = piece.copy()
            piece.putalpha(piece.getchannel("A").point(lambda v: int(v * alpha)))
        img.alpha_composite(piece, (cx0, cy0))
    return img


def export_view_previews(lib: compose.Library) -> list:
    """Write art/preview/views/<band>-<state>-<viewId>@1x.png for every drawn band and
    view, painted with `paint_entries` from the exported JSON (not re-derived), so the
    art side's own preview and the parity check use the same painter."""
    os.makedirs(PREVIEW_VIEWS_DIR, exist_ok=True)
    written = []
    for band in DRAWN_BANDS:
        for state in STATES:
            with open(os.path.join(SCENES_DIR, f"{band}-{state}.json")) as f:
                doc = json.load(f)
            for v in doc["views"]:
                w, h = v["size"]["w"], v["size"]["h"]
                img = paint_entries(lib, v["entries"], w, h)
                fname = f"{band}-{state}-{v['id']}@1x.png"
                img.save(os.path.join(PREVIEW_VIEWS_DIR, fname))
                written.append(fname)
    return written


# ---------------------------------------------------------------------------
# thumbnails (R-04) — drawn gags only, cut from the view holding the primary
# ---------------------------------------------------------------------------

def export_thumbs(lib: compose.Library) -> dict:
    """R-04 / D-042: each gag's primary plus an 8 px margin, cut from the `without`
    close-up that holds it (never past that close-up's rect), for the earliest drawn band
    the gag appears in."""
    thumbs = {}
    for band in DRAWN_BANDS:
        frames = {v: view_frame(lib, band, v) for v in layout.views(band)}
        groups = _hotspots_for_band(lib, band, frames)["without"]
        parts_by_gag: dict = {}
        for (_v, gag, part) in groups:
            parts_by_gag.setdefault(gag, set()).add(part)
        for gag, parts in sorted(parts_by_gag.items()):
            if gag in thumbs:
                continue
            part = _primary_part(gag, "without", parts)
            view, rect = _primary_closeup[(band, gag)]
            x0, y0, x1, y1 = groups[(view, gag, part)]
            img = render_view(lib, band, "without", view)
            m = 8
            cx0, cy0 = max(x0 - m, rect["x"]), max(y0 - m, rect["y"])
            cx1 = min(x1 + m, rect["x"] + rect["w"])
            cy1 = min(y1 + m, rect["y"] + rect["h"])
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

    index = {"schema": 2, "bands": {}, "beyond": "750", "thumbs": {}}

    for band in DRAWN_BANDS:
        own_gags = {g for g in HOME_PART if _band_of(g) == band}
        index["bands"][str(band)] = export_band(lib, band, own_gags)

    # `lib.manifest` was loaded before any overlay sprite was baked; merge the bake-time
    # additions in so everything below can resolve them.
    lib.manifest.update(_manifest_additions)

    base = _band_model(lib, NEAREST_DRAWN)
    cumulative = []
    for band in UNDRAWN_BANDS:
        cumulative = cumulative + NEW_GAGS_AT[band]
        index["bands"][str(band)] = export_placeholder_band(lib, band, cumulative, base,
                                                            set(NEW_GAGS_AT[band]))

    index["thumbs"] = export_thumbs(lib)
    export_view_previews(lib)

    # overlay sprites get merged into the shipped manifest so `{sprite, frame}`
    # references resolve (A2 / the manifest check).
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
    "G5.3": 360, "G5.4": 360, "G5.6": 360, "G7.3": 360,
    "G3.1": 490, "G6.4": 490,
    "G4.1": 610, "G5.2": 610, "G3.3": 610, "G6.3": 610,
    "G6.1": 750, "G6.2": 750, "G7.1": 750, "G7.2": 750, "G7.4": 750,
}


def _band_of(gag: str) -> int:
    return _GAG_BAND[gag]
