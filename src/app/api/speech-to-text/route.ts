import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

// Note: Speech-to-text functionality disabled - OpenAI Whisper removed
// Alternative: Use browser's built-in Web Speech API or other speech services

export const runtime = 'nodejs'

// Configuration
const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB (OpenAI Whisper limit)
const SUPPORTED_FORMATS = [
  'audio/wav',
  'audio/mp3', 
  'audio/m4a',
  'audio/webm',
  'audio/ogg',
  'audio/flac'
]

interface SpeechToTextResult {
  success: boolean
  data?: {
    text: string
    language: string
    confidence: number
    duration: number
    segments?: Array<{
      text: string
      start: number
      end: number
    }>
  }
  error?: string
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    console.log('🎤 Speech-to-text API called - Feature disabled')

    // Authentication check
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Return not implemented response
    return NextResponse.json(
      {
        success: false,
        error: 'Speech-to-text feature temporarily disabled',
        message: 'OpenAI Whisper has been removed. Please use browser-based speech recognition or contact support for alternatives.',
        alternatives: [
          'Use browser Web Speech API',
          'Type your question directly',
          'Upload text files instead'
        ]
      },
      { status: 501 }
    )

  } catch (error) {
    console.error('❌ Speech-to-text error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Speech-to-text feature disabled',
        message: error instanceof Error ? error.message : 'Service not available'
      },
      { status: 501 }
    )
  }
}

// Validate audio file
function validateAudioFile(file: File): { valid: boolean; error?: string } {
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
      error: `Unsupported audio format. Supported formats: ${SUPPORTED_FORMATS.join(', ')}`
    }
  }

  return { valid: true }
}

// Process audio with OpenAI Whisper
// Note: OpenAI Whisper processing removed - feature disabled

// Health check endpoint
export async function GET(): Promise<NextResponse> {
  try {
    const { userId } = await auth()
    
    return NextResponse.json({
      status: 'healthy',
      message: 'Speech-to-Text API is running',
      authenticated: !!userId,
      supportedFormats: SUPPORTED_FORMATS,
      maxFileSize: MAX_FILE_SIZE,
      supportedLanguages: ['auto', 'en', 'hi'],
      features: [
        'OpenAI Whisper integration',
        'Multiple audio formats',
        'Hindi and English support',
        'Auto language detection',
        'Segment timestamps',
        'Educational context optimization',
        'Development fallback'
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
