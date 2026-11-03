// Screens a transcript, in code, for text addressed to the marker rather than written as an answer: requests for
// marks, orders to ignore or override the scheme, claims to be the teacher, notes to the grader. English, Hindi and
// Hinglish. The phrases live in instruction-phrases.json for a person to review; no AI is involved.
//
// Why: an answer marked in a group sits next to other students' answers in the same prompt. A flagged answer is marked
// ALONE, so nothing it says can reach a neighbour's mark; it is shown to the teacher with a flag; and it is left out of
// "accept all high-confidence suggestions". The screen only decides who sits beside whom and what is flagged. It never
// changes a mark, so a false positive costs one extra call and one flag.

import phrases from './instruction-phrases.json';

export interface ScreenPattern { id: string; lang: 'en' | 'hi' | 'hinglish'; regex: string; note: string }

export interface ScreenHit { id: string; lang: string; note: string }
export interface ScreenResult { flagged: boolean; hits: ScreenHit[] }

export const SCREEN_VERSION: string = phrases.version;

const ZERO_WIDTH = /[​-‍⁠﻿]/g;
// Anything that is not a letter, a combining mark or a digit becomes a space (the danda and all punctuation included).
const NOT_TEXT = /[^\p{L}\p{M}\p{N}]+/gu;

/** The form the patterns are written against. */
export function normaliseForScreen(text: string): string {
  return text.normalize('NFC').replace(ZERO_WIDTH, '').toLocaleLowerCase('en-IN').replace(NOT_TEXT, ' ').replace(/\s+/g, ' ').trim();
}

function compile(patterns: readonly ScreenPattern[]): { p: ScreenPattern; re: RegExp }[] {
  return patterns.map((p) => ({ p, re: new RegExp(p.regex, 'iu') }));
}

const DEFAULT = compile(phrases.patterns as ScreenPattern[]);

/** Screen with the committed phrase list, or with another list (tests, a reviewer's candidate edits). */
export function screenInstructions(text: string, patterns?: readonly ScreenPattern[]): ScreenResult {
  const norm = normaliseForScreen(text);
  const hits: ScreenHit[] = [];
  for (const { p, re } of patterns ? compile(patterns) : DEFAULT) {
    if (re.test(norm)) hits.push({ id: p.id, lang: p.lang, note: p.note });
  }
  return { flagged: hits.length > 0, hits };
}

/**
 * Chunks for marking: every flagged answer alone, the rest in groups of `size` in their original order. With the
 * screen off, plain chunks (what grouping did before).
 */
export function groupForMarking<T extends { transcript: string }>(answers: readonly T[], size: number, screen: boolean): T[][] {
  const clean: T[] = [];
  const alone: T[][] = [];
  for (const a of answers) {
    if (screen && screenInstructions(a.transcript).flagged) alone.push([a]);
    else clean.push(a);
  }
  const out: T[][] = [];
  for (let i = 0; i < clean.length; i += size) out.push(clean.slice(i, i + size));
  return [...out, ...alone];
}
