// What a student sees once work is handed in: reading in progress, then "check what we
// read" (tap misread words; the transcript itself cannot be edited), then marks once the
// teacher returns the work.

import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { api } from '@/lib/trpc/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { HwStudentFlag } from '@/db/hw-schema'
import { HwError, HwLoading, HwMessage } from '../HwShell'
import { marksLabel, useHwT } from '../strings'
import type { HwOut } from '../types'
import { wordsOf } from '../text-spans'

type Started = HwOut['student']['start']
type Answer = Started['answers'][number]

function CheckAnswer({ submissionId, questionId, answer }: { submissionId: string; questionId: string; answer: Answer }) {
  const { t } = useHwT()
  const [flags, setFlags] = useState<HwStudentFlag[]>(answer.studentFlags ?? [])
  const [sent, setSent] = useState(true)
  const save = api.hw.student.flagWords.useMutation({ onSuccess: () => setSent(true) })
  const words = useMemo(() => wordsOf(answer.transcript ?? ''), [answer.transcript])

  if (answer.mode === 'typed') return null
  if (!answer.transcript || answer.transcriptStatus === 'pending') return <p className="text-sm text-muted-foreground">{t('st.check.notRead')}</p>

  const toggle = (w: (typeof words)[number]) => {
    setSent(false)
    setFlags((f) => (f.some((x) => x.start === w.start) ? f.filter((x) => x.start !== w.start) : [...f, w]))
  }

  return (
    <div className="space-y-3">
      {(answer.transcriptStatus === 'needs_review' || answer.transcriptStatus === 'failed') && (
        <p className="text-sm text-amber-700 dark:text-amber-400">{t('st.check.review')}</p>
      )}
      <p className="flex flex-wrap gap-x-1 gap-y-2 text-base leading-relaxed" lang="hi">
        {words.map((w) => {
          const on = flags.some((f) => f.start === w.start)
          return (
            <button key={w.start} type="button" onClick={() => toggle(w)} aria-pressed={on}
              className={on ? 'rounded bg-amber-200 px-1 underline decoration-wavy dark:bg-amber-900' : w.text.includes('[?]') ? 'rounded bg-slate-200 px-1 dark:bg-slate-700' : 'rounded px-1 hover:bg-muted'}>
              {w.text}
            </button>
          )
        })}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">{t('st.check.flagged', { n: flags.length })}</span>
        <Button size="sm" variant="outline" disabled={sent || save.isPending} onClick={() => save.mutate({ submissionId, questionId, flags })}>
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('st.check.saveFlags')}
        </Button>
        {save.error && <span className="text-sm text-red-600">{save.error.message}</span>}
      </div>
    </div>
  )
}

// Marks read concept by concept from the textbook's concept map: weakest first, with what to revise before each.
// Hidden while the concept map is off, and quietly empty when it cannot answer: the marks above are the result.
function ConceptPanel({ submissionId }: { submissionId: string }) {
  const { t } = useHwT()
  const f = api.hw.student.conceptFeedback.useQuery({ submissionId }, { staleTime: 600_000, retry: false })
  if (f.isLoading || f.error || !f.data?.enabled) return null
  const { weak, strong } = f.data
  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle>{t('st.concepts.title')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('st.concepts.help')}</p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {weak.length === 0 && strong.length === 0 && <p className="text-muted-foreground">{t('st.concepts.unplaced')}</p>}
        {weak.length === 0 && strong.length > 0 && <p>{t('st.concepts.none')}</p>}
        {weak.length > 0 && (
          <ul className="space-y-3">
            {weak.map((w) => (
              <li key={w.concept} className="space-y-1 border-l-2 border-amber-500 pl-3">
                <p>{t(w.questions.length > 1 ? 'st.concepts.lostMany' : 'st.concepts.lost', { lost: w.lost, of: w.outOf, concept: w.concept, qs: w.questions.join(', ') })}</p>
                {w.revisitFirst.length > 0 && (
                  <p className="text-muted-foreground">
                    {t('st.concepts.first', { list: w.revisitFirst.map((p) => t('st.concepts.chapter', { label: p.label, n: p.chapter })).join(t('st.concepts.and')) })}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
        {strong.length > 0 && weak.length > 0 && <p className="text-muted-foreground">{t('st.concepts.strong', { list: strong.join(', ') })}</p>}
      </CardContent>
    </Card>
  )
}

function Result({ submissionId }: { submissionId: string }) {
  const { t } = useHwT()
  const r = api.hw.student.result.useQuery({ submissionId })
  if (r.isLoading) return <HwLoading />
  if (r.error) return <HwError message={r.error.message} onRetry={() => r.refetch()} />
  const d = r.data!
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>{t('st.result.title')}</CardTitle></CardHeader>
        <CardContent className="text-2xl font-semibold">{t('st.result.total', { got: d.total, of: d.assignment.totalMarks })}</CardContent>
      </Card>
      <ConceptPanel submissionId={submissionId} />
      {d.questions.map((q) => (
        <Card key={q.id}>
          <CardHeader className="space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">{t('mk.question', { i: q.position + 1 })}</span>
              <Badge>{q.awarded ?? '–'} / {marksLabel(t, q.marks)}</Badge>
            </div>
            <CardTitle className="whitespace-pre-wrap text-base">{q.prompt}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="whitespace-pre-wrap rounded bg-muted p-3">{q.transcript || '—'}</p>
            {q.keyPoints.length > 0 && (
              <ul className="space-y-1">
                {q.keyPoints.map((k, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span>{k.description}</span>
                    <span className="shrink-0 font-medium">{k.marks} / {k.outOf}</span>
                  </li>
                ))}
              </ul>
            )}
            {q.comment && (
              <div>
                <p className="font-medium">{t('st.result.teacherComment')}</p>
                <p className="whitespace-pre-wrap">{q.comment}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function AfterSubmit({ data }: { data: Started }) {
  const { t } = useHwT()
  const s = data.submission
  if (s.status === 'returned') return <Result submissionId={s.id} />
  const reading = s.status === 'submitted' || s.status === 'processing'
  const hasInk = data.answers.some((a) => a.mode === 'ink')
  return (
    <div className="space-y-4">
      <HwMessage>{reading ? t('st.processing') : t('st.result.waiting')}</HwMessage>
      {hasInk && !reading && (
        <Card>
          <CardHeader>
            <CardTitle>{t('st.check.title')}</CardTitle>
            <p className="text-sm text-muted-foreground">{t('st.check.help')}</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {data.questions.map((q) => {
              const a = data.answers.find((x) => x.questionId === q.id)
              if (!a || a.mode !== 'ink') return null
              return (
                <div key={q.id} className="space-y-2 border-t pt-4 first:border-0 first:pt-0">
                  <p className="text-sm font-medium">{t('mk.question', { i: q.position + 1 })}: {q.prompt}</p>
                  <CheckAnswer submissionId={s.id} questionId={q.id} answer={a} />
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
