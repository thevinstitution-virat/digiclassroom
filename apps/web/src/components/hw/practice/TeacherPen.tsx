'use client'

// The teacher's pen on an InkBuddy answer (Phase 2 of docs/hw-eval/inkbuddy-teacher-roadmap.md): the reading of the learner's answer with
// a teacher's underlines (green: a point made, from the marking's own quotes; red: a wrong fact; yellow: spelling, grammar or punctuation;
// grey dotted: how it is written), the notes behind them, and the teacher's remark on a slip of paper. Everything shown here was checked
// on the server: each quote is in the reading. Nothing here changes a mark.

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useHwT, type HwKey } from '../strings'
import { NOTEBOOK_FONT } from './ResultExtras'

export type PenKind = 'fact' | 'language' | 'presentation'
export interface PenNote { kind: PenKind; quote: string; note: string; fix: string }
export interface Pen { remark: string; notes: PenNote[] }
export interface PointQuote { verdict: 'met' | 'partial'; quote: string }

type Mark = 'met' | 'partial' | PenKind
/** When two marks cover the same words, the one that matters more to the learner is drawn. */
const RANK: Record<Mark, number> = { partial: 0, met: 1, presentation: 2, language: 3, fact: 4 }
const STYLE: Record<Mark, string> = {
  met: 'underline decoration-green-600 decoration-2 underline-offset-4',
  partial: 'underline decoration-green-500 decoration-dotted decoration-2 underline-offset-4',
  fact: 'underline decoration-red-600 decoration-wavy decoration-2 underline-offset-4',
  language: 'bg-yellow-100 underline decoration-yellow-500 decoration-2 underline-offset-4 dark:bg-yellow-900/40',
  presentation: 'underline decoration-slate-500 decoration-dotted decoration-2 underline-offset-4',
}
const LABEL: Record<Mark, HwKey> = {
  met: 'pr.pen.k.met', partial: 'pr.pen.k.partial', fact: 'pr.pen.k.fact', language: 'pr.pen.k.language', presentation: 'pr.pen.k.presentation',
}

/** Where a quote is in the text: case and spacing aside, the first place it occurs. */
export function findQuote(text: string, quote: string): [number, number] | null {
  const words = quote.trim().split(/\s+/).filter(Boolean).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (!words.length) return null
  const m = new RegExp(words.join('\\s+'), 'i').exec(text)
  return m ? [m.index, m.index + m[0].length] : null
}

/** The text cut into runs, each with the most important mark over it (or none), and the note number for a pen mark. */
export function markRuns(text: string, marks: { kind: Mark; quote: string; n?: number }[]): { text: string; kind: Mark | null; n?: number }[] {
  const at: ({ kind: Mark; n?: number } | null)[] = new Array(text.length).fill(null)
  for (const m of marks) {
    const r = findQuote(text, m.quote)
    if (!r) continue
    for (let i = r[0]; i < r[1]; i++) if (!at[i] || RANK[m.kind] > RANK[at[i]!.kind]) at[i] = { kind: m.kind, n: m.n }
  }
  const runs: { text: string; kind: Mark | null; n?: number }[] = []
  for (let i = 0; i < text.length; i++) {
    const k = at[i]
    const last = runs[runs.length - 1]
    if (last && last.kind === (k?.kind ?? null) && last.n === k?.n) last.text += text[i]
    else runs.push({ text: text[i]!, kind: k?.kind ?? null, n: k?.n })
  }
  return runs
}

/** The reading with the teacher's underlines, the key to the colours, and the numbered notes. */
export function MarkedAnswer({ transcript, points, pen }: { transcript: string; points: PointQuote[]; pen: Pen | null }) {
  const { t } = useHwT()
  const notes = pen?.notes ?? []
  const marks = [
    ...points.map((p) => ({ kind: p.verdict as Mark, quote: p.quote })),
    ...notes.map((n, i) => ({ kind: n.kind as Mark, quote: n.quote, n: i + 1 })),
  ]
  const runs = markRuns(transcript || '—', marks)
  const used = new Set(runs.map((r) => r.kind).filter(Boolean) as Mark[])
  return (
    <div className="space-y-3">
      <p className="whitespace-pre-wrap rounded bg-muted p-3 leading-8">
        {runs.map((r, i) => r.kind
          ? <span key={i} className={STYLE[r.kind]} title={t(LABEL[r.kind])}>{r.text}{r.n && (i === runs.length - 1 || runs[i + 1]!.n !== r.n) ? <sup className="ml-0.5 text-[10px] font-semibold no-underline">{r.n}</sup> : null}</span>
          : <span key={i}>{r.text}</span>)}
      </p>
      {used.size > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label={t('pr.pen.key')}>
          {(['met', 'partial', 'fact', 'language', 'presentation'] as Mark[]).filter((k) => used.has(k)).map((k) => (
            <li key={k}><span className={STYLE[k]}>{t('pr.pen.sample')}</span> {t(LABEL[k])}</li>
          ))}
        </ul>
      )}
      {notes.length > 0 && (
        <ol className="space-y-2 text-sm">
          {notes.map((n, i) => (
            <li key={i} className="flex gap-2">
              <span className={cn('mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white', n.kind === 'fact' ? 'bg-red-600' : n.kind === 'language' ? 'bg-yellow-500' : 'bg-slate-500')}>{i + 1}</span>
              <span className="min-w-0">
                <span className="font-medium">“{n.quote}”</span> · {n.note}
                {n.fix && <span className="block text-muted-foreground">{t('pr.pen.fix', { fix: n.fix })}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

/** The teacher's remark, on a slip of paper in a handwriting-style font. */
export function TeacherRemark({ remark, children }: { remark: string; children?: ReactNode }) {
  const { t } = useHwT()
  return (
    <figure className="space-y-1">
      <style>{NOTEBOOK_FONT}</style>
      <figcaption className="text-sm font-medium">{t('pr.pen.title')}</figcaption>
      <div className="rotate-[-0.4deg] rounded-md border border-amber-200 bg-amber-50 p-4 shadow-sm dark:border-amber-900 dark:bg-amber-950/40">
        <p className="whitespace-pre-wrap text-[#1e3a8a] dark:text-blue-200" style={{ fontFamily: "'Kalam', 'Comic Sans MS', cursive", fontSize: 18, lineHeight: 1.6 }}>{remark}</p>
        <p className="mt-2 text-right text-sm text-[#1e3a8a] dark:text-blue-200" style={{ fontFamily: "'Kalam', 'Comic Sans MS', cursive" }}>{t('pr.pen.sign')}</p>
      </div>
      {children}
    </figure>
  )
}
