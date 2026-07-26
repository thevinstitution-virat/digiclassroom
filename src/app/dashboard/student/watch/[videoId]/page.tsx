'use client';

import React, { useCallback, useRef, useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc/client';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle2, Award, Loader2 } from 'lucide-react';
import { BunnyPlayer } from '@/components/student/BunnyPlayer';
import { YouTubeEmbed } from '@/components/student/YouTubeEmbed';
import debounce from 'lodash/debounce';

export default function WatchPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const videoId = params.videoId as string;
  const batchId = searchParams.get('batchId');

  const utils = trpc.useUtils();
  
  // We fetch the batch content to get the video metadata (reusing the cache if warm)
  const { data, isLoading, error } = trpc.student.getBatchContent.useQuery(
    { batchId: batchId! },
    { enabled: !!batchId }
  );

  useEffect(() => {
    if (error) {
      toast.error('Access denied or batch not found');
      router.replace('/dashboard/student');
    }
  }, [error, router]);

  const video = data?.videos.find(v => v.id === videoId);
  const currentIndex = data?.videos.findIndex(v => v.id === videoId) ?? -1;
  const prevVideo = currentIndex > 0 ? data?.videos[currentIndex - 1] : null;
  const nextVideo = currentIndex !== -1 && currentIndex < (data?.videos.length ?? 0) - 1 ? data?.videos[currentIndex + 1] : null;

  const [localCompleted, setLocalCompleted] = useState(false);
  const [maxWatched, setMaxWatched] = useState(0);

  // Initialize local state from server state when data loads
  useEffect(() => {
    if (video?.progress) {
      setLocalCompleted(video.progress.completed);
      setMaxWatched(video.progress.watchedSeconds);
    }
  }, [video]);

  const upsertProgressMutation = trpc.student.upsertVideoProgress.useMutation({
    onSuccess: () => {
      // Opt to not aggressively invalidate to avoid jitter, but we could
      // utils.student.getBatchContent.invalidate({ batchId: batchId! });
    }
  });

  const claimCertificateMutation = trpc.student.claimBatchCertificate.useMutation({
    onSuccess: (cert) => {
      toast.success('Certificate claimed successfully!');
      router.push(`/dashboard/student/certificates/${cert.id}`);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to claim certificate');
    }
  });

  const logEvent = trpc.student.logLearningEvent.useMutation();
  const hasLoggedPlay = useRef(false);
  const hasLoggedComplete = useRef(false);

  const isBatchCompletedLocally = data?.videos && data.videos.length > 0 && data.videos.every(v => 
    v.id === videoId ? localCompleted : v.progress?.completed
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedUpsert = useCallback(
    debounce((seconds: number, isCompleted: boolean) => {
      if (!video) return;
      upsertProgressMutation.mutate({
        videoId: video.id,
        watchedSeconds: Math.floor(seconds),
        duration: video.duration || 1, // fallback to avoid div by zero on server
        completed: isCompleted
      });
    }, 2000, { maxWait: 10000 }),
    [video, upsertProgressMutation]
  );

  const handleProgress = useCallback((seconds: number) => {
    if (!video) return;
    
    if (!hasLoggedPlay.current) {
      hasLoggedPlay.current = true;
      logEvent.mutate({ batchId: batchId!, eventType: 'video_play', metadata: { videoId: video.id, position: seconds } });
    }

    const newMaxWatched = Math.max(maxWatched, seconds);
    if (newMaxWatched > maxWatched) {
      setMaxWatched(newMaxWatched);
    }

    // Auto-complete at 90%
    let isNowCompleted = localCompleted;
    if (!isNowCompleted && video.duration && newMaxWatched >= video.duration * 0.9) {
      isNowCompleted = true;
      setLocalCompleted(true);
      if (!hasLoggedComplete.current) {
        hasLoggedComplete.current = true;
        logEvent.mutate({ batchId: batchId!, eventType: 'video_complete', metadata: { videoId: video.id, watchedSeconds: newMaxWatched } });
      }
    }

    debouncedUpsert(newMaxWatched, isNowCompleted);
  }, [video, maxWatched, localCompleted, debouncedUpsert, batchId, logEvent]);

  const handleComplete = useCallback(() => {
    if (!video) return;
    setLocalCompleted(true);
    
    if (!hasLoggedComplete.current) {
      hasLoggedComplete.current = true;
      logEvent.mutate({ batchId: batchId!, eventType: 'video_complete', metadata: { videoId: video.id, watchedSeconds: Math.floor(video.duration || maxWatched) } });
    }

    // Flush any pending debounces and write immediately
    debouncedUpsert.cancel();
    upsertProgressMutation.mutate({
      videoId: video.id,
      watchedSeconds: Math.floor(video.duration || maxWatched),
      duration: video.duration || 1,
      completed: true
    });
  }, [video, maxWatched, debouncedUpsert, upsertProgressMutation, batchId, logEvent]);


  if (!batchId) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground mb-4">Invalid navigation. Missing batch context.</p>
        <Button onClick={() => router.push('/dashboard/student')}>Go to Dashboard</Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="w-full aspect-video rounded-lg" />
        <Skeleton className="h-10 w-2/3" />
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground mb-4">Video not found in this batch.</p>
        <Button onClick={() => router.push(`/dashboard/student/batch/${batchId}`)}>Back to Batch</Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Button 
          variant="ghost" 
          size="sm" 
          className="-ml-3 text-muted-foreground"
          onClick={() => router.push(`/dashboard/student/batch/${batchId}`)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {data?.batch.batchName}
        </Button>
        {localCompleted && (
          <span className="flex items-center text-green-600 dark:text-green-500 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            Completed
          </span>
        )}
      </div>

      {isBatchCompletedLocally && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center text-amber-800 dark:text-amber-200">
            <Award className="w-8 h-8 mr-3 text-amber-500" />
            <div>
              <h3 className="font-bold">Congratulations!</h3>
              <p className="text-sm">You have completed all videos in this batch.</p>
            </div>
          </div>
          <Button 
            className="bg-amber-600 hover:bg-amber-700 text-white whitespace-nowrap"
            onClick={() => claimCertificateMutation.mutate({ batchId: batchId! })}
            disabled={claimCertificateMutation.isPending}
          >
            {claimCertificateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Award className="w-4 h-4 mr-2" />}
            Claim Certificate
          </Button>
        </div>
      )}

      <div className="w-full">
        {video.provider === 'youtube' && video.providerVideoId ? (
          <YouTubeEmbed 
            url={`https://youtube.com/watch?v=${video.providerVideoId}`} 
            onProgress={handleProgress}
            onComplete={handleComplete}
          />
        ) : video.providerVideoId ? (
          <BunnyPlayer 
            providerVideoId={video.providerVideoId}
            onProgress={handleProgress}
            onComplete={handleComplete}
          />
        ) : (
          <div className="w-full aspect-video bg-muted flex items-center justify-center text-muted-foreground rounded-lg">
            Video source unavailable
          </div>
        )}
      </div>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pt-4">
        <div>
          <h1 className="text-2xl font-bold">{video.title}</h1>
          {video.bookTag && (
            <p className="text-muted-foreground mt-1">
              {video.bookTag}
              {video.duration ? ` · ${Math.round(video.duration / 60)} min` : ''}
            </p>
          )}
        </div>
        
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            disabled={!prevVideo}
            onClick={() => prevVideo && router.push(`/dashboard/student/watch/${prevVideo.id}?batchId=${batchId}`)}
          >
            ← Previous
          </Button>
          <Button 
            disabled={!nextVideo}
            onClick={() => nextVideo && router.push(`/dashboard/student/watch/${nextVideo.id}?batchId=${batchId}`)}
          >
            Next →
          </Button>
        </div>
      </div>
    </div>
  );
}
