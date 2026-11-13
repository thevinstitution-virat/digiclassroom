// Turning a local ink draft into the two uploaded files, and sending them.

import { encodeInk, type InkDocument } from '@/lib/hw/ink/stroke-format'
import { gzipBytes } from '../ink/png-encode'
import { renderForReader } from '../ink/render'
import { hwSpaceHeaders } from '@/lib/trpc/hw-space'
import type { PhotoFacts } from '../photo/prepare'

/** HW_RENDER_MAX_WIDTH on the server must be at least this. */
export const RENDER_MAX_WIDTH = 1000

export class UploadError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

/** Resolves when the browser is idle (at most `ms` later), so preparing an upload never competes with the pen. */
function whenIdle(ms = 1500): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) window.requestIdleCallback(() => resolve(), { timeout: ms })
    else setTimeout(resolve, 0)
  })
}

export async function uploadInk(submissionId: string, questionId: string, doc: InkDocument): Promise<{ renderBytes: number; inkBytes: number }> {
  await whenIdle()
  const [{ png }, ink] = await Promise.all([
    renderForReader(doc, RENDER_MAX_WIDTH),
    gzipBytes(new TextEncoder().encode(JSON.stringify(encodeInk(doc)))),
  ])
  const form = new FormData()
  form.set('questionId', questionId)
  form.set('ink', new Blob([new Uint8Array(ink)], { type: 'application/gzip' }), 'ink.json.gz')
  form.set('render', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'render.png')
  // InkBuddy's screens send x-hw-space, so a school student's practice writing goes to their practice space, not their school
  const res = await fetch(`/api/hw/submissions/${encodeURIComponent(submissionId)}/ink`, { method: 'POST', body: form, credentials: 'include', headers: hwSpaceHeaders() })
  const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
  if (!res.ok || !body?.ok) throw new UploadError(body?.error ?? `upload failed (${res.status})`, res.status)
  return { renderBytes: png.length, inkBytes: ink.length }
}

/** A photo of an answer written on paper (already prepared by photo/prepare.ts). Returns a short-lived link to the stored photo. */
export async function uploadPhoto(submissionId: string, questionId: string, photo: Blob, facts: PhotoFacts & { override: boolean }): Promise<{ url: string; warning: string | null }> {
  const form = new FormData()
  form.set('questionId', questionId)
  form.set('photo', photo, 'answer.jpg')
  form.set('facts', JSON.stringify(facts))
  const res = await fetch(`/api/hw/submissions/${encodeURIComponent(submissionId)}/photo`, { method: 'POST', body: form, credentials: 'include', headers: hwSpaceHeaders() })
  const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; url?: string; warning?: string | null } | null
  if (!res.ok || !body?.ok || !body.url) throw new UploadError(body?.error ?? `upload failed (${res.status})`, res.status)
  return { url: body.url, warning: body.warning ?? null }
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}
