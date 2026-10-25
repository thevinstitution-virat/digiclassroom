// Assignment builder (drafts): add a question from a type preset, write prompt, marks and
// model answer, draft key points with AI, edit/reorder/delete them (they must add up), list
// accepted answers for very short questions, then publish.

import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react'
import { api } from '@/lib/trpc/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, NativeSelect } from '../fields'
import { marksLabel, useHwT } from '../strings'
import type { HwOut } from '../types'

type Detail = HwOut['assignments']['get']
type Question = Detail['questions'][number]
type QType = Question['type']
type Kind = 'key_point' | 'content' | 'structure' | 'language'
interface Item { kind: Kind; description: string; marks: number; source?: string }

const n = (v: string | number) => Number(v)
const KINDS: Kind[] = ['key_point', 'content', 'structure', 'language']

function RubricEditor({ q, onSaved }: { q: Question; onSaved: () => void }) {
  const { t } = useHwT()
  const [items, setItems] = useState<Item[]>(q.rubric.map((r) => ({ kind: r.kind, description: r.description, marks: n(r.marks), source: r.source })))
  const [dirty, setDirty] = useState(false)
  useEffect(() => {
    setItems(q.rubric.map((r) => ({ kind: r.kind, description: r.description, marks: n(r.marks), source: r.source })))
    setDirty(false)
  }, [q.rubric])
  const save = api.hw.rubric.set.useMutation({ onSuccess: () => { setDirty(false); onSaved() } })
  const draft = api.hw.rubric.draft.useMutation({ onSuccess: onSaved })

  const total = items.reduce((s, i) => s + (Number.isFinite(i.marks) ? i.marks : 0), 0)
  const qMarks = n(q.marks)
  const edit = (i: number, patch: Partial<Item>) => { setDirty(true); setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x))) }
  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= items.length) return
    setDirty(true)
    setItems((xs) => { const c = [...xs]; [c[i], c[j]] = [c[j], c[i]]; return c })
  }
  const askDraft = () => {
    if (q.rubric.length && !window.confirm(t('tc.b.draftReplace'))) return
    draft.mutate({ questionId: q.id, replace: q.rubric.length > 0 })
  }
  const okMarks = items.every((i) => i.marks > 0 && i.marks <= qMarks && Math.round(i.marks * 2) === i.marks * 2)

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{t('tc.b.rubric')}</p>
          <p className="text-xs text-muted-foreground">{t('tc.b.rubricHelp')}</p>
        </div>
        <Button size="sm" variant="outline" onClick={askDraft} disabled={draft.isPending || !q.prompt.trim()}>
          {draft.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
          {draft.isPending ? t('tc.b.drafting') : t('tc.b.draftAi')}
        </Button>
      </div>
      {draft.error && <p className="text-sm text-red-600">{draft.error.message}</p>}
      {items.map((it, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[8rem_1fr_5rem_auto]">
          <NativeSelect value={it.kind} onChange={(e) => edit(i, { kind: e.target.value as Kind })} aria-label="kind">
            {KINDS.map((k) => <option key={k} value={k}>{k.replace('_', ' ')}</option>)}
          </NativeSelect>
          <div className="space-y-1">
            <Input value={it.description} onChange={(e) => edit(i, { description: e.target.value })} maxLength={1000} aria-label={`${t('tc.b.rubric')} ${i + 1}`} />
            {it.source === 'ai_draft' && !dirty && <Badge variant="secondary">{t('tc.b.aiDraft')}</Badge>}
          </div>
          <Input type="number" step={0.5} min={0.5} max={qMarks} value={it.marks} onChange={(e) => edit(i, { marks: Number(e.target.value) })} aria-label={t('tc.b.marks')} />
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" onClick={() => move(i, -1)} aria-label="up"><ArrowUp className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => move(i, 1)} aria-label="down"><ArrowDown className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => { setDirty(true); setItems((xs) => xs.filter((_, j) => j !== i)) }} aria-label={t('common.delete')}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => { setDirty(true); setItems((xs) => [...xs, { kind: 'key_point', description: '', marks: Math.min(1, qMarks) }]) }}>
          <Plus className="mr-1 h-4 w-4" />{t('tc.b.addPoint')}
        </Button>
        <span className={total === qMarks ? 'text-sm text-green-700 dark:text-green-400' : 'text-sm text-amber-700 dark:text-amber-400'}>
          {t('tc.b.pointsTotal', { got: total, of: qMarks })}
        </span>
        <Button size="sm" className="ml-auto" disabled={!dirty || save.isPending || !okMarks || total > qMarks || items.some((i) => !i.description.trim())}
          onClick={() => save.mutate({ questionId: q.id, items: items.map(({ kind, description, marks }) => ({ kind, description, marks })) })}>
          {save.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{t('tc.b.saveRubric')}
        </Button>
      </div>
      {save.error && <p className="text-sm text-red-600">{save.error.message}</p>}
    </div>
  )
}

function QuestionEditor({ q, index, count, onChanged, onMove }: { q: Question; index: number; count: number; onChanged: () => void; onMove: (d: -1 | 1) => void }) {
  const { t } = useHwT()
  const [form, setForm] = useState({
    prompt: q.prompt, marks: n(q.marks), modelAnswer: q.modelAnswer ?? '', accepted: (q.acceptedAnswers ?? []).join('\n'),
    languageHint: q.languageHint, answerLines: q.answerLines, type: q.type,
  })
  const [dirty, setDirty] = useState(false)
  const update = api.hw.questions.update.useMutation({ onSuccess: () => { setDirty(false); onChanged() } })
  const remove = api.hw.questions.remove.useMutation({ onSuccess: onChanged })
  const set = (patch: Partial<typeof form>) => { setDirty(true); setForm((f) => ({ ...f, ...patch })) }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{t('mk.question', { i: index + 1 })} · {t(`type.${form.type}`)} · {marksLabel(t, form.marks)}</CardTitle>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" disabled={index === 0} onClick={() => onMove(-1)} aria-label="up"><ArrowUp className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" disabled={index === count - 1} onClick={() => onMove(1)} aria-label="down"><ArrowDown className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => window.confirm(t('tc.b.deleteQuestion')) && remove.mutate({ questionId: q.id })} aria-label={t('tc.b.deleteQuestion')}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label={t('tc.b.prompt')}>
          <Textarea value={form.prompt} onChange={(e) => set({ prompt: e.target.value })} rows={3} maxLength={10000} autoFocus={!q.prompt} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label={t('tc.b.marks')}>
            <Input type="number" step={0.5} min={0.5} max={100} value={form.marks} onChange={(e) => set({ marks: Number(e.target.value) })} />
          </Field>
          <Field label={t('tc.b.language')}>
            <NativeSelect value={form.languageHint} onChange={(e) => set({ languageHint: e.target.value as typeof form.languageHint })}>
              <option value="en">English</option><option value="hi">हिन्दी</option><option value="mixed">Hindi + English</option>
            </NativeSelect>
          </Field>
          <Field label={t('tc.b.lines')}>
            <Input type="number" min={1} max={200} value={form.answerLines} onChange={(e) => set({ answerLines: Number(e.target.value) })} />
          </Field>
          <Field label="Type">
            <NativeSelect value={form.type} onChange={(e) => set({ type: e.target.value as QType })}>
              {(['very_short', 'short', 'long', 'essay'] as QType[]).map((ty) => <option key={ty} value={ty}>{t(`type.${ty}`)}</option>)}
            </NativeSelect>
          </Field>
        </div>
        <Field label={t('tc.b.modelAnswer')}>
          <Textarea value={form.modelAnswer} onChange={(e) => set({ modelAnswer: e.target.value })} rows={3} maxLength={20000} />
        </Field>
        {form.type === 'very_short' && (
          <Field label={t('tc.b.accepted')}>
            <Textarea value={form.accepted} onChange={(e) => set({ accepted: e.target.value })} rows={2} />
          </Field>
        )}
        <div className="flex items-center gap-2">
          <Button size="sm" disabled={!dirty || update.isPending || !(form.marks > 0)}
            onClick={() => update.mutate({
              questionId: q.id,
              patch: {
                prompt: form.prompt, marks: form.marks, modelAnswer: form.modelAnswer || null, languageHint: form.languageHint,
                answerLines: form.answerLines, type: form.type,
                acceptedAnswers: form.accepted.split('\n').map((s) => s.trim()).filter(Boolean),
              },
            })}>
            {update.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{t('common.save')}
          </Button>
          {update.error && <span className="text-sm text-red-600">{update.error.message}</span>}
        </div>
        {!dirty && <RubricEditor q={q} onSaved={onChanged} />}
      </CardContent>
    </Card>
  )
}

export function Builder({ detail, onChanged }: { detail: Detail; onChanged: () => void }) {
  const { t } = useHwT()
  const presets = api.hw.presets.useQuery()
  const add = api.hw.questions.add.useMutation({ onSuccess: onChanged })
  const reorder = api.hw.questions.reorder.useMutation({ onSuccess: onChanged })
  const publish = api.hw.assignments.publish.useMutation({
    onSuccess: (r) => { if (r.warnings.length) window.alert(r.warnings.join('\n')); onChanged() },
  })
  const qs = detail.questions
  const total = qs.reduce((s, q) => s + n(q.marks), 0)

  const addOf = (type: QType) => {
    const p = presets.data?.[type]
    add.mutate({ assignmentId: detail.assignment.id, question: { type, prompt: '', marks: p?.defaultMarks ?? 1, answerLines: p?.answerLines ?? 4 } })
  }
  const move = (i: number, d: -1 | 1) => {
    const ids = qs.map((q) => q.id)
    const j = i + d
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    reorder.mutate({ assignmentId: detail.assignment.id, orderedIds: ids })
  }

  return (
    <div className="space-y-4">
      {qs.map((q, i) => (
        <QuestionEditor key={`${q.id}:${q.updatedAt}`} q={q} index={i} count={qs.length} onChanged={onChanged} onMove={(d) => move(i, d)} />
      ))}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 py-4">
          <span className="text-sm font-medium">{t('tc.b.addQuestion')}:</span>
          {(['very_short', 'short', 'long', 'essay'] as QType[]).map((ty) => (
            <Button key={ty} size="sm" variant="outline" disabled={add.isPending} onClick={() => addOf(ty)}>
              <Plus className="mr-1 h-4 w-4" />{t(`type.${ty}`)} ({presets.data?.[ty].defaultMarks ?? ''})
            </Button>
          ))}
          {add.error && <span className="text-sm text-red-600">{add.error.message}</span>}
        </CardContent>
      </Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-medium">{t('tc.b.total', { n: total })}</span>
        <Button disabled={!qs.length || publish.isPending} onClick={() => window.confirm(t('tc.b.publishConfirm')) && publish.mutate({ assignmentId: detail.assignment.id })}>
          {publish.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('tc.b.publish')}
        </Button>
      </div>
      {publish.error && <p className="text-sm text-red-600">{publish.error.message}</p>}
    </div>
  )
}
