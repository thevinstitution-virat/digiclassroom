// Services Configuration for VG Kosh

export interface ServiceConfig {
  ocr: {
    enabled: boolean
    languages: string[]
    confidenceThreshold: number
    maxFileSize: number
  }
  speechToText: {
    enabled: boolean
    defaultLanguage: string
    maxDuration: number
    maxFileSize: number
    provider: 'browser' | 'openai' | 'google' | 'azure' | 'assemblyai'
  }
  fileProcessing: {
    enabled: boolean
    maxFileSize: number
    allowedTypes: string[]
    tempDirectory: string
  }
  rateLimiting: {
    requestsPerMinute: number
    fileUploadsPerHour: number
  }
}

export const servicesConfig: ServiceConfig = {
  ocr: {
    enabled: process.env.ENABLE_OCR !== 'false',
    languages: (process.env.OCR_LANGUAGES || 'eng').split(','),
    confidenceThreshold: parseInt(process.env.OCR_CONFIDENCE_THRESHOLD || '30'),
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE_MB || '10') * 1024 * 1024
  },
  speechToText: {
    enabled: process.env.ENABLE_SPEECH_TO_TEXT !== 'false',
    defaultLanguage: process.env.STT_DEFAULT_LANGUAGE || 'en-US',
    maxDuration: parseInt(process.env.STT_MAX_DURATION_SECONDS || '300'),
    maxFileSize: parseInt(process.env.MAX_AUDIO_SIZE_MB || '25') * 1024 * 1024,
    provider: (process.env.STT_PROVIDER as any) || 'openai'
  },
  fileProcessing: {
    enabled: process.env.ENABLE_FILE_UPLOAD !== 'false',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE_MB || '10') * 1024 * 1024,
    allowedTypes: [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp'
    ],
    tempDirectory: process.env.TEMP_DIR || './tmp'
  },
  rateLimiting: {
    requestsPerMinute: parseInt(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE || '60'),
    fileUploadsPerHour: parseInt(process.env.RATE_LIMIT_FILE_UPLOADS_PER_HOUR || '20')
  }
}

// API Keys and Credentials
export const apiKeys = {
  googleCloud: {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    keyFile: process.env.GOOGLE_CLOUD_KEY_FILE
  },
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'us-east-1'
  },
  azure: {
    speechKey: process.env.AZURE_SPEECH_KEY,
    region: process.env.AZURE_SPEECH_REGION
  },
  assemblyAI: process.env.ASSEMBLYAI_API_KEY
}

// Feature flags
export const features = {
  ocr: process.env.ENABLE_OCR !== 'false',
  speechToText: process.env.ENABLE_SPEECH_TO_TEXT !== 'false',
  fileUpload: process.env.ENABLE_FILE_UPLOAD !== 'false',
  realTimeTranscription: process.env.ENABLE_REAL_TIME_TRANSCRIPTION !== 'false'
}

// Validation functions
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Check required environment variables
        // @ts-ignore
  if (features.speechToText && servicesConfig.speechToText.provider === 'openai' && !apiKeys.openai) {
    errors.push('OPENAI_API_KEY is required when using OpenAI speech-to-text')
  }

  if (features.speechToText && servicesConfig.speechToText.provider === 'google' && !apiKeys.googleCloud.projectId) {
    errors.push('GOOGLE_CLOUD_PROJECT_ID is required when using Google Cloud speech-to-text')
  }

  if (features.speechToText && servicesConfig.speechToText.provider === 'azure' && !apiKeys.azure.speechKey) {
    errors.push('AZURE_SPEECH_KEY is required when using Azure speech services')
  }

  if (features.speechToText && servicesConfig.speechToText.provider === 'assemblyai' && !apiKeys.assemblyAI) {
    errors.push('ASSEMBLYAI_API_KEY is required when using AssemblyAI')
  }

  // Validate file size limits
  if (servicesConfig.fileProcessing.maxFileSize > 100 * 1024 * 1024) {
    errors.push('MAX_FILE_SIZE_MB should not exceed 100MB for performance reasons')
  }

  if (servicesConfig.speechToText.maxFileSize > 100 * 1024 * 1024) {
    errors.push('MAX_AUDIO_SIZE_MB should not exceed 100MB for performance reasons')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

// Get service status
export function getServiceStatus() {
  return {
    ocr: {
      enabled: features.ocr,
      configured: true // Tesseract.js doesn't require API keys
    },
    speechToText: {
      enabled: features.speechToText,
      configured: servicesConfig.speechToText.provider === 'browser' || 
        // @ts-ignore
                 (servicesConfig.speechToText.provider === 'openai' && !!apiKeys.openai) ||
                 (servicesConfig.speechToText.provider === 'google' && !!apiKeys.googleCloud.projectId) ||
                 (servicesConfig.speechToText.provider === 'azure' && !!apiKeys.azure.speechKey) ||
                 (servicesConfig.speechToText.provider === 'assemblyai' && !!apiKeys.assemblyAI)
    },
    fileProcessing: {
      enabled: features.fileUpload,
      configured: true // No external dependencies required
    }
  }
}

// Export default configuration
export default servicesConfig
