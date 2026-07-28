// src/components/video/types.ts

export type VideoProvider = 'bunny' | 'youtube';

export type VideoChapter = {
  id: string;
  title: string;
  startSeconds: number;
  sortOrder: number;
};

/**
 * The minimal shape UniversalVideoPlayer needs from a videoAssets row.
 * Extend as needed — these are the fields the player actually reads.
 */
export type VideoAssetForPlayer = {
  id: string;
  provider: VideoProvider;
  providerVideoId: string;
  title: string;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
};
