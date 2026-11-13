'use client'

// Time, writing speed and handwriting on an InkBuddy result (Phase 4 of docs/hw-eval/inkbuddy-teacher-roadmap.md): words a minute and how
// it was timed, the percentile among other learners on the same question (only with enough of them), a pacing guide for exam answers
// at this speed, and a kind note on handwriting. Encouragement, never a mark.

import { Gauge, PenLine } from 'lucide-react'
import { formatClock } from '../student/Stopwatch'
import { useHwT, type HwKey } from '../strings'

export interface Pace {
  speed: { words: number; ms: number; wpm: number; source: 'stopwatch' | 'pen' | 'typing' } | null
  percentile: number | null
  peers: number
  guide: { marks: number; words: [number, number]; minutes: [number, number] }[]
  hand: 'unclear' | 'crossing' | 'small' | 'large' | 'clear' | 'clearPhoto' | null
}

export function PaceCard({ pace }: { pace: Pace }) {
  const { t } = useHwT()
  const s = pace.speed
  return (
    <div className="space-y-3 rounded-md border p-3 text-sm">
      <div className="space-y-1">
        <p className="flex items-center gap-2 font-medium"><Gauge className="h-4 w-4" aria-hidden />{t('pr.pace.title')}</p>
        {s ? (
          <>
            <p>{t('pr.pace.speed', { words: s.words, time: formatClock(s.ms), wpm: Math.round(s.wpm) })}</p>
            <p className="text-muted-foreground">{t(`pr.pace.src.${s.source}` as HwKey)}</p>
            <p>{pace.percentile !== null ? t('pr.pace.percentile', { p: pace.percentile }) : <span className="text-muted-foreground">{t('pr.pace.fewPeers')}</span>}</p>
            {pace.guide.length > 0 && (
              <div className="space-y-1 pt-1">
                <p className="text-muted-foreground">{t('pr.pace.guide')}</p>
                <ul className="space-y-0.5">
                  {pace.guide.map((g) => (
                    <li key={g.marks}>{t('pr.pace.guideRow', { marks: g.marks, lo: g.words[0], hi: g.words[1], tlo: g.minutes[0], thi: g.minutes[1] })}</li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">{t('pr.pace.guideNote')}</p>
              </div>
            )}
          </>
        ) : <p className="text-muted-foreground">{t('pr.pace.none')}</p>}
      </div>
      {pace.hand && (
        <div className="space-y-1 border-t pt-2">
          <p className="flex items-center gap-2 font-medium"><PenLine className="h-4 w-4" aria-hidden />{t('pr.hand.title')}</p>
          <p>{t(`pr.hand.${pace.hand}` as HwKey)}</p>
        </div>
      )}
    </div>
  )
}
