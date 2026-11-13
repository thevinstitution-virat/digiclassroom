/* eslint-disable no-restricted-syntax -- this test sets the environment the database layer reads, before loading it */
// Exam packages, phase 6: the report. The assembly is pure and tested exactly; then one attempt end to end against a real Postgres: marked
// answers (a rule's, the model's), one waiting for a person, the runner's report step, the learner's view with progress, append-only.
//   HW_ITEST_DATABASE_URL=postgres://... npx jest src/__tests__/hw/exams-report     (needs migrations 032-035)

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import type { ReportAnswer } from '@/lib/hw/exams/report';
import { blueprintFor } from '@/lib/hw/exams/blueprint';
import { parseWritingProfile } from '@/lib/hw/prompts/writing-profile.v1';

const DB_URL = process.env.HW_ITEST_DATABASE_URL;
const suite = DB_URL ? describe : describe.skip;
Object.assign(process.env, { DATABASE_URL: DB_URL ?? '', HW_EXAMS_ENABLED: 'true', HW_READ_MODEL: 'test-reader', HW_GRADE_MODEL: 'test-grader' });

// loaded after the environment is set: the module opens the database connection
let assembleReport: typeof import('@/lib/hw/exams/report')['assembleReport'];
let finalOf: typeof import('@/lib/hw/exams/report')['finalOf'];
let perQuestionOf: typeof import('@/lib/hw/exams/report')['perQuestionOf'];
let writingInputOf: typeof import('@/lib/hw/exams/report')['writingInputOf'];
beforeAll(async () => ({ assembleReport, finalOf, perQuestionOf, writingInputOf } = await import('@/lib/hw/exams/report')));

// ── the assembly (pure) ──────────────────────────────────────────────────────

const CH1 = 'Chemical Reactions and Equations';
const ans = (o: Partial<ReportAnswer> & { number: number }): ReportAnswer => ({
  answerId: `a${o.number}${o.alt ?? ''}`, alt: null, choiceGroup: null, qtype: 'short', chapter: CH1, topic: '', marks: 3, itemMarks: 3, prompt: 'Explain.',
  diagramParts: [], transcript: 'some words here', transcriptStatus: 'done', transcriptConfidence: 0.9, unclearCount: 0, failureReason: null, handOnly: null,
  rubric: [{ id: 'r1', description: 'first point', marks: 1 }, { id: 'r2', description: 'second point', marks: 2 }], teacher: null, auto: null, ...o,
});
const strict = (m1: number, m2: number, f1: 'same_fact' | 'different_fact' | 'absent' = 'same_fact', f2: 'same_fact' | 'right_idea_wrong_detail' | 'different_fact' | 'absent' = 'same_fact') => ({
  model: 'gpt-6-luna', marks: m1 + m2, items: [
    { rubric_item_id: 'r1', marks: m1, verdict: (m1 ? 'met' : 'missing') as 'met' | 'missing', quote: m1 ? 'first' : '', fact: f1 },
    { rubric_item_id: 'r2', marks: m2, verdict: (m2 === 2 ? 'met' : m2 ? 'partial' : 'missing') as 'met' | 'partial' | 'missing', quote: m2 ? 'second' : '', fact: f2 },
  ],
});

describe('exam report assembly', () => {
  it('takes the teacher\'s grade over the model\'s, the model\'s over nothing, and leaves an unmarked answer pending', () => {
    const a = ans({ number: 1, auto: strict(1, 0) });
    expect(finalOf(a)).toMatchObject({ awarded: 1, status: 'marked', source: 'ai', points: [{ text: 'first point', awarded: 1, verdict: 'met', quote: 'first' }, { awarded: 0, verdict: 'missing' }] });
    expect(finalOf({ ...a, teacher: { marks: 3, itemMarks: [{ rubric_item_id: 'r1', marks: 1 }, { rubric_item_id: 'r2', marks: 2 }] } }))
      .toMatchObject({ awarded: 3, source: 'teacher', points: [{ verdict: 'met' }, { verdict: 'met', quote: '' }] });
    expect(finalOf(ans({ number: 2, auto: { model: 'rule:blank', marks: 0, items: [] }, transcript: '' }))).toMatchObject({ status: 'blank', awarded: 0, source: 'rule' });
    expect(finalOf(ans({ number: 3, transcriptStatus: 'needs_review' }))).toBeNull();
    // a mark the database would refuse is never shown above the question's marks
    expect(finalOf(ans({ number: 4, auto: { model: 'm', marks: 9, items: [] } }))?.awarded).toBe(3);
  });

  it('counts an internal choice once, at the better alternative answered', () => {
    const qs = perQuestionOf([
      ans({ number: 5, alt: 'A', choiceGroup: 'g5', auto: strict(1, 0) }),
      ans({ number: 5, alt: 'B', choiceGroup: 'g5', auto: strict(1, 2) }),
      ans({ number: 6, alt: 'A', choiceGroup: 'g6', auto: { model: 'rule:blank', marks: 0, items: [] }, transcript: '' }),
      ans({ number: 6, alt: 'B', choiceGroup: 'g6', transcriptStatus: 'needs_review' }),
    ]);
    expect(qs.map((q) => [q.number, q.alt, q.status, q.awarded])).toEqual([[5, 'A', 'not_counted', null], [5, 'B', 'marked', 3], [6, 'A', 'not_counted', null], [6, 'B', 'pending', null]]);
  });

  it('adds up marked marks only, says what is pending and what a drawing part left out', () => {
    const r = assembleReport([
      ans({ number: 1, auto: strict(1, 2) }),
      ans({ number: 2, auto: strict(0, 1, 'different_fact', 'right_idea_wrong_detail') }),
      ans({ number: 3, transcriptStatus: 'needs_review', marks: 2, itemMarks: 5, rubric: [] }),
    ], { maxMarks: 11, writing: null, blueprint: null });
    expect(r).toMatchObject({ marksAwarded: 4, maxMarks: 11, markedMarks: 6, pendingMarks: 2, excludedMarks: 3 });
    expect(r.perQuestion[2]).toMatchObject({ status: 'pending', reason: expect.stringMatching(/checking how your writing was read/) });
  });

  it('the eight parameters come from the passes that can see them, with the counts behind each, and never a guess', () => {
    const r = assembleReport([
      ans({ number: 1, auto: strict(1, 2), transcript: 'Burning magnesium gives magnesium oxide [diagram]', prompt: 'Draw a labelled diagram.' }),
      ans({ number: 2, auto: strict(0, 1, 'different_fact', 'right_idea_wrong_detail'), unclearCount: 2, transcript: 'one two three four five six seven eight nine ten' }),
      ans({ number: 3, qtype: 'mcq', marks: 1, itemMarks: 1, rubric: [], transcript: 'B', auto: { model: 'exact_match', marks: 1, items: [] } }),
    ], { maxMarks: 7, writing: null, writingWhy: 'too_little_writing', blueprint: null });
    const p = Object.fromEntries(r.profile.parameters.map((x) => [x.id, x]));
    // written points: same, same; different, half-right; the multiple choice right = 3.5 of 5
    expect(p.factual_correctness).toMatchObject({ score: 0.7, band: 'fair', facts: { right: 3.5, of: 5 }, why: null });
    expect(p.step_marking).toMatchObject({ score: 4 / 6, facts: { got: 4, of: 6, answers: 2 } });
    expect(p.diagrams_and_tables).toMatchObject({ score: 1, facts: { drawn: 1, asked: 1 } });
    expect(p.presentation!.facts).toEqual({ unclear: 2, words: 16 });
    expect(p.presentation!.score).toBeCloseTo(0.9 - 2 * (2 / 16));
    for (const k of ['spelling', 'grammar', 'punctuation']) expect(p[k]).toMatchObject({ score: null, band: 'unavailable', why: 'too_little_writing' });
    expect(p.textbook_adherence).toMatchObject({ band: 'unavailable', why: 'library' });
  });

  it('the writing check: scores out of ten become shares, with its own examples; its input is the written answers only', () => {
    const w = parseWritingProfile({ spelling: { score: 7, examples: [{ written: 'oxigen', correct: 'oxygen' }] }, grammar: { score: 12, examples: [] }, punctuation: { score: 9, examples: [] } })!;
    expect(w.grammar.score).toBe(10);
    expect(parseWritingProfile({ spelling: { score: 'x' } })).toBeNull();
    const r = assembleReport([ans({ number: 1, auto: strict(1, 2) })], { maxMarks: 3, writing: w, blueprint: null });
    expect(r.profile.parameters.find((x) => x.id === 'spelling')).toMatchObject({ score: 0.7, band: 'fair', examples: [{ written: 'oxigen', correct: 'oxygen' }] });
    const long = 'word '.repeat(30);
    expect(writingInputOf([ans({ number: 1, transcript: long }), ans({ number: 2, qtype: 'mcq', transcript: 'B' })])).toEqual({ answers: [{ label: 'Q1', text: long.trim() }] });
    expect(writingInputOf([ans({ number: 1, transcript: 'too short' })])).toEqual({ skip: 'too_little_writing' });
  });

  it('weak areas by chapter and by topic, worst first, and study priorities by the board\'s units', () => {
    const bp = blueprintFor({ board: 'CBSE', classLevel: 10, examYear: 2027, subjectCode: '086' })!;
    const r = assembleReport([
      ans({ number: 1, topic: 'Balancing', auto: strict(1, 2) }),
      ans({ number: 2, topic: 'Types of reactions', auto: strict(0, 0, 'absent', 'absent') }),
      ans({ number: 3, chapter: 'Light - Reflection and Refraction', qtype: 'long', marks: 3, auto: strict(1, 0) }),
    ], { maxMarks: 9, writing: null, blueprint: bp });
    const chapters = r.weakAreas.filter((w) => w.level === 'chapter');
    expect(chapters.map((w) => [w.chapter, w.awarded, w.marks])).toEqual([['Light - Reflection and Refraction', 1, 3], [CH1, 3, 6]]);
    expect(chapters[0]!.missedKinds).toEqual(['long']);
    expect(r.weakAreas.filter((w) => w.level === 'topic').map((w) => w.topic)).toEqual(['Types of reactions', '—', 'Balancing']);
    expect(r.profile.priorities.map((p) => p.unit).length).toBeGreaterThan(0);
    expect(r.profile.priorities.every((p) => p.gainable >= 0)).toBe(true);
  });
});

// ── the database side ────────────────────────────────────────────────────────

let raw: Pool;
let database: typeof import('@/db')['db'];
let dbMod: typeof import('@/lib/db/connection');
let b: typeof import('@/lib/hw/exams/builder');
let L: typeof import('@/lib/hw/exams/learner');
let P: typeof import('@/lib/hw/exams/practice');
let R: typeof import('@/lib/hw/exams/report');
const packageIds: string[] = [];
const userIds: string[] = [];
const T0 = new Date('2099-04-01T09:00:00Z');

suite('exam report — integration', () => {
  jest.setTimeout(60_000);
  beforeAll(async () => {
    raw = new Pool({ connectionString: DB_URL });
    dbMod = await import('@/lib/db/connection');
    database = (await import('@/db')).db;
    (await import('@/lib/hw/config'))._resetHwConfig();
    b = await import('@/lib/hw/exams/builder');
    L = await import('@/lib/hw/exams/learner');
    P = await import('@/lib/hw/exams/practice');
    R = await import('@/lib/hw/exams/report');
  });
  afterAll(async () => {
    const c = await raw.connect();
    try {
      await c.query(`SET session_replication_role = replica`);
      if (userIds.length) {
        const asg = (await c.query(`SELECT assignment_id FROM hw_exam_attempt WHERE user_id = ANY($1) AND assignment_id IS NOT NULL`, [userIds])).rows.map((r) => r.assignment_id);
        await c.query(`DELETE FROM hw_exam_report WHERE attempt_id IN (SELECT id FROM hw_exam_attempt WHERE user_id = ANY($1))`, [userIds]);
        await c.query(`DELETE FROM hw_exam_attempt WHERE user_id = ANY($1)`, [userIds]);
        await c.query(`DELETE FROM hw_exam_entitlement WHERE user_id = ANY($1)`, [userIds]);
        if (asg.length) {
          await c.query(`DELETE FROM hw_ai_grade WHERE answer_id IN (SELECT a.id FROM hw_answer a JOIN hw_submission s ON s.id = a.submission_id WHERE s.assignment_id = ANY($1))`, [asg]);
          await c.query(`DELETE FROM hw_ai_job WHERE submission_id IN (SELECT id FROM hw_submission WHERE assignment_id = ANY($1)) OR question_id IN (SELECT id FROM hw_question WHERE assignment_id = ANY($1))`, [asg]);
          await c.query(`DELETE FROM hw_answer WHERE submission_id IN (SELECT id FROM hw_submission WHERE assignment_id = ANY($1))`, [asg]);
          await c.query(`DELETE FROM hw_submission WHERE assignment_id = ANY($1)`, [asg]);
          await c.query(`DELETE FROM hw_rubric_item WHERE question_id IN (SELECT id FROM hw_question WHERE assignment_id = ANY($1))`, [asg]);
          await c.query(`DELETE FROM hw_question WHERE assignment_id = ANY($1)`, [asg]);
          await c.query(`DELETE FROM hw_assignment WHERE id = ANY($1)`, [asg]);
        }
      }
      if (packageIds.length) {
        await c.query(`DELETE FROM hw_exam_set_item WHERE set_id IN (SELECT id FROM hw_exam_set WHERE package_id = ANY($1))`, [packageIds]);
        await c.query(`DELETE FROM hw_exam_set WHERE package_id = ANY($1)`, [packageIds]);
        await c.query(`DELETE FROM hw_exam_package WHERE id = ANY($1)`, [packageIds]);
      }
      if (userIds.length) await c.query(`DELETE FROM "user" WHERE id = ANY($1)`, [userIds]);
    } finally { c.release(); }
    await raw?.end();
    await dbMod?.getPool().end();
  });

  /** A learner's practice test of 1 multiple choice and 2 short answers, handed in and read: Q1 right, Q2 marked by the model, Q3 waiting for a person. */
  async function readAttempt(u: string, pool: string, attemptNo: number, q2: [number, number]) {
    const made = await P.buildPractice(database, u, { poolSetId: pool, topics: [], types: ['mcq', 'short'], count: 3 }, T0, (n) => n - 1);
    void made;
    const set = (await raw.query(`SELECT id FROM hw_exam_set WHERE owner_user_id = $1 ORDER BY created_at DESC LIMIT 1`, [u])).rows[0].id as string;
    return evaluated(u, set, attemptNo, q2);
  }
  async function evaluated(u: string, set: string, attemptNo: number, q2: [number, number]) {
    const { attemptId } = await L.startAttempt(database, u, set, new Date(T0.getTime() + attemptNo * 3600_000));
    const { materialiseAttempt } = await import('@/lib/hw/exams/materialise');
    const m = await database.transaction((tx) => materialiseAttempt(tx, attemptId));
    await raw.query(`UPDATE hw_exam_attempt SET status = 'evaluating', submitted_at = now() WHERE id = $1`, [attemptId]);
    await raw.query(`UPDATE hw_submission SET status = 'ready_for_review' WHERE id = $1`, [m.submissionId]);
    const [mcq, s1, s2] = m.questions;
    await raw.query(`UPDATE hw_answer SET transcript = 'B', transcript_status = 'done' WHERE id = $1`, [mcq!.answerId]);
    await raw.query(`UPDATE hw_answer SET transcript = 'Silver chloride turns grey in sunlight: decomposition.', transcript_status = 'done', transcript_confidence = 0.92, unclear_count = 1 WHERE id = $1`, [s1!.answerId]);
    await raw.query(`UPDATE hw_answer SET transcript = 'hard to read', transcript_status = 'needs_review', failure_reason = 'low confidence read' WHERE id = $1`, [s2!.answerId]);
    const r1 = (await raw.query(`SELECT id FROM hw_rubric_item WHERE question_id = $1 ORDER BY position`, [s1!.questionId])).rows.map((r) => r.id as string);
    await raw.query(`INSERT INTO hw_ai_grade (id, organization_id, answer_id, model, prompt_version, rubric_version, items, suggested_marks, confidence)
      VALUES ($1, 'vgp-exams', $2, 'exact_match', 'rules.v1', 1, '[]', 1, 1)`, [randomUUID(), mcq!.answerId]);
    await raw.query(`INSERT INTO hw_ai_grade (id, organization_id, answer_id, model, prompt_version, rubric_version, items, suggested_marks, confidence)
      VALUES ($1, 'vgp-exams', $2, 'test-grader', 'grade-strict.v2', 1, $3, $4, 0.9)`, [randomUUID(), s1!.answerId, JSON.stringify(
      r1.map((id, i) => ({ rubric_item_id: id, verdict: q2[i] ? 'met' : 'missing', quote: q2[i] ? 'turns grey' : '', marks: q2[i] ?? 0, confidence: 0.9, fact: q2[i] ? 'same_fact' : 'absent' }))), q2.reduce((s, x) => s + x, 0)]);
    return { attemptId, m, set };
  }

  it('makes the report once marking has finished: marks, points, pending, parameters; the attempt is reported; the learner sees it with progress', async () => {
    const p = (await b.createPackage(database, 'owner', { board: 'CBSE', classLevel: 10, examYear: 2027, slug: `r-${randomUUID().slice(0, 8)}`, title: 'Report test' })).id;
    packageIds.push(p);
    const pool = (await b.addSet(database, p, { kind: 'pool', subject: 'Science', subjectCode: '086', title: 'Ch1 pool', maxMarks: 7, durationMinutes: 60, syllabusScope: [CH1] })).id;
    await b.addAuthoredItem(database, pool, { marks: 1, qtype: 'mcq', stem: 'Which?', chapter: CH1, topic: 'Types', options: ['a', 'b', 'c', 'd'], correctOption: 'B' });
    for (const t of ['Types', 'Balancing']) {
      await b.addAuthoredItem(database, pool, { marks: 3, qtype: 'short', stem: `Explain (${t}).`, chapter: CH1, topic: t, schemeText: 'key',
        parts: [{ label: '', marks: 3, answer_kind: 'text', value_points: [{ id: 'v1', text: 'names the reaction', marks: 1, quote: '' }, { id: 'v2', text: 'gives the reason', marks: 2, quote: '' }] }] });
    }
    expect(await b.publishSet(database, pool)).toMatchObject({ published: true });
    await b.publishPackage(database, p);
    const u = `rp-${randomUUID().slice(0, 8)}`;
    userIds.push(u);
    await raw.query(`INSERT INTO "user" (id, name, email, role) VALUES ($1, 'L', $2, 'student')`, [u, `${u}@example.test`]);
    await b.grantEntitlement(database, 'owner', { userId: u, packageId: p, attemptsPerSet: null, expiresAt: null });

    const first = await readAttempt(u, pool, 1, [1, 0]);
    // a grade job still queued for one of its questions: not ready yet
    const jobId = randomUUID();
    await raw.query(`INSERT INTO hw_ai_job (id, organization_id, kind, status, question_id) VALUES ($1, 'vgp-exams', 'grade', 'queued', $2)`, [jobId, first.m.questions[1]!.questionId]);
    expect((await R.runExamReports(10, { ai: null })).filter((o) => o.attemptId === first.attemptId)).toEqual([]);
    await raw.query(`UPDATE hw_ai_job SET status = 'done' WHERE id = $1`, [jobId]);

    const writingCalls: string[][] = [];
    const ai = { async writingProfile({ answers }: { answers: { label: string; text: string }[] }) {
      writingCalls.push(answers.map((a) => a.label));
      return { profile: { spelling: { score: 8, examples: [{ written: 'clorride', correct: 'chloride' }] }, grammar: { score: 9, examples: [] }, punctuation: { score: 6, examples: [] } },
        result: { json: {}, usage: { input: 400, cached: 0, output: 80 }, rawUsage: {}, model: 'test-grader' } };
    } };
    const out = (await R.runExamReports(10, { ai })).find((o) => o.attemptId === first.attemptId);
    expect(out).toMatchObject({ ok: true, marks: 2, max: 7, pending: 1 });
    // too little writing (one short answer read): the writing check is not called, and says so
    expect(writingCalls).toEqual([]);

    const att = (await raw.query(`SELECT status, reported_at, marks_awarded::float AS m FROM hw_exam_attempt WHERE id = $1`, [first.attemptId])).rows[0];
    expect(att).toMatchObject({ status: 'reported', m: 2 });
    expect(att.reported_at).toBeTruthy();
    const row = (await raw.query(`SELECT * FROM hw_exam_report WHERE attempt_id = $1`, [first.attemptId])).rows[0];
    expect(row).toMatchObject({ grader_model: 'test-grader', prompt_version: expect.stringContaining('exam-report.v1') });
    await expect(raw.query(`UPDATE hw_exam_report SET marks_awarded = 7 WHERE attempt_id = $1`, [first.attemptId])).rejects.toThrow(/append-only/);
    // a second pass makes nothing new
    expect((await R.runExamReports(10, { ai })).filter((o) => o.attemptId === first.attemptId)).toEqual([]);

    const v1 = await L.attemptView(database, u, first.attemptId, { now: T0 });
    expect(v1.report).toMatchObject({ marksAwarded: 2, maxMarks: 7, pendingMarks: 3, progress: [{ attemptNo: 1, marksAwarded: 2 }] });
    // where the score stands on this set (owner, 13 Nov 2026): no others yet, so no percentile
    expect(v1.report!.standing).toEqual({ percentile: null, peers: 0 });
    // twenty others' FIRST attempts at the same set: ten scored 1 of 7, ten 3 of 7; 2 of 7 is above half of them. (This fixture's set is
    // the learner's own practice set, which the database keeps to its owner; a published set is shared. The rows are copied on one
    // connection with the checks off, only to put a field of other learners behind the same set.)
    const fx = await raw.connect();
    await fx.query(`SET session_replication_role = replica`);
    for (let i = 0; i < 20; i++) {
      const o = `rp-${randomUUID().slice(0, 8)}`;
      userIds.push(o);
      await fx.query(`INSERT INTO "user" (id, name, email, role) VALUES ($1, 'O', $2, 'student')`, [o, `${o}@example.test`]);
      const att = randomUUID();
      await fx.query(`INSERT INTO hw_exam_attempt SELECT (jsonb_populate_record(NULL::hw_exam_attempt, to_jsonb(a) || jsonb_build_object('id', $1::text, 'user_id', $2::text, 'assignment_id', NULL))).* FROM hw_exam_attempt a WHERE a.id = $3`, [att, o, first.attemptId]);
      await fx.query(`INSERT INTO hw_exam_report SELECT (jsonb_populate_record(NULL::hw_exam_report, to_jsonb(r) || jsonb_build_object('id', $1::text, 'attempt_id', $2::text, 'marks_awarded', $3::numeric))).* FROM hw_exam_report r WHERE r.attempt_id = $4`, [randomUUID(), att, i < 10 ? 1 : 3, first.attemptId]);
    }
    await fx.query(`SET session_replication_role = origin`);
    fx.release();
    const standing = (await L.attemptView(database, u, first.attemptId, { now: T0 })).report!.standing;
    expect(standing).toEqual({ percentile: 50, peers: 20 });
    const qs = v1.report!.perQuestion;
    expect(qs.map((q) => [q.number, q.status, q.awarded])).toEqual([[1, 'marked', 1], [2, 'marked', 1], [3, 'pending', null]]);
    expect(qs[1]!.points).toEqual([
      { text: 'names the reaction', marks: 1, awarded: 1, verdict: 'met', quote: 'turns grey' },
      { text: 'gives the reason', marks: 2, awarded: 0, verdict: 'missing', quote: '' },
    ]);
    const params = Object.fromEntries(v1.report!.profile.parameters.map((x) => [x.id, x]));
    expect(params.spelling).toMatchObject({ band: 'unavailable', why: 'too_little_writing' });
    expect(params.step_marking).toMatchObject({ facts: { got: 1, of: 3, answers: 1 } });
    expect(v1.report!.weakAreas.filter((w) => w.level === 'topic').map((w) => w.topic)).toEqual(['Types']);

    // a second attempt at the same test: progress shows both, in order
    const second = await evaluated(u, first.set, 2, [1, 2]);
    await raw.query(`UPDATE hw_answer SET transcript = $2 WHERE id = $1`, [second.m.questions[1]!.answerId, 'Silver clorride turns grey in sunlight because light breaks it down into silver and chlorine gas, which is a decomposition reaction caused by light energy.']);
    expect((await R.runExamReports(10, { ai })).find((o) => o.attemptId === second.attemptId)).toMatchObject({ ok: true, marks: 4 });
    // Q3 still waits for a person to check its read: it is left out of the writing check
    expect(writingCalls).toEqual([['Q2']]);
    const v2 = await L.attemptView(database, u, second.attemptId, { now: T0 });
    expect(v2.report!.progress.map((x) => [x.attemptNo, x.marksAwarded])).toEqual([[1, 2], [2, 4]]);
    expect(v2.report!.profile.parameters.find((x) => x.id === 'spelling')).toMatchObject({ score: 0.8, examples: [{ written: 'clorride', correct: 'chloride' }] });
    // the writing check is booked on the attempt
    expect(Number((await raw.query(`SELECT count(*) FROM hw_ai_job WHERE submission_id = $1 AND error = 'exam report: writing check'`, [second.m.submissionId])).rows[0].count)).toBe(1);
  });
});
