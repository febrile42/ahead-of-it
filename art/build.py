#!/usr/bin/env python3
"""PH1-02 art spike build script.

Renders every sprite defined in art/src/sprites/ to public/sprites/*.png (1x, PNG-8,
palette-only by construction — see art/src/dsl.py:save_png), writes
public/sprites/manifest.json, and composes the two judging previews at
art/preview/room.png (4x) and art/preview/sheet.png (1x) / sheet@4x.png (4x).

Usage: python3 art/build.py   (stdlib + pillow only, no other dependencies)
"""
from __future__ import annotations

import json
import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT = os.path.dirname(_HERE)
sys.path.insert(0, _REPO_ROOT)

from art.src.dsl import Canvas, save_png, scale_nn
from art.src import iso
from art.src.sprites import floor, wall, desk, worker, badge_reader, room, band80, poses
from art.src.sprites import band150, band220, street, band360, band490, band610, band750
from art.src import compose, layout, export_scene, moments, motion
from art.src.vox import Sprite

SPRITES_DIR = os.path.join(_REPO_ROOT, "public", "sprites")
PREVIEW_DIR = os.path.join(_HERE, "preview")

WALK_FRAME_MS = 120


def build_static_sprites():
    """floor / wall / desk: one frame each. Returns manifest entries."""
    manifest = {}

    f = floor.build()
    save_png(f, os.path.join(SPRITES_DIR, "floor.png"))
    manifest["floor"] = {
        "w": f.w, "h": f.h, "anchor": list(floor.ANCHOR),
        "frames": {"default": [{"file": "floor.png", "duration": 0}]},
    }

    w = wall.build()
    save_png(w, os.path.join(SPRITES_DIR, "wall.png"))
    manifest["wall"] = {
        "w": w.w, "h": w.h, "anchor": list(wall.ANCHOR),
        "frames": {"default": [{"file": "wall.png", "duration": 0}]},
    }

    d = desk.build()
    save_png(d, os.path.join(SPRITES_DIR, "desk.png"))
    manifest["desk"] = {
        "w": d.w, "h": d.h, "anchor": list(desk.ANCHOR),
        "frames": {"default": [{"file": "desk.png", "duration": 0}]},
    }
    return manifest, {"floor": f, "wall": w, "desk": d}


def build_badge_reader():
    red = badge_reader.build("red")
    green = badge_reader.build("green")
    save_png(red, os.path.join(SPRITES_DIR, "badge-reader-red.png"))
    save_png(green, os.path.join(SPRITES_DIR, "badge-reader-green.png"))
    entry = {
        "w": badge_reader.W, "h": badge_reader.H, "anchor": list(badge_reader.ANCHOR),
        "frames": {
            "red": [{"file": "badge-reader-red.png", "duration": 0}],
            "green": [{"file": "badge-reader-green.png", "duration": 0}],
        },
    }
    return entry, {"red": red, "green": green}


WALK_KEYS = ("down", "up", "left", "right")


def save_entry(name, frames, w, h, anchor, points=None, durations=None):
    """Save every frame of one manifest entry and return the entry. File naming keeps
    the spike's scheme: `<name>.png` for a single default frame, `<name>-<key>.png` for
    a single-frame state, `<name>-<key>-<i>.png` for an animation."""
    fm = {}
    for key, canvases in frames.items():
        files = []
        for i, cv in enumerate(canvases):
            if key == "default":
                fname = f"{name}.png"
            elif len(canvases) == 1:
                fname = f"{name}-{key}.png"
            else:
                fname = f"{name}-{key}-{i}.png"
            assert (cv.w, cv.h) == (w, h), (name, key, cv.w, cv.h, w, h)
            save_png(cv, os.path.join(SPRITES_DIR, fname))
            ms = (durations or {}).get(key, WALK_FRAME_MS if key in WALK_KEYS else 0)
            if isinstance(ms, (list, tuple)):          # per-file: a hold, then a beat
                assert len(ms) == len(canvases), (name, key, ms)
                ms = ms[i]
            files.append({"file": fname, "duration": ms})
        fm[key] = files
    entry = {"w": w, "h": h, "anchor": list(anchor), "frames": fm}
    if points:
        entry["points"] = {k: list(v) for k, v in points.items()}
    return entry


class Frames:
    """Registry record for a multi-frame sprite (workers)."""

    def __init__(self, frames, anchor):
        self.frames = frames
        self.anchor = tuple(anchor)


def build_worker(manifest, registry):
    """`worker` keeps its name and its four walk keys (the PH1-04 contract) and gains
    idle-* and step-* keys; looks b..e are new entries with the same keys."""
    rendered = None
    for look in worker.LOOK_NAMES:
        frames = worker.look_frames(look)
        name = "worker" if look == "a" else f"worker-{look}"
        manifest[name] = save_entry(name, frames, worker.W, worker.H, worker.ANCHOR)
        registry[f"worker-{look}"] = Frames({k: (v if k in WALK_KEYS else v[0]) for k, v in frames.items()},
                                           worker.ANCHOR)
        if look == "a":
            rendered = {k: frames[k] for k in WALK_KEYS}
    # poses that need a different canvas get their own entries, one frame per look
    q = {}
    for look in worker.LOOK_NAMES:
        q[f"{look}-left"] = [worker.queue_frame(look, "left")]
        q[f"{look}-right"] = [worker.queue_frame(look, "right")]
    manifest["worker-queue"] = save_entry("worker-queue", q, worker.QUEUE_W, worker.QUEUE_H,
                                          worker.QUEUE_ANCHOR)
    registry["worker-queue"] = Frames({k: v[0] for k, v in q.items()}, worker.QUEUE_ANCHOR)
    seated = {look: [worker.seated_frame(look)] for look in worker.LOOK_NAMES}
    # PH2-01 typing beats: single-file keys that motion.LOOP_KEYS threads between the
    # rest file to make `<look>-type`
    beats = {f"{look}-type-{b}": [worker.seated_frame(look, beat=b)]
             for look in worker.LOOK_NAMES for b in ("l", "r", "n")}
    manifest["worker-seated"] = save_entry("worker-seated", {**seated, **beats}, desk.W,
                                           desk.H, desk.ANCHOR)
    for look, cv in seated.items():
        registry[f"worker-seated-{look}"] = Sprite(cv[0], desk.ANCHOR)
    peel = {look: poses.peel_frames(look) for look in worker.LOOK_NAMES}
    manifest["worker-peel"] = save_entry("worker-peel", peel, desk.W, desk.H, desk.ANCHOR,
                                         durations={k: poses.PEEL_MS for k in peel})
    registry["worker-peel"] = Frames(peel, desk.ANCHOR)
    looks = worker.LOOK_NAMES
    reach = {look: poses.reach_frames(look) for look in looks}
    manifest["worker-reach"] = save_entry("worker-reach", reach, desk.W, desk.H, desk.ANCHOR,
                                          durations={k: poses.REACH_MS for k in reach})
    registry["worker-reach"] = Frames(reach, desk.ANCHOR)
    turned = {look: [worker.seated_frame(look, turned=True)] for look in looks}
    manifest["worker-seated-turned"] = save_entry("worker-seated-turned", turned, desk.W,
                                                  desk.H, desk.ANCHOR)
    for look, cv in turned.items():
        registry[f"worker-seated-turned-{look}"] = Sprite(cv[0], desk.ANCHOR)
    pr = {look: poses.printouts_frames(look) for look in looks}
    manifest["worker-printouts"] = save_entry(
        "worker-printouts", pr, poses.PRINTOUTS_W, poses.PRINTOUTS_H, poses.PRINTOUTS_ANCHOR,
        durations={k: poses.PRINTOUTS_MS for k in pr})
    registry["worker-printouts"] = Frames(pr, poses.PRINTOUTS_ANCHOR)
    give = {}
    for look in looks:
        give.update(poses.give_frames(look))
    manifest["worker-give"] = save_entry("worker-give", give, poses.GIVE_W, poses.GIVE_H,
                                         poses.GIVE_ANCHOR)
    registry["worker-give"] = Frames({k: v for k, v in give.items()}, poses.GIVE_ANCHOR)
    cour = poses.courier_frames()
    manifest["courier"] = save_entry("courier", cour, poses.GIVE_W, poses.GIVE_H,
                                     poses.GIVE_ANCHOR)
    registry["courier"] = Frames(cour, poses.GIVE_ANCHOR)
    watch = {look: poses.watch_frames(look) for look in looks}
    manifest["worker-watch"] = save_entry("worker-watch", watch, worker.W, worker.H,
                                          worker.ANCHOR,
                                          durations={k: poses.WATCH_MS for k in watch})
    registry["worker-watch"] = Frames(watch, worker.ANCHOR)
    for kind in ("sales", "engineer"):
        pf = poses.point_frames(kind)
        manifest[kind] = save_entry(kind, pf, poses.POINT_W, poses.POINT_H,
                                    poses.POINT_ANCHOR,
                                    durations={k: poses.POINT_MS for k in pf})
        registry[kind] = Frames(pf, poses.POINT_ANCHOR)
    hud = {}
    for look in looks:
        hud.update(poses.huddle_frames(look))
    manifest["worker-huddle"] = save_entry("worker-huddle", hud, worker.W, worker.H,
                                           worker.ANCHOR)
    registry["worker-huddle"] = Frames(hud, worker.ANCHOR)
    swave = {look: poses.seated_wave_frames(look) for look in looks}
    manifest["worker-seated-wave"] = save_entry("worker-seated-wave", swave, desk.W, desk.H,
                                                desk.ANCHOR,
                                                durations={k: poses.WAVE_MS for k in swave})
    registry["worker-seated-wave"] = Frames(swave, desk.ANCHOR)
    wave = {}
    for look in looks:
        wave.update(poses.wave_side_frames(look))
    manifest["worker-wave"] = save_entry("worker-wave", wave, worker.W, worker.H,
                                         worker.ANCHOR,
                                         durations={k: poses.WAVE_MS for k in wave})
    registry["worker-wave"] = Frames(wave, worker.ANCHOR)
    flinch = {}
    for look in looks:
        flinch.update(poses.flinch_frames(look))
    manifest["worker-flinch"] = save_entry("worker-flinch", flinch, worker.W, worker.H,
                                           worker.ANCHOR,
                                           durations={k: poses.FLINCH_MS for k in flinch})
    registry["worker-flinch"] = Frames(flinch, worker.ANCHOR)
    hat = {}
    for look in looks:
        hat[look] = [poses.hat_frame(look)]
        hat[look + "-left"] = [poses.hat_frame(look, "left")]
    manifest["worker-hat"] = save_entry("worker-hat", hat, poses.HAT_W, poses.HAT_H,
                                        poses.HAT_ANCHOR)
    registry["worker-hat"] = Frames(hat, poses.HAT_ANCHOR)
    # PH1-11 (band 360)
    coin = {}
    for look in looks:
        coin.update(band360.coin_frames(look))
    manifest["worker-coin"] = save_entry("worker-coin", coin, band360.COIN_W, band360.COIN_H,
                                         band360.COIN_ANCHOR,
                                         durations={k: 500 for k in coin})
    registry["worker-coin"] = Frames(coin, band360.COIN_ANCHOR)
    hs = {look: band360.headset_frames(look) for look in looks}
    manifest["worker-seated-headset"] = save_entry("worker-seated-headset", hs, desk.W,
                                                   desk.H, desk.ANCHOR)
    registry["worker-seated-headset"] = Frames(hs, desk.ANCHOR)
    hats = {"default": band360.hats_frames()[:1], "wobble": band360.hats_frames()}
    manifest["worker-hats"] = save_entry("worker-hats", hats, band360.HATS_W, band360.HATS_H,
                                         band360.HATS_ANCHOR,
                                         durations={"wobble": band360.HATS_MS})
    registry["worker-hats"] = Frames(hats, band360.HATS_ANCHOR)
    one = {}
    for look in looks:
        for label in band360.HAT_LABELS:
            one[f"{look}-{label.lower()}"] = [band360.onehat_frame(look, label)]
    manifest["worker-onehat"] = save_entry("worker-onehat", one, band360.ONEHAT_W,
                                           band360.ONEHAT_H, band360.ONEHAT_ANCHOR)
    registry["worker-onehat"] = Frames(one, band360.ONEHAT_ANCHOR)
    under = {"default": band360.under_frames()[:1], "hunt": band360.under_frames()}
    manifest["worker-under"] = save_entry("worker-under", under, desk.W, desk.H, desk.ANCHOR,
                                          durations={"hunt": 400})
    registry["worker-under"] = Frames(under, desk.ANCHOR)
    # PH1-11 (band 490)
    coat = {"default": [band490.coat_frame()]}
    manifest["worker-coat"] = save_entry("worker-coat", coat, desk.W, desk.H, desk.ANCHOR)
    registry["worker-coat"] = Frames(coat, desk.ANCHOR)
    bal = band490.balloon_frames()
    bf = {"default": bal[:1], "deflate": bal}
    manifest["balloon-welcome"] = save_entry("balloon-welcome", bf, band490.BALLOON_W,
                                             band490.BALLOON_H, band490.BALLOON_ANCHOR,
                                             durations={"deflate": band490.BALLOON_MS})
    registry["balloon-welcome"] = Frames(bf, band490.BALLOON_ANCHOR)
    bdg = {}
    for look in looks:
        bdg.update(band490.badge_frames(look))
    manifest["worker-badge"] = save_entry("worker-badge", bdg, band490.BADGE_W,
                                          band490.BADGE_H, band490.BADGE_ANCHOR,
                                          durations={k: 450 for k in bdg})
    registry["worker-badge"] = Frames(bdg, band490.BADGE_ANCHOR)
    vis = worker.visitor_frame()
    pts = {"net": worker.VISITOR_NET}
    manifest["visitor"] = save_entry("visitor", {"default": [vis]}, vis.w, vis.h,
                                     worker.VISITOR_ANCHOR, pts)
    registry["visitor"] = Sprite(vis, worker.VISITOR_ANCHOR, pts)
    return rendered


def build_desks(manifest, registry):
    pts = {"net": desk.net_point()}
    pts = {"net": desk.net_point(), "card": desk.card_point()}
    registry["desk"] = Sprite(desk.build(), desk.ANCHOR, pts)
    manifest["desk"]["points"] = {k: list(v) for k, v in pts.items()}
    for kind in ("postit", "notes", "padlock", "dev", "dev-built"):
        cv = desk.build_variant(kind)
        name = f"desk-{kind}"
        pts = {"net": desk.net_point(kind)}
        manifest[name] = save_entry(name, {"default": [cv]}, desk.W, desk.H, desk.ANCHOR, pts)
        registry[name] = Sprite(cv, desk.ANCHOR, pts)


def save_sprite(manifest, registry, name, spr):
    """One prop: the still as `default`, plus any animations (`Sprite.anims`) as extra
    frame keys with their per-frame duration."""
    frames = {"default": [spr.canvas]}
    durations = {}
    for key, (cvs, ms) in spr.anims.items():
        frames[key] = list(cvs)
        durations[key] = ms
    manifest[name] = save_entry(name, frames, spr.w, spr.h, spr.anchor, spr.points,
                                durations)
    registry[name] = spr


def build_props(manifest, registry):
    for group in (room.build_all(), band80.build_all(), band150.build_all(),
                  band220.build_all(), street.build_all(), band360.build_all(),
                  band490.build_all(), band610.build_all(), band750.build_all()):
        for name, spr in group.items():
            save_sprite(manifest, registry, name, spr)


def build_manifest():
    manifest, static = build_static_sprites()
    badge_entry, badge_rendered = build_badge_reader()
    manifest["badge-reader"] = badge_entry
    registry = {}
    worker_rendered = build_worker(manifest, registry)
    build_desks(manifest, registry)
    build_props(manifest, registry)

    # PH1-07: the VISITOR callout is for the 4x previews only; at 1x the chest sticker
    # on `visitor` carries it. The flag tells the renderer to leave it out.
    manifest["tag-visitor"]["preview_only"] = True

    # PH2-01: loop keys threaded from files that already exist (SCENE-FORMAT "Motion")
    motion.add_loop_keys(manifest)
    # PH2-03: the states only a band-crossing moment uses (SCENE-FORMAT "Band-crossing
    # moment")
    moments.add_keys(manifest, SPRITES_DIR)

    manifest_path = os.path.join(SPRITES_DIR, "manifest.json")
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2, sort_keys=True)
        f.write("\n")

    return static, badge_rendered, worker_rendered, registry


# ---------------------------------------------------------------------------
# Previews
# ---------------------------------------------------------------------------

def build_sheet(static, badge_rendered, worker_rendered, registry):
    """Every sprite on one sheet — the style-reference sheet, at 1x and 4x. Shelf-packed
    in a fixed order (no dict iteration surprises), each sprite bottom-aligned in its row."""
    items = [static["floor"], static["wall"], static["desk"], badge_rendered["red"],
             badge_rendered["green"]]
    for direction in WALK_KEYS:
        items.extend(worker_rendered[direction])
    for look in worker.LOOK_NAMES:
        fr = registry[f"worker-{look}"].frames
        items.extend([fr["idle-down"], fr["idle-up"], fr["idle-right"], fr["step-right"],
                      registry["worker-queue"].frames[f"{look}-left"]])
    for look in worker.LOOK_NAMES:
        seat = Canvas(desk.W, desk.H)
        seat.paste(registry["desk"].canvas, 0, 0)
        seat.paste(registry[f"worker-seated-{look}"].canvas, 0, 0)
        items.append(seat)
    for look in worker.LOOK_NAMES:
        for fr in registry["worker-peel"].frames[look]:
            seat = Canvas(desk.W, desk.H)
            seat.paste(registry["desk-notes"].canvas, 0, 0)
            seat.paste(fr, 0, 0)
            items.append(seat)
        break  # one look is enough to judge the pose; all five ship
    items.append(registry["visitor"].canvas)
    for name in ("desk-notes", "desk-padlock", "desk-dev", "desk-dev-built"):
        items.append(registry[name].canvas)
    for group in (room.build_all(), band80.build_all(), band150.build_all(),
                  band220.build_all(), street.build_all(), band360.build_all(),
                  band490.build_all(), band610.build_all(), band750.build_all()):
        for name in group:
            items.append(registry[name].canvas)
    # PH1-07 poses, one look each (all five ship): every frame, so the animation is
    # judgeable; desk-canvas poses are shown at their desk
    for fr in registry["worker-reach"].frames["a"]:
        seat = Canvas(desk.W, desk.H)
        seat.paste(registry["desk"].canvas, 0, 0)
        seat.paste(fr, 0, 0)
        items.append(seat)
    for key, frame in (("worker-printouts", "c"), ("worker-give", "e-left"),
                       ("courier", "right"), ("worker-watch", "b"),
                       ("sales", "point-right"), ("engineer", "point-left"),
                       ("worker-huddle", "a"), ("worker-huddle", "c-dongle"),
                       ("worker-wave", "c-right"),
                       ("worker-hat", "e"), ("worker-hat", "e-left"),
                       ("worker-coin", "b-left"), ("worker-seated-headset", "c"),
                       ("worker-hats", "wobble"), ("worker-onehat", "a-support"),
                       ("worker-under", "hunt"), ("worker-coat", "default"),
                       ("balloon-welcome", "deflate"), ("worker-badge", "a-left")):
        items.extend(registry[key].frames[frame])

    # trim to drawn pixels for the sheet only (wall-mounted props keep empty canvas
    # below them so their anchor stays inside; the shipped PNGs are untouched)
    trimmed = []
    for spr in items:
        bb = spr.img.getbbox()
        t = Canvas(bb[2] - bb[0], bb[3] - bb[1])
        t.img = spr.img.crop(bb)
        trimmed.append(t)
    items = trimmed

    pad, max_w = 6, 520
    rows, row, x, row_h = [], [], pad, 0
    for spr in items:
        if x + spr.w + pad > max_w and row:
            rows.append((row, row_h))
            row, x, row_h = [], pad, 0
        row.append((x, spr))
        x += spr.w + pad
        row_h = max(row_h, spr.h)
    rows.append((row, row_h))
    total_h = sum(h + pad for _, h in rows) + pad
    sheet = Canvas(max_w, total_h)
    y = pad
    for row, h in rows:
        for x, spr in row:
            sheet.paste(spr, x, y + h - spr.h)
        y += h + pad

    save_png(sheet, os.path.join(PREVIEW_DIR, "sheet.png"))
    save_png(scale_nn(sheet, 4), os.path.join(PREVIEW_DIR, "sheet@4x.png"))


def build_band(band: int):
    """Both states of one band for art review: every view (D-036) rendered as its own
    room from `layout.scene` (data) by `compose`, from the manifest and PNGs just
    written — preview-only callouts included — laid side by side in D-036 order,
    bottom-aligned, at 4x. Both states share every view's canvas, so the pair overlays
    pixel for pixel."""
    lib = compose.Library(SPRITES_DIR)
    gap = 12
    frames = {v: export_scene.view_frame(lib, band, v) for v in layout.views(band)}
    width = sum(size[0] for _o, size in frames.values()) + gap * (len(frames) - 1)
    height = max(size[1] for _o, size in frames.values())
    for st in ("without", "built"):
        out = Canvas(width, height)
        x = 0
        for v, (origin, size) in frames.items():
            placed = compose.resolve(lib, layout.scene(band, st)[v], origin)
            room_ = compose.render(lib, placed, size)
            out.img.alpha_composite(room_.img, (x, height - size[1]))
            x += size[0] + gap
        save_png(scale_nn(out, 4), os.path.join(PREVIEW_DIR, f"band{band}-{st}.png"))


def build_room(static, badge_rendered, worker_rendered):
    """3x3 floor, two walls, two desks, one worker mid-stride, a badge reader on a
    wall — composited on the isometric grid, saved at 4x (the judged deliverable)."""
    origin = (130, 90)
    scene = Canvas(300, 260)

    floor_spr, wall_spr, desk_spr = static["floor"], static["wall"], static["desk"]

    # back wall: two segments across the top-back edge (row -1), col 0 and 1
    for col in (0, 1):
        pt = iso.iso_to_screen(col, -1, origin)
        iso.place(scene, wall_spr, wall.ANCHOR, pt)

    # badge reader mounted on the right-hand wall segment (col 1), offset into its
    # right (unshadowed-by-window) portion — a wall prop, not placed via floor anchor
    wall_pt = iso.iso_to_screen(1, -1, origin)
    wx = wall_pt[0] - wall.ANCHOR[0] + 21
    wy = wall_pt[1] - wall.ANCHOR[1] + 18
    scene.paste(badge_rendered["green"], wx, wy)

    # 3x3 floor, painted back-to-front
    cells = [(c, r) for r in range(3) for c in range(3)]
    cells.sort(key=lambda cr: cr[0] + cr[1])
    for col, row in cells:
        pt = iso.iso_to_screen(col, row, origin)
        iso.place(scene, floor_spr, floor.ANCHOR, pt)

    # props on top of the floor, sorted by depth so nearer ones paint last
    props = []
    props.append(((0, 0), desk_spr, desk.ANCHOR))
    props.append(((2, 0), desk_spr, desk.ANCHOR))
    walk_frame = worker_rendered["right"][0]  # contact pose: the stride is visible
    props.append(((1, 2), walk_frame, worker.ANCHOR))
    props.sort(key=lambda p: p[0][0] + p[0][1])
    for (col, row), spr, anchor in props:
        pt = iso.iso_to_screen(col, row, origin)
        iso.place(scene, spr, anchor, pt)

    bbox = scene.img.getbbox()
    if bbox:
        x0, y0, x1, y1 = bbox
        margin = 4
        x0, y0 = max(x0 - margin, 0), max(y0 - margin, 0)
        x1, y1 = min(x1 + margin, scene.w), min(y1 + margin, scene.h)
        cropped = Canvas(x1 - x0, y1 - y0)
        cropped.img = scene.img.crop((x0, y0, x1, y1))
        scene = cropped

    save_png(scale_nn(scene, 4), os.path.join(PREVIEW_DIR, "room.png"))


def main():
    static, badge_rendered, worker_rendered, registry = build_manifest()
    build_sheet(static, badge_rendered, worker_rendered, registry)
    build_room(static, badge_rendered, worker_rendered)
    for band in layout.PLACEMENTS:
        build_band(band)
    export_scene.export_all()
    print("Build complete.")


if __name__ == "__main__":
    main()
