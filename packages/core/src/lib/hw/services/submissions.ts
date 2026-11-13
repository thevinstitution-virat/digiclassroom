// Student side: start, autosave, upload ink, submit, check the transcript, see results.
// Students never receive model answers, accepted answers or the marking scheme.

import { gunzipSync } from 'node:zlib';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { hwAiGrade, hwAnswer, hwAssignment, hwGrade, hwQuestion, hwRubricItem, hwSubmission, type HwAnswerMode, type HwStudentFlag } from '@/db/hw-schema';
import { assignmentForStudent, ownSubmission, requireHwEnabled, requireRole, studentEnrollmentsOf } from '../access/guards';
import { studentCanSeeResult, type HwActor } from '../access/policy';
import { getHwConfig } from '../config';
import { HwError } from '../errors';
import { db, newId, num } from '../db';
import { loadScope, scopeAllows } from '../tenant-scope';
import { checkRender } from '../ink/png';
import { inkSummary, validateEncodedInk } from '../ink/stroke-format';
import { queueSubmissionRead } from '../jobs/read-handler';
import { finishSubmissionIfRead, setTranscript } from '../pipeline';
import { answerFileKey, answerImageKey, keyVersion } from '../storage/keys';
import { attemptStatus, marksStanding, PRACTICE_REF_SQL, practiceRefOf } from '../practice/attempts';
import { activeWritingMs, countWords, handwritingFacts, handwritingNote, pacingGuide, percentileOf, unclearCount, writingSpeed, type HandFacts } from '../practice/pace';
import { putHwObject, signedReadUrl } from '../storage/r2';
import { learnerFigures, type LearnerFigure } from '../bank/figures';
import { boardFiguresOf, quickTestPace, reviseOf } from '../practice/board';
import { examPageStore } from '../storage/exam-pages';
import { PRACTICE_ORG_ID, PRACTICE_TEXT, answerModesOf } from '../practice/rules';
import { requireUsableTrial } from '../practice/trial';
import { latestRevisionsFor } from '../revisions';
import { readImageHeader } from '../photo/image';
import { PHOTO_LIMITS, SOFT_PAGE_PROBLEMS, pageVerdict } from '../photo/rules';

const MAX_TYPED_CHARS = 50_000;

/** Why a photo answer was refused, in words for the learner. */
const PHOTO_PROBLEM_TEXT = {
  too_small: 'This photo is too small to read. Take it again, closer, with the answer filling the frame.',
  too_large: 'This photo file is too large.',
  too_blurred: 'This photo is blurred. Hold the phone still and take it again.',
  too_dark: 'This photo is too dark. Take it again in better light.',
  too_bright: 'This photo is too bright. Move away from direct light.',
  glare: 'There is glare on this photo. Tilt the page or switch off the flash.',
} as const;

/** What a student may see of a question. */
function studentQuestion(q: typeof hwQuestion.$inferSelect) {
  // The passage is part of the question and is shown; the answer key, the rubric and the model answer never are.
  return { id: q.id, position: q.position, type: q.type, prompt: q.prompt, passage: q.passage, marks: num(q.marks), languageHint: q.languageHint, answerLines: q.answerLines };
}

/** A question made from a board paper shows the paper's own figures: private pictures, as short-lived links, with their words for a screen reader. */
async function withFigures(questions: (typeof hwQuestion.$inferSelect)[]) {
  const ids = [...new Set(questions.filter((q) => q.origin === 'board_paper' && q.originRef?.bankRowId).map((q) => q.originRef.bankRowId))];
  const figs = await learnerFigures(db, ids, signedReadUrl);
  // an InkBuddy board-pool question (practice/board.ts) shows its pool item's pictures
  const poolIds = [...new Set(questions.filter((q) => q.originRef?.poolItemId).map((q) => q.originRef.poolItemId))];
  const poolFigs = poolIds.length ? await boardFiguresOf(db, poolIds, (k) => examPageStore().readUrl(k)) : new Map<string, LearnerFigure[]>();
  return questions.map((q): ReturnType<typeof studentQuestion> & { figures?: LearnerFigure[] } => {
    const f = q.origin === 'board_paper' && q.originRef?.bankRowId ? figs.get(q.originRef.bankRowId) : q.originRef?.poolItemId ? poolFigs.get(q.originRef.poolItemId) : undefined;
    return f?.length ? { ...studentQuestion(q), figures: f } : studentQuestion(q);
  });
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
  const scope = await loadScope(db, actor.orgId);
  return rows
    .filter(({ a }) => enrollments.some((e) => e.classId === a.classId && (a.sectionId === null || e.sectionId === a.sectionId)))
    .filter(({ a }) => scopeAllows(scope, a.classId, a.sectionId))
    // The practice institution: only the learner's own questions, whatever the enrollments say.
    .filter(({ a }) => a.organizationId !== PRACTICE_ORG_ID || a.createdBy === actor.userId)
    .map(({ a, s }) => ({
      id: a.id, title: a.title, subject: a.subject, dueAt: a.dueAt, totalMarks: num(a.totalMarks), status: a.status,
      allowedModes: answerModesOf(a),
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
    assignment: { id: a.id, title: a.title, subject: a.subject, instructions: a.instructions, dueAt: a.dueAt, totalMarks: num(a.totalMarks), allowedModes: answerModesOf(a), status: a.status },
    // Self-practice: no teacher is involved, and the screens say so.
    practice: a.organizationId === PRACTICE_ORG_ID,
    // an InkBuddy quick test (practice/board.ts, phase 4): its writing time at the board's pace, counted from when it was first opened
    quickTest: a.organizationId === PRACTICE_ORG_ID ? quickTestPace(questions) : null,
    submission: { id: s.id, status: s.status, submittedAt: s.submittedAt, isLate: s.isLate, openedAt: s.createdAt },
    questions: await withFigures(questions),
    answers: await Promise.all(answers.map(async (x) => ({
      questionId: x.questionId, mode: x.mode, typedText: x.typedText, hasInk: Boolean(x.inkKey), timeSpentMs: x.timeSpentMs,
      // the learner's own photo of their answer, as a short-lived link, so it shows again on another device or after a reload
      photoUrl: x.mode === 'photo' && x.imageKey ? await signedReadUrl(x.imageKey) : null,
      // Transcripts appear once reading is done; never while the student can still edit.
      transcript: s.status === 'draft' ? null : x.transcript,
      transcriptStatus: s.status === 'draft' ? null : x.transcriptStatus,
      studentFlags: x.studentFlags,
    }))),
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
  /** InkBuddy's stopwatch: the time the learner timed themselves writing this answer (practice/pace.ts). */
  stopwatchMs?: number;
}) {
  const { submission, assignment } = await draftOf(actor, submissionId);
  const q = await questionOf(assignment.id, questionId);
  if (!answerModesOf(assignment).includes(input.mode)) throw new HwError('BAD_REQUEST', `This assignment does not accept ${input.mode} answers.`);
  if (input.typedText && input.typedText.length > MAX_TYPED_CHARS) throw new HwError('PAYLOAD_TOO_LARGE', 'This answer is too long.');
  const stats = input.typingStats ? JSON.parse(JSON.stringify(input.typingStats)) as Record<string, unknown> : undefined;
  if (stats && JSON.stringify(stats).length > 10_000) throw new HwError('PAYLOAD_TOO_LARGE', 'Answer metadata is too large.');

  const merge: Record<string, unknown> = {
    ...(stats ? { typing: stats } : {}),
    ...(typeof input.stopwatchMs === 'number' && input.stopwatchMs >= 0 ? { stopwatch: { ms: Math.round(Math.min(input.stopwatchMs, 6 * 3600_000)) } } : {}),
  };
  await db.insert(hwAnswer).values({
    id: newId(), organizationId: actor.orgId, submissionId: submission.id, questionId: q.id,
    mode: input.mode, typedText: input.mode === 'typed' ? input.typedText ?? '' : null,
    timeSpentMs: Math.max(0, Math.round(input.timeSpentMs)), inkStats: merge,
  }).onConflictDoUpdate({
    target: [hwAnswer.submissionId, hwAnswer.questionId],
    set: {
      mode: input.mode,
      typedText: input.mode === 'typed' ? input.typedText ?? '' : null,
      // Time only grows: an older autosave arriving late must not lower it.
      timeSpentMs: sql`GREATEST(${hwAnswer.timeSpentMs}, ${Math.max(0, Math.round(input.timeSpentMs))})`,
      ...(Object.keys(merge).length ? { inkStats: sql`${hwAnswer.inkStats} || ${JSON.stringify(merge)}::jsonb` } : {}),
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

  // active writing time and handwriting facts (practice/pace.ts), for the writing speed and the handwriting note on the result page
  const summary = {
    ...inkSummary(ink.ink), activeMs: activeWritingMs(ink.ink), hand: handwritingFacts(ink.ink),
    renderWidth: render.info.width, renderHeight: render.info.height, renderBytes: png.length, inkBytes: inkGz.length,
  };
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
 * A photo of an answer written on paper. The browser has already checked it (photo/measure.ts) and shrunk it; here the bytes are checked for
 * what they really are, their size in pixels and in bytes, and the browser's light and focus measurements are applied (a learner may use a
 * photo anyway when only those are doubtful). Stored under a new version, like ink, so a re-take never half-replaces a file.
 */
export async function storePhoto(actor: HwActor, submissionId: string, questionId: string, bytes: Uint8Array,
  facts: { sharpness: number; brightness: number; glare: number; override: boolean }) {
  const { submission, assignment } = await draftOf(actor, submissionId);
  const q = await questionOf(assignment.id, questionId);
  if (!answerModesOf(assignment).includes('photo')) throw new HwError('BAD_REQUEST', 'This assignment does not accept photos of answers.');
  if (bytes.length > PHOTO_LIMITS.maxBytes) throw new HwError('PAYLOAD_TOO_LARGE', PHOTO_PROBLEM_TEXT.too_large);
  const head = readImageHeader(bytes);
  if ('problem' in head) throw new HwError('BAD_REQUEST', 'This file is not a photo we can use. Please take a photo of your answer.', head.problem);
  const verdict = pageVerdict({ widthPx: head.width, heightPx: head.height, bytes: bytes.length, sharpness: facts.sharpness, brightness: facts.brightness, glare: facts.glare });
  if (!verdict.ok && !(SOFT_PAGE_PROBLEMS.has(verdict.why) && facts.override)) throw new HwError('BAD_REQUEST', PHOTO_PROBLEM_TEXT[verdict.why], `photo refused: ${verdict.why}`);

  const [existing] = await db.select({ imageKey: hwAnswer.imageKey }).from(hwAnswer)
    .where(and(eq(hwAnswer.submissionId, submission.id), eq(hwAnswer.questionId, q.id))).limit(1);
  const version = keyVersion(existing?.imageKey) + 1;
  const imageKey = answerFileKey({ orgId: actor.orgId, assignmentId: assignment.id, submissionId: submission.id, questionId: q.id }, 'photo', version, head.ext);
  await putHwObject(imageKey, bytes, head.mime);

  const photo = { width: head.width, height: head.height, bytes: bytes.length, mime: head.mime, sharpness: facts.sharpness, brightness: facts.brightness, glare: facts.glare, override: facts.override, verdict: verdict.ok ? 'ok' : verdict.why };
  await db.insert(hwAnswer).values({
    id: newId(), organizationId: actor.orgId, submissionId: submission.id, questionId: q.id,
    mode: 'photo', imageKey, inkStats: { photo },
  }).onConflictDoUpdate({
    target: [hwAnswer.submissionId, hwAnswer.questionId],
    // the ink files stay (switching back to Write keeps them); what is read is chosen by the mode (answerImageKey)
    set: { mode: 'photo', typedText: null, imageKey, inkStats: sql`${hwAnswer.inkStats} || ${JSON.stringify({ photo })}::jsonb` },
  });
  return { version, url: await signedReadUrl(imageKey), warning: verdict.ok ? null : verdict.why };
}

/**
 * Hand in. Typed answers are their own transcript (no AI reading). Questions left
 * unanswered get a blank answer, which marks as 0 without AI. If anything is handwritten,
 * one read job covers the whole submission.
 */
export async function submit(actor: HwActor, submissionId: string) {
  const { submission, assignment } = await draftOf(actor, submissionId);
  // Self-practice: handing in is refused, with a plain message, once the free trial cannot pay for another step.
  if (actor.orgId === PRACTICE_ORG_ID) await requireUsableTrial(db, actor.userId);
  const questions = await db.select().from(hwQuestion).where(eq(hwQuestion.assignmentId, assignment.id));

  return db.transaction(async (tx) => {
    const [locked] = await tx.select().from(hwSubmission).where(eq(hwSubmission.id, submission.id)).for('update');
    if (locked.status !== 'draft') throw new HwError('CONFLICT', 'This work has already been handed in.');

    const answers = await tx.select().from(hwAnswer).where(eq(hwAnswer.submissionId, submission.id));
    const missingInk = answers.filter((a) => a.mode === 'ink' && !a.renderKey);
    const qNums = (rows: typeof answers) => rows.map((a) => (questions.find((q) => q.id === a.questionId)?.position ?? 0) + 1).sort((x, y) => x - y).join(', ');
    if (missingInk.length) {
      throw new HwError('BAD_REQUEST', `Your writing for question ${qNums(missingInk)} has not finished uploading. Please wait and try again.`);
    }
    const missingPhoto = answers.filter((a) => a.mode === 'photo' && !a.imageKey);
    if (missingPhoto.length) {
      throw new HwError('BAD_REQUEST', `Question ${qNums(missingPhoto)} has no photo yet. Take a photo of your answer, or choose Write or Type.`);
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
/**
 * The book's answer to a question: the reference answer of its answer key, written from the textbook's own passages, with where it comes
 * from ("Science, Chapter 5, pages 72-73"). Null when the question has no ready key. Shown only after marking (myResult).
 */
/** The teacher's pen saved with an answer (practice/teacher-pen.ts), as the learner sees it: the remark and the checked notes. */
function penOf(stats: unknown): { remark: string; notes: { kind: 'fact' | 'language' | 'presentation'; quote: string; note: string; fix: string }[] } | null {
  const p = (stats as { pen?: { remark?: unknown; notes?: unknown } } | null)?.pen;
  if (!p || typeof p.remark !== 'string') return null;
  return { remark: p.remark, notes: Array.isArray(p.notes) ? (p.notes as { kind: 'fact' | 'language' | 'presentation'; quote: string; note: string; fix: string }[]) : [] };
}

type AnswerRow = typeof hwAnswer.$inferSelect;
type PaceStats = { stopwatch?: { ms?: number }; ink?: { activeMs?: number; hand?: HandFacts | null } };

/** The speed of one answer, from what was saved with it. */
function speedOfAnswer(a: Pick<AnswerRow, 'mode' | 'transcript' | 'inkStats' | 'timeSpentMs'>) {
  const s = (a.inkStats ?? {}) as PaceStats;
  return writingSpeed({ words: countWords(a.transcript), stopwatchMs: s.stopwatch?.ms ?? null, activeMs: s.ink?.activeMs ?? null, typedMs: a.timeSpentMs, mode: a.mode });
}

/**
 * Time, speed and handwriting for one InkBuddy answer (practice/pace.ts): words a minute (stopwatch, else the pen's own active time),
 * a pacing guide, the percentile among other learners' FIRST attempts at the same question (only with enough of them), and a kind note
 * on handwriting. Never a mark.
 */
async function paceOf(a: AnswerRow, ref: string | null, studentId: string) {
  const speed = speedOfAnswer(a);
  const s = (a.inkStats ?? {}) as PaceStats;
  let percentile: number | null = null;
  let peers = 0;
  if (speed && ref) {
    const r = await db.execute<{ mode: string; transcript: string | null; ink_stats: unknown; time_spent_ms: number }>(sql`
      SELECT DISTINCT ON (a.created_by) an.mode, an.transcript, an.ink_stats, an.time_spent_ms
        FROM hw_assignment a
        JOIN hw_question q ON q.assignment_id = a.id
        JOIN hw_submission sb ON sb.assignment_id = a.id
        JOIN hw_answer an ON an.submission_id = sb.id
       WHERE a.organization_id = ${PRACTICE_ORG_ID} AND a.created_by <> ${studentId} AND sb.status = 'returned'
         AND ${PRACTICE_REF_SQL} = ${ref}
       ORDER BY a.created_by, a.created_at
       LIMIT 5000`);
    const others = r.rows.map((x) => speedOfAnswer({ mode: x.mode as AnswerRow['mode'], transcript: x.transcript, inkStats: x.ink_stats as AnswerRow['inkStats'], timeSpentMs: x.time_spent_ms }))
      .filter((x): x is NonNullable<typeof x> => Boolean(x)).map((x) => x.wpm);
    peers = others.length;
    percentile = percentileOf(speed.wpm, others);
  }
  return {
    speed, percentile, peers,
    guide: speed ? pacingGuide(speed.wpm) : [],
    hand: handwritingNote({ mode: a.mode, facts: s.ink?.hand ?? null, unclear: unclearCount(a.transcript) }),
  };
}

export async function bookAnswerOf(keyId: string | null): Promise<{ text: string; source: string } | null> {
  if (!keyId) return null;
  const r = await db.execute<{ status: string; reference: string | null; citations: { title?: string; chapter?: string | null; pageStart?: number | null; pageEnd?: number | null }[] | null }>(sql`
    SELECT status, key ->> 'referenceAnswer' AS reference, citations FROM hw_question_key WHERE id = ${keyId}`);
  const k = r.rows[0];
  if (!k || k.status !== 'ready' || !k.reference?.trim()) return null;
  const cites = k.citations ?? [];
  const titles = [...new Set(cites.map((c) => c.title).filter(Boolean))];
  const chapters = [...new Set(cites.map((c) => c.chapter).filter(Boolean))];
  const pages = cites.flatMap((c) => [c.pageStart, c.pageEnd]).filter((p): p is number => typeof p === 'number' && p > 0);
  const lo = pages.length ? Math.min(...pages) : null;
  const hi = pages.length ? Math.max(...pages) : null;
  const source = [titles.join(', '), chapters.join(', '), lo === null ? '' : lo === hi ? `page ${lo}` : `pages ${lo}-${hi}`].filter(Boolean).join(' · ');
  return { text: k.reference.trim(), source };
}

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
  // marks changed after the work was returned (migration 036): who, only when a school's admin or teacher did it
  const revised = await latestRevisionsFor(db, answers.map(({ a }) => a.id));
  const practice = assignment.organizationId === PRACTICE_ORG_ID;
  // InkBuddy: the answer as the learner gave it (to set beside the reading), and the book's own answer with its pages
  const yours = new Map<string, { mode: string; url: string | null; typed: string | null }>();
  const book = new Map<string, { text: string; source: string } | null>();
  // the teacher's pen (practice/teacher-pen.ts): green from the marking's own quotes; red, yellow and grey notes and the remark, when written
  const green = new Map<string, { verdict: 'met' | 'partial'; quote: string }[]>();
  const pace = new Map<string, Awaited<ReturnType<typeof paceOf>>>();
  if (practice) {
    for (const q of questions) {
      const row = answers.find(({ a }) => a.questionId === q.id);
      if (row) pace.set(q.id, await paceOf(row.a, practiceRefOf(q.originRef), submission.studentId));
    }
    for (const { a, g } of answers) {
      if (!g?.aiGradeId) continue;
      const [ai] = await db.select({ items: hwAiGrade.items }).from(hwAiGrade).where(eq(hwAiGrade.id, g.aiGradeId)).limit(1);
      green.set(a.questionId, (ai?.items ?? []).flatMap((i) => (i.verdict === 'met' || i.verdict === 'partial') && i.quote?.trim() ? [{ verdict: i.verdict, quote: i.quote.trim() }] : []));
    }
    for (const { a } of answers) {
      const key = a.mode === 'typed' ? null : answerImageKey(a);
      yours.set(a.questionId, { mode: a.mode, url: key ? await signedReadUrl(key) : null, typed: a.mode === 'typed' ? a.typedText : null });
    }
    for (const q of questions) book.set(q.id, await bookAnswerOf(q.activeKeyId));
  }
  return {
    assignment: { id: assignment.id, title: assignment.title, totalMarks: num(assignment.totalMarks) },
    // Self-practice: who evaluated it, and how, on request (English and Hindi).
    ...(practice ? {
      practiceEstimate: { label: PRACTICE_TEXT.estimateLabel, note: PRACTICE_TEXT.estimateNote, how: PRACTICE_TEXT.estimateHow },
      attempts: await attemptStatus(db, actor.userId, assignment.id),
      // this mark among other learners' first attempts at the same question (one question per InkBuddy attempt); none for a quick test
      standing: await (async () => {
        const ref = practiceRefOf(questions[0]?.originRef);
        const outOf = questions.reduce((n, q) => n + num(q.marks), 0);
        return ref && outOf > 0 ? marksStanding(db, submission.studentId, ref, total / outOf) : null;
      })(),
      quickTest: quickTestPace(questions),
    } : {}),
    total,
    questions: questions.map((q) => {
      const row = answers.find(({ a }) => a.questionId === q.id);
      const g = row?.g ?? null;
      return {
        ...studentQuestion(q),
        transcript: row?.a.transcript ?? '',
        ...(practice ? {
          yours: yours.get(q.id) ?? null, bookAnswer: book.get(q.id) ?? null,
          // a board question (phase 3): the NCERT section and pages to revise, with a link to that page of the chapter
          revise: reviseOf(q.originRef), boardSources: q.originRef?.sources ?? null,
          pen: penOf(row?.a.inkStats), points: green.get(q.id) ?? [], pace: pace.get(q.id) ?? null,
        } : {}),
        awarded: g ? num(g.marks) : null,
        comment: g?.comment ?? null,
        revision: row ? revised.get(row.a.id) ?? null : null,
        keyPoints: (g?.itemMarks ?? []).map((m) => {
          const it = items.find((i) => i.id === m.rubric_item_id);
          return { description: it?.description ?? '', marks: m.marks, outOf: num(it?.marks) };
        }),
      };
    }),
  };
}
