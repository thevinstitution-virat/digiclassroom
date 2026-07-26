/**
 * RAG Quality Analytics API
 * 
 * GET /api/analytics/rag-quality?days=30
 * Returns RAGAS quality scores aggregated from chat_messages_history metadata.
 * 
 * Response: { summary, byAgent, trend }
 *   - summary: overall averages + sample size
 *   - byAgent: per-agent breakdown
 *   - trend: daily averages for time-series charting
 * 
 * Auth: withOrgContext, roles: admin | teacher
 */

import { withOrgContext, OrgRouteContext } from '@/lib/auth/with-org-context';
import { executeQuery } from '@/lib/db/connection';
import { safeJsonParse } from '@/lib/utils/jsonParse';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

type Metric = 'faithfulness' | 'answer_relevancy' | 'context_precision' | 'context_recall';
const METRICS: Metric[] = ['faithfulness', 'answer_relevancy', 'context_precision', 'context_recall'];

interface RagasRow {
  faithfulness: number | null;
  answer_relevancy: number | null;
  context_precision: number | null;
  context_recall: number | null;
  agentName: string | null;
  createdAt: Date;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Defensively extract RAGAS scores from metadata.
 * Handles: null, string JSON, already-parsed object, snake_case & camelCase keys.
 */
function readRagas(meta: unknown): Record<Metric, number | null> | null {
  if (!meta) return null;
  const m = safeJsonParse<Record<string, unknown>>(meta);
  if (!m) return null;

  // ragasScores may be stored under either key
  const r = (m.ragasScores ?? m.ragas_scores) as Record<string, number> | undefined;
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

/**
 * Compute average of non-null values for a given metric.
 */
function avgOf(rows: RagasRow[], key: Metric): number | null {
  const vals = rows.map((r) => r[key]).filter((v): v is number => typeof v === 'number');
  return vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(4) : null;
}

// ─── Route Handler ───────────────────────────────────────────────────────────

export const GET = withOrgContext(
  async (req: NextRequest, _ctx: any, _orgContext: OrgRouteContext) => {
    try {
      const url = new URL(req.url);
      const days = Math.min(Math.max(parseInt(url.searchParams.get('days') ?? '30', 10) || 30, 1), 180);
      const since = new Date(Date.now() - days * 86_400_000);

      // Query assistant messages with non-null metadata from the last N days.
      // Note: conversations table does not have organization_id — 
      // admin/teacher access is gated via withOrgContext role check above.
      const rows = await executeQuery(
        `SELECT cm.metadata, cm.timestamp as created_at
         FROM chat_messages_history cm
         JOIN conversations c ON cm.conversation_id = c.id
         WHERE cm.message_type = 'assistant'
           AND cm.metadata IS NOT NULL
           AND cm.timestamp >= ?
         ORDER BY cm.timestamp DESC`,
        [since]
      );

      // Parse and filter to only rows that contain ragasScores
      const parsed: RagasRow[] = [];
      for (const r of rows) {
        const ragas = readRagas(r.metadata);
        if (!ragas) continue;

        const meta = safeJsonParse<Record<string, unknown>>(r.metadata);
        parsed.push({
          ...ragas,
          agentName: (meta?.agentType as string) ?? (meta?.agentName as string) ?? null,
          createdAt: new Date(r.created_at),
        });
      }

      // ── Summary ──
      const summary = {
        sampleSize: parsed.length,
        ...Object.fromEntries(METRICS.map((m) => [m, avgOf(parsed, m)])),
      } as { sampleSize: number } & Record<Metric, number | null>;

      // ── By Agent ──
      const agentMap = new Map<string, RagasRow[]>();
      for (const p of parsed) {
        const k = p.agentName ?? 'unknown';
        if (!agentMap.has(k)) agentMap.set(k, []);
        agentMap.get(k)!.push(p);
      }
      const byAgent = [...agentMap.entries()].map(([agent, items]) => ({
        agent,
        count: items.length,
        ...Object.fromEntries(METRICS.map((m) => [m, avgOf(items, m)])),
      }));

      // ── Daily Trend ──
      const dayMap = new Map<string, RagasRow[]>();
      for (const p of parsed) {
        const k = p.createdAt.toISOString().slice(0, 10);
        if (!dayMap.has(k)) dayMap.set(k, []);
        dayMap.get(k)!.push(p);
      }
      const trend = [...dayMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, items]) => ({
          date,
          ...Object.fromEntries(METRICS.map((m) => [m, avgOf(items, m)])),
        }));

      return NextResponse.json({ summary, byAgent, trend });

    } catch (error) {
      logger.error('❌ [RAG Quality API] Failed to compute RAGAS analytics', undefined, error);
      return NextResponse.json(
        { error: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch RAG quality metrics' },
        { status: 500 }
      );
    }
  },
  { requireOrg: true, roles: ['admin', 'teacher'] }
);
