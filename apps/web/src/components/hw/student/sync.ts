// Turning a local ink draft into the two uploaded files, and sending them.

import { encodeInk, type InkDocument } from '@/lib/hw/ink/stroke-format'
import { gzipBytes } from '../ink/png-encode'
import { renderForReader } from '../ink/render'

/** HW_RENDER_MAX_WIDTH on the server must be at least this. */
export const RENDER_MAX_WIDTH = 1000

export class UploadError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

export async function uploadInk(submissionId: string, questionId: string, doc: InkDocument): Promise<{ renderBytes: number; inkBytes: number }> {
  const [{ png }, ink] = await Promise.all([
    renderForReader(doc, RENDER_MAX_WIDTH),
    gzipBytes(new TextEncoder().encode(JSON.stringify(encodeInk(doc)))),
  ])
  const form = new FormData()
  form.set('questionId', questionId)
  form.set('ink', new Blob([new Uint8Array(ink)], { type: 'application/gzip' }), 'ink.json.gz')
  form.set('render', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'render.png')
  const res = await fetch(`/api/hw/submissions/${encodeURIComponent(submissionId)}/ink`, { method: 'POST', body: form, credentials: 'include' })
  const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
  if (!res.ok || !body?.ok) throw new UploadError(body?.error ?? `upload failed (${res.status})`, res.status)
  return { renderBytes: png.length, inkBytes: ink.length }
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}
