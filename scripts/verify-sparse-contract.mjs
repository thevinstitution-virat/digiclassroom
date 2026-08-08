#!/usr/bin/env node
/**
 * Verifies sparse-tokenizer.ts still produces exactly what
 * sparse-tokenizer.fixture.json records.
 *
 * The sparse tokenizer is a cross-repo contract: DCP builds document-side
 * vectors at ingest, PDLMS/Varta builds query-side vectors at search time. If
 * either side's normalization or hashing drifts by one step, sparse retrieval
 * degrades silently — no exception, no log line, just worse answers that look
 * like a model problem. This test is the tripwire.
 *
 * DCP can drift from its own contract as easily as PDLMS can, which is why this
 * runs in DCP's CI and not only in PDLMS's.
 *
 * Deliberately dependency-free: no test framework is installed in this repo, and
 * adding one to guard a single pure function is not worth the lockfile churn.
 * esbuild is already a dependency and is used only to strip the type
 * annotations.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { transform } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const ragDir = join(here, '..', 'packages', 'core', 'src', 'lib', 'ai', 'rag');

const source = readFileSync(join(ragDir, 'sparse-tokenizer.ts'), 'utf8');
const fixture = JSON.parse(readFileSync(join(ragDir, 'sparse-tokenizer.fixture.json'), 'utf8'));

const { code } = await transform(source, { loader: 'ts', format: 'esm' });
const mod = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

const failures = [];
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) failures.push(`${label}\n    expected ${e}\n    actual   ${a}`);
};

if (mod.MIN_TOKEN_LENGTH !== fixture.minTokenLength) {
  failures.push(`MIN_TOKEN_LENGTH: expected ${fixture.minTokenLength}, actual ${mod.MIN_TOKEN_LENGTH}`);
}

for (const [term, expected] of Object.entries(fixture.termIndex)) {
  const tokens = mod.tokenizeForSparse(term);
  check(`tokenizeForSparse(${JSON.stringify(term)})`, tokens, expected.tokens);
  check(`hashTerm of ${JSON.stringify(term)}`, tokens.map(mod.hashTerm), expected.indices);
}

for (const [sentence, expected] of Object.entries(fixture.sentences)) {
  check(`buildSparseVector(${JSON.stringify(sentence)})`, mod.buildSparseVector(sentence), expected);
}

if (failures.length > 0) {
  console.error(`\n✗ Sparse tokenizer contract VIOLATED — ${failures.length} mismatch(es):\n`);
  for (const f of failures) console.error(`  • ${f}\n`);
  console.error(
    'Both DCP and PDLMS/Varta build sparse vectors with this algorithm. Changing it\n' +
      'without regenerating the fixture AND updating PDLMS silently breaks hybrid retrieval.\n',
  );
  process.exit(1);
}

const cases = Object.keys(fixture.termIndex).length + Object.keys(fixture.sentences).length;
console.log(`✓ Sparse tokenizer contract holds (${cases} cases).`);
