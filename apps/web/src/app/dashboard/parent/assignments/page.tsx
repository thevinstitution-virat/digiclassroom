'use client'

// Parent / guardian: the written assignments of a child an institution admin has linked to this account (roadmap-remaining.md, workstream A).
// What is shown: what was set, when it was due, whether it was handed in and whether late, and once the teacher has returned it the marks,
// the teacher's comment and the marking points. Nothing from the AI, no transcript, nothing before the teacher returns it.

import { useEffect, useState } from 'react'
import { api } from '@/lib/trpc/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HwError, HwLoading, HwMessage, HwShell } from '@/components/hw/HwShell'
import { NativeSelect } from '@/components/hw/fields'
import { marksLabel, useHwT } from '@/components/hw/strings'

function Result({ studentId, submissionId }: { studentId: string; submissionId: string }) {
  const { t } = useHwT()
  const r = api.hw.guardian.result.useQuery({ studentId, submissionId })
  if (r.isLoading) return <HwLoading />
  if (r.error) return <HwError message={r.error.message} onRetry={() => r.refetch()} />
  const res = r.data!
  return (
    <div className="space-y-3 border-t pt-3" data-testid="parent-result">
      <p className="text-sm font-medium text-green-700 dark:text-green-400">{t('pa.total', { got: res.total, of: res.assignment.totalMarks })}</p>
      {res.questions.map((q) => (
        <div key={q.id} className="rounded-md border p-3 text-sm">
          <p className="font-medium">{t('mk.question', { i: q.position + 1 })}: {q.prompt}</p>
          {q.passage && <p className="mt-1 whitespace-pre-wrap rounded bg-muted/40 p-2 text-xs">{q.passage}</p>}
          <p className="mt-1">{q.awarded === null ? t('pa.notMarked') : t('pa.awarded', { got: q.awarded, of: q.marks })}</p>
          {q.keyPoints.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-muted-foreground">
              {q.keyPoints.map((k, i) => <li key={i}>{k.description} — {k.marks}/{k.outOf}</li>)}
            </ul>
          )}
          {q.comment && <p className="mt-2 rounded bg-amber-50 p-2 dark:bg-amber-950/30"><span className="font-medium">{t('pa.teacherComment')}: </span>{q.comment}</p>}
        </div>
      ))}
    </div>
  )
}

export default function ParentAssignmentsPage() {
  const { t, lang } = useHwT()
  const on = api.hw.guardian.enabled.useQuery()
  const kids = api.hw.guardian.children.useQuery(undefined, { enabled: on.data?.enabled === true, retry: false })
  const [child, setChild] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  useEffect(() => { if (!child && kids.data?.length) setChild(kids.data[0].id) }, [kids.data, child])
  const list = api.hw.guardian.assignments.useQuery({ studentId: child }, { enabled: !!child })
  const fmt = (d: Date | string | null) => (d ? t('common.due', { date: new Date(d).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' }) }) : t('common.noDue'))

  return (
    <HwShell roles={['parent']} title={t('pa.title')} subtitle={t('pa.subtitle')}>
      {on.isLoading || kids.isLoading ? <HwLoading /> : !on.data?.enabled ? <HwMessage>{t('pa.off')}</HwMessage>
        : kids.error ? <HwError message={kids.error.message} onRetry={() => kids.refetch()} />
        : !kids.data?.length ? <HwMessage>{t('pa.noChildren')}</HwMessage> : (
          <div className="space-y-4">
            {kids.data.length > 1 && (
              <label className="flex items-center gap-2 text-sm">{t('pa.child')}
                <NativeSelect value={child} onChange={(e) => { setChild(e.target.value); setOpen(null) }} className="w-56">
                  {kids.data.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
                </NativeSelect>
              </label>
            )}
            {list.isLoading ? <HwLoading /> : list.error ? <HwError message={list.error.message} onRetry={() => list.refetch()} />
              : !list.data?.length ? <HwMessage>{t('pa.empty')}</HwMessage> : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {list.data.map((a) => (
                    <Card key={a.id}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{a.title}</CardTitle>
                        <p className="text-sm text-muted-foreground">{a.subject} · {marksLabel(t, a.totalMarks)}</p>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span>{fmt(a.dueAt)}</span>
                          <Badge variant={a.handedIn ? 'default' : 'outline'}>{a.handedIn ? t('pa.handedIn') : t('pa.notHandedIn')}</Badge>
                          {a.isLate && <Badge variant="destructive">{t('st.list.late')}</Badge>}
                          {a.handedIn && !a.returned && <span className="text-muted-foreground">{t('pa.waiting')}</span>}
                        </div>
                        {a.returned && a.submissionId && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => setOpen(open === a.id ? null : a.id)}>{open === a.id ? t('pa.hideResult') : t('pa.viewResult')}</Button>
                            {open === a.id && <Result studentId={child} submissionId={a.submissionId} />}
                          </>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
          </div>
        )}
    </HwShell>
  )
}
