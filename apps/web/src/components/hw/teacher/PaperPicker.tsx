// The builder's picker for board papers: choose a published paper, choose a question, add it. The server makes the question from the bank row (its text, its
// marks, its figures, the board's own marking scheme), so nothing about the question is typed here.

import { useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { api } from '@/lib/trpc/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, NativeSelect } from '../fields'
import { HwError, HwLoading } from '../HwShell'
import { marksLabel, useHwT } from '../strings'

export function PaperPicker({ assignmentId, onAdded }: { assignmentId: string; onAdded: () => void }) {
  const { t } = useHwT()
  const [open, setOpen] = useState(false)
  const [paperId, setPaperId] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const papers = api.hw.bank.papers.useQuery(undefined, { retry: false, staleTime: 300_000 })
  const chosen = paperId || papers.data?.[0]?.paperId || ''
  const questions = api.hw.bank.questions.useQuery({ paperId: chosen }, { enabled: open && chosen !== '', retry: false })
  const add = api.hw.bank.addQuestion.useMutation({
    onSuccess: (r) => {
      setNote(`${t('tc.b.paper.added', { marks: r.marks })}${r.excludedMarks ? ` ${t('tc.b.paper.drawingNote', { n: r.excludedMarks })}` : ''}`)
      onAdded()
    },
  })

  // Nothing published yet: nothing to offer, and no clutter.
  if (!papers.data?.length) return null
  const label = (p: (typeof papers.data)[number]) => t('pr.paper.label', { board: p.board, cls: p.classLevel, subject: p.subject, kind: t(p.kind === 'sqp' ? 'pr.paper.kind.sqp' : 'pr.paper.kind.past_paper'), session: p.session })

  if (!open) {
    return (
      <Card>
        <CardContent className="py-4">
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />{t('tc.b.paper.show')}</Button>
        </CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{t('tc.b.paper.title')}</CardTitle>
        <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setNote(null) }}>{t('tc.b.paper.hide')}</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{t('tc.b.paper.intro')}</p>
        <Field label={t('pr.paper.choose')}>
          <NativeSelect value={chosen} onChange={(e) => { setPaperId(e.target.value); setNote(null) }}>
            {papers.data.map((p) => <option key={p.paperId} value={p.paperId}>{label(p)}</option>)}
          </NativeSelect>
        </Field>
        {questions.isLoading && <HwLoading />}
        {questions.error && <HwError message={questions.error.message} onRetry={() => questions.refetch()} />}
        {add.error && <HwError message={add.error.message} />}
        {note && <p className="text-sm text-green-700 dark:text-green-400" role="status">{note}</p>}
        <ul className="space-y-2">
          {questions.data?.questions.map((q) => (
            <li key={q.rowId} className="flex flex-wrap items-start justify-between gap-3 rounded-md border p-3">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {t('pr.paper.q', { label: q.label })}
                  <Badge variant="secondary">{t('pr.paper.section', { s: q.section })}</Badge>
                  <Badge>{marksLabel(t, q.marks)}</Badge>
                  {q.variant === 'vi' && <Badge variant="outline">{t('tc.b.paper.vi')}</Badge>}
                  {q.figures.length > 0 && <Badge variant="outline">{t('pr.paper.figure')}</Badge>}
                </p>
                <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{q.stem}</p>
                {q.hasDrawing && <p className="text-xs text-amber-700 dark:text-amber-400">{t('pr.paper.drawing')}</p>}
              </div>
              <Button size="sm" disabled={add.isPending} onClick={() => { setNote(null); add.mutate({ assignmentId, rowId: q.rowId }) }}>
                {add.isPending && add.variables?.rowId === q.rowId && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {add.isPending && add.variables?.rowId === q.rowId ? t('tc.b.paper.adding') : t('tc.b.paper.add')}
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
