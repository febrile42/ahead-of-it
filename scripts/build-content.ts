// PH1-03 content pipeline.
//
// docs/content/*.md is the single source of truth (00-VISION.md: "Content is the
// product"). This script parses it deterministically — no LLM, no invented
// facts — into src/content/content.json, validated against
// src/content/schema.json, and fails the build on drift: a gag with no panel
// (or vice versa), a panel over the word budget, a receipt id that doesn't
// exist in EVIDENCE.md, either employer name in emitted content, or a beat
// missing from a panel.
//
// Sources and what each contributes:
//   BANDS-AND-GAGS.md  -> bands[] (year/people from the table, title/intro
//                         from each "## <id> · <year> · *title*" section);
//                         gags[].where / .without / .built (the pixel-scene
//                         bullets: Where / Without / Already — "Already"
//                         here is the *scene* description, renamed `built`
//                         in the schema so it isn't confused with the panel
//                         prose of the same name).
//   PANELS.md          -> gags[].title / .strip / .already / .prevented /
//                         .worthLater / .receipts (the panel copy — dry,
//                         second-person, ends with the visitor); beyond.panel
//                         and beyond.translation[] (the Beyond table);
//                         ambient.hover (G3.A, hover text only, no panel).
//   EVIDENCE.md         -> the set of valid E-xx ids, checked against every
//                         receipt referenced above.
//   TONE.md             -> copy{} (toggle/share/OG copy, §"Toggle and share
//                         copy"), including copy.contact.linkedin and
//                         copy.contact.email (the "Contact (R-12, D-019)"
//                         bullet). The email is split into { user, domain }
//                         here, not joined into one string — the joined
//                         address must never appear in content.json; the
//                         client assembles it (see src/content/index.ts).
//                         Also -> ui{} (close-up navigation strings, §
//                         "Navigation copy (D-042a)", R-14/R-20).
//   TIMELINE.md         -> the two employer names to ban (its own "## <name>,
//                         <city>" headings), same convention as
//                         scripts/check-employer.sh.
//
// Design note on the strip's descriptor text: the actual source of truth is
// docs/content/TONE.md §"Employer descriptors" (D-014, amended), which
// defines exactly ONE literal current-employer form — "a $3B+ clean-energy
// company" -> "the company" after first mention — with no date-based
// variant. PANELS.md's own header (lines 8-11), not TONE.md, is where "a
// clean-energy company, now $3B+" comes from; the 2026-09-16 panel review's DW-1
// (2026-09-16) already flagged that header line as inconsistent with the
// body and it was never fully corrected, so 15 panels (bands 80-490) still
// carry the header's "now $3B+" wording instead of TONE.md's canonical
// form while the rest use the correct one. the 2026-09-24 panel check's
// "wrong descriptor" finding checked the latter panels against that same
// erroneous PANELS.md header instead of against TONE.md/D-014 — the
// mastermind has ruled that finding a false positive. This script parses
// the strip's descriptor field literally, whichever form it finds, and does
// not validate its wording — only that it contains neither employer name
// (checked globally, see checkNoEmployerNames below). The PANELS.md
// header/body split itself is a real, still-open R-04a inconsistency; per
// the brief's boundary rule, fixing the doc is the mastermind's job, not
// this pipeline's.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BandId = 80 | 150 | 220 | 360 | 490 | 610 | 750 | 'beyond';

export interface Strip {
  year: string;
  headcount: string;
  descriptor: string;
}

export interface Band {
  id: BandId;
  year: string | null;
  people: string | null;
  title: string;
  intro: string;
}

export interface PanelFields {
  id: string;
  title: string;
  strip: Strip;
  already: string;
  prevented: string;
  worthLater?: string;
  receipts: string[];
}

export interface Gag extends PanelFields {
  band: BandId;
  where: string;
  without: string;
  built: string;
}

export interface Translation {
  receipt: string;
  atScale: string;
}

export interface Beyond {
  panel: PanelFields;
  translation: Translation[];
}

export interface Copy {
  toggleToWithout: string;
  toggleToBuilt: string;
  nudge: string;
  shareCaption: string;
  ogTitle: string;
  ogDescription: string;
  sliderLabel: string;
  // Split, not joined: the client assembles the address (see
  // src/content/index.ts). The joined string must never appear in
  // content.json.
  contact: {
    linkedin: string;
    email: { user: string; domain: string };
  };
}

export interface Ambient {
  hover: string;
}

// D-042a close-up navigation strings (docs/content/TONE.md §"Navigation
// copy"), plus D-051's landing copy (§"Landing copy"). Signposts only,
// filled with {placeholders} by the web at render time — see parseUi below
// for which placeholders each key takes.
export interface Ui {
  intro: string;
  roomHint: string;
  wholeFloor: string;
  previous: string;
  next: string;
  position: string;
  zoomIn: string;
  atStart: string;
  atEnd: string;
  roomTab: string;
  roomTabName: string;
  announce: string;
  announceRoom: string;
  announceWithout: string;
  announceBuilt: string;
  loading: string;
  loadFailed: string;
  retry: string;
  readoutAtBand: string;
}

export interface ContentJson {
  bands: Band[];
  gags: Gag[];
  beyond: Beyond;
  copy: Copy;
  ui: Ui;
  ambient: Ambient;
}

export class ContentPipelineError extends Error {
  constructor(messages: string[]) {
    super(
      `content pipeline: ${messages.length} problem(s) found\n` +
        messages.map((m) => `  - ${m}`).join('\n'),
    );
    this.name = 'ContentPipelineError';
  }
}

// ---------------------------------------------------------------------------
// Small generic helpers
// ---------------------------------------------------------------------------

/** 1-based line number of `index` within `text`. Used for file:line errors. */
function lineOf(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text[i] === '\n') line++;
  }
  return line;
}

interface Section {
  heading: string;
  headingIndex: number;
  body: string;
}

/** Split `text` on every line matching `headingRe` (must be `^...$` with `m` and `g` flags). */
function splitOnHeadings(text: string, headingRe: RegExp): Section[] {
  const heads = [...text.matchAll(headingRe)];
  return heads.map((h, i) => {
    const start = h.index! + h[0].length;
    const end = i + 1 < heads.length ? heads[i + 1].index! : text.length;
    return { heading: h[1], headingIndex: h.index!, body: text.slice(start, end) };
  });
}

// A token made up entirely of punctuation — a free-standing em dash ("—"),
// en dash ("–"), middle dot ("·"), hyphen ("-") or arrow ("→"), or any run
// of those characters — is not a word. Matches the 2026-09-24 panel check's
// manual counting method, which does not count these as words either.
const PUNCTUATION_ONLY_TOKEN_RE = /^[—–·\-→]+$/;

export function countWords(s: string | undefined): number {
  if (!s) return 0;
  const withoutBackticks = s.replace(/`[^`]*`/g, ' ');
  return withoutBackticks
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !PUNCTUATION_ONLY_TOKEN_RE.test(token)).length;
}

// ---------------------------------------------------------------------------
// EVIDENCE.md -> valid E-xx ids
// ---------------------------------------------------------------------------

export function parseEvidenceIds(evidenceMd: string): Set<string> {
  const ids = new Set<string>();
  for (const m of evidenceMd.matchAll(/^\|\s*(E-\d+)\s*\|/gm)) {
    ids.add(m[1]);
  }
  return ids;
}

// ---------------------------------------------------------------------------
// TIMELINE.md -> employer names to ban
// ---------------------------------------------------------------------------

export function parseEmployerNames(timelineMd: string): string[] {
  const names: string[] = [];
  for (const m of timelineMd.matchAll(/^## (.+?),/gm)) {
    names.push(m[1]);
  }
  return names;
}

// ---------------------------------------------------------------------------
// BANDS-AND-GAGS.md
// ---------------------------------------------------------------------------

interface BandTableRow {
  id: BandId;
  year: string | null;
  people: string | null;
}

/** The "| **80** | 2018 | ~80 | ... |" table near the top of the doc. */
export function parseBandsTable(bandsMd: string): BandTableRow[] {
  const rows: BandTableRow[] = [];
  const rowRe = /^\|\s*\*\*(\d+|1,000\+)\*\*\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/gm;
  for (const m of bandsMd.matchAll(rowRe)) {
    if (m[1] === '1,000+') {
      rows.push({ id: 'beyond', year: m[2] === '—' ? null : m[2], people: m[3] === 'Beyond' ? null : m[3] });
    } else {
      rows.push({ id: Number(m[1]) as BandId, year: m[2], people: m[3] });
    }
  }
  return rows;
}

interface BandSection {
  id: number;
  year: string;
  title: string;
  intro: string;
  bodyStart: number;
  body: string;
}

/** The seven "## <id> · <year> · *title*" sections, with their gag blocks inside. */
function parseBandSections(bandsMd: string): BandSection[] {
  const headingRe = /^## (\d+) · (.+?) · \*(.+?)\*\s*$/gm;
  const sections = splitOnHeadings(bandsMd, headingRe as unknown as RegExp);
  const heads = [...bandsMd.matchAll(headingRe)];
  return sections.map((s, i) => {
    const h = heads[i];
    // intro = the paragraph before the first "### " gag heading (or end of section)
    const firstGag = s.body.search(/^### /m);
    const introRaw = firstGag === -1 ? s.body : s.body.slice(0, firstGag);
    const intro = introRaw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .join(' ')
      .trim();
    return { id: Number(h[1]), year: h[2], title: h[3], intro, bodyStart: s.headingIndex, body: s.body };
  });
}

interface SceneFields {
  id: string;
  bandId: number;
  headingIndex: number;
  where: string;
  without: string;
  built: string;
}

/** Per-gag scene bullets: Already (scene) / Without / Where. Keyed by gag id. */
export function parseBandsGagScenes(bandsMd: string): Map<string, SceneFields> {
  const sections = parseBandSections(bandsMd);
  const scenes = new Map<string, SceneFields>();
  const gagHeadRe = /^### (\S+) · ([^\n]+?)\s*$/gm;

  for (const section of sections) {
    const gagSections = splitOnHeadings(section.body, gagHeadRe as unknown as RegExp);
    const gagHeads = [...section.body.matchAll(gagHeadRe)];
    gagSections.forEach((g, i) => {
      const id = gagHeads[i][1];
      const bullets = parseSceneBullets(g.body);
      const missing = (['already', 'without', 'where'] as const).filter((k) => !bullets[k]);
      if (missing.length > 0) {
        throw new ContentPipelineError([
          `docs/content/BANDS-AND-GAGS.md:${lineOf(bandsMd, section.bodyStart + g.headingIndex)}: gag ${id} is missing bullet(s): ${missing.join(', ')}`,
        ]);
      }
      scenes.set(id, {
        id,
        bandId: section.id,
        headingIndex: section.bodyStart + g.headingIndex,
        where: bullets.where!,
        without: bullets.without!,
        built: bullets.already!,
      });
    });
  }
  return scenes;
}

function parseSceneBullets(body: string): Partial<Record<'already' | 'without' | 'where' | 'receipt', string>> {
  const lines = body.split('\n');
  const bullets: Record<string, string[]> = {};
  let current: string | null = null;
  for (const line of lines) {
    const bm = line.match(/^- \*\*(\w[\w ]*?):\*\* ?(.*)$/);
    if (bm) {
      current = bm[1].toLowerCase();
      bullets[current] = [bm[2]];
    } else if (current && line.trim() !== '') {
      bullets[current].push(line.trim());
    } else if (line.trim() === '') {
      current = null;
    }
  }
  const out: Partial<Record<'already' | 'without' | 'where' | 'receipt', string>> = {};
  for (const k of Object.keys(bullets)) {
    if (k === 'already' || k === 'without' || k === 'where' || k === 'receipt') {
      out[k] = bullets[k].join(' ').trim();
    }
  }
  return out;
}

/** Every gag id declared in BANDS-AND-GAGS.md (26, excludes the G3.A ambient). */
export function parseBandsGagIds(bandsMd: string): Map<string, number> {
  const sections = parseBandSections(bandsMd);
  const ids = new Map<string, number>();
  const gagHeadRe = /^### (\S+) ·/gm;
  for (const section of sections) {
    for (const m of section.body.matchAll(gagHeadRe)) {
      ids.set(m[1], section.id);
    }
  }
  return ids;
}

export function parseBandSectionsPublic(bandsMd: string): Array<{ id: number; year: string; title: string; intro: string }> {
  return parseBandSections(bandsMd).map(({ id, year, title, intro }) => ({ id, year, title, intro }));
}

// ---------------------------------------------------------------------------
// PANELS.md
// ---------------------------------------------------------------------------

/** Parse one panel body (after the "### ID · title" heading) into its fields. */
export function parsePanelBody(id: string, rawBody: string, sourceMd: string, blockStart: number): PanelFields {
  // The last panel in a band section is followed by the "---" horizontal
  // rule that separates it from the next "## <band>" heading, and
  // splitOnHeadings only cuts on "### "/"## " boundaries — so that rule
  // (and the blank lines around it) end up inside *this* block's body,
  // appended to its last beat. Strip a trailing rule before parsing beats,
  // so it doesn't get read as part of the prose or block the trailing
  // `E-xx` receipt-list regex (which requires the beat to *end* with a
  // backticked list).
  const body = rawBody.replace(/\n[ \t]*-{3,}[ \t]*\s*$/, '');
  const lines = body.split('\n');
  let idx = 0;
  while (idx < lines.length && lines[idx].trim() === '') idx++;
  const stripLine = (lines[idx] ?? '').trim();
  const stripMatch = stripLine.match(/^`(.+)`$/);
  if (!stripMatch) {
    throw new ContentPipelineError([
      `docs/content/PANELS.md:${lineOf(sourceMd, blockStart)}: panel ${id} does not open with a backticked strip line`,
    ]);
  }
  const stripParts = stripMatch[1].split(' · ');
  if (stripParts.length !== 3) {
    throw new ContentPipelineError([
      `docs/content/PANELS.md:${lineOf(sourceMd, blockStart)}: panel ${id}'s strip must have exactly 3 fields (year · headcount · descriptor), found ${stripParts.length}: "${stripMatch[1]}"`,
    ]);
  }
  const [year, headcount, descriptor] = stripParts;

  const rest = lines.slice(idx + 1).join('\n');
  const beatRe = /\*\*(Already|What it prevented|Worth it later):\*\*/g;
  const marks = [...rest.matchAll(beatRe)];
  const beatKey: Record<string, 'already' | 'prevented' | 'worthLater'> = {
    Already: 'already',
    'What it prevented': 'prevented',
    'Worth it later': 'worthLater',
  };
  const beats: Partial<Record<'already' | 'prevented' | 'worthLater', string>> = {};
  for (let i = 0; i < marks.length; i++) {
    const label = marks[i][1];
    const start = marks[i].index! + marks[i][0].length;
    const end = i + 1 < marks.length ? marks[i + 1].index! : rest.length;
    beats[beatKey[label]] = rest.slice(start, end).trim();
  }

  const missing: string[] = [];
  if (!beats.already) missing.push('Already');
  if (!beats.prevented) missing.push('What it prevented');
  if (missing.length > 0) {
    throw new ContentPipelineError([
      `docs/content/PANELS.md:${lineOf(sourceMd, blockStart)}: panel ${id} is missing beat(s): ${missing.join(', ')}`,
    ]);
  }

  // The trailing backticked receipt list belongs to whichever beat is last.
  let receiptsRaw = '';
  for (const key of ['worthLater', 'prevented', 'already'] as const) {
    const text = beats[key];
    if (text) {
      const m = text.match(/`([^`]+)`\s*$/);
      if (m) {
        receiptsRaw = m[1].trim();
        beats[key] = text.slice(0, m.index).trim();
      }
      break;
    }
  }

  let receipts: string[];
  const rangeMatch = receiptsRaw.match(/^E-(\d+)\s*…\s*E-(\d+)$/);
  if (rangeMatch) {
    const [, a, b] = rangeMatch;
    receipts = [];
    for (let n = Number(a); n <= Number(b); n++) receipts.push(`E-${String(n).padStart(2, '0')}`);
  } else {
    receipts = receiptsRaw.split(/\s+/).filter(Boolean);
  }

  for (const key of ['already', 'prevented', 'worthLater'] as const) {
    if (beats[key]) beats[key] = beats[key]!.replace(/\s+/g, ' ').trim();
  }

  return {
    id,
    title: '', // filled by caller, who has the heading title
    strip: { year, headcount, descriptor },
    already: beats.already!,
    prevented: beats.prevented!,
    ...(beats.worthLater ? { worthLater: beats.worthLater } : {}),
    receipts,
  };
}

function panelWordCount(p: PanelFields): number {
  return countWords(p.already) + countWords(p.prevented) + countWords(p.worthLater);
}

interface ParsedPanels {
  gagPanels: Map<string, { bandId: number; title: string; fields: PanelFields }>;
  beyond: Beyond;
  ambientHover: string;
}

export function parsePanelsMd(panelsMd: string): ParsedPanels {
  const allHeadRe = /^## (.+?)\s*$/gm;
  const sections = splitOnHeadings(panelsMd, allHeadRe as unknown as RegExp);

  const gagPanels = new Map<string, { bandId: number; title: string; fields: PanelFields }>();
  let beyond: Beyond | undefined;
  let ambientHover: string | undefined;
  const wordCountErrors: string[] = [];

  const panelHeadRe = /^### (\S+) · ([^\n]+?)\s*$/gm;

  for (const section of sections) {
    const bandMatch = section.heading.match(/^(\d+) · /);
    const beyondMatch = section.heading.match(/^1,000\+ · Beyond/);

    if (bandMatch) {
      const bandId = Number(bandMatch[1]);
      const blocks = splitOnHeadings(section.body, panelHeadRe as unknown as RegExp);
      const heads = [...section.body.matchAll(panelHeadRe)];
      blocks.forEach((b, i) => {
        const id = heads[i][1];
        const title = heads[i][2];
        const blockStart = section.headingIndex + b.headingIndex;
        const fields = parsePanelBody(id, b.body, panelsMd, blockStart);
        fields.title = title;
        if (panelWordCount(fields) > 110) {
          wordCountErrors.push(
            `docs/content/PANELS.md:${lineOf(panelsMd, blockStart)}: panel ${id} is ${panelWordCount(fields)} words (max 110, excluding strip/backticks/bold labels)`,
          );
        }
        gagPanels.set(id, { bandId, title, fields });
      });
    } else if (beyondMatch) {
      const blocks = splitOnHeadings(section.body, panelHeadRe as unknown as RegExp);
      const heads = [...section.body.matchAll(panelHeadRe)];
      const bIdx = heads.findIndex((h) => h[1] === 'B');
      if (bIdx === -1) {
        throw new ContentPipelineError([`docs/content/PANELS.md:${lineOf(panelsMd, section.headingIndex)}: Beyond section has no "### B" panel`]);
      }
      const blockStart = section.headingIndex + blocks[bIdx].headingIndex;
      let blockBody = blocks[bIdx].body;
      const checklistIdx = blockBody.indexOf('**Checklist translation column');
      const tableBody = checklistIdx === -1 ? '' : blockBody.slice(checklistIdx);
      if (checklistIdx !== -1) blockBody = blockBody.slice(0, checklistIdx);

      const fields = parsePanelBody('B', blockBody, panelsMd, blockStart);
      fields.title = heads[bIdx][2];
      if (panelWordCount(fields) > 110) {
        wordCountErrors.push(
          `docs/content/PANELS.md:${lineOf(panelsMd, blockStart)}: panel B is ${panelWordCount(fields)} words (max 110, excluding strip/backticks/bold labels)`,
        );
      }

      const translation: Translation[] = [];
      const rowRe = /^\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*$/gm;
      for (const m of tableBody.matchAll(rowRe)) {
        if (m[1] === 'Receipt' || /^-+$/.test(m[1].replace(/\|/g, '').trim())) continue;
        translation.push({ receipt: m[1], atScale: m[2] });
      }

      beyond = { panel: fields, translation };
    } else if (section.heading.startsWith('Ambient · G3.A')) {
      const m = section.body.match(/Hover text only: \*"([\s\S]+?)"\*/);
      if (!m) {
        throw new ContentPipelineError([`docs/content/PANELS.md:${lineOf(panelsMd, section.headingIndex)}: G3.A ambient hover text not found`]);
      }
      ambientHover = m[1].replace(/\s+/g, ' ').trim();
    }
  }

  if (wordCountErrors.length > 0) {
    throw new ContentPipelineError(wordCountErrors);
  }
  if (!beyond) {
    throw new ContentPipelineError(['docs/content/PANELS.md: no "## 1,000+ · Beyond" section found']);
  }
  if (!ambientHover) {
    throw new ContentPipelineError(['docs/content/PANELS.md: no "## Ambient · G3.A" section found']);
  }

  return { gagPanels, beyond, ambientHover };
}

// ---------------------------------------------------------------------------
// TONE.md -> copy{}
// ---------------------------------------------------------------------------

export function parseCopy(toneMd: string): Copy {
  const startIdx = toneMd.indexOf('## Toggle and share copy');
  if (startIdx === -1) {
    throw new ContentPipelineError(['docs/content/TONE.md: no "## Toggle and share copy" section found']);
  }
  const nextHeadingIdx = toneMd.indexOf('\n## ', startIdx + 1);
  const section = toneMd.slice(startIdx, nextHeadingIdx === -1 ? undefined : nextHeadingIdx);

  function extract(re: RegExp, label: string): string {
    const m = section.match(re);
    if (!m) {
      throw new ContentPipelineError([`docs/content/TONE.md: could not find "${label}" in §"Toggle and share copy"`]);
    }
    return m[1].trim();
  }

  const linkedinMatch = section.match(/LinkedIn:\s*`([^`]+)`/);
  if (!linkedinMatch) {
    throw new ContentPipelineError(['docs/content/TONE.md: could not find "Contact" LinkedIn URL in §"Toggle and share copy"']);
  }
  const emailMatch = section.match(/\*\*Contact[^`]*email\s*`([^@`]+)@([^`]+)`/);
  if (!emailMatch) {
    throw new ContentPipelineError(['docs/content/TONE.md: could not find "Contact" email in §"Toggle and share copy"']);
  }

  return {
    toggleToWithout: extract(/Toggle, built → without: \*\*"([^"]+)"\*\*/, 'toggleToWithout'),
    toggleToBuilt: extract(/Without → built: \*\*"([^"]+)"\*\*/, 'toggleToBuilt'),
    nudge: extract(/Nudge \(once, after the first slider move\): \*"([^"]+)"\*/, 'nudge'),
    shareCaption: extract(/Share caption: \*"([^"]+)"\*/, 'shareCaption'),
    ogTitle: extract(/OG title: \*([^*]+)\*/, 'ogTitle'),
    sliderLabel: extract(/Slider label: \*([^*]+)\*/, 'sliderLabel'),
    ogDescription: extract(/OG description \/ tagline[^*]*\*\*\s*\*([^*]+)\*/, 'ogDescription'),
    // Split, never joined — see the Copy.contact doc comment above.
    contact: {
      linkedin: linkedinMatch[1].trim(),
      email: { user: emailMatch[1].trim(), domain: emailMatch[2].trim() },
    },
  };
}

// ---------------------------------------------------------------------------
// TONE.md -> ui{} (D-042a close-up navigation strings, D-051 landing copy)
// ---------------------------------------------------------------------------

// Each key's expected {placeholder} set, alphabetised to match
// placeholdersOf's output below — the web fills these in at render time
// (docs/content/TONE.md §"Navigation copy" / §"Landing copy").
const UI_PLACEHOLDERS: Record<keyof Ui, string[]> = {
  intro: [],
  roomHint: [],
  wholeFloor: [],
  previous: [],
  next: [],
  position: ['label', 'n', 'total'],
  zoomIn: ['label'],
  atStart: [],
  atEnd: [],
  roomTab: ['count', 'room'],
  roomTabName: ['count', 'room'],
  announce: ['label', 'n', 'room', 'total'],
  announceRoom: ['room'],
  announceWithout: [],
  announceBuilt: [],
  loading: [],
  loadFailed: [],
  retry: [],
  readoutAtBand: ['n', 'year'],
};

// D-051's own section carries `intro`/`roomHint`; every other key still
// comes from D-042a's. Split so an unknown/duplicate/missing key error
// names the section it was actually found (or missing) in.
const LANDING_UI_KEYS = ['intro', 'roomHint'] as const;
const NAVIGATION_UI_KEYS = [
  'wholeFloor',
  'previous',
  'next',
  'position',
  'zoomIn',
  'atStart',
  'atEnd',
  'roomTab',
  'roomTabName',
  'announce',
  'announceRoom',
] as const;
// D-053's page-state copy: toggle live announcement, loading/failure, readout (DIA-194 U-10/U-11/U-17).
const PAGE_STATE_UI_KEYS = [
  'announceWithout',
  'announceBuilt',
  'loading',
  'loadFailed',
  'retry',
  'readoutAtBand',
] as const;

function placeholdersOf(copy: string): string[] {
  return [...new Set([...copy.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();
}

/** The `| \`key\` | \`copy\` | where |` table rows of TONE.md's `## <heading>`
 * section, checked against exactly `keys` — same strictness for both call
 * sites below: unknown, duplicate, empty or missing key fails the build. */
function parseUiSection(toneMd: string, heading: string, keys: readonly (keyof Ui)[]): Partial<Ui> {
  const startIdx = toneMd.indexOf(heading);
  if (startIdx === -1) {
    throw new ContentPipelineError([`docs/content/TONE.md: no "${heading}" section found`]);
  }
  const nextHeadingIdx = toneMd.indexOf('\n## ', startIdx + 1);
  const section = toneMd.slice(startIdx, nextHeadingIdx === -1 ? undefined : nextHeadingIdx);

  const errors: string[] = [];
  const found = new Map<string, string>();
  const rowRe = /^\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|/gm;
  for (const m of section.matchAll(rowRe)) {
    const [, key, value] = m;
    if (found.has(key)) {
      errors.push(`docs/content/TONE.md: ui.${key} is duplicated in §"${heading}"`);
      continue;
    }
    found.set(key, value);
    if (!keys.includes(key as keyof Ui)) {
      errors.push(`docs/content/TONE.md: unknown ui key "${key}" in §"${heading}"`);
      continue;
    }
    if (value.trim() === '') {
      errors.push(`docs/content/TONE.md: ui.${key} has empty copy in §"${heading}"`);
      continue;
    }
    const expected = UI_PLACEHOLDERS[key as keyof Ui];
    const actual = placeholdersOf(value);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      errors.push(
        `docs/content/TONE.md: ui.${key} has placeholders {${actual.join(',')}}, expected {${expected.join(',')}}`,
      );
    }
  }
  for (const key of keys) {
    if (!found.has(key)) {
      errors.push(`docs/content/TONE.md: ui.${key} is missing from §"${heading}"`);
    }
  }

  if (errors.length > 0) {
    throw new ContentPipelineError(errors);
  }

  const result: Partial<Ui> = {};
  for (const key of keys) result[key] = found.get(key)!;
  return result;
}

/** TONE.md's §"Landing copy (D-051)" and §"Navigation copy (D-042a)" tables, merged. */
export function parseUi(toneMd: string): Ui {
  return {
    ...parseUiSection(toneMd, '## Landing copy (D-051)', LANDING_UI_KEYS),
    ...parseUiSection(toneMd, '## Navigation copy (D-042a)', NAVIGATION_UI_KEYS),
    ...parseUiSection(toneMd, '## Page state copy (D-053)', PAGE_STATE_UI_KEYS),
  } as Ui;
}

// ---------------------------------------------------------------------------
// Cross-file validation
// ---------------------------------------------------------------------------

function checkGagPanelParity(
  bandsGagIds: Map<string, number>,
  panelIds: Map<string, { bandId: number }>,
): string[] {
  const errors: string[] = [];
  for (const id of bandsGagIds.keys()) {
    if (!panelIds.has(id)) {
      errors.push(`gag ${id} is in docs/content/BANDS-AND-GAGS.md but has no panel in docs/content/PANELS.md`);
    }
  }
  for (const id of panelIds.keys()) {
    if (!bandsGagIds.has(id)) {
      errors.push(`panel ${id} is in docs/content/PANELS.md but has no gag entry in docs/content/BANDS-AND-GAGS.md`);
    }
  }
  return errors;
}

function checkReceipts(evidenceIds: Set<string>, panelId: string, receipts: string[]): string[] {
  const errors: string[] = [];
  for (const r of receipts) {
    if (!evidenceIds.has(r)) {
      errors.push(`panel ${panelId} cites ${r}, which is not a row in docs/content/EVIDENCE.md`);
    }
  }
  return errors;
}

export function checkNoEmployerNames(content: ContentJson, employerNames: string[]): string[] {
  const serialized = JSON.stringify(content);
  const errors: string[] = [];
  for (const name of employerNames) {
    if (serialized.toLowerCase().includes(name.toLowerCase())) {
      errors.push(`forbidden employer name "${name}" appears in emitted content.json (R-33 / D-014)`);
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Minimal JSON Schema (2020-12 subset) validator — no dependency added.
// Covers: type, additionalProperties, required, properties, items, enum,
// pattern, minLength, $ref/$defs. That is the entire vocabulary
// src/content/schema.json uses.
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonSchema = any;

export function validateAgainstSchema(schema: JsonSchema, data: unknown, root: JsonSchema = schema, path = '$'): string[] {
  if (schema.$ref) {
    const refPath = (schema.$ref as string).replace('#/', '').split('/');
    let resolved: JsonSchema = root;
    for (const part of refPath) resolved = resolved[part];
    return validateAgainstSchema(resolved, data, root, path);
  }

  const errors: string[] = [];

  if (schema.enum) {
    if (!schema.enum.some((v: unknown) => v === data)) {
      errors.push(`${path}: expected one of ${JSON.stringify(schema.enum)}, got ${JSON.stringify(data)}`);
    }
    return errors;
  }

  const types: string[] = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  if (types.length > 0) {
    const actual = data === null ? 'null' : Array.isArray(data) ? 'array' : typeof data;
    if (!types.includes(actual)) {
      errors.push(`${path}: expected type ${types.join('|')}, got ${actual}`);
      return errors;
    }
  }

  if (schema.type === 'string' && typeof data === 'string') {
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      errors.push(`${path}: string shorter than minLength ${schema.minLength}`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(data)) {
      errors.push(`${path}: "${data}" does not match pattern ${schema.pattern}`);
    }
  }

  if (schema.type === 'object' && data && typeof data === 'object' && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    for (const req of schema.required ?? []) {
      if (!(req in obj)) errors.push(`${path}: missing required property "${req}"`);
    }
    for (const key of Object.keys(obj)) {
      const propSchema = schema.properties?.[key];
      if (propSchema) {
        errors.push(...validateAgainstSchema(propSchema, obj[key], root, `${path}.${key}`));
      } else if (schema.additionalProperties === false) {
        errors.push(`${path}: unexpected property "${key}"`);
      }
    }
  }

  if (schema.type === 'array' && Array.isArray(data)) {
    data.forEach((item, i) => {
      if (schema.items) errors.push(...validateAgainstSchema(schema.items, item, root, `${path}[${i}]`));
    });
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Top-level build
// ---------------------------------------------------------------------------

export interface BuildInputs {
  bandsMd: string;
  panelsMd: string;
  evidenceMd: string;
  toneMd: string;
  timelineMd: string;
  schema: JsonSchema;
}

export function buildContent(inputs: BuildInputs): ContentJson {
  const { bandsMd, panelsMd, evidenceMd, toneMd, timelineMd, schema } = inputs;

  const evidenceIds = parseEvidenceIds(evidenceMd);
  const employerNames = parseEmployerNames(timelineMd);
  const bandsTable = parseBandsTable(bandsMd);
  const bandSections = parseBandSectionsPublic(bandsMd);
  const bandsGagIds = parseBandsGagIds(bandsMd);
  const scenes = parseBandsGagScenes(bandsMd);
  const { gagPanels, beyond, ambientHover } = parsePanelsMd(panelsMd);
  const copy = parseCopy(toneMd);
  const ui = parseUi(toneMd);

  const errors: string[] = [];

  errors.push(...checkGagPanelParity(bandsGagIds, gagPanels));

  // bands[]
  const bands: Band[] = bandsTable.map((row) => {
    if (row.id === 'beyond') {
      const beyondSection = panelsMd.match(/^## 1,000\+ · Beyond · \*(.+?)\*/m);
      const title = beyondSection ? beyondSection[1] : 'Beyond';
      const introMatch = panelsMd.match(/^## 1,000\+ · Beyond[^\n]*\n\n([\s\S]*?)\n\n### /m);
      const intro = introMatch ? introMatch[1].replace(/\s+/g, ' ').trim() : '';
      return { id: 'beyond', year: row.year, people: row.people, title, intro };
    }
    const section = bandSections.find((s) => s.id === row.id);
    if (!section) {
      errors.push(`docs/content/BANDS-AND-GAGS.md: band ${row.id} is in the bands table but has no "## ${row.id} · ..." section`);
      return { id: row.id, year: row.year, people: row.people, title: '', intro: '' };
    }
    return { id: row.id, year: row.year, people: row.people, title: section.title, intro: section.intro };
  });

  // gags[]
  const gags: Gag[] = [];
  for (const [id, { bandId, title, fields }] of gagPanels) {
    errors.push(...checkReceipts(evidenceIds, id, fields.receipts));
    const scene = scenes.get(id);
    if (!scene) {
      // Already reported by checkGagPanelParity; skip to avoid a duplicate/undefined crash.
      continue;
    }
    gags.push({
      ...fields,
      title,
      band: bandId as BandId,
      where: scene.where,
      without: scene.without,
      built: scene.built,
    });
  }
  gags.sort((a, b) => {
    const bandOrder = (b: BandId) => (b === 'beyond' ? 999 : b);
    return bandOrder(a.band) - bandOrder(b.band) || a.id.localeCompare(b.id);
  });

  errors.push(...checkReceipts(evidenceIds, 'B', beyond.panel.receipts));

  const content: ContentJson = {
    bands,
    gags,
    beyond,
    copy,
    ui,
    ambient: { hover: ambientHover },
  };

  errors.push(...checkNoEmployerNames(content, employerNames));
  errors.push(...validateAgainstSchema(schema, content));

  if (errors.length > 0) {
    throw new ContentPipelineError(errors);
  }

  return content;
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

function isMainModule(): boolean {
  const arg1 = process.argv[1];
  if (!arg1) return false;
  try {
    return import.meta.url === new URL(`file://${arg1}`).href || import.meta.url === fileURLToPath(arg1);
  } catch {
    return false;
  }
}

function main(): void {
  // scripts/build-content.ts -> repo root
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(here, '..');
  const contentDir = join(repoRoot, 'docs', 'content');

  const bandsMd = readFileSync(join(contentDir, 'BANDS-AND-GAGS.md'), 'utf8');
  const panelsMd = readFileSync(join(contentDir, 'PANELS.md'), 'utf8');
  const evidenceMd = readFileSync(join(contentDir, 'EVIDENCE.md'), 'utf8');
  const toneMd = readFileSync(join(contentDir, 'TONE.md'), 'utf8');
  const timelineMd = readFileSync(join(contentDir, 'TIMELINE.md'), 'utf8');
  const schema = JSON.parse(readFileSync(join(repoRoot, 'src', 'content', 'schema.json'), 'utf8'));

  let content: ContentJson;
  try {
    content = buildContent({ bandsMd, panelsMd, evidenceMd, toneMd, timelineMd, schema });
  } catch (err) {
    if (err instanceof ContentPipelineError) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }

  const outDir = join(repoRoot, 'src', 'content');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'content.json');
  writeFileSync(outPath, JSON.stringify(content, null, 2) + '\n', 'utf8');
  console.log(`content pipeline: wrote ${outPath} (${content.gags.length} gags, ${content.bands.length} bands)`);
}

if (isMainModule()) {
  main();
}
