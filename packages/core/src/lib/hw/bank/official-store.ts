// The answer-key service's lookup of an official scheme (KeyDeps.official, phase 3): find the bank row a board-paper question names, and give its
// key ONLY if a person has checked it. A draft or rejected row is not a scheme; two papers that both match are a miss, not a guess.

import { and, eq, isNull, sql } from 'drizzle-orm';
import type { db as Db } from '@/db';
import { hwBankPaper, hwBankQuestion } from '@/db/hw-bank-schema';
import type { OfficialScheme } from '../keys/service';
import type { KeyRequest } from '../keys/types';
import { markingPlanOf, parseQuestionNo, questionNoOf, type MarkingPlan, type OfficialRow } from './official';

type Database = typeof Db;
type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
type Reader = Database | Tx;

export type OfficialRef = NonNullable<KeyRequest['officialRef']>;

export type OfficialMiss =
  | 'bad_question_no'      // "26A" was expected, this is not a question number
  | 'no_paper'             // the bank has no such paper
  | 'ambiguous_paper'      // more than one paper matches: say the board or the class
  | 'no_row'               // the paper has no such question
  | 'needs_alternative'    // the question has an internal choice and the number does not say which ("26" for 26A / 26B)
  | 'not_checked'          // the row is there, but no person has checked it (draft, or rejected)
  | 'nothing_markable'     // every part is a drawing
  | 'unusable';            // the row cannot be turned into a key (reported with the reason)

export type OfficialFind =
  | { ok: true; scheme: OfficialScheme; plan: MarkingPlan; rowId: string; paperId: string }
  | { ok: false; miss: OfficialMiss; detail: string };

const ci = (col: unknown, v: string) => sql`lower(btrim(${col})) = ${v.trim().toLowerCase()}`;

/** What the board paper question names, if it is there and checked. `miss` and `detail` say why not. */
export async function findOfficial(d: Reader, ref: OfficialRef): Promise<OfficialFind> {
  const no = parseQuestionNo(ref.questionNo);
  if (!no) return { ok: false, miss: 'bad_question_no', detail: `"${ref.questionNo}" is not a question number like 26, 26A or 26A-vi` };

  const papers = await d.select().from(hwBankPaper).where(and(
    ci(hwBankPaper.subjectCode, ref.subjectCode), eq(hwBankPaper.session, ref.session.trim()), eq(hwBankPaper.kind, ref.kind),
    ...(ref.board ? [ci(hwBankPaper.board, ref.board)] : []),
    ...(ref.classLevel ? [eq(hwBankPaper.classLevel, ref.classLevel)] : []),
  )).limit(2);
  if (!papers.length) return { ok: false, miss: 'no_paper', detail: `no ${ref.kind} ${ref.session} ${ref.subjectCode} in the bank` };
  if (papers.length > 1) return { ok: false, miss: 'ambiguous_paper', detail: `more than one paper is ${ref.kind} ${ref.session} ${ref.subjectCode}: give the board or the class` };
  const paper = papers[0];

  const rows = await d.select().from(hwBankQuestion).where(and(
    eq(hwBankQuestion.paperId, paper.id), eq(hwBankQuestion.number, no.number),
    no.alt ? eq(hwBankQuestion.alt, no.alt) : isNull(hwBankQuestion.alt),
    no.variant ? eq(hwBankQuestion.variant, no.variant) : isNull(hwBankQuestion.variant),
  )).limit(1);
  const row = rows[0];
  if (!row) {
    const any = await d.select({ alt: hwBankQuestion.alt }).from(hwBankQuestion).where(and(eq(hwBankQuestion.paperId, paper.id), eq(hwBankQuestion.number, no.number), isNull(hwBankQuestion.variant)));
    if (any.some((r) => r.alt) && !no.alt) return { ok: false, miss: 'needs_alternative', detail: `question ${no.number} has an internal choice: name the alternative (${any.map((r) => `${no.number}${r.alt}`).sort().join(' or ')})` };
    return { ok: false, miss: 'no_row', detail: `${paper.title} has no question ${ref.questionNo}` };
  }
  const label = questionNoOf(row);
  if (row.status !== 'checked' && row.status !== 'published') return { ok: false, miss: 'not_checked', detail: `Q${label} is ${row.status}: no person has checked it` };

  const r = markingPlanOf({ number: row.number, alt: row.alt, variant: row.variant, qtype: row.qtype, marks: row.marks, options: row.options, correctOption: row.correctOption, parts: row.parts as OfficialRow['parts'] });
  if (!r.ok) return { ok: false, miss: 'unusable', detail: r.problems.join('; ') };
  if (!r.plan.key) return { ok: false, miss: 'nothing_markable', detail: `Q${label} is a drawing: nothing the app can mark` };
  return {
    ok: true, plan: r.plan, rowId: row.id, paperId: paper.id,
    scheme: {
      key: r.plan.key,
      label: `${paper.board} ${paper.kind === 'sqp' ? 'sample paper' : 'past paper'} ${paper.session}, ${paper.subjectCode} ${paper.subject}, Q${label} marking scheme (checked by ${row.checkedBy ?? 'a person'})`,
      source: { id: row.id, contentHash: row.contentHash },
    },
  };
}

/** KeyDeps.official: the checked scheme, or null. */
export async function lookupOfficialScheme(d: Reader, ref: OfficialRef): Promise<OfficialScheme | null> {
  const f = await findOfficial(d, ref);
  return f.ok ? f.scheme : null;
}

/** A key built from a bank row is still good only while the row is checked and says what it said then. */
export async function officialSourceValid(d: Reader, rowId: string, contentHash: string): Promise<boolean> {
  const r = (await d.select({ status: hwBankQuestion.status, contentHash: hwBankQuestion.contentHash }).from(hwBankQuestion).where(eq(hwBankQuestion.id, rowId)).limit(1))[0];
  return !!r && (r.status === 'checked' || r.status === 'published') && r.contentHash === contentHash;
}

/**
 * The by-code marking rule for a multiple-choice question made from a bank row (its origin_ref names the row): the forms of the right and of the wrong
 * options. null for every other question, and for a row that is no longer checked (then the question goes on as any other).
 */
export async function choiceRuleOf(d: Reader, q: { origin: string; originRef: Record<string, string> | null }): Promise<{ acceptedAnswers: string[]; wrongAnswers: string[] } | null> {
  const id = q.origin === 'board_paper' ? q.originRef?.bankRowId : undefined;
  if (!id) return null;
  const row = (await d.select().from(hwBankQuestion).where(eq(hwBankQuestion.id, id)).limit(1))[0];
  if (!row || (row.status !== 'checked' && row.status !== 'published')) return null;
  const r = markingPlanOf({ number: row.number, alt: row.alt, variant: row.variant, qtype: row.qtype, marks: row.marks, options: row.options, correctOption: row.correctOption, parts: row.parts as OfficialRow['parts'] });
  return r.ok && r.plan.mode === 'exact' ? { acceptedAnswers: r.plan.acceptedAnswers, wrongAnswers: r.plan.wrongAnswers } : null;
}
