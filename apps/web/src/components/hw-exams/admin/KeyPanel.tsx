// A question's key as a teacher checks it (migration 037; docs/hw-eval/board-bank-roadmap.md, phase 2): the whole question with its pictures, the
// right option or the value points, where the key came from, where the question is taught and where it was printed. A key the assistant wrote
// ("KEY TO CHECK") is marked checked here, by the signed-in account, and its pool cannot be published until every such key is. A key a model
// confirmed against the NCERT chapter arrives already checked by "Auto-check: ..." (the pool importer); its verdict is shown at the top.

import { api } from '@/lib/trpc/client'
import type { HwOut } from '@/components/hw/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Note } from './shared'

export type SetItem = HwOut['exams']['admin']['getSet']['items'][number]
type Part = { label?: string; marks?: number; answer_kind?: string; value_points?: { text?: string; marks?: number }[] }

/**
 * The second check of an assistant key by a model against the NCERT chapter (the pool importer writes it into the scheme text as
 * "AI check (model, date): confirmed from the textbook | DISPUTED | a person must check. <why>"). Confirmed keys arrive marked checked by
 * "Auto-check: model (date)"; a teacher can take that back like any check.
 */
export function aiCheckOf(schemeText: string | null | undefined) {
  const line = (schemeText ?? '').split('\n').find((l) => l.startsWith('AI check ('))
  if (!line) return null
  const status = line.includes('): confirmed') ? 'confirmed' : line.includes('): DISPUTED') ? 'disputed' : 'person'
  return { line, status } as const
}

const AI_TONE = {
  confirmed: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
  disputed: 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200',
  person: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
} as const

/** The small badges in the question list: whose key it is, how often the boards asked it, where it is taught. */
export function KeyBadges({ it }: { it: SetItem }) {
  const ncert = it.ncert as { section?: string; pages?: string }
  const ai = it.keyToCheck ? aiCheckOf(it.schemeText) : null
  return (
    <>
      {it.keyToCheck && (it.keyCheckedBy
        ? <Badge variant="secondary" title={`Checked by ${it.keyCheckedBy}`}>{it.keyCheckedBy.startsWith('Auto-check:') ? 'key auto-checked' : 'key checked'}</Badge>
        : <Badge variant="destructive">key to check</Badge>)}
      {ai && ai.status !== 'confirmed' && !it.keyCheckedBy && <Badge variant="outline" title={ai.line}>{ai.status === 'disputed' ? 'AI disputes key' : 'AI unsure'}</Badge>}
      {(it.schemeText ?? '').startsWith('CBSE marking scheme') && <Badge variant="secondary">CBSE key</Badge>}
      {it.sources.length > 1 && <Badge variant="outline" title={it.sources.join(', ')}>asked {it.sources.length}×</Badge>}
      {ncert.section && <Badge variant="outline">NCERT {ncert.section} · p{ncert.pages}</Badge>}
      {it.figures.length > 0 && <Badge variant="outline">{it.figures.length} picture{it.figures.length === 1 ? '' : 's'}</Badge>}
    </>
  )
}

export function KeyPanel({ it, editable, onChanged }: { it: SetItem; editable: boolean; onChanged: () => void }) {
  const check = api.hw.exams.admin.checkItemKey.useMutation({ onSuccess: onChanged })
  const ncert = it.ncert as { section?: string; title?: string; pages?: string; chapterNo?: number }
  const options = it.options as string[]
  const parts = it.parts as Part[]
  const ai = it.keyToCheck ? aiCheckOf(it.schemeText) : null
  return (
    <div className="mt-2 space-y-3 rounded-md border bg-muted/30 p-3 text-sm">
      {ai && <p className={`rounded border px-2 py-1 text-xs ${AI_TONE[ai.status]}`}>{ai.line}</p>}
      <p className="whitespace-pre-wrap">{it.stem}</p>
      {it.figures.map((f, k) => (
        <figure key={k} className="space-y-1">
          {f.url ? <img src={f.url} alt={f.description} className="max-h-64 rounded border bg-white" /> : <p className="text-xs text-muted-foreground">(picture not available here)</p>}
          <figcaption className="text-xs text-muted-foreground">{f.description}</figcaption>
        </figure>
      ))}
      {options.length > 0 && (
        <ol className="space-y-1">
          {options.map((o, k) => {
            const letter = 'ABCD'[k]
            const right = letter === it.correctOption
            return <li key={k} className={right ? 'font-semibold text-emerald-700 dark:text-emerald-300' : ''}>({letter}) {o}{right && ' ✓'}</li>
          })}
        </ol>
      )}
      {parts.length > 0 && (
        <div className="space-y-2">
          {parts.map((p, k) => (
            <div key={k}>
              <p className="font-medium">
                {p.label ? `Part (${p.label})` : 'The answer'} · {p.marks} mark{p.marks === 1 ? '' : 's'}
                {p.answer_kind === 'diagram' && <span className="ml-2 text-xs font-normal text-amber-700 dark:text-amber-300">a drawing: shown to the learner, not marked by the AI</span>}
              </p>
              <ul className="ml-4 list-disc">
                {(p.value_points ?? []).map((v, j) => <li key={j}>{v.text} <span className="text-muted-foreground">[{v.marks}]</span></li>)}
              </ul>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-1 text-xs text-muted-foreground">
        {ncert.section && <p>Taught in: NCERT {ncert.chapterNo ? `chapter ${ncert.chapterNo}, ` : ''}{ncert.section} {ncert.title}, pages {ncert.pages}</p>}
        {it.sources.length > 0 && <p>Printed in: {it.sources.join(', ')}</p>}
        <details><summary className="cursor-pointer">Scheme text</summary><p className="mt-1 whitespace-pre-wrap">{it.schemeText}</p></details>
      </div>
      {it.keyToCheck && (
        <div className="flex flex-wrap items-center gap-2">
          {it.keyCheckedBy
            ? <span className="text-xs">Checked by {it.keyCheckedBy}{it.keyCheckedAt ? ` on ${new Date(it.keyCheckedAt).toLocaleDateString('en-IN')}` : ''}.</span>
            : <span className="text-xs text-amber-700 dark:text-amber-300">The assistant wrote this key from the textbook. Compare it with NCERT before marking it checked.</span>}
          {editable && (it.keyCheckedBy
            ? <Button size="sm" variant="outline" disabled={check.isPending} onClick={() => check.mutate({ itemId: it.id, checked: false })}>Take back the check</Button>
            : <Button size="sm" disabled={check.isPending} onClick={() => check.mutate({ itemId: it.id, checked: true })}>Key is right: mark it checked</Button>)}
        </div>
      )}
      <Note tone="error">{check.error?.message}</Note>
    </div>
  )
}
