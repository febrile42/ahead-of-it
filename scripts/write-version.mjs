#!/usr/bin/env node
// DIA-103: stamps dist/version.json with the commit the build was made from,
// so anyone can tell which commit a served build is (`curl <host>/version.json`)
// without rebuilding locally. Not linked from the page (R-33-adjacent: it is
// build metadata, not served content, but check:employer and check:serving
// still run against it like anything else under dist/).
//
// CI sets GITHUB_SHA/GITHUB_REF_NAME; locally there is no such env, so this
// falls back to `git rev-parse`. Chained inside the `build` script after
// `vite build` (not a separate `postbuild` hook), both because writing any
// earlier would just have it wiped by Vite's emptyOutDir, and because
// check:employer/check:serving run later in that same script and must see it.
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

const sha = process.env.GITHUB_SHA || git(['rev-parse', 'HEAD']);
const shortSha = process.env.GITHUB_SHA ? sha.slice(0, 7) : git(['rev-parse', '--short', 'HEAD']);
const ref = process.env.GITHUB_REF_NAME || git(['rev-parse', '--abbrev-ref', 'HEAD']);

const version = {
  sha,
  shortSha,
  builtAt: new Date().toISOString(),
  ref,
};

writeFileSync('dist/version.json', JSON.stringify(version, null, 2) + '\n', 'utf8');
console.log(`write-version: dist/version.json -> ${shortSha} (${ref})`);
