// Marking in code (HW_CODE_MARKING_ENABLED): a one-mark answer that equals one of the question's
// accepted answers, after normalising, gets full marks without a model call.
//
// The normalisation folds only what is not a different answer: case, spacing, punctuation,
// Unicode normalisation (NFC) and Devanagari digits. It does NOT fold the nukta (the lenient
// rule in text/normalise.ts does, for very short answers) and it never guesses: anything that is
// not an exact match after these folds returns null and goes to the AI, as it does today.

import type { GradeQuestion, GradeResult } from './types';

const ZERO_WIDTH = /[​-‍⁠﻿]/g;
// Danda, double danda, then every Unicode punctuation and symbol.
const PUNCT = /[।॥\p{P}\p{S}]/gu;
const DEVANAGARI_ZERO = 0x0966;

/** ०१२३४५६७८९ -> 0123456789 (the Devanagari digits U+0966..U+096F). */
function devanagariDigits(s: string): string {
  return s.replace(/[०-९]/g, (c) => String(c.charCodeAt(0) - DEVANAGARI_ZERO));
}

export function normaliseForCodeMatch(s: string): string {
  return devanagariDigits(s.normalize('NFC').replace(ZERO_WIDTH, ''))
    .toLocaleLowerCase('en-IN')
    .replace(PUNCT, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const CODE_MARK_RULE_VERSION = 'code-exact.v1';

/** A mark from the accepted answers, or null when the answer must go to the AI. */
export function codeMark(q: GradeQuestion, answerId: string, transcript: string): GradeResult | null {
  if (q.marks !== 1 || q.acceptedAnswers.length === 0) return null;
  const a = normaliseForCodeMatch(transcript);
  if (!a) return null;
  if (!q.acceptedAnswers.some((acc) => normaliseForCodeMatch(acc) === a)) return null;
  return {
    answerId,
    model: 'exact_match',
    promptVersion: CODE_MARK_RULE_VERSION,
    rubricVersion: q.rubricVersion,
    confidence: 1,
    validationNotes: [],
    items: q.rubric.map((r) => ({ rubric_item_id: r.id, verdict: 'met' as const, quote: transcript.trim(), marks: r.marks, confidence: 1 })),
    suggestedMarks: q.marks,
    markSource: 'code',
  };
}
