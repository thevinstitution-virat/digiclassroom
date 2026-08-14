'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/auth/client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { BrainCircuit, Clock, Trophy, Target } from 'lucide-react';

interface ProgressMetrics {
    totalQueries: number;
    studyTimeMinutes: number;
    topicsMastered: number;
    averageConfidence: number;
    agentUsage: { name: string; count: number }[];
    weeklyActivity: { day: string; queries: number }[];
}

const GC = 'linear-gradient(135deg,var(--peacock-teal),var(--indigo-deep))';
const GP = 'linear-gradient(135deg,var(--kumkum),var(--saffron))';
const GW = 'linear-gradient(135deg,var(--turmeric),var(--gold))';
const GT = 'linear-gradient(135deg,var(--teal-light),var(--peacock-teal))';

/**
 * Learning-progress dashboard — presentation ported to the .dcs Indic mock.
 * Every metric stays real (fetched from /api/user/progress); the mock's demo
 * "achievements / subject mastery" panels are intentionally not fabricated here.
 */
export default function StudentProgressDashboard() {
    const { data: session } = useSession();
    const [metrics, setMetrics] = useState<ProgressMetrics | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!session?.user?.id) return;

        const fetchMetrics = async () => {
            try {
                const res = await fetch(`/api/user/progress?userId=${session.user.id}`);
                if (!res.ok)
  throw new Error('Failed to load progress data');
                const data = await res.json();
                setMetrics(data.metrics);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred');
            } finally {
                setIsLoading(false);
            }
        };

        fetchMetrics();
    }, [session?.user?.id]);

    if (isLoading) {
        return (
            <div className="dcs">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 16 }}>
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="card spin" style={{ height: 120, opacity: 0.4 }} />
                    ))}
                </div>
            </div>
        );
    }

    if (error || !metrics) {
        return (
            <div className="dcs">
                <div className="card" style={{ padding: 16, borderColor: 'rgb(192 57 43 / 0.3)', color: 'var(--kumkum)' }}>
                    Error loading progress dashboard: {error}
                </div>
            </div>
        );
    }

    const kpis = [
        { Icon: BrainCircuit, value: String(metrics.totalQueries), label: 'Total queries', hint: 'Questions asked to AI Tutor', grad: GC },
        { Icon: Clock, value: `${Math.round(metrics.studyTimeMinutes)} min`, label: 'Active study time', hint: 'Based on session duration', grad: GP },
        { Icon: Target, value: `${Math.round(metrics.averageConfidence * 100)}%`, label: 'Agent confidence', hint: 'Average AI response certainty', grad: GW },
        { Icon: Trophy, value: String(metrics.topicsMastered), label: 'Topics explored', hint: 'Distinct NCERT concepts', grad: GT },
    ];
    const maxAgent = Math.max(1, ...metrics.agentUsage.map(a => a.count));

    return (
        <div className="dcs">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* KPI stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 16 }}>
                    {kpis.map(({ Icon, value, label, hint, grad }) => (
                        <div key={label} className="card" style={{ padding: 20 }}>
                            <span className="plinth" style={{ width: 40, height: 40, background: grad }}>
                                <Icon className="h-5 w-5" />
                            </span>
                            <div style={{ fontSize: 26, fontWeight: 800, margin: '12px 0 2px', color: 'var(--ink)' }}>{value}</div>
                            <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>{label}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>{hint}</div>
                        </div>
                    ))}
                </div>

                <div className="two-col" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    {/* Weekly activity */}
                    <div className="card" style={{ padding: 22 }}>
                        <h3 className="sech" style={{ fontSize: 17 }}>Activity — last 7 days</h3>
                        <p style={{ margin: '2px 0 16px', fontSize: 13, color: 'var(--muted)' }}>Number of interactions per day</p>
                        <div style={{ height: 260 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={metrics.weeklyActivity}>
                                    <defs>
                                        <linearGradient id="dcs-activity" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="var(--saffron)" />
                                            <stop offset="100%" stopColor="var(--turmeric)" />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="day" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}`} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--ink)', boxShadow: 'var(--shadow-sm)' }}
                                        cursor={{ fill: 'rgb(var(--accent-primary-rgb) / 0.08)' }}
                                    />
                                    <Bar dataKey="queries" fill="url(#dcs-activity)" radius={[7, 7, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Agent usage */}
                    <div className="card" style={{ padding: 22 }}>
                        <h3 className="sech" style={{ fontSize: 17 }}>AI Tutor usage</h3>
                        <p style={{ margin: '2px 0 16px', fontSize: 13, color: 'var(--muted)' }}>Which specialised agents helped you most</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {metrics.agentUsage.map((agent) => (
                                <div key={agent.name}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13.5 }}>
                                        <span style={{ fontWeight: 700, color: 'var(--ink)', textTransform: 'capitalize' }}>{agent.name.replace(/_/g, ' ')}</span>
                                        <span style={{ color: 'var(--muted)' }}>{agent.count}</span>
                                    </div>
                                    <div style={{ height: 9, borderRadius: 999, background: 'var(--track)', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', borderRadius: 999, width: `${Math.max(5, (agent.count / maxAgent) * 100)}%`, background: 'linear-gradient(90deg,var(--teal-light),var(--peacock-teal))' }} />
                                    </div>
                                </div>
                            ))}
                            {metrics.agentUsage.length === 0 && (
                                <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0', fontStyle: 'italic' }}>
                                    No specialised agents used yet. Try asking the AI Tutor a specific subject question!
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
