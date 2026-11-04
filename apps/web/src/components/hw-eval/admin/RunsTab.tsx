'use client'

// Runs & gates tab (roadmap 5.5), read-only. Everything here was imported from the command line's own report.json
// (npm run hw:eval:gates -- import); nothing is recalculated, so it cannot disagree with npm run hw:eval:report.

import { Fragment, useState } from 'react'
import { api } from '@/lib/trpc/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HwError, HwLoading } from '@/components/hw/HwShell'
import { STATUS_LABEL, inr, ist } from './format'

const STATE: Record<string, string> = { pass: 'text-emerald-700', fail: 'text-red-700', insufficient: 'text-amber-700', not_applicable: 'text-muted-foreground' }

export function RunsTab() {
  const q = api.hwEval.admin.runsAndGates.useQuery()
  const [open, setOpen] = useState<string | null>(null)
  if (q.isLoading) return <HwLoading />
  if (q.error) return <HwError message={q.error.message} onRetry={() => q.refetch()} />
  const v = q.data!

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Gate tables</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">The newest imported result for each group, exactly as the report has it. Older results are kept.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-xs text-muted-foreground"><tr><th className="py-1 pr-3">Group</th><th className="pr-3">Verdict</th><th className="pr-3">Dataset</th><th className="pr-3">Imported</th><th /></tr></thead>
              <tbody>
                {v.gates.map((g) => (
                  <Fragment key={g.id}>
                    <tr className="border-t align-top">
                      <td className="py-2 pr-3 font-medium">{g.groupKey.split('|').map((p) => p.replace('_', ' ')).join(' · ')}</td>
                      <td className="pr-3"><Badge variant={g.verdict === 'eligible' ? 'default' : 'outline'}>{STATUS_LABEL[g.verdict] ?? g.verdict}</Badge></td>
                      <td className="pr-3">{g.datasetVersions.join(', ')}</td>
                      <td className="pr-3 text-xs">{ist(g.importedAt)}{g.earlier > 0 && <><br />{g.earlier} older</>}</td>
                      <td><Button size="sm" variant="outline" onClick={() => setOpen(open === g.id ? null : g.id)}>{open === g.id ? 'Close' : 'Checks'}</Button></td>
                    </tr>
                    {open === g.id && (
                      <tr><td colSpan={5} className="bg-muted/30 p-2">
                        <table className="w-full text-left text-xs">
                          <thead className="text-muted-foreground"><tr><th className="pr-3">Check</th><th className="pr-3">State</th><th>Detail</th></tr></thead>
                          <tbody>{g.checks.map((c, i) => <tr key={i} className="border-t"><td className="py-1 pr-3">{c.gate}</td><td className={`pr-3 ${STATE[c.state] ?? ''}`}>{c.state.replace('_', ' ')}</td><td>{c.detail}</td></tr>)}</tbody>
                        </table>
                        <p className="mt-2 text-xs text-muted-foreground">Runs: {g.runIds.join(', ')} · setup measured: <code>{g.productionFingerprint ? g.productionFingerprint.slice(0, 12) : 'not recorded'}</code></p>
                      </td></tr>
                    )}
                  </Fragment>
                ))}
                {!v.gates.length && <tr><td colSpan={5} className="py-2 text-muted-foreground">Nothing imported yet. Run <code>npm run hw:eval:report</code>, then <code>npm run hw:eval:gates -- import --report …/report.json --scheme-source …</code>.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Regression gate</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">The result of <code>npm run hw:eval:regression</code> for a candidate run against its baseline, as the command wrote it. A change to a reader or marking setup needs a passing result before it is promoted.</p>
          {v.regressions.map((r) => {
            const checks = r.checks as Array<{ metric: string; baseline: number; candidate: number; ok: boolean; limit?: string; n?: number; delta?: { estimate: number; lower: number; upper: number } }>
            return (
              <div key={r.id} className="rounded border p-2">
                <div className="flex flex-wrap items-center gap-2"><Badge variant={r.ok ? 'default' : 'outline'}>{r.ok ? 'Pass' : 'Fail'}</Badge><span className="font-mono text-xs">{r.candidateRunId}</span><span className="text-muted-foreground">against</span><span className="font-mono text-xs">{r.baselineRunId}</span><span className="text-xs text-muted-foreground">{r.datasetRef} · {ist(r.importedAt)}</span></div>
                <table className="mt-1 w-full text-left text-xs"><tbody>
                  {checks.map((c, i) => <tr key={i} className="border-t"><td className="py-0.5 pr-3">{c.ok ? '✓' : '✗'} {c.metric}</td><td className="pr-3">{Number.isFinite(c.baseline) ? c.baseline.toFixed(4) : '–'} → {Number.isFinite(c.candidate) ? c.candidate.toFixed(4) : 'not measured'}</td><td>{c.delta ? `change ${c.delta.estimate.toFixed(4)} [${c.delta.lower.toFixed(4)}, ${c.delta.upper.toFixed(4)}], n=${c.n ?? ''}` : c.limit ?? ''}</td></tr>)}
                </tbody></table>
              </div>
            )
          })}
          {!v.regressions.length && <p className="text-muted-foreground">None imported yet. After <code>npm run hw:eval:regression</code>, run <code>npm run hw:eval:gates -- import-regression --file …/regression.json</code>.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Dataset versions</CardTitle></CardHeader>
        <CardContent className="text-sm">
          <table className="w-full text-left">
            <thead className="text-xs text-muted-foreground"><tr><th className="py-1 pr-3">Dataset</th><th className="pr-3">Runs imported</th><th className="pr-3">Manifest</th><th>Last import</th></tr></thead>
            <tbody>
              {v.datasets.map((d) => <tr key={d.datasetRef} className="border-t"><td className="py-1 pr-3 font-medium">{d.datasetRef}</td><td className="pr-3">{d.runs}</td><td className="pr-3"><code>{d.manifestSha256 ? d.manifestSha256.slice(0, 12) : '–'}</code></td><td>{ist(d.lastImportedAt)}</td></tr>)}
              {!v.datasets.length && <tr><td colSpan={4} className="py-2 text-muted-foreground">None.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Runs</CardTitle></CardHeader>
        <CardContent className="text-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-xs text-muted-foreground"><tr><th className="py-1 pr-3">Run</th><th className="pr-3">Mode</th><th className="pr-3">Status</th><th className="pr-3">Dataset</th><th className="pr-3">Repeat</th><th className="pr-3">Cost</th><th className="pr-3">Items</th><th>Setup</th></tr></thead>
              <tbody>
                {v.runs.map((r) => (
                  <tr key={r.runId} className="border-t">
                    <td className="py-1 pr-3 font-mono text-xs">{r.runId}</td><td className="pr-3">{r.mode}</td><td className="pr-3">{r.status}</td><td className="pr-3">{r.datasetRef}</td>
                    <td className="pr-3">{r.repeat ?? '–'}</td><td className="pr-3">{inr(r.costPaise)}</td>
                    <td className="pr-3 text-xs">{Object.entries(r.counts).map(([k, n]) => `${k} ${n}`).join(' · ')}</td>
                    <td><code>{r.configHash ? r.configHash.slice(0, 8) : '–'}</code></td>
                  </tr>
                ))}
                {!v.runs.length && <tr><td colSpan={8} className="py-2 text-muted-foreground">None.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Shadow-mode results stay on the command line (<code>npm run hw:eval:live</code>) by design: they hold real students' predicted text.</p>
        </CardContent>
      </Card>
    </div>
  )
}
