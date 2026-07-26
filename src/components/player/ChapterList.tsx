'use client'

import { formatSeconds } from '@/lib/utils/youtube'
import { PlayCircle, Bookmark } from 'lucide-react'

export interface Chapter {
  id: string
  title: string
  startSeconds: number
  sortOrder: number
}

interface ChapterListProps {
  chapters: Chapter[]
  activeChapterIdx: number
  currentTime: number
  onChapterClick: (startSeconds: number) => void
}

export function ChapterList({ chapters, activeChapterIdx, currentTime, onChapterClick }: ChapterListProps) {
  if (chapters.length === 0) return null

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center gap-2">
        <Bookmark className="w-4 h-4 text-indigo-500" />
        <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">Chapters</span>
        <span className="ml-auto text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{chapters.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {chapters.map((chapter, idx) => {
          const isActive = idx === activeChapterIdx
          const isPast = currentTime >= chapter.startSeconds && !isActive

          return (
            <button
              key={chapter.id}
              onClick={() => onChapterClick(chapter.startSeconds)}
              className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-all border-l-2 ${
                isActive
                  ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-500 text-indigo-800 dark:text-indigo-200'
                  : isPast
                  ? 'border-emerald-300 dark:border-emerald-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'
              }`}
            >
              {isActive ? (
                <PlayCircle className="w-4 h-4 mt-0.5 text-indigo-500 shrink-0 animate-pulse" />
              ) : (
                <span className="w-4 h-4 mt-0.5 shrink-0 text-xs font-bold text-center text-slate-400">
                  {idx + 1}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-snug ${isActive ? 'font-semibold' : 'font-medium'} truncate`}>
                  {chapter.title}
                </p>
                <p className={`text-xs mt-0.5 ${isActive ? 'text-indigo-500' : 'text-slate-400'}`}>
                  {formatSeconds(chapter.startSeconds)}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
