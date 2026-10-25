'use client'

import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { api } from '@/lib/trpc/client'
import { Button } from '@/components/ui/button'
import { HwError, HwLoading, HwShell } from '@/components/hw/HwShell'
import { Marking } from '@/components/hw/teacher/Marking'
import { useHwT } from '@/components/hw/strings'

export default function MarkingPage() {
  const { t } = useHwT()
  const { assignmentId } = useParams<{ assignmentId: string }>()
  const initial = useSearchParams().get('question') ?? undefined
  const q = api.hw.assignments.get.useQuery({ assignmentId })

  return (
    <HwShell
      roles={['teacher', 'admin']}
      titleKey="mk.title"
      subtitle={q.data?.assignment.title}
      actions={<Button asChild variant="ghost" size="sm"><Link href={`/dashboard/teacher/assignments/${assignmentId}`}><ChevronLeft className="mr-1 h-4 w-4" />{t('common.back')}</Link></Button>}
    >
      {q.isLoading ? <HwLoading /> : q.error ? <HwError message={q.error.message} onRetry={() => q.refetch()} /> : (
        <Marking questions={q.data!.questions.map((x) => ({ id: x.id, position: x.position }))} initialQuestionId={initial} />
      )}
    </HwShell>
  )
}
