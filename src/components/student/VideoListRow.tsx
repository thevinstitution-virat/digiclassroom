import React from 'react';
import { Button } from '@/components/ui/button';
import { PlayCircle, CheckCircle2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface VideoWithProgress {
  id: string;
  title: string;
  provider: string;
  providerVideoId: string;
  thumbnailUrl: string | null;
  duration: number | null;
  bookTag: string | null;
  progress: {
    watchedSeconds: number;
    completed: boolean;
    lastWatchedAt: Date | null;
  } | null;
}

interface VideoListRowProps {
  video: VideoWithProgress;
  onWatch: (videoId: string) => void;
}

function formatDuration(seconds: number | null) {
  if (!seconds) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function VideoListRow({ video, onWatch }: VideoListRowProps) {
  const isCompleted = video.progress?.completed ?? false;
  const watchedSeconds = video.progress?.watchedSeconds ?? 0;
  const progressPercent = video.duration && video.duration > 0
    ? Math.min(100, (watchedSeconds / video.duration) * 100)
    : 0;

  return (
    <div className="flex items-center gap-4 p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors">
      <div className="relative h-16 w-28 bg-muted rounded overflow-hidden flex-shrink-0 flex items-center justify-center">
        {video.thumbnailUrl ? (
          <img src={video.thumbnailUrl} alt={video.title} className="object-cover w-full h-full" />
        ) : (
          <PlayCircle className="w-8 h-8 text-muted-foreground opacity-50" />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h4 className="font-medium text-base truncate">{video.title}</h4>
            <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
              <span>{formatDuration(video.duration)}</span>
              {isCompleted && (
                <span className="flex items-center text-green-600 dark:text-green-500 text-xs font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Completed
                </span>
              )}
            </div>
          </div>
          <Button size="sm" variant={isCompleted ? "secondary" : "default"} onClick={() => onWatch(video.id)}>
            {isCompleted ? 'Watch Again' : (watchedSeconds > 0 ? 'Resume' : 'Watch')}
          </Button>
        </div>
        
        {watchedSeconds > 0 && !isCompleted && (
          <div className="mt-3">
            <Progress value={progressPercent} className="h-1" />
          </div>
        )}
      </div>
    </div>
  );
}
