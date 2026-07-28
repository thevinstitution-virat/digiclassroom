/**
 * Voice-related type definitions for the AI Tutor system
 */

export interface VoiceRecordingState {
  isRecording: boolean
  isPaused: boolean
  isProcessing: boolean
  duration: number
  audioLevel: number
  error?: string
}

export interface VoiceProcessingOptions {
  language: string
  enableNoiseReduction: boolean
  enableVolumeNormalization: boolean
  enableVoiceActivityDetection: boolean
  maxRecordingDuration: number
  chunkSize: number
}

export interface VoiceProcessingResult {
  success: boolean
  data?: {
    text: string
    confidence: number
    language: string
    duration: number
    segments?: VoiceSegment[]
  }
  error?: string
}

export interface VoiceSegment {
  text: string
  start: number
  end: number
  confidence: number
}

export interface SpeechToTextOptions {
  language?: string
  continuous?: boolean
  interimResults?: boolean
  maxAlternatives?: number
  onStart?: () => void
  onResult?: (result: string, isFinal: boolean) => void
  onError?: (error: string) => void
  onEnd?: () => void
}

export interface SpeechToTextResult {
  success: boolean
  data?: {
    text: string
    confidence: number
    alternatives?: string[]
    language?: string
    duration?: number
  }
  error?: string
}

export interface VoiceCommand {
  id: string
  patterns: string[]
  action: string
  description: string
  category: 'explanation' | 'quiz' | 'summary' | 'navigation' | 'file' | 'general'
  requiresContext?: boolean
  cbseLevel?: string[]
  parameters?: Record<string, any>
}

export interface VoiceCommandResult {
  command: VoiceCommand | null
  confidence: number
  extractedText?: string
  parameters?: Record<string, any>
  isEducationalCommand?: boolean
}

export interface VoiceActivityDetection {
  isActive: boolean
  threshold: number
  silenceDuration: number
  maxSilenceDuration: number
}

export interface AudioVisualization {
  enabled: boolean
  fftSize: number
  smoothingTimeConstant: number
  frequencyData: Uint8Array
  volumeLevel: number
}

export interface VoiceUIState {
  recording: VoiceRecordingState
  processing: {
    isActive: boolean
    stage: 'transcription' | 'command_detection' | 'ai_processing'
    progress: number
  }
  visualization: AudioVisualization
  commands: {
    available: VoiceCommand[]
    suggestions: string[]
    lastDetected?: VoiceCommandResult
  }
}

export interface VoiceSettings {
  language: string
  autoSubmitCommands: boolean
  showVisualizer: boolean
  enableVoiceActivityDetection: boolean
  noiseReduction: boolean
  volumeNormalization: boolean
  maxRecordingDuration: number
  silenceTimeout: number
}

export interface VoiceError {
  type: 'permission_denied' | 'not_supported' | 'network_error' | 'processing_error' | 'timeout'
  message: string
  details?: any
  recoverable: boolean
  retryAfter?: number
}

export interface VoiceMetrics {
  recordingDuration: number
  processingTime: number
  transcriptionAccuracy: number
  commandDetectionAccuracy: number
  audioQuality: number
  networkLatency: number
}

// Educational context types
export interface EducationalVoiceContext {
  userRole: 'student' | 'teacher' | 'parent'
  classLevel: string
  subject: string
  currentTopic?: string
  hasUploadedFile: boolean
  conversationHistory: string[]
  learningObjectives?: string[]
  curriculum: 'cbse' | 'icse' | 'state'
}

export interface VoiceEducationalCommand extends VoiceCommand {
  educationalContext: {
    bloomsLevel: 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create'
    subjectAreas: string[]
    gradeRelevance: string[]
    pedagogicalIntent: 'explanation' | 'assessment' | 'practice' | 'exploration'
  }
}

export interface VoiceInteractionAnalytics {
  sessionId: string
  userId: string
  timestamp: Date
  voiceCommand?: VoiceCommandResult
  transcriptionResult: SpeechToTextResult
  aiResponse: string
  userSatisfaction?: number
  educationalValue?: number
  technicalQuality: VoiceMetrics
}
