/* eslint-disable no-restricted-syntax -- this test sets the environment the database layer reads, before loading it */
// The board-paper bank, phase 3 against a real Postgres: the official-scheme lookup the answer-key service uses. Only a row a person has checked is a
// scheme; a name that does not point at exactly one row is a miss, never a guess. The paper is an invented one (bank-fixture.ts).
//   HW_ITEST_DATABASE_URL=postgres://... npx jest src/__tests__/hw/bank-official-db     (needs migrations 032 and 033)

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { cloneBank } from '@/test-support/hw/bank-fixture';
import { expandBank, sha256 } from '@/lib/hw/bank/expand';
import { REVIEW_FORMAT, type VerdictFile, type VerdictIn } from '@/lib/hw/bank/review';
import { buildKey, type KeyDeps, type KeySettings } from '@/lib/hw/keys/service';
import type { KeyRequest } from '@/lib/hw/keys/types';

const DB_URL = process.env.HW_ITEST_DATABASE_URL;
const suite = DB_URL ? describe : describe.skip;
if (!DB_URL) console.warn('[bank-official] integration tests SKIPPED: set HW_ITEST_DATABASE_URL to a throwaway Postgres with migrations 032 and 033.');
Object.assign(process.env, { DATABASE_URL: DB_URL ?? '' });

let store: typeof import('@/lib/hw/bank/store');
let rstore: typeof import('@/lib/hw/bank/review-store');
let ostore: typeof import('@/lib/hw/bank/official-store');
let database: typeof import('@/db')['db'];
let dbMod: typeof import('@/lib/db/connection');
let raw: Pool;
const codes: string[] = [];

const one = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) => (await raw.query(sql, args)).rows[0] as T | undefined;

async function fresh(edit: (b: ReturnType<typeof cloneBank>) => void = () => {}, code = `O-${randomUUID().slice(0, 8)}`) {
  codes.push(code);
  const b = cloneBank();
  b.paper.code = code;
  edit(b);
  await store.importDraft(database, expandBank(b), { actor: 'importer', sourceSha256: sha256(JSON.stringify(b)) });
  return code;
}
const hashOf = async (code: string, n: number, alt: string | null = null, v: string | null = null) =>
  (await one<{ content_hash: string }>(`SELECT q.content_hash FROM hw_bank_question q JOIN hw_bank_paper p ON p.id = q.paper_id WHERE p.subject_code = $1 AND q.number = $2 AND COALESCE(q.alt,'') = $3 AND COALESCE(q.variant,'') = $4`, [code, n, alt ?? '', v ?? '']))!.content_hash;

/** What the teacher's sheet hands back for these rows: ok with every flagged item confirmed, or the verdict given. */
async function review(code: string, rows: [number, string | null, string | null][], verdict: 'ok' | 'reject' | 'fix' = 'ok', board = 'TESTBOARD') {
  const vs: VerdictIn[] = [];
  for (const [n, alt, v] of rows) {
    const r = (await one<{ needs_check: string[] }>(`SELECT q.needs_check FROM hw_bank_question q JOIN hw_bank_paper p ON p.id = q.paper_id WHERE p.subject_code = $1 AND q.number = $2 AND COALESCE(q.alt,'') = $3 AND COALESCE(q.variant,'') = $4`, [code, n, alt ?? '', v ?? '']))!;
    vs.push({ q: n, alt: alt as VerdictIn['alt'], variant: v as VerdictIn['variant'], content_hash: await hashOf(code, n, alt, v), verdict, confirmed: verdict === 'ok' ? r.needs_check : [], note: verdict === 'ok' ? '' : 'not right' });
  }
  const f: VerdictFile = { format: REVIEW_FORMAT, paper: { board, klass: 10, code, year: '2099-00', kind: 'sqp' }, reviewer: 'Mrs Rao', verdicts: vs };
  return rstore.applyReview(database, f, { recordedBy: 'op' });
}
const ref = (code: string, questionNo: string, extra: Record<string, unknown> = {}) => ({ kind: 'sqp' as const, session: '2099-00', subjectCode: code, questionNo, ...extra });

suite('board-paper bank — official scheme lookup', () => {
  jest.setTimeout(60_000);
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

  it('gives a checked row as the official key, naming who checked it and what it was made from', async () => {
    const code = await fresh();
    await review(code, [[2, 'B', null]]);
    const f = await ostore.findOfficial(database, ref(code, '2B'));
    if (!f.ok) throw new Error(f.detail);
    expect(f.plan).toMatchObject({ mode: 'ai', markableMarks: 2 });
    expect(f.scheme.key.valuePoints.map((v) => [v.text, v.marks])).toEqual([['Kidney', 1], ['It filters the blood', 1]]);
    expect(f.scheme.label).toBe(`TESTBOARD sample paper 2099-00, ${code} Science, Q2B marking scheme (checked by Mrs Rao)`);
    expect(f.scheme.source).toEqual({ id: f.rowId, contentHash: await hashOf(code, 2, 'B') });
    expect(await ostore.lookupOfficialScheme(database, ref(code, 'q2b'))).toMatchObject({ key: f.scheme.key });   // the way it is written does not matter
  });

  it('gives nothing for a row no person has checked, or one that was rejected, or whose check was withdrawn', async () => {
    const code = await fresh();
    expect(await ostore.findOfficial(database, ref(code, '2B'))).toMatchObject({ ok: false, miss: 'not_checked', detail: expect.stringContaining('is draft') });
    expect(await ostore.lookupOfficialScheme(database, ref(code, '2B'))).toBeNull();
    await review(code, [[2, 'B', null]]);
    expect((await ostore.findOfficial(database, ref(code, '2B'))).ok).toBe(true);
    await review(code, [[2, 'B', null]], 'fix');   // a fix withdraws the check
    expect(await ostore.findOfficial(database, ref(code, '2B'))).toMatchObject({ ok: false, miss: 'not_checked' });
    await review(code, [[2, 'B', null]], 'reject');
    expect(await ostore.findOfficial(database, ref(code, '2B'))).toMatchObject({ ok: false, miss: 'not_checked', detail: expect.stringContaining('is rejected') });
  });

  it('wants the alternative named, and tells the two visually impaired versions from the rest', async () => {
    const code = await fresh();
    await review(code, [[2, 'A', null], [2, 'B', null], [2, 'A', 'vi'], [1, null, null], [1, null, 'vi']]);
    expect(await ostore.findOfficial(database, ref(code, '2'))).toMatchObject({ ok: false, miss: 'needs_alternative', detail: expect.stringContaining('2A or 2B') });
    const a = await ostore.findOfficial(database, ref(code, '2A'));
    const vi = await ostore.findOfficial(database, ref(code, '2A-vi'));
    if (!a.ok || !vi.ok) throw new Error('expected both');
    expect(a.rowId).not.toBe(vi.rowId);
    expect(a.scheme.label).toContain('Q2A marking scheme');
    expect(vi.scheme.label).toContain('Q2A-vi marking scheme');
    expect(await ostore.findOfficial(database, ref(code, '1'))).toMatchObject({ ok: true, plan: { mode: 'exact' } });
    expect(await ostore.findOfficial(database, ref(code, '1-vi'))).toMatchObject({ ok: true });
  });

  it('is a miss, with the reason, for a name that points at nothing', async () => {
    const code = await fresh();
    expect(await ostore.findOfficial(database, ref(code, 'two'))).toMatchObject({ miss: 'bad_question_no' });
    expect(await ostore.findOfficial(database, ref(code, '99'))).toMatchObject({ miss: 'no_row' });
    expect(await ostore.findOfficial(database, ref(`NOPE-${randomUUID().slice(0, 6)}`, '1'))).toMatchObject({ miss: 'no_paper' });
    expect(await ostore.findOfficial(database, { ...ref(code, '1'), session: '1999-00' })).toMatchObject({ miss: 'no_paper' });
    expect(await ostore.findOfficial(database, { ...ref(code, '1'), kind: 'past_paper' })).toMatchObject({ miss: 'no_paper' });
  });

  it('never guesses between two papers: the board or the class has to say which', async () => {
    const code = await fresh();
    await fresh((b) => { b.paper.board = 'OTHERBOARD'; }, code);   // same code, session and kind, another board
    await review(code, [[1, null, null]]);
    await review(code, [[1, null, null]], 'ok', 'OTHERBOARD');
    expect(await ostore.findOfficial(database, ref(code, '1'))).toMatchObject({ ok: false, miss: 'ambiguous_paper' });
    expect(await ostore.findOfficial(database, ref(code, '1', { board: 'testboard' }))).toMatchObject({ ok: true, scheme: { label: expect.stringContaining('TESTBOARD') } });
    expect(await ostore.findOfficial(database, ref(code, '1', { board: 'OTHERBOARD', classLevel: 10 }))).toMatchObject({ ok: true, scheme: { label: expect.stringContaining('OTHERBOARD') } });
    expect(await ostore.findOfficial(database, ref(code, '1', { board: 'OTHERBOARD', classLevel: 9 }))).toMatchObject({ miss: 'no_paper' });
  });

  it('a drawing is left out of the key; a row that is only a drawing is a miss', async () => {
    const code = await fresh();
    await review(code, [[4, null, null]]);
    const f = await ostore.findOfficial(database, ref(code, '4'));
    if (!f.ok) throw new Error(f.detail);
    expect(f.plan).toMatchObject({ markableMarks: 2, excluded: [{ label: 'i', marks: 2 }] });
    expect(f.scheme.key.valuePoints.map((v) => v.id)).toEqual(['ii.1']);

    const only = await fresh((b) => {
      const q = b.questions[3];
      q.parts = q.parts.filter((p) => p.answer_kind === 'diagram');
      q.marks_total = 2;
      q.equations = [];
      b.paper.max_marks = 8;
    });
    await review(only, [[4, null, null]]);
    expect(await ostore.findOfficial(database, ref(only, '4'))).toMatchObject({ ok: false, miss: 'nothing_markable' });
  });

  it('a key made from a row is good only while the row is checked and unchanged', async () => {
    const code = await fresh();
    await review(code, [[2, 'B', null]]);
    const f = await ostore.findOfficial(database, ref(code, '2B'));
    if (!f.ok) throw new Error(f.detail);
    const { id, contentHash } = f.scheme.source!;
    expect(await ostore.officialSourceValid(database, id, contentHash)).toBe(true);
    expect(await ostore.officialSourceValid(database, id, 'f'.repeat(64))).toBe(false);          // the row says something else now
    expect(await ostore.officialSourceValid(database, randomUUID(), contentHash)).toBe(false);   // no such row
    await review(code, [[2, 'B', null]], 'fix');
    expect(await ostore.officialSourceValid(database, id, contentHash)).toBe(false);             // check withdrawn
    await review(code, [[2, 'B', null]]);
    expect(await ostore.officialSourceValid(database, id, contentHash)).toBe(true);              // checked again, same content
    // revised content: back to draft with a new hash
    const b = cloneBank(); b.paper.code = code; b.questions[1].parts[1].value_points[0].text = 'Kidney (the organ)';
    await store.importDraft(database, expandBank(b), { actor: 'importer', sourceSha256: sha256(JSON.stringify(b)), revise: true });
    expect(await ostore.officialSourceValid(database, id, contentHash)).toBe(false);
  });

  describe('through the answer-key service', () => {
    const settings: KeySettings = { writer: { provider: 'gemini', model: 'gemini-x' }, verifier: { provider: 'openrouter', model: 'openai/gpt-x' }, rMin: undefined, theta: 0.35, topK: 5, maxPassages: 3, pagesVerified: new Set() };
    const deps = (): KeyDeps => ({
      retriever: { indexId: 'test', embed: async () => { throw new Error('no retrieval for an official key'); }, search: async () => { throw new Error('no retrieval'); } },
      trio: { practiceRows: async () => { throw new Error('no trio'); }, chunks: async () => { throw new Error('no trio'); } },
      generate: async () => { throw new Error('a model must not write an official key'); },
      official: (r) => ostore.lookupOfficialScheme(database, r),
    });
    const request = (code: string, over: Partial<KeyRequest> = {}): KeyRequest => ({
      questionText: 'Name the organ that filters blood.', questionType: 'short', marks: 2, classLevel: '10', subject: 'Science', medium: 'English', questionOrigin: 'board_paper',
      officialRef: ref(code, '2B'), ...over,
    });

    it('is grounded in the official scheme, with the bank row it came from, and no model is called', async () => {
      const code = await fresh();
      await review(code, [[2, 'B', null]]);
      const r = await buildKey(request(code), deps(), settings);
      expect(r).toMatchObject({ status: 'grounded', source: 'official', partial: false, officialSource: { contentHash: await hashOf(code, 2, 'B') }, calls: [] });
      expect(r.status === 'grounded' && r.key.valuePoints.map((v) => v.marks)).toEqual([1, 1]);
      expect(r.notes).toEqual([expect.stringContaining('official scheme: TESTBOARD sample paper 2099-00')]);
    });

    it('a question carrying the wrong marks is refused by the key service, loudly (a drawing is not part of them)', async () => {
      const code = await fresh();
      await review(code, [[4, null, null]]);
      const wrong = await buildKey(request(code, { officialRef: ref(code, '4'), marks: 4 }), deps(), settings);
      expect(wrong).toMatchObject({ status: 'key_invalid', reason: 'checks_failed', problems: [expect.stringContaining('points add up to 2, question is worth 4')] });
      const right = await buildKey(request(code, { officialRef: ref(code, '4'), marks: 2 }), deps(), settings);
      expect(right).toMatchObject({ status: 'grounded', source: 'official' });
    });

    it('with the row not checked there is no official key, and the service goes on to the next source (here it stops: no textbook threshold set)', async () => {
      const code = await fresh();
      await expect(buildKey(request(code), deps(), settings)).rejects.toThrow(/HW_KEY_R_MIN is not set/);   // never reached a model, and said why
    });
  });
});
