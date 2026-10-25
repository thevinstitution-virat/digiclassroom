// Marking, question by question across the class.
//   Left:  the original handwriting (render image), toggle Original / Typed text.
//   Right: transcript with [?] and student-flagged words marked, the AI suggestion as rubric
//          checkboxes (verdict, quoted words highlighted in the transcript, marks), total and
//          confidence; Accept / Accept with changes / Mark by hand / Comment / Fix transcript.
// Keys: J / K next / previous student, A accept. Filters and a bulk "accept high-confidence".

import { useEffect, useState, type ReactNode } from 'react'
import { Check, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { api } from '@/lib/trpc/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { HwError, HwLoading, HwMessage } from '../HwShell'
import { NativeSelect } from '../fields'
import { marksLabel, useHwT } from '../strings'
import type { HwOut } from '../types'
import { annotate } from '../text-spans'

type Queue = HwOut['marking']['queue']
type Row = Queue['answers'][number]
type Filter = 'all' | 'needs_review' | 'low_confidence' | 'flagged' | 'ungraded'
interface SugItem { rubric_item_id: string; verdict: 'met' | 'partial' | 'missing'; quote: string; marks: number; confidence: number }

function Transcript({ row, quotes }: { row: Row; quotes: string[] }) {
  const { t } = useHwT()
  if (!row.transcript) return <p className="text-sm text-muted-foreground">{row.transcriptStatus === 'pending' ? t('tc.sub.processing') : '—'}</p>
  return (
    <div className="space-y-1">
      <p className="whitespace-pre-wrap rounded-md bg-muted p-3 text-base leading-relaxed">
        {annotate(row.transcript, row.studentFlags, quotes).map((s, i) => (
          <span key={i} className={cn(
            s.quote && 'bg-green-200 dark:bg-green-900',
            s.unclear && 'rounded bg-amber-200 px-0.5 font-semibold dark:bg-amber-800',
            s.flag && 'underline decoration-red-500 decoration-wavy underline-offset-4',
          )}>{s.text}</span>
        ))}
      </p>
      <p className="text-xs text-muted-foreground">{t('mk.unclearHint')} · {t('mk.flagsHint')}</p>
    </div>
  )
}

function Original({ answerId, mode, transcript }: { answerId: string; mode: Row['mode']; transcript: string | null }) {
  const { t } = useHwT()
  const [view, setView] = useState<'original' | 'typed'>('original')
  const detail = api.hw.marking.answer.useQuery({ answerId }, { enabled: mode !== 'typed', staleTime: 240_000 })
  if (mode === 'typed') return <HwMessage>{t('mk.noImage')}</HwMessage>
  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {(['original', 'typed'] as const).map((v) => (
          <Button key={v} size="sm" variant={view === v ? 'default' : 'outline'} onClick={() => setView(v)}>{t(v === 'original' ? 'mk.view.original' : 'mk.view.typed')}</Button>
        ))}
      </div>
      {view === 'typed' ? (
        <p className="whitespace-pre-wrap rounded-md border p-3 font-serif text-lg leading-relaxed">{transcript ?? '—'}</p>
      ) : detail.isLoading ? <HwLoading /> : detail.error ? <HwError message={detail.error.message} onRetry={() => detail.refetch()} /> : detail.data?.renderUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={detail.data.renderUrl} alt={t('mk.view.original')} className="w-full rounded-md border bg-white" />
      ) : <HwMessage>{t('mk.noImage')}</HwMessage>}
    </div>
  )
}

function Panel({ q, row, onDone }: { q: Queue; row: Row; onDone: () => void }) {
  const { t } = useHwT()
  const s = row.suggestion
  const sugItems = (s?.items ?? []) as SugItem[]
  const [items, setItems] = useState<Record<string, number>>({})
  const [comment, setComment] = useState(row.grade?.comment ?? '')
  const [manual, setManual] = useState<string>(row.grade ? String(row.grade.marks) : '')
  const [fixing, setFixing] = useState(false)
  const [text, setText] = useState(row.transcript ?? '')

  useEffect(() => {
    const init: Record<string, number> = {}
    const graded = (row.grade?.itemMarks ?? []) as { rubric_item_id: string; marks: number }[]
    for (const r of q.rubric) init[r.id] = graded.find((g) => g.rubric_item_id === r.id)?.marks ?? sugItems.find((x) => x.rubric_item_id === r.id)?.marks ?? 0
    setItems(init)
    setComment(row.grade?.comment ?? '')
    setManual(row.grade ? String(row.grade.marks) : '')
    setText(row.transcript ?? '')
    setFixing(false)
  }, [row.answerId, row.suggestion?.id, row.grade?.marks]) // eslint-disable-line react-hooks/exhaustive-deps

  const accept = api.hw.marking.accept.useMutation({ onSuccess: onDone })
  const edit = api.hw.marking.editAndAccept.useMutation({ onSuccess: onDone })
  const hand = api.hw.marking.manual.useMutation({ onSuccess: onDone })
  const note = api.hw.marking.comment.useMutation({ onSuccess: onDone })
  const fix = api.hw.marking.fixTranscript.useMutation({ onSuccess: () => { setFixing(false); onDone() } })
  const busy = accept.isPending || edit.isPending || hand.isPending || note.isPending || fix.isPending
  const err = accept.error ?? edit.error ?? hand.error ?? note.error ?? fix.error

  const changed = s ? q.rubric.some((r) => (items[r.id] ?? 0) !== (sugItems.find((x) => x.rubric_item_id === r.id)?.marks ?? 0)) : false
  const itemTotal = q.rubric.reduce((sum, r) => sum + (items[r.id] ?? 0), 0)
  const returned = row.submissionStatus === 'returned'
  const canAccept = Boolean(s) && !returned && (row.transcriptStatus === 'done' || row.transcriptStatus === 'not_needed')

  // A: accept (when the suggestion is unchanged).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, [contenteditable]')) return
      if (e.key.toLowerCase() === 'a' && canAccept && !changed && !busy && s) accept.mutate({ answerId: row.answerId, aiGradeId: s.id, comment: comment || null })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canAccept, changed, busy, s, row.answerId, comment, accept])

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-medium">{t('mk.transcript')}</span>
          {row.mode !== 'typed' && !returned && <Button size="sm" variant="ghost" onClick={() => setFixing((f) => !f)}>{t('mk.fixTranscript')}</Button>}
        </div>
        {fixing ? (
          <div className="space-y-2">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} lang="hi" />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy || text === row.transcript} onClick={() => fix.mutate({ answerId: row.answerId, text })}>{t('mk.saveTranscript')}</Button>
              <Button size="sm" variant="outline" disabled={busy || !row.transcript} onClick={() => fix.mutate({ answerId: row.answerId, confirm: true })}>{t('mk.confirmTranscript')}</Button>
            </div>
          </div>
        ) : <Transcript row={row} quotes={sugItems.filter((x) => x.verdict !== 'missing').map((x) => x.quote)} />}
        {row.failureReason && <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">{t('mk.failure')}: {row.failureReason}</p>}
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium">{t('mk.suggestion')}</span>
          {s && <Badge variant={s.confidence >= 0.85 ? 'default' : 'secondary'}>{t('mk.confidence', { n: Math.round(s.confidence * 100) })}</Badge>}
        </div>
        {!q.rubric.length ? null : (
          <ul className="space-y-2">
            {q.rubric.map((r) => {
              const sug = sugItems.find((x) => x.rubric_item_id === r.id)
              return (
                <li key={r.id} className="rounded-md border p-2">
                  <div className="flex items-start gap-2">
                    <input type="checkbox" className="mt-1" checked={(items[r.id] ?? 0) > 0} disabled={returned}
                      onChange={(e) => setItems((x) => ({ ...x, [r.id]: e.target.checked ? r.marks : 0 }))} aria-label={r.description} />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm">{r.description}</p>
                      {sug && (
                        <div className="text-xs text-muted-foreground">
                          <Badge variant={sug.verdict === 'met' ? 'default' : sug.verdict === 'partial' ? 'secondary' : 'outline'} className="mr-1">{t(`mk.verdict.${sug.verdict}`)}</Badge>
                          {sug.quote && <q className="italic">{sug.quote}</q>}
                        </div>
                      )}
                    </div>
                    <Input type="number" className="w-20" step={0.5} min={0} max={r.marks} value={items[r.id] ?? 0} disabled={returned}
                      onChange={(e) => setItems((x) => ({ ...x, [r.id]: Number(e.target.value) }))} aria-label={t('mk.manualMarks')} />
                    <span className="mt-2 text-xs text-muted-foreground">/ {r.marks}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {s ? (
          <p className="text-sm">{t('st.result.total', { got: changed ? itemTotal : s.suggestedMarks, of: q.question.marks })}</p>
        ) : <p className="text-sm text-muted-foreground">{t('mk.noSuggestion')}</p>}
        {s && Array.isArray(s.validationNotes) && s.validationNotes.length > 0 && (
          <details className="text-xs text-muted-foreground">
            <summary>{t('mk.notes')} ({s.validationNotes.length})</summary>
            <ul className="mt-1 list-disc pl-4">{(s.validationNotes as string[]).map((n, i) => <li key={i}>{n}</li>)}</ul>
          </details>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor={`c-${row.answerId}`}>{t('mk.comment')}</label>
        <Textarea id={`c-${row.answerId}`} value={comment} onChange={(e) => setComment(e.target.value)} rows={2} disabled={returned} />
      </div>

      {row.grade && <p className="text-sm font-medium text-green-700 dark:text-green-400"><Check className="mr-1 inline h-4 w-4" />{t('mk.graded', { n: row.grade.marks, of: q.question.marks, source: t(`mk.source.${row.grade.source}`) })}</p>}
      {err && <HwMessage tone="error">{err.message}</HwMessage>}

      {!returned && (
        <div className="flex flex-wrap items-end gap-2">
          {s && !changed && <Button disabled={!canAccept || busy} onClick={() => accept.mutate({ answerId: row.answerId, aiGradeId: s.id, comment: comment || null })}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{t('mk.accept')} (A)</Button>}
          {s && changed && <Button disabled={!canAccept || busy} onClick={() => edit.mutate({ answerId: row.answerId, aiGradeId: s.id, comment: comment || null, itemMarks: q.rubric.map((r) => ({ rubric_item_id: r.id, marks: items[r.id] ?? 0 })) })}>{t('mk.editAccept')}</Button>}
          <div className="flex items-end gap-1">
            {q.rubric.length > 0 ? (
              <Button variant="outline" disabled={busy} onClick={() => hand.mutate({ answerId: row.answerId, comment: comment || null, itemMarks: q.rubric.map((r) => ({ rubric_item_id: r.id, marks: items[r.id] ?? 0 })) })}>{t('mk.manual')} ({itemTotal})</Button>
            ) : (
              <>
                <Input type="number" className="w-24" step={0.5} min={0} max={q.question.marks} value={manual} onChange={(e) => setManual(e.target.value)} aria-label={t('mk.manualMarks')} />
                <Button variant="outline" disabled={busy || manual === ''} onClick={() => hand.mutate({ answerId: row.answerId, marks: Number(manual), comment: comment || null })}>{t('mk.manual')}</Button>
              </>
            )}
          </div>
          {row.grade && <Button variant="ghost" disabled={busy || comment === (row.grade.comment ?? '')} onClick={() => note.mutate({ answerId: row.answerId, comment: comment || null })}>{t('mk.saveComment')}</Button>}
        </div>
      )}
    </div>
  )
}

export function Marking({ questions, initialQuestionId }: { questions: { id: string; position: number }[]; initialQuestionId?: string }) {
  const { t } = useHwT()
  const [questionId, setQuestionId] = useState(initialQuestionId && questions.some((q) => q.id === initialQuestionId) ? initialQuestionId : questions[0]?.id)
  const [filter, setFilter] = useState<Filter>('all')
  const [index, setIndex] = useState(0)
  const queue = api.hw.marking.queue.useQuery({ questionId: questionId!, filter }, { enabled: Boolean(questionId) })
  const preview = api.hw.marking.bulkAcceptPreview.useQuery({ questionId: questionId! }, { enabled: Boolean(questionId) })
  const bulk = api.hw.marking.bulkAccept.useMutation({ onSuccess: (r) => { window.alert(t('mk.bulkDone', { n: r.accepted })); void queue.refetch(); void preview.refetch() } })

  const rows = queue.data?.answers ?? []
  useEffect(() => { if (index >= rows.length) setIndex(Math.max(0, rows.length - 1)) }, [rows.length, index])
  const row = rows[index]

  // J / K move between students.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return
      if (e.key.toLowerCase() === 'j') setIndex((i) => Math.min(rows.length - 1, i + 1))
      if (e.key.toLowerCase() === 'k') setIndex((i) => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rows.length])

  const afterAction = () => {
    void queue.refetch()
    void preview.refetch()
    setIndex((i) => Math.min(i + 1, Math.max(0, rows.length - 1)))
  }

  const askBulk = () => {
    const n = preview.data?.count ?? 0
    if (!n) return window.alert(t('mk.bulkNone'))
    if (window.confirm(t('mk.bulkConfirm', { n }))) bulk.mutate({ questionId: questionId!, confirmedCount: n })
  }

  const filters: Filter[] = ['all', 'needs_review', 'low_confidence', 'flagged', 'ungraded']
  const header: ReactNode = queue.data && (
    <Card>
      <CardHeader className="space-y-2 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect className="w-auto" value={questionId} onChange={(e) => { setQuestionId(e.target.value); setIndex(0) }} aria-label={t('mk.question', { i: '' })}>
            {questions.map((q) => <option key={q.id} value={q.id}>{t('mk.question', { i: q.position + 1 })}</option>)}
          </NativeSelect>
          <Badge variant="secondary">{marksLabel(t, queue.data.question.marks)}</Badge>
          <Button size="sm" variant="outline" className="ml-auto" disabled={bulk.isPending || !preview.data?.count} onClick={askBulk}>
            {bulk.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{t('mk.bulk')} ({preview.data?.count ?? 0})
          </Button>
        </div>
        <CardTitle className="whitespace-pre-wrap text-base">{queue.data.question.prompt}</CardTitle>
        <div className="flex flex-wrap gap-1">
          {filters.map((f) => <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => { setFilter(f); setIndex(0) }}>{t(`mk.filter.${f}`)}</Button>)}
        </div>
        {bulk.error && <p className="text-sm text-red-600">{bulk.error.message}</p>}
      </CardHeader>
    </Card>
  )

  if (!questionId) return <HwMessage>{t('mk.empty')}</HwMessage>
  if (queue.isLoading) return <HwLoading />
  if (queue.error) return <HwError message={queue.error.message} onRetry={() => queue.refetch()} />

  return (
    <div className="space-y-4">
      {header}
      {!row ? <HwMessage>{t('mk.empty')}</HwMessage> : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button size="icon" variant="outline" disabled={index === 0} onClick={() => setIndex(index - 1)} aria-label={t('common.previous')}><ChevronLeft className="h-4 w-4" /></Button>
              <NativeSelect className="w-auto max-w-[16rem]" value={index} onChange={(e) => setIndex(Number(e.target.value))} aria-label={t('tc.ov.student')}>
                {rows.map((r, i) => <option key={r.answerId} value={i}>{r.studentName}{r.grade ? ' ✓' : ''}</option>)}
              </NativeSelect>
              <Button size="icon" variant="outline" disabled={index >= rows.length - 1} onClick={() => setIndex(index + 1)} aria-label={t('common.next')}><ChevronRight className="h-4 w-4" /></Button>
              <span className="text-sm text-muted-foreground">{index + 1} / {rows.length}</span>
              {row.isLate && <Badge variant="destructive">{t('st.list.late')}</Badge>}
            </div>
            <span className="hidden text-xs text-muted-foreground md:inline">{t('mk.keys')}</span>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card><CardContent className="pt-6"><Original key={row.answerId} answerId={row.answerId} mode={row.mode} transcript={row.transcript} /></CardContent></Card>
            <Card><CardContent className="pt-6"><Panel q={queue.data!} row={row} onDone={afterAction} /></CardContent></Card>
          </div>
        </>
      )}
    </div>
  )
}
