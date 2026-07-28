'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '@/lib/trpc/client'
import { BunnyHLSPlayer } from './BunnyHLSPlayer'
import { YouTubePlayer } from './YouTubePlayer'
import { ChapterList, type Chapter } from './ChapterList'
import { Loader2, AlertCircle } from 'lucide-react'

interface UniversalVideoPlayerProps {
  videoAssetId: string
  onProgressUpdate?: (watchedSeconds: number, completionPercentage: number) => void
}

/**
 * UniversalVideoPlayer — the single entry point for all video playback.
 *
 * Fetches embed data via `getVideoEmbed`, determines the provider, and
 * renders the correct sub-player (BunnyHLSPlayer or YouTubePlayer) with
 * a chapter sidebar.
 *
 * Progress tracking uses the existing Phase 5 `lastUpdateRef` timestamp-gating
 * pattern (fix #8) — only fires when timeupdate actually triggers AND
 * 15 seconds have elapsed since the last save. Never fires stale data.
 */
export function UniversalVideoPlayer({
  videoAssetId,
  onProgressUpdate,
}: UniversalVideoPlayerProps) {
  const { data: embedData, isLoading, error } = api.videoAssets.getVideoEmbed.useQuery(
    { videoId: videoAssetId },
    { enabled: !!videoAssetId }
  )

  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [activeChapterIdx, setActiveChapterIdx] = useState(0)
  const seekRef = useRef<((seconds: number) => void) | null>(null)
  const lastUpdateRef = useRef(0)

  // Update duration from YouTube player when server doesn't have it
  const updateDurationMutation = api.videoAssets.updateDuration.useMutation()

  // Active chapter calculation
  useEffect(() => {
    if (!embedData?.chapters?.length) return
    const idx = embedData.chapters.reduce(
      (found: number, ch: Chapter, i: number) =>
        currentTime >= ch.startSeconds ? i : found,
      0
    )
    setActiveChapterIdx(idx)
  }, [currentTime, embedData?.chapters])

  // Timestamp-gated progress debounce (fix #8 — no setTimeout, no stale data)
  const handleTimeUpdate = useCallback(
    (time: number) => {
      setCurrentTime(time)
      const now = Date.now()
      if (now - lastUpdateRef.current > 15000 && duration > 0) {
        const pct = Math.min((time / duration) * 100, 100)
        onProgressUpdate?.(Math.floor(time), pct)
        lastUpdateRef.current = now
      }
    },
    [duration, onProgressUpdate]
  )

  const handleDurationKnown = useCallback(
    (dur: number) => {
      setDuration(dur)
      // If YouTube and server had null duration, persist it
      if (
        embedData?.provider === 'youtube' &&
        embedData.durationSeconds === null &&
        dur > 0
      ) {
        updateDurationMutation.mutate({
          videoId: videoAssetId,
          durationSeconds: dur,
        })
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [embedData?.provider, embedData?.durationSeconds, videoAssetId]
  )

  const handleSeekReady = useCallback((seekFn: (seconds: number) => void) => {
    seekRef.current = seekFn
  }, [])

  const handleChapterClick = useCallback((startSeconds: number) => {
    seekRef.current?.(startSeconds)
  }, [])

  // Loading state
  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-950 rounded-lg">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
      </div>
    )
  }

  // Error state
  if (error || !embedData) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-red-400 gap-3 rounded-lg p-8">
        <AlertCircle className="w-12 h-12 text-red-500/80" />
        <p className="font-medium text-lg">Could not load video securely</p>
        <p className="text-sm opacity-70">{error?.message || 'Access denied'}</p>
      </div>
    )
  }

  const hasChapters = embedData.chapters && embedData.chapters.length > 0

  return (
    <div className="flex w-full h-full bg-slate-950 rounded-lg overflow-hidden">
      {/* Video player area */}
      <div className={`flex-1 relative ${hasChapters ? '' : 'w-full'}`}>
        {embedData.provider === 'bunny' && embedData.hlsUrl && (
          <BunnyHLSPlayer
            hlsUrl={embedData.hlsUrl}
            chapters={embedData.chapters ?? []}
            duration={embedData.durationSeconds ?? 0}
            onTimeUpdate={handleTimeUpdate}
            onDurationKnown={handleDurationKnown}
            onSeekReady={handleSeekReady}
          />
        )}
        {embedData.provider === 'youtube' && embedData.youtubeVideoId && (
          <YouTubePlayer
            videoId={embedData.youtubeVideoId}
            onTimeUpdate={handleTimeUpdate}
            onDurationKnown={handleDurationKnown}
            onSeekReady={handleSeekReady}
          />
        )}
      </div>

      {/* Chapter sidebar */}
      {hasChapters && (
        <div className="w-64 border-l border-slate-800 bg-white dark:bg-slate-950 flex-shrink-0 hidden md:flex flex-col">
          <ChapterList
            chapters={embedData.chapters!}
            activeChapterIdx={activeChapterIdx}
            currentTime={currentTime}
            onChapterClick={handleChapterClick}
          />
        </div>
      )}
    </div>
  )
}
