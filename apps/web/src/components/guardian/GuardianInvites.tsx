'use client'

// Invite a student's parent or guardian, and see who was invited and who is linked.
//   mode "institution": an institution admin picks a student of their own institution (B2B).
//   mode "independent": the platform owner picks a student who joined on their own, without an institution (B2C).
// The rules (who may invite whom) are enforced on the server in lib/guardian/onboarding.ts; this is only the screen.

import { useState } from 'react'
import { api } from '@/lib/trpc/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { HwError, HwLoading, HwMessage } from '@/components/hw/HwShell'
import { Field, NativeSelect } from '@/components/hw/fields'
import { useHwT } from '@/components/hw/strings'

type Sent = { link: string; emailSent: boolean; email: string }

export function GuardianInvites({ mode }: { mode: 'institution' | 'independent' }) {
  const { t, lang } = useHwT()
  const utils = api.useUtils()
  const on = api.guardian.enabled.useQuery()
  const enabled = on.data?.enabled === true
  const [search, setSearch] = useState('')
  const [applied, setApplied] = useState('')
  const [studentId, setStudentId] = useState('')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState<Sent | null>(null)
  const [copied, setCopied] = useState(false)

  const inst = api.guardian.institutionStudents.useQuery(undefined, { enabled: enabled && mode === 'institution', retry: false })
  const indep = api.guardian.independentLearners.useQuery({ search: applied }, { enabled: enabled && mode === 'independent', retry: false })
  const students = mode === 'institution' ? inst : indep
  const invites = api.guardian.invitations.useQuery(undefined, { enabled, retry: false })
  const links = api.guardian.links.useQuery(undefined, { enabled, retry: false })
  const refresh = () => { void utils.guardian.invitations.invalidate(); void utils.guardian.links.invalidate() }
  const afterSend = (r: { link: string; emailSent: boolean }) => { setSent({ link: r.link, emailSent: r.emailSent, email }); setEmail(''); setStudentId(''); setCopied(false); refresh() }
  const sendInst = api.guardian.inviteForInstitution.useMutation({ onSuccess: afterSend })
  const sendIndep = api.guardian.inviteForIndependent.useMutation({ onSuccess: afterSend })
  const send = mode === 'institution' ? sendInst : sendIndep
  const revoke = api.guardian.revokeInvitation.useMutation({ onSuccess: refresh })
  const end = api.guardian.endLink.useMutation({ onSuccess: refresh })

  const fmt = (d: Date | string) => new Date(d).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { dateStyle: 'medium' })
  const copy = async () => {
    if (!sent) return
    try { await navigator.clipboard.writeText(sent.link); setCopied(true) } catch { /* the link is shown and can be selected by hand */ }
  }

  if (on.isLoading) return <HwLoading />
  if (!enabled) return <HwMessage>{t('gi.off')}</HwMessage>

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>{t('gi.title')}</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">{t(mode === 'institution' ? 'gi.hintInst' : 'gi.hintSuper')}</p>
          {mode === 'independent' && (
            <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); setApplied(search.trim()); setStudentId('') }}>
              <Field label={t('gi.search')}><Input value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" /></Field>
              <Button type="submit" variant="outline">{t('gi.search')}</Button>
            </form>
          )}
          {students.isLoading ? <HwLoading /> : students.error ? <HwError message={students.error.message} onRetry={() => students.refetch()} /> : (
            !students.data?.length ? <p>{t('gi.noStudents')}</p> : (
              <form className="grid gap-3 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); setSent(null); if (studentId && email.trim()) send.mutate({ studentId, email: email.trim() }) }}>
                <Field label={t('gi.student')}>
                  <NativeSelect value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
                    <option value="" />
                    {students.data.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.email})</option>)}
                  </NativeSelect>
                </Field>
                <Field label={t('gi.email')}><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} /></Field>
                <div className="flex items-end"><Button type="submit" disabled={!studentId || !email.trim() || send.isPending}>{t('gi.send')}</Button></div>
              </form>
            )
          )}
          {send.error && <p role="alert" className="text-red-600">{send.error.message}</p>}
          {sent && (
            <div role="status" className="space-y-2 rounded border border-green-300 bg-green-50 p-3 text-green-900 dark:bg-green-950/30 dark:text-green-200">
              <p>{sent.emailSent ? t('gi.sent', { email: sent.email }) : t('gi.notSent')}</p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="break-all rounded bg-background/60 px-2 py-1 text-xs">{sent.link}</code>
                <Button size="sm" variant="outline" type="button" onClick={copy}>{copied ? t('gi.copied') : t('gi.copy')}</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t('gi.invites')}</CardTitle></CardHeader>
        <CardContent className="text-sm">
          {invites.isLoading ? <HwLoading /> : invites.error ? <HwError message={invites.error.message} onRetry={() => invites.refetch()} />
            : !invites.data?.length ? <p className="text-muted-foreground">{t('gi.noInvites')}</p> : (
              <ul className="divide-y">
                {invites.data.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span><strong>{i.studentName}</strong> ← {i.guardianEmail}
                      <Badge variant="outline" className="ml-2">{t(`gi.st.${i.status}` as const)}</Badge>
                      {i.status === 'open' && <span className="ml-2 text-muted-foreground">{t('gi.expires', { date: fmt(i.expiresAt) })}</span>}
                    </span>
                    {i.status === 'open' && <Button size="sm" variant="outline" disabled={revoke.isPending} onClick={() => window.confirm(t('gi.revokeConfirm')) && revoke.mutate({ invitationId: i.id })}>{t('gi.revoke')}</Button>}
                  </li>
                ))}
              </ul>
            )}
          {revoke.error && <p role="alert" className="mt-2 text-red-600">{revoke.error.message}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t('gi.links')}</CardTitle></CardHeader>
        <CardContent className="text-sm">
          {links.isLoading ? <HwLoading /> : links.error ? <HwError message={links.error.message} onRetry={() => links.refetch()} />
            : !links.data?.length ? <p className="text-muted-foreground">{t('gi.noLinks')}</p> : (
              <ul className="divide-y">
                {links.data.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span><strong>{l.guardianName}</strong> ({l.guardianEmail}) → {l.studentName}{l.endedAt && <span className="ml-2 text-muted-foreground">({t('gi.ended')})</span>}</span>
                    {!l.endedAt && <Button size="sm" variant="outline" disabled={end.isPending} onClick={() => window.confirm(t('gi.endConfirm')) && end.mutate({ linkId: l.id })}>{t('gi.end')}</Button>}
                  </li>
                ))}
              </ul>
            )}
          {end.error && <p role="alert" className="mt-2 text-red-600">{end.error.message}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
