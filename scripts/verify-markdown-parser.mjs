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

// ──────────────────────────────────────────────────────
// 5. The ISBN is judged, not just counted.
// ──────────────────────────────────────────────────────
// A placeholder passes "is there an isbn?", names a work nothing can match again, and splits the book: the one failure
// that ingests cleanly and is invisible afterwards. A wrong check digit is only a misprint, so it warns.
const ISBN_LINE = 'isbn: "978-0-00-000000-2"';
check('isbn fixture: the line the tests rewrite is present', clean.includes(ISBN_LINE));
const withIsbn = (value) => parseEnrichedMarkdown(clean.replace(ISBN_LINE, value === null ? '' : `isbn: ${value}`));
const isbnErrors = (r) => r.errors.filter((e) => /is not an ISBN/.test(e));
const isbnWarnings = (r) => r.warnings.filter((w) => /check digit/.test(w));

check('isbn: the well-formed fixture has no isbn error or warning', isbnErrors(base).length === 0 && isbnWarnings(base).length === 0);
for (const bad of [
  '[not printed on the provided chapter pages — please verify and fill in]',
  '978-93-5292-XXX-X   # TODO REPLACE — do NOT ingest until real',
  'TBD',
  'unknown',
  '12345',
  '97800000000',
]) {
  const r = withIsbn(bad);
  check(`isbn: placeholder/garbage is refused: ${JSON.stringify(bad.slice(0, 38))}`, isbnErrors(r).length === 1, r.errors.join(' | ') || '(parsed without error)');
}
for (const good of ['81-7450-518-0', '9788174505187', '978-93-5729-100-2', '"978 0 00 000000 2"']) {
  const r = withIsbn(good);
  check(`isbn: a valid ISBN is accepted: ${good}`, isbnErrors(r).length === 0 && isbnWarnings(r).length === 0, [...r.errors, ...r.warnings].join(' | '));
}
const misprint = withIsbn('978-0-00-000000-3');
check('isbn: a wrong check digit is only a warning, and says which digit', misprint.errors.length === 0 && isbnWarnings(misprint).some((w) => /should be 2/.test(w)), [...misprint.errors, ...misprint.warnings].join(' | '));
const noIsbn = withIsbn(null);
check('isbn: leaving the line out is still only a warning (the caller may supply it)', noIsbn.errors.length === 0 && noIsbn.warnings.some((w) => /No isbn/.test(w)), noIsbn.errors.join(' | '));

// ──────────────────────────────────────────────────────
// 6. The page markers are trustworthy, or the file is refused.
// ──────────────────────────────────────────────────────
// A chunk's page is the marker above it, and the range check cannot tell page 130 from 131. These are the cases that
// are wrong for certain (refused) and the ones that are only suspicious (reported).
const pageErrors = (r) => r.errors.filter((e) => /PAGE/.test(e));
const pageWarnings = (r) => r.warnings.filter((w) => /PAGE/.test(w));
const marker = (n) => `<!-- PAGE ${n} -->`;
check('pages: the well-formed fixture has no page error or warning', pageErrors(base).length === 0 && pageWarnings(base).length === 0, [...pageErrors(base), ...pageWarnings(base)].join(' | '));

const backwards = parseEnrichedMarkdown(clean.replace(marker(204), marker(202)));
check('pages: a marker that runs backwards is refused, naming both lines', backwards.errors.some((e) => /PAGE 202 \(line \d+\) comes after PAGE 203 \(line \d+\)/.test(e)), backwards.errors.join(' | ') || '(parsed without error)');

const noFirst = parseEnrichedMarkdown(clean.replace(marker(201), ''));
check('pages: text above the first marker is refused (it would be cited as page 1)', noFirst.errors.some((e) => /before the first <!-- PAGE N --> marker/.test(e)), noFirst.errors.join(' | ') || '(parsed without error)');

const noMarkers = parseEnrichedMarkdown(clean.replace(/<!-- PAGE \d+ -->/g, '').replace(/^chapter_pages:.*$/m, ''));
check('pages: a file with no markers is refused even when no range is declared', noMarkers.errors.some((e) => /No <!-- PAGE N --> marker anywhere/.test(e)), noMarkers.errors.join(' | ') || '(parsed without error)');

const skipped203 = parseEnrichedMarkdown(clean.replace(marker(203), ''));
check('pages: a skipped marker is reported, with the pages it jumps between', pageWarnings(skipped203).some((w) => /skip pages: 202 -> 204/.test(w)), skipped203.warnings.join(' | '));
check('pages: a skipped marker is a warning, not a refusal', pageErrors(skipped203).length === 0, skipped203.errors.join(' | '));

const twice = parseEnrichedMarkdown(clean.replace(marker(203), `${marker(203)}\n\n${marker(203)}`));
check('pages: a marker repeated is a warning, not a refusal', pageWarnings(twice).some((w) => /PAGE 203 is marked twice/.test(w)) && pageErrors(twice).length === 0, [...twice.errors, ...twice.warnings].join(' | '));

const widerRange = parseEnrichedMarkdown(clean.replace(/^chapter_pages:.*$/m, 'chapter_pages: 201-207'));
check('pages: markers that stop short of chapter_pages are reported', widerRange.warnings.some((w) => /markers run 201-206, but chapter_pages says 201-207/.test(w)), widerRange.warnings.join(' | '));

// The rewrite that exercises the new checks must not change what a CORRECT file produces.
check('pages: the new checks do not change the chunks of the well-formed fixture', JSON.stringify(textOf(parseEnrichedMarkdown(clean))) === JSON.stringify(textOf(base)));

// ──────────────────────────────────────────────────────
// 7. A chapter's question set is practice whatever the heading's capitalisation or number.
// ──────────────────────────────────────────────────────
// "exercises" (plural, no other word) is how NCERT's Democratic Politics titles every chapter's question set. The rule
// was /\b(exercise|…)\b/, which does not match the plural word, so those questions became answerable source text.
const classOfHeading = (heading) => {
  const doc = [
    '---', 'book_title: T', 'isbn: 978-0-00-000000-2', 'class_level: "9"', 'subject: Political Science',
    'chapter_number: 1', 'chapter_title: X', 'chapter_pages: 1-1', 'validation_status: PENDING', '---',
    '<!-- PAGE 1 -->', '', `## ${heading}`, '',
    '1. Which of the following is not an instance of an exercise of a democratic right? Parents send their children to school.',
  ].join('\n');
  return parseEnrichedMarkdown(doc).chunks[0]?.retrieval_class;
};
for (const h of ['exercises', 'Exercises', 'EXERCISES', 'Exercise', 'Exercise 1.1', 'Exercises and Activities', 'Questions', 'Let us enhance our learning']) {
  check(`practice heading: "${h}" is practice`, classOfHeading(h) === 'practice', `got ${classOfHeading(h)}`);
}
for (const h of ['Summary', 'Overview', 'Why define democracy?', 'Broader meanings of democracy']) {
  check(`ordinary heading: "${h}" stays reference`, classOfHeading(h) === 'reference', `got ${classOfHeading(h)}`);
}

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
