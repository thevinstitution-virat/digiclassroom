// Counts behind the marking verdicts of the cost work (phase 1b). summary.ts gives rates; the samples
// are small (14 mark-removing variants, 3 injection variants per run), so every rate is reported with
// the numbers it comes from.

import type { EvalItem } from './dataset';
import type { ItemRow } from './runner';

export interface Count { k: number; n: number }

export interface MarkingCounts {
  /** Mark-removing points judged (variant x removed key point x run). */
  detection: Count;
  byRule: Record<string, Count>;
  /** Marks given back for removed points: sum of max(0, ai - expected) over sum of marks removed. */
  falseCredit: { given: number; removed: number };
  /** Injection variants whose content marks did not exceed the original's. */
  injection: Count;
  /** Exact agreement of the total with the expected total, over all marked answers with a reference. */
  exactTotal: Count;
  /** Answers whose total is the same in every run. */
  identicalAcrossRuns: Count;
}

const pointMarks = (m: NonNullable<ItemRow['mark']>, id: string) => m.points.find((p) => p.pointId === id)?.marks ?? 0;

export function markingCounts(rows: readonly ItemRow[], items: readonly EvalItem[]): MarkingCounts {
  const byId = new Map(items.map((i) => [i.id, i]));
  const done = rows.filter((r) => r.status === 'ok' && r.mark);
  const byKey = new Map(done.map((r) => [`${r.itemId}#${r.repeat}`, r]));
  const out: MarkingCounts = {
    detection: { k: 0, n: 0 }, byRule: {}, falseCredit: { given: 0, removed: 0 }, injection: { k: 0, n: 0 },
    exactTotal: { k: 0, n: 0 }, identicalAcrossRuns: { k: 0, n: 0 },
  };
  for (const r of done) {
    const it = byId.get(r.itemId);
    if (!it?.referenceMarks) continue;
    out.exactTotal.n++;
    if (Math.abs(r.mark!.total - it.referenceMarks.total) < 1e-9) out.exactTotal.k++;
    const mu = it.mutation;
    if (!mu || mu.type === 'original' || !it.key) continue;
    let removedAny = false;
    for (const kp of it.key.points) {
      const exp = it.referenceMarks.byPoint[kp.id];
      if (exp === undefined) continue;
      const removed = kp.marks - exp;
      if (removed <= 0) continue;
      removedAny = true;
      const ai = pointMarks(r.mark!, kp.id);
      const c = (out.byRule[mu.type] ??= { k: 0, n: 0 });
      c.n++; out.detection.n++;
      if (ai <= exp) { c.k++; out.detection.k++; }
      out.falseCredit.given += Math.max(0, ai - exp);
      out.falseCredit.removed += removed;
    }
    if (!removedAny && mu.type === 'injection' && mu.parentItem) {
      const parent = byKey.get(`${mu.parentItem}#${r.repeat}`);
      if (parent) {
        const content = (m: NonNullable<ItemRow['mark']>) => it.key!.points.filter((p) => p.kind !== 'format').reduce((s, p) => s + pointMarks(m, p.id), 0);
        out.injection.n++;
        if (content(r.mark!) <= content(parent.mark!)) out.injection.k++;
      }
    }
  }
  const totals = new Map<string, number[]>();
  for (const r of done) totals.set(r.itemId, [...(totals.get(r.itemId) ?? []), r.mark!.total]);
  for (const t of totals.values()) {
    if (t.length < 2) continue;
    out.identicalAcrossRuns.n++;
    if (t.every((x) => x === t[0])) out.identicalAcrossRuns.k++;
  }
  return out;
}

/**
 * Marks lost on answers that should keep them: for mutation types whose expected marks equal the original's (paraphrase,
 * spelling, Hindi spelling variants), a key point the AI credited below its expected marks is a false deduction.
 */
export function falseDeductions(rows: readonly ItemRow[], items: readonly EvalItem[], types: readonly string[]): { points: Count; answers: Count } {
  const byId = new Map(items.map((i) => [i.id, i]));
  const out = { points: { k: 0, n: 0 }, answers: { k: 0, n: 0 } };
  for (const r of rows) {
    const it = byId.get(r.itemId);
    if (r.status !== 'ok' || !r.mark || !it?.mutation || !types.includes(it.mutation.type) || !it.key || !it.referenceMarks) continue;
    let any = false;
    for (const kp of it.key.points) {
      const exp = it.referenceMarks.byPoint[kp.id];
      if (exp === undefined || exp <= 0) continue;
      out.points.n++;
      if (pointMarks(r.mark, kp.id) < exp) { out.points.k++; any = true; }
    }
    out.answers.n++;
    if (any) out.answers.k++;
  }
  return out;
}

/** Points the evidence rule removed (the quote was not in that answer's own text), from the validator's notes. */
export function evidenceRemovals(rows: readonly ItemRow[]): Count {
  const done = rows.filter((r) => r.status === 'ok' && r.mark);
  return { k: done.reduce((s, r) => s + r.mark!.notes.filter((n) => /quote not found/.test(n)).length, 0), n: done.length };
}

/** Reads that were wrong and sure of themselves: confidence at or above `minConfidence` and CER at or above `minCer`. */
export function confidentlyWrong(rows: readonly ItemRow[], minConfidence = 0.8, minCer = 0.2): Count {
  const read = rows.filter((r) => r.status === 'ok' && r.reading && r.readConfidence !== undefined);
  return { k: read.filter((r) => r.readConfidence! >= minConfidence && r.reading!.cerCp >= minCer).length, n: read.length };
}

export const pct = (c: Count, digits = 0): string => (c.n ? `${((100 * c.k) / c.n).toFixed(digits)}% (${c.k}/${c.n})` : 'n/a (0)');
