/**
 * Citation Quality Dashboard — Phase 5.6
 * Admin-only server component that queries Langfuse for citation metrics.
 *
 * Uses BetterAuth (NOT Clerk)
  for session validation.
 * BetterAuth session pattern from src/lib/trpc/server.ts:
 *   auth.api.getSession({ headers: await headers() })
 */

import { auth } from '@/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { LANGFUSE_SCORES } from '@/lib/observability/constants';

// Langfuse is optional — dashboard gracefully degrades if not configured
let langfuseAvailable = true;
let Langfuse: any;
try {
    Langfuse = require('langfuse').Langfuse;
} catch {
    langfuseAvailable = false;
}

export default async function CitationQualityDashboard() {
    // ── Auth Guard (BetterAuth) ─────────────────────────────────
    let session: any = null;
    try {
        session = await auth.api.getSession({ headers: await headers() });
    } catch {
        redirect('/');
    }

    if (!session?.user || !['admin', 'teacher'].includes(session.user.role)) {
        redirect('/');
    }

    // ── Check Langfuse availability ──────────────────────────────
    if (
        !langfuseAvailable ||
        !process.env.LANGFUSE_PUBLIC_KEY ||
        !process.env.LANGFUSE_SECRET_KEY
    ) {
        return (
            <div className="p-8 max-w-4xl mx-auto">
                <h1 className="text-2xl font-bold mb-4">Citation Quality Dashboard</h1>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-yellow-800 font-medium">
                        Langfuse not configured
                    </p>
                    <p className="text-yellow-700 text-sm mt-1">
                        Set LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, and LANGFUSE_HOST
                        environment variables to enable citation metrics.
                    </p>
                </div>
            </div>
        );
    }

    // ── Fetch Langfuse data ──────────────────────────────────────
    const lf = new Langfuse({
        publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
        secretKey: process.env.LANGFUSE_SECRET_KEY!,
        baseUrl: process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
    });

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    let tracesData: any[] = [];
    let scoresData: any[] = [];

    try {
        const [tracesRes, scoresRes] = await Promise.all([
            lf.fetchTraces({ limit: 500, fromTimestamp: sevenDaysAgo }),
            lf.fetchScores({ limit: 2000 }),
        ]);
        tracesData = tracesRes?.data || [];
        scoresData = scoresRes?.data || [];
    } catch (err) {
        return (
            <div className="p-8 max-w-4xl mx-auto">
                <h1 className="text-2xl font-bold mb-4">Citation Quality Dashboard</h1>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-800 font-medium">Failed to fetch Langfuse data</p>
                    <p className="text-red-700 text-sm mt-1">
                        {(err as Error).message}
                    </p>
                </div>
            </div>
        );
    }

    // ── Compute metrics ──────────────────────────────────────────
    const precisionScores = scoresData.filter(
        (s: any) => s.name === LANGFUSE_SCORES.CITATION_PRECISION && s.value >= 0 // exclude -1 sentinel
    );

    const overallPrecision =
        precisionScores.length > 0
            ? precisionScores.reduce((sum: number, s: any) => sum + s.value, 0) /
            precisionScores.length
            : null;

    const confidenceScores = scoresData.filter(
        (s: any) => s.name === 'responseConfidence'
    );
    const avgConfidence =
        confidenceScores.length > 0
            ? confidenceScores.reduce((sum: number, s: any) => sum + s.value, 0) /
            confidenceScores.length
            : null;

    // Scope violation count (precision = -1 means refusal)
    const scopeViolations = scoresData.filter(
        (s: any) => s.name === LANGFUSE_SCORES.CITATION_PRECISION && s.value === -1
    ).length;
    const totalSessions = precisionScores.length + scopeViolations;
    const scopeViolationRate =
        totalSessions > 0 ? ((scopeViolations / totalSessions) * 100).toFixed(1) : '0';

    // Status color helper
    const precisionStatus =
        overallPrecision === null
            ? 'text-muted-foreground'
            : overallPrecision >= 0.95
                ? 'text-green-600'
                : overallPrecision >= 0.85
                    ? 'text-yellow-600'
                    : 'text-red-600';

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-foreground">Citation Quality Dashboard</h1>
                <p className="text-muted-foreground text-sm mt-1">
                    7-day window · {totalSessions} total sessions ·
                    Updated: {new Date().toLocaleString('en-IN')}
                </p>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                {/* Precision */}
                <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        NCERT Citation Precision
                    </p>
                    <p className={`text-3xl font-bold mt-2 ${precisionStatus}`}>
                        {overallPrecision !== null
                            ? `${(overallPrecision * 100).toFixed(1)}%`
                            : 'No data'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Target: ≥ 95%</p>
                </div>

                {/* Total Sessions */}
                <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Total Sessions
                    </p>
                    <p className="text-3xl font-bold mt-2 text-foreground">{totalSessions}</p>
                    <p className="text-xs text-muted-foreground mt-1">Last 7 days</p>
                </div>

                {/* Scope Violations */}
                <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Scope Violations
                    </p>
                    <p className="text-3xl font-bold mt-2 text-foreground">
                        {scopeViolationRate}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Expected: &lt; 5%</p>
                </div>

                {/* Avg Confidence */}
                <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Avg Confidence
                    </p>
                    <p className="text-3xl font-bold mt-2 text-foreground">
                        {avgConfidence !== null
                            ? `${(avgConfidence * 100).toFixed(0)}%`
                            : 'No data'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Response quality</p>
                </div>
            </div>

            {/* Recent Traces */}
            <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-foreground mb-4">Recent Sessions</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border">
                                <th className="text-left py-2 px-3 text-muted-foreground font-medium">
                                    Time
                                </th>
                                <th className="text-left py-2 px-3 text-muted-foreground font-medium">
                                    Session
                                </th>
                                <th className="text-left py-2 px-3 text-muted-foreground font-medium">
                                    Agent
                                </th>
                                <th className="text-right py-2 px-3 text-muted-foreground font-medium">
                                    Status
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {tracesData.slice(0, 20).map((trace: any) => (
                                <tr
                                    key={trace.id}
                                    className="border-b border-border hover:bg-muted/50"
                                >
                                    <td className="py-2 px-3 text-muted-foreground">
                                        {new Date(trace.timestamp).toLocaleString('en-IN', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            day: '2-digit',
                                            month: 'short',
                                        })}
                                    </td>
                                    <td className="py-2 px-3 text-foreground font-mono text-xs">
                                        {(trace.sessionId || trace.id)?.slice(0, 12)}...
                                    </td>
                                    <td className="py-2 px-3 text-foreground">
                                        {trace.name || 'unknown'}
                                    </td>
                                    <td className="py-2 px-3 text-right">
                                        <span
                                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${trace.level === 'ERROR'
                                                ? 'bg-red-100 text-red-700'
                                                : 'bg-green-100 text-green-700'
                                                }`}
                                        >
                                            {trace.level === 'ERROR' ? 'Error' : 'OK'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {tracesData.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                        No traces found in the last 7 days. Send some test queries to see data.
                    </p>
                )}
            </div>
        </div>
    );
}
