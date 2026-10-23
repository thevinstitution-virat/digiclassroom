// Teacher side of assignments: build, publish, close. Every function takes a resolved
// actor and checks access through access/guards.ts.

import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { institutionClasses, institutionSections, member } from '@/db/schema';
import { hwAiJob, hwAssignment, hwClassTeacher, hwQuestion, hwRubricItem, type HwAnswerMode, type HwLanguage, type HwQuestionType, type HwRubricKind } from '@/db/hw-schema';
import { assignmentForManage, requireHwEnabled, requireRole, teacherLinks } from '../access/guards';
import { canCreateFor, linkCovers, roleFromMember, type HwActor } from '../access/policy';
import { requireModel } from '../config';
import { HwError } from '../errors';
import { db, newId, num, type Exec } from '../db';
import { quotaAllows, quotaRefusal, quotaState } from '../cost/quota';
import { recordUsage } from '../cost/usage';
import { generate, textPart, usageFromError } from '../gemini/client';
import { complete, fail } from '../jobs/queue';
import { RUBRIC_PROMPT_VERSION, RUBRIC_RESPONSE_SCHEMA, RUBRIC_SYSTEM_PROMPT, rubricDraftInput } from '../prompts/rubric-draft.v1';
import { z } from 'zod';

export interface AssignmentInput {
  classId: string;
  sectionId: string | null;
  subject: string;
  title: string;
  instructions?: string | null;
  dueAt?: Date | null;
  allowedModes: HwAnswerMode[];
}

export interface QuestionInput {
  type: HwQuestionType;
  prompt: string;
  marks: number;
  modelAnswer?: string | null;
  acceptedAnswers?: string[];
  languageHint?: HwLanguage;
  answerLines?: number;
}

export interface RubricItemInput {
  kind: HwRubricKind;
  description: string;
  marks: number;
}

function requireDraft(a: { status: string }, what: string): void {
  if (a.status !== 'draft') throw new HwError('CONFLICT', `${what} can only be changed while the assignment is a draft.`);
}

/** Class and section must exist and belong to the caller's institution. */
async function checkClass(actor: HwActor, classId: string, sectionId: string | null): Promise<void> {
  const [c] = await db.select({ id: institutionClasses.id }).from(institutionClasses)
    .where(and(eq(institutionClasses.id, classId), eq(institutionClasses.organizationId, actor.orgId))).limit(1);
  if (!c) throw new HwError('NOT_FOUND', 'Class not found.');
  if (sectionId) {
    const [s] = await db.select({ id: institutionSections.id }).from(institutionSections)
      .where(and(eq(institutionSections.id, sectionId), eq(institutionSections.classId, classId), eq(institutionSections.organizationId, actor.orgId))).limit(1);
    if (!s) throw new HwError('NOT_FOUND', 'Section not found in this class.');
  }
}

// ── Listing ──────────────────────────────────────────────────────────────────

export async function listForTeacher(actor: HwActor, filter: { status?: 'draft' | 'published' | 'closed' }) {
  requireRole(actor, 'admin', 'teacher');
  await requireHwEnabled(actor);
  const rows = await db.select().from(hwAssignment)
    .where(and(eq(hwAssignment.organizationId, actor.orgId), filter.status ? eq(hwAssignment.status, filter.status) : undefined))
    .orderBy(desc(hwAssignment.createdAt));
  if (actor.role === 'admin') return rows;
  const links = await teacherLinks(actor);
  return rows.filter((a) => links.some((l) => linkCovers(l, a)));
}

export async function getForManage(actor: HwActor, assignmentId: string) {
  await requireHwEnabled(actor);
  const assignment = await assignmentForManage(actor, assignmentId);
  const questions = await db.select().from(hwQuestion).where(eq(hwQuestion.assignmentId, assignmentId)).orderBy(asc(hwQuestion.position));
  const rubric = questions.length
    ? await db.select().from(hwRubricItem)
      .where(and(inArray(hwRubricItem.questionId, questions.map((q) => q.id)), isNull(hwRubricItem.retiredAt)))
      .orderBy(asc(hwRubricItem.position))
    : [];
  return {
    assignment,
    questions: questions.map((q) => ({ ...q, rubric: rubric.filter((r) => r.questionId === q.id) })),
  };
}

// ── Assignment ───────────────────────────────────────────────────────────────

export async function createAssignment(actor: HwActor, input: AssignmentInput) {
  requireRole(actor, 'admin', 'teacher');
  await requireHwEnabled(actor);
  await checkClass(actor, input.classId, input.sectionId);
  if (!canCreateFor(actor, input, await teacherLinks(actor))) throw new HwError('FORBIDDEN', 'You do not teach this class and subject.');
  const id = newId();
  await db.insert(hwAssignment).values({
    id,
    organizationId: actor.orgId,
    classId: input.classId,
    sectionId: input.sectionId,
    subject: input.subject.trim(),
    title: input.title.trim(),
    instructions: input.instructions ?? null,
    dueAt: input.dueAt ?? null,
    allowedModes: input.allowedModes,
    createdBy: actor.userId,
  });
  return { id };
}

/** Draft: everything. Published: wording and due date only. */
export async function updateAssignment(actor: HwActor, assignmentId: string, patch: Partial<AssignmentInput>) {
  const a = await assignmentForManage(actor, assignmentId);
  const structural = patch.classId !== undefined || patch.sectionId !== undefined || patch.subject !== undefined || patch.allowedModes !== undefined;
  if (structural) requireDraft(a, 'Class, subject and answer modes');
  if (a.status === 'closed') throw new HwError('CONFLICT', 'A closed assignment cannot be edited. Reopen it first.');
  if (patch.classId !== undefined || patch.sectionId !== undefined) {
    await checkClass(actor, patch.classId ?? a.classId, patch.sectionId === undefined ? a.sectionId : patch.sectionId);
    const target = { classId: patch.classId ?? a.classId, sectionId: patch.sectionId === undefined ? a.sectionId : patch.sectionId, subject: patch.subject ?? a.subject };
    if (!canCreateFor(actor, target, await teacherLinks(actor))) throw new HwError('FORBIDDEN', 'You do not teach this class and subject.');
  }
  await db.update(hwAssignment).set({
    ...(patch.classId !== undefined ? { classId: patch.classId } : {}),
    ...(patch.sectionId !== undefined ? { sectionId: patch.sectionId } : {}),
    ...(patch.subject !== undefined ? { subject: patch.subject.trim() } : {}),
    ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
    ...(patch.instructions !== undefined ? { instructions: patch.instructions } : {}),
    ...(patch.dueAt !== undefined ? { dueAt: patch.dueAt } : {}),
    ...(patch.allowedModes !== undefined ? { allowedModes: patch.allowedModes } : {}),
  }).where(eq(hwAssignment.id, a.id));
}

export async function deleteAssignment(actor: HwActor, assignmentId: string) {
  const a = await assignmentForManage(actor, assignmentId);
  requireDraft(a, 'Only a draft');
  await db.delete(hwAssignment).where(eq(hwAssignment.id, a.id));
}

export async function publishAssignment(actor: HwActor, assignmentId: string) {
  const a = await assignmentForManage(actor, assignmentId);
  if (a.status === 'published') return { totalMarks: num(a.totalMarks), warnings: [] as string[] };
  const { questions } = await getForManage(actor, assignmentId);
  const warnings: string[] = [];
  for (const q of questions) {
    if (!q.rubric.length) warnings.push(`Question ${q.position + 1} has no marking scheme, so AI cannot suggest marks for it; you will mark it by hand.`);
    const sum = q.rubric.reduce((s, r) => s + num(r.marks), 0);
    if (q.rubric.length && sum < num(q.marks)) warnings.push(`Question ${q.position + 1}: the marking scheme adds up to ${sum} of ${num(q.marks)} marks.`);
  }
  try {
    const [row] = await db.update(hwAssignment).set({ status: 'published' }).where(eq(hwAssignment.id, a.id)).returning({ totalMarks: hwAssignment.totalMarks });
    return { totalMarks: num(row.totalMarks), warnings };
  } catch (e) {
    // The database trigger checks the same rules; turn its message into a clear refusal.
    throw new HwError('BAD_REQUEST', `Cannot publish: ${(e as Error).message}`);
  }
}

export async function setAssignmentOpen(actor: HwActor, assignmentId: string, open: boolean) {
  const a = await assignmentForManage(actor, assignmentId);
  if (a.status === 'draft') throw new HwError('CONFLICT', 'Publish the assignment first.');
  await db.update(hwAssignment).set({ status: open ? 'published' : 'closed' }).where(eq(hwAssignment.id, a.id));
}

// ── Questions ────────────────────────────────────────────────────────────────

async function questionForManage(actor: HwActor, questionId: string) {
  const [q] = await db.select().from(hwQuestion)
    .where(and(eq(hwQuestion.id, questionId), eq(hwQuestion.organizationId, actor.orgId))).limit(1);
  if (!q) throw new HwError('NOT_FOUND', 'Question not found.');
  const a = await assignmentForManage(actor, q.assignmentId);
  return { q, a };
}

export async function addQuestion(actor: HwActor, assignmentId: string, input: QuestionInput) {
  const a = await assignmentForManage(actor, assignmentId);
  requireDraft(a, 'Questions');
  const id = newId();
  await db.transaction(async (tx) => {
    const [{ next }] = await tx.select({ next: sql<number>`COALESCE(max(${hwQuestion.position}) + 1, 0)` })
      .from(hwQuestion).where(eq(hwQuestion.assignmentId, a.id));
    await tx.insert(hwQuestion).values({
      id,
      organizationId: actor.orgId,
      assignmentId: a.id,
      position: Number(next),
      type: input.type,
      prompt: input.prompt.trim(),
      marks: String(input.marks),
      modelAnswer: input.modelAnswer ?? null,
      acceptedAnswers: input.acceptedAnswers ?? [],
      languageHint: input.languageHint ?? 'en',
      answerLines: input.answerLines ?? 4,
    });
  });
  return { id };
}

export async function updateQuestion(actor: HwActor, questionId: string, patch: Partial<QuestionInput>) {
  const { q, a } = await questionForManage(actor, questionId);
  const structural = patch.type !== undefined || patch.marks !== undefined;
  if (structural) requireDraft(a, 'Question type and marks');
  if (a.status === 'closed') throw new HwError('CONFLICT', 'A closed assignment cannot be edited.');
  try {
    await db.update(hwQuestion).set({
      ...(patch.type !== undefined ? { type: patch.type } : {}),
      ...(patch.prompt !== undefined ? { prompt: patch.prompt.trim() } : {}),
      ...(patch.marks !== undefined ? { marks: String(patch.marks) } : {}),
      ...(patch.modelAnswer !== undefined ? { modelAnswer: patch.modelAnswer } : {}),
      ...(patch.acceptedAnswers !== undefined ? { acceptedAnswers: patch.acceptedAnswers } : {}),
      ...(patch.languageHint !== undefined ? { languageHint: patch.languageHint } : {}),
      ...(patch.answerLines !== undefined ? { answerLines: patch.answerLines } : {}),
    }).where(eq(hwQuestion.id, q.id));
  } catch (e) {
    throw new HwError('BAD_REQUEST', `Cannot change the question: ${(e as Error).message}`);
  }
}

export async function removeQuestion(actor: HwActor, questionId: string) {
  const { q, a } = await questionForManage(actor, questionId);
  requireDraft(a, 'Questions');
  await db.transaction(async (tx) => {
    await tx.delete(hwQuestion).where(eq(hwQuestion.id, q.id));
    await tx.execute(sql`
      UPDATE hw_question SET position = position - 1
       WHERE assignment_id = ${a.id} AND position > ${q.position}`);
  });
}

export async function reorderQuestions(actor: HwActor, assignmentId: string, orderedIds: string[]) {
  const a = await assignmentForManage(actor, assignmentId);
  requireDraft(a, 'Question order');
  const current = await db.select({ id: hwQuestion.id }).from(hwQuestion).where(eq(hwQuestion.assignmentId, a.id));
  const known = new Set(current.map((c) => c.id));
  if (orderedIds.length !== known.size || orderedIds.some((id) => !known.has(id)) || new Set(orderedIds).size !== orderedIds.length) {
    throw new HwError('BAD_REQUEST', 'The new order must list every question exactly once.');
  }
  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx.update(hwQuestion).set({ position: i }).where(eq(hwQuestion.id, orderedIds[i]));
    }
  });
}

// ── Rubric ───────────────────────────────────────────────────────────────────

/**
 * Replace a question's whole marking scheme. Old items are retired, never edited, and the
 * question's rubric_version goes up, so AI suggestions always point at the wording they judged.
 * Phase 1: drafts only (regrading after a published rubric changes is Phase 3).
 */
export async function setRubric(actor: HwActor, questionId: string, items: RubricItemInput[], source: 'teacher' | 'ai_draft' = 'teacher', x?: Exec) {
  const { q, a } = await questionForManage(actor, questionId);
  requireDraft(a, 'The marking scheme');
  const marks = num(q.marks);
  for (const it of items) {
    if (!(it.marks > 0) || it.marks > marks) throw new HwError('BAD_REQUEST', `Each key point must be worth more than 0 and at most ${marks} marks.`);
    if (!it.description.trim()) throw new HwError('BAD_REQUEST', 'Every key point needs a description.');
  }
  const run = async (tx: Exec) => {
    const [{ version }] = await tx.update(hwQuestion).set({ rubricVersion: sql`${hwQuestion.rubricVersion} + 1` })
      .where(eq(hwQuestion.id, q.id)).returning({ version: hwQuestion.rubricVersion });
    await tx.update(hwRubricItem).set({ retiredAt: new Date() }).where(and(eq(hwRubricItem.questionId, q.id), isNull(hwRubricItem.retiredAt)));
    if (items.length) {
      await tx.insert(hwRubricItem).values(items.map((it, i) => ({
        id: newId(),
        organizationId: actor.orgId,
        questionId: q.id,
        position: i,
        kind: it.kind,
        description: it.description.trim(),
        marks: String(it.marks),
        version,
        source,
      })));
    }
    return version;
  };
  const version = x ? await run(x) : await db.transaction(run);
  const sum = items.reduce((s, i) => s + i.marks, 0);
  return { rubricVersion: version, total: sum, matchesQuestion: sum === marks };
}

const RubricDraft = z.object({
  items: z.array(z.object({
    kind: z.enum(['key_point', 'content', 'structure', 'language']),
    description: z.string().min(1).max(1000),
    marks: z.number().positive(),
  })).min(1).max(10),
});

/**
 * Ask the cheap model to draft key points. Saved as editable items marked ai_draft; the
 * teacher reviews them before publishing. Runs synchronously (one small call) but is
 * recorded as a job so its tokens and cost are counted like everything else.
 */
export async function draftRubric(actor: HwActor, questionId: string, opts: { replace: boolean }) {
  const { q, a } = await questionForManage(actor, questionId);
  requireDraft(a, 'The marking scheme');
  const existing = await db.select({ id: hwRubricItem.id }).from(hwRubricItem)
    .where(and(eq(hwRubricItem.questionId, q.id), isNull(hwRubricItem.retiredAt))).limit(1);
  if (existing.length && !opts.replace) throw new HwError('CONFLICT', 'This question already has key points. Confirm to replace them with an AI draft.');

  const state = await quotaState(db, actor.orgId, 'grade');
  if (!quotaAllows(state, 1)) throw new HwError('QUOTA_EXCEEDED', quotaRefusal(state));

  const model = requireModel('rubric');
  const jobId = newId();
  await db.insert(hwAiJob).values({
    id: jobId, organizationId: actor.orgId, kind: 'rubric_draft', status: 'running', questionId: q.id,
    provider: 'gemini', model, attempts: 1, startedAt: new Date(),
    payloadRef: JSON.stringify({ promptVersion: RUBRIC_PROMPT_VERSION }),
  });
  const job = (await db.select().from(hwAiJob).where(eq(hwAiJob.id, jobId)))[0];

  try {
    const res = await generate({
      model,
      systemInstruction: RUBRIC_SYSTEM_PROMPT,
      schema: RUBRIC_RESPONSE_SCHEMA,
      parts: [textPart(rubricDraftInput({ type: q.type, prompt: q.prompt, marks: num(q.marks), modelAnswer: q.modelAnswer, languageHint: q.languageHint }))],
    });
    const parsed = RubricDraft.safeParse(res.json);
    if (!parsed.success) throw new HwError('INVALID_PROVIDER_OUTPUT', 'The AI draft could not be used.', `rubric draft failed validation: ${parsed.error.issues[0]?.message}`);
    const marks = num(q.marks);
    const items = parsed.data.items.map((it) => ({ ...it, marks: Math.min(marks, Math.max(0.5, Math.round(it.marks * 2) / 2)) }));
    return await db.transaction(async (tx) => {
      const note = await recordUsage(tx, { jobId, orgId: actor.orgId, model: res.model, usage: res.usage, batch: false });
      const result = await setRubric(actor, q.id, items, 'ai_draft', tx);
      await complete(tx, jobId, res.model, note);
      return { ...result, items };
    });
  } catch (e) {
    const billed = usageFromError(e);
    await db.transaction(async (tx) => {
      if (billed) await recordUsage(tx, { jobId, orgId: actor.orgId, model: billed.model, usage: billed.usage, batch: false });
      await fail(tx, { ...job, attempts: job.maxAttempts }, e);
    });
    throw e;
  }
}

// ── Teacher <-> class links (institution admin) ──────────────────────────────

export async function listClassTeachers(actor: HwActor) {
  requireRole(actor, 'admin');
  return db.select().from(hwClassTeacher).where(eq(hwClassTeacher.organizationId, actor.orgId));
}

export async function assignClassTeacher(actor: HwActor, input: { classId: string; sectionId: string | null; teacherId: string; subject: string | null }) {
  requireRole(actor, 'admin');
  await checkClass(actor, input.classId, input.sectionId);
  const [m] = await db.select({ role: member.role }).from(member)
    .where(and(eq(member.userId, input.teacherId), eq(member.organizationId, actor.orgId))).limit(1);
  if (!m || roleFromMember(m.role) !== 'teacher') throw new HwError('BAD_REQUEST', 'That person is not a teacher in this institution.');
  const id = newId();
  try {
    await db.insert(hwClassTeacher).values({
      id, organizationId: actor.orgId, classId: input.classId, sectionId: input.sectionId,
      teacherId: input.teacherId, subject: input.subject?.trim() || null, createdBy: actor.userId,
    });
  } catch (e) {
    if ((e as { code?: string }).code === '23505') throw new HwError('CONFLICT', 'This teacher is already linked to that class.');
    throw e;
  }
  return { id };
}

export async function removeClassTeacher(actor: HwActor, linkId: string) {
  requireRole(actor, 'admin');
  const res = await db.delete(hwClassTeacher)
    .where(and(eq(hwClassTeacher.id, linkId), eq(hwClassTeacher.organizationId, actor.orgId)))
    .returning({ id: hwClassTeacher.id });
  if (!res.length) throw new HwError('NOT_FOUND', 'Link not found.');
}
