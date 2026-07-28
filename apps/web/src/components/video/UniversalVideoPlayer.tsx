// src/components/video/UniversalVideoPlayer.tsx
'use client';

import { useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/trpc/client';
import { BunnyHLSPlayer } from './BunnyHLSPlayer';
import { YouTubePlayer }  from './YouTubePlayer';
import type { VideoAssetForPlayer } from './types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  videoAsset: VideoAssetForPlayer;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function UniversalVideoPlayer({ videoAsset }: Props) {
  const isBunny   = videoAsset.provider === 'bunny';
  const isYouTube = videoAsset.provider === 'youtube';

  // ── Data fetching ────────────────────────────────────────────────────────────

  // Signed HLS URL — Bunny only. Disabled for YouTube (no unnecessary request).
  const {
    data:    embedData,
    isLoading: isEmbedLoading,
    error:   embedError,
  } = api.videoAssets.getVideoEmbed.useQuery(
    { videoId: videoAsset.id },
    { enabled: isBunny },
  );

  // Chapters — fetched for both providers
  const { data: chapters } = api.videoChapters.getByVideo.useQuery(
    { videoAssetId: videoAsset.id },
  );

  // Duration mutation — only fires the first time a video is played
  // (when durationSeconds is NULL in the DB). Safe to call conditionally
  // because the guard is inside the callback, not around the hook.
  const { mutate: updateDurationMutate } =
    api.videoAssets.updateDuration.useMutation();

  // Progress tracking mutation
  const { mutate: progressMutate } = api.videoProgress.upsert.useMutation();

  // ── Callbacks (stable — both wrapped in useCallback) ─────────────────────────

  const handleDurationLoaded = useCallback(
    (durationSeconds: number) => {
      // No-op if duration is already stored
      if (videoAsset.durationSeconds !== null) return;
      updateDurationMutate({ videoId: videoAsset.id, durationSeconds });
    },
    [videoAsset.id, videoAsset.durationSeconds, updateDurationMutate],
  );

  const handleProgressUpdate = useCallback(
    (currentSeconds: number, fraction: number) => {
      progressMutate({
        videoId: videoAsset.id,
        watchedSeconds: currentSeconds,
        completionPercentage: fraction * 100, // API expects 0-100
      });
    },
    [videoAsset.id, progressMutate],
  );

  // ── Bunny: loading / error states ────────────────────────────────────────────

  if (isBunny && isEmbedLoading) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-slate-800 bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (isBunny && (embedError || !embedData)) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 rounded-xl border border-slate-800 bg-slate-950 p-6 text-center text-red-500">
        <p className="max-w-md text-sm">Failed to load video.{embedError ? ` ${embedError.message}` : ''}</p>
      </div>
    );
  }

  // ── Bunny ────────────────────────────────────────────────────────────────────

  if (isBunny && embedData) {
    const hlsUrl = (embedData as { hlsUrl: string }).hlsUrl;

    if (!hlsUrl) {
      return (
        <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-slate-800 bg-slate-950 p-6 text-center text-red-500">
          <p className="text-sm">Embed data received but HLS URL field is missing. Check getVideoEmbed return shape.</p>
        </div>
      );
    }

    return (
      <BunnyHLSPlayer
        hlsUrl={hlsUrl}
        chapters={chapters}
        onDurationLoaded={handleDurationLoaded}
        onProgressUpdate={handleProgressUpdate}
      />
    );
  }

  // ── YouTube ───────────────────────────────────────────────────────────────────

  if (isYouTube) {
    return (
      <YouTubePlayer
        videoId={videoAsset.providerVideoId}
        chapters={chapters}
        onDurationLoaded={handleDurationLoaded}
        onProgressUpdate={handleProgressUpdate}
      />
    );
  }

  // ── Unknown provider ──────────────────────────────────────────────────────────

  return (
    <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-slate-800 bg-slate-950 p-6 text-center text-red-500">
      <p className="text-sm">Unsupported video provider: {videoAsset.provider}</p>
    </div>
  );
}
