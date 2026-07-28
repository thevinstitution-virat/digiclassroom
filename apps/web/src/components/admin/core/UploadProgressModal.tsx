"use client"

import React, { useEffect, useMemo, useRef, useState } from 'react'

type Stage = 'idle' | 'uploading' | 'processing' | 'indexing' | 'completed' | 'error'

export interface UploadProgressModalProps {
  open: boolean
  onClose: () => void
  uploadId: string
  initialStage?: Stage
  onCancel?: () => Promise<void>
  onRetry?: () => Promise<void>
  canPause?: boolean
  onPause?: () => Promise<void>
  onResume?: () => Promise<void>
}

export default function UploadProgressModal(props: UploadProgressModalProps) {
  const { open, onClose, uploadId, initialStage = 'processing', onCancel, onRetry, canPause, onPause, onResume } = props
  const [stage, setStage] = useState<Stage>(initialStage)
  const [current, setCurrent] = useState<number>(0)
  const [total, setTotal] = useState<number>(0)
  const [percent, setPercent] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [logsExpanded, setLogsExpanded] = useState(false)
  const [logLines, setLogLines] = useState<string[]>([])
  const [startTime, setStartTime] = useState<number>(Date.now())
  const [paused, setPaused] = useState(false)

  const esRef = useRef<EventSource | null>(null)
  const errorCountRef = useRef<number>(0)
  const hasReceivedDataRef = useRef<boolean>(false)

  useEffect(() => {
    if (!open) return
    setStartTime(Date.now())
    setError(null)
    setPaused(false)
    setStage(initialStage)
    setCurrent(0)
    setTotal(0)
    setPercent(0)
    errorCountRef.current = 0
    hasReceivedDataRef.current = false

    console.log(`🔌 UploadProgressModal: Opening SSE connection for uploadId: ${uploadId}`)

    // Subscribe to SSE stream
    const es = new EventSource(`/api/super-admin/content/progress/${uploadId}`)
    esRef.current = es

    es.addEventListener('ready', () => {
      console.log(`✅ UploadProgressModal: Received 'ready' event for ${uploadId}`)
      setStage('processing')
      hasReceivedDataRef.current = true
    })

    es.addEventListener('progress', (evt: MessageEvent) => {
      console.log(`📊 UploadProgressModal: Received 'progress' event:`, evt.data)
      try {
        const data = JSON.parse(evt.data)
        const cur = data.current || 0
        const tot = data.total || 0
        setCurrent(cur)
        setTotal(tot)
        if (tot > 0) {
          const p = Math.max(5, Math.min(99, Math.floor((cur / tot) * 100)))
          setPercent(p)
          console.log(`📈 UploadProgressModal: Progress updated to ${p}% (${cur}/${tot})`)
        }
        if (data.raw) setLogLines(prev => [...prev, data.raw])
        hasReceivedDataRef.current = true
        // Reset error count on successful progress update
        errorCountRef.current = 0
      } catch (error) {
        console.error(`❌ UploadProgressModal: Failed to parse progress data:`, error)
      }
    })

    es.addEventListener('end', () => {
      console.log(`🏁 UploadProgressModal: Received 'end' event for ${uploadId}`)
      setPercent(100)
      setStage('completed')
      hasReceivedDataRef.current = true
      // Close the connection immediately after receiving 'end' to prevent error events
      setTimeout(() => {
        console.log(`🔌 UploadProgressModal: Closing SSE after 'end' event`)
        try { es.close() } catch {}
      }, 100)
    })

    es.addEventListener('error', (evt) => {
      errorCountRef.current++

      // Don't log errors if we've already completed successfully
      if (hasReceivedDataRef.current && es.readyState === EventSource.CONNECTING) {
        // This is a normal reconnection attempt after server closed the connection
        // Silently close the connection since we're done
        console.log(`ℹ️ UploadProgressModal: SSE reconnecting after completion (closing)`)
        try { es.close() } catch {}
        return
      }

      console.error(`❌ UploadProgressModal: SSE error event (count: ${errorCountRef.current}):`, evt)
      console.error(`   ReadyState: ${es.readyState}`)
      console.error(`   Has received data: ${hasReceivedDataRef.current}`)

      // Only show error if we've had multiple errors AND haven't received any data
      // OR if the connection is permanently closed (readyState === 2)
      if (es.readyState === EventSource.CLOSED) {
        console.error(`❌ UploadProgressModal: SSE connection permanently closed`)
        if (!hasReceivedDataRef.current) {
          setStage('error')
          setError('Failed to connect to progress stream')
        } else {
          // Connection closed after receiving data - this is normal at the end
          console.log(`ℹ️ UploadProgressModal: SSE closed after receiving data (normal)`)
        }
      } else if (errorCountRef.current >= 3 && !hasReceivedDataRef.current) {
        // Multiple errors without any successful data
        console.error(`❌ UploadProgressModal: Too many errors without data`)
        setStage('error')
        setError('Progress stream interrupted')
      } else {
        // Transient error - log but don't fail
        console.warn(`⚠️ UploadProgressModal: Transient SSE error (will retry)`)
      }
    })

    // Add open event handler for debugging
    es.addEventListener('open', () => {
      console.log(`🔓 UploadProgressModal: SSE connection opened for ${uploadId}`)
    })

    return () => {
      console.log(`🔌 UploadProgressModal: Closing SSE connection for ${uploadId}`)
      try { es.close() } catch {}
    }
  }, [open, uploadId, initialStage])

  const elapsedSec = (Date.now() - startTime) / 1000
  const rate = useMemo(() => (current > 1 && elapsedSec > 1 ? current / elapsedSec : 0), [current, elapsedSec])
  const etaSec = useMemo(() => (rate > 0 && total > 0 ? Math.max(0, Math.round((total - current) / rate)) : 0), [rate, total, current])

  const etaText = useMemo(() => {
    if (stage === 'completed')
  return 'Completed!'
    if (stage === 'error')
  return 'Failed'
    if (current >= total && total > 0)
  return 'Finalizing...'
    if (etaSec > 0) {
      const minutes = Math.floor(etaSec / 60)
      const seconds = etaSec % 60
      return minutes > 0 ? `${minutes}m ${seconds}s remaining` : `${seconds}s remaining`
    }
    return 'Estimating...'
  }, [stage, current, total, etaSec])

  const colorClass = stage === 'error' ? 'bg-red-500' : stage === 'completed' ? 'bg-green-500' : 'bg-blue-600'

  const stageLabel = stage === 'uploading' ? 'Uploading' : stage === 'processing' ? 'Processing' : stage === 'indexing' ? 'Indexing' : stage === 'completed' ? 'Completed' : stage === 'error' ? 'Error' : 'Idle'

  const handleCancel = async () => {
    if (!onCancel) return
    if (!confirm('Are you sure you want to cancel this upload?')) return
    await onCancel()
  }

  const handleRetry = async () => { if (onRetry)
  await onRetry() }

  const handlePauseResume = async () => {
    if (!canPause) return
    if (paused) { if (onResume)
  await onResume(); setPaused(false) }
    else { if (onPause)
  await onPause(); setPaused(true) }
  }

  if (!open)
  return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-gray-900 shadow-xl border border-gray-200 dark:border-gray-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">{stageLabel} Textbook</h2>
          <button className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Circular progress indicator */}
        <div className="flex items-center gap-6">
          <div className="relative h-20 w-20">
            <svg className="h-20 w-20 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" stroke="#e5e7eb" strokeWidth="10" fill="none" />
              <circle cx="50" cy="50" r="45" stroke={stage === 'error' ? '#ef4444' : stage === 'completed' ? '#22c55e' : '#3b82f6'} strokeWidth="10" fill="none" strokeDasharray="283" strokeDashoffset={Math.max(0, 283 - (283 * percent) / 100)} style={{ transition: 'stroke-dashoffset 0.4s ease' }} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-lg font-semibold">{percent}%</div>
          </div>

          {/* Details */}
          <div className="flex-1 space-y-2">
            <div className="text-sm text-gray-600 dark:text-gray-400">Stage: <span className="font-medium text-gray-900 dark:text-gray-100">{stageLabel}</span></div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Page: <span className="font-medium text-gray-900 dark:text-gray-100">{current} / {total || '?'}</span></div>
            <div className="text-sm text-gray-600 dark:text-gray-400">ETA: <span className="font-medium text-gray-900 dark:text-gray-100">{etaText}</span></div>
            <div className="w-full h-3 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
              <div className={`${colorClass} h-3 rounded-full transition-all`} style={{ width: `${percent}%` }} />
            </div>
          </div>
        </div>

        {/* Success, errors, and status messages */}
        {stage === 'completed' && !error && (
          <div className="mt-4 p-3 rounded bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>Upload completed successfully!</span>
          </div>
        )}
        {error && <div className="mt-4 p-3 rounded bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 flex items-center gap-2">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span>{error}</span>
        </div>}

        <div className="mt-4">
          <button className="text-sm text-blue-600 hover:underline" onClick={() => setLogsExpanded(!logsExpanded)}>{logsExpanded ? 'Hide details' : 'Show details'}</button>
          {logsExpanded && (
            <div className="mt-2 max-h-40 overflow-auto rounded border border-gray-200 dark:border-gray-800 p-2 text-xs font-mono text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-950">
              {logLines.length ? logLines.map((l, i) => <div key={i}>{l}</div>) : <div>No details yet…</div>}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-between">
          <div className="space-x-2">
            {onCancel && stage !== 'completed' && stage !== 'error' && (
              <button className="px-3 py-2 rounded bg-red-600 text-white hover:bg-red-700" onClick={handleCancel} title="Esc">Cancel Upload</button>
            )}
            {onRetry && stage === 'error' && (
              <button className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700" onClick={handleRetry} title="Enter">Retry</button>
            )}
            {canPause && (
              <button className="px-3 py-2 rounded bg-yellow-500 text-white hover:bg-yellow-600" onClick={handlePauseResume}>{paused ? 'Resume' : 'Pause'}</button>
            )}
          </div>
          <button className="px-3 py-2 rounded bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

