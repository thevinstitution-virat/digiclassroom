#!/usr/bin/env node
/**
 * Verifies chapter-batch.ts: the rules the upload page and the ingest route share for putting enriched-Markdown
 * chapters into a CHOSEN book.
 *
 * What is protected: the failure that cannot be seen afterwards. A chapter attached to the wrong book is indexed
 * cleanly, cited correctly, and answers as a different book. So every rule that decides "does this file belong to this
 * book" has a case here, and so does every way a set of files can overwrite or half-fill a book.
 *
 * Dependency-free, like verify-markdown-parser.mjs and verify-sparse-contract.mjs: no test framework is installed in
 * this repo; esbuild is already a dependency and is used here only to bundle the TypeScript (the module imports the
 * parser).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { build } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const contentDir = join(here, '..', 'packages', 'core', 'src', 'lib', 'content');

const out = await build({
  entryPoints: [join(contentDir, 'chapter-batch.ts')],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'neutral',
  logLevel: 'silent',
});
const mod = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const { normaliseIsbn, toIsbn13, normaliseEdition, identityMismatch, identityNotes, analyseChapterFile, sha256Hex, planChapterBatch, MAX_CHAPTER_BYTES } = mod;

const failures = [];
const pass = [];
const check = (label, ok, detail) => {
  if (ok) pass.push(label);
  else failures.push(`${label}${detail ? `\n    ${detail}` : ''}`);
};

// The synthetic well-formed chapter: ISBN 978-0-00-000000-2, edition "Fixture Edition, 2026", chapter 3, pages 201-206.
const fixture = readFileSync(join(contentDir, '__fixtures__', 'well-formed-chapter.md'), 'utf8');
const FX_ISBN = '978-0-00-000000-2';
const FX_EDITION = 'Fixture Edition, 2026';
const chapterFile = (n, over = {}) => {
  let t = fixture.replace(/^chapter_number:.*$/m, `chapter_number: ${n}`);
  if (over.isbn !== undefined) t = t.replace(/^isbn:.*$/m, over.isbn === null ? '' : `isbn: "${over.isbn}"`);
  if (over.edition !== undefined) t = t.replace(/^edition:.*$/m, over.edition === null ? '' : `edition: ${over.edition}`);
  if (over.status !== undefined) t = t.replace(/^validation_status:.*$/m, `validation_status: ${over.status}`);
  if (over.title !== undefined) t = t.replace(/^book_title:.*$/m, `book_title: ${over.title}`);
  return t;
};
const analyse = async (name, text, over = {}) => ({ ...analyseChapterFile(name, text), sha256: over.sha256 ?? (await sha256Hex(new TextEncoder().encode(text))) });
const book = (chapters = []) => ({ id: 'b1', title: 'Synthetic Fixture Reader', isbn: FX_ISBN, edition: FX_EDITION, chapters });

// ──────────────────────────────────────────────────────
// 1. Identity: when is a file the same book?
// ──────────────────────────────────────────────────────
check('isbn: hyphens and spaces are ignored, x is upper-cased', normaliseIsbn(' 81-7450-518-0 ') === '8174505180' && normaliseIsbn('080442957x') === '080442957X');
check('isbn: an ISBN-10 converts to the ISBN-13 of the same book', toIsbn13('81-7450-518-0') === '9788174505187', toIsbn13('81-7450-518-0'));
check('isbn: an ISBN-10 ending in X converts correctly', toIsbn13('080442957X') === '9780804429573', toIsbn13('080442957X'));
check('isbn: an ISBN-13 is returned as it is', toIsbn13('978-93-5729-100-2') === '9789357291002');
check('isbn: garbage converts to nothing', toIsbn13('[not printed]') === '' && toIsbn13('12345') === '');
check('edition: case and spacing do not make a different edition', normaliseEdition('  Reprint   2025-26 ') === normaliseEdition('reprint 2025-26'));

const B = { isbn: '978-93-5729-100-2', edition: 'Reprint 2025-26' };
check('identity: the same book matches', identityMismatch({ ...B }, B) === null);
check('identity: ISBN-10 and ISBN-13 of one book match', identityMismatch({ isbn: '81-7450-518-0', edition: null }, { isbn: '978-81-7450-518-7', edition: null }) === null);
check('identity: a different ISBN is refused, naming both', /ISBN is 978-0-00-000000-2 but .* is 978-93-5729-100-2/.test(identityMismatch({ isbn: '978-0-00-000000-2', edition: 'Reprint 2025-26' }, B) ?? ''), identityMismatch({ isbn: '978-0-00-000000-2', edition: null }, B) ?? '(null)');
check('identity: two different editions are refused', /edition is "2024" but .* "Reprint 2025-26"/.test(identityMismatch({ isbn: B.isbn, edition: '2024' }, B) ?? ''));
check('identity: a blank edition on one side is not a mismatch', identityMismatch({ isbn: B.isbn, edition: null }, B) === null && identityMismatch(B, { isbn: B.isbn, edition: null }) === null);
check('identity: a file with no ISBN cannot be checked, so it is refused', /no isbn/.test(identityMismatch({ isbn: null, edition: null }, B) ?? ''));
check('identity: a book with no ISBN on record cannot disagree', identityMismatch({ isbn: B.isbn, edition: null }, { isbn: null, edition: null }) === null);
check('notes: an edition being recorded is mentioned', identityNotes({ isbn: B.isbn, edition: 'Reprint 2025-26' }, { isbn: B.isbn, edition: null }).some((n) => /no edition on record/.test(n)));
check('notes: a different title is mentioned but is not a mismatch', identityNotes({ isbn: B.isbn, edition: null, title: 'Democratic Politics I' }, { isbn: B.isbn, edition: null, title: 'Democratic Politics' }).some((n) => /ISBN is what decides/.test(n)));

// ──────────────────────────────────────────────────────
// 2. One file
// ──────────────────────────────────────────────────────
const good = analyseChapterFile('ch3.md', chapterFile(3));
check('file: the well-formed chapter is read cleanly', good.errors.length === 0 && good.chapter === 3 && good.status === 'APPROVED', good.errors.join(' | '));
check('file: identity and pages come from the frontmatter and chunks', good.isbn === FX_ISBN && good.edition === FX_EDITION && good.pages?.first === 201 && good.pages?.last === 206, JSON.stringify({ isbn: good.isbn, edition: good.edition, pages: good.pages }));
check('file: chunks are counted by class, and practice is reported', good.chunks.total > 0 && good.chunks.practice > 0 && good.chunks.reference + good.chunks.practice === good.chunks.total, JSON.stringify(good.chunks));
check('file: a name that is not .md is refused without being read', analyseChapterFile('book.pdf', '%PDF-1.4').errors.some((e) => /not a \.md file/.test(e)));
check('file: a chapter over 5 MB is refused with its size', analyseChapterFile('big.md', 'x', MAX_CHAPTER_BYTES + 1).errors.some((e) => /5 MB per chapter/.test(e)));
check('file: text with no frontmatter is refused by the parser', analyseChapterFile('x.md', '# Just a heading\n\nSome text without any metadata block at all, long enough to matter.').errors.length > 0);
check('file: a missing chapter_number reads as null, not as 0 or NaN', analyseChapterFile('x.md', fixture.replace(/^chapter_number:.*$/m, '')).chapter === null);
check('file: an unapproved status is read upper-cased', analyseChapterFile('x.md', chapterFile(3, { status: 'pending' })).status === 'PENDING');
check('sha256: the same bytes give the same hash, different bytes a different one', (await sha256Hex(new TextEncoder().encode('a'))) === (await sha256Hex(new TextEncoder().encode('a'))) && (await sha256Hex(new TextEncoder().encode('a'))) !== (await sha256Hex(new TextEncoder().encode('b'))));
check('sha256: the value is correct (SHA-256 of "abc")', (await sha256Hex(new TextEncoder().encode('abc'))) === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');

// ──────────────────────────────────────────────────────
// 3. A set of files against an EXISTING book
// ──────────────────────────────────────────────────────
const f1 = await analyse('ch1.md', chapterFile(1));
const f2 = await analyse('ch2.md', chapterFile(2));
const f4 = await analyse('ch4.md', chapterFile(4));

const clean = planChapterBatch([f1, f2], { mode: 'existing', book: book() });
check('existing: two good new chapters can be uploaded, both are adds', clean.canUpload && clean.summary.add === 2 && clean.summary.blocked === 0, JSON.stringify(clean.summary));

const withOne = planChapterBatch([f2], { mode: 'existing', book: book([{ partIndex: 1, sha256: f1.sha256 }]) });
check('existing: a chapter after the last one adds with no gap', withOne.missingChapters.length === 0 && withOne.canUpload);

const gap = planChapterBatch([f4], { mode: 'existing', book: book([{ partIndex: 1, sha256: f1.sha256 }]) });
check('existing: skipping a chapter is reported as missing, not blocked', gap.missingChapters.join(',') === '2,3' && gap.canUpload, JSON.stringify(gap.missingChapters));

const same = planChapterBatch([f1], { mode: 'existing', book: book([{ partIndex: 1, sha256: f1.sha256 }]) });
check('existing: identical content is "unchanged" and there is nothing to upload', same.items[0].action === 'unchanged' && !same.canUpload, JSON.stringify(same.items[0]));

const changed = planChapterBatch([f1], { mode: 'existing', book: book([{ partIndex: 1, sha256: 'deadbeef' }]) });
check('existing: different content for an existing chapter is a replace, with a note', changed.items[0].action === 'replace' && changed.items[0].notes.some((n) => /Replaces the chapter 1/.test(n)) && changed.canUpload);

const wrongBook = planChapterBatch([await analyse('x.md', chapterFile(1, { isbn: '978-93-5729-100-2' }))], { mode: 'existing', book: book() });
check('existing: a chapter of another book is blocked and nothing can be uploaded', wrongBook.items[0].blocked && /different book/.test(wrongBook.items[0].reasons.join(' ')) && !wrongBook.canUpload, wrongBook.items[0].reasons.join(' | '));

const wrongEdition = planChapterBatch([await analyse('x.md', chapterFile(1, { edition: '2019 reprint' }))], { mode: 'existing', book: book() });
check('existing: a different edition is blocked', wrongEdition.items[0].blocked && /edition/.test(wrongEdition.items[0].reasons.join(' ')));

const noIsbn = planChapterBatch([await analyse('x.md', chapterFile(1, { isbn: null }))], { mode: 'existing', book: book() });
check('existing: a file with no ISBN is blocked, since it cannot be checked', noIsbn.items[0].blocked);

const unapproved = planChapterBatch([await analyse('x.md', chapterFile(1, { status: 'PENDING' }))], { mode: 'existing', book: book() });
check('existing: a chapter that is not APPROVED is blocked, saying why', unapproved.items[0].blocked && /not APPROVED/.test(unapproved.items[0].reasons.join(' ')));

const dup = planChapterBatch([f2, await analyse('ch2-copy.md', chapterFile(2) + '\n<!-- a different byte -->\n')], { mode: 'existing', book: book() });
check('existing: two files for one chapter block the second, naming the first', !dup.items[0].blocked && dup.items[1].blocked && /"ch2.md" is also chapter 2/.test(dup.items[1].reasons.join(' ')) && !dup.canUpload, dup.items[1].reasons.join(' | '));

const noChapter = planChapterBatch([await analyse('x.md', chapterFile(1).replace(/^chapter_number:.*$/m, ''))], { mode: 'existing', book: book() });
check('existing: a file with no chapter_number is blocked', noChapter.items[0].blocked && /No chapter_number/.test(noChapter.items[0].reasons.join(' ')));

const mixed = planChapterBatch([f1, await analyse('x.md', chapterFile(2, { isbn: '978-93-5729-100-2' }))], { mode: 'existing', book: book() });
check('existing: one bad file blocks the whole upload (the set sent is the set reviewed)', mixed.summary.blocked === 1 && mixed.summary.add === 1 && !mixed.canUpload);

const parserBad = planChapterBatch([await analyse('x.md', '# no frontmatter at all, just some words that go on for a while')], { mode: 'existing', book: book() });
check('existing: a file the parser refuses is blocked with the parser\'s reason', parserBad.items[0].blocked && parserBad.items[0].reasons.length > 0 && !parserBad.canUpload);

check('existing: an empty set cannot be uploaded', !planChapterBatch([], { mode: 'existing', book: book() }).canUpload);

const edNote = planChapterBatch([f1], { mode: 'existing', book: { ...book(), edition: null } });
check('existing: an edition the book lacks is a note, not a block', edNote.canUpload && edNote.items[0].notes.some((n) => /no edition on record/.test(n)));

// ──────────────────────────────────────────────────────
// 4. A set of files for a NEW book
// ──────────────────────────────────────────────────────
const fresh = planChapterBatch([f1, f2], { mode: 'new' });
check('new: files that agree make a book, whose identity is read from the first', fresh.canUpload && fresh.identity?.isbn === FX_ISBN && fresh.identity?.edition === FX_EDITION && fresh.identity?.title === 'Synthetic Fixture Reader', JSON.stringify(fresh.identity));

const split = planChapterBatch([f1, await analyse('other.md', chapterFile(2, { isbn: '978-93-5729-100-2' }))], { mode: 'new' });
check('new: a file from another book in the same set is blocked', split.items[1].blocked && /not all from one book/.test(split.items[1].reasons.join(' ')) && !split.canUpload, split.items[1].reasons.join(' | '));

const noId = planChapterBatch([await analyse('x.md', chapterFile(1, { isbn: null }))], { mode: 'new' });
check('new: a book cannot be created without an ISBN', noId.items[0].blocked && !noId.canUpload && noId.identity === null);

const exists = planChapterBatch([f1], { mode: 'new', knownBooks: [book()] });
check('new: if that ISBN and edition already exist, you are told to select the book', !exists.canUpload && exists.problems.some((p) => /already exists: "Synthetic Fixture Reader"/.test(p)), JSON.stringify(exists.problems));

const otherEdition = planChapterBatch([f1], { mode: 'new', knownBooks: [{ ...book(), edition: '2019 reprint' }] });
check('new: the same ISBN in a different edition is a new book, not a clash', otherEdition.canUpload && otherEdition.problems.length === 0);

// ──────────────────────────────────────────────────────
console.log(`\nchapter-batch: ${pass.length} passed, ${failures.length} failed`);
if (failures.length) {
  console.error('\nFAILED:');
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
for (const p of pass) console.log(`  ✓ ${p}`);
console.log('');
