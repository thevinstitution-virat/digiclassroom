'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/core/ui/card';
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
            <div className="p-8 space-y-6 animate-pulse">
                <h1 className="text-3xl font-bold bg-gray-200 h-10 w-64 rounded"></h1>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map(i => (
                        <Card key={i} className="h-32 bg-gray-100 border-none"></Card>
                    ))}
                </div>
            </div>
        );
    }

    if (error || !metrics) {
        return (
            <div className="p-8">
                <div className="bg-red-50 text-red-600 p-4 rounded-lg">
                    Error loading progress dashboard: {error}
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Your Learning Journey</h1>
                <p className="text-gray-500 mt-2">Track your activity, agent usage, and subject mastery over time.</p>
            </div>

            {/* KPI Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Total Queries</CardTitle>
                        <BrainCircuit className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics.totalQueries}</div>
                        <p className="text-xs text-green-600 mt-1">Questions asked to AI Tutor</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Active Study Time</CardTitle>
                        <Clock className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{Math.round(metrics.studyTimeMinutes)} min</div>
                        <p className="text-xs text-gray-500 mt-1">Based on session duration</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Agent Confidence</CardTitle>
                        <Target className="h-4 w-4 text-indigo-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{Math.round(metrics.averageConfidence * 100)}%</div>
                        <p className="text-xs text-gray-500 mt-1">Average AI response certainty</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Topics Explored</CardTitle>
                        <Trophy className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics.topicsMastered}</div>
                        <p className="text-xs text-gray-500 mt-1">Distinct NCERT concepts</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Weekly Activity Chart */}
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Activity Last 7 Days</CardTitle>
                        <CardDescription>Number of interactions per day</CardDescription>
                    </CardHeader>
                    <CardContent className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={metrics.weeklyActivity}>
                                <XAxis dataKey="day" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}`} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                                />
                                <Bar dataKey="queries" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Agent Distribution */}
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>AI Tutor Usage</CardTitle>
                        <CardDescription>Which specialized agents helped you most</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {metrics.agentUsage.map((agent) => (
                                <div key={agent.name} className="flex items-center">
                                    <div className="w-1/3 flex-shrink-0">
                                        <span className="text-sm font-medium capitalize text-gray-700">
                                            {agent.name.replace(/_/g, ' ')}
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-2.5 mx-2">
                                        <div
                                            className="bg-blue-500 h-2.5 rounded-full"
                                            style={{
                                                width: `${Math.max(5, (agent.count / Math.max(...metrics.agentUsage.map(a => a.count))) * 100)}%`
                                            }}
                                        ></div>
                                    </div>
                                    <div className="w-10 text-right">
                                        <span className="text-sm text-gray-500 font-medium">{agent.count}</span>
                                    </div>
                                </div>
                            ))}

                            {metrics.agentUsage.length === 0 && (
                                <div className="text-center text-gray-500 py-8 italic">
                                    No specialized agents used yet. Try asking the AI Tutor a specific subject question!
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
