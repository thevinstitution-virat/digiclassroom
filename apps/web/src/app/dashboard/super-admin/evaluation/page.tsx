'use client'

// Virat Evaluator management (super admin): raters, tasks from a dataset version, assignment,
// progress, and the export of finished work as reference data.

import { useState } from 'react'
import { api } from '@/lib/trpc/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { HwError, HwLoading, HwMessage } from '@/components/hw/HwShell'
import { Field } from '@/components/hw/fields'
import { EvalShell, KIND_LABEL } from '@/components/hw-eval/EvalShell'

const KINDS = ['transcribe', 'blind_mark', 'key_audit', 'deidentify'] as const
const skillsOf = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean)

function Raters() {
  const utils = api.useUtils()
  const list = api.hwEval.admin.raters.useQuery()
  const create = api.hwEval.admin.createRater.useMutation({ onSuccess: () => { utils.hwEval.admin.raters.invalidate(); setEmail(''); setPseudonym(''); setSkills('') } })
  const update = api.hwEval.admin.updateRater.useMutation({ onSuccess: () => utils.hwEval.admin.raters.invalidate() })
  const [email, setEmail] = useState('')
  const [pseudonym, setPseudonym] = useState('')
  const [skills, setSkills] = useState('')
  const [editing, setEditing] = useState<{ id: string; skills: string } | null>(null)

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Raters</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          Skills: <code>transcribe</code>, <code>deidentify</code>, <code>adjudicate</code>, <code>mark:&lt;subject&gt;</code>, <code>audit:&lt;subject&gt;</code> (e.g. <code>mark:science</code>).
          Student and parent accounts cannot be raters. Raters see each other only by pseudonym.
        </p>
        {list.isLoading ? <HwLoading /> : list.error ? <HwError message={list.error.message} onRetry={() => list.refetch()} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-xs text-muted-foreground"><tr><th className="py-1 pr-3">Pseudonym</th><th className="pr-3">Account</th><th className="pr-3">Skills</th><th className="pr-3">Waiting / done</th><th /></tr></thead>
              <tbody>
                {list.data!.map((r) => (
                  <tr key={r.id} className="border-t align-top">
                    <td className="py-2 pr-3 font-medium">{r.pseudonym}{!r.active && <Badge variant="outline" className="ml-2">inactive</Badge>}</td>
                    <td className="pr-3">{r.email}</td>
                    <td className="pr-3">
                      {editing && editing.id === r.id
                        ? <div className="flex gap-1"><Input value={editing.skills} onChange={(e) => setEditing({ id: r.id, skills: e.target.value })} className="h-8" /><Button size="sm" onClick={() => update.mutate({ raterId: r.id, skills: skillsOf(editing.skills) }, { onSuccess: () => setEditing(null) })}>Save</Button></div>
                        : <button type="button" className="text-left hover:underline" onClick={() => setEditing({ id: r.id, skills: r.skills.join(', ') })}>{r.skills.join(', ') || '(none)'}</button>}
                    </td>
                    <td className="pr-3">{r.pending} / {r.done}</td>
                    <td><Button size="sm" variant="outline" onClick={() => update.mutate({ raterId: r.id, active: !r.active })}>{r.active ? 'Deactivate' : 'Activate'}</Button></td>
                  </tr>
                ))}
                {!list.data!.length && <tr><td colSpan={5} className="py-2 text-muted-foreground">No raters yet.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        {update.error && <HwMessage tone="error">{update.error.message}</HwMessage>}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Account email"><Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" /></Field>
          <Field label="Pseudonym" hint="3–40 letters, digits, _ or -"><Input value={pseudonym} onChange={(e) => setPseudonym(e.target.value)} /></Field>
          <Field label="Skills" hint="comma-separated"><Input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="transcribe, mark:science" /></Field>
        </div>
        <Button disabled={create.isPending || !email || !pseudonym} onClick={() => create.mutate({ email, pseudonym, skills: skillsOf(skills) })}>Add rater</Button>
        {create.error && <HwMessage tone="error">{create.error.message}</HwMessage>}
      </CardContent>
    </Card>
  )
}

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

function Dataset() {
  const known = api.hwEval.admin.datasets.useQuery()
  const [ref, setRef] = useState('')
  const valid = /^[a-z0-9][a-z0-9_-]*@v[0-9]+$/.test(ref)
  const progress = api.hwEval.admin.progress.useQuery({ datasetRef: ref }, { enabled: valid })
  const createTasks = api.hwEval.admin.createTasks.useMutation({ onSuccess: () => progress.refetch() })
  const assign = api.hwEval.admin.assign.useMutation({ onSuccess: () => progress.refetch() })
  const exp = api.hwEval.admin.exportReference.useMutation({ onSuccess: (d) => download(`${ref.replace('@', '-')}-reference.json`, d) })
  const table = KINDS.map((k) => ({ k, rows: (progress.data ?? []).filter((r) => r.kind === k) }))

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Tasks for a dataset version</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Dataset (name@vN)"><Input value={ref} onChange={(e) => setRef(e.target.value.trim())} placeholder="pilot-sst@v1" className="w-64" /></Field>
          {(known.data ?? []).map((d) => <Button key={d} size="sm" variant="outline" onClick={() => setRef(d)}>{d}</Button>)}
        </div>
        {valid && (
          <>
            {progress.isLoading ? <HwLoading /> : progress.error ? <HwError message={progress.error.message} /> : (
              <table className="w-full text-left">
                <thead className="text-xs text-muted-foreground"><tr><th className="py-1">Kind</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {table.map(({ k, rows }) => (
                    <tr key={k} className="border-t align-top">
                      <td className="py-2 pr-3 font-medium">{KIND_LABEL[k]}</td>
                      <td className="pr-3">{rows.length ? rows.map((r) => <Badge key={r.status} variant="secondary" className="mr-1">{r.status.replace('_', ' ')}: {r.n}</Badge>) : <span className="text-muted-foreground">no tasks</span>}</td>
                      <td><Button size="sm" variant="outline" disabled={createTasks.isPending} onClick={() => createTasks.mutate({ datasetRef: ref, kind: k })}>Create tasks</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {createTasks.data && <p>{createTasks.data.created} new tasks ({createTasks.data.eligible} eligible items; existing tasks are kept).</p>}
            <div className="flex flex-wrap gap-2">
              <Button disabled={assign.isPending} onClick={() => assign.mutate({ datasetRef: ref })}>Assign open tasks to raters</Button>
              <Button variant="outline" disabled={exp.isPending} onClick={() => exp.mutate({ datasetRef: ref })}>Download reference export</Button>
            </div>
            {assign.data && <p>{assign.data.assigned} assignments made.{assign.data.unfilled.length > 0 && <> Not filled: {assign.data.unfilled.join('; ')}.</>}</p>}
            {[createTasks.error, assign.error, exp.error].filter(Boolean).map((e, i) => <HwMessage key={i} tone="error">{e!.message}</HwMessage>)}
            <p className="text-xs text-muted-foreground">
              The export holds the agreed or adjudicated values with each rater&apos;s own values by pseudonym. Turn it into a new dataset version with
              <code> npm run hw:eval:reference -- apply</code>. Datasets themselves never change.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default function EvaluationAdminPage() {
  return (
    <EvalShell title="Evaluation" subtitle="Raters, human transcription and marking tasks, and reference data for the Virat Evaluator." needs="superAdmin">
      <div className="space-y-5">
        <Raters />
        <Dataset />
      </div>
    </EvalShell>
  )
}
