'use client';

/**
 * RAG Quality Dashboard Component
 * 
 * Displays RAGAS quality scores with:
 * - Summary metric cards (color-coded by threshold)
 * - Daily trend line chart
 * - Per-agent breakdown bar chart
 * - Configurable time window (7d–180d)
 * 
 * Uses recharts for visualization (project dependency).
 */

import { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────────────────────

const METRICS = ['faithfulness', 'answer_relevancy', 'context_precision', 'context_recall'] as const;
type Metric = (typeof METRICS)[number];

const COLORS: Record<Metric, string> = {
  faithfulness: '#6366f1',
  answer_relevancy: '#10b981',
  context_precision: '#f59e0b',
  context_recall: '#ef4444',
};

const LABELS: Record<Metric, string> = {
  faithfulness: 'Faithfulness',
  answer_relevancy: 'Answer Relevancy',
  context_precision: 'Context Precision',
  context_recall: 'Context Recall',
};

type Summary = { sampleSize: number } & Record<Metric, number | null>;
type AgentRow = { agent: string; count: number } & Record<Metric, number | null>;
type TrendPoint = { date: string } & Record<Metric, number | null>;
type ApiResponse = { summary: Summary; byAgent: AgentRow[]; trend: TrendPoint[] };

// ─── Component ───────────────────────────────────────────────────────────────

export default function RagQualityDashboard() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/analytics/rag-quality?days=${days}`, { credentials: 'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d: ApiResponse = await r.json();
      setData(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Loading ──
  if (loading && !data) {
    return (
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-12 shadow-xl border border-white/20 dark:border-gray-700/20">
        <div className="flex items-center justify-center gap-3">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-600 dark:text-gray-400 text-lg">Loading RAG quality metrics…</span>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (err) {
    return (
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-12 shadow-xl border border-red-200/30 dark:border-red-700/20">
        <div className="text-center">
          <div className="text-red-500 text-xl font-semibold mb-2">Failed to load</div>
          <p className="text-gray-600 dark:text-gray-400">{err}</p>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl text-sm font-medium hover:shadow-lg transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Empty ──
  if (!data || data.summary.sampleSize === 0) {
    return (
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-12 shadow-xl border border-white/20 dark:border-gray-700/20">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-2xl flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">No RAGAS Data Yet</h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm max-w-md mx-auto">
            No RAGAS-scored conversations found in this time window. Scores are captured automatically during AI chat sessions.
          </p>
        </div>
      </div>
    );
  }

  // ── Dashboard ──
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            RAG Quality Metrics
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
            RAGAS evaluation scores — last {days} days
          </p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value, 10))}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-medium shadow-sm hover:shadow transition-all"
        >
          {[7, 14, 30, 60, 90, 180].map((d) => (
            <option key={d} value={d}>{d} days</option>
          ))}
        </select>
      </div>

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {METRICS.map((m, i) => {
          const gradients = [
            'from-indigo-50 to-purple-50 dark:from-indigo-950 dark:to-purple-950 border-indigo-200/30',
            'from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950 border-emerald-200/30',
            'from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 border-amber-200/30',
            'from-rose-50 to-red-50 dark:from-rose-950 dark:to-red-950 border-rose-200/30',
          ];
          const iconGradients = [
            'from-indigo-500 to-purple-500',
            'from-emerald-500 to-teal-500',
            'from-amber-500 to-orange-500',
            'from-rose-500 to-red-500',
          ];
          return (
            <MetricCard
              key={m}
              label={LABELS[m]}
              value={data.summary[m]}
              gradient={gradients[i]}
              iconGradient={iconGradients[i]}
              color={COLORS[m]}
            />
          );
        })}
      </div>
      <div className="text-sm text-gray-500 dark:text-gray-400 pl-1">
        Based on <strong>{data.summary.sampleSize.toLocaleString()}</strong> evaluated conversations
      </div>

      {/* Trend Chart */}
      {data.trend.length > 1 && (
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-white/20 dark:border-gray-700/20">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Daily Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(v: string) => v.slice(5)} /* MM-DD */
              />
              <YAxis domain={[0, 1]} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: any) => value !== null ? `${(Number(value) * 100).toFixed(1)}%` : '—'}
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid rgba(0,0,0,0.1)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}
              />
              <Legend />
              {METRICS.map((m) => (
                <Line
                  key={m}
                  dataKey={m}
                  name={LABELS[m]}
                  stroke={COLORS[m]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* By Agent Chart */}
      {data.byAgent.length > 0 && (
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-white/20 dark:border-gray-700/20">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">By Agent</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data.byAgent}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="agent"
                tick={{ fontSize: 12 }}
                tickFormatter={(v: string) => v.replace(/_/g, ' ')}
              />
              <YAxis domain={[0, 1]} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: any) => value !== null ? `${(Number(value) * 100).toFixed(1)}%` : '—'}
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid rgba(0,0,0,0.1)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}
              />
              <Legend />
              {METRICS.map((m) => (
                <Bar key={m} dataKey={m} name={LABELS[m]} fill={COLORS[m]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>

          {/* Agent Count Table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 font-medium">Agent</th>
                  <th className="py-2 font-medium text-right">Samples</th>
                  {METRICS.map((m) => (
                    <th key={m} className="py-2 font-medium text-right">{LABELS[m]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.byAgent.map((row) => (
                  <tr key={row.agent} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 font-medium text-gray-900 dark:text-gray-100">
                      {row.agent.replace(/_/g, ' ')}
                    </td>
                    <td className="py-2 text-right text-gray-600 dark:text-gray-400">{row.count}</td>
                    {METRICS.map((m) => (
                      <td key={m} className="py-2 text-right">
                        <ScoreBadge value={row[m]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  gradient,
  iconGradient,
  color,
}: {
  label: string;
  value: number | null;
  gradient: string;
  iconGradient: string;
  color: string;
}) {
  const pct = value !== null ? `${(value * 100).toFixed(1)}%` : '—';
  const tone =
    value === null ? 'text-gray-400'
    : value >= 0.8 ? 'text-emerald-600 dark:text-emerald-400'
    : value >= 0.6 ? 'text-amber-600 dark:text-amber-400'
    : 'text-rose-600 dark:text-rose-400';

  return (
    <div className={`p-5 bg-gradient-to-r ${gradient} rounded-2xl border hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02]`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-8 h-8 bg-gradient-to-r ${iconGradient} rounded-lg flex items-center justify-center shadow-sm`}>
          <div className="w-3 h-3 rounded-full bg-white/80" />
        </div>
        <span className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400">
          {label}
        </span>
      </div>
      <div className={`text-3xl font-bold ${tone}`}>{pct}</div>
    </div>
  );
}

function ScoreBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-gray-400">—</span>;

  const pct = (value * 100).toFixed(1);
  const cls =
    value >= 0.8 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    : value >= 0.6 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';

  return (
    <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-semibold ${cls}`}>
      {pct}%
    </span>
  );
}
