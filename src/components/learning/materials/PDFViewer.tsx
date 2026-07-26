'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  XMarkIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  DocumentArrowDownIcon,
  EyeIcon,
  BookmarkIcon,
  ShareIcon,
  PrinterIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline'
import { Button } from '@/components/core/ui/button'
import { Badge } from '@/components/core/ui/badge'
import { Progress } from '@/components/core/ui/progress'
import { MaterialItem } from '@/types/user-management'

interface PDFViewerProps {
  material: MaterialItem
  isOpen: boolean
  onClose: () => void
  onDownload?: () => void
  onBookmark?: () => void
  onShare?: () => void
}

interface ReadingProgress {
  currentPage: number
  totalPages: number
  progressPercentage: number
  readingTime: number
}

export default function PDFViewer({
  material,
  isOpen,
  onClose,
  onDownload,
  onBookmark,
  onShare
}: PDFViewerProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [readingProgress, setReadingProgress] = useState<ReadingProgress>({
    currentPage: 1,
    totalPages: material.metadata.pageCount || 1,
    progressPercentage: 0,
    readingTime: 0
  })
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [startTime] = useState(Date.now())
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Update reading time every minute
  useEffect(() => {
    if (!isOpen) return

    const interval = setInterval(() => {
      const currentTime = Math.floor((Date.now() - startTime) / 60000) // minutes
      setReadingProgress(prev => ({
        ...prev,
        readingTime: currentTime
      }))
    }, 60000)

    return () => clearInterval(interval)
  }, [isOpen, startTime])

  // Handle fullscreen toggle
  const toggleFullscreen = async () => {
    if (!containerRef.current) return

    try {
      if (!isFullscreen) {
        await containerRef.current.requestFullscreen()
        setIsFullscreen(true)
      } else {
        await document.exitFullscreen()
        setIsFullscreen(false)
      }
    } catch (error) {
      console.error('Fullscreen error:', error)
    }
  }

  // Handle iframe load
  const handleIframeLoad = () => {
    setIsLoading(false)
    setError(null)
  }

  // Handle iframe error
  const handleIframeError = () => {
    setIsLoading(false)
    setError('Failed to load PDF. Please try downloading the file instead.')
  }

  // Handle download
  const handleDownload = async () => {
    try {
      if (onDownload) {
        onDownload()
      } else if (material.downloadUrl) {
        window.open(material.downloadUrl, '_blank')
      }
      
      // Track download
      await trackMaterialAccess('download')
    } catch (error) {
      console.error('Download error:', error)
    }
  }

  // Handle bookmark toggle
  const handleBookmark = async () => {
    try {
      setIsBookmarked(!isBookmarked)
      if (onBookmark) {
        onBookmark()
      }
      
      // Track bookmark
      await trackMaterialAccess('bookmark')
    } catch (error) {
      console.error('Bookmark error:', error)
    }
  }

  // Handle share
  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: material.title,
          text: material.description,
          url: material.viewerUrl
        })
      } else if (onShare) {
        onShare()
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(material.viewerUrl || '')
        // You could show a toast notification here
      }
      
      // Track share
      await trackMaterialAccess('share')
    } catch (error) {
      console.error('Share error:', error)
    }
  }

  // Track material access
  const trackMaterialAccess = async (action: string) => {
    try {
      await fetch('/api/materials/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialId: material.id,
          action,
          readingProgress
        })
      })
    } catch (error) {
      console.error('Failed to track access:', error)
    }
  }

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen)
  return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          ref={containerRef}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className={`bg-white dark:bg-gray-900 rounded-lg shadow-2xl overflow-hidden ${
            isFullscreen ? 'w-full h-full' : 'w-[95vw] h-[95vh] max-w-6xl'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                {material.title}
              </h2>
              <div className="flex items-center space-x-2 mt-1">
                <Badge variant="secondary">{material.type}</Badge>
                <Badge variant="outline">{material.subject}</Badge>
                <Badge variant="outline">Class {material.class}</Badge>
                {material.tags.slice(0, 2).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2 ml-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBookmark}
                className={isBookmarked ? 'text-yellow-600' : ''}
              >
                <BookmarkIcon className="h-4 w-4" />
              </Button>
              
              <Button variant="ghost" size="sm" onClick={handleShare}>
                <ShareIcon className="h-4 w-4" />
              </Button>
              
              <Button variant="ghost" size="sm" onClick={handleDownload}>
                <DocumentArrowDownIcon className="h-4 w-4" />
              </Button>
              
              <Button variant="ghost" size="sm" onClick={toggleFullscreen}>
                {isFullscreen ? (
                  <ArrowsPointingInIcon className="h-4 w-4" />
                ) : (
                  <ArrowsPointingOutIcon className="h-4 w-4" />
                )}
              </Button>
              
              <Button variant="ghost" size="sm" onClick={onClose}>
                <XMarkIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Progress Bar */}
          {readingProgress.totalPages > 1 && (
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                <span>
                  Page {readingProgress.currentPage} of {readingProgress.totalPages}
                </span>
                <span>
                  Reading time: {readingProgress.readingTime} min
                </span>
              </div>
              <Progress 
                value={readingProgress.progressPercentage} 
                className="h-1"
              />
            </div>
          )}

          {/* PDF Viewer */}
          <div className="flex-1 relative bg-gray-100 dark:bg-gray-800">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-400">Loading PDF...</p>
                </div>
              </div>
            )}

            {error && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center max-w-md mx-auto p-6">
                  <div className="text-red-500 mb-4">
                    <DocumentArrowDownIcon className="h-16 w-16 mx-auto" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Unable to Display PDF
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {error}
                  </p>
                  <Button onClick={handleDownload} className="w-full">
                    <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                    Download PDF Instead
                  </Button>
                </div>
              </div>
            )}

            {material.viewerUrl && (
              <iframe
                ref={iframeRef}
                src={`${material.viewerUrl}?embedded=true`}
                className="w-full h-full border-0"
                title={material.title}
                onLoad={handleIframeLoad}
                onError={handleIframeError}
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
              />
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
              <span>Size: {(material.fileSize / 1024 / 1024).toFixed(1)} MB</span>
              <span>Downloads: {material.downloadCount}</span>
              <span>Difficulty: {material.metadata.difficulty}</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
