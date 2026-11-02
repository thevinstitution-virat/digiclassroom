// Homework through the provider's batch API (HW_HOMEWORK_BATCH_ENABLED).
//
// What this adds to the batch path that already exists:
//   - Only homework is batched. Work the teacher is waiting on (due very soon, or already past
//     due) stays on the standard path, and so does anything the provider cannot batch.
//   - Every batch carries a "ready by" time, shown to the teacher.
//   - A batch that fails, errors for a request, or is not finished by its "ready by" time is
//     re-run on the standard path, with the reason recorded and shown. It never fails silently
//     and never waits for ever.
//
// Pure rules are separate from the database functions so the rules are tested exactly.

import { and, eq, inArray, sql } from 'drizzle-orm';
import { hwAiJob } from '@/db/hw-schema';
import { getHwConfig } from '../config';
import type { Exec } from '../db';

/** The teacher is waiting if the work is due within `urgentHours`, or is already past due. No due date = homework. */
export function isUrgent(dueAt: Date | null, now: Date, urgentHours: number): boolean {
  if (!dueAt) return false;
  return dueAt.getTime() - now.getTime() < urgentHours * 3_600_000;
}

export const readyBy = (now: Date, deadlineHours: number): Date => new Date(now.getTime() + deadlineHours * 3_600_000);

export const isOverdue = (readyByIso: string | undefined, now: Date): boolean => Boolean(readyByIso) && now.getTime() > Date.parse(readyByIso!);

export type BatchDecision = { batch: true } | { batch: false; reason: string | null };

/** Should this piece of work go to the batch API? `reason` explains a standard-path choice the teacher should know about. */
export function decideBatch(input: { standardForced: boolean; fallbackReason?: string; providerCanBatch: boolean; dueAt: Date | null; now: Date; urgentHours: number }): BatchDecision {
  if (input.standardForced) return { batch: false, reason: input.fallbackReason ?? 'run on the standard path' };
  if (!input.providerCanBatch) return { batch: false, reason: 'the AI provider cannot batch this kind of work; run on the standard path' };
  if (isUrgent(input.dueAt, input.now, input.urgentHours)) return { batch: false, reason: 'due soon or past due; run on the standard path so it is ready quickly' };
  return { batch: true };
}

export const FALLBACK_PREFIX = 'Re-run on the standard path';
export const fallbackNote = (reason: string): string => `${FALLBACK_PREFIX}: ${reason}`;

/** Due date of the assignment a read job (by submission) or grade job (by question) belongs to. */
export async function dueFor(x: Exec, ref: { submissionId?: string | null; questionId?: string | null }): Promise<Date | null> {
  if (ref.submissionId) {
    const r = await x.execute<{ due_at: Date | null }>(sql`SELECT a.due_at FROM hw_submission s JOIN hw_assignment a ON a.id = s.assignment_id WHERE s.id = ${ref.submissionId}`);
    return r.rows[0]?.due_at ? new Date(r.rows[0].due_at) : null;
  }
  if (ref.questionId) {
    const r = await x.execute<{ due_at: Date | null }>(sql`SELECT a.due_at FROM hw_question q JOIN hw_assignment a ON a.id = q.assignment_id WHERE q.id = ${ref.questionId}`);
    return r.rows[0]?.due_at ? new Date(r.rows[0].due_at) : null;
  }
  return null;
}

/**
 * Put a batch job back on the queue to run on the standard path. The reason is kept in `error`
 * (which teachers and admins see) even though the job has not failed. `attempts` is not reset, so
 * a standard run that keeps failing still ends as a visible failure.
 */
export async function requeueStandard(x: Exec, jobId: string, payload: object, reason: string): Promise<void> {
  await x.update(hwAiJob).set({
    status: 'queued', batchRef: null, lockedAt: null, lockedBy: null, runAfter: sql`now()`,
    payloadRef: JSON.stringify({ ...payload, standard: true, fallbackReason: fallbackNote(reason) }),
    error: fallbackNote(reason),
  }).where(eq(hwAiJob.id, jobId));
}

// ── What the teacher sees ────────────────────────────────────────────────────────────────

export interface AiWorkStatus {
  /** 'idle': nothing in flight. 'working': on the standard path. 'waiting_for_batch': batched, ready by `readyBy`. */
  state: 'idle' | 'working' | 'waiting_for_batch';
  /** Latest "ready by" among the batches in flight (ISO). */
  readyBy: string | null;
  batches: number;
  /** Why work was re-run on the standard path, newest first. Empty when nothing fell back. */
  fallbacks: string[];
}

export interface JobSummary { status: string; error: string | null; payloadRef: string | null }

export function summariseStatus(jobs: readonly JobSummary[]): AiWorkStatus {
  const inFlight = jobs.filter((j) => j.status === 'queued' || j.status === 'running' || j.status === 'batch_pending');
  const waiting = jobs.filter((j) => j.status === 'batch_pending');
  const readyByList = waiting.map((j) => { try { return (JSON.parse(j.payloadRef ?? '{}') as { readyBy?: string }).readyBy ?? null; } catch { return null; } }).filter((x): x is string => Boolean(x));
  const fallbacks = [...new Set(jobs.map((j) => j.error).filter((e): e is string => Boolean(e) && e!.startsWith(FALLBACK_PREFIX)))];
  return {
    state: waiting.length ? 'waiting_for_batch' : inFlight.length ? 'working' : 'idle',
    readyBy: readyByList.length ? readyByList.sort().at(-1)! : null,
    batches: waiting.length,
    fallbacks,
  };
}

/** The AI work in flight for one assignment (reads by submission, marking by question). */
export async function aiWorkStatus(x: Exec, orgId: string, assignmentId: string): Promise<AiWorkStatus> {
  const rows = await x.select({ status: hwAiJob.status, error: hwAiJob.error, payloadRef: hwAiJob.payloadRef })
    .from(hwAiJob)
    .where(and(
      eq(hwAiJob.organizationId, orgId),
      inArray(hwAiJob.status, ['queued', 'running', 'batch_pending', 'done']),
      sql`(${hwAiJob.submissionId} IN (SELECT id FROM hw_submission WHERE assignment_id = ${assignmentId})
           OR ${hwAiJob.questionId} IN (SELECT id FROM hw_question WHERE assignment_id = ${assignmentId}))`,
    ))
    .limit(500);
  return summariseStatus(rows);
}

export const homeworkBatchSettings = () => {
  const c = getHwConfig();
  return { enabled: c.HW_HOMEWORK_BATCH_ENABLED, deadlineHours: c.HW_HOMEWORK_BATCH_DEADLINE_HOURS, urgentHours: c.HW_HOMEWORK_URGENT_HOURS };
};
