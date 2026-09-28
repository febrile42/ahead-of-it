"""Band 610 props (PH1-12), both states. `docs/content/BANDS-AND-GAGS.md` §610.

Ground floor
  G4.1  front-door       a front door standing in the room's cut front-left edge, a
                         stoop outside it. `shut` (without) / `open` (built: the leaf
                         swung in against the jamb)
        auditor          a suit in profile outside it, holding up a clipboard that says
                         AUDITOR. `wait` (without: the near hand knocking, 2 frames) /
                         `shake` (built: the near hand out)
        infosec          built: someone in the doorway, a binder under the arm, the
                         hand out to the auditor's
        bubble-deal      a thought bubble with a `$` over a pit worker. `fade`
                         (without: grey, a brief gold that drains to grey, 4 frames,
                         the still is grey) / `gold`
"""
from __future__ import annotations

from ..dsl import Canvas
from ..vox import Iso, Sprite, make, make_anim
from .. import glyphs
from .room import PART_H, PART_T
from .worker import (Fig, LOOKS, R, _shadow, _leg_side, _torso_side, _head_side, _arm_side,
                     SIDE_BEATS)
from .poses import _place
from .band490 import _office_chair, CHAIR_CX, CHAIR_CR


def _union(**sprites) -> Sprite:
    """Several states of one prop under one manifest key, on one canvas (the union of
    all of them) with one anchor. Each becomes a named frame key — its animation if it
    has one (a `make_anim` sprite), else its still — and the first one's still is
    `default`."""
    ax = max(s.anchor[0] for s in sprites.values())
    ay = max(s.anchor[1] for s in sprites.values())
    w = max(ax + (s.w - s.anchor[0]) for s in sprites.values())
    h = max(ay + (s.h - s.anchor[1]) for s in sprites.values())

    def moved(cv, s):
        out = Canvas(w, h)
        out.img.alpha_composite(cv.img, (ax - s.anchor[0], ay - s.anchor[1]))
        return out
    anims = {}
    for n, s in sprites.items():
        if s.anims:
            cvs, ms = next(iter(s.anims.values()))
            anims[n] = ([moved(cv, s) for cv in cvs], ms)
        else:
            anims[n] = ([moved(s.canvas, s)], 0)
    first = next(iter(sprites.values()))
    pts = {k: (v[0] + ax - first.anchor[0], v[1] + ay - first.anchor[1])
           for k, v in first.points.items()}
    return Sprite(moved(first.canvas, first), (ax, ay), pts, anims)


def _per_look(frames_of, anchor, ms) -> Sprite:
    """A worker pose as one manifest entry keyed by look (like `worker-seated`), built
    as a Sprite so `build_all` can return it with the props. `frames_of(look)` returns
    {key: [Canvas, ...]}."""
    anims = {}
    for look in LOOKS:
        for k, cvs in frames_of(look).items():
            anims[k] = (cvs, ms if len(cvs) > 1 else 0)
    first = next(iter(anims.values()))[0][0]
    return Sprite(first, anchor, anims=anims)


# -- G4.1: the auditor at the door -------------------------------------------------------

# The door stands in the room's *front-left* edge (the plane r = 8 of its tile), where
# band 150's HQ had its front door: the room's front walls are cut away (the dollhouse
# convention), so a door there is the one door in the building the camera can see both
# sides of. The auditor can stand outside it on a stoop, in full view, and the shut leaf
# is between him and the room. On the back walls he would be behind 40 units of wall.
DOOR = dict(c0=1.5, c1=6.5, h=26.0)
R_EDGE = 8.0


def _jambs(iso: Iso):
    for c0, c1 in ((0.0, DOOR["c0"]), (DOOR["c1"], 8.0)):
        f = iso.box(c0, R_EDGE - PART_T, 0, c1, R_EDGE, PART_H, top="chair-dark",
                    left="wall", right="wall-shadow", outline=None)
        iso.outline(set(f), "outline")


def _frame(iso: Iso):
    for c0 in (DOOR["c0"] - 0.4, DOOR["c1"]):
        iso.box(c0, R_EDGE - PART_T, 0, c0 + 0.5, R_EDGE, DOOR["h"] + 1,
                top="wall-trim", left="wall-trim", right="badge-body")
    iso.box(DOOR["c0"] - 0.4, R_EDGE - PART_T, DOOR["h"] + 1, DOOR["c1"] + 0.5, R_EDGE,
            DOOR["h"] + 3, top="wall-trim", left="wall-trim", right="badge-body")


def _front_door(iso: Iso, c: Canvas, shut: bool):
    _jambs(iso)
    if not shut:
        # the leaf swung in against the far post, edge-on to us: the doorway is open
        # and the floor of the room shows through it
        iso.box(DOOR["c1"] - 0.6, R_EDGE - 5.6, 0, DOOR["c1"], R_EDGE - PART_T,
                DOOR["h"] - 0.2, top="desk-wood", left="desk-wood", right="desk-wood-dark")
    _frame(iso)
    if shut:
        f = iso.box(DOOR["c0"] + 0.1, R_EDGE - 0.7, 0, DOOR["c1"], R_EDGE - 0.1,
                    DOOR["h"] - 0.2, top="desk-wood", left="desk-wood",
                    right="desk-wood-dark")

        def leaf(cc, z):
            # two recessed panels and a handle: a door, not a plank
            if DOOR["c1"] - 1.4 <= cc < DOOR["c1"] - 0.6 and 11.0 <= z < 12.4:
                return "sticky"
            for z0, z1 in ((3.0, 11.0), (14.0, 23.0)):
                if DOOR["c0"] + 1.0 <= cc < DOOR["c1"] - 1.8 and z0 <= z < z1:
                    edge = (cc < DOOR["c0"] + 1.5 or z >= z1 - 0.8)
                    return "desk-wood-dark" if edge else None
            return None
        iso.paint(f, "L", R_EDGE - 0.1, leaf)


def _stoop(iso: Iso, c: Canvas):
    """A paved step outside the door: one tile of pavement at floor level, its own
    slab edge under it, and a mat."""
    f = iso.box(0.4, 0, -5, 7.6, 7.0, 0, top="wall-shadow", left="floor-left",
                right="floor-right", outline=None)
    iso.outline(set(f), "outline")
    iso.box(DOOR["c0"] + 0.4, 0.6, 0, DOOR["c1"] - 0.4, 3.0, 0.3, top="hair-1",
            left="hair-1", right="hair-1", outline=None)


# The auditor dresses like nobody in the building: a dark suit, a white collar and a
# red tie. Seniority, not menace (TONE.md: never a villain) — he is here to help, and
# the joke is that nobody can let him in.
AUDITOR_LOOK = dict(t="pants-1", T="chair-dark", p="pants-1", s="skin-1", h="badge-body",
                    style="short")
AUD_W, AUD_H = 44, 34
AUD_ANCHOR = (9, 34)
AUD_MS = 380


def _clipboard(c: Canvas, x0: int, y0: int):
    """A clipboard the size of a sign, billboarded: brown board, a steel clip, paper,
    AUDITOR in the 3x5 glyphs. The one thing in the picture that must be read."""
    text = "AUDITOR"
    w = glyphs.text_width(text) + 6
    h = 11
    c.rect(x0, y0, x0 + w - 1, y0 + h - 1, "outline")
    c.rect(x0 + 1, y0 + 1, x0 + w - 2, y0 + h - 2, "desk-wood")
    c.rect(x0 + 2, y0 + 2, x0 + w - 3, y0 + h - 2, "paper")
    glyphs.draw(c, text, x0 + 3, y0 + 4, "outline")
    cx = x0 + w // 2
    c.rect(cx - 3, y0 - 1, cx + 2, y0 + 1, "outline")
    c.rect(cx - 2, y0, cx + 1, y0 + 1, "badge-body")
    return w


def auditor_frames() -> dict:
    """Right-facing profile, standing. The far hand holds the clipboard up in front of
    the chest (drawn over the body: the label is what reads, the torso does not have
    to). Without: the near arm raised, knuckles to the door, a two-frame knock. Built:
    the near arm straight out at waist height, taking a hand."""
    out = {}
    for key, n in (("wait", 2), ("shake", 1)):
        frames = []
        for i in range(n):
            f = Fig(AUD_W, AUD_H)
            body = Fig()
            _shadow(body, cx=9)
            _leg_side(body, "stand", 0)
            _torso_side(body, 0)
            _leg_side(body, "stand", 0)
            _head_side(body, AUDITOR_LOOK["style"], 0)
            body.put(9, 9, "V")                                 # the collar
            body.put(10, 9, "V")
            for y in range(10, 14):                             # the tie
                body.put(10, y, "X")
            _place(f, body, 1, 10)
            if key == "wait":
                # forearm up and forward, the fist a pixel further on the knock
                k = i
                arm = {(10, 19), (11, 19), (11, 18), (12, 18), (12, 17), (13, 17),
                       (13, 16), (14, 16), (14, 15), (15, 15), (15, 14 - k), (16, 14 - k)}
                fist = {(16 + k, 12 - k), (17 + k, 12 - k), (16 + k, 13 - k),
                        (17 + k, 13 - k)}
            else:
                arm = {(x, y) for x in range(10, 17) for y in (20, 21)}
                fist = {(17, 20), (18, 20), (17, 21), (18, 21)}
            f.blob(arm | fist, lambda p: "s" if p in fist else "T", ring="outer")
            cv = f.to_canvas(AUDITOR_LOOK)
            # the clipboard, held against the chest by the far hand; it runs forward of
            # him toward the door, so the face and the knocking arm stay clear
            # (held high enough that the legs show under it: a person holding a board,
            # not a board with a head)
            _clipboard(cv, 3, 17)
            frames.append(cv)
        out[key] = frames
    out["walk"] = auditor_walk_frames()
    return out


AUD_WALK_MS = 120                   # the walkers' step (build.WALK_FRAME_MS)


def auditor_walk_frames() -> list:
    """PH2-03: the band-crossing moment walks him up to the door. The worker's four side
    beats (legs and bob), his suit, collar and tie, and the clipboard held up in front
    exactly as in `wait` and `shake`, riding the bob: it is still the one thing that
    must be read, so it never leaves his chest."""
    frames = []
    for near, far, arm, b in SIDE_BEATS:
        f = Fig(AUD_W, AUD_H)
        body = Fig()
        _shadow(body, cx=9)
        _leg_side(body, far, b)
        _torso_side(body, b)
        _leg_side(body, near, b)
        _head_side(body, AUDITOR_LOOK["style"], b)
        body.put(9, 9 + b, "V")
        body.put(10, 9 + b, "V")
        for y in range(10 + b, 14 + b):
            body.put(10, y, "X")
        _arm_side(body, arm, b)
        _place(f, body, 1, 10)
        cv = f.to_canvas(AUDITOR_LOOK)
        _clipboard(cv, 3, 17 + b)
        frames.append(cv)
    return frames


# The InfoSec lead: the building's own person, so a staff look (`b`), and a thick blue
# binder under the far arm — the program the auditor came to see, which exists.
def infosec_frame() -> Canvas:
    look = LOOKS["b"]
    f = Fig(24, 24)
    body = Fig()
    _shadow(body, cx=9)
    _arm_side(body, 0, 0, role="T", ring=True)
    _leg_side(body, "stand", 0)
    _torso_side(body, 0)
    _leg_side(body, "stand", 0)
    _head_side(body, look["style"], 0)
    _place(f, body, 0, 0)
    # the binder, clamped under the far arm against the back: a blue block standing
    # proud of the back, a white spine label
    f.blob(R(2, 10, 5, 17), lambda p: "V" if p[0] == 2 and 11 <= p[1] <= 15 else "B")
    arm = {(x, y) for x in range(9, 16) for y in (11, 12)}
    hand = {(16, 11), (17, 11), (16, 12), (17, 12)}
    f.blob(arm | hand, lambda p: "s" if p in hand else "t", ring="outer")
    cv = f.to_canvas(dict(look, B="shirt-1-dark"))
    return cv.mirror_h()                    # facing left, out of the door, at him


# -- the deal, in the pit --------------------------------------------------------------

DOLLAR = ["..#..", ".####", "#.#..", ".###.", "..#.#", "####.", "..#.."]
BUBBLE_W, BUBBLE_H = 20, 21
BUBBLE_ANCHOR = (18, 21)           # the smallest trailing dot, just over the head


def _bubble(ink: str, ring: str, fill: str) -> Canvas:
    """A thought cloud, 16 x 13, and two trailing dots down to the right to the thinker's
    head. The `$` is inked and ringed so it reads on the cloud whatever its colour."""
    c = Canvas(BUBBLE_W, BUBBLE_H)
    x0, y0, w, h = 0, 0, 16, 13
    pts = set()
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            dx, dy = (x - (x0 + w / 2 - 0.5)) / (w / 2), (y - (y0 + h / 2 - 0.5)) / (h / 2)
            if dx * dx + dy * dy <= 1.1:
                pts.add((x, y))
    for (x, y) in pts:
        c.point(x, y, "outline")
    for (x, y) in pts:
        if all((x + a, y + b) in pts for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            c.point(x, y, fill)
    gx, gy = x0 + 5, y0 + 3
    ink_px = {(gx + dx, gy + dy) for dy, row in enumerate(DOLLAR)
              for dx, ch in enumerate(row) if ch == "#"}
    for (x, y) in ink_px:
        for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if (x + a, y + b) not in ink_px:
                c.point(x + a, y + b, ring)
    for (x, y) in ink_px:
        c.point(x, y, ink)
    for (x, y, r) in ((15, 15, 1), (18, 19, 0)):
        c.rect(x - r, y - r, x + r + 1, y + r + 1, "outline")
        if r:
            c.rect(x, y, x + 1, y + 1, fill)
    return c


def bubble_frames() -> dict:
    """Without: the deal thought going grey — grey (0, the still, held long), then a
    brief gold (1) that tarnishes (2) and drains (3) back to grey. It dwells on dead
    and only now and then remembers hope, so it reads as a fade, not a blinker (DIA-110).
    The cloud greys with it, so the change is value as well as hue and reads for a
    colour-blind visitor. Built: gold, on white."""
    gold = _bubble("sticky", "desk-wood-dark", "paper")
    tarnish = _bubble("desk-wood", "desk-wood-dark", "paper")
    going = _bubble("wall-trim", "badge-body", "wall")
    grey = _bubble("badge-body", "wall-shadow", "wall-shadow")
    return {"fade": [grey, gold, tarnish, going], "gold": [gold]}


BUBBLE_MS = [3600, 500, 350, 350]      # grey hold, gold, tarnish, drain


# -- G3.3: the org chart with one box ----------------------------------------------------

POSTER_W, POSTER_H = 58, 40


def _box(c: Canvas, x0, y0, w, h, fill, text=None, ink="paper"):
    c.rect(x0, y0, x0 + w - 1, y0 + h - 1, "outline")
    c.rect(x0 + 1, y0 + 1, x0 + w - 2, y0 + h - 2, fill)
    if text:
        glyphs.draw(c, text, x0 + (w - glyphs.text_width(text)) // 2, y0 + 1, ink)


def _vline(c, x, y0, y1, col="outline"):
    for y in range(y0, y1 + 1):
        c.point(x, y, col)


def _hline(c, x0, x1, y, col="outline"):
    for x in range(x0, x1 + 1):
        c.point(x, y, col)


def _dept(c: Canvas, x0: int, w: int, y0: int, fill="shirt-1", text=None, kids=2):
    """A department: its box on the bus, and `kids` reports stacked under it."""
    cx = x0 + w // 2
    _vline(c, cx, y0 - 2, y0 - 1)
    _box(c, x0, y0, w, 7, fill, text)
    y = y0 + 7
    for k in range(kids):
        _vline(c, cx, y, y + 1)
        _box(c, cx - 2, y + 2, 5, 3, "shirt-1-dark")
        y += 5
    return cx


def org_chart(built: bool) -> Canvas:
    """A poster pinned to the corridor wall, billboarded: ORG CHART, the top box, a bus,
    and every department a little tree.

    Without, IT is not on the bus at all: one grey box hanging off FIN by a dotted
    line, low and to the right, with the one tired person who is all of it inside.
    Built, IT is a department on the bus like every other, with its own three reports.
    The shape carries it (a tree against a lone box), not the colour."""
    c = Canvas(POSTER_W, POSTER_H)
    c.rect(0, 0, POSTER_W - 1, POSTER_H - 1, "outline")
    c.rect(1, 1, POSTER_W - 2, POSTER_H - 2, "paper")
    for x, y in ((2, 1), (POSTER_W - 3, 1)):
        c.point(x, y, "badge-red")                          # two pins
    glyphs.draw(c, "ORG CHART", (POSTER_W - glyphs.text_width("ORG CHART")) // 2, 2,
                "outline")
    top_w = 9
    tx = (POSTER_W - top_w) // 2
    _box(c, tx, 9, top_w, 5, "chair-dark")
    ybus, ydept = 16, 18
    _vline(c, tx + top_w // 2, 14, ybus)
    depts = [(2, 7), (10, 7), (18, 7)]
    cxs = [_dept(c, x0, w, ydept) for (x0, w) in depts]
    # 13 wide, so the 4-wide N clears the box's edge and FIN does not read as FIR
    cxs.append(_dept(c, 26, 13, ydept, text="FIN"))
    if built:
        # IT on the bus, its own three reports side by side under it
        x0, w = 41, 9
        cx = x0 + w // 2
        _vline(c, cx, ydept - 2, ydept - 1)
        _box(c, x0, ydept, w, 7, "badge-green", "IT")          # FIN's letterforms
        _vline(c, cx, ydept + 7, ydept + 8)
        _hline(c, cx - 4, cx + 4, ydept + 9)
        for kx in (cx - 4, cx, cx + 4):
            _vline(c, kx, ydept + 9, ydept + 10)
            _box(c, kx - 1, ydept + 11, 3, 3, "shirt-1-dark")
        cxs.append(cx)
    _hline(c, min(cxs), max(cxs), ybus)
    if not built:
        # IT: off the bus, low and to the right, hung off FIN's side by a dashed line,
        # the tired face inside. Yellow: the one box on the chart the eye should land
        # on. `IT` sits on its own rows above the face, with a clear row between, so it
        # reads as a label in FIN's letterforms and not as the face's hair (DIA-3 review).
        bx, by, bw, bh = 47, 25, 9, 13
        _box(c, bx, by, bw, bh, "sticky")
        glyphs.draw(c, "IT", bx + 2, by + 2, "outline")
        _tired_face(c, bx + 2, by + 8)
        # the dashed line: 2 on, 1 off, out of FIN's right edge and down onto the box.
        # Six dashes, so it is a line of a kind and not `...` (more boxes)
        path = [(x, ydept + 3) for x in range(26 + 13, bx + bw // 2 + 1)]
        path += [(bx + bw // 2, y) for y in range(ydept + 4, by)]
        for k, (x, y) in enumerate(path):
            if k % 3 != 2:
                c.point(x, y, "outline")
    return c


def _tired_face(c: Canvas, x0, y0):
    """The tired person, 5 x 4: hair, eyes half-shut (a flat line), the mouth down."""
    rows = [".hhh.", "hsssh", "seees", ".sms."]
    for dy, row in enumerate(rows):
        for dx, ch in enumerate(row):
            if ch != ".":
                c.point(x0 + dx, y0 + dy, {"h": "hair-1", "s": "skin-1", "e": "outline",
                                           "m": "shirt-3-dark"}[ch])


# -- street: G5.2, phones in the air (the inset office's far wing) -------------------------

UP_W, UP_H = 16, 30
UP_ANCHOR = (8, 30)
UP_MS = 420


def phone_up_frames(look_name: str) -> list[Canvas]:
    """Front view, looking up, the screen-right arm straight up with a phone held at
    full stretch, hunting for a bar of signal (the phone sways a pixel, frame 1). The
    arm is the silhouette: nobody holds a phone over their head for any other reason."""
    from .worker import _leg_front, _torso_front, _head_front, _arm_front
    look = LOOKS[look_name]
    out = []
    for i in range(2):
        f = Fig(UP_W, UP_H)
        body = Fig()
        _shadow(body)
        _leg_front(body, "left", 0, 0)
        _leg_front(body, "right", 0, 0)
        _torso_front(body, 0)
        _arm_front(body, "left", 6, 0)
        _head_front(body, look["style"], 0)
        # eyes up at the phone: the pupils a row higher
        body.px[(6, 5)] = body.px[(9, 5)] = "s"
        body.px[(6, 4)] = body.px[(9, 4)] = "e"
        _place(f, body, 0, 6)
        x = 13 + (1 if i else 0)
        arm = {(13, y) for y in range(8, 16)} | {(14, y) for y in range(8, 16)}
        arm |= {(x, 5), (x + 1, 5), (x, 6), (x + 1, 6), (x, 7), (x + 1, 7)}
        f.blob(arm, lambda p: "s" if p[1] <= 7 else "T", ring="outer")
        f.blob(R(x - 1, 0, x + 1, 4), lambda p: "G" if p[1] in (1, 2) and p[0] == x else "L")
        out.append(f.to_canvas(look))
    return out


def _cabinet(iso: Iso, c: Canvas, frame: int, router: bool):
    """A two-drawer steel filing cabinet against the back wall; without, a consumer
    router on it: a small black box, two antennas splayed, one red light blinking
    (`blink`). Built, the cabinet is just a cabinet."""
    iso.floor_shadow(1.0, 1.0, 7.0, 5.0, grow=0.8, grow_r=0.3)
    f = iso.box(1.0, 1.0, 0, 7.0, 5.0, 11.0, top="wall-shadow", left="badge-body",
                right="chair-mid")

    def drawers(cc, z):
        if abs(z - 5.5) < 0.4 or abs(z - 10.6) < 0.2:
            return "chair-mid"
        if 3.4 <= cc < 4.6 and (7.8 <= z < 8.6 or 2.8 <= z < 3.6):
            return "wall-trim"                                  # the handles
        return None
    iso.paint(f, "L", 5.0, drawers)
    if not router:
        return
    rb = iso.box(2.0, 1.6, 11.0, 6.0, 4.2, 12.8, top="chair-dark", left="monitor-frame",
                 right="outline")
    iso.paint(rb, "L", 4.2, lambda cc, z: ("badge-red" if frame == 0 else "chair-mid")
              if 4.4 <= cc < 5.6 else ("badge-body" if 2.6 <= cc < 3.2 else None))
    for (x0, y0), dx in ((iso.pt(2.4, 1.8, 12.8), -1), (iso.pt(5.6, 1.8, 12.8), 1)):
        for k in range(7):                          # two pixels thick, a knob on the tip
            c.point(x0 + (dx * k) // 3, y0 - k - 1, "outline")
            c.point(x0 + (dx * k) // 3 + dx, y0 - k - 1, "chair-dark")
        c.point(x0 + (dx * 7) // 3, y0 - 8, "outline")


def ap_disc() -> Canvas:
    """Built: a ceiling access point on its bracket at the top of a wall — a flat white
    disc, a green light, and the three net-coloured arcs of `wifi` over it."""
    rows = ["...n.n.n...",
            "....n.n....",
            ".....n.....",
            ".ooooooooo.",
            "oVVVVVVVVVo",
            "oggggGggggo",
            ".ooooooooo."]
    c = Canvas(11, len(rows))
    from .band80 import _rows
    _rows(c, rows, 0, 0, {"o": "outline", "V": "paper", "g": "wall-shadow",
                          "G": "badge-green", "n": "net"})
    return c


# -- street: G6.3, the moving truck at the empty shell -----------------------------------

SHELL = 24.0                       # three tiles square
POST = 1.4
SHELL_H = 28.0
SHELL_DOOR = (4.0, 10.0)           # the doorway, c along its front-left edge


def _shell(iso: Iso, c: Canvas, fitted: bool):
    """A new building on the street, drawn the dollhouse way like the inset office: a
    concrete floor plate, walls cut to stubs so the inside shows, a column at each front
    corner and a door frame. Without, bare grey concrete with nothing in it. Built, the
    same shell fitted out: a cable tray along the back walls, a badge reader by the
    door, a room (glass stubs) with a camera bar."""
    S = SHELL
    iso.floor_shadow(0, 0, S, S, grow=1.5, grow_r=0.6)
    fl = iso.box(0, 0, -5, S, S, 0, top="wall-shadow" if not fitted else "floor-top",
                 left="floor-left", right="floor-right", outline=None)
    if not fitted:
        # bare concrete: the pour's seams and a few stains
        iso.paint(fl, "T", 0, lambda cc, rr: "wall-trim" if (int(cc) % 8 == 0 or int(rr) % 8 == 0)
                  else ("badge-body" if (int(cc * 3 + rr * 7) % 23 == 0) else None))
    else:
        iso.paint(fl, "T", 0, lambda cc, rr: "floor-left" if (int(cc) % 8 == 0 or int(rr) % 8 == 0) else None)
    iso.outline(set(fl), "outline")
    stub = 6.0
    # the back stubs (full width), then the front stubs either side of the doorway
    for box in ((0, 0, 0, S, 1.0, stub), (0, 0, 0, 1.0, S, stub)):
        f = iso.box(*box, top="chair-dark", left="wall", right="wall-shadow", outline=None)
        iso.outline(set(f), "outline")
    d0, d1 = SHELL_DOOR
    for box in ((S - 1.0, 0, 0, S, S, stub), (0, S - 1.0, 0, d0, S, stub),
                (d1, S - 1.0, 0, S, S, stub)):
        f = iso.box(*box, top="chair-dark", left="wall", right="wall-shadow", outline=None)
        iso.outline(set(f), "outline")
    if fitted:
        # the cable tray, run along the tops of the back stubs
        for box in ((1.0, 0.2, stub, S - 1.0, 1.8, stub + 1.0),
                    (0.2, 1.0, stub, 1.8, S - 1.0, stub + 1.0)):
            iso.box(*box, top="badge-body", left="wall-trim", right="chair-mid")
        # the room: glass stubs in the back-right corner, a camera bar on a screen
        for box in ((12.0, 9.0, 0, S - 1.0, 9.6, 8.0), (12.0, 1.0, 0, 12.6, 9.6, 8.0)):
            f = iso.box(*box, top="glass-highlight", left="glass", right="glass-dark",
                        outline=None)
            iso.outline(set(f), "outline")
        iso.box(17.0, 2.0, 0, 18.0, 3.0, 8.0, top="chair-dark", left="chair-dark",
                right="outline")
        scr = iso.box(14.0, 2.0, 8.0, 21.0, 2.6, 15.0, top="monitor-frame",
                      left="monitor-frame", right="outline")
        iso.paint(scr, "L", 2.6, lambda cc, z: "monitor-screen" if 14.6 <= cc < 20.4 and 8.6 <= z < 14.4 else None)
        iso.box(15.5, 2.0, 15.0, 19.5, 2.8, 16.2, top="chair-dark", left="outline",
                right="outline")
        iso.box(15.0, 5.0, 0, 20.0, 7.5, 7.0, top="desk-wood", left="desk-wood-dark",
                right="hair-1")
    # two columns at the front corners (nothing stands behind the front), none at the
    # back: a column or a beam at the back would stand over the road behind the shell
    for (pc, pr) in ((S - POST, S - POST), (0, S - POST), (S - POST, 0)):
        if (pc, pr) != (S - POST, 0):
            iso.box(pc, pr, 0, pc + POST, pr + POST, SHELL_H, top="wall-trim", left="wall",
                    right="wall-shadow")
    # the door frame on the front-left edge (plane r = S)
    for pc in (d0 - 0.5, d1):
        iso.box(pc, S - 1.0, 0, pc + 0.5, S, 24.0, top="wall-trim", left="wall-trim",
                right="badge-body")
    iso.box(d0 - 0.5, S - 1.0, 24.0, d1 + 0.5, S, 25.5, top="wall-trim", left="wall-trim",
            right="badge-body")
    if fitted:
        x, y = iso.left_px(S, d1 + 1.2, 14.0)                 # the reader, green
        c.rect(x - 1, y - 3, x + 2, y + 2, "outline")
        c.rect(x, y - 2, x + 1, y + 1, "badge-green")
        # no camera dome over the door: at 390px it never read on the pale frame, so it
        # came out as it did at 490 (DIA-73, D-041)


def banner_sqft() -> Canvas:
    """`100,000 SQ FT` on a hoarding banner tied to the shell's front: red cloth, white
    letters, two ties."""
    text = "100,000 SQ FT"
    w, h = glyphs.text_width(text) + 6, 9
    c = Canvas(w, h + 1)
    c.rect(0, 0, w - 1, h - 1, "outline")
    c.rect(1, 1, w - 2, h - 2, "badge-red")
    glyphs.draw(c, text, 3, 2, "paper")
    for x in (1, w - 2):
        c.point(x, h, "outline")
    return c


def _moving_truck(iso: Iso, c: Canvas):
    """A yellow box truck parked along +r, cab away from the viewer, its back to the
    shell: the roller door rolled up on a dark hold with boxes in it, a ramp down onto the
    pavement and two boxes on their way in. Yellow so it can never be taken for G5.1's
    white courier van in the same close-up (DIA-73); wheels showing below the body."""
    C0, C1 = 0.5, 7.5
    Z0 = 2.6                                               # the body rides above its wheels
    iso.floor_shadow(C0, -15.0, C1, 4.5, grow=1.0, grow_r=0.4)
    cab = iso.box(C0, -15.0, Z0, C1, -10.0, 11.0, top="sticky", left="sticky",
                  right="desk-wood")
    iso.paint(cab, "R", C1, lambda rr, z: "glass-dark" if 6.4 <= z < 10.0 and rr >= -13.8
              and rr < -10.6 else None)
    body = iso.box(C0, -10.0, Z0, C1, 4.5, 16.0, top="sticky", left="sticky",
                   right="desk-wood", edge="desk-wood")
    iso.paint(body, "R", C1, lambda rr, z: "desk-wood-dark" if Z0 <= z < Z0 + 1.0 else
              "sticky" if 10.0 <= z < 11.5 and -9.0 <= rr < 3.5 else None)   # the livery stripe
    # the back: the roller door rolled up into a drum under the roof, the hold dark,
    # a stack of boxes inside
    iso.paint(body, "L", 4.5, lambda cc, z: (
        "sticky" if cc < C0 + 0.8 or cc >= C1 - 0.8 or z < Z0 + 0.8 else
        "wall-trim" if z >= 13.0 else
        "desk-wood" if C0 + 1.6 <= cc < C0 + 4.4 and z < Z0 + 5.6 else
        "outline"))
    # wheels under the near side, tyres dark with a grey hub
    for rr in (-12.5, 1.0):
        w = iso.box(C1 - 0.5, rr - 1.5, 0, C1 + 0.2, rr + 1.5, 3.6, top="outline",
                    left="outline", right="outline")
        iso.paint(w, "R", C1 + 0.2, lambda r2, z, rr=rr: "chair-mid"
                  if abs(r2 - rr) < 0.6 and 1.2 <= z < 2.4 else None)
    # the ramp, down from the hold onto the pavement, and two boxes carried out
    iso.box(C0 + 1.2, 4.5, 0, C1 - 1.2, 10.5, 1.2, top="badge-body", left="chair-mid",
            right="chair-dark")
    for (bc, br, bz, s) in ((C0 + 1.6, 5.2, 1.2, 3.2), (C0 + 2.2, 11.2, 0, 3.6)):
        b = iso.box(bc, br, bz, bc + s, br + s, bz + s, top="desk-wood", left="desk-wood",
                    right="desk-wood-dark", edge="desk-wood-dark")
        iso.paint(b, "T", bz + s, lambda cc, rr, bc=bc, s=s: "sticky"
                  if abs(cc - (bc + s / 2)) < 0.5 else None)


CABLE_W, CABLE_H = 30, 28
CABLE_ANCHOR = (8, 28)
# The cable (DIA-73): down from the fist, once round a loop and away along the floor,
# 2 px thick in the network pink so it reads on the pale shell floor. It is the whole
# network so far — that is the joke.
CABLE_IN = [(18, 10), (19, 13), (20, 15)]                    # fist -> the loop
CABLE_OUT = [(20, 20), (20, 23), (22, 25), (29, 25)]         # the loop -> along the floor
CABLE_LOOP = (23.5, 17.5, 4.3, 2.3)                          # centre, outer and inner radius


def _run(path) -> set:
    """A 2 px cable through `path`: horizontal pairs where it falls steeply, vertical
    pairs where it runs flat, so a diagonal never swells to 3 px."""
    pts = set()
    for (x0, y0), (x1, y1) in zip(path, path[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0))
        steep = abs(y1 - y0) >= abs(x1 - x0)
        for i in range(n + 1):
            x, y = round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n)
            pts |= {(x, y), (x + 1, y) if steep else (x, y + 1)}
    return pts


def _cable_pts() -> set:
    cx, cy, ro, ri = CABLE_LOOP
    loop = {(x, y) for x in range(CABLE_W) for y in range(CABLE_H)
            if ri ** 2 <= (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= ro ** 2}
    return loop | _run(CABLE_IN) | _run(CABLE_OUT)


def cable_frames(look_name: str) -> dict:
    """In the new building's doorway, front view. Without: holding up one ethernet cable
    by its plug — the whole network, so far — head back, looking up at a ceiling with
    nothing on it. Built: a clipboard held out, every line ticked."""
    from .worker import _leg_front, _torso_front, _head_front, _arm_front
    look = LOOKS[look_name]
    out = {}
    for key in ("cable", "ticks"):
        f = Fig(CABLE_W, CABLE_H)
        body = Fig()
        _shadow(body)
        _leg_front(body, "left", 0, 0)
        _leg_front(body, "right", 0, 0)
        _torso_front(body, 0)
        _arm_front(body, "left", 6, 0)
        _head_front(body, look["style"], 0)
        if key == "cable":
            body.px[(6, 5)] = body.px[(9, 5)] = "s"
            body.px[(6, 4)] = body.px[(9, 4)] = "e"
        _place(f, body, 0, 4)
        if key == "cable":
            # forearm up and out to the side, the plug held up in the fist, the cable
            # hanging from it in a loop and trailing off along the floor
            f.blob(_cable_pts(), "n", ring="outer")
            arm = {(13, 13), (14, 13), (14, 12), (15, 12), (15, 11), (16, 11), (16, 10),
                   (17, 10)}
            fist = R(17, 7, 18, 9)
            f.blob(arm | fist, lambda p: "s" if p in fist else "T", ring="outer")
            f.blob(R(17, 3, 18, 6), lambda p: "Y" if p[1] == 3 else "V")   # the plug
        else:
            arm = {(x, y) for x in range(13, 16) for y in (14, 15)}
            f.blob(arm, "T", ring="outer")
            f.blob(R(9, 11, 17, 19), lambda p: "b" if p[0] in (9, 17) or p[1] in (11, 19) else "V")
            for y in (13, 15, 17):
                f.put(11, y, "g")
                f.put(12, y + 1, "g")
                f.put(13, y, "g")
                for x in range(14, 16):
                    f.put(x, y, "k")
        out[key] = f.to_canvas(dict(look, g="shirt-2-dark"))
    return {f"{look_name}-{k}": [v] for k, v in out.items()}


# -- street: the map (G6.3's pins) -------------------------------------------------------

MAP_W, MAP_H = 30, 26
# Six pins, one per office (BANDS-AND-GAGS.md §610: two by 2019, one in 2022, three in
# 2023). The map is abstract on purpose — a made-up coastline no one could place and no
# names (D-014) — so the pins say "how many", never "where". It has to read as a *map*
# cold (DIA-73: the green blob with red dots read as a berry bush): folded paper in three
# panels, a grid, sea and a coastline edge. The three new pins are bigger and red, the
# old ones small and blue.
PINS_OLD = [(14, 6), (17, 15), (24, 5)]
PINS_NEW = [(13, 22), (21, 10), (25, 19)]
MAP_FOLDS = (10, 20)                                         # the creases, x


def _land(x: int, y: int) -> bool:
    """Land east of a ragged coast with one deep bay."""
    import math
    coast = 9.0 + 3.0 * math.sin(y / 3.2) + (5.0 if 15 <= y <= 19 else 0.0)
    return x >= coast


def map_frames() -> list[Canvas]:
    """A folded paper map on a signpost: sea to the west, a ragged coast with a dark
    edge, land with a faint grid, the middle of three fold panels in shade, six pins;
    the three that opened this year (2023) are the big red ones and blink in (frame 1
    hides them)."""
    out = []
    for i in range(2):
        c = Canvas(MAP_W, MAP_H + 8)
        for k in range(8):                                    # the post
            c.point(MAP_W // 2, MAP_H + k, "outline")
            c.point(MAP_W // 2 + 1, MAP_H + k, "chair-mid")
        c.rect(0, 0, MAP_W - 1, MAP_H - 1, "outline")
        for y in range(1, MAP_H - 1):
            for x in range(1, MAP_W - 1):
                mid = MAP_FOLDS[0] <= x < MAP_FOLDS[1]        # the middle panel, in shade
                if not _land(x, y):
                    col = "glass-dark" if mid else "glass"
                elif any(not _land(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    col = "shirt-1-dark"                      # the coastline edge
                elif x % 6 == 3 or y % 6 == 3:
                    col = "wall-trim" if mid else "floor-left"   # the grid
                else:
                    col = "floor-left" if mid else "floor-top"
                c.point(x, y, col)
        for fx in MAP_FOLDS:                                  # the fold notches
            c.point(fx, 0, "paper")
            c.point(fx, MAP_H - 1, "paper")
        for (x, y) in PINS_OLD:
            c.rect(x - 1, y - 2, x + 1, y, "outline")
            c.point(x, y - 1, "shirt-1")
        if i == 0:
            for (x, y) in PINS_NEW:
                c.rect(x - 2, y - 4, x + 2, y, "outline")
                c.rect(x - 1, y - 3, x + 1, y - 1, "badge-red")
                c.point(x - 1, y - 3, "paper")
                c.point(x, y + 1, "outline")
        out.append(c)
    return out


def build_all() -> dict:
    shut = make(lambda iso, c: _front_door(iso, c, True))
    open_ = make(lambda iso, c: _front_door(iso, c, False))
    bub = bubble_frames()
    aud = auditor_frames()
    return {
        "front-door": _union(shut=shut, open=open_),
        "stoop": make(_stoop),
        "auditor": Sprite(aud["wait"][0], AUD_ANCHOR,
                          anims={"wait": (aud["wait"], AUD_MS), "shake": (aud["shake"], 0),
                                 "walk": (aud["walk"], AUD_WALK_MS)}),
        "infosec": Sprite(infosec_frame(), (15, 24)),
        "bubble-deal": Sprite(bub["fade"][0], BUBBLE_ANCHOR,
                              anims={"fade": (bub["fade"], BUBBLE_MS), "gold": (bub["gold"], 0)}),
        "cabinet-router": _union(router=make_anim(lambda iso, c, i: _cabinet(iso, c, i, True), 2,
                                                  ms=900),
                                 bare=make(lambda iso, c: _cabinet(iso, c, 0, False))),
        "ap-disc": Sprite(ap_disc(), (5, 7)),
        # an office chair on its own, turned so its seat faces us (band 490's drawing):
        # the one b stands on
        "chair-stand": make(lambda iso, c: _office_chair(iso, -CHAIR_CX + 4.0,
                                                         -CHAIR_CR + 4.0, facing="near")),
        "worker-phone-up": _per_look(lambda lk: {lk: phone_up_frames(lk)}, UP_ANCHOR, UP_MS),
        "worker-cable": _per_look(cable_frames, CABLE_ANCHOR, 0),
        "shell": _union(empty=make(lambda iso, c: _shell(iso, c, False), size=256),
                        fitted=make(lambda iso, c: _shell(iso, c, True), size=256)),
        "banner-sqft": Sprite(banner_sqft(), (banner_sqft().w // 2, banner_sqft().h)),
        "moving-truck": make(_moving_truck),
        "map-pins": Sprite(map_frames()[0], (MAP_W // 2, MAP_H + 8),
                           anims={"pins": (map_frames(), 600)}),
        "poster-org": Sprite(org_chart(False), (POSTER_W // 2, POSTER_H),
                             anims={"one-box": ([org_chart(False)], 0),
                                    "tree": ([org_chart(True)], 0)}),
    }
