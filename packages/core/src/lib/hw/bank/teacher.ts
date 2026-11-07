// The builder's picker (phase 4): a teacher adds a question of a published board paper to an assignment. The server makes the question from the bank row
// (text, marks, type, origin and the exact row it came from), so a teacher cannot attach one question's key to another question's words.

import { HwError } from '../errors';
import { db } from '../db';
import type { HwActor } from '../access/policy';
import { addQuestion } from '../services/assignments';
import { offerOf } from '../practice/paper';
import { answerLinesOf, hwTypeOf, originRefOf, promptOf } from '../practice/paper-rules';

/** Adds the bank row to a draft assignment as a board-paper question, keyed from the board's own scheme. Returns the new question. */
export async function addBankQuestion(actor: HwActor, assignmentId: string, rowId: string): Promise<{ id: string; marks: number; excludedMarks: number }> {
  const offer = await offerOf(db, rowId, 'teacher');
  if (!offer) throw new HwError('NOT_FOUND', 'That paper question is not available: it may not be published yet, or a picture it needs is missing.');
  const { header, row, plan } = offer;
  const type = hwTypeOf(row.qtype);
  const q = await addQuestion(actor, assignmentId, {
    type, prompt: promptOf(row, plan), marks: plan.markableMarks, acceptedAnswers: plan.acceptedAnswers, languageHint: 'en', answerLines: answerLinesOf(type),
    origin: 'board_paper', originRef: originRefOf(header, row),
  });
  return { id: q.id, marks: plan.markableMarks, excludedMarks: plan.excluded.reduce((s, e) => s + e.marks, 0) };
}
