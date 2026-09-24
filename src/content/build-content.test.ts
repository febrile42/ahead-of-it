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
  type BuildInputs,
} from '../../scripts/build-content';

// ---------------------------------------------------------------------------
// Fixtures. Small, self-contained markdown — not the real docs/content/*.md
// (those are covered by `npm run build` against the real docs and by
// docs/content/PANELS-CHECK-2026-09-24.md). Shapes mirror the real files
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
`;

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
// Full pipeline, happy path
// ---------------------------------------------------------------------------

describe('buildContent — happy path', () => {
  it('produces a schema-valid ContentJson from a minimal, consistent fixture set', () => {
    const content = buildContent(validInputs());
    expect(content.bands).toHaveLength(1);
    expect(content.gags).toHaveLength(1);
    expect(content.gags[0].id).toBe('G1.1');
    expect(content.beyond.panel.id).toBe('B');
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
// should-fix #2): matches PANELS-CHECK-2026-09-24.md's manual counting
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
