'use client'

// Writing-pad copy tasks: copy a given text by hand on the same pad students use. The ink
// and its render are uploaded like a student's answer and become reading test items.

import { useState } from 'react'
import { api } from '@/lib/trpc/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HwError, HwLoading, HwMessage } from '@/components/hw/HwShell'
import { InkPad, type InkStats } from '@/components/hw/ink/InkPad'
import { gzipBytes } from '@/components/hw/ink/png-encode'
import { renderForReader } from '@/components/hw/ink/render'
import { RENDER_MAX_WIDTH } from '@/components/hw/student/sync'
import { encodeInk, type InkDocument } from '@/lib/hw/ink/stroke-format'
import { EvalShell, useEvalMe, useVisibleTime } from '@/components/hw-eval/EvalShell'

type Item = { datasetRef: string; itemId: string; text: string; language: string; question: string }

async function upload(item: Item, doc: InkDocument, durationMs: number, device: string) {
  const [{ png }, ink] = await Promise.all([
    renderForReader(doc, RENDER_MAX_WIDTH),
    gzipBytes(new TextEncoder().encode(JSON.stringify(encodeInk(doc)))),
  ])
  const form = new FormData()
  form.set('datasetRef', item.datasetRef)
  form.set('itemId', item.itemId)
  form.set('durationMs', String(Math.round(durationMs)))
  form.set('device', device)
  form.set('ink', new Blob([new Uint8Array(ink)], { type: 'application/gzip' }), 'ink.json.gz')
  form.set('render', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'render.png')
  const res = await fetch('/api/hw-eval/copies', { method: 'POST', body: form, credentials: 'include' })
  const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
  if (!res.ok || !body?.ok) throw new Error(body?.error ?? `upload failed (${res.status})`)
}

function CopyOne({ item, onDone }: { item: Item; onDone: () => void }) {
  const [doc, setDoc] = useState<InkDocument | null>(null)
  const [stats, setStats] = useState<InkStats | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const elapsed = useVisibleTime()
  const lines = Math.min(40, Math.max(6, Math.ceil(item.text.length / 35) + 2))
  const send = async () => {
    if (!doc?.strokes.length) return
    setBusy(true)
    setError(null)
    try {
      await upload(item, doc, elapsed(), (stats?.tools ?? []).join('+') || 'unknown')
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Copy this text exactly, by hand</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">Same words, spelling and line breaks, mistakes included. Write the way you normally write. Do not write your name.</p>
          <p className="whitespace-pre-wrap rounded-md bg-muted p-3 text-lg leading-relaxed" lang={item.language === 'en' ? 'en' : 'hi'}>{item.text}</p>
        </CardContent>
      </Card>
      <InkPad value={doc} lines={lines} onChange={(d, s) => { setDoc(d); setStats(s) }} disabled={busy} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy || !doc?.strokes.length} onClick={send}>{busy ? 'Saving…' : 'Save and next'}</Button>
      </div>
      {error && <HwMessage tone="error">{error}</HwMessage>}
    </div>
  )
}

function Copies() {
  const q = api.hwEval.copies.useQuery(undefined, { refetchOnWindowFocus: false })
  if (q.isLoading) return <HwLoading />
  if (q.error) return <HwError message={q.error.message} onRetry={() => q.refetch()} />
  const item = q.data!.items[0]
  if (!item) return <HwMessage>Nothing left to copy. Thank you!</HwMessage>
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{q.data!.remaining} {q.data!.remaining === 1 ? 'text' : 'texts'} left to copy.</p>
      <CopyOne key={`${item.datasetRef}/${item.itemId}`} item={item} onDone={() => q.refetch()} />
    </div>
  )
}

export default function CopyPage() {
  const me = useEvalMe()
  return (
    <EvalShell title="Copy on the writing pad" back={{ href: '/evaluate', label: 'Your tasks' }}>
      {me.data?.isRater && <Copies />}
    </EvalShell>
  )
}
