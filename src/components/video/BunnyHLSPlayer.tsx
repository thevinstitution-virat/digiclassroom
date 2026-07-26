// src/components/video/BunnyHLSPlayer.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  AlertTriangle,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ChapterList } from './ChapterList';
import type { VideoChapter } from './types';

// ─── Helper ───────────────────────────────────────────────────────────────────

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  /** Signed Bunny Stream HLS URL from getVideoEmbed tRPC procedure. */
  hlsUrl: string;
  chapters?: VideoChapter[];
  onProgressUpdate?: (currentSeconds: number, fraction: number) => void;
  onDurationLoaded?: (durationSeconds: number) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function BunnyHLSPlayer({
  hlsUrl,
  chapters = [],
  onProgressUpdate,
  onDurationLoaded,
}: Props) {
  // ── Refs (mutable values that don't trigger re-renders) ─────────────────────
  const containerRef    = useRef<HTMLDivElement>(null);
  const videoRef        = useRef<HTMLVideoElement>(null);
  const hlsRef          = useRef<Hls | null>(null);
  const progressBarRef  = useRef<HTMLDivElement>(null);
  const lastUpdateRef   = useRef(0);
  const isDraggingRef   = useRef(false);

  // ── State ────────────────────────────────────────────────────────────────────
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [currentTime,  setCurrentTime]  = useState(0);
  const [duration,     setDuration]     = useState(0);
  const [volume,       setVolume]       = useState(1);
  const [isMuted,      setIsMuted]      = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBuffering,  setIsBuffering]  = useState(true);
  const [playerError,  setPlayerError]  = useState<string | null>(null);

  // ── HLS Setup ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hlsUrl) return;

    setPlayerError(null);
    setIsBuffering(true);
    setCurrentTime(0);
    setDuration(0);

    if (Hls.isSupported()) {
      const hls = new Hls({ startLevel: -1 }); // auto quality selection
      hlsRef.current = hls;

      hls.loadSource(hlsUrl);
      hls.attachMedia(video);

      // ── 403 Detection (fix #4) ─────────────────────────────────────────────
      // This is the first real-world test of Approach A signing.
      // A 403 here means the signing formula or key is wrong — fix in getVideoEmbed.
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;

        if (
          data.type === Hls.ErrorTypes.NETWORK_ERROR &&
          (data as { response?: { code?: number } }).response?.code === 403
        ) {
          setPlayerError(
            'Playback blocked (403): Bunny CDN rejected the signed token. ' +
            'Verify BUNNY_STREAM_SECURITY_KEY and the signing formula in getVideoEmbed.',
          );
          hls.destroy();
          return;
        }

        // Non-403 network error: attempt recovery
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad();
          return;
        }

        // Media error: attempt recovery
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
          return;
        }

        setPlayerError('A fatal playback error occurred. Try refreshing the page.');
      });

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    }

    // ── Safari native HLS fallback ─────────────────────────────────────────────
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl;
      return;
    }

    setPlayerError('HLS playback is not supported in this browser.');
  }, [hlsUrl]);

  // ── Video Event Listeners ────────────────────────────────────────────────────

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay         = () => setIsPlaying(true);
    const onPause        = () => setIsPlaying(false);
    const onEnded        = () => setIsPlaying(false);
    const onWaiting      = () => setIsBuffering(true);
    const onCanPlay      = () => setIsBuffering(false);
    const onVolumeChange = () => { setVolume(video.volume); setIsMuted(video.muted); };

    const onDurationChange = () => {
      if (isFinite(video.duration) && video.duration > 0) {
        setDuration(video.duration);
        onDurationLoaded?.(Math.floor(video.duration));
      }
    };

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      // lastUpdateRef pattern (fix #8) — only fires when video is actually playing.
      // setTimeout would fire stale data after pause; this pattern does not.
      const now = Date.now();
      if (now - lastUpdateRef.current > 15_000) {
        const fraction = video.duration > 0 ? video.currentTime / video.duration : 0;
        onProgressUpdate?.(Math.floor(video.currentTime), fraction);
        lastUpdateRef.current = now;
      }
    };

    video.addEventListener('play',           onPlay);
    video.addEventListener('pause',          onPause);
    video.addEventListener('ended',          onEnded);
    video.addEventListener('waiting',        onWaiting);
    video.addEventListener('canplay',        onCanPlay);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('timeupdate',     onTimeUpdate);
    video.addEventListener('volumechange',   onVolumeChange);

    return () => {
      video.removeEventListener('play',           onPlay);
      video.removeEventListener('pause',          onPause);
      video.removeEventListener('ended',          onEnded);
      video.removeEventListener('waiting',        onWaiting);
      video.removeEventListener('canplay',        onCanPlay);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('timeupdate',     onTimeUpdate);
      video.removeEventListener('volumechange',   onVolumeChange);
    };
  }, [onDurationLoaded, onProgressUpdate]);

  // ── Fullscreen Listener ──────────────────────────────────────────────────────

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // ── Control Handlers ─────────────────────────────────────────────────────────

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  }, []);

  const seekToFraction = useCallback((fraction: number) => {
    const video = videoRef.current;
    if (!video || !isFinite(video.duration)) return;
    video.currentTime = Math.max(0, Math.min(1, fraction)) * video.duration;
  }, []);

  const handleChapterClick = useCallback((startSeconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = startSeconds;
    void video.play();
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (video) video.muted = !video.muted;
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const v = parseFloat(e.target.value);
    video.volume = v;
    video.muted = v === 0;
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) void containerRef.current?.requestFullscreen();
    else void document.exitFullscreen();
  }, []);

  // ── Progress Bar — Click & Drag ───────────────────────────────────────────────

  const getFractionFromEvent = (e: MouseEvent | React.MouseEvent): number => {
    const bar = progressBarRef.current;
    if (!bar) return 0;
    const { left, width } = bar.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - left) / width));
  };

  const handleProgressMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    seekToFraction(getFractionFromEvent(e));

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      seekToFraction(getFractionFromEvent(ev));
    };
    const onMouseUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup',   onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onMouseUp);
  };

  // ── Derived ───────────────────────────────────────────────────────────────────

  const playbackPct = duration > 0 ? (currentTime / duration) * 100 : 0;

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
    <div ref={containerRef} className="group relative flex w-full flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-2xl lg:flex-row">

      {/* ── Video + Chapter sidebar ── */}
      <div className="flex flex-1 flex-col relative lg:flex-row">

        {/* Video area */}
        <div className="relative flex-1 bg-black">
          <video
            ref={videoRef}
            className="aspect-video w-full bg-black"
            controls={false}  // native controls OFF — we draw our own
            playsInline
            preload="metadata"
            onClick={togglePlay}
          />

          {/* Buffering spinner */}
          {isBuffering && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white" />
            </div>
          )}
        </div>

        {/* Chapter sidebar — only rendered when chapters exist */}
        {chapters.length > 0 && (
          <div className="hidden lg:block lg:w-72 shrink-0">
            <ChapterList chapters={chapters} currentTimeSeconds={currentTime} onChapterClick={handleChapterClick} />
          </div>
        )}
      </div>

      {/* ── Custom control bar ── */}
      <div className="absolute bottom-0 left-0 right-0 lg:right-72 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pb-4 pt-12 opacity-0 transition-opacity duration-300 group-hover:opacity-100">

        {/* Progress bar with chapter ticks */}
        <div
          ref={progressBarRef}
          className="relative mb-4 h-1.5 w-full cursor-pointer rounded-full bg-white/20"
          onMouseDown={handleProgressMouseDown}
        >
          {/* Playback fill */}
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-indigo-500"
            style={{ width: `${playbackPct}%` }}
          />

          {/* Chapter tick marks — live inside the custom bar (fix #7) */}
          {duration > 0 && chapters.map((ch) => {
            const pct = (ch.startSeconds / duration) * 100;
            if (pct <= 0 || pct >= 100) return null;
            return (
              <div
                key={ch.id}
                className="absolute top-0 h-full w-[2px] bg-white/50"
                style={{ left: `${pct}%` }}
              />
            );
          })}

          {/* Scrub thumb */}
          <div
            className="absolute top-1/2 -ml-2 h-4 w-4 -translate-y-1/2 rounded-full bg-indigo-500 shadow scale-0 transition-transform group-hover:scale-100"
            style={{ left: `${playbackPct}%` }}
          />
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-4 text-white">

          {/* Play / Pause */}
          <button type="button" onClick={togglePlay} className="hover:text-indigo-400">
            {isPlaying
              ? <Pause className="h-6 w-6" fill="currentColor" />
              : <Play className="h-6 w-6" fill="currentColor" />}
          </button>

          {/* Time */}
          <div className="text-sm tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>

          <div className="flex-1" />

          {/* Volume */}
          <div className="group/vol relative flex items-center gap-2">
            <button type="button" onClick={toggleMute} className="hover:text-indigo-400">
              {isMuted || volume === 0
                ? <VolumeX className="h-5 w-5" />
                : <Volume2 className="h-5 w-5" />}
            </button>
            <input
              type="range"
              min="0" max="1" step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-20 accent-indigo-500 opacity-0 transition-opacity group-hover/vol:opacity-100"
            />
          </div>

          {/* Fullscreen */}
          <button type="button" onClick={toggleFullscreen} className="hover:text-indigo-400">
            {isFullscreen
              ? <Minimize2 className="h-5 w-5" />
              : <Maximize2 className="h-5 w-5" />}
          </button>
        </div>
      </div>
      
      {/* Mobile Chapter sidebar */}
      {chapters.length > 0 && (
        <div className="lg:hidden h-64 border-t border-slate-800">
          <ChapterList chapters={chapters} currentTimeSeconds={currentTime} onChapterClick={handleChapterClick} />
        </div>
      )}
    </div>
  );
}
