/* eslint-disable no-restricted-syntax -- this test sets the environment the database layer reads, before loading it */
// Exam packages, phase 5: evaluating a handed-in booklet against a real Postgres, with a fake model — a real (fixture) board paper as the set,
// a learner who writes on the printed sheet, the reader's pages turned into one transcript per question, the hand-over to marking, the cost
// booked on the attempt, the exam space kept apart from InkBuddy, and the retries when the model fails.
//   HW_ITEST_DATABASE_URL=postgres://... npx jest src/__tests__/hw/exams-evaluate-db     (needs migrations 032-034)

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { cloneBank } from '@/test-support/hw/bank-fixture';
import { expandBank, sha256 } from '@/lib/hw/bank/expand';
import { REVIEW_FORMAT, type VerdictFile, type VerdictIn } from '@/lib/hw/bank/review';
import type { ExamAi, PageRead } from '@/lib/hw/exams/page-reader';
import { drawPage, photograph, toRgb } from '@/test-support/hw/sheet-photo';

const DB_URL = process.env.HW_ITEST_DATABASE_URL;
const suite = DB_URL ? describe : describe.skip;
if (!DB_URL) console.warn('[exams-evaluate] integration tests SKIPPED: set HW_ITEST_DATABASE_URL to a throwaway Postgres with migrations 032-034.');
Object.assign(process.env, { DATABASE_URL: DB_URL ?? '', HW_EXAMS_ENABLED: 'true', HW_READ_MODEL: 'test-reader', HW_GRADE_MODEL: 'test-grader' });

let raw: Pool;
let database: typeof import('@/db')['db'];
let dbMod: typeof import('@/lib/db/connection');
let store: typeof import('@/lib/hw/bank/store');
let rstore: typeof import('@/lib/hw/bank/review-store');
let b: typeof import('@/lib/hw/exams/builder');
let L: typeof import('@/lib/hw/exams/learner');
let P: typeof import('@/lib/hw/exams/pages');
let E: typeof import('@/lib/hw/exams/evaluate');
let S: typeof import('@/lib/hw/exams/sheet');
let config: typeof import('@/lib/hw/config');
const packageIds: string[] = [];
const userIds: string[] = [];
const codes: string[] = [];

const T0 = new Date('2099-05-01T09:00:00Z');
const at = (min: number) => new Date(T0.getTime() + min * 60_000);
const one = async <T = Record<string, unknown>>(q: string, args: unknown[] = []) => (await raw.query(q, args)).rows[0] as T | undefined;
const all = async <T = Record<string, unknown>>(q: string, args: unknown[] = []) => (await raw.query(q, args)).rows as T[];

const objects = new Map<string, Uint8Array>();
const pageStore = { put: async (k: string, v: Uint8Array) => { objects.set(k, v); }, remove: async (k: string) => { objects.delete(k); }, readUrl: async (k: string) => `test://${k}` };
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const png = (seed: number) => Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, ...be32(1240), ...be32(1754), 8, 2, 0, 0, 0, ...new Array(40).fill(seed)]);
const good = { sharpness: 0.9, brightness: 0.7, glare: 0.01, override: false };
const usage = { input: 1500, cached: 0, output: 300 };

/** A fake model: page reads in page order, and fixed answer-key matches. Counts its calls. */
function fakeAi(reads: PageRead[], opts: { fail?: boolean } = {}) {
  const calls = { read: 0, match: 0 };
  const ai: ExamAi = {
    async readPage() {
      if (opts.fail) throw new Error('provider down');
      const read = reads[calls.read++] ?? { sheet: null, grid: [], segments: [] };
      return { read, result: { json: {}, usage, rawUsage: {}, model: 'test-reader' } };
    },
    async matchAnswers({ answers }) {
      calls.match++;
      return { matches: new Map(answers.map((a) => [a.id, [{ number: 4, score: 0.9 }, { number: 3, score: 0.2 }]])), result: { json: {}, usage, rawUsage: {}, model: 'test-grader' } };
    },
  };
  return { ai, calls };
}
const deps = (ai: ExamAi) => ({ ai, getObject: async (k: string) => objects.get(k)!, now: () => at(100) });
/** The parsed read of rawPage in the batch tests, for the fake reader on the standard path. */
const rawPageRead = (code: string): PageRead => ({ sheet: { code, page: 1 }, grid: [{ number: 1, letter: 'C' }], segments: [
  { box: [2], numbersSeen: [], alternative: 'B', text: 'Kidney', confidence: 0.95, unclearCount: 0 },
  { box: [3], numbersSeen: [], alternative: 'D', text: '(a) Grass', confidence: 0.95, unclearCount: 0 },
] });
const seg = (o: Partial<PageRead['segments'][number]>): PageRead['segments'][number] => ({ box: [], numbersSeen: [], alternative: null, text: '', confidence: 0.95, unclearCount: 0, ...o });

/** The fixture paper (Q1 mcq, Q2 A/B, Q3 C/D case-based, Q4 long; 10 marks, 1 hour) as a published set; a learner who has handed in `pages` photos. */
async function handedIn(pages = 2) {
  const code = `V-${randomUUID().slice(0, 8)}`;
  codes.push(code);
  const bank = cloneBank();
  bank.paper.code = code;
  const imp = await store.importDraft(database, expandBank(bank), { actor: 'importer', sourceSha256: sha256(JSON.stringify(bank)) });
  const rows = (await raw.query(`SELECT number, alt, variant, content_hash, needs_check FROM hw_bank_question WHERE paper_id = $1`, [imp.paperId])).rows;
  const ident = { board: 'TESTBOARD', klass: 10, code, year: '2099-00', kind: 'sqp' as const };
  // the paper's figures have their pictures, as a paper offered to learners must
  const fig = await import('@/lib/hw/bank/figures');
  const figPng = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, ...be32(300), ...be32(200), 8, 2, 0, 0, 0, ...new Array(40).fill(9)]);
  for (const f of ['q3-fig1', 'q4-fig1']) await fig.attachFigureImage(database, async () => undefined, ident, f, figPng);
  const f: VerdictFile = { format: REVIEW_FORMAT, paper: ident, reviewer: 'Mrs Rao', verdicts: rows.map((x): VerdictIn => ({ q: x.number, alt: x.alt, variant: x.variant, content_hash: x.content_hash, verdict: 'ok', confirmed: x.needs_check, note: '' })) };
  await rstore.applyReview(database, f, { recordedBy: 'op' });
  await rstore.setPublished(database, ident, true, { actor: 'owner' });
  const p = (await b.createPackage(database, 'owner', { board: 'TESTBOARD', classLevel: 10, examYear: 2099, slug: `e-${randomUUID().slice(0, 8)}`, title: 'Eval test' })).id;
  packageIds.push(p);
  const s = (await b.setFromPaper(database, p, imp.paperId)).id;
  await b.publishSet(database, s);
  await b.publishPackage(database, p);
  const u = `ev-${randomUUID().slice(0, 8)}`;
  userIds.push(u);
  await raw.query(`INSERT INTO "user" (id, name, email, role) VALUES ($1, 'L', $2, 'student')`, [u, `${u}@example.test`]);
  await b.grantEntitlement(database, 'owner', { userId: u, packageId: p });
  const { attemptId } = await L.startAttempt(database, u, s, at(0));
  await L.finishWriting(database, u, attemptId, at(50));
  for (let i = 0; i < pages; i++) await P.addPage(database, pageStore, u, attemptId, png(Math.floor(Math.random() * 250) + i), good, at(51));
  await P.submitBooklet(database, u, attemptId, at(55));
  return { u, s, attemptId, code: S.sheetCode(s) };
}
/** Evaluate only this test's attempt (other suites may leave handed-in attempts in the shared scratch DB). */
async function evaluate(attemptId: string, ai: ExamAi, extra: Partial<import('@/lib/hw/exams/evaluate').EvalDeps> = {}) {
  await raw.query(`UPDATE hw_exam_attempt SET status = 'evaluating' WHERE id = $1 AND status = 'uploaded'`, [attemptId]);
  return E.evaluateClaimed(attemptId, { ...deps(ai), ...extra });
}
const answersOf = (attemptId: string) => all<{ q: string; status: string; transcript: string | null; reason: string | null }>(`
  SELECT q.origin_ref->>'questionNo' AS q, w.transcript_status AS status, w.transcript, w.failure_reason AS reason
    FROM hw_exam_attempt a JOIN hw_question q ON q.assignment_id = a.assignment_id JOIN hw_answer w ON w.question_id = q.id
   WHERE a.id = $1 ORDER BY q.position`, [attemptId]);

suite('exam packages, evaluating a booklet — integration', () => {
  jest.setTimeout(90_000);
  beforeAll(async () => {
    raw = new Pool({ connectionString: DB_URL });
    dbMod = await import('@/lib/db/connection');
    database = (await import('@/db')).db;
    config = await import('@/lib/hw/config');
    config._resetHwConfig();
    store = await import('@/lib/hw/bank/store');
    rstore = await import('@/lib/hw/bank/review-store');
    b = await import('@/lib/hw/exams/builder');
    L = await import('@/lib/hw/exams/learner');
    P = await import('@/lib/hw/exams/pages');
    E = await import('@/lib/hw/exams/evaluate');
    S = await import('@/lib/hw/exams/sheet');
  });
  afterAll(async () => {
    const c = await raw.connect();
    try {
      await c.query(`SET session_replication_role = replica`);
      if (userIds.length) {
        const subs = `SELECT s.id FROM hw_submission s WHERE s.student_id = ANY($1)`;
        for (const t of ['hw_ai_grade', 'hw_transcript_revision']) await c.query(`DELETE FROM ${t} WHERE answer_id IN (SELECT id FROM hw_answer WHERE submission_id IN (${subs}))`, [userIds]);
        await c.query(`DELETE FROM hw_ai_job WHERE submission_id IN (${subs}) OR question_id IN (SELECT q.id FROM hw_question q JOIN hw_assignment a ON a.id = q.assignment_id WHERE a.created_by = ANY($1))`, [userIds]);
        await c.query(`DELETE FROM hw_answer WHERE submission_id IN (${subs})`, [userIds]);
        await c.query(`DELETE FROM hw_submission WHERE student_id = ANY($1)`, [userIds]);
        await c.query(`DELETE FROM hw_question_key WHERE question_id IN (SELECT q.id FROM hw_question q JOIN hw_assignment a ON a.id = q.assignment_id WHERE a.created_by = ANY($1))`, [userIds]);
        await c.query(`DELETE FROM hw_rubric_item WHERE question_id IN (SELECT q.id FROM hw_question q JOIN hw_assignment a ON a.id = q.assignment_id WHERE a.created_by = ANY($1))`, [userIds]);
        await c.query(`DELETE FROM hw_question WHERE assignment_id IN (SELECT id FROM hw_assignment WHERE created_by = ANY($1))`, [userIds]);
        await c.query(`DELETE FROM hw_assignment WHERE created_by = ANY($1)`, [userIds]);
        await c.query(`DELETE FROM student_enrollments WHERE user_id = ANY($1)`, [userIds]);
        await c.query(`DELETE FROM hw_exam_page WHERE attempt_id IN (SELECT id FROM hw_exam_attempt WHERE user_id = ANY($1))`, [userIds]);
        await c.query(`DELETE FROM hw_exam_attempt WHERE user_id = ANY($1)`, [userIds]);
        await c.query(`DELETE FROM hw_exam_entitlement WHERE user_id = ANY($1)`, [userIds]);
        await c.query(`DELETE FROM "user" WHERE id = ANY($1)`, [userIds]);
      }
      if (packageIds.length) {
        await c.query(`DELETE FROM hw_exam_set_item WHERE set_id IN (SELECT id FROM hw_exam_set WHERE package_id = ANY($1))`, [packageIds]);
        await c.query(`DELETE FROM hw_exam_set WHERE package_id = ANY($1)`, [packageIds]);
        await c.query(`DELETE FROM hw_exam_package WHERE id = ANY($1)`, [packageIds]);
      }
      for (const code of codes) await c.query(`DELETE FROM hw_bank_paper WHERE subject_code = $1`, [code]);
    } finally { c.release(); }
    await raw?.end();
    await dbMod?.getPool().end();
  });

  it('reads a printed-sheet booklet into one transcript per question and hands it to marking, in the exam space', async () => {
    const { u, attemptId, code } = await handedIn(2);
    const { ai, calls } = fakeAi([
      { sheet: { code, page: 1 }, grid: [{ number: 1, letter: 'C' }], segments: [
        seg({ box: [2], alternative: 'B', text: 'Kidney' }),
        seg({ box: [3], alternative: 'D', text: '(a) Grass\nD. Fungi' }),
      ] },
      { sheet: { code, page: 2 }, grid: [], segments: [seg({ box: [4], text: '(i) [diagram] (ii) F = ma', confidence: 0.75, unclearCount: 0 })] },
    ]);
    const r = await evaluate(attemptId, ai);
    expect(r).toMatchObject({ ok: true, pages: 2, review: 0, calls: 2 });
    expect(calls).toEqual({ read: 2, match: 0 });

    const a = (await one<{ status: string; assignment_id: string; failure_reason: string | null }>(`SELECT status, assignment_id, failure_reason FROM hw_exam_attempt WHERE id = $1`, [attemptId]))!;
    expect(a).toMatchObject({ status: 'evaluating', failure_reason: null });
    expect(await one(`SELECT organization_id, status, created_by FROM hw_assignment WHERE id = $1`, [a.assignment_id])).toEqual({ organization_id: 'vgp-exams', status: 'published', created_by: u });
    expect(await one(`SELECT status FROM hw_submission WHERE assignment_id = $1`, [a.assignment_id])).toEqual({ status: 'ready_for_review' });

    const ans = await answersOf(attemptId);
    const by = Object.fromEntries(ans.map((x) => [x.q, x]));
    expect(by['1']).toMatchObject({ status: 'done', transcript: 'C' });
    expect(by['2B']).toMatchObject({ status: 'done', transcript: 'Kidney' });
    expect(by['2A']).toMatchObject({ status: 'done', transcript: '', reason: 'not attempted' });
    expect(by['3D']).toMatchObject({ status: 'done', transcript: '(a) Grass\nD. Fungi' });
    expect(by['3C']).toMatchObject({ status: 'done', transcript: '' });
    expect(by['4']).toMatchObject({ status: 'done', transcript: '(i) [diagram] (ii) F = ma' });

    // board questions take their key from the bank, built by the key step
    expect(Number((await one<{ n: number }>(`SELECT count(*)::int n FROM hw_question_key k JOIN hw_question q ON q.id = k.question_id WHERE q.assignment_id = $1 AND k.status = 'building'`, [a.assignment_id]))!.n)).toBe(6);
    // the read is kept with the page, and its cost on the attempt's submission
    expect((await one<{ q: { read?: { sheet: unknown } } }>(`SELECT quality AS q FROM hw_exam_page WHERE attempt_id = $1 ORDER BY position LIMIT 1`, [attemptId]))!.q.read?.sheet).toEqual({ code, page: 1 });
    expect(await one(`SELECT j.kind, j.status, j.organization_id, j.tokens_in::int AS t FROM hw_ai_job j JOIN hw_submission s ON s.id = j.submission_id WHERE s.assignment_id = $1 AND j.kind = 'read'`, [a.assignment_id]))
      .toEqual({ kind: 'read', status: 'done', organization_id: 'vgp-exams', t: 3000 });
    // nothing touched InkBuddy: no practice trial, nothing in the practice space
    expect(await one(`SELECT count(*)::int n FROM hw_practice_trial WHERE user_id = $1`, [u])).toEqual({ n: 0 });
  });

  it('a page read as two overlapping halves: two reads, joined at the seam, and kept with the page as such', async () => {
    const { attemptId, code } = await handedIn(1);
    const cut: Uint8Array[] = [];
    const halves = async (image: Uint8Array): Promise<[Uint8Array, Uint8Array]> => { cut.push(image); return [new Uint8Array([1]), new Uint8Array([2])]; };
    const { ai, calls } = fakeAi([
      { sheet: { code, page: 1 }, grid: [{ number: 1, letter: 'C' }], segments: [seg({ box: [3], alternative: 'D', text: '(a) Grass is eaten\nby the deer' })] },
      { sheet: null, grid: [], segments: [seg({ text: 'by the deer, which the tiger eats' })] },
    ]);
    const r = await evaluate(attemptId, ai, { halves });
    expect(r).toMatchObject({ ok: true, pages: 1, review: 0, calls: 2 });
    expect(calls).toEqual({ read: 2, match: 0 });
    expect(cut).toHaveLength(1);
    const by = Object.fromEntries((await answersOf(attemptId)).map((x) => [x.q, x]));
    expect(by['1']).toMatchObject({ status: 'done', transcript: 'C' });
    expect(by['3D']).toMatchObject({ status: 'done', transcript: '(a) Grass is eaten\nby the deer\nwhich the tiger eats' }); // the seam's repeat read once
    expect(by['4']).toMatchObject({ status: 'done', transcript: '' });
    expect((await one<{ q: { read?: { split?: string; sheet?: unknown } } }>(`SELECT quality AS q FROM hw_exam_page WHERE attempt_id = $1`, [attemptId]))!.q.read)
      .toMatchObject({ split: 'halves', sheet: { code, page: 1 } });
  });

  it('a printed-sheet photo is read box by box: the grid by code, only the box with writing sent to the reader, no page read', async () => {
    const { attemptId, s } = await handedIn(1);
    const { layout } = await L.sheetFor(database, s);
    const sharp = (await (await import('@/lib/hw/exams/crop')).loadSharp())!;
    const crop = await import('@/lib/hw/exams/crop');
    // the learner circled C for Q1 and wrote in the box for Q3, ticking alternative D
    const photo = await crop.encodeJpeg(sharp, toRgb(photograph(drawPage(layout, 1, { marks: { 1: 'C' }, ink: [3] }), { width: 1200, height: 1650 })), 85);
    const boxes: number[][] = [];
    const { ai, calls } = fakeAi([]);
    const boxAi: ExamAi = { ...ai, async readBox({ numbers }) {
      boxes.push(numbers);
      return { read: { numbersSeen: [], alternative: 'D', text: '(a) Grass\nD. Fungi', confidence: 0.95, unclearCount: 0 }, result: { json: {}, usage, rawUsage: {}, model: 'test-reader' } };
    } };
    const r = await evaluate(attemptId, boxAi, { sharp, getObject: async () => photo });
    expect(r).toMatchObject({ ok: true, pages: 1, review: 0, calls: 1 });
    expect(calls).toEqual({ read: 0, match: 0 });
    expect(boxes).toEqual([[3]]);
    const by = Object.fromEntries((await answersOf(attemptId)).map((x) => [x.q, x]));
    expect(by['1']).toMatchObject({ status: 'done', transcript: 'C' });
    expect(by['3D']).toMatchObject({ status: 'done', transcript: '(a) Grass\nD. Fungi' });
    expect(by['3C']).toMatchObject({ status: 'done', transcript: '' });
    expect((await one<{ q: { read?: { split?: string; prompt?: string; sheet?: unknown } } }>(`SELECT quality AS q FROM hw_exam_page WHERE attempt_id = $1`, [attemptId]))!.q.read)
      .toMatchObject({ split: 'sheet', prompt: 'exam-box-read.v1', sheet: { code: layout.code, page: 1 } });
  }, 120_000);

  it('plain paper: a written number the answer contradicts is checked by the matcher and goes to a person, not to that question', async () => {
    const { attemptId } = await handedIn(1);
    // the fake matcher says every answer reads like Q4: here the learner's "Q2 (B)" is a misread number (real handwriting, 12 Nov)
    const { ai, calls } = fakeAi([{ sheet: null, grid: [], segments: [seg({ numbersSeen: [{ number: 2, confidence: 0.95 }], alternative: 'B', text: 'F = ma, so the force doubles' })] }]);
    const r = await evaluate(attemptId, ai);
    expect(r).toMatchObject({ ok: true, review: 1, calls: 2 });
    expect(calls).toEqual({ read: 1, match: 1 });
    const by = Object.fromEntries((await answersOf(attemptId)).map((x) => [x.q, x]));
    expect(by['2B']).toMatchObject({ status: 'needs_review', transcript: null });
    expect((await one<{ q: { review?: { reason: string; detail: string }[] } }>(`SELECT quality AS q FROM hw_exam_page WHERE attempt_id = $1`, [attemptId]))!.q.review)
      .toEqual([{ reason: 'numbers_disagree', detail: 'numbered Q2 but reads like the answer to Q4' }]);
  });

  it('plain paper without numbers: the answer-key matcher places the writing', async () => {
    const { attemptId } = await handedIn(1);
    const { ai, calls } = fakeAi([{ sheet: null, grid: [], segments: [seg({ text: 'A labelled cell; F = ma' })] }]);
    const r = await evaluate(attemptId, ai);
    expect(r).toMatchObject({ ok: true, calls: 2 });
    expect(calls).toEqual({ read: 1, match: 1 });
    const by = Object.fromEntries((await answersOf(attemptId)).map((x) => [x.q, x]));
    expect(by['4']).toMatchObject({ status: 'done', transcript: 'A labelled cell; F = ma' });
    expect(by['1']).toMatchObject({ status: 'done', transcript: '' });
  });

  it('writing that cannot be placed is left for a person, and so are the blanks it might belong to', async () => {
    const { attemptId, code } = await handedIn(1);
    const { ai } = fakeAi([{ sheet: { code, page: 1 }, grid: [], segments: [seg({ box: [2], text: 'Heart' })] }]); // Q2 without A or B ticked
    const r = await evaluate(attemptId, ai);
    expect(r).toMatchObject({ ok: true, review: 1 });
    const ans = await answersOf(attemptId);
    expect(ans.every((x) => x.status === 'needs_review')).toBe(true);
    // and the page says why, for the report and for the person checking
    expect((await one<{ r: unknown }>(`SELECT quality->'review' AS r FROM hw_exam_page WHERE attempt_id = $1`, [attemptId]))!.r)
      .toEqual([{ reason: 'alternative_unknown', detail: 'answers Q2A or Q2B, not said which' }]);
  });

  it('a failing model is retried on later passes, then left for a person with the reason', async () => {
    const { attemptId } = await handedIn(1);
    const { ai } = fakeAi([], { fail: true });
    for (const n of [1, 2]) {
      const r = await evaluate(attemptId, ai);
      expect(r).toMatchObject({ ok: false, final: false });
      expect(await one(`SELECT status, failure_reason FROM hw_exam_attempt WHERE id = $1`, [attemptId]))
        .toEqual({ status: 'uploaded', failure_reason: `eval try ${n}/3: provider down` });
    }
    expect(await evaluate(attemptId, ai)).toMatchObject({ ok: false, final: true });
    expect(await one(`SELECT status, failure_reason FROM hw_exam_attempt WHERE id = $1`, [attemptId])).toEqual({ status: 'evaluating', failure_reason: 'eval failed: provider down' });
    // made once, kept: the assignment is not duplicated by the retries
    expect(await one(`SELECT count(*)::int n FROM hw_assignment WHERE created_by = (SELECT user_id FROM hw_exam_attempt WHERE id = $1)`, [attemptId])).toEqual({ n: 1 });
  });

  describe('the batch path (phase 5b)', () => {
    // a provider batch API standing in for OpenAI: it keeps what was submitted and answers polls with what the test says
    function fakeBatch() {
      const created: { name: string; items: import('@/lib/hw/ai').BatchItem[] }[] = [];
      let answer: (items: import('@/lib/hw/ai').BatchItem[]) => import('@/lib/hw/ai').BatchOutcome = () => ({ state: 'pending' });
      const api: import('@/lib/hw/exams/evaluate').ExamBatchApi = {
        provider: 'openai', readModel: 'test-reader',
        async create(items, name) { created.push({ name: `fake-${created.length}-${name}`, items }); return created[created.length - 1]!.name; },
        async poll(name) { const c = created.find((x) => x.name === name); if (!c) throw new Error('no such batch'); return answer(c.items); },
      };
      return { api, created, answerWith: (f: typeof answer) => { answer = f; } };
    }
    // the reader's raw JSON for the printed-sheet page of the first test
    const rawPage = (code: string) => ({ sheet: { code, page: 1 }, grid: [{ number: 1, letter: 'C' }], segments: [
      { box: ['Q2'], written_numbers: [], alternative: 'B', text: 'Kidney', confidence: 'high' },
      { box: ['Q3'], written_numbers: [], alternative: 'D', text: '(a) Grass', confidence: 'high' },
    ] });
    const succeeded = (code: string) => (items: import('@/lib/hw/ai').BatchItem[]): import('@/lib/hw/ai').BatchOutcome =>
      ({ state: 'succeeded', results: new Map(items.map((i) => [i.key, { ok: true as const, result: { json: rawPage(code), usage, rawUsage: {}, model: 'test-reader' } }])) });
    const batchJobs = (attemptId: string) => raw.query(`SELECT status, batch_ref, error, tokens_in::int AS t, payload_ref::jsonb -> 'exam' ->> 'readBy' AS read_by FROM hw_ai_job
      WHERE organization_id = 'vgp-exams' AND kind = 'read' AND batch_ref IS NOT NULL AND payload_ref::jsonb -> 'exam' ->> 'attemptId' = $1`, [attemptId]).then((r) => r.rows);
    const withBatch = async (fn: () => Promise<void>) => {
      process.env.HW_EXAMS_BATCH_ENABLED = 'true';
      config._resetHwConfig();
      try { await fn(); } finally { process.env.HW_EXAMS_BATCH_ENABLED = 'false'; config._resetHwConfig(); }
    };

    it('the reads go to the provider as a batch with a promised time; the poll places them, hands over to marking, and books batch prices', () => withBatch(async () => {
      const { attemptId, code } = await handedIn(1);
      // the promise is made at hand-in, so the learner sees it at once
      const promised = (await one<{ ready_by: Date | null }>(`SELECT ready_by FROM hw_exam_attempt WHERE id = $1`, [attemptId]))!.ready_by;
      expect(promised).not.toBeNull();
      const fb = fakeBatch();
      const { ai, calls } = fakeAi([]);
      const r = await evaluate(attemptId, ai, { batch: fb.api });
      expect((await one<{ ready_by: Date }>(`SELECT ready_by FROM hw_exam_attempt WHERE id = $1`, [attemptId]))!.ready_by).toEqual(promised); // and kept
      expect(r).toMatchObject({ ok: true, batched: true, requests: 1, batches: 1 });
      expect(calls).toEqual({ read: 0, match: 0 });
      expect(fb.created).toHaveLength(1);
      expect(fb.created[0]!.items[0]!.call).toMatchObject({ model: 'test-reader' });
      const att = (await one<{ status: string; ready_by: Date | null }>(`SELECT status, ready_by FROM hw_exam_attempt WHERE id = $1`, [attemptId]))!;
      expect(att.status).toBe('evaluating');
      expect(att.ready_by).not.toBeNull();
      expect(await batchJobs(attemptId)).toEqual([expect.objectContaining({ status: 'batch_pending' })]);
      expect((await answersOf(attemptId)).every((x) => x.status === 'pending')).toBe(true);
      // an attempt waiting on its batch is not "stale", however long it waits
      const c = await raw.connect();
      try { await c.query(`SET session_replication_role = replica`); await c.query(`UPDATE hw_exam_attempt SET updated_at = now() - interval '3 days' WHERE id = $1`, [attemptId]); }
      finally { await c.query(`SET session_replication_role = DEFAULT`); c.release(); }
      await E.recoverStaleAttempts();
      expect((await one<{ status: string }>(`SELECT status FROM hw_exam_attempt WHERE id = $1`, [attemptId]))!.status).toBe('evaluating');

      expect(await E.pollExamAttempt(attemptId, { ...deps(ai), batch: fb.api })).toEqual({ attemptId, state: 'waiting' });
      fb.answerWith(succeeded(code));
      const done = await E.pollExamAttempt(attemptId, { ...deps(ai), batch: fb.api });
      expect(done).toMatchObject({ state: 'done', outcome: { ok: true, pages: 1, review: 0 } });
      expect(calls).toEqual({ read: 0, match: 0 });
      const by = Object.fromEntries((await answersOf(attemptId)).map((x) => [x.q, x]));
      expect(by['1']).toMatchObject({ status: 'done', transcript: 'C' });
      expect(by['2B']).toMatchObject({ status: 'done', transcript: 'Kidney' });
      expect(by['3D']).toMatchObject({ status: 'done', transcript: '(a) Grass' });
      expect(await batchJobs(attemptId)).toEqual([expect.objectContaining({ status: 'done', t: 1500, error: 'exam booklet batch: 1 read(s)' })]);
      expect((await one<{ q: { read?: { via?: string } } }>(`SELECT quality AS q FROM hw_exam_page WHERE attempt_id = $1`, [attemptId]))!.q.read?.via).toBe('batch');
      // marking of this attempt is batched against the same promise, ending before it
      const qid = (await one<{ id: string }>(`SELECT q.id FROM hw_question q JOIN hw_exam_attempt a ON a.assignment_id = q.assignment_id WHERE a.id = $1 LIMIT 1`, [attemptId]))!.id;
      const mode = await (await import('@/lib/hw/exams/batch')).examMarkingMode(database, qid, new Date(), { enabled: true, windowHours: 24 });
      expect(mode).toMatchObject({ batch: true });
      expect((mode as { markBy: Date }).markBy.getTime()).toBeLessThan(att.ready_by!.getTime());
    }), 120_000);

    it('a batch that fails is closed with the reason, and the booklet is read now on the standard path', () => withBatch(async () => {
      const { attemptId, code } = await handedIn(1);
      const fb = fakeBatch();
      const { ai, calls } = fakeAi([rawPageRead(code)]);
      await evaluate(attemptId, ai, { batch: fb.api });
      fb.answerWith(() => ({ state: 'failed', reason: 'expired' }));
      const r = await E.pollExamAttempt(attemptId, { ...deps(ai), batch: fb.api });
      expect(r).toMatchObject({ state: 'standard', reason: 'the batch failed (expired)', outcome: { ok: true, pages: 1 } });
      expect(calls).toEqual({ read: 1, match: 0 });
      expect(await batchJobs(attemptId)).toEqual([expect.objectContaining({ status: 'done', error: 'Re-run on the standard path: the batch failed (expired)' })]);
      expect(await one(`SELECT evaluation_mode FROM hw_exam_attempt WHERE id = $1`, [attemptId])).toEqual({ evaluation_mode: 'standard' });
      expect(Object.fromEntries((await answersOf(attemptId)).map((x) => [x.q, x]))['2B']).toMatchObject({ status: 'done', transcript: 'Kidney' });
    }), 120_000);

    it('a batch not finished by its reading deadline is given up on, and the booklet read now', () => withBatch(async () => {
      const { attemptId, code } = await handedIn(1);
      const fb = fakeBatch();
      const { ai, calls } = fakeAi([rawPageRead(code)]);
      await evaluate(attemptId, ai, { batch: fb.api });
      const [job] = await batchJobs(attemptId);
      const late = { ...deps(ai), batch: fb.api, now: () => new Date(Date.parse(job.read_by) + 60_000) };
      const r = await E.pollExamAttempt(attemptId, late);
      expect(r).toMatchObject({ state: 'standard', reason: `the batch was not finished by ${job.read_by}` });
      expect(calls.read).toBe(1);
    }), 120_000);

    it('with the batch path off, a booklet is read now as before', async () => {
      const { attemptId, code } = await handedIn(1);
      const fb = fakeBatch();
      const { ai, calls } = fakeAi([rawPageRead(code)]);
      expect(await evaluate(attemptId, ai, { batch: fb.api })).toMatchObject({ ok: true, pages: 1 });
      expect(fb.created).toHaveLength(0);
      expect(calls.read).toBe(1);
    }, 120_000);
  });

  it('the runner claims handed-in attempts only while HW_EXAMS_ENABLED is on', async () => {
    process.env.HW_EXAMS_ENABLED = 'false';
    config._resetHwConfig();
    try {
      expect(await E.runExamEvaluations(5, deps(fakeAi([]).ai))).toEqual([]);
    } finally {
      process.env.HW_EXAMS_ENABLED = 'true';
      config._resetHwConfig();
    }
  });
});
