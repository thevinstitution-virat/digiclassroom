// Which answer page holds which question (owner's decision, 11 Nov 2026). The reader (phase 5) reports, for each photographed page, the evidence
// it found; this pure function turns that evidence into a mapping, strongest evidence first, and says plainly what it could not settle rather
// than guessing — a wrong match marks the right answer against the wrong question.
//
//   1. the printed answer sheet: the page's code says which set and which sheet page, so its own boxes are known exactly (sheet.ts);
//   2. a question number the learner wrote (in the sheet's margin, or at the head of an answer on plain or extra paper), read with confidence;
//   3. the answer itself: how close each written answer is to each question's answer key, used only when it clearly points at one question.
//
// A piece of writing that none of these settles goes to review. A question no page answers is simply not attempted.

export interface NumberSeen { number: number; confidence: number }
export interface KeyMatch { number: number; score: number }

/** One stretch of writing on a page, as the reader segmented it. */
export interface Segment {
  id: string;
  /** The sheet box it was written in, when the page is a printed sheet page and the writing sat inside a printed box. */
  sheetBox: number[] | null;
  /** Question numbers the learner wrote at its head, with the reader's confidence. */
  numbersSeen: NumberSeen[];
  /** Closeness of the writing to each question's answer key (0..1), from the reader. */
  keyMatches: KeyMatch[];
}

export interface PageEvidence {
  pageId: string;
  /** What the reader read in the header/footer of a printed sheet; null on plain paper. */
  sheet: { code: string; page: number } | null;
  segments: Segment[];
}

export const MAPPING_LIMITS = {
  /** A written number read with at least this confidence is taken. */
  numberConfidence: 0.8,
  /** An answer-key match must be at least this close, */
  keyScore: 0.6,
  /** and this much closer than the next best question. */
  keyMargin: 0.15,
} as const;

export type Source = 'sheet_box' | 'written_number' | 'answer_match';
export interface Assignment { segmentId: string; pageId: string; numbers: number[]; source: Source }
export type ReviewReason = 'wrong_sheet' | 'sheet_page_unknown' | 'nothing_conclusive' | 'numbers_disagree';
export interface Review { segmentId: string; pageId: string; reason: ReviewReason; detail: string }

export interface MappingResult {
  assignments: Assignment[];
  review: Review[];
  /** question number -> the segments that answer it, in page order */
  byQuestion: Map<number, Assignment[]>;
  notAttempted: number[];
}

/**
 * @param code the sheet code of this set (sheet.sheetCode)
 * @param sheetPageNumbers for each printed sheet page, the questions whose own box is on it (sheet.sheetLayout)
 * @param allNumbers every question number in the set
 */
export function mapPages(pages: PageEvidence[], code: string, sheetPageNumbers: Map<number, number[]>, allNumbers: number[]): MappingResult {
  const assignments: Assignment[] = [];
  const review: Review[] = [];

  for (const p of pages) {
    const ownSheet = p.sheet && p.sheet.code.toUpperCase() === code.toUpperCase();
    if (p.sheet && !ownSheet) {
      for (const s of p.segments) review.push({ segmentId: s.id, pageId: p.pageId, reason: 'wrong_sheet', detail: `printed for sheet ${p.sheet.code}, not ${code}` });
      continue;
    }
    const pageBoxes = ownSheet ? sheetPageNumbers.get(p.sheet!.page) : undefined;
    if (ownSheet && !pageBoxes) {
      for (const s of p.segments) review.push({ segmentId: s.id, pageId: p.pageId, reason: 'sheet_page_unknown', detail: `sheet page ${p.sheet!.page} does not exist` });
      continue;
    }
    for (const s of p.segments) {
      // 1. inside a printed box of this very page
      if (ownSheet && s.sheetBox?.length && s.sheetBox.every((n) => pageBoxes!.includes(n))) {
        const written = s.numbersSeen.filter((x) => x.confidence >= MAPPING_LIMITS.numberConfidence).map((x) => x.number);
        // a learner who wrote a different number inside a printed box is answering out of place: do not decide either way
        if (written.length && !written.some((n) => s.sheetBox!.includes(n))) {
          review.push({ segmentId: s.id, pageId: p.pageId, reason: 'numbers_disagree', detail: `written in the box for ${s.sheetBox.join('/')} but numbered ${written.join('/')}` });
          continue;
        }
        assignments.push({ segmentId: s.id, pageId: p.pageId, numbers: s.sheetBox, source: 'sheet_box' });
        continue;
      }
      // 2. a number the learner wrote
      const sure = [...new Set(s.numbersSeen.filter((x) => x.confidence >= MAPPING_LIMITS.numberConfidence && allNumbers.includes(x.number)).map((x) => x.number))];
      if (sure.length === 1) {
        const best = topMatch(s.keyMatches);
        // a confident number that the answer clearly contradicts is a mistake one way or the other: a person decides
        if (best && best.clear && best.number !== sure[0] && best.score - (s.keyMatches.find((k) => k.number === sure[0])?.score ?? 0) >= MAPPING_LIMITS.keyMargin * 2) {
          review.push({ segmentId: s.id, pageId: p.pageId, reason: 'numbers_disagree', detail: `numbered Q${sure[0]} but reads like the answer to Q${best.number}` });
          continue;
        }
        assignments.push({ segmentId: s.id, pageId: p.pageId, numbers: sure, source: 'written_number' });
        continue;
      }
      if (sure.length > 1) {
        review.push({ segmentId: s.id, pageId: p.pageId, reason: 'numbers_disagree', detail: `numbered ${sure.map((n) => `Q${n}`).join(' and ')}` });
        continue;
      }
      // 3. what the answer says
      const best = topMatch(s.keyMatches);
      if (best?.clear && allNumbers.includes(best.number)) {
        assignments.push({ segmentId: s.id, pageId: p.pageId, numbers: [best.number], source: 'answer_match' });
        continue;
      }
      review.push({ segmentId: s.id, pageId: p.pageId, reason: 'nothing_conclusive', detail: best ? `closest Q${best.number} at ${best.score.toFixed(2)}, not clear enough` : 'no number and no answer-key match' });
    }
  }

  const byQuestion = new Map<number, Assignment[]>();
  for (const a of assignments) for (const n of a.numbers) byQuestion.set(n, [...(byQuestion.get(n) ?? []), a]);
  const notAttempted = allNumbers.filter((n) => !byQuestion.has(n)).sort((a, b) => a - b);
  return { assignments, review, byQuestion, notAttempted };
}

function topMatch(ms: KeyMatch[]): { number: number; score: number; clear: boolean } | null {
  if (!ms.length) return null;
  const sorted = [...ms].sort((a, b) => b.score - a.score);
  const [a, b] = sorted;
  const clear = a!.score >= MAPPING_LIMITS.keyScore && a!.score - (b?.score ?? 0) >= MAPPING_LIMITS.keyMargin;
  return { number: a!.number, score: a!.score, clear };
}
