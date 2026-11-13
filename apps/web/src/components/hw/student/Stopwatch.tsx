// InkBuddy's stopwatch (Phase 4 of docs/hw-eval/inkbuddy-teacher-roadmap.md): the learner times their own writing, as they would pace
// themselves in the exam. Start when you begin writing, pause if you leave, stop when you finish. The time is saved with the answer and
// gives the writing speed on the result page; without it, the pen's own active time is used.

import { Pause, Play, RotateCcw, Square, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useHwT } from '../strings'

export interface StopwatchState { ms: number; since: number | null; stopped: boolean }
export const STOPWATCH_IDLE: StopwatchState = { ms: 0, since: null, stopped: false }

/** Time on the stopwatch now, including the running stretch. */
export const elapsedMs = (s: StopwatchState | undefined, now = Date.now()): number => (s ? s.ms + (s.since ? Math.max(0, now - s.since) : 0) : 0)

export function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  const two = (n: number) => String(n).padStart(2, '0')
  return h ? `${h}:${two(m)}:${two(sec)}` : `${two(m)}:${two(sec)}`
}

export function Stopwatch({ value, onChange }: { value: StopwatchState | undefined; onChange: (next: StopwatchState) => void }) {
  const { t } = useHwT()
  const s = value ?? STOPWATCH_IDLE
  const running = s.since !== null
  const now = Date.now()
  const start = () => onChange({ ms: s.ms, since: now, stopped: false })
  const pause = () => onChange({ ms: elapsedMs(s, now), since: null, stopped: false })
  const stop = () => onChange({ ms: elapsedMs(s, now), since: null, stopped: true })
  const reset = () => onChange(STOPWATCH_IDLE)
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2" role="group" aria-label={t('sw.title')}>
      <Timer className="h-4 w-4 text-muted-foreground" aria-hidden />
      <span className="min-w-[4.5rem] font-mono text-lg tabular-nums" aria-live="off">{formatClock(elapsedMs(s, now))}</span>
      {s.stopped ? (
        <>
          <span className="text-sm text-muted-foreground">{t('sw.stopped')}</span>
          <Button size="sm" variant="ghost" onClick={reset}><RotateCcw className="mr-1 h-4 w-4" />{t('sw.reset')}</Button>
        </>
      ) : running ? (
        <>
          <Button size="sm" variant="outline" onClick={pause}><Pause className="mr-1 h-4 w-4" />{t('sw.pause')}</Button>
          <Button size="sm" onClick={stop}><Square className="mr-1 h-4 w-4" />{t('sw.stop')}</Button>
        </>
      ) : (
        <>
          <Button size="sm" onClick={start}><Play className="mr-1 h-4 w-4" />{t(s.ms > 0 ? 'sw.resume' : 'sw.start')}</Button>
          {s.ms > 0 && <Button size="sm" variant="outline" onClick={stop}><Square className="mr-1 h-4 w-4" />{t('sw.stop')}</Button>}
        </>
      )}
      <p className="w-full text-xs text-muted-foreground">{t('sw.hint')}</p>
    </div>
  )
}
