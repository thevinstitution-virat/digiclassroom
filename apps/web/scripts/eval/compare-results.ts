/**
 * RAG Regression Comparator
 *
 * Compares two baseline result files and outputs a markdown diff table.
 * Exits with code 1 if any metric regresses beyond thresholds.
 *
 * Usage:
 *   pnpm eval:compare -- --base results/baseline-2026-05-11.json --pr results/baseline-2026-05-12.json
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// ─── Types ────────────────────────────────────────────────────────────────────

interface QueryResult {
  queryId: string;
  bucket: string;
  query: string;
  retrievedChunkCount: number;
  topScore: number;
  retrievedChapters: string[];
  citationCount: number;
  responseLatencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  answer: string;
  keywordsFound: string[];
  keywordHitRate: number;
  retrievalMet: boolean;
  gradeLeakDetected: boolean;
  error?: string;
}

// ─── Regression Thresholds ────────────────────────────────────────────────────

const THRESHOLDS = {
  latency: 0.20,          // +20% max
  tokens: 0.15,           // +15% max
  keywordHitRate: -0.05,  // -5 percentage points max
  gradeLeaks: 0,          // Any increase fails
};

// ─── Argument Parsing ─────────────────────────────────────────────────────────

function parseArgs(): { basePath: string; prPath: string } {
  const args = process.argv.slice(2);
  let basePath = '';
  let prPath = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--base' && args[i + 1]) {
      basePath = args[++i];
    } else if (args[i] === '--pr' && args[i + 1]) {
      prPath = args[++i];
    }
  }

  if (!basePath || !prPath) {
    console.error('Usage: npx tsx scripts/eval/compare-results.ts --base <file> --pr <file>');
    process.exit(1);
  }

  return {
    basePath: resolve(process.cwd(), basePath),
    prPath: resolve(process.cwd(), prPath),
  };
}

// ─── Metrics Computation ──────────────────────────────────────────────────────

interface Metrics {
  totalQueries: number;
  successful: number;
  avgLatencyMs: number;
  avgTotalTokens: number;
  retrievalMetRate: number;
  avgKeywordHitRate: number;
  gradeLeaks: number;
}

function computeMetrics(results: QueryResult[]): Metrics {
  const successful = results.filter(r => !r.error);
  const total = results.length;

  return {
    totalQueries: total,
    successful: successful.length,
    avgLatencyMs: successful.length > 0
      ? Math.round(successful.reduce((s, r) => s + r.responseLatencyMs, 0) / successful.length)
      : 0,
    avgTotalTokens: successful.length > 0
      ? Math.round(successful.reduce((s, r) => s + r.totalTokens, 0) / successful.length)
      : 0,
    retrievalMetRate: successful.length > 0
      ? Math.round(successful.filter(r => r.retrievalMet).length / successful.length * 1000) / 1000
      : 0,
    avgKeywordHitRate: successful.length > 0
      ? Math.round(successful.reduce((s, r) => s + r.keywordHitRate, 0) / successful.length * 1000) / 1000
      : 0,
    gradeLeaks: successful.filter(r => r.gradeLeakDetected).length,
  };
}

// ─── Comparison ───────────────────────────────────────────────────────────────

function main() {
  const { basePath, prPath } = parseArgs();

  if (!existsSync(basePath)) {
    console.error(`❌ Base file not found: ${basePath}`);
    process.exit(1);
  }
  if (!existsSync(prPath)) {
    console.error(`❌ PR file not found: ${prPath}`);
    process.exit(1);
  }

  const baseResults: QueryResult[] = JSON.parse(readFileSync(basePath, 'utf-8'));
  const prResults: QueryResult[] = JSON.parse(readFileSync(prPath, 'utf-8'));

  const baseMetrics = computeMetrics(baseResults);
  const prMetrics = computeMetrics(prResults);

  // Compute deltas
  const latencyDelta = baseMetrics.avgLatencyMs > 0
    ? (prMetrics.avgLatencyMs - baseMetrics.avgLatencyMs) / baseMetrics.avgLatencyMs
    : 0;
  const tokensDelta = baseMetrics.avgTotalTokens > 0
    ? (prMetrics.avgTotalTokens - baseMetrics.avgTotalTokens) / baseMetrics.avgTotalTokens
    : 0;
  const kwdDelta = prMetrics.avgKeywordHitRate - baseMetrics.avgKeywordHitRate;
  const retrievalDelta = prMetrics.retrievalMetRate - baseMetrics.retrievalMetRate;
  const leakDelta = prMetrics.gradeLeaks - baseMetrics.gradeLeaks;

  // Status checks
  const latencyStatus = latencyDelta > THRESHOLDS.latency ? '❌ REGRESSED' : '✅ OK';
  const tokensStatus = tokensDelta > THRESHOLDS.tokens ? '❌ REGRESSED' : '✅ OK';
  const kwdStatus = kwdDelta < THRESHOLDS.keywordHitRate ? '❌ REGRESSED' : '✅ OK';
  const retrievalStatus = retrievalDelta < -0.05 ? '⚠️ DEGRADED' : '✅ OK';
  const leakStatus = leakDelta > THRESHOLDS.gradeLeaks ? '❌ REGRESSED' : '✅ OK';

  const anyRegression = [latencyStatus, tokensStatus, kwdStatus, leakStatus].some(s => s.includes('REGRESSED'));

  // Output markdown table
  console.log('\n## RAG Regression Comparison\n');
  console.log('| Metric | Base | PR | Delta | Status |');
  console.log('|--------|------|-----|-------|--------|');
  console.log(
    `| Avg Latency | ${baseMetrics.avgLatencyMs}ms | ${prMetrics.avgLatencyMs}ms | ${latencyDelta >= 0 ? '+' : ''}${(latencyDelta * 100).toFixed(1)}% | ${latencyStatus} |`
  );
  console.log(
    `| Avg Tokens | ${baseMetrics.avgTotalTokens} | ${prMetrics.avgTotalTokens} | ${tokensDelta >= 0 ? '+' : ''}${(tokensDelta * 100).toFixed(1)}% | ${tokensStatus} |`
  );
  console.log(
    `| Retrieval Met | ${(baseMetrics.retrievalMetRate * 100).toFixed(1)}% | ${(prMetrics.retrievalMetRate * 100).toFixed(1)}% | ${retrievalDelta >= 0 ? '+' : ''}${(retrievalDelta * 100).toFixed(1)}pp | ${retrievalStatus} |`
  );
  console.log(
    `| Keyword Hit | ${(baseMetrics.avgKeywordHitRate * 100).toFixed(1)}% | ${(prMetrics.avgKeywordHitRate * 100).toFixed(1)}% | ${kwdDelta >= 0 ? '+' : ''}${(kwdDelta * 100).toFixed(1)}pp | ${kwdStatus} |`
  );
  console.log(
    `| Grade Leaks | ${baseMetrics.gradeLeaks} | ${prMetrics.gradeLeaks} | ${leakDelta >= 0 ? '+' : ''}${leakDelta} | ${leakStatus} |`
  );

  console.log(`\n**Queries:** Base=${baseMetrics.totalQueries} (${baseMetrics.successful} ok), PR=${prMetrics.totalQueries} (${prMetrics.successful} ok)\n`);

  // Per-query regression details
  const regressed: string[] = [];
  for (const prResult of prResults) {
    const baseResult = baseResults.find(b => b.queryId === prResult.queryId);
    if (!baseResult) continue;

    // Check individual keyword regression
    if (baseResult.keywordHitRate > 0 && prResult.keywordHitRate < baseResult.keywordHitRate - 0.1) {
      regressed.push(
        `${prResult.queryId}: keyword hit ${(baseResult.keywordHitRate * 100).toFixed(0)}% → ${(prResult.keywordHitRate * 100).toFixed(0)}%`
      );
    }
  }

  if (regressed.length > 0) {
    console.log('### Per-Query Regressions\n');
    for (const r of regressed) {
      console.log(`- ${r}`);
    }
    console.log('');
  }

  if (anyRegression) {
    console.error('❌ REGRESSION DETECTED — PR should not be merged.\n');
    process.exit(1);
  } else {
    console.log('✅ No regressions detected.\n');
    process.exit(0);
  }
}

main();
