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
import { practiceRefusals } from '../practice/trial';
import { createBatch, pollBatch, providerFor, readBatchSupported, routed, usageFromError, type AiResult, type BatchItem } from '../ai';
import { decideAfterRead, type EscalationPolicy } from '../reader/escalation';
import { readCall, readerForTier } from '../reader/gemini-reader';
import { parseReadOutput } from '../reader/parse';
import type { ReadAnswerResult, ReadInput } from '../reader/types';
import { getHwObject } from '../storage/r2';
import { answerImageKey } from '../storage/keys';
import { mimeOfKey } from '../photo/image';
import { failAnswers, finishSubmissionIfRead, setTranscript } from '../pipeline';
import { claim, claimBatchPending, complete, enqueueRead, fail, markBatchPending, payloadOf, type JobRow, type ReadPayload } from './queue';
import { shadowAfterRead } from '../shadow/shadow';
import { decideBatch, dueFor, homeworkBatchSettings, isOverdue, isSmallWork, readyBy, requeueStandard, saveStamp, stampPayload } from './homework-batch';
import { EXAM_ORG_ID } from '../exams/space';

interface PreparedRead {
  job: JobRow;
  tier: 1 | 2;
  input: ReadInput;
  bytes: number;
  /** HW_HOMEWORK_BATCH_ENABLED: why this ran on the standard path, when the teacher should know. */
  standardReason?: string;
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
  const rows = await db.select({ id: hwAnswer.id, mode: hwAnswer.mode, renderKey: hwAnswer.renderKey, imageKey: hwAnswer.imageKey, status: hwAnswer.transcriptStatus, lang: hwQuestion.languageHint })
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

  // Self-practice: a learner whose trial cannot pay for another step is not read. Nothing is refused outside the practice space.
  const trialRefused = await practiceRefusals(db, job.organizationId, pending.map((p) => p.id));
  if (trialRefused.size) {
    await db.transaction(async (tx) => {
      for (const msg of new Set(trialRefused.values())) {
        await failAnswers(tx, pending.filter((p) => trialRefused.get(p.id) === msg).map((p) => p.id), msg, 'needs_review');
      }
      if (pending.every((p) => trialRefused.has(p.id))) {
        await complete(tx, job.id, undefined, 'not read: the free trial cannot pay for another step');
        await finishSubmissionIfRead(tx, job.submissionId!);
      }
    });
    if (pending.every((p) => trialRefused.has(p.id))) return null;
    pending.splice(0, pending.length, ...pending.filter((p) => !trialRefused.has(p.id)));
  }

  const noImage = pending.filter((p) => !answerImageKey(p));
  if (noImage.length) {
    await db.transaction(async (tx) => {
      await failAnswers(tx, noImage.map((p) => p.id), 'No handwriting image was uploaded for this answer.', 'needs_review');
    });
  }
  const readable = pending.filter((p) => answerImageKey(p));
  if (!readable.length) {
    await db.transaction(async (tx) => {
      await complete(tx, job.id, undefined, 'no images to read');
      await finishSubmissionIfRead(tx, job.submissionId!);
    });
    return null;
  }

  const answers = await Promise.all(readable.map(async (r) => {
    const key = answerImageKey(r)!;
    // a photo is JPEG, PNG or WebP; the reader is told which
    return { answerId: r.id, languageHint: r.lang, png: await getHwObject(key), mimeType: mimeOfKey(key) };
  }));
  return { job, tier: payload.tier, input: { answers }, bytes: answers.reduce((s, a) => s + a.png.length, 0) };
}

type ReadJobRef = Pick<PreparedRead, 'job' | 'tier'> & { standardReason?: string };

/** Save one read's results and decide what happens to each answer. */
async function applyRead(p: ReadJobRef, results: ReadAnswerResult[], billing: Pick<AiResult, 'model' | 'usage' | 'costUsd'>, batch: boolean): Promise<void> {
  const escalate: string[] = [];
  const settled: string[] = [];
  const { model } = billing;
  await db.transaction(async (tx) => {
    const note = await recordUsage(tx, { jobId: p.job.id, orgId: p.job.organizationId, model, usage: billing.usage, costUsd: billing.costUsd, batch, pagesRead: results.length });
    const engine = `${p.job.provider ?? 'gemini'}:${model}`;
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
      settled.push(r.answerId);
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
    // A re-run on the standard path keeps its reason on the finished job, where the teacher can see it.
    const why = [payloadOf<ReadPayload>(p.job)?.fallbackReason, p.standardReason].filter(Boolean)[0];
    await complete(tx, p.job.id, model, [why, note].filter(Boolean).join(' | ') || undefined);
    if (!escalate.length) await finishSubmissionIfRead(tx, p.job.submissionId!);
  });
  // Production is committed; the candidate configuration may now read the same answers.
  await shadowAfterRead(p.job.organizationId, settled);
}

/** A read job that will not be retried: its answers go to the teacher, visibly. */
async function settleFailure(job: JobRow, e: unknown): Promise<void> {
  const billed = usageFromError(e);
  await db.transaction(async (tx) => {
    if (billed) await recordUsage(tx, { jobId: job.id, orgId: job.organizationId, model: billed.model, usage: billed.usage, costUsd: billed.costUsd, batch: false });
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
    await applyRead(p, res.answers, res, false);
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

    // A hand-in with only a few answers to read is read now: the learner is waiting, and batching it saves almost nothing.
    if (p.tier === 1 && isSmallWork(p.input.answers.length, cfg.HW_BATCH_SMALL_MAX) && (cfg.HW_HOMEWORK_BATCH_ENABLED || cfg.HW_BATCH_ENABLED)) {
      await runSync(p);
      continue;
    }

    if (cfg.HW_HOMEWORK_BATCH_ENABLED) {
      // Homework batches; urgent work, escalation, a fallback and anything the provider cannot batch stay standard.
      const payload = payloadOf<ReadPayload>(p.job);
      const s = homeworkBatchSettings();
      const d = decideBatch({
        standardForced: p.tier === 2 || Boolean(payload?.standard), fallbackReason: payload?.fallbackReason,
        providerCanBatch: readBatchSupported(providerFor('read')), dueAt: await dueFor(db, { submissionId: p.job.submissionId }), now: new Date(), urgentHours: s.urgentHours,
      });
      if (!d.batch) {
        if (p.tier === 1 && !payload?.standard && d.reason) p.standardReason = d.reason;
        await runSync(p);
        continue;
      }
    } else if (p.tier === 2 || !cfg.HW_BATCH_ENABLED || !readBatchSupported(providerFor('read'))) {
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
  const items: BatchItem[] = group.map((p) => ({ key: p.job.id, call: routed(readCall(model, p.input), 'read') }));
  try {
    const name = await createBatch(items, `hw-read-${new Date().toISOString()}`);
    await db.transaction(async (tx) => {
      for (const p of group) {
        // Record exactly which answers were sent, so results apply without re-reading anything.
        const sent: ReadPayload = {
          tier: 1, answerIds: p.input.answers.map((a) => a.answerId),
          ...(getHwConfig().HW_HOMEWORK_BATCH_ENABLED ? { readyBy: readyBy(new Date(), homeworkBatchSettings().deadlineHours).toISOString(), submittedAt: new Date().toISOString() } : {}),
        };
        await markBatchPending(tx, p.job.id, name, model, sent, getHwConfig().HW_BATCH_POLL_SECONDS, providerFor('read'));
      }
    });
  } catch (e) {
    // A batch that could not even be created is re-run on the standard path with the reason shown, whatever flag
    // asked for the batch: a failed batch must never leave an answer waiting without a reason.
    {
      for (const p of group) await db.transaction((tx) => requeueStandard(tx, p.job.id, payloadOf<ReadPayload>(p.job) ?? { tier: 1 }, `the batch could not be created (${describeError(e)})`));
      return;
    }
    for (const p of group) await settleFailure(p.job, e);
  }
}

/** Poll provider batches for read jobs and apply finished ones. */
export async function pollReadBatches(workerId: string): Promise<number> {
  // exam booklets' read batches are the exam step's own (exams/evaluate.ts)
  const jobs = await claimBatchPending('read', 50, workerId, getHwConfig().HW_BATCH_POLL_SECONDS, { notOrgId: EXAM_ORG_ID });
  const byBatch = new Map<string, JobRow[]>();
  for (const j of jobs) {
    if (!j.batchRef) {
      await settleFailure(j, new HwError('PROVIDER_ERROR', 'Batch reference lost.', 'batch_pending job without batch_ref'));
      continue;
    }
    byBatch.set(j.batchRef, [...(byBatch.get(j.batchRef) ?? []), j]);
  }

  // A batch that fails, errors for a request or runs out of time is ALWAYS re-run on the standard path with the
  // reason recorded (found in phase 1b: without this the answer stays pending with no reason until retries run out).
  const managed = true;
  // Managed mode: a batch that fails, errors for a request or runs out of time is re-run on the
  // standard path with the reason recorded; it does not fail the job or wait for ever.
  const stamped = (j: JobRow, outcome: 'completed' | 'failed' | 'overdue') => stampPayload(payloadOf<ReadPayload>(j) ?? ({ tier: 1 } as ReadPayload), new Date(), outcome);
  const fallback = (j: JobRow, reason: string, outcome: 'failed' | 'overdue' = 'failed') => db.transaction((tx) => requeueStandard(tx, j.id, stamped(j, outcome), reason));

  for (const [name, group] of byBatch) {
    let outcome;
    try {
      outcome = await pollBatch(group[0].provider, name, group[0].model ?? 'unknown');
    } catch (e) {
      console.error(`[hw] polling ${name} failed: ${describeError(e)}`);
      if (managed) {
        // The provider cannot be reached to poll: past the deadline, stop waiting.
        for (const j of group) if (isOverdue(payloadOf<ReadPayload>(j)?.readyBy, new Date())) await fallback(j, `the batch could not be checked and its time ran out (${describeError(e)})`, 'overdue');
      }
      continue; // run_after was pushed forward; try again next poll
    }
    if (outcome.state === 'pending') {
      if (managed) for (const j of group) if (isOverdue(payloadOf<ReadPayload>(j)?.readyBy, new Date())) await fallback(j, `the batch was not finished by ${payloadOf<ReadPayload>(j)!.readyBy}`, 'overdue');
      continue;
    }
    if (outcome.state === 'failed') {
      if (managed) { for (const j of group) await fallback(j, `the batch failed (${outcome.reason})`); continue; }
      for (const j of group) await settleFailure(j, new HwError('PROVIDER_ERROR', 'The AI batch failed.', outcome.reason));
      continue;
    }
    for (const j of group) {
      const entry = outcome.results.get(j.id);
      if (!entry) {
        if (managed) { await fallback(j, 'the batch returned no result for this submission'); continue; }
        await settleFailure(j, new HwError('PROVIDER_ERROR', 'The AI could not read this submission.', 'no result in batch'));
        continue;
      }
      if (managed && !entry.ok) { await fallback(j, `the batch could not read this submission (${describeError(entry.error)})`); continue; }
      if (managed) await saveStamp(db, j.id, stamped(j, 'completed'));
      try {
        if (!entry.ok) throw entry.error;
        const sent = payloadOf<ReadPayload>(j)?.answerIds;
        if (!sent?.length) throw new HwError('PROVIDER_ERROR', 'Batch job lost track of its answers.', 'batch_pending read job without answerIds');
        const results = parseReadOutput(entry.result.json, sent);
        await applyRead({ job: j, tier: 1 }, results, entry.result, true);
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
