// Class overview for a published assignment: each student's status, late flags, reading
// and marking counts, failed jobs, and the close / reopen / return actions.

import Link from 'next/link'
import { Loader2, PenSquare } from 'lucide-react'
import { api } from '@/lib/trpc/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { HwError, HwLoading, HwMessage } from '../HwShell'
import { useHwT } from '../strings'
import type { HwOut } from '../types'

type Detail = HwOut['assignments']['get']

export function Overview({ detail, onChanged }: { detail: Detail; onChanged: () => void }) {
  const { t } = useHwT()
  const a = detail.assignment
  const ov = api.hw.marking.overview.useQuery({ assignmentId: a.id }, { refetchInterval: 30_000 })
  const close = api.hw.assignments.close.useMutation({ onSuccess: onChanged })
  const reopen = api.hw.assignments.reopen.useMutation({ onSuccess: onChanged })
  const ret = api.hw.marking.returnAssignment.useMutation({ onSuccess: (r) => { window.alert(t('tc.ov.returned', { n: r.returned, m: r.notYetGraded })); void ov.refetch() } })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {detail.questions.map((q) => (
          <Button key={q.id} asChild size="sm">
            <Link href={`/dashboard/teacher/assignments/${a.id}/mark?question=${q.id}`}><PenSquare className="mr-1 h-4 w-4" />{t('tc.ov.mark')} · {t('mk.question', { i: q.position + 1 })}</Link>
          </Button>
        ))}
        <div className="ml-auto flex flex-wrap gap-2">
          {a.status === 'published'
            ? <Button size="sm" variant="outline" disabled={close.isPending} onClick={() => close.mutate({ assignmentId: a.id })}>{t('tc.ov.close')}</Button>
            : <Button size="sm" variant="outline" disabled={reopen.isPending} onClick={() => reopen.mutate({ assignmentId: a.id })}>{t('tc.ov.reopen')}</Button>}
          <Button size="sm" disabled={ret.isPending} onClick={() => ret.mutate({ assignmentId: a.id })}>
            {ret.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{t('tc.ov.return')}
          </Button>
        </div>
      </div>
      {(close.error || reopen.error || ret.error) && <HwMessage tone="error">{(close.error ?? reopen.error ?? ret.error)!.message}</HwMessage>}

      <Card>
        <CardHeader><CardTitle>{t('tc.ov.title')}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {ov.isLoading ? <HwLoading /> : ov.error ? <HwError message={ov.error.message} onRetry={() => ov.refetch()} /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('tc.ov.student')}</TableHead>
                  <TableHead>{t('tc.ov.status')}</TableHead>
                  <TableHead className="text-right">{t('mk.filter.needs_review')}</TableHead>
                  <TableHead className="text-right">{t('tc.sub.graded')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ov.data!.students.map((s) => (
                  <TableRow key={s.studentId}>
                    <TableCell>{s.roll ? `${s.roll}. ` : ''}{s.name}</TableCell>
                    <TableCell className="space-x-1">
                      <Badge variant={s.submission ? 'default' : 'secondary'}>{s.submission ? t(`tc.sub.${s.submission.status}`) : t('tc.ov.notStarted')}</Badge>
                      {s.submission?.isLate && <Badge variant="destructive">{t('st.list.late')}</Badge>}
                      {!!s.answers?.pending && <Badge variant="secondary">{t('tc.sub.processing')} {s.answers.pending}</Badge>}
                    </TableCell>
                    <TableCell className="text-right">{s.answers ? s.answers.needs_review + s.answers.failed : '–'}</TableCell>
                    <TableCell className="text-right">{s.answers ? `${s.answers.graded} / ${s.answers.total}` : '–'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {!!ov.data?.failedJobs.length && (
        <Card>
          <CardHeader><CardTitle className="text-base">{t('tc.ov.failedJobs')}</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {ov.data.failedJobs.map((j, i) => (
                <li key={i} className="rounded border border-red-200 p-2 dark:border-red-900">
                  <span className="font-medium">{j.kind}</span>: {j.error}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
