// Read jobs: turn a submission's ink renders into transcripts.
//
// Tier 1 goes through the Batch API when HW_BATCH_ENABLED (half price, slower): several
// submissions' requests share one provider batch, one request per submission. Tier 2
// (escalation of single doubtful answers) always runs synchronously.

import { and, eq, inArray } from 'drizzle-orm';
import { hwAnswer, hwQuestion } from '@/db/hw-schema';
import { getHwConfig } from '../config';
import { describeError, HwError } from '../errors';
import { db, type Exec } from '../db';
import { quotaAllows, quotaRefusal, quotaState } from '../cost/quota';
import { recordUsage } from '../cost/usage';
import { createBatch, parseResponse, pollBatch, usageFromError, type BatchItem } from '../gemini/client';
import { decideAfterRead, type EscalationPolicy } from '../reader/escalation';
import { readCall, readerForTier } from '../reader/gemini-reader';
import { parseReadOutput } from '../reader/parse';
import type { ReadAnswerResult, ReadInput } from '../reader/types';
import { getHwObject } from '../storage/r2';
import { failAnswers, finishSubmissionIfRead, setTranscript } from '../pipeline';
import { claim, claimBatchPending, complete, enqueueRead, fail, markBatchPending, payloadOf, type JobRow, type ReadPayload } from './queue';

interface PreparedRead {
  job: JobRow;
  tier: 1 | 2;
  input: ReadInput;
  bytes: number;
}

const policy = (): EscalationPolicy => ({
  escalateBelow: getHwConfig().HW_READ_ESCALATE_BELOW,
  unclearAbove: getHwConfig().HW_UNCLEAR_ESCALATE_ABOVE,
});

/** Load what a read job covers. Returns null (and settles the job) when there is nothing to send. */
async function prepare(job: JobRow): Promise<PreparedRead | null> {
  const payload = payloadOf<ReadPayload>(job) ?? { tier: 1 };
  const where = payload.answerIds?.length
    ? and(eq(hwAnswer.submissionId, job.submissionId!), inArray(hwAnswer.id, payload.answerIds))
    : and(eq(hwAnswer.submissionId, job.submissionId!), inArray(hwAnswer.mode, ['ink', 'photo']));
  const rows = await db.select({ id: hwAnswer.id, renderKey: hwAnswer.renderKey, imageKey: hwAnswer.imageKey, status: hwAnswer.transcriptStatus, lang: hwQuestion.languageHint })
    .from(hwAnswer).innerJoin(hwQuestion, eq(hwQuestion.id, hwAnswer.questionId))
    .where(where);
  const pending = rows.filter((r) => r.status === 'pending');

  if (!pending.length) {
    await db.transaction(async (tx) => {
      await complete(tx, job.id, undefined, 'nothing left to read');
      await finishSubmissionIfRead(tx, job.submissionId!);
    });
    return null;
  }

  const state = await quotaState(db, job.organizationId, 'read');
  if (!quotaAllows(state, pending.length)) {
    await db.transaction(async (tx) => {
      await failAnswers(tx, pending.map((p) => p.id), quotaRefusal(state), 'needs_review');
      await complete(tx, job.id, undefined, `not read: ${quotaRefusal(state)}`);
      await finishSubmissionIfRead(tx, job.submissionId!);
    });
    return null;
  }

  const noImage = pending.filter((p) => !(p.renderKey ?? p.imageKey));
  if (noImage.length) {
    await db.transaction(async (tx) => {
      await failAnswers(tx, noImage.map((p) => p.id), 'No handwriting image was uploaded for this answer.', 'needs_review');
    });
  }
  const readable = pending.filter((p) => p.renderKey ?? p.imageKey);
  if (!readable.length) {
    await db.transaction(async (tx) => {
      await complete(tx, job.id, undefined, 'no images to read');
      await finishSubmissionIfRead(tx, job.submissionId!);
    });
    return null;
  }

  const answers = await Promise.all(readable.map(async (r) => ({
    answerId: r.id,
    languageHint: r.lang,
    png: await getHwObject((r.renderKey ?? r.imageKey)!),
  })));
  return { job, tier: payload.tier, input: { answers }, bytes: answers.reduce((s, a) => s + a.png.length, 0) };
}

type ReadJobRef = Pick<PreparedRead, 'job' | 'tier'>;

/** Save one read's results and decide what happens to each answer. */
async function applyRead(p: ReadJobRef, results: ReadAnswerResult[], model: string, usage: Parameters<typeof recordUsage>[1]['usage'], batch: boolean): Promise<void> {
  const escalate: string[] = [];
  await db.transaction(async (tx) => {
    const note = await recordUsage(tx, { jobId: p.job.id, orgId: p.job.organizationId, model, usage, batch, pagesRead: results.length });
    const engine = `gemini:${model}`;
    for (const r of results) {
      const d = decideAfterRead(r, p.tier, policy());
      const answer = { id: r.answerId, organizationId: p.job.organizationId };
      if (d.action === 'escalate') {
        // Keep the tier 1 text in history; the answer stays pending until tier 2 decides.
        await tx.update(hwAnswer).set({ transcript: r.text, unclearCount: r.unclearCount, transcriptConfidence: String(r.confidence), readerEngine: engine, readerTier: p.tier })
          .where(eq(hwAnswer.id, r.answerId));
        escalate.push(r.answerId);
        continue;
      }
      await setTranscript(tx, answer, {
        text: r.text,
        status: d.action === 'accept' ? 'done' : 'needs_review',
        source: 'reader',
        confidence: r.confidence,
        unclearCount: r.unclearCount,
        engine,
        tier: p.tier,
        reason: d.action === 'needs_review' ? d.reason : null,
      });
    }
    if (escalate.length) await enqueueRead(tx, p.job.organizationId, p.job.submissionId!, { tier: 2, answerIds: escalate });
    await complete(tx, p.job.id, model, note);
    if (!escalate.length) await finishSubmissionIfRead(tx, p.job.submissionId!);
  });
}

/** A read job that will not be retried: its answers go to the teacher, visibly. */
async function settleFailure(job: JobRow, e: unknown): Promise<void> {
  const billed = usageFromError(e);
  await db.transaction(async (tx) => {
    if (billed) await recordUsage(tx, { jobId: job.id, orgId: job.organizationId, model: billed.model, usage: billed.usage, batch: false });
    const final = await fail(tx, job, e);
    if (!final) return;
    const payload = payloadOf<ReadPayload>(job);
    const where = payload?.answerIds?.length
      ? inArray(hwAnswer.id, payload.answerIds)
      : and(eq(hwAnswer.submissionId, job.submissionId!), eq(hwAnswer.transcriptStatus, 'pending'));
    const ids = (await tx.select({ id: hwAnswer.id }).from(hwAnswer).where(where)).map((r) => r.id);
    await failAnswers(tx, ids, `Reading failed (${describeError(e)}). Please read the original.`);
    await finishSubmissionIfRead(tx, job.submissionId!);
  });
}

async function runSync(p: PreparedRead): Promise<void> {
  try {
    const res = await readerForTier(p.tier).read(p.input);
    await applyRead(p, res.answers, res.model, res.usage, false);
  } catch (e) {
    await settleFailure(p.job, e);
  }
}

/** Queued read jobs. Returns how many were taken. */
export async function runReadJobs(workerId: string, deadline: number): Promise<number> {
  const cfg = getHwConfig();
  let taken = 0;
  const batchGroup: PreparedRead[] = [];
  let batchBytes = 0;

  while (Date.now() < deadline) {
    const [job] = await claim('read', 1, workerId);
    if (!job) break;
    taken++;
    let p: PreparedRead | null;
    try {
      p = await prepare(job);
    } catch (e) {
      await settleFailure(job, e);
      continue;
    }
    if (!p) continue;

    if (p.tier === 2 || !cfg.HW_BATCH_ENABLED) {
      await runSync(p);
      continue;
    }
    batchGroup.push(p);
    batchBytes += p.bytes;
    if (batchBytes >= cfg.HW_BATCH_MAX_BYTES * 0.75) break;
  }

  if (batchGroup.length) await submitReadBatch(batchGroup);
  return taken;
}

async function submitReadBatch(group: PreparedRead[]): Promise<void> {
  const model = readerForTier(1).model;
  const items: BatchItem[] = group.map((p) => ({ key: p.job.id, call: readCall(model, p.input) }));
  try {
    const name = await createBatch(items, `hw-read-${new Date().toISOString()}`);
    await db.transaction(async (tx) => {
      for (const p of group) {
        // Record exactly which answers were sent, so results apply without re-reading anything.
        const sent: ReadPayload = { tier: 1, answerIds: p.input.answers.map((a) => a.answerId) };
        await markBatchPending(tx, p.job.id, name, model, sent, getHwConfig().HW_BATCH_POLL_SECONDS);
      }
    });
  } catch (e) {
    for (const p of group) await settleFailure(p.job, e);
  }
}

/** Poll provider batches for read jobs and apply finished ones. */
export async function pollReadBatches(workerId: string): Promise<number> {
  const jobs = await claimBatchPending('read', 50, workerId, getHwConfig().HW_BATCH_POLL_SECONDS);
  const byBatch = new Map<string, JobRow[]>();
  for (const j of jobs) {
    if (!j.batchRef) {
      await settleFailure(j, new HwError('PROVIDER_ERROR', 'Batch reference lost.', 'batch_pending job without batch_ref'));
      continue;
    }
    byBatch.set(j.batchRef, [...(byBatch.get(j.batchRef) ?? []), j]);
  }

  for (const [name, group] of byBatch) {
    let outcome;
    try {
      outcome = await pollBatch(name);
    } catch (e) {
      console.error(`[hw] polling ${name} failed: ${describeError(e)}`);
      continue; // run_after was pushed forward; try again next poll
    }
    if (outcome.state === 'pending') continue;
    if (outcome.state === 'failed') {
      for (const j of group) await settleFailure(j, new HwError('PROVIDER_ERROR', 'The AI batch failed.', outcome.reason));
      continue;
    }
    for (const j of group) {
      const res = outcome.results.get(j.id);
      if (!res || 'error' in res) {
        await settleFailure(j, new HwError('PROVIDER_ERROR', 'The AI could not read this submission.', res ? res.error : 'no result in batch'));
        continue;
      }
      try {
        const sent = payloadOf<ReadPayload>(j)?.answerIds;
        if (!sent?.length) throw new HwError('PROVIDER_ERROR', 'Batch job lost track of its answers.', 'batch_pending read job without answerIds');
        const parsed = parseResponse(res, j.model ?? 'unknown');
        const results = parseReadOutput(parsed.json, sent);
        await applyRead({ job: j, tier: 1 }, results, parsed.model, parsed.usage, true);
      } catch (e) {
        await settleFailure(j, e);
      }
    }
  }
  return jobs.length;
}

/** Used by the submit endpoint inside its transaction. */
export async function queueSubmissionRead(x: Exec, orgId: string, submissionId: string): Promise<string> {
  return enqueueRead(x, orgId, submissionId, { tier: 1 });
}
