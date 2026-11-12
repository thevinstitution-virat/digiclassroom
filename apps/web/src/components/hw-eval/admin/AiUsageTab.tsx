'use client'

// Super admin: the Virat Evaluator's AI usage (packages/core/src/lib/hw/ai-usage.ts). What is running now (provider batches, queued work,
// exam booklets waiting), then tokens and cost: today, this month, and by day, institution, kind of work and model for the chosen window.

import { useState } from 'react'
import { api } from '@/lib/trpc/client'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HwError, HwLoading, HwMessage } from '@/components/hw/HwShell'
import { NativeSelect } from '@/components/hw/fields'

const KIND_LABEL: Record<string, string> = { read: 'Reading handwriting', grade: 'Marking', rubric_draft: 'Rubric drafts' }
const inr = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const tok = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))
const ago = (d: Date | string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60_000))
  return m < 60 ? `${m} min` : m < 48 * 60 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="space-y-1 py-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}

type Totals = { tokensIn: number; tokensCached: number; tokensOut: number; costPaise: number; jobs: number; batchJobs: number; batchCostPaise: number }

function CostByDay({ daily }: { daily: { day: string; totals: Totals }[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(...daily.map((d) => d.totals.costPaise), 1)
  const h = hover === null ? null : daily[hover]!
  return (
    <div className="space-y-2">
      <div className="flex h-5 items-center justify-between text-xs text-muted-foreground">
        <span>{inr(max)}</span>
        {h && <span className="text-foreground">{h.day}: {inr(h.totals.costPaise)} · {tok(h.totals.tokensIn + h.totals.tokensOut)} tokens · {h.totals.jobs} jobs{h.totals.batchJobs ? ` (${h.totals.batchJobs} batch)` : ''}</span>}
      </div>
      <div className="flex h-40 items-end gap-[2px] border-b border-muted-foreground/30" role="img" aria-label="Cost per day">
        {daily.map((d, i) => (
          <div key={d.day} className="flex h-full min-w-0 flex-1 items-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            title={`${d.day}: ${inr(d.totals.costPaise)}`}>
            <div className={`w-full rounded-t-[4px] ${hover === i ? 'bg-primary' : 'bg-primary/70'}`}
              style={{ height: d.totals.costPaise > 0 ? `${Math.max(2, (d.totals.costPaise / max) * 100)}%` : 0 }} />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground"><span>{daily[0]?.day}</span><span>{daily.at(-1)?.day}</span></div>
      <details className="text-sm">
        <summary className="cursor-pointer text-xs text-muted-foreground">Show as a table</summary>
        <table className="mt-2 w-full text-xs tabular-nums">
          <thead><tr className="text-left text-muted-foreground"><th>Day</th><th className="text-right">Jobs</th><th className="text-right">Tokens in</th><th className="text-right">Cached</th><th className="text-right">Tokens out</th><th className="text-right">Cost</th></tr></thead>
          <tbody>{daily.filter((d) => d.totals.jobs > 0).map((d) => (
            <tr key={d.day} className="border-t"><td>{d.day}</td><td className="text-right">{d.totals.jobs}</td><td className="text-right">{tok(d.totals.tokensIn)}</td><td className="text-right">{tok(d.totals.tokensCached)}</td><td className="text-right">{tok(d.totals.tokensOut)}</td><td className="text-right">{inr(d.totals.costPaise)}</td></tr>
          ))}</tbody>
        </table>
      </details>
    </div>
  )
}

function Breakdown({ title, rows }: { title: string; rows: (Totals & { label: string })[] }) {
  const total = rows.reduce((s, r) => s + r.costPaise, 0) || 1
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        {!rows.length ? <p className="text-sm text-muted-foreground">Nothing in this window.</p> : (
          <table className="w-full text-sm tabular-nums">
            <thead><tr className="text-left text-xs text-muted-foreground"><th className="font-normal"> </th><th className="text-right font-normal">Jobs</th><th className="text-right font-normal">Tokens</th><th className="text-right font-normal">Cost</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-t align-top">
                  <td className="py-1.5 pr-2">
                    <span>{r.label}</span>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-muted"><div className="h-full rounded-full bg-primary/70" style={{ width: `${(r.costPaise / total) * 100}%` }} /></div>
                  </td>
                  <td className="py-1.5 text-right">{r.jobs}{r.batchJobs ? <span className="block text-xs text-muted-foreground">{r.batchJobs} batch</span> : null}</td>
                  <td className="py-1.5 text-right">{tok(r.tokensIn + r.tokensOut)}</td>
                  <td className="py-1.5 text-right">{inr(r.costPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  )
}

export function AiUsageTab() {
  const [days, setDays] = useState(30)
  const [showAll, setShowAll] = useState(false)
  const q = api.hwEval.admin.aiUsage.useQuery({ days }, { refetchInterval: 60_000 })
  if (q.isLoading) return <HwLoading />
  if (q.error) return <HwError message={q.error.message} onRetry={() => q.refetch()} />
  const d = q.data!
  const runningBatches = d.now.batches.reduce((s, b) => s + b.batches, 0)
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Virat Evaluator AI only (reading, marking, keys, exam reports). Refreshes every minute.</p>
        <label className="flex items-center gap-2 text-sm">Window
          <NativeSelect value={String(days)} onChange={(e) => setDays(Number(e.target.value))}>
            {[7, 30, 90].map((n) => <option key={n} value={n}>Last {n} days</option>)}
          </NativeSelect>
        </label>
      </div>
      {d.priceProblem && <HwMessage tone="error">Costs may show as ₹0: {d.priceProblem}. Tokens are still counted.</HwMessage>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Tile label="Batches running" value={String(runningBatches)} hint={`${d.now.batches.reduce((s, b) => s + b.jobs, 0)} jobs waiting on the provider`} />
        <Tile label="Jobs queued / running" value={`${d.now.queued} / ${d.now.running}`} />
        <Tile label="Exam booklets in progress" value={String(d.now.exams.uploaded + d.now.exams.evaluating)} hint={d.now.exams.onBatch ? `${d.now.exams.onBatch} on the batch path` : undefined} />
        <Tile label="Cost today" value={inr(d.today.costPaise)} hint={`${tok(d.today.tokensIn + d.today.tokensOut)} tokens`} />
        <Tile label="Cost this month" value={inr(d.month.costPaise)} hint={`${tok(d.month.tokensIn + d.month.tokensOut)} tokens · ${d.month.answersGraded} answers marked`} />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Batches running now</CardTitle></CardHeader>
        <CardContent>
          {!d.now.batches.length ? <p className="text-sm text-muted-foreground">No batch is running.</p> : (
            <ul className="divide-y text-sm">
              {d.now.batches.slice(0, showAll ? undefined : 10).map((b) => (
                <li key={`${b.kind}-${b.organizationId}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>{KIND_LABEL[b.kind] ?? b.kind} · {b.organization}</span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Badge variant="outline">{b.batches} batch{b.batches === 1 ? '' : 'es'}</Badge>{b.jobs} jobs · oldest {ago(b.oldest)} · {b.model ?? '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {d.now.batches.length > 10 && (
            <button type="button" className="mt-2 text-xs text-muted-foreground underline" onClick={() => setShowAll((x) => !x)}>
              {showAll ? 'Show the 10 oldest' : `Show all ${d.now.batches.length} (oldest first)`}
            </button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Cost per day</CardTitle>
          <p className="text-sm text-muted-foreground">
            {d.days} days: {inr(d.window.costPaise)} · {tok(d.window.tokensIn)} in ({tok(d.window.tokensCached)} cached) · {tok(d.window.tokensOut)} out · {d.window.jobs} jobs
            {d.window.batchJobs ? ` · ${d.window.batchJobs} on batch (${inr(d.window.batchCostPaise)})` : ''}
          </p>
        </CardHeader>
        <CardContent><CostByDay daily={d.daily} /></CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Breakdown title="By institution" rows={d.byOrganization.map((r) => ({ ...r, label: r.organization }))} />
        <Breakdown title="By kind of work" rows={d.byKind.map((r) => ({ ...r, label: KIND_LABEL[r.kind] ?? r.kind }))} />
        <Breakdown title="By model" rows={d.byModel.map((r) => ({ ...r, label: r.model }))} />
      </div>
    </div>
  )
}
