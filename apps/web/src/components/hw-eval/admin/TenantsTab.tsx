'use client'

// Tenants tab (roadmap 5.1), platform owner only. Per institution: the feature switch, an optional list of classes and sections it is
// switched on for, a monthly AI budget in rupees, and this month's use. Every save asks for a reason and writes an audit row; the
// history of an institution is shown under its editor. The institution admin sees the same use numbers on their own page.

import { Fragment, useMemo, useState } from 'react'
import { api } from '@/lib/trpc/client'
import type { HwEvalRouterOutputs } from '@/lib/trpc/routers/hw-eval'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { HwError, HwLoading, HwMessage } from '@/components/hw/HwShell'
import { Field } from '@/components/hw/fields'

type Tenant = HwEvalRouterOutputs['admin']['tenants'][number]

export const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function UseBar({ u }: { u: Tenant['usage'] }) {
  if (u.fraction === null) return <span className="text-muted-foreground">no budget · {rupees(u.costPaise)} used</span>
  const pct = Math.min(100, Math.round(u.fraction * 100))
  return (
    <span className="block min-w-[10rem]">
      <span className="block h-2 w-full overflow-hidden rounded bg-muted" aria-hidden>
        <span className={`block h-2 ${u.exhausted ? 'bg-red-600' : u.warn ? 'bg-amber-500' : 'bg-emerald-600'}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="text-xs">{rupees(u.costPaise)} of {rupees(u.budgetPaise)} ({Math.round(u.fraction * 100)}%){u.exhausted ? ' · used up' : u.warn ? ' · over 80%' : ''}</span>
    </span>
  )
}

function History({ organizationId }: { organizationId: string }) {
  const h = api.hwEval.admin.tenantHistory.useQuery({ organizationId })
  if (h.isLoading) return <HwLoading />
  if (h.error) return <HwError message={h.error.message} onRetry={() => h.refetch()} />
  if (!h.data!.length) return <p className="text-muted-foreground">No changes recorded yet.</p>
  return (
    <ul className="space-y-2">
      {h.data!.map((r) => {
        const o = (r.oldValue ?? {}) as Record<string, unknown>
        const n = (r.newValue ?? {}) as Record<string, unknown>
        const changes = Object.keys(n).filter((k) => JSON.stringify(o[k]) !== JSON.stringify(n[k]))
          .map((k) => k === 'monthlyBudgetPaise' ? `budget ${rupees(Number(o[k] ?? 0))} → ${rupees(Number(n[k]))}` : k === 'scope' ? `classes ${(o[k] as unknown[] | undefined)?.length ?? 0} → ${(n[k] as unknown[]).length}` : `${k}: ${String(o[k])} → ${String(n[k])}`)
        return (
          <li key={r.id} className="rounded border p-2">
            <div className="text-xs text-muted-foreground">{new Date(r.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST · {r.actorId}</div>
            <div>{changes.join('; ') || r.action}</div>
            <div className="text-muted-foreground">Reason: {r.reason}</div>
          </li>
        )
      })}
    </ul>
  )
}

function Editor({ t, onDone }: { t: Tenant; onDone: () => void }) {
  const utils = api.useUtils()
  const save = api.hwEval.admin.setTenant.useMutation({ onSuccess: () => { utils.hwEval.admin.tenants.invalidate(); utils.hwEval.admin.tenantHistory.invalidate({ organizationId: t.organizationId }); setReason('') } })
  const [enabled, setEnabled] = useState(t.enabled)
  const [budget, setBudget] = useState(t.usage.budgetPaise ? String(t.usage.budgetPaise / 100) : '')
  const [restricted, setRestricted] = useState(t.scopeRestricted)
  const [reason, setReason] = useState('')
  // class id -> 'all' | Set of section ids
  const [picked, setPicked] = useState<Record<string, 'all' | string[]>>(() => {
    const out: Record<string, 'all' | string[]> = {}
    for (const e of t.scope) {
      if (e.sectionId === null) out[e.classId] = 'all'
      else if (out[e.classId] !== 'all') out[e.classId] = [...((out[e.classId] as string[] | undefined) ?? []), e.sectionId]
    }
    return out
  })
  const paise = budget.trim() === '' ? 0 : Math.round(Number(budget) * 100)
  const budgetOk = Number.isFinite(paise) && paise >= 0
  const scope = useMemo(() => Object.entries(picked).flatMap(([classId, v]): Array<{ classId: string; sectionId: string | null }> => v === 'all' ? [{ classId, sectionId: null }] : v.map((sectionId) => ({ classId, sectionId }))), [picked])
  const ready = budgetOk && reason.trim().length >= 3 && (!restricted || scope.length > 0)

  return (
    <div className="space-y-4 border-t bg-muted/30 p-3 text-sm">
      <label className="flex items-center gap-2"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Handwritten assignments are switched on for this institution</label>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Monthly AI budget (₹)" hint="Counted per Indian-time month. Empty or 0 = no budget; the older answer-count quota applies.">
          <Input inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. 500" />
        </Field>
        <Field label="Why are you changing this?" hint="At least 3 characters. Saved in the audit trail.">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
        </Field>
      </div>
      <div>
        <label className="flex items-center gap-2"><input type="checkbox" checked={restricted} onChange={(e) => setRestricted(e.target.checked)} /> Switch on for some classes only</label>
        {restricted && (
          <div className="mt-2 space-y-2">
            {!t.classes.length && <p className="text-muted-foreground">This institution has no classes.</p>}
            {t.classes.map((c) => {
              const v = picked[c.id]
              return (
                <div key={c.id} className="rounded border bg-background p-2">
                  <label className="flex items-center gap-2 font-medium">
                    <input type="checkbox" checked={v === 'all'} onChange={(e) => setPicked((p) => { const n = { ...p }; if (e.target.checked) n[c.id] = 'all'; else delete n[c.id]; return n })} />
                    {c.name} <span className="font-normal text-muted-foreground">(all sections)</span>
                  </label>
                  {v !== 'all' && c.sections.length > 0 && (
                    <div className="ml-6 mt-1 flex flex-wrap gap-3">
                      {c.sections.map((s) => (
                        <label key={s.id} className="flex items-center gap-1">
                          <input type="checkbox" checked={Array.isArray(v) && v.includes(s.id)} onChange={(e) => setPicked((p) => {
                            const cur = Array.isArray(p[c.id]) ? (p[c.id] as string[]) : []
                            const next = e.target.checked ? [...cur, s.id] : cur.filter((x) => x !== s.id)
                            const n = { ...p }
                            if (next.length) n[c.id] = next; else delete n[c.id]
                            return n
                          })} /> {s.name}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            {restricted && scope.length === 0 && <HwMessage tone="error">Choose at least one class, or untick the class limit.</HwMessage>}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={!ready || save.isPending} onClick={() => save.mutate({ organizationId: t.organizationId, enabled, monthlyBudgetPaise: paise, scopeRestricted: restricted, scope, reason: reason.trim() })}>Save</Button>
        <Button variant="outline" onClick={onDone}>Close</Button>
        {save.data && <span className="text-emerald-700">{save.data.changed ? 'Saved and recorded.' : 'Nothing changed.'}</span>}
      </div>
      {save.error && <HwMessage tone="error">{save.error.message}</HwMessage>}
      <div>
        <h4 className="mb-1 font-medium">History</h4>
        <History organizationId={t.organizationId} />
      </div>
    </div>
  )
}

export function TenantsTab() {
  const list = api.hwEval.admin.tenants.useQuery()
  const [open, setOpen] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const rows = (list.data ?? []).filter((t) => t.name.toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Tenants</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          One row per institution. At 80% of the budget the institution admin sees a warning; at 100% new answers wait for the teacher with the reason
          “AI quota reached”. Months run on Indian Standard Time.
        </p>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an institution" className="max-w-xs" aria-label="Find an institution" />
        {list.isLoading ? <HwLoading /> : list.error ? <HwError message={list.error.message} onRetry={() => list.refetch()} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-xs text-muted-foreground"><tr><th className="py-1 pr-3">Institution</th><th className="pr-3">Feature</th><th className="pr-3">Classes</th><th className="pr-3">This month</th><th className="pr-3">Use</th><th /></tr></thead>
              <tbody>
                {rows.map((t) => (
                  <Fragment key={t.organizationId}>
                    <tr className="border-t align-top">
                      <td className="py-2 pr-3 font-medium">{t.name}</td>
                      <td className="pr-3">{t.enabled ? <Badge>on</Badge> : <Badge variant="outline">off</Badge>}{t.isDefault && <span className="ml-1 text-xs text-muted-foreground">(default)</span>}</td>
                      <td className="pr-3">{t.scopeRestricted ? `${t.scope.length} listed` : 'all'}</td>
                      <td className="pr-3">{t.usage.pagesRead} pages · {t.usage.answersGraded} answers</td>
                      <td className="pr-3"><UseBar u={t.usage} /></td>
                      <td><Button size="sm" variant="outline" onClick={() => setOpen(open === t.organizationId ? null : t.organizationId)}>{open === t.organizationId ? 'Close' : 'Edit'}</Button></td>
                    </tr>
                    {open === t.organizationId && <tr><td colSpan={6} className="p-0"><Editor t={t} onDone={() => setOpen(null)} /></td></tr>}
                  </Fragment>
                ))}
                {!rows.length && <tr><td colSpan={6} className="py-2 text-muted-foreground">No institutions found.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
