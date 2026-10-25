// Person check of mutation variants before a dataset version is frozen (stage1-design.md §6):
// a 10% sample of every rule, at least 20 per rule (or all of a rule with fewer). Pure.

import { seededRandom } from './bootstrap';
import type { EvalItem } from './dataset';

export interface ReviewEntry {
  itemId: string;
  verdict: 'approved' | 'rejected';
  note?: string;
}

/** Item ids to review, grouped by rule; seeded, so the sample is reproducible. */
export function reviewSample(items: readonly EvalItem[], opts: { rate?: number; minPerRule?: number; seed?: number } = {}): Map<string, string[]> {
  const rate = opts.rate ?? 0.1;
  const min = opts.minPerRule ?? 20;
  const rnd = seededRandom(opts.seed ?? 20261026);
  const byRule = new Map<string, string[]>();
  for (const it of items) {
    if (!it.mutation) continue;
    const k = it.mutation.type;
    byRule.set(k, [...(byRule.get(k) ?? []), it.id]);
  }
  const out = new Map<string, string[]>();
  for (const [rule, ids] of [...byRule].sort(([a], [b]) => a.localeCompare(b))) {
    const n = Math.min(ids.length, Math.max(min, Math.ceil(ids.length * rate)));
    const pool = [...ids].sort();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    out.set(rule, pool.slice(0, n).sort());
  }
  return out;
}

export interface FreezeDecision {
  ok: boolean;
  problems: string[];
  /** Items going into the frozen version (rejected ones and their dependents removed). */
  keep: EvalItem[];
  rejected: string[];
}

/**
 * Every sampled item must be reviewed. A rule whose sample is more than `maxRejectRate`
 * rejected is refused whole: its unreviewed variants cannot be trusted either. Rejected
 * items are dropped; a rejected original drops its whole family.
 */
export function freezeDecision(items: readonly EvalItem[], reviews: readonly ReviewEntry[], sample: Map<string, string[]>, maxRejectRate = 0.1): FreezeDecision {
  const byId = new Map(reviews.map((r) => [r.itemId, r]));
  const problems: string[] = [];
  const rejected = new Set(reviews.filter((r) => r.verdict === 'rejected').map((r) => r.itemId));
  for (const [rule, ids] of sample) {
    const missing = ids.filter((id) => !byId.has(id));
    if (missing.length) problems.push(`${rule}: ${missing.length} of ${ids.length} sampled items not reviewed`);
    const rej = ids.filter((id) => rejected.has(id)).length;
    if (ids.length && rej / ids.length > maxRejectRate) problems.push(`${rule}: ${rej} of ${ids.length} sampled items rejected (> ${maxRejectRate * 100}%); regenerate this rule`);
  }
  for (const it of items) if (it.mutation?.type === 'original' && rejected.has(it.id)) {
    for (const v of items) if (v.mutation?.parentItem === it.id) rejected.add(v.id);
  }
  return { ok: problems.length === 0, problems, keep: items.filter((x) => !rejected.has(x.id)), rejected: [...rejected] };
}
