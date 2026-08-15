'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { 
  FileText, 
  Image, 
  X, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Eye,
  Copy
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ProcessingFile {
  file: File
  type: 'document' | 'image'
  status: 'uploading' | 'processing' | 'completed' | 'error'
  progress: number
  result?: {
    text?: string
    confidence?: number
    error?: string
  }
}

interface FileProcessingIndicatorProps {
  file: ProcessingFile
  onRemove: () => void
  className?: string
}

export function FileProcessingIndicator({
  file,
  onRemove,
  className
}: FileProcessingIndicatorProps) {
  const [showFullText, setShowFullText] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  const getStatusIcon = () => {
    switch (file.status) {
      case 'uploading':
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />
      default:
        return null
    }
  }

  const getStatusColor = () => {
    switch (file.status) {
      case 'uploading':
      case 'processing':
        return 'border-blue-200 bg-blue-50/50'
      case 'completed':
        return 'border-green-200 bg-green-50/50'
      case 'error':
        return 'border-red-200 bg-red-50/50'
      default:
        return 'border-border bg-muted/30'
    }
  }

  const getStatusText = () => {
    switch (file.status) {
      case 'uploading':
        return 'Uploading...'
      case 'processing':
        return file.type === 'image' ? 'Extracting text...' : 'Processing document...'
      case 'completed':
        return file.type === 'image' ? 'Text extracted' : 'Document processed'
      case 'error':
        return 'Processing failed'
      default:
        return 'Unknown status'
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0)
  return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const copyToClipboard = async () => {
    if (file.result?.text) {
      try {
        await navigator.clipboard.writeText(file.result.text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (error) {
        console.error('Failed to copy text:', error)
      }
    }
  }

  const truncateText = (text: string, maxLength: number = 150) => {
    if (text.length <= maxLength)
  return text
    return text.substring(0, maxLength) + '...'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn("w-full", className)}
    >
      <Card className={cn(
        "transition-all duration-200 backdrop-blur-sm",
        getStatusColor()
      )}>
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            {/* File Icon */}
            <div className="flex-shrink-0 mt-1">
              {file.type === 'image' ? (
                <Image className="h-5 w-5 text-blue-600" />
              ) : (
                <FileText className="h-5 w-5 text-blue-600" />
              )}
            </div>

            {/* File Info */}
            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <h4 className="text-sm font-medium text-foreground truncate">
                    {file.file.name}
                  </h4>
                  {getStatusIcon()}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRemove}
                  className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>

              {/* File Details */}
              <div className="flex items-center space-x-4 text-xs text-muted-foreground mb-2">
                <span>{formatFileSize(file.file.size)}</span>
                <span>{file.file.type}</span>
                {file.result?.confidence && (
                  <span className="text-green-600">
                    {Math.round(file.result.confidence * 100)}% confidence
                  </span>
                )}
              </div>

              {/* Status and Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{getStatusText()}</span>
                  {file.status === 'processing' && (
                    <span className="text-xs text-muted-foreground">{file.progress}%</span>
                  )}
                </div>

                {/* Progress Bar */}
                {(file.status === 'uploading' || file.status === 'processing') && (
                  <Progress 
                    value={file.progress} 
                    className="h-2"
                  />
                )}

                {/* Error Message */}
                {file.status === 'error' && file.result?.error && (
                  <div className="text-sm text-red-600 bg-red-50 p-2 rounded-md border border-red-200">
                    {file.result.error}
                  </div>
                )}

                {/* Extracted Text Preview */}
                {file.status === 'completed' && file.result?.text && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">
                        Extracted Text:
                      </span>
                      <div className="flex items-center space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowFullText(!showFullText)}
                          className="h-6 px-2 text-xs"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          {showFullText ? 'Less' : 'More'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={copyToClipboard}
                          className="h-6 px-2 text-xs"
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          {copied ? 'Copied!' : 'Copy'}
                        </Button>
                      </div>
                    </div>

                    <div className="bg-white/80 backdrop-blur-sm border border-border rounded-md p-3">
                      <AnimatePresence mode="wait">
                        {showFullText ? (
                          <motion.div
                            key="full"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="text-sm text-foreground whitespace-pre-wrap max-h-40 overflow-y-auto"
                          >
                            {file.result.text}
                          </motion.div>
                        ) : (
                          <motion.div
                            key="truncated"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="text-sm text-foreground"
                          >
                            {truncateText(file.result.text)}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
