'use client'

// One assigned task. Opening it records the start; submitting goes straight to the next one.

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/trpc/client'
import { HwError, HwLoading, HwMessage } from '@/components/hw/HwShell'
import { EvalShell, KIND_LABEL, useEvalMe, useVisibleTime } from '@/components/hw-eval/EvalShell'
import { TaskForm } from '@/components/hw-eval/TaskForms'

function Task({ assignmentId }: { assignmentId: string }) {
  const router = useRouter()
  const utils = api.useUtils()
  // Opening records the start time (once); the view never changes, so it is fetched once.
  const open = api.hwEval.open.useQuery({ assignmentId }, { staleTime: Infinity, refetchOnWindowFocus: false, retry: false })
  const submit = api.hwEval.submit.useMutation()
  const elapsed = useVisibleTime()

  if (open.isLoading) return <HwLoading />
  if (open.error) return <HwError message={open.error.message} onRetry={() => open.refetch()} />
  const view = open.data!.view

  const onSubmit = (payload: Record<string, unknown>) => submit.mutate({ assignmentId, payload, timeMs: elapsed() }, {
    onSuccess: async () => {
      const q = await utils.hwEval.queue.fetch()
      const next = q.pending.find((p) => p.assignmentId !== assignmentId)
      router.push(next ? `/evaluate/task/${next.assignmentId}` : '/evaluate')
    },
  })
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{KIND_LABEL[view.kind]}</p>
      <TaskForm view={view} busy={submit.isPending} submitLabel="Submit" onSubmit={onSubmit} />
      {submit.error && <HwMessage tone="error">{submit.error.message}</HwMessage>}
    </div>
  )
}

export default function TaskPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = use(params)
  const me = useEvalMe()
  return (
    <EvalShell title="Task" back={{ href: '/evaluate', label: 'Your tasks' }}>
      {me.data?.isRater && <Task key={assignmentId} assignmentId={assignmentId} />}
    </EvalShell>
  )
}
