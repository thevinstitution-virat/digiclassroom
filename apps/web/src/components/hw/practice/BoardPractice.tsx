'use client'

// InkBuddy board practice (docs/hw-eval/board-bank-roadmap.md): the 2026 board questions by chapter and NCERT topic (phase 3); the learner's weak
// topics and the quick test (phase 4). The lists come from the server and never carry the right option, a key or the scheme; the server
// re-checks that a question is on offer when one is started, and draws a quick test's questions itself.

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { api } from '@/lib/trpc/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, NativeSelect } from '@/components/hw/fields'
import { HwError, HwLoading, HwMessage } from '@/components/hw/HwShell'
import { marksLabel, useHwT } from '@/components/hw/strings'
import type { HwOut } from '@/components/hw/types'

type T = ReturnType<typeof useHwT>['t']
type Catalogue = NonNullable<HwOut['practice']['boardChapters']>

const questionsLabel = (t: T, n: number) => (n === 1 ? t('pr.board.oneQuestion') : t('pr.board.nQuestions', { n }))
const askedLabel = (t: T, n: number) => (n === 1 ? t('pr.board.askedOnceIn') : t('pr.board.askedTimes', { n }))
const triesLabel = (t: T, n: number) => (n === 1 ? t('pr.board.oneTry') : t('pr.board.tries', { n }))
const openPractice = (assignmentId: string) => `/dashboard/student/assignments/${assignmentId}?space=practice`

function Topic({ section, onBack }: { section: string; onBack: () => void }) {
  const { t } = useHwT()
  const router = useRouter()
  const q = api.hw.practice.boardQuestions.useQuery({ section }, { retry: false })
  const open = api.hw.practice.startBoardQuestion.useMutation({ onSuccess: (r) => router.push(openPractice(r.assignmentId)) })
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
                {x.tried && <span className="text-xs text-muted-foreground">{x.tried.best === null ? t('pr.board.waiting') : t('pr.board.tried', { best: x.tried.best, of: x.tried.outOf, tries: triesLabel(t, x.tried.attempts) })}</span>}
              </div>
              <p className="line-clamp-5 whitespace-pre-wrap text-sm">{x.stem}</p>
              {x.options.length > 0 && (
                <ol className="grid gap-x-4 text-sm sm:grid-cols-2">
                  {x.options.map((o) => <li key={o.letter}>({o.letter}) {o.text}</li>)}
                </ol>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed link to the question's picture */}
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

/** The learner's weak topics (phase 4): never tried, or under 60% on the first try; the boards' favourites first. */
function WeakTopics({ weak, onOpen }: { weak: Catalogue['weak']; onOpen: (chapter: string, section: string) => void }) {
  const { t } = useHwT()
  return (
    <section className="space-y-2 rounded-md border border-amber-300 bg-amber-50/60 p-3 dark:border-amber-800 dark:bg-amber-950/30" aria-labelledby="board-weak">
      <h3 id="board-weak" className="font-medium">{t('pr.weak.title')}</h3>
      <p className="text-xs text-muted-foreground">{t('pr.weak.help')}</p>
      {weak.length === 0 ? <p className="text-sm">{t('pr.weak.none')}</p> : (
        <ul className="space-y-2">
          {weak.map((w) => (
            <li key={`${w.chapter}:${w.section}`} className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{w.section} {w.title}</p>
                <p className="text-xs text-muted-foreground">
                  {w.chapterNo ? `${t('pr.weak.chapter', { n: w.chapterNo })} · ` : ''}{askedLabel(t, w.asked)} · {w.why === 'low_marks' && w.first ? t('pr.weak.low', { got: w.first.got, of: w.first.of }) : t('pr.board.notTried')}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => onOpen(w.chapter, w.section)}>{t('pr.board.open')}</Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** The quick test (phase 4): 5 or 10 board questions from the chosen chapters, one sitting at the board's pace, one grade card. */
function QuickTest({ chapters, tests }: { chapters: Catalogue['chapters']; tests: Catalogue['tests'] }) {
  const { t, lang } = useHwT()
  const router = useRouter()
  const [picked, setPicked] = useState<string[]>([])
  const [count, setCount] = useState<5 | 10>(5)
  const start = api.hw.practice.startQuickTest.useMutation({ onSuccess: (r) => router.push(openPractice(r.assignmentId)) })
  const toggle = (c: string) => setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]))
  const date = (d: string) => new Date(d).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short' })
  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle>{t('pr.quick.title')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('pr.quick.help')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t('pr.quick.chapters')}</legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {chapters.map((c) => (
              <label key={c.chapter} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-primary" checked={picked.includes(c.chapter)} onChange={() => toggle(c.chapter)} />
                <span>{c.chapterNo ? `${c.chapterNo}. ` : ''}{c.chapter}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t('pr.quick.size')}</legend>
          <div className="flex gap-1" role="radiogroup">
            {([5, 10] as const).map((n) => (
              <Button key={n} size="sm" variant={count === n ? 'default' : 'outline'} role="radio" aria-checked={count === n} onClick={() => setCount(n)}>{n}</Button>
            ))}
          </div>
        </fieldset>
        <div className="space-y-1">
          <Button disabled={start.isPending} onClick={() => start.mutate({ chapters: picked, count })}>
            {start.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{start.isPending ? t('pr.quick.starting') : t('pr.quick.start')}
          </Button>
          <p className="text-xs text-muted-foreground">{t('pr.quick.counts')}</p>
          {start.error && <p className="text-sm text-red-600">{start.error.message}</p>}
        </div>
        {tests.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">{t('pr.quick.past')}</h3>
            <ul className="space-y-1 text-sm">
              {tests.map((x) => (
                <li key={x.assignmentId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-2 py-1">
                  <span className="min-w-0 flex-1 truncate">{date(x.at)} · {t('pr.quick.card', { n: x.questions })}</span>
                  <span className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {x.got !== null ? `${x.got} / ${x.outOf}` : !x.status || x.status === 'draft' ? t('pr.quick.notIn') : t('pr.quick.waiting')}
                    </Badge>
                    <Link className="text-xs underline underline-offset-2" href={openPractice(x.assignmentId)}>{t('pr.quick.open')}</Link>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
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
    <>
      <Card>
        <CardHeader><CardTitle>{t('pr.board.title')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {section ? <Topic section={section} onBack={() => setSection(null)} /> : (
            <>
              <p className="text-sm text-muted-foreground">{t('pr.board.intro')}</p>
              {!cat.data.writtenOn && <p className="text-xs text-muted-foreground">{t('pr.board.objectiveOnly')}</p>}
              <WeakTopics weak={cat.data.weak} onOpen={(c, s) => { setChosen(c); setSection(s) }} />
              <Field label={t('pr.board.chapter')}>
                <NativeSelect value={ch.chapter} onChange={(e) => setChosen(e.target.value)}>
                  {chapters.map((c) => <option key={c.chapter} value={c.chapter}>{t('pr.board.chapterOpt', { n: c.chapterNo ?? '', name: c.chapter, qs: questionsLabel(t, c.questions) })}</option>)}
                </NativeSelect>
              </Field>
              <ul className="space-y-2">
                {ch.topics.map((tp) => (
                  <li key={tp.section} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{tp.section} {tp.title}</p>
                      <p className="text-xs text-muted-foreground">{t('pr.board.topicMeta', { qs: questionsLabel(t, tp.questions), asked: askedLabel(t, tp.asked), p: tp.pages })}</p>
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
      <QuickTest chapters={chapters} tests={cat.data.tests} />
    </>
  )
}
