'use client'

// Enhanced File Processing Service with OCR and Multi-format Support
export interface SupportedFileType {
  extension: string
  mimeType: string
  category: 'document' | 'image' | 'audio' | 'video'
  icon: string
  maxSize: number // in bytes
  description: string
}

export interface FileProcessingOptions {
  enableOCR: boolean
  enableSummarization: boolean
  extractImages: boolean
  preserveFormatting: boolean
  language: string
  compressionLevel: number
}

export interface FileProcessingResult {
  success: boolean
  fileName: string
  fileType: string
  fileSize: number
  content: {
    text: string
    summary?: string
    images?: string[]
    metadata: Record<string, any>
  }
  processingTime: number
  error?: string
}

export interface FilePreview {
  fileName: string
  fileType: string
  fileSize: number
  thumbnail?: string
  pageCount?: number
  duration?: number
  dimensions?: { width: number; height: number }
}

export interface BatchProcessingResult {
  totalFiles: number
  processedFiles: number
  failedFiles: number
  results: FileProcessingResult[]
  totalProcessingTime: number
}

export class EnhancedFileService {
  // Supported file types for educational content
  public readonly supportedFileTypes: SupportedFileType[] = [
    // Documents
    {
      extension: 'pdf',
      mimeType: 'application/pdf',
      category: 'document',
      icon: '📄',
      maxSize: 50 * 1024 * 1024, // 50MB
      description: 'PDF Document'
    },
    {
      extension: 'docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      category: 'document',
      icon: '📝',
      maxSize: 25 * 1024 * 1024, // 25MB
      description: 'Word Document'
    },
    {
      extension: 'pptx',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      category: 'document',
      icon: '📊',
      maxSize: 100 * 1024 * 1024, // 100MB
      description: 'PowerPoint Presentation'
    },
    {
      extension: 'txt',
      mimeType: 'text/plain',
      category: 'document',
      icon: '📃',
      maxSize: 5 * 1024 * 1024, // 5MB
      description: 'Text File'
    },
    // Images
    {
      extension: 'jpg',
      mimeType: 'image/jpeg',
      category: 'image',
      icon: '🖼️',
      maxSize: 10 * 1024 * 1024, // 10MB
      description: 'JPEG Image'
    },
    {
      extension: 'png',
      mimeType: 'image/png',
      category: 'image',
      icon: '🖼️',
      maxSize: 10 * 1024 * 1024, // 10MB
      description: 'PNG Image'
    },
    {
      extension: 'webp',
      mimeType: 'image/webp',
      category: 'image',
      icon: '🖼️',
      maxSize: 10 * 1024 * 1024, // 10MB
      description: 'WebP Image'
    },
    // Audio
    {
      extension: 'mp3',
      mimeType: 'audio/mpeg',
      category: 'audio',
      icon: '🎵',
      maxSize: 50 * 1024 * 1024, // 50MB
      description: 'MP3 Audio'
    },
    {
      extension: 'wav',
      mimeType: 'audio/wav',
      category: 'audio',
      icon: '🎵',
      maxSize: 100 * 1024 * 1024, // 100MB
      description: 'WAV Audio'
    },
    {
      extension: 'm4a',
      mimeType: 'audio/m4a',
      category: 'audio',
      icon: '🎵',
      maxSize: 50 * 1024 * 1024, // 50MB
      description: 'M4A Audio'
    }
  ]

  // Validate file type and size
  validateFile(file: File): { valid: boolean; error?: string; fileType?: SupportedFileType } {
    const extension = file.name.split('.').pop()?.toLowerCase()
    
    if (!extension) {
      return { valid: false, error: 'File has no extension' }
    }

    const fileType = this.supportedFileTypes.find(type => type.extension === extension)
    
    if (!fileType) {
      return { 
        valid: false, 
        error: `Unsupported file type: .${extension}. Supported types: ${this.supportedFileTypes.map(t => t.extension).join(', ')}` 
      }
    }

    if (file.size > fileType.maxSize) {
      return { 
        valid: false, 
        error: `File too large. Maximum size for ${fileType.description}: ${this.formatFileSize(fileType.maxSize)}` 
      }
    }

    return { valid: true, fileType }
  }

  // Generate file preview
  async generatePreview(file: File): Promise<FilePreview> {
    const extension = file.name.split('.').pop()?.toLowerCase()
    const fileType = this.supportedFileTypes.find(type => type.extension === extension)

    const preview: FilePreview = {
      fileName: file.name,
      fileType: fileType?.description || 'Unknown',
      fileSize: file.size
    }

    try {
      if (fileType?.category === 'image') {
        preview.thumbnail = await this.generateImageThumbnail(file)
        preview.dimensions = await this.getImageDimensions(file)
      } else if (fileType?.category === 'audio') {
        preview.duration = await this.getAudioDuration(file)
      } else if (extension === 'pdf') {
        preview.pageCount = await this.getPDFPageCount(file)
        preview.thumbnail = await this.generatePDFThumbnail(file)
      }
    } catch (error) {
      console.warn('⚠️ Failed to generate preview:', error)
    }

    return preview
  }

  // Generate image thumbnail
  private async generateImageThumbnail(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()

      img.onload = () => {
        const maxSize = 200
        const ratio = Math.min(maxSize / img.width, maxSize / img.height)
        
        canvas.width = img.width * ratio
        canvas.height = img.height * ratio

        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }

      img.onerror = reject
      img.src = URL.createObjectURL(file)
    })
  }

  // Get image dimensions
  private async getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      
      img.onload = () => {
        resolve({ width: img.width, height: img.height })
        URL.revokeObjectURL(img.src)
      }

      img.onerror = reject
      img.src = URL.createObjectURL(file)
    })
  }

  // Get audio duration
  private async getAudioDuration(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
      const audio = new Audio()
      
      audio.onloadedmetadata = () => {
        resolve(audio.duration)
        URL.revokeObjectURL(audio.src)
      }

      audio.onerror = reject
      audio.src = URL.createObjectURL(file)
    })
  }

  // Get PDF page count (simplified - would need PDF.js in production)
  private async getPDFPageCount(file: File): Promise<number> {
    // This is a simplified implementation
    // In production, you would use PDF.js or similar library
    return Math.ceil(file.size / 50000) // Rough estimate
  }

  // Generate PDF thumbnail (simplified)
  private async generatePDFThumbnail(file: File): Promise<string> {
    // This is a placeholder - in production, you would use PDF.js
    // to render the first page as a thumbnail
    return '/icons/pdf-thumbnail.png'
  }

  // Process single file
  async processFile(file: File, options: Partial<FileProcessingOptions> = {}): Promise<FileProcessingResult> {
    const startTime = Date.now()
    
    try {
      console.log(`📁 Processing file: ${file.name}`)

      // Validate file
      const validation = this.validateFile(file)
      if (!validation.valid) {
        throw new Error(validation.error)
      }

      const defaultOptions: FileProcessingOptions = {
        enableOCR: true,
        enableSummarization: true,
        extractImages: false,
        preserveFormatting: true,
        language: 'en',
        compressionLevel: 0.8
      }

      const finalOptions = { ...defaultOptions, ...options }

      // Send file to content upload API (replaced deprecated file-processing)
      const formData = new FormData()
      formData.append('file', file)
      formData.append('metadata', JSON.stringify({
        subject: 'General',
        class: 'Mixed',
        board: 'General',
        medium: 'English'
      }))

      const response = await fetch('/api/admin/content/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error(`Content upload API error: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'File processing failed')
      }

      const processingTime = Date.now() - startTime

      const processedResult: FileProcessingResult = {
        success: true,
        fileName: file.name,
        fileType: validation.fileType!.description,
        fileSize: file.size,
        content: result.data,
        processingTime
      }

      console.log(`✅ File processed successfully: ${file.name} (${processingTime}ms)`)
      return processedResult

    } catch (error) {
      const processingTime = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      console.error(`❌ File processing failed: ${file.name}`, error)

      return {
        success: false,
        fileName: file.name,
        fileType: 'Unknown',
        fileSize: file.size,
        content: {
          text: '',
          metadata: {}
        },
        processingTime,
        error: errorMessage
      }
    }
  }

  // Process multiple files in batch
  async processBatch(files: File[], options: Partial<FileProcessingOptions> = {}): Promise<BatchProcessingResult> {
    const startTime = Date.now()
    console.log(`📁 Processing batch of ${files.length} files`)

    const results: FileProcessingResult[] = []
    let processedFiles = 0
    let failedFiles = 0

    // Process files concurrently with limit
    const concurrencyLimit = 3
    const chunks = this.chunkArray(files, concurrencyLimit)

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(file => this.processFile(file, options))
      const chunkResults = await Promise.all(chunkPromises)
      
      results.push(...chunkResults)
      
      chunkResults.forEach(result => {
        if (result.success) {
          processedFiles++
        } else {
          failedFiles++
        }
      })
    }

    const totalProcessingTime = Date.now() - startTime

    const batchResult: BatchProcessingResult = {
      totalFiles: files.length,
      processedFiles,
      failedFiles,
      results,
      totalProcessingTime
    }

    console.log(`✅ Batch processing complete: ${processedFiles}/${files.length} files processed (${totalProcessingTime}ms)`)
    return batchResult
  }

  // OCR processing for images
  async performOCR(file: File, language: string = 'eng'): Promise<string> {
    try {
      console.log(`🔍 Performing OCR on: ${file.name}`)

      const formData = new FormData()
      formData.append('image', file)
      formData.append('language', language)

      const response = await fetch('/api/ocr', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error(`OCR API error: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'OCR processing failed')
      }

      console.log(`✅ OCR completed for: ${file.name}`)
      return result.data.text

    } catch (error) {
      console.error(`❌ OCR failed for: ${file.name}`, error)
      throw error
    }
  }

  // Utility functions
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }

  // Get supported file types by category
  getFileTypesByCategory(category: 'document' | 'image' | 'audio' | 'video'): SupportedFileType[] {
    return this.supportedFileTypes.filter(type => type.category === category)
  }

  // Get file type info
  getFileTypeInfo(extension: string): SupportedFileType | undefined {
    return this.supportedFileTypes.find(type => type.extension === extension.toLowerCase())
  }

  // Check if file type supports OCR
  supportsOCR(file: File): boolean {
    const extension = file.name.split('.').pop()?.toLowerCase()
    const fileType = this.getFileTypeInfo(extension || '')
    return fileType?.category === 'image' || extension === 'pdf'
  }

  // Get maximum file size for type
  getMaxFileSize(extension: string): number {
    const fileType = this.getFileTypeInfo(extension)
    return fileType?.maxSize || 5 * 1024 * 1024 // Default 5MB
  }
}

// Export singleton instance
export const enhancedFileService = new EnhancedFileService()
