// Grade jobs: AI suggestions for one question across the class, in chunks of
// HW_GRADE_BATCH_SIZE answers. Results go to hw_ai_grade ONLY; final grades are written by
// teacher actions in services/marking.ts and nowhere else.

import { inArray } from 'drizzle-orm';
import { hwAnswer } from '@/db/hw-schema';
import { getHwConfig, requireModel } from '../config';
import { describeError, HwError } from '../errors';
import { db } from '../db';
import { quotaAllows, quotaRefusal, quotaState } from '../cost/quota';
import { recordUsage } from '../cost/usage';
import { createBatch, generate, pollBatch, usageFromError, type AiResult } from '../ai';
import { gradeCall, gradeResultsFrom } from '../grader/ai-grader';
import type { GradeInput, GradeQuestion } from '../grader/types';
import { answersNeedingSuggestion, gradeByRules, insertAiGrades, loadGradeQuestion } from '../pipeline';
import { claim, claimBatchPending, complete, enqueueGrade, fail, markBatchPending, payloadOf, type GradePayload, type JobRow } from './queue';

function chunk<T>(xs: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}

/** Answers' current transcripts, re-read at apply time (they may have been fixed meanwhile). */
async function inputsFor(q: GradeQuestion, answerIds: string[]): Promise<GradeInput> {
  const rows = await db.select({ id: hwAnswer.id, transcript: hwAnswer.transcript }).from(hwAnswer).where(inArray(hwAnswer.id, answerIds));
  const byId = new Map(rows.map((r) => [r.id, r.transcript ?? '']));
  return { question: q, answers: answerIds.filter((id) => byId.has(id)).map((id) => ({ answerId: id, transcript: byId.get(id)! })) };
}

async function settleFailure(job: JobRow, e: unknown): Promise<void> {
  const billed = usageFromError(e);
  await db.transaction(async (tx) => {
    if (billed) await recordUsage(tx, { jobId: job.id, orgId: job.organizationId, model: billed.model, usage: billed.usage, costUsd: billed.costUsd, batch: false });
    await fail(tx, job, e);
  });
}

/** Rules first, then quota, then chunks. Returns the work left for AI, or null when the job is settled. */
async function plan(job: JobRow): Promise<{ q: GradeQuestion; chunks: string[][] } | null> {
  const q = await loadGradeQuestion(db, job.questionId!);
  if (!q) {
    await complete(db, job.id, undefined, 'question no longer exists');
    return null;
  }
  if (!q.rubric.length) {
    await complete(db, job.id, undefined, 'no marking scheme: answers wait for the teacher');
    return null;
  }
  await db.transaction((tx) => gradeByRules(tx, job.organizationId, q).then(() => undefined));
  const pending = await answersNeedingSuggestion(db, q);
  if (!pending.length) {
    await complete(db, job.id, undefined, 'nothing left to mark');
    return null;
  }
  const state = await quotaState(db, job.organizationId, 'grade');
  if (!quotaAllows(state, pending.length)) {
    const reason = quotaRefusal(state);
    await db.transaction(async (tx) => {
      await tx.update(hwAnswer).set({ failureReason: reason }).where(inArray(hwAnswer.id, pending.map((p) => p.answerId)));
      await complete(tx, job.id, undefined, `not marked: ${reason}`);
    });
    return null;
  }
  return { q, chunks: chunk(pending.map((p) => p.answerId), getHwConfig().HW_GRADE_BATCH_SIZE) };
}

/**
 * Save one chunk's suggestions. If the rubric changed after the request was made, the
 * suggestions are discarded and the answers are marked again against the new rubric.
 */
async function applyChunk(job: JobRow, requestedVersion: number, input: GradeInput, res: AiResult, batch: boolean): Promise<string | undefined> {
  const current = await loadGradeQuestion(db, input.question.id);
  return db.transaction(async (tx) => {
    const note = await recordUsage(tx, { jobId: job.id, orgId: job.organizationId, model: res.model, usage: res.usage, costUsd: res.costUsd, batch, answersGraded: input.answers.length });
    if (!current || current.rubricVersion !== requestedVersion) {
      if (current) await enqueueGrade(tx, job.organizationId, current.id, 0);
      return 'rubric changed while marking; suggestions discarded and re-queued';
    }
    const results = gradeResultsFrom(res, input);
    await insertAiGrades(tx, job.organizationId, job.id, results);
    return note;
  });
}

async function runSync(job: JobRow, q: GradeQuestion, chunks: string[][]): Promise<void> {
  const model = requireModel('grade');
  const notes: string[] = [];
  let failedChunks = 0;
  for (const ids of chunks) {
    const input = await inputsFor(q, ids);
    if (!input.answers.length) continue;
    try {
      const res = await generate(gradeCall(model, input));
      const note = await applyChunk(job, q.rubricVersion, input, res, false);
      if (note) notes.push(note);
    } catch (e) {
      const billed = usageFromError(e);
      if (billed) await recordUsage(db, { jobId: job.id, orgId: job.organizationId, model: billed.model, usage: billed.usage, costUsd: billed.costUsd, batch: false });
      // Other chunks still count; this chunk's answers stay unmarked and are picked up again.
      failedChunks++;
      notes.push(`a chunk of ${ids.length} failed: ${describeError(e)}`);
      await db.transaction((tx) => enqueueGrade(tx, job.organizationId, q.id, getHwConfig().HW_GRADE_DEBOUNCE_SECONDS));
    }
  }
  if (failedChunks > 0 && failedChunks === chunks.length) {
    await settleFailure(job, new HwError('PROVIDER_ERROR', 'AI marking failed.', notes.join(' | ')));
    return;
  }
  await complete(db, job.id, model, notes.length ? notes.join(' | ') : undefined);
}

export async function runGradeJobs(workerId: string, deadline: number): Promise<number> {
  const cfg = getHwConfig();
  let taken = 0;
  while (Date.now() < deadline) {
    const [job] = await claim('grade', 1, workerId);
    if (!job) break;
    taken++;
    try {
      const p = await plan(job);
      if (!p) continue;
      if (!cfg.HW_BATCH_ENABLED) {
        await runSync(job, p.q, p.chunks);
        continue;
      }
      const model = requireModel('grade');
      const items = await Promise.all(p.chunks.map(async (ids, i) => ({ key: `${job.id}:${i}`, call: gradeCall(model, await inputsFor(p.q, ids)) })));
      const name = await createBatch(items, `hw-grade-${job.id}`);
      const payload: GradePayload = { rubricVersion: p.q.rubricVersion, chunks: p.chunks };
      await markBatchPending(db, job.id, name, model, payload, cfg.HW_BATCH_POLL_SECONDS);
    } catch (e) {
      await settleFailure(job, e);
    }
  }
  return taken;
}

export async function pollGradeBatches(workerId: string): Promise<number> {
  const jobs = await claimBatchPending('grade', 20, workerId, getHwConfig().HW_BATCH_POLL_SECONDS);
  for (const job of jobs) {
    const payload = payloadOf<GradePayload>(job);
    if (!job.batchRef || !payload) {
      await settleFailure(job, new HwError('PROVIDER_ERROR', 'Batch job lost track of its answers.', 'grade batch job without batch_ref or payload'));
      continue;
    }
    let outcome;
    try {
      outcome = await pollBatch(job.provider, job.batchRef, job.model ?? 'unknown');
    } catch (e) {
      console.error(`[hw] polling ${job.batchRef} failed: ${describeError(e)}`);
      continue;
    }
    if (outcome.state === 'pending') continue;
    if (outcome.state === 'failed') {
      await settleFailure(job, new HwError('PROVIDER_ERROR', 'The AI batch failed.', outcome.reason));
      continue;
    }

    const q = await loadGradeQuestion(db, job.questionId!);
    const notes: string[] = [];
    let failedChunks = 0;
    for (let i = 0; i < payload.chunks.length; i++) {
      const entry = outcome.results.get(`${job.id}:${i}`);
      if (!q) break;
      if (!entry) {
        failedChunks++;
        notes.push(`chunk ${i} failed: no result`);
        continue;
      }
      try {
        if (!entry.ok) throw entry.error;
        const input = await inputsFor({ ...q, rubricVersion: payload.rubricVersion }, payload.chunks[i]);
        const note = await applyChunk(job, payload.rubricVersion, input, entry.result, true);
        if (note) notes.push(note);
      } catch (e) {
        const billed = usageFromError(e);
        if (billed) await recordUsage(db, { jobId: job.id, orgId: job.organizationId, model: billed.model, usage: billed.usage, costUsd: billed.costUsd, batch: true });
        failedChunks++;
        notes.push(`chunk ${i} failed: ${describeError(e)}`);
      }
    }
    if (failedChunks && q) await db.transaction((tx) => enqueueGrade(tx, job.organizationId, q.id, getHwConfig().HW_GRADE_DEBOUNCE_SECONDS));
    if (q && failedChunks === payload.chunks.length) {
      await settleFailure(job, new HwError('PROVIDER_ERROR', 'AI marking failed.', notes.join(' | ')));
    } else {
      await complete(db, job.id, job.model ?? undefined, notes.length ? notes.join(' | ') : (q ? undefined : 'question no longer exists'));
    }
  }
  return jobs.length;
}
