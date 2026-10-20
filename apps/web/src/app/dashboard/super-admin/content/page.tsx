'use client'

import React, { useState, useRef } from 'react'
import {
  Upload,
  FileText,
  BookOpen,
  Zap,
  Brain,
  CheckCircle,
  AlertTriangle,
  Clock,
  BarChart3,
  Sparkles,
  Database,
  Target,
  Activity,
  FolderOpen
} from 'lucide-react'
import useSWR, { mutate } from 'swr'
import UploadProgressModal from '@/components/admin/UploadProgressModal'
import ContentOverview from '@/components/admin/ContentOverview'
import DocumentManagement from '@/components/admin/DocumentManagement'
import {
  getDomains,
  getCourses,
  getLevels,
  getSubjects,
  getBooks,
  labelForDomain,
  labelForCourse,
  labelForLevel,
  MEDIUMS,
} from '@/config/content-taxonomy'
// Pure TypeScript with no imports, so the browser reads a chapter with the very
// code the server will ingest it with — the pre-flight below cannot disagree.
import {
  parseEnrichedMarkdown,
  checkHierarchyAgainstFrontmatter,
  classNumber,
  type BookHierarchy,
  type EnrichedBookMeta,
} from '@/lib/content/markdown-ingest-parser'

function HealthWidget() {
  const fetcher = (url: string) => fetch(url).then(r => r.json())
  const { data, error, isLoading } = useSWR('/api/super-admin/engine/health', fetcher, { refreshInterval: 15000 })

  return (
    <div className="mb-8">
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-4 shadow border border-white/20">
        <div className="flex items-center gap-3 mb-2">
          <Activity className="h-5 w-5 text-green-600" />
          <h3 className="font-semibold">Engine Health</h3>
        </div>
        {isLoading && <p className="text-sm text-muted-foreground">Checking...</p>}
        {error && <p className="text-sm text-red-600">Health check failed</p>}
        {data?.health && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
              <div className="font-medium">Python</div>
              <div className="text-muted-foreground">{data.health.python?.version || 'Unknown'}</div>
              <div className={data.health.python?.engine_import_ok ? 'text-green-600' : 'text-red-600'}>
                Engine import: {data.health.python?.engine_import_ok ? 'OK' : 'Fail'}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-primary/10">
              <div className="font-medium">Config</div>
              <div className="text-muted-foreground truncate">{data.health.config?.path || 'Unknown'}</div>
              <div className={data.health.config?.exists ? 'text-green-600' : 'text-red-600'}>
                Exists: {data.health.config?.exists ? 'Yes' : 'No'}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-primary/10 dark:bg-primary/15">
              <div className="font-medium">Qdrant</div>
              <div className="text-muted-foreground truncate">{data.health.qdrant?.url || 'Unknown'}</div>
              <div className={data.health.qdrant?.ok ? 'text-green-600' : 'text-red-600'}>
                Status: {data.health.qdrant?.ok ? 'OK' : 'Fail'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Temporarily comment out ContentOverview to isolate the issue
// import ContentOverview from '@/components/admin/ContentOverview'

/** One chapter file, read in the browser before anything is uploaded. */
interface MdPreflight {
  file: File
  meta: EnrichedBookMeta
  errors: string[]
  warnings: string[]
  chunkCount: number
  pages: string
}

const looseKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

type TaxonomyPick = { domain: string; course: string; level: string; subject: string; book: string }

/**
 * Fill the level / subject / book the file itself points at, without guessing.
 *
 * Domain and course are never inferred: the frontmatter's `board: NCERT` is a
 * publisher, not the examining body the taxonomy's course means. Once those are
 * chosen the class and the book follow from the file — but only a UNIQUE match
 * is taken, and only into fields still empty, so it never overrides a choice.
 */
function suggestTaxonomy(form: TaxonomyPick, meta?: EnrichedBookMeta): Partial<TaxonomyPick> {
  if (!meta || !form.domain || !form.course) return {}
  const next: Partial<TaxonomyPick> = {}

  let levelId = form.level
  if (!levelId) {
    const cls = classNumber(meta.class_level)
    const hit = cls ? getLevels(form.domain, form.course).find((l) => classNumber(l.label) === cls) : undefined
    if (hit) { levelId = hit.id; next.level = hit.id }
  }

  if (levelId && !form.book) {
    const want = [meta.subject, meta.book_title].map(looseKey).filter(Boolean)
    const hits: Array<{ subject: string; book: string }> = []
    for (const subject of getSubjects(form.domain, form.course, levelId)) {
      if (form.subject && form.subject !== subject) continue
      for (const book of getBooks(form.domain, form.course, levelId, subject)) {
        const b = looseKey(book)
        if (want.some((w) => b === w || b.includes(w))) hits.push({ subject, book })
      }
    }
    if (hits.length === 1) { next.subject = hits[0].subject; next.book = hits[0].book }
  }
  return next
}

interface UploadResult {
  success: boolean
  message?: string
  /** The refusal reason. Routes that refuse early send this and no `message`. */
  error?: string
  warnings?: string[]
  skipped?: string[]
  parts?: Array<{
    partIndex: number
    filename: string
    outcome: 'succeeded' | 'skipped-as-duplicate' | 'failed'
    detail?: string
    chunks: number
    points: number
    pages?: string
  }>
  work?: {
    title: string
    isbn: string
    edition: string | null
    hierarchy: BookHierarchy | null
  }
  stats?: {
    totalPages: number
    totalChunks: number
    totalWords: number
    uploadedChunks: number
    processingTime: number
  }
  extractionMethod?: string
  errors?: string[]
  additionalStats?: {
    tablesFound?: number
    equationsFound?: number
    figuresFound?: number
  }
  // PHASE 3: Validation statistics
  validationStats?: {
    validCount: number
    invalidCount: number
    validationRate: number
    invalidChunks?: Array<{ chunkId: string; error: string }>
  }
  strategy?: string
}

export default function UploadPage() {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [currentStep, setCurrentStep] = useState('')
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null)
  const lastFormRef = useRef<FormData | null>(null)
  const [activeTab, setActiveTab] = useState<'upload' | 'overview' | 'manage'>('upload')
  const [ingestMode, setIngestMode] = useState<'pdf' | 'markdown'>('pdf')
  const [mdSkipped, setMdSkipped] = useState<string[]>([])
  const [mdFiles, setMdFiles] = useState<MdPreflight[]>([])
  const [forceIndex, setForceIndex] = useState(false)
  const [forceReason, setForceReason] = useState('')
  // Cascading hierarchy: domain → course → level → subject → book → medium → title.
  // domain/course/level hold taxonomy IDs; subject/book/medium hold display values.
  const [formData, setFormData] = useState({
    file: null as File | null,
    domain: '',
    course: '',
    level: '',
    subject: '',
    book: '',
    medium: '',
    bookTitle: ''
  })

  // ── Curated-markdown lane ──────────────────────────────────────────────────
  // The first file that parses, else the first file: what the book's details are
  // read from. Every chapter of one book carries the same book-level frontmatter.
  const mdPrimaryMeta = (mdFiles.find((f) => f.errors.length === 0) ?? mdFiles[0])?.meta

  // The same hierarchy the PDF form collects, resolved to the labels the PDF lane
  // stores. Null until every field is chosen.
  const mdHierarchy: BookHierarchy | null =
    formData.domain && formData.course && formData.level && formData.subject &&
    formData.book && formData.medium && formData.bookTitle.trim()
      ? {
          domain: labelForDomain(formData.domain),
          course: labelForCourse(formData.domain, formData.course),
          level: labelForLevel(formData.domain, formData.course, formData.level),
          subjectGroup: formData.subject,
          book: formData.book,
          medium: formData.medium,
          bookTitle: formData.bookTitle.trim(),
        }
      : null

  // What the selection says against what each file says about itself.
  const mdChecks = mdFiles.map((f) =>
    mdHierarchy ? checkHierarchyAgainstFrontmatter(f.meta, mdHierarchy) : { errors: [] as string[], warnings: [] as string[] },
  )
  const mdUnapproved = mdFiles.filter((f) => f.meta.validation_status !== 'APPROVED')
  const mdChapterNos = mdFiles.map((f) => f.meta.chapter_number).filter(Boolean)
  const mdDuplicateChapters = [...new Set(mdChapterNos.filter((n, i) => mdChapterNos.indexOf(n) !== i))]
  const mdIsbns = [...new Set(mdFiles.map((f) => f.meta.isbn).filter(Boolean))]

  // Anything here stops the upload. The server refuses the same things; saying so
  // up front means the operator is never left reading a blank "Upload Failed".
  const mdBlockers: string[] = [
    ...mdFiles.flatMap((f) => f.errors.map((e) => `${f.file.name}: ${e}`)),
    ...mdFiles.flatMap((f, i) => mdChecks[i].errors.map((e) => `${f.file.name}: ${e}`)),
    ...(mdDuplicateChapters.length ? [`Chapter ${mdDuplicateChapters.join(', ')} is selected more than once.`] : []),
    ...(mdIsbns.length > 1 ? [`The selected files carry different ISBNs (${mdIsbns.join(', ')}), so they are not chapters of one book.`] : []),
    ...(mdUnapproved.length && !forceIndex
      ? [`${mdUnapproved.length} of ${mdFiles.length} file(s) are not APPROVED. Approve them in the file, or tick the override below.`]
      : []),
    ...(mdUnapproved.length && forceIndex && !forceReason.trim()
      ? ['Give a reason for indexing files that are not APPROVED.']
      : []),
  ]

  const handleMarkdownFiles = async (files: File[]) => {
    setResult(null)
    setMdSkipped([])
    const checked: MdPreflight[] = await Promise.all(
      files.map(async (file): Promise<MdPreflight> => {
        try {
          const { meta, chunks, errors, warnings } = parseEnrichedMarkdown(await file.text())
          const pageNos = chunks.map((c) => c.metadata.page as number)
          return {
            file, meta, errors, warnings,
            chunkCount: chunks.length,
            pages: pageNos.length ? `${Math.min(...pageNos)}-${Math.max(...pageNos)}` : '',
          }
        } catch (err) {
          return {
            file,
            meta: { validation_status: 'UNKNOWN' } as EnrichedBookMeta,
            errors: [`Could not read this file: ${err instanceof Error ? err.message : String(err)}`],
            warnings: [],
            chunkCount: 0,
            pages: '',
          }
        }
      }),
    )
    setMdFiles(checked)

    // Offer what the file says; never overwrite what the operator has already chosen.
    const meta = (checked.find((c) => c.errors.length === 0) ?? checked[0])?.meta
    if (!meta) return
    const medium = MEDIUMS.find((m) => m.toLowerCase() === (meta.medium || '').toLowerCase())
    setFormData((prev) => ({
      ...prev,
      bookTitle: prev.bookTitle || meta.book_title || '',
      medium: prev.medium || medium || '',
      ...suggestTaxonomy(prev, meta),
    }))
  }

  const handleMarkdownSubmit = async () => {
    if (mdFiles.length === 0) {
      alert('Please choose one or more enriched Markdown (.md) chapter files')
      return
    }
    if (!mdHierarchy) {
      alert('Please complete every step: domain, course, level, subject, book, medium and title.')
      return
    }
    if (mdBlockers.length > 0) return

    setIsUploading(true)
    setUploadProgress(10)
    setResult(null)
    setMdSkipped([])
    setCurrentStep('Parsing enriched markdown...')
    setShowProgressModal(true)

    try {
      const uploadId = Math.random().toString(36).slice(2)
      setActiveUploadId(uploadId)

      const body = new FormData()
      for (const f of mdFiles) body.append('file', f.file)
      body.append('uploadId', uploadId)
      // Same fields, same labels as the PDF lane sends.
      body.append('domain', mdHierarchy.domain)
      body.append('course', mdHierarchy.course)
      body.append('level', mdHierarchy.level)
      body.append('subject', mdHierarchy.subjectGroup)
      body.append('book', mdHierarchy.book)
      body.append('medium', mdHierarchy.medium)
      body.append('bookTitle', mdHierarchy.bookTitle)
      if (mdUnapproved.length > 0 && forceIndex) {
        body.append('force', 'true')
        body.append('forceReason', forceReason.trim())
      }

      setUploadProgress(50)
      setCurrentStep('Embedding + indexing to Qdrant...')

      const response = await fetch('/api/super-admin/content/ingest-markdown', {
        method: 'POST',
        body,
        headers: { 'X-Upload-Id': uploadId },
      })
      const json = await response.json().catch(() => ({
        success: false,
        error: `The server answered HTTP ${response.status} with no readable body.`,
      }))

      setUploadProgress(100)
      setCurrentStep(json.success ? 'Indexed successfully!' : 'Failed')
      setResult(json)
      setMdSkipped(Array.isArray(json.skipped) ? json.skipped : [])
      if (!response.ok || !json.success) console.warn('Markdown ingest returned error:', json)

      // Chapters are now in the library: refresh the Overview and Manage tabs, as
      // the PDF path does.
      if (json.totals?.succeeded > 0 || json.success) {
        mutate('/api/super-admin/qdrant/books')
        mutate('/api/super-admin/qdrant/stats')
      }
    } catch (err) {
      setResult({ success: false, error: err instanceof Error ? err.message : 'Ingest failed' })
    } finally {
      setIsUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (ingestMode === 'markdown') {
      await handleMarkdownSubmit()
      return
    }

    if (!formData.file || !formData.domain || !formData.course || !formData.level || !formData.subject || !formData.book || !formData.medium || !formData.bookTitle) {
      alert('Please complete every step: domain, course, level, subject, book, medium, title and file.')
      return
    }

    setIsUploading(true)
    setUploadProgress(0)
    setResult(null)

    try {
      // Resolve taxonomy IDs to human-readable labels for storage/retrieval.
      const domainLabel = labelForDomain(formData.domain)
      const courseLabel = labelForCourse(formData.domain, formData.course)
      const levelLabel = labelForLevel(formData.domain, formData.course, formData.level)

      const uploadFormData = new FormData()
      uploadFormData.append('file', formData.file)
      uploadFormData.append('domain', domainLabel)
      uploadFormData.append('course', courseLabel)
      uploadFormData.append('level', levelLabel)
      uploadFormData.append('subject', formData.subject)
      uploadFormData.append('book', formData.book)
      uploadFormData.append('bookTitle', formData.bookTitle)

      // Generate uploadId and wire up SSE progress
      const uploadId = Math.random().toString(36).slice(2)
      console.log(`🆔 Frontend: Generated uploadId: ${uploadId}`);
      uploadFormData.append('uploadId', uploadId)
      let currentPage = 0
      let totalPages = 0
      let progressSource: EventSource | null = null
      try {
        console.log(`🔌 Frontend: Establishing SSE connection for ${uploadId}`);
        const sseUrl = `/api/super-admin/content/progress/${uploadId}`;
        console.log(`📡 Frontend: SSE URL: ${sseUrl}`);

        progressSource = new EventSource(sseUrl)
        console.log(`🔗 Frontend: EventSource created, readyState: ${progressSource.readyState}`);

        progressSource.addEventListener('ready', (evt: MessageEvent) => {
          console.log(`✅ Frontend: SSE ready event received for ${uploadId}:`, evt.data);
        })

        progressSource.addEventListener('progress', (evt: MessageEvent) => {
          console.log(`📊 Frontend: Progress event received:`, evt.data);
          try {
            const data = JSON.parse((evt as any).data)
            currentPage = data.current || currentPage
            totalPages = data.total || totalPages
            console.log(`📈 Frontend: Progress updated to ${currentPage}/${totalPages}`);
            if (totalPages > 0) {
              const percent = Math.max(20, Math.min(99, Math.floor((currentPage / totalPages) * 100)))
              setUploadProgress(percent)
              setCurrentStep(`Processing page ${currentPage} of ${totalPages}...`)
            }
          } catch (error) {
            console.error(`❌ Frontend: Failed to parse progress data:`, error);
          }
        })
        progressSource.addEventListener('end', () => {
          console.log(`🏁 Frontend: End event received for ${uploadId}`);
          setCurrentStep('Finalizing...')
        })
        progressSource.addEventListener('error', (error) => {
          console.error(`❌ Frontend: SSE error for ${uploadId}:`, error);
          console.error(`❌ Frontend: SSE readyState: ${progressSource?.readyState}`);
          console.error(`❌ Frontend: SSE url: ${progressSource?.url}`);
          setCurrentStep('Processing PDF with intelligent extraction...')
        })

        progressSource.addEventListener('open', () => {
          console.log(`🔓 Frontend: SSE connection opened for ${uploadId}`);
        })

        // Add onopen handler as well
        progressSource.onopen = () => {
          console.log(`🔓 Frontend: SSE onopen fired for ${uploadId}`);
        }

        progressSource.onerror = (error) => {
          console.error(`❌ Frontend: SSE onerror fired for ${uploadId}:`, error);
          console.error(`❌ Frontend: SSE readyState in onerror: ${progressSource?.readyState}`);
        }

        // Wait for SSE connection to be ready
        await new Promise((resolve) => {
          const checkReady = () => {
            if (progressSource?.readyState === EventSource.OPEN) {
              console.log(`✅ Frontend: SSE connection is ready`);
              resolve(undefined);
            } else {
              console.log(`⏳ Frontend: Waiting for SSE connection... State: ${progressSource?.readyState}`);
              setTimeout(checkReady, 100);
            }
          };
          // Start checking after a brief delay
          setTimeout(checkReady, 100);
          // Timeout after 5 seconds
          setTimeout(() => {
            console.log(`⚠️ Frontend: SSE connection timeout, proceeding anyway`);
            resolve(undefined);
          }, 5000);
        });
      } catch (error) {
        console.error(`❌ Frontend: Failed to establish SSE connection:`, error);
      }

      // Open modal and store form for retry
      setActiveUploadId(uploadId)
      setShowProgressModal(true)

      uploadFormData.append('medium', formData.medium)
      lastFormRef.current = uploadFormData

      setCurrentStep('Uploading file...')
      setUploadProgress(25)

      const controller = new AbortController()
      const threeHoursMs = 3 * 60 * 60 * 1000
      const timeoutId = setTimeout(() => controller.abort(), threeHoursMs)
      const response = await fetch('/api/super-admin/content/upload', {
        method: 'POST',
        body: uploadFormData,
        signal: controller.signal,
        headers: { 'X-Upload-Id': uploadId }
      })
      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`)
      }

      setCurrentStep('Processing content...')
      setUploadProgress(75)

      setCurrentStep('Uploading to knowledge base...')

      const result = await response.json()

      setUploadProgress(100)
      setCurrentStep('Upload completed!')

      setResult(result)

      // Trigger refresh on both Manage Documents and Content Overview tabs
      if (result.success) {
        console.log('✅ Upload successful, triggering SWR refresh for both tabs...')
        // Refresh the books list and stats in both tabs
        mutate('/api/super-admin/qdrant/books')
        mutate('/api/super-admin/qdrant/stats')
        console.log('🔄 SWR mutate triggered for /api/super-admin/qdrant/books and /api/super-admin/qdrant/stats')
      }

      // Close SSE stream after completion
      try { progressSource?.close() } catch {}

    } catch (error) {
      setResult({
        success: false,
        message: 'Upload failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
        errors: [error instanceof Error ? error.message : 'Unknown error']
      })
    } finally {
      setIsUploading(false)
    }
  }

  const getExtractionMethodDescription = (method?: string) => {
    switch (method) {
      case 'digital': return '📄 High-quality digital text extraction'
      case 'ocr': return '🧠 Optical Character Recognition (OCR) used'
      case 'hybrid': return '⚡ Combined digital and OCR extraction'
      case 'doc-extract-engine': return '🚀 Advanced doc-extract-engine processing with structure analysis'
      case 'doc-extract-engine + Qdrant': return '🚀 doc-extract-engine processing with Qdrant vector indexing'
      default: return '❓ Unknown extraction method'
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-8">
        {/* Enhanced Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-orange-500/10 to-primary/10 backdrop-blur-sm border border-orange-200/30 rounded-2xl px-6 py-3 mb-6">
            <BookOpen className="h-5 w-5 text-orange-500" />
            <span className="text-sm font-medium bg-gradient-to-r from-orange-600 to-primary/80 bg-clip-text text-transparent">
              Content Management System
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-orange-600 to-primary/80 bg-clip-text text-transparent flex items-center justify-center gap-4">
              <Database className="h-12 w-12 text-orange-500" />
              Intelligent PDF Upload
            </span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Upload CBSE textbooks with advanced PDF processing and intelligent text extraction powered by AI
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-2 shadow-xl border border-white/20">
            <div className="flex space-x-2">
              <button
                onClick={() => setActiveTab('upload')}
                className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 flex items-center space-x-2 ${
                  activeTab === 'upload'
                    ? 'bg-gradient-to-r from-orange-500 to-primary/80 text-white shadow-lg'
                    : 'text-muted-foreground hover:text-orange-500 hover:bg-orange-50'
                }`}
              >
                <Upload className="h-4 w-4" />
                <span>Upload Content</span>
              </button>
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 flex items-center space-x-2 ${
                  activeTab === 'overview'
                    ? 'bg-gradient-to-r from-orange-500 to-primary/80 text-white shadow-lg'
                    : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
                }`}
              >
                <Database className="h-4 w-4" />
                <span>Content Overview</span>
              </button>
              <button
                onClick={() => setActiveTab('manage')}
                className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 flex items-center space-x-2 ${
                  activeTab === 'manage'
                    ? 'bg-gradient-to-r from-orange-500 to-primary/80 text-white shadow-lg'
                    : 'text-muted-foreground hover:text-green-500 hover:bg-green-50'
                }`}
              >
                <FolderOpen className="h-4 w-4" />
                <span>Manage Documents</span>
              </button>
            </div>
          </div>
        </div>


        {/* Engine Health Widget */}
        <HealthWidget />

        {/* Tab Content */}
        {activeTab === 'upload' && (
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Enhanced Upload Form */}
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20 hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02]">
            <div className="mb-8">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <Upload className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-primary/80 bg-clip-text text-transparent">
                    Upload Textbook
                  </h2>
                  <p className="text-muted-foreground">
                    {ingestMode === 'pdf'
                      ? 'Select a PDF file and provide metadata for intelligent processing'
                      : "Choose the book's enriched Markdown chapters and confirm where the book belongs"}
                  </p>
                </div>
              </div>
            </div>

            {/* Ingestion mode toggle — super-admin chooses the lane */}
            <div className="mb-6">
              <div className="inline-flex rounded-xl border border-border bg-background/40 p-1">
                {([
                  { key: 'pdf', label: 'PDF · Extract-Kit (auto)' },
                  { key: 'markdown', label: 'Enriched Markdown (curated)' },
                ] as const).map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setIngestMode(key)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                      ingestMode === key
                        ? 'bg-gradient-to-r from-orange-500 to-primary/80 text-white shadow'
                        : 'text-muted-foreground hover:text-foreground dark:hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {ingestMode === 'pdf'
                  ? 'Automated OCR + layout + metadata extraction. Use for bulk / un-curated PDFs.'
                  : 'Human-validated markdown (from a chapter skill). Skips OCR. You say where the book belongs — the same fields as a PDF — and each chapter’s number, title and printed page numbers are read from its frontmatter for exact citations.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {(() => {
                const selectCls = "w-full px-4 py-3 bg-muted/40 border border-border rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                const labelCls = "block text-sm font-medium text-foreground mb-2"

                const courses = formData.domain ? getCourses(formData.domain) : []
                const levels = formData.domain && formData.course ? getLevels(formData.domain, formData.course) : []
                const subjects = formData.domain && formData.course && formData.level ? getSubjects(formData.domain, formData.course, formData.level) : []
                const rawBooks = formData.subject ? getBooks(formData.domain, formData.course, formData.level, formData.subject) : []
                const books = rawBooks.length ? rawBooks : (formData.subject ? [formData.subject] : [])

                return (
                  <>
                    {/* 1 + 2 — Domain & Course */}
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className={labelCls}><span className="flex items-center gap-2">🎯 Domain<span className="text-red-500">*</span></span></label>
                        <select
                          value={formData.domain}
                          onChange={(e) => setFormData({ ...formData, domain: e.target.value, course: '', level: '', subject: '', book: '' })}
                          className={selectCls}
                          required
                        >
                          <option value="">Select Domain</option>
                          {getDomains().map((d) => (<option key={d.id} value={d.id}>{d.label}</option>))}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}><span className="flex items-center gap-2">📚 Course<span className="text-red-500">*</span></span></label>
                        <select
                          value={formData.course}
                          onChange={(e) => {
                            const next = { ...formData, course: e.target.value, level: '', subject: '', book: '' }
                            setFormData({ ...next, ...(ingestMode === 'markdown' ? suggestTaxonomy(next, mdPrimaryMeta) : {}) })
                          }}
                          className={selectCls}
                          disabled={!formData.domain}
                          required
                        >
                          <option value="">{formData.domain ? 'Select Course' : 'Select a domain first'}</option>
                          {courses.map((c) => (<option key={c.id} value={c.id}>{c.label}</option>))}
                        </select>
                      </div>
                    </div>

                    {/* 3 + 4 — Level & Subject */}
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className={labelCls}><span className="flex items-center gap-2">🎓 Level<span className="text-red-500">*</span></span></label>
                        <select
                          value={formData.level}
                          onChange={(e) => {
                            const next = { ...formData, level: e.target.value, subject: '', book: '' }
                            setFormData({ ...next, ...(ingestMode === 'markdown' ? suggestTaxonomy(next, mdPrimaryMeta) : {}) })
                          }}
                          className={selectCls}
                          disabled={!formData.course}
                          required
                        >
                          <option value="">{formData.course ? 'Select Level' : 'Select a course first'}</option>
                          {levels.map((l) => (<option key={l.id} value={l.id}>{l.label}</option>))}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}><span className="flex items-center gap-2">🧭 Subject<span className="text-red-500">*</span></span></label>
                        <select
                          value={formData.subject}
                          onChange={(e) => setFormData({ ...formData, subject: e.target.value, book: '' })}
                          className={selectCls}
                          disabled={!formData.level}
                          required
                        >
                          <option value="">{formData.level ? 'Select Subject' : 'Select a level first'}</option>
                          {subjects.map((s) => (<option key={s} value={s}>{s}</option>))}
                        </select>
                      </div>
                    </div>

                    {/* 5 + 6 — Book & Medium */}
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className={labelCls}><span className="flex items-center gap-2">📖 Book<span className="text-red-500">*</span></span></label>
                        <select
                          value={formData.book}
                          onChange={(e) => setFormData({ ...formData, book: e.target.value })}
                          className={selectCls}
                          disabled={!formData.subject}
                          required
                        >
                          <option value="">{formData.subject ? 'Select Book' : 'Select a subject first'}</option>
                          {books.map((b) => (<option key={b} value={b}>{b}</option>))}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}><span className="flex items-center gap-2">🌐 Medium<span className="text-red-500">*</span></span></label>
                        <select
                          value={formData.medium}
                          onChange={(e) => setFormData({ ...formData, medium: e.target.value })}
                          className={selectCls}
                          required
                        >
                          <option value="">Select Medium</option>
                          {MEDIUMS.map((m) => (<option key={m} value={m}>{m}</option>))}
                        </select>
                      </div>
                    </div>

                    {/* 7 — Book Title */}
                    <div>
                      <label className={labelCls}>Book Title</label>
                      <input
                        type="text"
                        value={formData.bookTitle}
                        onChange={(e) => setFormData({ ...formData, bookTitle: e.target.value })}
                        placeholder="e.g., NCERT Economics Textbook (full title as printed)"
                        className="w-full px-4 py-3 bg-muted/40 border border-border rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-300"
                        required
                      />
                    </div>
                  </>
                )
              })()}

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {ingestMode === 'pdf' ? 'PDF File' : 'Enriched Markdown Chapter Files (.md)'}
                </label>
                {ingestMode === 'markdown' && (
                  <p className="mb-2 text-xs text-muted-foreground">
                    Select one or more chapters of the same book. Chapter number, title and printed page range are
                    read from each file&apos;s
                    <code className="mx-1 px-1 rounded bg-muted">BOOK_METADATA</code>
                    frontmatter. Only <strong>APPROVED</strong> files are indexed.
                  </p>
                )}
                <div className="relative">
                  <input
                    key={ingestMode}
                    type="file"
                    multiple={ingestMode === 'markdown'}
                    accept={ingestMode === 'pdf' ? '.pdf' : '.md,text/markdown'}
                    onChange={(e) => {
                      const picked = Array.from(e.target.files ?? [])
                      if (ingestMode === 'markdown') {
                        void handleMarkdownFiles(picked)
                      } else {
                        setFormData({ ...formData, file: picked[0] || null })
                      }
                    }}
                    className="w-full px-4 py-3 bg-muted/40 border border-border rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
                    required
                  />
                </div>

                {/* What the files say about themselves, read in the browser before upload */}
                {ingestMode === 'markdown' && mdFiles.length > 0 && (
                  <div className="mt-3 rounded-xl border border-border bg-muted/30 p-4 text-xs space-y-3">
                    <p className="font-semibold text-foreground">Read from the file{mdFiles.length > 1 ? 's' : ''}</p>
                    {mdPrimaryMeta && (
                      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                        {([
                          ['Book', mdPrimaryMeta.book_title],
                          ['ISBN', mdPrimaryMeta.isbn],
                          ['Edition', mdPrimaryMeta.edition],
                          ['Publisher', mdPrimaryMeta.publisher],
                          ['Class · subject', [mdPrimaryMeta.class_level && `Class ${mdPrimaryMeta.class_level}`, mdPrimaryMeta.subject].filter(Boolean).join(' · ')],
                        ] as const).map(([k, v]) => (
                          <React.Fragment key={k}>
                            <dt className="text-muted-foreground">{k}</dt>
                            <dd className="text-foreground">{v || <span className="text-amber-600">not in the file</span>}</dd>
                          </React.Fragment>
                        ))}
                      </dl>
                    )}
                    <ul className="space-y-2">
                      {mdFiles.map((f, i) => (
                        <li key={f.file.name + i} className="rounded-lg border border-border bg-background/60 p-2">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-medium text-foreground">
                              {f.meta.chapter_number ? `Ch ${f.meta.chapter_number}` : 'Chapter ?'}
                              {f.meta.chapter_title ? ` · ${f.meta.chapter_title}` : ''}
                            </span>
                            <span className="text-muted-foreground">
                              {f.pages ? `pp ${f.pages} · ` : ''}{f.chunkCount} chunks
                            </span>
                            <span className={`ml-auto rounded px-1.5 py-0.5 font-semibold ${
                              f.meta.validation_status === 'APPROVED'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                            }`}>
                              {f.meta.validation_status || 'NO STATUS'}
                            </span>
                          </div>
                          <div className="text-muted-foreground truncate">{f.file.name}</div>
                          {f.errors.map((e, j) => (
                            <p key={`e${j}`} className="mt-1 text-red-600 dark:text-red-400">✗ {e}</p>
                          ))}
                          {[...f.warnings, ...(mdChecks[i]?.warnings ?? [])].slice(0, 3).map((w, j) => (
                            <p key={`w${j}`} className="mt-1 text-amber-700 dark:text-amber-300">⚠ {w}</p>
                          ))}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Override for chapters a human has not yet marked APPROVED */}
                {ingestMode === 'markdown' && mdUnapproved.length > 0 && (
                  <div className="mt-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-xs space-y-2">
                    <label className="flex items-start gap-2 font-medium text-amber-800 dark:text-amber-200">
                      <input
                        type="checkbox"
                        checked={forceIndex}
                        onChange={(e) => setForceIndex(e.target.checked)}
                        className="mt-0.5"
                      />
                      <span>
                        Index {mdUnapproved.length} file(s) that are not APPROVED anyway.
                        <span className="block font-normal text-amber-700 dark:text-amber-300">
                          A person is meant to confirm each transcription against the printed page before it becomes
                          citable. This records the override and your reason against the ingest run, and also re-embeds
                          any chapter that is already indexed unchanged.
                        </span>
                      </span>
                    </label>
                    {forceIndex && (
                      <input
                        type="text"
                        value={forceReason}
                        onChange={(e) => setForceReason(e.target.value)}
                        placeholder="Reason, e.g. checked against the printed book by …"
                        className="w-full px-3 py-2 bg-background border border-amber-300 dark:border-amber-700 rounded-lg"
                      />
                    )}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isUploading || (ingestMode === 'markdown' && mdBlockers.length > 0)}
                className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
              >
                {isUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5" />
                    <span>{ingestMode === 'pdf' ? 'Upload & Process' : 'Ingest Curated Markdown'}</span>
                  </>
                )}
              </button>

              {/* Why the button is disabled — never a silent grey-out */}
              {ingestMode === 'markdown' && mdBlockers.length > 0 && (
                <ul className="mt-3 list-disc pl-5 space-y-1 text-xs text-red-600 dark:text-red-400">
                  {mdBlockers.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              )}

              {/* Curated-lane audit trail: what was skipped / flagged */}
              {ingestMode === 'markdown' && mdSkipped.length > 0 && (
                <div className="mt-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-300 mb-2">
                    Reviewer audit — {mdSkipped.length} item(s) skipped or flagged
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-xs text-amber-800 dark:text-amber-200 max-h-40 overflow-y-auto">
                    {mdSkipped.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
            </form>

            {/* Advanced Progress Modal */}
            <UploadProgressModal
              open={showProgressModal}
              uploadId={activeUploadId || ''}
              onClose={() => setShowProgressModal(false)}
              onCancel={async () => {
                if (!activeUploadId) return
                await fetch('/api/super-admin/content/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uploadId: activeUploadId }) })
                setShowProgressModal(false)
              }}
              onRetry={async () => {
                // retry using last form data
                if (!lastFormRef.current) return
                setShowProgressModal(true)
                // let existing handleSubmit flow manage the actual re-submit
              }}
            />

            {/* Progress Bar */}
            {isUploading && (
              <div className="mt-6 space-y-3">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{currentStep}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-orange-500 to-red-500 h-3 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>

          {/* Results Panel */}
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-r from-primary to-primary/80 rounded-2xl flex items-center justify-center shadow-lg">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                  Upload Results
                </h2>
                <p className="text-muted-foreground">
                  Processing status and statistics
                </p>
              </div>
            </div>

            {result ? (
              <div className="space-y-6">
                {/* Status */}
                <div className={`p-4 rounded-xl border-2 ${
                  result.success
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                }`}>
                  <div className="flex items-center space-x-3">
                    {result.success ? (
                      <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                    ) : (
                      <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                    )}
                    <div>
                      <h3 className={`font-semibold ${
                        result.success
                          ? 'text-green-800 dark:text-green-200'
                          : 'text-red-800 dark:text-red-200'
                      }`}>
                        {result.success ? 'Upload Successful!' : 'Upload Failed'}
                      </h3>
                      <p className={`text-sm ${
                        result.success
                          ? 'text-green-700 dark:text-green-300'
                          : 'text-red-700 dark:text-red-300'
                      }`}>
                        {result.message || result.error}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Where the book was filed — the same hierarchy the PDF lane stores */}
                {result.work?.hierarchy && (
                  <div className="p-4 rounded-xl border border-border bg-muted/30 text-sm">
                    <h4 className="font-semibold text-foreground mb-1">Filed under</h4>
                    <p className="text-muted-foreground">
                      {[
                        result.work.hierarchy.domain,
                        result.work.hierarchy.course,
                        result.work.hierarchy.level,
                        result.work.hierarchy.subjectGroup,
                        result.work.hierarchy.book,
                      ].join(' › ')}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {result.work.title}
                      {result.work.isbn ? ` · ISBN ${result.work.isbn}` : ''}
                      {result.work.edition ? ` · ${result.work.edition}` : ''}
                    </p>
                  </div>
                )}

                {/* Per-chapter outcome */}
                {result.parts && result.parts.length > 0 && (
                  <div className="p-4 rounded-xl border border-border bg-muted/30">
                    <h4 className="font-semibold text-foreground mb-2">Chapters</h4>
                    <ul className="space-y-1 text-sm">
                      {result.parts.map((p) => (
                        <li key={p.partIndex} className="flex flex-wrap items-baseline gap-x-2">
                          <span className="font-medium text-foreground">Ch {p.partIndex}</span>
                          <span className={
                            p.outcome === 'failed'
                              ? 'text-red-600 dark:text-red-400'
                              : p.outcome === 'skipped-as-duplicate'
                              ? 'text-amber-700 dark:text-amber-300'
                              : 'text-green-700 dark:text-green-300'
                          }>
                            {p.outcome === 'succeeded' ? `indexed · ${p.chunks} chunks` : p.outcome === 'skipped-as-duplicate' ? 'unchanged · skipped' : 'failed'}
                          </span>
                          {p.pages && <span className="text-xs text-muted-foreground">pp {p.pages}</span>}
                          {p.detail && <span className="w-full text-xs text-muted-foreground">{p.detail}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Things the parser guessed or flagged — a moved boundary is a moved citation */}
                {result.warnings && result.warnings.length > 0 && (
                  <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
                    <h4 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">
                      Warnings ({result.warnings.length})
                    </h4>
                    <ul className="list-disc pl-5 space-y-1 text-xs text-amber-800 dark:text-amber-200 max-h-40 overflow-y-auto">
                      {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                )}

                {/* Extraction Method */}
                {result.extractionMethod && (
                  <div className="p-4 bg-primary/10 rounded-xl border border-primary/30">
                    <h4 className="font-semibold text-primary mb-2">Extraction Method</h4>
                    <p className="text-primary text-sm">
                      {getExtractionMethodDescription(result.extractionMethod)}
                    </p>
                  </div>
                )}

                {/* Statistics */}
                {result.stats && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-xl border border-orange-200/50 dark:border-orange-800/50">
                      <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                        {result.stats.totalPages}
                      </div>
                      <div className="text-sm text-orange-700 dark:text-orange-300">Total Pages</div>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-primary/10 to-primary/10 dark:from-primary/10 dark:to-primary/15 rounded-xl border border-primary/30">
                      <div className="text-2xl font-bold text-primary">
                        {result.stats.totalChunks}
                      </div>
                      <div className="text-sm text-primary">Content Chunks</div>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200/50 dark:border-green-800/50">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {result.stats.totalWords.toLocaleString()}
                      </div>
                      <div className="text-sm text-green-700 dark:text-green-300">Total Words</div>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-primary/10 to-primary/10 dark:from-primary/15 dark:to-primary/15 rounded-xl border border-primary/30">
                      <div className="text-2xl font-bold text-primary">
                        {Math.round(result.stats.processingTime / 1000)}s
                      </div>
                      <div className="text-sm text-primary">Processing Time</div>
                    </div>
                  </div>
                )}

                {/* Additional Statistics */}
                {result.additionalStats && (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-gradient-to-br from-cyan-50 to-teal-50 dark:from-cyan-900/20 dark:to-teal-900/20 rounded-xl border border-cyan-200/50 dark:border-cyan-800/50">
                      <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                        {result.additionalStats.tablesFound || 0}
                      </div>
                      <div className="text-sm text-cyan-700 dark:text-cyan-300">Tables Found</div>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-primary/10 to-primary/10 dark:from-primary/15 dark:to-primary/15 rounded-xl border border-primary/30">
                      <div className="text-2xl font-bold text-primary">
                        {result.additionalStats.equationsFound || 0}
                      </div>
                      <div className="text-sm text-primary">Equations Found</div>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-rose-50 to-primary/10 dark:from-rose-900/20 dark:to-primary/15 rounded-xl border border-rose-200/50 dark:border-rose-800/50">
                      <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                        {result.additionalStats.figuresFound || 0}
                      </div>
                      <div className="text-sm text-rose-700 dark:text-rose-300">Figures Found</div>
                    </div>
                  </div>
                )}

                {/* PHASE 3: Validation Statistics */}
                {result.validationStats && (
                  <div className={`p-6 rounded-xl border-2 ${
                    result.validationStats.validationRate >= 0.95
                      ? 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800'
                      : result.validationStats.validationRate >= 0.90
                      ? 'bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-yellow-200 dark:border-yellow-800'
                      : 'bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-red-200 dark:border-red-800'
                  }`}>
                    <div className="flex items-center space-x-3 mb-4">
                      {result.validationStats.validationRate >= 0.95 ? (
                        <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                      ) : result.validationStats.validationRate >= 0.90 ? (
                        <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                      ) : (
                        <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                      )}
                      <h4 className={`font-bold text-lg ${
                        result.validationStats.validationRate >= 0.95
                          ? 'text-green-800 dark:text-green-200'
                          : result.validationStats.validationRate >= 0.90
                          ? 'text-yellow-800 dark:text-yellow-200'
                          : 'text-red-800 dark:text-red-200'
                      }`}>
                        Data Quality: {(result.validationStats.validationRate * 100).toFixed(1)}%
                      </h4>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="p-3 bg-white/50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {result.validationStats.validCount}
                        </div>
                        <div className="text-sm text-muted-foreground">Valid Chunks</div>
                      </div>
                      <div className="p-3 bg-white/50 rounded-lg">
                        <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                          {result.validationStats.invalidCount}
                        </div>
                        <div className="text-sm text-muted-foreground">Invalid Chunks</div>
                      </div>
                    </div>

                    {result.validationStats.invalidChunks && result.validationStats.invalidChunks.length > 0 && (
                      <div className="mt-4 p-3 bg-white/50 rounded-lg">
                        <h5 className="font-semibold text-sm text-foreground mb-2">
                          Validation Errors ({result.validationStats.invalidChunks.length}):
                        </h5>
                        <ul className="text-xs text-muted-foreground space-y-1 max-h-32 overflow-y-auto">
                          {result.validationStats.invalidChunks.slice(0, 10).map((invalid, index) => (
                            <li key={index} className="flex items-start space-x-2">
                              <span className="text-red-500">•</span>
                              <span><strong>{invalid.chunkId}:</strong> {invalid.error}</span>
                            </li>
                          ))}
                          {result.validationStats.invalidChunks.length > 10 && (
                            <li className="text-muted-foreground italic">
                              ... and {result.validationStats.invalidChunks.length - 10} more
                            </li>
                          )}
                        </ul>
                      </div>
                    )}

                    {result.strategy && (
                      <div className="mt-4 text-sm text-muted-foreground">
                        <strong>Extraction Strategy:</strong> {result.strategy}
                      </div>
                    )}
                  </div>
                )}

                {/* Errors */}
                {result.errors && result.errors.length > 0 && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
                    <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">Errors</h4>
                    <ul className="text-red-700 dark:text-red-300 text-sm space-y-1">
                      {result.errors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                  Ready for Upload
                </h3>
                <p className="text-muted-foreground dark:text-muted-foreground">
                  Upload results and statistics will appear here
                </p>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Content Overview Tab */}
        {activeTab === 'overview' && (
          <ContentOverview isActive={activeTab === 'overview'} />
        )}

        {/* Document Management Tab */}
        {activeTab === 'manage' && (
          <DocumentManagement />
        )}
      </div>
    </div>
  )
}
