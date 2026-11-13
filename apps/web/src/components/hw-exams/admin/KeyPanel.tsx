// A question's key as a teacher checks it (migration 037; docs/hw-eval/board-bank-roadmap.md, phase 2): the whole question with its pictures, the
// right option or the value points, where the key came from, where the question is taught and where it was printed. A key the assistant wrote
// ("KEY TO CHECK") is marked checked here, by the signed-in account, and its pool cannot be published until every such key is.

import { api } from '@/lib/trpc/client'
import type { HwOut } from '@/components/hw/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Note } from './shared'

export type SetItem = HwOut['exams']['admin']['getSet']['items'][number]
type Part = { label?: string; marks?: number; answer_kind?: string; value_points?: { text?: string; marks?: number }[] }

/** The small badges in the question list: whose key it is, how often the boards asked it, where it is taught. */
export function KeyBadges({ it }: { it: SetItem }) {
  const ncert = it.ncert as { section?: string; pages?: string }
  return (
    <>
      {it.keyToCheck && (it.keyCheckedBy
        ? <Badge variant="secondary" title={`Checked by ${it.keyCheckedBy}`}>key checked</Badge>
        : <Badge variant="destructive">key to check</Badge>)}
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
  return (
    <div className="mt-2 space-y-3 rounded-md border bg-muted/30 p-3 text-sm">
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
