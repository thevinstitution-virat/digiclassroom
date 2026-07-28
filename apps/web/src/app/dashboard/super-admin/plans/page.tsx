'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CreditCard, Plus, Pencil, Trash2, Check, X, Loader2, Sparkles } from 'lucide-react'

interface Plan {
  id: string
  plan_name: string
  plan_code: string
  plan_type: string
  board: string
  class_access_type: string
  monthly_price: number
  daily_question_limit: number
  features: string[]
  display_name: string
  description: string
  highlight_text: string
  display_order: number
  is_active: boolean
  is_featured: boolean
}

const blank: Plan = {
  id: '', plan_name: '', plan_code: '', plan_type: 'class_access', board: 'ALL', class_access_type: 'single',
  monthly_price: 0, daily_question_limit: 30, features: [], display_name: '', description: '', highlight_text: '',
  display_order: 0, is_active: true, is_featured: false,
}

const BOARDS = ['ALL', 'CBSE', 'ICSE', 'STATE_BOARD']
const PLAN_TYPES = ['free_trial', 'board_access', 'class_access', 'subject_bundle', 'full_access']

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Plan | null>(null)
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/super-admin/plans')
      const data = await res.json()
      if (data.success) setPlans(data.plans)
      else setError(data.error || 'Failed to load plans')
    } catch { setError('Failed to load plans') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!editing) return
    if (!editing.plan_name || !editing.plan_code || !editing.display_name) { setError('Name, code and display name are required'); return }
    setSaving(true); setError(null)
    try {
      const isNew = !editing.id
      const res = await fetch(isNew ? '/api/super-admin/plans' : `/api/super-admin/plans/${editing.id}`, {
        method: isNew ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing),
      })
      const data = await res.json()
      if (data.success) { setEditing(null); load() } else setError(data.error || 'Save failed')
    } catch { setError('Save failed') } finally { setSaving(false) }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this plan?')) return
    await fetch(`/api/super-admin/plans/${id}`, { method: 'DELETE' })
    load()
  }

  const seedDefaults = async () => {
    setSeeding(true); setError(null)
    try {
      const res = await fetch('/api/super-admin/plans/seed-defaults', { method: 'POST' })
      const data = await res.json()
      if (data.success) load(); else setError(data.error || 'Seed failed')
    } catch { setError('Seed failed') } finally { setSeeding(false) }
  }

  const set = (patch: Partial<Plan>) => setEditing((e) => (e ? { ...e, ...patch } : e))

  if (editing) {
    return (
      <div className="space-y-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground"><CreditCard className="h-6 w-6 text-primary" /> {editing.id ? 'Edit' : 'New'} plan</h1>
        {error && <Alert className="border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/30"><X className="h-4 w-4 text-rose-600" /><AlertDescription className="text-rose-800 dark:text-rose-300">{error}</AlertDescription></Alert>}
        <Card>
          <CardContent className="space-y-5 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Display name *"><Input value={editing.display_name} onChange={(e) => set({ display_name: e.target.value })} placeholder="Classic" /></Field>
              <Field label="Internal name *"><Input value={editing.plan_name} onChange={(e) => set({ plan_name: e.target.value })} placeholder="Classic" /></Field>
              <Field label="Plan code * (UPPERCASE)"><Input value={editing.plan_code} onChange={(e) => set({ plan_code: e.target.value.toUpperCase() })} placeholder="CLASSIC" /></Field>
              <Field label="Monthly price (₹)"><Input type="number" min={0} value={editing.monthly_price} onChange={(e) => set({ monthly_price: Number(e.target.value) })} /></Field>
              <Field label="Daily question limit"><Input type="number" min={0} value={editing.daily_question_limit} onChange={(e) => set({ daily_question_limit: Number(e.target.value) })} /></Field>
              <Field label="Display order"><Input type="number" value={editing.display_order} onChange={(e) => set({ display_order: Number(e.target.value) })} /></Field>
              <Field label="Plan type"><Sel value={editing.plan_type} onChange={(v) => set({ plan_type: v })} options={PLAN_TYPES} /></Field>
              <Field label="Board"><Sel value={editing.board} onChange={(v) => set({ board: v })} options={BOARDS} /></Field>
              <Field label="Class access"><Sel value={editing.class_access_type} onChange={(v) => set({ class_access_type: v })} options={['single', 'all']} /></Field>
              <Field label="Badge / highlight"><Input value={editing.highlight_text} onChange={(e) => set({ highlight_text: e.target.value })} placeholder="Popular" /></Field>
              <Field label="Description" full><Input value={editing.description} onChange={(e) => set({ description: e.target.value })} placeholder="Shown under the plan name" /></Field>
              <Field label="Features (one per line)" full>
                <textarea value={editing.features.join('\n')} onChange={(e) => set({ features: e.target.value.split('\n').map((f) => f.trim()).filter(Boolean) })} rows={5}
                  className="w-full rounded-xl border border-input bg-background p-3 text-sm text-foreground shadow-elev-1 outline-none focus:border-primary focus:ring-2 focus:ring-ring/35" placeholder={'60 questions per day\nAll subjects included\nPriority support'} />
              </Field>
            </div>
            <div className="flex flex-wrap gap-6">
              <Toggle label="Active (visible to users)" checked={editing.is_active} onChange={(v) => set({ is_active: v })} />
              <Toggle label="Featured / popular" checked={editing.is_featured} onChange={(v) => set({ is_featured: v })} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="gradient" onClick={save} disabled={saving}><Check className="h-4 w-4" /> {saving ? 'Saving…' : 'Save plan'}</Button>
              <Button variant="outline" onClick={() => { setEditing(null); setError(null) }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground"><CreditCard className="h-6 w-6 text-primary" /> Subscription Plans</h1>
          <p className="mt-1 text-sm text-muted-foreground">These drive the pricing page students see — edit here and it updates everywhere.</p>
        </div>
        <div className="flex gap-2">
          {plans.length === 0 && <Button variant="outline" onClick={seedDefaults} disabled={seeding}>{seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Load default plans</Button>}
          <Button variant="gradient" onClick={() => { setError(null); setEditing({ ...blank }) }}><Plus className="h-4 w-4" /> New plan</Button>
        </div>
      </div>

      {error && <Alert className="border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/30"><X className="h-4 w-4 text-rose-600" /><AlertDescription className="text-rose-800 dark:text-rose-300">{error}</AlertDescription></Alert>}

      <Card>
        <CardHeader><CardTitle className="text-lg">All plans</CardTitle><CardDescription>Active plans appear on the pricing page in display order.</CardDescription></CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" /></div>
          ) : plans.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <CreditCard className="mx-auto mb-3 h-10 w-10 opacity-60" />
              <p className="font-medium">No plans yet</p>
              <p className="text-sm">Click “Load default plans” to add the standard Free / Basic / Classic / Pro tiers, then edit.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {plans.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-background/50 p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">{p.display_name}</span>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{p.plan_code}</code>
                      {p.is_featured && <Badge variant="success">Featured</Badge>}
                      {!p.is_active && <Badge variant="secondary">Hidden</Badge>}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">₹{p.monthly_price}/mo · {p.daily_question_limit} Q/day · {p.class_access_type === 'all' ? 'all classes' : '1 class'}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setError(null); setEditing({ ...blank, ...p }) }}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="outline" size="sm" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div className={`space-y-1.5 ${full ? 'sm:col-span-2' : ''}`}><label className="block text-sm font-medium text-foreground">{label}</label>{children}</div>
}
function Sel({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground shadow-elev-1 outline-none focus:border-primary focus:ring-2 focus:ring-ring/35">{options.map((o) => <option key={o} value={o}>{o}</option>)}</select>
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-input text-primary focus:ring-ring" />{label}</label>
}
