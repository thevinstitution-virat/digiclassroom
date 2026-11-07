// The importer's database side: read what is stored, and write a plan in one transaction. Rows are only ever written as draft. The paper row is
// locked for the length of the import, so two imports of the same paper take turns.

import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import type { db as Db } from '@/db';
import { hwBankFigure, hwBankImport, hwBankPaper, hwBankQuestion } from '@/db/hw-bank-schema';
import { rowKey, type ExpandedPaper, type ExpandedQuestion } from './expand';
import { planImport, type ImportPlan, type StoredPaper, type StoredRow } from './plan';

type Database = typeof Db;
type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
type Reader = Database | Tx;

async function loadStored(d: Reader, file: ExpandedPaper): Promise<{ paper: StoredPaper | null; rows: StoredRow[] }> {
  const p = (await d.select().from(hwBankPaper).where(and(
    eq(hwBankPaper.board, file.board), eq(hwBankPaper.classLevel, file.classLevel), eq(hwBankPaper.subjectCode, file.subjectCode),
    eq(hwBankPaper.session, file.session), eq(hwBankPaper.kind, file.kind),
  )).limit(1))[0];
  if (!p) return { paper: null, rows: [] };
  const rows = await d.select({
    id: hwBankQuestion.id, number: hwBankQuestion.number, alt: hwBankQuestion.alt, variant: hwBankQuestion.variant,
    status: hwBankQuestion.status, contentHash: hwBankQuestion.contentHash, version: hwBankQuestion.version,
  }).from(hwBankQuestion).where(eq(hwBankQuestion.paperId, p.id));
  return {
    paper: { id: p.id, status: p.status, version: p.version, sourceSha256: p.sourceSha256, title: p.title, maxMarks: p.maxMarks, duration: p.duration, sourceFiles: p.sourceFiles },
    rows,
  };
}

/** Reads the bank and says what importing this file would do. Writes nothing. */
export async function dryRun(database: Database, file: ExpandedPaper, sourceSha256: string, opts: { revise?: boolean } = {}): Promise<ImportPlan> {
  return planImport(file, sourceSha256, await loadStored(database, file), opts);
}

const questionValues = (paperId: string, q: ExpandedQuestion) => ({
  paperId, number: q.number, alt: q.alt, variant: q.variant, section: q.section, marks: q.marks, qtype: q.qtype, stem: q.stem, stemRaw: q.stemRaw,
  options: q.options, correctOption: q.correctOption, acceptedAnswers: q.acceptedAnswers, choiceGroup: q.choiceGroup, choiceKind: q.choiceKind,
  parts: q.parts, schemeText: q.schemeText, equations: q.equations, diagramParts: q.diagramParts, needsCheck: q.needsCheck, contentHash: q.contentHash,
});

/** A figure whose words did not change keeps its picture when the row is updated (a new description means the picture may no longer be the right one). */
const figureValues = (questionId: string, q: ExpandedQuestion, keep: Map<string, { description: string; storageKey: string | null }> = new Map()) => q.figures.map((f) => ({
  id: randomUUID(), questionId, figureId: f.figureId, side: f.side, description: f.description, labels: f.labels, readings: f.readings,
  confidence: f.confidence, needsPersonCheck: f.needsPersonCheck, note: f.note,
  storageKey: keep.get(f.figureId)?.description === f.description ? keep.get(f.figureId)!.storageKey : null,
}));

export interface ImportResult { plan: ImportPlan; paperId: string; written: boolean }

export class ImportConflictError extends Error {
  constructor(public readonly plan: ImportPlan) {
    super(`${plan.counts.conflict} question(s) were checked or published by a person and the file now says something different; nothing was written. Review them, then re-run with revise to send them back to draft.`);
    this.name = 'ImportConflictError';
  }
}

/** Writes the file as DRAFT rows. Refuses (nothing written) when a checked or published row would change, unless `revise` is set. */
export async function importDraft(database: Database, file: ExpandedPaper, meta: { actor: string; sourceSha256: string; revise?: boolean }): Promise<ImportResult> {
  return database.transaction(async (tx) => {
    // Serialise imports of one paper: lock the row if it exists (a first import of a new paper is guarded by the unique identity).
    await tx.select({ id: hwBankPaper.id }).from(hwBankPaper).where(and(
      eq(hwBankPaper.board, file.board), eq(hwBankPaper.classLevel, file.classLevel), eq(hwBankPaper.subjectCode, file.subjectCode),
      eq(hwBankPaper.session, file.session), eq(hwBankPaper.kind, file.kind),
    )).for('update').limit(1);
    const stored = await loadStored(tx, file);
    const plan = planImport(file, meta.sourceSha256, stored, { revise: meta.revise });
    if (plan.counts.conflict > 0) throw new ImportConflictError(plan);

    let paperId = stored.paper?.id ?? '';
    if (!plan.changes) return { plan, paperId, written: false };

    const anyContentChange = plan.counts.new + plan.counts.update_draft + plan.counts.revise > 0;
    const paperCommon = {
      title: file.title, maxMarks: file.maxMarks, duration: file.duration, sourceFiles: file.sourceFiles, sourceSha256: meta.sourceSha256,
    };
    if (!stored.paper) {
      paperId = randomUUID();
      await tx.insert(hwBankPaper).values({
        id: paperId, board: file.board, classLevel: file.classLevel, subject: file.subject, subjectCode: file.subjectCode, session: file.session, kind: file.kind,
        ...paperCommon, importedBy: meta.actor,
      });
    } else {
      // A paper whose rows changed is a new version. Any new, updated or revised row is a draft, so a paper that was checked is a draft again
      // (the database only lets a paper be checked when every row is).
      await tx.update(hwBankPaper).set({
        ...paperCommon, importedBy: meta.actor,
        ...(anyContentChange ? { version: sql`${hwBankPaper.version} + 1` } : {}),
        ...(anyContentChange && stored.paper.status !== 'draft' ? { status: 'draft' as const } : {}),
      }).where(eq(hwBankPaper.id, paperId));
    }

    const byKey = new Map(file.questions.map((q) => [rowKey(q), q]));
    for (const r of plan.rows) {
      const q = byKey.get(r.key);
      if (!q || r.action === 'unchanged' || r.action === 'conflict') continue;
      if (r.action === 'new') {
        const id = randomUUID();
        await tx.insert(hwBankQuestion).values({ id, ...questionValues(paperId, q) });
        const figs = figureValues(id, q);
        if (figs.length) await tx.insert(hwBankFigure).values(figs);
        continue;
      }
      // update_draft / revise: the row goes (back) to draft with the new content and a new version; its figures are replaced.
      const id = r.existingId as string;
      const { paperId: _p, number: _n, alt: _a, variant: _v, ...content } = questionValues(paperId, q);
      void _p; void _n; void _a; void _v;
      await tx.update(hwBankQuestion).set({
        ...content, status: 'draft', checkedBy: null, checkedAt: null, version: sql`${hwBankQuestion.version} + 1`,
      }).where(eq(hwBankQuestion.id, id));
      const had = await tx.select({ figureId: hwBankFigure.figureId, description: hwBankFigure.description, storageKey: hwBankFigure.storageKey }).from(hwBankFigure).where(eq(hwBankFigure.questionId, id));
      await tx.delete(hwBankFigure).where(eq(hwBankFigure.questionId, id));
      const figs = figureValues(id, q, new Map(had.map((h) => [h.figureId, h])));
      if (figs.length) await tx.insert(hwBankFigure).values(figs);
    }

    await tx.insert(hwBankImport).values({
      id: randomUUID(), paperId, actor: meta.actor, sourceSha256: meta.sourceSha256,
      summary: { counts: plan.counts, paper: plan.paper, revise: Boolean(meta.revise), orphans: plan.orphans },
    });
    return { plan, paperId, written: true };
  });
}
