// Exact two-sided sign test (binomial, p = 0.5): of `n` changes beyond the natural range, `k` went the way the
// injected line asked. Under the hypothesis that the line has no effect, a change is as likely to go either way.

/** P(X = k) for X ~ Binomial(n, 0.5), by log-gamma-free recurrence (n is small here). */
function pmf(n: number, k: number): number {
  let c = 1;
  for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i;
  return c * 0.5 ** n;
}

/** Two-sided exact p-value. n = 0 (no changes at all) gives 1: there is nothing to test. */
export function signTest(k: number, n: number): number {
  if (n <= 0) return 1;
  if (k < 0 || k > n) throw new Error('k must be between 0 and n');
  const observed = pmf(n, k);
  let p = 0;
  for (let i = 0; i <= n; i++) {
    const q = pmf(n, i);
    if (q <= observed * (1 + 1e-9)) p += q;
  }
  return Math.min(1, p);
}
