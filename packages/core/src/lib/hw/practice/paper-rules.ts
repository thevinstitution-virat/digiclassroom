// Self-practice from a board paper (phase 4): which bank rows a learner may be offered, and the question made from one. Pure: no database.
//
// A row is offered only when everything that makes it fair is in place:
//   * the row (and its paper) is PUBLISHED: a person checked it and the owner switched the paper on;
//   * every picture the question needs is attached (a figure the learner cannot see is not a question they can answer);
//   * the app can mark it: multiple choice always (by code); a written row only when written answers of this kind can be marked (an eligible group,
//     or the owner relaxed that rule); a row that is only a drawing never;
//   * it is not the "for visually impaired students" version: a teacher may give that one (allowVisuallyImpaired), a learner is never offered it by default.

import { markingPlanOf, questionNoOf, type MarkingPlan, type OfficialRow } from '../bank/official';

export interface PaperRowLike extends OfficialRow {
  id: string;
  section: string;
  stem: string;
  status: 'draft' | 'checked' | 'published' | 'rejected';
}

export type NotOffered = 'not_published' | 'visually_impaired' | 'figure_missing' | 'nothing_markable' | 'written_not_ready' | 'unusable';

export type Offer = { ok: true; plan: MarkingPlan } | { ok: false; why: NotOffered; detail?: string };

export function offerVerdict(row: PaperRowLike, figures: { side: 'paper' | 'scheme'; hasImage: boolean }[], writtenReady: boolean, opts: { allowVisuallyImpaired?: boolean } = {}): Offer {
  if (row.status !== 'published') return { ok: false, why: 'not_published' };
  if (row.variant && !opts.allowVisuallyImpaired) return { ok: false, why: 'visually_impaired' };
  if (figures.some((f) => f.side === 'paper' && !f.hasImage)) return { ok: false, why: 'figure_missing' };
  const r = markingPlanOf(row);
  if (!r.ok) return { ok: false, why: 'unusable', detail: r.problems.join('; ') };
  if (r.plan.mode === 'hand' || !r.plan.key) return { ok: false, why: 'nothing_markable' };
  if (r.plan.mode === 'ai' && !writtenReady) return { ok: false, why: 'written_not_ready' };
  return { ok: true, plan: r.plan };
}

export type HwType = 'very_short' | 'short' | 'long';

/** The question type the product knows. Multiple choice is a one-word answer; a case-based question is a long one. */
export function hwTypeOf(qtype: string): HwType {
  if (qtype === 'mcq' || qtype === 'assertion_reason' || qtype === 'very_short') return 'very_short';
  if (qtype === 'short') return 'short';
  return 'long';
}

export const answerLinesOf = (t: HwType) => (t === 'long' ? 12 : t === 'short' ? 6 : 3);

/** What the learner reads: the paper's own words, the options for a multiple-choice question, and a plain note for a drawing the app does not mark. */
export function promptOf(row: Pick<PaperRowLike, 'stem' | 'options' | 'qtype'>, plan: MarkingPlan): string {
  const out = [row.stem.trim()];
  if (plan.mode === 'exact') {
    const drawn = row.options.every((o) => !o.text.trim());
    out.push(drawn ? 'The options A, B, C and D are shown in the figure.' : row.options.map((o) => `${o.letter}. ${o.text.trim()}`).join('\n'));
    out.push('Write the letter of the correct option.');
  }
  if (plan.excluded.length) {
    out.push(`(${plan.excluded.map((e) => `Part ${e.label} asks for a drawing`).join('; ')}. Draw it on paper: it is not marked here, and the marks for it are not counted.)`);
  }
  return out.join('\n\n');
}

export interface PaperHeader { board: string; classLevel: number; subject: string; subjectCode: string; session: string; kind: 'sqp' | 'past_paper' }

export const kindName = (k: PaperHeader['kind']) => (k === 'sqp' ? 'sample paper' : 'paper');

export function attemptTitle(p: PaperHeader, row: Pick<PaperRowLike, 'number' | 'alt' | 'variant'>): string {
  return `Practice: ${p.board} Class ${p.classLevel} ${p.subject} ${kindName(p.kind)} ${p.session}, Q${questionNoOf(row)}`.slice(0, 300);
}

/** The question's origin reference: what the answer-key service looks the official scheme up by, and the exact bank row it was made from. */
export function originRefOf(p: PaperHeader, row: Pick<PaperRowLike, 'id' | 'number' | 'alt' | 'variant'>): Record<string, string> {
  return { kind: p.kind, session: p.session, subjectCode: p.subjectCode, questionNo: questionNoOf(row), board: p.board, classLevel: String(p.classLevel), bankRowId: row.id };
}
