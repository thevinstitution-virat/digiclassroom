// Phase 5: from the reader's pages to one transcript per question — pure, so every rule is tested exactly. Called twice by the evaluation: once
// with no answer-key matches (most writing is placed by the printed box or a written number), and once more after the text-only matcher has
// scored the writing that was left AND every answer placed by a number the learner wrote (`needMatch`): on real handwriting the reader misread
// "Q.26" as 20 at 0.95 confidence (docs/hw-eval/real-handwriting-read-1.md), so a written number is only trusted when the answer's content does
// not clearly point elsewhere (mapping.ts sends such an answer to a person).
//
// Rules, on top of mapping.ts:
//   * the multiple-choice grid gives a choice question its letter directly;
//   * writing placed on a unit with alternatives (Q12 (A) or (B), or Q30 / Q31) goes to the alternative the learner ticked or wrote; failing
//     that, to the one the answer-key match clearly prefers; failing that, to review — never to a guess;
//   * a question with writing is 'done' unless a piece of it was read with low confidence ('needs_review');
//   * a multiple-choice answer whose words clearly are one option's words, but whose letter was read as another, goes to a person: the reader
//     misread ticked letters at 0.95 confidence, and code marks the letter alone;
//   * a question with no writing is blank (it scores 0 by rule) — unless some writing on the booklet could not be placed, in which case it might
//     have been answered there, and it goes to review instead of being marked 0.

import type { KeyMatch, MappingResult, PageEvidence, Review } from './mapping';
import { mapPages, MAPPING_LIMITS } from './mapping';
import type { PageRead, ReadSegment } from './page-reader';

export interface AssembleQuestion {
  answerId: string; number: number; alt: string | null; choice: boolean;
  /** A choice question's options, to check the words written beside the letter; absent or empty, no check. */
  options?: { letter: string; text: string }[];
}

const wordsOf = (s: string): string[] => s.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
const dice = (a: string[], b: string[]): number => {
  if (!a.length || !b.length) return 0;
  const left = new Map<string, number>();
  for (const w of a) left.set(w, (left.get(w) ?? 0) + 1);
  let common = 0;
  for (const w of b) { const n = left.get(w) ?? 0; if (n > 0) { common++; left.set(w, n - 1); } }
  return (2 * common) / (a.length + b.length);
};
export const OPTION_WORDS_LIMITS = { score: 0.8, margin: 0.2 } as const;

/**
 * Which option the words written beside a letter are, when they clearly are one: "(B) Al2O3 and MgO" -> the option whose text is
 * "Al2O3 and MgO". Word overlap, so a missing hyphen or a capital does not matter; options that differ by a word or two (assertion-reason) are
 * never told apart, and an option drawn in a figure (no text) is never matched. Null when the words do not clearly point at one option.
 */
export function optionFromWords(written: string, options: { letter: string; text: string }[]): string | null {
  const w = wordsOf(written);
  if (!w.length) return null;
  const scored = options.filter((o) => o.text.trim()).map((o) => ({ letter: o.letter.toUpperCase(), score: dice(w, wordsOf(o.text)) })).sort((a, b) => b.score - a.score);
  const [a, b] = scored;
  return a && a.score >= OPTION_WORDS_LIMITS.score && a.score - (b?.score ?? 0) >= OPTION_WORDS_LIMITS.margin ? a.letter : null;
}

/** The words after the option letter: "(B) Al2O3 and MgO" -> "Al2O3 and MgO". */
const afterLetter = (text: string): string =>
  text.trim().replace(/^ans(?:wer)?\s*[:.-]?\s*/i, '').replace(/^\(\s*[A-Da-d]\s*\)\s*/, '').replace(/^[A-Da-d]\s*[.):,-]\s*/, '');

/**
 * A multiple-choice answer is its letter: "(B) virtual", "B.", "b) virtual", "Ans: B" all give "B". A bare letter followed by a word ("A virtual
 * image") is not taken — it may be the article — and the answer is kept as written, for the marking to judge.
 */
export function choiceLetter(text: string): string | null {
  const t = text.trim().replace(/^ans(?:wer)?\s*[:.-]?\s*/i, '');
  const m = /^\(\s*([A-Da-d])\s*\)/.exec(t) ?? /^([A-Da-d])\s*(?:$|[.):,-])/.exec(t);
  return m ? m[1]!.toUpperCase() : null;
}

/**
 * The learner's own label at the start of an answer ("Q12.", "12)", "Ans 12 -", "Question 12:") is where it goes, not what it says: the reader
 * reports it separately, so it is taken off the transcript — only at the very start, and only for this answer's own number.
 */
export function withoutLabel(text: string, number: number): string {
  // "Q12", "Question 12", "Ans 12" with or without punctuation; a bare "12" only with punctuation ("12." / "12)"), so "3 moles of ..." stays whole
  const prefixed = new RegExp(`^\\s*(?:q(?:uestion)?|ans(?:wer)?)\\s*(?:no\\.?)?\\s*${number}\\s*[.):-]?\\s+`, 'i');
  const bare = new RegExp(`^\\s*${number}\\s*[.):-]\\s+`);
  return text.replace(prefixed, '').replace(bare, '');
}

export interface AnswerOutcome {
  status: 'done' | 'needs_review' | 'blank';
  text: string;
  confidence: number | null;
  unclearCount: number;
  /** For a person: where the text came from, or why it needs them. */
  note: string;
}

export interface AssembleResult {
  mapping: MappingResult;
  answers: Map<string, AnswerOutcome>;
  /** Writing nothing placed, and every answer placed by a written number: send to the answer-key matcher (only before matches are given). */
  needMatch: { id: string; text: string }[];
  review: (Review | { segmentId: string; pageId: string; reason: 'alternative_unknown'; detail: string })[];
}

export function assembleBooklet(input: {
  code: string;
  sheetPageNumbers: Map<number, number[]>;
  questions: AssembleQuestion[];
  pages: { pageId: string; position: number; read: PageRead }[];
  matches?: Map<string, KeyMatch[]>;
  /** Below this reading confidence a piece of writing goes to a person (HW_READ_ESCALATE_BELOW). */
  minConfidence: number;
}): AssembleResult {
  const allNumbers = [...new Set(input.questions.map((q) => q.number))].sort((a, b) => a - b);
  const pages = [...input.pages].sort((a, b) => a.position - b.position);
  const segs = new Map<string, ReadSegment>();
  const evidence: PageEvidence[] = pages.map((p) => ({
    pageId: p.pageId,
    sheet: p.read.sheet,
    segments: p.read.segments.map((s, i) => {
      const id = `p${p.position}s${i}`;
      segs.set(id, s);
      return { id, sheetBox: s.box.length ? s.box : null, numbersSeen: s.numbersSeen, keyMatches: input.matches?.get(id) ?? [] };
    }),
  }));
  const mapping = mapPages(evidence, input.code, input.sheetPageNumbers, allNumbers);
  const review: AssembleResult['review'] = [...mapping.review];

  type Piece = { text: string; confidence: number; unclear: number; where: string; alt?: string | null };
  const pieces = new Map<string, Piece[]>();
  const add = (answerId: string, p: Piece) => pieces.set(answerId, [...(pieces.get(answerId) ?? []), p]);

  // the grid: a letter per choice question
  for (const p of pages) {
    for (const g of p.read.grid) {
      if (!g.letter) continue;
      const q = input.questions.find((x) => x.number === g.number && x.choice);
      if (q) add(q.answerId, { text: g.letter, confidence: 0.95, unclear: 0, where: `grid on page ${p.position + 1}` });
    }
  }

  for (const a of mapping.assignments) {
    const s = segs.get(a.segmentId)!;
    const candidates = input.questions.filter((q) => a.numbers.includes(q.number));
    let target: AssembleQuestion | undefined;
    if (candidates.length === 1) target = candidates[0];
    else if (candidates.length > 1) {
      // which alternative: ticked or written letter, then a written number among several, then a clear answer-key preference
      const byAlt = s.alternative ? candidates.filter((q) => q.alt === s.alternative) : [];
      const written = s.numbersSeen.filter((n) => n.confidence >= MAPPING_LIMITS.numberConfidence).map((n) => n.number);
      const byNumber = candidates.filter((q) => written.includes(q.number));
      if (byAlt.length === 1) target = byAlt[0];
      else if (byNumber.length === 1) target = byNumber[0];
      else {
        const ms = (input.matches?.get(a.segmentId) ?? []).filter((m) => candidates.some((q) => q.number === m.number)).sort((x, y) => y.score - x.score);
        const [m1, m2] = ms;
        const sameNumber = new Set(candidates.map((q) => q.number)).size === 1;
        if (!sameNumber && m1 && m1.score >= MAPPING_LIMITS.keyScore && m1.score - (m2?.score ?? 0) >= MAPPING_LIMITS.keyMargin) target = candidates.find((q) => q.number === m1.number);
      }
      if (!target) {
        review.push({ segmentId: a.segmentId, pageId: a.pageId, reason: 'alternative_unknown', detail: `answers ${candidates.map((q) => `Q${q.number}${q.alt ?? ''}`).join(' or ')}, not said which` });
        continue;
      }
    }
    if (!target) continue;
    const page = pages.find((p) => p.pageId === a.pageId)!;
    add(target.answerId, { text: withoutLabel(s.text, target.number), confidence: s.confidence, unclear: s.unclearCount, where: `page ${page.position + 1} (${a.source.replace('_', ' ')})`, alt: s.alternative });
  }

  const toMatch = [
    ...review.filter((r) => r.reason === 'nothing_conclusive').map((r) => r.segmentId),
    ...mapping.assignments.filter((a) => a.source === 'written_number').map((a) => a.segmentId),
  ];
  const needMatch = input.matches
    ? []
    : [...new Set(toMatch)].flatMap((id) => {
      const s = segs.get(id);
      return s && s.text.trim() ? [{ id, text: s.text }] : [];
    });

  const unplaced = review.length > 0;
  const answers = new Map<string, AnswerOutcome>();
  for (const q of input.questions) {
    const ps = pieces.get(q.answerId) ?? [];
    let text = ps.map((p) => p.text).filter((t) => t.trim()).join('\n\n');
    // a choice question is marked by code on its letter alone; what else was written is kept in the note
    let extra = '';
    let noLetter = false;
    let wordsSay: string | null = null;
    if (q.choice && text) {
      // the reader sometimes reports the chosen letter in its "alternative" field and leaves it out of the text (half the real runs, 12 Nov)
      const alts = [...new Set(ps.map((p) => p.alt).filter((x): x is string => !!x && /^[A-D]$/.test(x)))];
      const letter = choiceLetter(text) ?? (alts.length === 1 ? alts[0]! : null);
      if (letter && q.options?.length) {
        const byWords = optionFromWords(afterLetter(text), q.options);
        if (byWords && byWords !== letter) wordsSay = byWords;
      }
      if (letter && text.trim() !== letter) { extra = `; written: ${text.replace(/\s+/g, ' ').slice(0, 120)}`; text = letter; }
      // a choice question has no rubric: if no letter can be found, nothing would ever mark it — a person does
      if (!letter) noLetter = true;
    }
    if (!text) {
      answers.set(q.answerId, unplaced
        ? { status: 'needs_review', text: '', confidence: null, unclearCount: 0, note: 'no writing placed here, but some writing in the booklet could not be placed' }
        : { status: 'blank', text: '', confidence: null, unclearCount: 0, note: 'not attempted' });
      continue;
    }
    const confidence = Math.min(...ps.map((p) => p.confidence));
    const unclearCount = ps.reduce((n, p) => n + p.unclear, 0);
    const hard = confidence < input.minConfidence;
    answers.set(q.answerId, {
      status: hard || noLetter || wordsSay ? 'needs_review' : 'done',
      text, confidence, unclearCount,
      note: (hard ? 'hard to read; ' : '') + (noLetter ? 'could not tell which option was chosen; ' : '')
        + (wordsSay ? `the letter was read as ${text} but the words written are option ${wordsSay}'s; ` : '')
        + `from ${ps.map((p) => p.where).join(', ')}${extra}`,
    });
  }
  return { mapping, answers, needMatch, review };
}
