// Percentile bootstrap confidence intervals, resampling ANSWERS (each answer with all of
// its points together), with a seeded generator so a report reproduces exactly. Pure.

/** mulberry32: small, fast, seedable; good enough for resampling. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Interval {
  estimate: number;
  lower: number;
  upper: number;
  /** Resamples whose statistic was NaN (e.g. QWK with no variation); excluded from the bounds. */
  undefinedResamples: number;
}

/**
 * `answers` are whole answers (any shape); `stat` computes the metric from a list of them.
 * B resamples with replacement, the same size as the input; percentile bounds at alpha/2.
 */
export function bootstrapCI<T>(answers: readonly T[], stat: (xs: readonly T[]) => number, opts: { B?: number; alpha?: number; seed?: number } = {}): Interval {
  const B = opts.B ?? 2000;
  const alpha = opts.alpha ?? 0.05;
  const rnd = seededRandom(opts.seed ?? 20261026);
  const estimate = stat(answers);
  const n = answers.length;
  if (n === 0) return { estimate: NaN, lower: NaN, upper: NaN, undefinedResamples: 0 };
  const values: number[] = [];
  let undef = 0;
  const sample = new Array<T>(n);
  for (let b = 0; b < B; b++) {
    for (let i = 0; i < n; i++) sample[i] = answers[Math.floor(rnd() * n)];
    const v = stat(sample);
    if (Number.isNaN(v)) undef++;
    else values.push(v);
  }
  values.sort((x, y) => x - y);
  const q = (p: number) => {
    if (!values.length) return NaN;
    const idx = Math.min(values.length - 1, Math.max(0, Math.floor(p * (values.length - 1))));
    return values[idx];
  };
  return { estimate, lower: q(alpha / 2), upper: q(1 - alpha / 2), undefinedResamples: undef };
}
