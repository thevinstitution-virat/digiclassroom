// Super-admin side of the evaluator tools: raters, tasks from a dataset, assignment to
// raters, progress, and the export of finished work as reference data.
// The database enforces skills, rater counts and independence (migration 015); this file
// turns its refusals into readable messages.

import { randomInt, randomUUID } from 'node:crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { user } from '@/db/schema';
import { hwEvalAdjudication, hwEvalAssignment, hwEvalRater, hwEvalSubmission, hwEvalTask, type HwEvalTaskKind } from '@/db/hw-eval-schema';
import { HwError } from '../errors';
import { parseDatasetRef } from '../eval/dataset';
import { requireSuperAdmin, type EvalActor } from './access';
import { eligibleForTask } from './payloads';
import { evalSource } from './source';

/** Postgres refusals from migration 015's triggers and constraints, as HwErrors. */
export function dbRefusal(e: unknown): never {
  const pg = (e as { cause?: { code?: string; message?: string }; code?: string; message?: string });
  const code = pg.code ?? pg.cause?.code;
  const msg = pg.cause?.message ?? pg.message ?? 'refused';
  if (code === '23505') throw new HwError('CONFLICT', 'That already exists.', msg);
  if (code === '23514' || code === 'P0001' || code === '23001') throw new HwError('BAD_REQUEST', msg.replace(/^error: /, ''), msg);
  throw e;
}

const SKILL = /^(transcribe|deidentify|adjudicate|(mark|audit):[a-z][a-z ]{1,60})$/;
export function normaliseSkills(skills: readonly string[]): string[] {
  const out = [...new Set(skills.map((s) => s.trim().toLowerCase().replace(/\s+/g, ' ')).filter(Boolean))];
  const bad = out.filter((s) => !SKILL.test(s));
  if (bad.length) throw new HwError('BAD_REQUEST', `Unknown skills: ${bad.join(', ')}. Use transcribe, deidentify, adjudicate, mark:<subject>, audit:<subject>.`);
  return out.sort();
}

export async function listRaters(a: EvalActor) {
  requireSuperAdmin(a);
  const rows = await db.select({
    id: hwEvalRater.id, pseudonym: hwEvalRater.pseudonym, skills: hwEvalRater.skills, active: hwEvalRater.active,
    email: user.email, createdAt: hwEvalRater.createdAt,
  }).from(hwEvalRater).innerJoin(user, eq(user.id, hwEvalRater.userId)).orderBy(hwEvalRater.pseudonym);
  const load = await db.select({ raterId: hwEvalAssignment.raterId, pending: sql<number>`count(*) filter (where ${hwEvalAssignment.submittedAt} is null)::int`, done: sql<number>`count(${hwEvalAssignment.submittedAt})::int` })
    .from(hwEvalAssignment).groupBy(hwEvalAssignment.raterId);
  const by = new Map(load.map((l) => [l.raterId, l]));
  return rows.map((r) => ({ ...r, pending: by.get(r.id)?.pending ?? 0, done: by.get(r.id)?.done ?? 0 }));
}

export async function createRater(a: EvalActor, input: { email: string; pseudonym: string; skills: string[] }) {
  requireSuperAdmin(a);
  const [u] = await db.select({ id: user.id }).from(user).where(sql`lower(${user.email}) = ${input.email.trim().toLowerCase()}`).limit(1);
  if (!u) throw new HwError('NOT_FOUND', 'No account with that email. The person must sign up first.');
  try {
    const [r] = await db.insert(hwEvalRater).values({
      id: randomUUID(), pseudonym: input.pseudonym.trim(), userId: u.id, skills: normaliseSkills(input.skills), active: true, createdBy: a.userId,
    }).returning({ id: hwEvalRater.id });
    return r;
  } catch (e) {
    return dbRefusal(e);
  }
}

export async function updateRater(a: EvalActor, input: { raterId: string; skills?: string[]; active?: boolean }) {
  requireSuperAdmin(a);
  const set: Partial<typeof hwEvalRater.$inferInsert> = {};
  if (input.skills) set.skills = normaliseSkills(input.skills);
  if (input.active !== undefined) set.active = input.active;
  try {
    const r = await db.update(hwEvalRater).set(set).where(eq(hwEvalRater.id, input.raterId)).returning({ id: hwEvalRater.id });
    if (!r.length) throw new HwError('NOT_FOUND', 'Rater not found.');
    return r[0];
  } catch (e) {
    return dbRefusal(e);
  }
}

const REQUIRED: Record<HwEvalTaskKind, number> = { transcribe: 2, blind_mark: 2, key_audit: 1, deidentify: 1 };

/** Creates the tasks of one kind for a dataset version. Existing tasks are left alone. */
export async function createTasks(a: EvalActor, input: { datasetRef: string; kind: HwEvalTaskKind }) {
  requireSuperAdmin(a);
  parseDatasetRef(input.datasetRef);
  const items = await evalSource().items(input.datasetRef);
  const rows: (typeof hwEvalTask.$inferInsert)[] = [];
  if (input.kind === 'key_audit') {
    const seen = new Set<string>();
    for (const it of items) {
      const k = it.key?.keyId;
      if (!k || !/^[0-9a-f]{64}$/.test(k) || seen.has(k) || it.key?.source === 'official') continue;
      seen.add(k);
      rows.push({ id: randomUUID(), kind: 'key_audit', datasetRef: input.datasetRef, targetId: k, subject: it.subject, requiredRaters: 1, status: 'open', createdBy: a.userId });
    }
  } else {
    for (const it of items) {
      if (!eligibleForTask(input.kind, it)) continue;
      rows.push({
        id: randomUUID(), kind: input.kind, datasetRef: input.datasetRef, targetId: it.id,
        subject: input.kind === 'blind_mark' ? it.subject : null, requiredRaters: REQUIRED[input.kind], status: 'open', createdBy: a.userId,
      });
    }
  }
  if (!rows.length) return { created: 0, eligible: 0 };
  const created = await db.insert(hwEvalTask).values(rows).onConflictDoNothing().returning({ id: hwEvalTask.id });
  return { created: created.length, eligible: rows.length };
}

const skillFor = (kind: HwEvalTaskKind, subject: string | null) =>
  kind === 'blind_mark' ? `mark:${(subject ?? '').toLowerCase()}` : kind === 'key_audit' ? `audit:${(subject ?? '').toLowerCase()}` : kind;

/**
 * Fills open tasks with raters: each slot goes to the eligible active rater with the fewest
 * unfinished assignments who is not already on that task. Queue order is random per rater.
 */
export async function assignOpenTasks(a: EvalActor, input: { datasetRef: string }) {
  requireSuperAdmin(a);
  const tasks = await db.select({
    id: hwEvalTask.id, kind: hwEvalTask.kind, subject: hwEvalTask.subject, required: hwEvalTask.requiredRaters,
    have: sql<number>`(select count(*)::int from hw_eval_assignment x where x.task_id = ${hwEvalTask.id})`,
  }).from(hwEvalTask).where(and(eq(hwEvalTask.datasetRef, input.datasetRef), inArray(hwEvalTask.status, ['open', 'in_progress'])));
  const raters = await db.select({ id: hwEvalRater.id, skills: hwEvalRater.skills }).from(hwEvalRater).where(eq(hwEvalRater.active, true));
  const pending = new Map<string, number>((await db.select({ raterId: hwEvalAssignment.raterId, n: sql<number>`count(*)::int` })
    .from(hwEvalAssignment).where(sql`${hwEvalAssignment.submittedAt} is null`).groupBy(hwEvalAssignment.raterId)).map((r) => [r.raterId, r.n]));
  const onTask = new Map<string, Set<string>>();
  for (const r of await db.select({ taskId: hwEvalAssignment.taskId, raterId: hwEvalAssignment.raterId }).from(hwEvalAssignment)
    .where(inArray(hwEvalAssignment.taskId, tasks.length ? tasks.map((t) => t.id) : ['-']))) {
    onTask.set(r.taskId, (onTask.get(r.taskId) ?? new Set()).add(r.raterId));
  }

  let assigned = 0;
  const unfilled: string[] = [];
  for (const t of tasks) {
    for (let slot = t.have; slot < t.required; slot++) {
      const taken = onTask.get(t.id) ?? new Set<string>();
      const skill = skillFor(t.kind, t.subject);
      const pick = raters.filter((r) => r.skills.includes(skill) && !taken.has(r.id))
        .sort((x, y) => (pending.get(x.id) ?? 0) - (pending.get(y.id) ?? 0))[0];
      if (!pick) { unfilled.push(`${t.kind}${t.subject ? ` (${t.subject})` : ''}: no free rater with ${skill}`); break; }
      try {
        await db.insert(hwEvalAssignment).values({ id: randomUUID(), taskId: t.id, raterId: pick.id, orderIndex: randomInt(0, 1_000_000) });
      } catch (e) {
        try { dbRefusal(e); } catch (x) { unfilled.push((x as Error).message); break; }
      }
      taken.add(pick.id);
      onTask.set(t.id, taken);
      pending.set(pick.id, (pending.get(pick.id) ?? 0) + 1);
      assigned++;
    }
  }
  return { assigned, unfilled: [...new Set(unfilled)].slice(0, 20) };
}

export async function progress(a: EvalActor, input: { datasetRef: string }) {
  requireSuperAdmin(a);
  const rows = await db.select({ kind: hwEvalTask.kind, status: hwEvalTask.status, n: sql<number>`count(*)::int` })
    .from(hwEvalTask).where(eq(hwEvalTask.datasetRef, input.datasetRef)).groupBy(hwEvalTask.kind, hwEvalTask.status);
  return rows;
}

export async function datasetsWithTasks(a: EvalActor) {
  requireSuperAdmin(a);
  return (await db.selectDistinct({ ref: hwEvalTask.datasetRef }).from(hwEvalTask).orderBy(hwEvalTask.datasetRef)).map((r) => r.ref);
}

export interface ReferenceExport {
  datasetRef: string;
  exportedAt: string;
  /** Per item: the resolved value, how it was reached, and each rater's own value (by pseudonym). */
  transcripts: Record<string, { text: string; how: 'agreed' | 'adjudicated'; raters: Record<string, string> }>;
  marks: Record<string, { byPoint: Record<string, number>; how: 'agreed' | 'adjudicated'; raters: Record<string, Record<string, number>> }>;
  deidentification: Record<string, { verdict: 'clean' | 'needs_blanking'; regions: { x: number; y: number; w: number; h: number }[] }>;
  keyAudits: Record<string, { points: { id: string; verdict: string; note?: string }[]; missing: string[]; how: 'single' | 'adjudicated' }>;
}

/** Finished tasks of a dataset as reference data (scripts/hw-eval-reference.ts turns it into a new version). */
export async function exportReference(a: EvalActor, input: { datasetRef: string }): Promise<ReferenceExport> {
  requireSuperAdmin(a);
  const tasks = await db.select().from(hwEvalTask).where(and(eq(hwEvalTask.datasetRef, input.datasetRef), eq(hwEvalTask.status, 'done')));
  const ids = tasks.length ? tasks.map((t) => t.id) : ['-'];
  const subs = await db.select({ taskId: hwEvalAssignment.taskId, pseudonym: hwEvalRater.pseudonym, payload: hwEvalSubmission.payload })
    .from(hwEvalSubmission)
    .innerJoin(hwEvalAssignment, eq(hwEvalAssignment.id, hwEvalSubmission.assignmentId))
    .innerJoin(hwEvalRater, eq(hwEvalRater.id, hwEvalAssignment.raterId))
    .where(inArray(hwEvalAssignment.taskId, ids));
  const adjs = new Map((await db.select().from(hwEvalAdjudication).where(inArray(hwEvalAdjudication.taskId, ids))).map((x) => [x.taskId, x]));
  const out: ReferenceExport = { datasetRef: input.datasetRef, exportedAt: new Date().toISOString(), transcripts: {}, marks: {}, deidentification: {}, keyAudits: {} };
  for (const t of tasks) {
    const own = subs.filter((s) => s.taskId === t.id);
    if (!own.length) continue;
    const adj = adjs.get(t.id);
    const final = (adj?.payload ?? own[0].payload) as Record<string, unknown>;
    const how = adj ? 'adjudicated' as const : 'agreed' as const;
    if (t.kind === 'transcribe') {
      out.transcripts[t.targetId] = { text: String(final.text ?? ''), how, raters: Object.fromEntries(own.map((s) => [s.pseudonym, String(s.payload.text ?? '')])) };
    } else if (t.kind === 'blind_mark') {
      out.marks[t.targetId] = { byPoint: final.byPoint as Record<string, number>, how, raters: Object.fromEntries(own.map((s) => [s.pseudonym, s.payload.byPoint as Record<string, number>])) };
    } else if (t.kind === 'deidentify') {
      out.deidentification[t.targetId] = { verdict: final.verdict as 'clean' | 'needs_blanking', regions: (final.regions ?? []) as ReferenceExport['deidentification'][string]['regions'] };
    } else {
      out.keyAudits[t.targetId] = { points: final.points as { id: string; verdict: string }[], missing: (final.missing ?? []) as string[], how: adj ? 'adjudicated' : 'single' };
    }
  }
  return out;
}
