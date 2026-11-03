// Phase 1d, task 4: do an answer's marks depend on which other answers share its call?
//
// Design, fixed before any of these runs was read: every answer of a set is marked in 3 different random groupings, 2 runs per grouping.
//   within  = the largest gap between the two runs of one grouping (run-to-run noise for that answer)
//   across  = the gap between the highest and the lowest grouping mean
//   moved   = across > within  (the groupings differ by more than the answer varies inside any one grouping)
// The same statistic on a profile that marks one answer per call (M1-strict) is the noise reference: with nobody to share a call
// with, any `moved` there is run-to-run noise alone. A grouped profile is recorded as grouping-sensitive when it moves more answers
// than the reference and a one-sided Fisher exact test on the two counts gives p <= 0.10 (the sample is small, so the bar is loose).

import type { EvalItem } from './dataset';
import type { ItemRow } from './runner';

export interface AnswerMovement {
  itemId: string;
  /** Marks by grouping, then run. */
  marks: number[][];
  within: number;
  across: number;
  moved: boolean;
  expected: number | null;
  /** Of the highest and lowest grouping mean: which sits nearer the expected mark (null when no expected mark). */
  highIsCloser: boolean | null;
}

const mean = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

/** `byGrouping`: the marked rows of each grouping (two runs each). Answers missing from any run are left out and counted. */
export function groupingMovement(byGrouping: readonly (readonly ItemRow[])[], items: readonly EvalItem[]): { answers: AnswerMovement[]; incomplete: number } {
  const byId = new Map(items.map((i) => [i.id, i]));
  const ids = [...new Set(byGrouping.flatMap((g) => g.map((r) => r.itemId)))];
  const answers: AnswerMovement[] = [];
  let incomplete = 0;
  for (const id of ids) {
    const marks = byGrouping.map((g) => g.filter((r) => r.itemId === id && r.status === 'ok' && r.mark).sort((a, b) => a.repeat - b.repeat).map((r) => r.mark!.total));
    if (marks.some((m) => m.length < 2)) { incomplete++; continue; }
    const within = Math.max(...marks.map((m) => Math.max(...m) - Math.min(...m)));
    const means = marks.map(mean);
    const across = Math.max(...means) - Math.min(...means);
    const expected = byId.get(id)?.referenceMarks?.total ?? null;
    const hi = Math.max(...means);
    const lo = Math.min(...means);
    answers.push({
      itemId: id, marks, within, across, moved: across > within + 1e-9, expected,
      highIsCloser: expected === null || Math.abs(hi - expected) === Math.abs(lo - expected) ? null : Math.abs(hi - expected) < Math.abs(lo - expected),
    });
  }
  return { answers, incomplete };
}

export interface MovementSummary {
  n: number;
  moved: number;
  /** Sizes of the `across` gap among the moved answers, and how many moved the answer's mark nearer / further from the expected one. */
  sizes: Record<string, number>;
  highNearer: number;
  lowNearer: number;
  /** Among moved answers: did the groupings disagree about being right (one grouping gave the expected mark, another did not)? */
  splitOnExpected: number;
}

export function summariseMovement(answers: readonly AnswerMovement[]): MovementSummary {
  const moved = answers.filter((a) => a.moved);
  const sizes: Record<string, number> = {};
  for (const a of moved) { const k = a.across >= 1.5 ? '1.5 or more' : a.across >= 1 ? '1 to 1.5' : a.across >= 0.5 ? '0.5 to 1' : 'under 0.5'; sizes[k] = (sizes[k] ?? 0) + 1; }
  const splitOnExpected = moved.filter((a) => {
    if (a.expected === null) return false;
    const hits = a.marks.map((m) => m.every((x) => Math.abs(x - a.expected!) < 1e-9));
    return hits.some(Boolean) && !hits.every(Boolean);
  }).length;
  return {
    n: answers.length, moved: moved.length, sizes,
    highNearer: moved.filter((a) => a.highIsCloser === true).length, lowNearer: moved.filter((a) => a.highIsCloser === false).length, splitOnExpected,
  };
}

const logChoose = (n: number, k: number): number => { let s = 0; for (let i = 1; i <= k; i++) s += Math.log(n - k + i) - Math.log(i); return s; };

/** One-sided Fisher exact p for [[a, b], [c, d]]: the chance of at least `a` in the first cell with the margins fixed (a = moved in the group under test). */
export function fisherOneSided(a: number, b: number, c: number, d: number): number {
  const n1 = a + b; const n2 = c + d; const k = a + c; const n = n1 + n2;
  let p = 0;
  for (let x = a; x <= Math.min(n1, k); x++) {
    if (k - x > n2) continue;
    p += Math.exp(logChoose(n1, x) + logChoose(n2, k - x) - logChoose(n, k));
  }
  return Math.min(1, p);
}

/** The pre-registered verdict: grouping-sensitive when the grouped profile moves more answers than the reference and p <= 0.10. */
export function groupingVerdict(grouped: { moved: number; n: number }, reference: { moved: number; n: number }): { sensitive: boolean; p: number } {
  const p = fisherOneSided(grouped.moved, grouped.n - grouped.moved, reference.moved, reference.n - reference.moved);
  return { sensitive: grouped.moved > reference.moved && p <= 0.1, p };
}
