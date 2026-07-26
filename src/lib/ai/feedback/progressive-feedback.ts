/**
 * Progressive Feedback System
 * Real-time retrieval feedback for enhanced user experience
 * 
 * Features:
 * - Stage-by-stage progress tracking
 * - Source preview before answer generation
 * - Confidence scoring
 * - Retrieval quality metrics
 * - User trust building
 */

export type FeedbackStage = 
  | 'routing'
  | 'cache-check'
  | 'analyzing'
  | 'searching'
  | 'ranking'
  | 'generating'
  | 'complete'
  | 'error'

export interface SourcePreview {
  bookTitle: string
  chapter: string
  section?: string
  page?: number
  relevance: number // 0-100
  snippet: string // First 100 chars
}

export interface RetrievalFeedback {
  stage: FeedbackStage
  message: string
  progress: number // 0-100
  
  // Stage-specific data
  routing?: {
    route: string
    complexity: string
    intent: string
  }
  
  cacheCheck?: {
    found: boolean
    similarity?: number
    source: 'exact' | 'semantic' | 'none'
  }
  
  analysis?: {
    entities: string[]
    intent: string
    multiQueries: number
  }
  
  search?: {
    chunksFound: number
    searchTime: number
    queriesExecuted: number
  }
  
  ranking?: {
    topSources: SourcePreview[]
    confidence: number // 0-100
    qualityScore: number // 0-100
  }
  
  generation?: {
    estimatedTokens: number
    streamingStarted: boolean
  }
  
  error?: {
    code: string
    message: string
    recoverable: boolean
  }
}

/**
 * Create feedback event for routing stage
 */
export function createRoutingFeedback(
  route: string,
  complexity: string,
  intent: string
): RetrievalFeedback {
  return {
    stage: 'routing',
    message: `Analyzing query complexity: ${complexity}`,
    progress: 10,
    routing: {
      route,
      complexity,
      intent
    }
  }
}

/**
 * Create feedback event for cache check stage
 */
export function createCacheCheckFeedback(
  found: boolean,
  similarity?: number,
  source: 'exact' | 'semantic' | 'none' = 'none'
): RetrievalFeedback {
  return {
    stage: 'cache-check',
    message: found 
      ? `Found cached answer (${similarity ? `${(similarity * 100).toFixed(0)}% match` : 'exact match'})`
      : 'No cached answer found, searching textbooks...',
    progress: 20,
    cacheCheck: {
      found,
      similarity,
      source
    }
  }
}

/**
 * Create feedback event for analysis stage
 */
export function createAnalysisFeedback(
  entities: string[],
  intent: string,
  multiQueries: number
): RetrievalFeedback {
  return {
    stage: 'analyzing',
    message: `Analyzing query: Found ${entities.length} key concepts`,
    progress: 30,
    analysis: {
      entities,
      intent,
      multiQueries
    }
  }
}

/**
 * Create feedback event for search stage
 */
export function createSearchFeedback(
  chunksFound: number,
  searchTime: number,
  queriesExecuted: number
): RetrievalFeedback {
  return {
    stage: 'searching',
    message: `Searching NCERT textbooks... Found ${chunksFound} relevant sections`,
    progress: 50,
    search: {
      chunksFound,
      searchTime,
      queriesExecuted
    }
  }
}

/**
 * Create feedback event for ranking stage
 */
export function createRankingFeedback(
  topSources: SourcePreview[],
  confidence: number,
  qualityScore: number
): RetrievalFeedback {
  return {
    stage: 'ranking',
    message: `Ranking sources by relevance... Confidence: ${confidence}%`,
    progress: 70,
    ranking: {
      topSources,
      confidence,
      qualityScore
    }
  }
}

/**
 * Create feedback event for generation stage
 */
export function createGenerationFeedback(
  estimatedTokens: number,
  streamingStarted: boolean = false
): RetrievalFeedback {
  return {
    stage: 'generating',
    message: streamingStarted 
      ? 'Generating answer...'
      : 'Preparing to generate answer...',
    progress: 80,
    generation: {
      estimatedTokens,
      streamingStarted
    }
  }
}

/**
 * Create feedback event for completion
 */
export function createCompleteFeedback(): RetrievalFeedback {
  return {
    stage: 'complete',
    message: 'Answer generated successfully',
    progress: 100
  }
}

/**
 * Create feedback event for error
 */
export function createErrorFeedback(
  code: string,
  message: string,
  recoverable: boolean = false
): RetrievalFeedback {
  return {
    stage: 'error',
    message: `Error: ${message}`,
    progress: 0,
    error: {
      code,
      message,
      recoverable
    }
  }
}

/**
 * Calculate confidence score based on retrieval quality
 */
export function calculateConfidence(
  chunks: Array<{ ranking?: any; score?: number }>,
  queryComplexity: string
): number {
  
  if (chunks.length === 0)
  return 0
  
  // Factor 1: Top chunk score (40% weight)
  const topScore = chunks[0]?.ranking?.finalScore || chunks[0]?.score || 0
  const topScoreContribution = topScore * 40
  
  // Factor 2: Number of high-quality chunks (30% weight)
  const highQualityChunks = chunks.filter(c => 
    (c.ranking?.finalScore || c.score || 0) > 0.7
  ).length
  const qualityCountContribution = Math.min(highQualityChunks / 3, 1) * 30
  
  // Factor 3: Completeness scores (20% weight)
  const avgCompleteness = chunks.reduce((sum, c) => 
    sum + (c.ranking?.completenessScore || 0), 0
  ) / chunks.length
  const completenessContribution = avgCompleteness * 100 * 0.20
  
  // Factor 4: Query complexity adjustment (10% weight)
  let complexityAdjustment = 10
  if (queryComplexity === 'simple' && chunks.length >= 2) {
    complexityAdjustment = 10 // Full confidence for simple queries
  } else if (queryComplexity === 'moderate' && chunks.length >= 3) {
    complexityAdjustment = 8
  } else if (queryComplexity === 'complex' && chunks.length >= 5) {
    complexityAdjustment = 6
  } else {
    complexityAdjustment = 4 // Lower confidence if insufficient chunks
  }
  
  const totalConfidence = 
    topScoreContribution +
    qualityCountContribution +
    completenessContribution +
    complexityAdjustment
  
  return Math.round(Math.min(totalConfidence, 100))
}

/**
 * Calculate quality score based on ranking metrics
 */
export function calculateQualityScore(
  chunks: Array<{ ranking?: any; score?: number }>
): number {
  
  if (chunks.length === 0)
  return 0
  
  // Average of top 3 chunks' final scores
  const top3 = chunks.slice(0, 3)
  const avgScore = top3.reduce((sum, c) => 
    sum + (c.ranking?.finalScore || c.score || 0), 0
  ) / top3.length
  
  return Math.round(avgScore * 100)
}

/**
 * Create source preview from chunk
 */
export function createSourcePreview(
  chunk: {
    text: string
    metadata: Record<string, any>
    ranking?: any
    score?: number
  }
): SourcePreview {
  
  const metadata = chunk.metadata || {}
  const relevance = Math.round((chunk.ranking?.finalScore || chunk.score || 0) * 100)
  
  // Extract snippet (first 100 chars)
  const snippet = chunk.text.substring(0, 100).trim() + '...'
  
  return {
    bookTitle: metadata.bookTitle || metadata.book_title || 'NCERT Textbook',
    chapter: metadata.chapter || metadata.chapter_title || 'Unknown Chapter',
    section: metadata.section || metadata.section_title,
    page: metadata.page || metadata.page_number,
    relevance,
    snippet
  }
}

/**
 * Format feedback as Server-Sent Event
 */
export function formatAsSSE(feedback: RetrievalFeedback): string {
  return `data: ${JSON.stringify(feedback)}\n\n`
}

/**
 * Send feedback via response stream
 */
export function sendFeedback(
  encoder: TextEncoder,
  controller: ReadableStreamDefaultController,
  feedback: RetrievalFeedback
): void {
  try {
    const sseData = formatAsSSE(feedback)
    controller.enqueue(encoder.encode(sseData))
  } catch (error) {
    console.error('[Progressive Feedback] Error sending feedback:', error)
  }
}

/**
 * Create feedback stream helper
 */
export class FeedbackStream {
  private encoder: TextEncoder
  private controller: ReadableStreamDefaultController | null = null
  
  constructor() {
    this.encoder = new TextEncoder()
  }
  
  setController(controller: ReadableStreamDefaultController): void {
    this.controller = controller
  }
  
  send(feedback: RetrievalFeedback): void {
    if (!this.controller) {
      console.warn('[Feedback Stream] Controller not set')
      return
    }
    sendFeedback(this.encoder, this.controller, feedback)
  }
  
  sendRouting(route: string, complexity: string, intent: string): void {
    this.send(createRoutingFeedback(route, complexity, intent))
  }
  
  sendCacheCheck(found: boolean, similarity?: number, source?: 'exact' | 'semantic' | 'none'): void {
    this.send(createCacheCheckFeedback(found, similarity, source))
  }
  
  sendAnalysis(entities: string[], intent: string, multiQueries: number): void {
    this.send(createAnalysisFeedback(entities, intent, multiQueries))
  }
  
  sendSearch(chunksFound: number, searchTime: number, queriesExecuted: number): void {
    this.send(createSearchFeedback(chunksFound, searchTime, queriesExecuted))
  }
  
  sendRanking(topSources: SourcePreview[], confidence: number, qualityScore: number): void {
    this.send(createRankingFeedback(topSources, confidence, qualityScore))
  }
  
  sendGeneration(estimatedTokens: number, streamingStarted: boolean = false): void {
    this.send(createGenerationFeedback(estimatedTokens, streamingStarted))
  }
  
  sendComplete(): void {
    this.send(createCompleteFeedback())
  }
  
  sendError(code: string, message: string, recoverable: boolean = false): void {
    this.send(createErrorFeedback(code, message, recoverable))
  }
}

