// The photo booklet (phase 4): after the writing time, the learner photographs each answer page. Every photo is checked here first (blur, light,
// glare — page-measure.ts; uncertain checks can be overridden), shrunk to a sensible size, and uploaded; then the pages are put in order and
// handed in. The server checks everything it can itself (lib/hw/exams/pages.ts); nothing here is trusted for the clock or the file.

import { useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Camera, Images, Loader2, Send, Trash2 } from 'lucide-react'
import { api } from '@/lib/trpc/client'
import type { HwOut } from '@/components/hw/types'
import { PAGE_LIMITS, SOFT_PAGE_PROBLEMS, type PageProblem } from '@/lib/hw/exams/rules'
import { preparePhoto, type PhotoFacts } from '@/components/hw/photo/prepare'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useExamT, type ExKey } from './strings'

type Page = HwOut['exams']['attempt']['booklet'][number]
type Facts = PhotoFacts
type Held = { id: string; name: string; blob: Blob; preview: string; facts: Facts; problem: PageProblem | 'unreadable' }

/** The long side a page is uploaded at: plenty for handwriting, a fraction of a phone photo's size. */
const UPLOAD_LONG_SIDE = 2400

const prepare = (file: File) => preparePhoto(file, UPLOAD_LONG_SIDE)

export function Booklet({ attemptId, status, pages, onChanged }: { attemptId: string; status: string; pages: Page[]; onChanged: () => void }) {
  const { t, pick } = useExamT()
  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [held, setHeld] = useState<Held[]>([])
  const [error, setError] = useState<string | null>(null)
  const reorder = api.hw.exams.reorderPages.useMutation({ onSuccess: onChanged, onError: (e) => setError(pick(e.message)) })
  const remove = api.hw.exams.removePage.useMutation({ onSuccess: onChanged, onError: (e) => setError(pick(e.message)) })
  const handIn = api.hw.exams.submitBooklet.useMutation({ onSuccess: onChanged, onError: (e) => setError(pick(e.message)) })
  const open = status === 'time_up'

  async function upload(name: string, blob: Blob, facts: Facts, override: boolean): Promise<boolean> {
    setBusy(t('ex.b.uploading', { name }))
    const form = new FormData()
    form.append('page', blob, 'page.jpg')
    form.append('facts', JSON.stringify({ ...facts, override }))
    const res = await fetch(`/api/hw/exams/attempts/${encodeURIComponent(attemptId)}/pages`, { method: 'POST', body: form, credentials: 'include' })
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
    if (!res.ok || !body.ok) { setError(pick(body.error ?? 'Upload failed. / अपलोड नहीं हुआ।')); return false }
    onChanged()
    return true
  }

  async function addFiles(files: FileList | null) {
    if (!files?.length) return
    setError(null)
    for (const file of Array.from(files)) {
      setBusy(t('ex.b.checking', { name: file.name }))
      try {
        const p = await prepare(file)
        if (p.verdict.ok) await upload(file.name, p.blob, p.facts, false)
        else setHeld((h) => [...h, { id: `${Date.now()}-${file.name}`, name: file.name, blob: p.blob, preview: URL.createObjectURL(p.blob), facts: p.facts, problem: p.verdict.ok ? 'unreadable' : p.verdict.why }])
      } catch {
        setHeld((h) => [...h, { id: `${Date.now()}-${file.name}`, name: file.name, blob: file, preview: '', facts: { sharpness: 0, brightness: 0, glare: 0 }, problem: 'unreadable' }])
      }
    }
    setBusy(null)
    if (camera.current) camera.current.value = ''
    if (gallery.current) gallery.current.value = ''
  }

  const drop = (h: Held) => { if (h.preview) URL.revokeObjectURL(h.preview); setHeld((all) => all.filter((x) => x.id !== h.id)) }
  const move = (i: number, by: -1 | 1) => {
    const ids = pages.map((p) => p.id)
    const [x] = ids.splice(i, 1)
    ids.splice(i + by, 0, x!)
    reorder.mutate({ attemptId, orderedIds: ids })
  }
  const working = Boolean(busy) || reorder.isPending || remove.isPending || handIn.isPending

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-lg">{t('ex.b.title')}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {open ? <p className="text-sm text-muted-foreground">{t('ex.b.howto')}</p> : <p className="text-sm font-medium">{t(status === 'reported' ? 'ex.b.handedInMarked' : 'ex.b.handedIn', { n: pages.length })}</p>}

        {open && (
          <div className="flex flex-wrap gap-2">
            <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void addFiles(e.target.files)} />
            <input ref={gallery} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void addFiles(e.target.files)} />
            <Button disabled={working || pages.length >= PAGE_LIMITS.maxPages} onClick={() => camera.current?.click()}><Camera className="mr-1 h-4 w-4" />{t('ex.b.take')}</Button>
            <Button variant="outline" disabled={working || pages.length >= PAGE_LIMITS.maxPages} onClick={() => gallery.current?.click()}><Images className="mr-1 h-4 w-4" />{t('ex.b.choose')}</Button>
          </div>
        )}
        {busy && <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" />{busy}</p>}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

        {held.map((h) => (
          <div key={h.id} className="flex gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
            {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of the learner's own photo */}
            {h.preview && <img src={h.preview} alt="" className="h-24 w-auto rounded border bg-white" />}
            <div className="min-w-0 flex-1 space-y-2">
              <p>{t(`ex.b.p.${h.problem}` as ExKey)}</p>
              <div className="flex flex-wrap gap-2">
                {h.problem !== 'unreadable' && SOFT_PAGE_PROBLEMS.has(h.problem) && (
                  <Button size="sm" variant="outline" disabled={working} onClick={async () => { if (await upload(h.name, h.blob, h.facts, true)) drop(h); setBusy(null) }}>{t('ex.b.useAnyway')}</Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => drop(h)}>{t('ex.b.retake')}</Button>
              </div>
            </div>
          </div>
        ))}

        {pages.length === 0 ? (open && <p className="text-sm text-muted-foreground">{t('ex.b.none')}</p>) : (
          <ol className="grid gap-3 sm:grid-cols-3">
            {pages.map((p, i) => (
              <li key={p.id} className="space-y-2 rounded-md border p-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed link to the learner's own page */}
                <img src={p.url} alt={t('ex.b.page', { n: i + 1 })} className="aspect-[3/4] w-full rounded bg-muted object-contain" />
                <div className="flex items-center justify-between gap-1">
                  <span className="text-sm font-medium">{t('ex.b.page', { n: i + 1 })}</span>
                  {open && (
                    <span className="flex">
                      <Button size="icon" variant="ghost" aria-label={t('ex.b.up')} disabled={i === 0 || working} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" aria-label={t('ex.b.down')} disabled={i === pages.length - 1 || working} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" aria-label={t('ex.b.remove')} disabled={working} onClick={() => remove.mutate({ attemptId, pageId: p.id })}><Trash2 className="h-4 w-4" /></Button>
                    </span>
                  )}
                </div>
                {p.warning && <Badge variant="outline" className="text-xs">{t('ex.b.warn', { what: t(`ex.b.w.${p.warning}` as ExKey) })}</Badge>}
              </li>
            ))}
          </ol>
        )}

        {open && pages.length > 0 && (
          <Button disabled={working} onClick={() => { if (window.confirm(t('ex.b.handInConfirm', { n: pages.length }))) handIn.mutate({ attemptId }) }}>
            <Send className="mr-1 h-4 w-4" />{t('ex.b.handIn', { n: pages.length })}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
