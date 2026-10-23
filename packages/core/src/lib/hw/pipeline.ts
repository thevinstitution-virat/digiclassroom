// The steps between "student pressed submit" and "teacher sees suggestions", shared by the
// submit endpoint and the job handlers.

import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { hwAiGrade, hwAnswer, hwGrade, hwQuestion, hwRubricItem, hwSubmission, hwTranscriptRevision } from '@/db/hw-schema';
import { getHwConfig } from './config';
import { newId, num, type Exec } from './db';
import { gradeWithoutAi } from './grader/exact-match';
import type { GradeQuestion, GradeResult } from './grader/types';
import { enqueueGrade } from './jobs/queue';

export type AnswerRow = typeof hwAnswer.$inferSelect;

/** A question with its CURRENT rubric (not retired), as the grader needs it. */
export async function loadGradeQuestion(x: Exec, questionId: string): Promise<GradeQuestion | null> {
  const [q] = await x.select().from(hwQuestion).where(eq(hwQuestion.id, questionId)).limit(1);
  if (!q) return null;
  const rubric = await x.select().from(hwRubricItem)
    .where(and(eq(hwRubricItem.questionId, questionId), isNull(hwRubricItem.retiredAt)))
    .orderBy(asc(hwRubricItem.position), asc(hwRubricItem.createdAt));
  return {
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    marks: num(q.marks),
    modelAnswer: q.modelAnswer,
    acceptedAnswers: q.acceptedAnswers ?? [],
    rubricVersion: q.rubricVersion,
    rubric: rubric.map((r) => ({ id: r.id, kind: r.kind, description: r.description, marks: num(r.marks) })),
  };
}

export async function insertAiGrades(x: Exec, orgId: string, jobId: string | null, results: GradeResult[]): Promise<void> {
  if (!results.length) return;
  await x.insert(hwAiGrade).values(results.map((r) => ({
    id: newId(),
    organizationId: orgId,
    answerId: r.answerId,
    jobId,
    model: r.model,
    promptVersion: r.promptVersion,
    rubricVersion: r.rubricVersion,
    items: r.items,
    suggestedMarks: String(r.suggestedMarks),
    confidence: String(r.confidence),
    validationNotes: r.validationNotes,
  })));
}

/**
 * Answers of one question that still need a suggestion for the current rubric: transcript
 * ready, submission handed in, no final grade yet, and no AI grade newer than the latest
 * transcript revision for this rubric version.
 */
export async function answersNeedingSuggestion(x: Exec, q: GradeQuestion): Promise<{ answerId: string; transcript: string }[]> {
  const rows = await x.execute<{ id: string; transcript: string | null }>(sql`
    SELECT a.id, a.transcript
      FROM hw_answer a
      JOIN hw_submission s ON s.id = a.submission_id
     WHERE a.question_id = ${q.id}
       AND a.transcript_status IN ('done', 'not_needed')
       AND s.status NOT IN ('draft', 'returned')
       AND NOT EXISTS (SELECT 1 FROM hw_grade g WHERE g.answer_id = a.id)
       AND NOT EXISTS (
         SELECT 1 FROM hw_ai_grade ag
          WHERE ag.answer_id = a.id AND ag.rubric_version = ${q.rubricVersion}
            AND ag.created_at >= COALESCE(
              (SELECT max(r.created_at) FROM hw_transcript_revision r WHERE r.answer_id = a.id), a.created_at))
     ORDER BY a.created_at`);
  return rows.rows.map((r) => ({ answerId: r.id, transcript: r.transcript ?? '' }));
}

/**
 * For one question: mark what rules can mark (blank, exact match) right now, for free, and
 * queue an AI grade job for the rest. Needs a rubric for AI marking; without one, answers
 * wait for the teacher.
 */
export async function gradeRulesThenQueue(x: Exec, orgId: string, questionId: string): Promise<{ byRule: number; queued: number }> {
  const q = await loadGradeQuestion(x, questionId);
  if (!q) return { byRule: 0, queued: 0 };
  const { byRule, forAi } = await gradeByRules(x, orgId, q);
  if (forAi > 0 && q.rubric.length > 0) await enqueueGrade(x, orgId, q.id, getHwConfig().HW_GRADE_DEBOUNCE_SECONDS);
  return { byRule, queued: forAi };
}

/**
 * The free part only: blank and exact-match answers get their suggestion now. Used by the
 * grade job itself, which must not queue another job for the question it is working on.
 */
export async function gradeByRules(x: Exec, orgId: string, q: GradeQuestion): Promise<{ byRule: number; forAi: number }> {
  const pending = await answersNeedingSuggestion(x, q);
  const byRule: GradeResult[] = [];
  let forAi = 0;
  for (const a of pending) {
    const r = gradeWithoutAi(q, a.answerId, a.transcript);
    if (r) byRule.push(r);
    else forAi++;
  }
  await insertAiGrades(x, orgId, null, byRule);
  return { byRule: byRule.length, forAi };
}

/** When nothing in a submission is still being read, it is ready for the teacher. */
export async function finishSubmissionIfRead(x: Exec, submissionId: string): Promise<boolean> {
  const answers = await x.select({ questionId: hwAnswer.questionId, status: hwAnswer.transcriptStatus, orgId: hwAnswer.organizationId })
    .from(hwAnswer).where(eq(hwAnswer.submissionId, submissionId));
  if (answers.some((a) => a.status === 'pending')) return false;

  const updated = await x.update(hwSubmission).set({ status: 'ready_for_review' })
    .where(and(eq(hwSubmission.id, submissionId), inArray(hwSubmission.status, ['submitted', 'processing'])))
    .returning({ id: hwSubmission.id, orgId: hwSubmission.organizationId });
  if (!updated.length) return false;

  for (const qid of new Set(answers.map((a) => a.questionId))) {
    await gradeRulesThenQueue(x, updated[0].orgId, qid);
  }
  return true;
}

/** Set a transcript and keep it in history. */
export async function setTranscript(
  x: Exec,
  answer: Pick<AnswerRow, 'id' | 'organizationId'>,
  t: {
    text: string;
    status: 'done' | 'not_needed' | 'needs_review';
    source: 'typed' | 'reader' | 'teacher_edit' | 'teacher_confirm';
    confidence?: number | null;
    unclearCount: number;
    engine?: string | null;
    tier?: number | null;
    reason?: string | null;
    by?: string | null;
  },
): Promise<void> {
  await x.update(hwAnswer).set({
    transcript: t.text,
    transcriptStatus: t.status,
    transcriptConfidence: t.confidence === undefined || t.confidence === null ? null : String(t.confidence),
    unclearCount: t.unclearCount,
    ...(t.engine !== undefined ? { readerEngine: t.engine } : {}),
    ...(t.tier !== undefined ? { readerTier: t.tier } : {}),
    failureReason: t.reason ?? null,
  }).where(eq(hwAnswer.id, answer.id));
  await x.insert(hwTranscriptRevision).values({
    id: newId(),
    organizationId: answer.organizationId,
    answerId: answer.id,
    transcript: t.text,
    source: t.source,
    readerEngine: t.engine ?? null,
    confidence: t.confidence === undefined || t.confidence === null ? null : String(t.confidence),
    createdBy: t.by ?? null,
  });
}

/** Answers that could not be read: the teacher reads the original. Never left as "pending". */
export async function failAnswers(x: Exec, answerIds: string[], reason: string, status: 'failed' | 'needs_review' = 'failed'): Promise<void> {
  if (!answerIds.length) return;
  await x.update(hwAnswer).set({ transcriptStatus: status, failureReason: reason })
    .where(and(inArray(hwAnswer.id, answerIds), eq(hwAnswer.transcriptStatus, 'pending')));
}

/** Latest AI suggestion per answer, for the marking view. */
export async function latestAiGrade(x: Exec, answerId: string) {
  const [g] = await x.select().from(hwAiGrade).where(eq(hwAiGrade.answerId, answerId)).orderBy(desc(hwAiGrade.createdAt)).limit(1);
  return g ?? null;
}

export async function hasFinalGrade(x: Exec, answerId: string): Promise<boolean> {
  const [g] = await x.select({ id: hwGrade.answerId }).from(hwGrade).where(eq(hwGrade.answerId, answerId)).limit(1);
  return Boolean(g);
}
