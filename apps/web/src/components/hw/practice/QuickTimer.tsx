'use client'

// The quick test's clock (docs/hw-eval/board-bank-roadmap.md, phase 4): the board's pace, 2¼ minutes a mark, counted from when the test was first
// opened. It only tells the time, as an invigilator would: it never hands the test in or stops the writing.

import { useEffect, useState } from 'react'
import { Timer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useHwT } from '../strings'

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export function QuickTimer({ openedAt, minutes, marks }: { openedAt: string | Date; minutes: number; marks: number }) {
  const { t } = useHwT()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  const left = minutes * 60 - Math.max(0, (now - new Date(openedAt).getTime()) / 1000)
  const over = left < 0
  return (
    <div role="timer" aria-live="off"
      className={cn('flex items-center gap-2 rounded-md border px-3 py-2 text-sm', over ? 'border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200' : 'bg-muted/40')}>
      <Timer className="h-4 w-4 shrink-0" aria-hidden />
      <span className="tabular-nums">{over ? t('pr.quick.over', { over: clock(-left), m: minutes }) : t('pr.quick.timer', { left: clock(left), m: minutes, marks })}</span>
    </div>
  )
}
