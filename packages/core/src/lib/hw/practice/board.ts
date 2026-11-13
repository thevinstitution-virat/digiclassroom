// InkBuddy board practice (docs/hw-eval/board-bank-roadmap.md, phase 3): the 2026 board questions, chapter by chapter and topic by topic (the NCERT
// sections), written with the pen and marked like any InkBuddy question; after marking, the learner is told which pages of the textbook to revise.
//
// The questions come from the exam packages' question POOLS (migration 035/037), and only from PUBLISHED pools: publishing a pool needs every key the
// assistant wrote to be checked by a named teacher, so a learner never meets an unchecked key. A question is one InkBuddy attempt (one-question
// assignment in the practice space, like a board-paper or textbook question), marked against the pool's own key:
//   - multiple choice and assertion-reason: the right option and the wrong ones by code (official-store.ts choiceRuleOf); anything unclear, by the model;
//   - written answers: by the model against the checked value points, ONLY while the owner's switch HW_INKBUDDY_POOL_AI_ENABLED is on (decision D3
//     for InkBuddy); while it is off, written board questions are simply not offered. A drawing part is never marked (it is left out of the marks).

import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { hwAssignment, hwQuestion, hwRubricItem } from '@/db/hw-schema';
import { hwExamPackage, hwExamSet, hwExamSetItem, type ItemFigure } from '@/db/hw-exams-schema';
import { getHwConfig } from '../config';
import { HwError } from '../errors';
import { db, newId, num, type Exec } from '../db';
import { acceptedAnswersFor } from '../bank/expand';
import { ensureLearnerSpace } from './attempt';
import { attemptHistory } from './attempts';
import { answerLinesOf, hwTypeOf } from './paper-rules';
import { PRACTICE_ORG_ID, PRACTICE_TEXT } from './rules';
import { ensurePracticeSpace, isPracticeLearner, practiceEnabled, requireUsableTrial } from './trial';
import { learnerClass } from './learner-class';

const both = (t: { en: string; hi: string }) => `${t.en} / ${t.hi}`;
/** A key the assistant wrote says so in its scheme text (the same rule as exams/builder.ts keyNeedsCheck). */
const keyNeedsCheck = (schemeText: string | null | undefined) => (schemeText ?? '').startsWith('KEY TO CHECK');
const OBJECTIVE = new Set(['mcq', 'assertion_reason']);

export const BOARD_TEXT = {
  gone: { en: 'This board question is not on offer now.', hi: 'यह बोर्ड प्रश्न अभी उपलब्ध नहीं है।' },
  writeLetter: 'Write the letter of the correct option.',
} as const;

/** Where a chapter of NCERT Class X Science (2026-27 reprint) starts: its own PDF on ncert.nic.in starts at this printed page. */
export const NCERT_SCI10_FIRST_PAGE: Record<number, number> = { 1: 1, 2: 17, 3: 37, 4: 58, 5: 79, 6: 100, 7: 113, 8: 128, 9: 134, 10: 161, 11: 171, 12: 195, 13: 208 };

export interface Revise { book: string; chapterNo: number | null; chapter: string; section: string; title: string; pages: string; url: string | null }

/**
 * What to revise after a board question: its NCERT section and printed pages, and a link to that page of the chapter's PDF on ncert.nic.in
 * (Class X Science, English: jesc1NN.pdf). Null when the question carries no textbook reference. Pure.
 */
export function reviseOf(ref: Record<string, string> | null | undefined, classLevel?: number): Revise | null {
  if (!ref?.ncertSection) return null;
  const chapterNo = ref.chapterNo ? Number(ref.chapterNo) : null;
  const first = chapterNo ? NCERT_SCI10_FIRST_PAGE[chapterNo] : undefined;
  const from = Number((ref.ncertPages ?? '').split('-')[0]);
  const science10 = (classLevel ?? Number(ref.classLevel)) === 10 && /science/i.test(ref.subject ?? 'Science');
  const url = science10 && chapterNo && first && from >= first
    ? `https://ncert.nic.in/textbook/pdf/jesc1${String(chapterNo).padStart(2, '0')}.pdf#page=${from - first + 1}` : null;
  return { book: ref.book || 'NCERT', chapterNo, chapter: ref.chapter ?? '', section: ref.ncertSection, title: ref.ncertTitle ?? '', pages: ref.ncertPages ?? '', url };
}

type ItemRow = typeof hwExamSetItem.$inferSelect;
type Part = { label?: string; marks?: number; answer_kind?: string; value_points?: { text: string; marks: number }[] };

export type BoardPlan =
  | { ok: true; mode: 'choice'; marks: number; prompt: string; acceptedAnswers: string[]; wrongAnswers: string[]; rubric: { text: string; marks: number }[]; hasDrawing: false }
  | { ok: true; mode: 'written'; marks: number; prompt: string; acceptedAnswers: []; wrongAnswers: []; rubric: { text: string; marks: number }[]; hasDrawing: boolean }
  | { ok: false; why: 'key_unchecked' | 'written_off' | 'nothing_markable' | 'no_answer' };

/** How a pool question is offered and marked in InkBuddy, or why it is not. Pure: `writtenOn` is HW_INKBUDDY_POOL_AI_ENABLED. */
export function boardPlanOf(it: Pick<ItemRow, 'qtype' | 'marks' | 'stem' | 'options' | 'correctOption' | 'parts' | 'schemeText' | 'keyCheckedBy'>, writtenOn: boolean): BoardPlan {
  if (keyNeedsCheck(it.schemeText) && !it.keyCheckedBy) return { ok: false, why: 'key_unchecked' };
  const stem = (it.stem ?? '').trim();
  if (OBJECTIVE.has(it.qtype)) {
    const options = (it.options as string[]).map((text, i) => ({ letter: 'ABCD'[i]!, text }));
    const correct = it.correctOption ?? '';
    if (options.length !== 4 || !correct) return { ok: false, why: 'no_answer' };
    const wrong = [...new Set(options.filter((o) => o.letter !== correct).flatMap((o) => acceptedAnswersFor(o.letter, options)))];
    const right = options.find((o) => o.letter === correct)!;
    return {
      ok: true, mode: 'choice', marks: num(it.marks), hasDrawing: false,
      prompt: [stem, options.map((o) => `${o.letter}. ${o.text.trim()}`).join('\n'), BOARD_TEXT.writeLetter].join('\n\n'),
      acceptedAnswers: acceptedAnswersFor(correct, options), wrongAnswers: wrong,
      rubric: [{ text: `The correct option, (${correct})${right.text.trim() ? `: ${right.text.trim()}` : ''}`, marks: num(it.marks) }],
    };
  }
  if (!writtenOn) return { ok: false, why: 'written_off' };
  const parts = it.parts as Part[];
  const drawn = parts.filter((p) => p.answer_kind === 'diagram');
  const markable = parts.filter((p) => p.answer_kind !== 'diagram');
  const rubric = markable.flatMap((p) => (p.value_points ?? []).map((v) => ({ text: p.label ? `(${p.label}) ${v.text}` : v.text, marks: num(v.marks) })));
  const marks = Math.round(rubric.reduce((s, r) => s + r.marks, 0) * 2) / 2;
  if (!rubric.length || marks <= 0) return { ok: false, why: 'nothing_markable' };
  const note = drawn.length
    ? `\n\n(${drawn.map((p) => `Part ${p.label || ''}`.trim()).join(', ')} asks for a drawing. Draw it on paper: it is not marked here, and its marks are not counted.)` : '';
  return { ok: true, mode: 'written', marks, prompt: stem + note, acceptedAnswers: [], wrongAnswers: [], rubric, hasDrawing: drawn.length > 0 };
}

const writtenOn = () => getHwConfig().HW_INKBUDDY_POOL_AI_ENABLED;

/** The pool questions on offer to a class: items of published pools in published packages for that class. */
async function poolItems(x: Exec, classLevels: number[], where?: ReturnType<typeof eq>) {
  if (!classLevels.length) return [];
  return x.select({ it: hwExamSetItem, pkg: { classLevel: hwExamPackage.classLevel, board: hwExamPackage.board }, set: { id: hwExamSet.id, subject: hwExamSet.subject } })
    .from(hwExamSetItem)
    .innerJoin(hwExamSet, eq(hwExamSet.id, hwExamSetItem.setId))
    .innerJoin(hwExamPackage, eq(hwExamPackage.id, hwExamSet.packageId))
    .where(and(eq(hwExamSet.kind, 'pool'), eq(hwExamSet.status, 'published'), eq(hwExamPackage.status, 'published'), inArray(hwExamPackage.classLevel, classLevels), ...(where ? [where] : [])))
    .orderBy(asc(hwExamSet.position), asc(hwExamSetItem.position));
}

/** The learner's marks on every board question they tried: best and latest, by pool item. */
async function triedOf(x: Exec, userId: string): Promise<Map<string, { best: number | null; outOf: number; attempts: number }>> {
  const r = await x.execute<{ item: string; best: string | null; out_of: string; n: number }>(sql`
    SELECT q.origin_ref ->> 'poolItemId' AS item, max(g.got) AS best, max(q.marks) AS out_of, count(DISTINCT a.id)::int AS n
      FROM hw_assignment a
      JOIN hw_question q ON q.assignment_id = a.id
      LEFT JOIN hw_submission s ON s.assignment_id = a.id AND s.student_id = ${userId}
      LEFT JOIN LATERAL (SELECT sum(gr.marks) AS got FROM hw_answer an JOIN hw_grade gr ON gr.answer_id = an.id WHERE an.submission_id = s.id AND s.status = 'returned') g ON true
     WHERE a.organization_id = ${PRACTICE_ORG_ID} AND a.created_by = ${userId} AND q.origin_ref ? 'poolItemId'
     GROUP BY 1`);
  return new Map(r.rows.map((row) => [row.item, { best: row.best === null ? null : num(row.best), outOf: num(row.out_of), attempts: row.n }]));
}

const ncertOf = (it: ItemRow) => it.ncert as { book?: string; chapterNo?: number; section?: string; title?: string; pages?: string };
const sectionKey = (s: string) => s.split('.').map((n) => n.padStart(3, '0')).join('.');

export interface BoardTopic { section: string; title: string; pages: string; questions: number; objective: number; written: number; asked: number; tried: number; best: { got: number; of: number } | null }
export interface BoardChapter { chapterNo: number | null; chapter: string; questions: number; asked: number; topics: BoardTopic[] }

/** InkBuddy's board practice home: chapters, and within each its NCERT topics, with how many questions are on offer, how often the boards asked them, and the learner's marks. */
export async function boardCatalogue(x: Exec, userId: string): Promise<{ available: boolean; writtenOn: boolean; chapters: BoardChapter[] }> {
  if (!practiceEnabled()) return { available: false, writtenOn: false, chapters: [] };
  const rows = await poolItems(x, (await learnerClass(userId)).classLevels);
  const tried = await triedOf(x, userId);
  const on = writtenOn();
  const chapters = new Map<string, BoardChapter>();
  for (const { it } of rows) {
    const plan = boardPlanOf(it, on);
    const n = ncertOf(it);
    if (!plan.ok || !n.section) continue;
    const ch = chapters.get(it.chapter) ?? { chapterNo: n.chapterNo ?? null, chapter: it.chapter, questions: 0, asked: 0, topics: [] };
    chapters.set(it.chapter, ch);
    let t = ch.topics.find((x) => x.section === n.section);
    if (!t) { t = { section: n.section, title: n.title ?? '', pages: n.pages ?? '', questions: 0, objective: 0, written: 0, asked: 0, tried: 0, best: null }; ch.topics.push(t); }
    const asked = Math.max(1, it.sources.length);
    t.questions++; t.asked += asked; ch.questions++; ch.asked += asked;
    if (plan.mode === 'choice') t.objective++; else t.written++;
    const mine = tried.get(it.id);
    if (mine) {
      t.tried++;
      if (mine.best !== null) t.best = { got: (t.best?.got ?? 0) + mine.best, of: (t.best?.of ?? 0) + plan.marks };
    }
  }
  const list = [...chapters.values()].sort((a, b) => (a.chapterNo ?? 99) - (b.chapterNo ?? 99) || a.chapter.localeCompare(b.chapter));
  for (const c of list) c.topics.sort((a, b) => sectionKey(a.section).localeCompare(sectionKey(b.section)));
  return { available: true, writtenOn: on, chapters: list };
}

export interface BoardQuestion {
  itemId: string; qtype: string; marks: number; stem: string; options: { letter: string; text: string }[];
  asked: number; sources: string[]; figures: { description: string; url: string | null }[]; hasDrawing: boolean;
  tried: { best: number | null; outOf: number; attempts: number } | null;
}

/** The questions of one NCERT topic (section) on offer to the learner, most-asked first. Never the right option, the key or the scheme. */
export async function boardQuestions(x: Exec, userId: string, section: string, sign?: (key: string) => Promise<string>): Promise<{ topic: BoardTopic | null; chapter: string; questions: BoardQuestion[] }> {
  if (!practiceEnabled()) return { topic: null, chapter: '', questions: [] };
  const rows = await poolItems(x, (await learnerClass(userId)).classLevels, sql`${hwExamSetItem.ncert} ->> 'section' = ${section}` as never);
  const tried = await triedOf(x, userId);
  const on = writtenOn();
  const out: BoardQuestion[] = [];
  let chapter = '';
  for (const { it } of rows) {
    const plan = boardPlanOf(it, on);
    if (!plan.ok) continue;
    chapter = it.chapter;
    out.push({
      itemId: it.id, qtype: it.qtype, marks: plan.marks, stem: (it.stem ?? '').trim(),
      options: plan.mode === 'choice' ? (it.options as string[]).map((text, i) => ({ letter: 'ABCD'[i]!, text })) : [],
      asked: Math.max(1, it.sources.length), sources: it.sources,
      figures: await Promise.all((it.figures as ItemFigure[]).map(async (f) => ({ description: f.description, url: sign ? await sign(f.key) : null }))),
      hasDrawing: plan.hasDrawing, tried: tried.get(it.id) ?? null,
    });
  }
  out.sort((a, b) => b.asked - a.asked || a.marks - b.marks);
  const cat = out.length ? (await boardCatalogue(x, userId)).chapters.flatMap((c) => c.topics).find((t) => t.section === section) ?? null : null;
  return { topic: cat, chapter, questions: out };
}

/** The origin_ref of an InkBuddy attempt at a pool question: strings only (hw_question.origin_ref). */
export function boardOriginRef(it: Pick<ItemRow, 'id' | 'setId' | 'chapter' | 'sources' | 'ncert'>, classLevel: number, subject: string, objective: boolean): Record<string, string> {
  const n = it.ncert as { book?: string; chapterNo?: number; section?: string; title?: string; pages?: string };
  return {
    poolItemId: it.id, poolSetId: it.setId, objective: objective ? '1' : '0', classLevel: String(classLevel), subject, chapter: it.chapter,
    sources: it.sources.join(', '),
    ...(n.section ? { ncertSection: n.section, ncertTitle: n.title ?? '', ncertPages: n.pages ?? '', book: n.book ?? '', chapterNo: n.chapterNo ? String(n.chapterNo) : '' } : {}),
  };
}

/**
 * Start a board question (or open the learner's latest attempt at it). Everything that makes it offerable is re-read from the database here: the
 * server never trusts the browser. Further attempts after marking go through "write it again" (attempts.ts), like every InkBuddy question.
 */
export async function startBoardAttempt(userId: string, itemId: string): Promise<{ assignmentId: string; reused: boolean }> {
  if (!practiceEnabled()) throw new HwError('FEATURE_DISABLED', both(PRACTICE_TEXT.off));
  if (!(await isPracticeLearner(db, userId))) throw new HwError('FORBIDDEN', both(PRACTICE_TEXT.notStarted));
  await requireUsableTrial(db, userId);
  const lc = await learnerClass(userId);
  const row = (await poolItems(db, lc.classLevels, eq(hwExamSetItem.id, itemId)))[0];
  const plan = row ? boardPlanOf(row.it, writtenOn()) : null;
  if (!row || !plan?.ok) throw new HwError('NOT_FOUND', both(BOARD_TEXT.gone));
  const { it, pkg, set } = row;

  const history = await attemptHistory(db, userId, `pool:${it.id}`);
  if (history.length) return { assignmentId: history[history.length - 1]!.assignmentId, reused: true };
  const limit = getHwConfig().HW_SELF_PRACTICE_MAX_ATTEMPTS;
  const [{ n }] = (await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM hw_assignment WHERE organization_id = ${PRACTICE_ORG_ID} AND created_by = ${userId}`)).rows;
  if (n >= limit) throw new HwError('QUOTA_EXCEEDED', both(PRACTICE_TEXT.attemptLimit));

  const type = hwTypeOf(it.qtype);
  const assignmentId = newId();
  await db.transaction(async (tx) => {
    await ensurePracticeSpace(tx);
    const { classId, sectionId } = await ensureLearnerSpace(tx, userId, pkg.classLevel);
    const ncert = ncertOf(it);
    await tx.insert(hwAssignment).values({
      id: assignmentId, organizationId: PRACTICE_ORG_ID, classId, sectionId, subject: set.subject,
      title: `${pkg.board} board question · ${ncert.section ? `NCERT ${ncert.section} ${ncert.title}` : it.chapter} · ${it.sources[0] ?? ''}`.slice(0, 300),
      instructions: null, dueAt: null, allowedModes: ['ink', 'typed'], createdBy: userId,
    });
    const questionId = newId();
    await tx.insert(hwQuestion).values({
      id: questionId, organizationId: PRACTICE_ORG_ID, assignmentId, position: 0, type, prompt: plan.prompt, marks: String(plan.marks),
      languageHint: 'en', answerLines: answerLinesOf(type), acceptedAnswers: plan.acceptedAnswers,
      modelAnswer: plan.mode === 'choice' ? (it.correctOption ?? null) : plan.rubric.map((r) => r.text).join('; '),
      // the pool's own key, checked by a teacher (or the board's scheme): the question's rubric, never written by a model here
      origin: 'custom', originRef: boardOriginRef(it, pkg.classLevel, set.subject, plan.mode === 'choice'), rubricMode: 'teacher',
    });
    await tx.insert(hwRubricItem).values(plan.rubric.map((r, i) => ({
      id: newId(), organizationId: PRACTICE_ORG_ID, questionId, position: i, kind: 'key_point' as const, description: r.text, marks: String(r.marks), source: 'teacher' as const,
    })));
    await tx.update(hwAssignment).set({ status: 'published', totalMarks: String(plan.marks), publishedAt: new Date() }).where(eq(hwAssignment.id, assignmentId));
  });
  return { assignmentId, reused: false };
}

/** The pictures of a pool question, for the answer screen (the item's own, never the scheme's). */
export async function boardFiguresOf(x: Exec, itemIds: string[], sign: (key: string) => Promise<string>): Promise<Map<string, { figureId: string; description: string; url: string }[]>> {
  const out = new Map<string, { figureId: string; description: string; url: string }[]>();
  if (!itemIds.length) return out;
  for (const r of await x.select({ id: hwExamSetItem.id, figures: hwExamSetItem.figures }).from(hwExamSetItem).where(inArray(hwExamSetItem.id, itemIds))) {
    const figs = r.figures as ItemFigure[];
    if (figs.length) out.set(r.id, await Promise.all(figs.map(async (f, k) => ({ figureId: `fig${k + 1}`, description: f.description, url: await sign(f.key) }))));
  }
  return out;
}

/** The by-code rule for an InkBuddy multiple-choice board question (choiceRuleOf): read from its pool item, which must still be published and checked. */
export async function boardChoiceRule(x: Exec, poolItemId: string): Promise<{ acceptedAnswers: string[]; wrongAnswers: string[] } | null> {
  const r = (await x.select({ it: hwExamSetItem, status: hwExamSet.status }).from(hwExamSetItem).innerJoin(hwExamSet, eq(hwExamSet.id, hwExamSetItem.setId))
    .where(eq(hwExamSetItem.id, poolItemId)).limit(1))[0];
  if (!r || r.status === 'draft') return null;
  const plan = boardPlanOf(r.it, false);
  return plan.ok && plan.mode === 'choice' ? { acceptedAnswers: plan.acceptedAnswers, wrongAnswers: plan.wrongAnswers } : null;
}
