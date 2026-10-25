'use client'

// Evaluator home: the rater's own queue (in their random order), disputed tasks waiting for
// an adjudicator, and writing-pad copy tasks.

import Link from 'next/link'
import { api } from '@/lib/trpc/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HwError, HwLoading } from '@/components/hw/HwShell'
import { EvalShell, KIND_LABEL, useEvalMe } from '@/components/hw-eval/EvalShell'

function Queue() {
  const me = useEvalMe()
  const q = api.hwEval.queue.useQuery(undefined, { enabled: !!me.data?.isRater })
  const adj = api.hwEval.adjudications.useQuery(undefined, { enabled: !!me.data?.skills.includes('adjudicate') })
  if (q.isLoading) return <HwLoading />
  if (q.error) return <HwError message={q.error.message} onRetry={() => q.refetch()} />
  const d = q.data!
  const counts = d.pending.reduce<Record<string, number>>((m, p) => ({ ...m, [p.kind]: (m[p.kind] ?? 0) + 1 }), {})
  const next = d.pending[0]
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Your tasks</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>{d.pending.length} waiting · {d.done} done</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(counts).map(([k, n]) => <Badge key={k} variant="secondary">{KIND_LABEL[k] ?? k}: {n}</Badge>)}
          </div>
          {next
            ? <Button asChild><Link href={`/evaluate/task/${next.assignmentId}`}>Start next task ({KIND_LABEL[next.kind]})</Link></Button>
            : <p className="text-muted-foreground">Nothing waiting. New tasks appear here when they are assigned to you.</p>}
          <p className="text-xs text-muted-foreground">Tasks come in a random order. Work on your own: nobody else&apos;s answer for the same task is shown to you, and nothing from any AI.</p>
        </CardContent>
      </Card>
      {me.data?.skills.includes('adjudicate') && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Disagreements to resolve</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {adj.isLoading ? <HwLoading /> : adj.error ? <HwError message={adj.error.message} /> : !adj.data?.length
              ? <p className="text-muted-foreground">None waiting.</p>
              : (
                <>
                  <p>{adj.data.length} waiting. You only see tasks you did not work on yourself.</p>
                  <Button asChild variant="outline"><Link href={`/evaluate/adjudicate/${adj.data[0].id}`}>Resolve the next one ({KIND_LABEL[adj.data[0].kind]})</Link></Button>
                </>
              )}
          </CardContent>
        </Card>
      )}
      {(me.data?.copyDatasets.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Copy texts on the writing pad</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Write given texts by hand, so the reader can be tested on real handwriting.</p>
            <Button asChild variant="outline"><Link href="/evaluate/copy">Open copy tasks</Link></Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function EvaluatePage() {
  return (
    <EvalShell title="Evaluation" subtitle="Reference work for testing the handwriting reader and the AI marker.">
      <Queue />
    </EvalShell>
  )
}
