// Scoring a reader against the true text, for scripts/hw-eval.ts. Pure.

import { countUnclear } from '../text/normalise';

/** Unicode NFC, unified line endings, runs of spaces collapsed, trimmed. Case and spelling kept. */
export function normaliseForCer(s: string): string {
  return s.normalize('NFC').replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
}

/** Levenshtein distance over Unicode code points (so Devanagari matras count as characters). */
export function editDistance(a: string, b: string): number {
  const x = Array.from(a);
  const y = Array.from(b);
  if (!x.length) return y.length;
  if (!y.length) return x.length;
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[y.length];
}

export interface SampleScore {
  cer: number;
  /** [?] markers per reference word. */
  unclearRate: number;
  catastrophic: boolean;
  refChars: number;
  outChars: number;
}

/**
 * CER = edit distance / reference length, after NFC. Each [?] counts as what it is in the
 * text (three wrong characters), so honest "unreadable" marks still cost something.
 * Catastrophic: CER above 0.5, or output more than twice as long as the reference.
 */
export function scoreSample(output: string, truth: string): SampleScore {
  const o = normaliseForCer(output);
  const t = normaliseForCer(truth);
  const refChars = Array.from(t).length;
  const outChars = Array.from(o).length;
  const cer = refChars ? editDistance(o, t) / refChars : outChars ? 1 : 0;
  const words = t.split(/\s+/).filter(Boolean).length;
  return {
    cer,
    unclearRate: words ? countUnclear(o) / words : 0,
    catastrophic: cer > 0.5 || outChars > 2 * Math.max(refChars, 1),
    refChars,
    outChars,
  };
}

export function median(xs: number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
