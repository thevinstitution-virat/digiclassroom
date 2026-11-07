/* eslint-disable no-restricted-syntax -- this test sets the environment the database layer reads, before loading it */
// The board-paper bank, phase 5 against a real Postgres: every question the evaluation export names finds its official key in the checked bank, and the key
// adds up to the question's marks. (If export and lookup ever disagree, an evaluation would silently skip questions or, worse, fall back to a textbook key.)
//   HW_ITEST_DATABASE_URL=postgres://... npx jest src/__tests__/hw/bank-eval-db     (needs migrations 032 and 033)

import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { cloneBank } from '@/test-support/hw/bank-fixture';
import { expandBank, sha256, type ExpandedPaper } from '@/lib/hw/bank/expand';
import { parseBankFile } from '@/lib/hw/bank/schema';
import { REVIEW_FORMAT, type VerdictFile } from '@/lib/hw/bank/review';
import { evalQuestionsOf } from '@/lib/hw/bank/eval-export';
import { buildKey, type KeyDeps, type KeySettings } from '@/lib/hw/keys/service';

const DB_URL = process.env.HW_ITEST_DATABASE_URL;
const suite = DB_URL ? describe : describe.skip;
if (!DB_URL) console.warn('[bank-eval] integration tests SKIPPED: set HW_ITEST_DATABASE_URL to a throwaway Postgres with migrations 032 and 033.');
Object.assign(process.env, { DATABASE_URL: DB_URL ?? '' });

let store: typeof import('@/lib/hw/bank/store');
let rstore: typeof import('@/lib/hw/bank/review-store');
let ostore: typeof import('@/lib/hw/bank/official-store');
let database: typeof import('@/db')['db'];
let dbMod: typeof import('@/lib/db/connection');
let raw: Pool;
const codes: string[] = [];

const settings: KeySettings = { writer: { provider: 'gemini', model: 'gemini-x' }, verifier: { provider: 'openrouter', model: 'openai/gpt-x' }, rMin: undefined, theta: 0.35, topK: 5, maxPassages: 3, pagesVerified: new Set() };
const deps = (): KeyDeps => ({
  retriever: { indexId: 'test', embed: async () => { throw new Error('no retrieval for an official key'); }, search: async () => { throw new Error('no retrieval'); } },
  trio: { practiceRows: async () => { throw new Error('no trio'); }, chunks: async () => { throw new Error('no trio'); } },
  generate: async () => { throw new Error('a model must not write an official key'); },
  official: (r) => ostore.lookupOfficialScheme(database, r),
});

/** Imports the paper under a code of its own, has every row checked, and returns the paper as imported. */
async function importAndCheck(paper: ExpandedPaper, code: string) {
  codes.push(code);
  const p = { ...paper, subjectCode: code };
  await store.importDraft(database, p, { actor: 'importer', sourceSha256: sha256(JSON.stringify(p)) });
  const rows = (await raw.query(`SELECT q.number, q.alt, q.variant, q.content_hash, q.needs_check FROM hw_bank_question q JOIN hw_bank_paper pp ON pp.id = q.paper_id WHERE pp.subject_code = $1`, [code])).rows;
  const f: VerdictFile = {
    format: REVIEW_FORMAT, paper: { board: p.board, klass: p.classLevel, code, year: p.session, kind: p.kind }, reviewer: 'Mrs Rao',
    verdicts: rows.map((r) => ({ q: r.number, alt: r.alt, variant: r.variant, content_hash: r.content_hash, verdict: 'ok' as const, confirmed: r.needs_check, note: '' })),
  };
  await rstore.applyReview(database, f, { recordedBy: 'op' });
  return p;
}

async function everyExportedQuestionGetsItsOfficialKey(paper: ExpandedPaper, code: string) {
  const p = await importAndCheck(paper, code);
  const { questions } = evalQuestionsOf(p);
  expect(questions.length).toBeGreaterThan(0);
  const failures: string[] = [];
  for (const q of questions) {
    const r = await buildKey(q, deps(), settings);
    if (r.status !== 'grounded' || r.source !== 'official' || !r.officialSource) { failures.push(`${q.officialRef!.questionNo}: ${r.status}`); continue; }
    const sum = r.key.valuePoints.reduce((s, v) => s + v.marks, 0);
    if (Math.abs(sum - q.marks) > 1e-9) failures.push(`${q.officialRef!.questionNo}: key adds to ${sum}, question ${q.marks}`);
  }
  expect(failures).toEqual([]);
  return questions.length;
}

suite('board-paper bank, phase 5 — integration', () => {
  jest.setTimeout(120_000);
  beforeAll(async () => {
    raw = new Pool({ connectionString: DB_URL });
    dbMod = await import('@/lib/db/connection');
    database = (await import('@/db')).db;
    store = await import('@/lib/hw/bank/store');
    rstore = await import('@/lib/hw/bank/review-store');
    ostore = await import('@/lib/hw/bank/official-store');
  });
  afterAll(async () => {
    for (const c of codes) await raw?.query(`DELETE FROM hw_bank_paper WHERE subject_code = $1`, [c]);
    await raw?.end();
    await dbMod?.getPool().end();
  });

  it('every question the export names finds its official key in the checked bank, adding up to its marks', async () => {
    expect(await everyExportedQuestionGetsItsOfficialKey(expandBank(cloneBank()), `E-${randomUUID().slice(0, 8)}`)).toBe(5);
  });

  it('an unchecked paper gives the export nothing to evaluate against: the lookup finds no official key', async () => {
    const code = `E-${randomUUID().slice(0, 8)}`;
    codes.push(code);
    const paper = { ...expandBank(cloneBank()), subjectCode: code };
    await store.importDraft(database, paper, { actor: 'importer', sourceSha256: sha256(JSON.stringify(paper)) });
    for (const q of evalQuestionsOf(paper).questions) expect(await ostore.lookupOfficialScheme(database, q.officialRef!)).toBeNull();
  });

  const realBank = join(__dirname, '../../../../../hw-evals/banks/cbse-x-science-sqp-2026-27/bank.json');
  (existsSync(realBank) ? it : it.skip)('the real CBSE Class X Science paper: all 28 exported questions get their official key', async () => {
    const parsed = parseBankFile(readFileSync(realBank, 'utf8'));
    if (!parsed.ok) throw new Error(parsed.problems.join('; '));
    expect(await everyExportedQuestionGetsItsOfficialKey(expandBank(parsed.bank, { kind: 'sqp' }), `086-E${randomUUID().slice(0, 6)}`)).toBe(28);
  });
});
