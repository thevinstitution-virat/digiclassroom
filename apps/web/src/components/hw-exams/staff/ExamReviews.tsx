'use client'

// Exam reports a member of staff may revise (migration 036; docs/hw-eval/mark-revisions.md): the platform team sees every reported attempt; a
// school's admin and teachers see their own learners' (the server decides who is whose). The detail shows the report as the learner sees it,
// each answer as read with its current marks, a revise form per answer, and the full revision history (with reasons, for staff only).

import { useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/trpc/client'
import type { HwOut } from '@/components/hw/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HwError, HwLoading, HwMessage } from '@/components/hw/HwShell'
import { RevisePanel, RevisionNote } from '@/components/hw/Revision'
import { useHwT } from '@/components/hw/strings'
import { ExamReport } from '@/components/hw-exams/learner/Report'

type Detail = HwOut['exams']['reviews']['get']
type Question = Detail['questions'][number]

const fmt = (n: number | null) => (n === null ? '—' : String(Math.round(n * 100) / 100))

export function ExamReviewList({ base }: { base: string }) {
  const { t, lang } = useHwT()
  const q = api.hw.exams.reviews.list.useQuery()
  const day = (d: Date | string | null) => (d ? new Date(d).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { dateStyle: 'medium' }) : '')
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('rv.ex.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('rv.ex.subtitle')}</p>
      </div>
      {q.isLoading ? <HwLoading /> : q.error ? <HwError message={q.error.message} onRetry={() => q.refetch()} /> : !q.data?.length ? <HwMessage>{t('rv.ex.none')}</HwMessage> : (
        <Card>
          <CardContent className="divide-y p-0">
            {q.data.map((r) => (
              <div key={r.attemptId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{r.learner}</p>
                  <p className="text-sm text-muted-foreground">{r.setTitle} · {r.packageTitle} · #{r.attemptNo} · {day(r.reportedAt)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {r.pending > 0 && <Badge variant="outline" className="border-amber-300 text-amber-800 dark:text-amber-300">{t('rv.ex.pending', { n: r.pending })}</Badge>}
                  {r.revisions > 0 && <Badge variant="outline">{t('rv.ex.revised', { n: r.revisions })}</Badge>}
                  <span className="font-mono tabular-nums">{fmt(r.marksAwarded)} / {fmt(r.maxMarks)}</span>
                  <Button asChild size="sm" variant="outline"><Link href={`${base}/${r.attemptId}`}>{t('rv.ex.open')}</Link></Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ReviewQuestion({ q, me, attemptId, revision }: { q: Question; me: Detail['me']; attemptId: string; revision?: Detail['history'][number] }) {
  const { t } = useHwT()
  const utils = api.useUtils()
  const [open, setOpen] = useState(false)
  const revise = api.hw.exams.reviews.revise.useMutation({
    onSuccess: () => { setOpen(false); void utils.hw.exams.reviews.get.invalidate({ attemptId }); void utils.hw.exams.reviews.list.invalidate() },
  })
  const status = q.status === 'pending' ? t('rv.ex.pendingQ') : q.status === 'not_counted' ? t('rv.ex.notCounted') : null
  return (
    <li className="space-y-2 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">{t('rv.ex.question', { n: `${q.number}${q.alt ?? ''}` })}</span>
        <div className="flex items-center gap-2">
          {status && <Badge variant="outline">{status}</Badge>}
          <span className="font-mono tabular-nums">{fmt(q.awarded)} / {fmt(q.marks)}</span>
        </div>
      </div>
      {revision && <RevisionNote r={{ ...revision, by: { name: revision.name, designation: revision.designation } }} />}
      <div>
        <p className="text-xs text-muted-foreground">{t('rv.ex.answer')}</p>
        <p className="whitespace-pre-wrap rounded bg-muted p-2 text-sm">{q.transcript || '—'}</p>
      </div>
      {q.rubric.length > 0 && !open && (
        <ul className="space-y-0.5 text-sm">
          {q.rubric.map((r) => <li key={r.id} className="flex justify-between gap-3"><span>{r.description}</span><span className="shrink-0 font-mono text-xs">{fmt(r.awarded)}/{fmt(r.marks)}</span></li>)}
        </ul>
      )}
      {open ? (
        <RevisePanel rubric={q.rubric} questionMarks={q.marks} currentMarks={q.awarded} me={me} busy={revise.isPending} error={revise.error?.message}
          onSubmit={(i) => revise.mutate({ answerId: q.answerId, ...i })} onCancel={() => setOpen(false)} />
      ) : (
        <Button size="sm" variant="outline" onClick={() => { revise.reset(); setOpen(true) }}>{t('rv.open')}</Button>
      )}
    </li>
  )
}

export function ExamReviewDetail({ attemptId, base }: { attemptId: string; base: string }) {
  const { t, lang } = useHwT()
  const q = api.hw.exams.reviews.get.useQuery({ attemptId })
  if (q.isLoading) return <HwLoading />
  if (q.error) return <div className="mx-auto max-w-5xl p-4"><HwError message={q.error.message} onRetry={() => q.refetch()} /></div>
  const d = q.data!
  const latest = new Map(d.history.map((h) => [h.answerId, h]))
  const when = (x: Date | string) => new Date(x).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' })
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6 sm:px-6">
      <Button asChild variant="ghost" size="sm"><Link href={base}>← {t('rv.ex.back')}</Link></Button>
      <div>
        <h1 className="text-2xl font-semibold">{d.learner}</h1>
        <p className="text-sm text-muted-foreground">{d.set.title} · {d.packageTitle} · #{d.attempt.attemptNo}</p>
      </div>

      <Card>
        <CardHeader className="pb-0"><CardTitle className="text-base">{t('rv.title')}</CardTitle></CardHeader>
        <CardContent><ul className="divide-y">{d.questions.map((x) => <ReviewQuestion key={x.answerId} q={x} me={d.me} attemptId={attemptId} revision={latest.get(x.answerId)} />)}</ul></CardContent>
      </Card>

      {d.history.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{t('rv.history')}</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {d.history.map((h, i) => {
                const n = d.questions.find((x) => x.answerId === h.answerId)
                return (
                  <li key={i}>
                    <p>{n ? `${t('rv.ex.question', { n: `${n.number}${n.alt ?? ''}` })} · ` : ''}{t('rv.historyRow', { date: when(h.at), before: fmt(h.marksBefore), after: fmt(h.marksAfter), name: h.name, designation: h.designation })}{!h.shownToLearner && <span className="ml-1 text-xs text-muted-foreground">({t('rv.hidden')})</span>}</p>
                    <p className="text-xs italic text-muted-foreground">{h.reason}</p>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {d.report && <ExamReport report={d.report} attemptNo={d.attempt.attemptNo} />}
    </div>
  )
}
