// InkBuddy attempts at one question (owner, 13 Nov 2026: docs/hw-eval/inkbuddy-teacher-roadmap.md, Phase 1).
//
// A learner may write the same question again after it is marked, up to HW_SELF_PRACTICE_MAX_ATTEMPTS_PER_QUESTION times (10) in their
// current plan. The count starts from the plan's start: today the free trial's; a paid plan, when it exists, starts it again from zero.
// Every attempt is kept, as the question's history (marks over time). An attempt is its own one-question assignment, because a learner has
// one submission per assignment; the new one copies the question, its marking points and its answer key, so writing again costs no new key.

import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { hwAssignment, hwPracticeTrial, hwQuestion, hwRubricItem } from '@/db/hw-schema';
import { getHwConfig } from '../config';
import { HwError } from '../errors';
import { db, newId, num, type Exec } from '../db';
import { queueKey } from '../keys/product';
import { PRACTICE_ORG_ID, PRACTICE_TEXT } from './rules';
import { isPracticeLearner, practiceEnabled, requireUsableTrial } from './trial';

const both = (t: { en: string; hi: string }) => `${t.en} / ${t.hi}`;

/** What identifies "the same question" across attempts: the book exercise (passage:index), or the board-paper row. */
export function practiceRefOf(originRef: Record<string, string> | null | undefined): string | null {
  if (originRef?.exercise) return originRef.exercise;
  if (originRef?.bankRowId) return `bank:${originRef.bankRowId}`;
  return null;
}
const REF_SQL = sql`coalesce(q.origin_ref ->> 'exercise', 'bank:' || (q.origin_ref ->> 'bankRowId'))`;

export const attemptsPerQuestion = (): number => getHwConfig().HW_SELF_PRACTICE_MAX_ATTEMPTS_PER_QUESTION;

/** When the learner's current plan began: the free trial's start (a paid plan's start will replace it). Attempts before it do not count. */
export async function planStart(x: Exec, userId: string): Promise<Date> {
  const [t] = await x.select({ startedAt: hwPracticeTrial.startedAt }).from(hwPracticeTrial).where(eq(hwPracticeTrial.userId, userId)).limit(1);
  return t?.startedAt ?? new Date(0);
}

export interface AttemptRow {
  assignmentId: string;
  submissionId: string | null;
  /** The submission's status, or null when the attempt was opened but nothing was saved yet. */
  status: string | null;
  createdAt: Date;
  submittedAt: Date | null;
  /** Marks, once returned. */
  awarded: number | null;
  outOf: number;
}

/** Every attempt the learner made at one question, oldest first. */
export async function attemptHistory(x: Exec, userId: string, ref: string): Promise<AttemptRow[]> {
  const r = await x.execute<{ assignment_id: string; submission_id: string | null; status: string | null; created_at: Date | string; submitted_at: Date | string | null; awarded: string | null; out_of: string }>(sql`
    SELECT a.id AS assignment_id, s.id AS submission_id, s.status, a.created_at, s.submitted_at, q.marks AS out_of,
           CASE WHEN s.status = 'returned' THEN (SELECT sum(g.marks) FROM hw_answer an JOIN hw_grade g ON g.answer_id = an.id WHERE an.submission_id = s.id) END AS awarded
      FROM hw_assignment a
      JOIN hw_question q ON q.assignment_id = a.id
      LEFT JOIN hw_submission s ON s.assignment_id = a.id AND s.student_id = ${userId}
     WHERE a.organization_id = ${PRACTICE_ORG_ID} AND a.created_by = ${userId} AND ${REF_SQL} = ${ref}
     ORDER BY a.created_at, a.id`);
  return r.rows.map((row) => ({
    assignmentId: row.assignment_id, submissionId: row.submission_id, status: row.status,
    createdAt: new Date(row.created_at), submittedAt: row.submitted_at ? new Date(row.submitted_at) : null,
    awarded: row.awarded === null ? null : num(row.awarded), outOf: num(row.out_of),
  }));
}

/** For a list of questions (search results): how many times each was attempted, and the latest attempt to open. */
export async function attemptCounts(x: Exec, userId: string, refs: string[]): Promise<Map<string, { attempts: number; latestAssignmentId: string }>> {
  const out = new Map<string, { attempts: number; latestAssignmentId: string }>();
  if (!refs.length) return out;
  const r = await x.execute<{ ref: string; n: number; latest: string }>(sql`
    SELECT ${REF_SQL} AS ref, count(*)::int AS n, (array_agg(a.id ORDER BY a.created_at DESC, a.id DESC))[1] AS latest
      FROM hw_assignment a JOIN hw_question q ON q.assignment_id = a.id
     WHERE a.organization_id = ${PRACTICE_ORG_ID} AND a.created_by = ${userId}
       AND ${REF_SQL} IN (${sql.join(refs.map((ref) => sql`${ref}`), sql`, `)})
     GROUP BY 1`);
  for (const row of r.rows) out.set(row.ref, { attempts: Number(row.n), latestAssignmentId: row.latest });
  return out;
}

/** Where the learner stands on one question: the history, the attempts used in this plan, and whether they may write it again now. */
export async function attemptStatus(x: Exec, userId: string, assignmentId: string) {
  const [q] = await x.select({ originRef: hwQuestion.originRef }).from(hwQuestion)
    .innerJoin(hwAssignment, eq(hwAssignment.id, hwQuestion.assignmentId))
    .where(and(eq(hwQuestion.assignmentId, assignmentId), eq(hwAssignment.organizationId, PRACTICE_ORG_ID), eq(hwAssignment.createdBy, userId))).limit(1);
  const ref = practiceRefOf(q?.originRef);
  if (!ref) return null;
  const history = await attemptHistory(x, userId, ref);
  const start = await planStart(x, userId);
  const usedInPlan = history.filter((h) => h.createdAt >= start).length;
  const limit = attemptsPerQuestion();
  const latest = history[history.length - 1];
  return {
    history: history.map((h, i) => ({ n: i + 1, ...h, current: h.assignmentId === assignmentId })),
    usedInPlan, limit,
    // a new attempt only once the latest one is marked; an open or held latest attempt is where to go instead
    canWriteAgain: latest?.status === 'returned' && usedInPlan < limit,
    latestAssignmentId: latest?.assignmentId ?? assignmentId,
  };
}

/**
 * "Write it again" after a mark: a new attempt at the same question, on a copy of it with the same marking points and answer key. When the
 * latest attempt is not marked yet, that attempt is returned instead (finish it first). Refused after the plan's limit for this question.
 */
export async function writeAgain(userId: string, assignmentId: string): Promise<{ assignmentId: string; reused: boolean }> {
  if (!practiceEnabled()) throw new HwError('FEATURE_DISABLED', both(PRACTICE_TEXT.off));
  if (!(await isPracticeLearner(db, userId))) throw new HwError('FORBIDDEN', both(PRACTICE_TEXT.notStarted));
  await requireUsableTrial(db, userId);
  return db.transaction(async (tx) => {
    const [own] = await tx.select({ q: hwQuestion }).from(hwQuestion)
      .innerJoin(hwAssignment, eq(hwAssignment.id, hwQuestion.assignmentId))
      .where(and(eq(hwQuestion.assignmentId, assignmentId), eq(hwAssignment.organizationId, PRACTICE_ORG_ID), eq(hwAssignment.createdBy, userId))).limit(1);
    const ref = practiceRefOf(own?.q.originRef);
    if (!own || !ref) throw new HwError('NOT_FOUND', 'Practice question not found.');
    // one new attempt at a time for this learner and question, however fast the button is pressed
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`hw-practice-again:${userId}:${ref}`}))`);
    const history = await attemptHistory(tx, userId, ref);
    const latest = history[history.length - 1]!;
    if (latest.status !== 'returned') return { assignmentId: latest.assignmentId, reused: true };
    const start = await planStart(tx, userId);
    const limit = attemptsPerQuestion();
    if (history.filter((h) => h.createdAt >= start).length >= limit) {
      throw new HwError('CONFLICT', both({ en: PRACTICE_TEXT.questionAttemptLimit.en.replace('{n}', String(limit)), hi: PRACTICE_TEXT.questionAttemptLimit.hi.replace('{n}', String(limit)) }));
    }

    // copy the LATEST attempt's question: it carries the newest key and marking points
    const [[a], [q]] = await Promise.all([
      tx.select().from(hwAssignment).where(eq(hwAssignment.id, latest.assignmentId)).limit(1),
      tx.select().from(hwQuestion).where(eq(hwQuestion.assignmentId, latest.assignmentId)).orderBy(asc(hwQuestion.position)).limit(1),
    ]);
    const newAssignmentId = newId();
    const newQuestionId = newId();
    await tx.insert(hwAssignment).values({
      id: newAssignmentId, organizationId: PRACTICE_ORG_ID, classId: a.classId, sectionId: a.sectionId, subject: a.subject,
      title: a.title, instructions: a.instructions, dueAt: null, allowedModes: a.allowedModes, createdBy: userId,
    });
    await tx.insert(hwQuestion).values({
      id: newQuestionId, organizationId: PRACTICE_ORG_ID, assignmentId: newAssignmentId, position: 0, type: q.type, prompt: q.prompt, marks: q.marks,
      modelAnswer: q.modelAnswer, acceptedAnswers: q.acceptedAnswers, languageHint: q.languageHint, answerLines: q.answerLines,
      schemeSource: q.schemeSource, origin: q.origin, originRef: q.originRef, passage: q.passage, rubricMode: q.rubricMode, activeKeyId: q.activeKeyId,
    });
    const items = await tx.select().from(hwRubricItem).where(and(eq(hwRubricItem.questionId, q.id), isNull(hwRubricItem.retiredAt))).orderBy(asc(hwRubricItem.position));
    if (items.length) {
      await tx.insert(hwRubricItem).values(items.map((it) => ({
        id: newId(), organizationId: PRACTICE_ORG_ID, questionId: newQuestionId, position: it.position, kind: it.kind, description: it.description,
        marks: it.marks, source: it.source,
      })));
    }
    // no usable key to carry over (it failed or never came): build one for the new attempt, as for a first attempt
    if (q.rubricMode === 'key' && !q.activeKeyId) {
      const [row] = await tx.select().from(hwQuestion).where(eq(hwQuestion.id, newQuestionId)).limit(1);
      await queueKey(tx, row, userId);
    }
    await tx.update(hwAssignment).set({ status: 'published' }).where(eq(hwAssignment.id, newAssignmentId));
    return { assignmentId: newAssignmentId, reused: false };
  });
}
