'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

export default function MyAnalyticsPage() {
  const batchesQuery = api.student.getEnrolledBatches.useQuery();
  const activeBatches = batchesQuery.data?.filter(b => b.enrollmentStatus === 'active') || [];
  
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  
  const currentBatchId = selectedBatchId || (activeBatches.length > 0 ? activeBatches[0].batch.id : null);

  if (batchesQuery.isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl font-bold tracking-tight">My Performance</h1>
        {activeBatches.length > 0 && (
          <Select value={currentBatchId!} onValueChange={setSelectedBatchId}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Select batch" />
            </SelectTrigger>
            <SelectContent>
              {activeBatches.map(b => (
                <SelectItem key={b.batch.id} value={b.batch.id}>{b.batch.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {currentBatchId ? (
        <BatchAnalyticsView batchId={currentBatchId} />
      ) : (
        <Card><CardContent className="p-12 text-center text-muted-foreground">You are not actively enrolled in any batches.</CardContent></Card>
      )}

      <YearlyGrowthView />
    </div>
  );
}

function BatchAnalyticsView({ batchId }: { batchId: string }) {
  const analyticsQuery = api.student.getMyBatchAnalytics.useQuery({ batchId });
  const rankingQuery = api.student.getMyAnonymousRanking.useQuery({ batchId });
  const heatmapQuery = api.student.getMyActivityHeatmap.useQuery({ batchId });

  if (analyticsQuery.isLoading || rankingQuery.isLoading || heatmapQuery.isLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const { data: a } = analyticsQuery;

  // Heatmap rendering helpers
  const today = new Date();
  const days = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (27 - i));
    return d.toISOString().split('T')[0];
  });
  
  const heatmapMap = new Map(heatmapQuery.data?.map(d => [d.date, d.minutes]));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">My Rank</CardTitle></CardHeader>
          <CardContent>
            {a?.rankAvailable ? (
              <div className="text-2xl font-bold">#{a.myRank} <span className="text-lg font-normal text-muted-foreground">/ {a.totalStudents}</span></div>
            ) : (
              <div className="text-sm text-muted-foreground italic mt-2">Available after first week</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Completion</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{a?.myCompletion.toFixed(0)}%</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Quiz Avg</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{a?.myQuizAvg !== null ? `${a?.myQuizAvg.toFixed(1)}%` : '-'}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Streak</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{a?.myStreakDays} <span className="text-lg font-normal text-muted-foreground">days</span></div></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Anonymous Batch Ranking</CardTitle>
            <p className="text-xs text-muted-foreground italic mt-1">Other students shown anonymously — no identities are revealed.</p>
          </CardHeader>
          <CardContent>
            {rankingQuery.data && rankingQuery.data.length > 0 ? (
              <div className="h-48 flex items-end gap-[2px] w-full border-b mt-4">
                {rankingQuery.data.map((r, i) => (
                  <div key={i} className="flex-1 flex flex-col justify-end group relative h-full">
                    <div 
                      className={`w-full rounded-t-sm transition-all ${r.isYou ? 'bg-blue-500' : 'bg-muted'}`} 
                      style={{ height: `${r.score}%` }}
                    />
                    {r.isYou && <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded shadow-sm whitespace-nowrap z-10">You ({r.score.toFixed(0)})</div>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground italic py-8 text-center">Rankings will appear after the first week of class.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Study Activity Heatmap</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {days.map(d => {
                const mins = heatmapMap.get(d) || 0;
                let bgClass = 'bg-muted/50';
                if (mins > 0 && mins <= 30) bgClass = 'bg-blue-200 dark:bg-blue-900/50';
                else if (mins > 30 && mins <= 60) bgClass = 'bg-blue-400 dark:bg-blue-700/70';
                else if (mins > 60) bgClass = 'bg-blue-600 dark:bg-blue-500';
                
                return (
                  <div key={d} className="flex flex-col items-center">
                    <div className={`w-full aspect-square rounded-sm ${bgClass} group relative`}>
                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                        {mins} min on {new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function YearlyGrowthView() {
  const { data, isLoading } = api.student.getMyYearlyGrowth.useQuery();

  if (isLoading) return null;
  if (!data || data.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Yearly Growth</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map(y => (
            <div key={y.year} className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center border-b pb-4 last:border-0">
              <div className="text-xl font-bold text-muted-foreground">{y.year}</div>
              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                <div className="flex flex-col"><span className="text-xs text-muted-foreground">Study Time</span><span className="font-semibold">{y.totalMinutes} min</span></div>
                <div className="flex flex-col"><span className="text-xs text-muted-foreground">Courses</span><span className="font-semibold">{y.coursesCompleted} / {y.coursesEnrolled}</span></div>
                <div className="flex flex-col"><span className="text-xs text-muted-foreground">Quiz Avg</span><span className="font-semibold">{y.avgQuizScore !== null ? `${y.avgQuizScore.toFixed(1)}%` : '-'}</span></div>
                <div className="flex flex-col"><span className="text-xs text-muted-foreground">Certificates</span><span className="font-semibold">{y.certificatesEarned}</span></div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
