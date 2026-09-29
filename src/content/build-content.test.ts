import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import realContent from './content.json';
import schema from './schema.json';
import {
  buildContent,
  ContentPipelineError,
  countWords,
  parseBandSectionsPublic,
  parseBandsTable,
  parseCopy,
  parseEmployerNames,
  parseEvidenceIds,
  parsePanelBody,
  parsePanelsMd,
  parseUi,
  type BuildInputs,
} from '../../scripts/build-content';

// The real docs/content/TONE.md, for the "reads the real file" test below —
// not a fixture, since D-042a's exact wording matters (R-14/R-20).
const REAL_TONE_MD = readFileSync(new URL('../../docs/content/TONE.md', import.meta.url), 'utf-8');

// ---------------------------------------------------------------------------
// Fixtures. Small, self-contained markdown — not the real docs/content/*.md
// (those are covered by `npm run build` against the real docs and by
// the 2026-09-24 panel check). Shapes mirror the real files
// closely enough to exercise every regex the parser relies on: the bands
// table row, the "## <id> · <year> · *title*" band heading, the "### <id> ·
// <title>" gag/panel heading, the scene bullets, the strip line, the beat
// labels, the trailing receipt list, the Beyond table, the ambient hover
// text, and TONE.md's "Toggle and share copy" section.
// ---------------------------------------------------------------------------

const VALID_BANDS_MD = `# Bands and gags — fixture

| Band | Year | People | New this year |
|---|---|---|---|
| **80** | 2018 | ~80 | fixture band |

## 80 · 2018 · *As found (fixture)*

Intro paragraph for the fixture band.

### G1.1 · Test gag
- **Already:** built-state scene text.
- **Without:** without-state scene text.
- **Where:** the closet.
- **Receipt:** E-01.

## Refinement map (R-15) (fixture)

| box | gags |
|---|---|
| sso | G1.1 |
| securityLead |  |
| erp |  |
| network |  |
| mdm |  |
`;

const VALID_PANELS_MD = `# Panels — fixture

## 80 · 2018

### G1.1 · Test gag
\`2018 · ~80 · a $3B+ clean-energy company\`
**Already:** In 2018, at ~80 people, I did the fixture thing.

**What it prevented:** by now something bad happens without it. \`E-01\`

---

## 1,000+ · Beyond · *Fixture translation*

### B · Fixture beyond panel
\`1,000+ · your company · every receipt, translated\`
**Already:** the fixture beyond lead beat.

**What it prevented:** the fixture beyond prevention beat. \`E-01\`

**Checklist translation column**

| Receipt | At your scale |
|---|---|
| Fixture receipt | Fixture translation |

---

## Ambient · G3.A · 3:47am
No panel. Hover text only: *"Fixture hover text."*
`;

const VALID_EVIDENCE_MD = `# Evidence ledger — fixture

| ID | Claim | Source | Status | Used by |
|---|---|---|---|---|
| E-01 | Fixture receipt | Fixture source | confirmed | G1.1 B |
`;

const VALID_TIMELINE_MD = `# Timeline — fixture

## Fixture Employer One, Fixture City
2018 — fixture event.

## Fixture Employer Two, Fixture City
2012 — fixture event.
`;

const VALID_TONE_MD = `# Tone — fixture

## Toggle and share copy (fixture)

- Toggle, built → without: **"See it without him"**. Without → built: **"What he'd already built"**.
- Nudge (once, after the first slider move): *"Now see what this looks like without him."*
- Share caption: *"Fixture share caption."*
- OG title: *Fixture OG title*. Slider label: *at your scale*.
- **Contact (fixture):** email \`fixture.user@fixture-domain.example\` — assembled
  client-side, never a plain \`mailto:\` in the source. LinkedIn: \`https://www.linkedin.com/in/fixture/\`.
- **OG description / tagline (fixture):** *Fixture tagline text.*

## Landing copy (D-051) (fixture)

| key | copy | where |
|---|---|---|
| \`intro\` | \`Fixture intro lede.\` | fixture. |
| \`roomHint\` | \`Fixture room hint.\` | fixture. |

## Navigation copy (D-042a) (fixture)

| key | copy | where |
|---|---|---|
| \`wholeFloor\` | \`Whole floor\` | fixture. |
| \`previous\` | \`Previous close-up\` | fixture. |
| \`next\` | \`Next close-up\` | fixture. |
| \`position\` | \`{label} · {n} of {total}\` | fixture. |
| \`zoomIn\` | \`Zoom in: {label}\` | fixture. |
| \`atStart\` | \`No earlier close-ups\` | fixture. |
| \`atEnd\` | \`No more close-ups\` | fixture. |
| \`roomTab\` | \`{room} ({count})\` | fixture. |
| \`roomTabName\` | \`{room}: {count} to tap\` | fixture. |
| \`announce\` | \`{room}: {label}, {n} of {total}\` | fixture. |
| \`announceRoom\` | \`{room}: whole floor\` | fixture. |

## Page state copy (D-053) (fixture)

| key | copy | where |
|---|---|---|
| \`announceWithout\` | \`Showing the building without him\` | fixture. |
| \`announceBuilt\` | \`Showing what he'd already built\` | fixture. |
| \`loading\` | \`Loading the building…\` | fixture. |
| \`loadFailed\` | \`The building didn't load. Everything in it is in the punch list.\` | fixture. |
| \`retry\` | \`Try again\` | fixture. |
| \`readoutAtBand\` | \`~{n} → {year}\` | fixture. |

## Share control copy (D-057) (fixture)

| key | copy | where |
|---|---|---|
| \`shareButton\` | \`Share it without him\` | fixture. |
| \`shareButtonName\` | \`Share it without him: a picture of this building\` | fixture. |

## Refinement copy (R-15) (fixture)

| key | copy | where |
|---|---|---|
| \`haveLegend\` | \`Fixture: already have some?\` | fixture. |
| \`haveHelp\` | \`Fixture: nothing is sent or saved.\` | fixture. |
| \`haveSso\` | \`Fixture SSO\` | fixture. |
| \`haveSecurityLead\` | \`Fixture security lead\` | fixture. |
| \`haveErp\` | \`Fixture ERP\` | fixture. |
| \`haveNetwork\` | \`Fixture network\` | fixture. |
| \`haveMdm\` | \`Fixture MDM\` | fixture. |
| \`haveTag\` | \`Fixture ahead of it\` | fixture. |
| \`punchListLeft\` | \`Punch list ({n} left)\` | fixture. |
| \`haveAnnounce\` | \`{n} left on the punch list\` | fixture. |
| \`haveHotspotSuffix\` | \`{title} — fixture ahead of it\` | fixture. |
`;

const VALID_UI = {
  intro: 'Fixture intro lede.',
  roomHint: 'Fixture room hint.',
  wholeFloor: 'Whole floor',
  previous: 'Previous close-up',
  next: 'Next close-up',
  position: '{label} · {n} of {total}',
  zoomIn: 'Zoom in: {label}',
  atStart: 'No earlier close-ups',
  atEnd: 'No more close-ups',
  roomTab: '{room} ({count})',
  roomTabName: '{room}: {count} to tap',
  announce: '{room}: {label}, {n} of {total}',
  announceRoom: '{room}: whole floor',
  announceWithout: 'Showing the building without him',
  announceBuilt: "Showing what he'd already built",
  loading: 'Loading the building…',
  loadFailed: "The building didn't load. Everything in it is in the punch list.",
  retry: 'Try again',
  readoutAtBand: '~{n} → {year}',
  shareButton: 'Share it without him',
  shareButtonName: 'Share it without him: a picture of this building',
  haveLegend: 'Fixture: already have some?',
  haveHelp: 'Fixture: nothing is sent or saved.',
  haveSso: 'Fixture SSO',
  haveSecurityLead: 'Fixture security lead',
  haveErp: 'Fixture ERP',
  haveNetwork: 'Fixture network',
  haveMdm: 'Fixture MDM',
  haveTag: 'Fixture ahead of it',
  punchListLeft: 'Punch list ({n} left)',
  haveAnnounce: '{n} left on the punch list',
  haveHotspotSuffix: '{title} — fixture ahead of it',
};

function validInputs(overrides: Partial<BuildInputs> = {}): BuildInputs {
  return {
    bandsMd: VALID_BANDS_MD,
    panelsMd: VALID_PANELS_MD,
    evidenceMd: VALID_EVIDENCE_MD,
    toneMd: VALID_TONE_MD,
    timelineMd: VALID_TIMELINE_MD,
    schema,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// One band
// ---------------------------------------------------------------------------

describe('parsing one band', () => {
  it('reads id, year, people from the bands table and title/intro from the section heading', () => {
    const table = parseBandsTable(VALID_BANDS_MD);
    expect(table).toEqual([{ id: 80, year: '2018', people: '~80' }]);

    const sections = parseBandSectionsPublic(VALID_BANDS_MD);
    expect(sections).toEqual([
      { id: 80, year: '2018', title: 'As found (fixture)', intro: 'Intro paragraph for the fixture band.' },
    ]);
  });
});

// ---------------------------------------------------------------------------
// One panel
// ---------------------------------------------------------------------------

describe('parsing one panel', () => {
  it('reads the strip, the beats and the trailing receipt list', () => {
    const { gagPanels } = parsePanelsMd(VALID_PANELS_MD);
    const g11 = gagPanels.get('G1.1');
    expect(g11).toBeDefined();
    expect(g11!.fields.strip).toEqual({ year: '2018', headcount: '~80', descriptor: 'a $3B+ clean-energy company' });
    expect(g11!.fields.already).toBe('In 2018, at ~80 people, I did the fixture thing.');
    expect(g11!.fields.prevented).toBe('by now something bad happens without it.');
    expect(g11!.fields.receipts).toEqual(['E-01']);
    expect(g11!.fields.worthLater).toBeUndefined();
  });

  it('does not leak the trailing "---" band separator into the last panel in a section (regression)', () => {
    // G1.1 is the only — therefore last — panel in "## 80 · 2018", directly
    // followed by "---" and the next "## " heading, same as every band
    // boundary in the real docs/content/PANELS.md. Before this was fixed,
    // the last beat's slice ran through to the end of the section body and
    // picked up "\n\n---" verbatim, which both corrupted the emitted prose
    // and silently zeroed out `receipts` (the trailing-receipt regex
    // requires the beat to *end* on a closing backtick).
    const { gagPanels } = parsePanelsMd(VALID_PANELS_MD);
    const g11 = gagPanels.get('G1.1')!;
    expect(g11.fields.prevented).not.toContain('-');
    expect(g11.fields.receipts).toEqual(['E-01']);
  });
});

// ---------------------------------------------------------------------------
// EVIDENCE.md / TIMELINE.md / TONE.md helpers
// ---------------------------------------------------------------------------

describe('parsing evidence ids, employer names and toggle/share copy', () => {
  it('collects every E-xx row', () => {
    expect(parseEvidenceIds(VALID_EVIDENCE_MD)).toEqual(new Set(['E-01']));
  });

  it('collects both employer names to ban', () => {
    expect(parseEmployerNames(VALID_TIMELINE_MD)).toEqual(['Fixture Employer One', 'Fixture Employer Two']);
  });

  it('reads the toggle/share/OG copy block', () => {
    const copy = parseCopy(VALID_TONE_MD);
    expect(copy).toEqual({
      toggleToWithout: 'See it without him',
      toggleToBuilt: "What he'd already built",
      nudge: 'Now see what this looks like without him.',
      shareCaption: 'Fixture share caption.',
      ogTitle: 'Fixture OG title',
      sliderLabel: 'at your scale',
      ogDescription: 'Fixture tagline text.',
      contact: {
        linkedin: 'https://www.linkedin.com/in/fixture/',
        email: { user: 'fixture.user', domain: 'fixture-domain.example' },
      },
    });
  });
});

// ---------------------------------------------------------------------------
// TONE.md §"Navigation copy (D-042a)" -> ui{}
// ---------------------------------------------------------------------------

describe('parsing ui (D-042a)', () => {
  it('reads the real docs/content/TONE.md navigation strings', () => {
    expect(parseUi(REAL_TONE_MD)).toEqual({
      intro:
        "Josh Gister's résumé, as a building. Slide to your company's headcount: everything you can tap was already in place by the time his company was that size.",
      roomHint: 'Tap an area to zoom in',
      wholeFloor: 'Whole floor',
      previous: 'Previous close-up',
      next: 'Next close-up',
      position: '{label} · {n} of {total}',
      zoomIn: 'Zoom in: {label}',
      atStart: 'No earlier close-ups',
      atEnd: 'No more close-ups',
      roomTab: '{room} ({count})',
      roomTabName: '{room}: {count} to tap',
      announce: '{room}: {label}, {n} of {total}',
      announceRoom: '{room}: whole floor',
      announceWithout: 'Showing the building without him',
      announceBuilt: "Showing what he'd already built",
      loading: 'Loading the building…',
      loadFailed: "The building didn't load. Everything in it is in the punch list.",
      retry: 'Try again',
      readoutAtBand: '~{n} → {year}',
      shareButton: 'Share it without him',
      shareButtonName: 'Share it without him: a picture of this building',
      haveLegend: 'What do you already have?',
      haveHelp: 'Tick what your company has. It stays on this page: nothing is sent or saved.',
      haveSso: 'SSO',
      haveSecurityLead: 'A security lead',
      haveErp: 'An ERP',
      haveNetwork: 'A real network',
      haveMdm: 'MDM',
      haveTag: "You're ahead of it",
      punchListLeft: 'Punch list ({n} left)',
      haveAnnounce: '{n} left on the punch list',
      haveHotspotSuffix: "{title} — you're ahead of it",
    });
  });

  it('reads the fixture table', () => {
    expect(parseUi(VALID_TONE_MD)).toEqual(VALID_UI);
  });

  it('fails when a key is missing from the table', () => {
    const missingKey = VALID_TONE_MD.replace('| `atEnd` | `No more close-ups` | fixture. |\n', '');
    expect(() => parseUi(missingKey)).toThrow(/ui\.atEnd is missing/);
  });

  it('fails on an unknown key in the table', () => {
    const unknownKey = VALID_TONE_MD.replace(
      '| `announceRoom` | `{room}: whole floor` | fixture. |',
      '| `announceRoom` | `{room}: whole floor` | fixture. |\n| `bogusKey` | `Bogus` | fixture. |',
    );
    expect(() => parseUi(unknownKey)).toThrow(/unknown ui key "bogusKey"/);
  });

  it('fails when a copy value has the wrong placeholder set', () => {
    const wrongPlaceholders = VALID_TONE_MD.replace(
      '| `position` | `{label} · {n} of {total}` | fixture. |',
      '| `position` | `{label} · {n}` | fixture. |',
    );
    expect(() => parseUi(wrongPlaceholders)).toThrow(/ui\.position has placeholders \{label,n\}, expected \{label,n,total\}/);
  });
});

// ---------------------------------------------------------------------------
// TONE.md §"Landing copy (D-051)" -> ui.intro / ui.roomHint
// ---------------------------------------------------------------------------

describe('parsing landing copy (D-051)', () => {
  it('fails when a key is missing from the table', () => {
    const missingKey = VALID_TONE_MD.replace('| `roomHint` | `Fixture room hint.` | fixture. |\n', '');
    expect(() => parseUi(missingKey)).toThrow(/ui\.roomHint is missing from §"## Landing copy \(D-051\)"/);
  });

  it('fails on an unknown key in the table', () => {
    const unknownKey = VALID_TONE_MD.replace(
      '| `roomHint` | `Fixture room hint.` | fixture. |',
      '| `roomHint` | `Fixture room hint.` | fixture. |\n| `bogusKey` | `Bogus` | fixture. |',
    );
    expect(() => parseUi(unknownKey)).toThrow(/unknown ui key "bogusKey" in §"## Landing copy \(D-051\)"/);
  });

  it('a §"Navigation copy" key is unknown inside §"Landing copy", and vice versa', () => {
    const wholeFloorInLanding = VALID_TONE_MD.replace(
      '| `roomHint` | `Fixture room hint.` | fixture. |',
      '| `roomHint` | `Fixture room hint.` | fixture. |\n| `wholeFloor` | `Whole floor` | fixture. |',
    );
    expect(() => parseUi(wholeFloorInLanding)).toThrow(/unknown ui key "wholeFloor" in §"## Landing copy \(D-051\)"/);
  });
});

// ---------------------------------------------------------------------------
// Full pipeline, happy path
// ---------------------------------------------------------------------------

describe('buildContent — happy path', () => {
  it('produces a schema-valid ContentJson from a minimal, consistent fixture set', () => {
    const content = buildContent(validInputs());
    expect(content.bands).toHaveLength(1);
    expect(content.gags).toHaveLength(1);
    expect(content.gags[0].id).toBe('G1.1');
    expect(content.beyond.panel.id).toBe('B');
    expect(content.ui).toEqual(VALID_UI);
    expect(content.ambient.hover).toBe('Fixture hover text.');
    expect(content.copy.shareCaption).toBe('Fixture share caption.');
  });

  it('is deterministic: building the same inputs twice gives byte-identical JSON', () => {
    const a = JSON.stringify(buildContent(validInputs()), null, 2);
    const b = JSON.stringify(buildContent(validInputs()), null, 2);
    expect(a).toBe(b);
  });
});

// ---------------------------------------------------------------------------
// Failure cases — one per drift the brief requires build-content.ts to
// catch, each asserted via ContentPipelineError so a caller (main()) exits
// 1 with a clear, file/line- or id-bearing message.
// ---------------------------------------------------------------------------

describe('buildContent — failure cases', () => {
  it('fails when a gag in BANDS-AND-GAGS.md has no panel in PANELS.md', () => {
    const bandsWithExtraGag =
      VALID_BANDS_MD +
      `
### G1.2 · Orphan gag
- **Already:** scene text.
- **Without:** scene text.
- **Where:** the closet.
`;
    expect(() => buildContent(validInputs({ bandsMd: bandsWithExtraGag }))).toThrow(ContentPipelineError);
    try {
      buildContent(validInputs({ bandsMd: bandsWithExtraGag }));
      expect.unreachable();
    } catch (err) {
      expect(String(err)).toContain('G1.2');
      expect(String(err)).toContain('has no panel');
    }
  });

  it('fails when a panel in PANELS.md has no gag entry in BANDS-AND-GAGS.md', () => {
    const panelsWithExtraPanel = VALID_PANELS_MD.replace(
      '---\n\n## 1,000+',
      `### G1.2 · Orphan panel
\`2018 · ~80 · a $3B+ clean-energy company\`
**Already:** orphan lead beat.

**What it prevented:** orphan prevention beat. \`E-01\`

---

## 1,000+`,
    );
    expect(() => buildContent(validInputs({ panelsMd: panelsWithExtraPanel }))).toThrow(/G1\.2.*has no gag entry/s);
  });

  it('fails when a panel cites an E-xx that is not a row in EVIDENCE.md', () => {
    const panelsWithBadReceipt = VALID_PANELS_MD.replace('`E-01`\n\n---\n\n## 1,000+', '`E-99`\n\n---\n\n## 1,000+');
    expect(() => buildContent(validInputs({ panelsMd: panelsWithBadReceipt }))).toThrow(
      /G1\.1 cites E-99, which is not a row/,
    );
  });

  it('fails when an emitted string contains either employer name', () => {
    const panelsWithEmployerName = VALID_PANELS_MD.replace(
      'In 2018, at ~80 people, I did the fixture thing.',
      'In 2018, at ~80 people, I did the fixture thing at Fixture Employer One.',
    );
    expect(() => buildContent(validInputs({ panelsMd: panelsWithEmployerName }))).toThrow(
      /forbidden employer name "Fixture Employer One"/,
    );
  });

  it('fails when a panel is missing a required beat', () => {
    const panelsMissingBeat = VALID_PANELS_MD.replace(
      `**What it prevented:** by now something bad happens without it. \`E-01\`

---

## 1,000+`,
      '\n\n---\n\n## 1,000+',
    );
    expect(() => buildContent(validInputs({ panelsMd: panelsMissingBeat }))).toThrow(
      /G1\.1 is missing beat\(s\): What it prevented/,
    );
  });

  it('fails a 111-word panel and names the panel id in the message (acceptance)', () => {
    // already: 1 word. prevented: 110 filler words. Total 111 > 110.
    const filler = Array.from({ length: 110 }, (_, i) => `word${i}`).join(' ');
    const panelsWithLongPanel = VALID_PANELS_MD.replace(
      '**Already:** In 2018, at ~80 people, I did the fixture thing.\n\n**What it prevented:** by now something bad happens without it. `E-01`',
      `**Already:** X.\n\n**What it prevented:** ${filler} \`E-01\``,
    );
    expect(() => buildContent(validInputs({ panelsMd: panelsWithLongPanel }))).toThrow(ContentPipelineError);
    try {
      buildContent(validInputs({ panelsMd: panelsWithLongPanel }));
      expect.unreachable();
    } catch (err) {
      const message = String(err);
      expect(message).toContain('panel G1.1 is 111 words (max 110');
    }
  });
});

// ---------------------------------------------------------------------------
// parsePanelBody directly — the single-panel unit underneath parsePanelsMd
// ---------------------------------------------------------------------------

describe('parsePanelBody', () => {
  it('rejects a panel that does not open with a backticked strip line', () => {
    const body = 'no strip line here\n**Already:** x.\n\n**What it prevented:** y.';
    expect(() => parsePanelBody('X.1', body, body, 0)).toThrow(/does not open with a backticked strip line/);
  });
});

// ---------------------------------------------------------------------------
// countWords — standalone punctuation tokens are not words (PH1-03 review
// should-fix #2): matches the 2026-09-24 panel check's manual counting
// method, which does not count a free-standing em/en dash, middle dot,
// hyphen or arrow as a word.
// ---------------------------------------------------------------------------

describe('countWords', () => {
  it('counts ordinary space-separated words', () => {
    expect(countWords('four little words')).toBe(3);
  });

  it('does not count standalone punctuation tokens as words', () => {
    expect(countWords('three — words — here')).toBe(3);
    expect(countWords('en dash – too')).toBe(3);
    expect(countWords('middle · dot')).toBe(2);
    expect(countWords('bare - hyphen')).toBe(2);
    expect(countWords('an → arrow')).toBe(2);
    expect(countWords('repeated —— dashes –– together')).toBe(3);
  });

  it('still counts a hyphenated compound as one word (hyphen is not standalone)', () => {
    expect(countWords('a well-built room')).toBe(3);
  });

  it('ignores backticked receipt ids, as before', () => {
    expect(countWords('already built `E-01 E-02`')).toBe(2);
  });

  it('returns 0 for undefined', () => {
    expect(countWords(undefined)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// copy.contact — split, never joined (PH1-03 review item #3)
// ---------------------------------------------------------------------------

describe('copy.contact', () => {
  it('parses linkedin and email as separate fields, not a joined address', () => {
    const copy = parseCopy(VALID_TONE_MD);
    expect(copy.contact).toEqual({
      linkedin: 'https://www.linkedin.com/in/fixture/',
      email: { user: 'fixture.user', domain: 'fixture-domain.example' },
    });
  });

  it('never emits the joined email address anywhere in the built content.json', () => {
    const content = buildContent(validInputs());
    const json = JSON.stringify(content);
    const joined = `${content.copy.contact.email.user}@${content.copy.contact.email.domain}`;
    expect(json).not.toContain(joined);
    expect(json).not.toContain('fixture.user@fixture-domain.example');
  });

  it('never emits the real joined address in the committed content.json', () => {
    // Guards the actual shipped artifact, not just the fixture build.
    const json = JSON.stringify(realContent);
    expect(json).not.toContain('joshua.gister@gmail.com');
  });
});
