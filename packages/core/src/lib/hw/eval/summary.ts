// Headline numbers for a run, and the comparison of two runs (stage1-design.md §5.2).
// Statuses are never turned into numbers: failed / no_grounding / skipped rows are counted
// and excluded. Full grouped reports and the gate table come later (reports stage).

import { bootstrapCI, type Interval } from './bootstrap';
import {
  allRunsIdentical, detectionRate, falseCreditRate, icc21, injectionResistance, invarianceRate, meanSpread, qwk,
  summariseMarking, verdictConfusion, type MarkPair, type MutatedPoint, type Verdict,
} from './agreement';
import { HARMLESS, type EvalItem } from './dataset';
import { summariseReading, type ReadingSummary } from './reading';
import type { ItemRow, MarkResult, RunMode } from './runner';

export const MIN_MARKING = 60;
export const MIN_READING = 100;

export interface MarkingHeadline {
  n: number;
  /** QWK per maximum mark (QWK needs one scale); NaN-free groups only. */
  qwkByMax: { maxMarks: number; n: number; qwk: number; ci: Interval }[];
  normalisedMae: number;
  normalisedMaeCi: Interval;
  exact: number;
  withinOne: number;
  bias: number;
  largeErrorRate: number;
  confusion: Record<Verdict, Record<Verdict, number>>;
  insufficient: boolean;
}

export interface MutationHeadline {
  detection: number;
  falseCredit: number;
  invariance: number;
  injection: number;
  byType: Record<string, { n: number; detection?: number; meanAbsDelta?: number }>;
}

export interface RunSummary {
  mode: RunMode;
  counts: Record<string, number>;
  reading?: ReadingSummary & { insufficient: boolean };
  marking?: MarkingHeadline;
  /** e2e only: marking on the truth transcript, and MAE(e2e) − MAE(truth) with a CI. */
  markingTruth?: MarkingHeadline;
  readingEffect?: Interval;
  mutations?: MutationHeadline;
  repeatability?: { items: number; allIdentical: number; icc: number; meanSpread: number };
  keys?: { questions: number; grounded: number; noGrounding: Record<string, number>; invalid: number; partial: number; marksSumOk: number };
}

const refVerdict = (ref: number, max: number): Verdict => (ref <= 0 ? 'missing' : ref >= max ? 'met' : 'partial');

function marking(rows: readonly ItemRow[], items: Map<string, EvalItem>, field: 'mark' | 'markTruth'): MarkingHeadline | undefined {
  const scored = rows.filter((r) => r.repeat === 0 && r[field] && items.get(r.itemId)?.referenceMarks);
  if (!scored.length) return undefined;
  const pairsOf = (rs: readonly ItemRow[]) => rs.map((r) => ({ ai: r[field]!.total, ref: items.get(r.itemId)!.referenceMarks!.total, max: items.get(r.itemId)!.question.marks }));
  const all = pairsOf(scored);
  const byMax = new Map<number, ItemRow[]>();
  for (const r of scored) { const m = items.get(r.itemId)!.question.marks; byMax.set(m, [...(byMax.get(m) ?? []), r]); }
  const qwkByMax = [...byMax].map(([maxMarks, rs]) => {
    const stat = (xs: readonly ItemRow[]) => qwk(pairsOf(xs) as MarkPair[], maxMarks);
    return { maxMarks, n: rs.length, qwk: stat(rs), ci: bootstrapCI(rs, stat) };
  }).sort((a, b) => a.maxMarks - b.maxMarks);
  const nmae = (xs: readonly ItemRow[]) => { const p = pairsOf(xs); return p.reduce((s, x) => s + Math.abs(x.ai - x.ref) / x.max, 0) / p.length; };
  // Exact / within one / bias / large errors pooled across scales (each pair judged on its own M).
  const s = all.map((p) => summariseMarking([p], p.max));
  const mean = (f: (x: (typeof s)[number]) => number) => s.reduce((a, x) => a + f(x), 0) / s.length;
  const pointPairs: { ref: Verdict; ai: Verdict }[] = [];
  for (const r of scored) {
    const it = items.get(r.itemId)!;
    for (const p of r[field]!.points) {
      const kp = it.key!.points.find((x) => x.id === p.pointId);
      const ref = it.referenceMarks!.byPoint[p.pointId];
      if (kp && ref !== undefined) pointPairs.push({ ref: refVerdict(ref, kp.marks), ai: p.verdict });
    }
  }
  return {
    n: scored.length, qwkByMax, normalisedMae: nmae(scored), normalisedMaeCi: bootstrapCI(scored, nmae),
    exact: mean((x) => x.exact), withinOne: mean((x) => x.withinOne), bias: mean((x) => x.bias), largeErrorRate: mean((x) => x.largeErrorRate),
    confusion: verdictConfusion(pointPairs), insufficient: scored.length < MIN_MARKING,
  };
}

const pointMarks = (m: MarkResult, id: string) => m.points.find((p) => p.pointId === id)?.marks ?? 0;

function mutations(rows: readonly ItemRow[], items: Map<string, EvalItem>, field: 'mark' | 'markTruth'): MutationHeadline | undefined {
  const byKey = new Map(rows.filter((r) => r[field]).map((r) => [`${r.itemId}#${r.repeat}`, r]));
  const points: MutatedPoint[] = [];
  const harmless: { original: number; variant: number }[] = [];
  const injection: { original: number; variant: number }[] = [];
  const byType: MutationHeadline['byType'] = {};
  for (const r of byKey.values()) {
    const it = items.get(r.itemId);
    const mu = it?.mutation;
    if (!it || !mu || mu.type === 'original' || !mu.parentItem || !it.key || !it.referenceMarks) continue;
    const parent = byKey.get(`${mu.parentItem}#${r.repeat}`);
    const t = (byType[mu.type] ??= { n: 0 });
    t.n++;
    const m = r[field]!;
    let removedAny = false;
    for (const kp of it.key.points) {
      const exp = it.referenceMarks.byPoint[kp.id];
      if (exp === undefined) continue; // no reference for this point: not judged
      const removed = kp.marks - exp;
      if (removed > 0) { removedAny = true; points.push({ aiPointMarks: pointMarks(m, kp.id), expectedPointMarks: exp, removed }); }
    }
    if (removedAny) continue;
    if (!parent) continue;
    // Content points only: format points may legitimately differ (e.g. word limits).
    const content = (x: MarkResult) => it.key!.points.filter((p) => p.kind !== 'format').reduce((s, p) => s + pointMarks(x, p.id), 0);
    const pair = { original: content(parent[field]!), variant: content(m) };
    if (mu.type === 'injection') injection.push(pair);
    else if (HARMLESS.has(mu.type)) harmless.push(pair);
    t.meanAbsDelta = ((t.meanAbsDelta ?? 0) * (t.n - 1) + Math.abs(pair.variant - pair.original)) / t.n;
  }
  for (const [type, v] of Object.entries(byType)) {
    const rel = [...byKey.values()].filter((r) => items.get(r.itemId)?.mutation?.type === type);
    const pts: MutatedPoint[] = [];
    for (const r of rel) {
      const it = items.get(r.itemId)!;
      for (const kp of it.key?.points ?? []) {
        const exp = it.referenceMarks?.byPoint[kp.id];
        if (exp !== undefined && kp.marks - exp > 0) pts.push({ aiPointMarks: pointMarks(r[field]!, kp.id), expectedPointMarks: exp, removed: kp.marks - exp });
      }
    }
    if (pts.length) v.detection = detectionRate(pts);
  }
  if (!points.length && !harmless.length && !injection.length) return undefined;
  return { detection: detectionRate(points), falseCredit: falseCreditRate(points), invariance: invarianceRate(harmless), injection: injectionResistance(injection), byType };
}

export function summariseRun(mode: RunMode, allRows: readonly ItemRow[], dsItems: readonly EvalItem[]): RunSummary {
  const items = new Map(dsItems.map((x) => [x.id, x]));
  const counts: Record<string, number> = {};
  for (const r of allRows) counts[r.status] = (counts[r.status] ?? 0) + 1;
  const ok = allRows.filter((r) => r.status === 'ok');
  const out: RunSummary = { mode, counts };

  if (mode === 'read' || mode === 'e2e') {
    const rs = ok.filter((r) => r.repeat === 0 && r.reading).map((r) => r.reading!);
    if (rs.length) out.reading = { ...summariseReading(rs), insufficient: rs.length < MIN_READING };
  }
  if (mode === 'mark' || mode === 'e2e') {
    out.marking = marking(ok, items, 'mark');
    out.mutations = mutations(ok, items, 'mark');
    const reps = new Map<string, number[]>();
    for (const r of ok) if (r.mark) reps.set(r.itemId, [...(reps.get(r.itemId) ?? []), r.mark.total]);
    const full = [...reps.values()].filter((x) => x.length > 1);
    const k = Math.max(0, ...full.map((x) => x.length));
    const complete = full.filter((x) => x.length === k);
    if (complete.length) out.repeatability = { items: complete.length, allIdentical: allRunsIdentical(complete), icc: icc21(complete), meanSpread: meanSpread(complete) };
  }
  if (mode === 'e2e') {
    out.markingTruth = marking(ok, items, 'markTruth');
    const paired = ok.filter((r) => r.repeat === 0 && r.mark && r.markTruth && items.get(r.itemId)?.referenceMarks);
    if (paired.length) {
      out.readingEffect = bootstrapCI(paired, (xs) => xs.reduce((s, r) => {
        const ref = items.get(r.itemId)!.referenceMarks!.total;
        return s + Math.abs(r.mark!.total - ref) - Math.abs(r.markTruth!.total - ref);
      }, 0) / xs.length);
    }
  }
  if (mode === 'key') {
    const byQ = new Map<string, ItemRow>();
    for (const r of allRows) if (r.repeat === 0 && r.key && !byQ.has(r.questionId)) byQ.set(r.questionId, r);
    const ks = [...byQ.values()];
    const noGrounding: Record<string, number> = {};
    for (const r of ks) if (r.key!.status === 'no_grounding') noGrounding[r.key!.reason ?? 'unknown'] = (noGrounding[r.key!.reason ?? 'unknown'] ?? 0) + 1;
    out.keys = {
      questions: ks.length,
      grounded: ks.filter((r) => r.key!.status === 'grounded').length,
      noGrounding,
      invalid: ks.filter((r) => r.key!.status === 'key_invalid').length,
      partial: ks.filter((r) => r.key!.partial).length,
      marksSumOk: ks.filter((r) => r.key!.status === 'grounded' && Math.abs((r.key!.marksSum ?? -1) - (items.get(r.itemId)?.question.marks ?? -2)) < 1e-9).length,
    };
  }
  return out;
}

export interface MetricDelta { metric: string; baseline: number; candidate: number; delta: number; worseWhen: 'higher' | 'lower' }

/** Headline deltas, candidate − baseline. Same dataset and mode required. */
export function compareSummaries(baseline: RunSummary, candidate: RunSummary): MetricDelta[] {
  const out: MetricDelta[] = [];
  const add = (metric: string, a: number | undefined, b: number | undefined, worseWhen: 'higher' | 'lower') => {
    if (a === undefined || b === undefined || Number.isNaN(a) || Number.isNaN(b)) return;
    out.push({ metric, baseline: a, candidate: b, delta: b - a, worseWhen });
  };
  add('reading.cerCp', baseline.reading?.cerCp, candidate.reading?.cerCp, 'higher');
  add('reading.cerG', baseline.reading?.cerG, candidate.reading?.cerG, 'higher');
  add('reading.cerFlat', baseline.reading?.cerFlat, candidate.reading?.cerFlat, 'higher');
  add('reading.wer', baseline.reading?.wer, candidate.reading?.wer, 'higher');
  add('reading.inventedRate', baseline.reading?.inventedRate, candidate.reading?.inventedRate, 'higher');
  add('reading.catastrophicRate', baseline.reading?.catastrophicRate, candidate.reading?.catastrophicRate, 'higher');
  for (const g of baseline.marking?.qwkByMax ?? []) {
    add(`marking.qwk[M=${g.maxMarks}]`, g.qwk, candidate.marking?.qwkByMax.find((x) => x.maxMarks === g.maxMarks)?.qwk, 'lower');
  }
  add('marking.normalisedMae', baseline.marking?.normalisedMae, candidate.marking?.normalisedMae, 'higher');
  add('marking.largeErrorRate', baseline.marking?.largeErrorRate, candidate.marking?.largeErrorRate, 'higher');
  add('marking.bias', baseline.marking?.bias, candidate.marking?.bias, 'higher');
  add('mutations.detection', baseline.mutations?.detection, candidate.mutations?.detection, 'lower');
  add('mutations.falseCredit', baseline.mutations?.falseCredit, candidate.mutations?.falseCredit, 'higher');
  add('mutations.invariance', baseline.mutations?.invariance, candidate.mutations?.invariance, 'lower');
  add('mutations.injection', baseline.mutations?.injection, candidate.mutations?.injection, 'lower');
  add('repeatability.allIdentical', baseline.repeatability?.allIdentical, candidate.repeatability?.allIdentical, 'lower');
  add('keys.grounded', baseline.keys?.grounded, candidate.keys?.grounded, 'lower');
  return out;
}

/** Items whose total moved between two runs (repeat 0). */
export function changedItems(a: readonly ItemRow[], b: readonly ItemRow[]): { itemId: string; baseline: number; candidate: number }[] {
  const am = new Map(a.filter((r) => r.repeat === 0 && r.mark).map((r) => [r.itemId, r.mark!.total]));
  return b.filter((r) => r.repeat === 0 && r.mark && am.has(r.itemId) && am.get(r.itemId) !== r.mark.total)
    .map((r) => ({ itemId: r.itemId, baseline: am.get(r.itemId)!, candidate: r.mark!.total }));
}
