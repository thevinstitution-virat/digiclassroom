// src/components/video/ChapterList.tsx
'use client';

import { PlayCircle } from 'lucide-react';
import type { VideoChapter } from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

/**
 * The active chapter is the last one whose startSeconds <= currentTime.
 * Assumes chapters are ordered by startSeconds ascending (they are, via sortOrder).
 */
function getActiveIndex(chapters: VideoChapter[], currentTime: number): number {
  let idx = -1;
  for (let i = 0; i < chapters.length; i++) {
    if (chapters[i].startSeconds <= currentTime) idx = i;
    else break;
  }
  return idx;
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  chapters: VideoChapter[];
  currentTimeSeconds: number;
  onChapterClick: (startSeconds: number) => void;
};

export function ChapterList({ chapters, currentTimeSeconds, onChapterClick }: Props) {
  if (chapters.length === 0) return null;

  const activeIdx = getActiveIndex(chapters, currentTimeSeconds);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-vg-surface-1 border-l border-vg-border">
      {/* Header */}
      <div className="border-b border-vg-border px-4 py-3">
        <h3 className="text-sm font-semibold text-vg-text-primary">
          Chapters
        </h3>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {chapters.map((chapter, idx) => {
          const isActive = idx === activeIdx;
          return (
            <div key={chapter.id}>
              <button
                type="button"
                onClick={() => onChapterClick(chapter.startSeconds)}
                className={[
                  'flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm',
                  'transition-colors hover:bg-vg-surface-2',
                  isActive
                    ? 'bg-blue-500/10 text-blue-500'
                    : 'text-vg-text-primary',
                ].join(' ')}
              >
                {/* Icon */}
                <div className="mt-0.5 flex w-5 shrink-0 items-center justify-center">
                  {isActive ? (
                    <PlayCircle className="h-4 w-4 fill-current" />
                  ) : (
                    <span className="text-xs text-vg-text-muted">
                      {idx + 1}
                    </span>
                  )}
                </div>

                {/* Title */}
                <span className="flex-1 line-clamp-2">
                  {chapter.title}
                </span>

                {/* Timestamp */}
                <span className="text-xs font-medium text-vg-text-muted">
                  {formatTime(chapter.startSeconds)}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
