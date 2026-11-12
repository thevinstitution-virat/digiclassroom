// Marks changed after they reached the learner (migration 036; docs/hw-eval/mark-revisions.md). Two pieces, used by homework and exams alike:
//   * RevisionNote: what the learner (and a parent) sees: "Marks revised by <name>, <designation>, on <date>", or the date only when the
//     app's own staff made the change;
//   * RevisePanel: the reviser's form: new marks (per key point when the question has them), their name and designation (prefilled from their
//     account, editable; required unless they are the app's own staff), and why.

import { useState } from 'react'
import { History, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { HwMessage } from '@/components/hw/HwShell'
import { useHwT } from '@/components/hw/strings'

export interface RevisionLike {
  marksBefore: number | null
  marksAfter: number
  at: Date | string
  by: { name: string; designation: string } | null
}

export function RevisionNote({ r, className = '' }: { r: RevisionLike; className?: string }) {
  const { t, lang } = useHwT()
  const date = new Date(r.at).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { dateStyle: 'medium' })
  return (
    <p className={`flex items-start gap-1.5 text-xs text-blue-800 dark:text-blue-300 ${className}`} data-testid="revision-note">
      <History className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        {r.by ? t('rv.by', { name: r.by.name, designation: r.by.designation, date }) : t('rv.dateOnly', { date })}{' '}
        <span className="text-muted-foreground">{r.marksBefore === null ? t('rv.wasNone') : t('rv.was', { n: r.marksBefore })}</span>
      </span>
    </p>
  )
}

export interface ReviseInput {
  itemMarks?: { rubric_item_id: string; marks: number }[]
  marks?: number
  reason: string
  name?: string
  designation?: string
}

export function RevisePanel({ rubric, questionMarks, currentMarks, me, busy, error, onSubmit, onCancel }: {
  rubric: { id: string; description: string; marks: number; awarded: number }[]
  questionMarks: number
  currentMarks: number | null
  me: { name: string; designation: string; nameShown: boolean }
  busy: boolean
  error?: string | null
  onSubmit: (input: ReviseInput) => void
  onCancel: () => void
}) {
  const { t } = useHwT()
  const [items, setItems] = useState<Record<string, number>>(() => Object.fromEntries(rubric.map((r) => [r.id, r.awarded])))
  const [total, setTotal] = useState(currentMarks === null ? '' : String(currentMarks))
  const [name, setName] = useState(me.name)
  const [designation, setDesignation] = useState(me.designation)
  const [reason, setReason] = useState('')
  const itemTotal = rubric.reduce((s, r) => s + (items[r.id] ?? 0), 0)
  const shownTotal = rubric.length ? itemTotal : Number(total || 0)
  const ready = reason.trim().length >= 3 && (!me.nameShown || (name.trim().length >= 2 && designation.trim().length >= 2)) && (rubric.length > 0 || total !== '')

  const submit = () => onSubmit({
    ...(rubric.length ? { itemMarks: rubric.map((r) => ({ rubric_item_id: r.id, marks: items[r.id] ?? 0 })) } : { marks: Number(total) }),
    reason: reason.trim(),
    ...(me.nameShown ? { name: name.trim(), designation: designation.trim() } : {}),
  })

  return (
    <div className="space-y-3 rounded-md border border-blue-300 bg-blue-50/50 p-3 dark:border-blue-800 dark:bg-blue-950/20" data-testid="revise-panel">
      <p className="text-sm font-medium">{t('rv.title')}</p>
      {rubric.length > 0 ? (
        <ul className="space-y-2">
          {rubric.map((r) => (
            <li key={r.id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1">{r.description}</span>
              <Input type="number" className="w-20" step={0.5} min={0} max={r.marks} value={items[r.id] ?? 0}
                onChange={(e) => setItems((x) => ({ ...x, [r.id]: Number(e.target.value) }))} aria-label={`${t('rv.marks')}: ${r.description}`} />
              <span className="text-xs text-muted-foreground">/ {r.marks}</span>
            </li>
          ))}
        </ul>
      ) : (
        <label className="flex items-center gap-2 text-sm">
          <span>{t('rv.marks')}</span>
          <Input type="number" className="w-24" step={0.5} min={0} max={questionMarks} value={total} onChange={(e) => setTotal(e.target.value)} />
          <span className="text-xs text-muted-foreground">/ {questionMarks}</span>
        </label>
      )}
      <p className="text-sm font-medium">{t('rv.total', { n: shownTotal, of: questionMarks })}</p>
      {me.nameShown && (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1 text-sm"><span>{t('rv.name')}</span><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></label>
          <label className="space-y-1 text-sm"><span>{t('rv.designation')}</span><Input value={designation} onChange={(e) => setDesignation(e.target.value)} maxLength={120} /></label>
        </div>
      )}
      <label className="block space-y-1 text-sm">
        <span>{t('rv.reason')}</span>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={1000} />
        <span className="block text-xs text-muted-foreground">{t('rv.reasonHelp')}</span>
      </label>
      <p className="text-xs text-muted-foreground">
        {me.nameShown ? t('rv.help', { name: name.trim() || '…', designation: designation.trim() || '…' }) : t('rv.helpPlatform')}
      </p>
      {error && <HwMessage tone="error">{error}</HwMessage>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={!ready || busy} onClick={submit}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{t('rv.save')}</Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>{t('rv.cancel')}</Button>
      </div>
    </div>
  )
}
