'use client'

// InkBuddy: practise questions from a published board paper (docs/hw-eval/board-paper-importer.md). The list comes from the server and never carries an
// option, an answer or the marking scheme; the server re-checks that a question is on offer when one is started.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/trpc/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, NativeSelect } from '@/components/hw/fields'
import { HwError, HwLoading, HwMessage } from '@/components/hw/HwShell'
import { marksLabel, useHwT } from '@/components/hw/strings'

export function PaperPractice() {
  const { t } = useHwT()
  const router = useRouter()
  const papers = api.hw.practice.papers.useQuery(undefined, { retry: false, staleTime: 300_000 })
  const [chosen, setChosen] = useState('')
  const list = papers.data?.papers ?? []
  const paperId = chosen && list.some((p) => p.paperId === chosen) ? chosen : list[0]?.paperId ?? ''
  const questions = api.hw.practice.paperQuestions.useQuery({ paperId }, { enabled: paperId !== '', retry: false })
  const open = api.hw.practice.startPaperQuestion.useMutation({
    onSuccess: (r) => router.push(`/dashboard/student/assignments/${r.assignmentId}?space=practice`),
  })
  // No published paper has a question to offer yet: say nothing rather than show an empty card.
  if (papers.isLoading || papers.error || !papers.data?.available || list.length === 0) return null
  const label = (p: (typeof list)[number]) => t('pr.paper.label', { board: p.board, cls: p.classLevel, subject: p.subject, kind: t(p.kind === 'sqp' ? 'pr.paper.kind.sqp' : 'pr.paper.kind.past_paper'), session: p.session })

  return (
    <Card>
      <CardHeader><CardTitle>{t('pr.paper.title')}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('pr.paper.intro')}</p>
        <Field label={t('pr.paper.choose')}>
          <NativeSelect value={paperId} onChange={(e) => setChosen(e.target.value)}>
            {list.map((p) => <option key={p.paperId} value={p.paperId}>{label(p)} · {t('pr.paper.count', { n: p.questions })}</option>)}
          </NativeSelect>
        </Field>
        {questions.isLoading && <HwLoading />}
        {questions.error && <HwError message={questions.error.message} onRetry={() => questions.refetch()} />}
        {open.error && <HwError message={open.error.message} />}
        {questions.data && questions.data.questions.length === 0 && <HwMessage>{t('pr.paper.none')}</HwMessage>}
        <ul className="space-y-3">
          {questions.data?.questions.map((q) => (
            <li key={q.rowId} className="flex flex-wrap items-start justify-between gap-3 rounded-md border p-3">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {t('pr.paper.q', { label: q.label })}
                  <Badge variant="secondary">{t('pr.paper.section', { s: q.section })}</Badge>
                  <Badge>{marksLabel(t, q.marks)}</Badge>
                  {q.figures.length > 0 && <Badge variant="outline">{t('pr.paper.figure')}</Badge>}
                </div>
                <p className="line-clamp-4 whitespace-pre-wrap text-sm">{q.stem}</p>
                {q.alsoOffered.length > 0 && <p className="text-xs text-muted-foreground">{t('pr.paper.also', { others: q.alsoOffered.join(', ') })}</p>}
                {q.hasDrawing && <p className="text-xs text-amber-700 dark:text-amber-400">{t('pr.paper.drawing')}</p>}
              </div>
              <Button size="sm" disabled={open.isPending} onClick={() => open.mutate({ rowId: q.rowId })}>
                {open.isPending && open.variables?.rowId === q.rowId ? t('pr.q.opening') : t('pr.q.practise')}
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
