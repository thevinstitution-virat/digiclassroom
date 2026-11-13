'use client'

// The InkBuddy home's progress (Phase 5 of docs/hw-eval/inkbuddy-teacher-roadmap.md): every question practised, with the marks of each
// attempt in order (so the learner sees themselves improve), the best, and a "to revisit" list of questions marked below full marks.

import { useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/trpc/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { HwError, HwLoading } from '../HwShell'
import { useHwT } from '../strings'

export function PracticeProgress() {
  const { t } = useHwT()
  const p = api.hw.practice.progress.useQuery(undefined, { retry: false, staleTime: 0 })
  const [only, setOnly] = useState<'all' | 'revisit'>('all')
  const d = p.data
  const list = d ? (only === 'revisit' ? d.questions.filter((q) => q.revisit) : d.questions) : []
  const revisit = d?.questions.filter((q) => q.revisit).length ?? 0
  return (
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle>{t('pr.mine.title')}</CardTitle>
        {d && d.questions.length > 0 && (
          <p className="text-sm text-muted-foreground">{t('pr.prog.summary', { q: d.questions.length, a: d.attempts, full: d.full })}</p>
        )}
        {d && d.questions.length > 0 && (
          <div className="flex gap-1" role="radiogroup">
            <Button size="sm" variant={only === 'all' ? 'default' : 'outline'} role="radio" aria-checked={only === 'all'} onClick={() => setOnly('all')}>{t('pr.prog.all')}</Button>
            <Button size="sm" variant={only === 'revisit' ? 'default' : 'outline'} role="radio" aria-checked={only === 'revisit'} onClick={() => setOnly('revisit')}>{t('pr.prog.revisit', { n: revisit })}</Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {p.isLoading ? <HwLoading /> : p.error ? <HwError message={p.error.message} onRetry={() => p.refetch()} /> : !d?.questions.length ? (
          <p className="text-sm text-muted-foreground">{t('pr.mine.empty')}</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('pr.prog.noneToRevisit')}</p>
        ) : (
          <ul className="space-y-3">
            {list.map((q) => (
              <li key={q.ref} className="space-y-2 rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 font-medium">{q.prompt}</p>
                  {q.best !== null && <Badge variant={q.best >= q.outOf ? 'default' : 'secondary'}>{t('pr.prog.best', { best: q.best, of: q.outOf })}</Badge>}
                </div>
                {(q.book || q.chapter) && <p className="text-xs text-muted-foreground">{[q.book, q.chapter].filter(Boolean).join(' · ')}</p>}
                <div className="flex flex-wrap items-center gap-1.5" aria-label={t('pr.prog.attempts')}>
                  {q.attempts.map((a, i) => (
                    <Link key={a.assignmentId} href={`/dashboard/student/assignments/${a.assignmentId}?space=practice`}
                      className={cn('rounded border px-2 py-0.5 text-xs tabular-nums hover:bg-muted', a.awarded !== null && a.awarded >= q.outOf && 'border-emerald-500 text-emerald-700 dark:text-emerald-300')}
                      title={t('pr.attempts.row', { n: i + 1 })}>
                      {a.awarded !== null ? `${a.awarded}/${q.outOf}` : '…'}
                    </Link>
                  ))}
                  <Button asChild size="sm" variant="outline" className="ml-auto">
                    <Link href={`/dashboard/student/assignments/${q.latestAssignmentId}?space=practice`}>{t(q.revisit ? 'pr.prog.again' : 'st.list.open')}</Link>
                  </Button>
                </div>
                {q.revisit && <p className="text-xs text-amber-700 dark:text-amber-300">{t('pr.prog.revisitHint')}</p>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
