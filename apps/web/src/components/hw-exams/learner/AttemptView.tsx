// A timed attempt: the countdown and the question paper. The countdown follows the SERVER's clock: it starts from the server's "now" sent with
// the view and adds time measured with performance.now(), a monotonic clock that changing the device's date or time does not move. When the
// countdown reaches zero the page asks the server again, which is what actually ends the writing time (the server never trusts this page).

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Flag, XCircle } from 'lucide-react'
import { api } from '@/lib/trpc/client'
import type { HwOut } from '@/components/hw/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { HwError, HwLoading, HwMessage } from '@/components/hw/HwShell'
import { LEARNER_BASE } from './Catalogue'
import { Booklet } from './Booklet'
import { ExamReport } from './Report'
import { clockText, useExamT, type ExKey } from './strings'

type View = HwOut['exams']['attempt']
type Q = View['paper'][number]

/** Re-renders every second while `on`. */
function useTick(on: boolean) {
  const [, set] = useState(0)
  useEffect(() => {
    if (!on) return
    const h = window.setInterval(() => set((n) => n + 1), 1000)
    return () => window.clearInterval(h)
  }, [on])
}

/** The dashboard's own sticky header, whose height changes with the screen size: the clock sits just below it. */
function useHeaderOffset(): number {
  const [h, setH] = useState(0)
  useEffect(() => {
    const header = document.querySelector('header')
    if (!header || getComputedStyle(header).position !== 'sticky') return
    const measure = () => setH(header.getBoundingClientRect().height)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(header)
    return () => ro.disconnect()
  }, [])
  return h
}

function Question({ q, first }: { q: Q; first: boolean }) {
  const { t } = useExamT()
  return (
    <div className="space-y-2">
      {!first && q.choiceGroup && <p className="text-center text-sm font-semibold tracking-wide text-muted-foreground">{t('ex.q.or')}</p>}
      <div className="flex gap-3">
        <span className="w-12 shrink-0 font-semibold">{t('ex.q', { n: `${q.number}${q.alt ?? ''}` })}</span>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="whitespace-pre-wrap leading-relaxed">{q.stem}</p>
          {q.options.length > 0 && (
            <ol className="grid gap-1 sm:grid-cols-2">
              {q.options.map((o) => <li key={o.letter}><span className="font-medium">({o.letter})</span> {o.text}</li>)}
            </ol>
          )}
          {q.figures.map((f) => (
            <figure key={f.figureId} className="max-w-md">
              {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed link, not a static asset */}
              <img src={f.url} alt={f.description} className="rounded border bg-white" />
              <figcaption className="mt-1 text-xs text-muted-foreground">{t('ex.q.figure')}</figcaption>
            </figure>
          ))}
        </div>
        <span className="shrink-0 text-sm text-muted-foreground">{t(q.marks === 1 ? 'ex.q.mark' : 'ex.q.marks', { n: q.marks })}</span>
      </div>
    </div>
  )
}

export function AttemptView({ attemptId }: { attemptId: string }) {
  const { t, pick, date } = useExamT()
  const utils = api.useUtils()
  const q = api.hw.exams.attempt.useQuery({ attemptId }, { retry: false, refetchOnWindowFocus: true, staleTime: 0 })
  const refresh = () => utils.hw.exams.attempt.invalidate({ attemptId })
  const finish = api.hw.exams.finishWriting.useMutation({ onSuccess: refresh })
  const headerOffset = useHeaderOffset()
  const giveUp = api.hw.exams.abandon.useMutation({ onSuccess: refresh })

  // The server's time when the view arrived, and the monotonic instant it arrived at.
  const anchor = useMemo(() => (q.data ? { server: new Date(q.data.serverNow).getTime(), mono: performance.now() } : null), [q.data])
  const status = q.data?.attempt.status
  const running = status === 'started' || status === 'time_up'
  useTick(running)
  const serverNow = anchor ? anchor.server + (performance.now() - anchor.mono) : 0
  const writeLeft = q.data && status === 'started' ? new Date(q.data.attempt.expiresAt).getTime() - serverNow : 0
  const uploadLeft = q.data && running ? new Date(q.data.attempt.uploadDeadlineAt).getTime() - serverNow : 0

  // When a countdown reaches zero, ask the server: it is the one that ends the time.
  const crossed = (status === 'started' && writeLeft <= 0) || (status === 'time_up' && uploadLeft <= 0)
  useEffect(() => { if (crossed) void refresh() }, [crossed]) // eslint-disable-line react-hooks/exhaustive-deps

  if (q.isLoading) return <HwLoading />
  if (q.error) return <HwError message={pick(q.error.message)} onRetry={() => q.refetch()} />
  const v = q.data!
  const a = v.attempt
  const actionError = finish.error?.message ?? giveUp.error?.message
  const groupFirst = new Set<string>()

  return (
    <div className="space-y-4">
      {/* the clock stays on screen while the paper scrolls */}
      <div className="sticky z-20 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6" style={{ top: headerOffset }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">{v.set.title}</p>
            <p className="text-xs text-muted-foreground">{v.set.subject} · {t('ex.t.attempt', { n: a.attemptNo })}</p>
          </div>
          {status === 'started' && (
            <div className="text-right" role="timer" aria-live="off">
              <p className="text-xs text-muted-foreground">{t('ex.t.left')}</p>
              <p className={`font-mono text-2xl font-bold tabular-nums ${writeLeft < 5 * 60_000 ? 'text-red-600' : ''}`}>{clockText(writeLeft)}</p>
            </div>
          )}
          {status === 'time_up' && (
            <div className="text-right" role="timer" aria-live="off">
              <p className="text-xs text-muted-foreground">{t('ex.t.upload')}</p>
              <p className="font-mono text-2xl font-bold tabular-nums text-amber-600">{clockText(uploadLeft)}</p>
            </div>
          )}
          {!running && <Badge variant="outline">{t(`ex.a.status.${status}` as ExKey)}</Badge>}
        </div>
      </div>

      {status === 'started' && <HwMessage>{t('ex.t.instructions')}</HwMessage>}
      {status === 'time_up' && <HwMessage><p className="font-medium">{t('ex.t.timeUp')}</p></HwMessage>}
      {/* a reported attempt shows its marks first, then the pages they came from */}
      {status === 'reported' && v.report && <ExamReport report={v.report} attemptNo={a.attemptNo} />}
      {(status === 'time_up' || v.booklet.length > 0) && <Booklet attemptId={attemptId} status={status!} pages={v.booklet} onChanged={refresh} />}
      {(status === 'uploaded' || status === 'evaluating') && (
        <HwMessage><p className="font-medium">{a.readyBy ? t('ex.t.readyBy', { date: date(a.readyBy) }) : t('ex.t.marking')}</p></HwMessage>
      )}
      {status === 'abandoned' && (
        <HwMessage>
          <p className="font-medium">{t('ex.t.closed')}</p>
          {a.failureReason && ['no_pages_uploaded', 'given_up'].includes(a.failureReason) && <p className="mt-1">{t(`ex.t.closed.${a.failureReason}` as ExKey)}</p>}
        </HwMessage>
      )}
      {actionError && <p role="alert" className="text-sm text-red-600">{pick(actionError)}</p>}

      <Card>
        <CardContent className="space-y-6 py-6">
          {v.paper.map((p, i) => {
            const first = !p.choiceGroup || !groupFirst.has(p.choiceGroup)
            if (p.choiceGroup) groupFirst.add(p.choiceGroup)
            const section = p.section && (i === 0 || v.paper[i - 1]!.section !== p.section)
            return (
              <div key={`${p.number}-${p.alt ?? ''}-${i}`} className="space-y-3">
                {section && <p className="border-b pb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('ex.q.section', { s: p.section })}</p>}
                <Question q={p} first={first} />
              </div>
            )
          })}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm"><Link href={`${LEARNER_BASE}/${v.set.packageId}`}>{t('ex.t.backToPackage')}</Link></Button>
        <div className="flex flex-wrap gap-2">
          {running && (
            <Button variant="ghost" size="sm" disabled={giveUp.isPending} onClick={() => { if (window.confirm(t('ex.t.giveUpConfirm'))) giveUp.mutate({ attemptId }) }}>
              <XCircle className="mr-1 h-4 w-4" />{t('ex.t.giveUp')}
            </Button>
          )}
          {status === 'started' && (
            <Button disabled={finish.isPending} onClick={() => { if (window.confirm(t('ex.t.finishConfirm'))) finish.mutate({ attemptId }) }}>
              <Flag className="mr-1 h-4 w-4" />{t('ex.t.finish')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
