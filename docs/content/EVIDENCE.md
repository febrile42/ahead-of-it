# Evidence ledger

Every receipt used in a panel has a row here. **Source** is a quote from the resume
(2026-09-15 version) or `[JOSH: confirm]`. Nothing marked `[JOSH: confirm]` ships.
Status: `resume` · `confirmed` · `needs-josh` · `deferred`.

| ID | Claim | Source | Status | Used by |
|---|---|---|---|---|
| E-01 | Cloud-first Microsoft 365/Azure infrastructure and identity from day one, designed for elastic scale, geographic expansion, capex-light ops | Resume: "Established cloud-first Microsoft 365/Azure infrastructure and identity from day one" | resume — **[JOSH: headcount in Jan 2018?]** | G1.1 G1.2 G5.5 |
| E-02 | Built IT from ground up; 11 staff across Cybersecurity, Infrastructure, IT Automation Engineering, Support; introduced leadership layers | Resume: "Built and led a hierarchical team of 11 staff…" | resume — **[JOSH: year each function was stood up; first hire and when]** | G2.1 G3.3 G7.3 |
| E-03 | IT Automation Engineering function exists | Resume (same line) | resume — **[JOSH: what it automated — is onboarding/provisioning one of them? before/after time-to-provision?]** | G3.1 G3.2 |
| E-04 | Hired an Information Security Manager; advancing toward ISO 27001 and SOC 2 within 18–24 months; policy frameworks, audit readiness, cross-dept workflows | Resume: "Led security initiatives…" | resume — **[JOSH: year and headcount when the program started; what triggered it]** | G4.1 |
| E-05 | Planned and coordinated IT for 6 new corporate offices, 100k+ sq ft: structured cabling, building access, intrusion detection, VC/AV, across the US | Resume: "Planned and coordinated IT needs for 6 new corporate offices…" | resume | G2.2 G2.4 G6.3 G6.4 |
| E-06 | Core network: Palo Alto, Extreme, Cisco, Ruckus; onboarded dedicated network engineering staff | Resume: "Directed core network infrastructure…" | resume — **[JOSH: which vendor for wireless, which for edge — so the gag props are right]** | G2.3 G5.2 |
| E-07 | $500,000+ savings in 2024 via renegotiation, renewals, licensing audits; owns IT budgeting and vendor strategy | Resume: "Delivered over $500,000 in savings in 2024…" | resume | G6.2 |
| E-08 | SaaS portfolio strategy and integration: Salesforce, NetSuite, HRIS/HCM, Procore, Primavera P6; partnered with Sales, Finance, HR, Ops | Resume: "Partnered on enterprise SaaS portfolio strategy…" | resume | G4.3 G6.1 |
| E-09 | the previous employer: migrated physical servers to VMware; DR with NetApp/Commvault | Resume | resume — **[JOSH: years]** | G5.3 |
| E-10 | the previous employer: VoIP transition, −33% communication costs, remote and call-center teams | Resume | resume | G5.4 |
| E-11 | the previous employer: ~40% reduction in network/telecom/hosting cost, +33% network capacity; $200M org, 300+ employees, nine-building campus; two new 200k+ sq ft facilities | Resume | resume | G5.1 G5.2 G6.3 |
| E-12 | Enterprise AI adoption and governance: tool evaluation, vendor mgmt, usage policies, cost governance; measurable improvements | Resume: "Led enterprise AI adoption and governance…" | resume — **[JOSH: year; one concrete "measurable improvement" we can cite]** | G7.1 |
| E-13 | Reports to SVP Product & Technology; key contributor to strategic planning | Resume | resume | G7.2 |
| E-14 | Incubated Software Development and Product Management, transitioned both to dedicated leadership; 15–30% YoY headcount growth | Resume | resume — **[JOSH: years incubated and handed off]** | G7.3 |
| E-15 | Ranked #2 of 31 in leadership on internal engagement survey | Resume | resume — **[JOSH: year; ok to show publicly?]** | G7.4 |
| E-16 | 750+ employees and contractors, distributed hybrid workforce, $3B+ balance sheet | Resume | resume | band 7 framing |
| E-17 | ip2geo.org: 8 years continuous operation, 99.96%+ uptime, run end-to-end | Resume | resume — could be a live check | deferred (not a gag; possible panel footer) |
| E-18 | the previous employer web: 4 → 80 team, $20M revenue, 1.2M monthly visitors, 35k leads/month | Resume | resume | not used in gags; keep |
| E-19 | Endpoint management / MDM / zero-touch provisioning at the current employer (tooling, when) | **not on resume** | **needs-josh** | G3.2 |
| E-20 | Email security and security-awareness training at the current employer (what, when) | **not on resume** | **needs-josh** | G4.2 |
| E-21 | Onboarding time-to-productive before/after automation | **not on resume** | **needs-josh** | G3.1 |
| E-22 | Timing of first dedicated support hire at the current employer and headcount then | **not on resume** | **needs-josh** | G2.1 |
| E-23 | the previous employer inter-building connectivity (what linked the nine buildings; was the +33% capacity that?) | **not on resume** — inferred | **needs-josh** | G5.1 |
| E-24 | Procurement/asset register before the function existed (how laptops were bought at 60 people) | **not on resume** | **needs-josh** | G1.3 |
| E-25 | Standardised video-conferencing rooms — platform and count | **not on resume** — partly implied by E-05 | **needs-josh** | G2.4 G5.5 |

## Rules

- A gag whose only receipt is `needs-josh` is **held** (not cut) until answered. Held gags
  are marked in `BANDS-AND-GAGS.md`.
- When Josh confirms, replace the bracket with the fact and set status `confirmed`. Keep
  the original resume quote where there was one.
- Never merge two receipts into one bigger-sounding claim.
