// Self-practice, phase 2: starting one practice question (docs/hw-eval/self-practice.md).
//
// An attempt is a one-question assignment in the practice institution, owned by one learner: its section is the learner's own, so nobody
// else is enrolled in it and nobody else can see it. The question is a verified textbook exercise; its marking scheme is an answer key built
// from the book (rubric_mode 'key', queued here, built by the job runner). Handing in, reading, marking and returning are the ordinary paths.

import { createHash } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { hwAnswer, hwAssignment, hwQuestion, hwSubmission } from '@/db/hw-schema';
import { institutionClasses, institutionSections, studentEnrollments } from '@/db/schema';
import { getHwConfig } from '../config';
import { HwError } from '../errors';
import { db, newId, type Exec } from '../db';
import { queueKey } from '../keys/product';
import { defaultHub, parseScope, requireOfferedScope, verifyCatalogQuestion, type HubLike } from './catalog';
import { PRACTICE_ORG_ID, PRACTICE_TEXT } from './rules';
import { ensurePracticeSpace, isPracticeLearner, practiceEnabled, requireUsableTrial } from './trial';

const both = (t: { en: string; hi: string }) => `${t.en} / ${t.hi}`;

export const levelClassId = (level: number): string => `vgp-class-${level}`;
/** One section per learner and class level: only that learner is enrolled in it, which is what keeps their attempts private. */
export const learnerSectionId = (userId: string, level: number): string =>
  `vgp-s-${createHash('sha256').update(userId).digest('hex').slice(0, 20)}-${level}`;

/** The learner's own class level and section in the practice institution, and their enrollment in it. Safe to repeat. */
async function ensureLearnerSpace(x: Exec, userId: string, level: number): Promise<{ classId: string; sectionId: string }> {
  const classId = levelClassId(level);
  const sectionId = learnerSectionId(userId, level);
  await x.insert(institutionClasses).values({ id: classId, organizationId: PRACTICE_ORG_ID, name: `Class ${level}`, level }).onConflictDoNothing();
  await x.insert(institutionSections).values({ id: sectionId, organizationId: PRACTICE_ORG_ID, classId, name: 'Self-practice' }).onConflictDoNothing();
  const [e] = await x.select({ id: studentEnrollments.id }).from(studentEnrollments)
    .where(and(eq(studentEnrollments.organizationId, PRACTICE_ORG_ID), eq(studentEnrollments.userId, userId), eq(studentEnrollments.classId, classId), eq(studentEnrollments.sectionId, sectionId))).limit(1);
  if (!e) await x.insert(studentEnrollments).values({ organizationId: PRACTICE_ORG_ID, userId, classId, sectionId, status: 'active' });
  return { classId, sectionId };
}

/** A question's answer key may be rebuilt this many times for a "write it again" (the platform pays for each build). */
const MAX_KEY_BUILDS = 3;

/**
 * "Write it again" for a practice answer that was read but got no mark (the reader or the AI was not sure, the key was not ready, or the
 * trial ran short): the answer and everything made from it is removed and the submission is a draft again, on the same question and key.
 * Only the learner's own submission, only while it is waiting for a mark; never while a job is still working on it; never after it was
 * returned. A failed answer key is queued again (up to MAX_KEY_BUILDS builds); a question the book has no key for stays refused.
 */
export async function retryAttempt(userId: string, submissionId: string): Promise<{ submissionId: string }> {
  if (!practiceEnabled()) throw new HwError('FEATURE_DISABLED', both(PRACTICE_TEXT.off));
  if (!(await isPracticeLearner(db, userId))) throw new HwError('FORBIDDEN', both(PRACTICE_TEXT.notStarted));
  await requireUsableTrial(db, userId);
  await db.transaction(async (tx) => {
    const [s] = await tx.select().from(hwSubmission)
      .where(and(eq(hwSubmission.id, submissionId), eq(hwSubmission.organizationId, PRACTICE_ORG_ID), eq(hwSubmission.studentId, userId))).for('update');
    if (!s) throw new HwError('NOT_FOUND', 'Submission not found.');
    if (s.status !== 'ready_for_review' && s.status !== 'graded') {
      // Still being read, or not handed in: wait. Marked (returned): final.
      throw new HwError('CONFLICT', both(s.status === 'submitted' || s.status === 'processing' ? PRACTICE_TEXT.retryBusy : PRACTICE_TEXT.retryNotHeld));
    }
    const questions = await tx.select().from(hwQuestion).where(eq(hwQuestion.assignmentId, s.assignmentId));
    const busy = await tx.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM hw_ai_job
       WHERE organization_id = ${PRACTICE_ORG_ID} AND status IN ('queued', 'running', 'batch_pending')
         AND (submission_id = ${s.id} OR question_id IN (${sql.join(questions.map((q) => sql`${q.id}`), sql`, `)}))`);
    if ((busy.rows[0]?.n ?? 0) > 0) throw new HwError('CONFLICT', both(PRACTICE_TEXT.retryBusy));

    for (const q of questions) {
      const keys = await tx.execute<{ status: string; n: number }>(sql`
        SELECT (SELECT status FROM hw_question_key WHERE question_id = ${q.id} AND superseded_at IS NULL) AS status,
               (SELECT count(*)::int FROM hw_question_key WHERE question_id = ${q.id}) AS n`);
      const { status, n } = keys.rows[0] ?? { status: null, n: 0 };
      if (status === 'no_grounding') throw new HwError('CONFLICT', both(PRACTICE_TEXT.retryNoKey));
      if (status === 'failed' || status === null) {
        if (n >= MAX_KEY_BUILDS) throw new HwError('CONFLICT', both(PRACTICE_TEXT.retryKeyLimit));
        await queueKey(tx, q, userId);
      }
    }

    // The answer goes, and with it its reading, suggestions and marks (they cascade). Cost already spent stays spent.
    await tx.delete(hwAnswer).where(eq(hwAnswer.submissionId, s.id));
    await tx.update(hwSubmission).set({ status: 'draft', submittedAt: null, isLate: false, failureReason: null }).where(eq(hwSubmission.id, s.id));
  });
  return { submissionId };
}

export interface StartAttemptInput {
  classLevel: string | number;
  subject: string;
  medium: string;
  /** The catalog question picked: the hub's passage id and the question's number in it, with its text (checked against the hub). */
  passageId: string;
  index: number;
  text: string;
}

export async function startAttempt(userId: string, input: StartAttemptInput, deps: { hub?: HubLike | null } = {}): Promise<{ assignmentId: string; reused: boolean }> {
  if (!practiceEnabled()) throw new HwError('FEATURE_DISABLED', both(PRACTICE_TEXT.off));
  if (!(await isPracticeLearner(db, userId))) throw new HwError('FORBIDDEN', both(PRACTICE_TEXT.notStarted));
  await requireUsableTrial(db, userId);

  const scope = parseScope(input);
  requireOfferedScope(scope);
  const q = await verifyCatalogQuestion(scope, input, deps.hub === undefined ? defaultHub() : deps.hub);
  if (!q) throw new HwError('NOT_FOUND', 'That question was not found in the textbook. Search again and pick it from the list.');

  // The same question twice opens the same attempt.
  const prior = await db.execute<{ id: string }>(sql`
    SELECT a.id FROM hw_assignment a JOIN hw_question hq ON hq.assignment_id = a.id
     WHERE a.organization_id = ${PRACTICE_ORG_ID} AND a.created_by = ${userId} AND hq.origin_ref ->> 'exercise' = ${q.ref} LIMIT 1`);
  if (prior.rows[0]) return { assignmentId: prior.rows[0].id, reused: true };

  const limit = getHwConfig().HW_SELF_PRACTICE_MAX_ATTEMPTS;
  const [{ n }] = (await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM hw_assignment WHERE organization_id = ${PRACTICE_ORG_ID} AND created_by = ${userId}`)).rows;
  if (n >= limit) throw new HwError('QUOTA_EXCEEDED', both(PRACTICE_TEXT.attemptLimit));

  const assignmentId = newId();
  await db.transaction(async (tx) => {
    await ensurePracticeSpace(tx);
    const { classId, sectionId } = await ensureLearnerSpace(tx, userId, scope.classLevel);
    await tx.insert(hwAssignment).values({
      id: assignmentId, organizationId: PRACTICE_ORG_ID, classId, sectionId, subject: scope.subject,
      title: `Practice: ${q.book}, chapter ${q.chapter}`.slice(0, 300), instructions: null, dueAt: null,
      allowedModes: ['ink', 'typed'], createdBy: userId,
    });
    const questionId = newId();
    await tx.insert(hwQuestion).values({
      id: questionId, organizationId: PRACTICE_ORG_ID, assignmentId, position: 0, type: q.shape.type, prompt: q.text.trim(), marks: String(q.shape.marks),
      languageHint: scope.medium, answerLines: q.shape.type === 'long' ? 12 : q.shape.type === 'short' ? 6 : 3,
      // A textbook exercise: its key is built from the book, and is public enough for the shared key library.
      origin: 'textbook_exercise',
      originRef: { book: q.book, chapter: `Chapter ${q.chapter}`, exercise: q.ref, passageId: q.passageId },
      rubricMode: 'key',
    });
    const [row] = await tx.select().from(hwQuestion).where(eq(hwQuestion.id, questionId)).limit(1);
    await queueKey(tx, row, userId);
    await tx.update(hwAssignment).set({ status: 'published' }).where(eq(hwAssignment.id, assignmentId));
  });
  return { assignmentId, reused: false };
}
