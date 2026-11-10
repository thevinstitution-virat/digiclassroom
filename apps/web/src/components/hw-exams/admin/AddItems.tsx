// Adding questions to a draft set: a published board-paper question (its content stays the bank's), or one the super-admin writes, with its
// marking scheme as value points. The value points are checked as they are typed, with the same rule the server applies.

import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { api } from '@/lib/trpc/client'
import { authoredProblems } from '@/lib/hw/exams/build-rules'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { HwError, HwLoading } from '@/components/hw/HwShell'
import { Field, NativeSelect } from '@/components/hw/fields'
import { Note, Problems, QTYPE_LABEL, marksText } from './shared'

export function BankPicker({ setId, onAdded, onCancel }: { setId: string; onAdded: () => void; onCancel: () => void }) {
  const papers = api.hw.exams.admin.papers.useQuery(undefined, { staleTime: 300_000 })
  const [paperId, setPaperId] = useState('')
  const [chapter, setChapter] = useState('')
  const [added, setAdded] = useState<string[]>([])
  const chosen = paperId || papers.data?.[0]?.paperId || ''
  const qs = api.hw.exams.admin.paperQuestions.useQuery({ paperId: chosen }, { enabled: chosen !== '' })
  const add = api.hw.exams.admin.addBankItem.useMutation({ onSuccess: (_r, v) => { setAdded((a) => [...a, v.rowId]); onAdded() } })
  const rows = (qs.data?.questions ?? []).filter((q) => q.variant === null)

  return (
    <div className="space-y-3 rounded-md border p-4">
      <p className="font-medium">Add a board-paper question</p>
      {papers.isLoading ? <HwLoading /> : papers.error ? <HwError message={papers.error.message} /> : !papers.data!.length ? <p className="text-sm">No board paper is published yet.</p> : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Paper">
              <NativeSelect value={chosen} onChange={(e) => setPaperId(e.target.value)}>
                {papers.data!.map((p) => <option key={p.paperId} value={p.paperId}>{p.board} {p.classLevel} {p.subject} — {p.kind === 'sqp' ? 'sample paper' : 'past paper'} {p.session}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Chapter for the questions you add" hint="used for the learner’s weak areas"><Input value={chapter} onChange={(e) => setChapter(e.target.value)} list="hw-exam-chapters" placeholder="Light – Reflection and Refraction" /></Field>
          </div>
          {qs.isLoading ? <HwLoading /> : qs.error ? <HwError message={qs.error.message} /> : (
            <ul className="max-h-96 divide-y overflow-y-auto rounded-md border">
              {rows.map((q) => (
                <li key={q.rowId} className="flex items-start gap-3 p-3 text-sm">
                  <span className="w-10 shrink-0 font-medium">Q{q.label}</span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2">{q.stem}</span>
                    <span className="mt-1 flex flex-wrap gap-1 text-xs text-muted-foreground">
                      <Badge variant="outline">{QTYPE_LABEL[q.qtype] ?? q.qtype}</Badge><Badge variant="outline">{marksText(q.marks)}</Badge>
                      {q.hasDrawing && <Badge variant="outline">has a drawing</Badge>}
                    </span>
                  </span>
                  {added.includes(q.rowId)
                    ? <span className="text-xs text-emerald-700">Added</span>
                    : <Button size="sm" variant="outline" disabled={add.isPending} onClick={() => add.mutate({ setId, rowId: q.rowId, ...(chapter.trim() && { chapter: chapter.trim() }) })}>Add</Button>}
                </li>
              ))}
              {!rows.length && <li className="p-3 text-sm text-muted-foreground">No published questions in this paper.</li>}
            </ul>
          )}
        </>
      )}
      <Note tone="error">{add.error?.message}</Note>
      <Button size="sm" variant="ghost" onClick={onCancel}>Done</Button>
    </div>
  )
}

type Point = { text: string; marks: string }
type Part = { label: string; marks: string; kind: 'text' | 'numeric' | 'equation' | 'diagram'; points: Point[] }
const KINDS: Part['kind'][] = ['text', 'numeric', 'equation', 'diagram']
const newPart = (label = ''): Part => ({ label, marks: '', kind: 'text', points: [{ text: '', marks: '' }] })
const LETTERS = ['A', 'B', 'C', 'D'] as const
type QType = 'mcq' | 'assertion_reason' | 'very_short' | 'short' | 'long' | 'case_based'

export function AuthoredForm({ setId, onAdded, onCancel }: { setId: string; onAdded: () => void; onCancel: () => void }) {
  const [qtype, setQtype] = useState<QType>('short')
  const [marks, setMarks] = useState('3')
  const [stem, setStem] = useState('')
  const [chapter, setChapter] = useState('')
  const [section, setSection] = useState('')
  const [options, setOptions] = useState(['', '', '', ''])
  const [correct, setCorrect] = useState<'' | (typeof LETTERS)[number]>('')
  const [parts, setParts] = useState<Part[]>([newPart()])
  const [saved, setSaved] = useState(false)
  const choice = qtype === 'mcq' || qtype === 'assertion_reason'
  const add = api.hw.exams.admin.addAuthoredItem.useMutation({
    onSuccess: () => { setSaved(true); setStem(''); setOptions(['', '', '', '']); setCorrect(''); setParts([newPart()]); onAdded() },
  })

  const builtParts = useMemo(() => parts.map((p, i) => ({
    label: p.label.trim(), alternative: null, marks: Number(p.marks), answer_kind: p.kind,
    value_points: p.points.filter((v) => v.text.trim()).map((v, j) => ({ id: `p${i + 1}v${j + 1}`, text: v.text.trim(), marks: Number(v.marks), quote: '' })),
  })), [parts])
  const problems = choice
    ? authoredProblems({ qtype, marks: Number(marks), options: options.filter((o) => o.trim()), correctOption: correct || null })
    : authoredProblems({ qtype, marks: Number(marks), parts: builtParts })
  const scheme = builtParts.flatMap((p) => p.value_points.map((v) => `${p.label ? `(${p.label}) ` : ''}${v.text} (${v.marks})`)).join('\n')

  const setPart = (i: number, patch: Partial<Part>) => setParts((ps) => ps.map((p, k) => (k === i ? { ...p, ...patch } : p)))
  const setPoint = (i: number, j: number, patch: Partial<Point>) => setPart(i, { points: parts[i]!.points.map((v, k) => (k === j ? { ...v, ...patch } : v)) })

  const submit = () => {
    setSaved(false)
    add.mutate({
      setId,
      item: {
        qtype, marks: Number(marks), stem: stem.trim(), ...(chapter.trim() && { chapter: chapter.trim() }), ...(section.trim() && { section: section.trim() }),
        ...(choice
          ? { options: options.map((o) => o.trim()), correctOption: correct || null }
          : { parts: builtParts, schemeText: scheme }),
      },
    })
  }

  return (
    <div className="space-y-3 rounded-md border p-4">
      <p className="font-medium">Write a question</p>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Type">
          <NativeSelect value={qtype} onChange={(e) => setQtype(e.target.value as QType)}>
            {Object.entries(QTYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Marks"><Input type="number" min={0.5} step="0.5" value={marks} onChange={(e) => setMarks(e.target.value)} /></Field>
        <Field label="Section" hint="optional"><Input value={section} onChange={(e) => setSection(e.target.value)} placeholder="B" /></Field>
        <Field label="Chapter"><Input value={chapter} onChange={(e) => setChapter(e.target.value)} list="hw-exam-chapters" /></Field>
      </div>
      <Field label="Question"><Textarea rows={3} value={stem} onChange={(e) => setStem(e.target.value)} /></Field>

      {choice ? (
        <div className="space-y-2">
          {LETTERS.map((l, i) => (
            <div key={l} className="flex items-center gap-2">
              <label className="flex w-16 items-center gap-1 text-sm"><input type="radio" name={`correct-${setId}`} aria-label={`${l} is the right answer`} checked={correct === l} onChange={() => setCorrect(l)} /> {l}</label>
              <Input value={options[i]} aria-label={`Option ${l}`} onChange={(e) => setOptions((o) => o.map((x, k) => (k === i ? e.target.value : x)))} />
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Choose the right option with the button beside it.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">The marking scheme, as value points: each point is one thing the answer must say, with its marks. Points add up to their part; parts add up to the question.</p>
          {parts.map((p, i) => (
            <div key={i} className="space-y-2 rounded-md bg-muted/40 p-3">
              <div className="grid gap-2 sm:grid-cols-[6rem_6rem_10rem_auto]">
                <Field label="Part label"><Input value={p.label} onChange={(e) => setPart(i, { label: e.target.value })} placeholder={parts.length > 1 ? 'a' : ''} /></Field>
                <Field label="Part marks"><Input type="number" min={0.5} step="0.5" value={p.marks} onChange={(e) => setPart(i, { marks: e.target.value })} /></Field>
                <Field label="Answer is">
                  <NativeSelect value={p.kind} onChange={(e) => setPart(i, { kind: e.target.value as Part['kind'] })}>{KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</NativeSelect>
                </Field>
                {parts.length > 1 && <div className="flex items-end"><Button size="sm" variant="ghost" onClick={() => setParts((ps) => ps.filter((_, k) => k !== i))}><Trash2 className="mr-1 h-4 w-4" />Remove part</Button></div>}
              </div>
              {p.points.map((v, j) => (
                <div key={j} className="flex gap-2">
                  <Input value={v.text} aria-label={`Value point ${j + 1}`} placeholder="e.g. Light bends when it passes from one medium to another" onChange={(e) => setPoint(i, j, { text: e.target.value })} />
                  <Input value={v.marks} aria-label={`Marks for value point ${j + 1}`} type="number" min={0.5} step="0.5" className="w-24" placeholder="marks" onChange={(e) => setPoint(i, j, { marks: e.target.value })} />
                  {p.points.length > 1 && <Button size="icon" variant="ghost" aria-label="Remove point" onClick={() => setPart(i, { points: p.points.filter((_, k) => k !== j) })}><Trash2 className="h-4 w-4" /></Button>}
                </div>
              ))}
              <Button size="sm" variant="ghost" onClick={() => setPart(i, { points: [...p.points, { text: '', marks: '' }] })}><Plus className="mr-1 h-4 w-4" />Value point</Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => setParts((ps) => [...ps, newPart(String.fromCharCode(97 + ps.length))])}><Plus className="mr-1 h-4 w-4" />Part</Button>
        </div>
      )}

      {stem.trim() && <Problems title="Before this can be added" items={problems} />}
      <Note tone="error">{add.error?.message}</Note>
      {saved && <Note>Added. Write the next one, or close.</Note>}
      <div className="flex gap-2">
        <Button size="sm" disabled={add.isPending || stem.trim().length < 3 || problems.length > 0} onClick={submit}>Add question</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Close</Button>
      </div>
    </div>
  )
}
