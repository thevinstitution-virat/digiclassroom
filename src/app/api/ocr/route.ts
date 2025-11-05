import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
// Legacy dependency removed: tesseract.js

export const runtime = 'nodejs'

// Configuration
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const SUPPORTED_FORMATS = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/tiff'
]

interface OCRResult {
  success: boolean
  data?: {
    text: string
    confidence: number
    words: Array<{
      text: string
      confidence: number
      bbox: {
        x0: number
        y0: number
        x1: number
        y1: number
      }
    }>
    metadata: {
      fileName: string
      fileSize: number
      processingTime: number
      language: string
    }
  }
  error?: string
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const startTime = Date.now()

  try {
    // Authentication check
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse form data
    const formData = await req.formData()
    const imageFile = formData.get('image') as File
    const language = formData.get('language') as string || 'eng'
    const options = formData.get('options') ? JSON.parse(formData.get('options') as string) : {}

    if (!imageFile) {
      return NextResponse.json(
        { success: false, error: 'No image file provided' },
        { status: 400 }
      )
    }

    // Validate file
    const validation = validateImageFile(imageFile)
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      )
    }

    console.log('🖼️ Processing image file:', {
      name: imageFile.name,
      size: imageFile.size,
      type: imageFile.type,
      language,
      userId
    })

    // Endpoint deprecated
    return NextResponse.json({ success: false, error: 'OCR endpoint is deprecated during migration to doc-extract-engine' }, { status: 410 })

  } catch (error) {
    console.error('❌ OCR processing error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'OCR processing failed' 
      },
      { status: 500 }
    )
  }
}

// Validate image file
function validateImageFile(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`
    }
  }

  // Check file type
  if (!SUPPORTED_FORMATS.includes(file.type)) {
    return {
      valid: false,
      error: `Unsupported image format. Supported formats: ${SUPPORTED_FORMATS.join(', ')}`
    }
  }

  return { valid: true }
}

// OCR API is deprecated as part of migration to doc-extract-engine; returns 410
async function processWithTesseract(
  imageFile: File,
  language: string,
  options: any = {}
): Promise<OCRResult> {
  return {
    success: false,
    error: 'OCR API is deprecated during migration to doc-extract-engine',
  } as any
}

// Health check endpoint
export async function GET(): Promise<NextResponse> {
  try {
    const { userId } = await auth()
    
    return NextResponse.json({
      status: 'healthy',
      message: 'OCR API is running',
      authenticated: !!userId,
      supportedFormats: SUPPORTED_FORMATS,
      maxFileSize: MAX_FILE_SIZE,
      supportedLanguages: [
        'eng', 'hin', 'san', 'ben', 'guj', 'kan', 'mal', 'mar', 'ori', 'pan', 'tam', 'tel', 'urd'
      ],
      features: [
        'Deprecated OCR endpoint',
        'Multiple image formats',
        'Indian language support',
        'Word-level confidence',
        'Bounding box coordinates'
      ],
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'error',
        message: 'Health check failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
