// Teacher side of assignments: build, publish, close. Every function takes a resolved
// actor and checks access through access/guards.ts.

import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { institutionClasses, institutionSections, member, user } from '@/db/schema';
import { hwAiJob, hwAssignment, hwClassTeacher, hwQuestion, hwRubricItem, type HwAnswerMode, type HwLanguage, type HwQuestionOrigin, type HwQuestionType, type HwRubricKind } from '@/db/hw-schema';
import { assignmentForManage, requireHwEnabled, requireRole, teacherLinks } from '../access/guards';
import { canCreateFor, linkCovers, roleFromMember, type HwActor } from '../access/policy';
import { requireModel } from '../config';
import { HwError } from '../errors';
import { db, newId, num, type Exec } from '../db';
import { loadScope, requireScope } from '../tenant-scope';
import { quotaAllows, quotaRefusal, quotaState } from '../cost/quota';
import { replaceRubric } from './rubric-store';
import { currentKeys, keyViewOf, queueKey, switchToTeacher } from '../keys/product';
import { aiOffMessage } from '../eligibility/decision';
import { eligibilityOfQuestion } from '../eligibility/registry';
import { recordUsage } from '../cost/usage';
import { generate, providerFor, routed, textPart, usageFromError } from '../ai';
import { complete, fail } from '../jobs/queue';
import { RUBRIC_PROMPT_VERSION, RUBRIC_RESPONSE_SCHEMA, RUBRIC_SYSTEM_PROMPT, rubricDraftInput } from '../prompts/rubric-draft.v2';
import { draftBlockedReason, publishBlockedByDraft } from '../rubric-draft-rules';
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
  /** Where the question comes from; a textbook exercise or a board paper is public, a custom question is the teacher's own (default). */
  origin?: HwQuestionOrigin;
  /** textbook_exercise: {book, chapter, exercise}; board_paper: {paper, year, questionNo}. */
  originRef?: Record<string, string>;
  /** The passage the question is about (a case, a source, a reading text); a key may be built from it. */
  passage?: string | null;
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
  const keys = await currentKeys(db, questions.map((q) => q.id));
  return {
    assignment,
    questions: questions.map((q) => ({ ...q, rubric: rubric.filter((r) => r.questionId === q.id), key: keyViewOf(q, keys.get(q.id)) })),
  };
}

// ── Assignment ───────────────────────────────────────────────────────────────

export async function createAssignment(actor: HwActor, input: AssignmentInput) {
  requireRole(actor, 'admin', 'teacher');
  await requireHwEnabled(actor);
  await checkClass(actor, input.classId, input.sectionId);
  // Roadmap 5.1: for every role, an institution restricted to some classes cannot make an assignment outside them.
  await requireScope(db, actor.orgId, input.classId, input.sectionId);
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
  if (a.status === 'published') return { totalMarks: num(a.totalMarks), warnings: [] as string[], handMarked: [] as HandMarked[] };
  const { questions } = await getForManage(actor, assignmentId);
  const blank = questions.filter((q) => !q.prompt.trim()).map((q) => q.position + 1);
  if (blank.length) throw new HwError('BAD_REQUEST', `Write the question text for question ${blank.join(', ')} before publishing.`);
  // Key points the AI drafted and the teacher has not saved yet are not a marking scheme the teacher has checked.
  const unchecked = publishBlockedByDraft(questions);
  if (unchecked) throw new HwError('CONFLICT', unchecked);
  const warnings: string[] = [];
  for (const q of questions) {
    if (!q.rubric.length) warnings.push(`Question ${q.position + 1} has no marking scheme, so AI cannot suggest marks for it; you will mark it by hand.`);
    const sum = q.rubric.reduce((s, r) => s + num(r.marks), 0);
    if (q.rubric.length && sum < num(q.marks)) warnings.push(`Question ${q.position + 1}: the marking scheme adds up to ${sum} of ${num(q.marks)} marks.`);
  }
  // Key status never blocks publishing; the teacher is told which questions will be marked by hand, and why.
  const handMarked = await handMarkedList(questions.map((q) => ({ id: q.id, position: q.position })));
  try {
    const [row] = await db.update(hwAssignment).set({ status: 'published' }).where(eq(hwAssignment.id, a.id)).returning({ totalMarks: hwAssignment.totalMarks });
    return { totalMarks: num(row.totalMarks), warnings, handMarked };
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
      origin: input.origin ?? 'custom',
      originRef: input.originRef ?? {},
      passage: input.passage?.trim() || null,
      // A new question is marked against an answer key built for it; "use my own rubric" switches it to the teacher's.
      rubricMode: 'key',
    });
    const [row] = await tx.select().from(hwQuestion).where(eq(hwQuestion.id, id)).limit(1);
    await queueKey(tx, row, actor.userId);
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
      ...(patch.origin !== undefined ? { origin: patch.origin } : {}),
      ...(patch.originRef !== undefined ? { originRef: patch.originRef } : {}),
      ...(patch.passage !== undefined ? { passage: patch.passage?.trim() || null } : {}),
    }).where(eq(hwQuestion.id, q.id));
    // A change to anything the key was built from makes the key stale: build a new one.
    const changesKey = ['prompt', 'type', 'marks', 'languageHint', 'origin', 'originRef', 'passage'].some((k) => (patch as Record<string, unknown>)[k] !== undefined);
    if (changesKey) {
      const [row] = await db.select().from(hwQuestion).where(eq(hwQuestion.id, q.id)).limit(1);
      await db.transaction((tx) => queueKey(tx, row, actor.userId));
    }
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
    // Writing a rubric by hand (or having the AI draft one) is choosing the teacher's own rubric over the answer key.
    await switchToTeacher(tx, q.id);
    return replaceRubric(tx, actor.orgId, q.id, items, source);
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
  // "Draft with AI" is for the teacher's own rubric only; a question with an answer key shows the key instead (roadmap 5.2).
  if (q.rubricMode === 'key') throw new HwError('CONFLICT', 'This question uses an answer key. Choose "Use my own rubric instead" first if you want to write or draft key points yourself.');
  // The draft comes only from the teacher's model answer (prompt rubric-draft.v2); without one there is nothing to draft from.
  const blocked = draftBlockedReason(q);
  if (blocked) throw new HwError('BAD_REQUEST', blocked);
  const existing = await db.select({ id: hwRubricItem.id }).from(hwRubricItem)
    .where(and(eq(hwRubricItem.questionId, q.id), isNull(hwRubricItem.retiredAt))).limit(1);
  if (existing.length && !opts.replace) throw new HwError('CONFLICT', 'This question already has key points. Confirm to replace them with an AI draft.');

  const state = await quotaState(db, actor.orgId, 'grade');
  if (!quotaAllows(state, 1)) throw new HwError('QUOTA_EXCEEDED', quotaRefusal(state));

  const model = requireModel('rubric');
  const jobId = newId();
  await db.insert(hwAiJob).values({
    id: jobId, organizationId: actor.orgId, kind: 'rubric_draft', status: 'running', questionId: q.id,
    provider: providerFor('rubric'), model, attempts: 1, startedAt: new Date(),
    payloadRef: JSON.stringify({ promptVersion: RUBRIC_PROMPT_VERSION }),
  });
  const job = (await db.select().from(hwAiJob).where(eq(hwAiJob.id, jobId)))[0];

  try {
    const res = await generate(routed({
      model,
      systemInstruction: RUBRIC_SYSTEM_PROMPT,
      schema: RUBRIC_RESPONSE_SCHEMA,
      parts: [textPart(rubricDraftInput({ type: q.type, prompt: q.prompt, marks: num(q.marks), modelAnswer: q.modelAnswer as string, languageHint: q.languageHint }))],
    }, 'rubric'));
    const parsed = RubricDraft.safeParse(res.json);
    if (!parsed.success) throw new HwError('INVALID_PROVIDER_OUTPUT', 'The AI draft could not be used.', `rubric draft failed validation: ${parsed.error.issues[0]?.message}`);
    const marks = num(q.marks);
    const items = parsed.data.items.map((it) => ({ ...it, marks: Math.min(marks, Math.max(0.5, Math.round(it.marks * 2) / 2)) }));
    return await db.transaction(async (tx) => {
      const note = await recordUsage(tx, { jobId, orgId: actor.orgId, model: res.model, usage: res.usage, costUsd: res.costUsd, batch: false });
      const result = await setRubric(actor, q.id, items, 'ai_draft', tx);
      await complete(tx, jobId, res.model, note);
      return { ...result, items };
    });
  } catch (e) {
    const billed = usageFromError(e);
    await db.transaction(async (tx) => {
      if (billed) await recordUsage(tx, { jobId, orgId: actor.orgId, model: billed.model, usage: billed.usage, costUsd: billed.costUsd, batch: false });
      await fail(tx, { ...job, attempts: job.maxAttempts }, e);
    });
    throw e;
  }
}

// ── Answer keys (roadmap 5.2) ────────────────────────────────────────────────

export interface HandMarked { questionId: string; position: number; reason: string; message: string }

/** Which of these questions will have no AI suggestion right now, and why (the registry and the key, as marking will see them). */
async function handMarkedList(qs: { id: string; position: number }[]): Promise<HandMarked[]> {
  const out: HandMarked[] = [];
  for (const q of qs) {
    const d = await eligibilityOfQuestion(db, q.id, { rebuild: false }); // a preview only looks: it never queues a rebuild
    if (!d.eligible) out.push({ questionId: q.id, position: q.position, reason: d.reason, message: aiOffMessage(d.reason) });
  }
  return out;
}

/** The builder lists, before publishing, the questions that will be hand-marked and why. Never blocks publishing. */
export async function publishPreview(actor: HwActor, assignmentId: string) {
  await requireHwEnabled(actor);
  await assignmentForManage(actor, assignmentId);
  const qs = await db.select({ id: hwQuestion.id, position: hwQuestion.position }).from(hwQuestion).where(eq(hwQuestion.assignmentId, assignmentId)).orderBy(asc(hwQuestion.position));
  return { handMarked: await handMarkedList(qs) };
}

/** "Use my own rubric instead": the key is dropped for this question, and during the pilot the question is marked by hand. */
export async function useOwnRubric(actor: HwActor, questionId: string) {
  const { q, a } = await questionForManage(actor, questionId);
  requireDraft(a, 'The marking scheme');
  await db.transaction((tx) => switchToTeacher(tx, q.id));
}

/** Back to an answer key: a new one is built (the teacher's rubric stays until it is ready). */
export async function useAnswerKey(actor: HwActor, questionId: string) {
  const { q, a } = await questionForManage(actor, questionId);
  requireDraft(a, 'The marking scheme');
  await db.transaction(async (tx) => {
    await tx.update(hwQuestion).set({ rubricMode: 'key' }).where(eq(hwQuestion.id, q.id));
    const [row] = await tx.select().from(hwQuestion).where(eq(hwQuestion.id, q.id)).limit(1);
    await queueKey(tx, row, actor.userId);
  });
}

/** Build the key again (after a failure, a refusal, or when the teacher wants a fresh one). Not on a closed assignment. */
export async function retryKey(actor: HwActor, questionId: string) {
  const { q, a } = await questionForManage(actor, questionId);
  if (a.status === 'closed') throw new HwError('CONFLICT', 'A closed assignment cannot be edited.');
  if (q.rubricMode !== 'key') throw new HwError('CONFLICT', 'This question uses your own rubric, not an answer key.');
  await db.transaction(async (tx) => {
    // A fresh build even when one is "already on its way" for the same question text is pointless; only a settled key is rebuilt.
    const cur = (await currentKeys(tx, [q.id])).get(q.id);
    if (cur?.status === 'building') return;
    if (cur) await tx.execute(sql`UPDATE hw_question_key SET superseded_at = now() WHERE id = ${cur.id}`);
    await queueKey(tx, q, actor.userId);
  });
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

// ── Pickers for the UI ───────────────────────────────────────────────────────

/** Classes, sections and teachers of the institution, for the admin's linking screen. */
export async function classTeacherOptions(actor: HwActor) {
  requireRole(actor, 'admin');
  const classes = await db.select({ id: institutionClasses.id, name: institutionClasses.name, level: institutionClasses.level })
    .from(institutionClasses).where(eq(institutionClasses.organizationId, actor.orgId)).orderBy(asc(institutionClasses.level), asc(institutionClasses.name));
  const sections = await db.select({ id: institutionSections.id, classId: institutionSections.classId, name: institutionSections.name })
    .from(institutionSections).where(eq(institutionSections.organizationId, actor.orgId)).orderBy(asc(institutionSections.name));
  const teachers = await db.select({ id: user.id, name: user.name, email: user.email, role: member.role })
    .from(member).innerJoin(user, eq(user.id, member.userId))
    .where(eq(member.organizationId, actor.orgId));
  return { classes, sections, teachers: teachers.filter((t) => roleFromMember(t.role) === 'teacher').map(({ role: _r, ...t }) => t) };
}

/** What this teacher may set work for: their linked classes (admins: every class). */
export async function assignmentTargets(actor: HwActor) {
  requireRole(actor, 'admin', 'teacher');
  await requireHwEnabled(actor);
  const classes = await db.select({ id: institutionClasses.id, name: institutionClasses.name, level: institutionClasses.level })
    .from(institutionClasses).where(eq(institutionClasses.organizationId, actor.orgId)).orderBy(asc(institutionClasses.level), asc(institutionClasses.name));
  const sections = await db.select({ id: institutionSections.id, classId: institutionSections.classId, name: institutionSections.name })
    .from(institutionSections).where(eq(institutionSections.organizationId, actor.orgId)).orderBy(asc(institutionSections.name));
  // Only the classes and sections the institution has the feature switched on for (all of them unless it is restricted).
  const scope = await loadScope(db, actor.orgId);
  const inScope = (classId: string, sectionId: string | null) => !scope.restricted || scope.entries.some((e) => e.classId === classId && (e.sectionId === null || e.sectionId === sectionId));
  const okClasses = classes.filter((c) => !scope.restricted || scope.entries.some((e) => e.classId === c.id));
  const okSections = sections.filter((s) => inScope(s.classId, s.id));
  if (actor.role === 'admin') {
    return { classes: okClasses, sections: okSections, links: okClasses.map((c) => ({ classId: c.id, sectionId: null, subject: null })) };
  }
  const links = await teacherLinks(actor);
  const allowed = new Set(links.map((l) => l.classId));
  return { classes: okClasses.filter((c) => allowed.has(c.id)), sections: okSections.filter((s) => allowed.has(s.classId)), links };
}
