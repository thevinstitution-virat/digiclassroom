/**
 * Canary Baseline Snapshot
 *
 * Captures current OpenAI/GPT-4.1 performance metrics BEFORE flipping
 * ARCH_TWO_TIER_ROUTING. Output is written to docs/canary/baseline-{date}.json.
 *
 * Usage:
 *   npx tsx scripts/canary/baseline-snapshot.ts [--days 14]
 */

import { executeQuery } from '../../src/lib/db/connection';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeJson<T = any>(val: unknown): T | null {
  if (!val) return null;
  if (typeof val === 'object') return val as T;
  try { return JSON.parse(val as string); } catch { return null; }
}

type Metric = 'faithfulness' | 'answer_relevancy' | 'context_precision' | 'context_recall';
const METRICS: Metric[] = ['faithfulness', 'answer_relevancy', 'context_precision', 'context_recall'];

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return +(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(4);
}

function p50(nums: number[]): number | null {
  if (!nums.length) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function p95(nums: number[]): number | null {
  if (!nums.length) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.95)];
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const daysArg = process.argv.includes('--days')
    ? parseInt(process.argv[process.argv.indexOf('--days') + 1], 10)
    : 14;
  const days = Math.max(1, Math.min(daysArg, 90));
  const since = new Date(Date.now() - days * 86_400_000);

  console.log(`📊 Capturing baseline over last ${days} days (since ${since.toISOString().slice(0, 10)})`);

  // Query all assistant messages with metadata
  const rows: any[] = await executeQuery(
    `SELECT cm.metadata, cm.tokens_used, cm.response_time_ms, cm.timestamp as created_at
     FROM chat_messages_history cm
     JOIN conversations c ON cm.conversation_id = c.id
     WHERE cm.message_type = 'assistant'
       AND cm.metadata IS NOT NULL
       AND cm.timestamp >= ?
     ORDER BY cm.timestamp DESC`,
    [since]
  );

  console.log(`  → Found ${rows.length} assistant messages`);

  // Parse rows
  interface ParsedRow {
    provider: string;
    model: string;
    agentType: string;
    latencyMs: number | null;
    estimatedCostUsd: number | null;
    ragas: Record<Metric, number | null> | null;
    date: string;
  }

  const parsed: ParsedRow[] = [];
  for (const r of rows) {
    const m = safeJson<Record<string, any>>(r.metadata);
    if (!m) continue;

    // Extract RAGAS scores
    const ragasRaw = (m.ragasScores ?? m.ragas_scores) as Record<string, number> | undefined;
    let ragas: Record<Metric, number | null> | null = null;
    if (ragasRaw && typeof ragasRaw === 'object') {
      ragas = {
        faithfulness: ragasRaw.faithfulness ?? ragasRaw.Faithfulness ?? null,
        answer_relevancy: ragasRaw.answer_relevancy ?? ragasRaw.answerRelevancy ?? null,
        context_precision: ragasRaw.context_precision ?? ragasRaw.contextPrecision ?? null,
        context_recall: ragasRaw.context_recall ?? ragasRaw.contextRecall ?? null,
      };
    }

    parsed.push({
      provider: (m.llmProvider as string) || 'openai',
      model: (m.llmModel as string) || 'gpt-4.1-mini',
      agentType: (m.agentType as string) || 'unknown',
      latencyMs: r.response_time_ms || (m.latencyMs as number) || null,
      estimatedCostUsd: (m.estimatedCostUsd as number) || null,
      ragas,
      date: new Date(r.created_at).toISOString().slice(0, 10),
    });
  }

  // ── RAGAS summary ──
  const ragasRows = parsed.filter(p => p.ragas !== null);
  const ragasSummary: Record<string, number | null> = {};
  for (const metric of METRICS) {
    const vals = ragasRows.map(r => r.ragas![metric]).filter((v): v is number => v !== null);
    ragasSummary[metric] = avg(vals);
  }

  // ── Latency summary ──
  const latencies = parsed.map(p => p.latencyMs).filter((v): v is number => v !== null);
  const latencySummary = {
    avg: avg(latencies),
    p50: p50(latencies),
    p95: p95(latencies),
    sampleSize: latencies.length,
  };

  // ── Cost summary ──
  const costs = parsed.map(p => p.estimatedCostUsd).filter((v): v is number => v !== null);
  const costSummary = {
    totalUsd: costs.length ? +costs.reduce((a, b) => a + b, 0).toFixed(6) : null,
    avgPerRequest: avg(costs),
    sampleSize: costs.length,
  };

  // ── By Agent breakdown ──
  const agentMap = new Map<string, ParsedRow[]>();
  for (const p of parsed) {
    const k = p.agentType;
    if (!agentMap.has(k)) agentMap.set(k, []);
    agentMap.get(k)!.push(p);
  }
  const byAgent = [...agentMap.entries()].map(([agent, items]) => {
    const rItems = items.filter(i => i.ragas !== null);
    const lats = items.map(i => i.latencyMs).filter((v): v is number => v !== null);
    return {
      agent,
      count: items.length,
      ragas: Object.fromEntries(
        METRICS.map(m => [m, avg(rItems.map(r => r.ragas![m]).filter((v): v is number => v !== null))])
      ),
      latency: { avg: avg(lats), p50: p50(lats), p95: p95(lats) },
    };
  });

  // ── Daily trend ──
  const dayMap = new Map<string, ParsedRow[]>();
  for (const p of parsed) {
    if (!dayMap.has(p.date)) dayMap.set(p.date, []);
    dayMap.get(p.date)!.push(p);
  }
  const dailyTrend = [...dayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => {
      const rItems = items.filter(i => i.ragas !== null);
      const lats = items.map(i => i.latencyMs).filter((v): v is number => v !== null);
      return {
        date,
        requests: items.length,
        ragas: Object.fromEntries(
          METRICS.map(m => [m, avg(rItems.map(r => r.ragas![m]).filter((v): v is number => v !== null))])
        ),
        latency: { avg: avg(lats), p50: p50(lats) },
      };
    });

  // ── Assemble snapshot ──
  const snapshot = {
    capturedAt: new Date().toISOString(),
    windowDays: days,
    since: since.toISOString(),
    totalMessages: parsed.length,
    primaryProvider: 'openai',
    primaryModel: 'gpt-4.1-mini',
    ragas: { ...ragasSummary, sampleSize: ragasRows.length },
    latency: latencySummary,
    cost: costSummary,
    byAgent,
    dailyTrend,
  };

  // ── Write output ──
  const outDir = join(process.cwd(), 'docs', 'canary');
  mkdirSync(outDir, { recursive: true });

  const dateStr = new Date().toISOString().slice(0, 10);
  const outPath = join(outDir, `baseline-${dateStr}.json`);
  writeFileSync(outPath, JSON.stringify(snapshot, null, 2));

  console.log(`\n✅ Baseline snapshot written to: ${outPath}`);
  console.log(`   Total messages: ${parsed.length}`);
  console.log(`   RAGAS samples:  ${ragasRows.length}`);
  console.log(`   Latency p50:    ${latencySummary.p50 ?? 'N/A'}ms`);
  console.log(`   Latency p95:    ${latencySummary.p95 ?? 'N/A'}ms`);
  console.log(`   Avg cost/req:   $${costSummary.avgPerRequest ?? 'N/A'}`);

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Baseline snapshot failed:', err);
  process.exit(1);
});
