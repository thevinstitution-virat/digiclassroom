'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { loadYouTubeApi } from '@/lib/utils/youtube-api'
import { Loader2, AlertCircle } from 'lucide-react'

interface YouTubePlayerProps {
  videoId: string
  onTimeUpdate: (currentTime: number) => void
  onDurationKnown: (duration: number) => void
  onSeekReady: (seekFn: (seconds: number) => void) => void
}

/**
 * YouTube Player — uses the YouTube IFrame Player API.
 *
 * Notes:
 *   - The API script is loaded via a singleton loader (fix #5) to avoid
 *     global callback race conditions on fast re-mounts.
 *   - YouTube IFrame API does not have a `timeupdate` event like <video>,
 *     so we poll `getCurrentTime()` every 1 second via setInterval.
 *   - Chapters are shown only in the sidebar (ChapterList), not overlaid on
 *     YouTube's controls — the IFrame API doesn't expose the progress bar.
 */
export function YouTubePlayer({
  videoId,
  onTimeUpdate,
  onDurationKnown,
  onSeekReady,
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<any>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    let isMounted = true

    const initPlayer = () => {
      if (!containerRef.current || !isMounted) return

      // Create a fresh div for each player instance
      const playerDiv = document.createElement('div')
      playerDiv.id = `yt-player-${videoId}-${Date.now()}`
      containerRef.current.innerHTML = ''
      containerRef.current.appendChild(playerDiv)

      try {
        playerRef.current = new (window as any).YT.Player(playerDiv, {
          videoId,
          playerVars: {
            rel: 0,
            modestbranding: 1,
            iv_load_policy: 3,
            playsinline: 1,
          },
          events: {
            onReady: (e: any) => {
              if (!isMounted) return
              setIsLoading(false)
              const duration = e.target.getDuration()
              if (duration > 0) {
                onDurationKnown(Math.floor(duration))
              }

              // Expose seek function
              onSeekReady((seconds: number) => {
                playerRef.current?.seekTo(seconds, true)
                playerRef.current?.playVideo()
              })

              // Poll currentTime every 1 second
              intervalRef.current = setInterval(() => {
                const time = playerRef.current?.getCurrentTime?.() ?? 0
                onTimeUpdate(time)
              }, 1000)
            },
            onError: () => {
              if (!isMounted) return
              setIsLoading(false)
              setHasError(true)
            },
          },
        })
      } catch {
        setIsLoading(false)
        setHasError(true)
      }
    }

    loadYouTubeApi().then(initPlayer)

    return () => {
      isMounted = false
      if (intervalRef.current) clearInterval(intervalRef.current)
      try {
        playerRef.current?.destroy()
      } catch {
        // player may already be destroyed
      }
      playerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId])

  if (hasError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-red-400 gap-3">
        <AlertCircle className="w-12 h-12 text-red-500/80" />
        <p className="font-medium text-lg">Failed to load YouTube video</p>
        <p className="text-sm opacity-70">The video may be private or unavailable.</p>
      </div>
    )
  }

  return (
    <div className="w-full h-full relative bg-black">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-500" />
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  )
}
