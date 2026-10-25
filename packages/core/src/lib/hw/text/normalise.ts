// Text comparison helpers for English and Hindi (Devanagari). Pure.
//
// Two strengths:
// - normaliseForMatch: lenient, for exact-match marking of very short answers. Folds case,
//   punctuation (including the danda), spacing, and the nukta (students often omit it; a
//   1-mark answer should not be lost for a dot).
// - normaliseForQuote: strict, for checking an AI's quote is really in the transcript. Only
//   Unicode NFC and whitespace are folded; words, spelling and punctuation must match.

const NUKTA = '़';
const ZERO_WIDTH = /[​-‍⁠﻿]/g;
// Danda (।), double danda (॥), plus general punctuation and symbols.
const PUNCT = /[।॥\p{P}\p{S}]/gu;

export function normaliseForMatch(s: string): string {
  return s
    .normalize('NFC')
    .replace(ZERO_WIDTH, '')
    // NFC decomposes the precomposed nukta letters (U+0958–U+095F), so one removal covers both spellings.
    .split(NUKTA).join('')
    .toLocaleLowerCase('en-IN')
    .replace(PUNCT, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normaliseForQuote(s: string): string {
  return s.normalize('NFC').replace(ZERO_WIDTH, '').replace(/\s+/g, ' ').trim();
}

/** Is `quote` really in `transcript`? Empty quotes never count as evidence. */
export function quoteIsInTranscript(quote: string, transcript: string): boolean {
  const q = normaliseForQuote(quote);
  if (!q) return false;
  return normaliseForQuote(transcript).includes(q);
}

/** Exact-match marking: does the answer equal one of the accepted answers? */
export function matchesAccepted(answer: string, accepted: readonly string[]): boolean {
  const a = normaliseForMatch(answer);
  if (!a) return false;
  return accepted.some((acc) => normaliseForMatch(acc) === a);
}

/** Unreadable-word markers in a transcript. Counted in code, never taken from the model. */
export function countUnclear(text: string): number {
  return (text.match(/\[\?\]/g) ?? []).length;
}
