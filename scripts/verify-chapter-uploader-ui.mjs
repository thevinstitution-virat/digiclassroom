#!/usr/bin/env node
/**
 * Runs the chapter-upload page (MarkdownChapterUploader) in a simulated browser against a mocked server, and checks what a
 * super-admin would see and what would actually be sent.
 *
 * The rules themselves are tested in verify-chapter-batch.mjs and the SQL in verify-content-works.mjs. This covers the part
 * they cannot: that the page uses those rules the way they were meant, that the right book id reaches the server, that
 * a blocked file really stops the upload, and that one chapter failing does not take the others with it.
 *
 * Uses only what the web app already depends on (React, SWR, jsdom through its jest environment, esbuild).
 */
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const require = createRequire(join(root, 'package.json'));
const { JSDOM } = require('jsdom');

// ── Bundle the component with React, for a browser ────────────────────────────
const out = await build({
  stdin: {
    resolveDir: root,
    loader: 'tsx',
    contents: `
      import React, { act } from 'react';
      import { createRoot } from 'react-dom/client';
      import MarkdownChapterUploader from './apps/web/src/components/admin/MarkdownChapterUploader';
      window.__h = {
        mount(el) { const root = createRoot(el); act(() => { root.render(React.createElement(MarkdownChapterUploader)); }); return root; },
        act,
      };
    `,
  },
  bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', logLevel: 'silent',
  alias: { '@/lib': join(root, 'packages', 'core', 'src', 'lib') },
  define: { 'process.env.NODE_ENV': '"development"' },
});

const fixture = readFileSync(join(root, 'packages', 'core', 'src', 'lib', 'content', '__fixtures__', 'well-formed-chapter.md'), 'utf8');
const FX_ISBN = '978-0-00-000000-2';
const FX_EDITION = 'Fixture Edition, 2026';
const chapterText = (n, over = {}) => {
  let t = fixture.replace(/^chapter_number:.*$/m, `chapter_number: ${n}`).replace(/^chapter_title:.*$/m, `chapter_title: Chapter ${n} title`);
  if (over.isbn) t = t.replace(/^isbn:.*$/m, `isbn: "${over.isbn}"`);
  if (over.status) t = t.replace(/^validation_status:.*$/m, `validation_status: ${over.status}`);
  return t;
};

const failures = [];
const pass = [];
const check = (label, ok, detail) => { if (ok) pass.push(label); else failures.push(`${label}${detail ? `\n    ${detail}` : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** One simulated browser with its own mocked server. */
async function session({ works, ingest }) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost:3001/', pretendToBeVisual: true, runScripts: 'outside-only' });
  const w = dom.window;
  w.IS_REACT_ACT_ENVIRONMENT = true;
  w.TextDecoder = TextDecoder;
  w.TextEncoder = TextEncoder;
  w.MessageChannel = MessageChannel;
  Object.defineProperty(w, 'crypto', { value: webcrypto, configurable: true });
  w.File.prototype.arrayBuffer = function () {
    return new Promise((resolve, reject) => { const fr = new w.FileReader(); fr.onload = () => resolve(fr.result); fr.onerror = reject; fr.readAsArrayBuffer(this); });
  };
  const calls = [];
  w.fetch = async (url, init) => {
    const u = String(url);
    if (u.startsWith('/api/super-admin/content/works')) {
      const r = await works(u);
      return { ok: r.ok ?? true, status: r.status ?? 200, json: async () => r.body };
    }
    if (u === '/api/super-admin/content/ingest-markdown') {
      const fd = init.body;
      const call = { file: fd.get('file')?.name, contentItemId: fd.get('contentItemId'), newBook: fd.get('newBook') };
      calls.push(call);
      const r = await ingest(call, calls.length);
      return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body };
    }
    throw new Error(`unexpected request: ${u}`);
  };
  w.eval(out.outputFiles[0].text);
  const el = w.document.getElementById('root');
  const root = w.__h.mount(el);
  const act = w.__h.act;
  const settle = async (ms = 60) => { await act(async () => { await sleep(ms); }); };
  const $ = (sel) => [...el.querySelectorAll(sel)];
  const text = () => el.textContent.replace(/\s+/g, ' ');
  const click = async (node) => { await act(async () => { node.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); }); await settle(); };
  const radio = (label) => $('[role="radio"]').find((n) => n.textContent.includes(label));
  const addFiles = async (files) => {
    const input = el.querySelector('input[type="file"]');
    const list = files.map(([name, content]) => new w.File([content], name, { type: 'text/markdown' }));
    Object.defineProperty(input, 'files', { value: list, configurable: true });
    await act(async () => { input.dispatchEvent(new w.Event('change', { bubbles: true })); });
    await settle(150);
  };
  const uploadButton = () => $('button').find((b) => /^Upload( |$)/.test(b.textContent.trim()) || /Uploading and indexing/.test(b.textContent));
  const close = () => { act(() => root.unmount()); w.close(); };
  return { el, w, calls, settle, $, text, click, radio, addFiles, uploadButton, close, act };
}

const BOOK = {
  id: '11111111-1111-1111-1111-111111111111',
  title: 'Synthetic Fixture Reader',
  isbn: FX_ISBN,
  edition: FX_EDITION,
  lang: 'English',
  updatedAt: '2026-10-01T00:00:00Z',
  refs: [{ app: 'digiclassroom', localId: 'isbn:x' }],
  chapters: [
    { partIndex: 1, label: 'Chapter 1', sha256: null, bytes: 1, pages: 5, updatedAt: '2026-10-01T00:00:00Z', run: { status: 'active', chunks: 12, at: null, error: null, forced: false }, live: { chunks: 12, at: null, forced: false } },
    { partIndex: 2, label: 'Chapter 2', sha256: 'f'.repeat(64), bytes: 1, pages: 5, updatedAt: '2026-10-01T00:00:00Z', run: { status: 'failed', chunks: null, at: null, error: 'timed out', forced: false }, live: null },
  ],
};
const worksBody = { success: true, works: [BOOK, { ...BOOK, id: '22222222-2222-2222-2222-222222222222', title: 'Another Book', isbn: '978-93-5729-100-2', edition: 'Reprint 2025-26', chapters: [] }] };
const okPart = (n, chunks = 9) => ({ status: 200, body: { success: true, parts: [{ partIndex: n, outcome: 'succeeded', chunks, points: chunks, pages: '201-206' }], warnings: [], work: { contentItemId: BOOK.id } } });

// ──────────────────────────────────────────────────────
// 1. The page shows the books and asks for one first
// ──────────────────────────────────────────────────────
{
  const s = await session({ works: async () => ({ body: worksBody }), ingest: async () => okPart(1) });
  await s.settle(100);
  check('book: the books are listed with ISBN, edition and chapter count', s.text().includes('Synthetic Fixture Reader') && s.text().includes(`ISBN ${FX_ISBN}`) && s.text().includes('1 chapter indexed'), s.text().slice(0, 400));
  check('book: a "New book" choice is offered', !!s.radio('New book'));
  check('book: files cannot be chosen before a book is', s.el.querySelector('input[type="file"]').disabled === true && /Choose a book first/.test(s.text()));
  await s.click(s.radio('Synthetic Fixture Reader'));
  check('book: choosing one enables the file picker and shows its chapters (live and not live)', s.el.querySelector('input[type="file"]').disabled === false && /Chapters in this book/.test(s.text()) && /2 \(not live\)/.test(s.text()), s.text().slice(0, 500));
  s.close();
}

// ──────────────────────────────────────────────────────
// 2. An existing book: the review, the blocks, and what is sent
// ──────────────────────────────────────────────────────
{
  const s = await session({ works: async () => ({ body: worksBody }), ingest: async (c) => okPart(Number(/ch(\d+)/.exec(c.file)[1])) });
  await s.settle(100);
  await s.click(s.radio('Synthetic Fixture Reader'));
  await s.addFiles([['ch3.md', chapterText(3)], ['wrong-book.md', chapterText(4, { isbn: '978-93-5729-100-2' })]]);
  check('review: both files are listed with their chapter numbers', /Chapter 3/.test(s.text()) && /Chapter 4/.test(s.text()));
  check('review: a chapter of another book is blocked, naming both ISBNs', /Blocked/.test(s.text()) && /different book/.test(s.text()) && s.text().includes('978-93-5729-100-2'), s.text().slice(0, 700));
  check('review: one blocked file disables the upload', s.uploadButton().disabled === true);
  check('review: the page says what is blocked', /1 blocked/.test(s.text()));

  check('audit: what the parser skipped is shown to the reviewer, per chapter (the fixture has one SKIP region)', /Reviewer audit: 1 item skipped or flagged/.test(s.text()) && /SKIPPED \(\d+ body lines? excluded\)/.test(s.text()), s.text().slice(0, 900));

  await s.click(s.$('button[aria-label="Remove wrong-book.md"]')[0]);
  check('review: removing the blocked file enables the upload and says what it will do', s.uploadButton().disabled === false && /Upload 1 chapter to "Synthetic Fixture Reader"/.test(s.uploadButton().textContent), s.uploadButton()?.textContent);
  check('review: the missing chapters are reported (the book has 1 and 2 in some form, adds 3: none missing)', !/still be missing/.test(s.text()));

  await s.click(s.uploadButton());
  await s.settle(150);
  check('upload: exactly one request was sent, naming the chosen book by id', s.calls.length === 1 && s.calls[0].file === 'ch3.md' && s.calls[0].contentItemId === BOOK.id && s.calls[0].newBook === null, JSON.stringify(s.calls));
  check('upload: the row shows the result and the page says it is done', /Indexed/.test(s.text()) && /Done\. 1 chapter indexed/.test(s.text()), s.text().slice(-300));
  check('upload: a second batch can be started', !!s.$('button').find((b) => /Upload more chapters/.test(b.textContent)));
  s.close();
}

// ──────────────────────────────────────────────────────
// 3. Not approved, duplicates, gaps, and re-uploading what is already there
// ──────────────────────────────────────────────────────
{
  const s = await session({ works: async () => ({ body: worksBody }), ingest: async () => okPart(1) });
  await s.settle(100);
  await s.click(s.radio('Synthetic Fixture Reader'));
  await s.addFiles([['ch1.md', chapterText(1, { status: 'PENDING' })]]);
  check('approval: a chapter that is not APPROVED is blocked, saying a person must approve it', /not APPROVED/.test(s.text()) && s.uploadButton().disabled === true);
  await s.click(s.$('button[aria-label="Remove ch1.md"]')[0]);
  await s.addFiles([['ch6.md', chapterText(6)]]);
  check('gaps: skipping chapters is reported but does not block', /still be missing chapters? 3, 4, 5/.test(s.text()) && s.uploadButton().disabled === false, s.text().slice(0, 600));
  await s.addFiles([['ch6-copy.md', chapterText(6) + '\n<!-- x -->\n']]);
  check('duplicates: two files for one chapter block the upload', /is also chapter 6/.test(s.text()) && s.uploadButton().disabled === true);
  s.close();
}

// ──────────────────────────────────────────────────────
// 4. A failure does not take the others with it
// ──────────────────────────────────────────────────────
{
  const s = await session({
    works: async () => ({ body: worksBody }),
    ingest: async (c) => (c.file === 'ch3.md' ? { status: 422, body: { success: false, error: '"ch3.md" was refused by the parser.', errors: ['isbn is not an ISBN'] } } : okPart(4)),
  });
  await s.settle(100);
  await s.click(s.radio('Synthetic Fixture Reader'));
  await s.addFiles([['ch3.md', chapterText(3)], ['ch4.md', chapterText(4)]]);
  await s.click(s.uploadButton());
  await s.settle(200);
  check('failure: both chapters were attempted, in chapter order', s.calls.map((c) => c.file).join(',') === 'ch3.md,ch4.md', JSON.stringify(s.calls));
  check('failure: the failed row shows the server\'s reason, the other shows success', /refused by the parser/.test(s.text()) && /Failed/.test(s.text()) && /Indexed/.test(s.text()), s.text().slice(-500));
  check('failure: the summary counts both', /1 chapter indexed, 1 failed/.test(s.text()), s.text().slice(-250));
  s.close();
}

// ──────────────────────────────────────────────────────
// 5. A NEW book
// ──────────────────────────────────────────────────────
{
  const created = '33333333-3333-3333-3333-333333333333';
  const s = await session({
    works: async () => ({ body: { success: true, works: [] } }),
    ingest: async (c, n) => ({ status: 200, body: { success: true, parts: [{ partIndex: n, outcome: 'succeeded', chunks: 5, points: 5, pages: '1-4' }], warnings: [], work: { contentItemId: created } } }),
  });
  await s.settle(100);
  await s.click(s.radio('New book'));
  await s.addFiles([['ch1.md', chapterText(1)], ['ch2.md', chapterText(2)]]);
  check('new: the upload button names a new book', /to a new book/.test(s.uploadButton()?.textContent ?? ''), s.uploadButton()?.textContent);
  await s.click(s.uploadButton());
  await s.settle(200);
  check('new: the first chapter asks the server to create the book', s.calls[0].newBook === 'true' && s.calls[0].contentItemId === null, JSON.stringify(s.calls[0]));
  check('new: the next chapter is attached to the book the first one made, by id', s.calls[1].contentItemId === created && s.calls[1].newBook === null, JSON.stringify(s.calls[1]));
  s.close();
}
{
  const s = await session({
    works: async () => ({ body: { success: true, works: [] } }),
    ingest: async () => ({ status: 409, body: { success: false, error: 'A book with ISBN x already exists: "Old". Select it from the list instead of creating a new one. Nothing was stored.' } }),
  });
  await s.settle(100);
  await s.click(s.radio('New book'));
  await s.addFiles([['ch1.md', chapterText(1)], ['ch2.md', chapterText(2)]]);
  await s.click(s.uploadButton());
  await s.settle(200);
  check('new: if the book already exists the server says so and the rest are NOT attempted (no second creation)', s.calls.length === 1 && /already exists/.test(s.text()) && /Not attempted/.test(s.text()), JSON.stringify(s.calls));
  s.close();
}
{
  const s = await session({ works: async () => ({ body: { success: true, works: [BOOK] } }), ingest: async () => okPart(1) });
  await s.settle(100);
  await s.click(s.radio('New book'));
  await s.addFiles([['ch1.md', chapterText(1)]]);
  check('new: if that ISBN and edition are already listed, the page tells you to select the book and blocks the upload', /already exists: "Synthetic Fixture Reader"/.test(s.text()) && s.uploadButton().disabled === true, s.text().slice(-400));
  s.close();
}

// ──────────────────────────────────────────────────────
// 6. The server being unavailable
// ──────────────────────────────────────────────────────
{
  const s = await session({ works: async () => ({ ok: false, status: 500, body: { success: false, error: 'database is down' } }), ingest: async () => okPart(1) });
  await s.settle(100);
  check('errors: a failing book list is explained, and a new book can still be started', /database is down/.test(s.text()) && !!s.radio('New book'), s.text().slice(0, 300));
  s.close();
}

console.log(`\nchapter-uploader-ui: ${pass.length} passed, ${failures.length} failed`);
if (failures.length) {
  console.error('\nFAILED:');
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
for (const p of pass) console.log(`  ✓ ${p}`);
console.log('');
process.exit(0);
