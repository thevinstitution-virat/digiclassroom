import React, { useEffect } from 'react';

interface BunnyPlayerProps {
  providerVideoId: string;
  onProgress: (seconds: number) => void;
  onComplete: () => void;
}

export function BunnyPlayer({ providerVideoId, onProgress, onComplete }: BunnyPlayerProps) {
  const libraryId = process.env.NEXT_PUBLIC_BUNNY_LIBRARY_ID;

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.event === 'timeupdate') {
        onProgress(e.data.data.currentTime);
      }
      if (e.data?.event === 'ended') {
        onComplete();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onProgress, onComplete]);

  if (!libraryId) {
    return (
      <div className="w-full aspect-video bg-muted flex items-center justify-center text-muted-foreground rounded-lg">
        Video player configuration missing (BUNNY_LIBRARY_ID)
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black">
      <iframe
        src={`https://iframe.mediadelivery.net/embed/${libraryId}/${providerVideoId}?autoplay=false&responsive=true`}
        loading="lazy"
        className="absolute top-0 left-0 w-full h-full border-0"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
        allowFullScreen
      />
    </div>
  );
}
