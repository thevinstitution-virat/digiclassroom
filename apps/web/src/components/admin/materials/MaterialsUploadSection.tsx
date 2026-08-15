'use client'

import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CloudArrowUpIcon,
  DocumentTextIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  FolderIcon
} from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useDropzone } from 'react-dropzone'
import type { MaterialUploadData } from '@/types/google-drive'

interface MaterialsUploadSectionProps {
  onUploadComplete: () => void
}

interface UploadFile extends File {
  id: string
  uploadData: Partial<MaterialUploadData>
  status: 'pending' | 'uploading' | 'completed' | 'error'
  progress: number
  error?: string
}

export default function MaterialsUploadSection({ onUploadComplete }: MaterialsUploadSectionProps) {
  const [files, setFiles] = useState<UploadFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [defaultMetadata, setDefaultMetadata] = useState<Partial<MaterialUploadData>>({
    board: 'CBSE',
    medium: 'ENGLISH',
    class: 10,
    subject: 'Mathematics',
    smType: 'Chapter Notes',
    difficulty: 'medium',
    tags: []
  })

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadFile[] = acceptedFiles.map(file => ({
      ...file,
      id: Math.random().toString(36).substr(2, 9),
      uploadData: { ...defaultMetadata },
      status: 'pending',
      progress: 0
    }))
    
    setFiles(prev => [...prev, ...newFiles])
  }, [defaultMetadata])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: true,
    maxSize: 50 * 1024 * 1024 // 50MB
  })

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId))
  }

  const updateFileMetadata = (fileId: string, data: Partial<MaterialUploadData>) => {
    setFiles(prev => prev.map(f => 
      f.id === fileId 
        ? { ...f, uploadData: { ...f.uploadData, ...data } }
        : f
    ))
  }

  const validateFile = (file: UploadFile): string[] => {
    const errors: string[] = []
    
    if (!file.uploadData.title?.trim()) {
      errors.push('Title is required')
    }
    if (!file.uploadData.subject?.trim()) {
      errors.push('Subject is required')
    }
    if (!file.uploadData.type) {
      errors.push('Material type is required')
    }
    
    return errors
  }

  // Enhanced upload function with retry logic and better error handling
  const uploadFileWithRetry = async (file: UploadFile, maxRetries: number = 2): Promise<any> => {
    let attempt = 0

    while (attempt < maxRetries) {
      try {
        // Update progress for current attempt
        setFiles(prev => prev.map(f =>
          f.id === file.id
            ? { ...f, status: 'uploading', progress: (attempt / maxRetries) * 50 }
            : f
        ))

        const formData = new FormData()
        formData.append('file', file)
        formData.append('metadata', JSON.stringify(file.uploadData))

        const response = await fetch('/api/super-admin/materials/upload', {
          method: 'POST',
          body: formData
        })

        const result = await response.json()

        if (result.success) {
          return result
        }

        // Handle specific error types
        if (result.needsReauth || result.error?.includes('Google Drive not connected')) {
          // Redirect to Google Drive setup
          window.location.href = '/dashboard/super-admin/materials?tab=settings'
          return { success: false, error: 'Google Drive authentication required' }
        }

        if (result.error?.includes('token') || result.error?.includes('expired')) {
          // Token issue - try to refresh and retry
          console.log(`Token issue detected, attempt ${attempt + 1}/${maxRetries}`)
          if (attempt < maxRetries - 1) {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 2000))
            attempt++
            continue
          }
        }

        throw new Error(result.error || 'Upload failed')

      } catch (error) {
        attempt++
        console.error(`Upload attempt ${attempt} failed for ${file.name}:`, error)

        if (attempt < maxRetries) {
          // Update progress to show retry
          setFiles(prev => prev.map(f =>
            f.id === file.id
              ? { ...f, status: 'uploading', progress: (attempt / maxRetries) * 50, error: `Retrying... (${attempt}/${maxRetries})` }
              : f
          ))

          // Exponential backoff: wait longer between retries
          const waitTime = Math.min(2000 * Math.pow(2, attempt - 1), 10000)
          await new Promise(resolve => setTimeout(resolve, waitTime))
        } else {
          // All retries failed
          throw error
        }
      }
    }

    throw new Error('All retry attempts failed')
  }

  const uploadFiles = async () => {
    if (files.length === 0) return

    setIsUploading(true)
    setUploadProgress(0)

    try {
      const totalFiles = files.length
      let completedFiles = 0

      for (const file of files) {
        const errors = validateFile(file)
        if (errors.length > 0) {
          setFiles(prev => prev.map(f => 
            f.id === file.id 
              ? { ...f, status: 'error', error: errors.join(', ') }
              : f
          ))
          continue
        }

        // Update file status to uploading
        setFiles(prev => prev.map(f => 
          f.id === file.id 
            ? { ...f, status: 'uploading', progress: 0 }
            : f
        ))

        try {
          const result = await uploadFileWithRetry(file)

          if (result.success) {
            setFiles(prev => prev.map(f =>
              f.id === file.id
                ? { ...f, status: 'completed', progress: 100 }
                : f
            ))
          } else {
            setFiles(prev => prev.map(f =>
              f.id === file.id
                ? { ...f, status: 'error', error: result.error || 'Upload failed' }
                : f
            ))
          }
        } catch (error) {
          setFiles(prev => prev.map(f => 
            f.id === file.id 
              ? { ...f, status: 'error', error: 'Network error' }
              : f
          ))
        }

        completedFiles++
        setUploadProgress((completedFiles / totalFiles) * 100)
      }

      onUploadComplete()
    } finally {
      setIsUploading(false)
    }
  }

  const clearCompleted = () => {
    setFiles(prev => prev.filter(f => f.status !== 'completed'))
  }

  const materialTypes = [
    { value: 'notes', label: 'Notes' },
    { value: 'summaries', label: 'Summaries' },
    { value: 'mind_maps', label: 'Mind Maps' },
    { value: 'quizzes', label: 'Quizzes' },
    { value: 'textbooks', label: 'Textbooks' },
    { value: 'reference', label: 'Reference' }
  ]

  const subjects = [
    'Hindi',
    'English',
    'Mathematics',
    'Science',
    'Social Science',
    'Physics',
    'Chemistry',
    'Biology',
    'Physical Education',
    'Geography',
    'History',
    'Political Science',
    'Civics',
    'Economics',
    'Micro Economics',
    'Macro Economics',
    'Business Studies',
    'Accountancy',
    'Psychology',
    'Information Technology'
  ]

  const studyMaterialTypes = [
    'Chapter Notes',
    'Important Terms & Formula Sheet',
    'Exam Ready Material',
    'PYQs (Previous Year Questions)',
    'NCERT Insights'
  ]

  return (
    <div className="space-y-6">
      {/* Default Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Default Upload Settings</CardTitle>
          <CardDescription>
            Set default values that will be applied to all uploaded files
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <Label htmlFor="default-board">Education Board</Label>
              <Select 
                value={defaultMetadata.board} 
                onValueChange={(value) => setDefaultMetadata(prev => ({ ...prev, board: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CBSE">CBSE</SelectItem>
                  <SelectItem value="ICSE">ICSE</SelectItem>
                  <SelectItem value="STATE_BOARD">State Board</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="default-class">Class</Label>
              <Select 
                value={defaultMetadata.class?.toString()} 
                onValueChange={(value) => setDefaultMetadata(prev => ({ ...prev, class: parseInt(value) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(num => (
                    <SelectItem key={num} value={num.toString()}>Class {num}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="default-medium">Medium</Label>
              <Select
                value={defaultMetadata.medium}
                onValueChange={(value) => setDefaultMetadata(prev => ({ ...prev, medium: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENGLISH">English</SelectItem>
                  <SelectItem value="HINDI">Hindi</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="default-subject">Subject</Label>
              <Select
                value={defaultMetadata.subject}
                onValueChange={(value) => setDefaultMetadata(prev => ({ ...prev, subject: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map(subject => (
                    <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="default-sm-type">SM Type</Label>
              <Select
                value={defaultMetadata.smType}
                onValueChange={(value) => setDefaultMetadata(prev => ({ ...prev, smType: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {studyMaterialTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Materials</CardTitle>
          <CardDescription>
            Drag and drop PDF files or click to browse
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'border-input hover:border-blue-400'
            }`}
          >
            <input {...getInputProps()} />
            <CloudArrowUpIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            {isDragActive ? (
              <p className="text-blue-600 dark:text-blue-400">Drop the files here...</p>
            ) : (
              <div>
                <p className="text-muted-foreground mb-2">
                  Drag and drop PDF files here, or click to select files
                </p>
                <p className="text-sm text-muted-foreground">
                  Maximum file size: 50MB per file
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* File List */}
      {files.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Upload Queue ({files.length} files)</CardTitle>
              <CardDescription>
                Configure metadata for each file before uploading
              </CardDescription>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={clearCompleted}
                disabled={!files.some(f => f.status === 'completed')}
              >
                Clear Completed
              </Button>
              <Button
                onClick={uploadFiles}
                disabled={isUploading || files.length === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isUploading ? 'Uploading...' : 'Upload All'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isUploading && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Upload Progress</span>
                  <span className="text-sm text-muted-foreground">{Math.round(uploadProgress)}%</span>
                </div>
                <Progress value={uploadProgress} className="w-full" />
              </div>
            )}
            
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {files.map((file) => (
                <FileUploadItem
                  key={file.id}
                  file={file}
                  materialTypes={materialTypes}
                  subjects={subjects}
                  studyMaterialTypes={studyMaterialTypes}
                  onUpdate={(data) => updateFileMetadata(file.id, data)}
                  onRemove={() => removeFile(file.id)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Individual file upload item component
interface FileUploadItemProps {
  file: UploadFile
  materialTypes: { value: string; label: string }[]
  subjects: string[]
  studyMaterialTypes: string[]
  onUpdate: (data: Partial<MaterialUploadData>) => void
  onRemove: () => void
}

function FileUploadItem({ file, materialTypes, subjects, studyMaterialTypes, onUpdate, onRemove }: FileUploadItemProps) {
  const getStatusIcon = () => {
    switch (file.status) {
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />
      case 'error':
        return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
      case 'uploading':
        return <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
      default:
        return <DocumentTextIcon className="h-5 w-5 text-muted-foreground" />
    }
  }

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {getStatusIcon()}
          <div>
            <p className="font-medium text-sm">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {(file.size / 1024 / 1024).toFixed(1)} MB
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={
            file.status === 'completed' ? 'default' :
            file.status === 'error' ? 'destructive' :
            file.status === 'uploading' ? 'secondary' : 'outline'
          }>
            {file.status}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            disabled={file.status === 'uploading'}
          >
            <XMarkIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {file.error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
          {file.error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <Label htmlFor={`title-${file.id}`}>Title *</Label>
          <Input
            id={`title-${file.id}`}
            value={file.uploadData.title || ''}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Enter material title"
            disabled={file.status === 'uploading' || file.status === 'completed'}
          />
        </div>

        <div>
          <Label htmlFor={`subject-${file.id}`}>Subject *</Label>
          <Select 
            value={file.uploadData.subject || ''} 
            onValueChange={(value) => onUpdate({ subject: value })}
            disabled={file.status === 'uploading' || file.status === 'completed'}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select subject" />
            </SelectTrigger>
            <SelectContent>
              {subjects.map(subject => (
                <SelectItem key={subject} value={subject}>{subject}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor={`type-${file.id}`}>Type *</Label>
          <Select
            value={file.uploadData.type || ''}
            onValueChange={(value) => onUpdate({ type: value as any })}
            disabled={file.status === 'uploading' || file.status === 'completed'}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {materialTypes.map(type => (
                <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor={`sm-type-${file.id}`}>SM Type</Label>
          <Select
            value={file.uploadData.smType || ''}
            onValueChange={(value) => onUpdate({ smType: value as any })}
            disabled={file.status === 'uploading' || file.status === 'completed'}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select SM type" />
            </SelectTrigger>
            <SelectContent>
              {studyMaterialTypes.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor={`description-${file.id}`}>Description</Label>
        <Textarea
          id={`description-${file.id}`}
          value={file.uploadData.description || ''}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="Enter material description"
          rows={2}
          disabled={file.status === 'uploading' || file.status === 'completed'}
        />
      </div>
    </div>
  )
}
