/* eslint-disable no-restricted-syntax -- this test sets the environment the database layer reads, before loading it */
// Exam packages (migration 035): question pools and a learner's own practice tests — the draw (pure) and the database side.

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { drawPractice, practiceMinutes, type PoolItem } from '@/lib/hw/exams/practice';

const DB_URL = process.env.HW_ITEST_DATABASE_URL;
const suite = DB_URL ? describe : describe.skip;
Object.assign(process.env, { DATABASE_URL: DB_URL ?? '', HW_EXAMS_ENABLED: 'true' });

// ── the draw (pure) ──────────────────────────────────────────────────────────

const item = (id: string, qtype: string, marks: number, topic: string, position: number): PoolItem => ({ id, qtype, marks, topic, chapter: 'Ch1', position });
const POOL = [
  item('m1', 'mcq', 1, 'A', 0), item('m2', 'mcq', 1, 'A', 1), item('m3', 'mcq', 1, 'B', 2), item('m4', 'mcq', 1, 'C', 3),
  item('r1', 'assertion_reason', 1, 'B', 4), item('s1', 'short', 3, 'A', 5), item('s2', 'short', 3, 'B', 6), item('s3', 'short', 3, 'C', 7),
  item('v1', 'very_short', 2, 'C', 8),
];
const first = () => 0; // a fixed "random": always the first choice

describe('drawPractice', () => {
  it('takes only the chosen topics and types', () => {
    const got = drawPractice(POOL, { topics: ['A'], types: ['mcq', 'short'], count: 10 }, first);
    expect(got.map((g) => g.id).sort()).toEqual(['m1', 'm2', 's1']);
  });
  it('spreads the questions over the chosen topics', () => {
    const got = drawPractice(POOL, { topics: ['A', 'B', 'C'], types: ['mcq'], count: 3 }, first);
    expect(new Set(got.map((g) => g.topic))).toEqual(new Set(['A', 'B', 'C']));
  });
  it('puts them in the board\'s order: objective first, then by marks', () => {
    const got = drawPractice(POOL, { topics: [], types: [], count: 9 }, (n) => n - 1);
    expect(got.map((g) => g.qtype)).toEqual(['mcq', 'mcq', 'mcq', 'mcq', 'assertion_reason', 'very_short', 'short', 'short', 'short']);
  });
  it('gives what the pool has when asked for more, and nothing when nothing fits', () => {
    expect(drawPractice(POOL, { topics: ['C'], types: [], count: 30 }, first)).toHaveLength(3);
    expect(drawPractice(POOL, { topics: ['Z'], types: [], count: 5 }, first)).toEqual([]);
  });
  it('writing time follows the board\'s pace, at least ten minutes', () => {
    expect(practiceMinutes(80)).toBe(180);
    expect(practiceMinutes(2)).toBe(10);
  });
});

// ── the database side ────────────────────────────────────────────────────────

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

async function learner() {
  const u = `pr-${randomUUID().slice(0, 8)}`;
  userIds.push(u);
  await raw.query(`INSERT INTO "user" (id, name, email, role) VALUES ($1, 'L', $2, 'student')`, [u, `${u}@example.test`]);
  return u;
}
const written = (marks: number, topic: string) => ({
  marks, qtype: 'short' as const, stem: `Explain (${topic}).`, chapter: 'Chemical Reactions and Equations', topic, schemeText: 'key',
  parts: [{ label: '', marks, answer_kind: 'text', value_points: [{ id: 'v1', text: 'the point', marks, quote: '' }] }],
});
const choice = (topic: string) => ({ marks: 1, qtype: 'mcq' as const, stem: `Which (${topic})?`, chapter: 'Chemical Reactions and Equations', topic, options: ['a', 'b', 'c', 'd'], correctOption: 'B' as const });

/** A published package with a published pool: 4 multiple choice and 3 short answers over two topics. */
async function poolPackage(publishPool = true) {
  const p = (await b.createPackage(database, 'owner', { board: 'TESTBOARD', classLevel: 10, examYear: 2099, slug: `p-${randomUUID().slice(0, 8)}`, title: 'Chapter practice' })).id;
  packageIds.push(p);
  const pool = (await b.addSet(database, p, { kind: 'pool', subject: 'Science', subjectCode: '086', title: 'Ch1 pool', maxMarks: 13, durationMinutes: 60, syllabusScope: ['Chemical Reactions and Equations'] })).id;
  for (const t of ['Decomposition', 'Decomposition', 'Displacement', 'Displacement']) await b.addAuthoredItem(database, pool, choice(t));
  for (const t of ['Decomposition', 'Displacement', 'Displacement']) await b.addAuthoredItem(database, pool, written(3, t));
  if (publishPool) expect(await b.publishSet(database, pool)).toEqual({ published: true, problems: [] });
  // a package opens only with a published set: a pool still in draft keeps it closed
  expect(await b.publishPackage(database, p)).toMatchObject({ published: publishPool });
  return { p, pool };
}

suite('exam packages, pools and practice tests — integration', () => {
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

  it('a learner with access sees the pool\'s topics and types, makes a test of their own, and can start it', async () => {
    const { p, pool } = await poolPackage();
    const u = await learner();
    await b.grantEntitlement(database, 'owner', { userId: u, packageId: p, attemptsPerSet: null, expiresAt: null });
    const view = await L.packageForLearner(database, u, p, T0);
    expect(view.sets).toEqual([]); // the pool itself is never a test
    expect(view.pools).toEqual([expect.objectContaining({
      id: pool, questions: 7, chapters: ['Chemical Reactions and Equations'],
      topics: expect.arrayContaining([{ topic: 'Decomposition', questions: 3 }, { topic: 'Displacement', questions: 4 }]),
      types: [expect.objectContaining({ qtype: 'mcq', marks: [1], questions: 4 }), expect.objectContaining({ qtype: 'short', marks: [3], questions: 3 })],
    })]);
    const made = await P.buildPractice(database, u, { poolSetId: pool, topics: ['Displacement'], types: ['mcq', 'short'], count: 3 }, T0, () => 0);
    expect(made).toMatchObject({ questions: 3, durationMinutes: practiceMinutes(made.maxMarks) });
    const set = (await raw.query(`SELECT kind, status, owner_user_id, pool_set_id, max_marks::float AS m FROM hw_exam_set WHERE id = $1`, [made.setId])).rows[0];
    expect(set).toMatchObject({ kind: 'practice', status: 'published', owner_user_id: u, pool_set_id: pool, m: made.maxMarks });
    const items = (await raw.query(`SELECT number, qtype, topic FROM hw_exam_set_item WHERE set_id = $1 ORDER BY number`, [made.setId])).rows;
    expect(items.every((i) => i.topic === 'Displacement')).toBe(true);
    expect(items.map((i) => i.qtype)).toEqual([...items.map((i) => i.qtype)].sort((a, b) => (a === 'mcq' ? -1 : 1) - (b === 'mcq' ? -1 : 1)));
    // it is now one of the learner's tests, with its own printed sheet, and starts like any other
    const after = await L.packageForLearner(database, u, p, T0);
    expect(after.sets).toEqual([expect.objectContaining({ id: made.setId, kind: 'practice', questions: 3 })]);
    expect((await L.sheetForLearner(database, u, made.setId)).layout.pages.length).toBeGreaterThan(0);
    expect(await L.startAttempt(database, u, made.setId, T0)).toMatchObject({ attemptNo: 1 });
  });

  it('another learner can neither see nor start someone else\'s practice test, and nobody can start a pool', async () => {
    const { p, pool } = await poolPackage();
    const [u, other] = [await learner(), await learner()];
    for (const x of [u, other]) await b.grantEntitlement(database, 'owner', { userId: x, packageId: p, attemptsPerSet: null, expiresAt: null });
    const made = await P.buildPractice(database, u, { poolSetId: pool, topics: [], types: [], count: 2 }, T0, () => 0);
    expect((await L.packageForLearner(database, other, p, T0)).sets).toEqual([]);
    expect(await publicOf(L.startAttempt(database, other, made.setId, T0))).toMatch(/Not found/);
    expect(await publicOf(L.sheetForLearner(database, other, made.setId))).toMatch(/Not found/);
    expect(await publicOf(L.startAttempt(database, u, pool, T0))).toMatch(/Not found/);
    // and the database says the same, whatever the code does
    await expect(raw.query(`INSERT INTO hw_exam_attempt (user_id, set_id, attempt_no, expires_at, upload_deadline_at, max_marks) VALUES ($1, $2, 1, now() + interval '1 hour', now() + interval '2 hours', 2)`, [other, made.setId]))
      .rejects.toThrow(/belongs to another learner/);
    await expect(raw.query(`INSERT INTO hw_exam_attempt (user_id, set_id, attempt_no, expires_at, upload_deadline_at, max_marks) VALUES ($1, $2, 1, now() + interval '1 hour', now() + interval '2 hours', 13)`, [u, pool]))
      .rejects.toThrow(/question pool/);
    await expect(raw.query(`UPDATE hw_exam_set SET owner_user_id = NULL WHERE id = $1`, [made.setId])).rejects.toThrow();
  });

  it('refuses without access, with an unpublished pool, or when nothing fits', async () => {
    const { p, pool } = await poolPackage();
    const u = await learner();
    expect(await publicOf(P.buildPractice(database, u, { poolSetId: pool, topics: [], types: [], count: 5 }, T0))).toMatch(/access|पहुँच|plan|योजना/i);
    await b.grantEntitlement(database, 'owner', { userId: u, packageId: p, attemptsPerSet: null, expiresAt: null });
    expect(await publicOf(P.buildPractice(database, u, { poolSetId: pool, topics: ['Nothing'], types: [], count: 5 }, T0))).toMatch(/No questions match/);
    expect(await publicOf(P.buildPractice(database, u, { poolSetId: pool, topics: [], types: [], count: 0 }, T0))).toMatch(/between 1 and 30/);
    const draft = await poolPackage(false);
    await b.grantEntitlement(database, 'owner', { userId: u, packageId: draft.p, attemptsPerSet: null, expiresAt: null });
    expect(await publicOf(P.buildPractice(database, u, { poolSetId: draft.pool, topics: [], types: [], count: 5 }, T0))).toMatch(/Not found/);
  });

  it('the super admin\'s package page does not list learners\' practice tests', async () => {
    const { p, pool } = await poolPackage();
    const u = await learner();
    await b.grantEntitlement(database, 'owner', { userId: u, packageId: p, attemptsPerSet: null, expiresAt: null });
    await P.buildPractice(database, u, { poolSetId: pool, topics: [], types: [], count: 2 }, T0, () => 0);
    expect((await b.getPackage(database, p)).sets.map((s) => s.kind)).toEqual(['pool']);
  });

  it('decision D3 for exams only: an authored exam question is AI-markable only with HW_EXAMS_AUTHORED_AI_ENABLED, and nowhere else', async () => {
    const { p, pool } = await poolPackage();
    const u = await learner();
    await b.grantEntitlement(database, 'owner', { userId: u, packageId: p, attemptsPerSet: null, expiresAt: null });
    const made = await P.buildPractice(database, u, { poolSetId: pool, topics: [], types: ['short'], count: 1 }, T0, () => 0);
    const { attemptId } = await L.startAttempt(database, u, made.setId, T0);
    const { materialiseAttempt } = await import('@/lib/hw/exams/materialise');
    const m = await database.transaction((tx) => materialiseAttempt(tx, attemptId));
    const qid = m.questions[0]!.questionId;
    const { eligibilityOfQuestion } = await import('@/lib/hw/eligibility/registry');
    const { checkKeyForMarking } = await import('@/lib/hw/keys/product');
    const { hwQuestion } = await import('@/db/hw-schema');
    const { eq } = await import('drizzle-orm');
    const config = await import('@/lib/hw/config');
    const set = (v: string) => { process.env.HW_EXAMS_AUTHORED_AI_ENABLED = v; process.env.HW_ELIGIBILITY_ENFORCED = 'true'; process.env.HW_GRADE_MODEL = 'test-grader'; config._resetHwConfig(); };
    try {
      set('false');
      expect(await eligibilityOfQuestion(database, qid)).toMatchObject({ eligible: false, reason: 'teacher_rubric' });
      set('true');
      expect(await eligibilityOfQuestion(database, qid)).toMatchObject({ eligible: true, scheme: { source: 'teacher_rubric' } });
      // the same question in any other institution stays with a person
      const q = (await database.select().from(hwQuestion).where(eq(hwQuestion.id, qid)))[0]!;
      expect(await checkKeyForMarking(database, { ...q, organizationId: 'some-school' })).toEqual({ ok: false, reason: 'teacher_rubric' });
    } finally {
      delete process.env.HW_EXAMS_AUTHORED_AI_ENABLED; delete process.env.HW_ELIGIBILITY_ENFORCED; config._resetHwConfig();
    }
  });
});
