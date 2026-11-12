// Phase 5: an exam attempt becomes an ordinary hw_assignment in the exam space, so reading's results go through the marking pipeline that has
// already been measured (strict marking, keys, quotas, monitoring), untouched. One question per set item; an internal choice's alternatives are
// separate questions and the one the learner did not answer is simply blank (the report counts the group once, at its best).
//
//   * a board-paper item reuses InkBuddy's path: the question is made from the person-checked bank row, its key is the board's own scheme
//     (rubric_mode 'key', built by the key product from the bank, no model); a drawing part is left out of the mark and reported as such;
//   * an authored item carries its own scheme: its value points become the question's rubric points (rubric_mode 'teacher').
//
// Safe to repeat: an attempt that already has its assignment gets the same one back.

import { and, asc, eq, inArray } from 'drizzle-orm';
import { hwBankQuestion } from '@/db/hw-bank-schema';
import { hwAnswer, hwAssignment, hwQuestion, hwRubricItem, hwSubmission, type HwLanguage } from '@/db/hw-schema';
import { hwExamAttempt, hwExamPackage, hwExamSet, hwExamSetItem } from '@/db/hw-exams-schema';
import { HwError } from '../errors';
import { newId, type Exec } from '../db';
import { queueKey } from '../keys/product';
import { offerCheck } from '../practice/paper';
import { hwTypeOf, originRefOf, promptOf } from '../practice/paper-rules';
import { ensureExamLearnerSpace, ensureExamSpace, EXAM_ORG_ID } from './space';

export interface ExamQuestion {
  itemId: string;
  questionId: string;
  answerId: string;
  number: number;
  alt: string | null;
  choiceGroup: string | null;
  choice: boolean;
  /** What the question is marked out of here (a drawing part of a board question is left out). */
  marks: number;
  /** The set's own mark for the item; differs from `marks` only when a drawing part is left out. */
  itemMarks: number;
  /** Set when the question cannot be marked here (its board row stopped being on offer after the set was published): a person marks it. */
  handOnly: string | null;
  /** For answer matching: the question as the learner saw it, and its model answer. */
  prompt: string;
  modelAnswer: string;
  /** A choice question's options by letter (A-D), for checking the words a learner writes beside the letter; empty otherwise. */
  options: { letter: string; text: string }[];
}

export interface Materialised { assignmentId: string; submissionId: string; questions: ExamQuestion[]; lang: 'en' | 'hi'; setId: string }

const CHOICE = new Set(['mcq', 'assertion_reason']);
const pointsText = (parts: unknown): string =>
  (Array.isArray(parts) ? parts : []).flatMap((p) => (Array.isArray((p as { value_points?: unknown }).value_points) ? (p as { value_points: { text?: string }[] }).value_points : []))
    .map((v) => v.text ?? '').filter(Boolean).join('; ');

/** The attempt's assignment, questions, submission and answers, made once. Runs in the caller's transaction. */
export async function materialiseAttempt(tx: Exec, attemptId: string): Promise<Materialised> {
  const attempt = (await tx.select().from(hwExamAttempt).where(eq(hwExamAttempt.id, attemptId)).limit(1))[0];
  if (!attempt) throw new HwError('NOT_FOUND', 'Attempt not found.');
  const set = (await tx.select().from(hwExamSet).where(eq(hwExamSet.id, attempt.setId)).limit(1))[0]!;
  const pkg = (await tx.select().from(hwExamPackage).where(eq(hwExamPackage.id, set.packageId)).limit(1))[0]!;
  const lang: 'en' | 'hi' = set.medium === 'hi' ? 'hi' : 'en';
  const items = await tx.select().from(hwExamSetItem).where(eq(hwExamSetItem.setId, set.id)).orderBy(asc(hwExamSetItem.position));

  if (attempt.assignmentId) return { ...(await load(tx, attempt.assignmentId, attempt.userId, items)), lang, setId: set.id };

  await ensureExamSpace(tx);
  const { classId, sectionId } = await ensureExamLearnerSpace(tx, attempt.userId, pkg.classLevel);
  const assignmentId = newId();
  await tx.insert(hwAssignment).values({
    id: assignmentId, organizationId: EXAM_ORG_ID, classId, sectionId, subject: set.subject,
    title: `${set.title} — attempt ${attempt.attemptNo}`.slice(0, 300), instructions: null, dueAt: null, allowedModes: ['photo'], createdBy: attempt.userId,
  });
  const language: HwLanguage = lang;
  let total = 0;
  for (const [position, it] of items.entries()) {
    const questionId = newId();
    if (it.bankQuestionId) {
      // the same checks InkBuddy makes, as a teacher would see the row (a drawing part is excluded from the mark, not refused)
      const check = await offerCheck(tx, it.bankQuestionId, 'teacher');
      if (!check.ok) {
        // publishing refuses such a row, so this is a row that changed since: the rest of the booklet is still marked, this one by a person
        const stem = (await tx.select({ stem: hwBankQuestion.stem }).from(hwBankQuestion).where(eq(hwBankQuestion.id, it.bankQuestionId)).limit(1))[0]?.stem ?? `Q${it.number}`;
        await tx.insert(hwQuestion).values({
          id: questionId, organizationId: EXAM_ORG_ID, assignmentId, position, type: hwTypeOf(it.qtype), prompt: stem, marks: String(it.marks), languageHint: language, answerLines: 1,
          origin: 'custom', originRef: { examItemId: it.id, examNumber: String(it.number), handOnly: check.why }, rubricMode: 'teacher',
        });
        total += it.marks;
        continue;
      }
      const { header, row, plan } = check.offer;
      await tx.insert(hwQuestion).values({
        id: questionId, organizationId: EXAM_ORG_ID, assignmentId, position, type: hwTypeOf(row.qtype), prompt: promptOf(row, plan), marks: String(plan.markableMarks),
        languageHint: language, answerLines: 1, acceptedAnswers: plan.acceptedAnswers, origin: 'board_paper',
        originRef: { ...originRefOf(header, row), examItemId: it.id, examNumber: String(it.number) }, rubricMode: 'key',
      });
      const [created] = await tx.select().from(hwQuestion).where(eq(hwQuestion.id, questionId)).limit(1);
      await queueKey(tx, created!, attempt.userId);
      total += plan.markableMarks;
    } else {
      const choice = CHOICE.has(it.qtype);
      const correct = it.correctOption ?? '';
      const options = it.options as string[];
      const prompt = [it.stem ?? '', ...(choice ? options.map((o, i) => `(${'ABCD'[i]}) ${o}`) : [])].join('\n');
      await tx.insert(hwQuestion).values({
        id: questionId, organizationId: EXAM_ORG_ID, assignmentId, position, type: hwTypeOf(it.qtype), prompt, marks: String(it.marks),
        languageHint: language, answerLines: 1, origin: 'custom', originRef: { examItemId: it.id, examNumber: String(it.number) }, rubricMode: 'teacher',
        // a multiple choice is answered with its letter; code marks it (exact match), never the model
        acceptedAnswers: choice && correct ? [correct, `(${correct})`, `${correct}) ${options['ABCD'.indexOf(correct)] ?? ''}`.trim()] : [],
        modelAnswer: choice ? correct : pointsText(it.parts) || it.schemeText || null,
      });
      if (!choice) {
        const points = (it.parts as { value_points?: { text: string; marks: number }[] }[]).flatMap((p) => p.value_points ?? []);
        if (points.length) {
          await tx.insert(hwRubricItem).values(points.map((v, i) => ({
            id: newId(), organizationId: EXAM_ORG_ID, questionId, position: i, kind: 'key_point' as const, description: v.text, marks: String(v.marks), source: 'teacher' as const,
          })));
        }
      }
      total += it.marks;
    }
  }
  await tx.update(hwAssignment).set({ status: 'published', totalMarks: String(total), publishedAt: new Date() }).where(eq(hwAssignment.id, assignmentId));

  const submissionId = newId();
  await tx.insert(hwSubmission).values({
    id: submissionId, organizationId: EXAM_ORG_ID, assignmentId, studentId: attempt.userId, status: 'processing', submittedAt: attempt.submittedAt ?? new Date(),
  });
  const qs = await tx.select({ id: hwQuestion.id }).from(hwQuestion).where(eq(hwQuestion.assignmentId, assignmentId)).orderBy(asc(hwQuestion.position));
  await tx.insert(hwAnswer).values(qs.map((q) => ({ id: newId(), organizationId: EXAM_ORG_ID, submissionId, questionId: q.id, mode: 'photo' as const, transcriptStatus: 'pending' as const })));
  await tx.update(hwExamAttempt).set({ assignmentId }).where(eq(hwExamAttempt.id, attemptId));
  return { ...(await load(tx, assignmentId, attempt.userId, items)), lang, setId: set.id };
}

async function load(tx: Exec, assignmentId: string, userId: string, items: (typeof hwExamSetItem.$inferSelect)[]) {
  const sub = (await tx.select({ id: hwSubmission.id }).from(hwSubmission)
    .where(and(eq(hwSubmission.assignmentId, assignmentId), eq(hwSubmission.studentId, userId))).limit(1))[0];
  if (!sub) throw new HwError('CONFLICT', 'The attempt’s marking record is incomplete.', `assignment ${assignmentId} has no submission`);
  const rows = await tx.select({ q: hwQuestion, answerId: hwAnswer.id }).from(hwQuestion)
    .innerJoin(hwAnswer, and(eq(hwAnswer.questionId, hwQuestion.id), eq(hwAnswer.submissionId, sub.id)))
    .where(eq(hwQuestion.assignmentId, assignmentId)).orderBy(asc(hwQuestion.position));
  const bankRows = new Map<string, { alt: string | null; group: string | null; scheme: string; options: { letter: string; text: string }[] }>();
  const bankIds = items.flatMap((i) => (i.bankQuestionId ? [i.bankQuestionId] : []));
  if (bankIds.length) {
    for (const b of await tx.select({ id: hwBankQuestion.id, alt: hwBankQuestion.alt, group: hwBankQuestion.choiceGroup, scheme: hwBankQuestion.schemeText, options: hwBankQuestion.options })
      .from(hwBankQuestion).where(inArray(hwBankQuestion.id, bankIds))) {
      bankRows.set(b.id, { alt: b.alt, group: b.group, scheme: b.scheme, options: b.options ?? [] });
    }
  }
  const questions: ExamQuestion[] = rows.map(({ q, answerId }) => {
    const it = items.find((i) => i.id === q.originRef.examItemId);
    if (!it) throw new HwError('CONFLICT', 'The attempt’s questions no longer match its set.', `question ${q.id} has no set item`);
    const bank = it.bankQuestionId ? bankRows.get(it.bankQuestionId) : undefined;
    return {
      itemId: it.id, questionId: q.id, answerId, number: it.number, alt: bank?.alt ?? null, handOnly: q.originRef.handOnly ?? null, choiceGroup: bank?.group ?? null, choice: CHOICE.has(it.qtype),
      marks: Number(q.marks), itemMarks: it.marks, prompt: q.prompt,
      modelAnswer: bank?.scheme || q.modelAnswer || q.acceptedAnswers.join(' / ') || pointsText(it.parts),
      options: !CHOICE.has(it.qtype) ? [] : bank ? bank.options : ((it.options as string[]) ?? []).map((text, i) => ({ letter: 'ABCD'[i]!, text })),
    };
  });
  return { assignmentId, submissionId: sub.id, questions };
}
