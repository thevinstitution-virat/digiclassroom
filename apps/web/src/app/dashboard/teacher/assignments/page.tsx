'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Plus } from 'lucide-react'
import { api } from '@/lib/trpc/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { HwError, HwLoading, HwMessage, HwShell } from '@/components/hw/HwShell'
import { Field, NativeSelect } from '@/components/hw/fields'
import { marksLabel, useHwT } from '@/components/hw/strings'

type Mode = 'typed' | 'ink'

function NewAssignment({ onDone }: { onDone: () => void }) {
  const { t } = useHwT()
  const router = useRouter()
  const targets = api.hw.assignments.targets.useQuery()
  const create = api.hw.assignments.create.useMutation({ onSuccess: (r) => router.push(`/dashboard/teacher/assignments/${r.id}`) })
  const [classId, setClassId] = useState('')
  const [sectionId, setSectionId] = useState('')
  const [subject, setSubject] = useState('')
  const [title, setTitle] = useState('')
  const [instructions, setInstructions] = useState('')
  const [due, setDue] = useState('')
  const [modes, setModes] = useState<Mode[]>(['ink', 'typed'])

  const sections = useMemo(() => (targets.data?.sections ?? []).filter((s) => s.classId === classId), [targets.data, classId])
  // A teacher linked to one subject for this class gets it filled in.
  const linkedSubjects = useMemo(() => [...new Set((targets.data?.links ?? []).filter((l) => l.classId === classId && l.subject).map((l) => l.subject as string))], [targets.data, classId])

  if (targets.isLoading) return <HwLoading />
  if (targets.error) return <HwError message={targets.error.message} onRetry={() => targets.refetch()} />
  if (!targets.data?.classes.length) return <HwMessage>{t('tc.new.noClasses')}</HwMessage>

  const toggleMode = (m: Mode) => setModes((x) => (x.includes(m) ? x.filter((y) => y !== m) : [...x, m]))
  const valid = classId && subject.trim() && title.trim() && modes.length

  return (
    <Card>
      <CardHeader><CardTitle>{t('tc.list.new')}</CardTitle></CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!valid) return
            create.mutate({
              classId, sectionId: sectionId || null, subject: subject.trim(), title: title.trim(),
              instructions: instructions.trim() || null, dueAt: due ? new Date(due) : null, allowedModes: modes,
            })
          }}
        >
          <Field label={t('tc.new.class')}>
            <NativeSelect value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId('') }} required>
              <option value="" />
              {targets.data.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </NativeSelect>
          </Field>
          <Field label={t('tc.new.section')}>
            <NativeSelect value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={!classId}>
              <option value="">{t('tc.new.allSections')}</option>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </NativeSelect>
          </Field>
          <Field label={t('tc.new.subject')}>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} list="hw-subjects" required maxLength={100} />
            <datalist id="hw-subjects">{linkedSubjects.map((s) => <option key={s} value={s} />)}</datalist>
          </Field>
          <Field label={t('tc.new.due')}>
            <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t('tc.new.title')}>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={300} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label={t('tc.new.instructions')}>
              <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2} maxLength={10000} />
            </Field>
          </div>
          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="text-sm font-medium">{t('tc.new.modes')}</legend>
            <div className="flex flex-wrap gap-4 text-sm">
              {(['ink', 'typed'] as Mode[]).map((m) => (
                <label key={m} className="flex items-center gap-2">
                  <input type="checkbox" checked={modes.includes(m)} onChange={() => toggleMode(m)} />
                  {t(m === 'ink' ? 'st.mode.write' : 'st.mode.type')}
                </label>
              ))}
            </div>
          </fieldset>
          {create.error && <p className="text-sm text-red-600 sm:col-span-2">{create.error.message}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={!valid || create.isPending}>{create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('tc.new.create')}</Button>
            <Button type="button" variant="outline" onClick={onDone}>{t('common.cancel')}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export default function TeacherAssignmentsPage() {
  const { t, lang } = useHwT()
  const list = api.hw.assignments.list.useQuery()
  const [creating, setCreating] = useState(false)
  const statusVariant = { draft: 'secondary', published: 'default', closed: 'outline' } as const

  return (
    <HwShell roles={['teacher', 'admin']} actions={!creating && <Button size="sm" onClick={() => setCreating(true)}><Plus className="mr-1 h-4 w-4" />{t('tc.list.new')}</Button>}>
      <div className="space-y-6">
        {creating && <NewAssignment onDone={() => setCreating(false)} />}
        {list.isLoading ? <HwLoading /> : list.error ? <HwError message={list.error.message} onRetry={() => list.refetch()} /> : !list.data?.length ? (
          !creating && <HwMessage>{t('tc.list.empty')}</HwMessage>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {list.data.map((a) => (
              <Link key={a.id} href={`/dashboard/teacher/assignments/${a.id}`} className="block">
                <Card className="h-full transition hover:border-primary">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{a.title}</CardTitle>
                      <Badge variant={statusVariant[a.status]}>{t(`tc.status.${a.status}`)}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {a.subject} · {marksLabel(t, Number(a.totalMarks))}
                    {a.dueAt && <> · {t('common.due', { date: new Date(a.dueAt).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN') })}</>}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </HwShell>
  )
}
