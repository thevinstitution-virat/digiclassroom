'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { api } from '@/lib/trpc/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { HwError, HwLoading, HwShell } from '@/components/hw/HwShell'
import { Builder } from '@/components/hw/teacher/Builder'
import { Overview } from '@/components/hw/teacher/Overview'
import { marksLabel, useHwT } from '@/components/hw/strings'

export default function TeacherAssignmentPage() {
  const { t } = useHwT()
  const { assignmentId } = useParams<{ assignmentId: string }>()
  const q = api.hw.assignments.get.useQuery({ assignmentId })
  const a = q.data?.assignment
  const refetch = () => { void q.refetch() }

  return (
    <HwShell
      roles={['teacher', 'admin']}
      title={a?.title}
      subtitle={a ? `${a.subject} · ${marksLabel(t, q.data!.questions.reduce((s, x) => s + Number(x.marks), 0))}` : undefined}
      actions={
        <>
          {a && <Badge variant={a.status === 'draft' ? 'secondary' : 'default'}>{t(`tc.status.${a.status}`)}</Badge>}
          <Button asChild variant="ghost" size="sm"><Link href="/dashboard/teacher/assignments"><ChevronLeft className="mr-1 h-4 w-4" />{t('common.back')}</Link></Button>
        </>
      }
    >
      {q.isLoading ? <HwLoading /> : q.error ? <HwError message={q.error.message} onRetry={refetch} /> : a!.status === 'draft'
        ? <Builder detail={q.data!} onChanged={refetch} />
        : <Overview detail={q.data!} onChanged={refetch} />}
    </HwShell>
  )
}
