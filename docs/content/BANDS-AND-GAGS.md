# Bands and gags — DRAFT v2 (evidence round 1 applied, 2026-09-16)

Seven bands. The slider snaps between them; the readout shows the band's range. Each gag
has: **See** (what the pixels show) · **Where** (placement in the building) · **Is** (the
real problem, for the panel) · **Built** (what replaces it when the switch flips) ·
**Receipt** (`E-xx` from `EVIDENCE.md`). Gags marked **HELD** need a Josh answer before
they can ship. Panel copy is drafted after this list is approved; the voice is in
`TONE.md`.

Anchors in Josh's history, so bands align to real receipts (`TIMELINE.md`):
- **~80 people, 2018** — the current employer day one. Band 2. Confirmed.
- **300+ people, nine buildings** — the previous employer (2011–2017). Band 5.
- **750+ people, six offices, 29 VC rooms in five cities** — the current employer today. Band 7.
- the current employer's 2019–2025 hires need a headcount-by-year to land in bands 3–6 (**Q-10**).

The building's fixed geography, used by every band: **the closet** (back corner, ground
floor) · **the front door** (badge reader lives here) · **the sales pit** (open floor,
ground) · **the finance corner** (first floor) · **the conference room** (glass, first
floor) · **the roof** (power, solar) · **the top floor** (exec meeting, appears band 6) ·
**outside** (street, truck, second building, other cities).

**Naming (D-014):** these notes say "the current employer" freely; *panel copy never does* — it uses the
descriptor in `TONE.md`. Total: 25 gags + 1 ambient, + 1 proposed (G5.6). Cap is 28 (G-02). G7.4 cut (D-011).

---

## Band 1 · 25–60 · *Before the function*

Four desks become twelve. One floor. The company has never had an IT person and doesn't
think it needs one yet. the current employer was already ~80 when Josh arrived, so this band is what the
*day before* looked like, inferred from what he found; it exists so the visitor can find
their past.

### G1.1 · The closet
- **See:** the "server room" is a supply closet. A router on a shelf next to the paper
  towels, a box fan pointed at it, a nest of cables. A worker opens the door and a cable
  falls out.
- **Where:** the closet.
- **Is:** consumer-grade gear, no rack, no cooling, no separation from the cleaning
  supplies. It works until the day it doesn't, and that day is a Monday.
- **Built:** a real, small, boring rack. Managed switch, proper APs, a label maker has been
  used. Cloud identity means the rack is *small* — this is the day-one decision that made
  every later office cheap.
- **Receipt:** E-01.

### G1.2 · Password post-its
- **See:** a yellow sticky note on every monitor. One worker is peeling a note off a
  colleague's screen to log in.
- **Where:** the sales pit, every desk.
- **Is:** no identity provider. Shared logins, personal Gmail forwarding, the offboarding
  process is "hope".
- **Built:** the notes are gone. A tiny padlock icon on each monitor (SSO + MFA). One
  worker taps a phone to log in.
- **Receipt:** E-01.

### G1.3 · The founder's credit card
- **See:** laptops arriving in an online-retailer box, delivered to the CEO's desk; the CEO
  is signing for it while on a call.
- **Where:** front door → the corner office.
- **Is:** procurement is a personal card and a spreadsheet nobody updates. No asset
  register, no standard build, no idea what's on what.
- **Built:** a small IT desk near the door with a shelf of identical laptops, each with a
  tag.
- **Receipt:** E-24 (confirmed: laptops on credit cards). Ships.

---

## Band 2 · 60–120 · *The developer who became IT*

Two floors. Thirty desks, then sixty. This is the band the current employer's IT function was born in —
~80 people, 2018, one Support hire, and a move from ~9k to ~22k sq ft in the same year.
Somebody technical has become IT by accident and it is costing the company that person's
real job.

### G2.1 · The queue at DEV
- **See:** a desk whose monitor reads `DEV`. Six people in a line behind it, one holding a
  laptop over their head like a broken appliance. The developer's own screen is a half-
  finished pull request.
- **Where:** the sales pit, the desk nearest the closet.
- **Is:** the engineer who "knows computers" is the helpdesk, the admin, and the on-call.
  The visible cost is a queue; the real cost is engineering velocity.
- **Built:** the queue is gone. A two-person support desk with an SLA board (`Open: 3 ·
  Avg: 1h`), and the developer's screen is code again.
- **Receipt:** E-02, E-22 (confirmed: first Support hire 2018 at ~80). Ships with the date.

### G2.2 · The ceiling cable
- **See:** an ethernet cable running along the floor between desks, held down with tape
  and a small yellow `CAUTION` sign. A worker steps over it every few seconds.
- **Where:** the sales pit, floor.
- **Is:** no structured cabling; the network is whatever reached. The next office move
  repeats this at scale unless someone plans for it.
- **Built:** the cable retracts into the ceiling. A patch panel appears in the (now real)
  closet. The caution sign is gone.
- **Receipt:** E-05.

### G2.3 · The guest Wi-Fi is the Wi-Fi
- **See:** a visitor with a `VISITOR` sticker on a sofa by the front door, laptop glowing;
  a dotted line from their laptop to the closet and every desk.
- **Where:** front door lobby.
- **Is:** one flat network. Guests, printers, the finance PC and the CEO's laptop are all
  neighbours.
- **Built:** the dotted line stops at a small firewall box in the closet. The visitor still
  has Wi-Fi; it just goes nowhere interesting.
- **Receipt:** E-06 (confirmed: Palo Alto NGFW at the edge — the box is a Palo Alto). Ships.

### G2.4 · The dongle meeting
- **See:** four people huddled around one laptop, pointed at a wall-mounted TV with a
  dangling dongle. A fifth person on the screen is a frozen face.
- **Where:** the conference room.
- **Is:** no AV standard. Every meeting starts with ten minutes of cables.
- **Built:** a proper room: camera bar, a small touch panel, everyone sitting down, the
  remote face is moving.
- **Receipt:** E-05, E-25 (confirmed: 2 rooms in 2018 → 29 across five cities). The panel
  receipt is "two rooms, then twenty-nine." Ships.

---

## Band 3 · 120–200 · *The onboarding wall*

Three floors. Hiring is now the company's main activity, and every new person exposes the
absence of a system.

### G3.1 · The empty desk
- **See:** a new hire sitting at a bare desk with their coat still on. Above their head a
  wall calendar flips pages. A `WELCOME!` balloon slowly deflates.
- **Where:** the sales pit, front row.
- **Is:** onboarding takes weeks because it is a person, not a process. Accounts are
  created by hand, laptops ordered when someone remembers.
- **Built:** the desk has a laptop, a badge and a coffee. The calendar shows one page.
- **Receipt:** E-03 (confirmed: Systems & Automation Engineer 2022; SSO/SCIM, JML,
  provisioning). **No before/after number exists and none will be implied** (E-21). The
  panel describes the function; it does not quantify it. Ships.

### G3.2 · The shopping cart
- **See:** a supermarket trolley full of laptops parked by the closet. No one knows whose
  they are. One has a sticky note: `DAVE? (LEFT 2023)`.
- **Where:** beside the closet.
- **Is:** no asset management, no endpoint management. Offboarding returns a laptop to a
  trolley and the data on it to fate.
- **Built:** the trolley is a shelf; each laptop has a tag and a small green light
  (managed, encrypted, wipeable).
- **Receipt:** E-19 (confirmed: Intune 2019 for Windows + mobile; Jamf and Zebra later). Ships.

### G3.3 · The org chart with one box
- **See:** a wall poster of the org chart. Every department is a tree; IT is one box, off
  to the side, with a dotted line to Finance. The box has one very tired sprite in it.
- **Where:** first-floor corridor wall.
- **Is:** IT is a single point of failure reporting into whoever signs the invoices. No
  leadership layer, no on-call rotation, no succession.
- **Built:** the box becomes a small tree — Infrastructure, Security, Support — and the
  line goes to Technology, not Finance.
- **Receipt:** E-02, E-13.

### G3.A · The 3:47am window *(ambient, all bands, R-13)*
- **See:** at night, one window lights up; a sprite in pyjamas at a laptop. In the built
  state a *different* window lights up each night — it's a rotation.
- **Receipt:** none needed; decorative.

---

## Band 4 · 200–300 · *The auditor at the door*

Four floors. The first enterprise customers. The company's problems stop being internal.

### G4.1 · The auditor turned away
- **See:** a figure in a suit with a clipboard labelled `AUDITOR` at the front door; the
  door is shut. In the sales pit, a worker's `$` thought-bubble fades to grey.
- **Where:** front door + sales pit (two-part gag; both must be visible).
- **Is:** the first SOC 2 / ISO 27001 request, from procurement, on the biggest deal so
  far. No program, no policies, nobody whose job it is.
- **Built:** the door is open, a handshake, and a first-floor desk with a nameplate
  (`InfoSec`) and a binder.
- **Receipt:** E-04 (confirmed: InfoSec Manager 2023; Security Analyst 2025). Still want the
  *trigger* for the "when it hits" line — nice-to-have, not blocking. Sample panel in
  `TONE.md` needs its year filled in. Ships.

### G4.2 · The fish
- **See:** a fishing line dangles from the ceiling in front of a worker's monitor with an
  envelope on the hook. The worker is reaching for it.
- **Where:** finance corner (the CFO's inbox is the target, always).
- **Is:** phishing, and no email security or awareness training between the attacker and
  the wire transfer.
- **Built:** the hook comes down and hits a small shield; the fish swims off. The worker
  has a `REPORT` button on screen.
- **Receipt:** E-20 (confirmed: annual security training from 2019). The fix is framed as
  training + reporting unless Josh names a tool. Ships.

### G4.3 · Two CRMs
- **See:** two workers back-to-back at adjacent desks, each with a spreadsheet titled
  `CUSTOMERS (real)`. A third worker between them holding both printouts, looking from one
  to the other.
- **Where:** sales pit / finance corner boundary.
- **Is:** departments bought their own systems. Sales, Finance and Ops each have a source
  of truth, and month-end is a reconciliation project.
- **Built:** one screen, a pipeline flowing between `CRM → ERP → HRIS` icons; the middle
  worker is sitting down.
- **Receipt:** E-08.

---

## Band 5 · 300–500 · *The second building* — topology fork begins (R-09)

The site outgrows one building. Josh has done both shapes: a nine-building campus
(the previous employer) and offices in six cities (the current employer). The slider grows a second building
next door (`campus`) or a smaller building in a different city, inset (`offices`).
G5.1–G5.4 are campus-flavoured but work for both with minor prop changes; G5.5 is
offices-only.

### G5.1 · The USB courier
- **See:** a worker walking the path between the two buildings carrying a USB stick above
  their head like a torch. They pass another worker walking the other way with a different
  USB stick.
- **Where:** outside, between buildings.
- **Is:** no site-to-site link, no shared storage. The network between buildings is a
  person.
- **Built:** a blinking link between the buildings (fiber run drawn along the path); the
  couriers are sitting at desks.
- **Receipt:** E-23 (confirmed: private fiber between the nine buildings). **Not** E-11 —
  the +33% capacity was WAN and must not be attached to this gag. Ships.

### G5.2 · Phones in the air
- **See:** a cluster of workers on the far side of the second building holding phones up,
  one standing on a chair. A consumer router blinks sadly on a filing cabinet.
- **Where:** second building, far wing.
- **Is:** Wi-Fi dead zones; coverage is whatever someone bought at a shop.
- **Built:** ceiling APs at regular intervals; everyone sitting.
- **Receipt:** E-06 (confirmed: Ruckus and Extreme WAPs). E-11 for the campus scale only. Ships.

### G5.3 · The second fan
- **See:** the closet again, now with *two* box fans, a `DO NOT TURN OFF` sign, and a
  tower PC with a hand-written `MAIN SERVER` label. A worker touches it and everyone
  freezes.
- **Where:** the closet (callback to G1.1).
- **Is:** physical servers with no redundancy and no tested restore. Backups are a hope
  with a schedule.
- **Built:** a real rack, a small `VIRTUALISED` badge, and a second small icon offsite
  (DR). No fans.
- **Receipt:** E-09 (confirmed: VMware 2013; Commvault + DR 2015). Ships.

### G5.4 · The phone bill
- **See:** a worker at a desk phone feeding coins into it. Behind them, a wall of desk
  phones with cords tangled into a single knot that goes into the closet.
- **Where:** sales pit / call-center row.
- **Is:** legacy telecom, per-line cost, no flexibility for remote or a call center.
- **Built:** headsets, no cords, a `−33%` receipt taped to the wall.
- **Receipt:** E-10.

### G5.5 · The frozen face *(offices topology only)*
- **See:** the inset building in another city; a video wall between the two buildings
  shows a pixelated frozen face mid-sentence. A worker on each side is waving.
- **Where:** conference rooms in both buildings.
- **Is:** two sites, no collaboration standard. Every cross-office meeting is a lottery.
- **Built:** both rooms have the same kit; the face is moving; the wave is returned.
- **Receipt:** E-01, E-05, E-25 (29 rooms: Boston, Chicago, NYC, DC, Lawrence). Ships.

### G5.6 · Data everywhere *(PROPOSED — Josh to accept or reject)*
- **See:** a worker walking between buildings with a *stack of external hard drives* (a
  cousin of the USB courier), and on desks throughout, little labelled drives: `FINAL`,
  `FINAL2`, `FINAL-real`. One worker is looking under a desk for a drive.
- **Where:** everywhere, second building especially.
- **Is:** company data lives on whichever machine made it. No shared storage, no single
  copy, no backup that anyone has tested.
- **Built:** the drives are gone; a single storage icon in the (real) closet; the
  under-desk worker is sitting up.
- **Receipt:** E-09 (NetApp + centralisation of company data, 2012). This is a real thing
  Josh did that the v1 draft missed. If accepted, total becomes 26 + ambient; still ≤ 28.
  Possible fold: merge into G5.1 (the courier carries drives *and* a USB stick) if band 5
  is over budget on art.

---

## Band 6 · 500–750 · *Sprawl*

Five floors, more sites. Growth is 15–30% a year and every department has solved its own
problems in its own way. The top floor appears.

### G6.1 · SaaS balloons
- **See:** every worker has a balloon over their head with a different little logo on it.
  Two workers with balloons that are *almost* the same logo. Balloons keep drifting up
  into the ceiling.
- **Where:** everywhere.
- **Is:** shadow IT. Nobody knows what the company is paying for, twice.
- **Built:** the balloons converge into a handful of shared ones, tethered. A small
  `PORTFOLIO` board in the corridor.
- **Receipt:** E-08.

### G6.2 · The renewal avalanche
- **See:** the finance corner buried under a slope of paper; each sheet has a logo and a
  date. A hand sticks out holding a pen. A sheet on top reads `AUTO-RENEWED`.
- **Where:** finance corner.
- **Is:** contracts nobody owns, renewals nobody negotiates, licences nobody audits.
- **Built:** the pile is a tidy calendar on the wall; the finance worker is upright;
  a framed receipt on the wall reads `$500,000+ · 2024`.
- **Receipt:** E-07.

### G6.3 · The moving truck
- **See:** outside, a moving truck at a brand-new, empty building shell (`100,000 SQ FT`
  on a banner). One worker stands in the doorway holding a single ethernet cable and
  looking up.
- **Where:** outside, new site.
- **Is:** a new office with no IT plan. Cabling, access control, intrusion detection and AV
  are somebody's problem three weeks before move-in.
- **Built:** the shell has cable trays, a badge reader, a camera dome, a conference room
  with a camera bar — and the worker has a clipboard with everything ticked.
- **Receipt:** E-05, E-11.

### G6.4 · The badge that doesn't
- **See:** a worker tapping a badge at a door that stays shut; next to it, another door
  propped open with an office chair.
- **Where:** front door of the second building.
- **Is:** physical access is ad-hoc: keys, a propped door, a fob system nobody administers.
  Offboarding doesn't reach the doors.
- **Built:** the badge reader goes green; the chair is a chair again; a tiny camera dome
  over the door.
- **Receipt:** E-05.

---

## Band 7 · 750–1,000+ · *Scale and governance*

The full campus or the full map. Six floors. The company is big enough that its problems
are now about judgment, not equipment. The top floor is where the argument ends.

### G7.1 · The unvetted robot
- **See:** a cheerful little robot wandering the floor with a badge reading `UNVETTED`.
  A worker is feeding it a stack of documents labelled `CONFIDENTIAL`; the robot is
  happily eating them. Another worker is handing it the company card.
- **Where:** sales pit, open floor.
- **Is:** AI tools adopted by everyone and governed by no one. Data leaves; costs arrive;
  nobody evaluated anything.
- **Built:** the robot's badge reads `APPROVED`; it wears a tiny policy document like a
  lanyard; the documents go through a small gate first; the card is back in Finance.
- **Receipt:** E-12 (resume). Still want the year and one concrete improvement — the panel
  can ship on the resume line alone. Ships.

### G7.2 · The empty chair
- **See:** top floor, glass room, an exec meeting. Six chairs, five people, a whiteboard
  reading `NEXT 3 YEARS`. One chair is empty; its nameplate reads `TECHNOLOGY`.
- **Where:** top floor.
- **Is:** no technology voice in strategic planning. Decisions are made and IT finds out
  in the change request.
- **Built:** the chair is occupied. (This is the *only* place Josh appears, and he is
  sitting in a meeting — D-007.) Below, the floor runs without him.
- **Receipt:** E-13.

### G7.3 · Ten hats
- **See:** one IT manager wearing a stack of hats labelled `INFRA` `SEC` `SUPPORT` `DEV`
  `PRODUCT`, walking carefully.
- **Where:** first-floor corridor.
- **Is:** functions that were incubated inside IT and never handed off. The person who
  built them is now the bottleneck on all of them.
- **Built:** the hats are on five different heads. Two of them (`DEV`, `PRODUCT`) walk off
  toward their own floor. The original manager has one hat.
- **Receipt:** E-02, E-14 (confirmed: Dev incubated 2018 → handed off 2019; Product
  incubated 2020 → handed off 2021). Two hats walk off, two years apart — the animation
  can literally stagger them. Ships.

### ~~G7.4 · The board on the wall~~ — CUT (D-011)
Josh: the engagement-survey ranking stays on the paper resume and off the site.

---

## Trim candidates if we're over budget on art

In order: G5.6 (fold into G5.1), G1.3 (band 1 works with two gags), G5.5 (offices-only;
could fold into G2.4 at scale), G3.2.

## Questions this draft raises for Josh

Round 1 answered the receipts. Still open:
- **Q-10** — rough headcount per year at the current employer 2019–2025, so the 2019 Intune / 2022
  automation / 2023 security+network hires land in the right bands. Right now they are
  placed by narrative, not by number.
- **G5.6** — accept, fold into G5.1, or reject?
- Two or three gags from your own history that are *missing* — the thing that actually
  went wrong that you still tell people about. Those beat anything I inferred.
