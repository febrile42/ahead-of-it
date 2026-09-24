"""Desk group: desk + office chair + monitor on one floor tile (PH1-06 redraw).

The spike's desk was a solid block with a stool beside it and a monitor floating above
the back corner. This one is built from world-unit boxes (art/src/vox.py), so the
monitor's stand sits *on* the desktop by construction, and the chair has a seat, a gas
post, a base and a backrest.

Orientation (fixed for every desk variant, so seated workers line up):
  - the desk runs along +c at the back of the tile (r 0.5..4);
  - the monitor's screen is its +r face, i.e. it faces down-left, toward the chair and
    toward the viewer, so whatever is on the screen (code, a sticky note, `DEV`) reads;
  - the chair sits at the front (r 4.5..7.8) with its backrest nearest the viewer.

A seated worker (`worker-seated`, art/src/sprites/worker.py) is a separate sprite on
the same 32x40 canvas and anchor; paste it over any desk variant and it lands in the
chair. It redraws the backrest over the worker's back, which is why `backrest()` lives
here and is shared.

Variants (band 80): `desk` (plain), `desk-postit` (G1.2 without: yellow sticky note on
the screen), `desk-padlock` (G1.2 built: tiny padlock on the bezel), `desk-dev` (G2.1
without: a `DEV` card taped to the monitor, screen showing a half-written pull request),
`desk-dev-built` (G2.1 built: same developer's desk, card gone, screen full of code).
`desk-dev` also carries a colleague's broken laptop, open beside the PR — the developer
is a hero doing two jobs (TONE.md), not a bottleneck.
"""
from ..dsl import Canvas
from ..vox import Iso, SwapIso
from .. import glyphs

W, H = 32, 40
ANCHOR = (16, H)

# world-unit geometry, shared with worker-seated
DESK = dict(c0=0.5, c1=7.5, r0=0.5, r1=4.0, top=8.0, slab=1.5)
MON = dict(c0=3.2, c1=7.2, r0=1.2, r1=2.0, z0=DESK["top"] + 1.5, z1=DESK["top"] + 9.5)
# the developer's desk carries a second machine, so his monitor is narrower and shifted
# right; both screens then sit clear of his head
MON_DEV = dict(MON, c0=4.4, c1=7.4)
CHAIR = dict(c0=0.8, c1=4.2, r0=4.6, r1=7.4, seat=5.0)
BACKREST = dict(c0=0.8, c1=4.2, r0=7.4, r1=8.1, z0=6.0, z1=11.0)
SCREEN_PLANE = MON["r1"]


def build(kind: str = "plain", turned: bool = False, screen=None) -> Canvas:
    """`turned` (PH1-07): the same desk rotated a quarter turn, screen facing +c
    (down-right), chair on the tile's right; built with `vox.SwapIso`. `screen`
    optionally overrides the screen painter: fn(c, z, band, c0, c1) -> colour | None."""
    c = Canvas(W, H)
    iso = SwapIso(c) if turned else Iso(c)
    _shadows(iso)
    _desk(iso)
    mon = MON_DEV if kind.startswith("dev") else MON
    faces = _monitor(iso, mon)
    _screen(iso, faces, kind, mon, screen)
    _chair(iso)
    backrest(iso)
    if kind == "dev":
        _their_laptop(iso)
        _dev_card(c)
    if kind == "padlock":
        _padlock(c, iso)
    if kind == "postit":
        _postits(c)
    return c


# PH1-10 fix round (G1.2): the notes are paper stuck *on* the monitor, not pixels on
# the screen: flat squares, outlined, on the bezel's corners and sticking out past its
# edge. NOTE_PEEL (x0, y0, x1, y1 inclusive, desk canvas) is the one `worker-peel`
# takes: on the bottom-left corner, overhanging onto the desk top, so the peel's second
# frame can paint the desk back over it.
NOTE_PEEL = (17, 15, 22, 20)
NOTE_TOP = (24, 10, 28, 14)


def _note(c: Canvas, box, scribbles):
    x0, y0, x1, y1 = box
    c.rect(x0, y0, x1, y1, "outline")
    c.rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, "sticky")
    for (x, y) in scribbles:                      # a password, written down
        c.point(x, y, "outline")


def _postits(c: Canvas):
    x0, y0, _x1, _y1 = NOTE_PEEL
    _note(c, NOTE_PEEL, [(x0 + 1, y0 + 2), (x0 + 2, y0 + 2), (x0 + 3, y0 + 2),
                         (x0 + 2, y0 + 4), (x0 + 3, y0 + 4)])
    tx, ty, _a, _b = NOTE_TOP
    _note(c, NOTE_TOP, [(tx + 1, ty + 2), (tx + 2, ty + 2)])


def net_point(kind: str = "plain", turned: bool = False) -> tuple[int, int]:
    """Where a dotted network line meets this desk: the middle of the screen."""
    m = MON_DEV if kind.startswith("dev") else MON
    iso = (SwapIso if turned else Iso)(Canvas(W, H))
    return iso.left_px(SCREEN_PLANE, (m["c0"] + m["c1"]) / 2, (m["z0"] + m["z1"]) / 2)


def card_point(turned: bool = False) -> tuple[int, int]:
    """The middle of the monitor's top edge: where a billboarded card (`DEV`,
    `CUSTOMERS`, `REPORT`) is taped. PH1-07."""
    m = MON
    iso = (SwapIso if turned else Iso)(Canvas(W, H))
    return iso.left_px(SCREEN_PLANE, (m["c0"] + m["c1"]) / 2, m["z1"] + 1)


def build_variant(kind: str) -> Canvas:
    assert kind in ("postit", "padlock", "dev", "dev-built"), kind
    return build(kind)


# -- parts -----------------------------------------------------------------

def _shadows(iso: Iso):
    d = DESK
    iso.floor_shadow(d["c0"], d["r0"], d["c1"], d["r1"], grow=1.0, grow_r=0.5)
    iso.floor_shadow(CHAIR["c0"] + 0.5, CHAIR["r0"] + 0.5, CHAIR["c1"] - 0.5,
                     BACKREST["r1"] - 0.4, grow=1.0, grow_r=0.3)


def _desk(iso: Iso):
    d = DESK
    top = d["top"]
    # modesty panel at the back, then the two end panels, then the slab on top
    iso.box(d["c0"] + 0.4, d["r0"], 1.0, d["c1"] - 0.4, d["r0"] + 0.9, top,
            top="desk-wood-dark", left="desk-wood-dark", right="desk-wood-dark")
    for c0 in (d["c0"], d["c1"] - 1.0):
        iso.box(c0, d["r0"], 0, c0 + 1.0, d["r1"], top,
                top="desk-wood", left="desk-wood", right="desk-wood-dark")
    iso.box(d["c0"], d["r0"], top, d["c1"], d["r1"], top + d["slab"],
            top="desk-wood", left="desk-wood-dark", right="desk-wood-dark")


def _monitor(iso: Iso, m: dict) -> dict:
    mid = (m["c0"] + m["c1"]) / 2
    top = DESK["top"] + DESK["slab"]
    # foot plate and neck: the monitor now stands on the desktop, not above it
    iso.box(mid - 1.0, 1.0, top, mid + 1.0, 2.6, top + 0.8,
            top="monitor-frame", left="monitor-frame", right="monitor-frame")
    iso.box(mid - 0.3, 1.0, top, mid + 0.4, 1.6, m["z0"] + 1,
            top="monitor-frame", left="monitor-frame", right="monitor-frame")
    return iso.box(m["c0"], m["r0"], m["z0"], m["c1"], m["r1"], m["z1"],
                   top="chair-mid", left="monitor-frame", right="chair-dark")


def _screen(iso: Iso, faces: dict, kind: str, m: dict, custom=None):
    """Screen content, painted in face coordinates so it skews with the monitor.
    Lines are 1 unit (1 px) tall bands counted down from the top of the glass."""
    c0, c1 = m["c0"] + 0.5, m["c1"] - 0.5
    top, bot = m["z1"] - 1.0, m["z0"] + 1.0

    def band(z):
        return int(top - z)  # 0 = first pixel row under the bezel

    # (band, indent, length) in c units; colours alternate for syntax
    code = [(1, 0.0, 2.5, "paper"), (3, 0.8, 2.2, "sticky"), (5, 0.8, 1.6, "paper")]
    pr = [(1, 0.0, 3.0, "paper"), (3, 0.0, 2.0, "badge-green"), (4, 0.0, 1.5, "badge-red")]

    def fn(c, z):
        if not (c0 <= c < c1 and bot <= z < top):
            return None
        b = band(z)
        if custom is not None:
            return custom(c, z, b, c0, c1)
        if kind in ("dev", "dev-built"):
            for bb, ind, ln, col in (pr if kind == "dev" else code):
                if b == bb and c0 + ind <= c < c0 + ind + ln:
                    return col
            if kind == "dev" and b == 5 and c0 <= c < c0 + 0.5:
                return "paper"  # the cursor, parked mid-review
            return "shirt-1-dark"
        if b == 0 and c < c0 + 1.5:
            return "glass-highlight"
        return "monitor-screen"

    iso.paint(faces, "L", SCREEN_PLANE, fn)


def _chair(iso: Iso):
    ch = CHAIR
    # five-star base (flattened) + gas post + seat cushion
    iso.box(ch["c0"] + 0.3, 4.9, 0, ch["c1"] - 0.3, 7.2, 0.8, top="chair-dark",
            left="chair-dark", right="outline")
    iso.box(2.2, 5.7, 0.8, 2.8, 6.3, ch["seat"], top="chair-mid", left="chair-mid",
            right="chair-dark")
    iso.box(ch["c0"], ch["r0"], ch["seat"], ch["c1"], ch["r1"], ch["seat"] + 1.5,
            top="chair-mid", left="chair-dark", right="chair-dark")


def backrest(iso: Iso):
    """The chair back, nearest the viewer. Shared with worker-seated, which redraws it
    over the seated worker's lower back."""
    b = BACKREST
    iso.box(2.2, b["r0"] - 0.2, CHAIR["seat"] + 1.5, 2.8, b["r0"] + 0.4, b["z0"],
            top="chair-dark", left="chair-dark", right="outline")
    iso.box(b["c0"], b["r0"], b["z0"], b["c1"], b["r1"], b["z1"],
            top="chair-mid", left="chair-mid", right="chair-dark")


def _their_laptop(iso: Iso):
    """Someone else's laptop, open on the developer's desk beside his own half-finished
    pull request: he is doing two jobs, and doing both. Red X where the desktop was."""
    top = DESK["top"] + DESK["slab"]
    iso.box(1.6, 2.2, top, 4.0, 3.9, top + 0.6, top="chair-mid", left="chair-dark",
            right="outline")
    lid = iso.box(1.6, 1.8, top, 4.0, 2.3, top + 4.8, top="chair-dark",
                  left="monitor-frame", right="outline")

    def screen(c, z):
        if 2.0 <= c < 3.6 and top + 1.0 <= z < top + 4.2:
            u, v = (c - 2.0) / 1.6, (z - top - 1.0) / 3.2
            if abs(u - v) < 0.22 or abs(u - (1 - v)) < 0.22:
                return "badge-red"
            return "monitor-screen"
        return None
    iso.paint(lid, "L", 2.3, screen)


def _dev_card(c: Canvas):
    """A paper card taped to the top of the monitor, facing the viewer: `DEV`.
    Billboarded (not skewed) so the word reads at 1x."""
    w = glyphs.text_width("DEV")
    x0, y0 = 19, 5
    c.outlined_rect(x0, y0, x0 + w + 1, y0 + 6, "paper", "outline")
    glyphs.draw(c, "DEV", x0 + 1, y0 + 1, "outline")
    # two strips of tape holding it to the bezel
    c.point(x0 + 1, y0 + 7, "wall-shadow")
    c.point(x0 + w, y0 + 7, "wall-shadow")


def _padlock(c: Canvas, iso: Iso):
    """A tiny padlock clipped to the monitor's top-right corner: sign-in is locked."""
    x, y = iso.left_px(SCREEN_PLANE, MON["c1"] - 0.6, MON["z1"])
    x -= 3
    y -= 3
    rows = [
        ".ooo.",
        "oo.oo",
        "ooooo",
        "oyyyo",
        "oyoyo",
        "oyyyo",
        "ooooo",
    ]
    for dy, row in enumerate(rows):
        for dx, ch in enumerate(row):
            if ch == "o":
                c.point(x + dx, y + dy, "outline")
            elif ch == "y":
                c.point(x + dx, y + dy, "sticky")
