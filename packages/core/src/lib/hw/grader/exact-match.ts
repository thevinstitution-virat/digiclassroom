// Marking without AI. Two cases cost nothing:
// - a blank answer gets 0, every rubric item "missing";
// - a very short answer equal to an accepted answer (after normalising) gets full marks;
// - a multiple-choice question of the board-paper bank (q.choice): the right option gets full marks, a wrong option gets 0, both by rule.
// Anything else returns null and goes to the AI grader.

import { choiceVerdict } from '../bank/official';
import { matchesAccepted } from '../text/normalise';
import { codeMark } from './code-marking';
import type { GradeQuestion, GradeResult } from './types';

export const EXACT_MATCH_MODEL = 'exact_match';
export const BLANK_MODEL = 'rule:blank';
/** A multiple-choice answer that is exactly one of the wrong options (board-paper bank): 0 marks by rule, no model. */
export const CHOICE_WRONG_MODEL = 'rule:choice_wrong';
export const RULE_PROMPT_VERSION = 'rules.v1';

export interface RuleOptions {
  /** HW_CODE_MARKING_ENABLED: also mark one-mark answers that equal an accepted answer, and record every rule mark as `code`. */
  codeMarking?: boolean;
}

export function gradeWithoutAi(q: GradeQuestion, answerId: string, transcript: string, opts: RuleOptions = {}): GradeResult | null {
  const base = { answerId, promptVersion: RULE_PROMPT_VERSION, rubricVersion: q.rubricVersion, confidence: 1, validationNotes: [] };
  const src = opts.codeMarking ? { markSource: 'code' as const } : {};

  if (transcript.trim() === '') {
    return {
      ...base,
      ...src,
      model: BLANK_MODEL,
      items: q.rubric.map((r) => ({ rubric_item_id: r.id, verdict: 'missing' as const, quote: '', marks: 0, confidence: 1 })),
      suggestedMarks: 0,
    };
  }

  // A board-paper multiple-choice question: the answer is the right option, a wrong option, or unclear. Unclear is never guessed: it goes on as any other answer does.
  if (q.choice) {
    const v = choiceVerdict(q.choice, transcript);
    if (v === 'right') {
      return { ...base, ...src, model: EXACT_MATCH_MODEL, items: q.rubric.map((r) => ({ rubric_item_id: r.id, verdict: 'met' as const, quote: transcript.trim(), marks: r.marks, confidence: 1 })), suggestedMarks: q.marks };
    }
    if (v === 'wrong') {
      return { ...base, ...src, model: CHOICE_WRONG_MODEL, items: q.rubric.map((r) => ({ rubric_item_id: r.id, verdict: 'missing' as const, quote: transcript.trim(), marks: 0, confidence: 1 })), suggestedMarks: 0 };
    }
  }

  if (opts.codeMarking) {
    const c = codeMark(q, answerId, transcript);
    if (c) return c;
  }

  if (q.type === 'very_short' && q.acceptedAnswers.length > 0 && matchesAccepted(transcript, q.acceptedAnswers)) {
    const items = q.rubric.map((r) => ({ rubric_item_id: r.id, verdict: 'met' as const, quote: transcript.trim(), marks: r.marks, confidence: 1 }));
    return { ...base, ...src, model: EXACT_MATCH_MODEL, items, suggestedMarks: q.marks };
  }

  return null;
}
