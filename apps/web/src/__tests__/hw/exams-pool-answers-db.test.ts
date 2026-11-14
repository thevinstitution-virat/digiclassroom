/* eslint-disable no-restricted-syntax -- this test sets the environment the database layer reads, before loading it */
// Exam questions carry their worked model answer, its source and the bank's permanent question ID (migration 038), and `refresh` brings a draft
// pool already imported up to date with a newer pool file without losing the teachers' key checks.

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { authoredOf, autoCheckedBy, refresh, type Pool as PoolFile, type StoredFigure } from '../../../../../scripts/hw-exam-pool-import';

const DB_URL = process.env.HW_ITEST_DATABASE_URL;
const suite = DB_URL ? describe : describe.skip;
Object.assign(process.env, { DATABASE_URL: DB_URL ?? '', HW_EXAMS_ENABLED: 'true' });

type Item = PoolFile['items'][number];
const poolFile = (title: string, items: Item[]): PoolFile => ({
  format: 'exam-pool/2', title, board: 'TESTBOARD', classLevel: 10, subject: 'Science', subjectCode: '086',
  chapter: 'Our Environment', chapterNo: 13, book: 'NCERT Science Class X', topics: ['13.1.1 Food Chains and Webs'], ar_options: ['A', 'B', 'C', 'D'], items,
});
const mcq = (ref: string, extra: Partial<Item> = {}): Item => ({
  id: ref, qtype: 'mcq', marks: 1, topic: '13.1.1 Food Chains and Webs', sources: [ref], key: 'assistant', needsCheck: true,
  stem: `Which level? (${ref})`, options: ['T1', 'T2', 'T3', 'T4'], correctOption: 'A',
  answer: '(A) T1. The producers hold the most energy.', answerSource: 'assistant', qid: `10-Sci-13-13.1.1-${ref.replace(/\D/g, '').padStart(3, '0')}-E`, ...extra,
});
const noPictures = (items: Item[]) => new Map<string, StoredFigure[]>(items.map((q) => [q.id, []]));

describe('authoredOf carries the model answer and the permanent ID', () => {
  it('and leaves them out of the key and the scheme text', () => {
    const q = mcq('31/1/1 Q1');
    const a = authoredOf(poolFile('t', [q]), q);
    expect(a).toMatchObject({ modelAnswer: '(A) T1. The producers hold the most energy.', answerSource: 'assistant', qid: q.qid, correctOption: 'A' });
    expect(a.schemeText).not.toContain('producers hold');
  });
  it('a question without them stores none', () => {
    const q = mcq('31/1/1 Q2', { answer: undefined, answerSource: undefined, qid: undefined });
    expect(authoredOf(poolFile('t', [q]), q)).toMatchObject({ modelAnswer: null, answerSource: null, qid: null });
  });
});

describe('a key whose note asks for a teacher', () => {
  it('is never stamped auto-checked, even when the model agreed', () => {
    const auto = { model: 'gpt-6-luna', at: '2026-11-14', status: 'approved' as const, why: 'Luna agrees (B)' };
    expect(autoCheckedBy(mcq('x', { autoCheck: auto }))).toBe('Auto-check: gpt-6-luna (2026-11-14)');
    expect(autoCheckedBy(mcq('x', { autoCheck: auto, note: 'The printed answer does not fit the figure. A teacher should confirm.' }))).toBeNull();
    expect(autoCheckedBy(mcq('x', { autoCheck: auto, note: 'Teacher must check the board intent.' }))).toBeNull();
    expect(autoCheckedBy(mcq('x', { autoCheck: auto, note: 'The split is the assistant’s.' }))).not.toBeNull();
  });
});

let raw: Pool;
let database: typeof import('@/db')['db'];
let dbMod: typeof import('@/lib/db/connection');
let b: typeof import('@/lib/hw/exams/builder');
let L: typeof import('@/lib/hw/exams/learner');
let P: typeof import('@/lib/hw/exams/practice');
const packageIds: string[] = [];
const userIds: string[] = [];
const publicOf = (p: Promise<unknown>) => p.then(() => 'resolved', (e: { publicMessage?: string; message: string }) => e.publicMessage ?? e.message);
const T0 = new Date('2099-03-01T09:00:00Z');

suite('model answers and question IDs (038) — integration', () => {
  jest.setTimeout(60_000);
  beforeAll(async () => {
    raw = new Pool({ connectionString: DB_URL });
    dbMod = await import('@/lib/db/connection');
    database = (await import('@/db')).db;
    (await import('@/lib/hw/config'))._resetHwConfig();
    b = await import('@/lib/hw/exams/builder');
    L = await import('@/lib/hw/exams/learner');
    P = await import('@/lib/hw/exams/practice');
  });
  afterAll(async () => {
    const c = await raw.connect();
    try {
      await c.query(`SET session_replication_role = replica`);
      if (userIds.length) {
        await c.query(`DELETE FROM hw_exam_attempt WHERE user_id = ANY($1)`, [userIds]);
        await c.query(`DELETE FROM hw_exam_entitlement WHERE user_id = ANY($1)`, [userIds]);
      }
      if (packageIds.length) {
        await c.query(`DELETE FROM hw_exam_attempt WHERE set_id IN (SELECT id FROM hw_exam_set WHERE package_id = ANY($1))`, [packageIds]);
        await c.query(`DELETE FROM hw_exam_set_item WHERE set_id IN (SELECT id FROM hw_exam_set WHERE package_id = ANY($1))`, [packageIds]);
        await c.query(`DELETE FROM hw_exam_set WHERE package_id = ANY($1)`, [packageIds]);
        await c.query(`DELETE FROM hw_exam_package WHERE id = ANY($1)`, [packageIds]);
      }
      if (userIds.length) await c.query(`DELETE FROM "user" WHERE id = ANY($1)`, [userIds]);
    } finally { c.release(); }
    await raw?.end();
    await dbMod?.getPool().end();
  });

  async function draftPool(title = 'Ch13 pool') {
    const slug = `a-${randomUUID().slice(0, 8)}`;
    const p = (await b.createPackage(database, 'owner', { board: 'TESTBOARD', classLevel: 10, examYear: 2099, slug, title: 'Chapter practice' })).id;
    packageIds.push(p);
    const pool = (await b.addSet(database, p, { kind: 'pool', subject: 'Science', subjectCode: '086', title, maxMarks: 2, durationMinutes: 60, syllabusScope: ['Our Environment'] })).id;
    return { p, pool, slug };
  }

  it('stores the model answer, its source and the ID; refuses one without the other or a bad ID, in code and in the database', async () => {
    const { pool } = await draftPool();
    const q = mcq('31/1/1 Q3');
    const { id } = await b.addAuthoredItem(database, pool, authoredOf(poolFile('t', [q]), q));
    const row = (await raw.query(`SELECT model_answer, answer_source, qid FROM hw_exam_set_item WHERE id = $1`, [id])).rows[0];
    expect(row).toEqual({ model_answer: q.answer, answer_source: 'assistant', qid: q.qid });
    const base = authoredOf(poolFile('t', [q]), q);
    expect(await publicOf(b.addAuthoredItem(database, pool, { ...base, answerSource: null }))).toMatch(/needs its source/);
    expect(await publicOf(b.addAuthoredItem(database, pool, { ...base, qid: 'not an id!' }))).toMatch(/not a question ID/);
    await expect(raw.query(`UPDATE hw_exam_set_item SET answer_source = NULL WHERE id = $1`, [id])).rejects.toThrow(/answer_shapes/);
    await expect(raw.query(`UPDATE hw_exam_set_item SET answer_source = 'someone' WHERE id = $1`, [id])).rejects.toThrow(/answer_shapes/);
    await expect(raw.query(`UPDATE hw_exam_set_item SET qid = 'a b' WHERE id = $1`, [id])).rejects.toThrow(/answer_shapes/);
    // the teacher sees it beside the key
    expect((await b.getSet(database, pool)).items[0]).toMatchObject({ modelAnswer: q.answer, answerSource: 'assistant', qid: q.qid });
  });

  it('changing the model answer or the ID keeps the teacher\'s key check; changing the key takes it back', async () => {
    const { pool } = await draftPool();
    const q = mcq('31/1/1 Q4');
    const { id } = await b.addAuthoredItem(database, pool, authoredOf(poolFile('t', [q]), q));
    await b.checkItemKey(database, id, 'Ms Teacher', true, T0);
    await b.updateItem(database, id, { modelAnswer: '(A) T1. Better words.' });
    await b.updateItem(database, id, { qid: '10-Sci-13-13.1.1-999-M' });
    let row = (await raw.query(`SELECT model_answer, answer_source, qid, key_checked_by FROM hw_exam_set_item WHERE id = $1`, [id])).rows[0];
    expect(row).toEqual({ model_answer: '(A) T1. Better words.', answer_source: 'assistant', qid: '10-Sci-13-13.1.1-999-M', key_checked_by: 'Ms Teacher' });
    await b.updateItem(database, id, { correctOption: 'B' });
    row = (await raw.query(`SELECT key_checked_by FROM hw_exam_set_item WHERE id = $1`, [id])).rows[0];
    expect(row.key_checked_by).toBeNull();
  });

  it('a practice test copies them, and the learner\'s paper never shows the model answer', async () => {
    const { p, pool } = await draftPool();
    const items = [mcq('31/1/1 Q5'), mcq('31/1/1 Q6')];
    for (const q of items) {
      const { id } = await b.addAuthoredItem(database, pool, authoredOf(poolFile('t', items), q));
      await b.checkItemKey(database, id, 'T', true);
    }
    expect(await b.publishSet(database, pool)).toEqual({ published: true, problems: [] });
    expect(await b.publishPackage(database, p)).toMatchObject({ published: true });
    const u = `ma-${randomUUID().slice(0, 8)}`;
    userIds.push(u);
    await raw.query(`INSERT INTO "user" (id, name, email, role) VALUES ($1, 'L', $2, 'student')`, [u, `${u}@example.test`]);
    await b.grantEntitlement(database, 'owner', { userId: u, packageId: p, attemptsPerSet: null, expiresAt: null });
    const made = await P.buildPractice(database, u, { poolSetId: pool, topics: [], types: [], count: 2 }, T0, () => 0);
    const copied = (await raw.query(`SELECT model_answer, answer_source, qid FROM hw_exam_set_item WHERE set_id = $1 ORDER BY qid`, [made.setId])).rows;
    expect(copied).toEqual(items.map((q) => ({ model_answer: q.answer, answer_source: 'assistant', qid: q.qid })).sort((x, y) => (x.qid ?? '').localeCompare(y.qid ?? '')));
    const { attemptId } = await L.startAttempt(database, u, made.setId, T0);
    const view = await L.attemptView(database, u, attemptId, { now: T0 });
    expect(JSON.stringify(view)).not.toMatch(/producers hold|modelAnswer|model_answer/);
  });

  it('refresh: a dry run writes nothing; with --write it fills answers and IDs, keeps checks on unchanged keys, replaces changed ones and adds new questions', async () => {
    const title = `Refresh ${randomUUID().slice(0, 6)}`;
    const { pool, slug } = await draftPool(title);
    // what was imported before the quality pass: no answers or IDs, and Q8's key was (A)
    const old = [mcq('31/1/1 Q7', { answer: undefined, answerSource: undefined, qid: undefined }), mcq('31/1/1 Q8', { answer: undefined, answerSource: undefined, qid: undefined })];
    const ids: Record<string, string> = {};
    for (const q of old) {
      ids[q.id] = (await b.addAuthoredItem(database, pool, authoredOf(poolFile(title, old), q))).id;
      await b.checkItemKey(database, ids[q.id]!, 'Ms Teacher', true, T0);
    }
    const auto = { model: 'gpt-6-luna', at: '2026-11-14', status: 'approved' as const, why: 'Luna agrees (B)' };
    const now = [mcq('31/1/1 Q7'), mcq('31/1/1 Q8', { correctOption: 'B', answer: '(B) T2. Fixed.', autoCheck: auto }), mcq('31/1/1 Q9')];
    const file = poolFile(title, now);
    const opts = { keys: true, add: true, write: false, by: 'test' };

    const dry = await refresh(file, 2099, slug, now, noPictures(now), opts);
    expect(dry).toMatchObject({ answers: 1, ids: 1, keysReplaced: ['31/1/1 Q8'], added: ['31/1/1 Q9'], notInFile: [] });
    expect((await raw.query(`SELECT count(*)::int AS n FROM hw_exam_set_item WHERE set_id = $1 AND (qid IS NOT NULL OR correct_option = 'B')`, [pool])).rows[0].n).toBe(0);

    const without = await refresh(file, 2099, slug, now, noPictures(now), { ...opts, keys: false, add: false });
    expect(without).toMatchObject({ keysDiffer: ['31/1/1 Q8'], missing: ['31/1/1 Q9'], keysReplaced: [], added: [] });

    const done = await refresh(file, 2099, slug, now, noPictures(now), { ...opts, write: true });
    expect(done).toMatchObject({ answers: 1, ids: 1, keysReplaced: ['31/1/1 Q8'], added: ['31/1/1 Q9'], checksTakenBack: 1, maxMarks: 3 });
    const rows = (await raw.query(`SELECT sources->>0 AS ref, correct_option, model_answer, qid, key_checked_by FROM hw_exam_set_item WHERE set_id = $1 ORDER BY ref`, [pool])).rows;
    expect(rows).toEqual([
      { ref: '31/1/1 Q7', correct_option: 'A', model_answer: now[0]!.answer, qid: now[0]!.qid, key_checked_by: 'Ms Teacher' },
      { ref: '31/1/1 Q8', correct_option: 'B', model_answer: '(B) T2. Fixed.', qid: now[1]!.qid, key_checked_by: 'Auto-check: gpt-6-luna (2026-11-14)' },
      { ref: '31/1/1 Q9', correct_option: 'A', model_answer: now[2]!.answer, qid: now[2]!.qid, key_checked_by: null },
    ]);
    // a second run has nothing left to do
    expect(await refresh(file, 2099, slug, now, noPictures(now), { ...opts, write: true })).toMatchObject({ answers: 0, ids: 0, schemeTexts: 0, keysReplaced: [], added: [] });
  });
});
