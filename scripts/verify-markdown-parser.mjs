#!/usr/bin/env node
/**
 * Verifies markdown-ingest-parser.ts against a WELL-FORMED chapter.
 *
 * Every test this parser had before ran against one real chapter that is
 * malformed in four independent ways — escaped bytes, 24 unclosed blocks, 5
 * missing page tags, 2 en-dashes. Behaviour was therefore tuned to a broken
 * file, and "it handles ch8" said nothing about whether it handles a correct
 * one. `__fixtures__/well-formed-chapter.md` is the correct one: every block
 * type in the prep skill's spec, properly closed, properly page-tagged,
 * provenance-marked, and clean on the linter (0 errors, 0 warnings).
 *
 * The four properties asserted here are the ones whose failure is INVISIBLE
 * downstream — a moved chunk boundary is a moved citation, and nothing further
 * along the pipeline can tell that it moved.
 *
 * Deliberately dependency-free, same as verify-sparse-contract.mjs: no test
 * framework is installed in this repo and esbuild is already a dependency,
 * used here only to strip type annotations.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { transform } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const contentDir = join(here, '..', 'packages', 'core', 'src', 'lib', 'content');

// argv[2] overrides the parser under test. That is how these assertions were
// shown to FAIL before they were trusted to pass — point it at the previous
// revision (`git show HEAD:...`) and every property below reports red.
const parserPath = process.argv[2] ?? join(contentDir, 'markdown-ingest-parser.ts');
const source = readFileSync(parserPath, 'utf8');
const { code } = await transform(source, { loader: 'ts', format: 'esm' });
const mod = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const { parseEnrichedMarkdown } = mod;
const normalizeEscapes = mod.normalizeEscapes ?? ((s) => ({ text: s, removed: 0 }));

const FIXTURE = join(contentDir, '__fixtures__', 'well-formed-chapter.md');
const clean = readFileSync(FIXTURE, 'utf8');

const failures = [];
const pass = [];
const check = (label, ok, detail) => {
  if (ok) pass.push(label);
  else failures.push(`${label}${detail ? `\n    ${detail}` : ''}`);
};

const implicitWarnings = (r) => r.warnings.filter((w) => /boundary GUESSED/.test(w));
const strayWarnings = (r) => r.warnings.filter((w) => /closes nothing/.test(w));

// ───────────────────────────────────────────────────────────────────────────
// 1. The well-formed fixture parses cleanly.
// ───────────────────────────────────────────────────────────────────────────
const base = parseEnrichedMarkdown(clean);

check('parser exports normalizeEscapes', typeof mod.normalizeEscapes === 'function');
check('fixture: no parse errors', base.errors.length === 0, base.errors.join(' | '));
check(
  'fixture: ZERO implicit-close warnings',
  implicitWarnings(base).length === 0,
  implicitWarnings(base).join('\n    '),
);
check('fixture: no stray-closer warnings', strayWarnings(base).length === 0, strayWarnings(base).join('\n    '));
check('fixture: no escapes to remove', normalizeEscapes(clean).removed === 0);

// Every block type in the spec survives as its own atomic chunk.
const EXPECTED_TYPES = [
  'figure', 'table', 'graph', 'case_study', 'glossary_term',
  'feature', 'qr_code', 'dialogue', 'discussion_prompt', 'suggested_activity',
];
const seen = new Set(base.chunks.map((c) => c.metadata.content_type));
for (const t of EXPECTED_TYPES) {
  check(`fixture: [${t}] is its own chunk`, seen.has(t), `types present: ${[...seen].join(', ')}`);
}

// Atomic means the block's text is the block and nothing else. A glossary
// definition that carries the next paragraph is the exact defect that made
// GLOSSARY TERM worth adding to the opener table.
for (const c of base.chunks) {
  if (c.metadata.content_type === 'text') continue;
  const tag = c.text.match(/^\[([A-Z][A-Z_ ]*?)(?:\s+[\d.]+)?\s*(?:\||\])/)?.[1].trim();
  check(
    `atomic: [${tag}] chunk ends at its own closing tag`,
    new RegExp(`\\[/${tag}\\]$`).test(c.text.trim()),
    `tail: ${JSON.stringify(c.text.slice(-70))}`,
  );
}

// Practice classification, by block type and by section title.
const practice = base.chunks.filter((c) => c.retrieval_class === 'practice');
check(
  'fixture: prompts and activities are practice',
  practice.some((c) => c.metadata.content_type === 'discussion_prompt') &&
    practice.some((c) => c.metadata.content_type === 'suggested_activity'),
  practice.map((c) => c.metadata.content_type).join(', '),
);
check(
  'fixture: the exercises section is practice prose',
  practice.some((c) => c.metadata.content_type === 'text' && /Questions and activities/.test(c.metadata.section_title)),
);
check(
  'fixture: the Summary section is NOT practice',
  base.chunks.some((c) => /^Summary$/.test(c.metadata.section_title) && c.retrieval_class === 'reference'),
);

// Pages: inside the declared range, and genuinely spread across it.
const pages = [...new Set(base.chunks.map((c) => c.metadata.page))].sort((a, b) => a - b);
check('fixture: every page inside 201-206', pages.every((p) => p >= 201 && p <= 206), pages.join(','));
check('fixture: pages span the range, not one value', pages.length >= 5, pages.join(','));
check(
  'fixture: a block Page N-M range is read as a range',
  base.chunks.some((c) => c.metadata.content_type === 'case_study' && c.metadata.page === 204 && c.metadata.pageEndNumber === 205),
);
check('fixture: the SKIP region is recorded', base.skipped.length === 1, JSON.stringify(base.skipped));

// ───────────────────────────────────────────────────────────────────────────
// 2. A deliberately unclosed block warns — with the RIGHT line number.
// ───────────────────────────────────────────────────────────────────────────
const lines = clean.split('\n');
const graphOpenIdx = lines.findIndex((l) => l.startsWith('[GRAPH '));
const graphCloseIdx = lines.findIndex((l) => l.trim() === '[/GRAPH]');
const unclosedLines = lines.filter((_, i) => i !== graphCloseIdx);
// The opener sits before the removed closer, so its own line number is unchanged.
const expectedLine = graphOpenIdx + 1;
const unclosed = parseEnrichedMarkdown(unclosedLines.join('\n'));

const uw = implicitWarnings(unclosed);
check('unclosed: exactly one implicit-close warning', uw.length === 1, uw.join('\n    '));
check(
  `unclosed: warning names the opening line (${expectedLine})`,
  uw.length === 1 && uw[0].includes(`opened at line ${expectedLine}`),
  uw[0] ?? '(no warning at all — the guess was SILENT)',
);
check(
  'unclosed: warning names the block and the guessed boundary',
  uw.length === 1 && /\[GRAPH\]/.test(uw[0]) && /boundary GUESSED at line \d+/.test(uw[0]),
  uw[0],
);
// Verify the file really is line-shifted the way the assertion assumes.
check(
  'unclosed: the [/GRAPH] line is the only difference',
  unclosedLines.length === lines.length - 1 && lines[graphCloseIdx].trim() === '[/GRAPH]',
);

// ───────────────────────────────────────────────────────────────────────────
// 3. A stray closing tag contaminates NOTHING. Asserted on chunk text.
// ───────────────────────────────────────────────────────────────────────────
// Inserted mid-paragraph, in prose, far from any real block: the position where
// it used to be silently accumulated into the surrounding chunk.
const proseIdx = lines.findIndex((l) => l.startsWith('things it hopes to buy later.'));
const strayLines = [...lines];
strayLines.splice(proseIdx + 1, 0, '[/TABLE]');
const stray = parseEnrichedMarkdown(strayLines.join('\n'));

const sw = strayWarnings(stray);
check('stray: warned about, not swallowed', sw.length === 1 && /\[\/TABLE\]/.test(sw[0]), sw.join(' | '));
check(
  'stray: no chunk text contains the stray tag outside a real TABLE block',
  stray.chunks.every((c) => c.metadata.content_type === 'table' || !c.text.includes('[/TABLE]')),
  stray.chunks
    .filter((c) => c.metadata.content_type !== 'table' && c.text.includes('[/TABLE]'))
    .map((c) => `${c.metadata.content_type}: ${JSON.stringify(c.text.slice(0, 120))}`)
    .join('\n    '),
);
// The strongest form: byte-identical output to the clean run. Anything the stray
// tag disturbed — text, boundaries, ordering — shows up here.
const textOf = (r) => r.chunks.map((c) => `${c.metadata.content_type}|${c.metadata.page}|${c.text}`);
check(
  'stray: chunk text is byte-identical to the clean parse',
  JSON.stringify(textOf(stray)) === JSON.stringify(textOf(base)),
  firstDiff(textOf(base), textOf(stray)),
);

// ───────────────────────────────────────────────────────────────────────────
// 4. Escaping tolerance: escaped bytes produce identical chunks.
// ───────────────────────────────────────────────────────────────────────────
// The bytes that arrive are the bytes that get indexed, so this property has to
// hold in the parser permanently, regardless of what the prep side emits.
const escaped = clean.replace(/([[\]_*#\-])/g, '\\$1');
const norm = normalizeEscapes(escaped);
check('escaped: the normalizer has something to remove', norm.removed > 0, String(norm.removed));
check('escaped: normalizing restores the original bytes', norm.text === clean);

const fromEscaped = parseEnrichedMarkdown(escaped);
check(
  'escaped: chunk text is byte-identical to the clean parse',
  JSON.stringify(textOf(fromEscaped)) === JSON.stringify(textOf(base)),
  firstDiff(textOf(base), textOf(fromEscaped)),
);
check(
  'escaped: ZERO implicit-close warnings (blocks still recognised)',
  implicitWarnings(fromEscaped).length === 0,
  implicitWarnings(fromEscaped).join('\n    '),
);
check(
  'escaped: the escaping itself is reported, not hidden',
  fromEscaped.warnings.some((w) => /markdown escape\(s\) removed/.test(w)),
  fromEscaped.warnings.join(' | '),
);
// A backslash inside a fenced code block is content, not syntax.
const fenced = '```\nC:\\Users\\x\n```';
check('escaped: fenced code is left alone', normalizeEscapes(fenced).text === fenced);

function firstDiff(a, b) {
  if (a.length !== b.length) return `chunk count ${a.length} vs ${b.length}`;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return `chunk ${i}\n    expected ${JSON.stringify(a[i].slice(0, 160))}\n    actual   ${JSON.stringify(b[i].slice(0, 160))}`;
  }
  return '';
}

// ───────────────────────────────────────────────────────────────────────────
console.log(`\nmarkdown-ingest-parser: ${pass.length} passed, ${failures.length} failed`);
if (failures.length) {
  console.error('\nFAILED:');
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
for (const p of pass) console.log(`  ✓ ${p}`);
console.log('');
