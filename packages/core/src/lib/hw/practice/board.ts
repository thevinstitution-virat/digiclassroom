// InkBuddy board practice (docs/hw-eval/board-bank-roadmap.md, phase 3): the 2026 board questions, chapter by chapter and topic by topic (the NCERT
// sections), written with the pen and marked like any InkBuddy question; after marking, the learner is told which pages of the textbook to revise.
//
// The questions come from the exam packages' question POOLS (migration 035/037), and only from PUBLISHED pools: publishing a pool needs every key the
// assistant wrote to be checked by a named teacher, so a learner never meets an unchecked key. A question is one InkBuddy attempt (one-question
// assignment in the practice space, like a board-paper or textbook question), marked against the pool's own key:
//   - multiple choice and assertion-reason: the right option and the wrong ones by code (official-store.ts choiceRuleOf); anything unclear, by the model;
//   - written answers: by the model against the checked value points, ONLY while the owner's switch HW_INKBUDDY_POOL_AI_ENABLED is on (decision D3
//     for InkBuddy); while it is off, written board questions are simply not offered. A drawing part is never marked (it is left out of the marks).
//
// Phase 4: the learner's weak topics (never tried, or under 60% on the first try; weakTopicsOf) and the quick test (startQuickTest: 5 or 10 of
// these questions in one assignment, one sitting at the board's pace, one grade card). A quick test's questions carry origin_ref.quickTest, so
// they are never a question's own attempt (attempts.ts practiceRefOf), but their marks do count as the learner's first try at the topic.

import { randomInt } from 'node:crypto';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { hwAssignment, hwQuestion, hwRubricItem } from '@/db/hw-schema';
import { hwExamPackage, hwExamSet, hwExamSetItem, type ItemFigure } from '@/db/hw-exams-schema';
import { getHwConfig } from '../config';
import { HwError } from '../errors';
import { db, newId, num, type Exec } from '../db';
import { acceptedAnswersFor } from '../bank/expand';
import { ensureLearnerSpace } from './attempt';
import { drawPractice, practiceMinutes } from '../exams/practice';
import { attemptHistory, questionsStarted } from './attempts';
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

export interface Tried {
  /** Best marks over the marked attempts, null while none is marked. */
  best: number | null;
  /** Marks on the FIRST marked attempt (weak topics, phase 4), null while none is marked. */
  first: number | null;
  outOf: number;
  /** Attempts started, a quick test's question included. */
  attempts: number;
}

/**
 * The learner's marks on every board question they tried, by pool item: on its own (phase 3) or inside a quick test (phase 4). Marks are the
 * question's own (a quick test has many questions in one submission); a returned question left unanswered counts 0.
 */
export async function triedOf(x: Exec, userId: string): Promise<Map<string, Tried>> {
  const r = await x.execute<{ item: string; assignment_id: string; status: string | null; out_of: string; got: string | null }>(sql`
    SELECT q.origin_ref ->> 'poolItemId' AS item, a.id AS assignment_id, s.status, q.marks AS out_of,
           (SELECT sum(gr.marks) FROM hw_answer an JOIN hw_grade gr ON gr.answer_id = an.id WHERE an.submission_id = s.id AND an.question_id = q.id) AS got
      FROM hw_assignment a
      JOIN hw_question q ON q.assignment_id = a.id
      LEFT JOIN hw_submission s ON s.assignment_id = a.id AND s.student_id = ${userId}
     WHERE a.organization_id = ${PRACTICE_ORG_ID} AND a.created_by = ${userId} AND q.origin_ref ? 'poolItemId'
     ORDER BY a.created_at, a.id`);
  const out = new Map<string, Tried>();
  for (const row of r.rows) {
    const t = out.get(row.item) ?? { best: null, first: null, outOf: num(row.out_of), attempts: 0 };
    t.attempts++;
    if (row.status === 'returned') {
      const got = row.got === null ? 0 : num(row.got);
      if (t.first === null) t.first = got;
      t.best = Math.max(t.best ?? 0, got);
    }
    out.set(row.item, t);
  }
  return out;
}

const ncertOf = (it: ItemRow) => it.ncert as { book?: string; chapterNo?: number; section?: string; title?: string; pages?: string };
const sectionKey = (s: string) => s.split('.').map((n) => n.padStart(3, '0')).join('.');

export interface BoardTopic {
  section: string; title: string; pages: string; questions: number; objective: number; written: number; asked: number; tried: number;
  /** Marks so far: the best attempt at each question tried. */
  best: { got: number; of: number } | null;
  /** Marks on the first attempt at each question tried (weak topics). */
  first: { got: number; of: number } | null;
}
export interface BoardChapter { chapterNo: number | null; chapter: string; questions: number; asked: number; topics: BoardTopic[] }
export interface WeakTopic extends BoardTopic { chapter: string; chapterNo: number | null; why: 'never_tried' | 'low_marks' }

/** Below this share of the marks on first attempts, a topic is weak (roadmap phase 4). */
export const WEAK_BELOW = 0.6;
/** How many weak topics the home shows. */
export const WEAK_SHOWN = 6;

/**
 * The learner's weak topics (phase 4): those whose first attempts scored under 60%, then those never tried (owner, 13 Nov 2026: what the
 * learner got wrong comes before what they have not met). Within each, the boards' favourites first (how many times the topic's questions
 * were asked), then the lowest marks. Pure.
 */
export function weakTopicsOf(chapters: BoardChapter[], shown = WEAK_SHOWN): WeakTopic[] {
  const share = (t: BoardTopic) => (t.first && t.first.of > 0 ? t.first.got / t.first.of : 0);
  const rank = (w: WeakTopic) => (w.why === 'low_marks' ? 0 : 1);
  return chapters.flatMap((c) => c.topics.flatMap((t): WeakTopic[] => {
    if (!t.first) return t.tried ? [] : [{ ...t, chapter: c.chapter, chapterNo: c.chapterNo, why: 'never_tried' }]; // tried, marks not back yet: not weak
    return share(t) < WEAK_BELOW ? [{ ...t, chapter: c.chapter, chapterNo: c.chapterNo, why: 'low_marks' }] : [];
  })).sort((a, b) => rank(a) - rank(b) || b.asked - a.asked || share(a) - share(b) || (a.chapterNo ?? 99) - (b.chapterNo ?? 99) || sectionKey(a.section).localeCompare(sectionKey(b.section)))
    .slice(0, shown);
}

/**
 * InkBuddy's board practice home: chapters, and within each its NCERT topics, with how many questions are on offer, how often the boards asked
 * them and the learner's marks; and the learner's weak topics (phase 4).
 */
export async function boardCatalogue(x: Exec, userId: string): Promise<{ available: boolean; writtenOn: boolean; chapters: BoardChapter[]; weak: WeakTopic[]; tests: QuickTestRow[] }> {
  if (!practiceEnabled()) return { available: false, writtenOn: false, chapters: [], weak: [], tests: [] };
  const rows = await poolItems(x, (await learnerClass(userId)).classLevels);
  const tried = await triedOf(x, userId);
  const on = writtenOn();
  const chapters = new Map<string, BoardChapter>();
  const add = (acc: { got: number; of: number } | null, got: number, of: number) => ({ got: (acc?.got ?? 0) + got, of: (acc?.of ?? 0) + of });
  for (const { it } of rows) {
    const plan = boardPlanOf(it, on);
    const n = ncertOf(it);
    if (!plan.ok || !n.section) continue;
    const ch = chapters.get(it.chapter) ?? { chapterNo: n.chapterNo ?? null, chapter: it.chapter, questions: 0, asked: 0, topics: [] };
    chapters.set(it.chapter, ch);
    let t = ch.topics.find((x) => x.section === n.section);
    if (!t) { t = { section: n.section, title: n.title ?? '', pages: n.pages ?? '', questions: 0, objective: 0, written: 0, asked: 0, tried: 0, best: null, first: null }; ch.topics.push(t); }
    const asked = Math.max(1, it.sources.length);
    t.questions++; t.asked += asked; ch.questions++; ch.asked += asked;
    if (plan.mode === 'choice') t.objective++; else t.written++;
    const mine = tried.get(it.id);
    if (mine) {
      t.tried++;
      if (mine.best !== null) t.best = add(t.best, mine.best, plan.marks);
      if (mine.first !== null) t.first = add(t.first, mine.first, plan.marks);
    }
  }
  const list = [...chapters.values()].sort((a, b) => (a.chapterNo ?? 99) - (b.chapterNo ?? 99) || a.chapter.localeCompare(b.chapter));
  for (const c of list) c.topics.sort((a, b) => sectionKey(a.section).localeCompare(sectionKey(b.section)));
  return { available: true, writtenOn: on, chapters: list, weak: weakTopicsOf(list), tests: await quickTestsOf(x, userId) };
}

export interface BoardQuestion {
  itemId: string; qtype: string; marks: number; stem: string; options: { letter: string; text: string }[];
  asked: number; sources: string[]; figures: { description: string; url: string | null }[]; hasDrawing: boolean;
  tried: Tried | null;
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
  // the trial's limit is on different questions, as for textbook questions (practice/attempt.ts); a question met in a quick test is not new
  const tried = await triedOf(db, userId);
  if (!tried.has(it.id) && (await questionsStarted(db, userId)) >= getHwConfig().HW_SELF_PRACTICE_MAX_ATTEMPTS) throw new HwError('QUOTA_EXCEEDED', both(PRACTICE_TEXT.attemptLimit));

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
    await insertBoardQuestion(tx, assignmentId, 0, row, plan);
    await tx.update(hwAssignment).set({ status: 'published', totalMarks: String(plan.marks), publishedAt: new Date() }).where(eq(hwAssignment.id, assignmentId));
  });
  return { assignmentId, reused: false };
}

type PoolRow = Awaited<ReturnType<typeof poolItems>>[number];
type OkPlan = Extract<BoardPlan, { ok: true }>;

/** One pool question as a question of an InkBuddy assignment, with the pool's own key as its rubric. */
async function insertBoardQuestion(tx: Exec, assignmentId: string, position: number, { it, pkg, set }: PoolRow, plan: OkPlan, extraRef: Record<string, string> = {}) {
  const type = hwTypeOf(it.qtype);
  const questionId = newId();
  await tx.insert(hwQuestion).values({
    id: questionId, organizationId: PRACTICE_ORG_ID, assignmentId, position, type, prompt: plan.prompt, marks: String(plan.marks),
    languageHint: 'en', answerLines: answerLinesOf(type), acceptedAnswers: plan.acceptedAnswers,
    modelAnswer: plan.mode === 'choice' ? (it.correctOption ?? null) : plan.rubric.map((r) => r.text).join('; '),
    // the pool's own key, checked by a teacher (or the board's scheme): the question's rubric, never written by a model here
    origin: 'custom', originRef: { ...boardOriginRef(it, pkg.classLevel, set.subject, plan.mode === 'choice'), ...extraRef }, rubricMode: 'teacher',
  });
  await tx.insert(hwRubricItem).values(plan.rubric.map((r, i) => ({
    id: newId(), organizationId: PRACTICE_ORG_ID, questionId, position: i, kind: 'key_point' as const, description: r.text, marks: String(r.marks), source: 'teacher' as const,
  })));
}

// ── the quick test (phase 4) ─────────────────────────────────────────────────

export const QUICK_TEST_SIZES = [5, 10] as const;
export type QuickTestSize = (typeof QUICK_TEST_SIZES)[number];

export const QUICK_TEXT = {
  none: { en: 'No board questions are on offer for these chapters yet.', hi: 'इन अध्यायों के लिए अभी कोई बोर्ड प्रश्न उपलब्ध नहीं है।' },
} as const;

/** The writing time of a quick test at the board's pace (exams/practice.ts: 2¼ minutes a mark, at least ten), when these are a quick test's questions. Pure. */
export function quickTestPace(questions: { marks: string | number; originRef: Record<string, string> | null }[]): { minutes: number; marks: number } | null {
  if (!questions.length || !questions.every((q) => q.originRef?.quickTest)) return null;
  const marks = questions.reduce((s, q) => s + num(q.marks), 0);
  return { minutes: practiceMinutes(marks), marks };
}

/**
 * A quick test (phase 4): 5 or 10 board questions from the chosen chapters (all of them when none is chosen), drawn as pool practice tests are
 * (exams/practice.ts drawPractice: spread over the topics, never both alternatives of one internal choice, in the board's order), written in one
 * sitting at the board's pace. One InkBuddy assignment with one grade card; each question is marked as in phase 3. Each new question counts
 * against the trial's limit on questions. While an earlier quick test is not handed in yet, that one is opened instead.
 */
export async function startQuickTest(userId: string, input: { chapters: string[]; count: QuickTestSize }, rand: (n: number) => number = (n) => randomInt(n)): Promise<{ assignmentId: string; reused: boolean; questions: number }> {
  if (!practiceEnabled()) throw new HwError('FEATURE_DISABLED', both(PRACTICE_TEXT.off));
  if (!(await isPracticeLearner(db, userId))) throw new HwError('FORBIDDEN', both(PRACTICE_TEXT.notStarted));
  await requireUsableTrial(db, userId);
  const on = writtenOn();
  const offered = (await poolItems(db, (await learnerClass(userId)).classLevels)).flatMap((row) => {
    const plan = boardPlanOf(row.it, on);
    const n = ncertOf(row.it);
    if (!plan.ok || !n.section || (input.chapters.length && !input.chapters.includes(row.it.chapter))) return [];
    return [{ row, plan, id: row.it.id, position: row.it.position, qtype: row.it.qtype, marks: plan.marks, topic: n.section, chapter: row.it.chapter, choiceGroup: row.it.choiceGroup, chapterNo: n.chapterNo ?? null }];
  });
  if (!offered.length) throw new HwError('NOT_FOUND', both(QUICK_TEXT.none));

  return db.transaction(async (tx) => {
    // one quick test at a time for this learner, however fast the button is pressed
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`hw-quick-test:${userId}`}))`);
    const open = await tx.execute<{ id: string; n: number }>(sql`
      SELECT a.id, count(q.id)::int AS n FROM hw_assignment a JOIN hw_question q ON q.assignment_id = a.id
        LEFT JOIN hw_submission s ON s.assignment_id = a.id AND s.student_id = ${userId}
       WHERE a.organization_id = ${PRACTICE_ORG_ID} AND a.created_by = ${userId} AND q.origin_ref ? 'quickTest' AND (s.id IS NULL OR s.status = 'draft')
       GROUP BY a.id, a.created_at ORDER BY a.created_at DESC LIMIT 1`);
    if (open.rows[0]) return { assignmentId: open.rows[0].id, reused: true, questions: open.rows[0].n };

    const chosen = drawPractice(offered, { topics: [], types: [], count: input.count }, rand);
    const tried = await triedOf(tx, userId);
    const fresh = chosen.filter((c) => !tried.has(c.id)).length;
    if ((await questionsStarted(tx, userId)) + fresh > getHwConfig().HW_SELF_PRACTICE_MAX_ATTEMPTS) throw new HwError('QUOTA_EXCEEDED', both(PRACTICE_TEXT.attemptLimit));

    const { pkg, set } = chosen[0]!.row;
    const marks = chosen.reduce((s, c) => s + c.marks, 0);
    const minutes = practiceMinutes(marks);
    const chapterNos = [...new Set(chosen.map((c) => c.chapterNo).filter((n): n is number => n !== null))].sort((a, b) => a - b);
    const assignmentId = newId();
    await ensurePracticeSpace(tx);
    const { classId, sectionId } = await ensureLearnerSpace(tx, userId, pkg.classLevel);
    await tx.insert(hwAssignment).values({
      id: assignmentId, organizationId: PRACTICE_ORG_ID, classId, sectionId, subject: set.subject,
      title: `${pkg.board} quick test · ${chosen.length} board questions${chapterNos.length ? ` · ${chapterNos.length > 1 ? 'chapters' : 'chapter'} ${chapterNos.join(', ')}` : ''}`.slice(0, 300),
      instructions: `${minutes} minutes for ${marks} marks, the board's pace. Write every answer in one sitting, then hand in.`,
      dueAt: null, allowedModes: ['ink', 'typed'], createdBy: userId,
    });
    for (const [i, c] of chosen.entries()) await insertBoardQuestion(tx, assignmentId, i, c.row, c.plan, { quickTest: '1' });
    await tx.update(hwAssignment).set({ status: 'published', totalMarks: String(marks), publishedAt: new Date() }).where(eq(hwAssignment.id, assignmentId));
    return { assignmentId, reused: false, questions: chosen.length };
  });
}

export interface QuickTestRow { assignmentId: string; title: string; at: string; questions: number; outOf: number; status: string | null; got: number | null }

/** The learner's quick tests, newest first, with their marks once returned. */
export async function quickTestsOf(x: Exec, userId: string, limit = 10): Promise<QuickTestRow[]> {
  const r = await x.execute<{ id: string; title: string; created_at: Date | string; n: number; total_marks: string | null; status: string | null; got: string | null }>(sql`
    SELECT a.id, a.title, a.created_at, count(q.id)::int AS n, a.total_marks, s.status,
           CASE WHEN s.status = 'returned' THEN coalesce((SELECT sum(g.marks) FROM hw_answer an JOIN hw_grade g ON g.answer_id = an.id WHERE an.submission_id = s.id), 0) END AS got
      FROM hw_assignment a JOIN hw_question q ON q.assignment_id = a.id
      LEFT JOIN hw_submission s ON s.assignment_id = a.id AND s.student_id = ${userId}
     WHERE a.organization_id = ${PRACTICE_ORG_ID} AND a.created_by = ${userId} AND q.origin_ref ? 'quickTest'
     GROUP BY a.id, s.id
     ORDER BY a.created_at DESC, a.id DESC
     LIMIT ${limit}`);
  return r.rows.map((row) => ({
    assignmentId: row.id, title: row.title, at: new Date(row.created_at).toISOString(), questions: row.n, outOf: num(row.total_marks),
    status: row.status, got: row.got === null ? null : num(row.got),
  }));
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
