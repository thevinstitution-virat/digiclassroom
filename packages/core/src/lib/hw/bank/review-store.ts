// The review's database side (phase 2): read what is stored for a paper, and record a verdict file in one transaction. The paper row is locked for
// the length of the write, so two reviews of one paper take turns. Rows only ever go draft -> checked (or back to draft, or to rejected); their
// content is never touched here, and the database refuses it if anything tried (migration 032 guard).

import { randomUUID } from 'node:crypto';
import { and, asc, eq } from 'drizzle-orm';
import type { db as Db } from '@/db';
import { hwBankFigure, hwBankImport, hwBankPaper, hwBankQuestion, hwBankReview } from '@/db/hw-bank-schema';
import {
  planReview, reviewStatus, type LastReview, type ReviewPaper, type ReviewPlan, type ReviewRow, type ReviewStatus, type VerdictFile,
} from './review';
import type { ReviewSheetData } from './review-sheet';

type Database = typeof Db;
type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
type Reader = Database | Tx;

/** Which paper: the same identity the importer uses. */
export interface PaperIdentity { board: string; klass: number; code: string; year: string; kind: 'sqp' | 'past_paper' }

export const identityOfFile = (f: VerdictFile): PaperIdentity => f.paper;
export const identityOfExpanded = (p: { board: string; classLevel: number; subjectCode: string; session: string; kind: 'sqp' | 'past_paper' }): PaperIdentity =>
  ({ board: p.board, klass: p.classLevel, code: p.subjectCode, year: p.session, kind: p.kind });

const identityWhere = (i: PaperIdentity) => and(
  eq(hwBankPaper.board, i.board), eq(hwBankPaper.classLevel, i.klass), eq(hwBankPaper.subjectCode, i.code), eq(hwBankPaper.session, i.year), eq(hwBankPaper.kind, i.kind),
);

export class PaperNotFoundError extends Error {
  constructor(i: PaperIdentity) {
    super(`${i.board} Class ${i.klass} ${i.code} ${i.year} (${i.kind}) is not in the bank: import it first`);
    this.name = 'PaperNotFoundError';
  }
}

export class ReviewRefusedError extends Error {
  constructor(public readonly plan: ReviewPlan) {
    super(`${plan.problems.length} problem${plan.problems.length === 1 ? '' : 's'} in the verdict file; nothing was recorded.`);
    this.name = 'ReviewRefusedError';
  }
}

interface State { paper: ReviewPaper & { version: number; title: string }; rows: ReviewRow[]; last: LastReview[] }

async function loadState(d: Reader, i: PaperIdentity): Promise<State> {
  const p = (await d.select().from(hwBankPaper).where(identityWhere(i)).limit(1))[0];
  if (!p) throw new PaperNotFoundError(i);
  const q = await d.select({
    id: hwBankQuestion.id, number: hwBankQuestion.number, alt: hwBankQuestion.alt, variant: hwBankQuestion.variant, status: hwBankQuestion.status,
    contentHash: hwBankQuestion.contentHash, version: hwBankQuestion.version, needsCheck: hwBankQuestion.needsCheck, marks: hwBankQuestion.marks, choiceGroup: hwBankQuestion.choiceGroup,
  }).from(hwBankQuestion).where(eq(hwBankQuestion.paperId, p.id));
  const reviews = await d.select().from(hwBankReview).where(eq(hwBankReview.paperId, p.id)).orderBy(asc(hwBankReview.createdAt));
  const lastBy = new Map<string, LastReview>();
  for (const r of reviews) if (r.questionId) lastBy.set(r.questionId, { questionId: r.questionId, contentHash: r.contentHash, verdict: r.verdict, note: r.note, reviewer: r.reviewer });
  return {
    paper: { id: p.id, status: p.status, maxMarks: p.maxMarks, version: p.version, title: p.title },
    rows: q,
    last: [...lastBy.values()],
  };
}

/** What recording this file would do. Writes nothing. */
export async function reviewDryRun(database: Database, file: VerdictFile): Promise<ReviewPlan> {
  const s = await loadState(database, identityOfFile(file));
  return planReview(s.paper, s.rows, s.last, file);
}

/** Where the paper stands: how many rows are checked, which fixes are waiting. */
export async function paperReviewStatus(database: Database, i: PaperIdentity): Promise<ReviewStatus> {
  const s = await loadState(database, i);
  return reviewStatus(s.paper, s.rows, s.last);
}

export interface ReviewResult { plan: ReviewPlan; written: boolean }

/** Records the verdicts. Refuses (nothing written) when any verdict cannot be applied. */
export async function applyReview(database: Database, file: VerdictFile, meta: { recordedBy: string }): Promise<ReviewResult> {
  const ident = identityOfFile(file);
  return database.transaction(async (tx) => {
    await tx.select({ id: hwBankPaper.id }).from(hwBankPaper).where(identityWhere(ident)).for('update').limit(1);
    const s = await loadState(tx, ident);
    const plan = planReview(s.paper, s.rows, s.last, file);
    if (plan.problems.length) throw new ReviewRefusedError(plan);
    if (!plan.changes) return { plan, written: false };

    const reviewer = file.reviewer.trim();
    const now = new Date();
    for (const i of plan.items) {
      if (i.action === 'unchanged') continue;
      await tx.insert(hwBankReview).values({
        id: randomUUID(), paperId: s.paper.id, questionId: i.row.id, number: i.row.number, alt: i.row.alt as 'A' | 'B' | 'C' | 'D' | null,
        variant: i.row.variant as 'vi' | null, questionVersion: i.row.version, contentHash: i.row.contentHash, verdict: i.verdict.verdict,
        confirmed: i.verdict.verdict === 'ok' ? i.verdict.confirmed : [], note: i.note, reviewer, recordedBy: meta.recordedBy,
      });
      if (i.action === 'check') await tx.update(hwBankQuestion).set({ status: 'checked', checkedBy: reviewer, checkedAt: now }).where(eq(hwBankQuestion.id, i.row.id));
      else if (i.action === 'withdraw') await tx.update(hwBankQuestion).set({ status: 'draft', checkedBy: null, checkedAt: null }).where(eq(hwBankQuestion.id, i.row.id));
      else if (i.action === 'reject') await tx.update(hwBankQuestion).set({ status: 'rejected', checkedBy: null, checkedAt: null }).where(eq(hwBankQuestion.id, i.row.id));
    }
    // Rows first: the database only lets a paper become checked when every row already is.
    if (plan.paperAfter) await tx.update(hwBankPaper).set({ status: plan.paperAfter }).where(eq(hwBankPaper.id, s.paper.id));
    return { plan, written: true };
  });
}

/** Everything a reviewer needs to see for one paper, as the sheet shows it. Rows are in paper order. */
export async function loadSheetData(database: Database, i: PaperIdentity, opts: { /** The picture behind a storage key as a data: link, or null. Without it the sheet shows the words only. */ readImage?: (key: string) => Promise<string | null> } = {}): Promise<ReviewSheetData> {
  const s = await loadState(database, i);
  const q = await database.select().from(hwBankQuestion).where(eq(hwBankQuestion.paperId, s.paper.id));
  const figs = await database.select({
    questionId: hwBankFigure.questionId, figureId: hwBankFigure.figureId, side: hwBankFigure.side, description: hwBankFigure.description, labels: hwBankFigure.labels,
    readings: hwBankFigure.readings, confidence: hwBankFigure.confidence, needsPersonCheck: hwBankFigure.needsPersonCheck, note: hwBankFigure.note, storageKey: hwBankFigure.storageKey,
  }).from(hwBankFigure).innerJoin(hwBankQuestion, eq(hwBankQuestion.id, hwBankFigure.questionId)).where(eq(hwBankQuestion.paperId, s.paper.id));
  const images = new Map<string, string | null>();
  if (opts.readImage) for (const f of figs) if (f.storageKey && !images.has(f.storageKey)) images.set(f.storageKey, await opts.readImage(f.storageKey));
  const rank = (r: { number: number; alt: string | null; variant: string | null }) => r.number * 10 + (r.variant ? 5 : 0) + (r.alt ? r.alt.charCodeAt(0) - 64 : 0) / 10;
  const paper = (await database.select().from(hwBankPaper).where(eq(hwBankPaper.id, s.paper.id)))[0];
  return {
    paper: {
      board: paper.board, klass: paper.classLevel, subject: paper.subject, code: paper.subjectCode, year: paper.session, kind: paper.kind, title: paper.title,
      maxMarks: paper.maxMarks, status: paper.status, version: paper.version,
    },
    rows: q.sort((a, b) => rank(a) - rank(b)).map((r) => ({
      number: r.number, alt: r.alt, variant: r.variant, section: r.section, marks: r.marks, qtype: r.qtype, stem: r.stem, options: r.options, correctOption: r.correctOption,
      parts: r.parts, schemeText: r.schemeText, equations: r.equations as { plain: string; latex: string }[], diagramParts: r.diagramParts, needsCheck: r.needsCheck,
      status: r.status, version: r.version, contentHash: r.contentHash, checkedBy: r.checkedBy, choiceGroup: r.choiceGroup,
      figures: figs.filter((f) => f.questionId === r.id).map(({ questionId: _q, storageKey, ...f }) => { void _q; return { ...f, imageDataUri: storageKey ? images.get(storageKey) ?? null : null }; }),
    })),
  };
}

export class PublishRefusedError extends Error {
  constructor(message: string) { super(message); this.name = 'PublishRefusedError'; }
}

/**
 * The owner's go-live for a paper: every row checked by a person, the marks adding up (the paper is `checked`), then paper and rows become `published`,
 * which is what learners are offered. The act is logged with who did it. `unpublish` is the way back (rows to `checked`, the paper to `checked`).
 */
export async function setPublished(database: Database, i: PaperIdentity, publish: boolean, meta: { actor: string }): Promise<{ rows: number }> {
  return database.transaction(async (tx) => {
    await tx.select({ id: hwBankPaper.id }).from(hwBankPaper).where(identityWhere(i)).for('update').limit(1);
    const s = await loadState(tx, i);
    const from = publish ? 'checked' : 'published';
    const to = publish ? 'published' : 'checked';
    if (s.paper.status !== from) {
      throw new PublishRefusedError(publish
        ? `the paper is ${s.paper.status}: it can be published only when every question has been checked (status: checked)`
        : `the paper is ${s.paper.status}, not published`);
    }
    const rows = await tx.update(hwBankQuestion).set({ status: to }).where(and(eq(hwBankQuestion.paperId, s.paper.id), eq(hwBankQuestion.status, from))).returning({ id: hwBankQuestion.id });
    await tx.update(hwBankPaper).set({ status: to }).where(eq(hwBankPaper.id, s.paper.id));
    const p = (await tx.select({ sha: hwBankPaper.sourceSha256 }).from(hwBankPaper).where(eq(hwBankPaper.id, s.paper.id)))[0];
    await tx.insert(hwBankImport).values({ id: randomUUID(), paperId: s.paper.id, actor: meta.actor, sourceSha256: p.sha, summary: { event: publish ? 'publish' : 'unpublish', rows: rows.length } });
    return { rows: rows.length };
  });
}
