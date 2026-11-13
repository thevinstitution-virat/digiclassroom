'use client'

// InkBuddy's result page, Phase 1 of docs/hw-eval/inkbuddy-teacher-roadmap.md: who evaluated it (and how, on request), the learner's
// attempts at the question with "Write it again", their answer as they wrote it beside how it was read, and the book's own answer on a
// notebook page in a handwriting-style font (Kalam, self-hosted under /fonts/kalam, covers English and Devanagari; SIL OFL).

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, RotateCcw } from 'lucide-react'
import { api } from '@/lib/trpc/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { HwMessage } from '../HwShell'
import { useHwT } from '../strings'

type Bi = { en: string; hi: string }

/** "Evaluated by Virat Evaluator · practice marks", and how it was marked behind a disclosure. */
export function EvaluatedNote({ label, note, how }: { label: Bi; note: Bi; how?: Bi }) {
  const { lang } = useHwT()
  return (
    <HwMessage>
      <p className="font-medium">{label[lang]}</p>
      {how ? (
        <details className="mt-1">
          <summary className="cursor-pointer text-sm underline underline-offset-2">{how[lang]}</summary>
          <p className="mt-1 text-sm">{note[lang]}</p>
        </details>
      ) : <p>{note[lang]}</p>}
    </HwMessage>
  )
}

export interface AttemptsInfo {
  history: { n: number; assignmentId: string; status: string | null; createdAt: string | Date; awarded: number | null; outOf: number; current: boolean }[]
  usedInPlan: number
  limit: number
  canWriteAgain: boolean
  latestAssignmentId: string
}

/** The learner's attempts at this question, oldest first, and "Write it again" while the plan allows. */
export function AttemptsCard({ attempts, assignmentId }: { attempts: AttemptsInfo; assignmentId: string }) {
  const { t, lang } = useHwT()
  const router = useRouter()
  const again = api.hw.practice.writeAgain.useMutation({
    onSuccess: (r) => router.push(`/dashboard/student/assignments/${r.assignmentId}?space=practice`),
  })
  const date = (d: string | Date) => new Date(d).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short' })
  const atLimit = attempts.usedInPlan >= attempts.limit
  const latestOpen = !attempts.canWriteAgain && !atLimit && attempts.latestAssignmentId !== assignmentId
  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-lg">{t('pr.attempts.title')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('pr.attempts.used', { used: attempts.usedInPlan, limit: attempts.limit })}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <ol className="space-y-1 text-sm">
          {attempts.history.map((h) => (
            <li key={h.assignmentId} className={cn('flex flex-wrap items-center justify-between gap-2 rounded-md px-2 py-1', h.current && 'bg-muted')}>
              <span>{t('pr.attempts.row', { n: h.n })} · {date(h.createdAt)}</span>
              <span className="flex items-center gap-2">
                <Badge variant="secondary">{h.awarded !== null ? `${h.awarded} / ${h.outOf}` : t('pr.attempts.notMarked')}</Badge>
                {h.current ? <span className="text-xs text-muted-foreground">{t('pr.attempts.this')}</span> : (
                  <Link className="text-xs underline underline-offset-2" href={`/dashboard/student/assignments/${h.assignmentId}?space=practice`}>{t('pr.attempts.open')}</Link>
                )}
              </span>
            </li>
          ))}
        </ol>
        {attempts.canWriteAgain && (
          <Button onClick={() => again.mutate({ assignmentId })} disabled={again.isPending}>
            {again.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
            {again.isPending ? t('pr.again.starting') : t('pr.again', { n: attempts.usedInPlan + 1, limit: attempts.limit })}
          </Button>
        )}
        {latestOpen && (
          <Button asChild variant="outline"><Link href={`/dashboard/student/assignments/${attempts.latestAssignmentId}?space=practice`}>{t('pr.attempts.latest')}</Link></Button>
        )}
        {atLimit && <p className="text-sm text-muted-foreground">{t('pr.again.limit', { limit: attempts.limit })}</p>}
        {again.error && <p className="text-sm text-red-600">{again.error.message}</p>}
      </CardContent>
    </Card>
  )
}

/** The answer as the learner gave it (their writing, photo or typing) beside how Virat Evaluator read it. */
export function AnswerToggle({ yours, transcript, readView }: { yours: { mode: string; url: string | null; typed: string | null } | null; transcript: string; /** The reading, drawn by the caller (with the teacher's underlines). */ readView?: ReactNode }) {
  const { t } = useHwT()
  const [view, setView] = useState<'read' | 'yours'>('read')
  return (
    <div className="space-y-2">
      <div className="flex gap-1" role="radiogroup">
        {(['yours', 'read'] as const).map((v) => (
          <Button key={v} size="sm" variant={view === v ? 'default' : 'outline'} role="radio" aria-checked={view === v} onClick={() => setView(v)}>
            {t(v === 'yours' ? 'pr.view.yours' : 'pr.view.read')}
          </Button>
        ))}
      </div>
      {view === 'read' ? (
        readView ?? <p className="whitespace-pre-wrap rounded bg-muted p-3">{transcript || '—'}</p>
      ) : yours?.mode === 'typed' ? (
        <p className="whitespace-pre-wrap rounded border p-3">{yours.typed || '—'}</p>
      ) : yours?.url ? (
        // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed link to the learner's own writing or photo
        <img src={yours.url} alt={t('pr.view.yours')} className="max-h-[70vh] w-full rounded-md border bg-white object-contain" />
      ) : (
        <p className="text-sm text-muted-foreground">{t('pr.view.none')}</p>
      )}
    </div>
  )
}

export const NOTEBOOK_FONT = `
@font-face { font-family: 'Kalam'; font-style: normal; font-weight: 400; font-display: swap;
  src: url(/fonts/kalam/kalam-devanagari-400-normal.woff2) format('woff2');
  unicode-range: U+0900-097F,U+1CD0-1CF9,U+200C-200D,U+20A8,U+20B9,U+20F0,U+25CC,U+A830-A839,U+A8E0-A8FF,U+11B00-11B09; }
@font-face { font-family: 'Kalam'; font-style: normal; font-weight: 400; font-display: swap;
  src: url(/fonts/kalam/kalam-latin-400-normal.woff2) format('woff2');
  unicode-range: U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD; }
`

/** The book's answer on a ruled notebook page with a margin, in a handwriting-style font, and the pages it comes from. */
export function BookAnswer({ text, source }: { text: string; source: string }) {
  const { t } = useHwT()
  const line = 34
  return (
    <div className="space-y-1">
      <style>{NOTEBOOK_FONT}</style>
      <p className="text-sm font-medium">{t('pr.book.title')}</p>
      <div
        className="relative overflow-hidden rounded-md border text-slate-900 shadow-sm"
        style={{
          background: `linear-gradient(90deg, transparent 47px, rgba(239,68,68,0.55) 47px, rgba(239,68,68,0.55) 49px, transparent 49px), repeating-linear-gradient(180deg, #fffdf6 0px, #fffdf6 ${line - 1}px, rgba(59,130,246,0.28) ${line - 1}px, rgba(59,130,246,0.28) ${line}px)`,
          backgroundColor: '#fffdf6',
        }}
      >
        <p
          className="whitespace-pre-wrap"
          style={{ fontFamily: "'Kalam', 'Comic Sans MS', cursive", fontSize: 19, lineHeight: `${line}px`, padding: `${line - 6}px 16px ${line / 2}px 60px`, color: '#1e3a8a' }}
        >
          {text}
        </p>
      </div>
      {source && <p className="text-xs text-muted-foreground">{t('pr.book.from', { source })}</p>}
    </div>
  )
}
