'use client'

// Monitoring tab (roadmap 5.4), platform owner only: per group, today (Indian time) and the last 7 days; alerts; batch turnaround; quota burn.
// A breach with enough answers takes a group out of "eligible" automatically (the alert says so); the figures are from the daily roll-up,
// which is recomputed every 15 minutes from the product's own tables.

import { Fragment, useState } from 'react'
import { api } from '@/lib/trpc/client'
import type { HwEvalRouterOutputs } from '@/lib/trpc/routers/hw-eval'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HwError, HwLoading } from '@/components/hw/HwShell'
import { STATUS_LABEL, inr, ist, num1, pct, secs } from './format'

type Monitor = HwEvalRouterOutputs['admin']['monitoring']
type Group = Monitor['groups'][number]
type Fig = Group['today']

const ALERT_LABEL: Record<string, string> = {
  override_rate: 'Teachers changed too many suggestions',
  large_override_rate: 'Too many large changes',
  transcript_fix_rate: 'Too many reading corrections',
  failed_job_rate: 'Too many failed marking jobs',
  cost_over_projection: 'Cost above projection',
}

function Cells({ f }: { f: Fig }) {
  const c = f.counts
  const r = f.rates
  return (
    <>
      <td className="pr-3">{c.answers}</td>
      <td className="pr-3">{c.shown}</td>
      <td className="pr-3 whitespace-nowrap">{c.unchanged} / {c.edited} / {c.byHand}{c.byRule ? ` (+${c.byRule} rule)` : ''}</td>
      <td className="pr-3">{pct(r.overrideRate)}{r.meanOverride !== null && <span className="text-xs text-muted-foreground"> · mean {num1(r.meanOverride)}</span>}</td>
      <td className="pr-3">{pct(r.largeOverrideRate)}</td>
      <td className="pr-3">{c.transcriptFixes} / {c.misreadTaps}</td>
      <td className="pr-3">{c.instructionFlags} / {c.instructionNotTaps}</td>
      <td className="pr-3">{c.jobsFailed} / {c.batchFallbacks}</td>
      <td className="pr-3 whitespace-nowrap">{r.paisePerAnswer === null ? '–' : inr(r.paisePerAnswer)}{r.costRatio !== null && <span className="text-xs text-muted-foreground"> · {num1(r.costRatio)}× plan</span>}</td>
    </>
  )
}

const HEAD = ['Answers', 'Shown', 'Kept / edited / by hand', 'Changed', 'Large', 'Fixes / misreads', 'Flags / “not”', 'Failed / fallbacks', '₹ per answer']

function Section({ title, f, extra }: { title: string; f: Fig; extra?: React.ReactNode }) {
  return <tr className="border-t"><td className="py-1 pr-3 text-xs text-muted-foreground">{title}</td><Cells f={f} />{extra}</tr>
}

export function MonitoringTab() {
  const q = api.hwEval.admin.monitoring.useQuery(undefined, { refetchInterval: 60_000 })
  const [open, setOpen] = useState<string | null>(null)
  if (q.isLoading) return <HwLoading />
  if (q.error) return <HwError message={q.error.message} onRetry={() => q.refetch()} />
  const v = q.data!
  const openAlerts = v.alerts.filter((a) => !a.clearedAt)
  const th = v.thresholds

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Alerts</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            Thresholds are provisional until Phase 4 has measured real teachers. Over the last 7 days, on the marking setup running now, with at least {th.minAnswers} answers: more than {pct(th.maxOverrideRate)} of suggestions changed, or more than {pct(th.maxLargeOverrideRate)} changed by a lot, takes the
            group out of “eligible” {v.autoDemote ? 'automatically (and emails you)' : <strong>— automatic demotion is switched off, so you are only emailed</strong>}.
            More than {pct(th.maxTranscriptFixRate)} reading corrections, {pct(th.maxFailedJobRate)} failed jobs or {th.maxCostRatio}× the projected cost only warn.
          </p>
          {!openAlerts.length ? <p>No open alerts.</p> : (
            <ul className="space-y-2">
              {openAlerts.map((a) => (
                <li key={a.id} className={`rounded border p-2 ${a.severity === 'demote' ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'}`}>
                  <div className="font-medium">{a.label} — {ALERT_LABEL[a.code] ?? a.code}</div>
                  <div>{pct(a.value, 1)} against a limit of {pct(a.threshold, 1)} ({a.sampleSize} in the sample). {a.demoted ? 'Taken out of “eligible” automatically.' : ''}</div>
                  <div className="text-xs text-muted-foreground">Raised {ist(a.raisedAt)}{a.emailedAt ? ` · emailed ${ist(a.emailedAt)}` : ' · not emailed yet'}</div>
                </li>
              ))}
            </ul>
          )}
          {v.alerts.some((a) => a.clearedAt) && <p className="text-xs text-muted-foreground">{v.alerts.filter((a) => a.clearedAt).length} earlier alert(s) in the last 30 days have cleared.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Groups</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            “Kept / edited / by hand” is what teachers did with the AI suggestion; “Shown” is answers that had one in front of the teacher. Today is {v.today} (India).
            Turnaround is the batch API’s own recorded time over 7 days.
          </p>
          {!v.groups.length ? <p>No marking recorded yet in the last 7 days.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-xs text-muted-foreground"><tr><th className="py-1 pr-3">Group</th>{HEAD.map((h) => <th key={h} className="pr-3">{h}</th>)}<th /></tr></thead>
                <tbody>
                  {v.groups.map((g) => (
                    <Fragment key={g.groupKey}>
                      <tr className="border-t align-top">
                        <td className="py-2 pr-3 font-medium">{g.label}<br /><Badge variant={g.effective === 'eligible' ? 'default' : 'outline'}>{STATUS_LABEL[g.effective] ?? g.effective}</Badge></td>
                        <Cells f={g.last7} />
                        <td><Button size="sm" variant="outline" onClick={() => setOpen(open === g.groupKey ? null : g.groupKey)}>{open === g.groupKey ? 'Close' : 'Days'}</Button></td>
                      </tr>
                      {open === g.groupKey && (
                        <tr><td colSpan={HEAD.length + 2} className="bg-muted/30 p-2">
                          <table className="w-full text-left text-xs">
                            <thead className="text-muted-foreground"><tr><th className="pr-3">Day (IST)</th>{HEAD.map((h) => <th key={h} className="pr-3">{h}</th>)}</tr></thead>
                            <tbody>
                              <Section title="Last 7 days" f={g.last7} />
                              <Section title={`Today ${v.today}`} f={g.today} />
                              {g.byDay.filter((d) => d.day !== v.today).map((d) => <Section key={d.day} title={d.day} f={d} />)}
                            </tbody>
                          </table>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Batch turnaround, {g.turnaround.n} marking batches: median {secs(g.turnaround.p50)}, 90th percentile {secs(g.turnaround.p90)}.
                          </p>
                        </td></tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Quota burn per institution (this month, India)</CardTitle></CardHeader>
        <CardContent className="text-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-xs text-muted-foreground"><tr><th className="py-1 pr-3">Institution</th><th className="pr-3">Used</th><th className="pr-3">Budget</th><th className="pr-3">Used of budget</th><th className="pr-3">At this pace by month end</th></tr></thead>
              <tbody>
                {v.tenants.map((t) => (
                  <tr key={t.organizationId} className="border-t">
                    <td className="py-1 pr-3 font-medium">{t.name}</td>
                    <td className="pr-3">{inr(t.usedPaise)}</td>
                    <td className="pr-3">{t.budgetPaise ? inr(t.budgetPaise) : 'none'}</td>
                    <td className="pr-3">{t.fraction === null ? '–' : <span className={t.exhausted ? 'text-red-700' : t.warn ? 'text-amber-700' : ''}>{pct(t.fraction)}{t.exhausted ? ' · used up' : t.warn ? ' · over 80%' : ''}</span>}</td>
                    <td className="pr-3">{t.projectedMonthPaise === null ? '–' : inr(t.projectedMonthPaise)}</td>
                  </tr>
                ))}
                {!v.tenants.length && <tr><td colSpan={5} className="py-2 text-muted-foreground">No institution has the feature on yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
