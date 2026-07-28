'use client';

import React, { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { StatCard } from './StatCard';
import { StudentProgressTable } from './StudentProgressTable';
import { BatchStatsTable } from './BatchStatsTable';
import { Users, BookOpen, Video, Percent } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function AnalyticsDashboard() {
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data: stats, isLoading: statsLoading } = trpc.institutionAdmin.getDashboardStats.useQuery();
  
  const { data: studentsData, isLoading: studentsLoading } = trpc.institutionAdmin.getStudentProgressList.useQuery({
    page,
    pageSize,
  });

  const { data: batchesData, isLoading: batchesLoading } = trpc.institutionAdmin.getBatchStats.useQuery();

  return (
    <div className="space-y-8 mt-8">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
        ) : stats ? (
          <>
            <StatCard label="Active Students" value={stats.activeStudents} icon={Users} />
            <StatCard label="Active Batches" value={stats.activeBatches} icon={BookOpen} />
            <StatCard label="Total Videos" value={stats.totalVideos} icon={Video} />
            <StatCard label="Avg Completion" value={`${stats.platformCompletionRate.toFixed(1)}%`} icon={Percent} />
          </>
        ) : null}
      </div>

      {/* Student Progress Table */}
      <StudentProgressTable
        data={studentsData?.students || []}
        total={studentsData?.total || 0}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        isLoading={studentsLoading}
      />

      {/* Batch Stats Table */}
      <BatchStatsTable
        data={batchesData || []}
        isLoading={batchesLoading}
      />
    </div>
  );
}
