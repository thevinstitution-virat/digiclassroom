// One package: its details, its sets (with what stops each from being published), adding a mock or a board paper, publishing, and grants.

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileText, Plus } from 'lucide-react'
import { api } from '@/lib/trpc/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { HwError, HwLoading } from '@/components/hw/HwShell'
import { Field, NativeSelect } from '@/components/hw/fields'
import { BASE, Crumbs, KIND_LABEL, Note, StatusBadge, rupees } from './shared'

type Pkg = { id: string; status: string; title: string; blurb: string; pricePaise: number; attemptsPerSet: number }

function Details({ pkg, onSaved }: { pkg: Pkg; onSaved: () => void }) {
  const [f, setF] = useState({ title: pkg.title, blurb: pkg.blurb, price: String(pkg.pricePaise / 100), attempts: String(pkg.attemptsPerSet) })
  const [saved, setSaved] = useState(false)
  const update = api.hw.exams.admin.update.useMutation({ onSuccess: () => { setSaved(true); onSaved() } })
  const draft = pkg.status === 'draft'
  const save = () => {
    setSaved(false)
    update.mutate({
      packageId: pkg.id,
      patch: { title: f.title.trim(), blurb: f.blurb, pricePaise: Math.round(Number(f.price) * 100), ...(draft && { attemptsPerSet: Number(f.attempts) }) },
    })
  }
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Details</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Description"><Textarea rows={3} value={f.blurb} onChange={(e) => setF({ ...f, blurb: e.target.value })} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Price (₹)"><Input type="number" min={0} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field>
          <Field label="Attempts per set" hint={draft ? undefined : 'fixed once published'}>
            <Input type="number" min={1} max={50} value={f.attempts} disabled={!draft} onChange={(e) => setF({ ...f, attempts: e.target.value })} />
          </Field>
        </div>
        <Note tone="error">{update.error?.message}</Note>
        {saved && <Note>Saved.</Note>}
        <Button size="sm" onClick={save} disabled={update.isPending || !f.title.trim()}>Save details</Button>
      </CardContent>
    </Card>
  )
}

function AddMock({ packageId, onCancel }: { packageId: string; onCancel: () => void }) {
  const router = useRouter()
  const [f, setF] = useState({ kind: 'mock_full' as 'mock_full' | 'mock_half', subject: '', subjectCode: '', title: '', maxMarks: '80', duration: '180', scope: '' })
  const add = api.hw.exams.admin.addSet.useMutation({ onSuccess: (r) => router.push(`${BASE}/${packageId}/sets/${r.id}`) })
  const scope = f.scope.split('\n').map((s) => s.trim()).filter(Boolean)
  return (
    <div className="space-y-3 rounded-md border p-4">
      <p className="font-medium">New mock test</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Kind">
          <NativeSelect value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as typeof f.kind })}>
            <option value="mock_full">Full-syllabus mock</option>
            <option value="mock_half">Half-syllabus mock</option>
          </NativeSelect>
        </Field>
        <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Science mock test 1" /></Field>
        <Field label="Subject"><Input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} placeholder="Science" /></Field>
        <Field label="Subject code"><Input value={f.subjectCode} onChange={(e) => setF({ ...f, subjectCode: e.target.value })} placeholder="086" /></Field>
        <Field label="Out of (marks)"><Input type="number" min={1} step="0.5" value={f.maxMarks} onChange={(e) => setF({ ...f, maxMarks: e.target.value })} /></Field>
        <Field label="Time (minutes)"><Input type="number" min={5} max={360} value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })} /></Field>
      </div>
      {f.kind === 'mock_half' && (
        <Field label="Chapters covered" hint="one per line; a half-syllabus mock must list them">
          <Textarea rows={4} value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })} />
        </Field>
      )}
      <Note tone="error">{add.error?.message}</Note>
      <div className="flex gap-2">
        <Button size="sm" disabled={add.isPending || !f.title.trim() || !f.subject.trim() || !f.subjectCode.trim()} onClick={() => add.mutate({
          packageId, set: { kind: f.kind, subject: f.subject.trim(), subjectCode: f.subjectCode.trim(), title: f.title.trim(), maxMarks: Number(f.maxMarks), durationMinutes: Number(f.duration), syllabusScope: scope },
        })}>Create mock</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

function AddPaper({ packageId, onCancel }: { packageId: string; onCancel: () => void }) {
  const router = useRouter()
  const papers = api.hw.exams.admin.papers.useQuery(undefined, { staleTime: 300_000 })
  const [paperId, setPaperId] = useState('')
  const [duration, setDuration] = useState('')
  const add = api.hw.exams.admin.setFromPaper.useMutation({ onSuccess: (r) => router.push(`${BASE}/${packageId}/sets/${r.id}`) })
  const chosen = paperId || papers.data?.[0]?.paperId || ''
  return (
    <div className="space-y-3 rounded-md border p-4">
      <p className="font-medium">A board paper as a set</p>
      <p className="text-sm text-muted-foreground">Every published question of the paper is added in order, with the paper’s own marks and time. Only papers a teacher has checked and you have published appear here.</p>
      {papers.isLoading ? <HwLoading /> : papers.error ? <HwError message={papers.error.message} /> : !papers.data!.length ? (
        <p className="text-sm">No board paper is published yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Field label="Paper">
            <NativeSelect value={chosen} onChange={(e) => setPaperId(e.target.value)}>
              {papers.data!.map((p) => <option key={p.paperId} value={p.paperId}>{p.board} {p.classLevel} {p.subject} ({p.subjectCode}) — {p.kind === 'sqp' ? 'sample paper' : 'past paper'} {p.session} · {p.questions} questions</option>)}
            </NativeSelect>
          </Field>
          <Field label="Time (minutes)" hint="blank = the paper’s own"><Input type="number" min={5} max={360} value={duration} onChange={(e) => setDuration(e.target.value)} className="sm:w-36" /></Field>
        </div>
      )}
      <Note tone="error">{add.error?.message}</Note>
      <div className="flex gap-2">
        <Button size="sm" disabled={!chosen || add.isPending} onClick={() => add.mutate({ packageId, paperId: chosen, ...(duration && { durationMinutes: Number(duration) }) })}>Add the paper</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

function Grant({ packageId }: { packageId: string }) {
  const [email, setEmail] = useState('')
  const [attempts, setAttempts] = useState('')
  const [days, setDays] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const grant = api.hw.exams.admin.grant.useMutation({ onSuccess: () => { setDone(`Granted to ${email.trim()}.`); setEmail('') } })
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Give this package to a learner</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">Without payment: a scholarship, a tester, a trial. Granting again to the same learner updates their access.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Learner’s email"><Input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setDone(null) }} /></Field>
          <Field label="Attempts per set" hint="blank = the package’s"><Input type="number" min={1} max={50} value={attempts} onChange={(e) => setAttempts(e.target.value)} /></Field>
          <Field label="Access for (days)" hint="blank = no end"><Input type="number" min={1} max={1000} value={days} onChange={(e) => setDays(e.target.value)} /></Field>
        </div>
        <Note tone="error">{grant.error?.message}</Note>
        <Note>{done}</Note>
        <Button size="sm" disabled={!email.trim() || grant.isPending} onClick={() => grant.mutate({
          email: email.trim(), packageId, attemptsPerSet: attempts ? Number(attempts) : null,
          expiresAt: days ? new Date(Date.now() + Number(days) * 86_400_000) : null,
        })}>Grant</Button>
      </CardContent>
    </Card>
  )
}

export function PackageDetail({ packageId }: { packageId: string }) {
  const utils = api.useUtils()
  const q = api.hw.exams.admin.get.useQuery({ packageId })
  const [adding, setAdding] = useState<'mock' | 'paper' | null>(null)
  const [publishProblems, setPublishProblems] = useState<string[]>([])
  const refresh = () => { utils.hw.exams.admin.get.invalidate({ packageId }); utils.hw.exams.admin.list.invalidate() }
  const publish = api.hw.exams.admin.publish.useMutation({ onSuccess: (r) => { setPublishProblems(r.problems); refresh() } })
  const setOpen = api.hw.exams.admin.setOpen.useMutation({ onSuccess: refresh })

  if (q.isLoading) return <HwLoading />
  if (q.error) return <HwError message={q.error.message} onRetry={() => q.refetch()} />
  const { package: pkg, sets } = q.data!

  return (
    <div className="space-y-4">
      <Crumbs trail={[{ label: 'Exam packages', href: BASE }, { label: pkg.title }]} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight">{pkg.title} <StatusBadge status={pkg.status} /></h1>
          <p className="text-sm text-muted-foreground">{pkg.board} · Class {pkg.classLevel} · {pkg.examYear} boards · {pkg.attemptsPerSet} attempts per set · {rupees(pkg.pricePaise)} · <span className="font-mono">{pkg.slug}</span></p>
        </div>
        <div className="flex gap-2">
          {pkg.status === 'draft' && <Button onClick={() => publish.mutate({ packageId })} disabled={publish.isPending}>Publish package</Button>}
          {pkg.status === 'published' && <Button variant="outline" onClick={() => setOpen.mutate({ packageId, open: false })} disabled={setOpen.isPending}>Retire</Button>}
          {pkg.status === 'retired' && <Button variant="outline" onClick={() => setOpen.mutate({ packageId, open: true })} disabled={setOpen.isPending}>Reopen</Button>}
        </div>
      </div>
      {pkg.status === 'draft' && <p className="text-sm text-muted-foreground">Once published, the package’s board, class, year, short name and attempts per set are fixed: a learner’s past attempts must still mean what they meant. Retiring hides it from new learners; it never goes back to draft.</p>}
      <Note tone="error">{publish.error?.message ?? setOpen.error?.message}</Note>
      {publishProblems.length > 0 && <Note tone="error">{publishProblems.join(' ')}</Note>}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
          <CardTitle className="text-base">Sets</CardTitle>
          {!adding && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setAdding('paper')}><FileText className="mr-1 h-4 w-4" />Board paper</Button>
              <Button size="sm" variant="outline" onClick={() => setAdding('mock')}><Plus className="mr-1 h-4 w-4" />Mock test</Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {adding === 'mock' && <AddMock packageId={packageId} onCancel={() => setAdding(null)} />}
          {adding === 'paper' && <AddPaper packageId={packageId} onCancel={() => setAdding(null)} />}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted-foreground"><tr><th className="py-2 pr-3">Set</th><th className="pr-3">Kind</th><th className="pr-3">Subject</th><th className="pr-3">Questions</th><th className="pr-3">Marks</th><th className="pr-3">Time</th><th className="pr-3">Status</th></tr></thead>
              <tbody>
                {sets.map((s) => (
                  <tr key={s.id} className="border-t align-top">
                    <td className="py-2 pr-3">
                      <Link href={`${BASE}/${packageId}/sets/${s.id}`} className="font-medium hover:underline">{s.title}</Link>
                      {s.problems.length > 0 && <ul className="mt-1 list-disc pl-4 text-xs text-amber-700 dark:text-amber-400">{s.problems.map((p) => <li key={p}>{p}</li>)}</ul>}
                    </td>
                    <td className="pr-3">{KIND_LABEL[s.kind]}</td>
                    <td className="pr-3">{s.subject} <span className="text-muted-foreground">({s.subjectCode})</span></td>
                    <td className="pr-3">{s.items}</td>
                    <td className="pr-3">{s.attainable} / {s.maxMarks}</td>
                    <td className="pr-3">{s.durationMinutes} min</td>
                    <td className="pr-3"><StatusBadge status={s.status} /></td>
                  </tr>
                ))}
                {!sets.length && <tr><td colSpan={7} className="py-4 text-muted-foreground">No sets yet. Add a board paper or a mock test.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Details key={`${pkg.id}-${pkg.status}`} pkg={pkg} onSaved={refresh} />
        <Grant packageId={packageId} />
      </div>
    </div>
  )
}
