'use client'

import React, { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/core/ui/button'
import { Textarea } from '@/components/core/ui/textarea'
import { Card, CardContent } from '@/components/core/ui/card'
import { VoiceRecordingButton } from './VoiceRecordingButton'
import { FileProcessingIndicator } from './FileProcessingIndicator'
import { Paperclip, Send, X, FileText, Image, Mic, Upload } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { voiceCommandsService } from '@/lib/services/voice-commands-service'

interface MultiModalInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (data: {
    text: string
    file?: File
    voiceCommand?: any
    isVoiceInput?: boolean
  }) => void
  disabled?: boolean
  placeholder?: string
  className?: string
  context?: {
    hasUploadedFile?: boolean
    currentTopic?: string
    classLevel?: string
    subject?: string
  }
  /** Optional controls rendered as a slim toolbar at the top of the input card (e.g. tutor selector). */
  headerSlot?: React.ReactNode
}

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

export function MultiModalInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "Type your message or use voice...",
  className,
  context,
  headerSlot
}: MultiModalInputProps) {
  const [uploadedFile, setUploadedFile] = useState<ProcessingFile | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // WhatsApp-style: Show send button when there's text, mic button when empty
  const showSendButton = value.trim().length > 0
  const showMicButton = !showSendButton

  // Handle file upload
  const handleFileUpload = useCallback(async (file: File) => {
    const fileType = file.type.startsWith('image/') ? 'image' : 'document'
    
    const processingFile: ProcessingFile = {
      file,
      type: fileType,
      status: 'uploading',
      progress: 0
    }
    
    setUploadedFile(processingFile)

    try {
      // Process file based on type
      if (fileType === 'image') {
        await processImageFile(processingFile)
      } else {
        await processDocumentFile(processingFile)
      }
    } catch (error) {
      console.error('File processing failed:', error)
      setUploadedFile(prev => prev ? {
        ...prev,
        status: 'error',
        result: { error: error instanceof Error ? error.message : 'Processing failed' }
      } : null)
    }
  }, [])

  // Process image file with OCR
  const processImageFile = async (processingFile: ProcessingFile) => {
    setUploadedFile(prev => prev ? { ...prev, status: 'processing', progress: 20 } : null)

    const formData = new FormData()
    formData.append('image', processingFile.file)
    formData.append('language', 'eng')

    const response = await fetch('/api/ocr', {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      throw new Error(`OCR failed: ${response.status}`)
    }

    const result = await response.json()
    
    if (result.success) {
      setUploadedFile(prev => prev ? {
        ...prev,
        status: 'completed',
        progress: 100,
        result: {
          text: result.data.text,
          confidence: result.data.confidence
        }
      } : null)
    } else {
      throw new Error(result.error || 'OCR processing failed')
    }
  }

  // Process document file using content upload API
  const processDocumentFile = async (processingFile: ProcessingFile) => {
    setUploadedFile(prev => prev ? { ...prev, status: 'processing', progress: 20 } : null)

    const formData = new FormData()
    formData.append('file', processingFile.file)
    formData.append('metadata', JSON.stringify({
      subject: 'General',
      class: 'Mixed',
      board: 'General',
      medium: 'English'
    }))

    const response = await fetch('/api/super-admin/content/upload', {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      throw new Error(`Document processing failed: ${response.status}`)
    }

    const result = await response.json()

    if (result.success) {
      setUploadedFile(prev => prev ? {
        ...prev,
        status: 'completed',
        progress: 100,
        result: {
          text: result.extractedText || 'Document processed successfully',
          confidence: 0.9
        }
      } : null)
    } else {
      throw new Error(result.error || 'Document processing failed')
    }
  }

  // Handle voice recording completion
  const handleVoiceRecording = useCallback((audioBlob: Blob) => {
    console.log('Voice recording completed:', audioBlob.size, 'bytes')
  }, [])

  // Handle voice transcription
  const handleVoiceTranscription = useCallback((text: string) => {
    // Process voice commands
    const commandResult = voiceCommandsService.processVoiceInput(text, context)
    
    if (commandResult.command && commandResult.confidence > 0.7) {
      // Handle voice command
      const formattedCommand = voiceCommandsService.formatCommandForAI(commandResult)
      onChange(formattedCommand)
      
      // Auto-submit voice commands
      setTimeout(() => {
        onSubmit({
          text: formattedCommand,
          file: uploadedFile?.file,
          voiceCommand: commandResult,
          isVoiceInput: true
        })
      }, 100)
    } else {
      // Regular voice input
      onChange(text)
    }
  }, [context, onChange, onSubmit, uploadedFile])

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileUpload(files[0])
    }
  }, [handleFileUpload])

  // Handle file input change
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }, [handleFileUpload])

  // Handle submit
  const handleSubmit = useCallback(() => {
    if (!value.trim() && !uploadedFile) return

    onSubmit({
      text: value,
      file: uploadedFile?.file,
      isVoiceInput: false
    })

    // Clear input and uploaded file after submit
    onChange('')
    setUploadedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [value, uploadedFile, onSubmit, onChange])

  // Handle key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }, [handleSubmit])

  // Remove uploaded file
  const removeFile = useCallback(() => {
    setUploadedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  return (
    <div className={cn("space-y-3", className)}>
      {/* File Processing Indicator */}
      <AnimatePresence>
        {uploadedFile && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <FileProcessingIndicator
              file={uploadedFile}
              onRemove={removeFile}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Input Area */}
      <Card 
        className={cn(
          "bg-white/90 backdrop-blur-sm border-orange-200/60 transition-all duration-200",
          isDragOver && "border-blue-400 bg-blue-50/50",
          "hover:border-blue-400 hover:shadow-md"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CardContent className="p-4">
          {/* Header toolbar (e.g. tutor selector) — slim row above the input */}
          {headerSlot && (
            <div className="mb-2.5 flex items-center justify-between gap-2 border-b border-orange-100/60 pb-2.5">
              {headerSlot}
            </div>
          )}

          {/* Drag and Drop Overlay */}
          <AnimatePresence>
            {isDragOver && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-blue-100/80 backdrop-blur-sm border-2 border-dashed border-blue-400 rounded-xl flex items-center justify-center z-10"
              >
                <div className="text-center">
                  <Upload className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-blue-700 font-medium">Drop file here to analyze</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-end space-x-3">
            {/* Text Input */}
            <div className="flex-1">
              <Textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={placeholder}
                className="min-h-[44px] max-h-32 resize-none border-0 focus:ring-0 bg-transparent p-2 text-sm whitespace-pre-wrap placeholder:text-gray-400"
                disabled={disabled}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2">
              {/* File Upload Button (Paperclip) */}
              <div className="relative">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileInputChange}
                  accept=".txt,.pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled || !!uploadedFile}
                  className="h-11 w-11 p-0 rounded-xl border-orange-200/60 hover:border-blue-400 bg-white/90 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-200"
                >
                  <Paperclip className="h-4 w-4 text-gray-600" />
                </Button>
              </div>

              {/* WhatsApp-style Dynamic Button */}
              <AnimatePresence mode="wait">
                {showMicButton && (
                  <motion.div
                    key="mic"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <VoiceRecordingButton
                      onRecordingComplete={handleVoiceRecording}
                      onTranscriptionResult={handleVoiceTranscription}
                      onError={(error) => console.error('Voice error:', error)}
                      onRecordingCancel={() => console.log('Recording cancelled')}
                      disabled={disabled}
                      size="md"
                      showVisualizer={true}
                      longPressDelay={500}
                      slideThreshold={100}
                    />
                  </motion.div>
                )}

                {showSendButton && (
                  <motion.div
                    key="send"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Button
                      onClick={handleSubmit}
                      disabled={!value.trim() || disabled}
                      className="h-11 w-11 p-0 rounded-xl bg-gradient-to-r from-orange-500 to-blue-600 hover:from-orange-600 hover:to-blue-700 shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      <Send className="h-4 w-4 text-white" />
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
