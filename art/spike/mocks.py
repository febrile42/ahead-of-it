"""PH1-08a: render the floor-convention mocks.

    python3 art/spike/mocks.py

Writes, next to this file:
    A-750.png  A-360.png    option A: one view per gag-carrying floor + a switcher strip
    B-750.png  B-360.png    option B: one tall exploded stack in a scrolling viewport
    *@3x.png                nearest-neighbour 3x copies
    *-hot.png               the same with every primary hotspot's 44 CSS px disc drawn
                            (green: clear of every other primary; red: overlaps one)
    hotspots.json           per option/band/view: size, hotspots, min primary spacing

Every mock is 390 px wide = a 390-CSS-px phone. Views are 360 native px wide and are
shown at 1 CSS px per art px, which is what the painter's integer device scale gives a
360-wide view on every phone in the table in FLOOR-CONVENTION-2026-09.md.
"""
from __future__ import annotations

import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from PIL import Image, ImageDraw  # noqa: E402

import views as V  # noqa: E402
from mocklib import rgb, draw_text, text_w, scale_nn  # noqa: E402

PHONE_W = 390
GUT = (PHONE_W - V.VIEW_W) // 2
BG = (244, 240, 230, 255)       # page background stand-in (not art; never shipped)

ROOM_H = 226
ROOM_O = (156, 64)
STREET_H = 232
STREET_O = (148, 104)


def render_view(vid, band, hq=True):
    if vid == "street":
        sc = V.V(V.VIEW_W, STREET_H, STREET_O, band)
        V.street(sc, hq)
        if band >= 490:
            V.map_overlay(sc, 6, 4)
    else:
        sc = V.V(V.VIEW_W, ROOM_H, ROOM_O, band)
        {"ground": V.ground, "floor-2": V.floor2, "top": V.top}[vid](sc)
    im = sc.flush()
    return im, sc.hotspots()


def views_for(band):
    """The spike's rule: a view per storey that carries a gag, then the street."""
    vs = ["ground"]
    if any(V.GAG_BAND[g] <= band for g in ("G4.2", "G4.3", "G2.4", "G7.3a", "G7.3",
                                           "G3.3", "G7.4", "G6.2")):
        vs.append("floor-2")
    if band >= V.GAG_BAND["G7.2"]:
        vs.append("top")
    if band >= 150:
        vs.append("street")
    return vs


def default_view(band, rendered):
    """Most primary hotspots of this band's own gags; ties -> earliest in views[]."""
    best, best_n = None, -1
    for vid, (_, hot) in rendered.items():
        n = sum(1 for h in hot if h["primary"] and V.GAG_BAND[h["gagId"]] == band)
        if n > best_n:
            best, best_n = vid, n
    return best


def spacing(hot):
    prim = [h for h in hot if h["primary"]]
    worst, bad = math.inf, []
    for i in range(len(prim)):
        for j in range(i + 1, len(prim)):
            a, b = prim[i], prim[j]
            d = math.hypot(a["cx"] - b["cx"], a["cy"] - b["cy"])
            worst = min(worst, d)
            if d < 44:
                bad.append((a["gagId"], b["gagId"], round(d, 1)))
    return (round(worst, 1) if worst != math.inf else None), bad


def check_primaries(hot):
    """One primary per gag (merge multiple primary parts of one gag into one rect)."""
    by = {}
    for h in hot:
        by.setdefault(h["gagId"], []).append(h)
    for gag, hs in by.items():
        prim = [h for h in hs if h["primary"]]
        assert len(prim) == 1, (gag, [h["part"] for h in prim])
    return by


# --- chrome (mock only: the web draws this as HTML, not art) -------------------------
def tabs(active, vids, band, rendered, w=PHONE_W, h=44):
    im = Image.new("RGBA", (w, h), BG)
    d = ImageDraw.Draw(im)
    n = len(vids)
    names = {"ground": "GROUND", "floor-2": "FLOOR 2", "top": "TOP", "street": "STREET"}
    for i, vid in enumerate(vids):
        x0, x1 = round(i * w / n), round((i + 1) * w / n) - 1
        on = vid == active
        d.rectangle([x0, 2, x1, h - 3], fill=rgb("paper") if on else BG,
                    outline=rgb("outline"))
        if on:
            d.rectangle([x0 + 1, h - 6, x1 - 1, h - 4], fill=rgb("outline"))
        t = names[vid]
        tw = text_w(t) * 2 + len(t) - 1
        draw_text(im, t, x0 + (x1 - x0 - tw) // 2, 12, "outline", scale=2)
        # count of gags in the view; a dot if it holds this band's new gags
        hot = rendered[vid][1]
        gags = {hh["gagId"] for hh in hot}
        new = any(V.GAG_BAND[g] == band for g in gags)
        c = str(len(gags))
        draw_text(im, c, x0 + (x1 - x0 - text_w(c)) // 2, 29, "outline")
        if new:
            d.ellipse([x1 - 10, 6, x1 - 4, 12], fill=rgb("net"), outline=rgb("outline"))
    return im


def screen(view_im, tab_im, caption):
    h = tab_im.height + view_im.height + 16
    im = Image.new("RGBA", (PHONE_W, h), BG)
    im.alpha_composite(tab_im, (0, 0))
    im.alpha_composite(view_im, (GUT, tab_im.height))
    draw_text(im, caption, 4, h - 10, "wall-trim")
    ImageDraw.Draw(im).line([(0, h - 1), (PHONE_W, h - 1)], fill=rgb("outline"))
    return im


def overlay(im, hot_abs):
    """Draw each primary's 44 CSS px disc; red where it overlaps another's centre-44."""
    out = im.copy()
    d = ImageDraw.Draw(out)
    prim = [h for h in hot_abs if h["primary"]]
    for h in hot_abs:
        if not h["primary"]:
            d.rectangle([h["x"], h["y"], h["x"] + h["w"], h["y"] + h["h"]],
                        outline=(120, 120, 120, 255))
    for h in prim:
        bad = any(o is not h and math.hypot(o["cx"] - h["cx"], o["cy"] - h["cy"]) < 44
                  for o in prim)
        col = (220, 40, 40, 255) if bad else (40, 160, 60, 255)
        cx, cy = h["cx"], h["cy"]
        d.ellipse([cx - 22, cy - 22, cx + 22, cy + 22], outline=col, width=2)
        d.ellipse([cx - 2, cy - 2, cx + 2, cy + 2], fill=col)
        draw_text(out, h["gagId"].replace("G", "").upper(), int(cx) - 6, int(cy) + 4,
                  (col[0], col[1], col[2], 255))
    return out


def shift(hot, dx, dy):
    return [dict(h, x=h["x"] + dx, y=h["y"] + dy, cx=h["cx"] + dx, cy=h["cy"] + dy)
            for h in hot]


def save(name, im, hot_abs):
    im.save(os.path.join(HERE, f"{name}.png"))
    scale_nn(im, 3).save(os.path.join(HERE, f"{name}@3x.png"))
    overlay(im, hot_abs).save(os.path.join(HERE, f"{name}-hot.png"))


# --- option A --------------------------------------------------------------------------
def option_a(band, report):
    vids = views_for(band)
    rendered = {v: render_view(v, band) for v in vids}
    dflt = default_view(band, rendered)
    screens, hot_abs, y = [], [], 0
    rep = {"views": [], "default": dflt}
    order = [dflt] + [v for v in vids if v != dflt]
    for vid in order:
        im, hot = rendered[vid]
        t = tabs(vid, vids, band, rendered)
        cap = f"A {band} {vid.upper()}{' DEFAULT' if vid == dflt else ''}"
        s = screen(im, t, cap)
        screens.append(s)
        hot_abs += shift(hot, GUT, y + t.height)
        worst, bad = spacing(hot)
        rep["views"].append({"id": vid, "size": list(im.size), "default": vid == dflt,
                             "gags": sorted({h["gagId"] for h in hot}),
                             "primaries": sum(h["primary"] for h in hot),
                             "min_primary_spacing": worst, "under_44": bad})
        y += s.height
    sheet = Image.new("RGBA", (PHONE_W, y), BG)
    yy = 0
    for s in screens:
        sheet.alpha_composite(s, (0, yy))
        yy += s.height
    check_primaries(hot_abs)
    allg = set()
    for v in rep["views"]:
        allg |= set(v["gags"])
    rep["gag_count"] = len(allg)
    prim = [h for h in hot_abs if h["primary"]]
    dv = next(v for v in rep["views"] if v["default"])
    n1 = sum(1 for h in rendered[dflt][1] if h["primary"])
    rep["taps"] = {"one_tap": n1, "two_taps": len(prim) - n1,
                   "mean": round((n1 + 2 * (len(prim) - n1)) / len(prim), 2)}
    save(f"A-{band}", sheet, hot_abs)
    report[f"A-{band}"] = rep


# --- option B: one tall exploded stack -------------------------------------------------
def chunk(band, floors):
    """Storeys with no gag, collapsed to 14 px each: the same 12x9 footprint."""
    h = 14 * floors
    sc = V.V(V.VIEW_W, ROOM_H + h, (ROOM_O[0], ROOM_O[1] + h), band)
    V.exterior(sc, 0, 0, V.C, V.R, floors, storey=14, depth=1.0)
    for f in range(floors):
        t = str(3 + f)
        x, y = sc.g(0, V.R, 14 * f + 4)
        sc.label(t, (x + 20, y + 16), depth=90)
    im = sc.flush()
    return im, h


def option_b(band, report):
    vids = views_for(band)
    rendered = {v: render_view(v, band, hq=False) for v in vids}
    parts = []   # (image, hotspots, pitch)
    fl = V.FLOORS[band]
    if "top" in rendered:
        parts.append(("top", rendered["top"], None))
        n_empty = fl - 3
    else:
        n_empty = fl - 2
    if n_empty > 0:
        parts.append(("chunk", chunk(band, n_empty), None))
    for vid in ("floor-2", "ground", "street"):
        if vid in rendered:
            parts.append((vid, rendered[vid], None))
    # place: rooms float as an exploded stack; the collapsed storeys sit under the top
    # room (their roof is its floor) and float above floor 2
    y, placed = 0, []
    for vid, payload, _ in parts:
        if vid == "chunk":
            im, h = payload
            yy = y - (ROOM_H - 70) if placed and placed[-1][0] == "top" else y
            placed.append((vid, im, [], yy))
            y = yy + im.height - 40
        else:
            im, hot = payload
            placed.append((vid, im, hot, y))
            y += im.height + (-10 if vid in ("top", "floor-2") else 6)
    H = max(p[3] + p[1].height for p in placed) + 8
    im = Image.new("RGBA", (PHONE_W, H), BG)
    hot_abs = []
    # paint bottom-up so upper floors overlap lower ones' empty sky, chunk before top
    order = sorted(placed, key=lambda p: -p[3])
    for vid, pim, hot, yy in order:
        if vid == "top":
            continue
        im.alpha_composite(pim, (GUT, max(yy, 0)) if yy >= 0 else (GUT, 0))
    for vid, pim, hot, yy in placed:
        if vid == "top":
            im.alpha_composite(pim, (GUT, yy))
    for vid, pim, hot, yy in placed:
        hot_abs += shift(hot, GUT, yy)
    # the fold: what a 390 x 844 phone shows of the scene under slider + toggle
    fold = 460
    d = ImageDraw.Draw(im)
    k = 1
    while k * fold < H:
        for x in range(0, PHONE_W, 6):
            d.line([(x, k * fold), (x + 2, k * fold)], fill=rgb("net"))
        draw_text(im, f"SCREEN {k + 1}", 4, k * fold + 3, "net")
        k += 1
    draw_text(im, f"B {band} ONE VIEW {V.VIEW_W}X{H}", 4, 3, "wall-trim")
    check_primaries(hot_abs)
    worst, bad = spacing(hot_abs)
    gags = sorted({h["gagId"] for h in hot_abs})
    ground_y = dict((vid, yy) for vid, _, _, yy in placed)["ground"]
    per_screen_top, per_screen_ground = {}, {}
    for h in hot_abs:
        if h["primary"]:
            k1 = int(h["cy"] // fold) + 1
            per_screen_top[k1] = per_screen_top.get(k1, 0) + 1
            k2 = int((h["cy"] - ground_y) // fold) + 1 if h["cy"] >= ground_y else \
                -int((ground_y - h["cy"]) // fold) - 1
            per_screen_ground[k2] = per_screen_ground.get(k2, 0) + 1
    report[f"B-{band}"] = {"size": [V.VIEW_W, H], "gag_count": len(gags),
                           "primaries_per_screen_opened_at_top": per_screen_top,
                           "primaries_per_screen_opened_at_ground": per_screen_ground,
                           "primaries": sum(h["primary"] for h in hot_abs),
                           "min_primary_spacing": worst, "under_44": bad,
                           "screens_tall": round(H / fold, 2),
                           "floor_tops_y": {vid: yy for vid, _, _, yy in placed}}
    save(f"B-{band}", im, hot_abs)


if __name__ == "__main__":
    report = {}
    for band in (750, 360):
        option_a(band, report)
        option_b(band, report)
    with open(os.path.join(HERE, "hotspots.json"), "w") as f:
        json.dump(report, f, indent=1)
    for k, v in report.items():
        print(k, json.dumps(v)[:1500])
