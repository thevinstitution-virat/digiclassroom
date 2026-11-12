// Phase 5: evaluating a handed-in booklet. The job runner calls runExamEvaluations every pass; each attempt it claims goes
//   uploaded -> evaluating: materialise its assignment (materialise.ts), read every page (verbatim, no answer key; by default as two
//   overlapping halves, two calls a page, HW_EXAMS_READ_SPLIT),
//   place the writing (assemble.ts + mapping.ts, with the text-only answer-key matcher for what is left and to check every answer placed by a
//   number the learner wrote), write one transcript per
//   question, and hand the submission to the marking pipeline that already exists (rules first, then strict marking jobs).
// The attempt stays 'evaluating' while it is marked; the report (phase 6) closes it.
//
// Cost: every call's usage is booked on a finished `read` job of the attempt's submission, so the attempt's cost is that job plus its grade
// jobs. Failure: retried on the next pass up to HW_EXAMS_EVAL_MAX_TRIES, then left for a person with the reason. A pass that dies half-way
// (a crash) is picked up again once it is stale. Nothing here runs unless HW_EXAMS_ENABLED.

import { and, asc, eq, sql } from 'drizzle-orm';
import { hwAiJob } from '@/db/hw-schema';
import { hwExamAttempt, hwExamPage } from '@/db/hw-exams-schema';
import { getHwConfig, requireModel } from '../config';
import { db, newId, type Exec } from '../db';
import { describeError } from '../errors';
import { recordUsage } from '../cost/usage';
import { failAnswers, finishSubmissionIfRead, setTranscript } from '../pipeline';
import { examPageStore } from '../storage/exam-pages';
import { assembleBooklet, type AnswerOutcome } from './assemble';
import { loadSharp, sharpHalfCropper, type HalfCropper } from './crop';
import { mergeHalves } from './halves';
import { readSheetPhoto } from './sheet-read';
import { materialiseAttempt, type Materialised } from './materialise';
import { EXAM_BOX_READ_PROMPT_VERSION, EXAM_PAGE_READ_PROMPT_VERSION, liveExamAi, type ExamAi, type PageRead, type PaperQuestionRef } from './page-reader';
import { sheetFor } from './learner';
import { EXAM_ORG_ID } from './space';
import type { AiResult } from '../ai';

export interface EvalDeps {
  ai: ExamAi;
  getObject(key: string): Promise<Uint8Array>;
  now(): Date;
  /** Cuts a page into two overlapping halves to read separately (HW_EXAMS_READ_SPLIT=halves); absent or null = read the whole page. */
  halves?: HalfCropper | null;
  /** sharp, for reading printed answer-sheet pages box by box (HW_EXAMS_SHEET_VISION); absent or null = every page is read as a page. */
  sharp?: typeof import('sharp') | null;
}

export async function liveEvalDeps(): Promise<EvalDeps> {
  const store = examPageStore();
  return {
    halves: getHwConfig().HW_EXAMS_READ_SPLIT === 'halves' ? await sharpHalfCropper() : null,
    sharp: getHwConfig().HW_EXAMS_SHEET_VISION ? await loadSharp() : null,
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
  | { attemptId: string; ok: false; error: string; final: boolean };

const TRY = /^eval try (\d+)\//;

/** Puts back attempts whose evaluation died half-way (still 'evaluating', answers still pending, untouched for a while). */
async function recoverStale(x: Exec): Promise<number> {
  const stale = getHwConfig().HW_JOB_STALE_MINUTES;
  const r = await x.execute(sql`
    UPDATE hw_exam_attempt a SET status = 'uploaded'
     WHERE a.status = 'evaluating' AND a.updated_at < now() - (${stale} * interval '1 minute')
       AND (a.failure_reason IS NULL OR a.failure_reason NOT LIKE 'eval failed:%')
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

/** Evaluates one attempt the caller has already moved to 'evaluating'. Never throws: a failure is recorded on the attempt. */
export async function evaluateClaimed(attemptId: string, deps: EvalDeps): Promise<EvalOutcome> {
  const calls: AiResult[] = [];
  try {
    const m = await db.transaction((tx) => materialiseAttempt(tx, attemptId));
    const result = await readAndPlace(attemptId, m, deps, calls);
    const costPaise = await db.transaction(async (tx) => {
      const paise = await bookCost(tx, m, calls, result.pages);
      await writeAnswers(tx, m, result.answers);
      await finishSubmissionIfRead(tx, m.submissionId); // the marking pipeline takes it from here
      await tx.update(hwExamAttempt).set({ failureReason: null }).where(eq(hwExamAttempt.id, attemptId));
      return paise;
    });
    const tally: Record<AnswerOutcome['status'], number> = { done: 0, needs_review: 0, blank: 0 };
    for (const a of result.answers.values()) tally[a.status]++;
    return { attemptId, ok: true, pages: result.pages, answers: tally, review: result.review, calls: calls.length, costPaise };
  } catch (e) {
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
    if (calls.length) {
      try {
        const m = await db.transaction((tx) => materialiseAttempt(tx, attemptId));
        await db.transaction((tx) => bookCost(tx, m, calls, 0));
      } catch { /* the failure above is what matters */ }
    }
    console.error(`[hw-exams] evaluation of ${attemptId} failed (${tries}/${max}): ${msg}`);
    return { attemptId, ok: false, error: msg, final };
  }
}

async function readAndPlace(attemptId: string, m: Materialised, deps: EvalDeps, calls: AiResult[]) {
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
  const reads: { pageId: string; position: number; read: PageRead }[] = [];
  for (const p of pages) {
    const image = await deps.getObject(p.imageKey);
    let read: PageRead | null = null;
    let model = 'code';
    let how: 'sheet' | 'halves' | 'page' = 'sheet';
    let sheetFallback: string | null = null;
    if (deps.sharp && deps.ai.readBox) {
      // a printed answer-sheet page: code finds it, reads the grid and picks the boxes with writing; the reader transcribes each box
      const r = await readSheetPhoto({ image, layout: sheet.layout, questions: refs, lang: m.lang, ai: deps.ai, sharp: deps.sharp });
      calls.push(...r.calls);
      if (r.ok) { read = r.read; model = r.calls[0]?.model ?? 'code'; } else sheetFallback = r.reason;
    }
    // not a printed sheet page (or one code could not square up): read as a page, in halves by default
    const halves = read ? null : deps.halves ? await deps.halves(image) : null;
    if (!read && halves) {
      how = 'halves';
      // two overlapping halves, each read at about twice the detail, joined at the seam (halves.ts)
      const top = await deps.ai.readPage({ image: halves[0], mime: 'image/jpeg', questions: refs, lang: m.lang });
      calls.push(top.result);
      const bottom = await deps.ai.readPage({ image: halves[1], mime: 'image/jpeg', questions: refs, lang: m.lang });
      calls.push(bottom.result);
      read = mergeHalves(top.read, bottom.read);
      model = top.result.model;
    } else if (!read) {
      how = 'page';
      const whole = await deps.ai.readPage({ image, mime: p.mimeType, questions: refs, lang: m.lang });
      calls.push(whole.result);
      read = whole.read;
      model = whole.result.model;
    }
    reads.push({ pageId: p.id, position: p.position, read: read! });
    // kept with the page for the report and for a person checking it
    const prompt = how === 'sheet' ? EXAM_BOX_READ_PROMPT_VERSION : EXAM_PAGE_READ_PROMPT_VERSION;
    await db.update(hwExamPage).set({ quality: sql`${hwExamPage.quality} || ${JSON.stringify({ read: { ...read!, model, prompt, split: how, ...(sheetFallback ? { sheetFallback } : {}) } })}::jsonb` })
      .where(eq(hwExamPage.id, p.id));
  }

  const sheetPageNumbers = new Map(sheet.layout.pages.map((p) => [p.page, p.numbers]));
  const minConfidence = getHwConfig().HW_READ_ESCALATE_BELOW;
  const qs = m.questions.map((q) => ({ answerId: q.answerId, number: q.number, alt: q.alt, choice: q.choice, options: q.options }));
  let a = assembleBooklet({ code: sheet.layout.code, sheetPageNumbers, questions: qs, pages: reads, minConfidence });
  if (a.needMatch.length) {
    const byNumber = new Map<number, { number: number; question: string; modelAnswer: string }>();
    for (const q of m.questions) {
      const cur = byNumber.get(q.number);
      byNumber.set(q.number, cur
        ? { ...cur, question: `${cur.question}\nOR ${q.prompt}`, modelAnswer: `${cur.modelAnswer}\nOR ${q.modelAnswer}` }
        : { number: q.number, question: q.prompt, modelAnswer: q.modelAnswer });
    }
    const { matches, result } = await deps.ai.matchAnswers({ questions: [...byNumber.values()], answers: a.needMatch });
    calls.push(result);
    a = assembleBooklet({ code: sheet.layout.code, sheetPageNumbers, questions: qs, pages: reads, minConfidence, matches });
  }
  // what a person must look at, kept with the page it is on (the report shows it: "page 2 could not be read")
  for (const r of reads) {
    const items = a.review.filter((x) => x.pageId === r.pageId).map((x) => ({ reason: x.reason, detail: x.detail }));
    await db.update(hwExamPage).set({ quality: sql`${hwExamPage.quality} || ${JSON.stringify({ review: items })}::jsonb` }).where(eq(hwExamPage.id, r.pageId));
  }
  return { answers: a.answers, pages: pages.length, review: a.review.length };
}

async function bookCost(tx: Exec, m: Materialised, calls: AiResult[], pagesRead: number): Promise<number> {
  if (!calls.length) return 0;
  const jobId = newId();
  await tx.insert(hwAiJob).values({
    id: jobId, organizationId: EXAM_ORG_ID, kind: 'read', status: 'done', submissionId: m.submissionId,
    provider: 'openai', model: calls[0]!.model, attempts: 1, startedAt: new Date(), finishedAt: new Date(), error: `exam booklet: ${calls.length} call(s)`,
  });
  for (const [i, c] of calls.entries()) {
    await recordUsage(tx, { jobId, orgId: EXAM_ORG_ID, model: c.model, usage: c.usage, batch: false, costUsd: c.costUsd, pagesRead: i === 0 ? pagesRead : 0 });
  }
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
