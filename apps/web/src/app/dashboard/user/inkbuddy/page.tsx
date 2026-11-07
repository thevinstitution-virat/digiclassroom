'use client'

// InkBuddy: the Virat Evaluator for independent learners (docs/hw-eval/self-practice.md): start the free trial, find a textbook
// question, practise it on the ordinary student answer screen, and see your own practice list.
// The tab is shown only to people with no institution, or who already started a trial.

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { api } from '@/lib/trpc/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field, NativeSelect } from '@/components/hw/fields'
import { HwError, HwLanguageToggle, HwLoading, HwMessage } from '@/components/hw/HwShell'
import { marksLabel, useHwT, type HwKey } from '@/components/hw/strings'

const SUBJECTS: { value: string; key: HwKey }[] = [
  { value: 'Science', key: 'pr.sub.science' },
  { value: 'Mathematics', key: 'pr.sub.mathematics' },
  { value: 'Social Science', key: 'pr.sub.social' },
  { value: 'English', key: 'pr.sub.english' },
  { value: 'Hindi', key: 'pr.sub.hindi' },
]
type Scope = { classLevel: number; subject: string; medium: 'en' | 'hi' }

function Frame({ children }: { children: React.ReactNode }) {
  const { t } = useHwT()
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{t('pr.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('pr.subtitle')}</p>
        </div>
        <HwLanguageToggle />
      </div>
      {children}
    </div>
  )
}

function Finder({ scopes }: { scopes: Scope[] }) {
  const { t, lang } = useHwT()
  const router = useRouter()
  const [book, setBook] = useState(0)
  const chosen = scopes[Math.min(book, scopes.length - 1)]
  const classLevel = String(chosen.classLevel)
  const subject = chosen.subject
  const medium = chosen.medium
  const subjectName = (name: string) => { const s = SUBJECTS.find((x) => x.value.toLowerCase() === name.toLowerCase()); return s ? t(s.key) : name }
  const [topic, setTopic] = useState('')
  const [asked, setAsked] = useState<{ classLevel: string; subject: string; medium: 'en' | 'hi'; query: string } | null>(null)

  const found = api.hw.practice.search.useQuery(asked!, { enabled: asked !== null, retry: false, staleTime: 300_000 })
  const open = api.hw.practice.startQuestion.useMutation({
    onSuccess: (r) => router.push(`/dashboard/student/assignments/${r.assignmentId}`),
  })

  return (
    <Card>
      <CardHeader><CardTitle>{t('pr.search.title')}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => { e.preventDefault(); if (topic.trim().length >= 2) setAsked({ classLevel, subject, medium, query: topic.trim() }) }}
        >
          <Field label={t('pr.search.book')}>
            <NativeSelect value={String(book)} onChange={(e) => setBook(Number(e.target.value))}>
              {scopes.map((s, i) => (
                <option key={i} value={i}>
                  {t('pr.search.bookLabel', { cls: s.classLevel, subject: subjectName(s.subject), medium: t(s.medium === 'hi' ? 'pr.medium.hi' : 'pr.medium.en') })}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t('pr.search.topic')}>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t('pr.search.topicPh')} maxLength={200} />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={topic.trim().length < 2 || found.isFetching}>
              {found.isFetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {found.isFetching ? t('pr.search.searching') : t('pr.search.go')}
            </Button>
          </div>
        </form>

        {found.error && <HwError message={found.error.message} onRetry={() => found.refetch()} />}
        {open.error && <HwError message={open.error.message} />}
        {found.data && !found.data.available && <HwMessage>{found.data.message ? found.data.message[lang] : t('pr.off')}</HwMessage>}
        {found.data?.available && found.data.questions.length === 0 && <HwMessage>{t('pr.search.none')}</HwMessage>}
        {found.data?.available && found.data.questions.length > 0 && (
          <ul className="space-y-3">
            {found.data.questions.map((q) => (
              <li key={q.ref} className="flex flex-wrap items-start justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="whitespace-pre-wrap text-sm">{q.text}</p>
                  <p className="text-xs text-muted-foreground">{t('pr.search.from', { book: q.book, n: q.chapter, p: q.page })} · {marksLabel(t, q.shape.marks)}</p>
                </div>
                <Button
                  size="sm"
                  disabled={open.isPending}
                  onClick={() => asked && open.mutate({ classLevel: asked.classLevel, subject: asked.subject, medium: asked.medium, passageId: q.passageId, index: q.index, text: q.text })}
                >
                  {open.isPending && open.variables?.passageId === q.passageId && open.variables.index === q.index
                    ? t('pr.q.opening') : t('pr.q.practise')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function Mine() {
  const { t } = useHwT()
  const list = api.hw.student.assignments.useQuery(undefined, { retry: false })
  const label = (s: string | undefined) => (!s || s === 'draft' ? 'st.list.pending' : s === 'returned' ? 'st.list.returned' : 'st.list.submitted') as HwKey
  return (
    <Card>
      <CardHeader><CardTitle>{t('pr.mine.title')}</CardTitle></CardHeader>
      <CardContent>
        {list.isLoading ? <HwLoading /> : list.error ? <HwError message={list.error.message} onRetry={() => list.refetch()} /> : !list.data?.length ? (
          <p className="text-sm text-muted-foreground">{t('pr.mine.empty')}</p>
        ) : (
          <ul className="space-y-2">
            {list.data.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
                <span className="min-w-0 flex-1">{a.title}<span className="text-muted-foreground"> · {a.subject}</span></span>
                <Badge variant="secondary">{t(label(a.submission?.status))}</Badge>
                <Button asChild size="sm" variant="outline"><Link href={`/dashboard/student/assignments/${a.id}`}>{t('st.list.open')}</Link></Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export default function InkBuddyPage() {
  const { t, lang } = useHwT()
  const status = api.hw.practice.status.useQuery(undefined, { retry: false })
  const utils = api.useUtils()
  const start = api.hw.practice.start.useMutation({
    onSuccess: async () => { await utils.hw.practice.status.invalidate(); await utils.hw.status.invalidate() },
  })

  const s = status.data
  return (
    <Frame>
      {status.isLoading ? <HwLoading /> : status.error ? <HwError message={status.error.message} onRetry={() => status.refetch()} /> : !s?.enabled ? (
        <HwMessage>{t('pr.off')}</HwMessage>
      ) : !s.eligible ? (
        <HwMessage>{t('pr.notEligible')}</HwMessage>
      ) : !s.started && !s.ready ? (
        <Card>
          <CardHeader><CardTitle>{t('pr.soon.title')}</CardTitle></CardHeader>
          <CardContent className="text-sm"><p>{t('pr.soon.body')}</p></CardContent>
        </Card>
      ) : !s.started ? (
        <Card>
          <CardHeader><CardTitle>{t('pr.intro.title', { n: s.trialDays })}</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>{t('pr.intro.body')}</p>
            {start.error && <HwError message={start.error.message} />}
            <Button onClick={() => start.mutate()} disabled={start.isPending}>
              {start.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {start.isPending ? t('pr.starting') : t('pr.intro.start')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {s.active ? (
            <p className="flex flex-wrap gap-x-4 text-sm text-muted-foreground">
              <span>{t('pr.trial.days', { n: s.daysLeft })}</span>
              <span>{t('pr.trial.allowance', { pct: s.allowanceLeftPct })}</span>
            </p>
          ) : s.message ? <HwMessage>{s.message[lang]}</HwMessage> : null}
          {s.active && s.scopes.length > 0 && <Finder scopes={s.scopes} />}
          <Mine />
        </div>
      )}
    </Frame>
  )
}
