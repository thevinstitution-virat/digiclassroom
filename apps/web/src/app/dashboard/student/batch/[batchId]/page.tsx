'use client';

import React, { useMemo } from 'react';
import { trpc } from '@/lib/trpc/client';
import { VideoListRow } from '@/components/student/VideoListRow';
import { StudentBatchAnnouncements } from '@/components/student/StudentBatchAnnouncements';
import { useRouter, useParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BookOpen } from 'lucide-react';

export default function BatchContentPage() {
  const router = useRouter();
  const params = useParams();
  const batchId = params.batchId as string;

  const { data, isLoading, error } = trpc.student.getBatchContent.useQuery({ batchId });

  React.useEffect(() => {
    if (error) {
      if (error.data?.code === 'FORBIDDEN') {
        toast.error('Access denied to this batch');
      } else {
        toast.error('Could not load batch content');
      }
      router.replace('/dashboard/student');
    }
  }, [error, router]);

  const handleWatch = (videoId: string) => {
    router.push(`/dashboard/student/watch/${videoId}?batchId=${batchId}`);
  };

  // Group videos by bookTag
  const groupedVideos = useMemo(() => {
    if (!data?.videos) return [];
    
    const groups = new Map<string, typeof data.videos>();
    data.videos.forEach(video => {
      const tag = video.bookTag || 'General';
      if (!groups.has(tag)) groups.set(tag, []);
      groups.get(tag)!.push(video);
    });

    // Sort tags alphabetically, but ensure 'General' is first if it exists
    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === 'General') return -1;
      if (b === 'General') return 1;
      return a.localeCompare(b);
    });
  }, [data?.videos]);

  if (isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-8">
        <div className="space-y-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-10 w-2/3" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-8 w-1/4" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (error || !data) return null; // handled by onError

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="mb-4 -ml-3 text-muted-foreground"
          onClick={() => router.push('/dashboard/student')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          My Courses
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">{data.batch.batchName}</h1>
        <div className="flex items-center gap-2 mt-2 text-muted-foreground">
          <BookOpen className="w-4 h-4" />
          <span>{data.batch.domain.name} — {data.batch.course.name} — {data.batch.level.name}</span>
        </div>
      </div>

      <StudentBatchAnnouncements batchId={batchId} />

      {data.videos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border rounded-xl bg-muted/30">
          <p className="text-muted-foreground">No videos have been added to this course yet.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {groupedVideos.map(([bookTag, videos]) => {
            const completedCount = videos.filter(v => v.progress?.completed).length;
            
            return (
              <div key={bookTag} className="space-y-4">
                <div className="flex items-end justify-between pb-2 border-b">
                  <h3 className="text-xl font-semibold flex items-center gap-2">
                    {bookTag}
                  </h3>
                  <span className="text-sm font-medium text-muted-foreground">
                    {completedCount} / {videos.length} videos
                  </span>
                </div>
                
                <div className="flex flex-col gap-3">
                  {videos.map(video => (
                    <VideoListRow 
                      key={video.id} 
                      video={video} 
                      onWatch={handleWatch} 
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
