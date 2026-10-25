// Rater side of the evaluator tools: the queue, one task at a time, submission, and
// adjudication of disagreements.
//
// What a rater sees is built here and only here:
//   - never another rater's submission for the same task (adjudicators excepted, and they
//     see "Rater A / Rater B", not pseudonyms);
//   - never AI output: views are built from the dataset item and the cached key only, and
//     eval run results are never read here;
//   - images are served through /api/hw-eval/media after the same ownership check.

import { randomUUID } from 'node:crypto';
import { and, asc, eq, isNull, notExists, sql } from 'drizzle-orm';
import { db } from '@/db';
import { hwEvalAdjudication, hwEvalAssignment, hwEvalSubmission, hwEvalTask, type HwEvalTaskKind } from '@/db/hw-eval-schema';
import { HwError } from '../errors';
import type { EvalItem } from '../eval/dataset';
import { requireRater, type EvalActor, type EvalRater } from './access';
import { dbRefusal } from './admin';
import { markDiff, outcomeOf, parsePayload, transcriptDiff, type PayloadContext, type TaskPayload } from './payloads';
import { evalSource } from './source';

const skillFor = (kind: HwEvalTaskKind, subject: string | null) =>
  kind === 'blind_mark' ? `mark:${(subject ?? '').toLowerCase()}` : kind === 'key_audit' ? `audit:${(subject ?? '').toLowerCase()}` : kind;

export async function myQueue(a: EvalActor) {
  const r = requireRater(a);
  const pending = await db.select({ assignmentId: hwEvalAssignment.id, kind: hwEvalTask.kind, subject: hwEvalTask.subject, datasetRef: hwEvalTask.datasetRef, startedAt: hwEvalAssignment.startedAt })
    .from(hwEvalAssignment).innerJoin(hwEvalTask, eq(hwEvalTask.id, hwEvalAssignment.taskId))
    .where(and(eq(hwEvalAssignment.raterId, r.id), isNull(hwEvalAssignment.submittedAt), sql`${hwEvalTask.status} <> 'cancelled'`))
    .orderBy(asc(hwEvalAssignment.orderIndex));
  const [{ done }] = await db.select({ done: sql<number>`count(*)::int` }).from(hwEvalAssignment)
    .where(and(eq(hwEvalAssignment.raterId, r.id), sql`${hwEvalAssignment.submittedAt} is not null`));
  const adjudications = r.skills.includes('adjudicate') ? (await adjudicationCandidates(r)).length : 0;
  return { pseudonym: r.pseudonym, skills: r.skills, pending, done, adjudications };
}

async function ownAssignment(r: EvalRater, assignmentId: string) {
  const [row] = await db.select({ a: hwEvalAssignment, t: hwEvalTask }).from(hwEvalAssignment)
    .innerJoin(hwEvalTask, eq(hwEvalTask.id, hwEvalAssignment.taskId))
    .where(and(eq(hwEvalAssignment.id, assignmentId), eq(hwEvalAssignment.raterId, r.id))).limit(1);
  if (!row) throw new HwError('NOT_FOUND', 'Task not found.');
  if (row.t.status === 'cancelled') throw new HwError('CONFLICT', 'This task was cancelled.');
  return row;
}

async function itemOf(datasetRef: string, itemId: string): Promise<EvalItem> {
  const it = (await evalSource().items(datasetRef)).find((x) => x.id === itemId);
  if (!it) throw new HwError('NOT_FOUND', 'The item is not in its dataset.');
  return it;
}

/** The task as a rater sees it. Media is referenced, not embedded. */
async function taskView(t: typeof hwEvalTask.$inferSelect, mediaQuery: string) {
  if (t.kind === 'key_audit') {
    const key = await evalSource().key(t.targetId);
    if (!key) throw new HwError('NOT_FOUND', 'The answer key is not available.');
    const items = await evalSource().items(t.datasetRef);
    const q = items.find((x) => x.key?.keyId === t.targetId);
    return {
      kind: t.kind,
      question: q ? { text: q.question.text, marks: q.question.marks, type: q.questionType, class: q.class, subject: q.subject, medium: q.medium } : null,
      source: key.source,
      referenceAnswer: key.key.referenceAnswer,
      points: key.key.valuePoints.map((p) => ({ id: p.id, text: p.text, marks: p.marks, kind: p.kind, cites: p.cites, acceptedAlternatives: p.acceptedAlternatives })),
      passages: key.passages.map((p) => ({ id: p.id, text: p.text, citation: key.citations.find((c) => c.chunkId === p.id)?.citationFormat ?? null })),
    };
  }
  const it = await itemOf(t.datasetRef, t.targetId);
  const image = it.media.photo || it.media.render ? `/api/hw-eval/media?${mediaQuery}` : null;
  if (t.kind === 'transcribe') return { kind: t.kind, image, language: it.language };
  if (t.kind === 'deidentify') return { kind: t.kind, image };
  // blind_mark: the answer as the student wrote it, the question and the key. Nothing from any AI run.
  return {
    kind: t.kind,
    image,
    typedText: image ? null : it.truthTranscript?.text ?? null,
    question: { text: it.question.text, marks: it.question.marks, passageText: it.question.passageText ?? null, type: it.questionType, class: it.class, subject: it.subject, medium: it.medium },
    referenceAnswer: it.key?.referenceAnswer ?? null,
    points: (it.key?.points ?? []).map((p) => ({ id: p.id, text: p.text ?? '', marks: p.marks, acceptedAlternatives: p.acceptedAlternatives ?? [] })),
  };
}

async function payloadContext(t: typeof hwEvalTask.$inferSelect): Promise<PayloadContext> {
  if (t.kind === 'blind_mark') {
    const it = await itemOf(t.datasetRef, t.targetId);
    return { points: (it.key?.points ?? []).map((p) => ({ id: p.id, marks: p.marks })) };
  }
  if (t.kind === 'key_audit') {
    const key = await evalSource().key(t.targetId);
    return { points: (key?.key.valuePoints ?? []).map((p) => ({ id: p.id, marks: p.marks })) };
  }
  return {};
}

export async function openAssignment(a: EvalActor, assignmentId: string) {
  const r = requireRater(a);
  const row = await ownAssignment(r, assignmentId);
  if (row.a.submittedAt) throw new HwError('CONFLICT', 'You have already submitted this task.');
  if (!row.a.startedAt) await db.update(hwEvalAssignment).set({ startedAt: new Date() }).where(and(eq(hwEvalAssignment.id, assignmentId), isNull(hwEvalAssignment.startedAt)));
  return { assignmentId, view: await taskView(row.t, `assignment=${encodeURIComponent(assignmentId)}`) };
}

export async function submitAssignment(a: EvalActor, input: { assignmentId: string; payload: unknown; timeMs: number }) {
  const r = requireRater(a);
  const row = await ownAssignment(r, input.assignmentId);
  if (row.a.submittedAt) throw new HwError('CONFLICT', 'You have already submitted this task.');
  const parsed = parsePayload(row.t.kind, input.payload, await payloadContext(row.t));
  if (!parsed.ok) throw new HwError('BAD_REQUEST', `This answer cannot be saved: ${parsed.problem}.`);
  try {
    return await db.transaction(async (tx) => {
      // Lock the task so two raters finishing together decide its outcome once.
      await tx.execute(sql`SELECT 1 FROM hw_eval_task WHERE id = ${row.t.id} FOR UPDATE`);
      await tx.insert(hwEvalSubmission).values({ id: randomUUID(), assignmentId: input.assignmentId, payload: parsed.payload as Record<string, unknown>, timeMs: Math.max(0, Math.min(86_400_000, Math.round(input.timeMs))) });
      const subs = await tx.select({ payload: hwEvalSubmission.payload }).from(hwEvalSubmission)
        .innerJoin(hwEvalAssignment, eq(hwEvalAssignment.id, hwEvalSubmission.assignmentId)).where(eq(hwEvalAssignment.taskId, row.t.id));
      const status = subs.length >= row.t.requiredRaters ? outcomeOf(row.t.kind, subs.map((s) => s.payload as TaskPayload)) : 'in_progress';
      await tx.update(hwEvalTask).set({ status }).where(eq(hwEvalTask.id, row.t.id));
      return { status };
    });
  } catch (e) {
    if (e instanceof HwError) throw e;
    return dbRefusal(e);
  }
}

/** Tasks this rater may adjudicate: disputed, not their own, and within their skills. */
async function adjudicationCandidates(r: EvalRater) {
  if (!r.skills.includes('adjudicate')) return [];
  const rows = await db.select({ id: hwEvalTask.id, kind: hwEvalTask.kind, subject: hwEvalTask.subject, datasetRef: hwEvalTask.datasetRef })
    .from(hwEvalTask)
    .where(and(
      eq(hwEvalTask.status, 'needs_adjudication'),
      notExists(db.select({ x: sql`1` }).from(hwEvalAssignment).where(and(eq(hwEvalAssignment.taskId, hwEvalTask.id), eq(hwEvalAssignment.raterId, r.id)))),
      notExists(db.select({ x: sql`1` }).from(hwEvalAdjudication).where(eq(hwEvalAdjudication.taskId, hwEvalTask.id))),
    )).orderBy(asc(hwEvalTask.createdAt)).limit(500);
  return rows.filter((t) => r.skills.includes(skillFor(t.kind, t.subject)));
}

export async function adjudicationQueue(a: EvalActor) {
  return adjudicationCandidates(requireRater(a));
}

async function adjudicableTask(r: EvalRater, taskId: string) {
  const t = (await adjudicationCandidates(r)).find((x) => x.id === taskId);
  if (!t) throw new HwError('NOT_FOUND', 'This task is not waiting for you to adjudicate.');
  const [full] = await db.select().from(hwEvalTask).where(eq(hwEvalTask.id, taskId)).limit(1);
  return full;
}

export async function openAdjudication(a: EvalActor, taskId: string) {
  const r = requireRater(a);
  const t = await adjudicableTask(r, taskId);
  const subs = await db.select({ payload: hwEvalSubmission.payload, orderIndex: hwEvalAssignment.orderIndex }).from(hwEvalSubmission)
    .innerJoin(hwEvalAssignment, eq(hwEvalAssignment.id, hwEvalSubmission.assignmentId))
    .where(eq(hwEvalAssignment.taskId, t.id)).orderBy(asc(hwEvalSubmission.createdAt));
  const labelled = subs.map((s, i) => ({ label: `Rater ${String.fromCharCode(65 + i)}`, payload: s.payload }));
  const diff = t.kind === 'transcribe' && labelled.length === 2
    ? { words: transcriptDiff(String(labelled[0].payload.text ?? ''), String(labelled[1].payload.text ?? '')) }
    : t.kind === 'blind_mark' && labelled.length === 2
      ? { marks: markDiff(labelled[0].payload.byPoint as Record<string, number>, labelled[1].payload.byPoint as Record<string, number>) }
      : null;
  return { taskId, view: await taskView(t, `task=${encodeURIComponent(taskId)}`), submissions: labelled, diff };
}

export async function submitAdjudication(a: EvalActor, input: { taskId: string; payload: unknown; reason: string; timeMs: number }) {
  const r = requireRater(a);
  const t = await adjudicableTask(r, input.taskId);
  const parsed = parsePayload(t.kind, input.payload, await payloadContext(t));
  if (!parsed.ok) throw new HwError('BAD_REQUEST', `This decision cannot be saved: ${parsed.problem}.`);
  if (!input.reason.trim()) throw new HwError('BAD_REQUEST', 'Say briefly why.');
  try {
    await db.transaction(async (tx) => {
      await tx.insert(hwEvalAdjudication).values({ id: randomUUID(), taskId: t.id, adjudicatorRaterId: r.id, payload: parsed.payload as Record<string, unknown>, reason: input.reason.trim().slice(0, 2000), timeMs: Math.max(0, Math.min(86_400_000, Math.round(input.timeMs))) });
      await tx.update(hwEvalTask).set({ status: 'done' }).where(eq(hwEvalTask.id, t.id));
    });
    return { status: 'done' as const };
  } catch (e) {
    return dbRefusal(e);
  }
}

const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };

/** Image bytes for a task the caller is assigned to, or may adjudicate. */
export async function taskMedia(a: EvalActor, q: { assignmentId?: string; taskId?: string }): Promise<{ bytes: Uint8Array; mime: string }> {
  const r = requireRater(a);
  let t: typeof hwEvalTask.$inferSelect;
  if (q.assignmentId) t = (await ownAssignment(r, q.assignmentId)).t;
  else if (q.taskId) t = await adjudicableTask(r, q.taskId);
  else throw new HwError('BAD_REQUEST', 'Which task?');
  if (t.kind === 'key_audit') throw new HwError('NOT_FOUND', 'This task has no image.');
  const it = await itemOf(t.datasetRef, t.targetId);
  const rel = it.media.photo ?? it.media.render;
  if (!rel) throw new HwError('NOT_FOUND', 'This item has no image.');
  const mime = MIME[rel.split('.').pop()?.toLowerCase() ?? ''];
  if (!mime) throw new HwError('BAD_REQUEST', 'Unsupported image type.');
  return { bytes: await evalSource().media(t.datasetRef, rel), mime };
}
