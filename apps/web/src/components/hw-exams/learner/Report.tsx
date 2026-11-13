// The learner's exam report (phase 6; packages/core/src/lib/hw/exams/report.ts): the marks, question by question with each value point, the
// eight parameters, where marks were lost, and progress across attempts at the same test. Everything shown comes from the stored report; the
// sentences are made here, in the learner's language, from its numbers.

import { CheckCircle2, CircleDashed, MinusCircle, XCircle } from 'lucide-react'
import type { HwOut } from '@/components/hw/types'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useExamT, type ExKey } from './strings'
import { RevisionNote, type RevisionLike } from '@/components/hw/Revision'

type Rep = NonNullable<HwOut['exams']['attempt']['report']>
type Param = Rep['profile']['parameters'][number]
type QRow = Rep['perQuestion'][number]

const fmt = (n: number) => (Math.round(n * 100) / 100).toString()
const pct = (n: number) => `${Math.round(n * 100)}%`

const BAND_STYLE: Record<string, string> = {
  strong: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  fair: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200',
  weak: 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200',
  unavailable: 'text-muted-foreground',
}
const BAR_STYLE: Record<string, string> = { strong: 'bg-emerald-500', fair: 'bg-amber-500', weak: 'bg-red-500', current: 'bg-primary', past: 'bg-muted-foreground/40' }

function Bar({ value, band }: { value: number; band: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="presentation">
      <div className={`h-full rounded-full ${BAR_STYLE[band] ?? 'bg-primary'}`} style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }} />
    </div>
  )
}

function ParameterRow({ p }: { p: Param }) {
  const { t } = useExamT()
  const f = p.facts as Record<string, number>
  const sentence = p.why
    ? t(`ex.r.why.${p.why}` as ExKey)
    : p.id === 'factual_correctness' ? t('ex.r.f.fact', { right: fmt(f.right ?? 0), of: f.of ?? 0 })
    : p.id === 'step_marking' ? t('ex.r.f.step', { got: fmt(f.got ?? 0), of: fmt(f.of ?? 0), n: f.answers ?? 0 })
    : p.id === 'presentation' ? (f.unclear ? t('ex.r.f.unclear', { n: f.unclear, of: f.words ?? 0 }) : t('ex.r.f.clear'))
    : p.id === 'diagrams_and_tables' ? t('ex.r.f.drawn', { n: f.drawn ?? 0, of: f.asked ?? 0 })
    : p.examples.length ? '' : t('ex.r.f.noMistakes')
  return (
    <li className="space-y-1.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium">{t(`ex.r.p.${p.id}` as ExKey)}</span>
        <Badge variant="outline" className={BAND_STYLE[p.band]}>{t(`ex.r.band.${p.band}` as ExKey)}</Badge>
      </div>
      {p.score !== null && <Bar value={p.score} band={p.band} />}
      {sentence && <p className="text-sm text-muted-foreground">{sentence}</p>}
      {p.examples.length > 0 && (
        <ul className="space-y-0.5 text-sm">
          {p.examples.map((e, i) => (
            <li key={i}><span className="text-red-700 line-through decoration-red-400 dark:text-red-300">{e.written}</span> → <span className="text-emerald-700 dark:text-emerald-300">{e.correct}</span></li>
          ))}
        </ul>
      )}
    </li>
  )
}

const VERDICT_ICON = {
  met: <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />,
  partial: <MinusCircle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />,
  missing: <XCircle className="h-4 w-4 shrink-0 text-red-600" aria-hidden />,
}

function QuestionRow({ q, revision }: { q: QRow; revision?: RevisionLike }) {
  const { t } = useExamT()
  const label = t('ex.q', { n: `${q.number}${q.alt ?? ''}` })
  const status = q.status === 'marked' ? null : <Badge variant="outline" className="text-xs">{t(`ex.r.q.${q.status}` as ExKey)}</Badge>
  return (
    <li className={`space-y-2 py-3 ${q.status === 'not_counted' ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="font-semibold">{label}</span>
          {(q.chapter || q.topic) && <span className="ml-2 text-xs text-muted-foreground">{[q.chapter, q.topic].filter(Boolean).join(' · ')}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {status}
          <span className="font-mono tabular-nums">{q.awarded === null ? '—' : fmt(q.awarded)} / {fmt(q.marks)}</span>
        </div>
      </div>
      {revision && <RevisionNote r={revision} />}
      {q.reason && <p className="text-sm text-muted-foreground">{t(q.status === 'pending' ? 'ex.r.q.pendingWhy' : 'ex.r.q.pending')}</p>}
      {q.excludedMarks > 0 && <p className="text-xs text-muted-foreground">{t('ex.r.q.excluded', { n: fmt(q.excludedMarks) })}</p>}
      {q.points.length > 0 && q.status !== 'not_counted' && (
        <ul className="space-y-1.5 border-l-2 pl-3">
          {q.points.map((p, i) => (
            <li key={i} className="flex gap-2 text-sm">
              {VERDICT_ICON[p.verdict]}
              <div className="min-w-0 flex-1">
                <p>{p.text}</p>
                {p.quote && <p className="text-xs italic text-muted-foreground">{t('ex.r.q.youWrote', { q: p.quote })}</p>}
              </div>
              <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{fmt(p.awarded)}/{fmt(p.marks)}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

export function ExamReport({ report: r, attemptNo }: { report: Rep; attemptNo: number }) {
  const { t, date } = useExamT()
  const share = r.maxMarks > 0 ? r.marksAwarded / r.maxMarks : 0
  const prev = r.progress.filter((p) => p.attemptNo < attemptNo).at(-1)
  const chapters = r.weakAreas.filter((w) => w.level === 'chapter' && w.share < 1)
  const topics = r.weakAreas.filter((w) => w.level === 'topic' && w.share < 1)
  const priorities = r.profile.priorities.filter((p) => p.gainable > 0)
  const pending = r.perQuestion.filter((q) => q.status === 'pending').length
  // the latest change of marks on each answer (a report is re-made after each revision)
  const revisedOf = new Map(r.revisions.map((x) => [x.answerId, x]))

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 py-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">{t('ex.r.score')}</p>
              <p className="text-4xl font-bold tabular-nums">{fmt(r.marksAwarded)}<span className="text-xl font-medium text-muted-foreground"> / {fmt(r.maxMarks)}</span></p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-semibold tabular-nums">{pct(share)}</p>
              {prev && (
                <p className="text-sm text-muted-foreground">
                  {t('ex.r.vsPrev', { n: prev.attemptNo, d: `${r.marksAwarded - prev.marksAwarded >= 0 ? '+' : '−'}${fmt(Math.abs(r.marksAwarded - prev.marksAwarded))}` })}
                </p>
              )}
              {/* among other learners' first attempts at this set (only with 20 of them) */}
              <p className="text-sm text-muted-foreground">
                {r.standing.percentile !== null ? t('ex.r.standing', { p: r.standing.percentile }) : t('ex.r.fewPeers')}
              </p>
            </div>
          </div>
          <Bar value={share} band={share >= 0.8 ? 'strong' : share >= 0.5 ? 'fair' : 'weak'} />
          {pending > 0 && <p className="text-sm text-amber-700 dark:text-amber-300">{t('ex.r.pending', { n: pending, m: fmt(r.pendingMarks) })}</p>}
          {r.excludedMarks > 0 && <p className="text-sm text-muted-foreground">{t('ex.r.excluded', { n: fmt(r.excludedMarks) })}</p>}
          <p className="text-xs text-muted-foreground">{t(r.revision > 0 ? 'ex.r.updatedAt' : 'ex.r.madeAt', { date: date(r.createdAt) })}</p>
        </CardContent>
      </Card>

      {r.progress.length > 1 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{t('ex.r.progress')}</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {r.progress.map((p) => (
                <li key={p.attemptNo} className="grid grid-cols-[5.5rem_1fr_4.5rem] items-center gap-3 text-sm">
                  <span className={p.attemptNo === attemptNo ? 'font-semibold' : ''}>{t('ex.t.attempt', { n: p.attemptNo })}</span>
                  <Bar value={p.maxMarks ? p.marksAwarded / p.maxMarks : 0} band={p.attemptNo === attemptNo ? 'current' : 'past'} />
                  <span className="text-right font-mono tabular-nums">{fmt(p.marksAwarded)}/{fmt(p.maxMarks)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {(priorities.length > 0 || chapters.length > 0) && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{t('ex.r.weak')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {priorities.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium">{t('ex.r.priorities')}</p>
                <ol className="space-y-1 text-sm">
                  {priorities.map((p) => (
                    <li key={p.unit} className="flex justify-between gap-3">
                      <span>{t('ex.r.unit', { u: p.unit, name: p.name })}<span className="ml-1 text-xs text-muted-foreground">({p.chapters.join(', ')})</span></span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">{t('ex.r.gainable', { n: fmt(p.gainable), of: p.boardMarks })}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {chapters.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium">{t('ex.r.byChapter')}</p>
                <ul className="space-y-2">
                  {chapters.map((w) => (
                    <li key={w.chapter} className="space-y-1 text-sm">
                      <div className="flex justify-between gap-3"><span>{w.chapter}</span><span className="tabular-nums text-muted-foreground">{fmt(w.awarded)}/{fmt(w.marks)}</span></div>
                      <Bar value={w.share} band={w.share >= 0.8 ? 'strong' : w.share >= 0.5 ? 'fair' : 'weak'} />
                      {w.missedKinds.length > 0 && <p className="text-xs text-muted-foreground">{t('ex.r.lostOn', { kinds: w.missedKinds.map((k) => t(`ex.r.qt.${k}` as ExKey)).join(', ') })}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {topics.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium">{t('ex.r.byTopic')}</p>
                <ul className="space-y-1 text-sm">
                  {topics.map((w) => (
                    <li key={`${w.chapter}|${w.topic}`} className="flex justify-between gap-3">
                      <span>{w.topic}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">{fmt(w.awarded)}/{fmt(w.marks)} · {pct(w.share)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-0"><CardTitle className="text-base">{t('ex.r.params')}</CardTitle></CardHeader>
        <CardContent>
          <p className="pt-1 text-xs text-muted-foreground">{t('ex.r.paramsNote')}</p>
          <ul className="divide-y">{r.profile.parameters.map((p) => <ParameterRow key={p.id} p={p} />)}</ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-0"><CardTitle className="text-base">{t('ex.r.questions')}</CardTitle></CardHeader>
        <CardContent>
          <p className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">{VERDICT_ICON.met}{t('ex.r.v.met')}</span>
            <span className="flex items-center gap-1">{VERDICT_ICON.partial}{t('ex.r.v.partial')}</span>
            <span className="flex items-center gap-1">{VERDICT_ICON.missing}{t('ex.r.v.missing')}</span>
            {pending > 0 && <span className="flex items-center gap-1"><CircleDashed className="h-4 w-4" aria-hidden />{t('ex.r.q.pending')}</span>}
          </p>
          <ul className="divide-y">{r.perQuestion.map((q, i) => <QuestionRow key={`${q.number}-${q.alt ?? ''}-${i}`} q={q} revision={q.answerId ? revisedOf.get(q.answerId) : undefined} />)}</ul>
        </CardContent>
      </Card>
    </div>
  )
}
