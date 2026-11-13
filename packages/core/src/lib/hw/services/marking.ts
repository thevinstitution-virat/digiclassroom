// Teacher marking. THE ONLY MODULE THAT WRITES hw_grade: every write here is a direct
// teacher action (accept, edit, manual, bulk accept after confirming the count). The AI path
// writes suggestions to hw_ai_grade and never imports this file. A test greps for this.

import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { studentEnrollments, user } from '@/db/schema';
import { hwAiGrade, hwAiJob, hwAiUsageMonthly, hwAnswer, hwAssignment, hwGrade, hwQuestion, hwRubricItem, hwSubmission, hwTenantQuota, hwTranscriptRevision, type HwItemMark } from '@/db/hw-schema';
import { assignmentForManage, requireHwEnabled, requireRole } from '../access/guards';
import { canSetQuota, type HwActor } from '../access/policy';
import { getHwConfig } from '../config';
import { HwError } from '../errors';
import { db, num, type Exec } from '../db';
import { countUnclear } from '../text/normalise';
import { aiWorkStatus } from '../jobs/homework-batch';
import { screenInstructions } from '../grader/instruction-screen';
import { dismissedFlags, dismissInstructionFlag } from '../instruction-flags';
import { gradeRulesThenQueue, setTranscript, suggestionSources, type SuggestionSource } from '../pipeline';
import { aiOffMessage, isRuleModel } from '../eligibility/decision';
import { eligibilityOfQuestion } from '../eligibility/registry';
import { signedReadUrl } from '../storage/r2';
import { answerImageKey } from '../storage/keys';
import { tenantUsage } from '../tenants';
import { writeAudit } from '../admin-audit';
import { PRACTICE_ORG_ID } from '../practice/rules';

type AnswerRow = typeof hwAnswer.$inferSelect;
type AiGradeRow = typeof hwAiGrade.$inferSelect;

/** An answer, its question and assignment, checked against the teacher's access. */
export async function answerForMarking(actor: HwActor, answerId: string) {
  const [a] = await db.select().from(hwAnswer).where(and(eq(hwAnswer.id, answerId), eq(hwAnswer.organizationId, actor.orgId))).limit(1);
  if (!a) throw new HwError('NOT_FOUND', 'Answer not found.');
  const [q] = await db.select().from(hwQuestion).where(eq(hwQuestion.id, a.questionId)).limit(1);
  const assignment = await assignmentForManage(actor, q.assignmentId);
  const [s] = await db.select().from(hwSubmission).where(eq(hwSubmission.id, a.submissionId)).limit(1);
  if (s.status === 'draft') throw new HwError('CONFLICT', 'This work has not been handed in.');
  return { answer: a, question: q, assignment, submission: s };
}

export async function currentRubric(questionId: string) {
  return db.select().from(hwRubricItem)
    .where(and(eq(hwRubricItem.questionId, questionId), isNull(hwRubricItem.retiredAt)))
    .orderBy(asc(hwRubricItem.position));
}

/**
 * A suggestion is usable only if it is the newest one for the answer, made for the current
 * rubric, and made after the latest transcript change.
 */
async function usableAiGrade(answer: AnswerRow, rubricVersion: number, aiGradeId: string): Promise<AiGradeRow> {
  const [g] = await db.select().from(hwAiGrade).where(and(eq(hwAiGrade.id, aiGradeId), eq(hwAiGrade.answerId, answer.id))).limit(1);
  if (!g) throw new HwError('NOT_FOUND', 'Suggestion not found.');
  // An AI suggestion is usable only while its group is eligible for the marking setup running now (roadmap 5.3). A rule's mark in code is not an AI suggestion.
  if (!isRuleModel(g.model)) {
    const elig = await eligibilityOfQuestion(db, answer.questionId);
    if (!elig.eligible) throw new HwError('CONFLICT', aiOffMessage(elig.reason));
  }
  const [latest] = await db.select({ id: hwAiGrade.id }).from(hwAiGrade).where(eq(hwAiGrade.answerId, answer.id)).orderBy(desc(hwAiGrade.createdAt)).limit(1);
  const [rev] = await db.select({ at: hwTranscriptRevision.createdAt }).from(hwTranscriptRevision)
    .where(eq(hwTranscriptRevision.answerId, answer.id)).orderBy(desc(hwTranscriptRevision.createdAt)).limit(1);
  if (latest.id !== g.id || g.rubricVersion !== rubricVersion || (rev && g.createdAt < rev.at)) {
    throw new HwError('CONFLICT', 'This suggestion is out of date. Reload to see the latest one.');
  }
  return g;
}

/** Validate item marks against the current rubric; returns their sum. */
export function checkItemMarks(itemMarks: HwItemMark[], rubric: { id: string; marks: string }[], questionMarks: number): number {
  const seen = new Set<string>();
  let sum = 0;
  for (const m of itemMarks) {
    const r = rubric.find((x) => x.id === m.rubric_item_id);
    if (!r) throw new HwError('BAD_REQUEST', 'A key point does not belong to this question.');
    if (seen.has(m.rubric_item_id)) throw new HwError('BAD_REQUEST', 'A key point is listed twice.');
    seen.add(m.rubric_item_id);
    if (!(m.marks >= 0) || m.marks > num(r.marks) || Math.round(m.marks * 2) !== m.marks * 2) {
      throw new HwError('BAD_REQUEST', `Marks for a key point must be between 0 and ${num(r.marks)}, in half marks.`);
    }
    sum += m.marks;
  }
  if (sum > questionMarks) throw new HwError('BAD_REQUEST', `Key points add up to ${sum}, more than the question's ${questionMarks} marks.`);
  return sum;
}

/**
 * A person's final mark for an answer, written as a revision (revisions.ts: released homework, a reported exam attempt). The one other place
 * hw_grade is written; still only ever a person's action, never the AI's.
 */
export async function writePersonGrade(tx: Exec, orgId: string, answerId: string, userId: string, g: { marks: number; itemMarks: HwItemMark[] }) {
  const now = new Date();
  await tx.insert(hwGrade).values({ answerId, organizationId: orgId, marks: String(g.marks), itemMarks: g.itemMarks, source: 'manual', aiGradeId: null, gradedBy: userId, gradedAt: now })
    .onConflictDoUpdate({ target: hwGrade.answerId, set: { marks: String(g.marks), itemMarks: g.itemMarks, source: 'manual', aiGradeId: null, gradedBy: userId, gradedAt: now } });
}

/** All answers of a submission graded -> submission is graded. */
async function refreshSubmissionStatus(x: Exec, submissionId: string): Promise<void> {
  await x.execute(sql`
    UPDATE hw_submission s SET status = 'graded'
     WHERE s.id = ${submissionId} AND s.status = 'ready_for_review'
       AND NOT EXISTS (
         SELECT 1 FROM hw_answer a WHERE a.submission_id = s.id
            AND NOT EXISTS (SELECT 1 FROM hw_grade g WHERE g.answer_id = a.id))`);
}

async function writeGrade(x: Exec, actor: HwActor, answer: AnswerRow, g: {
  marks: number; itemMarks: HwItemMark[]; comment?: string | null; source: 'accepted_ai' | 'edited_ai' | 'manual'; aiGradeId: string | null;
}): Promise<void> {
  const values = {
    answerId: answer.id,
    organizationId: actor.orgId,
    marks: String(g.marks),
    itemMarks: g.itemMarks,
    comment: g.comment ?? null,
    source: g.source,
    aiGradeId: g.aiGradeId,
    gradedBy: actor.userId,
    gradedAt: new Date(),
  };
  await x.insert(hwGrade).values(values).onConflictDoUpdate({
    target: hwGrade.answerId,
    set: { marks: values.marks, itemMarks: values.itemMarks, source: values.source, aiGradeId: values.aiGradeId, gradedBy: values.gradedBy, gradedAt: values.gradedAt, ...(g.comment !== undefined ? { comment: values.comment } : {}) },
  });
  await refreshSubmissionStatus(x, answer.submissionId);
}

function notReturned(s: { status: string }): void {
  if (s.status === 'returned') throw new HwError('CONFLICT', 'This work has been returned; marks can no longer change here.');
}

// ── Single-answer actions ────────────────────────────────────────────────────

export async function acceptAiGrade(actor: HwActor, answerId: string, aiGradeId: string, comment?: string | null) {
  const { answer, question, submission } = await answerForMarking(actor, answerId);
  notReturned(submission);
  const g = await usableAiGrade(answer, question.rubricVersion, aiGradeId);
  await db.transaction((tx) => writeGrade(tx, actor, answer, {
    marks: num(g.suggestedMarks),
    itemMarks: g.items.map((i) => ({ rubric_item_id: i.rubric_item_id, marks: i.marks })),
    comment, source: 'accepted_ai', aiGradeId: g.id,
  }));
}

export async function editAiGrade(actor: HwActor, answerId: string, aiGradeId: string, itemMarks: HwItemMark[], comment?: string | null) {
  const { answer, question, submission } = await answerForMarking(actor, answerId);
  notReturned(submission);
  const g = await usableAiGrade(answer, question.rubricVersion, aiGradeId);
  const marks = checkItemMarks(itemMarks, await currentRubric(question.id), num(question.marks));
  await db.transaction((tx) => writeGrade(tx, actor, answer, { marks, itemMarks, comment, source: 'edited_ai', aiGradeId: g.id }));
}

export async function manualGrade(actor: HwActor, answerId: string, input: { marks?: number; itemMarks?: HwItemMark[]; comment?: string | null }) {
  const { answer, question, submission } = await answerForMarking(actor, answerId);
  notReturned(submission);
  const qMarks = num(question.marks);
  const itemMarks = input.itemMarks ?? [];
  const marks = itemMarks.length ? checkItemMarks(itemMarks, await currentRubric(question.id), qMarks) : input.marks;
  if (marks === undefined || !(marks >= 0) || marks > qMarks || Math.round(marks * 2) !== marks * 2) {
    throw new HwError('BAD_REQUEST', `Marks must be between 0 and ${qMarks}, in half marks.`);
  }
  await db.transaction((tx) => writeGrade(tx, actor, answer, { marks, itemMarks, comment: input.comment, source: 'manual', aiGradeId: null }));
}

/**
 * The teacher says a flagged answer is not an instruction to the marker. Recorded with the patterns that fired (the pilot's
 * false-positive measure); the flag is lifted for this text, so the answer can go into "accept all" again. It changes no mark.
 */
export async function notAnInstruction(actor: HwActor, answerId: string) {
  if (!getHwConfig().HW_INSTRUCTION_GUARD_ENABLED) throw new HwError('NOT_FOUND', 'Not available.');
  const { answer } = await answerForMarking(actor, answerId);
  return dismissInstructionFlag(actor.orgId, actor.userId, { id: answer.id, transcript: answer.transcript });
}

export async function setComment(actor: HwActor, answerId: string, comment: string | null) {
  const { answer, submission } = await answerForMarking(actor, answerId);
  notReturned(submission);
  const res = await db.update(hwGrade).set({ comment, gradedBy: actor.userId, gradedAt: new Date() })
    .where(eq(hwGrade.answerId, answer.id)).returning({ id: hwGrade.answerId });
  if (!res.length) throw new HwError('CONFLICT', 'Give a mark before adding a comment.');
}

// ── Bulk accept ──────────────────────────────────────────────────────────────

async function highConfidenceCandidates(actor: HwActor, questionId: string, minConfidence: number) {
  const [q] = await db.select().from(hwQuestion).where(and(eq(hwQuestion.id, questionId), eq(hwQuestion.organizationId, actor.orgId))).limit(1);
  if (!q) throw new HwError('NOT_FOUND', 'Question not found.');
  await assignmentForManage(actor, q.assignmentId);
  const rows = await db.execute<{ answer_id: string; ai_grade_id: string }>(sql`
    SELECT DISTINCT ON (a.id) a.id AS answer_id, a.transcript, ag.id AS ai_grade_id, ag.confidence, ag.rubric_version, ag.created_at, ag.model
      FROM hw_answer a
      JOIN hw_submission s ON s.id = a.submission_id AND s.status IN ('ready_for_review', 'graded')
      JOIN hw_ai_grade ag ON ag.answer_id = a.id
     WHERE a.question_id = ${q.id}
       AND a.transcript_status IN ('done', 'not_needed')
       AND jsonb_array_length(a.student_flags) = 0
       AND NOT EXISTS (SELECT 1 FROM hw_grade g WHERE g.answer_id = a.id)
     ORDER BY a.id, ag.created_at DESC`);
  const elig = await eligibilityOfQuestion(db, q.id);
  // Re-check each candidate with the same rule the single accept uses.
  const out: { answerId: string; aiGradeId: string }[] = [];
  const guard = getHwConfig().HW_INSTRUCTION_GUARD_ENABLED;
  const candidates = rows.rows as unknown as { answer_id: string; transcript: string | null; ai_grade_id: string; confidence: string; rubric_version: number; created_at: Date; model: string }[];
  // A teacher's "not an instruction" on the answer's current text lifts the flag.
  const dismissed = guard ? await dismissedFlags(actor.orgId, candidates.map((c) => ({ id: c.answer_id, transcript: c.transcript }))) : new Set<string>();
  for (const r of candidates) {
    if (num(r.confidence) < minConfidence || r.rubric_version !== q.rubricVersion) continue;
    // No AI suggestion is accepted in bulk for a group that is not eligible.
    if (!elig.eligible && !isRuleModel(r.model)) continue;
    // An answer that addresses the marker is never accepted in bulk: the teacher reads it.
    if (guard && !dismissed.has(r.answer_id) && screenInstructions(r.transcript ?? '').flagged) continue;
    const [rev] = await db.select({ at: hwTranscriptRevision.createdAt }).from(hwTranscriptRevision)
      .where(eq(hwTranscriptRevision.answerId, r.answer_id)).orderBy(desc(hwTranscriptRevision.createdAt)).limit(1);
    if (rev && new Date(r.created_at) < rev.at) continue;
    out.push({ answerId: r.answer_id, aiGradeId: r.ai_grade_id });
  }
  return { question: q, candidates: out };
}

/** Step 1: how many would be accepted. Answers with student flags are never included. */
export async function bulkAcceptPreview(actor: HwActor, questionId: string) {
  const min = getHwConfig().HW_HIGH_CONFIDENCE;
  const { candidates } = await highConfidenceCandidates(actor, questionId, min);
  return { count: candidates.length, minConfidence: min };
}

/** Step 2: accept them, only if the count the teacher confirmed is still the count. */
export async function bulkAccept(actor: HwActor, questionId: string, confirmedCount: number) {
  const min = getHwConfig().HW_HIGH_CONFIDENCE;
  const { candidates } = await highConfidenceCandidates(actor, questionId, min);
  if (candidates.length !== confirmedCount) {
    throw new HwError('CONFLICT', `The number of suggestions changed (now ${candidates.length}). Please review and confirm again.`);
  }
  await db.transaction(async (tx) => {
    for (const c of candidates) {
      const [answer] = await tx.select().from(hwAnswer).where(eq(hwAnswer.id, c.answerId));
      const [g] = await tx.select().from(hwAiGrade).where(eq(hwAiGrade.id, c.aiGradeId));
      await writeGrade(tx, actor, answer, {
        marks: num(g.suggestedMarks),
        itemMarks: g.items.map((i) => ({ rubric_item_id: i.rubric_item_id, marks: i.marks })),
        source: 'accepted_ai', aiGradeId: g.id,
      });
    }
  });
  return { accepted: candidates.length };
}

// ── Transcript fixes ─────────────────────────────────────────────────────────

/** The teacher corrects a transcript (or confirms it as right). The old one stays in history; marking runs again. */
export async function fixTranscript(actor: HwActor, answerId: string, input: { text?: string; confirm?: boolean }) {
  const { answer, question, submission } = await answerForMarking(actor, answerId);
  notReturned(submission);
  if (answer.mode === 'typed') throw new HwError('BAD_REQUEST', 'Typed answers are already exact.');
  const text = input.confirm ? answer.transcript ?? '' : input.text;
  if (text === undefined) throw new HwError('BAD_REQUEST', 'Give the corrected text, or confirm the current one.');
  if (text.length > 50_000) throw new HwError('PAYLOAD_TOO_LARGE', 'This transcript is too long.');
  await db.transaction(async (tx) => {
    await setTranscript(tx, answer, {
      text, status: 'done', source: input.confirm ? 'teacher_confirm' : 'teacher_edit',
      unclearCount: countUnclear(text), confidence: 1, by: actor.userId,
    });
    await tx.update(hwSubmission).set({ status: 'ready_for_review' })
      .where(and(eq(hwSubmission.id, submission.id), eq(hwSubmission.status, 'processing')));
    await gradeRulesThenQueue(tx, actor.orgId, question.id);
  });
}

// ── Views ────────────────────────────────────────────────────────────────────

export async function classOverview(actor: HwActor, assignmentId: string) {
  await requireHwEnabled(actor);
  const a = await assignmentForManage(actor, assignmentId);
  const students = await db.select({ id: user.id, name: user.name, sectionId: studentEnrollments.sectionId, roll: studentEnrollments.rollNumber })
    .from(studentEnrollments).innerJoin(user, eq(user.id, studentEnrollments.userId))
    .where(and(eq(studentEnrollments.organizationId, actor.orgId), eq(studentEnrollments.classId, a.classId), eq(studentEnrollments.status, 'active')));
  const inScope = students.filter((s) => a.sectionId === null || s.sectionId === a.sectionId);
  const subs = await db.select().from(hwSubmission).where(eq(hwSubmission.assignmentId, a.id));
  const counts = subs.length
    ? await db.execute<{ submission_id: string; pending: number; needs_review: number; failed: number; graded: number; total: number }>(sql`
      SELECT a.submission_id,
             count(*) FILTER (WHERE a.transcript_status = 'pending')::int      AS pending,
             count(*) FILTER (WHERE a.transcript_status = 'needs_review')::int AS needs_review,
             count(*) FILTER (WHERE a.transcript_status = 'failed')::int       AS failed,
             count(g.answer_id)::int                                           AS graded,
             count(*)::int                                                     AS total
        FROM hw_answer a LEFT JOIN hw_grade g ON g.answer_id = a.id
       WHERE a.submission_id IN (${sql.join(subs.map((s) => sql`${s.id}`), sql`, `)})
       GROUP BY a.submission_id`)
    : { rows: [] };
  const jobs = await db.select({ kind: hwAiJob.kind, status: hwAiJob.status, error: hwAiJob.error, submissionId: hwAiJob.submissionId, questionId: hwAiJob.questionId, updatedAt: hwAiJob.updatedAt })
    .from(hwAiJob)
    .where(and(eq(hwAiJob.organizationId, actor.orgId), eq(hwAiJob.status, 'failed'),
      sql`(${hwAiJob.submissionId} IN (SELECT id FROM hw_submission WHERE assignment_id = ${a.id}) OR ${hwAiJob.questionId} IN (SELECT id FROM hw_question WHERE assignment_id = ${a.id}))`))
    .orderBy(desc(hwAiJob.updatedAt)).limit(50);
  // Only while homework batching is on: what the AI is doing, when it will be ready, and any fallback.
  const aiWork = getHwConfig().HW_HOMEWORK_BATCH_ENABLED || getHwConfig().HW_BATCH_ENABLED ? await aiWorkStatus(db, actor.orgId, a.id) : undefined;
  return {
    ...(aiWork ? { aiWork } : {}),
    assignment: { id: a.id, title: a.title, status: a.status, dueAt: a.dueAt, totalMarks: num(a.totalMarks), returnedAt: a.returnedAt },
    students: inScope.map((st) => {
      const s = subs.find((x) => x.studentId === st.id);
      const c = s ? counts.rows.find((r) => r.submission_id === s.id) : undefined;
      return { studentId: st.id, name: st.name, roll: st.roll, submission: s ? { id: s.id, status: s.status, submittedAt: s.submittedAt, isLate: s.isLate } : null, answers: c ?? null };
    }),
    failedJobs: jobs,
  };
}

export type QueueFilter = 'all' | 'needs_review' | 'low_confidence' | 'flagged' | 'ungraded';

/** Every handed-in answer to one question, for marking question by question. */
export async function questionQueue(actor: HwActor, questionId: string, filter: QueueFilter) {
  const [q] = await db.select().from(hwQuestion).where(and(eq(hwQuestion.id, questionId), eq(hwQuestion.organizationId, actor.orgId))).limit(1);
  if (!q) throw new HwError('NOT_FOUND', 'Question not found.');
  await assignmentForManage(actor, q.assignmentId);
  const rows = await db.select({ a: hwAnswer, s: hwSubmission, g: hwGrade, name: user.name })
    .from(hwAnswer)
    .innerJoin(hwSubmission, eq(hwSubmission.id, hwAnswer.submissionId))
    .innerJoin(user, eq(user.id, hwSubmission.studentId))
    .leftJoin(hwGrade, eq(hwGrade.answerId, hwAnswer.id))
    .where(and(eq(hwAnswer.questionId, q.id), inArray(hwSubmission.status, ['processing', 'ready_for_review', 'graded', 'returned'])))
    .orderBy(asc(user.name));
  const ids = rows.map((r) => r.a.id);
  const ai = ids.length
    ? await db.execute<AiGradeRow & { answer_id: string }>(sql`
      SELECT DISTINCT ON (answer_id) * FROM hw_ai_grade WHERE answer_id IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})
       ORDER BY answer_id, created_at DESC`)
    : { rows: [] };
  const hi = getHwConfig().HW_HIGH_CONFIDENCE;
  // Only while a cost flag that records it is on (needs migration 019): where each suggestion came from.
  const sourceFlags = getHwConfig().HW_CODE_MARKING_ENABLED || getHwConfig().HW_DEDUPE_MARKING_ENABLED;
  const sources = sourceFlags
    ? await suggestionSources(db, actor.orgId, (ai.rows as unknown as { id: string }[]).map((x) => x.id))
    : new Map<string, SuggestionSource>();
  const guarded = getHwConfig().HW_INSTRUCTION_GUARD_ENABLED;
  const dismissed = guarded ? await dismissedFlags(actor.orgId, rows.map((r) => ({ id: r.a.id, transcript: r.a.transcript }))) : new Set<string>();
  // Roadmap 5.3: AI suggestions are shown only while this kind of question is eligible for the marking setup running now.
  const elig = await eligibilityOfQuestion(db, q.id);
  const items = rows.map((r) => {
    const found = (ai.rows as unknown as Record<string, unknown>[]).find((x) => x.answer_id === r.a.id) ?? null;
    const suggestion = found && (elig.eligible || isRuleModel(found.model as string)) ? found : null;
    const src = suggestion ? sources.get(suggestion.id as string) : undefined;
    return {
      answerId: r.a.id,
      studentName: r.name,
      submissionStatus: r.s.status,
      isLate: r.s.isLate,
      mode: r.a.mode,
      transcript: r.a.transcript,
      transcriptStatus: r.a.transcriptStatus,
      transcriptConfidence: r.a.transcriptConfidence === null ? null : num(r.a.transcriptConfidence),
      // Only while the instruction guard is on: the answer contains text addressed to the marker.
      ...(guarded ? (() => { const s = screenInstructions(r.a.transcript ?? ''); return s.flagged ? (dismissed.has(r.a.id) ? { instructionFlagDismissed: true } : { instructionFlag: s.hits.map((h) => h.note) }) : {}; })() : {}),
      unclearCount: r.a.unclearCount,
      studentFlags: r.a.studentFlags,
      failureReason: r.a.failureReason,
      suggestion: suggestion && {
        id: suggestion.id as string,
        items: suggestion.items,
        suggestedMarks: num(suggestion.suggested_marks as string),
        confidence: num(suggestion.confidence as string),
        rubricVersion: suggestion.rubric_version as number,
        validationNotes: suggestion.validation_notes,
        model: suggestion.model as string,
        ...(src ? { source: src.markSource, reusedFromAnswerId: src.reusedFromAnswerId, sameAsOthers: src.sameAsOthers } : {}),
      },
      grade: r.g && { marks: num(r.g.marks), itemMarks: r.g.itemMarks, comment: r.g.comment, source: r.g.source },
    };
  });
  const keep = (x: (typeof items)[number]) => {
    switch (filter) {
      case 'needs_review': return x.transcriptStatus === 'needs_review' || x.transcriptStatus === 'failed';
      case 'low_confidence': return (x.suggestion !== null && x.suggestion.confidence < hi) || (x.transcriptConfidence !== null && x.transcriptConfidence < hi);
      case 'flagged': return x.studentFlags.length > 0;
      case 'ungraded': return !x.grade;
      default: return true;
    }
  };
  return {
    question: { id: q.id, position: q.position, type: q.type, prompt: q.prompt, marks: num(q.marks), modelAnswer: q.modelAnswer, rubricVersion: q.rubricVersion },
    rubric: (await currentRubric(q.id)).map((r) => ({ id: r.id, kind: r.kind, description: r.description, marks: num(r.marks) })),
    answers: items.filter(keep),
    // Present only when AI suggestions are off for this kind of question: why, in words for the teacher.
    ...(elig.eligible ? {} : { aiOff: { reason: elig.reason, message: aiOffMessage(elig.reason) } }),
  };
}

/** One answer with short-lived links to its original handwriting and its transcript history. */
export async function answerDetail(actor: HwActor, answerId: string) {
  const { answer } = await answerForMarking(actor, answerId);
  const history = await db.select().from(hwTranscriptRevision).where(eq(hwTranscriptRevision.answerId, answer.id)).orderBy(asc(hwTranscriptRevision.createdAt));
  return {
    answerId: answer.id,
    // the picture that was read: the learner's photo for a photo answer, else the ink render
    renderUrl: answerImageKey(answer) ? await signedReadUrl(answerImageKey(answer)!) : null,
    inkUrl: answer.inkKey ? await signedReadUrl(answer.inkKey) : null,
    imageUrl: answer.imageKey ? await signedReadUrl(answer.imageKey) : null,
    transcriptHistory: history.map((h) => ({ transcript: h.transcript, source: h.source, readerEngine: h.readerEngine, confidence: h.confidence === null ? null : num(h.confidence), at: h.createdAt })),
  };
}

// ── Returning work ───────────────────────────────────────────────────────────

/** Return every fully graded submission. Marks become visible to students only now. */
export async function returnAssignment(actor: HwActor, assignmentId: string) {
  const a = await assignmentForManage(actor, assignmentId);
  return db.transaction(async (tx) => {
    const returned = await tx.update(hwSubmission).set({ status: 'returned' })
      .where(and(eq(hwSubmission.assignmentId, a.id), eq(hwSubmission.status, 'graded')))
      .returning({ id: hwSubmission.id });
    const [{ waiting }] = await tx.select({ waiting: sql<number>`count(*)::int` }).from(hwSubmission)
      .where(and(eq(hwSubmission.assignmentId, a.id), inArray(hwSubmission.status, ['submitted', 'processing', 'ready_for_review'])));
    if (returned.length) await tx.update(hwAssignment).set({ returnedAt: new Date() }).where(eq(hwAssignment.id, a.id));
    return { returned: returned.length, notYetGraded: Number(waiting) };
  });
}

// ── Self-practice: the one place a mark is written without a teacher ─────────

/**
 * Independent learners have no teacher (docs/hw-eval/self-practice.md). In the PRACTICE SPACE ONLY, a submission whose every answer has a
 * suggestion for the current marking scheme is given those marks and returned, labelled "AI practice estimate" to the learner. graded_by must be a real user (foreign key), so it holds the learner's own id: source 'accepted_ai' in the practice institution means no teacher. It is held
 * back (left for the learner to see the reading only) when anything is doubtful: an answer the reader was unsure of, a suggestion below
 * HW_HIGH_CONFIDENCE, or text flagged as addressed to the marker. Run by the job runner; never from the AI paths.
 */
async function releasePracticeSubmission(submissionId: string): Promise<boolean> {
  const cfg = getHwConfig();
  return db.transaction(async (tx) => {
    const [s] = await tx.select().from(hwSubmission).where(eq(hwSubmission.id, submissionId)).for('update');
    if (!s || s.organizationId !== PRACTICE_ORG_ID || !['ready_for_review', 'graded'].includes(s.status)) return false;
    const rows = await tx.select({ a: hwAnswer, rubricVersion: hwQuestion.rubricVersion }).from(hwAnswer)
      .innerJoin(hwQuestion, eq(hwQuestion.id, hwAnswer.questionId))
      .where(eq(hwAnswer.submissionId, s.id));
    if (!rows.length) return false;
    const grades: { answerId: string; marks: number; itemMarks: HwItemMark[]; aiGradeId: string }[] = [];
    for (const { a, rubricVersion } of rows) {
      if (!['done', 'not_needed'].includes(a.transcriptStatus)) return false;
      if (a.transcriptConfidence !== null && num(a.transcriptConfidence) < cfg.HW_HIGH_CONFIDENCE) return false;
      if (cfg.HW_INSTRUCTION_GUARD_ENABLED && screenInstructions(a.transcript ?? '').flagged) return false;
      const [g] = await tx.select().from(hwAiGrade)
        .where(and(eq(hwAiGrade.answerId, a.id), eq(hwAiGrade.rubricVersion, rubricVersion)))
        .orderBy(desc(hwAiGrade.createdAt)).limit(1);
      if (!g || num(g.confidence) < cfg.HW_HIGH_CONFIDENCE) return false;
      grades.push({ answerId: a.id, marks: num(g.suggestedMarks), itemMarks: g.items.map((i) => ({ rubric_item_id: i.rubric_item_id, marks: i.marks })), aiGradeId: g.id });
    }
    for (const g of grades) {
      await tx.insert(hwGrade).values({
        answerId: g.answerId, organizationId: s.organizationId, marks: String(g.marks), itemMarks: g.itemMarks, comment: null,
        source: 'accepted_ai', aiGradeId: g.aiGradeId, gradedBy: s.studentId, gradedAt: new Date(),
      }).onConflictDoNothing();
    }
    await tx.update(hwSubmission).set({ status: 'returned' }).where(eq(hwSubmission.id, s.id));
    return true;
  });
}

/**
 * Release what is ready. Returns how many submissions were returned. A no-op unless self-practice is on.
 *
 * Only submissions whose every answer already has a suggestion for the current scheme are looked at, and the ones with the NEWEST suggestions first.
 * Work that is held back for good (an unsure reading, a low-confidence suggestion, no suggestion because the key never came) stays "ready for review"
 * for ever; taking the oldest first would let such work fill the batch and starve everything behind it.
 */
export async function releasePracticeSubmissions(limit = 100): Promise<number> {
  if (!getHwConfig().HW_SELF_PRACTICE_ENABLED) return 0;
  const subs = await db.execute<{ id: string }>(sql`
    SELECT s.id FROM hw_submission s
     WHERE s.organization_id = ${PRACTICE_ORG_ID} AND s.status IN ('ready_for_review', 'graded')
       AND EXISTS (SELECT 1 FROM hw_answer a WHERE a.submission_id = s.id)
       AND NOT EXISTS (
         SELECT 1 FROM hw_answer a JOIN hw_question q ON q.id = a.question_id
          WHERE a.submission_id = s.id
            AND NOT EXISTS (SELECT 1 FROM hw_ai_grade g WHERE g.answer_id = a.id AND g.rubric_version = q.rubric_version))
     ORDER BY (SELECT max(g.created_at) FROM hw_ai_grade g JOIN hw_answer a ON a.id = g.answer_id WHERE a.submission_id = s.id) DESC
     LIMIT ${limit}`);
  let n = 0;
  for (const s of subs.rows) if (await releasePracticeSubmission(s.id)) n++;
  return n;
}

// ── Usage and quota ──────────────────────────────────────────────────────────

export async function usageThisMonth(actor: HwActor) {
  requireRole(actor, 'admin');
  // The same figures the super admin sees on the Tenants tab (lib/hw/tenants.ts), so the two screens cannot disagree.
  const thisMonth = await tenantUsage(db, actor.orgId);
  const rows = await db.select().from(hwAiUsageMonthly).where(eq(hwAiUsageMonthly.organizationId, actor.orgId)).orderBy(desc(hwAiUsageMonthly.month)).limit(12);
  const [q] = await db.select().from(hwTenantQuota).where(eq(hwTenantQuota.organizationId, actor.orgId)).limit(1);
  return {
    enabled: q?.enabled ?? getHwConfig().HW_FEATURE_DEFAULT_ENABLED,
    monthlyAnswerQuota: q?.monthlyAnswerQuota ?? 0,
    thisMonth,
    months: rows.map((r) => ({ month: r.month, pagesRead: r.pagesRead, answersGraded: r.answersGraded, tokensIn: r.tokensIn, tokensCached: r.tokensCached, tokensOut: r.tokensOut, costPaise: num(r.costPaise) })),
  };
}

export async function setQuota(actor: HwActor, orgId: string, input: { enabled: boolean; monthlyAnswerQuota: number }) {
  if (!canSetQuota(actor)) throw new HwError('FORBIDDEN', 'Only platform staff can change quotas.');
  await db.transaction(async (tx) => {
    const [before] = await tx.select({ enabled: hwTenantQuota.enabled, q: hwTenantQuota.monthlyAnswerQuota }).from(hwTenantQuota).where(eq(hwTenantQuota.organizationId, orgId)).limit(1);
    await tx.insert(hwTenantQuota).values({ organizationId: orgId, enabled: input.enabled, monthlyAnswerQuota: input.monthlyAnswerQuota })
      .onConflictDoUpdate({ target: hwTenantQuota.organizationId, set: { enabled: input.enabled, monthlyAnswerQuota: input.monthlyAnswerQuota } });
    // Roadmap 5.1: every change to a quota leaves an audit row.
    await writeAudit(tx, { actorId: actor.userId, action: 'quota_changed', entity: 'tenant', entityId: orgId,
      oldValue: before ? { enabled: before.enabled, monthlyAnswerQuota: before.q } : null, newValue: { enabled: input.enabled, monthlyAnswerQuota: input.monthlyAnswerQuota }, reason: 'platform staff quota change' });
  });
}
