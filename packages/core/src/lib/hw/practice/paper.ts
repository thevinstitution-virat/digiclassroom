// Self-practice from a board paper (phase 4, docs/hw-eval/board-paper-importer.md): the published papers a learner can pick from, and starting one
// question of one. Same shape as the textbook practice (attempt.ts): a one-question assignment in the practice institution, in the learner's own section,
// marked against an answer key, but the question is a person-checked row of the bank and its key is the board's own scheme (never written by a model).

import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { hwBankFigure, hwBankPaper, hwBankQuestion } from '@/db/hw-bank-schema';
import { hwAssignment, hwQuestion } from '@/db/hw-schema';
import { getHwConfig } from '../config';
import { HwError } from '../errors';
import { db, newId, type Exec } from '../db';
import { queueKey } from '../keys/product';
import { questionNoOf, type MarkingPlan, type OfficialRow } from '../bank/official';
import { ensureLearnerSpace } from './attempt';
import { paperWrittenReady } from './catalog';
import { answerLinesOf, attemptTitle, hwTypeOf, offerVerdict, originRefOf, promptOf, type PaperHeader, type PaperRowLike } from './paper-rules';
import { PRACTICE_ORG_ID, PRACTICE_TEXT } from './rules';
import { ensurePracticeSpace, isPracticeLearner, practiceEnabled, requireUsableTrial } from './trial';

const both = (t: { en: string; hi: string }) => `${t.en} / ${t.hi}`;

export interface PaperOffer extends PaperHeader { paperId: string; title: string; questions: number }

/** Who is choosing: a learner (written answers need an eligible group; never the visually impaired versions) or a teacher (who marks by hand if need be, and may give a visually impaired version). */
export type Chooser = 'learner' | 'teacher';

export interface PaperQuestionOffer {
  rowId: string;
  variant: 'vi' | null;
  /** "26", or "26A" for an alternative of an internal choice. */
  label: string;
  number: number;
  alt: string | null;
  section: string;
  /** The marks the learner can earn here (a drawing is not counted). */
  marks: number;
  qtype: string;
  stem: string;
  figures: { figureId: string; description: string }[];
  /** A part of the question asks for a drawing, which is not marked here. */
  hasDrawing: boolean;
  /** "Attempt A or B": the other alternatives of the same question, as labels. */
  alsoOffered: string[];
}

interface Loaded { paper: typeof hwBankPaper.$inferSelect; rows: PaperRowLike[]; figures: Map<string, { side: 'paper' | 'scheme'; hasImage: boolean; figureId: string; description: string }[]> }

const asRow = (r: typeof hwBankQuestion.$inferSelect): PaperRowLike => ({
  id: r.id, number: r.number, alt: r.alt, variant: r.variant, section: r.section, qtype: r.qtype, marks: r.marks, stem: r.stem, options: r.options,
  correctOption: r.correctOption, parts: r.parts as OfficialRow['parts'], status: r.status,
});

async function loadPaper(x: Exec, where: ReturnType<typeof eq>): Promise<Loaded | null> {
  const paper = (await x.select().from(hwBankPaper).where(and(where, eq(hwBankPaper.status, 'published'))).limit(1))[0];
  if (!paper) return null;
  const qs = await x.select().from(hwBankQuestion).where(and(eq(hwBankQuestion.paperId, paper.id), eq(hwBankQuestion.status, 'published'))).orderBy(asc(hwBankQuestion.number), sql`${hwBankQuestion.variant} NULLS FIRST`, sql`${hwBankQuestion.alt} NULLS FIRST`);
  const figs = qs.length ? await x.select({ qid: hwBankFigure.questionId, figureId: hwBankFigure.figureId, side: hwBankFigure.side, description: hwBankFigure.description, key: hwBankFigure.storageKey })
    .from(hwBankFigure).where(inArray(hwBankFigure.questionId, qs.map((q) => q.id))) : [];
  const figures: Loaded['figures'] = new Map();
  for (const f of figs) figures.set(f.qid, [...(figures.get(f.qid) ?? []), { side: f.side, hasImage: Boolean(f.key), figureId: f.figureId, description: f.description }]);
  return { paper, rows: qs.map(asRow), figures };
}

const headerOf = (p: typeof hwBankPaper.$inferSelect): PaperHeader => ({ board: p.board, classLevel: p.classLevel, subject: p.subject, subjectCode: p.subjectCode, session: p.session, kind: p.kind });

/** The published papers with at least one question a learner can be offered now. */
export async function offeredPapers(x: Exec, who: Chooser = 'learner'): Promise<PaperOffer[]> {
  const papers = await x.select({ id: hwBankPaper.id }).from(hwBankPaper).where(eq(hwBankPaper.status, 'published')).orderBy(asc(hwBankPaper.classLevel), asc(hwBankPaper.subject), asc(hwBankPaper.session));
  const written = who === 'teacher' || await paperWrittenReady(x);
  const out: PaperOffer[] = [];
  for (const { id } of papers) {
    const l = await loadPaper(x, eq(hwBankPaper.id, id));
    if (!l) continue;
    const n = l.rows.filter((r) => offerVerdict(r, l.figures.get(r.id) ?? [], written, { allowVisuallyImpaired: who === 'teacher' }).ok).length;
    if (n > 0) out.push({ paperId: l.paper.id, ...headerOf(l.paper), title: l.paper.title, questions: n });
  }
  return out;
}

/** The questions of one published paper that a learner can be offered now, in paper order. Null when the paper is not published. */
export async function paperQuestions(x: Exec, paperId: string, who: Chooser = 'learner'): Promise<{ paper: PaperOffer; questions: PaperQuestionOffer[] } | null> {
  const l = await loadPaper(x, eq(hwBankPaper.id, paperId));
  if (!l) return null;
  const written = who === 'teacher' || await paperWrittenReady(x);
  const questions: PaperQuestionOffer[] = [];
  for (const r of l.rows) {
    const figs = l.figures.get(r.id) ?? [];
    const v = offerVerdict(r, figs, written, { allowVisuallyImpaired: who === 'teacher' });
    if (!v.ok) continue;
    questions.push({
      rowId: r.id, variant: r.variant === 'vi' ? 'vi' : null, label: questionNoOf(r), number: r.number, alt: r.alt, section: r.section, marks: v.plan.markableMarks, qtype: r.qtype, stem: r.stem,
      figures: figs.filter((f) => f.side === 'paper').map((f) => ({ figureId: f.figureId, description: f.description })),
      hasDrawing: v.plan.excluded.length > 0, alsoOffered: [],
    });
  }
  // The alternatives of one question know about each other (attempt A or B).
  for (const q of questions) q.alsoOffered = questions.filter((o) => o.number === q.number && o.variant === q.variant && o.rowId !== q.rowId).map((o) => o.label);
  return { paper: { paperId: l.paper.id, ...headerOf(l.paper), title: l.paper.title, questions: questions.length }, questions };
}

/** One offerable row, re-read from the database with everything that makes it offerable re-checked. Null when it is not on offer (to this chooser, now). */
export async function offerOf(x: Exec, rowId: string, who: Chooser): Promise<{ header: PaperHeader; row: PaperRowLike; plan: MarkingPlan } | null> {
  const c = await offerCheck(x, rowId, who);
  return c.ok ? c.offer : null;
}

/** offerOf with the reason when the row is not on offer (exam sets refuse to publish such a row, and say why). */
export async function offerCheck(x: Exec, rowId: string, who: Chooser):
  Promise<{ ok: true; offer: { header: PaperHeader; row: PaperRowLike; plan: MarkingPlan } } | { ok: false; why: string; detail?: string }> {
  const r = (await x.select({ paperId: hwBankQuestion.paperId }).from(hwBankQuestion).where(eq(hwBankQuestion.id, rowId)).limit(1))[0];
  const l = r ? await loadPaper(x, eq(hwBankPaper.id, r.paperId)) : null;
  const row = l?.rows.find((q) => q.id === rowId);
  if (!l || !row) return { ok: false, why: 'not_published' };
  const v = offerVerdict(row, l.figures.get(row.id) ?? [], who === 'teacher' || await paperWrittenReady(x), { allowVisuallyImpaired: who === 'teacher' });
  return v.ok ? { ok: true, offer: { header: headerOf(l.paper), row, plan: v.plan } } : { ok: false, why: v.why, ...(v.detail ? { detail: v.detail } : {}) };
}

/**
 * Start one question of a published paper. The row, its paper, its pictures and its marking are re-checked here, from the database: the server never
 * trusts the browser about what is on offer. The same question twice opens the same attempt.
 */
export async function startPaperAttempt(userId: string, rowId: string): Promise<{ assignmentId: string; reused: boolean }> {
  if (!practiceEnabled()) throw new HwError('FEATURE_DISABLED', both(PRACTICE_TEXT.off));
  if (!(await isPracticeLearner(db, userId))) throw new HwError('FORBIDDEN', both(PRACTICE_TEXT.notStarted));
  await requireUsableTrial(db, userId);

  const offer = await offerOf(db, rowId, 'learner');
  if (!offer) throw new HwError('NOT_FOUND', both(PRACTICE_TEXT.paperGone));
  const { header, row: q, plan } = offer;

  const prior = await db.execute<{ id: string }>(sql`
    SELECT a.id FROM hw_assignment a JOIN hw_question hq ON hq.assignment_id = a.id
     WHERE a.organization_id = ${PRACTICE_ORG_ID} AND a.created_by = ${userId} AND hq.origin_ref ->> 'bankRowId' = ${rowId} LIMIT 1`);
  if (prior.rows[0]) return { assignmentId: prior.rows[0].id, reused: true };

  const limit = getHwConfig().HW_SELF_PRACTICE_MAX_ATTEMPTS;
  const [{ n }] = (await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM hw_assignment WHERE organization_id = ${PRACTICE_ORG_ID} AND created_by = ${userId}`)).rows;
  if (n >= limit) throw new HwError('QUOTA_EXCEEDED', both(PRACTICE_TEXT.attemptLimit));

  const type = hwTypeOf(q.qtype);
  const assignmentId = newId();
  await db.transaction(async (tx) => {
    await ensurePracticeSpace(tx);
    const { classId, sectionId } = await ensureLearnerSpace(tx, userId, header.classLevel);
    await tx.insert(hwAssignment).values({
      id: assignmentId, organizationId: PRACTICE_ORG_ID, classId, sectionId, subject: header.subject,
      title: attemptTitle(header, q), instructions: null, dueAt: null, allowedModes: ['ink', 'typed'], createdBy: userId,
    });
    const questionId = newId();
    await tx.insert(hwQuestion).values({
      id: questionId, organizationId: PRACTICE_ORG_ID, assignmentId, position: 0, type, prompt: promptOf(q, plan), marks: String(plan.markableMarks),
      languageHint: 'en', answerLines: answerLinesOf(type), acceptedAnswers: plan.acceptedAnswers,
      // A board paper: its key is the board's own scheme, read from the person-checked bank (public, like a textbook exercise).
      origin: 'board_paper', originRef: originRefOf(header, q), rubricMode: 'key',
    });
    const [created] = await tx.select().from(hwQuestion).where(eq(hwQuestion.id, questionId)).limit(1);
    await queueKey(tx, created, userId);
    await tx.update(hwAssignment).set({ status: 'published' }).where(eq(hwAssignment.id, assignmentId));
  });
  return { assignmentId, reused: false };
}
