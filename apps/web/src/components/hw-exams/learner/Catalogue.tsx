// The learner's list of exam packages, and one package with its tests: attempts used, starting the next one (after saying plainly that the clock
// starts at once), and the way back to a test that is still open.

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Clock, Printer } from 'lucide-react'
import { api } from '@/lib/trpc/client'
import type { HwOut } from '@/components/hw/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { HwError, HwLanguageToggle, HwLoading, HwMessage } from '@/components/hw/HwShell'
import { useExamT, type ExKey } from './strings'

export const LEARNER_BASE = '/dashboard/user/exams'

export function ExamFrame({ children }: { children: React.ReactNode }) {
  const { t } = useExamT()
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{t('ex.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('ex.subtitle')}</p>
        </div>
        <HwLanguageToggle />
      </div>
      {children}
    </div>
  )
}

const rupees = (p: number) => `₹${(p / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

export function Catalogue() {
  const { t, pick, date } = useExamT()
  const q = api.hw.exams.catalogue.useQuery(undefined, { retry: false })
  if (q.isLoading) return <HwLoading />
  if (q.error) return <HwMessage tone="error">{pick(q.error.message)}</HwMessage>
  if (!q.data!.length) return <HwMessage>{t('ex.catalogue.none')}</HwMessage>
  const accessKey: Record<string, ExKey> = { active: 'ex.access.active', expired: 'ex.access.expired', refunded: 'ex.access.refunded', none: 'ex.access.none' }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {q.data!.map((p) => (
        <Card key={p.id} className="flex flex-col">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-lg">{p.title}</CardTitle>
              <Badge variant={p.access === 'active' ? 'default' : 'outline'}>{t(accessKey[p.access]!)}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{t('ex.pkg.meta', { board: p.board, cls: p.classLevel, year: p.examYear })}</p>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3 text-sm">
            {p.blurb && <p className="line-clamp-3">{p.blurb}</p>}
            <p className="text-muted-foreground">
              {p.subjects.join(', ')} · {t('ex.pkg.sets', { n: p.sets })} · {t('ex.pkg.attempts', { n: p.attemptsPerSet })}
              {p.access === 'active' && p.accessEndsAt && <> · {t('ex.access.until', { date: date(p.accessEndsAt) })}</>}
            </p>
            <div className="mt-auto flex items-center justify-between gap-2">
              <span className="font-medium">{p.access === 'active' ? '' : p.pricePaise === 0 ? t('ex.pkg.free') : rupees(p.pricePaise)}</span>
              <Button asChild size="sm" variant={p.access === 'active' ? 'default' : 'outline'}><Link href={`${LEARNER_BASE}/${p.id}`}>{t('ex.pkg.open')}</Link></Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

type LSet = HwOut['exams']['package']['sets'][number]

function StartDialog({ set, onClose }: { set: LSet; onClose: () => void }) {
  const { t, pick } = useExamT()
  const router = useRouter()
  const start = api.hw.exams.start.useMutation({ onSuccess: (r) => router.push(`${LEARNER_BASE}/attempt/${r.attemptId}`) })
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('ex.confirm.title', { title: set.title })}</DialogTitle>
          <DialogDescription>{t('ex.confirm.body', { min: set.durationMinutes, grace: set.graceMinutes })}</DialogDescription>
        </DialogHeader>
        {start.error && <p role="alert" className="text-sm text-red-600">{pick(start.error.message)}</p>}
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>{t('ex.confirm.cancel')}</Button>
          <Button onClick={() => start.mutate({ setId: set.id })} disabled={start.isPending}><Clock className="mr-1 h-4 w-4" />{t('ex.confirm.go')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const STATUS_KEY: Record<string, ExKey> = {
  started: 'ex.a.status.started', time_up: 'ex.a.status.time_up', uploaded: 'ex.a.status.uploaded',
  evaluating: 'ex.a.status.evaluating', reported: 'ex.a.status.reported', abandoned: 'ex.a.status.abandoned',
}

export function PackageView({ packageId }: { packageId: string }) {
  const { t, pick, date } = useExamT()
  const q = api.hw.exams.package.useQuery({ packageId }, { retry: false })
  const [starting, setStarting] = useState<LSet | null>(null)
  if (q.isLoading) return <HwLoading />
  if (q.error) return <HwError message={pick(q.error.message)} onRetry={() => q.refetch()} />
  const { package: pkg, sets, access, openAttempt } = q.data!
  const kindKey = (k: string) => `ex.kind.${k}` as ExKey

  return (
    <div className="space-y-4">
      <Link href={LEARNER_BASE} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />{t('ex.back')}</Link>
      <div>
        <h2 className="text-xl font-semibold">{pkg.title}</h2>
        <p className="text-sm text-muted-foreground">{t('ex.pkg.meta', { board: pkg.board, cls: pkg.classLevel, year: pkg.examYear })}</p>
        {pkg.blurb && <p className="mt-2 text-sm">{pkg.blurb}</p>}
      </div>
      {!access && <HwMessage>{t('ex.access.ask')}</HwMessage>}
      {openAttempt && (
        <Card className="border-amber-300 dark:border-amber-800">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm">
            <span className="flex items-center gap-2"><Clock className="h-4 w-4" />{sets.find((s) => s.id === openAttempt.setId)?.title}</span>
            <Button asChild size="sm"><Link href={`${LEARNER_BASE}/attempt/${openAttempt.id}`}>{t('ex.set.resume')}</Link></Button>
          </CardContent>
        </Card>
      )}
      {!sets.length && <HwMessage>{t('ex.set.none')}</HwMessage>}
      <div className="space-y-3">
        {sets.map((s) => (
          <Card key={s.id}>
            <CardContent className="space-y-3 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{s.title}</p>
                  <div className="text-sm text-muted-foreground">
                    <Badge variant="outline" className="mr-2">{t(kindKey(s.kind))}</Badge>
                    {s.subject} · {t('ex.set.meta', { marks: s.maxMarks, min: s.durationMinutes, q: s.questions })}
                  </div>
                  {access && (
                    <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      <span>{t('ex.set.used', { used: s.used, allowed: s.allowed })}</span>
                      <a href={`/exam-sheet/${s.id}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-primary hover:underline"><Printer className="h-3 w-3" />{t('ex.set.sheet')}</a>
                    </p>
                  )}
                </div>
                {access && (s.canStart.ok
                  ? <Button size="sm" onClick={() => setStarting(s)}>{t('ex.set.start', { n: s.canStart.attemptNo })}</Button>
                  : s.canStart.why !== 'attempt_open' && <span className="max-w-xs text-right text-xs text-muted-foreground">{pick(`${s.canStart.en} / ${s.canStart.hi}`)}</span>)}
              </div>
              {s.attempts.length > 0 && (
                <ul className="divide-y rounded-md border text-sm">
                  {[...s.attempts].reverse().map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                      <span>{t('ex.a.row', { n: a.attemptNo, date: date(a.startedAt) })}</span>
                      <span className="flex items-center gap-2">
                        <Badge variant={a.status === 'abandoned' ? 'outline' : 'secondary'}>{t(STATUS_KEY[a.status]!)}</Badge>
                        <Link href={`${LEARNER_BASE}/attempt/${a.id}`} className="text-xs underline-offset-2 hover:underline">{t('ex.a.open')}</Link>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      {starting && <StartDialog set={starting} onClose={() => setStarting(null)} />}
    </div>
  )
}
