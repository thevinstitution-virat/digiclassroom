// A small Postgres-backed job queue on hw_ai_job. No Redis: claims use
// SELECT ... FOR UPDATE SKIP LOCKED, so several workers (or overlapping cron runs) never
// take the same job.
//
// Lifecycle: queued -> running -> done | failed, with batch_pending in between for Batch API
// jobs. A failure retries with backoff until max_attempts, then stays failed with its error,
// which teachers and admins see.

import { and, eq, inArray, lte, sql } from 'drizzle-orm';
import { hwAiJob, type HwJobKind } from '@/db/hw-schema';
import { describeError, isHwError } from '../errors';
import { db, newId, type Exec } from '../db';
import { currentProvider, providerFor } from '../ai';
import { getHwConfig } from '../config';

export type JobRow = typeof hwAiJob.$inferSelect;

/** Small JSON stored in payload_ref: what this job covers. */
export interface ReadPayload {
  tier: 1 | 2;
  /** Only these answers; omitted = every pending ink/photo answer of the submission. */
  answerIds?: string[];
  /** HW_HOMEWORK_BATCH_ENABLED: the latest time the batch may take (ISO). */
  readyBy?: string;
  /** HW_HOMEWORK_BATCH_ENABLED: when the batch was submitted, and how it ended (see stampPayload). */
  submittedAt?: string;
  completedAt?: string;
  turnaroundSeconds?: number;
  batchOutcome?: 'completed' | 'failed' | 'overdue';
  /** HW_HOMEWORK_BATCH_ENABLED: a batch failed or ran out of time; run on the standard path, never batch again. */
  standard?: boolean;
  fallbackReason?: string;
}

export interface GradePayload {
  rubricVersion: number;
  chunks: string[][];
  /** HW_DEDUPE_MARKING_ENABLED: representative answer id -> later answers with the same transcript, marked from its suggestion. */
  followers?: Record<string, string[]>;
  /** HW_DEDUPE_MARKING_ENABLED: key version hash at the time of the request. */
  keyHash?: string;
  /** HW_HOMEWORK_BATCH_ENABLED, as for ReadPayload. */
  readyBy?: string;
  submittedAt?: string;
  completedAt?: string;
  turnaroundSeconds?: number;
  batchOutcome?: 'completed' | 'failed' | 'overdue';
  standard?: boolean;
  fallbackReason?: string;
}

export function payloadOf<T>(job: JobRow): T | null {
  if (!job.payloadRef) return null;
  try {
    return JSON.parse(job.payloadRef) as T;
  } catch {
    return null;
  }
}

export async function enqueueRead(x: Exec, orgId: string, submissionId: string, payload: ReadPayload): Promise<string> {
  const id = newId();
  await x.insert(hwAiJob).values({
    id, organizationId: orgId, kind: 'read', submissionId, payloadRef: JSON.stringify(payload), provider: providerFor(payload.tier === 2 ? 'escalate' : 'read'),
  });
  return id;
}

/**
 * One queued grade job per question at a time. A new answer that becomes gradable while a
 * job is already queued is picked up by that job; the delay lets a class's submissions
 * accumulate so they are marked together.
 */
export async function enqueueGrade(x: Exec, orgId: string, questionId: string, delaySeconds: number, opts: { standard?: { reason: string } } = {}): Promise<void> {
  await x.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'hw-grade:' + questionId}))`);
  const [existing] = await x.select({ id: hwAiJob.id }).from(hwAiJob)
    .where(and(eq(hwAiJob.kind, 'grade'), eq(hwAiJob.questionId, questionId), eq(hwAiJob.status, 'queued')))
    .limit(1);
  // A fallback must not be swallowed by a job that would batch again: it makes that job standard.
  const payloadRef = opts.standard ? JSON.stringify({ standard: true, fallbackReason: opts.standard.reason }) : undefined;
  if (existing) {
    if (payloadRef) await x.update(hwAiJob).set({ payloadRef, error: opts.standard!.reason }).where(eq(hwAiJob.id, existing.id));
    return;
  }
  await x.insert(hwAiJob).values({
    id: newId(), organizationId: orgId, kind: 'grade', questionId, provider: providerFor('grade'),
    runAfter: sql`now() + make_interval(secs => ${delaySeconds})`,
    ...(payloadRef ? { payloadRef, error: opts.standard!.reason } : {}),
  });
}

/** Claim up to `limit` ready jobs of one kind. */
/** Only this worker's institutions when HW_JOB_ORG_PREFIX is set (tests); every job otherwise. */
function ownJobs() {
  const p = getHwConfig().HW_JOB_ORG_PREFIX;
  return p ? sql`starts_with(organization_id, ${p}::text)` : sql`true`;
}

export async function claim(kind: HwJobKind, limit: number, workerId: string, filter?: (j: JobRow) => boolean): Promise<JobRow[]> {
  const rows = await db.execute<{ id: string }>(sql`
    UPDATE hw_ai_job SET status = 'running', locked_at = now(), locked_by = ${workerId},
           attempts = attempts + 1, started_at = COALESCE(started_at, now())
     WHERE id IN (
       SELECT id FROM hw_ai_job
        WHERE status = 'queued' AND kind = ${kind} AND run_after <= now() AND ${ownJobs()}
        ORDER BY created_at
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED)
    RETURNING id`);
  const ids = rows.rows.map((r) => r.id);
  if (!ids.length) return [];
  const jobs = await db.select().from(hwAiJob).where(inArray(hwAiJob.id, ids));
  return filter ? jobs.filter(filter) : jobs;
}

/**
 * Claim batch jobs due for a poll; pushing run_after forward keeps other workers off them. `scope` keeps one institution's batches apart:
 * exam booklets are read in batches of their own (exams/evaluate.ts), which the homework read poller must not take.
 */
export async function claimBatchPending(kind: HwJobKind, limit: number, workerId: string, pollSeconds: number, scope: { orgId?: string; notOrgId?: string } = {}): Promise<JobRow[]> {
  const only = scope.orgId ? sql`organization_id = ${scope.orgId}` : sql`true`;
  const not = scope.notOrgId ? sql`organization_id <> ${scope.notOrgId}` : sql`true`;
  const rows = await db.execute<{ id: string }>(sql`
    UPDATE hw_ai_job SET locked_at = now(), locked_by = ${workerId},
           run_after = now() + make_interval(secs => ${pollSeconds})
     WHERE id IN (
       SELECT id FROM hw_ai_job
        WHERE status = 'batch_pending' AND kind = ${kind} AND run_after <= now() AND ${ownJobs()} AND ${only} AND ${not}
        ORDER BY created_at
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED)
    RETURNING id`);
  const ids = rows.rows.map((r) => r.id);
  return ids.length ? db.select().from(hwAiJob).where(inArray(hwAiJob.id, ids)) : [];
}

export async function markBatchPending(x: Exec, jobId: string, batchRef: string, model: string, payload?: unknown, pollSeconds = 60, provider: string = currentProvider()): Promise<void> {
  await x.update(hwAiJob).set({
    status: 'batch_pending', batchRef, model, provider, lockedAt: null, lockedBy: null,
    runAfter: sql`now() + make_interval(secs => ${pollSeconds})`,
    ...(payload !== undefined ? { payloadRef: JSON.stringify(payload) } : {}),
  }).where(eq(hwAiJob.id, jobId));
}

/** `note` is kept in `error` even on success, e.g. "price missing for model X". */
export async function complete(x: Exec, jobId: string, model?: string, note?: string): Promise<void> {
  await x.update(hwAiJob).set({
    status: 'done', finishedAt: new Date(), lockedAt: null, lockedBy: null,
    ...(model ? { model } : {}), error: note ?? null,
  }).where(eq(hwAiJob.id, jobId));
}

/** Only provider failures are retried: unusable output or missing configuration would fail the same way again. */
export function isRetryable(e: unknown): boolean {
  if (isHwError(e)) return e.code === 'PROVIDER_ERROR';
  return true;
}

export function backoffSeconds(attempts: number): number {
  return 30 * 2 ** Math.max(0, attempts - 1);
}

/** Returns true when the job is now permanently failed. */
export async function fail(x: Exec, job: JobRow, e: unknown): Promise<boolean> {
  const error = describeError(e);
  const final = !isRetryable(e) || job.attempts >= job.maxAttempts;
  await x.update(hwAiJob).set(final
    ? { status: 'failed', error, finishedAt: new Date(), lockedAt: null, lockedBy: null }
    : {
      status: 'queued', error, batchRef: null, lockedAt: null, lockedBy: null,
      runAfter: sql`now() + make_interval(secs => ${backoffSeconds(job.attempts)})`,
    }).where(eq(hwAiJob.id, job.id));
  return final;
}

/** Jobs left running by a crashed worker go back to the queue (their attempt still counts). */
export async function recoverStale(staleMinutes: number): Promise<number> {
  const res = await db.update(hwAiJob)
    .set({ status: 'queued', lockedAt: null, lockedBy: null, error: 'worker stopped mid-job; retrying' })
    .where(and(eq(hwAiJob.status, 'running'), lte(hwAiJob.lockedAt, sql`now() - make_interval(mins => ${staleMinutes})`)))
    .returning({ id: hwAiJob.id });
  return res.length;
}
