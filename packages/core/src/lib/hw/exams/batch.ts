// Exam booklets through the provider's batch API (phase 5b, HW_EXAMS_BATCH_ENABLED): half price, in exchange for a "report ready by" time
// the learner sees. One promise per attempt (ready_by, migration 034), shared by the two batched steps: reading the booklet gets the first part
// of the window, marking the rest. A batch that fails, has a failed read, or is not done by its own deadline is re-run on the standard path with
// the reason recorded, so the promise is kept or the work is simply done sooner; it never waits for ever.

import { eq } from 'drizzle-orm';
import { hwQuestion } from '@/db/hw-schema';
import { hwExamAttempt } from '@/db/hw-exams-schema';
import type { Exec } from '../db';

export const EXAM_BATCH = {
  /** Reading may use this share of the window; marking gets what is left. */
  readShare: 0.6,
  /** Marking's batch must end this share of the window before the promise, to leave time for a standard re-run. */
  markMargin: 0.1,
  /** Less time than this left for a step: run it now instead of batching it. */
  minBatchMinutes: 60,
  /** OpenAI: 50,000 requests and 200 MB per batch file; kept well below. */
  maxRequests: 40_000,
  maxBytes: 150 * 1024 * 1024,
} as const;

const H = 3_600_000;

/** Reading a handed-in booklet: batch it (with its deadline and the promise) or read it now, and why. */
export function readingBatchPlan(input: { now: Date; windowHours: number; promisedBy: Date | null }):
  { mode: 'batch'; readyBy: Date; readBy: Date } | { mode: 'standard'; reason: string } {
  const readyBy = input.promisedBy ?? new Date(input.now.getTime() + input.windowHours * H);
  // reading ends by the earlier of: its share of a fresh window, or the promise less marking's share
  const readBy = new Date(Math.min(input.now.getTime() + EXAM_BATCH.readShare * input.windowHours * H, readyBy.getTime() - (1 - EXAM_BATCH.readShare) * input.windowHours * H));
  if (readBy.getTime() - input.now.getTime() < EXAM_BATCH.minBatchMinutes * 60_000) return { mode: 'standard', reason: 'too little time left before the promised report to wait for a batch' };
  return { mode: 'batch', readyBy, readBy };
}

/** Marking one question of a batched attempt: the batch must end a margin before the promise; too close, mark it now. */
export function markingBatchPlan(input: { now: Date; readyBy: Date | null; windowHours: number }): { batch: true; markBy: Date } | { batch: false; reason: string } {
  if (!input.readyBy) return { batch: false, reason: 'no promised time' };
  const markBy = new Date(input.readyBy.getTime() - EXAM_BATCH.markMargin * input.windowHours * H);
  if (markBy.getTime() - input.now.getTime() < EXAM_BATCH.minBatchMinutes * 60_000) return { batch: false, reason: 'too close to the promised report time to batch the marking' };
  return { batch: true, markBy };
}

/** Requests into batches that stay inside the provider's limits, in order. `sizes` are each request's size in bytes. */
export function chunkRequests(sizes: number[], limits: { maxRequests: number; maxBytes: number } = EXAM_BATCH): number[][] {
  const out: number[][] = [];
  let cur: number[] = [];
  let bytes = 0;
  sizes.forEach((s, i) => {
    if (cur.length && (cur.length >= limits.maxRequests || bytes + s > limits.maxBytes)) { out.push(cur); cur = []; bytes = 0; }
    cur.push(i);
    bytes += s;
  });
  if (cur.length) out.push(cur);
  return out;
}

/** A request's size in the batch file: its image as base64 plus the instructions and wrapping. */
export const requestBytes = (imageBytes: number) => Math.ceil(imageBytes / 3) * 4 + 8_192;

/** How a grade job of the exam space is to run: from the attempt its question belongs to. Null when the question is not an exam attempt's. */
export async function examMarkingMode(x: Exec, questionId: string, now: Date, cfg: { enabled: boolean; windowHours: number }):
  Promise<{ batch: true; markBy: Date } | { batch: false; reason: string | null } | null> {
  const [row] = await x.select({ mode: hwExamAttempt.evaluationMode, readyBy: hwExamAttempt.readyBy })
    .from(hwQuestion).innerJoin(hwExamAttempt, eq(hwExamAttempt.assignmentId, hwQuestion.assignmentId))
    .where(eq(hwQuestion.id, questionId)).limit(1);
  if (!row) return null;
  if (!cfg.enabled || row.mode !== 'batch') return { batch: false, reason: null };
  return markingBatchPlan({ now, readyBy: row.readyBy, windowHours: cfg.windowHours });
}
