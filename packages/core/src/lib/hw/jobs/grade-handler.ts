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
import { practiceRefusals } from '../practice/trial';
import { createBatch, generate, pollBatch, providerFor, routed, usageFromError, type AiResult } from '../ai';
import { defaultGradeOptions } from '../grader/ai-grader';
import { markCall, markChunkSize, markResultsFrom } from '../grader/mark-mode';
import type { GradeInput, GradeQuestion } from '../grader/types';
import { answersNeedingSuggestion, findPriorSuggestions, gradeByRules, insertAiGrades, loadGradeQuestion, reusedSuggestion } from '../pipeline';
import { keyVersionHash, planDuplicates, transcriptHash } from '../grader/dedupe';
import { recordInstructionFlags } from '../instruction-flags';
import { groupForMarking } from '../grader/instruction-screen';
import type { GradeResult } from '../grader/types';
import { claim, claimBatchPending, complete, enqueueGrade, fail, markBatchPending, payloadOf, type GradePayload, type JobRow } from './queue';
import { shadowAfterGrade } from '../shadow/shadow';
import { aiOffMessage } from '../eligibility/decision';
import { eligibilityOfQuestion } from '../eligibility/registry';
import { decideBatch, dueFor, fallbackNote, homeworkBatchSettings, isOverdue, isSmallWork, readyBy, requeueStandard, saveStamp, stampPayload } from './homework-batch';
import { examMarkingMode } from '../exams/batch';
import { EXAM_ORG_ID } from '../exams/space';

const RUBRIC_CHANGED = 'rubric changed while marking; suggestions discarded and re-queued';

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

interface Plan { q: GradeQuestion; chunks: string[][]; followers?: Record<string, string[]>; keyHash?: string }

/** Rules first, then (flag) reuse, then quota, then chunks. Returns the work left for AI, or null when the job is settled. */
async function plan(job: JobRow): Promise<Plan | null> {
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
  let pending = await answersNeedingSuggestion(db, q);
  if (!pending.length) {
    await complete(db, job.id, undefined, 'nothing left to mark');
    return null;
  }

  // Roadmap 5.3: AI marks only for a group the registry says is eligible for the setup running now. Rules in code (above) are not AI.
  const elig = await eligibilityOfQuestion(db, q.id);
  if (!elig.eligible) {
    const reason = aiOffMessage(elig.reason);
    await db.transaction(async (tx) => {
      await tx.update(hwAnswer).set({ failureReason: reason }).where(inArray(hwAnswer.id, pending.map((p) => p.answerId)));
      await complete(tx, job.id, undefined, `not marked: ${reason} (${elig.reason})`);
    });
    return null;
  }

  // Identical answers are marked once: first from suggestions an AI already made for this question,
  // then within this job (one answer per distinct transcript goes to the AI, the rest copy it).
  let followers: Record<string, string[]> | undefined;
  let keyHash: string | undefined;
  if (getHwConfig().HW_DEDUPE_MARKING_ENABLED) {
    keyHash = keyVersionHash(q);
    const hashes = new Map(pending.map((p) => [p.answerId, transcriptHash(p.transcript)]));
    const prior = await findPriorSuggestions(db, job.organizationId, keyHash, [...new Set(hashes.values())]);
    const reuse: GradeResult[] = [];
    const rest: typeof pending = [];
    for (const p of pending) {
      const original = prior.get(hashes.get(p.answerId)!);
      if (original) reuse.push(reusedSuggestion(original, p.answerId, { transcriptHash: hashes.get(p.answerId)!, keyVersionHash: keyHash }));
      else rest.push(p);
    }
    if (reuse.length) await db.transaction((tx) => insertAiGrades(tx, job.organizationId, job.id, reuse));
    const dup = planDuplicates(rest);
    followers = dup.followers;
    pending = dup.toAi;
    if (!pending.length) {
      await complete(db, job.id, undefined, `${reuse.length} reused from earlier identical answers; nothing left to mark`);
      return null;
    }
  }
  // Self-practice: a learner whose trial cannot pay for another step is not marked. Nothing is refused outside the practice space.
  const trialRefused = await practiceRefusals(db, job.organizationId, pending.map((p) => p.answerId));
  if (trialRefused.size) {
    await db.transaction(async (tx) => {
      for (const msg of new Set(trialRefused.values())) {
        await tx.update(hwAnswer).set({ failureReason: msg }).where(inArray(hwAnswer.id, pending.filter((p) => trialRefused.get(p.answerId) === msg).map((p) => p.answerId)));
      }
      if (pending.every((p) => trialRefused.has(p.answerId))) await complete(tx, job.id, undefined, 'not marked: the free trial cannot pay for another step');
    });
    if (pending.every((p) => trialRefused.has(p.answerId))) return null;
    pending = pending.filter((p) => !trialRefused.has(p.answerId));
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
  // With the instruction guard, an answer addressed to the marker is marked alone, so nothing it says can reach a neighbour.
  const chunks = getHwConfig().HW_INSTRUCTION_GUARD_ENABLED
    ? groupForMarking(pending, markChunkSize(), true).map((g) => g.map((p) => p.answerId))
    : chunk(pending.map((p) => p.answerId), markChunkSize());
  return { q, chunks, followers, keyHash };
}

/**
 * Save one chunk's suggestions. If the rubric changed after the request was made, the
 * suggestions are discarded and the answers are marked again against the new rubric.
 */
async function applyChunk(job: JobRow, requestedVersion: number, input: GradeInput, res: AiResult, batch: boolean, dup?: { followers?: Record<string, string[]>; keyHash?: string }): Promise<string | undefined> {
  const current = await loadGradeQuestion(db, input.question.id);
  return db.transaction(async (tx) => {
    const note = await recordUsage(tx, { jobId: job.id, orgId: job.organizationId, model: res.model, usage: res.usage, costUsd: res.costUsd, batch, answersGraded: input.answers.length });
    if (!current || current.rubricVersion !== requestedVersion) {
      if (current) await enqueueGrade(tx, job.organizationId, current.id, 0);
      return RUBRIC_CHANGED;
    }
    const results = markResultsFrom(res, input);
    const cfg = getHwConfig();
    // The screen's record of what it flagged when marking (the denominator of its false-positive rate). Never blocks marking.
    if (cfg.HW_INSTRUCTION_GUARD_ENABLED) await recordInstructionFlags(tx, job.organizationId, input.answers);
    if (cfg.HW_CODE_MARKING_ENABLED || cfg.HW_DEDUPE_MARKING_ENABLED) {
      // Record that a model marked these, and (for reuse) what makes them reusable.
      const byId = new Map(input.answers.map((a) => [a.answerId, a.transcript]));
      const kHash = dup?.keyHash ?? keyVersionHash(input.question);
      for (const r of results) {
        r.markSource = 'ai';
        if (cfg.HW_DEDUPE_MARKING_ENABLED) { r.transcriptHash = transcriptHash(byId.get(r.answerId) ?? ''); r.keyVersionHash = kHash; }
      }
    }
    const copies: GradeResult[] = [];
    if (cfg.HW_DEDUPE_MARKING_ENABLED && dup?.followers) {
      // A later answer is copied only if its transcript, read again now, is still identical.
      const ids = results.flatMap((r) => dup.followers![r.answerId] ?? []);
      const rows = ids.length ? await tx.select({ id: hwAnswer.id, transcript: hwAnswer.transcript }).from(hwAnswer).where(inArray(hwAnswer.id, ids)) : [];
      const now = new Map(rows.map((r) => [r.id, r.transcript ?? '']));
      for (const r of results) {
        for (const f of dup.followers[r.answerId] ?? []) {
          if (now.has(f) && transcriptHash(now.get(f)!) === r.transcriptHash) copies.push(reusedSuggestion(r, f, { transcriptHash: r.transcriptHash!, keyVersionHash: r.keyVersionHash! }));
        }
      }
    }
    await insertAiGrades(tx, job.organizationId, job.id, [...results, ...copies]);
    return note;
  });
}

async function runSync(job: JobRow, q: GradeQuestion, chunks: string[][], dupOf?: { followers?: Record<string, string[]>; keyHash?: string }, why?: string): Promise<void> {
  const model = requireModel('grade');
  // A re-run on the standard path keeps its reason on the finished job, where the teacher can see it.
  const notes: string[] = why ? [why] : [];
  let failedChunks = 0;
  for (const ids of chunks) {
    const input = await inputsFor(q, ids);
    if (!input.answers.length) continue;
    try {
      const res = await generate(routed(markCall(model, input, defaultGradeOptions()), 'grade'));
      const note = await applyChunk(job, q.rubricVersion, input, res, false, dupOf);
      if (note) notes.push(note);
      // Production is committed; the candidate configuration may now mark the same answers.
      if (note !== RUBRIC_CHANGED) await shadowAfterGrade(job.organizationId, q, input.answers);
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
      const inPayload = payloadOf<GradePayload>(job);
      // an exam booklet's marking follows its attempt: batched against the attempt's promised report time, or marked now (exams/batch.ts)
      const exam = job.organizationId === EXAM_ORG_ID && job.questionId
        ? await examMarkingMode(db, job.questionId, new Date(), { enabled: cfg.HW_EXAMS_BATCH_ENABLED, windowHours: cfg.HW_EXAMS_BATCH_HOURS })
        : null;
      let examReadyBy: string | undefined;
      if (exam) {
        if (!exam.batch || inPayload?.standard) {
          await runSync(job, p.q, p.chunks, { followers: p.followers, keyHash: p.keyHash }, (inPayload?.standard ? inPayload.fallbackReason : exam.batch ? undefined : exam.reason) ?? undefined);
          continue;
        }
        examReadyBy = exam.markBy.toISOString();
      } else if (isSmallWork(p.chunks.reduce((n, c) => n + c.length, 0), cfg.HW_BATCH_SMALL_MAX)) {
        // A few answers to mark (one InkBuddy attempt is one): marked now, not after a batch.
        await runSync(job, p.q, p.chunks, { followers: p.followers, keyHash: p.keyHash });
        continue;
      } else if (cfg.HW_HOMEWORK_BATCH_ENABLED) {
        // Homework batches; urgent work and a fallback stay on the standard path.
        const d = decideBatch({
          standardForced: Boolean(inPayload?.standard), fallbackReason: inPayload?.fallbackReason, providerCanBatch: true,
          dueAt: await dueFor(db, { questionId: job.questionId }), now: new Date(), urgentHours: homeworkBatchSettings().urgentHours,
        });
        if (!d.batch) {
          await runSync(job, p.q, p.chunks, { followers: p.followers, keyHash: p.keyHash }, d.reason ?? undefined);
          continue;
        }
      } else if (!cfg.HW_BATCH_ENABLED) {
        await runSync(job, p.q, p.chunks, { followers: p.followers, keyHash: p.keyHash });
        continue;
      }
      const model = requireModel('grade');
      const items = await Promise.all(p.chunks.map(async (ids, i) => ({ key: `${job.id}:${i}`, call: routed(markCall(model, await inputsFor(p.q, ids), defaultGradeOptions()), 'grade') })));
      let name: string;
      try {
        name = await createBatch(items, `hw-grade-${job.id}`);
      } catch (e) {
        // A batch that could not even be created is re-run on the standard path, with the reason shown.
        await db.transaction((tx) => requeueStandard(tx, job.id, {}, `the batch could not be created (${describeError(e)})`));
        continue;
      }
      const payload: GradePayload = {
        rubricVersion: p.q.rubricVersion, chunks: p.chunks, ...(p.followers ? { followers: p.followers, keyHash: p.keyHash } : {}),
        ...(examReadyBy ? { readyBy: examReadyBy, submittedAt: new Date().toISOString() }
          : cfg.HW_HOMEWORK_BATCH_ENABLED ? { readyBy: readyBy(new Date(), homeworkBatchSettings().deadlineHours).toISOString(), submittedAt: new Date().toISOString() } : {}),
      };
      await markBatchPending(db, job.id, name, model, payload, cfg.HW_BATCH_POLL_SECONDS, providerFor('grade'));
    } catch (e) {
      await settleFailure(job, e);
    }
  }
  return taken;
}

export async function pollGradeBatches(workerId: string): Promise<number> {
  const jobs = await claimBatchPending('grade', 20, workerId, getHwConfig().HW_BATCH_POLL_SECONDS);
  // A batch that fails, errors or runs out of time is ALWAYS re-run on the standard path with the reason recorded.
  const managed = true;
  // Managed mode: a batch that fails, errors or runs out of time is re-run on the standard path, with the reason recorded.
  const fallback = (j: JobRow, reason: string, outcome: 'failed' | 'overdue' = 'failed') => db.transaction((tx) => requeueStandard(tx, j.id, stampPayload(payloadOf<GradePayload>(j) ?? {}, new Date(), outcome), reason));
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
      if (managed && isOverdue(payload.readyBy, new Date())) await fallback(job, `the batch could not be checked and its time ran out (${describeError(e)})`, 'overdue');
      continue;
    }
    if (outcome.state === 'pending') {
      if (managed && isOverdue(payload.readyBy, new Date())) await fallback(job, `the batch was not finished by ${payload.readyBy}`, 'overdue');
      continue;
    }
    if (outcome.state === 'failed') {
      if (managed) { await fallback(job, `the batch failed (${outcome.reason})`); continue; }
      await settleFailure(job, new HwError('PROVIDER_ERROR', 'The AI batch failed.', outcome.reason));
      continue;
    }

    if (managed) await saveStamp(db, job.id, stampPayload(payload, new Date(), 'completed'));
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
        const note = await applyChunk(job, payload.rubricVersion, input, entry.result, true, { followers: payload.followers, keyHash: payload.keyHash });
        if (note) notes.push(note);
        if (note !== RUBRIC_CHANGED) await shadowAfterGrade(job.organizationId, input.question, input.answers);
      } catch (e) {
        const billed = usageFromError(e);
        if (billed) await recordUsage(db, { jobId: job.id, orgId: job.organizationId, model: billed.model, usage: billed.usage, costUsd: billed.costUsd, batch: true });
        failedChunks++;
        notes.push(`chunk ${i} failed: ${describeError(e)}`);
      }
    }
    if (failedChunks && q) {
      await db.transaction((tx) => enqueueGrade(tx, job.organizationId, q.id, managed ? 0 : getHwConfig().HW_GRADE_DEBOUNCE_SECONDS,
        managed ? { standard: { reason: fallbackNote(`${failedChunks} of ${payload.chunks.length} batched requests failed (${notes.join('; ')})`) } } : {}));
    }
    if (q && failedChunks === payload.chunks.length && !managed) {
      await settleFailure(job, new HwError('PROVIDER_ERROR', 'AI marking failed.', notes.join(' | ')));
    } else {
      await complete(db, job.id, job.model ?? undefined, notes.length ? notes.join(' | ') : (q ? undefined : 'question no longer exists'));
    }
  }
  return jobs.length;
}
