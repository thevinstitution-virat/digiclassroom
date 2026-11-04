'use client'

// Institution admin: which teacher sets work for which class (and section, subject), and
// how much AI the institution used this month.

import { useMemo, useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { api } from '@/lib/trpc/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { HwError, HwLoading, HwShell } from '@/components/hw/HwShell'
import { Field, NativeSelect } from '@/components/hw/fields'
import { useHwT } from '@/components/hw/strings'

/** Roadmap 5.4: this institution's marking figures for the last 7 days. Aggregates only; a group under the minimum size shows no figures. */
function MarkingQuality() {
  const { t } = useHwT()
  const mon = api.hw.admin.monitoring.useQuery()
  const pct = (x: number | null) => (x === null ? '–' : `${Math.round(x * 100)}%`)
  return (
    <Card>
      <CardHeader><CardTitle>{t('ad.mon.title')}</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        {mon.isLoading ? <HwLoading /> : mon.error ? <HwError message={mon.error.message} onRetry={() => mon.refetch()} /> : (
          <>
            <p className="text-muted-foreground">{t('ad.mon.hint', { n: mon.data!.minGroupSize })}</p>
            {!mon.data!.groups.length ? <p>{t('ad.mon.empty')}</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="text-xs text-muted-foreground"><tr><th className="py-1 pr-3">{t('ad.mon.group')}</th><th className="pr-3">{t('ad.mon.answers')}</th><th className="pr-3">{t('ad.mon.kept')}</th><th className="pr-3">{t('ad.mon.changed')}</th><th className="pr-3">{t('ad.mon.large')}</th><th className="pr-3">{t('ad.mon.fixes')}</th><th className="pr-3">{t('ad.mon.cost')}</th></tr></thead>
                  <tbody>
                    {mon.data!.groups.map((g) => g.suppressed
                      ? <tr key={g.groupKey} className="border-t"><td className="py-1 pr-3">{g.label}</td><td colSpan={6} className="text-muted-foreground">{t('ad.mon.small', { n: g.minGroupSize })}</td></tr>
                      : (
                        <tr key={g.groupKey} className="border-t">
                          <td className="py-1 pr-3">{g.label}</td>
                          <td className="pr-3">{g.last7.counts.answers}</td>
                          <td className="pr-3">{pct(g.last7.counts.shown ? g.last7.counts.unchanged / g.last7.counts.shown : null)}</td>
                          <td className="pr-3">{pct(g.last7.rates.overrideRate)}</td>
                          <td className="pr-3">{pct(g.last7.rates.largeOverrideRate)}</td>
                          <td className="pr-3">{pct(g.last7.rates.transcriptFixRate)}</td>
                          <td className="pr-3">{g.last7.rates.paisePerAnswer === null ? '–' : (g.last7.rates.paisePerAnswer / 100).toFixed(2)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default function InstitutionAssignmentsPage() {
  const { t } = useHwT()
  const options = api.hw.classTeachers.options.useQuery()
  const links = api.hw.classTeachers.list.useQuery()
  const usage = api.hw.admin.usage.useQuery()
  const assign = api.hw.classTeachers.assign.useMutation({ onSuccess: () => { void links.refetch(); setSubject('') } })
  const remove = api.hw.classTeachers.remove.useMutation({ onSuccess: () => links.refetch() })
  const [teacherId, setTeacherId] = useState('')
  const [classId, setClassId] = useState('')
  const [sectionId, setSectionId] = useState('')
  const [subject, setSubject] = useState('')

  const o = options.data
  const sections = useMemo(() => (o?.sections ?? []).filter((s) => s.classId === classId), [o, classId])
  const name = (list: { id: string; name: string }[] | undefined, id: string | null) => (id ? list?.find((x) => x.id === id)?.name ?? '?' : null)
  // This month, from the same function the platform owner's Tenants tab uses (hw/tenants.ts tenantUsage).
  const month = usage.data?.thisMonth
  const pct = month?.fraction == null ? 0 : Math.round(month.fraction * 100)

  return (
    <HwShell roles={['admin']} titleKey="ad.title" subtitle={t('app.subtitle')}>
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>{t('ad.usage')}</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {usage.isLoading ? <HwLoading /> : usage.error ? <HwError message={usage.error.message} onRetry={() => usage.refetch()} /> : (
              <>
                <p>{t('ad.usageLine', { pages: month?.pagesRead ?? 0, graded: month?.answersGraded ?? 0, cost: ((month?.costPaise ?? 0) / 100).toFixed(2) })}</p>
                {month && month.budgetPaise > 0
                  ? <p className="text-muted-foreground">{t('ad.budget', { budget: (month.budgetPaise / 100).toFixed(2), used: (month.costPaise / 100).toFixed(2), pct })}</p>
                  : <p className="text-muted-foreground">{usage.data!.monthlyAnswerQuota ? t('ad.quota', { n: usage.data!.monthlyAnswerQuota }) : t('ad.quotaOff')}</p>}
                {month && month.keyBuilds > 0 && <p className="text-muted-foreground">{t('ad.keys', { n: month.keyBuilds, cost: (month.keyCostPaise / 100).toFixed(2) })}</p>}
                {month?.exhausted
                  ? <p role="alert" className="rounded border border-red-300 bg-red-50 p-2 text-red-800">{t('ad.budgetFull')}</p>
                  : month?.warn && <p role="status" className="rounded border border-amber-300 bg-amber-50 p-2 text-amber-900">{t('ad.budgetWarn', { pct })}</p>}
              </>
            )}
          </CardContent>
        </Card>

        <MarkingQuality />

        <Card>
          <CardHeader><CardTitle>{t('ad.link')}</CardTitle></CardHeader>
          <CardContent>
            {options.isLoading ? <HwLoading /> : options.error ? <HwError message={options.error.message} onRetry={() => options.refetch()} /> : (
              <form className="grid gap-4 sm:grid-cols-4" onSubmit={(e) => {
                e.preventDefault()
                if (teacherId && classId) assign.mutate({ teacherId, classId, sectionId: sectionId || null, subject: subject.trim() || null })
              }}>
                <Field label={t('ad.teacher')}>
                  <NativeSelect value={teacherId} onChange={(e) => setTeacherId(e.target.value)} required>
                    <option value="" />
                    {o!.teachers.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.email})</option>)}
                  </NativeSelect>
                </Field>
                <Field label={t('tc.new.class')}>
                  <NativeSelect value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId('') }} required>
                    <option value="" />
                    {o!.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </NativeSelect>
                </Field>
                <Field label={t('tc.new.section')}>
                  <NativeSelect value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={!classId}>
                    <option value="">{t('tc.new.allSections')}</option>
                    {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </NativeSelect>
                </Field>
                <Field label={t('tc.new.subject')}>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t('ad.anySubject')} maxLength={100} />
                </Field>
                <div className="sm:col-span-4">
                  <Button type="submit" disabled={!teacherId || !classId || assign.isPending}>{assign.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{t('ad.link')}</Button>
                  {assign.error && <span className="ml-3 text-sm text-red-600">{assign.error.message}</span>}
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            {links.isLoading ? <HwLoading /> : links.error ? <HwError message={links.error.message} onRetry={() => links.refetch()} /> : (
              <ul className="divide-y">
                {links.data!.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span>
                      <strong>{name(o?.teachers, l.teacherId)}</strong> → {name(o?.classes, l.classId)}
                      {l.sectionId ? ` / ${name(o?.sections, l.sectionId)}` : ` (${t('tc.new.allSections')})`}
                      {' · '}{l.subject ?? t('ad.anySubject')}
                    </span>
                    <Button size="icon" variant="ghost" disabled={remove.isPending} onClick={() => remove.mutate({ linkId: l.id })} aria-label={t('common.delete')}><Trash2 className="h-4 w-4" /></Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </HwShell>
  )
}
