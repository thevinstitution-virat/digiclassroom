// Per-device storage for the student's work in progress: ink and typed drafts (autosave),
// and an outbox of uploads/hand-ins waiting for the network. IndexedDB can be unavailable
// (private mode, blocked storage): every call fails soft and the page keeps working, it just
// cannot survive a reload offline.

import type { InkDocument } from '@/lib/hw/ink/stroke-format'

const DB_NAME = 'hw-assignments'
const VERSION = 1

export interface LocalDraft {
  key: string // `${submissionId}:${questionId}`
  submissionId: string
  questionId: string
  mode: 'typed' | 'ink'
  ink?: InkDocument
  typedText?: string
  timeSpentMs: number
  /** Bumped on every local change; the server copy is current when uploadedRev === rev. */
  rev: number
  uploadedRev: number
  stats?: Record<string, unknown>
  updatedAt: number
}

export interface OutboxSubmit {
  submissionId: string
  queuedAt: number
}

let opening: Promise<IDBDatabase | null> | null = null

function open(): Promise<IDBDatabase | null> {
  if (opening) return opening
  opening = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null)
      const req = indexedDB.open(DB_NAME, VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('drafts')) db.createObjectStore('drafts', { keyPath: 'key' })
        if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'submissionId' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return opening
}

function run<T>(store: 'drafts' | 'outbox', mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return open().then((db) => new Promise<T | null>((resolve) => {
    if (!db) return resolve(null)
    try {
      const req = fn(db.transaction(store, mode).objectStore(store))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  }))
}

export const draftKey = (submissionId: string, questionId: string) => `${submissionId}:${questionId}`

export async function saveDraft(d: LocalDraft): Promise<boolean> {
  return (await run('drafts', 'readwrite', (s) => s.put(d))) !== null
}

export async function loadDraft(key: string): Promise<LocalDraft | null> {
  return (await run<LocalDraft | undefined>('drafts', 'readonly', (s) => s.get(key))) ?? null
}

export async function draftsFor(submissionId: string): Promise<LocalDraft[]> {
  const all = (await run<LocalDraft[]>('drafts', 'readonly', (s) => s.getAll())) ?? []
  return all.filter((d) => d.submissionId === submissionId)
}

export async function clearDrafts(submissionId: string): Promise<void> {
  for (const d of await draftsFor(submissionId)) await run('drafts', 'readwrite', (s) => s.delete(d.key))
}

export async function queueSubmit(submissionId: string): Promise<void> {
  await run('outbox', 'readwrite', (s) => s.put({ submissionId, queuedAt: Date.now() } satisfies OutboxSubmit))
}

export async function queuedSubmit(submissionId: string): Promise<boolean> {
  return Boolean(await run<OutboxSubmit | undefined>('outbox', 'readonly', (s) => s.get(submissionId)))
}

export async function unqueueSubmit(submissionId: string): Promise<void> {
  await run('outbox', 'readwrite', (s) => s.delete(submissionId))
}
