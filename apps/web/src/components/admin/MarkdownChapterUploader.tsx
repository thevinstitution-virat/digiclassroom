'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { AlertTriangle, BookOpen, CheckCircle, FileText, Loader2, Plus, Search, Upload, X, XCircle } from 'lucide-react'
import {
  analyseChapterFile,
  planChapterBatch,
  sha256Hex,
  type BatchTarget,
  type ChapterFileAnalysis,
  type KnownBook,
} from '@/lib/content/chapter-batch'
import type { Work } from '@/lib/db/content-works'

/**
 * Upload enriched-Markdown chapters into a BOOK THE SUPER-ADMIN CHOSE, one chapter at a time.
 *
 * Why it works this way (the same way PDLMS attaches a file to a book from its catalogue):
 *  - The person chooses the book first. Nothing about which book is guessed from a file, because a chapter attached to the
 *    wrong book is indexed cleanly, cited correctly, and answers as a different book: invisible afterwards.
 *  - Every chapter file is read and checked in the browser against that book BEFORE anything is sent: the same parser and the
 *    same identity rules the server uses (lib/content/chapter-batch.ts). One blocked file blocks the whole upload, so the set
 *    that is sent is the set that was reviewed. The server checks again; the browser is never trusted.
 *  - Chapters go one request at a time, in chapter order. One failing chapter does not stop the others, and the result of each
 *    is shown against its own row.
 *  - Nothing is indexed unless validation_status is APPROVED: a person checks the transcription against the printed pages.
 */

const WORKS_URL = '/api/super-admin/content/works'
const INGEST_URL = '/api/super-admin/content/ingest-markdown'
const fetcher = (url: string) => fetch(url).then((r) => r.json())

type Row = { id: number; file: File; analysis: ChapterFileAnalysis | null }
/** What the ingest route answers, as far as this page reads it. */
type IngestResponse = {
  success?: boolean
  error?: string
  errors?: string[]
  warnings?: string[]
  parts?: Array<{ outcome?: string; chunks?: number; pages?: string; detail?: string }>
  work?: { contentItemId?: string }
}
type Outcome = {
  status: 'waiting' | 'uploading' | 'done' | 'unchanged' | 'failed' | 'not-attempted'
  detail?: string
  chunks?: number
  pages?: string
  warnings?: string[]
}

const pagesLabel = (a: ChapterFileAnalysis) =>
  a.pages ? (a.pages.first === a.pages.last ? `p. ${a.pages.first}` : `pp. ${a.pages.first}-${a.pages.last}`) : ''

const inputCls =
  'w-full px-4 py-3 bg-muted/40 border border-border rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all'

export default function MarkdownChapterUploader() {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [chosen, setChosen] = useState<string | 'new' | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [outcomes, setOutcomes] = useState<Record<number, Outcome>>({})
  const [phase, setPhase] = useState<'choosing' | 'uploading' | 'finished'>('choosing')
  const nextId = useRef(1)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250)
    return () => clearTimeout(t)
  }, [search])

  const { data, error: listError, isLoading, mutate } = useSWR<{ success: boolean; works?: Work[]; error?: string }>(
    `${WORKS_URL}?q=${encodeURIComponent(debounced)}`,
    fetcher,
    { keepPreviousData: true },
  )
  const works = useMemo<Work[]>(() => (data?.success ? (data.works ?? []) : []), [data])
  const listProblem = listError ? 'Could not reach the server.' : data && !data.success ? (data.error ?? 'Could not load the books.') : null

  // The chosen book may fall out of the search results while the person types; keep it from the last list that had it.
  const chosenWork = useRef<Work | null>(null)
  const found = chosen && chosen !== 'new' ? works.find((w) => w.id === chosen) : undefined
  if (found) chosenWork.current = found
  const book: Work | null = chosen && chosen !== 'new' ? (found ?? (chosenWork.current?.id === chosen ? chosenWork.current : null)) : null

  const target: BatchTarget | null = useMemo(() => {
    if (chosen === 'new') {
      return { mode: 'new', knownBooks: works.map(toKnownBook) }
    }
    return book ? { mode: 'existing', book: toKnownBook(book) } : null
  }, [chosen, book, works])

  const analysed = rows.filter((r) => r.analysis) as Array<Row & { analysis: ChapterFileAnalysis }>
  const plan = useMemo(
    () => (target ? planChapterBatch(analysed.map((r) => r.analysis), target) : null),
    [target, rows], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // ── Adding files ───────────────────────────────────────────────────────────
  const addFiles = useCallback(async (list: FileList | File[]) => {
    const files = Array.from(list)
    if (files.length === 0) return
    const fresh: Row[] = files.map((file) => ({ id: nextId.current++, file, analysis: null }))
    setRows((cur) => {
      // The same file chosen again replaces the earlier one instead of queueing a second copy.
      const names = new Set(files.map((f) => f.name))
      return [...cur.filter((r) => !names.has(r.file.name)), ...fresh]
    })
    for (const row of fresh) {
      let analysis: ChapterFileAnalysis
      try {
        const bytes = await row.file.arrayBuffer()
        // ignoreBOM: keep a byte-order mark if there is one, exactly as the server reads the file, so a file the server
        // would refuse for starting with a BOM is refused here too.
        const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes)
        analysis = { ...analyseChapterFile(row.file.name, text, bytes.byteLength), sha256: await sha256Hex(bytes) }
      } catch (err) {
        analysis = {
          ...analyseChapterFile(row.file.name, '', 0),
          errors: [`"${row.file.name}" could not be read: ${err instanceof Error ? err.message : String(err)}`],
        }
      }
      setRows((cur) => cur.map((r) => (r.id === row.id ? { ...r, analysis } : r)))
    }
  }, [])

  const remove = (id: number) => setRows((cur) => cur.filter((r) => r.id !== id))
  const reset = () => {
    setRows([])
    setOutcomes({})
    setPhase('choosing')
  }

  // ── Uploading ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'uploading') return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [phase])

  const upload = async () => {
    if (!plan || !plan.canUpload || !target) return
    const queue = analysed
      .map((r, i) => ({ row: r, item: plan.items[i] }))
      .filter((x) => x.item.action === 'add' || x.item.action === 'replace')
      .sort((a, b) => (a.item.chapter ?? 0) - (b.item.chapter ?? 0))

    setPhase('uploading')
    setOutcomes(Object.fromEntries(analysed.map((r, i) => [r.id, { status: plan.items[i].action === 'unchanged' ? 'unchanged' : 'waiting' } as Outcome])))
    let bookId: string | null = chosen !== 'new' ? chosen : null

    for (let q = 0; q < queue.length; q++) {
      const { row } = queue[q]
      setOutcomes((o) => ({ ...o, [row.id]: { status: 'uploading' } }))
      const body = new FormData()
      body.append('file', row.file)
      body.append('uploadId', Math.random().toString(36).slice(2))
      // An existing book (or the new one, once its first chapter has made it) is named by id, so the server enforces it.
      // The first chapter of a new book asks the server to create it, and to refuse if it already exists.
      if (bookId) body.append('contentItemId', bookId)
      else body.append('newBook', 'true')

      let ok = false
      let message = ''
      let part: NonNullable<IngestResponse['parts']>[number] | null = null
      let warnings: string[] | undefined
      try {
        const res = await fetch(INGEST_URL, { method: 'POST', body })
        const json: IngestResponse = await res.json().catch(() => ({}))
        part = Array.isArray(json.parts) ? (json.parts[0] ?? null) : null
        warnings = Array.isArray(json.warnings) && json.warnings.length ? json.warnings : undefined
        ok = res.ok && json.success === true
        if (!ok) {
          const errs: string[] = Array.isArray(json.errors) ? json.errors : []
          message = [json.error, ...errs, part?.detail].filter(Boolean).join(' ') || `The server answered ${res.status}.`
        } else if (!bookId && json.work?.contentItemId) {
          bookId = json.work.contentItemId
        }
      } catch (err) {
        message = `Network error: ${err instanceof Error ? err.message : String(err)}`
      }

      if (ok) {
        const unchanged = part?.outcome === 'skipped-as-duplicate'
        setOutcomes((o) => ({
          ...o,
          [row.id]: { status: unchanged ? 'unchanged' : 'done', chunks: part?.chunks, pages: part?.pages, warnings },
        }))
      } else {
        setOutcomes((o) => ({ ...o, [row.id]: { status: 'failed', detail: message } }))
        // A new book whose FIRST chapter failed does not exist yet: going on would try to create it again with the next file.
        if (!bookId) {
          setOutcomes((o) => {
            const rest = Object.fromEntries(queue.slice(q + 1).map((x) => [x.row.id, { status: 'not-attempted' } as Outcome]))
            return { ...o, ...rest }
          })
          break
        }
      }
    }

    await mutate()
    if (chosen === 'new' && bookId) setChosen(bookId)
    setPhase('finished')
  }

  // ── What to show ───────────────────────────────────────────────────────────
  const busy = phase === 'uploading'
  const results = Object.values(outcomes)
  const doneCount = results.filter((o) => o.status === 'done').length
  const failCount = results.filter((o) => o.status === 'failed').length
  const targetLabel = chosen === 'new' ? 'a new book' : book ? `"${book.title}"` : ''

  return (
    <div className="space-y-8">
      {/* 1 — The book */}
      <section aria-labelledby="mcu-book">
        <h3 id="mcu-book" className="text-base font-semibold text-foreground mb-1 flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-white text-xs">1</span>
          Which book are these chapters for?
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Choose the book first. Every file is checked against it before anything is uploaded, so a chapter cannot end up in the wrong book.
        </p>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or ISBN"
            aria-label="Search books by title or ISBN"
            disabled={busy}
            className={`${inputCls} pl-10`}
          />
        </div>

        {listProblem && (
          <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-400">{listProblem}</p>
        )}

        <div role="radiogroup" aria-label="Books" className="grid gap-2 max-h-72 overflow-y-auto pr-1">
          <button
            type="button"
            role="radio"
            aria-checked={chosen === 'new'}
            disabled={busy}
            onClick={() => setChosen('new')}
            className={`text-left rounded-xl border p-3 transition-all ${chosen === 'new' ? 'border-orange-500 bg-orange-500/10' : 'border-dashed border-border hover:border-orange-400'}`}
          >
            <span className="flex items-center gap-2 font-medium text-sm text-foreground">
              <Plus className="h-4 w-4" aria-hidden /> New book
            </span>
            <span className="block text-xs text-muted-foreground mt-1">
              Its title, ISBN and edition are read from the chapter files. If that ISBN and edition already exist you are asked to select the book instead.
            </span>
          </button>

          {isLoading && !data && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground p-2"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading books...</p>
          )}
          {works.map((w) => {
            const live = w.chapters.filter((c) => c.live).length
            return (
              <button
                key={w.id}
                type="button"
                role="radio"
                aria-checked={chosen === w.id}
                disabled={busy}
                onClick={() => setChosen(w.id)}
                className={`text-left rounded-xl border p-3 transition-all ${chosen === w.id ? 'border-orange-500 bg-orange-500/10' : 'border-border hover:border-orange-400'}`}
              >
                <span className="flex items-center gap-2 font-medium text-sm text-foreground">
                  <BookOpen className="h-4 w-4 shrink-0" aria-hidden /> {w.title}
                </span>
                <span className="block text-xs text-muted-foreground mt-1">
                  {w.isbn ? `ISBN ${w.isbn}` : 'No ISBN recorded'}
                  {w.edition ? ` · ${w.edition}` : ''} · {live === 0 ? 'no chapters indexed yet' : `${live} chapter${live === 1 ? '' : 's'} indexed`}
                </span>
              </button>
            )
          })}
          {!isLoading && works.length === 0 && !listProblem && (
            <p className="text-sm text-muted-foreground p-2">{debounced ? 'No book matches that search.' : 'There are no books yet. Choose "New book".'}</p>
          )}
        </div>

        {book && <ChapterShelf book={book} missing={plan?.missingChapters ?? []} />}
      </section>

      {/* 2 — The files */}
      <section aria-labelledby="mcu-files">
        <h3 id="mcu-files" className="text-base font-semibold text-foreground mb-1 flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-white text-xs">2</span>
          Choose the chapter files
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          One <code className="px-1 rounded bg-muted">.md</code> file per chapter, up to 5 MB each. You can choose many at once. The chapter number, book and page numbers are read from each file&apos;s frontmatter. Only files marked <strong>validation_status: APPROVED</strong> are indexed.
        </p>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            if (!busy && target) void addFiles(e.dataTransfer.files)
          }}
          className={`rounded-xl border-2 border-dashed p-6 text-center ${target ? 'border-border' : 'border-border opacity-60'}`}
        >
          <input
            ref={fileInput}
            type="file"
            multiple
            accept=".md,text/markdown"
            aria-label="Chapter files"
            className="sr-only"
            disabled={!target || busy}
            onChange={(e) => {
              if (e.target.files) void addFiles(e.target.files)
              e.target.value = '' // so choosing the same file again works
            }}
          />
          <button
            type="button"
            disabled={!target || busy}
            onClick={() => fileInput.current?.click()}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-2 text-sm font-medium hover:border-orange-400 disabled:cursor-not-allowed"
          >
            <FileText className="h-4 w-4" aria-hidden /> Choose chapter files
          </button>
          <p className="mt-2 text-xs text-muted-foreground">{target ? 'or drop them here' : 'Choose a book first'}</p>
        </div>
      </section>

      {/* 3 — Review and upload */}
      {rows.length > 0 && target && (
        <section aria-labelledby="mcu-review">
          <h3 id="mcu-review" className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-white text-xs">3</span>
            Review, then upload
          </h3>

          <ul className="space-y-2">
            {[...rows]
              .sort((a, b) => (a.analysis?.chapter ?? 1e9) - (b.analysis?.chapter ?? 1e9))
              .map((r) => {
                const idx = analysed.findIndex((x) => x.id === r.id)
                const item = plan && idx >= 0 ? plan.items[idx] : null
                const out = outcomes[r.id]
                return (
                  <li key={r.id} className="rounded-xl border border-border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {r.analysis?.chapter ? `Chapter ${r.analysis.chapter}` : 'Chapter ?'}
                          {r.analysis?.chapterTitle ? `: ${r.analysis.chapterTitle}` : ''}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {r.file.name}
                          {r.analysis && r.analysis.chunks.total > 0
                            ? ` · ${pagesLabel(r.analysis)} · ${r.analysis.chunks.total} passages (${r.analysis.chunks.reference} the tutor can answer from, ${r.analysis.chunks.practice} practice)`
                            : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!r.analysis && <Loader2 className="h-4 w-4 animate-spin" aria-label="Reading" />}
                        {item && !out && <Badge item={item} />}
                        {out && <OutcomeBadge outcome={out} />}
                        {!busy && phase !== 'finished' && (
                          <button type="button" onClick={() => remove(r.id)} aria-label={`Remove ${r.file.name}`} className="p-1 rounded hover:bg-muted">
                            <X className="h-4 w-4" aria-hidden />
                          </button>
                        )}
                      </div>
                    </div>

                    {item?.reasons.map((why, i) => (
                      <p key={i} role="alert" className="mt-2 flex gap-2 text-xs text-red-700 dark:text-red-300">
                        <XCircle className="h-4 w-4 shrink-0" aria-hidden /> <span>{why}</span>
                      </p>
                    ))}
                    {out?.status === 'failed' && out.detail && (
                      <p role="alert" className="mt-2 flex gap-2 text-xs text-red-700 dark:text-red-300">
                        <XCircle className="h-4 w-4 shrink-0" aria-hidden /> <span>{out.detail}</span>
                      </p>
                    )}
                    {item && !item.blocked && <Notes notes={[...item.notes, ...(out?.warnings ?? [])]} />}
                    {/* What the parser left out or flagged (SKIP regions, UNCLEAR marks): the reviewer's audit trail. */}
                    {r.analysis && r.analysis.skipped.length > 0 && (
                      <details className="mt-2 text-xs text-amber-800 dark:text-amber-200">
                        <summary className="cursor-pointer">
                          Reviewer audit: {r.analysis.skipped.length} item{r.analysis.skipped.length === 1 ? '' : 's'} skipped or flagged
                        </summary>
                        <ul className="list-disc pl-5 mt-1 space-y-1 max-h-40 overflow-y-auto">
                          {r.analysis.skipped.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </details>
                    )}
                  </li>
                )
              })}
          </ul>

          {plan && plan.problems.map((p, i) => (
            <p key={i} role="alert" className="mt-3 flex gap-2 text-sm text-red-700 dark:text-red-300">
              <XCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden /> <span>{p}</span>
            </p>
          ))}
          {plan && plan.missingChapters.length > 0 && (
            <p className="mt-3 flex gap-2 text-sm text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
              <span>After this upload the book will still be missing chapter{plan.missingChapters.length === 1 ? '' : 's'} {plan.missingChapters.join(', ')}. That is allowed, but the tutor cannot answer about them yet.</span>
            </p>
          )}

          {phase !== 'finished' ? (
            <>
              {plan && (
                <p className="mt-4 text-sm text-muted-foreground">
                  {plan.summary.add} to add, {plan.summary.replace} to replace, {plan.summary.unchanged} unchanged
                  {plan.summary.blocked > 0 ? `, ${plan.summary.blocked} blocked. Remove or fix the blocked file${plan.summary.blocked === 1 ? '' : 's'} to continue.` : '.'}
                </p>
              )}
              <button
                type="button"
                onClick={() => void upload()}
                disabled={!plan?.canUpload || busy || rows.some((r) => !r.analysis)}
                className="mt-3 w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold py-4 px-8 rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Upload className="h-5 w-5" aria-hidden />}
                <span>
                  {busy
                    ? 'Uploading and indexing chapters...'
                    : plan?.canUpload
                      ? `Upload ${plan.summary.add + plan.summary.replace} chapter${plan.summary.add + plan.summary.replace === 1 ? '' : 's'} to ${targetLabel}`
                      : 'Upload'}
                </span>
              </button>
              {busy && <p className="mt-2 text-xs text-muted-foreground">Each chapter is embedded as it is uploaded. Keep this page open.</p>}
            </>
          ) : (
            <div role="status" className="mt-4 rounded-xl border border-border p-4">
              <p className="text-sm font-medium text-foreground">
                {failCount === 0 ? `Done. ${doneCount} chapter${doneCount === 1 ? '' : 's'} indexed.` : `${doneCount} chapter${doneCount === 1 ? '' : 's'} indexed, ${failCount} failed. The rows above say why.`}
              </p>
              <button type="button" onClick={reset} className="mt-3 rounded-xl border border-border px-4 py-2 text-sm hover:border-orange-400">
                Upload more chapters
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function toKnownBook(w: Work): KnownBook {
  return {
    id: w.id,
    title: w.title,
    isbn: w.isbn,
    edition: w.edition,
    // A chapter stored but not live (its indexing failed) must not count as "already indexed with identical content":
    // uploading it again has to try again, so its hash is withheld.
    chapters: w.chapters.map((c) => ({ partIndex: c.partIndex, sha256: c.live ? c.sha256 : null })),
  }
}

function ChapterShelf({ book, missing }: { book: Work; missing: number[] }) {
  if (book.chapters.length === 0 && missing.length === 0) {
    return <p className="mt-3 text-xs text-muted-foreground">This book has no chapters yet.</p>
  }
  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-foreground mb-1">Chapters in this book</p>
      <ul className="flex flex-wrap gap-1.5">
        {book.chapters.map((c) => (
          <li
            key={c.partIndex}
            title={c.live ? `${c.live.chunks ?? '?'} passages live` : (c.run?.error ?? 'Stored, but not live')}
            className={`rounded-full px-2.5 py-1 text-xs border ${c.live ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200' : 'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200'}`}
          >
            {c.partIndex}
            {c.live ? '' : ' (not live)'}
          </li>
        ))}
        {missing.map((n) => (
          <li key={`m${n}`} className="rounded-full px-2.5 py-1 text-xs border border-dashed border-border text-muted-foreground">
            {n} (missing)
          </li>
        ))}
      </ul>
    </div>
  )
}

function Badge({ item }: { item: { blocked: boolean; action: 'add' | 'replace' | 'unchanged' | null } }) {
  if (item.blocked) return <span className="rounded-full px-2.5 py-1 text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200">Blocked</span>
  const map = {
    add: ['Add', 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'],
    replace: ['Replace', 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200'],
    unchanged: ['Unchanged', 'bg-muted text-muted-foreground'],
  } as const
  const [text, cls] = item.action ? map[item.action] : ['', '']
  return text ? <span className={`rounded-full px-2.5 py-1 text-xs ${cls}`}>{text}</span> : null
}

function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  switch (outcome.status) {
    case 'uploading':
      return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Indexing</span>
    case 'done':
      return <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300"><CheckCircle className="h-4 w-4" aria-hidden /> Indexed{outcome.chunks ? ` · ${outcome.chunks} passages` : ''}</span>
    case 'unchanged':
      return <span className="text-xs text-muted-foreground">Unchanged, skipped</span>
    case 'failed':
      return <span className="inline-flex items-center gap-1 text-xs text-red-700 dark:text-red-300"><XCircle className="h-4 w-4" aria-hidden /> Failed</span>
    case 'not-attempted':
      return <span className="text-xs text-muted-foreground">Not attempted</span>
    default:
      return <span className="text-xs text-muted-foreground">Waiting</span>
  }
}

function Notes({ notes }: { notes: string[] }) {
  const [open, setOpen] = useState(false)
  if (notes.length === 0) return null
  const shown = open ? notes : notes.slice(0, 2)
  return (
    <div className="mt-2 space-y-1">
      {shown.map((n, i) => (
        <p key={i} className="flex gap-2 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden /> <span>{n}</span>
        </p>
      ))}
      {notes.length > 2 && (
        <button type="button" onClick={() => setOpen(!open)} className="text-xs underline text-muted-foreground">
          {open ? 'Show fewer' : `Show ${notes.length - 2} more`}
        </button>
      )}
    </div>
  )
}
