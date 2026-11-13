// Phase 5: evaluating a handed-in booklet. The job runner calls runExamEvaluations and pollExamBatches every pass.
//
//   uploaded -> evaluating: materialise the attempt's assignment (materialise.ts), then PLAN the reading with code alone (planBooklet): a
//   printed answer-sheet page becomes one read per box with writing, its grid read from the ink (sheet-read.ts); any other page two
//   overlapping halves (HW_EXAMS_READ_SPLIT) or one whole read. The plan is then READ either now (the standard path) or, with
//   HW_EXAMS_BATCH_ENABLED, through the provider's batch API at half price (exams/batch.ts: a "report ready by" time, a reading deadline inside
//   it, files kept inside the provider's limits). When the reads are in: place the writing (assemble.ts + mapping.ts, the text-only
//   answer-key matcher for what is left and to check every answer placed by a written number), write one transcript per question, and hand the
//   submission to the marking pipeline (rules first, then strict marking jobs, batched against the same promise when the attempt is).
// The attempt stays 'evaluating' while it is marked; the report (phase 6) closes it.
//
// Cost: standard calls are booked on a finished `read` job of the attempt's submission; a batch's reads on its own job rows, at batch prices.
// Failure: retried on the next pass up to HW_EXAMS_EVAL_MAX_TRIES, then left for a person with the reason. A batch that fails, has a failed read
// or misses its reading deadline is read again on the standard path, with the reason kept. A pass that dies half-way is picked up again once
// stale (never while its batch is pending). Nothing here runs unless HW_EXAMS_ENABLED.

import { and, asc, eq, sql } from 'drizzle-orm';
import { hwAiJob } from '@/db/hw-schema';
import { hwExamAttempt, hwExamPage } from '@/db/hw-exams-schema';
import { getHwConfig, requireModel } from '../config';
import { db, newId, type Exec } from '../db';
import { describeError } from '../errors';
import { recordUsage } from '../cost/usage';
import { failAnswers, finishSubmissionIfRead, setTranscript } from '../pipeline';
import { examPageStore } from '../storage/exam-pages';
import { createBatch, pollBatch, providerFor, readBatchSupported, routed, type AiResult, type BatchItem, type BatchOutcome } from '../ai';
import { claimBatchPending } from '../jobs/queue';
import { assembleBooklet, type AnswerOutcome } from './assemble';
import { chunkRequests, readingBatchPlan, requestBytes } from './batch';
import { loadSharp, sharpHalfCropper, type HalfCropper } from './crop';
import { mergeHalves } from './halves';
import { planSheetPhoto, sheetPageRead, type SheetOutput, type SheetPlan } from './sheet-read';
import { materialiseAttempt, type Materialised } from './materialise';
import {
  boxReadCall, EXAM_BOX_READ_PROMPT_VERSION, EXAM_PAGE_READ_PROMPT_VERSION, liveExamAi, pageReadCall, parseBoxRead, parsePageRead,
  type ExamAi, type PageRead, type PaperQuestionRef,
} from './page-reader';
import { sheetFor } from './learner';
import { EXAM_ORG_ID } from './space';

type Mime = 'image/png' | 'image/jpeg' | 'image/webp';

/** The provider's batch API, as the exam step uses it (tests pass a fake). */
export interface ExamBatchApi {
  provider: string;
  readModel: string;
  create(items: BatchItem[], name: string): Promise<string>;
  poll(name: string, model: string): Promise<BatchOutcome>;
}

export interface EvalDeps {
  ai: ExamAi;
  getObject(key: string): Promise<Uint8Array>;
  now(): Date;
  /** Cuts a page into two overlapping halves to read separately (HW_EXAMS_READ_SPLIT=halves); absent or null = read the whole page. */
  halves?: HalfCropper | null;
  /** sharp, for reading printed answer-sheet pages box by box (HW_EXAMS_SHEET_VISION); absent or null = every page is read as a page. */
  sharp?: import('./crop').SharpFn | null;
  /** The batch API (HW_EXAMS_BATCH_ENABLED and a provider that can batch reads); absent or null = every booklet is read now. */
  batch?: ExamBatchApi | null;
}

export async function liveEvalDeps(): Promise<EvalDeps> {
  const store = examPageStore();
  const cfg = getHwConfig();
  const readProvider = providerFor('read');
  return {
    halves: cfg.HW_EXAMS_READ_SPLIT === 'halves' ? await sharpHalfCropper() : null,
    sharp: cfg.HW_EXAMS_SHEET_VISION ? await loadSharp() : null,
    batch: cfg.HW_EXAMS_BATCH_ENABLED && readBatchSupported(readProvider)
      ? { provider: readProvider, readModel: requireModel('read'), create: createBatch, poll: (name, model) => pollBatch(readProvider, name, model) }
      : null,
    ai: liveExamAi({ read: requireModel('read'), match: requireModel('grade') }),
    getObject: async (key) => {
      // the page store hands out links; for the bytes, R2 directly or the local stand-in's data: URL
      const url = await store.readUrl(key);
      if (url.startsWith('data:')) return Uint8Array.from(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
      const res = await fetch(url);
      if (!res.ok) throw new Error(`page ${key}: HTTP ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    },
    now: () => new Date(),
  };
}

export type EvalOutcome =
  | { attemptId: string; ok: true; pages: number; answers: Record<AnswerOutcome['status'], number>; review: number; calls: number; costPaise: number }
  | { attemptId: string; ok: true; batched: true; requests: number; batches: number; readyBy: string; readBy: string }
  | { attemptId: string; ok: false; error: string; final: boolean };

const TRY = /^eval try (\d+)\//;

/** An exam read batch still waiting at the provider, for this attempt. */
const pendingBatch = (attemptCol: ReturnType<typeof sql>) => sql`EXISTS (
  SELECT 1 FROM hw_ai_job j WHERE j.organization_id = ${EXAM_ORG_ID} AND j.kind = 'read' AND j.status = 'batch_pending'
     AND j.payload_ref::jsonb -> 'exam' ->> 'attemptId' = ${attemptCol})`;

/** Puts back attempts whose evaluation died half-way (still 'evaluating', answers still pending, untouched for a while, no batch waiting). */
async function recoverStale(x: Exec): Promise<number> {
  const stale = getHwConfig().HW_JOB_STALE_MINUTES;
  const r = await x.execute(sql`
    UPDATE hw_exam_attempt a SET status = 'uploaded'
     WHERE a.status = 'evaluating' AND a.updated_at < now() - (${stale} * interval '1 minute')
       AND (a.failure_reason IS NULL OR a.failure_reason NOT LIKE 'eval failed:%')
       AND NOT ${pendingBatch(sql`"a"."id"`)}
       AND (a.assignment_id IS NULL OR EXISTS (
             SELECT 1 FROM hw_submission s JOIN hw_answer w ON w.submission_id = s.id
              WHERE s.assignment_id = a.assignment_id AND w.transcript_status = 'pending'))`);
  return r.rowCount ?? 0;
}

/** Claims up to `limit` handed-in attempts, oldest first; two workers never take the same one. */
async function claim(limit: number): Promise<string[]> {
  const r = await db.execute<{ id: string }>(sql`
    UPDATE hw_exam_attempt SET status = 'evaluating'
     WHERE id IN (SELECT id FROM hw_exam_attempt WHERE status = 'uploaded' ORDER BY submitted_at NULLS LAST LIMIT ${limit} FOR UPDATE SKIP LOCKED)
    RETURNING id`);
  return r.rows.map((x) => x.id);
}

/** Exported for tests: put back attempts that died half-way. */
export const recoverStaleAttempts = () => recoverStale(db);

export async function runExamEvaluations(limit = getHwConfig().HW_EXAMS_EVAL_PER_PASS, deps?: EvalDeps): Promise<EvalOutcome[]> {
  if (!getHwConfig().HW_EXAMS_ENABLED) return [];
  await recoverStale(db);
  const ids = await claim(limit);
  if (!ids.length) return [];
  const d = deps ?? (await liveEvalDeps());
  const out: EvalOutcome[] = [];
  for (const id of ids) out.push(await evaluateClaimed(id, d));
  return out;
}

// ── the reading plan ─────────────────────────────────────────────────────────

interface Req { key: string; kind: 'box' | 'page'; image: Uint8Array; mime: Mime; numbers: number[]; alternatives: string[] }

/** What a page's reads become (stored with a batch, so no image is kept). */
type StoredSheetPlan = Omit<Extract<SheetPlan, { ok: true }>, 'requests' | 'marks'> & { requests: ({ kind: 'box'; numbers: number[]; alternatives: string[] } | { kind: 'extra' })[] };
type PageMeta = { pageId: string; position: number; sheetFallback?: string } & (
  | { how: 'sheet'; keys: string[]; sheet: StoredSheetPlan }
  | { how: 'halves'; keys: [string, string] }
  | { how: 'page'; keys: [string] });

/** Code only: for every accepted page, what has to be read and how the reads go back together. No model is called. */
async function planBooklet(attemptId: string, m: Materialised, deps: EvalDeps) {
  const pages = await db.select().from(hwExamPage)
    .where(and(eq(hwExamPage.attemptId, attemptId), eq(hwExamPage.status, 'accepted'))).orderBy(asc(hwExamPage.position));
  const units = new Map<number, PaperQuestionRef>();
  for (const q of m.questions) {
    const u = units.get(q.number) ?? { number: q.number, alternatives: [], choice: q.choice };
    if (q.alt && !u.alternatives.includes(q.alt)) u.alternatives.push(q.alt);
    units.set(q.number, u);
  }
  const refs = [...units.values()].sort((a, b) => a.number - b.number);
  const sheet = await sheetFor(db, m.setId);
  const metas: PageMeta[] = [];
  const reqs: Req[] = [];
  for (const p of pages) {
    const image = await deps.getObject(p.imageKey);
    let sheetFallback: string | undefined;
    if (deps.sharp && deps.ai.readBox) {
      // a printed answer-sheet page: code finds it, reads the grid and picks the boxes with writing
      const plan = await planSheetPhoto({ image, layout: sheet.layout, sharp: deps.sharp });
      if (plan.ok) {
        const keys = plan.requests.map((r, i) => {
          const key = `${p.position}:s${i}`;
          reqs.push({ key, kind: r.kind === 'box' ? 'box' : 'page', image: r.image, mime: 'image/jpeg', numbers: r.kind === 'box' ? r.numbers : [], alternatives: r.kind === 'box' ? r.alternatives : [] });
          return key;
        });
        const stored: StoredSheetPlan = { ok: true, sheet: plan.sheet, grid: plan.grid, fixed: plan.fixed, requests: plan.requests.map((r) => (r.kind === 'box' ? { kind: 'box', numbers: r.numbers, alternatives: r.alternatives } : { kind: 'extra' })) };
        metas.push({ pageId: p.id, position: p.position, how: 'sheet', keys, sheet: stored });
        continue;
      }
      sheetFallback = plan.reason;
    }
    // not a printed sheet page (or one code could not square up): read as a page, in halves by default
    const halves = deps.halves ? await deps.halves(image) : null;
    if (halves) {
      const keys: [string, string] = [`${p.position}:t`, `${p.position}:b`];
      reqs.push({ key: keys[0], kind: 'page', image: halves[0], mime: 'image/jpeg', numbers: [], alternatives: [] });
      reqs.push({ key: keys[1], kind: 'page', image: halves[1], mime: 'image/jpeg', numbers: [], alternatives: [] });
      metas.push({ pageId: p.id, position: p.position, how: 'halves', keys, ...(sheetFallback ? { sheetFallback } : {}) });
    } else {
      const key = `${p.position}:p`;
      reqs.push({ key, kind: 'page', image, mime: p.mimeType, numbers: [], alternatives: [] });
      metas.push({ pageId: p.id, position: p.position, how: 'page', keys: [key], ...(sheetFallback ? { sheetFallback } : {}) });
    }
  }
  return { metas, reqs, refs, layout: sheet.layout };
}

type Spend = { result: AiResult; batch: boolean }[];

/** The standard path: every planned read now, through the reader. */
async function readNow(reqs: Req[], refs: PaperQuestionRef[], lang: 'en' | 'hi', deps: EvalDeps, spend: Spend): Promise<Map<string, SheetOutput>> {
  const out = new Map<string, SheetOutput>();
  for (const r of reqs) {
    if (r.kind === 'box') {
      const { read, result } = await deps.ai.readBox!({ image: r.image, mime: r.mime, numbers: r.numbers, alternatives: r.alternatives, lang });
      spend.push({ result, batch: false });
      out.set(r.key, { kind: 'box', read });
    } else {
      const { read, result } = await deps.ai.readPage({ image: r.image, mime: r.mime, questions: refs, lang });
      spend.push({ result, batch: false });
      out.set(r.key, { kind: 'page', read });
    }
  }
  return out;
}

/** The planned reads back into one read per page. A missing read is an error (the caller re-reads on the standard path). */
function pageReads(metas: PageMeta[], outs: Map<string, SheetOutput>): { pageId: string; position: number; read: PageRead }[] {
  const page = (key: string): PageRead => {
    const o = outs.get(key);
    if (!o || o.kind !== 'page') throw new Error(`read ${key} is missing`);
    return o.read;
  };
  return metas.map((m) => {
    if (m.how === 'sheet') {
      const plan = { ...m.sheet, marks: [], requests: m.sheet.requests.map((r) => ({ ...r, image: new Uint8Array() })) } as Extract<SheetPlan, { ok: true }>;
      return { pageId: m.pageId, position: m.position, read: sheetPageRead(plan, m.keys.map((k) => { const o = outs.get(k); if (!o) throw new Error(`read ${k} is missing`); return o; })) };
    }
    if (m.how === 'halves') return { pageId: m.pageId, position: m.position, read: mergeHalves(page(m.keys[0]), page(m.keys[1])) };
    return { pageId: m.pageId, position: m.position, read: page(m.keys[0]) };
  });
}

/** Each page's read, kept with the page for the report and for a person checking it. */
async function keepReads(metas: PageMeta[], reads: { pageId: string; read: PageRead }[], model: string, via: 'now' | 'batch') {
  for (const meta of metas) {
    const read = reads.find((r) => r.pageId === meta.pageId)!.read;
    const prompt = meta.how === 'sheet' ? EXAM_BOX_READ_PROMPT_VERSION : EXAM_PAGE_READ_PROMPT_VERSION;
    await db.update(hwExamPage).set({ quality: sql`${hwExamPage.quality} || ${JSON.stringify({ read: { ...read, model, prompt, split: meta.how, via, ...(meta.sheetFallback ? { sheetFallback: meta.sheetFallback } : {}) } })}::jsonb` })
      .where(eq(hwExamPage.id, meta.pageId));
  }
}

/** Placement: the matching rule, the answer-key matcher for what needs it (always now: one small text call), notes for a person per page. */
async function place(m: Materialised, layout: Awaited<ReturnType<typeof sheetFor>>['layout'], reads: { pageId: string; position: number; read: PageRead }[], deps: EvalDeps, spend: Spend) {
  const sheetPageNumbers = new Map(layout.pages.map((p) => [p.page, p.numbers]));
  const minConfidence = getHwConfig().HW_READ_ESCALATE_BELOW;
  const qs = m.questions.map((q) => ({ answerId: q.answerId, number: q.number, alt: q.alt, choice: q.choice, options: q.options }));
  let a = assembleBooklet({ code: layout.code, sheetPageNumbers, questions: qs, pages: reads, minConfidence });
  if (a.needMatch.length) {
    const byNumber = new Map<number, { number: number; question: string; modelAnswer: string }>();
    for (const q of m.questions) {
      const cur = byNumber.get(q.number);
      byNumber.set(q.number, cur
        ? { ...cur, question: `${cur.question}\nOR ${q.prompt}`, modelAnswer: `${cur.modelAnswer}\nOR ${q.modelAnswer}` }
        : { number: q.number, question: q.prompt, modelAnswer: q.modelAnswer });
    }
    const { matches, result } = await deps.ai.matchAnswers({ questions: [...byNumber.values()], answers: a.needMatch });
    spend.push({ result, batch: false });
    a = assembleBooklet({ code: layout.code, sheetPageNumbers, questions: qs, pages: reads, minConfidence, matches });
  }
  // what a person must look at, kept with the page it is on (the report shows it: "page 2 could not be read")
  for (const r of reads) {
    const items = a.review.filter((x) => x.pageId === r.pageId).map((x) => ({ reason: x.reason, detail: x.detail }));
    await db.update(hwExamPage).set({ quality: sql`${hwExamPage.quality} || ${JSON.stringify({ review: items })}::jsonb` }).where(eq(hwExamPage.id, r.pageId));
  }
  return { answers: a.answers, review: a.review.length };
}

/** Transcripts written, cost booked, and the submission handed to marking: one transaction. */
async function finish(attemptId: string, m: Materialised, answers: Map<string, AnswerOutcome>, spend: Spend, pagesRead: number, batchJobs: { id: string; entries: AiResult[] }[] = []) {
  return db.transaction(async (tx) => {
    let paise = await bookCost(tx, m, spend, pagesRead);
    for (const j of batchJobs) paise += await bookBatchJob(tx, j.id, j.entries);
    await writeAnswers(tx, m, answers);
    await finishSubmissionIfRead(tx, m.submissionId); // the marking pipeline takes it from here
    await tx.update(hwExamAttempt).set({ failureReason: null }).where(eq(hwExamAttempt.id, attemptId));
    return paise;
  });
}

const tallyOf = (answers: Map<string, AnswerOutcome>) => {
  const t: Record<AnswerOutcome['status'], number> = { done: 0, needs_review: 0, blank: 0 };
  for (const a of answers.values()) t[a.status]++;
  return t;
};

// ── evaluating one attempt ───────────────────────────────────────────────────

/**
 * Evaluates one attempt the caller has already moved to 'evaluating': read now, or submit its reads as a batch (pollExamBatches finishes it).
 * Never throws: a failure is recorded on the attempt. `standard` forces the standard path (a batch that did not work out).
 */
export async function evaluateClaimed(attemptId: string, deps: EvalDeps, opts: { standard?: string } = {}): Promise<EvalOutcome> {
  const spend: Spend = [];
  try {
    const m = await db.transaction((tx) => materialiseAttempt(tx, attemptId));
    const cfg = getHwConfig();
    const att = (await db.select({ mode: hwExamAttempt.evaluationMode, readyBy: hwExamAttempt.readyBy }).from(hwExamAttempt).where(eq(hwExamAttempt.id, attemptId)).limit(1))[0]!;
    const plan = await planBooklet(attemptId, m, deps);

    if (!opts.standard && cfg.HW_EXAMS_BATCH_ENABLED && deps.batch && att.mode === 'batch' && plan.reqs.length) {
      const d = readingBatchPlan({ now: deps.now(), windowHours: cfg.HW_EXAMS_BATCH_HOURS, promisedBy: att.readyBy });
      if (d.mode === 'batch') {
        const submitted = await submitBatch(attemptId, m, plan, deps, d.readyBy, d.readBy);
        if (submitted) return submitted;
      }
    }

    const outs = await readNow(plan.reqs, plan.refs, m.lang, deps, spend);
    const reads = pageReads(plan.metas, outs);
    await keepReads(plan.metas, reads, spend[0]?.result.model ?? 'code', 'now');
    const placed = await place(m, plan.layout, reads, deps, spend);
    const costPaise = await finish(attemptId, m, placed.answers, spend, plan.metas.length);
    if (opts.standard) await db.update(hwExamAttempt).set({ evaluationMode: 'standard', failureReason: null }).where(eq(hwExamAttempt.id, attemptId));
    return { attemptId, ok: true, pages: plan.metas.length, answers: tallyOf(placed.answers), review: placed.review, calls: spend.length, costPaise };
  } catch (e) {
    return failed(attemptId, e, spend);
  }
}

async function failed(attemptId: string, e: unknown, spend: Spend): Promise<EvalOutcome> {
  const msg = describeError(e).slice(0, 500);
  const prev = (await db.select({ r: hwExamAttempt.failureReason }).from(hwExamAttempt).where(eq(hwExamAttempt.id, attemptId)).limit(1))[0]?.r ?? '';
  const tries = Number(TRY.exec(prev ?? '')?.[1] ?? 0) + 1;
  const max = getHwConfig().HW_EXAMS_EVAL_MAX_TRIES;
  const final = tries >= max;
  // a final failure stays 'evaluating' with the reason, for a person; otherwise back in the queue
  await db.update(hwExamAttempt).set(final
    ? { failureReason: `eval failed: ${msg}` }
    : { status: 'uploaded', failureReason: `eval try ${tries}/${max}: ${msg}` }).where(eq(hwExamAttempt.id, attemptId));
  // what was spent before the failure is still spent
  if (spend.length) {
    try {
      const m = await db.transaction((tx) => materialiseAttempt(tx, attemptId));
      await db.transaction((tx) => bookCost(tx, m, spend, 0));
    } catch { /* the failure above is what matters */ }
  }
  console.error(`[hw-exams] evaluation of ${attemptId} failed (${tries}/${max}): ${msg}`);
  return { attemptId, ok: false, error: msg, final };
}

// ── the batch path ───────────────────────────────────────────────────────────

interface ExamBatchPayload {
  exam: { attemptId: string; chunk: number; chunks: number; readyBy: string; readBy: string; submittedAt: string; kinds: Record<string, 'box' | 'page'>; metas?: PageMeta[] };
}

/** Submits the plan's reads as one or more batches (inside the provider's limits) and records them. Null = could not submit: read now. */
async function submitBatch(attemptId: string, m: Materialised, plan: Awaited<ReturnType<typeof planBooklet>>, deps: EvalDeps, readyBy: Date, readBy: Date): Promise<EvalOutcome | null> {
  const api = deps.batch!;
  const chunks = chunkRequests(plan.reqs.map((r) => requestBytes(r.image.length)));
  const created: { name: string; idx: number[] }[] = [];
  try {
    for (const [i, idx] of chunks.entries()) {
      const items: BatchItem[] = idx.map((k) => {
        const r = plan.reqs[k]!;
        const call = r.kind === 'box' ? boxReadCall(api.readModel, r.image, r.mime, r.numbers, r.alternatives, m.lang) : pageReadCall(api.readModel, r.image, r.mime, plan.refs, m.lang);
        return { key: r.key, call: routed(call, 'read') };
      });
      created.push({ name: await api.create(items, `hw-exam-${attemptId.slice(0, 8)}-${i + 1}of${chunks.length}`), idx });
    }
  } catch (e) {
    // a batch that could not even be created: the booklet is read now (a created part, if any, is left to expire unused)
    console.error(`[hw-exams] batch for ${attemptId} could not be created, reading now: ${describeError(e)}`);
    return null;
  }
  const now = deps.now();
  await db.transaction(async (tx) => {
    for (const [i, c] of created.entries()) {
      const payload: ExamBatchPayload = {
        exam: {
          attemptId, chunk: i, chunks: created.length, readyBy: readyBy.toISOString(), readBy: readBy.toISOString(), submittedAt: now.toISOString(),
          kinds: Object.fromEntries(c.idx.map((k) => [plan.reqs[k]!.key, plan.reqs[k]!.kind])), ...(i === 0 ? { metas: plan.metas } : {}),
        },
      };
      await tx.insert(hwAiJob).values({
        id: newId(), organizationId: EXAM_ORG_ID, kind: 'read', status: 'batch_pending', submissionId: m.submissionId, provider: api.provider, model: api.readModel,
        batchRef: c.name, payloadRef: JSON.stringify(payload), attempts: 1, startedAt: now,
        runAfter: sql`now() + make_interval(secs => ${getHwConfig().HW_BATCH_POLL_SECONDS})`,
      });
    }
    await tx.update(hwExamAttempt).set({ readyBy, failureReason: null }).where(eq(hwExamAttempt.id, attemptId));
  });
  return { attemptId, ok: true, batched: true, requests: plan.reqs.length, batches: created.length, readyBy: readyBy.toISOString(), readBy: readBy.toISOString() };
}

export type BatchPollOutcome =
  | { attemptId: string; state: 'waiting' }
  | { attemptId: string; state: 'done'; outcome: EvalOutcome }
  | { attemptId: string; state: 'standard'; reason: string; outcome: EvalOutcome };

/** Polls exam read batches; an attempt whose batches are all in is placed and handed to marking, one that went wrong is read now. */
export async function pollExamBatches(deps?: EvalDeps, workerId = `exam-poll-${process.pid}`): Promise<BatchPollOutcome[]> {
  if (!getHwConfig().HW_EXAMS_ENABLED) return [];
  const claimed = await claimBatchPending('read', 50, workerId, getHwConfig().HW_BATCH_POLL_SECONDS, { orgId: EXAM_ORG_ID });
  const attempts = [...new Set(claimed.map((j) => (JSON.parse(j.payloadRef ?? '{}') as Partial<ExamBatchPayload>).exam?.attemptId).filter((x): x is string => !!x))];
  if (!attempts.length) return [];
  const d = deps ?? (await liveEvalDeps());
  const out: BatchPollOutcome[] = [];
  for (const attemptId of attempts) out.push(await pollExamAttempt(attemptId, d));
  return out;
}

/** One attempt's batches: waiting, done, or read again on the standard path (exported for tests, which must not touch other attempts). */
export async function pollExamAttempt(attemptId: string, deps: EvalDeps): Promise<BatchPollOutcome> {
  const jobs = await db.select().from(hwAiJob)
    .where(and(eq(hwAiJob.organizationId, EXAM_ORG_ID), eq(hwAiJob.kind, 'read'), eq(hwAiJob.status, 'batch_pending'), sql`${hwAiJob.payloadRef}::jsonb -> 'exam' ->> 'attemptId' = ${attemptId}`));
  const parts = jobs.map((j) => ({ job: j, p: (JSON.parse(j.payloadRef ?? '{}') as ExamBatchPayload).exam })).sort((a, b) => a.p.chunk - b.p.chunk);
  const now = deps.now();
  const results = new Map<string, NonNullable<ReturnType<Map<string, import('../ai').BatchEntry>['get']>>>();
  const spentByJob: { id: string; entries: AiResult[] }[] = [];
  let problem: string | null = null;
  let waiting = false;
  if (!parts.length || parts.length !== parts[0]!.p.chunks || !parts[0]!.p.metas) problem = 'the batch lost track of its parts';
  for (const { job, p } of parts) {
    if (problem) break;
    let o: BatchOutcome;
    try {
      o = await deps.batch!.poll(job.batchRef!, job.model ?? 'unknown');
    } catch (e) {
      if (now.getTime() > Date.parse(p.readBy)) problem = `the batch could not be checked and its time ran out (${describeError(e)})`;
      else waiting = true;
      continue;
    }
    if (o.state === 'failed') { problem = `the batch failed (${o.reason})`; continue; }
    if (o.state === 'pending') {
      if (now.getTime() > Date.parse(p.readBy)) problem = `the batch was not finished by ${p.readBy}`;
      else waiting = true;
      continue;
    }
    const entries: AiResult[] = [];
    for (const key of Object.keys(p.kinds)) {
      const e = o.results.get(key);
      if (e) results.set(key, e);
      if (e?.ok) entries.push(e.result);
    }
    spentByJob.push({ id: job.id, entries });
  }
  if (!problem && waiting) return { attemptId, state: 'waiting' };

  const kinds = Object.assign({}, ...parts.map((x) => x.p.kinds)) as Record<string, 'box' | 'page'>;
  if (!problem) {
    const failedKeys = Object.keys(kinds).filter((k) => !results.get(k)?.ok);
    if (failedKeys.length) problem = `${failedKeys.length} of ${Object.keys(kinds).length} reads in the batch failed`;
  }
  if (problem) {
    // what came back is still paid for; the batch is closed and the booklet read now
    await db.transaction(async (tx) => {
      for (const { job } of parts) {
        const spent = spentByJob.find((s) => s.id === job.id)?.entries ?? [];
        await bookBatchJob(tx, job.id, spent, `${'Re-run on the standard path'}: ${problem}`);
      }
    });
    const outcome = await evaluateClaimed(attemptId, deps, { standard: problem });
    return { attemptId, state: 'standard', reason: problem, outcome };
  }

  const spend: Spend = [];
  try {
    const m = await db.transaction((tx) => materialiseAttempt(tx, attemptId));
    const metas = parts[0]!.p.metas!;
    const outs = new Map<string, SheetOutput>();
    for (const [key, kind] of Object.entries(kinds)) {
      const e = results.get(key)!;
      if (!e.ok) continue;
      outs.set(key, kind === 'box' ? { kind: 'box', read: parseBoxRead(e.result.json) } : { kind: 'page', read: parsePageRead(e.result.json) });
    }
    const reads = pageReads(metas, outs);
    await keepReads(metas, reads, parts[0]!.job.model ?? 'unknown', 'batch');
    const { layout } = await sheetFor(db, m.setId);
    const placed = await place(m, layout, reads, deps, spend);
    const costPaise = await finish(attemptId, m, placed.answers, spend, metas.length, spentByJob);
    return { attemptId, state: 'done', outcome: { attemptId, ok: true, pages: metas.length, answers: tallyOf(placed.answers), review: placed.review, calls: spend.length + spentByJob.reduce((n, s) => n + s.entries.length, 0), costPaise } };
  } catch (e) {
    return { attemptId, state: 'done', outcome: await failed(attemptId, e, spend) };
  }
}

// ── cost and transcripts ─────────────────────────────────────────────────────

async function bookCost(tx: Exec, m: Materialised, spend: Spend, pagesRead: number): Promise<number> {
  if (!spend.length) return 0;
  const jobId = newId();
  await tx.insert(hwAiJob).values({
    id: jobId, organizationId: EXAM_ORG_ID, kind: 'read', status: 'done', submissionId: m.submissionId,
    provider: 'openai', model: spend[0]!.result.model, attempts: 1, startedAt: new Date(), finishedAt: new Date(), error: `exam booklet: ${spend.length} call(s)`,
  });
  for (const [i, s] of spend.entries()) {
    await recordUsage(tx, { jobId, orgId: EXAM_ORG_ID, model: s.result.model, usage: s.result.usage, batch: s.batch, costUsd: s.result.costUsd, pagesRead: i === 0 ? pagesRead : 0 });
  }
  const [j] = await tx.select({ paise: hwAiJob.costEstimatePaise }).from(hwAiJob).where(eq(hwAiJob.id, jobId));
  return Number(j?.paise ?? 0);
}

/** A batch's reads booked on its own job row, at batch prices; the row is closed (with why, when it was given up on). */
async function bookBatchJob(tx: Exec, jobId: string, entries: AiResult[], note?: string): Promise<number> {
  for (const r of entries) await recordUsage(tx, { jobId, orgId: EXAM_ORG_ID, model: r.model, usage: r.usage, batch: true, costUsd: r.costUsd });
  await tx.update(hwAiJob).set({ status: 'done', finishedAt: new Date(), lockedAt: null, lockedBy: null, error: note ?? `exam booklet batch: ${entries.length} read(s)` }).where(eq(hwAiJob.id, jobId));
  const [j] = await tx.select({ paise: hwAiJob.costEstimatePaise }).from(hwAiJob).where(eq(hwAiJob.id, jobId));
  return Number(j?.paise ?? 0);
}

async function writeAnswers(tx: Exec, m: Materialised, answers: Map<string, AnswerOutcome>): Promise<void> {
  const review: string[] = [];
  for (const q of m.questions) {
    const a = answers.get(q.answerId)!;
    const row = { id: q.answerId, organizationId: EXAM_ORG_ID };
    if (a.status === 'blank') {
      await setTranscript(tx, row, { text: '', status: 'done', source: 'reader', confidence: null, unclearCount: 0, engine: `exam:${EXAM_PAGE_READ_PROMPT_VERSION}`, reason: a.note });
    } else if (a.status === 'done' && q.handOnly) {
      await setTranscript(tx, row, { text: a.text, status: 'needs_review', source: 'reader', confidence: a.confidence, unclearCount: a.unclearCount, engine: `exam:${EXAM_PAGE_READ_PROMPT_VERSION}`, reason: `to be marked by a person: ${q.handOnly}` });
    } else if (a.status === 'done') {
      await setTranscript(tx, row, { text: a.text, status: 'done', source: 'reader', confidence: a.confidence, unclearCount: a.unclearCount, engine: `exam:${EXAM_PAGE_READ_PROMPT_VERSION}`, reason: null });
    } else {
      if (a.text) await setTranscript(tx, row, { text: a.text, status: 'needs_review', source: 'reader', confidence: a.confidence, unclearCount: a.unclearCount, engine: `exam:${EXAM_PAGE_READ_PROMPT_VERSION}`, reason: a.note });
      else review.push(q.answerId);
    }
  }
  if (review.length) await failAnswers(tx, review, 'no writing placed here, but some writing in the booklet could not be placed', 'needs_review');
}
