'use client'

// Eligibility tab (roadmap 5.3), platform owner only. One row per group (subject x question type x language x scheme source). AI suggestions
// are created and shown only for a group that is "Eligible" for the marking setup running now. A group is promoted from a passing gate result
// measured on that setup, with a typed reason and a confirmation; it is demoted by a person with a reason, or by the system (monitoring, or a
// newer failing gate result). Every change is in the history and the audit trail.

import { Fragment, useState } from 'react'
import { api } from '@/lib/trpc/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { HwError, HwLoading, HwMessage } from '@/components/hw/HwShell'
import { Field } from '@/components/hw/fields'
import { STATUS_LABEL, ist } from './format'

const tone = (s: string) => (s === 'eligible' ? 'default' : 'outline') as 'default' | 'outline'

function Detail({ groupKey, effective, runningHash }: { groupKey: string; effective: string; runningHash: string | null }) {
  const utils = api.useUtils()
  const history = api.hwEval.admin.eligibilityHistory.useQuery({ groupKey })
  const results = api.hwEval.admin.gateResults.useQuery({ groupKey })
  const refresh = () => { void utils.hwEval.admin.eligibility.invalidate(); void utils.hwEval.admin.eligibilityHistory.invalidate({ groupKey }) }
  const promote = api.hwEval.admin.promote.useMutation({ onSuccess: () => { refresh(); setReason(''); setConfirm(false) } })
  const demote = api.hwEval.admin.demote.useMutation({ onSuccess: () => { refresh(); setReason('') } })
  const [pick, setPick] = useState('')
  const [reason, setReason] = useState('')
  const [confirm, setConfirm] = useState(false)
  // A result can promote only if it passed AND measured the setup running now.
  const usable = (results.data ?? []).filter((g) => g.verdict === 'eligible' && g.productionFingerprint && g.productionFingerprint === runningHash)

  return (
    <div className="space-y-4 border-t bg-muted/30 p-3 text-sm">
      <div>
        <h4 className="mb-1 font-medium">Gate results for this group (newest first)</h4>
        {results.isLoading ? <HwLoading /> : results.error ? <HwError message={results.error.message} /> : !results.data!.length ? <p className="text-muted-foreground">None imported. Import a report with <code>npm run hw:eval:gates -- import</code>.</p> : (
          <ul className="space-y-1">
            {results.data!.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center gap-2">
                <Badge variant={tone(g.verdict)}>{STATUS_LABEL[g.verdict] ?? g.verdict}</Badge>
                <span className="text-xs text-muted-foreground">{ist(g.importedAt)} · {g.datasetVersions.join(', ')}</span>
                {g.productionFingerprint === runningHash ? <span className="text-xs text-emerald-700">measured on the setup running now</span> : <span className="text-xs text-amber-700">measured on a different setup</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {effective !== 'eligible' && (
        <div className="space-y-2">
          <h4 className="font-medium">Promote</h4>
          {!usable.length
            ? <p className="text-muted-foreground">No passing gate result for the marking setup running now, so this group cannot be promoted. Run the gates on the running setup, then import the report.</p>
            : (
              <>
                <Field label="Gate result"><select className="h-9 w-full rounded-md border bg-background px-2" value={pick} onChange={(e) => setPick(e.target.value)}>
                  <option value="" />
                  {usable.map((g) => <option key={g.id} value={g.id}>{ist(g.importedAt)} · {g.datasetVersions.join(', ')}</option>)}
                </select></Field>
                <Field label="Reason" hint="A sentence, at least 10 characters. It is kept in the history."><Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} /></Field>
                <label className="flex items-center gap-2"><input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} /> I confirm: AI suggestions will be created and shown to teachers for this group.</label>
                <Button disabled={!pick || reason.trim().length < 10 || !confirm || promote.isPending} onClick={() => promote.mutate({ groupKey, gateResultId: pick, reason: reason.trim(), confirm })}>Promote to eligible</Button>
              </>
            )}
          {promote.data && <HwMessage>Promoted. {promote.data.requeuedQuestions} question(s) that were waiting for the teacher are being marked now.</HwMessage>}
          {promote.error && <HwMessage tone="error">{promote.error.message}</HwMessage>}
        </div>
      )}

      {effective === 'eligible' && (
        <div className="space-y-2">
          <h4 className="font-medium">Demote</h4>
          <Field label="Reason" hint="Why this group should stop getting AI suggestions."><Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} /></Field>
          <Button variant="outline" disabled={reason.trim().length < 3 || demote.isPending} onClick={() => demote.mutate({ groupKey, reason: reason.trim() })}>Demote to “not yet”</Button>
          {demote.error && <HwMessage tone="error">{demote.error.message}</HwMessage>}
        </div>
      )}

      <div>
        <h4 className="mb-1 font-medium">History</h4>
        {history.isLoading ? <HwLoading /> : history.error ? <HwError message={history.error.message} /> : !history.data!.length ? <p className="text-muted-foreground">No changes yet.</p> : (
          <ul className="space-y-1">
            {history.data!.map((h) => (
              <li key={h.id} className="rounded border bg-background p-2">
                <div className="text-xs text-muted-foreground">{ist(h.at)} · {h.automatic ? 'the system' : h.actorId}</div>
                <div>{STATUS_LABEL[h.fromStatus] ?? h.fromStatus} → <strong>{STATUS_LABEL[h.toStatus] ?? h.toStatus}</strong></div>
                <div className="text-muted-foreground">{h.reason}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export function EligibilityTab() {
  const list = api.hwEval.admin.eligibility.useQuery()
  const all = api.hwEval.admin.gateResults.useQuery({})
  const [open, setOpen] = useState<string | null>(null)
  const registry = new Map((list.data?.rows ?? []).map((r) => [r.groupKey, r]))
  // Groups that have a gate result but no registry row yet (a passing result alone records nothing) are listed too, so they can be promoted.
  const keys = [...new Set([...registry.keys(), ...(all.data ?? []).map((g) => g.groupKey)])].sort()
  const label = (k: string) => k.split('|').map((p) => p.replace('_', ' ')).join(' · ')

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Eligibility</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          A group gets AI marking suggestions only while it is <strong>Eligible</strong> for the marking setup running now. Anything else is marked by hand,
          with the reason shown to the teacher. Rules in code (exact answers, blanks) are not suggestions and always apply.
        </p>
        {list.data && <p className="text-xs text-muted-foreground">Running setup: <code>{list.data.runningHash ? list.data.runningHash.slice(0, 12) : 'no grade model configured'}</code></p>}
        {list.isLoading || all.isLoading ? <HwLoading /> : list.error ? <HwError message={list.error.message} onRetry={() => list.refetch()} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-xs text-muted-foreground"><tr><th className="py-1 pr-3">Group</th><th className="pr-3">Now</th><th className="pr-3">Decided</th><th /></tr></thead>
              <tbody>
                {keys.map((k) => {
                  const r = registry.get(k)
                  const eff = r ? r.effective : 'no_record'
                  return (
                    <Fragment key={k}>
                      <tr className="border-t align-top">
                        <td className="py-2 pr-3 font-medium">{label(k)}</td>
                        <td className="pr-3"><Badge variant={tone(eff)}>{STATUS_LABEL[eff] ?? eff}</Badge></td>
                        <td className="pr-3 text-xs text-muted-foreground">{r ? <>{ist(r.decidedAt)}<br />{r.reason}</> : '–'}</td>
                        <td><Button size="sm" variant="outline" onClick={() => setOpen(open === k ? null : k)}>{open === k ? 'Close' : 'Open'}</Button></td>
                      </tr>
                      {open === k && <tr><td colSpan={4} className="p-0"><Detail groupKey={k} effective={eff} runningHash={list.data?.runningHash ?? null} /></td></tr>}
                    </Fragment>
                  )
                })}
                {!keys.length && <tr><td colSpan={4} className="py-2 text-muted-foreground">No groups yet. Import a gate report with <code>npm run hw:eval:gates -- import</code>.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
