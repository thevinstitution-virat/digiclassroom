// Marking agreement, mutation and repeatability metrics (stage1-design.md §5.2). Pure.
// Marks are on a 0.5 grid from 0 to M.

export interface MarkPair {
  ai: number;
  ref: number;
}

const toCat = (x: number) => Math.round(x * 2);

/**
 * Quadratic weighted kappa on the 0.5-mark grid, k = 2M + 1 categories:
 *   QWK = 1 − Σ w_jl O_jl / Σ w_jl E_jl,  w_jl = (j − l)² / (k − 1)²
 * E is the outer product of the marginals scaled to N. Returns NaN when undefined
 * (fewer than 2 items, or both raters constant: no variation to agree about).
 */
export function qwk(pairs: readonly MarkPair[], maxMarks: number): number {
  const k = toCat(maxMarks) + 1;
  const n = pairs.length;
  if (n < 2 || k < 2) return NaN;
  const O = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const ra = new Array<number>(k).fill(0);
  const rb = new Array<number>(k).fill(0);
  for (const p of pairs) {
    const a = toCat(p.ai);
    const b = toCat(p.ref);
    if (a < 0 || b < 0 || a >= k || b >= k) throw new Error(`mark out of range 0..${maxMarks}: ai=${p.ai} ref=${p.ref}`);
    O[a][b]++;
    ra[a]++;
    rb[b]++;
  }
  let num = 0;
  let den = 0;
  for (let j = 0; j < k; j++) {
    for (let l = 0; l < k; l++) {
      const w = ((j - l) * (j - l)) / ((k - 1) * (k - 1));
      num += w * O[j][l];
      den += w * (ra[j] * rb[l]) / n;
    }
  }
  return den === 0 ? NaN : 1 - num / den;
}

export interface MarkingSummary {
  n: number;
  mae: number;
  normalisedMae: number;
  exact: number;
  withinOne: number;
  bias: number;
  largeErrorRate: number;
}

export function summariseMarking(pairs: readonly MarkPair[], maxMarks: number): MarkingSummary {
  const n = pairs.length;
  const mean = (f: (p: MarkPair) => number) => (n ? pairs.reduce((s, p) => s + f(p), 0) / n : NaN);
  const d = (p: MarkPair) => p.ai - p.ref;
  return {
    n,
    mae: mean((p) => Math.abs(d(p))),
    normalisedMae: mean((p) => Math.abs(d(p))) / maxMarks,
    exact: mean((p) => (d(p) === 0 ? 1 : 0)),
    withinOne: mean((p) => (Math.abs(d(p)) <= 1 ? 1 : 0)),
    bias: mean(d),
    largeErrorRate: mean((p) => (Math.abs(d(p)) > 1 || Math.abs(d(p)) > 0.2 * maxMarks ? 1 : 0)),
  };
}

export type Verdict = 'met' | 'partial' | 'missing';
const VERDICTS: Verdict[] = ['met', 'partial', 'missing'];

/** 3×3 counts: rows = reference verdict, columns = AI verdict. */
export function verdictConfusion(pairs: readonly { ref: Verdict; ai: Verdict }[]): Record<Verdict, Record<Verdict, number>> {
  const m = Object.fromEntries(VERDICTS.map((r) => [r, Object.fromEntries(VERDICTS.map((a) => [a, 0]))])) as Record<Verdict, Record<Verdict, number>>;
  for (const p of pairs) m[p.ref][p.ai]++;
  return m;
}

// ── Mutation tests ───────────────────────────────────────────────────────────

/** One mutated point: what the AI gave it, and what the rule says it should get. */
export interface MutatedPoint {
  aiPointMarks: number;
  expectedPointMarks: number;
  /** Marks the rule removed from this point (original − expected). */
  removed: number;
}

/** Share of mark-removing variants where the AI gave the affected point no more than expected. */
export function detectionRate(points: readonly MutatedPoint[]): number {
  const rel = points.filter((p) => p.removed > 0);
  return rel.length ? rel.filter((p) => p.aiPointMarks <= p.expectedPointMarks).length / rel.length : NaN;
}

/** Σ max(0, ai − expected) / Σ removed: marks given back for removed or wrong points. */
export function falseCreditRate(points: readonly MutatedPoint[]): number {
  const removed = points.reduce((s, p) => s + p.removed, 0);
  return removed ? points.reduce((s, p) => s + Math.max(0, p.aiPointMarks - p.expectedPointMarks), 0) / removed : NaN;
}

/** Harmless variants: content marks unchanged from the original answer (same configuration). */
export function invarianceRate(pairs: readonly { original: number; variant: number }[]): number {
  return pairs.length ? pairs.filter((p) => p.variant === p.original).length / pairs.length : NaN;
}

/** Injection variants: never more marks than the original. */
export function injectionResistance(pairs: readonly { original: number; variant: number }[]): number {
  return pairs.length ? pairs.filter((p) => p.variant <= p.original).length / pairs.length : NaN;
}

// ── Repeatability ────────────────────────────────────────────────────────────

/** runs[i][r] = total for item i in run r. */
export function allRunsIdentical(runs: readonly (readonly number[])[]): number {
  return runs.length ? runs.filter((r) => r.every((x) => x === r[0])).length / runs.length : NaN;
}

export function meanSpread(runs: readonly (readonly number[])[]): number {
  if (!runs.length) return NaN;
  const sd = (xs: readonly number[]) => {
    const m = xs.reduce((s, x) => s + x, 0) / xs.length;
    return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1 || 1));
  };
  return runs.reduce((s, r) => s + sd(r), 0) / runs.length;
}

/**
 * ICC(2,1): two-way random effects, absolute agreement, single rater (Shrout & Fleiss).
 *   ICC = (MSR − MSE) / (MSR + (k−1)MSE + k(MSC − MSE)/n)
 * n items (rows), k runs (columns).
 */
export function icc21(data: readonly (readonly number[])[]): number {
  const n = data.length;
  const k = n ? data[0].length : 0;
  if (n < 2 || k < 2 || data.some((r) => r.length !== k)) return NaN;
  const grand = data.flat().reduce((s, x) => s + x, 0) / (n * k);
  const rowMeans = data.map((r) => r.reduce((s, x) => s + x, 0) / k);
  const colMeans = Array.from({ length: k }, (_, j) => data.reduce((s, r) => s + r[j], 0) / n);
  const ssr = k * rowMeans.reduce((s, m) => s + (m - grand) ** 2, 0);
  const ssc = n * colMeans.reduce((s, m) => s + (m - grand) ** 2, 0);
  const sst = data.flat().reduce((s, x) => s + (x - grand) ** 2, 0);
  const sse = sst - ssr - ssc;
  const msr = ssr / (n - 1);
  const msc = ssc / (k - 1);
  const mse = sse / ((n - 1) * (k - 1));
  const den = msr + (k - 1) * mse + (k * (msc - mse)) / n;
  return den === 0 ? NaN : (msr - mse) / den;
}

// ── Teacher baseline: Krippendorff's alpha ──────────────────────────────────

/**
 * Krippendorff's alpha for numeric marks, with missing values allowed.
 * units[u] = the marks given to unit u by each coder (null = not marked by that coder).
 * metric 'interval': δ² = (c − k)²; 'ordinal': δ² from cumulative category frequencies.
 */
export function krippendorffAlpha(units: readonly (readonly (number | null)[])[], metric: 'interval' | 'ordinal' = 'ordinal'): number {
  const vals = units.map((u) => u.filter((x): x is number => x !== null)).filter((u) => u.length >= 2);
  const N = vals.reduce((s, u) => s + u.length, 0);
  if (N < 2) return NaN;
  const cats = [...new Set(vals.flat())].sort((a, b) => a - b);
  const n_c = new Map(cats.map((c) => [c, vals.flat().filter((x) => x === c).length]));
  const delta2 = (c: number, k: number): number => {
    if (metric === 'interval') return (c - k) ** 2;
    if (c === k) return 0;
    const [lo, hi] = c < k ? [c, k] : [k, c];
    let s = 0;
    for (const g of cats) if (g >= lo && g <= hi) s += n_c.get(g)!;
    s -= (n_c.get(lo)! + n_c.get(hi)!) / 2;
    return s * s;
  };
  // Observed disagreement within units.
  let Do = 0;
  for (const u of vals) {
    const m = u.length;
    let s = 0;
    for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) if (i !== j) s += delta2(u[i], u[j]);
    Do += s / (m - 1);
  }
  Do /= N;
  // Expected disagreement across all pairable values.
  let De = 0;
  for (const c of cats) for (const k of cats) if (c !== k) De += n_c.get(c)! * n_c.get(k)! * delta2(c, k);
  De /= N * (N - 1);
  return De === 0 ? NaN : 1 - Do / De;
}
