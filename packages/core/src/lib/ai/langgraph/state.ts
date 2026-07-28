export interface TutorGraphState {
  query: string
  userId?: string // For A/B testing
  studentProfile: {
    board?: string
    classLevel?: string
    subject?: string
    medium?: string
  }
  routingIntent?: {
    type: string
    complexity: string
    requiresMultipleChunks: boolean
    estimatedTokens: number
    cacheStrategy: string
    optimalChunkCount: number
  }
  analysis?: {
    entities: string[]
    curriculumContext: {
      board?: string
      classLevel?: string
      subject?: string
    }
    intent: string
    multiQueries: string[]
  }
  retrievedChunks?: Array<{
    id: string
    text: string
    metadata: Record<string, unknown>
    score: number
  }>
  rankedChunks?: Array<{
    id: string
    text: string
    metadata: Record<string, unknown>
    score: number
  }>
  generation?: {
    directAnswer: string
    explanationSteps: string[]
    keyTerms: Array<{ term: string; definition: string; citation?: string }>
    questionAnalysis?: any
    raw?: unknown
  }
  draftAnswer?: string
  hallucinationReport?: {
    supported: boolean
    unsupportedClaims: string[]
  }
  finalAnswer?: string
  metadata?: {
    cached?: boolean
    cacheKey?: string
    promptContexts?: Array<{
      id: string
      text: string
      metadata: Record<string, unknown>
      score: number
    }>
    questionAnalysis?: any
    generationError?: string
    rawResponse?: string
    regenerationAttempt?: number
    regenerationReason?: string[]
    ragasScores?: {
      faithfulness: number | null
      relevance: number | null
      contextPrecision: number | null
      contextRecall: number | null
    }
    [key: string]: unknown
  }
}
