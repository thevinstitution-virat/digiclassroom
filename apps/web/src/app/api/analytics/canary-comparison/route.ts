/**
 * Canary Comparison Analytics API
 *
 * GET /api/analytics/canary-comparison?days=7
 *
 * Compares LLM provider performance (OpenAI vs Gemini) using metadata
 * stored in chat_messages_history by the telemetry-hardened save flow.
 *
 * Auth: withOrgContext, roles: admin
 */

import { withOrgContext, OrgRouteContext } from '@/lib/auth/with-org-context';
import { executeQuery } from '@/lib/db/connection';
import { safeJsonParse } from '@/lib/utils/jsonParse';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

type Metric = 'faithfulness' | 'answer_relevancy' | 'context_precision' | 'context_recall';
const METRICS: Metric[] = ['faithfulness', 'answer_relevancy', 'context_precision', 'context_recall'];

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return +(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(4);
}

function p50(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function p95(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor(s.length * 0.95)];
}

function readRagas(meta: Record<string, any>): Record<Metric, number | null> | null {
  const r = (meta.ragasScores ?? meta.ragas_scores) as Record<string, number> | undefined;
  if (!r || typeof r !== 'object') return null;
  const pick = (a: string, b: string): number | null =>
    typeof r[a] === 'number' ? r[a] : typeof r[b] === 'number' ? r[b] : null;
  return {
    faithfulness: pick('faithfulness', 'Faithfulness'),
    answer_relevancy: pick('answer_relevancy', 'answerRelevancy'),
    context_precision: pick('context_precision', 'contextPrecision'),
    context_recall: pick('context_recall', 'contextRecall'),
  };
}

function delta(a: number | null, b: number | null): number | null {
  if (a == null || b == null) return null;
  return +(b - a).toFixed(4);
}

export const GET = withOrgContext(
  async (req: NextRequest, _ctx: any, _orgContext: OrgRouteContext) => {
    try {
      const url = new URL(req.url);
      const days = Math.min(Math.max(parseInt(url.searchParams.get('days') ?? '7', 10) || 7, 1), 90);
      const since = new Date(Date.now() - days * 86_400_000);

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

      interface Row { provider: string; model: string; agentType: string; latencyMs: number | null; costUsd: number | null; ragas: Record<Metric, number | null> | null; date: string; }
      const parsed: Row[] = [];
      for (const r of rows) {
        const m = safeJsonParse<Record<string, any>>(r.metadata);
        if (!m) continue;
        parsed.push({
          provider: (m.llmProvider as string) || 'openai',
          model: (m.llmModel as string) || 'unknown',
          agentType: (m.agentType as string) || 'unknown',
          latencyMs: r.response_time_ms || (m.latencyMs as number) || null,
          costUsd: (m.estimatedCostUsd as number) || null,
          ragas: readRagas(m),
          date: new Date(r.created_at).toISOString().slice(0, 10),
        });
      }

      // Group by provider
      const provMap = new Map<string, Row[]>();
      for (const p of parsed) { if (!provMap.has(p.provider)) provMap.set(p.provider, []); provMap.get(p.provider)!.push(p); }

      const providers = [...provMap.entries()].map(([prov, items]) => {
        const ri = items.filter(i => i.ragas !== null);
        const lats = items.map(i => i.latencyMs).filter((v): v is number => v !== null);
        const costs = items.map(i => i.costUsd).filter((v): v is number => v !== null);
        return {
          provider: prov,
          totalRequests: items.length,
          ragas: { sampleSize: ri.length, ...Object.fromEntries(METRICS.map(m => [m, avg(ri.map(r => r.ragas![m]).filter((v): v is number => v !== null))])) } as { sampleSize: number; [k: string]: number | null },
          latency: { avg: avg(lats), p50: p50(lats), p95: p95(lats), sampleSize: lats.length },
          cost: { totalUsd: costs.length ? +costs.reduce((a, b) => a + b, 0).toFixed(6) : null, avgPerRequest: avg(costs), sampleSize: costs.length },
        };
      });

      // Daily trend
      const dayMap = new Map<string, Map<string, Row[]>>();
      for (const p of parsed) {
        if (!dayMap.has(p.date)) dayMap.set(p.date, new Map());
        const dm = dayMap.get(p.date)!;
        if (!dm.has(p.provider)) dm.set(p.provider, []);
        dm.get(p.provider)!.push(p);
      }
      const dailyTrend = [...dayMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, dm]) => {
        const byProv: Record<string, any> = {};
        for (const [prov, items] of dm.entries()) {
          const ri = items.filter(i => i.ragas !== null);
          const lats = items.map(i => i.latencyMs).filter((v): v is number => v !== null);
          byProv[prov] = { requests: items.length, faithfulness: avg(ri.map(r => r.ragas!.faithfulness).filter((v): v is number => v !== null)), latencyAvg: avg(lats) };
        }
        return { date, ...byProv };
      });

      // Decision gates
      const openai = providers.find(p => p.provider === 'openai');
      const google = providers.find(p => p.provider === 'google');
      let verdict: string = 'insufficient_data';
      if (openai && google && openai.ragas.sampleSize >= 10 && google.ragas.sampleSize >= 10) {
        const fd = delta(openai.ragas.faithfulness as number | null, google.ragas.faithfulness as number | null);
        if (fd != null && fd < -0.05) verdict = 'regressed';
        else if (fd != null && fd >= -0.05) {
          const cr = (google.cost.avgPerRequest ?? 1) / (openai.cost.avgPerRequest ?? 1);
          verdict = cr < 0.8 ? 'improved' : 'neutral';
        }
      }

      return NextResponse.json({
        windowDays: days,
        since: since.toISOString(),
        totalMessages: parsed.length,
        providers,
        dailyTrend,
        decisionGates: {
          hasBaseline: !!openai && openai.totalRequests >= 10,
          hasCanary: !!google && google.totalRequests >= 10,
          ragasDelta: openai && google ? { faithfulness: delta(openai.ragas.faithfulness as number | null, google.ragas.faithfulness as number | null) } : null,
          latencyDelta: openai?.latency.p50 != null && google?.latency.p50 != null ? { p50Ms: (google.latency.p50 ?? 0) - (openai.latency.p50 ?? 0) } : null,
          costRatio: openai?.cost.avgPerRequest && google?.cost.avgPerRequest && openai.cost.avgPerRequest > 0 ? +((google.cost.avgPerRequest ?? 0) / openai.cost.avgPerRequest).toFixed(2) : null,
          verdict,
        },
      });
    } catch (error) {
      logger.error('❌ [Canary Comparison API] Failed', undefined, error);
      return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
    }
  },
  { requireOrg: true, roles: ['admin'] }
);
