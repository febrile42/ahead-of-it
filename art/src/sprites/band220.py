"""Band 220 props (PH1-07), both states. `docs/content/BANDS-AND-GAGS.md` §220.

The conference room is glass (`glass-*` in room.py) in the back-right corner of band
220's 16-column plate, tiles (12..15, 0..2); its TV hangs on the back-right wall over
tiles 13..14, the table runs along row 1. Anchors as everywhere else: the front vertex of
the tile the sprite is placed on (`tv-*`: tile (13, 0); `conf-*`: tile (12, 1), the
table's rear-most tile). Positions live in `layout.py`; only the relative offsets
(TV = table tile + (1, -1)) are baked in here, for the HDMI cable.

Without
  G2.4   tv-frozen          the remote face, pixelated and frozen mid-sentence, a
                            buffering spinner (2-frame `blink` on the spinner)
         conf-huddle        the table with the chairs shoved back, one laptop on it
                            pointed at the TV, a cable up to the TV with an adapter
                            dangling from it, spare dongles on the table
  G7.3a  whiteboard-requests  FEATURE / REQUESTS, full, OWNER:? — nobody's name

Built
  G2.4   tv-live            the same face, sharp, talking (2-frame `talk`)
         camera-bar         a camera bar over the TV
         conf-table         the table, four chairs pulled in, a touch panel
  G7.3a  whiteboard-owned   the same list, ticked and numbered, OWNER: and a hat
"""
from __future__ import annotations

from ..dsl import Canvas
from ..vox import Iso, Sprite, make, make_anim
from .. import glyphs
from . import desk as desk_mod
from .band80 import _thick, _rows

# world units, relative to the TV's tile. PH1-10 (item 3): the conference room's TV is
# half as big again so the frozen face reads at 1x; the inset office (street) gets the
# old size — the same kit, in a smaller room.
TV = dict(c0=1.0, c1=23.0, r0=0.0, r1=1.2, z0=12.0, z1=31.0, block=2.0)
# who is on the screen: the conference room sees the inset office's person (red shirt,
# as in the inset); the inset sees HQ's (green). (shirt, frozen shirt)
INSET_PERSON = ("badge-red", "shirt-3-dark")
HQ_PERSON = ("badge-green", "shirt-2-dark")


def _tv_body(iso: Iso, t: dict):
    return iso.box(t["c0"], t["r0"], t["z0"], t["c1"], t["r1"], t["z1"],
                   top="chair-dark", left="monitor-frame", right="outline")


def _face_fn(u, z, frozen: bool, mouth_open: bool, t: dict, who=HQ_PERSON,
             wave: bool = False):
    """The remote colleague, in the TV face's own coordinates: u = c - c0 across, z up,
    normalised to a 14 x 13 screen so every size draws the same face. `frozen`
    quantises everything to `block`-unit squares (the pixelated look of a stalled
    video) and catches the eyes mid-blink and the mouth mid-word."""
    W, H = t["c1"] - t["c0"], t["z1"] - t["z0"]
    zb = z - t["z0"]
    if not (0.8 <= u < W - 0.8 and 0.8 <= zb < H - 0.8):
        return None
    if frozen:
        # square blocks on screen: a unit along the face is 2 px wide, 1 px tall
        k = t["block"]
        u = (u // (k / 2)) * (k / 2) + k / 4
        zb = (zb // k) * k + k / 2
    u, zb = u * 14.0 / W, zb * 13.0 / H
    # a face unit is twice as wide on screen as it is tall, so the head's radius
    # across is about half its radius up — otherwise the face reads as a loaf
    sx = 14.0 / W * 2.0 * H / 13.0
    du, dz = (u - 7.0) * sx / 1.45, zb - 7.0
    shirt = who[1] if frozen else who[0]
    if wave:
        # a hand up by the head, caught mid-wave (PH1-10 fix round): the forearm
        # rising from the shoulder on the screen's right, an open hand at the top
        if 4.4 <= du < 6.2 and 1.0 <= zb < 7.4:
            return shirt
        if 4.0 <= du < 6.8 and 7.4 <= zb < 10.6:
            return "skin-3"
        if 3.4 <= du < 4.4 and 8.6 <= zb < 9.8:
            return "skin-3"                                     # the thumb
    # shoulders
    if zb < 3.0 and abs(du) < 5.5 - max(0.0, zb - 1.0) * 1.2:
        return shirt
    # head: an oval
    if (du / 3.3) ** 2 + (dz / 4.6) ** 2 < 1.0:
        if dz > 2.4 or (abs(du) > 2.6 and dz > -1.0):
            return "hair-1"
        if abs(dz - 0.6) < 0.6 and abs(abs(du) - 1.3) < 0.6:
            return "outline" if not frozen else "skin-2"      # eyes; mid-blink
        if frozen and abs(dz - 0.1) < 0.6 and abs(abs(du) - 1.3) < 0.9:
            return "outline"                                    # half-shut lids
        if abs(dz + 2.1) < (1.0 if mouth_open else 0.45) and abs(du) < 1.3:
            return "badge-red" if mouth_open else "outline"
        return "skin-3"
    return "glass-dark" if not frozen else "shirt-1-dark"


def _tv(iso: Iso, c: Canvas, frame: int, frozen: bool, t: dict, who=HQ_PERSON,
        wave=False):
    f = _tv_body(iso, t)
    mouth = True if frozen else (frame == 1)
    iso.paint(f, "L", t["r1"], lambda cc, z: _face_fn(cc - t["c0"], z, frozen, mouth, t,
                                                     who, wave) or "monitor-frame")
    if frozen:
        # buffering spinner, top right (PH1-11: bigger, on its own dark disc, so "frozen"
        # reads at 1x): eight dots round a ring, the lit one and its fading tail going
        # round frame by frame
        cx, cy = iso.left_px(t["r1"], t["c1"] - 3.4, t["z1"] - 4.2)
        disc = [(dx, dy) for dy in range(-5, 6) for dx in range(-5, 6)
                if dx * dx + dy * dy <= 22]
        for (dx, dy) in disc:
            c.point(cx + dx, cy + dy + dx // 2, "outline")
        ring = [(0, -3), (2, -2), (3, 0), (2, 2), (0, 3), (-2, 2), (-3, 0), (-2, -2)]
        lead = (frame * 4) % 8
        for i, (dx, dy) in enumerate(ring):
            k = (lead - i) % 8
            col = "paper" if k == 0 else ("wall-shadow" if k == 1 else (
                "badge-body" if k == 2 else "chair-mid"))
            c.point(cx + dx, cy + dy + dx // 2, col)


def _tv_frozen(t, who=HQ_PERSON, wave=False):
    def draw(iso, c, frame):
        _tv(iso, c, frame, True, t, who, wave)
        return {"screen": iso.left_px(t["r1"], (t["c0"] + t["c1"]) / 2, t["z0"])}
    return draw


def _tv_live(t, who=HQ_PERSON):
    def draw(iso, c, frame):
        _tv(iso, c, frame, False, t, who)
        return {"screen": iso.left_px(t["r1"], (t["c0"] + t["c1"]) / 2, t["z0"])}
    return draw


def _camera_bar(t):
    def draw(iso: Iso, c: Canvas):
        mid = (t["c0"] + t["c1"]) / 2
        f = iso.box(mid - 3.5, 0.0, t["z1"] + 0.6, mid + 3.5, 1.8, t["z1"] + 2.6,
                    top="chair-mid", left="monitor-frame", right="outline")
        iso.paint(f, "L", 1.8, lambda cc, z: "glass-highlight"
                  if abs(cc - mid) < 0.5 and t["z1"] + 1.1 <= z < t["z1"] + 2.1
                  else ("badge-green" if abs(cc - mid - 2.5) < 0.3 and t["z1"] + 1.1 <= z < t["z1"] + 2.1
                        else None))
    return draw


# -- the table (tile (12, 1) is its rear-most tile; four seats on row 1) -----------------

# 3.5 tiles long; its front edge is a desk's front edge (r 4.0), so seated workers line
# up exactly as at a desk; it runs back to within a unit of the wall
TABLE = dict(c0=2.0, c1=30.0, r0=-5.0, r1=4.0)


def _chair_at(iso: Iso, dc: float, dr: float = 0.0, back=True):
    """The desk chair (desk.py geometry) shifted by dc/dr world units."""
    ch = desk_mod.CHAIR
    iso.box(ch["c0"] + 0.3 + dc, 4.9 + dr, 0, ch["c1"] - 0.3 + dc, 7.2 + dr, 0.8,
            top="chair-dark", left="chair-dark", right="outline")
    iso.box(2.2 + dc, 5.7 + dr, 0.8, 2.8 + dc, 6.3 + dr, ch["seat"], top="chair-mid",
            left="chair-mid", right="chair-dark")
    iso.box(ch["c0"] + dc, ch["r0"] + dr, ch["seat"], ch["c1"] + dc, ch["r1"] + dr,
            ch["seat"] + 1.5, top="chair-mid", left="chair-dark", right="chair-dark")
    if back:
        b = desk_mod.BACKREST
        iso.box(b["c0"] + dc, b["r0"] + dr, b["z0"], b["c1"] + dc, b["r1"] + dr, b["z1"],
                top="chair-mid", left="chair-mid", right="chair-dark")


def _table(iso: Iso):
    t = TABLE
    top = desk_mod.DESK["top"]
    iso.floor_shadow(t["c0"], t["r0"], t["c1"], t["r1"], grow=1.0, grow_r=0.5)
    for cc in (t["c0"] + 1.0, t["c1"] - 3.0):                        # two pedestals
        iso.box(cc, t["r0"] + 1.0, 0, cc + 2.0, t["r1"] - 1.0, top,
                top="desk-wood-dark", left="desk-wood-dark", right="hair-1")
    return iso.box(t["c0"], t["r0"], top, t["c1"], t["r1"], top + 1.5, top="desk-wood",
                   left="desk-wood-dark", right="desk-wood-dark")


def _conf_table(iso: Iso, c: Canvas):
    """Built: chairs pulled in at the four seats (seated workers paste over tiles
    (12..15, 1) exactly as at a desk), a touch panel on the table."""
    _table(iso)
    top = desk_mod.DESK["top"] + 1.5
    # touch panel: a small dark wedge, screen lit, facing the seats
    f = iso.box(14.0, 2.0, top, 17.0, 3.4, top + 1.6, top="monitor-frame",
                left="monitor-frame", right="outline")
    iso.paint(f, "T", top + 1.6, lambda a, b: "monitor-screen" if 14.4 <= a < 16.6 and 2.3 <= b < 3.1 else None)
    iso.paint(f, "L", 3.4, lambda a, z: "badge-green" if 16.0 <= a < 16.5 else None)
    for k in range(4):
        _chair_at(iso, 8.0 * k, back=False)   # backrests come with the seated workers


def _conf_huddle(iso: Iso, c: Canvas):
    """Without: chairs shoved back against the glass, one laptop on the table turned
    to the TV, its cable climbing to the TV with an adapter dangling off it."""
    for dc, dr in ((0.5, 6.5), (25.0, 7.5)):
        _chair_at(iso, dc, dr)
    tf = _table(iso)
    top = desk_mod.DESK["top"] + 1.5
    # spare dongles and adapters, spilled on the table
    for (cc, rr, col) in ((8.5, 2.6, "paper"), (10.2, 3.2, "wall-shadow"),
                          (20.5, 2.4, "paper"), (22.0, 3.0, "badge-body")):
        iso.box(cc, rr, top, cc + 1.2, rr + 0.6, top + 0.6, top=col, left=col,
                right="badge-body", outline="outline")
    # the laptop, lid toward us (screen toward the TV)
    lc = 14.0
    iso.box(lc, 1.4, top, lc + 4.0, 3.6, top + 0.7, top="chair-mid", left="badge-body",
            right="chair-dark")
    lid = iso.box(lc, 3.4, top, lc + 4.0, 3.9, top + 5.0, top="chair-dark",
                  left="chair-mid", right="chair-dark")
    iso.paint(lid, "L", 3.9, lambda a, z: "paper" if abs(a - lc - 2.0) < 0.4 and abs(z - top - 3.0) < 0.6 else None)
    # the HDMI cable: off the back of the laptop, up the wall to the TV (one tile +c, -r,
    # i.e. c + 8, r - 8 from here), with the adapter dangling off it halfway: a
    # yellow dongle (PH1-10 item 3), big enough to read at 1x
    t = TV
    tvx = 8.0 + (t["c0"] + t["c1"]) / 2 - 4.0
    pts = [(lc + 2.0, 1.4, top + 0.4), (lc + 1.0, 0.2, top + 0.2), (tvx - 0.5, -6.0, 4.0),
           (tvx, -6.8, t["z0"] - 1.0), (tvx, -7.0, t["z0"] + 0.2)]
    _thick(iso, pts, "outline", width=1)
    x, y = iso.pt(tvx - 0.4, -6.2, 7.0)
    for dy in range(1, 3):                                            # the dangle
        c.point(x - 2, y + dy, "outline")
    c.rect(x - 5, y + 3, x + 1, y + 9, "outline")                     # the dongle
    c.rect(x - 4, y + 4, x, y + 8, "sticky")
    c.rect(x - 3, y + 9, x - 1, y + 10, "badge-body")                 # its plug
    c.point(x - 4, y + 4, "paper")                                    # a glint


# -- G7.3a: the whiteboard --------------------------------------------------------------

def _whiteboard(owned: bool) -> Canvas:
    """A whiteboard on a wheeled stand, billboarded. FEATURE / REQUESTS, a list that
    runs to the bottom edge, and the line that makes the joke: OWNER:? (without) or
    OWNER: and a little hat (built). Anchor: between the feet."""
    w_in = glyphs.text_width("REQUESTS") + 4
    w, h = w_in + 2, 34
    c = Canvas(w, h + 9)
    c.rect(0, 0, w - 1, h - 1, "badge-body")        # aluminium frame
    c.rect(0, 0, w - 1, 0, "outline")
    c.rect(0, h - 1, w - 1, h - 1, "outline")
    c.rect(0, 0, 0, h - 1, "outline")
    c.rect(w - 1, 0, w - 1, h - 1, "outline")
    c.rect(2, 2, w - 3, h - 3, "paper")
    glyphs.draw(c, "FEATURE", 1 + (w - glyphs.text_width("FEATURE")) // 2, 3, "outline")
    glyphs.draw(c, "REQUESTS", 1 + (w - glyphs.text_width("REQUESTS")) // 2, 9, "outline")
    # the list: scribbles in two marker colours, one per line
    lens = [18, 23, 14, 21, 16]
    for i, ln in enumerate(lens):
        y = 16 + i * 2
        col = ("shirt-1", "badge-red")[i % 2]
        x0 = 4
        if owned:
            # ticked and numbered: a priority digit, then a green tick on the done ones
            glyphs_digit = "12345"[i]
            c.point(3, y, "shirt-2-dark")
            x0 = 6
            if i in (0, 2):
                for (dx, dy) in ((-7, 0), (-6, 1), (-5, 0), (-4, -1)):
                    c.point(w + dx, y + dy, "shirt-2-dark")
        for x in range(x0, min(x0 + ln, w - 8)):
            if (x * 7 + i * 3) % 5 != 0:
                c.point(x, y, col)
    glyphs.draw(c, "OWNER:", 4, h - 8, "outline")
    ox = 4 + glyphs.text_width("OWNER:") + 2
    if owned:
        # the hat: a red crown on a brim
        _rows(c, [".rrr.", ".rrr.", "rrrrr"], ox, h - 7, {"r": "badge-red"})
        c.rect(ox, h - 4, ox + 4, h - 4, "outline")
    else:
        glyphs.draw(c, "?", ox, h - 8, "badge-red")
    # stand: two legs to castors
    for k in range(8):
        c.point(4 - k // 3, h + k, "outline")
        c.point(w - 5 + k // 3, h + k, "outline")
    c.rect(1, h + 8, w - 2, h + 8, "shadow")
    for x in (1, 2, w - 3, w - 2):
        c.point(x, h + 7, "outline")
    return c


def build_all() -> dict:
    wb0, wb1 = _whiteboard(False), _whiteboard(True)
    return {
        # without
        # both ends of the same stalled call, each frozen mid-wave (G2.4)
        "tv-frozen": make_anim(_tv_frozen(TV, INSET_PERSON, wave=True), 2, ms=250),
        "tv-frozen-inset": make_anim(_tv_frozen(TV, HQ_PERSON, wave=True), 2, ms=250),
        "conf-huddle": make(_conf_huddle),
        "whiteboard-requests": Sprite(wb0, (wb0.w // 2, wb0.h)),
        # built
        "tv-live": make_anim(_tv_live(TV, INSET_PERSON), 2, key="talk", ms=180),
        "camera-bar": make(_camera_bar(TV)),
        "tv-live-inset": make_anim(_tv_live(TV, HQ_PERSON), 2, key="talk", ms=180),
        "conf-table": make(_conf_table),
        "whiteboard-owned": Sprite(wb1, (wb1.w // 2, wb1.h)),
        # a desk chair on its own (desk geometry, desk anchor): the inset's seat in
        # front of its screen; the backrest comes with whoever sits in it
        "chair": make(lambda iso, c: _chair_at(iso, 0.0, back=False)),
    }
