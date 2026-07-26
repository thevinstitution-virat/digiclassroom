'use client';

import React, { useEffect, useState, useCallback } from 'react';

interface ProviderStats {
  provider: string;
  totalRequests: number;
  ragas: { sampleSize: number; faithfulness: number | null; answer_relevancy: number | null; context_precision: number | null; context_recall: number | null };
  latency: { avg: number | null; p50: number | null; p95: number | null; sampleSize: number };
  cost: { totalUsd: number | null; avgPerRequest: number | null; sampleSize: number };
}

interface DecisionGates {
  hasBaseline: boolean;
  hasCanary: boolean;
  ragasDelta: { faithfulness: number | null } | null;
  latencyDelta: { p50Ms: number } | null;
  costRatio: number | null;
  verdict: 'insufficient_data' | 'regressed' | 'neutral' | 'improved';
}

interface CanaryData {
  windowDays: number;
  totalMessages: number;
  providers: ProviderStats[];
  decisionGates: DecisionGates;
}

const VERDICT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  insufficient_data: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', label: '⏳ Insufficient Data' },
  regressed: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: '🔴 Regressed — Do NOT Promote' },
  neutral: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', label: '🟡 Neutral — Review Needed' },
  improved: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: '🟢 Improved — Safe to Promote' },
};

function MetricCard({ label, value, unit, delta }: { label: string; value: number | null; unit?: string; delta?: number | null }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900">
      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</div>
      <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
        {value != null ? `${value}${unit || ''}` : '—'}
      </div>
      {delta != null && (
        <div className={`text-xs mt-1 font-medium ${delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-gray-500'}`}>
          {delta > 0 ? '+' : ''}{delta.toFixed(4)} vs baseline
        </div>
      )}
    </div>
  );
}

function ProviderPanel({ stats, isCanary }: { stats: ProviderStats; isCanary?: boolean }) {
  const providerLabel = stats.provider === 'openai' ? 'OpenAI (GPT-4.1)' : stats.provider === 'google' ? 'Google (Gemini 2.5 Flash-Lite)' : stats.provider;
  return (
    <div className={`rounded-xl border-2 p-6 ${isCanary ? 'border-blue-400 dark:border-blue-600' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-900`}>
      <div className="flex items-center gap-2 mb-4">
        <span className={`w-3 h-3 rounded-full ${isCanary ? 'bg-blue-500' : 'bg-gray-400'}`} />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{providerLabel}</h3>
        {isCanary && <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">CANARY</span>}
      </div>
      <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">{stats.totalRequests} requests • {stats.ragas.sampleSize} with RAGAS</div>
      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="Faithfulness" value={stats.ragas.faithfulness} />
        <MetricCard label="Relevancy" value={stats.ragas.answer_relevancy} />
        <MetricCard label="Latency p50" value={stats.latency.p50} unit="ms" />
        <MetricCard label="Latency p95" value={stats.latency.p95} unit="ms" />
        <MetricCard label="Avg Cost/Req" value={stats.cost.avgPerRequest ? +stats.cost.avgPerRequest.toFixed(6) : null} unit=" USD" />
        <MetricCard label="Total Cost" value={stats.cost.totalUsd ? +stats.cost.totalUsd.toFixed(4) : null} unit=" USD" />
      </div>
    </div>
  );
}

export function CanaryComparisonDashboard() {
  const [data, setData] = useState<CanaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics/canary-comparison?days=${days}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>;
  if (error) return <div className="p-6 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl">Error: {error}</div>;
  if (!data) return null;

  const openai = data.providers.find(p => p.provider === 'openai');
  const google = data.providers.find(p => p.provider === 'google');
  const gates = data.decisionGates;
  const vs = VERDICT_STYLES[gates.verdict] || VERDICT_STYLES.insufficient_data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">🐤 Canary Comparison</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{data.totalMessages} messages over {data.windowDays} days</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={days} onChange={e => setDays(+e.target.value)} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm">
            <option value={3}>3 days</option>
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
          </select>
          <button onClick={fetchData} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Refresh</button>
        </div>
      </div>

      {/* Verdict banner */}
      <div className={`rounded-xl p-5 ${vs.bg}`}>
        <div className={`text-xl font-bold ${vs.text}`}>{vs.label}</div>
        <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
          <div><span className="text-gray-500 dark:text-gray-400">RAGAS Δ (faith):</span>{' '}<span className="font-mono font-bold">{gates.ragasDelta?.faithfulness?.toFixed(4) ?? '—'}</span></div>
          <div><span className="text-gray-500 dark:text-gray-400">Latency Δ (p50):</span>{' '}<span className="font-mono font-bold">{gates.latencyDelta?.p50Ms != null ? `${gates.latencyDelta.p50Ms > 0 ? '+' : ''}${gates.latencyDelta.p50Ms}ms` : '—'}</span></div>
          <div><span className="text-gray-500 dark:text-gray-400">Cost ratio:</span>{' '}<span className="font-mono font-bold">{gates.costRatio != null ? `${gates.costRatio}x` : '—'}</span></div>
        </div>
      </div>

      {/* Provider panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {openai && <ProviderPanel stats={openai} />}
        {google && <ProviderPanel stats={google} isCanary />}
        {!openai && !google && (
          <div className="col-span-2 text-center py-12 text-gray-500 dark:text-gray-400">
            No provider data available yet. Send some chat messages and check back.
          </div>
        )}
      </div>
    </div>
  );
}
