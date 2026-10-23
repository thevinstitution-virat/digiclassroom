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
  const month = usage.data?.months[0]

  return (
    <HwShell roles={['admin']} titleKey="ad.title" subtitle={t('app.subtitle')}>
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>{t('ad.usage')}</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {usage.isLoading ? <HwLoading /> : usage.error ? <HwError message={usage.error.message} onRetry={() => usage.refetch()} /> : (
              <>
                <p>{t('ad.usageLine', { pages: month?.pagesRead ?? 0, graded: month?.answersGraded ?? 0, cost: ((month?.costPaise ?? 0) / 100).toFixed(2) })}</p>
                <p className="text-muted-foreground">{usage.data!.monthlyAnswerQuota ? t('ad.quota', { n: usage.data!.monthlyAnswerQuota }) : t('ad.quotaOff')}</p>
              </>
            )}
          </CardContent>
        </Card>

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
