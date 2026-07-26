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

function HealthWidget() {
  const fetcher = (url: string) => fetch(url).then(r => r.json())
  const { data, error, isLoading } = useSWR('/api/super-admin/engine/health', fetcher, { refreshInterval: 15000 })

  return (
    <div className="mb-8">
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-4 shadow border border-white/20 dark:border-gray-700/20">
        <div className="flex items-center gap-3 mb-2">
          <Activity className="h-5 w-5 text-green-600" />
          <h3 className="font-semibold">Engine Health</h3>
        </div>
        {isLoading && <p className="text-sm text-gray-500">Checking...</p>}
        {error && <p className="text-sm text-red-600">Health check failed</p>}
        {data?.health && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
              <div className="font-medium">Python</div>
              <div className="text-gray-600 dark:text-gray-300">{data.health.python?.version || 'Unknown'}</div>
              <div className={data.health.python?.engine_import_ok ? 'text-green-600' : 'text-red-600'}>
                Engine import: {data.health.python?.engine_import_ok ? 'OK' : 'Fail'}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <div className="font-medium">Config</div>
              <div className="text-gray-600 dark:text-gray-300 truncate">{data.health.config?.path || 'Unknown'}</div>
              <div className={data.health.config?.exists ? 'text-green-600' : 'text-red-600'}>
                Exists: {data.health.config?.exists ? 'Yes' : 'No'}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20">
              <div className="font-medium">Qdrant</div>
              <div className="text-gray-600 dark:text-gray-300 truncate">{data.health.qdrant?.url || 'Unknown'}</div>
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

interface UploadResult {
  success: boolean
  message: string
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
  const [formData, setFormData] = useState({
    file: null as File | null,
    classLevel: '',
    subject: '',
    bookTitle: '',
    board: '',
    medium: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.file || !formData.classLevel || !formData.subject || !formData.bookTitle || !formData.board || !formData.medium) {
      alert('Please fill in all fields including Board and Medium')
      return
    }

    setIsUploading(true)
    setUploadProgress(0)
    setResult(null)

    try {
      const uploadFormData = new FormData()
      uploadFormData.append('file', formData.file)
      uploadFormData.append('classLevel', formData.classLevel)
      uploadFormData.append('subject', formData.subject)
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

      uploadFormData.append('board', formData.board)
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
          <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-orange-500/10 to-blue-500/10 backdrop-blur-sm border border-orange-200/30 rounded-2xl px-6 py-3 mb-6">
            <BookOpen className="h-5 w-5 text-orange-500" />
            <span className="text-sm font-medium bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
              Content Management System
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent flex items-center justify-center gap-4">
              <Database className="h-12 w-12 text-orange-500" />
              Intelligent PDF Upload
            </span>
          </h1>

          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-8">
            Upload CBSE textbooks with advanced PDF processing and intelligent text extraction powered by AI
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-2 shadow-xl border border-white/20 dark:border-gray-700/20">
            <div className="flex space-x-2">
              <button
                onClick={() => setActiveTab('upload')}
                className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 flex items-center space-x-2 ${
                  activeTab === 'upload'
                    ? 'bg-gradient-to-r from-orange-500 to-blue-500 text-white shadow-lg'
                    : 'text-gray-600 dark:text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-gray-700'
                }`}
              >
                <Upload className="h-4 w-4" />
                <span>Upload Content</span>
              </button>
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 flex items-center space-x-2 ${
                  activeTab === 'overview'
                    ? 'bg-gradient-to-r from-orange-500 to-blue-500 text-white shadow-lg'
                    : 'text-gray-600 dark:text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-gray-700'
                }`}
              >
                <Database className="h-4 w-4" />
                <span>Content Overview</span>
              </button>
              <button
                onClick={() => setActiveTab('manage')}
                className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 flex items-center space-x-2 ${
                  activeTab === 'manage'
                    ? 'bg-gradient-to-r from-orange-500 to-blue-500 text-white shadow-lg'
                    : 'text-gray-600 dark:text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-gray-700'
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
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20 dark:border-gray-700/20 hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02]">
            <div className="mb-8">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <Upload className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                    Upload Textbook
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    Select a PDF file and provide metadata for intelligent processing
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Class Level
                  </label>
                  <select
                    value={formData.classLevel}
                    onChange={(e) => setFormData({ ...formData, classLevel: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-300"
                    required
                  >
                    <option value="">Select Class</option>
                    <option value="Class I">Class I</option>
                    <option value="Class II">Class II</option>
                    <option value="Class III">Class III</option>
                    <option value="Class IV">Class IV</option>
                    <option value="Class V">Class V</option>
                    <option value="Class VI">Class VI</option>
                    <option value="Class VII">Class VII</option>
                    <option value="Class VIII">Class VIII</option>
                    <option value="Class IX">Class IX</option>
                    <option value="Class X">Class X</option>
                    <option value="Class XI">Class XI</option>
                    <option value="Class XII">Class XII</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Subject
                  </label>
                  <select
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-300"
                    required
                  >
                    <option value="">Select Subject</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Science">Science</option>
                    <option value="Social Science">Social Science</option>
                    <option value="English">English</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Economics">Economics</option>
                    <option value="History">History</option>
                    <option value="Geography">Geography</option>
                    <option value="Political Science">Political Science</option>
                    <option value="Physics">Physics</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="Biology">Biology</option>
                  </select>
                </div>
              </div>

              {/* Board and Medium Selection Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <span className="flex items-center gap-2">
                      🏛️ Education Board
                      <span className="text-red-500">*</span>
                    </span>
                  </label>
                  <select
                    value={formData.board}
                    onChange={(e) => setFormData({ ...formData, board: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-300"
                    required
                  >
                    <option value="">Select Education Board</option>
                    <option value="CBSE">CBSE (Central Board of Secondary Education)</option>
                    <option value="ICSE">ICSE (Indian Certificate of Secondary Education)</option>
                    <option value="State Board">State Board</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <span className="flex items-center gap-2">
                      🌐 Language Medium
                      <span className="text-red-500">*</span>
                    </span>
                  </label>
                  <select
                    value={formData.medium}
                    onChange={(e) => setFormData({ ...formData, medium: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-300"
                    required
                  >
                    <option value="">Select Language Medium</option>
                    <option value="English">English</option>
                    <option value="Hindi">Hindi</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Book Title
                </label>
                <input
                  type="text"
                  value={formData.bookTitle}
                  onChange={(e) => setFormData({ ...formData, bookTitle: e.target.value })}
                  placeholder="e.g., NCERT Economics Textbook"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-300"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  PDF File
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setFormData({ ...formData, file: e.target.files?.[0] || null })}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isUploading}
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
                    <span>Upload & Process</span>
                  </>
                )}
              </button>
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
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>{currentStep}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-orange-500 to-red-500 h-3 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>

          {/* Results Panel */}
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20 dark:border-gray-700/20">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Upload Results
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
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
                        {result.message}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Extraction Method */}
                {result.extractionMethod && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                    <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Extraction Method</h4>
                    <p className="text-blue-700 dark:text-blue-300 text-sm">
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
                    <div className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl border border-blue-200/50 dark:border-blue-800/50">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {result.stats.totalChunks}
                      </div>
                      <div className="text-sm text-blue-700 dark:text-blue-300">Content Chunks</div>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200/50 dark:border-green-800/50">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {result.stats.totalWords.toLocaleString()}
                      </div>
                      <div className="text-sm text-green-700 dark:text-green-300">Total Words</div>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border border-purple-200/50 dark:border-purple-800/50">
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {Math.round(result.stats.processingTime / 1000)}s
                      </div>
                      <div className="text-sm text-purple-700 dark:text-purple-300">Processing Time</div>
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
                    <div className="p-4 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-xl border border-indigo-200/50 dark:border-indigo-800/50">
                      <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                        {result.additionalStats.equationsFound || 0}
                      </div>
                      <div className="text-sm text-indigo-700 dark:text-indigo-300">Equations Found</div>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20 rounded-xl border border-rose-200/50 dark:border-rose-800/50">
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
                      <div className="p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {result.validationStats.validCount}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Valid Chunks</div>
                      </div>
                      <div className="p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                        <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                          {result.validationStats.invalidCount}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Invalid Chunks</div>
                      </div>
                    </div>

                    {result.validationStats.invalidChunks && result.validationStats.invalidChunks.length > 0 && (
                      <div className="mt-4 p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                        <h5 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">
                          Validation Errors ({result.validationStats.invalidChunks.length}):
                        </h5>
                        <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 max-h-32 overflow-y-auto">
                          {result.validationStats.invalidChunks.slice(0, 10).map((invalid, index) => (
                            <li key={index} className="flex items-start space-x-2">
                              <span className="text-red-500">•</span>
                              <span><strong>{invalid.chunkId}:</strong> {invalid.error}</span>
                            </li>
                          ))}
                          {result.validationStats.invalidChunks.length > 10 && (
                            <li className="text-gray-500 italic">
                              ... and {result.validationStats.invalidChunks.length - 10} more
                            </li>
                          )}
                        </ul>
                      </div>
                    )}

                    {result.strategy && (
                      <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
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
                <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400 mb-2">
                  Ready for Upload
                </h3>
                <p className="text-gray-500 dark:text-gray-500">
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
