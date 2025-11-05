/**
 * Multi-modal input type definitions for the AI Tutor system
 */

import { VoiceCommandResult, VoiceProcessingResult } from './voice'

export interface MultiModalInput {
  text?: string
  voice?: VoiceInput
  file?: FileInput
  timestamp: Date
  sessionId: string
  userId: string
}

export interface VoiceInput {
  audioBlob: Blob
  transcription?: string
  command?: VoiceCommandResult
  processingResult?: VoiceProcessingResult
  duration: number
  language: string
}

export interface FileInput {
  file: File
  type: FileType
  processingResult?: FileProcessingResult
  metadata: FileMetadata
}

export type FileType = 'document' | 'image' | 'audio' | 'video'

export interface FileMetadata {
  name: string
  size: number
  mimeType: string
  uploadedAt: Date
  processingStarted?: Date
  processingCompleted?: Date
}

export interface FileProcessingResult {
  success: boolean
  data?: {
    text?: string
    confidence?: number
    metadata?: ProcessingMetadata
    extractedElements?: ExtractedElement[]
  }
  error?: string
  processingTime: number
}

export interface ProcessingMetadata {
  fileName: string
  fileSize: number
  fileType: string
  pageCount?: number
  language?: string
  ocrEngine?: string
  processingMethod: 'ocr' | 'pdf_parse' | 'document_parse'
}

export interface ExtractedElement {
  type: 'text' | 'image' | 'table' | 'formula' | 'diagram'
  content: string
  confidence: number
  boundingBox?: BoundingBox
  metadata?: Record<string, any>
}

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

export interface MultiModalProcessingState {
  text: {
    isProcessing: boolean
    hasContent: boolean
  }
  voice: {
    isRecording: boolean
    isProcessing: boolean
    hasResult: boolean
  }
  file: {
    isUploading: boolean
    isProcessing: boolean
    hasResult: boolean
    progress: number
  }
  combined: {
    isReady: boolean
    canSubmit: boolean
    processingStage?: 'input' | 'analysis' | 'integration' | 'ai_processing'
  }
}

export interface MultiModalSubmission {
  text: string
  file?: File
  voiceCommand?: VoiceCommandResult
  isVoiceInput: boolean
  combinedContext?: CombinedContext
  educationalIntent?: EducationalIntent
}

export interface CombinedContext {
  textContent: string
  fileContent?: string
  voiceCommand?: string
  userIntent: UserIntent
  educationalContext: EducationalContext
}

export interface UserIntent {
  primary: 'question' | 'explanation' | 'practice' | 'assessment' | 'exploration'
  secondary?: string[]
  confidence: number
  detectedFrom: ('text' | 'voice' | 'file')[]
}

export interface EducationalContext {
  subject: string
  topic?: string
  classLevel: string
  userRole: 'student' | 'teacher' | 'parent'
  curriculum: 'cbse' | 'icse' | 'state'
  learningObjective?: string
  bloomsLevel?: 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create'
}

export interface EducationalIntent {
  type: 'learn' | 'practice' | 'assess' | 'explore' | 'create'
  subject: string
  topic?: string
  difficulty: 'basic' | 'intermediate' | 'advanced'
  format: 'explanation' | 'examples' | 'quiz' | 'summary' | 'analysis'
}

export interface MultiModalResponse {
  text: string
  attachments?: ResponseAttachment[]
  suggestions?: ActionSuggestion[]
  educationalValue: EducationalValue
  metadata: ResponseMetadata
}

export interface ResponseAttachment {
  type: 'image' | 'document' | 'audio' | 'interactive'
  url?: string
  content?: string
  description: string
}

export interface ActionSuggestion {
  type: 'voice_command' | 'file_upload' | 'text_input' | 'navigation'
  label: string
  description: string
  action: string
  parameters?: Record<string, any>
}

export interface EducationalValue {
  relevance: number // 0-1
  accuracy: number // 0-1
  pedagogicalQuality: number // 0-1
  ageAppropriateness: number // 0-1
  curriculumAlignment: number // 0-1
}

export interface ResponseMetadata {
  processingTime: number
  sourcesUsed: string[]
  confidenceScore: number
  educationalLevel: string
  bloomsTaxonomy: string[]
  suggestedFollowUp: string[]
}

export interface MultiModalAnalytics {
  sessionId: string
  userId: string
  timestamp: Date
  inputTypes: ('text' | 'voice' | 'file')[]
  processingMetrics: {
    totalTime: number
    voiceProcessingTime?: number
    fileProcessingTime?: number
    aiResponseTime: number
  }
  userEngagement: {
    inputLength: number
    voiceDuration?: number
    fileSize?: number
    interactionComplexity: number
  }
  educationalMetrics: {
    topicCoverage: string[]
    skillsAddressed: string[]
    learningOutcomes: string[]
    assessmentResults?: AssessmentResult[]
  }
}

export interface AssessmentResult {
  skill: string
  level: 'novice' | 'developing' | 'proficient' | 'advanced'
  confidence: number
  evidence: string[]
  recommendations: string[]
}

export interface MultiModalError {
  type: 'input_error' | 'processing_error' | 'integration_error' | 'ai_error'
  component: 'text' | 'voice' | 'file' | 'combined'
  message: string
  details?: any
  recoverable: boolean
  suggestedAction?: string
}

export interface MultiModalSettings {
  voice: {
    enabled: boolean
    autoTranscribe: boolean
    commandDetection: boolean
    language: string
  }
  file: {
    enabled: boolean
    autoProcess: boolean
    maxSize: number
    allowedTypes: string[]
  }
  integration: {
    autoSubmitVoiceCommands: boolean
    combineInputs: boolean
    showProcessingSteps: boolean
  }
  ui: {
    showSuggestions: boolean
    enableDragDrop: boolean
    visualFeedback: boolean
  }
}
