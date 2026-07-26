import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/index';
import { eq, sql, desc, gte } from 'drizzle-orm';
import { aiTutorUsage } from '@/db/schema';
import { Langfuse } from 'langfuse';

const langfuse = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_BASE_URL || 'https://us.langfuse.com',
});

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
        }

        // 1. Fetch data from DB: Total queries and weekly activity
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const dbStats = await db.select({
            totalCount: sql<number>`SUM(${aiTutorUsage.questionsAsked})`,
        }).from(aiTutorUsage)
            .where(eq(aiTutorUsage.userId, userId));

        const totalQueries = Number(dbStats[0]?.totalCount || 0);

        // Get daily distribution for chart
        const dailyStats = await db.select({
            dayStr: sql<string>`DATE(${aiTutorUsage.date})`,
            count: sql<number>`SUM(${aiTutorUsage.questionsAsked})`,
        }).from(aiTutorUsage)
            .where(gte(aiTutorUsage.date, sevenDaysAgo))
            .groupBy(sql`DATE(${aiTutorUsage.date})`)
            .orderBy(sql`DATE(${aiTutorUsage.date})`);

        // Pad last 7 days even if missing
        const weeklyMap = new Map();
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const str = d.toISOString().split('T')[0];
            const shortStr = str.substring(5); // MM-DD
            weeklyMap.set(str, { day: shortStr, queries: 0 });
        }

        dailyStats.forEach((stat: any) => {
            const day = stat.dayStr; // e.g. 2023-10-25
            if (weeklyMap.has(day)) {
                weeklyMap.get(day)!.queries = Number(stat.count);
            }
        });

        const weeklyActivity = Array.from(weeklyMap.values());

        // 2. Fetch rich analytics from Langfuse API via Metrics API or raw traces
        // For direct real-world usage we summarize latest traces associated with this user
        let agentUsageMap: Record<string, number> = {};
        let averageConfidence = 0.85; // Default fallback
        let studyTimeMinutes = totalQueries * 2.5; // Roughly 2.5 min per query average
        let topicsMastered = Math.floor(totalQueries / 10);

        try {
            if (process.env.LANGFUSE_SECRET_KEY) {
                // Fetch traces associated with the userId
                const userTraces = await langfuse.fetchTraces({
                    userId: userId,
                    page: 1,
                    limit: 100 // Sample size for recent stats
                });

                if (userTraces.data && userTraces.data.length > 0) {
                    let scoreSum = 0;
                    let scoreCount = 0;

                    userTraces.data.forEach(trace => {
                        // Count agent usage by tags or name (depending on Phase 5 tagging strategy)
                        const agentName = trace.tags?.find(t => t.startsWith('agent:'))?.replace('agent:', '') || 'general';
                        agentUsageMap[agentName] = (agentUsageMap[agentName] || 0) + 1;

                        // Average confidence if reported in metadata
                        const meta = trace.metadata as Record<string, unknown>;
                        if (meta?.confidenceScore) {
                            scoreSum += meta.confidenceScore as number;
                            scoreCount++;
                        }
                    });

                    if (scoreCount > 0) {
                        averageConfidence = scoreSum / scoreCount;
                    }
                }
            }
        } catch (lfError) {
            console.warn('Langfuse analytics fetch failed, relying on DB stats:', lfError);
        }

        // Format agent usage array
        const agentUsage = Object.entries(agentUsageMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

        return NextResponse.json({
            success: true,
            metrics: {
                totalQueries,
                studyTimeMinutes,
                topicsMastered,
                averageConfidence,
                weeklyActivity,
                agentUsage: agentUsage.length > 0 ? agentUsage : [{ name: 'general', count: totalQueries }]
            }
        });

    } catch (error) {
        console.error('Error fetching progress metrics:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
