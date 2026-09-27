"""PH2-03 step 2: the band-crossing moments as scene data (SCENE-FORMAT.md "Band-crossing
moment", D-045, `docs/content/MOMENTS.md`).

A moment is the band's own gag, its **Already** line played forward in <= 2.5 s, in the
built file's default close-up: the threat arrives and meets what was already built. It is
exported as a `moment` block, a complete paint list for that one view whose moving
entries are PH2-01 walkers played once (their legs sum to `ms`), so the web plays it with
the ticker it already has and no new arithmetic. It ends on the exported built scene,
pixel for pixel, and holds it (`check_scenes.py` proves both).

Three parts, like `motion.py`:

  1. **Keys** (`add_keys`): the states a moment needs that no band drew: `hidden` (a
     transparent file on the sprite's canvas, for an entrance or an exit) and keys
     threaded from files that already exist (`worker-seated` `d-wave`).
  2. **Beats** (`BEATS`) and the **export** (`export`): which placements of the built
     room act, and their legs, as offsets from the pose they end in (the exported one).
  3. **The reference** (`room_at`): the pipeline's own depth-sorted render of the room at
     moment time m, from the layout, never from the export. `check_scenes.py` compares
     the exported moment, painted in array order, with it at every sampled m.

Everything is a pure function of the layout and this table, so three `build.py` runs stay
byte-identical.
"""
from __future__ import annotations

import os

from .dsl import Canvas, save_png
from . import compose, motion

MS_MAX = 2500           # the brief: <= 2.5 s
HOLD_MIN = 250          # every moment holds its end frame (the exported scene) this long

# sprites with an invisible state, for an entrance or an exit inside a moment
HIDDEN = ("card-report", "fishing-line", "infosec", "worker-e", "worker-seated")
# {sprite: {new key: (source sprite, source key)}}: files that already ship, by reference
THREADED = {"worker-seated": {"d-wave": ("worker-seated-wave", "d")}}


def add_keys(manifest: dict, sprites_dir: str):
    """`hidden` and the threaded keys (build.py, after every sprite is saved)."""
    for name in HIDDEN:
        m = manifest[name]
        if "hidden" in m["frames"]:
            raise ValueError(f"{name}: key 'hidden' already exists")
        fname = f"{name}-hidden.png"
        save_png(Canvas(m["w"], m["h"]), os.path.join(sprites_dir, fname))
        m["frames"]["hidden"] = [{"file": fname, "duration": 0}]
    for name, keys in THREADED.items():
        m = manifest[name]
        for key, (src, src_key) in keys.items():
            s = manifest[src]
            if (s["w"], s["h"], s["anchor"]) != (m["w"], m["h"], m["anchor"]):
                raise ValueError(f"{name}.{key}: {src} has another canvas or anchor")
            if key in m["frames"]:
                raise ValueError(f"{name}: key {key!r} already exists")
            m["frames"][key] = [dict(f) for f in s["frames"][src_key]]


# ---------------------------------------------------------------------------
# 2. the beats
# ---------------------------------------------------------------------------

def mv(frame: str, to: tuple, ms: int) -> dict:
    """A move leg to `to`, an offset from the actor's end pose."""
    return {"frame": frame, "to": to, "ms": ms}


def hold(frame: str, ms: int) -> dict:
    return {"frame": frame, "hold": ms}


# {band: {gag, ms, actors}}. An actor either `match`es exactly one placement of the built
# room (it ends in that placement's exported pose) or `add`s a transient sprite placed
# `at` an offset from the matched placement's anchor and painted in the depth slot `dz`
# after it; a transient ends hidden. `start` is the first pose, an offset from the end
# pose. `aloft`: the actor moves in height, not across the floor, so its depth stays. Everything not listed holds still for the moment (its clock starts after).
#
# 360 (G5.3, the box fan) is dropped, not shipped weak (MOMENTS.md rated it at risk). In
# the default close-up the only floor a walker can reach without crossing G3.2's trolley
# or G1.1's closet is a 20 px strip in front of the raised closet, ~60 px below the
# VIRTUALISED card; the carrier can neither reach the rack nor stop at the badge, and a
# person turning round with a fan below a label does not say "no heat to fight" cold.
LINE_STOP = 10          # 150: px above its without pose, where the envelope meets the rim

BEATS = {
    # G4.2 (E-20): band 150's own phishing line comes down from above the crop, hits the
    # shield (one held white flash), and is stopped on the rim; REPORT flashes on.
    150: dict(gag="G4.2", ms=2000, actors=[
        dict(match=dict(sprite="fishing-shield"), legs=[
            hold("bare", 800), hold("strike", 250), hold("default", 950)]),
        dict(add="fishing-line", match=dict(sprite="fishing-shield"), at=(0, 0), dz=0.0001,
             aloft=True, start=(0, -44), legs=[mv("default", (0, -LINE_STOP), 800),
                                              hold("default", 250), hold("hidden", 950)]),
        dict(match=dict(sprite="card-report"), legs=[
            hold("hidden", 1050), hold("default", 120), hold("hidden", 100),
            hold("default", 730)]),
    ]),
    # G2.4 (E-25, E-01): the screen is dark; the call connects in one cut; the remote
    # face waves; the seated worker nearest the screen (the same person) waves back.
    220: dict(gag="G2.4", ms=2000, actors=[
        dict(match=dict(sprite="tv-live"), legs=[
            hold("dark", 450), hold("default", 200), hold("wave", 220), hold("default", 180),
            hold("wave", 220), hold("default", 730)]),
        dict(match=dict(sprite="worker-seated", gag="G2.4", frame="d"), legs=[
            hold("d", 900), hold("d-wave", 700), hold("d", 400)]),
    ]),
    # G3.1 (E-03): the new hire walks in from the front and sits at the desk that is
    # already set; its laptop comes on as they sit. The walker is the seated person
    # (look e both), so nobody new appears and nobody leaves.
    490: dict(gag="G3.1", ms=2000, actors=[
        dict(add="worker-e", match=dict(sprite="worker-seated", gag="G3.1", frame="e"),
             at=(-7, -4), dz=0.02, start=(-40, 20),
             legs=[mv("up", (0, 0), 1000), hold("hidden", 1000)]),
        dict(match=dict(sprite="worker-seated", gag="G3.1", frame="e"), legs=[
            hold("hidden", 1000), hold("e", 1000)]),
        dict(match=dict(sprite="desk-laptop", gag="G3.1"), legs=[
            hold("off", 1150), hold("default", 850)]),
    ]),
    # G4.1 (E-04): the auditor walks up to the shut door and knocks once; it opens, and
    # the InfoSec lead is in the doorway taking his hand. The $ bubble stays gold.
    610: dict(gag="G4.1", ms=2000, actors=[
        dict(match=dict(sprite="auditor"), start=(-44, 22), legs=[
            mv("walk", (0, 0), 900), hold("wait", 500), hold("shake", 600)]),
        dict(match=dict(sprite="front-door"), legs=[hold("shut", 1400), hold("open", 600)]),
        dict(match=dict(sprite="infosec"), legs=[hold("hidden", 1400), hold("default", 600)]),
    ]),
    # G7.1 (E-12): the robot rolls in from the back of the floor, badge blank, and stops by
    # the gate (from the front it would start over the void past the slab edge); the sheet
    # passes through the gate (light green); then the badge reads APPROVED. Gate first,
    # then badge: the tool and the policy arrived together. It never holds a document.
    750: dict(gag="G7.1", ms=2000, actors=[
        dict(match=dict(sprite="robot"), start=(36, -18), legs=[
            mv("pending", (0, 0), 900), hold("pending", 400), hold("approved", 700)]),
        dict(match=dict(sprite="doc-gate"), legs=[hold("wait", 1000), hold("default", 1000)]),
    ]),
}


def _find(placements: list, spec: dict) -> dict:
    hits = [q for q in placements if "line" not in q and q["sprite"] == spec["sprite"]
            and all(q.get(k) == v for k, v in spec.items() if k != "sprite")]
    if len(hits) != 1:
        raise ValueError(f"moment actor {spec} matches {len(hits)} placements, want 1")
    return hits[0]


def _cast(placements: list, beat: dict) -> list:
    """[(placement, actor)] for every actor, placements as resolved in the room (a
    transient is a new placement dict, at its end pose)."""
    out = []
    for a in beat["actors"]:
        q = _find(placements, a["match"])
        if "add" in a:
            q = {"sprite": a["add"], "frame": "default", "index": 0, "layer": "main",
                 "x": q["x"] + a["at"][0], "y": q["y"] + a["at"][1],
                 "depth": q["depth"] + a["dz"], "order": q["order"] + 0.5}
        out.append((q, a))
    return out


def _walk(a: dict, ex: int, ey: int) -> tuple:
    """(start x, start y, legs) in room coordinates for an actor ending at (ex, ey)."""
    sx, sy = a.get("start", (0, 0))
    legs = [dict(leg, to=[ex + leg["to"][0], ey + leg["to"][1]]) if "to" in leg
            else dict(leg) for leg in a["legs"]]
    return ex + sx, ey + sy, legs


def _validate(band: int, beat: dict):
    if not 0 < beat["ms"] <= MS_MAX:
        raise ValueError(f"band {band} moment: {beat['ms']} ms, want 1..{MS_MAX}")
    for a in beat["actors"]:
        total = sum(leg.get("ms", leg.get("hold", 0)) for leg in a["legs"])
        if total != beat["ms"]:
            raise ValueError(f"band {band} moment {a}: legs sum to {total}, not {beat['ms']}")
        end = (0, 0)
        for leg in a["legs"]:
            if "to" in leg:
                end = tuple(leg["to"])
        if "add" not in a and end != (0, 0):
            raise ValueError(f"band {band} moment {a}: does not end on its exported pose")
        if "add" in a and a["legs"][-1]["frame"] != "hidden":
            raise ValueError(f"band {band} moment {a}: a transient must end hidden")


def export(lib: compose.Library, band: int, vlist: list):
    """The `moment` block for band `band`'s built file (vlist: its views, as written),
    or None if the band has no beat."""
    from . import export_scene
    beat = BEATS.get(band)
    if beat is None:
        return None
    _validate(band, beat)
    view = next(v for v in vlist if v.get("default"))
    if not any(h["gagId"] == beat["gag"] and h["primary"] for h in view["hotspots"]):
        raise ValueError(f"band {band} moment: {beat['gag']}'s primary is not in the "
                         f"default close-up {view['id']} (the brief: choose another gag)")
    rid = view["parent"]
    origin, size = export_scene.view_frame(lib, band, rid)
    placements, lines = export_scene.resolve_view(lib, band, "built", rid, origin)
    placements = [dict(q) for q in placements]
    cast = _cast(placements, beat)
    for i, (q, a) in enumerate(cast):
        q["_actor"] = i
        if "add" in a:
            placements.append(q)
    entries = export_scene._entries_for_view(lib, placements, lines, band, "built", rid,
                                             size)
    for e in entries:
        i = e.pop("_actor", None)
        if i is None:
            continue
        q, a = cast[i]
        e["x"], e["y"], legs = _walk(a, q["x"], q["y"])
        e["frame"] = legs[0]["frame"]
        e["motion"] = {"start": 0, "walk": legs}     # start explicit: the web requires it
    return {"gagId": beat["gag"], "view": view["id"], "ms": beat["ms"],
            "entries": export_scene._crop_entries(lib, entries, view["rect"])}


# ---------------------------------------------------------------------------
# 3. the reference: the room at moment time m, depth-sorted, from the layout
# ---------------------------------------------------------------------------

PAD = 64                # the reference canvas's margin: an actor may start off the room


def room_at(lib: compose.Library, band: int, rid: str, m: int):
    """The built room `rid` at moment time m as the pipeline draws it: the layout's
    placements, every actor on the pose the contract's arithmetic gives at m
    (`motion.pose_at`), its depth moved with it (a floor step of dy screen px is dy / 8
    in depth, as `check_scenes` does for PH2-01's walkers), hidden ones left out; then
    `compose.render`'s own sort. Returns the room-size image."""
    from . import export_scene
    beat = BEATS[band]
    origin, size = export_scene.view_frame(lib, band, rid)
    resolved = compose.resolve(lib, export_scene._site_only(
        lib, _layout_scene(band)[rid]), (origin[0] + PAD, origin[1] + PAD))
    placed = list(resolved)
    gone = set()
    for q, a in _cast(resolved, beat):
        sx, sy, legs = _walk(a, q["x"], q["y"])
        x, y, fr, idx = motion.pose_at(lib.manifest, {"sprite": q["sprite"], "x": sx,
                                                      "y": sy, "frame": legs[0]["frame"],
                                                      "motion": {"walk": legs}}, m)
        if "add" in a:
            placed.append(q)
        if fr == "hidden":
            gone.add(id(q))
            continue
        if not a.get("aloft"):
            q["depth"] = q["depth"] + (y - q["y"]) / 8
        q["x"], q["y"], q["frame"], q["index"] = x, y, fr, idx
    placed = [q for q in placed if id(q) not in gone]
    img = compose.render(lib, placed, (size[0] + 2 * PAD, size[1] + 2 * PAD)).img
    return img.crop((PAD, PAD, PAD + size[0], PAD + size[1]))


def _layout_scene(band: int) -> dict:
    from . import layout
    return layout.scene(band, "built")
