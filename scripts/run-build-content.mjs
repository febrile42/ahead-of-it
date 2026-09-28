#!/usr/bin/env node
// Runs scripts/build-content.ts without adding a TS-execution dependency
// (no tsx/ts-node — the dependency allowlist is vite, typescript,
// vitest, @playwright/test, wrangler only).
//
// Why this exists: build-content.ts is plain TypeScript with type-only
// annotations (isolatedModules-safe, no enums/namespaces), so it is a
// perfect candidate for Node's native `--experimental-strip-types` — except
// this repo is exercised on Node 20 as well as the pinned Node 22
// (`.nvmrc`; see PH1-01-REVIEW.md "Node 22 vs 20": the whole toolchain was
// deliberately kept Node-20-clean), and Node 20 has no type-stripping at
// all. So this uses the `typescript` package already in devDependencies —
// the same compiler `tsc` type-checks the rest of the repo with — to erase
// the types (isolated single-file transpile, matching tsconfig's
// `isolatedModules: true`), writes the result next to the source (so
// build-content.ts's own `dirname(import.meta.url)` -> repo-root math is
// unaffected), runs it with plain `node`, and deletes it again.
import ts from 'typescript';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const srcPath = join(here, 'build-content.ts');
const outPath = join(here, '.build-content.generated.mjs');

const source = readFileSync(srcPath, 'utf8');
const { outputText, diagnostics } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  },
  fileName: srcPath,
  reportDiagnostics: true,
});

if (diagnostics && diagnostics.length > 0) {
  const formatted = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCurrentDirectory: () => here,
    getCanonicalFileName: (f) => f,
    getNewLine: () => '\n',
  });
  console.error(formatted);
  process.exit(1);
}

writeFileSync(outPath, outputText, 'utf8');

let result;
try {
  result = spawnSync(process.execPath, [outPath], { stdio: 'inherit' });
} finally {
  rmSync(outPath, { force: true });
}

process.exit(result.status ?? 1);
