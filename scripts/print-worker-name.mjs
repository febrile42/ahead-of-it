#!/usr/bin/env node
// Prints the Worker's `name` from wrangler.jsonc, so CI can compose a
// workers.dev host without ever repeating that name as a second literal —
// renaming the Worker in wrangler.jsonc is then the only edit needed.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const configPath = join(here, '..', 'wrangler.jsonc');
const raw = readFileSync(configPath, 'utf8');

// Strip JSONC's // and /* */ comments; wrangler.jsonc has no string values
// containing "//", so a per-line strip is safe here.
const stripped = raw
  .split('\n')
  .map((line) => line.replace(/\/\/.*$/, ''))
  .join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const { name } = JSON.parse(stripped);
if (!name) {
  console.error('wrangler.jsonc has no "name" field.');
  process.exit(1);
}
process.stdout.write(name);
