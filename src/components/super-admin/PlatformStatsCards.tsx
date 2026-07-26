'use client';

import React from 'react';
import { StatCard } from '@/components/institution/StatCard';
import { Building2, Users, Layers, Video } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { Skeleton } from '@/components/ui/skeleton';

export function PlatformStatsCards() {
  const { data, isLoading, error } = trpc.superAdminAnalytics.getPlatformStats.useQuery();

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-32 border rounded-xl bg-card p-6 flex flex-col justify-between">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </div>
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 border border-red-200 bg-red-50 text-red-600 rounded-lg">
        Failed to load platform stats
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Total Institutions"
        value={data.totalInstitutions.toLocaleString()}
        icon={Building2}
      />
      <StatCard
        label="Total Students"
        value={data.totalStudents.toLocaleString()}
        icon={Users}
      />
      <StatCard
        label="Active Batches"
        value={data.totalBatches.toLocaleString()}
        icon={Layers}
      />
      <StatCard
        label="Video Assets"
        value={data.totalVideos.toLocaleString()}
        icon={Video}
      />
    </div>
  );
}
