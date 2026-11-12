/* eslint-disable no-restricted-syntax -- this test sets the environment the database layer reads, before loading it */
// Mark revisions (migration 036): who may change released marks, what is recorded, what the learner sees, and the exam report's new revision.
//   HW_ITEST_DATABASE_URL=postgres://... npx jest src/__tests__/hw/mark-revisions     (needs migrations 032-036)

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

const DB_URL = process.env.HW_ITEST_DATABASE_URL;
const suite = DB_URL ? describe : describe.skip;
Object.assign(process.env, { DATABASE_URL: DB_URL ?? '', HW_EXAMS_ENABLED: 'true', HW_READ_MODEL: 'test-reader', HW_GRADE_MODEL: 'test-grader' });

let R: typeof import('@/lib/hw/revisions');
beforeAll(async () => { R = await import('@/lib/hw/revisions'); });

describe('reviser label', () => {
  const ok = { reason: 'Re-checked the diagram' };
  it('a school\'s admin or teacher must give a name and a designation; the app\'s own staff may not', () => {
    expect(() => R.reviserLabel('teacher', { ...ok }, 'Asha Rao')).toThrow(/name/);
    expect(() => R.reviserLabel('admin', { ...ok, name: 'Asha Rao' }, '')).toThrow(/designation/);
    expect(R.reviserLabel('teacher', { ...ok, name: '  Asha   Rao ', designation: 'Class teacher' }, '')).toEqual({ name: 'Asha Rao', designation: 'Class teacher', reason: 'Re-checked the diagram' });
    expect(R.reviserLabel('platform', ok, 'Owner Name')).toEqual({ name: 'Owner Name', designation: 'Platform', reason: 'Re-checked the diagram' });
  });
  it('always needs a reason', () => {
    expect(() => R.reviserLabel('platform', { reason: ' x ' }, 'O')).toThrow(/why/);
  });
});

let raw: Pool;
let database: typeof import('@/db')['db'];
let dbMod: typeof import('@/lib/db/connection');
let b: typeof import('@/lib/hw/exams/builder');
let L: typeof import('@/lib/hw/exams/learner');
let P: typeof import('@/lib/hw/exams/practice');
let Rep: typeof import('@/lib/hw/exams/report');
const packageIds: string[] = [];
const userIds: string[] = [];
const orgIds: string[] = [];
const T0 = new Date('2099-06-01T09:00:00Z');
const CH1 = 'Chemical Reactions and Equations';
const publicOf = (p: Promise<unknown>) => p.then(() => 'resolved', (e: { publicMessage?: string; message: string }) => e.publicMessage ?? e.message);

async function person(role: string, name: string) {
  const u = `rv-${randomUUID().slice(0, 8)}`;
  userIds.push(u);
  if (role !== 'super_admin') {
    await raw.query(`INSERT INTO "user" (id, name, email, role) VALUES ($1, $2, $3, $4)`, [u, name, `${u}@example.test`, role]);
    return u;
  }
  // migration 011 refuses a new super admin account (rightly); a test one is made with that guard paused on this connection only
  const c = await raw.connect();
  try {
    await c.query(`SET session_replication_role = replica`);
    await c.query(`INSERT INTO "user" (id, name, email, role) VALUES ($1, $2, $3, 'super_admin')`, [u, name, `${u}@example.test`]);
  } finally { await c.query(`RESET session_replication_role`); c.release(); }
  return u;
}

suite('mark revisions — integration', () => {
  jest.setTimeout(60_000);
  beforeAll(async () => {
    raw = new Pool({ connectionString: DB_URL });
    dbMod = await import('@/lib/db/connection');
    database = (await import('@/db')).db;
    (await import('@/lib/hw/config'))._resetHwConfig();
    b = await import('@/lib/hw/exams/builder');
    L = await import('@/lib/hw/exams/learner');
    P = await import('@/lib/hw/exams/practice');
    Rep = await import('@/lib/hw/exams/report');
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
          const sub = `SELECT id FROM hw_submission WHERE assignment_id = ANY($1)`;
          await c.query(`DELETE FROM hw_mark_revision WHERE submission_id IN (${sub})`, [asg]);
          await c.query(`DELETE FROM hw_grade_history WHERE answer_id IN (SELECT id FROM hw_answer WHERE submission_id IN (${sub}))`, [asg]);
          await c.query(`DELETE FROM hw_grade WHERE answer_id IN (SELECT id FROM hw_answer WHERE submission_id IN (${sub}))`, [asg]);
          await c.query(`DELETE FROM hw_ai_grade WHERE answer_id IN (SELECT id FROM hw_answer WHERE submission_id IN (${sub}))`, [asg]);
          await c.query(`DELETE FROM hw_ai_job WHERE submission_id IN (${sub}) OR question_id IN (SELECT id FROM hw_question WHERE assignment_id = ANY($1))`, [asg]);
          await c.query(`DELETE FROM hw_answer WHERE submission_id IN (${sub})`, [asg]);
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
      if (orgIds.length) {
        await c.query(`DELETE FROM hw_class_teacher WHERE organization_id = ANY($1)`, [orgIds]);
        await c.query(`DELETE FROM student_enrollments WHERE organization_id = ANY($1)`, [orgIds]);
        await c.query(`DELETE FROM institution_classes WHERE organization_id = ANY($1)`, [orgIds]);
        await c.query(`DELETE FROM member WHERE organization_id = ANY($1)`, [orgIds]);
        await c.query(`DELETE FROM organization WHERE id = ANY($1)`, [orgIds]);
      }
      if (userIds.length) await c.query(`DELETE FROM "user" WHERE id = ANY($1)`, [userIds]);
    } finally { c.release(); }
    await raw?.end();
    await dbMod?.getPool().end();
  });

  /** A learner's reported practice test: Q1 multiple choice right, Q2 short answer 1/3 by the model, Q3 waiting for a person. */
  async function reportedAttempt(learner: string) {
    const p = (await b.createPackage(database, 'owner', { board: 'CBSE', classLevel: 10, examYear: 2027, slug: `rv-${randomUUID().slice(0, 8)}`, title: 'Revision test' })).id;
    packageIds.push(p);
    const pool = (await b.addSet(database, p, { kind: 'pool', subject: 'Science', subjectCode: '086', title: 'Ch1 pool', maxMarks: 7, durationMinutes: 60, syllabusScope: [CH1] })).id;
    await b.addAuthoredItem(database, pool, { marks: 1, qtype: 'mcq', stem: 'Which?', chapter: CH1, topic: 'Types', options: ['a', 'b', 'c', 'd'], correctOption: 'B' });
    for (const t of ['Types', 'Balancing']) {
      await b.addAuthoredItem(database, pool, { marks: 3, qtype: 'short', stem: `Explain (${t}).`, chapter: CH1, topic: t, schemeText: 'key',
        parts: [{ label: '', marks: 3, answer_kind: 'text', value_points: [{ id: 'v1', text: 'names the reaction', marks: 1, quote: '' }, { id: 'v2', text: 'gives the reason', marks: 2, quote: '' }] }] });
    }
    await b.publishSet(database, pool);
    await b.publishPackage(database, p);
    await b.grantEntitlement(database, 'owner', { userId: learner, packageId: p, attemptsPerSet: null, expiresAt: null });
    await P.buildPractice(database, learner, { poolSetId: pool, topics: [], types: ['mcq', 'short'], count: 3 }, T0, (n) => n - 1);
    const set = (await raw.query(`SELECT id FROM hw_exam_set WHERE owner_user_id = $1 ORDER BY created_at DESC LIMIT 1`, [learner])).rows[0].id as string;
    const { attemptId } = await L.startAttempt(database, learner, set, T0);
    const { materialiseAttempt } = await import('@/lib/hw/exams/materialise');
    const m = await database.transaction((tx) => materialiseAttempt(tx, attemptId));
    await raw.query(`UPDATE hw_exam_attempt SET status = 'evaluating', submitted_at = now() WHERE id = $1`, [attemptId]);
    await raw.query(`UPDATE hw_submission SET status = 'ready_for_review' WHERE id = $1`, [m.submissionId]);
    const [mcq, s1, s2] = m.questions;
    await raw.query(`UPDATE hw_answer SET transcript = 'B', transcript_status = 'done' WHERE id = $1`, [mcq!.answerId]);
    await raw.query(`UPDATE hw_answer SET transcript = 'Silver chloride turns grey: decomposition.', transcript_status = 'done', transcript_confidence = 0.9 WHERE id = $1`, [s1!.answerId]);
    await raw.query(`UPDATE hw_answer SET transcript = 'hard to read', transcript_status = 'needs_review', failure_reason = 'low confidence read' WHERE id = $1`, [s2!.answerId]);
    const r1 = (await raw.query(`SELECT id FROM hw_rubric_item WHERE question_id = $1 ORDER BY position`, [s1!.questionId])).rows.map((r) => r.id as string);
    await raw.query(`INSERT INTO hw_ai_grade (id, organization_id, answer_id, model, prompt_version, rubric_version, items, suggested_marks, confidence) VALUES ($1, 'vgp-exams', $2, 'exact_match', 'rules.v1', 1, '[]', 1, 1)`, [randomUUID(), mcq!.answerId]);
    await raw.query(`INSERT INTO hw_ai_grade (id, organization_id, answer_id, model, prompt_version, rubric_version, items, suggested_marks, confidence) VALUES ($1, 'vgp-exams', $2, 'test-grader', 'grade-strict.v2', 1, $3, 1, 0.9)`,
      [randomUUID(), s1!.answerId, JSON.stringify([{ rubric_item_id: r1[0], verdict: 'met', quote: 'turns grey', marks: 1, confidence: 0.9 }, { rubric_item_id: r1[1], verdict: 'missing', quote: '', marks: 0, confidence: 0.9 }])]);
    const out = await Rep.reportAttempt(attemptId, { ai: null });
    expect(out).toMatchObject({ ok: true, marks: 2 });
    return { attemptId, m, s1Rubric: r1, s2Rubric: (await raw.query(`SELECT id FROM hw_rubric_item WHERE question_id = $1 ORDER BY position`, [s2!.questionId])).rows.map((r) => r.id as string) };
  }

  /** A school the learner is a student of, with an admin, a teacher linked to the learner's class (Science), and one who is not. */
  async function school(learner: string) {
    const org = `rv-org-${randomUUID().slice(0, 8)}`;
    orgIds.push(org);
    await raw.query(`INSERT INTO organization (id, name, slug, created_at) VALUES ($1, 'Test School', $1, now())`, [org]);
    const cls = (await raw.query(`INSERT INTO institution_classes (organization_id, name) VALUES ($1, 'Class 10') RETURNING id`, [org])).rows[0].id as string;
    const other = (await raw.query(`INSERT INTO institution_classes (organization_id, name) VALUES ($1, 'Class 9') RETURNING id`, [org])).rows[0].id as string;
    const admin = await person('student', 'Principal Sharma');
    const teacher = await person('student', 'Asha Rao');
    const outsider = await person('student', 'Ravi Teacher');
    for (const [u, role] of [[learner, 'student'], [admin, 'org_admin'], [teacher, 'teacher'], [outsider, 'teacher']] as const) {
      await raw.query(`INSERT INTO member (id, organization_id, user_id, role, created_at) VALUES ($1, $2, $3, $4, now())`, [randomUUID(), org, u, role]);
    }
    await raw.query(`INSERT INTO student_enrollments (organization_id, user_id, class_id) VALUES ($1, $2, $3)`, [org, learner, cls]);
    await raw.query(`INSERT INTO hw_class_teacher (organization_id, class_id, teacher_id, subject) VALUES ($1, $2, $3, 'Science')`, [org, cls, teacher]);
    await raw.query(`INSERT INTO hw_class_teacher (organization_id, class_id, teacher_id, subject) VALUES ($1, $2, $3, 'Science')`, [org, other, outsider]);
    return { org, admin, teacher, outsider };
  }

  it('exam reports: the super admin, the learner\'s school admin and assigned teacher may revise; others may not; the learner sees who, except the app\'s own staff', async () => {
    const learner = await person('student', 'Learner One');
    const { attemptId, m, s1Rubric, s2Rubric } = await reportedAttempt(learner);
    const { admin, teacher, outsider } = await school(learner);
    const owner = await person('super_admin', 'App Owner');
    const stranger = await person('student', 'Someone Else');
    const [, s1, s2] = m.questions;

    // who may: decided by the server, and anyone else is told the report is not there
    expect(await R.examReviserFor(database, owner, learner, 'Science')).toMatchObject({ kind: 'platform', orgId: null });
    expect(await R.examReviserFor(database, admin, learner, 'Science')).toMatchObject({ kind: 'admin' });
    expect(await R.examReviserFor(database, teacher, learner, 'Science')).toMatchObject({ kind: 'teacher' });
    expect(await R.examReviserFor(database, teacher, learner, 'Mathematics')).toBeNull(); // a Science link does not cover Mathematics
    expect(await R.examReviserFor(database, outsider, learner, 'Science')).toBeNull(); // teaches another class
    expect(await R.examReviserFor(database, learner, learner, 'Science')).toBeNull();
    const input = { answerId: s2!.answerId, itemMarks: [{ rubric_item_id: s2Rubric[0]!, marks: 1 }, { rubric_item_id: s2Rubric[1]!, marks: 2 }], reason: 'Read the answer myself' };
    expect(await publicOf(R.reviseExamAnswer(stranger, { ...input, name: 'X Y', designation: 'Teacher' }))).toMatch(/not found/i);
    expect(await publicOf(R.reviseExamAnswer(outsider, { ...input, name: 'Ravi', designation: 'Teacher' }))).toMatch(/not found/i);
    // a school's teacher must say who they are
    expect(await publicOf(R.reviseExamAnswer(teacher, input))).toMatch(/name/);

    // the teacher marks the answer that was waiting for a person: a new report revision, the attempt's marks follow
    expect(await R.reviseExamAnswer(teacher, { ...input, name: 'Asha Rao', designation: 'Class teacher' })).toEqual({ revision: 1, marksAwarded: 5 });
    // the owner lowers Q2: the learner is told the date only
    expect(await R.reviseExamAnswer(owner, { answerId: s1!.answerId, itemMarks: [{ rubric_item_id: s1Rubric[0]!, marks: 0 }, { rubric_item_id: s1Rubric[1]!, marks: 0 }], reason: 'Wrong reaction named' }))
      .toEqual({ revision: 2, marksAwarded: 4 });

    const reports = (await raw.query(`SELECT revision, marks_awarded::float AS m FROM hw_exam_report WHERE attempt_id = $1 ORDER BY revision`, [attemptId])).rows;
    expect(reports).toEqual([{ revision: 0, m: 2 }, { revision: 1, m: 5 }, { revision: 2, m: 4 }]);
    expect((await raw.query(`SELECT marks_awarded::float AS m FROM hw_exam_attempt WHERE id = $1`, [attemptId])).rows[0].m).toBe(4);

    const v = (await L.attemptView(database, learner, attemptId, { now: T0 })).report!;
    expect(v).toMatchObject({ revision: 2, marksAwarded: 4, pendingMarks: 0 });
    expect(v.revisions).toEqual([
      expect.objectContaining({ answerId: s2!.answerId, marksBefore: null, marksAfter: 3, by: { name: 'Asha Rao', designation: 'Class teacher' } }),
      expect.objectContaining({ answerId: s1!.answerId, marksBefore: 1, marksAfter: 0, by: null }),
    ]);
    // the learner never gets the reviser's account or the reason
    expect(JSON.stringify(v.revisions)).not.toMatch(/Wrong reaction|Read the answer|App Owner/);
    expect(v.perQuestion.find((q) => q.answerId === s2!.answerId)).toMatchObject({ status: 'marked', awarded: 3, source: 'teacher' });
    expect(v.progress).toEqual([expect.objectContaining({ attemptNo: 1, marksAwarded: 4 })]);

    // staff see the full history, with reasons, and who the learner does not see
    const staff = await R.examReportForStaff(admin, attemptId);
    expect(staff.history.map((h) => [h.name, h.kind, h.shownToLearner, h.reason])).toEqual([['Asha Rao', 'teacher', true, 'Read the answer myself'], ['App Owner', 'platform', false, 'Wrong reaction named']]);
    expect(staff.me).toMatchObject({ kind: 'admin', name: 'Principal Sharma', designation: 'Institution admin', nameShown: true });
    expect((await R.examReportsForStaff(teacher)).map((r) => r.attemptId)).toContain(attemptId);
    expect((await R.examReportsForStaff(outsider)).map((r) => r.attemptId)).not.toContain(attemptId);
    expect((await R.examReportsForStaff(owner)).map((r) => r.attemptId)).toContain(attemptId);

    // the record cannot be edited
    await expect(raw.query(`UPDATE hw_mark_revision SET reason = 'x' WHERE exam_attempt_id = $1`, [attemptId])).rejects.toThrow(/append-only/);
    await expect(raw.query(`UPDATE hw_exam_report SET marks_awarded = 0 WHERE attempt_id = $1`, [attemptId])).rejects.toThrow(/append-only/);
  });

  it('AI usage (super admin only): a running batch is listed, and the tokens and cost of today are counted', async () => {
    const { aiUsageDashboard } = await import('@/lib/hw/ai-usage');
    const learner = await person('student', 'Learner Three');
    const { m } = await reportedAttempt(learner);
    expect(await publicOf(aiUsageDashboard({ userId: learner, isSuperAdmin: false, rater: null }))).toMatch(/owner/);
    const before = await aiUsageDashboard({ userId: 'x', isSuperAdmin: true, rater: null }, { days: 7 });
    await raw.query(`INSERT INTO hw_ai_job (id, organization_id, kind, status, submission_id, provider, model, batch_ref, tokens_in, tokens_out, cost_estimate_paise)
      VALUES ($1, 'vgp-exams', 'read', 'batch_pending', $2, 'openai', 'test-reader', 'batch_test_1', 1000, 200, 12.5)`, [randomUUID(), m.submissionId]);
    const d = await aiUsageDashboard({ userId: 'x', isSuperAdmin: true, rater: null }, { days: 7 });
    expect(d.daily).toHaveLength(7);
    expect(d.now.batches).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'read', organization: 'Exam packages', batches: 1 })]));
    expect(d.today.tokensIn - before.today.tokensIn).toBe(1000);
    expect(d.today.costPaise - before.today.costPaise).toBeCloseTo(12.5);
    expect(d.today.batchJobs - before.today.batchJobs).toBe(1);
    expect(d.byOrganization.find((r) => r.organizationId === 'vgp-exams')).toBeTruthy();
    await raw.query(`UPDATE hw_ai_job SET status = 'done' WHERE batch_ref = 'batch_test_1'`);
  });

  it('homework: only returned work is revised, by whoever may mark it; the learner\'s result shows the reviser', async () => {
    const learner = await person('student', 'Learner Two');
    const { m, s1Rubric } = await reportedAttempt(learner);
    // the exam assignment stands in for homework here: returned, marked by a person
    const [, s1] = m.questions;
    const { db: hwDb } = await import('@/lib/hw/db');
    const { myResult } = await import('@/lib/hw/services/submissions');
    const admin = await person('student', 'Head Teacher');
    const actor = { userId: admin, orgId: 'vgp-exams', role: 'admin' as const, isPlatformStaff: false };
    const input = { answerId: s1!.answerId, itemMarks: [{ rubric_item_id: s1Rubric[0]!, marks: 1 }, { rubric_item_id: s1Rubric[1]!, marks: 1 }], reason: 'Partly right reason', name: 'Head Teacher', designation: 'Principal' };
    expect(await publicOf(R.reviseHomeworkAnswer(actor, input))).toMatch(/not been returned/);
    await raw.query(`UPDATE hw_submission SET status = 'returned' WHERE id = $1`, [m.submissionId]);
    // a student of the institution may not
    expect(await publicOf(R.reviseHomeworkAnswer({ ...actor, userId: learner, role: 'student' }, input))).toMatch(/teach|not found/i);
    expect(await R.reviseHomeworkAnswer(actor, input)).toEqual({ marks: 2 });
    const res = await myResult({ userId: learner, orgId: 'vgp-exams', role: 'student', isPlatformStaff: false }, m.submissionId);
    const q = res.questions.find((x) => x.awarded === 2)!;
    expect(q.revision).toMatchObject({ marksBefore: null, marksAfter: 2, by: { name: 'Head Teacher', designation: 'Principal' } });
    // platform staff acting in the institution: the date only
    const owner = await person('super_admin', 'Owner');
    await R.reviseHomeworkAnswer({ userId: owner, orgId: 'vgp-exams', role: 'admin', isPlatformStaff: true }, { ...input, itemMarks: [{ rubric_item_id: s1Rubric[0]!, marks: 1 }, { rubric_item_id: s1Rubric[1]!, marks: 2 }] });
    const after = await myResult({ userId: learner, orgId: 'vgp-exams', role: 'student', isPlatformStaff: false }, m.submissionId);
    expect(after.questions.find((x) => x.awarded === 3)!.revision).toMatchObject({ marksBefore: 2, marksAfter: 3, by: null });
    void hwDb;
  });
});
