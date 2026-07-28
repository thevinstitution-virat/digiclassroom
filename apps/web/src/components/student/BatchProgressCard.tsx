'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, PlayCircle, CheckCircle } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { Skeleton } from '@/components/ui/skeleton';

interface BatchProgressCardProps {
  batchId: string;
  batchName: string;
  courseName: string;
  domainName: string;
  stats: {
    totalVideos: number;
    videosWatched: number;
    completedVideos: number;
    avgCompletion: number;
  };
}

export function BatchProgressCard({
  batchId,
  batchName,
  courseName,
  domainName,
  stats
}: BatchProgressCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Lazy-loaded query
  const { data: batchContent, isLoading } = trpc.student.getBatchContent.useQuery(
    { batchId },
    { enabled: expanded, staleTime: 5 * 60 * 1000 }
  );

  const toggleExpand = () => setExpanded(prev => !prev);

  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (stats.avgCompletion / 100) * circumference;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 bg-muted/20 border-b relative">
        <div className="absolute top-4 right-4 text-center">
          <svg width="80" height="80" className="rotate-[-90deg]">
            <circle
              cx="40"
              cy="40"
              r={radius}
              stroke="currentColor"
              strokeWidth="6"
              fill="transparent"
              className="text-muted"
            />
            <circle
              cx="40"
              cy="40"
              r={radius}
              stroke="currentColor"
              strokeWidth="6"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className={`${stats.avgCompletion >= 90 ? 'text-green-500' : 'text-blue-500'} transition-all duration-1000`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center font-bold text-sm">
            {Math.round(stats.avgCompletion)}%
          </div>
        </div>

        <div>
          <CardTitle className="text-xl pr-20">{batchName}</CardTitle>
          <div className="flex gap-2 mt-2">
            <Badge variant="outline">{domainName}</Badge>
            <Badge variant="secondary">{courseName}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="flex justify-between items-center text-sm mb-4">
          <div className="flex flex-col">
            <span className="text-muted-foreground">Videos Completed</span>
            <span className="font-medium">{stats.completedVideos} / {stats.totalVideos}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={toggleExpand}>
            {expanded ? (
              <><ChevronUp className="h-4 w-4 mr-1" /> Hide Details</>
            ) : (
              <><ChevronDown className="h-4 w-4 mr-1" /> View Details</>
            )}
          </Button>
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t space-y-3">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : batchContent?.videos.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-2">
                No videos available yet.
              </div>
            ) : (
              batchContent?.videos.map((video) => (
                <div key={video.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    {video.progress?.completed ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <PlayCircle className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span className="font-medium text-sm line-clamp-1">{video.title}</span>
                  </div>
                  <div className="text-xs font-mono">
                    {video.progress ? (
                      <span className={video.progress.completed ? 'text-green-600' : 'text-blue-600'}>
                        {video.progress.completed ? '100%' : 'Partial'}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0%</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
