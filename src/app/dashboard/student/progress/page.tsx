'use client';

import React from 'react';
import { trpc } from '@/lib/trpc/client';
import { OverallProgressBar } from '@/components/student/OverallProgressBar';
import { BatchProgressCard } from '@/components/student/BatchProgressCard';
import { Skeleton } from '@/components/ui/skeleton';

export default function StudentProgressPage() {
  const { data, isLoading } = trpc.student.getProgressSummary.useQuery();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-2xl font-bold text-transparent">
        My Progress
      </h1>
      <p className="mt-2 text-gray-600 dark:text-gray-300">
        Track your learning journey across all your enrolled courses.
      </p>

      {/* Overall Progress */}
      <div className="mt-8 bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        {isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : data ? (
          <OverallProgressBar percentage={data.overallStats.avgCompletion} />
        ) : null}
        
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">Total Videos</span>
              <span className="text-xl font-semibold">{data.overallStats.videosWatched > 0 ? '—' : '0'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">Started</span>
              <span className="text-xl font-semibold text-blue-600">{data.overallStats.videosWatched}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">Completed</span>
              <span className="text-xl font-semibold text-green-600">{data.overallStats.completedVideos}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">Avg Completion</span>
              <span className="text-xl font-semibold">{data.overallStats.avgCompletion.toFixed(1)}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Batch Progress List */}
      <div className="mt-12">
        <h2 className="text-xl font-semibold mb-6">Course Breakdown</h2>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
        ) : data?.batches.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
            You are not enrolled in any active courses yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {data?.batches.map(batch => (
              <BatchProgressCard
                key={batch.batchId}
                batchId={batch.batchId}
                batchName={batch.batchName}
                courseName={batch.courseName}
                domainName={batch.domainName}
                stats={batch.stats}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
