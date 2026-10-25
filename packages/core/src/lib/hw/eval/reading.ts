// Reading metrics (docs/hw-eval/stage1-design.md §5.2). Pure.
//
// Normalisation for every reading metric: NFC, unified line endings, runs of spaces
// collapsed, trimmed. Case and spelling are KEPT: a "corrected" word is an error.

import { countUnclear } from '../text/normalise';

export const UNCLEAR = '[?]';

export function normaliseForReading(s: string): string {
  return s.normalize('NFC').replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
}

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** User-perceived characters: "क्षि" is one unit here, four code points elsewhere. */
export function graphemes(s: string): string[] {
  return Array.from(segmenter.segment(s), (x) => x.segment);
}

export function codePoints(s: string): string[] {
  return Array.from(s);
}

/** Levenshtein distance over any token sequence. */
export function levenshtein<T>(a: readonly T[], b: readonly T[]): number {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

const PUNCT = /[।॥\p{P}\p{S}]/gu;

/** Words for WER: whitespace tokens after removing punctuation (incl. danda), keeping [?] whole. */
export function words(s: string): string[] {
  return normaliseForReading(s)
    .split(/\s+/)
    .map((w) => (w === UNCLEAR ? w : w.replace(PUNCT, '')))
    .filter(Boolean);
}

export type AlignOp = { op: 'match' | 'sub' | 'ins' | 'del'; out?: string; truth?: string };

/** Minimum-edit word alignment of output against truth (ties: match > sub > del > ins). */
export function alignWords(out: readonly string[], truth: readonly string[]): AlignOp[] {
  const n = out.length;
  const m = truth.length;
  const d: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      d[i][j] = Math.min(d[i - 1][j - 1] + (out[i - 1] === truth[j - 1] ? 0 : 1), d[i - 1][j] + 1, d[i][j - 1] + 1);
    }
  }
  const ops: AlignOp[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (out[i - 1] === truth[j - 1] ? 0 : 1)) {
      ops.push({ op: out[i - 1] === truth[j - 1] ? 'match' : 'sub', out: out[i - 1], truth: truth[j - 1] });
      i--;
      j--;
    } else if (j > 0 && d[i][j] === d[i][j - 1] + 1) {
      ops.push({ op: 'del', truth: truth[j - 1] });
      j--;
    } else {
      ops.push({ op: 'ins', out: out[i - 1] });
      i--;
    }
  }
  return ops.reverse();
}

export interface ReadingItemScore {
  /** Edit distance and reference length, so callers can micro-average. */
  cpEdits: number;
  /** Code point edits with every line break read as a space (layout ignored), same reference length. */
  cpEditsFlat: number;
  cpRef: number;
  gEdits: number;
  gRef: number;
  wordEdits: number;
  wordRef: number;
  outWords: number;
  unclear: number;
  invented: number;
  /** Per-item rates, for medians and the catastrophic test. */
  cerCp: number;
  cerG: number;
  wer: number;
  catastrophic: boolean;
}

export function scoreReading(output: string, truth: string): ReadingItemScore {
  const o = normaliseForReading(output);
  const t = normaliseForReading(truth);
  const oc = codePoints(o);
  const tc = codePoints(t);
  const og = graphemes(o);
  const tg = graphemes(t);
  const ow = words(o);
  const tw = words(t);
  const cpEdits = levenshtein(oc, tc);
  const flat = (s: string) => codePoints(s.replace(/\n/g, ' '));
  const cpEditsFlat = levenshtein(flat(o), flat(t));
  const gEdits = levenshtein(og, tg);
  const ops = alignWords(ow, tw);
  const wordEdits = ops.filter((x) => x.op !== 'match').length;
  const invented = ops.filter((x) => (x.op === 'sub' || x.op === 'ins') && x.out !== UNCLEAR).length;
  const rate = (e: number, r: number, outLen: number) => (r ? e / r : outLen ? 1 : 0);
  const cerCp = rate(cpEdits, tc.length, oc.length);
  return {
    cpEdits, cpEditsFlat, cpRef: tc.length, gEdits, gRef: tg.length, wordEdits, wordRef: tw.length,
    outWords: ow.length, unclear: countUnclear(o), invented,
    cerCp, cerG: rate(gEdits, tg.length, og.length), wer: rate(wordEdits, tw.length, ow.length),
    catastrophic: cerCp > 0.5 || oc.length > 2 * Math.max(tc.length, 1),
  };
}

export interface ReadingSummary {
  n: number;
  cerCp: number;
  /** CER with line breaks read as spaces: the same reading without layout. NaN for runs scored before it existed. */
  cerFlat: number;
  cerG: number;
  wer: number;
  medianCerCp: number;
  unclearRate: number;
  inventedRate: number;
  catastrophicRate: number;
}

/** Micro-averaged rates over a set of items (§5.2). */
export function summariseReading(items: readonly ReadingItemScore[]): ReadingSummary {
  const sum = (f: (x: ReadingItemScore) => number) => items.reduce((s, x) => s + f(x), 0);
  const div = (a: number, b: number) => (b ? a / b : NaN);
  return {
    n: items.length,
    cerCp: div(sum((x) => x.cpEdits), sum((x) => x.cpRef)),
    cerFlat: div(sum((x) => x.cpEditsFlat ?? NaN), sum((x) => x.cpRef)),
    cerG: div(sum((x) => x.gEdits), sum((x) => x.gRef)),
    wer: div(sum((x) => x.wordEdits), sum((x) => x.wordRef)),
    medianCerCp: median(items.map((x) => x.cerCp)),
    unclearRate: div(sum((x) => x.unclear), sum((x) => x.wordRef)),
    inventedRate: div(sum((x) => x.invented), sum((x) => x.outWords)),
    catastrophicRate: div(items.filter((x) => x.catastrophic).length, items.length),
  };
}

export function median(xs: readonly number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
