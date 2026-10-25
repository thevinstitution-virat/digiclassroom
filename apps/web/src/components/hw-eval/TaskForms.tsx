'use client'

// The four task forms. Each takes the task view (built on the server from the dataset item
// or cached key only: never AI output), an optional starting value (adjudication starts
// from Rater A), and calls onSubmit with the payload the server validates again.

import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/hw/fields'
import type { HwEvalRouterOutputs } from '@/lib/trpc/routers/hw-eval'

export type TaskView = HwEvalRouterOutputs['open']['view']
type ViewOf<K extends TaskView['kind']> = Extract<TaskView, { kind: K }>

export interface FormProps<K extends TaskView['kind'], P> {
  view: ViewOf<K>
  initial?: P
  busy: boolean
  submitLabel: string
  onSubmit: (payload: P) => void
}

const halves = (max: number) => Array.from({ length: Math.round(max * 2) + 1 }, (_, i) => i / 2)

export function TaskImage({ src, alt }: { src: string; alt: string }) {
  const [full, setFull] = useState(false)
  return (
    <div className="overflow-auto rounded-md border bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element -- private, per-request image from our API */}
      <img src={src} alt={alt} onClick={() => setFull((f) => !f)} className={full ? 'max-w-none cursor-zoom-out' : 'w-full cursor-zoom-in'} />
    </div>
  )
}

function QuestionCard({ q }: { q: { text: string; marks: number; passageText?: string | null; class: string; subject: string; medium: string } }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{q.class} · {q.subject} · {q.medium} medium · {q.marks} marks</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        {q.passageText && <p className="whitespace-pre-wrap rounded-md bg-muted p-3">{q.passageText}</p>}
        <p className="whitespace-pre-wrap font-medium">{q.text}</p>
      </CardContent>
    </Card>
  )
}

// ── Transcription ─────────────────────────────────────────────────────────────

export function TranscribeForm({ view, initial, busy, submitLabel, onSubmit }: FormProps<'transcribe', { text: string }>) {
  const [text, setText] = useState(initial?.text ?? '')
  const ref = useRef<HTMLTextAreaElement>(null)
  // Where the cursor goes once React has written the new text (setting it earlier is undone by the update).
  const caret = useRef<number | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (el && caret.current !== null) {
      el.focus()
      el.setSelectionRange(caret.current, caret.current)
      caret.current = null
    }
  }, [text])
  const insertUnclear = () => {
    const el = ref.current
    if (!el) return setText((t) => `${t}[?]`)
    const s = el.selectionStart
    caret.current = s + 3
    setText(`${text.slice(0, s)}[?]${text.slice(el.selectionEnd)}`)
  }
  return (
    <div className="space-y-4">
      {view.image ? <TaskImage src={view.image} alt="Handwritten answer to transcribe" /> : <p className="text-sm text-red-600">This item has no image.</p>}
      <div className="rounded-md border bg-muted/40 p-3 text-sm">
        Type exactly what is written: the same words, spelling, punctuation and line breaks, mistakes included. Do not correct anything.
        Where a word cannot be read, type <code>[?]</code> for that word. Language: {view.language === 'hi' ? 'Hindi' : view.language === 'mixed' ? 'Hindi and English' : 'English'}.
      </div>
      <Textarea ref={ref} value={text} onChange={(e) => setText(e.target.value)} rows={10} lang={view.language === 'en' ? 'en' : 'hi'} spellCheck={false} autoCorrect="off" autoCapitalize="off" className="text-base" aria-label="Transcription" />
      <div className="flex flex-wrap gap-2">
        {/* onMouseDown: keep the text box focused, so its cursor position is the one used */}
        <Button type="button" variant="outline" onMouseDown={(e) => e.preventDefault()} onClick={insertUnclear}>Insert [?]</Button>
        <Button type="button" disabled={busy} onClick={() => onSubmit({ text })}>{submitLabel}</Button>
      </div>
      {!text.trim() && <p className="text-xs text-muted-foreground">An empty transcription means the page is blank.</p>}
    </div>
  )
}

// ── Blind marking ─────────────────────────────────────────────────────────────

export function BlindMarkForm({ view, initial, busy, submitLabel, onSubmit }: FormProps<'blind_mark', { byPoint: Record<string, number>; note?: string }>) {
  const [by, setBy] = useState<Record<string, number | undefined>>(initial?.byPoint ?? {})
  const [note, setNote] = useState(initial?.note ?? '')
  const total = view.points.reduce((s, p) => s + (by[p.id] ?? 0), 0)
  const complete = view.points.every((p) => by[p.id] !== undefined)
  return (
    <div className="space-y-4">
      <QuestionCard q={view.question} />
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">The student&apos;s answer</CardTitle></CardHeader>
        <CardContent>
          {view.image ? <TaskImage src={view.image} alt="The student's handwritten answer" /> : <p className="whitespace-pre-wrap text-sm">{view.typedText ?? '(no answer)'}</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Marking scheme: give marks for each point</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {view.referenceAnswer && <p className="rounded-md bg-muted p-3 text-sm"><span className="font-medium">Model answer: </span>{view.referenceAnswer}</p>}
          {view.points.map((p) => (
            <div key={p.id} className="grid gap-2 sm:grid-cols-[1fr_8rem] sm:items-center">
              <div className="text-sm">
                <span className="font-medium">{p.id}.</span> {p.text} <span className="text-muted-foreground">({p.marks} marks)</span>
                {p.acceptedAlternatives.length > 0 && <div className="text-xs text-muted-foreground">Also accept: {p.acceptedAlternatives.join('; ')}</div>}
              </div>
              <NativeSelect aria-label={`Marks for ${p.id}`} value={by[p.id] === undefined ? '' : String(by[p.id])} onChange={(e) => setBy((x) => ({ ...x, [p.id]: e.target.value === '' ? undefined : Number(e.target.value) }))}>
                <option value="">—</option>
                {halves(p.marks).map((m) => <option key={m} value={m}>{m}</option>)}
              </NativeSelect>
            </div>
          ))}
          <p className="text-sm font-medium">Total: {total} / {view.question.marks}</p>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Note (optional): anything another marker should know" />
          <Button type="button" disabled={busy || !complete} onClick={() => onSubmit({ byPoint: Object.fromEntries(view.points.map((p) => [p.id, by[p.id] as number])), ...(note.trim() ? { note: note.trim() } : {}) })}>{submitLabel}</Button>
          {!complete && <p className="text-xs text-muted-foreground">Give marks for every point (0 is a mark).</p>}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Key audit ─────────────────────────────────────────────────────────────────

type AuditVerdict = 'correct' | 'partly_correct' | 'wrong' | 'not_in_source'
type AuditPayload = { points: { id: string; verdict: AuditVerdict; note?: string }[]; missing: string[]; note?: string }
const VERDICT_LABEL: Record<AuditVerdict, string> = { correct: 'Correct', partly_correct: 'Partly correct', wrong: 'Wrong', not_in_source: 'Not in the source' }

export function KeyAuditForm({ view, initial, busy, submitLabel, onSubmit }: FormProps<'key_audit', AuditPayload>) {
  const [v, setV] = useState<Record<string, AuditVerdict | undefined>>(Object.fromEntries((initial?.points ?? []).map((p) => [p.id, p.verdict])))
  const [notes, setNotes] = useState<Record<string, string>>(Object.fromEntries((initial?.points ?? []).map((p) => [p.id, p.note ?? ''])))
  const [missing, setMissing] = useState((initial?.missing ?? []).join('\n'))
  const [note, setNote] = useState(initial?.note ?? '')
  const complete = view.points.every((p) => v[p.id])
  return (
    <div className="space-y-4">
      {view.question && <QuestionCard q={{ ...view.question, passageText: null }} />}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Sources the key was written from ({view.source})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {view.passages.length === 0 && <p className="text-sm text-muted-foreground">No passages (official scheme or the question&apos;s own passage).</p>}
          {view.passages.map((p) => (
            <div key={p.id} className="rounded-md border p-3 text-sm">
              <div className="mb-1 text-xs text-muted-foreground">{p.citation ?? 'Given passage'} · <code>{p.id.slice(0, 8)}</code></div>
              <p className="whitespace-pre-wrap">{p.text}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Check each point against the sources and the syllabus</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {view.referenceAnswer && <p className="rounded-md bg-muted p-3 text-sm"><span className="font-medium">Model answer: </span>{view.referenceAnswer}</p>}
          {view.points.map((p) => (
            <div key={p.id} className="space-y-2 border-b pb-3 last:border-0">
              <p className="text-sm"><span className="font-medium">{p.id}.</span> {p.text} <span className="text-muted-foreground">({p.marks} marks, {p.kind.replace('_', ' ')}, cites {p.cites.map((c) => c.slice(0, 8)).join(', ')})</span></p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(VERDICT_LABEL) as AuditVerdict[]).map((k) => (
                  <Button key={k} type="button" size="sm" variant={v[p.id] === k ? 'default' : 'outline'} onClick={() => setV((x) => ({ ...x, [p.id]: k }))}>{VERDICT_LABEL[k]}</Button>
                ))}
              </div>
              {v[p.id] && v[p.id] !== 'correct' && <Textarea rows={2} value={notes[p.id] ?? ''} onChange={(e) => setNotes((x) => ({ ...x, [p.id]: e.target.value }))} placeholder="What is wrong, and what should it say?" />}
            </div>
          ))}
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Points the key is missing (one per line)</span>
            <Textarea rows={3} value={missing} onChange={(e) => setMissing(e.target.value)} />
          </label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Note (optional)" />
          <Button type="button" disabled={busy || !complete} onClick={() => onSubmit({
            points: view.points.map((p) => ({ id: p.id, verdict: v[p.id] as AuditVerdict, ...(notes[p.id]?.trim() ? { note: notes[p.id].trim() } : {}) })),
            missing: missing.split('\n').map((s) => s.trim()).filter(Boolean),
            ...(note.trim() ? { note: note.trim() } : {}),
          })}>{submitLabel}</Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ── De-identification ─────────────────────────────────────────────────────────

type Region = { x: number; y: number; w: number; h: number }
type DeidPayload = { verdict: 'clean' | 'needs_blanking'; regions: Region[]; note?: string }

export function DeidentifyForm({ view, initial, busy, submitLabel, onSubmit }: FormProps<'deidentify', DeidPayload>) {
  const [regions, setRegions] = useState<Region[]>(initial?.regions ?? [])
  const [draft, setDraft] = useState<Region | null>(null)
  const [note, setNote] = useState(initial?.note ?? '')
  const box = useRef<HTMLDivElement>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const at = (e: ReactPointerEvent) => {
    const r = box.current!.getBoundingClientRect()
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }
  }
  const rect = (a: { x: number; y: number }, b: { x: number; y: number }): Region => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) })
  if (!view.image) return <p className="text-sm text-red-600">This item has no image.</p>
  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-muted/40 p-3 text-sm">
        Look for anything that identifies a person or school: names, roll or admission numbers, signatures, school names or stamps, phone numbers.
        If you see any, drag a box over each one and choose &ldquo;Needs blanking&rdquo;.
      </div>
      <div ref={box} className="relative touch-none select-none overflow-hidden rounded-md border bg-white"
        onPointerDown={(e) => {
          e.preventDefault()
          start.current = at(e)
          setDraft(rect(start.current, start.current))
          try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* capture is a convenience: drawing works without it */ }
        }}
        onPointerMove={(e) => { if (start.current) setDraft(rect(start.current, at(e))) }}
        onPointerUp={(e) => { if (start.current) { const r = rect(start.current, at(e)); if (r.w > 0.01 && r.h > 0.01) setRegions((x) => [...x, r]) } start.current = null; setDraft(null) }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- private, per-request image from our API */}
        <img src={view.image} alt="Page to check for personal data" className="block w-full" draggable={false} />
        {[...regions, ...(draft ? [draft] : [])].map((g, i) => (
          <div key={i} className="absolute border-2 border-red-600 bg-red-600/30" style={{ left: `${g.x * 100}%`, top: `${g.y * 100}%`, width: `${g.w * 100}%`, height: `${g.h * 100}%` }} />
        ))}
      </div>
      {regions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {regions.length} box{regions.length > 1 ? 'es' : ''} marked.
          <Button type="button" size="sm" variant="outline" onClick={() => setRegions((x) => x.slice(0, -1))}>Undo last box</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setRegions([])}>Clear</Button>
        </div>
      )}
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Note (optional)" />
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy || regions.length > 0} onClick={() => onSubmit({ verdict: 'clean', regions: [], ...(note.trim() ? { note: note.trim() } : {}) })}>Clean: nothing identifying</Button>
        <Button type="button" variant="destructive" disabled={busy || regions.length === 0} onClick={() => onSubmit({ verdict: 'needs_blanking', regions, ...(note.trim() ? { note: note.trim() } : {}) })}>Needs blanking ({submitLabel.toLowerCase()})</Button>
      </div>
    </div>
  )
}

export function TaskForm(props: { view: TaskView; initial?: unknown; busy: boolean; submitLabel: string; onSubmit: (payload: Record<string, unknown>) => void }) {
  const { view, initial, ...rest } = props
  const submit = (p: object) => rest.onSubmit(p as Record<string, unknown>)
  if (view.kind === 'transcribe') return <TranscribeForm view={view} initial={initial as never} {...rest} onSubmit={submit} />
  if (view.kind === 'blind_mark') return <BlindMarkForm view={view} initial={initial as never} {...rest} onSubmit={submit} />
  if (view.kind === 'key_audit') return <KeyAuditForm view={view} initial={initial as never} {...rest} onSubmit={submit} />
  return <DeidentifyForm view={view} initial={initial as never} {...rest} onSubmit={submit} />
}
