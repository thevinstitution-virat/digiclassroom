'use client'

// The InkBuddy grade card (Phase 5 of docs/hw-eval/inkbuddy-teacher-roadmap.md): the top of a marked attempt, like the corner of a
// teacher's corrected copy: the marks, which attempt this is, where the mark stands among other learners' first attempts at the same
// question (only with enough of them), the writing speed, and the date. Every detail is further down the page.

import { Award, Gauge, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useHwT } from '../strings'
import type { AttemptsInfo } from './ResultExtras'
import type { Pace } from './PaceCard'

export function GradeCard({ total, outOf, attempts, standing, pace }: {
  total: number
  outOf: number
  attempts: AttemptsInfo | null
  standing: { percentile: number | null; peers: number } | null
  pace: Pace | null
}) {
  const { t, lang } = useHwT()
  const share = outOf > 0 ? total / outOf : 0
  const current = attempts?.history.find((h) => h.current)
  const date = current ? new Date(current.createdAt).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : null
  const tone = share >= 1 ? 'text-emerald-700 dark:text-emerald-300' : share >= 0.6 ? 'text-blue-700 dark:text-blue-300' : 'text-amber-700 dark:text-amber-300'
  return (
    <Card className="overflow-hidden">
      <CardContent className="grid gap-4 py-5 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full border-4 border-current" style={{ transform: 'rotate(-6deg)' }}>
            <span className={`text-2xl font-bold tabular-nums ${tone}`}>{total}</span>
            <span className="text-xs text-muted-foreground">/ {outOf}</span>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t('pr.card.title')}</p>
            <p className={`text-3xl font-semibold tabular-nums ${tone}`}>{Math.round(share * 100)}%</p>
            {current && attempts && <p className="text-sm text-muted-foreground">{t('pr.card.attempt', { n: current.n, total: attempts.history.length })}{date ? ` · ${date}` : ''}</p>}
          </div>
        </div>
        <ul className="space-y-1.5 text-sm">
          {standing && (
            <li className="flex items-start gap-2">
              <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              {standing.percentile !== null ? t('pr.card.standing', { p: standing.percentile }) : <span className="text-muted-foreground">{t('pr.card.fewPeers')}</span>}
            </li>
          )}
          {pace?.speed && (
            <li className="flex items-start gap-2">
              <Gauge className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              {t('pr.card.speed', { wpm: Math.round(pace.speed.wpm) })}{pace.percentile !== null ? ` · ${t('pr.card.speedStanding', { p: pace.percentile })}` : ''}
            </li>
          )}
          {share >= 1 && (
            <li className="flex items-start gap-2"><Award className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />{t('pr.card.full')}</li>
          )}
        </ul>
      </CardContent>
    </Card>
  )
}
