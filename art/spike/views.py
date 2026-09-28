"""PH1-08a: the rooms, drawn once, reused by every option's mock.

Each function draws one *view's* worth of building into a `V` (a mocklib Scene that also
records union-rect hotspots per gag part). Everything is gated by band, so the same code
draws band 360 and band 750 cumulatively (R-03a). Rough by design: sprites from PH1-07
where one exists, flat palette blocks with a 3x5 label where none does yet.

Floor plan used by every option (the spike's proposal, see FLOOR-CONVENTION-2026-09.md):
    ground   lobby + closet + sales pit        (band 80's room, grown to 12 x 9)
    floor-2  finance corner + glass meeting room + corridor
    top      the boardroom (750 only)
    street   HQ exterior, road, inset office, shell + truck (610), map (490+)
"""
from __future__ import annotations

from mocklib import Scene, sprite, rgb, label_img, room_shell, text_w, draw_text
from PIL import ImageDraw

GAG_BAND = {
    "G1.1": 80, "G1.2": 80, "G2.1": 80, "G2.2": 80, "G2.3": 80,
    "G3.2": 150, "G4.2": 150, "G4.3": 150, "G5.1": 150,
    "G2.4": 220, "G7.3a": 220,
    "G7.3": 360, "G5.4": 360, "G5.3": 360, "G5.6": 360,
    "G3.1": 490, "G6.4": 490,
    "G4.1": 610, "G5.2": 610, "G3.3": 610, "G6.3": 610,
    "G6.1": 750, "G6.2": 750, "G7.1": 750, "G7.2": 750, "G7.4": 750,
}
FLOORS = {80: 2, 150: 3, 220: 4, 360: 5, 490: 6, 610: 7, 750: 7}
LOOK = {"a": "worker", "b": "worker-b", "c": "worker-c", "d": "worker-d", "e": "worker-e"}

# one room footprint for every storey: a building's floors share a plan
C, R = 12, 9
VIEW_W = 360


class V(Scene):
    def __init__(self, w, h, origin, band):
        super().__init__(w, h, origin)
        self.band = band
        self.parts = {}   # (gag, part) -> [x0, y0, x1, y1, primary]

    def on(self, gag):
        return self.band >= GAG_BAND[gag]

    def _mark(self, gag, part, x0, y0, x1, y1, primary):
        if not gag:
            return
        k = (gag, part)
        if k in self.parts:
            b = self.parts[k]
            b[0], b[1] = min(b[0], x0), min(b[1], y0)
            b[2], b[3] = max(b[2], x1), max(b[3], y1)
            b[4] = b[4] or primary
        else:
            self.parts[k] = [x0, y0, x1, y1, primary]

    # --- tagged placements ------------------------------------------------------
    def P(self, name, frame, pt, depth, gag=None, part="main", primary=True, flip=False):
        im, a, _ = sprite(name, frame)
        self.spr(name, frame, pt, depth, flip)
        self._mark(gag, part, pt[0] - a[0], pt[1] - a[1], pt[0] - a[0] + im.width,
                   pt[1] - a[1] + im.height, primary)
        return pt

    def T(self, name, c, r, frame="default", depth=None, dx=0, dy=0, **tag):
        pt = self.at(c, r)
        return self.P(name, frame, (pt[0] + dx, pt[1] + dy),
                      c + r + 1 if depth is None else depth, **tag)

    def F(self, name, frame, u, v, depth=None, **tag):
        return self.P(name, frame, self.g(u, v), u + v if depth is None else depth, **tag)

    def W(self, look, frame, u, v, depth=None, **tag):
        return self.F(LOOK[look], frame, u, v, depth, **tag)

    def S(self, look, c, r, depth=None, turned=False, **tag):
        """A seated worker on the desk at (c, r)."""
        return self.T("worker-seated-turned" if turned else "worker-seated", c, r,
                      frame=look, depth=(c + r + 1.01) if depth is None else depth, **tag)

    def Bx(self, u0, v0, u1, v1, h, top, left, right, z=0, depth=None, text=None,
           gag=None, part="main", primary=True, text_col="outline"):
        g = self.g
        pts = [g(u0, v0, z + h), g(u1, v1, z), g(u0, v1, z), g(u1, v0, z)]
        self.box(u0, v0, u1, v1, h, top, left, right, z, depth, text, text_col)
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        self._mark(gag, part, min(xs), min(ys), max(xs), max(ys), primary)

    def Lb(self, t, pt, depth=99, gag=None, part="label", primary=False, **kw):
        w, h = self.label(t, pt, depth, **kw)
        self._mark(gag, part, pt[0] - w // 2, pt[1] - h, pt[0] + (w - w // 2), pt[1],
                   primary)

    def hotspots(self):
        out = []
        for (gag, part), (x0, y0, x1, y1, prim) in self.parts.items():
            out.append(dict(gagId=gag, part=part, x=x0, y=y0, w=x1 - x0, h=y1 - y0,
                            primary=prim, cx=(x0 + x1) / 2, cy=(y0 + y1) / 2))
        return out


# --- small props, as blocks ------------------------------------------------------------
def balloon(sc: V, u, v, col, depth, z=40, gag="G6.1", primary=False, part="balloon"):
    x, y = sc.g(u, v, z)
    sc.line([(x, y + 5), (x + 1, y + 14)], "outline", depth)
    sc.ellipse(x, y, 3, 4, col, depth + 0.01)
    sc._mark(gag, part, x - 4, y - 5, x + 4, y + 14, primary)


def fan(sc: V, c, r, dx=0, dy=0, depth=None, **tag):
    return sc.T("box-fan", c, r, dx=dx, dy=dy, depth=depth, **tag)


# ======================================================================================
# GROUND: lobby, closet, sales pit
# ======================================================================================
def ground(sc: V):
    """Screen targets were planned first (>= 50 px apart where the geography allows),
    then props placed under them; the -hot.png overlays show the result."""
    room_shell(sc, 0, 0, C, R, door_rows=(8,), win_rows=(3,), win_cols=(5, 8, 10),
               closet=(0, 0, 1, 1))
    # --- closet (G1.1) ------------------------------------------------------------
    sc.T("closet-shelf", 0, 0, depth=0.6, gag="G1.1", part="closet")
    sc.T("mop-bucket", 0, 1, depth=1.5)
    fan(sc, 1, 1, dx=-10, dy=-3, depth=2.2, gag="G1.1", part="closet")
    sc.T("partition-c", 0, 1, depth=2.05)
    sc.T("partition-c", 1, 1, depth=3.05)
    sc.T("partition-r-door-open", 1, 0, depth=2.5)
    sc.T("partition-r-end", 1, 1, depth=3.1)
    # --- G5.3 (360): the closet overflows -- tower MAIN SERVER, second fan, and the
    # worker whose touch freezes the room, just outside the closet front
    if sc.on("G5.3"):
        u, v = 1.1, 3.6
        sc.Bx(u - 0.3, v - 0.3, u + 0.2, v + 0.2, 20, "chair-mid", "chair-dark",
              "monitor-frame", depth=u + v, gag="G5.3", part="tower")
        sc.F("box-fan", "default", u + 0.2, v - 0.9, depth=u + v - 0.8, gag="G5.3",
             part="tower")
        sc.W("a", "idle-left", u + 0.75, v + 0.55, gag="G5.3", part="tower")
        sc.Lb("MAIN SERVER", sc.g(u - 0.05, v - 0.05, 26), depth=40, gag="G5.3",
              part="tower")
    # --- lobby: sofa + visitor (G2.3); the front door at row 8 (G4.1, 610) --------------
    sc.T("sofa", 0, 5, depth=6.5)
    sc.F("visitor", "default", 0.95, 6.05, depth=6.9, gag="G2.3", part="visitor")
    sc.Lb("VISITOR", sc.g(0.9, 6.0, 34), gag="G2.3", part="visitor")
    sc.T("plant", 0, 7, depth=7.4)
    if sc.on("G4.1"):
        sc.W("a", "idle-right", 0.8, 8.55, depth=9.3, gag="G4.1", part="door")
        sc.Bx(0.95, 8.2, 1.2, 8.45, 6, "paper", "paper", "wall-shadow", z=10,
              depth=9.4, gag="G4.1", part="door")
        sc.Lb("AUDITOR", sc.g(0.8, 8.55, 30), gag="G4.1", part="door")
    # --- G3.2 trolley beside the closet; CEO desk + retail box -----------------------
    if sc.on("G3.2"):
        sc.T("trolley", 3, 0, gag="G3.2", part="trolley")
        im, a, pts = sprite("trolley")
        base = sc.at(3, 0)
        sc.P("note-dave", "default", (base[0] - a[0] + pts["note"][0],
                                      base[1] - a[1] + pts["note"][1]), 4.05,
             gag="G3.2", part="trolley")
        sc.T("desk-retail-box", 11, 0, gag="G3.2", part="box", primary=False)
    # --- DEV desk + queue (G2.1) --------------------------------------------------
    sc.T("desk-dev", 6, 0, gag="G2.1", part="queue")
    sc.S("b", 6, 0)
    queue = [("c", "idle"), ("a", "laptop"), ("e", "idle"), ("d", "idle"), ("b", "idle"),
             ("c", "idle")]
    for i, (look, kind) in enumerate(queue):
        u, v = 7.4 + i * 0.62, 1.7
        if kind == "laptop":
            sc.F("worker-queue", f"{look}-left", u, v, gag="G2.1", part="queue")
        else:
            sc.W(look, "idle-left", u, v, gag="G2.1", part="queue")
    # --- sales pit desks: post-its (G1.2) ----------------------------------------------
    pit = [(4, 3), (6, 4), (8, 3), (4, 5)]
    for (c, r) in pit:
        if (c, r) != (6, 4):
            sc.T("desk-postit", c, r, gag="G1.2", part="notes", primary=False)
    sc.T("desk-postit", 6, 4, gag="G1.2", part="peel")
    sc.S("a", 4, 3)
    sc.S("d", 8, 3)
    sc.S("c", 4, 5)
    sc.T("worker-peel", 6, 4, frame="e", depth=11.01, gag="G1.2", part="peel")
    if sc.on("G4.1"):
        # G4.1 part 2: a pit worker's $ thought-bubble going grey
        x, y = sc.at(8, 3)
        sc.Lb("$", (x - 4, y - 34), gag="G4.1", part="pit", primary=False,
              bg="wall-shadow")
    if sc.on("G5.6"):
        for (c, r) in [(4, 3), (8, 3)]:
            x, y = sc.at(c, r)
            sc.rect(x - 12, y - 16, x - 8, y - 13, "badge-body", c + r + 1.02)
            sc._mark("G5.6", "drives-hq", x - 12, y - 16, x - 8, y - 13, False)
    # --- floor cable + CAUTION + the step-over (G2.2) ---------------------------------
    for r in range(2, 7):
        sc.T("cable-floor-r", 2, r, depth=r + 2.0, gag="G2.2", part="cable",
             primary=False)
    sc.T("cable-floor-turn", 2, 7, depth=9.0, gag="G2.2", part="cable", primary=False)
    for c in range(3, C):
        sc.T("cable-floor-c", c, 7, depth=c + 7.0, gag="G2.2", part="cable",
             primary=False)
    sc.T("sign-caution", 6, 7, dx=-10, dy=-2, depth=13.6, gag="G2.2", part="step")
    sc.W("c", "step-right", 7.3, 7.55, gag="G2.2", part="step")
    # --- G3.1 the empty desk, front row (490) --------------------------------------
    if sc.on("G3.1"):
        sc.T("desk", 10, 8, gag="G3.1", part="desk")
        sc.S("e", 10, 8, gag="G3.1", part="desk")
        x, y = sc.at(10, 8)
        sc.line([(x + 14, y - 26), (x + 14, y - 40)], "outline", 19.2)
        sc.ellipse(x + 14, y - 44, 4, 5, "badge-red", 19.3)
        sc.Lb("WELCOME!", (x + 14, y - 49), gag="G3.1", part="desk", primary=False)
        sc._mark("G3.1", "desk", x + 9, y - 49, x + 19, y - 26, True)
    # --- G5.4 the phone bill: call-centre row on the right (360) ---------------------
    if sc.on("G5.4"):
        for r in (3, 5):
            sc.T("desk", 11, r, gag="G5.4", part="phones")
        sc.S("b", 11, 5, gag="G5.4", part="phones")
        sc.W("a", "idle-right", 10.5, 4.2, gag="G5.4", part="phones")
        x, y = sc.at(11, 3)
        sc.rect(x + 2, y - 26, x + 9, y - 21, "chair-dark", 15.2)   # desk phone
        sc.line([(x + 9, y - 22), (x + 18, y - 34), (x + 6, y - 40)], "outline", 15.3)
        sc.Lb("25C", (x - 2, y - 34), gag="G5.4", part="phones", primary=False)
    # --- G7.1 the unvetted robot, front-left of the pit (750) --------------------------
    if sc.on("G7.1"):
        u, v = 4.2, 7.6
        sc.Bx(u - 0.3, v - 0.3, u + 0.3, v + 0.3, 12, "badge-body", "wall-trim",
              "chair-mid", depth=u + v + 0.3, gag="G7.1", part="robot")
        sc.Bx(u - 0.25, v - 0.25, u + 0.25, v + 0.25, 8, "wall-trim", "badge-body",
              "chair-mid", z=12, depth=u + v + 0.31, gag="G7.1", part="robot")
        x, y = sc.g(u, v, 20)
        sc.rect(x - 2, y - 2, x + 2, y, "monitor-screen", u + v + 0.32, outline=None)
        sc.Lb("UNVETTED", sc.g(u, v, 34), gag="G7.1", part="robot")
        sc.Bx(u + 0.35, v - 0.3, u + 0.75, v + 0.1, 4, "paper", "paper", "wall-shadow",
              z=6, depth=u + v + 0.33, gag="G7.1", part="robot")   # CONFIDENTIAL stack
    # --- G6.1 SaaS balloons over every head (750) -----------------------------------
    if sc.on("G6.1"):
        cols = ["badge-red", "sticky", "badge-green", "shirt-1", "net", "glass-dark"]
        heads = [(5.0, 4.0), (9.0, 5.0), (5.0, 6.0), (7.4, 1.7), (9.3, 1.7),
                 (10.5, 4.2), (2.0, 3.85), (12.0, 6.0)]
        for i, (u, v) in enumerate(heads):
            balloon(sc, u, v, cols[i % len(cols)], u + v + 1.5, z=44)
        # the primary: two almost-identical balloons over the CEO's corner
        balloon(sc, 11.4, 1.3, "shirt-1", 14.0, z=52, primary=True, part="twins")
        balloon(sc, 11.75, 1.3, "shirt-1-dark", 14.01, z=50, primary=True, part="twins")
    return sc


# ======================================================================================
# FLOOR 2: finance corner, glass meeting room, corridor
# ======================================================================================
def floor2(sc: V):
    room_shell(sc, 0, 0, C, R, win_rows=(2,), win_cols=(3,))
    b = sc.band
    # --- finance corner, back-left ------------------------------------------------
    FIN = (1, 2)
    if sc.on("G4.2"):
        sc.T("desk", *FIN)
        sc.T("fishing-line", *FIN, depth=sum(FIN) + 1.005, gag="G4.2", part="hook")
        sc.T("worker-reach", *FIN, frame="a", depth=sum(FIN) + 1.01, gag="G4.2",
             part="hook")
    if sc.on("G6.2"):
        # the renewal avalanche: a slope of paper burying the corner, a hand with a pen
        sc.Bx(0.1, 4.0, 2.4, 6.2, 10, "paper", "wall", "wall-shadow", depth=7.0,
              gag="G6.2", part="pile")
        sc.Bx(0.3, 4.3, 1.8, 5.6, 8, "paper", "wall", "wall-shadow", z=10, depth=7.1,
              gag="G6.2", part="pile")
        x, y = sc.g(1.1, 5.0, 22)
        sc.rect(x, y - 5, x + 2, y, "skin-1", 7.2)
        sc.Lb("AUTO-RENEWED", sc.g(1.2, 5.1, 30), depth=99, gag="G6.2", part="pile")
    if sc.on("G4.3"):
        sc.T("desk-sheet", 5, 3, gag="G4.3", part="crm")
        sc.S("e", 5, 3)
        sc.T("desk-turned-sheet", 4, 4, gag="G4.3", part="crm")
        sc.S("a", 4, 4, turned=True)
        sc.F("worker-printouts", "c", 5.62, 4.62, gag="G4.3", part="crm")
        sc.Lb("CUSTOMERS", sc.g(5.2, 3.4, 30), depth=98, gag="G4.3", part="crm")
    # --- glass meeting room, back-right: c 6..11, r 0..3 ---------------------------------
    if sc.on("G2.4"):
        # low glass cutaway walls (front + left)
        sc.Bx(6.0, 3.8, 12.0, 4.0, 7, "glass-highlight", "glass", "glass-dark",
              depth=15.5)
        sc.Bx(6.0, 0.0, 6.2, 3.8, 7, "glass-highlight", "glass", "glass-dark",
              depth=9.9)
        # table, the huddle round one laptop, the TV with the dongle + frozen face
        sc.Bx(8.4, 1.4, 10.6, 2.6, 8, "desk-wood", "desk-wood", "desk-wood-dark",
              depth=12.5)
        for (u, v, look, fr) in [(8.2, 1.2, "a", "idle-right"), (8.9, 1.1, "d", "idle-down"),
                                 (9.6, 1.1, "b", "idle-down"), (10.3, 1.3, "e", "idle-left")]:
            sc.W(look, fr, u, v, gag="G2.4", part="huddle")
        sc.Bx(9.0, 0.05, 10.8, 0.25, 16, "monitor-frame", "monitor-frame", "chair-dark",
              z=18, depth=10.0, gag="G2.4", part="huddle")
        x, y = sc.g(10.0, 0.2, 26)
        sc.rect(x - 4, y - 4, x + 3, y + 2, "skin-2", 10.1, outline=None)
    if sc.on("G7.3a"):
        sc.Bx(6.6, 0.05, 8.4, 0.25, 18, "paper", "paper", "wall-shadow", z=12, depth=9.0,
              gag="G7.3a", part="board")
        sc.Lb("FEATURE\nREQUESTS", sc.g(7.5, 0.2, 42), depth=97, gag="G7.3a",
              part="board")
        sc.W("c", "idle-right", 6.9, 2.9, gag="G7.3a", part="board")
        sc.W("b", "idle-left", 8.1, 3.4, gag="G7.3a", part="board")
    # --- corridor along the front ---------------------------------------------------
    if sc.on("G3.3"):
        # org chart poster on the left wall at rows 6-7
        x, y = sc.g(0.02, 7.0, 36)
        sc.line([(x, y), (x - 28, y + 14)], "outline", 50)
        p0, p1 = sc.g(0.02, 6.0, 34), sc.g(0.02, 8.0, 14)
        sc.box(0.0, 6.2, 0.05, 7.9, 20, "paper", "paper", "paper", z=14, depth=0.5)
        sc._mark("G3.3", "chart", p1[0], p0[1] - 4, p0[0], p1[1] + 4, True)
        sc.Lb("ORG", sc.g(0.02, 7.1, 38), depth=96, gag="G3.3", part="chart")
    if sc.on("G7.4"):
        sc.W("d", "idle-right", 3.3, 7.6, gag="G7.4", part="chain")
        sc.W("a", "idle-right", 4.1, 7.2, gag="G7.4", part="chain")
        sc.W("e", "idle-right", 4.9, 6.8, gag="G7.4", part="chain")
        sc.Bx(5.6, 6.0, 6.3, 6.6, 20, "badge-body", "wall-trim", "chair-mid",
              depth=12.9, gag="G7.4", part="chain")
        sc.Lb("V3?", sc.g(3.3, 7.6, 30), depth=96, gag="G7.4", part="chain")
    if sc.on("G7.3"):
        u, v = 9.4, 6.6
        sc.W("a", "down", u, v, gag="G7.3", part="hats")
        x, y = sc.g(u, v, 23)
        cols = ["badge-red", "sticky", "badge-green", "shirt-1", "net"][: 5 if b < 360
                                                                         else 5]
        for i, col in enumerate(cols):
            sc.rect(x - 5, y - 3 - i * 4, x + 4, y - i * 4, col, u + v + 0.1 + i * 0.001)
        sc._mark("G7.3", "hats", x - 6, y - 24, x + 5, y + 24, True)
        sc.Lb("HATS", sc.g(u, v, 50), depth=96, gag="G7.3", part="hats")
    if sc.on("G6.1"):
        for (u, v, col) in [(3.8, 5.2, "sticky"), (4.6, 4.8, "net"), (9.6, 1.6, "badge-red")]:
            balloon(sc, u, v, col, u + v + 1.5, z=44)
    return sc


# ======================================================================================
# TOP: the boardroom (750)
# ======================================================================================
def top(sc: V):
    room_shell(sc, 0, 0, C, R, win_rows=(2, 5), win_cols=(3, 6, 9))
    # glass boardroom in the middle: c 4..9, r 2..6
    sc.Bx(4.0, 6.8, 10.0, 7.0, 7, "glass-highlight", "glass", "glass-dark", depth=16.5)
    sc.Bx(4.0, 2.0, 4.2, 6.8, 7, "glass-highlight", "glass", "glass-dark", depth=10.5)
    sc.Bx(5.6, 3.6, 8.4, 5.4, 8, "desk-wood", "desk-wood", "desk-wood-dark", depth=13.0,
          gag="G7.2", part="table")
    seats = [(5.3, 3.6, "a", "idle-right"), (5.3, 4.8, "c", "idle-right"),
             (6.6, 3.2, "d", "idle-down"), (7.8, 3.2, "b", "idle-down"),
             (8.7, 4.4, "e", "idle-left")]
    for (u, v, look, fr) in seats:
        sc.W(look, fr, u, v, gag="G7.2", part="table")
    # the empty chair, front, nameplate TECHNOLOGY
    sc.Bx(7.0, 5.6, 7.6, 6.2, 10, "chair-mid", "chair-dark", "chair-dark", depth=13.9,
          gag="G7.2", part="table")
    sc.Lb("TECHNOLOGY", sc.g(7.3, 5.9, 18), depth=98, gag="G7.2", part="table")
    sc.Bx(5.0, 2.05, 8.0, 2.25, 18, "paper", "paper", "wall-shadow", z=12, depth=8.0,
          gag="G7.2", part="table", primary=False)
    sc.Lb("NEXT 3 YEARS", sc.g(6.5, 2.2, 40), depth=97)
    sc.T("plant", 0, 8, depth=8.4)
    sc.T("plant", 11, 0, depth=11.4)
    if sc.on("G6.1"):
        for (u, v, col) in [(10.5, 1.2, "sticky"), (2.0, 3.5, "badge-green")]:
            balloon(sc, u, v, col, u + v + 1.5, z=50)
    return sc


# ======================================================================================
# STREET: HQ exterior, road, inset office, (610) shell + truck, (490+) map
# ======================================================================================
def exterior(sc: V, u0, v0, u1, v1, floors, storey=14, z0=0, depth=50.0, door_u=None,
             gag=None, part="main", primary=False, roof=True):
    """An HQ block at diorama scale: one box per storey, a window band on each face."""
    for f in range(floors):
        z = z0 + f * storey
        sc.box(u0, v0, u1, v1, storey, "wall-trim", "wall", "wall-shadow", z=z,
               depth=depth + f * 0.01)

        def win(f=f, z=z):
            d = ImageDraw.Draw(sc.im)
            # left (+v) face: windows along u
            n = int((u1 - u0) * 2)
            for i in range(n):
                a = u0 + (i + 0.25) / n * (u1 - u0)
                bb = u0 + (i + 0.75) / n * (u1 - u0)
                q = [sc.g(a, v1, z + 4), sc.g(bb, v1, z + 4), sc.g(bb, v1, z + 10),
                     sc.g(a, v1, z + 10)]
                d.polygon(q, fill=rgb("glass"), outline=rgb("glass-dark"))
            n = int((v1 - v0) * 2)
            for i in range(n):
                a = v0 + (i + 0.25) / n * (v1 - v0)
                bb = v0 + (i + 0.75) / n * (v1 - v0)
                q = [sc.g(u1, a, z + 4), sc.g(u1, bb, z + 4), sc.g(u1, bb, z + 10),
                     sc.g(u1, a, z + 10)]
                d.polygon(q, fill=rgb("glass-dark"), outline=rgb("outline"))
        sc._add(depth + f * 0.01 + 0.005, win)
    if door_u is not None:
        sc.box(door_u - 0.3, v1 - 0.02, door_u + 0.3, v1, 11, "chair-dark", "chair-dark",
               "chair-dark", z=z0, depth=depth + 0.5)
    if gag:
        pts = [sc.g(u0, v0, z0 + floors * storey), sc.g(u1, v1, z0), sc.g(u0, v1, z0),
               sc.g(u1, v0, z0)]
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        sc._mark(gag, part, min(xs), min(ys), max(xs), max(ys), primary)


def inset_room(sc: V, c0, r0, cols, rows):
    room_shell(sc, c0, r0, cols, rows, win_rows=(r0 + 1,), win_cols=(c0 + 1, c0 + 3))
    c1, r1 = c0 + cols - 1, r0 + rows - 1
    for c in range(c0, c1 + 1):
        sc.T("partition-c-end" if c == c1 else "partition-c", c, r1, depth=c + r1 + 1.95)
    for r in range(r0, r1 + 1):
        n = "partition-r-doorway" if r == r1 - 1 else "partition-r"
        if r == r1:
            n = "partition-r-end"
        sc.T(n, c1, r, depth=c1 + r + 1.95)


def street(sc: V, hq=True):
    """hq=False: option B, where the stack above *is* HQ; only its door is drawn."""
    b = sc.band
    # ground: a pavement of floor tiles is too loud; leave the sky/ground as the page
    # HQ block at the right, door on its front-left face
    hq_u0, hq_v0, hq_u1, hq_v1 = 7.0, 0.0, 11.0, 3.0
    # road from HQ's door down +r, then along -c to the inset's door
    road = [(8, r, "road-r") for r in range(3, 7)] + [(8, 7, "road-turn")] + \
           [(c, 7, "road-c") for c in range(7, 5, -1)]
    for (c, r, n) in road:
        sc.T(n, c, r, depth=0.1)
    # inset office: tiles (1..4, 5..8), door on its front-right edge at row 7
    inset_room(sc, 0, 5, 5, 3)
    if hq:
        exterior(sc, hq_u0, hq_v0, hq_u1, hq_v1, FLOORS[b], z0=0, depth=30.0, door_u=8.5)
    else:
        exterior(sc, hq_u0, hq_v0, hq_u1, hq_v1, 1, z0=0, depth=30.0, door_u=8.5)
    if sc.on("G5.1"):
        sc.F("worker-give", "e-left", 8.95, 3.45, depth=30.5, gag="G5.1",
             part="hq-door", primary=False)
        sc.F("courier", "right", 8.35, 4.3, depth=30.6, gag="G5.1", part="hq-door",
             primary=False)
        sc.T("truck", 8, 5, dy=4, depth=14.5, gag="G5.1", part="truck")
        sc.F("worker-watch", "b", 5.3, 7.1, depth=13.0, gag="G5.1", part="inset-door",
             primary=False)
        sc.T("desk", 2, 5, depth=8.0)
    if sc.on("G6.4"):
        # the inset door: a badge that doesn't, the next door propped with a chair
        sc.F("badge-reader", "red", 5.05, 6.2, depth=12.0, gag="G6.4", part="door")
        sc.W("d", "idle-up", 5.45, 6.4, depth=12.1, gag="G6.4", part="door")
    if sc.on("G5.2"):
        # far wing: workers holding phones up, one on a chair; router on a cabinet
        for (u, v, look) in [(0.6, 6.6, "a"), (1.3, 6.9, "c"), (0.9, 7.5, "e")]:
            sc.W(look, "idle-down", u, v, gag="G5.2", part="phones")
            x, y = sc.g(u, v, 27)
            sc.rect(x - 1, y - 3, x + 1, y, "monitor-screen", u + v + 0.1, outline=None)
    if sc.on("G5.6"):
        # the consumer NAS on the windowsill and FINAL drives on the desk
        sc.Bx(2.0, 5.05, 2.4, 5.4, 9, "chair-mid", "chair-dark", "monitor-frame", z=10,
              depth=7.0, gag="G5.6", part="nas")
        sc.Lb("FINAL2", sc.g(2.2, 5.2, 26), depth=95, gag="G5.6", part="nas")
    if sc.on("G2.4"):
        # the inset office's frozen face on its back wall (G2.4's second part)
        x, y = sc.g(3.6, 5.02, 22)
        sc.rect(x - 6, y - 5, x + 6, y + 3, "monitor-frame", 7.0)
        sc.rect(x - 3, y - 3, x + 3, y + 1, "skin-2", 7.01, outline=None)
        sc._mark("G2.4", "inset", x - 6, y - 5, x + 6, y + 3, False)
    if sc.on("G6.3"):
        # the empty shell with its banner and the moving truck, back-left
        sc.Bx(1.0, 0.5, 4.0, 2.5, 26, "wall-trim", "wall", "wall-shadow", depth=4.0,
              gag="G6.3", part="shell")
        sc.Lb("100,000 SQ FT", sc.g(2.5, 2.5, 20), depth=90, gag="G6.3", part="shell",
              bg="sticky")
        sc.T("truck", 4, 3, dy=2, depth=7.5, gag="G6.3", part="shell")
        sc.W("b", "idle-down", 2.6, 3.0, depth=6.2, gag="G6.3", part="shell")
    return sc


def map_overlay(sc: V, x, y, w=84, h=50):
    """(490+) the map: an overlay sprite in a corner, each pin a placement tagged G6.3."""
    pins_by_year = [(80, 0.72, 0.28), (150, 0.46, 0.34), (490, 0.40, 0.46),
                    (610, 0.30, 0.66), (610, 0.70, 0.42), (610, 0.62, 0.50)]
    sc.rect(x, y, x + w - 1, y + h - 1, "paper", 200)
    sc.rect(x + 3, y + 3, x + w - 4, y + h - 4, "glass", 200.01, outline="glass-dark")
    # a crude landmass
    sc.rect(x + 8, y + 9, x + w - 10, y + h - 9, "floor-top", 200.02, outline=None)
    for i, (yr, fx, fy) in enumerate(pins_by_year):
        if sc.band >= max(yr, 490 if i < 3 else 610):
            px, py = x + int(fx * w), y + int(fy * h)
            sc.rect(px - 1, py - 4, px + 1, py - 2, "badge-red", 200.1 + i * 0.001)
            sc.line([(px, py - 1), (px, py)], "outline", 200.1)
            if sc.on("G6.3"):
                sc._mark("G6.3", f"pin-{i}", px - 2, py - 5, px + 2, py + 1, False)
