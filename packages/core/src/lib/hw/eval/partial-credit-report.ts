// Phase 1d: marks of a finished strict-marking run under each partial-credit rule, recomputed from the stored verdicts
// (no model call), and the tables built on them.
//
// A row's points carry the model's verdict (`fact`), its quote (`claimed`) and whether the quote is in the answer's own text
// (`evidence`). The marks under a rule are: same_fact with evidence -> the point's marks; right_idea_wrong_detail with evidence ->
// partialCredit(rule); everything else 0. A point without a stored verdict (code-marked answers, runs made before phase 1d) keeps the
// marks it was given: nothing to recompute.

import { marksFor, PARTIAL_RULES, type PartialRule } from '../grader/partial-credit';
import type { EvalItem } from './dataset';
import { falseDeductions, markingCounts, type Count } from './marking-report';
import type { ItemRow, MarkResult } from './runner';

export { PARTIAL_RULES };
export type { PartialRule };

/** A row's mark as the rule would have given it. Rows whose points have no stored verdict come back unchanged. */
export function markUnderRule(mark: MarkResult, item: EvalItem, rule: PartialRule): MarkResult {
  if (!item.key) return mark;
  const points = mark.points.map((p) => {
    if (!p.fact) return p;
    const full = item.key!.points.find((k) => k.id === p.pointId)?.marks ?? 0;
    const credited = p.fact === 'same_fact' || p.fact === 'right_idea_wrong_detail' ? p.evidence !== false : false;
    const marks = credited ? marksFor(p.fact, full, rule) : 0;
    // As the validator labels it: a right idea with a wrong detail stays "partial" even when the rule gives it the full marks.
    const verdict: MarkResult['points'][number]['verdict'] = marks <= 0 ? 'missing' : p.fact === 'same_fact' ? 'met' : 'partial';
    return { ...p, marks, verdict };
  });
  const total = Math.min(points.reduce((s, p) => s + p.marks, 0), item.question.marks);
  return { ...mark, points, total };
}

export function rowsUnderRule(rows: readonly ItemRow[], items: readonly EvalItem[], rule: PartialRule): ItemRow[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  return rows.map((r) => (r.mark && byId.get(r.itemId) ? { ...r, mark: markUnderRule(r.mark, byId.get(r.itemId)!, rule) } : r));
}

/** The items with their expected marks as they stand under `rule` (only near_miss items differ between rules). */
export function itemsUnderRule(items: readonly EvalItem[], rule: PartialRule): EvalItem[] {
  return items.map((it) => {
    const e = it.referenceMarks?.byRule?.[rule];
    return e && it.referenceMarks ? { ...it, referenceMarks: { ...it.referenceMarks, byPoint: e.byPoint, total: e.total } } : it;
  });
}

export interface RuleTable {
  rule: PartialRule;
  /** Mark-removing variants other than near_miss (the comparison with phase 1c). */
  detection: Count;
  falseCredit: { given: number; removed: number };
  falseDeductions: { answers: Count; points: Count };
  /** Near-miss answers: the near-missed point got exactly its expected marks / the answer's total is exactly the expected total. */
  nearMissPoint: Count;
  nearMissTotal: Count;
  injection: Count;
  exactTotal: Count;
}

export function ruleTable(rows: readonly ItemRow[], items: readonly EvalItem[], rule: PartialRule): RuleTable {
  const done = rows.filter((r) => r.status === 'ok' && r.mark);
  const under = itemsUnderRule(items, rule);
  const recomputed = rowsUnderRule(done, items, rule);
  const withoutNear = under.filter((i) => i.mutation?.type !== 'near_miss');
  const c = markingCounts(recomputed, withoutNear);
  const fd = falseDeductions(recomputed, under, ['paraphrase', 'spelling', 'hindi_spelling_variant']);
  const nearPoint: Count = { k: 0, n: 0 };
  const nearTotal: Count = { k: 0, n: 0 };
  const byId = new Map(under.map((i) => [i.id, i]));
  for (const r of recomputed) {
    const it = byId.get(r.itemId);
    if (it?.mutation?.type !== 'near_miss' || !it.referenceMarks || !it.mutation.target) continue;
    const got = r.mark!.points.find((p) => p.pointId === it.mutation!.target)?.marks ?? 0;
    nearPoint.n++;
    if (Math.abs(got - it.referenceMarks.byPoint[it.mutation.target]) < 1e-9) nearPoint.k++;
    nearTotal.n++;
    if (Math.abs(r.mark!.total - it.referenceMarks.total) < 1e-9) nearTotal.k++;
  }
  return { rule, detection: c.detection, falseCredit: c.falseCredit, falseDeductions: { answers: fd.answers, points: fd.points }, nearMissPoint: nearPoint, nearMissTotal: nearTotal, injection: c.injection, exactTotal: c.exactTotal };
}

export type FactCounts = Record<'same_fact' | 'right_idea_wrong_detail' | 'different_fact' | 'absent' | 'none', number>;

/**
 * What the grader decided for the TARGET point of every variant of a type (wrong_fact: a wrong fact replaces the key point's fact).
 * `none` is a row with no stored verdict. Where it matters: under `half` or `full`, each right_idea_wrong_detail on a wrong fact is credit leaked.
 */
export function verdictsOnTarget(rows: readonly ItemRow[], items: readonly EvalItem[], type: string, only?: ReadonlySet<string>): FactCounts {
  const byId = new Map(items.map((i) => [i.id, i]));
  const out: FactCounts = { same_fact: 0, right_idea_wrong_detail: 0, different_fact: 0, absent: 0, none: 0 };
  for (const r of rows) {
    const it = byId.get(r.itemId);
    if (r.status !== 'ok' || !r.mark || it?.mutation?.type !== type || !it.mutation.target) continue;
    if (only && !only.has(r.itemId)) continue;
    const p = r.mark.points.find((x) => x.pointId === it.mutation!.target);
    out[p?.fact ?? 'none']++;
  }
  return out;
}

export const sumCounts = (c: FactCounts) => c.same_fact + c.right_idea_wrong_detail + c.different_fact + c.absent + c.none;
