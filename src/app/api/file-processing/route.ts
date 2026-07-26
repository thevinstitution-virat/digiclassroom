import { NextRequest, NextResponse } from 'next/server'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
// Legacy dependency removed: pdf-parse

// File processing configuration
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = {
  'application/pdf': 'pdf',
  'image/jpeg': 'image',
  'image/jpg': 'image', 
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image'
}

interface ProcessingResult {
  success: boolean
  data?: {
    text: string
    metadata: {
      fileName: string
      fileType: string
      fileSize: number
      pageCount?: number
      confidence?: number
      processingTime: number
    }
  }
  error?: string
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now()

  try {
    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const options = formData.get('options') ? JSON.parse(formData.get('options') as string) : {}

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file
    const validation = validateFile(file)
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      )
    }

    // Process file based on type
    const fileType = ALLOWED_TYPES[file.type as keyof typeof ALLOWED_TYPES]
    let result: ProcessingResult

    if (fileType === 'pdf') {
      result = await processPDF(file, options)
    } else if (fileType === 'image') {
      result = await processImage(file, options)
    } else {
      return NextResponse.json(
        { success: false, error: 'Unsupported file type' },
        { status: 400 }
      )
    }

    // Add processing time
    if (result.success && result.data) {
      result.data.metadata.processingTime = Date.now() - startTime
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('File processing error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Processing failed' 
      },
      { status: 500 }
    )
  }
}

function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`
    }
  }

  // Check file type
  if (!Object.keys(ALLOWED_TYPES).includes(file.type)) {
    return {
      valid: false,
      error: 'Unsupported file type. Allowed: PDF, JPEG, PNG, GIF, WebP'
    }
  }

  return { valid: true }
}

async function processPDF(file: File, options: any): Promise<ProcessingResult> {
  // Endpoint deprecated during migration to doc-extract-engine
  return {
    success: false,
    error: 'PDF processing via /api/file-processing is deprecated. Use /api/super-admin/content/upload for doc-extract-engine processing.'
  }
}

async function processImage(file: File, options: any): Promise<ProcessingResult> {
  try {
    // For server-side OCR, we'll use a different approach
    // This could integrate with cloud services like Google Vision API, AWS Textract, etc.
    
    // For now, we'll return a placeholder that indicates client-side processing is needed
    return {
      success: true,
      data: {
        text: '[OCR_PLACEHOLDER]', // Special marker for client-side processing
        metadata: {
          fileName: file.name,
          fileType: 'image',
          fileSize: file.size,
          processingTime: 0
        }
      }
    }

  } catch (error) {
    console.error('Image processing error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Image processing failed'
    }
  }
}

function cleanPDFText(text: string): string {
  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove page numbers and headers/footers (basic patterns)
    .replace(/^\d+\s*$/gm, '')
    // Remove common PDF artifacts
    .replace(/\f/g, '\n') // Form feed to newline
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\r/g, '\n')
    // Remove excessive newlines
    .replace(/\n{3,}/g, '\n\n')
    // Trim whitespace
    .trim()
}

async function ensureTmpDirectory(): Promise<void> {
  const tmpDir = join(process.cwd(), 'tmp')
  try {
    const { mkdir } = await import('fs/promises')
    await mkdir(tmpDir, { recursive: true })
  } catch (error) {
    // Directory might already exist
    console.log('Tmp directory setup:', error)
  }
}

// Health check endpoint
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'healthy',
    supportedTypes: Object.keys(ALLOWED_TYPES),
    maxFileSize: MAX_FILE_SIZE,
    timestamp: new Date().toISOString()
  })
}
