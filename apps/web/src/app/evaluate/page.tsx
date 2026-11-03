'use client'

// Evaluator home: the rater's own queue (in their random order), disputed tasks waiting for
// an adjudicator, and writing-pad copy tasks. English and Hindi.

import Link from 'next/link'
import { api } from '@/lib/trpc/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HwError, HwLoading } from '@/components/hw/HwShell'
import { useHwT } from '@/components/hw/strings'
import { EvalShell, kindLabel, useEvalMe } from '@/components/hw-eval/EvalShell'

function Queue() {
  const { t } = useHwT()
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
        <CardHeader className="pb-2"><CardTitle className="text-base">{t('ev.q.title')}</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>{t('ev.q.counts', { n: d.pending.length, done: d.done })}</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(counts).map(([k, n]) => <Badge key={k} variant="secondary">{kindLabel(t, k)}: {n}</Badge>)}
          </div>
          {next
            ? <Button asChild><Link href={`/evaluate/task/${next.assignmentId}`}>{t('ev.q.start', { kind: kindLabel(t, next.kind) })}</Link></Button>
            : <p className="text-muted-foreground">{t('ev.q.none')}</p>}
          <p className="text-xs text-muted-foreground">{t('ev.q.independence')}</p>
        </CardContent>
      </Card>
      {me.data?.skills.includes('adjudicate') && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{t('ev.adj.title')}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {adj.isLoading ? <HwLoading /> : adj.error ? <HwError message={adj.error.message} /> : !adj.data?.length
              ? <p className="text-muted-foreground">{t('ev.adj.none')}</p>
              : (
                <>
                  <p>{t('ev.adj.count', { n: adj.data.length })}</p>
                  <Button asChild variant="outline"><Link href={`/evaluate/adjudicate/${adj.data[0].id}`}>{t('ev.adj.resolve', { kind: kindLabel(t, adj.data[0].kind) })}</Link></Button>
                </>
              )}
          </CardContent>
        </Card>
      )}
      {(me.data?.copyDatasets.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{t('ev.copy.title')}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{t('ev.copy.help')}</p>
            <Button asChild variant="outline"><Link href="/evaluate/copy">{t('ev.copy.open')}</Link></Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function EvaluatePage() {
  const { t } = useHwT()
  return (
    <EvalShell title={t('ev.home.title')} subtitle={t('ev.home.subtitle')}>
      <Queue />
    </EvalShell>
  )
}
