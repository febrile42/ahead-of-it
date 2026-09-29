// scripts/check-employer.sh (R-33, D-014): the employer names come from
// EMPLOYER_DENYLIST, never from the repo. These run the real script against
// throwaway dirs with a made-up name so no real name appears here either.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCRIPT = resolve(__dirname, 'check-employer.sh');
const NAME = 'Acme Widgets';

function workspace(files: Record<string, string>, { git = false } = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'check-employer-'));
  mkdirSync(join(dir, 'dist'));
  for (const [path, body] of Object.entries(files)) writeFileSync(join(dir, path), body);
  if (git) {
    const g = (...args: string[]) => spawnSync('git', args, { cwd: dir });
    g('init', '-q');
    g('add', '-A');
  }
  return dir;
}

function run(cwd: string, env: Record<string, string>) {
  const { PATH, HOME } = process.env;
  const r = spawnSync('bash', [SCRIPT], { cwd, env: { PATH, HOME, ...env }, encoding: 'utf8' });
  return { status: r.status, out: r.stdout + r.stderr };
}

describe('check-employer.sh', () => {
  it('skips with a warning when the list is unset outside CI', () => {
    const r = run(workspace({ 'dist/index.html': `<p>${NAME}</p>` }), {});
    expect(r.status).toBe(0);
    expect(r.out).toMatch(/not set — skipping/);
  });

  it('fails when the list is unset in CI', () => {
    const r = run(workspace({ 'dist/index.html': '<p>clean</p>' }), { CI: 'true' });
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/empty in CI/);
  });

  it('fails on a case-insensitive hit in dist and does not print the name', () => {
    const dir = workspace({ 'dist/index.html': '<p>clean</p>\n<p>ACME widgets</p>' });
    const r = run(dir, { CI: 'true', EMPLOYER_DENYLIST: `Other Co, ${NAME}` });
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/entry #2 found in dist/);
    expect(r.out).toMatch(/dist\/index\.html:2/);
    expect(r.out.toLowerCase()).not.toContain(NAME.toLowerCase());
  });

  it('fails on a hit in a tracked repo file outside dist', () => {
    const dir = workspace(
      { 'dist/index.html': '<p>clean</p>', 'NOTES.md': `worked at ${NAME}\n` },
      { git: true },
    );
    const r = run(dir, { EMPLOYER_DENYLIST: NAME });
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/entry #1 found in the repo:\n {2}NOTES\.md:1/);
  });

  it('passes a clean tree with a newline-separated list', () => {
    const dir = workspace({ 'dist/index.html': '<p>a clean-energy company</p>' }, { git: true });
    const r = run(dir, { CI: 'true', EMPLOYER_DENYLIST: `${NAME}\n  Other Co  \n` });
    expect(r.status).toBe(0);
    expect(r.out).toMatch(/clean — .*\(2 employer entries\)/);
  });
});

// PH3-05 (D-010): the internal project name is not sensitive like the
// employer names, so these tests use the real word and check it always
// runs, independent of EMPLOYER_DENYLIST.
describe('check-employer.sh — internal project name gate', () => {
  it('fails on a case-insensitive hit in dist content even with no employer list', () => {
    const dir = workspace({ 'dist/index.html': '<p>Occupancy build</p>' });
    const r = run(dir, {});
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/internal project name 'occupancy' found in dist content/);
    expect(r.out).toMatch(/dist\/index\.html:1/);
  });

  it('fails on a hit in a dist filename', () => {
    const dir = workspace({ 'dist/occupancy-manifest.json': '{}' });
    const r = run(dir, {});
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/internal project name 'occupancy' found in dist filenames/);
    expect(r.out).toMatch(/occupancy-manifest\.json/);
  });

  it('still fails on the internal name even when the employer list is clean', () => {
    const dir = workspace({ 'dist/index.html': '<p>Occupancy</p>' }, { git: true });
    const r = run(dir, { CI: 'true', EMPLOYER_DENYLIST: NAME });
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/internal project name 'occupancy' found in dist content/);
  });

  it('passes when neither the internal name nor an employer name is present', () => {
    const dir = workspace({ 'dist/index.html': '<p>clean</p>' });
    const r = run(dir, {});
    expect(r.status).toBe(0);
    expect(r.out).toMatch(/clean — no internal project name/);
  });
});
