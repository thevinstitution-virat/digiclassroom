// Reading a booklet page in two halves (docs/hw-eval/real-handwriting-read-1.md). A whole page is shrunk by the provider to about 768 px on its
// short side; read as a top and a bottom half, each half keeps about twice the detail, and on real handwriting that is what read the question
// numbers right and stopped the reader filling unreadable words with the textbook's idea. Pure: the rectangles to cut, and how two half-reads
// become one page read. Lines of writing run across the page, so the cut is always horizontal, whatever the page's shape.
//
// The halves overlap, so writing at the seam is read whole at least once and usually twice. Joining drops the repeat: the longest run of words
// that ends the top half's text and starts the bottom half's (allowing small reading differences) is the overlap, and what the bottom half read
// there is merged into the top half's segment it repeats, keeping both reads' numbers and boxes. An answer that runs across the seam therefore
// stays one answer, as it would on a whole-page read.

import type { PageRead, ReadSegment } from './page-reader';

export const HALVES = {
  /** Share of the page height read by both halves. ~8% of an A4 page is two to three lines of handwriting. */
  overlap: 0.08,
  /** A page shorter than this (px) is read whole: halving it would gain no detail. */
  minHeight: 1200,
  /** Words compared at the seam, at most. */
  maxSeamWords: 80,
  /** Two runs of words are the same writing when their word overlap is at least this (short runs), */
  sameWords: 0.8,
  /** or this for runs of `longRun` words or more: two reads of one line differ more ("w.r.t." / "with respect to", a digit / [?]). */
  sameWordsLong: 0.6,
  longRun: 6,
} as const;

export interface Rect { left: number; top: number; width: number; height: number }

/** The top and bottom halves to read, overlapping; null when the page should be read whole. */
export function halfRects(width: number, height: number): [Rect, Rect] | null {
  if (!(width > 0) || !(height >= HALVES.minHeight)) return null;
  const topHeight = Math.min(height, Math.ceil(height * (0.5 + HALVES.overlap / 2)));
  const bottomTop = Math.max(0, Math.floor(height * (0.5 - HALVES.overlap / 2)));
  return [{ left: 0, top: 0, width, height: topHeight }, { left: 0, top: bottomTop, width, height: height - bottomTop }];
}

interface Word { w: string; seg: number; end: number }
const words = (segs: ReadSegment[]): Word[] =>
  // positions in the text as read (so it can be cut there); each word compared in a normal form (subscript digits, case)
  segs.flatMap((s, seg) => [...s.text.matchAll(/[\p{L}\p{N}]+|\[\?+\]/gu)].map((m) => ({ w: m[0].normalize('NFKC').toLowerCase(), seg, end: m.index! + m[0].length })));

const dice = (a: string[], b: string[]): number => {
  const left = new Map<string, number>();
  for (const w of a) left.set(w, (left.get(w) ?? 0) + 1);
  let common = 0;
  for (const w of b) { const n = left.get(w) ?? 0; if (n > 0) { common++; left.set(w, n - 1); } }
  return (2 * common) / (a.length + b.length);
};

/**
 * The writing both halves read: a run that ends the top half's words and a run that starts the bottom half's, which may differ in length
 * (each half reads the seam its own way). The runs must start with the same word and end with the same word, and share most of their words.
 * The longest such pair wins; null when there is none (the seam fell in blank space).
 */
export function seamOverlap(top: string[], bottom: string[]): { topStart: number; bottomCount: number } | null {
  const earliest = Math.max(0, top.length - HALVES.maxSeamWords);
  let best: { topStart: number; bottomCount: number; score: number; size: number } | null = null;
  for (let i = earliest; i <= top.length - 2; i++) {
    if (top[i] !== bottom[0]) continue;
    const tail = top.slice(i);
    const lo = Math.max(2, Math.floor(tail.length * 0.75));
    const hi = Math.min(bottom.length, Math.ceil(tail.length * 1.34));
    for (let mb = lo; mb <= hi; mb++) {
      if (bottom[mb - 1] !== tail[tail.length - 1]) continue;
      const score = dice(tail, bottom.slice(0, mb));
      const need = Math.min(tail.length, mb) >= HALVES.longRun ? HALVES.sameWordsLong : HALVES.sameWords;
      const size = tail.length + mb;
      // the closest pair of runs wins, then the longer: a run padded with a neighbouring answer matches less well than the true repeat
      if (score >= need && (!best || score > best.score + 1e-9 || (Math.abs(score - best.score) <= 1e-9 && size > best.size))) best = { topStart: i, bottomCount: mb, score, size };
    }
  }
  return best && { topStart: best.topStart, bottomCount: best.bottomCount };
}

const unclear = (t: string) => (t.match(/\[\?+\]/g) ?? []).length;

function absorb(into: ReadSegment, from: ReadSegment, extraText: string): ReadSegment {
  const numbers = new Map(into.numbersSeen.map((n) => [n.number, n.confidence]));
  for (const n of from.numbersSeen) numbers.set(n.number, Math.max(numbers.get(n.number) ?? 0, n.confidence));
  const text = extraText ? `${into.text}\n${extraText}` : into.text;
  return {
    box: [...new Set([...into.box, ...from.box])],
    numbersSeen: [...numbers].map(([number, confidence]) => ({ number, confidence })),
    alternative: into.alternative ?? from.alternative,
    text,
    // the repeated words were read twice; the continuation is only as sure as the read it came from
    confidence: extraText ? Math.min(into.confidence, from.confidence) : into.confidence,
    unclearCount: unclear(text),
  };
}

/** Two half-reads of one page as one page read: sheet from the top (where the code is printed), the grid joined, the seam's repeat dropped. */
export function mergeHalves(top: PageRead, bottom: PageRead): PageRead {
  const grid = new Map<number, PageRead['grid'][number]['letter']>();
  for (const g of [...top.grid, ...bottom.grid]) {
    // the same grid row read twice: kept when both reads agree, otherwise no letter (a person looks)
    grid.set(g.number, grid.has(g.number) && grid.get(g.number) !== g.letter ? null : g.letter);
  }

  const tw = words(top.segments);
  const bw = words(bottom.segments);
  const seam = seamOverlap(tw.map((x) => x.w), bw.map((x) => x.w));
  const segments = [...top.segments];
  const rest: ReadSegment[] = [];
  if (!seam) rest.push(...bottom.segments);
  else {
    const m = seam.bottomCount;
    const topRun = tw.length - seam.topStart;
    // the bottom word k of the overlap lies about here in the top run (the runs may differ in length)
    const topWord = (k: number) => tw[seam.topStart + Math.min(topRun - 1, Math.round((k * (topRun - 1)) / Math.max(1, m - 1)))]!;
    for (const [i, s] of bottom.segments.entries()) {
      const mine = bw.map((x, k) => ({ ...x, k })).filter((x) => x.seg === i);
      const repeated = mine.filter((x) => x.k < m);
      if (!repeated.length && mine.length) { rest.push(s); continue; }
      if (!mine.length) { if (i < bw[m - 1]!.seg) continue; rest.push(s); continue; } // an empty segment inside the overlap is noise
      // which top segment these repeated words are: the one holding the matching top word
      const target = topWord(repeated[0]!.k).seg;
      const cut = repeated[repeated.length - 1]!.end;
      const remainder = s.text.slice(cut).replace(/^[\s.,;:)\]]+/, '').trimEnd();
      segments[target] = absorb(segments[target]!, s, repeated.length === mine.length ? '' : remainder);
    }
  }
  return { sheet: top.sheet ?? bottom.sheet, grid: [...grid].map(([number, letter]) => ({ number, letter })), segments: [...segments, ...rest] };
}
