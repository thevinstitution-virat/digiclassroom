// Back-compatible entry point for scripts/hw-eval.ts. The metrics now live in reading.ts,
// agreement.ts and bootstrap.ts.

import { countUnclear } from '../text/normalise';
import { codePoints, levenshtein, normaliseForReading } from './reading';

export { median } from './reading';

/** Unicode NFC, unified line endings, runs of spaces collapsed, trimmed. Case and spelling kept. */
export const normaliseForCer = normaliseForReading;

/** Levenshtein distance over Unicode code points. */
export function editDistance(a: string, b: string): number {
  return levenshtein(codePoints(a), codePoints(b));
}

export interface SampleScore {
  cer: number;
  /** [?] markers per reference word. */
  unclearRate: number;
  catastrophic: boolean;
  refChars: number;
  outChars: number;
}

/** CER (code points) after normalisation; catastrophic = CER > 0.5 or output > 2× reference. */
export function scoreSample(output: string, truth: string): SampleScore {
  const o = normaliseForReading(output);
  const t = normaliseForReading(truth);
  const refChars = codePoints(t).length;
  const outChars = codePoints(o).length;
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

