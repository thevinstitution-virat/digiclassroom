'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { api } from '@/lib/trpc/client'
import { Button } from '@/components/ui/button'
import { HwError, HwLoading, HwMessage, HwShell } from '@/components/hw/HwShell'
import { AnswerWorkspace } from '@/components/hw/student/AnswerWorkspace'
import { AfterSubmit } from '@/components/hw/student/AfterSubmit'
import { useHwT } from '@/components/hw/strings'

/** While reading runs, check back this often. */
const POLL_MS = 20_000

export default function StudentAssignmentPage() {
  const { t } = useHwT()
  const { assignmentId } = useParams<{ assignmentId: string }>()
  const start = api.hw.student.start.useMutation()
  const [loaded, setLoaded] = useState(false)

  // `start` is idempotent: it opens the student's draft, or returns the existing submission.
  const load = useCallback(() => start.mutate({ assignmentId }, { onSettled: () => setLoaded(true) }), [assignmentId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  const status = start.data?.submission.status
  useEffect(() => {
    // Self-practice has no teacher to wait for, so the result arrives on its own: keep checking while it is being marked too.
    const waiting = status === 'submitted' || status === 'processing' || (start.data?.practice === true && (status === 'ready_for_review' || status === 'graded'))
    if (!waiting) return
    const h = setInterval(load, POLL_MS)
    return () => clearInterval(h)
  }, [status, load, start.data?.practice])

  const d = start.data
  return (
    <HwShell
      roles={['student']}
      title={d?.assignment.title}
      subtitle={d ? `${d.assignment.subject}${d.assignment.instructions ? ` — ${d.assignment.instructions}` : ''}` : undefined}
      actions={d?.practice
        ? <Button asChild variant="ghost" size="sm"><Link href="/dashboard/user/inkbuddy"><ChevronLeft className="mr-1 h-4 w-4" />{t('pr.back')}</Link></Button>
        : <Button asChild variant="ghost" size="sm"><Link href="/dashboard/student/assignments"><ChevronLeft className="mr-1 h-4 w-4" />{t('common.back')}</Link></Button>}
    >
      {!loaded || (start.isPending && !d) ? <HwLoading /> : start.error && !d ? (
        <HwError message={start.error.message} onRetry={load} />
      ) : !d ? null : d.submission.status === 'draft' ? (
        d.assignment.status === 'closed' ? <HwMessage>{t('st.closed')}</HwMessage> : <AnswerWorkspace data={d} onSubmitted={load} />
      ) : (
        <AfterSubmit data={d} onRetry={load} />
      )}
    </HwShell>
  )
}
