'use client'

import Link from 'next/link'
import { api } from '@/lib/trpc/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HwError, HwLoading, HwMessage, HwShell } from '@/components/hw/HwShell'
import { marksLabel, useHwT } from '@/components/hw/strings'
import type { HwOut } from '@/components/hw/types'

type Item = HwOut['student']['assignments'][number]

function groupOf(a: Item): 'pending' | 'submitted' | 'returned' {
  if (!a.submission || a.submission.status === 'draft') return 'pending'
  return a.submission.status === 'returned' ? 'returned' : 'submitted'
}

export default function StudentAssignmentsPage() {
  const { t, lang } = useHwT()
  const q = api.hw.student.assignments.useQuery()

  const fmt = (d: Date | string | null) =>
    d ? t('common.due', { date: new Date(d).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' }) }) : t('common.noDue')

  const groups = (['pending', 'submitted', 'returned'] as const).map((g) => ({
    g,
    items: (q.data ?? []).filter((a) => groupOf(a) === g),
  }))

  return (
    <HwShell roles={['student']}>
      {q.isLoading ? <HwLoading /> : q.error ? <HwError message={q.error.message} onRetry={() => q.refetch()} /> : !q.data?.length ? (
        <HwMessage>{t('st.list.empty')}</HwMessage>
      ) : (
        <div className="space-y-8">
          {groups.filter((x) => x.items.length).map(({ g, items }) => (
            <section key={g} className="space-y-3">
              <h2 className="text-lg font-semibold">{t(`st.list.${g}`)}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {items.map((a) => (
                  <Card key={a.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{a.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">{a.subject} · {marksLabel(t, a.totalMarks)}</p>
                    </CardHeader>
                    <CardContent className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span>{fmt(a.dueAt)}</span>
                        {a.submission?.isLate && <Badge variant="destructive">{t('st.list.late')}</Badge>}
                        {a.status === 'closed' && g === 'pending' && <Badge variant="secondary">{t('st.closed')}</Badge>}
                      </div>
                      <Button asChild size="sm">
                        <Link href={`/dashboard/student/assignments/${a.id}`}>{t('st.list.open')}</Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </HwShell>
  )
}
