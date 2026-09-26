#!/usr/bin/env python3
"""D-042 schema-2 scene fixtures (DIA-40), independent of the art exporter.

Writes, next to this file:
  index.json                       schema 2, bands 80 and 750, `beyond` -> 750
  80-{built,without}.json          one room, two close-ups (the default is NOT the first)
  750-{built,without}.json         four rooms, ten close-ups, every gag due at 750
  <band>-<state>-<viewId>@1x.png   goldens for band 80, composed here with Pillow
                                   straight from the entries (no browser, no canvas), so
                                   the parity spec compares two independent renderers.

The fixtures follow docs/product/SCENE-FORMAT.md exactly: local coordinates in a close-up,
`size` equals `rect`, rooms carry no hotspots, primaries >= 24 native px apart, exactly one
`default`, both states share their skeleton. Regenerate with:
    python3 tests/fixtures/generate_d042.py
"""
import json
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
SPRITES = HERE.parent.parent / 'public' / 'sprites'
MANIFEST = json.loads((SPRITES / 'manifest.json').read_text())
CONTENT = json.loads((HERE.parent.parent / 'src' / 'content' / 'content.json').read_text())
GAG_BAND = {g['id']: (750 if g['band'] == 'beyond' else g['band']) for g in CONTENT['gags']}

# Gags that are two-part (SCENE-FORMAT); G5.1 only in `without`.
TWO_PART = {'G3.2': 'both', 'G4.1': 'both', 'G2.4': 'both', 'G5.1': 'without'}
PROPS = ['rack', 'desk', 'sofa', 'sla-board', 'cable-tray', 'desk-laptop', 'laptop-shelf', 'calendar-one']

SLOT_X = [24, 68, 112, 156]
ROW_Y = [39, 89]




PLAN_80 = 80, [
    ('ground', 'Ground floor', (300, 214), [
        ((0, 0), 'Closet and desk', ['G1.1', 'G1.2']),
        ((120, 94), 'Front of house', ['G2.1', 'G2.2', 'G2.3']),
    ]),
]

PLAN_750 = 750, [
    ('ground', 'Ground floor', (360, 240), [
        ((0, 0), 'Server closet', ['G1.1', 'G1.2', 'G2.1']),
        ((180, 0), 'Lobby', ['G2.2', 'G2.3', 'G3.1']),
        ((0, 120), 'Shipping bay', ['G3.2', 'G4.1', 'G5.3']),
        ((180, 120), 'Executive corner', ['G5.4', 'G6.1', 'G7.1']),
    ]),
    ('floor-2', 'Second floor', (360, 240), [
        ((0, 0), 'Conference room', ['G2.4', 'G3.3', 'G4.2']),
        ((180, 0), 'Open plan', ['G4.3', 'G6.2', 'G7.3']),
        ((0, 120), 'Quiet corner', ['G7.3a', 'G7.4']),
    ]),
    ('top', 'Top floor', (200, 120), [
        ((10, 0), 'Board room', ['G7.2']),
    ]),
    ('street', 'Street', (314, 236), [
        ((0, 0), 'Front door', ['G5.1', 'G5.2', 'G5.6']),
        ((134, 116), 'Back lane', ['G6.3', 'G6.4']),
    ]),
]


def floor_entries(w, h, dx=0, dy=0):
    out = []
    for j in range(h // 16 + 2):
        for i in range(w // 32 + 2):
            out.append({'sprite': 'floor', 'frame': 'default', 'x': 16 + 32 * i + dx, 'y': 16 + 16 * j + dy, 'depth': 0})
    return out


def closeup_content(state, primaries):
    """Entries and hotspots in close-up-local coordinates."""
    entries = floor_entries(180, 120)
    hotspots = []
    extra = 0
    for n, gag in enumerate(primaries):
        cx, cy = SLOT_X[n], ROW_Y[0]
        prop = PROPS[sum(map(ord, gag)) % len(PROPS)]
        entries.append({'sprite': prop, 'frame': 'default', 'x': cx, 'y': cy + 20, 'depth': 100 + n, 'gagId': gag})
        if state == 'without':
            entries.append({'sprite': 'cable-spill', 'frame': 'default', 'x': cx + 10, 'y': cy + 22, 'depth': 101 + n, 'gagId': gag})
        hs = {'gagId': gag, 'x': cx - 20, 'y': cy - 25, 'w': 40, 'h': 50, 'primary': True}
        if gag in TWO_PART:
            hs['part'] = 'a'
        hotspots.append(hs)
    for gag in primaries:
        rule = TWO_PART.get(gag)
        if rule in ('both', state):
            cx, cy = SLOT_X[extra], ROW_Y[1]
            extra += 1
            entries.append({'sprite': 'box-fan', 'frame': 'default', 'x': cx, 'y': cy + 20, 'depth': 120 + extra, 'gagId': gag, 'part': 'b'})
            hotspots.append({'gagId': gag, 'part': 'b', 'x': cx - 20, 'y': cy - 25, 'w': 40, 'h': 50, 'primary': False})
    return entries, hotspots


def build(band, rooms, state):
    own = {g for g, b in GAG_BAND.items() if b == band}
    best, default_id = -1, None
    for rid, _, _, closeups in rooms:
        for n, (_, _, prim) in enumerate(closeups, 1):
            count = sum(1 for g in prim if g in own)
            if count > best:
                best, default_id = count, f'{rid}.{n}'
    views = []
    for rid, rlabel, (rw, rh), closeups in rooms:
        room_entries = floor_entries(rw, rh)
        built = []
        for n, ((rx, ry), label, prim) in enumerate(closeups, 1):
            entries, hotspots = closeup_content(state, prim)
            built.append((n, rx, ry, label, entries, hotspots))
            room_entries += [
                {**e, 'x': e['x'] + rx, 'y': e['y'] + ry}
                for e in entries if e['sprite'] != 'floor'
            ]
        views.append({
            'id': rid, 'kind': 'room', 'label': rlabel, 'size': {'w': rw, 'h': rh},
            'focus': {'x': 0, 'y': 0, 'w': rw, 'h': rh}, 'entries': room_entries, 'hotspots': [],
        })
        for n, rx, ry, label, entries, hotspots in built:
            view = {
                'id': f'{rid}.{n}', 'kind': 'closeup', 'parent': rid, 'label': label,
                'rect': {'x': rx, 'y': ry, 'w': 180, 'h': 120},
                'size': {'w': 180, 'h': 120}, 'focus': {'x': 0, 'y': 0, 'w': 180, 'h': 120},
            }
            if f'{rid}.{n}' == default_id:
                view['default'] = True
            view['entries'] = entries
            view['hotspots'] = hotspots
            views.append(view)
    return {'schema': 2, 'band': band, 'state': state, 'views': views}


def render(view):
    w, h = view['size']['w'], view['size']['h']
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    for e in view['entries']:
        meta = MANIFEST[e['sprite']]
        sprite = Image.open(SPRITES / meta['frames'][e['frame']][0]['file']).convert('RGBA')
        ox, oy = e['x'] - meta['anchor'][0], e['y'] - meta['anchor'][1]
        # clip like a canvas does, then source-over
        sx, sy = max(0, -ox), max(0, -oy)
        ex, ey = min(sprite.width, w - ox), min(sprite.height, h - oy)
        if ex <= sx or ey <= sy:
            continue
        img.alpha_composite(sprite.crop((sx, sy, ex, ey)), (ox + sx, oy + sy))
    return img


def main():
    index = json.loads((HERE / 'index.json').read_text())
    index['schema'] = 2
    index['bands'] = {'80': {'built': '80-built.json', 'without': '80-without.json'},
                      '750': {'built': '750-built.json', 'without': '750-without.json'}}
    index['beyond'] = '750'
    (HERE / 'index.json').write_text(json.dumps(index, indent=2) + '\n')
    for band, rooms in (PLAN_80, PLAN_750):
        for state in ('built', 'without'):
            scene = build(band, rooms, state)
            (HERE / f'{band}-{state}.json').write_text(json.dumps(scene, indent=1) + '\n')
            if band == 80:
                for view in scene['views']:
                    render(view).save(HERE / f"{band}-{state}-{view['id']}@1x.png")


if __name__ == '__main__':
    main()
