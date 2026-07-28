'use client';

import React from 'react';
import { trpc } from '@/lib/trpc/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Layers, Users } from 'lucide-react';

export function TopContentList() {
  const { data, isLoading, error } = trpc.superAdminAnalytics.getTopContent.useQuery();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Content</CardTitle>
          <CardDescription>Most popular batches across all institutions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Content</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-red-600">Failed to load top content</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Content</CardTitle>
        <CardDescription>Most popular batches across all institutions</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            No enrollments found.
          </div>
        ) : (
          <div className="space-y-6">
            {data.map((batch, idx) => (
              <div key={batch.id} className="flex items-center justify-between">
                <div className="flex items-start gap-3 overflow-hidden">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-medium shrink-0">
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{batch.name}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Layers className="w-3 h-3" />
                      <span className="truncate">{batch.orgName || 'Global Platform'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 bg-muted px-2 py-1 rounded-md text-sm font-medium">
                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                  {batch.enrollmentCount}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
