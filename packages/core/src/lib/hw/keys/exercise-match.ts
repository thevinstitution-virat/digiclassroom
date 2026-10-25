// Exercise match (stage1-design.md §2.3 step 2). Pure.
//
// A question that closely matches one of the book's own exercise questions takes that
// exercise's chapter as an anchor for passage retrieval. Similarity is Jaccard over word
// 3-grams after NFC, lower-casing and punctuation removal.

const PUNCT = /[।॥\p{P}\p{S}]/gu;

export function matchWords(s: string): string[] {
  return s.normalize('NFC').toLowerCase().replace(PUNCT, ' ').split(/\s+/).filter(Boolean);
}

/** Word 3-grams; a text shorter than three words is one shingle of all its words. */
export function shingles(s: string, n = 3): Set<string> {
  const w = matchWords(s);
  const out = new Set<string>();
  if (w.length === 0) return out;
  if (w.length < n) {
    out.add(w.join(' '));
    return out;
  }
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '));
  return out;
}

export function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

export interface PracticeRow {
  id: string;
  contentItemId: string;
  chapter: string | null;
  text: string;
}

/**
 * The practice rows hold several numbered questions each ("Questions:\n  1. …\n  2. …"), so
 * each question is compared on its own; a row's score is its best question's score.
 */
export function exerciseQuestions(text: string): string[] {
  const body = text.replace(/^\[[^\]]*\]\s*/, '');
  const numbered = body.split(/\n\s*\d{1,2}[.)]\s+/).slice(1).map((q) => q.trim()).filter(Boolean);
  if (numbered.length) return numbered;
  const stripped = body.replace(/^Questions?:\s*/i, '').trim();
  return stripped ? [stripped] : [];
}

export interface ExerciseMatch {
  rowId: string;
  contentItemId: string;
  chapter: string;
  score: number;
  question: string;
}

/** Best match at or above theta that has a chapter; null otherwise. Glossary rows are not questions. */
export function bestExerciseMatch(question: string, rows: readonly PracticeRow[], theta: number): ExerciseMatch | null {
  const q = shingles(question);
  let best: ExerciseMatch | null = null;
  for (const r of rows) {
    if (!r.chapter || /^\[GLOSSARY/i.test(r.text)) continue;
    for (const eq of exerciseQuestions(r.text)) {
      const score = jaccard(q, shingles(eq));
      if (!best || score > best.score) best = { rowId: r.id, contentItemId: r.contentItemId, chapter: r.chapter, score, question: eq };
    }
  }
  return best && best.score >= theta ? best : null;
}
