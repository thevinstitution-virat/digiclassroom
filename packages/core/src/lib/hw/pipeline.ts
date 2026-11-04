// The steps between "student pressed submit" and "teacher sees suggestions", shared by the
// submit endpoint and the job handlers.

import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { hwAiGrade, hwAnswer, hwGrade, hwQuestion, hwRubricItem, hwSubmission, hwTranscriptRevision } from '@/db/hw-schema';
import { hwAiGradeSource } from '@/db/hw-cost-schema';
import { REUSE_NOTE } from './grader/dedupe';
import { getHwConfig } from './config';
import { newId, num, type Exec } from './db';
import { gradeWithoutAi } from './grader/exact-match';
import type { GradeQuestion, GradeResult } from './grader/types';
import { enqueueGrade } from './jobs/queue';
import { isRuleModel } from './eligibility/decision';
import { schemeStampsForAnswers } from './keys/product';

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
  const rows = results.map((r) => ({ id: newId(), r }));
  await x.insert(hwAiGrade).values(rows.map(({ id, r }) => ({
    id,
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
  // Where each model's suggestion got its marking scheme from, and which key (and key-service version) it used (migration 027). A rule in code is not an AI suggestion.
  const byModel = rows.filter(({ r }) => !isRuleModel(r.model));
  if (byModel.length) {
    const stamps = await schemeStampsForAnswers(x, orgId, [...new Set(byModel.map(({ r }) => r.answerId))]);
    await x.execute(sql`INSERT INTO hw_ai_grade_scheme (ai_grade_id, organization_id, scheme_source, question_key_id, key_service_version, config_hash) VALUES ${sql.join(byModel.map(({ id, r }) => {
      const st = stamps.get(r.answerId) ?? { source: 'teacher_rubric' as const, keyId: null, keyServiceVersion: null, configHash: null };
      return sql`(${id}, ${orgId}, ${st.source}, ${st.keyId}, ${st.keyServiceVersion}, ${st.configHash})`;
    }), sql`, `)}`);
  }
  // How each suggestion was produced, only while a cost flag that records it is on (migration 019).
  const sourced = rows.filter(({ r }) => r.markSource !== undefined);
  if (sourced.length) {
    await x.insert(hwAiGradeSource).values(sourced.map(({ id, r }) => ({
      aiGradeId: id,
      organizationId: orgId,
      answerId: r.answerId,
      markSource: r.markSource!,
      reusedFromAnswerId: r.markSource === 'reuse' ? r.reusedFromAnswerId! : null,
      transcriptHash: r.transcriptHash ?? null,
      keyVersionHash: r.keyVersionHash ?? null,
    })));
  }
}

/** Suggestions an AI already made for the same question, key version and transcript (originals only, newest first). */
export async function findPriorSuggestions(x: Exec, orgId: string, keyHash: string, transcriptHashes: string[]): Promise<Map<string, GradeResult>> {
  const out = new Map<string, GradeResult>();
  if (!transcriptHashes.length) return out;
  const rows = await x.execute<{ answer_id: string; model: string; prompt_version: string; rubric_version: number; items: GradeResult['items']; suggested_marks: string; confidence: string; validation_notes: string[]; transcript_hash: string }>(sql`
    SELECT DISTINCT ON (s.transcript_hash) g.answer_id, g.model, g.prompt_version, g.rubric_version, g.items, g.suggested_marks, g.confidence, g.validation_notes, s.transcript_hash
      FROM hw_ai_grade_source s JOIN hw_ai_grade g ON g.id = s.ai_grade_id AND g.organization_id = s.organization_id
     WHERE s.organization_id = ${orgId} AND s.key_version_hash = ${keyHash} AND s.mark_source = 'ai'
       AND s.transcript_hash IN (${sql.join(transcriptHashes.map((h) => sql`${h}`), sql`, `)})
     ORDER BY s.transcript_hash, g.created_at DESC`);
  for (const r of rows.rows) {
    out.set(r.transcript_hash, {
      answerId: r.answer_id, model: r.model, promptVersion: r.prompt_version, rubricVersion: r.rubric_version, items: r.items,
      suggestedMarks: Number(r.suggested_marks), confidence: Number(r.confidence), validationNotes: r.validation_notes,
    });
  }
  return out;
}

/** A copy of an original suggestion for another answer with the same transcript, question and key version. */
export function reusedSuggestion(original: GradeResult, toAnswerId: string, hashes: { transcriptHash: string; keyVersionHash: string }): GradeResult {
  return {
    ...original,
    answerId: toAnswerId,
    markSource: 'reuse',
    reusedFromAnswerId: original.answerId,
    ...hashes,
    validationNotes: [...original.validationNotes.filter((n) => n !== REUSE_NOTE), REUSE_NOTE],
  };
}

export interface SuggestionSource { markSource: 'ai' | 'code' | 'reuse'; reusedFromAnswerId: string | null; sameAsOthers: number }

/** For the marking view: how each listed suggestion was produced, and how many other answers share its transcript. */
export async function suggestionSources(x: Exec, orgId: string, aiGradeIds: string[]): Promise<Map<string, SuggestionSource>> {
  const out = new Map<string, SuggestionSource>();
  if (!aiGradeIds.length) return out;
  const rows = await x.execute<{ ai_grade_id: string; mark_source: SuggestionSource['markSource']; reused_from_answer_id: string | null; same_as_others: number }>(sql`
    SELECT s.ai_grade_id, s.mark_source, s.reused_from_answer_id,
           CASE WHEN s.transcript_hash IS NULL THEN 0 ELSE
             (SELECT count(DISTINCT o.answer_id)::int FROM hw_ai_grade_source o
               WHERE o.organization_id = s.organization_id AND o.key_version_hash = s.key_version_hash
                 AND o.transcript_hash = s.transcript_hash AND o.answer_id <> s.answer_id) END AS same_as_others
      FROM hw_ai_grade_source s
     WHERE s.organization_id = ${orgId} AND s.ai_grade_id IN (${sql.join(aiGradeIds.map((i) => sql`${i}`), sql`, `)})`);
  for (const r of rows.rows) out.set(r.ai_grade_id, { markSource: r.mark_source, reusedFromAnswerId: r.reused_from_answer_id, sameAsOthers: r.same_as_others });
  return out;
}

/** How many OTHER answers to the same question share this answer's transcript and key version (0 when unknown). */
export async function sameAsOthers(x: Exec, orgId: string, answerId: string): Promise<number> {
  const rows = await x.execute<{ n: number }>(sql`
    SELECT count(DISTINCT o.answer_id)::int AS n
      FROM hw_ai_grade_source me
      JOIN hw_ai_grade_source o ON o.organization_id = me.organization_id AND o.key_version_hash = me.key_version_hash
                               AND o.transcript_hash = me.transcript_hash AND o.answer_id <> me.answer_id
     WHERE me.organization_id = ${orgId} AND me.answer_id = ${answerId} AND me.transcript_hash IS NOT NULL`);
  return rows.rows[0]?.n ?? 0;
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
  const codeMarking = getHwConfig().HW_CODE_MARKING_ENABLED;
  for (const a of pending) {
    const r = gradeWithoutAi(q, a.answerId, a.transcript, { codeMarking });
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
