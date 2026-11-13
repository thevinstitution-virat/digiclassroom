'use client'

// InkBuddy board practice (docs/hw-eval/board-bank-roadmap.md, phase 3): the 2026 board questions by chapter and NCERT topic. The lists come from the
// server and never carry the right option, a key or the scheme; the server re-checks that a question is on offer when one is started.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/trpc/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, NativeSelect } from '@/components/hw/fields'
import { HwError, HwLoading, HwMessage } from '@/components/hw/HwShell'
import { marksLabel, useHwT } from '@/components/hw/strings'

function Topic({ section, onBack }: { section: string; onBack: () => void }) {
  const { t } = useHwT()
  const router = useRouter()
  const q = api.hw.practice.boardQuestions.useQuery({ section }, { retry: false })
  const open = api.hw.practice.startBoardQuestion.useMutation({
    onSuccess: (r) => router.push(`/dashboard/student/assignments/${r.assignmentId}?space=practice`),
  })
  const topic = q.data?.topic
  return (
    <div className="space-y-3">
      <Button size="sm" variant="outline" onClick={onBack}>← {t('pr.board.back')}</Button>
      {topic && <h3 className="font-medium">NCERT {topic.section} {topic.title} <span className="text-sm font-normal text-muted-foreground">· {t('pr.board.pages', { p: topic.pages })}</span></h3>}
      {q.isLoading && <HwLoading />}
      {q.error && <HwError message={q.error.message} onRetry={() => q.refetch()} />}
      {open.error && <HwError message={open.error.message} />}
      {q.data && q.data.questions.length === 0 && <HwMessage>{t('pr.board.none')}</HwMessage>}
      <ul className="space-y-3">
        {q.data?.questions.map((x) => (
          <li key={x.itemId} className="flex flex-wrap items-start justify-between gap-3 rounded-md border p-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge>{marksLabel(t, x.marks)}</Badge>
                <Badge variant="secondary" title={x.sources.join(', ')}>{x.asked === 1 ? t('pr.board.askedOnce') : t('pr.board.asked', { n: x.asked })}</Badge>
                {x.figures.length > 0 && <Badge variant="outline">{t('pr.board.figure')}</Badge>}
                {x.tried && <span className="text-xs text-muted-foreground">{x.tried.best === null ? t('pr.board.waiting') : t('pr.board.tried', { best: x.tried.best, of: x.tried.outOf, n: x.tried.attempts })}</span>}
              </div>
              <p className="line-clamp-5 whitespace-pre-wrap text-sm">{x.stem}</p>
              {x.options.length > 0 && (
                <ol className="grid gap-x-4 text-sm sm:grid-cols-2">
                  {x.options.map((o) => <li key={o.letter}>({o.letter}) {o.text}</li>)}
                </ol>
              )}
              {x.figures.map((f, k) => f.url && <img key={k} src={f.url} alt={f.description} className="max-h-40 rounded border bg-white" />)}
              {x.hasDrawing && <p className="text-xs text-amber-700 dark:text-amber-400">{t('pr.paper.drawing')}</p>}
            </div>
            <Button size="sm" disabled={open.isPending} onClick={() => open.mutate({ itemId: x.itemId })}>
              {open.isPending && open.variables?.itemId === x.itemId ? t('pr.q.opening') : t('pr.q.practise')}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function BoardPractice() {
  const { t } = useHwT()
  const cat = api.hw.practice.boardChapters.useQuery(undefined, { retry: false, staleTime: 60_000 })
  const [chosen, setChosen] = useState('')
  const [section, setSection] = useState<string | null>(null)
  const chapters = cat.data?.chapters ?? []
  // nothing published for this class yet: say nothing rather than show an empty card
  if (cat.isLoading || cat.error || !cat.data?.available || chapters.length === 0) return null
  const ch = chapters.find((c) => c.chapter === chosen) ?? chapters[0]!

  return (
    <Card>
      <CardHeader><CardTitle>{t('pr.board.title')}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {section ? <Topic section={section} onBack={() => setSection(null)} /> : (
          <>
            <p className="text-sm text-muted-foreground">{t('pr.board.intro')}</p>
            {!cat.data.writtenOn && <p className="text-xs text-muted-foreground">{t('pr.board.objectiveOnly')}</p>}
            <Field label={t('pr.board.chapter')}>
              <NativeSelect value={ch.chapter} onChange={(e) => setChosen(e.target.value)}>
                {chapters.map((c) => <option key={c.chapter} value={c.chapter}>{t('pr.board.chapterOpt', { n: c.chapterNo ?? '', name: c.chapter, q: c.questions })}</option>)}
              </NativeSelect>
            </Field>
            <ul className="space-y-2">
              {ch.topics.map((tp) => (
                <li key={tp.section} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{tp.section} {tp.title}</p>
                    <p className="text-xs text-muted-foreground">{t('pr.board.topicMeta', { q: tp.questions, a: tp.asked, p: tp.pages })}</p>
                    <p className="text-xs">{tp.best ? t('pr.board.best', { got: tp.best.got, of: tp.best.of }) : <span className="text-muted-foreground">{t('pr.board.notTried')}</span>}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setSection(tp.section)}>{t('pr.board.open')}</Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}
