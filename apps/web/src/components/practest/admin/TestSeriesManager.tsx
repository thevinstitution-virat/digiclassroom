'use client'

// Test-series (blueprint) authoring — CRUD over practest_test_configurations.

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PlusIcon, PencilIcon, TrashIcon, XCircleIcon, CheckIcon } from '@heroicons/react/24/outline'

interface Config {
  id: string
  name: string
  description?: string
  board?: string
  class_level?: number | null
  subject?: string
  topics?: string[]
  total_questions?: number
  duration_minutes?: number
  negative_marking?: number
  partial_marking?: boolean
  randomize_questions?: boolean
  randomize_options?: boolean
  difficulty_distribution?: Record<string, number> | null
  is_active?: boolean
  is_public?: boolean
}

const BOARDS = ['CBSE', 'ICSE', 'STATE_UP', 'STATE_MH', 'STATE_TN']
const blank: Config = {
  id: '', name: '', description: '', board: 'CBSE', class_level: 9, subject: '',
  topics: [], total_questions: 20, duration_minutes: 30, negative_marking: 0,
  partial_marking: false, randomize_questions: true, randomize_options: true,
  difficulty_distribution: { EASY: 8, MEDIUM: 8, HARD: 4 }, is_active: true, is_public: false,
}

export default function TestSeriesManager() {
  const [configs, setConfigs] = useState<Config[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Config | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/super-admin/practest/configurations')
      const data = await res.json()
      if (data.success) setConfigs(data.configurations)
      else setError(data.error || 'Failed to load')
    } catch {
      setError('Failed to load test series')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!editing) return
    if (!editing.name || !editing.subject || !editing.class_level) {
      setError('Name, subject and class are required')
      return
    }
    setSaving(true); setError(null)
    try {
      const isNew = !editing.id
      const res = await fetch(
        isNew ? '/api/super-admin/practest/configurations' : `/api/super-admin/practest/configurations/${editing.id}`,
        { method: isNew ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) },
      )
      const data = await res.json()
      if (data.success) { setEditing(null); load() }
      else setError(data.error || 'Save failed')
    } catch {
      setError('Save failed')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this test series?')) return
    await fetch(`/api/super-admin/practest/configurations/${id}`, { method: 'DELETE' })
    load()
  }

  const set = (patch: Partial<Config>) => setEditing((e) => (e ? { ...e, ...patch } : e))
  const setDist = (k: 'EASY' | 'MEDIUM' | 'HARD', v: number) =>
    setEditing((e) => (e ? { ...e, difficulty_distribution: { ...(e.difficulty_distribution ?? {}), [k]: v } } : e))

  // ── Editor form ──
  if (editing) {
    const dist = editing.difficulty_distribution ?? { EASY: 0, MEDIUM: 0, HARD: 0 }
    return (
      <Card>
        <CardHeader>
          <CardTitle>{editing.id ? 'Edit' : 'New'} test series</CardTitle>
          <CardDescription>A reusable blueprint students can launch. Mark it Active + Public to publish.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {error && (
            <Alert className="border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/30">
              <XCircleIcon className="h-4 w-4 text-rose-600" />
              <AlertDescription className="text-rose-800 dark:text-rose-300">{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name *"><Input value={editing.name} onChange={(e) => set({ name: e.target.value })} placeholder="Class 9 Science — Full Mock" /></Field>
            <Field label="Subject *"><Input value={editing.subject} onChange={(e) => set({ subject: e.target.value })} placeholder="Science" /></Field>
            <Field label="Board"><Sel value={editing.board ?? 'CBSE'} onChange={(v) => set({ board: v })} options={BOARDS} /></Field>
            <Field label="Class *"><Input type="number" min={1} max={12} value={editing.class_level ?? ''} onChange={(e) => set({ class_level: Number(e.target.value) })} /></Field>
            <Field label="Topics (comma-separated, optional)" full>
              <Input value={(editing.topics ?? []).join(', ')} onChange={(e) => set({ topics: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} placeholder="Motion, Force, Gravitation" />
            </Field>
            <Field label="Description" full>
              <Input value={editing.description ?? ''} onChange={(e) => set({ description: e.target.value })} placeholder="Short description shown to students" />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Questions"><Input type="number" min={1} value={editing.total_questions ?? 20} onChange={(e) => set({ total_questions: Number(e.target.value) })} /></Field>
            <Field label="Duration (min)"><Input type="number" min={1} value={editing.duration_minutes ?? 30} onChange={(e) => set({ duration_minutes: Number(e.target.value) })} /></Field>
            <Field label="Negative marking"><Input type="number" min={0} step="0.25" value={editing.negative_marking ?? 0} onChange={(e) => set({ negative_marking: Number(e.target.value) })} /></Field>
            <Field label="Partial marking"><Toggle checked={!!editing.partial_marking} onChange={(v) => set({ partial_marking: v })} /></Field>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-foreground">Difficulty mix</p>
            <div className="grid grid-cols-3 gap-4">
              {(['EASY', 'MEDIUM', 'HARD'] as const).map((k) => (
                <Field key={k} label={k}><Input type="number" min={0} value={dist[k] ?? 0} onChange={(e) => setDist(k, Number(e.target.value))} /></Field>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Total {(dist.EASY ?? 0) + (dist.MEDIUM ?? 0) + (dist.HARD ?? 0)} / {editing.total_questions ?? 0} questions
            </p>
          </div>

          <div className="flex flex-wrap gap-6">
            <Toggle label="Randomize questions" checked={!!editing.randomize_questions} onChange={(v) => set({ randomize_questions: v })} />
            <Toggle label="Randomize options" checked={!!editing.randomize_options} onChange={(v) => set({ randomize_options: v })} />
            <Toggle label="Active" checked={!!editing.is_active} onChange={(v) => set({ is_active: v })} />
            <Toggle label="Public (visible to students)" checked={!!editing.is_public} onChange={(v) => set({ is_public: v })} />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="gradient" onClick={save} disabled={saving}><CheckIcon className="h-4 w-4" /> {saving ? 'Saving…' : 'Save series'}</Button>
            <Button variant="outline" onClick={() => { setEditing(null); setError(null) }}>Cancel</Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ── List ──
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>Test series</CardTitle>
            <CardDescription>Reusable, blueprinted tests students can launch.</CardDescription>
          </div>
          <Button variant="gradient" onClick={() => { setError(null); setEditing({ ...blank }) }}><PlusIcon className="h-4 w-4" /> New series</Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="py-8 text-center text-muted-foreground">Loading…</p>
        ) : configs.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">No test series yet. Create your first blueprint.</p>
        ) : (
          <div className="space-y-3">
            {configs.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background/50 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">{c.name}</span>
                    {c.is_public && c.is_active ? <Badge variant="success">Published</Badge> : <Badge variant="secondary">Draft</Badge>}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {c.board} · Class {c.class_level} · {c.subject} · {c.total_questions} Q · {c.duration_minutes} min
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setError(null); setEditing({ ...blank, ...c }) }}><PencilIcon className="h-4 w-4" /></Button>
                  <Button variant="outline" size="sm" onClick={() => remove(c.id)}><TrashIcon className="h-4 w-4 text-rose-600" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`space-y-1.5 ${full ? 'sm:col-span-2' : ''}`}>
      <label className="block text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  )
}

function Sel({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground shadow-elev-1 outline-none focus:border-primary focus:ring-2 focus:ring-ring/35"
    >
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-input text-primary focus:ring-ring" />
      {label}
    </label>
  )
}
