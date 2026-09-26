"""PH2-01 motion (SCENE-FORMAT.md "Motion (PH2-01)"): which entries move, how, and a
reference player for the contract.

Three parts:

  1. **Loop keys** (`LOOP_KEYS`, `add_loop_keys`): an animated key threaded from files
     that already exist, by reference. `worker-seated` `a-type` starts with the very file
     `a` paints, so an entry switched from `a` to `a-type` paints the same pixels at rest
     (the contract's "rest pose = today's export") and no PNG is duplicated.
  2. **Assignment** (`assign`): the exporter calls it on each room's entries, per band x
     state, and it sets `frame` / `motion` on the entries that move. Gag parts animate in
     place only; only entries with no `gagId` may walk (`WALKS`).
  3. **The reference player** (`pose_at`, `paint_at`): the contract's arithmetic, written
     once, used by `check_scenes.py` (close-up == room crop at every sampled t; the
     walker paint-order proof) and by the calmer-is-measured report.

Everything here is a pure function of the scene data: `start` is a hash of band, state,
view id and entry index, so three `build.py` runs stay byte-identical.
"""
from __future__ import annotations

import hashlib

LOOKS = ("a", "b", "c", "d", "e")
WORKER = {"a": "worker", "b": "worker-b", "c": "worker-c", "d": "worker-d", "e": "worker-e"}
RATES = (0.5, 1, 1.5, 2)
START_SPREAD = 2000          # ms: starts fall in [0, START_SPREAD)


# ---------------------------------------------------------------------------
# 1. loop keys, threaded from existing single-file keys
# ---------------------------------------------------------------------------

def _loop_keys() -> dict:
    """{sprite: {new_key: [(source_key, ms), ...]}}. The first source is the rest pose."""
    keys: dict = {}
    seated = keys.setdefault("worker-seated", {})
    for look in LOOKS:
        # typing, from behind: a key with each hand, a long look at the screen, then a
        # glance down at the keyboard. Calm (built) at rate 1; `without` plays it faster.
        seated[f"{look}-type"] = [(look, 420), (f"{look}-type-l", 160), (look, 160),
                                  (f"{look}-type-r", 160), (look, 900),
                                  (f"{look}-type-n", 600)]
        # in a meeting (G2.4 built, G7.2): listening, the odd nod
        seated[f"{look}-nod"] = [(look, 2400), (f"{look}-type-n", 450)]
    huddle = keys.setdefault("worker-huddle", {})
    for look in LOOKS:
        # G2.4 without: the one with the adapter keeps trying it in the laptop
        huddle[f"{look}-dongle-try"] = [(f"{look}-dongle", 700), (look, 450)]
    for look in LOOKS:
        k = keys.setdefault(WORKER[look], {})
        for side in ("left", "right"):
            # G2.1 without: waiting in the queue, shifting weight now and then
            k[f"idle-{side}-shuffle"] = [(f"idle-{side}", 1300), (f"shuffle-a-{side}", 220),
                                         (f"shuffle-b-{side}", 260)]
            # built: an idle turn to face the room, and back
            k[f"idle-{side}-turn"] = [(f"idle-{side}", 2600), ("idle-down", 1400)]
    # G6.2 without: buried in renewals, the hand in the heap still signing
    keys["paper-slope"] = {"sign": [("default", 900), ("sign-1", 220), ("default", 220),
                                    ("sign-1", 220)]}
    # G7.2 built (R-07): Josh in the meeting chair, making a point now and then
    keys["worker-seated-josh"] = {"talk": [("default", 2600), ("point-1", 900)]}
    return keys


LOOP_KEYS = _loop_keys()


def add_loop_keys(manifest: dict):
    """Add every LOOP_KEYS key to `manifest` (build.py, after every sprite is saved)."""
    for sprite, keys in LOOP_KEYS.items():
        frames = manifest[sprite]["frames"]
        for key, seq in keys.items():
            if key in frames:
                raise ValueError(f"{sprite}: loop key {key!r} already exists")
            frames[key] = [{"file": frames[src][0]["file"], "duration": ms}
                           for src, ms in seq]


# ---------------------------------------------------------------------------
# 2. assignment: who moves
# ---------------------------------------------------------------------------

# Walkers (ambient people only). {(band, state, view, sprite, rest frame): (rate, legs)},
# legs as in the contract but with `to` as a pixel offset from the rest pose. Empty:
# the only standing people with no gagId (worker-card at 750) carry G7.1's card and the
# doc gate's document, so walking them away would change a gag, and a new person would
# change a rest pose, which PH2-01 forbids. Adding walkers is an art + golden decision.
WALKS: dict = {}

# gag parts that are people in a meeting, not at a desk: they nod, they do not type
MEETING = {"G2.4", "G7.2"}


def start_of(band: int, state: str, view: str, index: int) -> int:
    h = hashlib.sha256(f"{band}|{state}|{view}|{index}".encode()).hexdigest()
    return int(h[:8], 16) % START_SPREAD


def _is_loop(manifest: dict, sprite: str, key: str) -> bool:
    if sprite not in manifest:      # a baked `fx-net-*` overlay: always still
        return False
    fs = manifest[sprite]["frames"][key]
    return len(fs) > 1 and all(f["duration"] > 0 for f in fs)


def _swap(e: dict, state: str):
    """(key, rate) a still entry plays instead of its own key, or None."""
    spr, fr, gag = e["sprite"], e["frame"], e.get("gagId")
    if spr == "worker-seated" and fr in LOOKS:
        if gag in MEETING:
            return f"{fr}-nod", 1
        return f"{fr}-type", (1.5 if state == "without" else 1)
    if (spr, fr) == ("paper-slope", "default"):
        return "sign", 1
    if (spr, fr) == ("worker-seated-josh", "default"):
        return "talk", 1
    if spr == "worker-huddle" and fr.endswith("-dongle"):
        return f"{fr}-try", 1
    if spr in WORKER.values() and fr in ("idle-left", "idle-right") and gag == "G2.1":
        return (f"{fr}-shuffle", 1) if state == "without" else (f"{fr}-turn", 1)
    return None


def assign(manifest: dict, band: int, state: str, view: str, entries: list):
    """Set `frame` and `motion` on the entries of one room, in place."""
    for i, e in enumerate(entries):
        if "motion" in e:
            raise ValueError(f"band {band} {state} {view}[{i}] already has motion")
        rate = 1
        sw = _swap(e, state)
        if sw:
            e["frame"], rate = sw
        walk = WALKS.get((band, state, view, e["sprite"], e["frame"]))
        if walk:
            if e.get("gagId"):
                raise ValueError(f"band {band} {state} {view}: {e['sprite']} is part of "
                                 f"{e['gagId']} and may not walk")
            rate, legs = walk
            m = {"start": start_of(band, state, view, i)}
            if rate != 1:
                m["rate"] = rate
            m["walk"] = [dict(leg, to=[e["x"] + leg["to"][0], e["y"] + leg["to"][1]])
                         if "to" in leg else dict(leg) for leg in legs]
            e["motion"] = m
        elif _is_loop(manifest, e["sprite"], e["frame"]):
            m = {"start": start_of(band, state, view, i)}
            if rate != 1:
                m["rate"] = rate
            e["motion"] = m


# ---------------------------------------------------------------------------
# 3. the reference player: exactly the contract's arithmetic
# ---------------------------------------------------------------------------

def frame_index(manifest: dict, sprite: str, key: str, u) -> int:
    """Which file of `key` is painted at loop time u (ms, already scaled by rate)."""
    fs = manifest[sprite]["frames"][key]
    if len(fs) < 2 or any(f["duration"] <= 0 for f in fs):
        return 0
    total = sum(f["duration"] for f in fs)
    tau = int(u // 1) % total
    acc = 0
    for i, f in enumerate(fs):
        if acc <= tau < acc + f["duration"]:
            return i
        acc += f["duration"]
    raise AssertionError("unreachable")


def period(e: dict) -> int:
    """A walker's loop length in ms (0 for anything else)."""
    m = e.get("motion") or {}
    return sum(leg.get("ms", leg.get("hold", 0)) for leg in m.get("walk", []))


def pose_at(manifest: dict, e: dict, t: int):
    """(x, y, frame key, file index) the entry paints at integer time t (ms)."""
    m = e.get("motion")
    if not m or t < m.get("start", 0):
        return e["x"], e["y"], e["frame"], 0
    start, rate = m.get("start", 0), m.get("rate", 1)
    u = (t - start) * rate
    if "walk" not in m:
        return e["x"], e["y"], e["frame"], frame_index(manifest, e["sprite"], e["frame"], u)
    tau = (t - start) % period(e)
    x, y, acc = e["x"], e["y"], 0
    for leg in m["walk"]:
        dur = leg.get("ms", leg.get("hold", 0))
        if tau < acc + dur:
            elapsed = tau - acc
            fi = frame_index(manifest, e["sprite"], leg["frame"], u)
            if "to" in leg:
                x1, y1 = leg["to"]
                return (x + ((x1 - x) * elapsed) // dur, y + ((y1 - y) * elapsed) // dur,
                        leg["frame"], fi)
            return x, y, leg["frame"], fi
        acc += dur
        if "to" in leg:
            x, y = leg["to"]
    raise AssertionError("unreachable")


def entries_at(manifest: dict, entries: list, t: int) -> list:
    """The entries as the painter would draw them at t: position, key and file index."""
    out = []
    for e in entries:
        x, y, fr, idx = pose_at(manifest, e, t)
        out.append({**e, "x": x, "y": y, "frame": fr, "index": idx})
    return out


def paint_at(lib, entries: list, w: int, h: int, t: int):
    from .export_scene import paint_entries
    return paint_entries(lib, entries_at(lib.manifest, entries, t), w, h)


def swept_box(manifest: dict, e: dict):
    """Canvas box (x0, y0, x1, y1) the entry can ever cover: its rest box, unioned over
    every point of its walk (a straight leg's boxes are covered by its endpoints')."""
    m = manifest[e["sprite"]]
    ax, ay = m["anchor"]
    pts = [(e["x"], e["y"])] + [tuple(leg["to"]) for leg in
                                 (e.get("motion") or {}).get("walk", []) if "to" in leg]
    return (min(x for x, _ in pts) - ax, min(y for _, y in pts) - ay,
            max(x for x, _ in pts) - ax + m["w"], max(y for _, y in pts) - ay + m["h"])


def sample_times(entries: list, horizon: int = 6000, step: int = 100) -> list:
    """Integer times worth checking: every `step` ms over `horizon`, plus a walker's
    whole loop."""
    end = max([horizon] + [(e.get("motion") or {}).get("start", 0) + period(e)
                           for e in entries])
    return list(range(0, end + 1, step))
