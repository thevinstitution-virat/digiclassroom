'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import Hls from 'hls.js'
import { formatSeconds } from '@/lib/utils/youtube'
import type { Chapter } from './ChapterList'
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, Loader2,
} from 'lucide-react'

interface BunnyHLSPlayerProps {
  hlsUrl: string
  chapters: Chapter[]
  duration: number
  onTimeUpdate: (currentTime: number) => void
  onDurationKnown: (duration: number) => void
  onSeekReady: (seekFn: (seconds: number) => void) => void
}

/**
 * Bunny HLS Player — uses hls.js with custom controls.
 *
 * Why custom controls:
 *   1. `controls={false}` prevents right-click → "Save video" on signed URLs (security)
 *   2. Chapter tick marks live natively in the custom progress bar (no cross-browser hacks)
 *   3. Full programmatic seek control for chapter clicking
 */
export function BunnyHLSPlayer({
  hlsUrl,
  chapters,
  duration: externalDuration,
  onTimeUpdate,
  onDurationKnown,
  onSeekReady,
}: BunnyHLSPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(externalDuration || 0)
  const [isLoading, setIsLoading] = useState(true)
  const [showControls, setShowControls] = useState(true)
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Attach HLS source
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      })
      hls.loadSource(hlsUrl)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false)
        if (video.duration && isFinite(video.duration)) {
          setDuration(Math.floor(video.duration))
          onDurationKnown(Math.floor(video.duration))
        }
      })
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.error('[BunnyHLS] Fatal error:', data.type, data.details)
          setIsLoading(false)
        }
      })
      hlsRef.current = hls
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      video.src = hlsUrl
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false)
        setDuration(Math.floor(video.duration))
        onDurationKnown(Math.floor(video.duration))
      })
    }

    // Expose seek function to parent
    onSeekReady((seconds: number) => {
      if (videoRef.current) {
        videoRef.current.currentTime = seconds
        videoRef.current.play()
        setIsPlaying(true)
      }
    })

    return () => {
      hlsRef.current?.destroy()
      hlsRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hlsUrl])

  // Time update listener
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const handler = () => {
      setCurrentTime(video.currentTime)
      onTimeUpdate(video.currentTime)
      // Update duration if it wasn't available during manifest parse
      if (duration === 0 && video.duration && isFinite(video.duration)) {
        setDuration(Math.floor(video.duration))
        onDurationKnown(Math.floor(video.duration))
      }
    }
    video.addEventListener('timeupdate', handler)
    video.addEventListener('ended', () => setIsPlaying(false))
    return () => {
      video.removeEventListener('timeupdate', handler)
    }
  }, [onTimeUpdate, duration, onDurationKnown])

  // Auto-hide controls after 3 seconds of no mouse movement
  const handleMouseMove = useCallback(() => {
    setShowControls(true)
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    hideTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false)
    }, 3000)
  }, [isPlaying])

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play()
      setIsPlaying(true)
    } else {
      video.pause()
      setIsPlaying(false)
    }
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setIsMuted(video.muted)
  }

  const toggleFullscreen = () => {
    if (!containerRef.current) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
      setIsFullscreen(false)
    } else {
      containerRef.current.requestFullscreen()
      setIsFullscreen(true)
    }
  }

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current
    if (!video || duration === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    video.currentTime = pct * duration
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black group cursor-pointer"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => { if (isPlaying) setShowControls(false) }}
      onClick={(e) => {
        // Only toggle play on direct video clicks (not on controls)
        if ((e.target as HTMLElement).tagName === 'VIDEO' || (e.target as HTMLElement).dataset.videoOverlay) {
          togglePlay()
        }
      }}
    >
      <video
        ref={videoRef}
        className="w-full h-full"
        playsInline
      />

      {/* Loading spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-500" />
        </div>
      )}

      {/* Click-to-play overlay */}
      <div data-video-overlay="true" className="absolute inset-0" />

      {/* Custom control bar */}
      <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pb-3 pt-10 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {/* Progress bar with chapter ticks */}
        <div
          className="w-full h-1.5 bg-white/20 rounded-full cursor-pointer mb-3 relative group/progress hover:h-2.5 transition-all"
          onClick={handleProgressClick}
        >
          {/* Played fill */}
          <div
            className="absolute top-0 left-0 h-full bg-indigo-500 rounded-full transition-[width] duration-100"
            style={{ width: `${progress}%` }}
          />
          {/* Chapter tick marks */}
          {chapters.map((ch) => (
            <div
              key={ch.id}
              className="absolute top-0 w-0.5 h-full bg-white/60 z-10 rounded"
              style={{ left: `${duration > 0 ? (ch.startSeconds / duration) * 100 : 0}%` }}
              title={ch.title}
            />
          ))}
          {/* Seek handle */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-indigo-400 rounded-full shadow-md opacity-0 group-hover/progress:opacity-100 transition-opacity"
            style={{ left: `${progress}%`, transform: `translateX(-50%) translateY(-50%)` }}
          />
        </div>

        {/* Control buttons */}
        <div className="flex items-center gap-3 text-white">
          <button onClick={togglePlay} className="hover:text-indigo-400 transition-colors">
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>

          <button onClick={toggleMute} className="hover:text-indigo-400 transition-colors">
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>

          <span className="text-xs font-mono text-white/80 select-none">
            {formatSeconds(Math.floor(currentTime))} / {formatSeconds(duration)}
          </span>

          <div className="flex-1" />

          <button onClick={toggleFullscreen} className="hover:text-indigo-400 transition-colors">
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  )
}
