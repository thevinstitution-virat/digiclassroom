'use client'

// Resolving a disagreement: the task as the raters saw it, both answers as "Rater A / B",
// the differences, and the same form pre-filled with Rater A's answer to correct.

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { api } from '@/lib/trpc/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { HwError, HwLoading, HwMessage } from '@/components/hw/HwShell'
import { EvalShell, KIND_LABEL, useEvalMe, useVisibleTime } from '@/components/hw-eval/EvalShell'
import { TaskForm } from '@/components/hw-eval/TaskForms'
import type { HwEvalRouterOutputs } from '@/lib/trpc/routers/hw-eval'

type Adj = HwEvalRouterOutputs['openAdjudication']

function WordDiff({ ops }: { ops: NonNullable<Adj['diff']> extends infer D ? D extends { words: infer W } ? W : never : never }) {
  return (
    <p className="leading-8">
      {ops.map((o, i) => o.op === 'match'
        ? <span key={i}>{o.truth} </span>
        : (
          <span key={i} className="mr-1 rounded bg-amber-100 px-1 dark:bg-amber-900/40">
            <span className="text-blue-700 dark:text-blue-300">A: {o.truth ?? '∅'}</span>{' '}
            <span className="text-fuchsia-700 dark:text-fuchsia-300">B: {o.out ?? '∅'}</span>
          </span>
        ))}
    </p>
  )
}

function Resolve({ taskId }: { taskId: string }) {
  const router = useRouter()
  const utils = api.useUtils()
  const q = api.hwEval.openAdjudication.useQuery({ taskId }, { refetchOnWindowFocus: false })
  const save = api.hwEval.adjudicate.useMutation()
  const [reason, setReason] = useState('')
  const elapsed = useVisibleTime()
  if (q.isLoading) return <HwLoading />
  if (q.error) return <HwError message={q.error.message} onRetry={() => q.refetch()} />
  const d = q.data!
  const diff = d.diff as { words?: Parameters<typeof WordDiff>[0]['ops']; marks?: { pointId: string; a: number; b: number }[] } | null

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">{KIND_LABEL[d.view.kind]}: the raters disagreed</p>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">What differs</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {diff?.words && <WordDiff ops={diff.words} />}
          {diff?.marks && (
            <ul className="list-disc pl-5">
              {diff.marks.map((m) => <li key={m.pointId}>{m.pointId}: Rater A gave {m.a ?? '—'}, Rater B gave {m.b ?? '—'}</li>)}
            </ul>
          )}
          {!diff && d.submissions.map((s) => (
            <details key={s.label} className="rounded-md border p-2">
              <summary className="cursor-pointer font-medium">{s.label}</summary>
              <pre className="mt-2 whitespace-pre-wrap text-xs">{JSON.stringify(s.payload, null, 2)}</pre>
            </details>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Your decision (starts from Rater A&apos;s answer)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Why, in a line (required): e.g. 'line 3 reads pressure, B is right'" />
          <TaskForm view={d.view} initial={d.submissions[0]?.payload} busy={save.isPending || !reason.trim()} submitLabel="Save decision"
            onSubmit={(payload) => save.mutate({ taskId, payload, reason, timeMs: elapsed() }, {
              onSuccess: async () => {
                const next = (await utils.hwEval.adjudications.fetch()).find((t) => t.id !== taskId)
                router.push(next ? `/evaluate/adjudicate/${next.id}` : '/evaluate')
              },
            })} />
          {save.error && <HwMessage tone="error">{save.error.message}</HwMessage>}
        </CardContent>
      </Card>
    </div>
  )
}

export default function AdjudicatePage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = use(params)
  const me = useEvalMe()
  return (
    <EvalShell title="Resolve a disagreement" back={{ href: '/evaluate', label: 'Your tasks' }}>
      {me.data?.isRater && <Resolve key={taskId} taskId={taskId} />}
    </EvalShell>
  )
}
