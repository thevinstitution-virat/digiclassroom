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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TenantsTab } from '@/components/hw-eval/admin/TenantsTab'
import { EligibilityTab } from '@/components/hw-eval/admin/EligibilityTab'
import { MonitoringTab } from '@/components/hw-eval/admin/MonitoringTab'
import { RunsTab } from '@/components/hw-eval/admin/RunsTab'

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

// Invite someone who has no account yet (roadmap task 3.2): they sign up with this address, verify it, and become a rater.
function Invites() {
  const utils = api.useUtils()
  const list = api.hwEval.admin.invites.useQuery()
  const invite = api.hwEval.admin.inviteRater.useMutation({ onSuccess: () => { utils.hwEval.admin.invites.invalidate(); setEmail(''); setPseudonym(''); setSkills('') } })
  const cancel = api.hwEval.admin.cancelInvite.useMutation({ onSuccess: () => utils.hwEval.admin.invites.invalidate() })
  const [email, setEmail] = useState('')
  const [pseudonym, setPseudonym] = useState('')
  const [skills, setSkills] = useState('')

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Invite an evaluator by email</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          For people who have no account yet. They get an email (English and Hindi) with a sign-up link; once they confirm their email address, they become a rater with this pseudonym and these skills.
          The invitation is valid for 30 days. A student or parent account of an institution cannot become a rater; the invitation is then marked blocked, with the reason.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Email address"><Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" /></Field>
          <Field label="Pseudonym" hint="3–40 letters, digits, _ or -"><Input value={pseudonym} onChange={(e) => setPseudonym(e.target.value)} /></Field>
          <Field label="Skills" hint="comma-separated"><Input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="transcribe, mark:science" /></Field>
        </div>
        <Button disabled={invite.isPending || !email || !pseudonym} onClick={() => invite.mutate({ email, pseudonym, skills: skillsOf(skills) })}>Send invitation</Button>
        {invite.error && <HwMessage tone="error">{invite.error.message}</HwMessage>}
        {invite.data && (
          <HwMessage>
            {invite.data.emailSent ? 'Invitation sent.' : `The invitation was saved but the email could not be sent (${invite.data.emailError}). Send this link yourself:`}
            {!invite.data.emailSent && <span className="mt-1 block break-all font-mono text-xs">{invite.data.link}</span>}
          </HwMessage>
        )}
        {list.isLoading ? <HwLoading /> : list.error ? <HwError message={list.error.message} onRetry={() => list.refetch()} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-xs text-muted-foreground"><tr><th className="py-1 pr-3">Email</th><th className="pr-3">Pseudonym</th><th className="pr-3">Status</th><th className="pr-3">Valid until</th><th /></tr></thead>
              <tbody>
                {list.data!.map((i) => (
                  <tr key={i.id} className="border-t align-top">
                    <td className="py-2 pr-3">{i.email}</td>
                    <td className="pr-3 font-medium">{i.pseudonym}</td>
                    <td className="pr-3">
                      <Badge variant={i.state === 'accepted' ? 'default' : 'secondary'}>{i.state}</Badge>
                      {i.state === 'blocked' && i.blockedReason && <div className="mt-1 text-xs text-muted-foreground">{i.blockedReason}</div>}
                    </td>
                    <td className="pr-3">{new Date(i.expiresAt).toLocaleDateString()}</td>
                    <td>{i.state === 'pending' && <Button size="sm" variant="outline" disabled={cancel.isPending} onClick={() => cancel.mutate({ inviteId: i.id })}>Cancel</Button>}</td>
                  </tr>
                ))}
                {!list.data!.length && <tr><td colSpan={5} className="py-2 text-muted-foreground">No invitations yet.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        {cancel.error && <HwMessage tone="error">{cancel.error.message}</HwMessage>}
      </CardContent>
    </Card>
  )
}

// Consent records (roadmap task 3.1). Only the platform owner sees this tab. A record holds a pseudonym, never a name; the account link
// exists only for volunteers and teachers who copy texts by hand. Withdrawing is one action: the next dataset version leaves the person out.
const SOURCES = [['A', 'A: volunteers copy known texts'], ['B', 'B: constructed answers'], ['C', 'C: real student answers'], ['D', 'D: previously checked copies'], ['E', 'E: teacher marking baseline'], ['F', 'F: answer keys']] as const
const USES = [['evaluation', 'evaluation'], ['shadow', 'shadow mode'], ['report', 'the report']] as const

function Consents() {
  const utils = api.useUtils()
  const list = api.hwEval.admin.consents.useQuery()
  const record = api.hwEval.admin.recordConsent.useMutation({ onSuccess: () => { utils.hwEval.admin.consents.invalidate(); setPseudonym(''); setEmail(''); setCollected(''); setGuardian('') } })
  const withdraw = api.hwEval.admin.withdrawConsent.useMutation({ onSuccess: () => utils.hwEval.admin.consents.invalidate() })
  const [kind, setKind] = useState<'volunteer' | 'teacher' | 'parent' | 'student'>('volunteer')
  const [pseudonym, setPseudonym] = useState('')
  const [org, setOrg] = useState('')
  const [form, setForm] = useState('')
  const [lang, setLang] = useState<'en' | 'hi'>('en')
  const [sources, setSources] = useState<string[]>(['A'])
  const [uses, setUses] = useState<string[]>(['evaluation'])
  const [signed, setSigned] = useState('')
  const [collected, setCollected] = useState('')
  const [email, setEmail] = useState('')
  const [guardian, setGuardian] = useState('')
  const toggle = (xs: string[], set: (v: string[]) => void, v: string) => set(xs.includes(v) ? xs.filter((x) => x !== v) : [...xs, v])
  const parents = (list.data ?? []).filter((c) => c.subjectKind === 'parent' && c.status === 'active')
  const needsAccount = (kind === 'volunteer' || kind === 'teacher') && sources.includes('A')
  const ready = pseudonym && form && signed && collected && sources.length && uses.length && (!needsAccount || email) && (kind !== 'student' || guardian)

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Consent</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          Record the signed form of every person whose work is used. Work of real people (sources A, C, D, E) becomes a task only while a live consent covers it.
          A student needs a parent&apos;s record first. Withdrawing is one action and cannot be undone: open tasks on the person&apos;s items stop, the runner refuses any dataset version that
          contains them, and the next version leaves them out. Forms: docs/hw-eval/consent-forms (get them reviewed legally before use).
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Who signed">
            <select className="h-9 w-full rounded-md border bg-background px-2" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="volunteer">Volunteer (adult)</option><option value="teacher">Teacher</option><option value="parent">Parent</option><option value="student">Student (with a parent&apos;s record)</option>
            </select>
          </Field>
          <Field label="Pseudonym" hint="never a name"><Input value={pseudonym} onChange={(e) => setPseudonym(e.target.value)} /></Field>
          <Field label="School id" hint="optional"><Input value={org} onChange={(e) => setOrg(e.target.value)} /></Field>
          <Field label="Form version" hint="e.g. volunteer-v1"><Input value={form} onChange={(e) => setForm(e.target.value)} /></Field>
          <Field label="Form language">
            <select className="h-9 w-full rounded-md border bg-background px-2" value={lang} onChange={(e) => setLang(e.target.value as 'en' | 'hi')}><option value="en">English</option><option value="hi">हिन्दी</option></select>
          </Field>
          <Field label="Date signed"><Input type="date" value={signed} onChange={(e) => setSigned(e.target.value)} /></Field>
          <Field label="Collected by" hint="a name or a role"><Input value={collected} onChange={(e) => setCollected(e.target.value)} /></Field>
          {(kind === 'volunteer' || kind === 'teacher') && <Field label={needsAccount ? 'Account email (needed for source A)' : 'Account email (optional)'}><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>}
          {kind === 'student' && (
            <Field label="Parent's record">
              <select className="h-9 w-full rounded-md border bg-background px-2" value={guardian} onChange={(e) => setGuardian(e.target.value)}>
                <option value="" />{parents.map((p) => <option key={p.id} value={p.id}>{p.pseudonym} · {p.sources.join('')} · {p.formVersion}</option>)}
              </select>
            </Field>
          )}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <fieldset className="space-y-1"><legend className="font-medium">Sources agreed</legend>
            {SOURCES.map(([k, label]) => <label key={k} className="mr-4 inline-flex items-center gap-1"><input type="checkbox" checked={sources.includes(k)} onChange={() => toggle(sources, setSources, k)} />{label}</label>)}
          </fieldset>
          <fieldset className="space-y-1"><legend className="font-medium">Uses agreed</legend>
            {USES.map(([k, label]) => <label key={k} className="mr-4 inline-flex items-center gap-1"><input type="checkbox" checked={uses.includes(k)} onChange={() => toggle(uses, setUses, k)} />{label}</label>)}
          </fieldset>
        </div>
        <Button disabled={record.isPending || !ready} onClick={() => record.mutate({
          subjectKind: kind, pseudonym, organizationId: org || null, formVersion: form, language: lang, sources: sources as ('A' | 'B' | 'C' | 'D' | 'E' | 'F')[],
          uses: uses as ('evaluation' | 'shadow' | 'report')[], signedAt: signed, collectedBy: collected, ...(email ? { subjectEmail: email } : {}), ...(guardian ? { guardianConsentId: guardian } : {}),
        })}>Record consent</Button>
        {record.error && <HwMessage tone="error">{record.error.message}</HwMessage>}
        {withdraw.error && <HwMessage tone="error">{withdraw.error.message}</HwMessage>}
        {withdraw.data && <p>Withdrawn ({withdraw.data.withdrawn} record{withdraw.data.withdrawn === 1 ? '' : 's'}); {withdraw.data.cancelledTasks} open task{withdraw.data.cancelledTasks === 1 ? '' : 's'} stopped. Make the next dataset version with: npm run hw:eval:consent -- withdrawn, then exclude.</p>}
        {list.isLoading ? <HwLoading /> : list.error ? <HwError message={list.error.message} onRetry={() => list.refetch()} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-xs text-muted-foreground"><tr><th className="py-1 pr-3">Pseudonym</th><th className="pr-3">Kind</th><th className="pr-3">Sources / uses</th><th className="pr-3">Signed</th><th className="pr-3">Status</th><th className="pr-3">Account</th><th /></tr></thead>
              <tbody>
                {list.data!.map((c) => (
                  <tr key={c.id} className="border-t align-top">
                    <td className="py-2 pr-3 font-medium">{c.pseudonym ?? '(none)'}</td>
                    <td className="pr-3">{c.subjectKind}</td>
                    <td className="pr-3">{c.sources.join('') || '–'} · {c.uses.join(', ') || '–'}</td>
                    <td className="pr-3">{c.signedAt}<div className="text-xs text-muted-foreground">{c.formVersion} ({c.language}) · {c.collectedBy ?? '–'}</div></td>
                    <td className="pr-3">
                      <Badge variant={c.status === 'active' ? 'default' : 'secondary'}>{c.status === 'parent_withdrawn' ? "parent's withdrawn" : c.status}</Badge>
                      {c.withdrawnReason && <div className="mt-1 text-xs text-muted-foreground">{c.withdrawnReason}</div>}
                    </td>
                    <td className="pr-3">{c.accountEmail ?? '–'}</td>
                    <td>{c.status !== 'withdrawn' ? (
                      <Button size="sm" variant="outline" disabled={withdraw.isPending} onClick={() => {
                        const reason = window.prompt('Why is this consent being withdrawn? (kept in the audit record)')
                        if (reason && reason.trim().length >= 3 && window.confirm('Withdraw this consent? This cannot be undone.')) withdraw.mutate({ consentId: c.id, reason })
                      }}>Withdraw</Button>
                    ) : null}</td>
                  </tr>
                ))}
                {!list.data!.length && <tr><td colSpan={7} className="py-2 text-muted-foreground">No consent recorded yet.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
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
            {createTasks.data && <p>{createTasks.data.created} new tasks ({createTasks.data.eligible} eligible items; existing tasks are kept).{createTasks.data.skippedNoConsent > 0 && <> {createTasks.data.skippedNoConsent} item(s) skipped: no live consent covers them.</>}</p>}
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
      <Tabs defaultValue="raters" className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="raters">Raters</TabsTrigger>
          <TabsTrigger value="consent">Consent</TabsTrigger>
          <TabsTrigger value="tenants">Tenants</TabsTrigger>
          <TabsTrigger value="eligibility">Eligibility</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          <TabsTrigger value="runs">Runs &amp; gates</TabsTrigger>
        </TabsList>
        <TabsContent value="raters" className="space-y-5">
          <Raters />
          <Invites />
          <Dataset />
        </TabsContent>
        <TabsContent value="consent"><Consents /></TabsContent>
        <TabsContent value="tenants"><TenantsTab /></TabsContent>
        <TabsContent value="eligibility"><EligibilityTab /></TabsContent>
        <TabsContent value="monitoring"><MonitoringTab /></TabsContent>
        <TabsContent value="runs"><RunsTab /></TabsContent>
      </Tabs>
    </EvalShell>
  )
}
