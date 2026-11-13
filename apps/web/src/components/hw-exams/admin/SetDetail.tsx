// One set: its settings, its questions in order, adding and arranging them while it is a draft, and publishing. Once published, the
// questions, marks and time are frozen by the database; only the title can still be corrected.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, FileText, PenLine, Trash2 } from 'lucide-react'
import { api } from '@/lib/trpc/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { HwError, HwLoading } from '@/components/hw/HwShell'
import { Field } from '@/components/hw/fields'
import { AuthoredForm, BankPicker } from './AddItems'
import { KeyBadges, KeyPanel } from './KeyPanel'
import { BASE, Crumbs, KIND_LABEL, Note, Problems, QTYPE_LABEL, StatusBadge, marksText } from './shared'

type SetRow = { id: string; status: string; title: string; maxMarks: number; durationMinutes: number; graceMinutes: number; syllabusScope: string[]; kind: string }

function Settings({ set, onSaved }: { set: SetRow; onSaved: () => void }) {
  const draft = set.status === 'draft'
  const [f, setF] = useState({ title: set.title, maxMarks: String(set.maxMarks), duration: String(set.durationMinutes), grace: String(set.graceMinutes), scope: set.syllabusScope.join('\n') })
  const [saved, setSaved] = useState(false)
  const update = api.hw.exams.admin.updateSet.useMutation({ onSuccess: () => { setSaved(true); onSaved() } })
  const save = () => {
    setSaved(false)
    update.mutate({
      setId: set.id,
      patch: draft
        ? { title: f.title.trim(), maxMarks: Number(f.maxMarks), durationMinutes: Number(f.duration), graceMinutes: Number(f.grace), syllabusScope: f.scope.split('\n').map((s) => s.trim()).filter(Boolean) }
        : { title: f.title.trim() },
    })
  }
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Settings</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Out of (marks)"><Input type="number" step="0.5" disabled={!draft} value={f.maxMarks} onChange={(e) => setF({ ...f, maxMarks: e.target.value })} /></Field>
          <Field label="Time (minutes)"><Input type="number" disabled={!draft} value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })} /></Field>
          <Field label="Upload time after (minutes)" hint="to photograph and upload the pages"><Input type="number" disabled={!draft} value={f.grace} onChange={(e) => setF({ ...f, grace: e.target.value })} /></Field>
        </div>
        {set.kind === 'mock_half' && (
          <Field label="Chapters covered" hint="one per line"><Textarea rows={4} disabled={!draft} value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })} /></Field>
        )}
        {!draft && <p className="text-xs text-muted-foreground">Marks, time and chapters are fixed now that the set is {set.status}.</p>}
        <Note tone="error">{update.error?.message}</Note>
        {saved && <Note>Saved.</Note>}
        <Button size="sm" onClick={save} disabled={update.isPending || !f.title.trim()}>Save settings</Button>
      </CardContent>
    </Card>
  )
}

/** The curriculum's chapter names, offered by every chapter field on the page (a datalist: anything else can still be typed). */
export const CHAPTER_LIST = 'hw-exam-chapters'

function ChapterCell({ itemId, value, editable, onSaved }: { itemId: string; value: string; editable: boolean; onSaved: () => void }) {
  const [v, setV] = useState(value)
  const update = api.hw.exams.admin.updateItem.useMutation({ onSuccess: onSaved })
  if (!editable) return <span>{value || <span className="text-muted-foreground">—</span>}</span>
  return (
    <span className="flex gap-1">
      <Input value={v} onChange={(e) => setV(e.target.value)} className="h-8 min-w-[10rem]" aria-label="Chapter" placeholder="chapter" list={CHAPTER_LIST} />
      {v !== value && <Button size="sm" className="h-8" disabled={update.isPending} onClick={() => update.mutate({ itemId, patch: { chapter: v.trim() } })}>Save</Button>}
    </span>
  )
}

export function SetDetail({ packageId, setId }: { packageId: string; setId: string }) {
  const router = useRouter()
  const utils = api.useUtils()
  const q = api.hw.exams.admin.getSet.useQuery({ setId })
  const pkg = api.hw.exams.admin.get.useQuery({ packageId })
  const [adding, setAdding] = useState<'bank' | 'authored' | null>(null)
  const [open, setOpenRow] = useState<string | null>(null)
  const [onlyToCheck, setOnlyToCheck] = useState(false)
  const [publishProblems, setPublishProblems] = useState<string[]>([])
  const refresh = () => { utils.hw.exams.admin.getSet.invalidate({ setId }); utils.hw.exams.admin.get.invalidate({ packageId }) }
  const publish = api.hw.exams.admin.publishSet.useMutation({ onSuccess: (r) => { setPublishProblems(r.problems); refresh() } })
  const setOpen = api.hw.exams.admin.setSetOpen.useMutation({ onSuccess: refresh })
  const del = api.hw.exams.admin.deleteSet.useMutation({ onSuccess: () => { utils.hw.exams.admin.get.invalidate({ packageId }); router.push(`${BASE}/${packageId}`) } })
  const remove = api.hw.exams.admin.removeItem.useMutation({ onSuccess: refresh })
  const reorder = api.hw.exams.admin.reorderItems.useMutation({ onSuccess: refresh })

  if (q.isLoading) return <HwLoading />
  if (q.error) return <HwError message={q.error.message} onRetry={() => q.refetch()} />
  const { set, items, attainable, problems, warnings, blueprint } = q.data!
  const draft = set.status === 'draft'
  const move = (i: number, by: -1 | 1) => {
    const ids = items.map((x) => x.id)
    const [it] = ids.splice(i, 1)
    ids.splice(i + by, 0, it!)
    reorder.mutate({ setId, orderedIds: ids })
  }
  const toCheck = items.filter((x) => x.keyToCheck && !x.keyCheckedBy).length
  const shown = onlyToCheck ? items.filter((x) => x.keyToCheck && !x.keyCheckedBy) : items
  const actionError = publish.error?.message ?? setOpen.error?.message ?? del.error?.message ?? remove.error?.message ?? reorder.error?.message

  return (
    <div className="space-y-4">
      <Crumbs trail={[{ label: 'Exam packages', href: BASE }, { label: pkg.data?.package.title ?? 'Package', href: `${BASE}/${packageId}` }, { label: set.title }]} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight">{set.title} <StatusBadge status={set.status} /></h1>
          <a href={`/exam-sheet/${set.id}?preview=admin`} target="_blank" rel="noopener" className="text-sm text-primary hover:underline">Preview answer sheet</a>
          <p className="text-sm text-muted-foreground">{KIND_LABEL[set.kind]} · {set.subject} ({set.subjectCode}) · {items.length} question{items.length === 1 ? '' : 's'} · {attainable} of {set.maxMarks} marks · {set.durationMinutes} min + {set.graceMinutes} min to upload</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {draft && <Button onClick={() => publish.mutate({ setId })} disabled={publish.isPending}>Publish set</Button>}
          {draft && <Button variant="ghost" disabled={del.isPending} onClick={() => { if (window.confirm('Delete this draft set and its questions?')) del.mutate({ setId }) }}><Trash2 className="mr-1 h-4 w-4" />Delete</Button>}
          {set.status === 'published' && <Button variant="outline" onClick={() => setOpen.mutate({ setId, open: false })} disabled={setOpen.isPending}>Retire</Button>}
          {set.status === 'retired' && <Button variant="outline" onClick={() => setOpen.mutate({ setId, open: true })} disabled={setOpen.isPending}>Reopen</Button>}
        </div>
      </div>
      <Note tone="error">{actionError}</Note>
      {draft && <Problems items={publishProblems.length ? publishProblems : problems} />}
      {draft && <Problems items={warnings} title="Worth a look (does not stop publishing)" />}
      {blueprint && (
        <>
          <datalist id={CHAPTER_LIST}>{blueprint.chapters.map((c) => <option key={c} value={c} />)}</datalist>
          {(set.kind === 'mock_full' || set.kind === 'mock_half') && (
            <p className="text-xs text-muted-foreground">
              Mocks are checked against the board’s {blueprint.session} curriculum: <a href={blueprint.source.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{blueprint.source.title}</a>.
            </p>
          )}
        </>
      )}
      {draft && items.some((x) => !x.chapter) && (
        <Note tone="error">
          {`${items.filter((x) => !x.chapter).length} of ${items.length} questions have no chapter (${items.filter((x) => !x.chapter).map((x) => `Q${x.number}${x.alt ?? ''}`).join(', ')}). `}
          A learner’s weak areas are reported by chapter, and chapters cannot be added once the set is published.
        </Note>
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
          <CardTitle className="text-base">Questions</CardTitle>
          {items.some((x) => x.keyToCheck) && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={onlyToCheck} onChange={(e) => setOnlyToCheck(e.target.checked)} />
              Only keys still to check ({toCheck})
            </label>
          )}
          {draft && !adding && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setAdding('bank')}><FileText className="mr-1 h-4 w-4" />From a board paper</Button>
              <Button size="sm" variant="outline" onClick={() => setAdding('authored')}><PenLine className="mr-1 h-4 w-4" />Write one</Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {draft && adding === 'bank' && <BankPicker setId={setId} onAdded={refresh} onCancel={() => setAdding(null)} />}
          {draft && adding === 'authored' && <AuthoredForm setId={setId} onAdded={refresh} onCancel={() => setAdding(null)} />}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted-foreground"><tr><th className="py-2 pr-3">No.</th><th className="pr-3">Question</th><th className="pr-3">Marks</th><th className="pr-3">Chapter</th>{draft && <th />}</tr></thead>
              <tbody>
                {shown.map((it) => { const i = items.indexOf(it); return (
                  <tr key={it.id} className="border-t align-top">
                    <td className="whitespace-nowrap py-2 pr-3 font-medium">Q{it.number}{it.alt ?? ''}{it.section && <div className="text-xs font-normal text-muted-foreground">Sec {it.section}</div>}</td>
                    <td className="max-w-xl pr-3">
                      <span className="line-clamp-2">{it.stem}</span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        <Badge variant="outline">{QTYPE_LABEL[it.qtype] ?? it.qtype}</Badge>
                        <Badge variant={it.bankQuestionId ? 'secondary' : 'outline'}>{it.bankQuestionId ? 'board paper' : 'written here'}</Badge>
                        {it.choiceGroup && <Badge variant="outline">internal choice</Badge>}
                        <KeyBadges it={it} />
                      </span>
                      {!it.bankQuestionId && (
                        <Button size="sm" variant="link" className="h-auto px-0" onClick={() => setOpenRow(open === it.id ? null : it.id)} aria-expanded={open === it.id}>
                          {open === it.id ? 'Hide the key' : 'Show the key'}
                        </Button>
                      )}
                      {open === it.id && <KeyPanel it={it} editable={draft} onChanged={refresh} />}
                    </td>
                    <td className="pr-3">{marksText(it.marks)}</td>
                    <td className="pr-3"><ChapterCell key={`${it.id}-${it.chapter}`} itemId={it.id} value={it.chapter} editable={draft} onSaved={refresh} /></td>
                    {draft && (
                      <td className="whitespace-nowrap">
                        <Button size="icon" variant="ghost" aria-label="Move up" disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" aria-label="Move down" disabled={i === items.length - 1 || reorder.isPending} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" aria-label="Remove" disabled={remove.isPending} onClick={() => remove.mutate({ itemId: it.id })}><Trash2 className="h-4 w-4" /></Button>
                      </td>
                    )}
                  </tr>
                ) })}
                {!items.length && <tr><td colSpan={5} className="py-4 text-muted-foreground">No questions yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Settings key={`${set.id}-${set.status}`} set={set} onSaved={refresh} />
    </div>
  )
}
