import React, { useEffect, useRef } from 'react';

interface YouTubeEmbedProps {
  url: string;
  onProgress: (seconds: number) => void;
  onComplete: () => void;
}

function extractYouTubeId(url: string) {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
  return match ? match[1] : null;
}

export function YouTubeEmbed({ url, onProgress, onComplete }: YouTubeEmbedProps) {
  const videoId = extractYouTubeId(url);
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!videoId) return;

    // Load YouTube API script
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const initPlayer = () => {
      if (!containerRef.current) return;
      
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: {
          autoplay: 0,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onStateChange: (event: any) => {
            // 0 = ended
            if (event.data === 0) {
              onComplete();
              if (timerRef.current) clearInterval(timerRef.current);
            } else if (event.data === 1) { // 1 = playing
              if (!timerRef.current) {
                timerRef.current = setInterval(() => {
                  if (playerRef.current?.getCurrentTime) {
                    onProgress(playerRef.current.getCurrentTime());
                  }
                }, 5000); // Poll every 5s instead of 10s to ensure better tracking
              }
            } else {
              // Paused or buffering
              if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
              }
              if (playerRef.current?.getCurrentTime) {
                onProgress(playerRef.current.getCurrentTime());
              }
            }
          }
        }
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      (window as any).onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (playerRef.current?.destroy) {
        playerRef.current.destroy();
      }
    };
  }, [videoId, onProgress, onComplete]);

  if (!videoId) {
    return (
      <div className="w-full aspect-video bg-muted flex items-center justify-center text-muted-foreground rounded-lg">
        Invalid YouTube URL
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black">
      <div ref={containerRef} className="absolute top-0 left-0 w-full h-full border-0" />
    </div>
  );
}

// Add global YT types
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}
