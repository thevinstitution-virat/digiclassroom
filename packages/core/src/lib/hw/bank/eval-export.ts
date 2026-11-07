// The board paper as evaluation material (phase 5). Pure: no database, no model.
//
//   * questions: the written questions an AI would mark against the board's own scheme, as key requests carrying an `officialRef`, for
//     `hw-eval-mutate generate`. Multiple choice is marked by code and has nothing for a model to be evaluated on; a drawing is not marked.
//   * equation items: every distinct equation of the paper as an item to copy BY HAND, so the reader's handling of chemical and physics
//     equations is measured on the paper's own equations (copy sheets, then `hw-paper-eval equation-report`).

import { createHash } from 'node:crypto';
import type { EvalItem } from '../eval/dataset';
import type { KeyRequest } from '../keys/types';
import { hwTypeOf, promptOf } from '../practice/paper-rules';
import type { ExpandedPaper, ExpandedQuestion } from './expand';
import { markingPlanOf, questionNoOf, type OfficialRow } from './official';

export type EvalQuestion = KeyRequest & { board: string };

export interface SkippedRow { row: string; why: string }

const rowOf = (q: ExpandedQuestion): OfficialRow & { stem: string } => ({
  number: q.number, alt: q.alt, variant: q.variant, qtype: q.qtype, marks: q.marks, options: q.options, correctOption: q.correctOption, parts: q.parts as OfficialRow['parts'], stem: q.stem,
});

/** The questions to evaluate AI marking on: written, not a visually impaired version, with something a model can mark. */
export function evalQuestionsOf(paper: ExpandedPaper): { questions: EvalQuestion[]; skipped: SkippedRow[] } {
  const questions: EvalQuestion[] = [];
  const skipped: SkippedRow[] = [];
  for (const q of paper.questions) {
    const label = `Q${questionNoOf(q)}`;
    if (q.variant) { skipped.push({ row: label, why: 'a visually impaired version is not practised by learners' }); continue; }
    const r = markingPlanOf(rowOf(q));
    if (!r.ok) { skipped.push({ row: label, why: r.problems.join('; ') }); continue; }
    if (r.plan.mode === 'exact') { skipped.push({ row: label, why: 'multiple choice is marked by code: no model to evaluate' }); continue; }
    if (r.plan.mode === 'hand' || !r.plan.key) { skipped.push({ row: label, why: 'only a drawing: nothing a model marks' }); continue; }
    questions.push({
      questionText: promptOf(rowOf(q), r.plan),
      // The product's own type for the row (a case-based question is a long one), so the evaluation groups are the groups learners are marked in.
      questionType: hwTypeOf(q.qtype),
      marks: r.plan.markableMarks,
      classLevel: String(paper.classLevel),
      subject: paper.subject,
      medium: 'English',
      board: paper.board,
      questionOrigin: 'board_paper',
      officialRef: { kind: paper.kind, session: paper.session, subjectCode: paper.subjectCode, questionNo: questionNoOf(q), board: paper.board, classLevel: paper.classLevel },
    });
  }
  return { questions, skipped };
}

const B32 = 'abcdefghijklmnopqrstuvwxyz234567';
/** A stable opaque id (evitem_ + 16 base32 characters) from a hash, so exporting twice gives the same items. */
function itemIdOf(seed: string): string {
  const bytes = createHash('sha256').update(seed).digest().subarray(0, 10);
  let bits = 0;
  let acc = 0;
  let out = '';
  for (const b of bytes) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 5) { out += B32[(acc >>> (bits - 5)) & 31]; bits -= 5; }
    acc &= (1 << bits) - 1;
  }
  return `evitem_${out.slice(0, 16)}`;
}

/** Each distinct equation of the paper (with the questions it appears in), as a known-text item for a person to copy by hand. */
export function equationItemsOf(paper: ExpandedPaper): { items: EvalItem[]; rowsOf: Map<string, string[]> } {
  const items: EvalItem[] = [];
  const rowsOf = new Map<string, string[]>();
  for (const q of paper.questions) {
    if (q.variant) continue;
    for (const e of q.equations) {
      const text = e.plain.trim();
      if (!text) continue;
      const seen = rowsOf.get(text);
      if (seen) { if (!seen.includes(`Q${q.number}`)) seen.push(`Q${q.number}`); continue; }
      rowsOf.set(text, [`Q${q.number}`]);
      const qid = `eq_${createHash('sha256').update(text).digest('hex').slice(0, 12)}`;
      items.push({
        id: itemIdOf(`equation|${paper.board}|${paper.classLevel}|${paper.subjectCode}|${paper.session}|${text}`),
        source: 'A', subject: paper.subject, class: String(paper.classLevel), board: paper.board, medium: 'English', language: 'en', questionType: 'very_short', mode: 'typed',
        question: { id: qid, text: 'Copy this equation by hand, exactly as written.', marks: 1 },
        media: {}, truthTranscript: { text, how: 'known_text' }, key: null, referenceMarks: null, mutation: null,
        handwritingBand: 'unknown', device: 'unknown', consent: { ref: null, deidentified: true },
      });
    }
  }
  return { items, rowsOf };
}

/** The read-back pairs of a reading run over an equation dataset: the equation as written, and what the reader returned for the handwriting. */
export function equationPairs(items: readonly EvalItem[], rows: readonly { itemId: string; status: string; transcript?: unknown }[]): { truth: string; read: string }[] {
  const truth = new Map(items.filter((i) => i.question.id.startsWith('eq_') && i.truthTranscript).map((i) => [i.id, i.truthTranscript!.text]));
  return rows.filter((r) => truth.has(r.itemId) && r.status === 'ok' && typeof r.transcript === 'string').map((r) => ({ truth: truth.get(r.itemId)!, read: r.transcript as string }));
}
