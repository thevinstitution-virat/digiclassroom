// src/components/video/YouTubePlayer.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { loadYouTubeApi } from '@/lib/utils/youtube-api';
import { ChapterList } from './ChapterList';
import type { VideoChapter } from './types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  /** The YouTube video ID stored in providerVideoId. */
  videoId: string;
  chapters?: VideoChapter[];
  onProgressUpdate?: (currentSeconds: number, fraction: number) => void;
  onDurationLoaded?: (durationSeconds: number) => void;
};

// ─── YouTube error code map ───────────────────────────────────────────────────

const YT_ERROR_MESSAGES: Record<number, string> = {
  2:   'Invalid YouTube video ID.',
  5:   'YouTube HTML5 player error.',
  100: 'Video not found or set to private.',
  101: 'Video owner has disabled embedding.',
  150: 'Video owner has disabled embedding.',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function YouTubePlayer({
  videoId,
  chapters = [],
  onProgressUpdate,
  onDurationLoaded,
}: Props) {
  const playerDivRef       = useRef<HTMLDivElement>(null);
  const playerRef          = useRef<any>(null);
  const lastUpdateRef      = useRef(0);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [currentTime,  setCurrentTime]  = useState(0);
  const [playerError,  setPlayerError]  = useState<string | null>(null);

  // ── Progress Polling ─────────────────────────────────────────────────────────
  // YouTube's IFrame API has no timeupdate event; we poll on a 1 s interval
  // instead. The lastUpdateRef pattern (fix #8) ensures we only write progress
  // while the video is actually playing, not after pause/seek.

  const stopPolling = useCallback(() => {
    if (!progressIntervalRef.current) return;
    clearInterval(progressIntervalRef.current);
    progressIntervalRef.current = null;
  }, []);

  const startPolling = useCallback(() => {
    if (progressIntervalRef.current) return;
    progressIntervalRef.current = setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      try {
        const t = player.getCurrentTime() ?? 0;
        const d = player.getDuration() ?? 0;
        setCurrentTime(t);
        const now = Date.now();
        if (now - lastUpdateRef.current > 15_000 && d > 0) {
          onProgressUpdate?.(Math.floor(t), t / d);
          lastUpdateRef.current = now;
        }
      } catch {
        // Player in a transient state — ignore
      }
    }, 1_000);
  }, [onProgressUpdate]);

  // ── Player Init (fix #5 — singleton API loader) ───────────────────────────────

  useEffect(() => {
    let destroyed = false;

    loadYouTubeApi()
      .then(() => {
        // Guard against strict-mode double-invoke and videoId change races
        if (destroyed || !playerDivRef.current || playerRef.current) return;

        playerRef.current = new (window as any).YT.Player(playerDivRef.current, {
          videoId,
          playerVars: {
            autoplay:       0,
            modestbranding: 1,
            rel:            0,
            enablejsapi:    1,
          },
          events: {
            onReady: (e: any) => {
              const d = e.target.getDuration();
              if (isFinite(d) && d > 0) {
                onDurationLoaded?.(Math.floor(d));
              }
            },
            onStateChange: (e: any) => {
              if (e.data === (window as any).YT.PlayerState.PLAYING) startPolling();
              else stopPolling();
            },
            onError: (e: any) => {
              stopPolling();
              setPlayerError(
                YT_ERROR_MESSAGES[e.data] ?? `YouTube error (code ${e.data}).`,
              );
            },
          },
        });
      })
      .catch(() => {
        if (!destroyed) {
          setPlayerError(
            'Failed to load YouTube player. Check your internet connection.',
          );
        }
      });

    return () => {
      destroyed = true;
      stopPolling();
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch { /* ignore */ }
        playerRef.current = null;
      }
    };
  // Re-initialize when the video changes. startPolling/stopPolling are stable
  // (useCallback with stable deps), so they don't cause unwanted re-runs.
  }, [videoId, onDurationLoaded, startPolling, stopPolling]);

  // ── Chapter Seek ─────────────────────────────────────────────────────────────

  const handleChapterClick = useCallback((startSeconds: number) => {
    const player = playerRef.current;
    if (!player) return;
    try {
      player.seekTo(startSeconds, true);
      player.playVideo();
    } catch { /* ignore transient state */ }
  }, []);

  // ── Error State ───────────────────────────────────────────────────────────────

  if (playerError) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 bg-slate-950 p-6 text-center text-red-500">
        <AlertTriangle className="h-10 w-10" />
        <p className="max-w-md text-sm">{playerError}</p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="group relative flex w-full flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-2xl lg:flex-row">
      <div className="flex flex-1 flex-col relative lg:flex-row">

        {/* YouTube iframe target — the IFrame API replaces this div with an iframe */}
        <div className="relative flex-1 bg-black aspect-video">
          <div ref={playerDivRef} className="absolute inset-0 w-full h-full" />
        </div>

        {/* Chapter sidebar — chapter overlay on YouTube's iframe is impossible,
            so chapters are sidebar-only for YouTube (fix #7). */}
        {chapters.length > 0 && (
          <div className="lg:w-72 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-800">
            <ChapterList chapters={chapters} currentTimeSeconds={currentTime} onChapterClick={handleChapterClick} />
          </div>
        )}
      </div>
    </div>
  );
}
