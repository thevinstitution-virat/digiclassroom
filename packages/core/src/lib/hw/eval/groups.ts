// Group breakdowns and the teacher baseline (stage1-design.md §5.2 "Groups", "Teacher
// baseline", "Minimum data"). Pure.
//
// A group shows numbers only with enough data: ≥ 60 answers for marking, ≥ 100 items for
// reading; otherwise it says "Insufficient data (n = …)". QWK needs one mark scale, so it is
// computed per maximum mark M inside a group; normalised MAE pools scales.

import { bootstrapCI, type Interval } from './bootstrap';
import { krippendorffAlpha, qwk, summariseMarking, type MarkPair } from './agreement';
import type { EvalItem } from './dataset';
import { summariseReading, type ReadingSummary } from './reading';
import type { ItemRow } from './runner';
import { MIN_MARKING, MIN_READING } from './summary';

export type Dimension = 'medium' | 'language' | 'mode' | 'handwritingBand' | 'subject' | 'class' | 'questionType' | 'markWeight' | 'device';
export const DIMENSIONS: Dimension[] = ['medium', 'language', 'mode', 'handwritingBand', 'subject', 'class', 'questionType', 'markWeight', 'device'];

/** Mark weight bands: 1 / 2–3 / 4–7 / ≥ 8 (the design's 4–6 band is widened so 7 belongs somewhere). */
export function markWeight(m: number): string {
  if (m <= 1) return '1';
  if (m <= 3) return '2-3';
  if (m <= 7) return '4-7';
  return '8+';
}

export function dimensionValue(it: EvalItem, d: Dimension): string {
  switch (d) {
    case 'markWeight': return markWeight(it.question.marks);
    case 'class': return it.class;
    default: return String(it[d]);
  }
}

export interface ScaleAgreement { maxMarks: number; n: number; qwk: number; ci: Interval }

export interface MarkingGroup {
  n: number;
  insufficient: boolean;
  normalisedMae: number;
  normalisedMaeCi: Interval;
  largeErrorRate: number;
  bias: number;
  byScale: ScaleAgreement[];
}

export interface GroupStats {
  dimension: Dimension | 'all';
  value: string;
  reading?: ReadingSummary & { insufficient: boolean };
  marking?: MarkingGroup;
}

type Scored = { row: ItemRow; item: EvalItem; ai: number; ref: number; max: number };

/** Repeat 0 rows with AI marks (from `field`) and reference marks. */
export function scoredRows(rows: readonly ItemRow[], items: ReadonlyMap<string, EvalItem>, field: 'mark' | 'markTruth' = 'mark'): Scored[] {
  const out: Scored[] = [];
  for (const row of rows) {
    if (row.repeat !== 0 || row.status !== 'ok' || !row[field]) continue;
    const item = items.get(row.itemId);
    if (!item?.referenceMarks) continue;
    out.push({ row, item, ai: row[field]!.total, ref: item.referenceMarks.total, max: item.question.marks });
  }
  return out;
}

export function markingGroup(s: readonly Scored[], minN = MIN_MARKING): MarkingGroup {
  const nmae = (xs: readonly Scored[]) => xs.reduce((a, x) => a + Math.abs(x.ai - x.ref) / x.max, 0) / xs.length;
  const per = s.map((x) => summariseMarking([{ ai: x.ai, ref: x.ref }], x.max));
  const mean = (f: (p: (typeof per)[number]) => number) => per.reduce((a, p) => a + f(p), 0) / Math.max(1, per.length);
  const scales = new Map<number, Scored[]>();
  for (const x of s) scales.set(x.max, [...(scales.get(x.max) ?? []), x]);
  const byScale = [...scales].map(([maxMarks, xs]) => {
    const stat = (ys: readonly Scored[]) => qwk(ys.map((y) => ({ ai: y.ai, ref: y.ref })) as MarkPair[], maxMarks);
    return { maxMarks, n: xs.length, qwk: stat(xs), ci: bootstrapCI(xs, stat) };
  }).sort((a, b) => a.maxMarks - b.maxMarks);
  return {
    n: s.length, insufficient: s.length < minN,
    normalisedMae: s.length ? nmae(s) : NaN, normalisedMaeCi: bootstrapCI(s, nmae),
    largeErrorRate: mean((p) => p.largeErrorRate), bias: mean((p) => p.bias), byScale,
  };
}

/** Overall and per-dimension statistics for one run. */
export function groupBreakdown(rows: readonly ItemRow[], dsItems: readonly EvalItem[], dims: readonly Dimension[] = DIMENSIONS): GroupStats[] {
  const items = new Map(dsItems.map((x) => [x.id, x]));
  const reading = rows.filter((r) => r.repeat === 0 && r.status === 'ok' && r.reading && items.has(r.itemId));
  const marked = scoredRows(rows, items);
  const build = (dimension: GroupStats['dimension'], value: string, keep: (it: EvalItem) => boolean): GroupStats => {
    const rd = reading.filter((r) => keep(items.get(r.itemId)!)).map((r) => r.reading!);
    const mk = marked.filter((x) => keep(x.item));
    return {
      dimension, value,
      ...(rd.length ? { reading: { ...summariseReading(rd), insufficient: rd.length < MIN_READING } } : {}),
      ...(mk.length ? { marking: markingGroup(mk) } : {}),
    };
  };
  const out: GroupStats[] = [build('all', 'all', () => true)];
  for (const d of dims) {
    const values = [...new Set(dsItems.map((it) => dimensionValue(it, d)))].sort();
    for (const v of values) {
      const g = build(d, v, (it) => dimensionValue(it, d) === v);
      if (g.reading || g.marking) out.push(g);
    }
  }
  return out;
}

// ── Teacher baseline (source E) ─────────────────────────────────────────────────────────

/** reference/raters.json of a dataset version: itemId -> pseudonym -> marks by point. */
export type RaterMarks = Record<string, Record<string, Record<string, number>>>;

export interface TeacherBaseline {
  /** Answers marked by at least two teachers. */
  n: number;
  byScale: { maxMarks: number; n: number; qwk: number }[];
  normalisedMae: number;
  exact: number;
  /** Ordinal alpha over all markers, when some answers have more than two. */
  alpha: number | null;
}

const sum = (m: Record<string, number>) => Object.values(m).reduce((a, x) => a + x, 0);

/** Teacher vs teacher on double-marked answers: the first two markers of each answer, by name order. */
export function teacherBaseline(raters: RaterMarks, items: ReadonlyMap<string, EvalItem>, keep: (it: EvalItem) => boolean = () => true): TeacherBaseline {
  const pairs: { a: number; b: number; max: number }[] = [];
  const units: (number | null)[][] = [];
  const coders = [...new Set(Object.values(raters).flatMap((r) => Object.keys(r)))].sort();
  let more = false;
  for (const [itemId, byRater] of Object.entries(raters)) {
    const it = items.get(itemId);
    if (!it || !keep(it)) continue;
    const names = Object.keys(byRater).sort();
    if (names.length < 2) continue;
    if (names.length > 2) more = true;
    pairs.push({ a: sum(byRater[names[0]]), b: sum(byRater[names[1]]), max: it.question.marks });
    units.push(coders.map((c) => (byRater[c] ? sum(byRater[c]) : null)));
  }
  const scales = new Map<number, typeof pairs>();
  for (const p of pairs) scales.set(p.max, [...(scales.get(p.max) ?? []), p]);
  return {
    n: pairs.length,
    byScale: [...scales].map(([maxMarks, ps]) => ({ maxMarks, n: ps.length, qwk: qwk(ps.map((p) => ({ ai: p.a, ref: p.b })), maxMarks) })).sort((x, y) => x.maxMarks - y.maxMarks),
    normalisedMae: pairs.length ? pairs.reduce((s, p) => s + Math.abs(p.a - p.b) / p.max, 0) / pairs.length : NaN,
    exact: pairs.length ? pairs.filter((p) => p.a === p.b).length / pairs.length : NaN,
    alpha: more ? krippendorffAlpha(units, 'ordinal') : null,
  };
}
