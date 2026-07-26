'use client';

import { api } from '@/lib/trpc/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function StudentDetailAnalyticsPage({ params }: { params: { batchId: string, studentId: string } }) {
  const { data, isLoading } = api.institutionAdmin.getStudentDetail.useQuery({ batchId: params.batchId, studentId: params.studentId });

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!data) return <div>No data found.</div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/institution/analytics/${params.batchId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Student Details</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Video Completion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.videoProgress.map(v => (
              <div key={v.videoId} className="flex flex-col gap-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium truncate mr-2">{v.title}</span>
                  <span className="text-muted-foreground whitespace-nowrap">{v.completion.toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: `${v.completion}%` }} />
                </div>
              </div>
            ))}
            {data.videoProgress.length === 0 && <div className="text-sm text-muted-foreground">No video progress yet.</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quiz History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.quizHistory.map(q => (
                <div key={q.attemptId} className="flex justify-between items-center border-b pb-2 last:border-0">
                  <div className="flex flex-col">
                    <span className="font-medium">{q.quizTitle}</span>
                    <span className="text-xs text-muted-foreground">{q.completedAt ? new Date(q.completedAt).toLocaleDateString() : 'In Progress'}</span>
                  </div>
                  <div className="font-bold">{q.score.toFixed(1)}%</div>
                </div>
              ))}
              {data.quizHistory.length === 0 && <div className="text-sm text-muted-foreground">No quizzes taken yet.</div>}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Weekly Engagement Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {data.weeklyTrend.length > 0 ? (
              <div className="h-48 w-full flex items-end gap-2 border-b border-l p-4">
                {data.weeklyTrend.map((t, i) => (
                  <div key={i} className="flex-1 flex flex-col justify-end items-center group relative h-full">
                    <div 
                      className="w-full bg-blue-500/80 hover:bg-blue-600 rounded-t-sm transition-all" 
                      style={{ height: `${t.engagementScore}%` }}
                    />
                    <span className="text-xs mt-2 text-muted-foreground rotate-45 origin-left truncate w-8">
                      {new Date(t.weekOf).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                    <div className="absolute -top-8 bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
                      {t.engagementScore.toFixed(0)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Not enough data to show trends.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
