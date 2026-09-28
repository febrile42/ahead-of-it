# Panels — DRAFT v4 (2026-09-24: every factual mark resolved; Beyond band added)

Final copy for every hotspot, in the `TONE.md` voice: **Already** (dated, numbered, first
person, past tense) → **What it prevented** (second person, honest confidence) → **Worth it
later** (only where a real later receipt exists). ≤ 110 words each, excluding the strip.
Every panel ends with the single contact line (R-12) — omitted below.

**The strip (new, R-04a):** every panel opens with a fixed metadata line —
`YEAR · ~HEADCOUNT · COMPANY DESCRIPTOR` — rendered by the UI, not written into prose.
Panels are opened in arbitrary order, so every panel is somebody's first; the strip makes
each one self-identifying without spending words. Descriptors (D-014): current company =
*a clean-energy company, now $3B+*; previous = *a $200M company, nine-building campus*.

No open fact questions remain: every one was answered 2026-09-24 and folded in. The answers
are in `EVIDENCE.md` (E-01…E-30) and `TIMELINE.md`.

**Review disposition** (panel review, 2026-09-16): 10 blockers → 8 fixed, 2 pushed
back (see end). Both doc-wide rules (descriptor in every panel; second-person prevention
beat) applied. Protected sentences untouched.

---

## 80 · 2018

### G1.1 · Identity in the cloud, from day one
`2018 · ~80 · a clean-energy company, now $3B+`
**Already:** In 2018, at ~80 people, I put identity and email in the cloud on day one —
Microsoft 365 and Azure — and designed the platform for elastic scale, geographic
expansion and capex-light operations. The alternative was a server room; I chose not to
have one.

**What it prevented:** at 80 your "server room" is a supply closet with a box fan, and it
works until the Monday it doesn't. Every office you open afterwards inherits the same
closet.

**Worth it later:** six offices opened on that design. Five are comms racks only;
Lawrence — the operations site — is the one that got servers, for the OT that needs
them. `E-01 E-05`

### G1.2 · One identity, so leaving is one switch
`2018 · ~80 · a clean-energy company, now $3B+`
**Already:** From 2018, at ~80 people, one identity for everyone in Microsoft 365 and
Azure, with single sign-on and multi-factor authentication enforced org-wide from the
start — so a person's access was one record, not a dozen.

**What it prevented:** by now logins are on sticky notes and in a shared spreadsheet, and
offboarding is "hope". You find out how good it was on the first departure on bad terms.

**Worth it later:** SCIM provisioning was built on that identity in 2022, and the company
went passwordless in 2025. `E-01 E-03 E-29`

### G2.1 · A helpdesk with an owner
`2018 · ~80 · a clean-energy company, now $3B+`
**Already:** The first hire I made for the function, in 2018, was a support agent. From
~80 people onward, IT requests had a queue and a person whose job it was.

**What it prevented:** at your size someone technical has become IT by accident. The line
at their desk is the visible cost; the engineering they aren't doing is the real one.

**Worth it later:** support grew to a team of six by 2023, one hire at a time as
headcount demanded. `E-22 E-02`

### G2.2 · The office opened wired
`2018 · ~80 · a clean-energy company, now $3B+`
**Already:** In 2018 I planned and ran the Boston build-out and move — roughly 9,000 to
22,000 sq ft — with structured cabling, building access, intrusion detection and
conferencing installed before move-in. The same playbook then opened five more offices: Chicago 2019, Lawrence 2022, Austin,
New York and DC in 2023.

**What it prevented:** the week after you sign a lease, the network is whatever reached —
a cable taped across the floor with a caution sign — and every move repeats it at scale
unless someone plans for it. `E-05`

### G2.3 · A firewall five years before a network engineer
`2018 · ~80 · a clean-energy company, now $3B+`
**Already:** In 2018, at ~80 people, I put a Palo Alto next-generation firewall at the
edge, with guest Wi-Fi segmented from the corporate network from the start — so the
network had a boundary and rules before it had a network engineer.

**What it prevented:** at 80 there is usually one flat network: the visitor's laptop on
your lobby sofa is a neighbour of the finance PC and the CEO's mailbox.

**Worth it later:** by the time a dedicated network engineer joined in 2023, the edge had
been in place for five years. `E-06`

---

## 150 · 2019

### G3.2 · Laptops known, encrypted, wipeable
`2019 · ~150 · a clean-energy company, now $3B+`
**Already:** In 2019, at ~150 people, I deployed Intune for Windows and mobile: devices
enrolled, encrypted and remotely wipeable, with a standard build instead of whatever
arrived in the box. Jamf and Zebra joined the fleet later.

**What it prevented:** by 150 laptops are bought on credit cards, tracked in nobody's
spreadsheet, and returned — sometimes — to a trolley by the closet. The data on the one
labelled "Dave? (left)" is a question nobody wants asked. `E-19 E-24`

### G4.2 · Everyone trained, every year
`2019 · ~150 · a clean-energy company, now $3B+`
**Already:** In 2019 I started annual security training for the whole company, at ~150
people, with a way to report what looked wrong — and put Exchange ATP (now Defender
for Office 365) and Area 1, through a managed security provider, in front of the
mailboxes.

**What it prevented:** around now the first serious phishing attempt lands in your
finance inbox with a plausible invoice attached, and there is nothing between it and a
wire transfer except one person's instincts. `E-20`

### G4.3 · A system of record with an owner
`2019 · ~150 · a clean-energy company, now $3B+`
**Already:** In 2019, at ~150 people, I hired a Salesforce administrator — a business
system with a dedicated owner — and partnered with Sales, Finance, HR and Operations
leaders on the portfolio that grew around it over the following years: Salesforce,
NetSuite, HRIS, Procore, Primavera P6.

**What it prevented:** by now two of your teams each have a spreadsheet called
"CUSTOMERS (real)", and month-end is a reconciliation project.

**Worth it later:** that administrator became a product manager in 2020, in the product
function I was incubating. `E-08 E-14`

### G5.1 · The second office, on the network the same year
`2019 · ~150 · a clean-energy company, now $3B+`
**Already:** In 2019 Chicago opened and the offices were linked by VPN the same year, at
~150 people. A few years earlier, at a $200M company on a nine-building campus, I'd
linked the buildings with private fiber.

**What it prevented:** with a second office, your network between cities is a courier
account — a padded envelope with a hard drive in it, and someone at the far end checking
their watch.

**Worth it later:** every office since — Lawrence, Austin, New York, DC — opened on the
VPN from day one. `E-27 E-23 E-05`

---

## 220 · 2020

### G2.4 · Twenty-nine rooms, one standard
`2020 · ~220 · a clean-energy company, now $3B+`
**Already:** I built twenty-nine conference rooms across Boston, Chicago, New York, DC
and Lawrence to one standard, so any room behaved like every other room — the function
was fixed from the first two in 2018; the kit itself was unified by the time DC opened
in 2023. Most of the rooms came through 2020, at ~220 people, when everyone went home.

**What it prevented:** by now your meetings start with four people around one laptop
pointed at a TV, and a colleague in another city frozen mid-sentence on the wall.

**Worth it later:** when everyone went home in 2020, the meetings just moved. There was
no AV project. `E-25 E-28`

### G7.3a · Product had an owner before it had a team
`2020 · ~220 · a clean-energy company, now $3B+`
**Already:** In 2020, at ~220 people, I took the Director of Product title with two
product managers — one the Salesforce administrator I'd hired in 2019, one an internal
move — so the function existed before the company was ready to staff it properly.

**What it prevented:** by now there is a whiteboard of feature requests with nobody's
name on it, and sales and engineering are pointing at each other across it.

**Worth it later:** handed to a dedicated lead the next year, at ~360. `E-14`

---

## 360 · 2021

### G7.3 · Built it, then handed it off — twice
`2021 · ~360 · a clean-energy company, now $3B+`
**Already:** I incubated software development in 2018 — three developers and a product
manager through a team-extension partner — and handed it to a dedicated lead in 2019. I
incubated product in 2020, as Director of Product with two PMs, and handed that off in
2021, at ~360 people.

**What it prevented:** by now the person who built the functions is the bottleneck on all
of them — five hats on one head, walking carefully.

**Worth it later:** IT itself got leadership layers in 2023, on the same principle: build
it, then make sure it doesn't need you. And before any of this, at the campus, a web team
grown from four to eighty. `E-14 E-02 E-18`

### G5.4 · Phone costs down 33%, in 2011
`2011 · 300+ · a $200M company, nine-building campus`
**Already:** In 2011, at a $200M company on a nine-building campus, I led the move to
VoIP: communication costs down 33%, and the remote and call-centre teams no longer tied
to a desk phone.

**What it prevented:** with legacy telecom every seat is a line on a bill, every new one
is a work order, and your call-centre team sits wherever the copper is.

**Worth it later:** by 2014, across network, telecom and hosting, costs were down ~40%
while WAN capacity was up 33%. `E-10 E-11`

### G5.3 · Virtualised, with a tested recovery plan
`2013 · 300+ · a $200M company, nine-building campus`
**Already:** At the campus I moved the physical servers to VMware in 2013 and added
Commvault with a disaster-recovery plan in 2015, on NetApp storage — and tested the
restore before calling it done.

**What it prevented:** at 300 there is a tower PC in the closet hand-labelled "MAIN
SERVER" with a sign that says do not turn off, two fans pointed at it, and a backup that
is a schedule rather than a tested restore. `E-09`

### G5.6 · One copy of the company's data
`2012 · 300+ · a $200M company, nine-building campus`
**Already:** In 2012, at a $200M company on a nine-building campus, I migrated and
centralised company data onto NetApp — off workstations, portable hard drives and
consumer NAS boxes.

**What it prevented:** by now there are three drives on your desks labelled FINAL, and
someone is under a desk looking for the fourth.

**Worth it later:** the 2013 virtualisation and the 2015 DR plan had one place to
protect. `E-09`

---

## 490 · 2022

### G3.1 · Day one, with a laptop and a badge
`2022 · ~490 · a clean-energy company, now $3B+`
**Already:** In 2022, at ~490 people, I hired a Systems & Automation Engineer and started
a function: joiner/mover/leaver operations, SSO and SCIM configuration, workstation
provisioning, and the integrations between systems.

**What it prevented:** at your size onboarding is a person, not a process. A new hire
sits at a bare desk in their coat while accounts get created by hand and a laptop gets
ordered when someone remembers.

**Worth it later:** by 2026 the same process was running for 250 contractors on top of
~500 employees. `E-03 E-30`

### G6.4 · Access control as part of the opening
`2022 · ~490 · a clean-energy company, now $3B+`
**Already:** In 2022 Lawrence opened and Boston took a fourth floor, at ~490 people, with
building access, intrusion detection, cabling and conferencing specified as part of the
opening rather than added after it. Badge removal was a step on the offboarding
checklist — manual, but on the list.

**What it prevented:** by now your physical access is a fob system nobody administers
and a door propped open with a chair. Offboarding reaches the accounts and stops at the
building. `E-05`

---

## 610 · 2023

### G4.1 · A security function, before the auditor arrived
`2023 · ~610 · a $3B+ clean-energy company`
**Already:** In 2023, at ~610 people, I hired an Information Security Manager and stood
up the policy framework, audit readiness and cross-department compliance workflows. A
Security Analyst followed in 2025.

**What it prevented:** around this size an enterprise prospect's procurement team asks to
see your security program before they'll sign, and the honest answer — with no program,
no policies and no one whose job it is — is "we don't have one". The deal dies in
procurement, not in the budget. `E-04`

### G5.2 · Five years of network before a network engineer
`2023 · ~610 · a $3B+ clean-energy company`
**Already:** The Palo Alto had been at the edge since 2018; Ruckus and Extreme wireless
and a Cisco core carried the floors. In 2023, at ~610 people, I hired a network engineer
and made the network a function — someone whose job it was.

**What it prevented:** by now the far wing of your second office runs on a consumer
router on a filing cabinet, and the people out there are holding their phones in the
air. `E-06`

### G3.3 · Nine people, four functions, leaders between them and me
`2023 · ~610 · a $3B+ clean-energy company`
**Already:** By 2023, at ~610 people, IT was nine people across Infrastructure,
Cybersecurity, Network, Automation and Support, and I introduced leadership layers so
the function no longer ran through one person.

**What it prevented:** at your size IT is one box off to the side of the org chart with
a dotted line to whoever signs the invoices — a single point of failure with no on-call
rotation and no succession.

**Worth it later:** eleven people by 2026. `E-02 E-13`

### G6.3 · Three offices in one year, one playbook
`2023 · ~610 · a $3B+ clean-energy company`
**Already:** In 2023 Austin, New York and Washington DC opened in the same year, at ~610
people, each with structured cabling, building access, intrusion detection and
conferencing specified before move-in. Six offices in total, over 100,000 sq ft. Years
earlier — 2015 to 2017, at a $200M company on a nine-building campus — two new
facilities of 200,000+ sq ft.

**What it prevented:** by now a new office is a signed lease and a moving truck, and IT
is one person in the doorway of an empty shell holding a single cable, three weeks
before people arrive. `E-05 E-11`

---

## 750 · 2024+

### G6.1 · A portfolio, not a pile
`2024 · ~650 → 750 · a $3B+ clean-energy company`
**Already:** The SaaS portfolio has been a partnership with Sales, Finance, HR and
Operations leaders since 2018; the major consolidation and integration work landed in
2024. The renewals and licensing audits of the same year are the next panel.

**What it prevented:** by now every one of your departments has solved its own problem
with its own subscription, two of them are nearly the same product, and nobody can say
what the company pays for twice. `E-08`

### G6.2 · $500,000+ back, in one year
`2024 · ~650 → 750 · a $3B+ clean-energy company`
**Already:** I owned enterprise IT budgeting and vendor strategy. In 2024 that produced
over $500,000 in savings, most of it recurring, through renegotiation, renewals and
licensing audits — the same year as the portfolio consolidation in the previous panel.

**What it prevented:** by now contracts auto-renew because nobody owns them, and your
finance corner is under a slope of paper with a hand sticking out. `E-07`

### G7.1 · The policy arrived with the tool
`2025 · ~700 · a $3B+ clean-energy company`
**Already:** In 2025, at ~700 people, I introduced ChatGPT to the whole organisation and
the governance with it — tool evaluation, usage policy, vendor management and cost
controls — rather than writing policy to chase a tool people already had. Glean followed
in 2026, and Claude mid-year.

**What it prevented:** by now someone is already pasting confidential documents into an
assistant on a personal account, and the company card is next. `E-12`

### G7.2 · A chair at the table
`2022→ · ~490→750 · a $3B+ clean-energy company`
**Already:** Since the second half of 2022 I have reported to the SVP of Product &
Technology and contributed to strategic planning and cross-functional initiatives across
the company — the technology voice in the room where the three-year plan gets drawn.

**What it prevented:** by now the plan gets drawn in a room with six chairs, and
technology is a change request that arrives after the decision — usually with a date
already on it.

**Worth it later:** Dev in 2019, Product in 2021, IT's own leaders in 2023 — three
functions handed over, so the floor runs without me in that meeting. `E-13 E-14 E-02`

### G7.4 · Someone whose job is the knowledge
`2026 · ~750 · a $3B+ clean-energy company`
**Already:** In 2026, at ~750 people, the company's Business Librarian — a role it had
had since 2020 — moved into the IT function: knowledge management next to the systems
that hold the knowledge, the same year Glean gave the company one place to search.

**What it prevented:** by now your real procedures live in people's heads and in seven
versions of a document, and every departure takes some of them along. `E-26 E-12`

---

## 1,000+ · Beyond · *The from-zero seat inside a big company* (D-029)

Not a year band. Past 750 the slider has one more stop; the building stops growing and
the copy turns to the reader's large organisation. One panel, opened by the band itself,
plus a translation column in the checklist.

### B · Nobody builds IT from zero at your size
`1,000+ · your company · every receipt in this building, translated`
**Already:** Everything in this building was decided ahead of need — at 80, at 150, at
600 — by one person who stayed long enough to see the 2018 decisions carry 750 people
across six cities.

**What it prevented:** nobody builds IT from zero at your size. Except every time you
acquire a company, open a region, stand up a business unit, or a new category of tool
arrives before anyone owns it. Each of those is a from-zero build inside a big company,
with the same failure modes as the closet and the sticky notes — and more at stake.

**Worth it later:** the checklist below maps each receipt to what it looks like at
yours. `E-01…E-30`

**Checklist translation column (R-14, at this stop only):**

| Receipt | At 1,000+ this is |
|---|---|
| Six site builds; three in one year on one playbook (G2.2, G6.3, G6.4) | the site-integration playbook for every acquisition and new region |
| AI governance shipped *with* the tool, 2025 (G7.1) | the same problem at any size; policy with the rollout, not after it |
| Dev and Product incubated, then handed off (G7.3, G7.3a) | the internal-startup pattern: stand it up, staff it, give it away |
| Leadership layers at 610 (G3.3) | org design when a function outgrows its founder |
| $500,000+ a year back from vendors (G6.2) | the licensing and renewal program every enterprise runs annually |
| A security function and audit readiness before the ask (G4.1) | the readiness work that precedes any certification |
| Cloud identity in 2018; passwordless in 2025 (G1.1, G1.2) | identity as the platform; everything else plugs in |
| JML automation covering 250 contractors (G3.1) | joiner/mover/leaver at the scale of a workforce that churns |
| Nine functions, one building, eight years (all) | the person you put on the thing that doesn't exist yet |

---

## Ambient · G3.A · 3:47am
No panel. Hover text only: *"Someone is always on call. In the built state, it's a
rotation."*

---

## Forks — resolved 2026-09-24

Answered via AskUserQuestion; recorded as D-027. Original framing kept for the record.

**F-1 · Merge G5.3 into G5.6?** → **Keep both.** Both are E-09, same band, same closet, adjacent years.
G5.6 is the better-written; G5.3's VMware/Commvault is already its Worth-it-later. Merging
saves one gag's art and loses the two-fans picture. (Trim order currently folds G5.6 into
G5.1 — the reviewer and I both think G5.3 → G5.6 is the better fold.)

**F-2 · Merge G6.1 into G6.2?** → **Keep separate, cross-link** (done, both directions). One achievement split across two panels: the portfolio
work and the money it produced. Merged, the $500,000+ gets the consolidation as its
cause and the balloons/avalanche become one scene. Kept separate, band 750 stays at five
gags.

**F-3 · The first build (E-18) is nowhere on the site.** → **(b)**, one line in G7.3 (done). The web organisation you grew 4 →
80 / $20M / 1.2M visitors a month is the "twice" in `00-VISION.md`'s rare fact, and no
panel mentions it because the building is about IT. Options: (a) leave it to LinkedIn;
(b) one line in G7.3's Worth-it-later ("…and before any of this, a web team from four
to eighty"); (c) a footer/about line, outside the building. I lean (b).

**F-4 · The tagline.** → **Promote** to OG description and toggle copy (done in `TONE.md`). "Build it, then make sure it doesn't need you" (G7.3) is the
résumé's thesis in nine words and currently lives in one mid-band panel. Promote it to
the OG description / toggle copy alongside "at your scale"?

**F-5 · G7.1's present tense.** → **Keep as is.** "by now someone is already pasting…" is the most
aggressive line in the doc. The reviewer flagged it against "honest confidence"; both of
us think it should stay. Your call on whether it makes a reader defensive.

**F-6 · G2.4's prevention beat.** → **Yes**: the 2020 move was remote-without-an-AV-project. Now G2.4's Worth-it-later (E-28). Currently an inconvenience (the dongle huddle), not a
cost. The stronger frame — "the company went fully remote in 2020 without an AV project"
— needs you to say whether that's true.

## Pushed back on the review

- **G6.2 "owned budget and vendor strategy"** — the reviewer called it unsourced. It is on
  the resume verbatim ("Owned enterprise IT budgeting and vendor strategy") and in E-07's
  row. Kept, minus "outright".
- **"Partnered with Sales, Finance, HR and Operations"** (G4.3, G6.1) — also on the resume
  and in E-08. Kept, with "leaders" restored from the resume's wording.
- **Descriptor-in-every-panel** — agreed with the diagnosis, not the prescription. Adding
  six words of prose to 25 panels reads as a tic; the strip (R-04a) makes every panel
  self-identifying and also fixes the nine missing headcounts (DW-4) for free.
- **G6.1's "~650 at band 750"** — real, and it was a defect in my own docs: `TIMELINE.md`
  mapped 2024 to band 610 while the gag list put 2024+ at 750. Fixed at the source: band
  750 is 2024+ / ~650→750, and the strip shows the range.
