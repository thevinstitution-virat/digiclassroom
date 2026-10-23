// Student side: start, autosave, upload ink, submit, check the transcript, see results.
// Students never receive model answers, accepted answers or the marking scheme.

import { gunzipSync } from 'node:zlib';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { hwAnswer, hwAssignment, hwGrade, hwQuestion, hwRubricItem, hwSubmission, type HwAnswerMode, type HwStudentFlag } from '@/db/hw-schema';
import { assignmentForStudent, ownSubmission, requireHwEnabled, requireRole, studentEnrollmentsOf } from '../access/guards';
import { studentCanSeeResult, type HwActor } from '../access/policy';
import { getHwConfig } from '../config';
import { HwError } from '../errors';
import { db, newId, num } from '../db';
import { checkRender } from '../ink/png';
import { inkSummary, validateEncodedInk } from '../ink/stroke-format';
import { queueSubmissionRead } from '../jobs/read-handler';
import { finishSubmissionIfRead, setTranscript } from '../pipeline';
import { answerFileKey, keyVersion } from '../storage/keys';
import { putHwObject } from '../storage/r2';

const MAX_TYPED_CHARS = 50_000;

/** What a student may see of a question. */
function studentQuestion(q: typeof hwQuestion.$inferSelect) {
  return { id: q.id, position: q.position, type: q.type, prompt: q.prompt, marks: num(q.marks), languageHint: q.languageHint, answerLines: q.answerLines };
}

export async function myAssignments(actor: HwActor) {
  requireRole(actor, 'student');
  await requireHwEnabled(actor);
  const enrollments = await studentEnrollmentsOf(actor);
  if (!enrollments.length) return [];
  const classIds = [...new Set(enrollments.map((e) => e.classId))];
  const rows = await db.select({ a: hwAssignment, s: hwSubmission })
    .from(hwAssignment)
    .leftJoin(hwSubmission, and(eq(hwSubmission.assignmentId, hwAssignment.id), eq(hwSubmission.studentId, actor.userId)))
    .where(and(eq(hwAssignment.organizationId, actor.orgId), inArray(hwAssignment.classId, classIds), inArray(hwAssignment.status, ['published', 'closed'])))
    .orderBy(asc(hwAssignment.dueAt));
  return rows
    .filter(({ a }) => enrollments.some((e) => e.classId === a.classId && (a.sectionId === null || e.sectionId === a.sectionId)))
    .map(({ a, s }) => ({
      id: a.id, title: a.title, subject: a.subject, dueAt: a.dueAt, totalMarks: num(a.totalMarks), status: a.status,
      allowedModes: a.allowedModes,
      submission: s ? { id: s.id, status: s.status, submittedAt: s.submittedAt, isLate: s.isLate } : null,
    }));
}

/** Open (or resume) the student's draft. */
export async function startSubmission(actor: HwActor, assignmentId: string) {
  requireRole(actor, 'student');
  await requireHwEnabled(actor);
  const a = await assignmentForStudent(actor, assignmentId);
  let [s] = await db.select().from(hwSubmission)
    .where(and(eq(hwSubmission.assignmentId, a.id), eq(hwSubmission.studentId, actor.userId))).limit(1);
  if (!s) {
    if (a.status !== 'published') throw new HwError('CONFLICT', 'This assignment is closed.');
    await db.insert(hwSubmission).values({ id: newId(), organizationId: actor.orgId, assignmentId: a.id, studentId: actor.userId })
      .onConflictDoNothing();
    [s] = await db.select().from(hwSubmission)
      .where(and(eq(hwSubmission.assignmentId, a.id), eq(hwSubmission.studentId, actor.userId))).limit(1);
  }
  const questions = await db.select().from(hwQuestion).where(eq(hwQuestion.assignmentId, a.id)).orderBy(asc(hwQuestion.position));
  const answers = await db.select().from(hwAnswer).where(eq(hwAnswer.submissionId, s.id));
  return {
    assignment: { id: a.id, title: a.title, subject: a.subject, instructions: a.instructions, dueAt: a.dueAt, totalMarks: num(a.totalMarks), allowedModes: a.allowedModes, status: a.status },
    submission: { id: s.id, status: s.status, submittedAt: s.submittedAt, isLate: s.isLate },
    questions: questions.map(studentQuestion),
    answers: answers.map((x) => ({
      questionId: x.questionId, mode: x.mode, typedText: x.typedText, hasInk: Boolean(x.inkKey), timeSpentMs: x.timeSpentMs,
      // Transcripts appear once reading is done; never while the student can still edit.
      transcript: s.status === 'draft' ? null : x.transcript,
      transcriptStatus: s.status === 'draft' ? null : x.transcriptStatus,
      studentFlags: x.studentFlags,
    })),
  };
}

async function draftOf(actor: HwActor, submissionId: string) {
  const { submission, assignment } = await ownSubmission(actor, submissionId);
  if (submission.status !== 'draft') throw new HwError('CONFLICT', 'This work has already been handed in.');
  if (assignment.status !== 'published') throw new HwError('CONFLICT', 'This assignment is closed.');
  return { submission, assignment };
}

async function questionOf(assignmentId: string, questionId: string) {
  const [q] = await db.select().from(hwQuestion).where(and(eq(hwQuestion.id, questionId), eq(hwQuestion.assignmentId, assignmentId))).limit(1);
  if (!q) throw new HwError('NOT_FOUND', 'Question not found.');
  return q;
}

/** Autosave. Ink files come separately through storeInk. */
export async function saveAnswer(actor: HwActor, submissionId: string, questionId: string, input: {
  mode: HwAnswerMode;
  typedText?: string | null;
  timeSpentMs: number;
  /** Typed mode only: paste events etc., for information. */
  typingStats?: Record<string, unknown>;
}) {
  const { submission, assignment } = await draftOf(actor, submissionId);
  const q = await questionOf(assignment.id, questionId);
  if (!assignment.allowedModes.includes(input.mode)) throw new HwError('BAD_REQUEST', `This assignment does not accept ${input.mode} answers.`);
  if (input.mode === 'photo') throw new HwError('BAD_REQUEST', 'Photo answers arrive in a later update.');
  if (input.typedText && input.typedText.length > MAX_TYPED_CHARS) throw new HwError('PAYLOAD_TOO_LARGE', 'This answer is too long.');
  const stats = input.typingStats ? JSON.parse(JSON.stringify(input.typingStats)) as Record<string, unknown> : undefined;
  if (stats && JSON.stringify(stats).length > 10_000) throw new HwError('PAYLOAD_TOO_LARGE', 'Answer metadata is too large.');

  await db.insert(hwAnswer).values({
    id: newId(), organizationId: actor.orgId, submissionId: submission.id, questionId: q.id,
    mode: input.mode, typedText: input.mode === 'typed' ? input.typedText ?? '' : null,
    timeSpentMs: Math.max(0, Math.round(input.timeSpentMs)), inkStats: stats ? { typing: stats } : {},
  }).onConflictDoUpdate({
    target: [hwAnswer.submissionId, hwAnswer.questionId],
    set: {
      mode: input.mode,
      typedText: input.mode === 'typed' ? input.typedText ?? '' : null,
      // Time only grows: an older autosave arriving late must not lower it.
      timeSpentMs: sql`GREATEST(${hwAnswer.timeSpentMs}, ${Math.max(0, Math.round(input.timeSpentMs))})`,
      ...(stats ? { inkStats: sql`${hwAnswer.inkStats} || ${JSON.stringify({ typing: stats })}::jsonb` } : {}),
    },
  });
}

/**
 * Ink upload: the gzipped stroke JSON and the PNG rendered from it on the device. Both are
 * validated here (size, gzip, stroke schema, PNG header and width) before anything is stored.
 */
export async function storeInk(actor: HwActor, submissionId: string, questionId: string, inkGz: Uint8Array, png: Uint8Array) {
  const cfg = getHwConfig();
  const { submission, assignment } = await draftOf(actor, submissionId);
  const q = await questionOf(assignment.id, questionId);
  if (!assignment.allowedModes.includes('ink')) throw new HwError('BAD_REQUEST', 'This assignment does not accept handwritten answers.');
  if (inkGz.length > cfg.HW_INK_MAX_BYTES) throw new HwError('PAYLOAD_TOO_LARGE', 'The handwriting file is too large.');
  if (png.length > cfg.HW_RENDER_MAX_BYTES) throw new HwError('PAYLOAD_TOO_LARGE', 'The handwriting image is too large.');

  let json: unknown;
  try {
    const raw = gunzipSync(inkGz, { maxOutputLength: cfg.HW_INK_MAX_BYTES * 20 });
    json = JSON.parse(raw.toString('utf8'));
  } catch {
    throw new HwError('BAD_REQUEST', 'The handwriting file could not be read.', 'ink is not gzipped JSON');
  }
  const ink = validateEncodedInk(json);
  if (!ink.ok) throw new HwError('BAD_REQUEST', 'The handwriting file is not valid.', `ink invalid: ${ink.problem}`);
  if (ink.ink.strokes.length === 0) throw new HwError('BAD_REQUEST', 'This answer has no writing yet.');
  const render = checkRender(png, cfg.HW_RENDER_MAX_WIDTH);
  if (!render.ok) throw new HwError('BAD_REQUEST', 'The handwriting image is not valid.', render.problem);

  const [existing] = await db.select({ inkKey: hwAnswer.inkKey }).from(hwAnswer)
    .where(and(eq(hwAnswer.submissionId, submission.id), eq(hwAnswer.questionId, q.id))).limit(1);
  const version = keyVersion(existing?.inkKey) + 1;
  const ref = { orgId: actor.orgId, assignmentId: assignment.id, submissionId: submission.id, questionId: q.id };
  const inkKey = answerFileKey(ref, 'ink', version);
  const renderKey = answerFileKey(ref, 'render', version);
  await putHwObject(inkKey, inkGz, 'application/gzip');
  await putHwObject(renderKey, png, 'image/png');

  const summary = { ...inkSummary(ink.ink), renderWidth: render.info.width, renderHeight: render.info.height, renderBytes: png.length, inkBytes: inkGz.length };
  await db.insert(hwAnswer).values({
    id: newId(), organizationId: actor.orgId, submissionId: submission.id, questionId: q.id,
    mode: 'ink', inkKey, renderKey, inkStats: { ink: summary },
  }).onConflictDoUpdate({
    target: [hwAnswer.submissionId, hwAnswer.questionId],
    set: { mode: 'ink', typedText: null, inkKey, renderKey, inkStats: sql`${hwAnswer.inkStats} || ${JSON.stringify({ ink: summary })}::jsonb` },
  });
  return { version, ...summary };
}

/**
 * Hand in. Typed answers are their own transcript (no AI reading). Questions left
 * unanswered get a blank answer, which marks as 0 without AI. If anything is handwritten,
 * one read job covers the whole submission.
 */
export async function submit(actor: HwActor, submissionId: string) {
  const { submission, assignment } = await draftOf(actor, submissionId);
  const questions = await db.select().from(hwQuestion).where(eq(hwQuestion.assignmentId, assignment.id));

  return db.transaction(async (tx) => {
    const [locked] = await tx.select().from(hwSubmission).where(eq(hwSubmission.id, submission.id)).for('update');
    if (locked.status !== 'draft') throw new HwError('CONFLICT', 'This work has already been handed in.');

    const answers = await tx.select().from(hwAnswer).where(eq(hwAnswer.submissionId, submission.id));
    const missingInk = answers.filter((a) => a.mode === 'ink' && !a.renderKey);
    if (missingInk.length) {
      const nums = missingInk.map((a) => (questions.find((q) => q.id === a.questionId)?.position ?? 0) + 1).sort((x, y) => x - y);
      throw new HwError('BAD_REQUEST', `Your writing for question ${nums.join(', ')} has not finished uploading. Please wait and try again.`);
    }

    for (const q of questions) {
      if (answers.some((a) => a.questionId === q.id)) continue;
      const id = newId();
      await tx.insert(hwAnswer).values({ id, organizationId: actor.orgId, submissionId: submission.id, questionId: q.id, mode: 'typed', typedText: '' });
      answers.push((await tx.select().from(hwAnswer).where(eq(hwAnswer.id, id)))[0]);
    }

    for (const a of answers.filter((x) => x.mode === 'typed')) {
      await setTranscript(tx, a, { text: a.typedText ?? '', status: 'not_needed', source: 'typed', unclearCount: 0, engine: 'typed', tier: null });
    }

    const now = new Date();
    const needsReading = answers.some((a) => a.mode === 'ink' || a.mode === 'photo');
    await tx.update(hwSubmission).set({
      status: needsReading ? 'processing' : 'submitted',
      submittedAt: now,
      isLate: assignment.dueAt ? now > assignment.dueAt : false,
    }).where(eq(hwSubmission.id, submission.id));

    if (needsReading) await queueSubmissionRead(tx, actor.orgId, submission.id);
    else await finishSubmissionIfRead(tx, submission.id);
    return { status: needsReading ? 'processing' : 'ready_for_review' };
  });
}

/**
 * The student taps words they think were misread. Stored as hints for the teacher; the
 * student cannot change the transcript or the answer.
 */
export async function flagWords(actor: HwActor, submissionId: string, questionId: string, flags: HwStudentFlag[]) {
  const { submission } = await ownSubmission(actor, submissionId);
  if (submission.status === 'draft') throw new HwError('CONFLICT', 'Hand in your work first.');
  if (submission.status === 'returned') throw new HwError('CONFLICT', 'This work has already been marked.');
  const [a] = await db.select().from(hwAnswer)
    .where(and(eq(hwAnswer.submissionId, submission.id), eq(hwAnswer.questionId, questionId))).limit(1);
  if (!a || a.mode === 'typed') throw new HwError('BAD_REQUEST', 'Only handwritten answers can be checked.');
  if (!a.transcript || !['done', 'needs_review'].includes(a.transcriptStatus)) throw new HwError('CONFLICT', 'This answer has not been read yet.');
  if (flags.length > 50) throw new HwError('BAD_REQUEST', 'Too many words flagged.');
  for (const f of flags) {
    if (!(f.start >= 0 && f.end > f.start && f.end <= a.transcript.length) || a.transcript.slice(f.start, f.end) !== f.text) {
      throw new HwError('BAD_REQUEST', 'A flagged word does not match the transcript.');
    }
  }
  await db.update(hwAnswer).set({ studentFlags: flags }).where(eq(hwAnswer.id, a.id));
}

/** Marks and feedback, only after the teacher returns the work. */
export async function myResult(actor: HwActor, submissionId: string) {
  const { submission, assignment } = await ownSubmission(actor, submissionId);
  if (!studentCanSeeResult(actor, submission)) throw new HwError('CONFLICT', 'Your teacher has not returned this work yet.');
  const questions = await db.select().from(hwQuestion).where(eq(hwQuestion.assignmentId, assignment.id)).orderBy(asc(hwQuestion.position));
  const answers = await db.select({ a: hwAnswer, g: hwGrade }).from(hwAnswer)
    .leftJoin(hwGrade, eq(hwGrade.answerId, hwAnswer.id))
    .where(eq(hwAnswer.submissionId, submission.id));
  const itemIds = answers.flatMap(({ g }) => (g?.itemMarks ?? []).map((m) => m.rubric_item_id));
  const items = itemIds.length ? await db.select().from(hwRubricItem).where(inArray(hwRubricItem.id, itemIds)) : [];
  const total = answers.reduce((s, { g }) => s + num(g?.marks), 0);
  return {
    assignment: { id: assignment.id, title: assignment.title, totalMarks: num(assignment.totalMarks) },
    total,
    questions: questions.map((q) => {
      const row = answers.find(({ a }) => a.questionId === q.id);
      const g = row?.g ?? null;
      return {
        ...studentQuestion(q),
        transcript: row?.a.transcript ?? '',
        awarded: g ? num(g.marks) : null,
        comment: g?.comment ?? null,
        keyPoints: (g?.itemMarks ?? []).map((m) => {
          const it = items.find((i) => i.id === m.rubric_item_id);
          return { description: it?.description ?? '', marks: m.marks, outOf: num(it?.marks) };
        }),
      };
    }),
  };
}
