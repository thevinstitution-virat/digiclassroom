#!/usr/bin/env node
/**
 * Runs the SQL behind the chapter-upload page against a REAL Postgres built from the trio migrations.
 *
 * Why: that SQL (which books exist, which chapters each has, whether a chapter is live, which source reference a chosen
 * book is attached through) decides where a chapter is stored. A typo in it is not caught by types and does not look
 * wrong in a test with a fake database, so it is run for real.
 *
 *   CONTENT_DATABASE_URL=postgres://postgres:...@127.0.0.1:5432/trio node scripts/verify-content-works.mjs
 *
 * Skips with a notice when the variable is unset (CI has no database), like the Book Buddy integration spec. Everything
 * happens inside one transaction that is rolled back, so nothing is left behind, even on a database with real data.
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const url = process.env.CONTENT_DATABASE_URL;
if (!url) {
  console.log('verify-content-works: skipped (set CONTENT_DATABASE_URL to a trio database with the migrations applied).');
  process.exit(0);
}

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, '..', 'package.json'));
const { Client } = require('pg');

const out = await build({
  entryPoints: [join(here, '..', 'packages', 'core', 'src', 'lib', 'db', 'content-works.ts')],
  bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
});
const { listWorks, getBook, listBooksWithIsbn, ensureWorkSourceRef } = await import(
  `data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`
);

// The identity resolver, bundled with its database connection swapped for the test's own (see "attach" below).
const stubConnection = {
  name: 'stub-content-connection',
  setup(b) {
    b.onResolve({ filter: /content-connection$/ }, () => ({ path: 'stub-content-connection', namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
      loader: 'js',
      contents: `export const getContentPool = () => globalThis.__verifyPool;`,
    }));
  },
};
const idOut = await build({
  entryPoints: [join(here, '..', 'packages', 'core', 'src', 'lib', 'db', 'content-identity.ts')],
  bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent', plugins: [stubConnection],
});
const { resolveOrCreateContentItem } = await import(`data:text/javascript;base64,${Buffer.from(idOut.outputFiles[0].text).toString('base64')}`);

const failures = [];
const pass = [];
const check = (label, ok, detail) => {
  if (ok) pass.push(label);
  else failures.push(`${label}${detail ? `\n    ${detail}` : ''}`);
};

const db = new Client({ connectionString: url });
await db.connect();
await db.query('BEGIN');
try {
  const one = async (sql, params) => (await db.query(sql, params)).rows[0];
  const item = (title, kind, isbn, edition) =>
    one(`INSERT INTO content.content_item (title, kind, isbn, edition) VALUES ($1, $2, $3, $4) RETURNING id`, [title, kind, isbn, edition]);
  const ref = (id, app, local) => db.query(`INSERT INTO content.content_source_ref (content_item_id, app, local_id) VALUES ($1, $2, $3)`, [id, app, local]);
  const asset = (id, role, part, sha, label) =>
    one(
      `INSERT INTO content.content_asset (content_item_id, role, part_index, part_label, variant, storage_account, storage_uri, asset_sha256, bytes, page_count)
       VALUES ($1, $2, $3, $4, 'default', 'digiclassroom-pro', $5, $6, 1234, 17) RETURNING id`,
      [id, role, part, label ?? null, `r2://x/${role}-${part}-${sha}.md`, sha],
    );
  const run = (id, assetId, status, chunks, error, startedAgo) =>
    db.query(
      `INSERT INTO content.ingest_run (content_item_id, content_asset_id, source_app, embedding_model, embedding_dim, status, chunk_count, error, started_at, completed_at, forced)
       VALUES ($1, $2, 'digiclassroom', 'text-embedding-3-large', 3072, $3, $4, $5, now() - ($6 || ' minutes')::interval, now() - ($6 || ' minutes')::interval, false)`,
      [id, assetId, status, chunks, error, String(startedAgo)],
    );

  // A: two chapters. Chapter 1 is live. Chapter 2 was live, then a re-upload FAILED, so its latest run is failed but the
  // earlier version is still the one that is searchable.
  const A = await item('Zzz Democratic Politics', 'book', '978-93-5729-100-2', 'Reprint 2025-26');
  await ref(A.id, 'pdlms', 'pdlms-book-1');
  await ref(A.id, 'digiclassroom', 'isbn:978-93-5729-100-2');
  const a1 = await asset(A.id, 'enriched_md', 1, 'aaa111', 'Chapter 1: What is Democracy?');
  const a2 = await asset(A.id, 'enriched_md', 2, 'bbb222', 'Chapter 2: Constitutional Design');
  await asset(A.id, 'enriched_md', 0, 'whole', 'the whole work, not a chapter');
  await asset(A.id, 'pdf_paginated', 0, 'pdfpdf', null);
  await asset(A.id, 'source', 0, 'srcsrc', null);
  await run(A.id, a1.id, 'active', 52, null, 100);
  await run(A.id, a2.id, 'active', 40, null, 60);
  await run(A.id, a2.id, 'failed', null, 'embedding provider timed out', 5);

  // B: an ISBN-10 stored without hyphens, no edition, one reference, no chapters.
  const B = await item('Zzz Fundamentals of Physical Geography', 'book', '8174505180', null);
  await ref(B.id, 'pdlms', 'pdlms-book-2');
  // C: not a book. D: a book with no source reference at all. E: a book with no ISBN.
  const C = await item('Zzz Not a book', 'audio', '9780000000002', null);
  const D = await item('Zzz Orphan reference', 'book', '9781111111113', null);
  const E = await item('Zzz No ISBN yet', 'book', null, null);
  await ref(E.id, 'vidyaverse', 'v-1');

  const all = await listWorks(db, 'Zzz');
  const byId = new Map(all.map((w) => [w.id, w]));
  const wa = byId.get(A.id);

  check('list: books of the right kind are listed, an audio item is not', byId.has(A.id) && byId.has(B.id) && byId.has(D.id) && byId.has(E.id) && !byId.has(C.id), all.map((w) => w.title).join(' | '));
  check('list: ordered by title', all.map((w) => w.title).join('|') === ['Zzz Democratic Politics', 'Zzz Fundamentals of Physical Geography', 'Zzz No ISBN yet', 'Zzz Orphan reference'].join('|'), all.map((w) => w.title).join(' | '));
  check('chapters: only enriched-Markdown parts of 1 or more are chapters (not the whole work, PDF or source)', wa.chapters.length === 2 && wa.chapters.map((c) => c.partIndex).join(',') === '1,2', JSON.stringify(wa.chapters.map((c) => c.partIndex)));
  check('chapters: label, hash, size and pages come through', wa.chapters[0].label === 'Chapter 1: What is Democracy?' && wa.chapters[0].sha256 === 'aaa111' && wa.chapters[0].bytes === 1234 && wa.chapters[0].pages === 17, JSON.stringify(wa.chapters[0]));
  check('chapters: a live chapter reports its live run and chunk count', wa.chapters[0].live?.chunks === 52 && wa.chapters[0].run?.status === 'active', JSON.stringify(wa.chapters[0]));
  check('chapters: a failed re-upload shows as the latest run, with its error...', wa.chapters[1].run?.status === 'failed' && /timed out/.test(wa.chapters[1].run?.error ?? ''), JSON.stringify(wa.chapters[1].run));
  check('chapters: ...while the previous version is still reported as live', wa.chapters[1].live?.chunks === 40, JSON.stringify(wa.chapters[1].live));
  check('chapters: a book with no chapters has an empty list, not null', byId.get(B.id).chapters.length === 0 && Array.isArray(byId.get(B.id).chapters));
  check('refs: every source reference of the book is listed', wa.refs.length === 2 && wa.refs.some((r) => r.app === 'digiclassroom') && wa.refs.some((r) => r.app === 'pdlms' && r.localId === 'pdlms-book-1'), JSON.stringify(wa.refs));
  check('identity: isbn and edition are returned as stored, null when absent', wa.isbn === '978-93-5729-100-2' && wa.edition === 'Reprint 2025-26' && byId.get(B.id).edition === null && byId.get(E.id).isbn === null);

  const ids = async (q) => (await listWorks(db, q)).filter((w) => w.title.startsWith('Zzz')).map((w) => w.id);
  check('search: by title, any case', JSON.stringify(await ids('zzz democratic')) === JSON.stringify([A.id]));
  check('search: by ISBN typed with hyphens finds an ISBN stored without them', (await ids('81-7450-518')).join() === B.id, (await ids('81-7450-518')).join());
  check('search: by ISBN typed without hyphens finds an ISBN stored with them', (await ids('9789357291002')).join() === A.id);
  check('search: by part of an ISBN', (await ids('93-5729')).join() === A.id);
  check('search: a % or _ is a literal character, not a wildcard', (await ids('%')).length === 0 && (await ids('Zzz_Democratic')).length === 0);
  check('search: nothing matches nonsense', (await ids('no-such-book-anywhere')).length === 0);
  check('search: an empty search lists everything', (await ids('')).length === 4);
  check('search: a quote in the text cannot break the query', (await ids(`' OR 1=1 --`)).length === 0);

  check('getBook: finds a book by id with its identity', (await getBook(db, A.id))?.isbn === '978-93-5729-100-2' && (await getBook(db, A.id))?.title === 'Zzz Democratic Politics');
  check('getBook: an item that is not a book is not found', (await getBook(db, C.id)) === null);
  check('getBook: an unknown id is not found', (await getBook(db, '00000000-0000-0000-0000-000000000000')) === null);

  const withIsbn = (await listBooksWithIsbn(db)).filter((b) => b.title.startsWith('Zzz')).map((b) => b.id).sort();
  check('listBooksWithIsbn: books with an ISBN only, no audio, no book without one', JSON.stringify(withIsbn) === JSON.stringify([A.id, B.id, D.id].sort()), withIsbn.join());

  const refA = await ensureWorkSourceRef(db, A.id);
  check('source ref: this app\'s own reference is preferred over an older one', refA.app === 'digiclassroom' && refA.localId === 'isbn:978-93-5729-100-2', JSON.stringify(refA));
  const refB = await ensureWorkSourceRef(db, B.id);
  check('source ref: otherwise the work\'s existing reference is used, none is added', refB.app === 'pdlms' && refB.localId === 'pdlms-book-2' && (await one('SELECT count(*)::int AS n FROM content.content_source_ref WHERE content_item_id = $1', [B.id])).n === 1);
  const refD1 = await ensureWorkSourceRef(db, D.id);
  const refD2 = await ensureWorkSourceRef(db, D.id);
  check('source ref: a work with none gets one created, once', refD1.app === 'digiclassroom' && refD1.localId === `work:${D.id}` && JSON.stringify(refD1) === JSON.stringify(refD2) && (await one('SELECT count(*)::int AS n FROM content.content_source_ref WHERE content_item_id = $1', [D.id])).n === 1, JSON.stringify([refD1, refD2]));
  // ── Attaching a chapter to the CHOSEN book ──
  // The resolver's own transaction statements are swallowed so they cannot commit this test's outer transaction.
  const swallow = (sql) => /^\s*(BEGIN|COMMIT|ROLLBACK)\s*$/i.test(sql);
  globalThis.__verifyPool = {
    query: (sql, p) => db.query(sql, p),
    connect: async () => ({ query: async (sql, p) => (swallow(sql) ? { rows: [] } : db.query(sql, p)), release() {} }),
  };
  const count = async () => (await one(`SELECT count(*)::int AS n FROM content.content_item WHERE title LIKE 'Zzz%'`)).n;
  const before = await count();

  const viaRefB = await ensureWorkSourceRef(db, B.id);
  const hitB = await resolveOrCreateContentItem({ sourceApp: viaRefB.app, sourceLocalId: viaRefB.localId, title: 'Zzz Fundamentals of Physical Geography', isbn: '81-7450-518-0', edition: null });
  check('attach: through the chosen book\'s own reference, a chapter lands on that exact book', hitB.contentItemId === B.id && hitB.matchedBy === 'source_ref', JSON.stringify(hitB));
  check('attach: and no second copy of the book is created', (await count()) === before);

  const viaRefA = await ensureWorkSourceRef(db, A.id);
  const hitA = await resolveOrCreateContentItem({ sourceApp: viaRefA.app, sourceLocalId: viaRefA.localId, title: 'Zzz Democratic Politics', isbn: '9789357291002', edition: 'reprint 2025-26' });
  check('attach: the same holds when the file writes the ISBN and edition differently', hitA.contentItemId === A.id && hitA.matchedBy === 'source_ref', JSON.stringify(hitA));

  // What the lane did BEFORE a book could be chosen: identity from the file's own spelling of the ISBN. The work is stored
  // as "8174505180"; the file says "81-7450-518-0"; the strict comparison does not match, so a SECOND book is made.
  const oldWay = await resolveOrCreateContentItem({ sourceApp: 'digiclassroom', sourceLocalId: 'isbn:81-7450-518-0', title: 'Zzz Fundamentals of Physical Geography', isbn: '81-7450-518-0', edition: null });
  check('attach: for contrast, identity guessed from the file would have created a duplicate book', oldWay.matchedBy === 'created' && oldWay.contentItemId !== B.id && (await count()) === before + 1, JSON.stringify(oldWay));
} finally {
  await db.query('ROLLBACK');
  await db.end();
}

console.log(`\ncontent-works (real Postgres): ${pass.length} passed, ${failures.length} failed`);
if (failures.length) {
  console.error('\nFAILED:');
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
for (const p of pass) console.log(`  ✓ ${p}`);
console.log('');
