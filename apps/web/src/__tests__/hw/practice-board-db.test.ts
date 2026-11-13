/* eslint-disable no-restricted-syntax -- this test sets the environment the feature reads, before loading it */
// InkBuddy board practice (docs/hw-eval/board-bank-roadmap.md, phase 3): what is offered (pure), the textbook link, and the database side — the
// catalogue by chapter and NCERT topic, starting a question, marking a multiple-choice answer by code, and the owner's switch for written answers.

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

const DB_URL = process.env.HW_ITEST_DATABASE_URL;
const suite = DB_URL ? describe : describe.skip;
Object.assign(process.env, {
  DATABASE_URL: DB_URL ?? '', HW_SELF_PRACTICE_ENABLED: 'true', HW_SELF_PRACTICE_TRIAL_BUDGET_PAISE: '1000', HW_SELF_PRACTICE_MAX_ATTEMPTS: '25',
  HW_EXAMS_ENABLED: 'true', HW_ELIGIBILITY_ENFORCED: 'true',
});

// the module is loaded after the environment is set (it reads the database settings when loaded)
let P: typeof import('@/lib/hw/practice/board');
beforeAll(async () => { P = await import('@/lib/hw/practice/board'); });
const boardPlanOf = (...a: Parameters<typeof P.boardPlanOf>) => P.boardPlanOf(...a);
const reviseOf = (...a: Parameters<typeof P.reviseOf>) => P.reviseOf(...a);

const CHECKED = 'KEY TO CHECK: written by the assistant from NCERT Class X Science, chapter 5 (Life Processes); a teacher must confirm it\nkey';
const mcqItem = { qtype: 'mcq', marks: 1, stem: 'Which enzyme acts on proteins in the stomach?', options: ['Pepsin', 'Amylase', 'Trypsin', 'Lipase'], correctOption: 'A', parts: [], schemeText: CHECKED, keyCheckedBy: 'Ms Rao' };
const writtenItem = {
  qtype: 'short', marks: 3, stem: '(a) Explain peristalsis. (b) Draw the alimentary canal.', options: [], correctOption: null, schemeText: CHECKED, keyCheckedBy: 'Ms Rao',
  parts: [
    { label: 'a', marks: 1, answer_kind: 'text', value_points: [{ id: 'v1', text: 'Rhythmic contraction of the gut muscles pushes food along', marks: 1, quote: '' }] },
    { label: 'b', marks: 2, answer_kind: 'diagram', value_points: [{ id: 'v2', text: 'labels', marks: 2, quote: '' }] },
  ],
};

describe('boardPlanOf (pure)', () => {
  it('a multiple-choice question: the options in the prompt, the right option and the wrong ones for code marking', () => {
    const p = boardPlanOf(mcqItem as never, false);
    expect(p).toMatchObject({ ok: true, mode: 'choice', marks: 1 });
    if (!p.ok || p.mode !== 'choice') throw new Error('plan');
    expect(p.prompt).toContain('A. Pepsin');
    expect(p.prompt).toMatch(/Write the letter of the correct option\.$/);
    expect(p.acceptedAnswers).toEqual(expect.arrayContaining(['A', 'Pepsin', 'A. Pepsin']));
    expect(p.wrongAnswers).toEqual(expect.arrayContaining(['B', 'Trypsin']));
    expect(p.wrongAnswers).not.toContain('A');
  });
  it('a key the assistant wrote is never offered before a teacher checked it; the board\'s own scheme needs no check', () => {
    expect(boardPlanOf({ ...mcqItem, keyCheckedBy: null } as never, true)).toEqual({ ok: false, why: 'key_unchecked' });
    expect(boardPlanOf({ ...mcqItem, keyCheckedBy: null, schemeText: 'CBSE marking scheme: 31/4/1 Q1' } as never, true)).toMatchObject({ ok: true });
  });
  it('a written question: only with the owner\'s switch on; a drawing part is left out of the marks and the learner is told', () => {
    expect(boardPlanOf(writtenItem as never, false)).toEqual({ ok: false, why: 'written_off' });
    const p = boardPlanOf(writtenItem as never, true);
    expect(p).toMatchObject({ ok: true, mode: 'written', marks: 1, hasDrawing: true, rubric: [{ text: '(a) Rhythmic contraction of the gut muscles pushes food along', marks: 1 }] });
    if (p.ok) expect(p.prompt).toMatch(/Part b asks for a drawing/);
    expect(boardPlanOf({ ...writtenItem, parts: [writtenItem.parts[1]] } as never, true)).toEqual({ ok: false, why: 'nothing_markable' });
  });
});

describe('reviseOf (pure)', () => {
  const ref = { ncertSection: '5.2.1', ncertTitle: 'Autotrophic Nutrition', ncertPages: '81-83', chapterNo: '5', book: 'NCERT Science Class X', classLevel: '10', subject: 'Science' };
  it('names the section and pages and links to that page of the chapter on ncert.nic.in', () => {
    expect(reviseOf(ref)).toEqual({ book: 'NCERT Science Class X', chapterNo: 5, chapter: '', section: '5.2.1', title: 'Autotrophic Nutrition', pages: '81-83', url: 'https://ncert.nic.in/textbook/pdf/jesc105.pdf#page=3' });
    expect(reviseOf({ ...ref, chapterNo: '1', ncertPages: '1-16' })!.url).toBe('https://ncert.nic.in/textbook/pdf/jesc101.pdf#page=1');
  });
  it('no link it cannot be sure of (another class or subject), and nothing without a textbook reference', () => {
    expect(reviseOf({ ...ref, classLevel: '9' })!.url).toBeNull();
    expect(reviseOf({ ...ref, subject: 'Mathematics' })!.url).toBeNull();
    expect(reviseOf({ poolItemId: 'x' })).toBeNull();
  });
});

// ── the database side ────────────────────────────────────────────────────────

let raw: Pool;
let database: typeof import('@/db')['db'];
let dbMod: typeof import('@/lib/db/connection');
let b: typeof import('@/lib/hw/exams/builder');
let B: typeof import('@/lib/hw/practice/board');
let trial: typeof import('@/lib/hw/practice/trial');
let pipeline: typeof import('@/lib/hw/pipeline');
let product: typeof import('@/lib/hw/keys/product');
let rules: typeof import('@/lib/hw/grader/exact-match');
let config: typeof import('@/lib/hw/config');
const packageIds: string[] = [];
const userIds: string[] = [];
const publicOf = (p: Promise<unknown>) => p.then(() => 'resolved', (e: { publicMessage?: string; message: string }) => e.publicMessage ?? e.message);
const sign = async (key: string) => `signed:${key}`;
const FIG = `hw-exams/figures/${'b'.repeat(64)}.png`;
const ncert = (section: string, title: string, pages: string) => ({ book: 'NCERT Science Class X', chapterNo: 5, section, title, pages });

/** A published package for a class, with one published pool: two multiple-choice and one written question over two topics (keys checked). */
async function poolPackage(classLevel = 10) {
  const p = (await b.createPackage(database, 'owner', { board: 'TESTBOARD', classLevel, examYear: 2099, slug: `bp-${randomUUID().slice(0, 8)}`, title: 'Chapter practice' })).id;
  packageIds.push(p);
  const pool = (await b.addSet(database, p, { kind: 'pool', subject: 'Science', subjectCode: '086', title: 'Ch5 pool', maxMarks: 5, durationMinutes: 60, syllabusScope: ['Life Processes'] })).id;
  const base = { chapter: 'Life Processes', section: 'B', schemeText: CHECKED };
  const m1 = (await b.addAuthoredItem(database, pool, { ...base, qtype: 'mcq', marks: 1, stem: mcqItem.stem, options: mcqItem.options, correctOption: 'A', topic: '5.2.4 Nutrition in Human Beings', ncert: ncert('5.2.4', 'Nutrition in Human Beings', '84-86'), sources: ['31/7/1 Q1', '31/7/3 Q6'], figures: [{ key: FIG, description: 'the stomach', labels: [] }] })).id;
  const m2 = (await b.addAuthoredItem(database, pool, { ...base, qtype: 'assertion_reason', marks: 1, stem: 'Assertion (A): ... Reason (R): ...', options: ['both, explains', 'both, not', 'A only', 'R only'], correctOption: 'C', topic: '5.3 Respiration', ncert: ncert('5.3', 'Respiration', '87-90'), sources: ['31(B)-E2 Q8'] })).id;
  const w = (await b.addAuthoredItem(database, pool, { ...base, qtype: 'short', marks: 3, stem: writtenItem.stem, parts: writtenItem.parts, diagramParts: ['b'], topic: '5.2.4 Nutrition in Human Beings', ncert: ncert('5.2.4', 'Nutrition in Human Beings', '84-86'), sources: ['31/4/1 Q13'] })).id;
  for (const id of [m1, m2, w]) await b.checkItemKey(database, id, 'Ms Rao', true);
  expect(await b.publishSet(database, pool)).toEqual({ published: true, problems: [] });
  expect(await b.publishPackage(database, p)).toMatchObject({ published: true });
  return { p, pool, m1, m2, w };
}
const learner = async (grade = 10) => {
  const id = `bd-${randomUUID().slice(0, 8)}`;
  userIds.push(id);
  await raw.query(`INSERT INTO "user" (id, name, email, role, created_at) VALUES ($1, 'Learner', $2, 'student', now())`, [id, `${id}@example.test`]);
  await raw.query(`INSERT INTO enhanced_user_profiles (user_id, grade_level, medium) VALUES ($1, $2, 'ENGLISH') ON CONFLICT (user_id) DO NOTHING`, [id, grade]);
  await trial.startTrial(id);
  return id;
};
const withWritten = async <T>(on: boolean, fn: () => Promise<T>) => {
  process.env.HW_INKBUDDY_POOL_AI_ENABLED = on ? 'true' : 'false'; config._resetHwConfig();
  try { return await fn(); } finally { process.env.HW_INKBUDDY_POOL_AI_ENABLED = 'false'; config._resetHwConfig(); }
};

suite('InkBuddy board practice (phase 3) — integration', () => {
  jest.setTimeout(60_000);
  beforeAll(async () => {
    raw = new Pool({ connectionString: DB_URL });
    dbMod = await import('@/lib/db/connection');
    database = (await import('@/db')).db;
    config = await import('@/lib/hw/config');
    config._resetHwConfig();
    b = await import('@/lib/hw/exams/builder');
    B = await import('@/lib/hw/practice/board');
    trial = await import('@/lib/hw/practice/trial');
    pipeline = await import('@/lib/hw/pipeline');
    product = await import('@/lib/hw/keys/product');
    rules = await import('@/lib/hw/grader/exact-match');
  });
  afterAll(async () => {
    const c = await raw.connect();
    try {
      await c.query(`SET session_replication_role = replica`);
      if (userIds.length) {
        await c.query(`DELETE FROM hw_rubric_item WHERE question_id IN (SELECT q.id FROM hw_question q JOIN hw_assignment a ON a.id = q.assignment_id WHERE a.created_by = ANY($1))`, [userIds]);
        await c.query(`DELETE FROM hw_question WHERE assignment_id IN (SELECT id FROM hw_assignment WHERE created_by = ANY($1))`, [userIds]);
        await c.query(`DELETE FROM hw_assignment WHERE created_by = ANY($1)`, [userIds]);
      }
      if (packageIds.length) {
        await c.query(`DELETE FROM hw_exam_set_item WHERE set_id IN (SELECT id FROM hw_exam_set WHERE package_id = ANY($1))`, [packageIds]);
        await c.query(`DELETE FROM hw_exam_set WHERE package_id = ANY($1)`, [packageIds]);
        await c.query(`DELETE FROM hw_exam_package WHERE id = ANY($1)`, [packageIds]);
      }
    } finally { c.release(); }
    await raw?.end();
    await dbMod?.getPool().end();
  });

  it('the catalogue: chapters, then NCERT topics in order, with counts and how often asked; written questions only with the switch on', async () => {
    await poolPackage();
    const u = await learner();
    const off = await B.boardCatalogue(database, u);
    expect(off.writtenOn).toBe(false);
    const ch = off.chapters.find((c) => c.chapter === 'Life Processes')!;
    const topic = (s: string) => ch.topics.find((t) => t.section === s)!;
    expect(ch.chapterNo).toBe(5);
    expect(topic('5.2.4')).toMatchObject({ title: 'Nutrition in Human Beings', pages: '84-86', objective: 1, written: 0, best: null });
    expect(topic('5.3')).toMatchObject({ objective: 1, written: 0 });
    // topics are in NCERT order (5.2.4 before 5.3)
    expect(ch.topics.map((t) => t.section).indexOf('5.2.4')).toBeLessThan(ch.topics.map((t) => t.section).indexOf('5.3'));
    const on = await withWritten(true, () => B.boardCatalogue(database, u));
    expect(on.chapters.find((c) => c.chapter === 'Life Processes')!.topics.find((t) => t.section === '5.2.4')).toMatchObject({ objective: 1, written: 1 });
  });

  it('a topic\'s questions carry their pictures and sources, never the right option or the key; another class sees nothing', async () => {
    const { m1 } = await poolPackage();
    const u = await learner();
    const r = await B.boardQuestions(database, u, '5.2.4', sign);
    const q = r.questions.find((x) => x.itemId === m1)!;
    expect(q).toMatchObject({ qtype: 'mcq', marks: 1, asked: 2, sources: ['31/7/1 Q1', '31/7/3 Q6'], figures: [{ description: 'the stomach', url: `signed:${FIG}` }] });
    expect(JSON.stringify(r)).not.toMatch(/correctOption|KEY TO CHECK|Ms Rao|Rhythmic/);
    const nine = await learner(9);
    expect((await B.boardQuestions(database, nine, '5.2.4', sign)).questions.filter((x) => x.itemId === m1)).toEqual([]);
  });

  it('starting a multiple-choice question makes one InkBuddy attempt on the pool\'s key; the right and wrong options are marked by code', async () => {
    const { m1 } = await poolPackage();
    const u = await learner();
    const { assignmentId, reused } = await B.startBoardAttempt(u, m1);
    expect(reused).toBe(false);
    expect((await B.startBoardAttempt(u, m1))).toEqual({ assignmentId, reused: true });
    const q = (await raw.query(`SELECT * FROM hw_question WHERE assignment_id = $1`, [assignmentId])).rows[0];
    expect(q).toMatchObject({ origin: 'custom', rubric_mode: 'teacher', marks: '1.00' });
    expect(q.origin_ref).toMatchObject({ poolItemId: m1, objective: '1', ncertSection: '5.2.4', ncertPages: '84-86', chapterNo: '5', sources: '31/7/1 Q1, 31/7/3 Q6' });
    const gq = (await pipeline.loadGradeQuestion(database, q.id))!;
    expect(gq.choice).toBeDefined();
    expect(rules.gradeWithoutAi(gq, 'a1', 'A')).toMatchObject({ suggestedMarks: 1, model: rules.EXACT_MATCH_MODEL });
    expect(rules.gradeWithoutAi(gq, 'a1', 'Trypsin')).toMatchObject({ suggestedMarks: 0, model: rules.CHOICE_WRONG_MODEL });
    expect(rules.gradeWithoutAi(gq, 'a1', 'A or C')).toBeNull(); // unclear: never guessed
    // an unclear answer may go to the model against the one right option, switch or not
    const [row] = await database.select().from((await import('@/db/hw-schema')).hwQuestion).where((await import('drizzle-orm')).eq((await import('@/db/hw-schema')).hwQuestion.id, q.id));
    expect(await product.checkKeyForMarking(database, row!)).toMatchObject({ ok: true });
    expect(B.reviseOf(q.origin_ref)!.url).toBe('https://ncert.nic.in/textbook/pdf/jesc105.pdf#page=6');
  });

  it('a written question: refused while the switch is off; with it on, marked by the model against the checked points (the drawing left out)', async () => {
    const { w } = await poolPackage();
    const u = await learner();
    expect(await publicOf(B.startBoardAttempt(u, w))).toMatch(/not on offer/);
    const { assignmentId } = await withWritten(true, () => B.startBoardAttempt(u, w));
    const q = (await raw.query(`SELECT * FROM hw_question WHERE assignment_id = $1`, [assignmentId])).rows[0];
    expect(q).toMatchObject({ marks: '1.00', rubric_mode: 'teacher' });
    expect(q.prompt).toMatch(/Part b asks for a drawing/);
    const rubric = (await raw.query(`SELECT description, marks FROM hw_rubric_item WHERE question_id = $1 ORDER BY position`, [q.id])).rows;
    expect(rubric).toEqual([{ description: '(a) Rhythmic contraction of the gut muscles pushes food along', marks: '1.00' }]);
    const hq = (await import('@/db/hw-schema')).hwQuestion;
    const [row] = await database.select().from(hq).where((await import('drizzle-orm')).eq(hq.id, q.id));
    expect(await withWritten(true, () => product.checkKeyForMarking(database, row!))).toMatchObject({ ok: true });
    // switched off again later: the attempt waits for a person rather than being marked by a model
    expect(await product.checkKeyForMarking(database, row!)).toEqual({ ok: false, reason: 'teacher_rubric' });
  });

  it('a question of a pool that is not published, or of an unpublished package, is not on offer', async () => {
    const p = (await b.createPackage(database, 'owner', { board: 'TESTBOARD', classLevel: 10, examYear: 2099, slug: `bq-${randomUUID().slice(0, 8)}`, title: 'Draft' })).id;
    packageIds.push(p);
    const pool = (await b.addSet(database, p, { kind: 'pool', subject: 'Science', subjectCode: '086', title: 'Draft pool', maxMarks: 1, durationMinutes: 60, syllabusScope: ['Life Processes'] })).id;
    const id = (await b.addAuthoredItem(database, pool, { qtype: 'mcq', marks: 1, stem: 'Q?', options: ['a', 'b', 'c', 'd'], correctOption: 'A', chapter: 'Life Processes', topic: '5.3 Respiration', ncert: ncert('5.3', 'Respiration', '87-90'), schemeText: 'CBSE marking scheme: x' })).id;
    const u = await learner();
    expect(await publicOf(B.startBoardAttempt(u, id))).toMatch(/not on offer/);
    expect((await B.boardQuestions(database, u, '5.3', sign)).questions.map((q) => q.itemId)).not.toContain(id);
  });
});
