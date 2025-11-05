/**
 * Intelligent Query Router
 * Routes queries to optimal processing paths based on complexity and intent
 * 
 * Features:
 * - Query complexity analysis
 * - Intent-based routing
 * - Cache-first strategy for simple queries
 * - Full RAG pipeline for complex queries
 * - Hybrid approach for medium complexity
 */

import { analyzeQueryAndGenerateVariations } from '@/lib/services/query-analysis-service'
import { commandWordDetector } from '../question-analysis/command-word-detector'

export interface QueryIntent {
  type: 'definition' | 'explanation' | 'comparison' | 'procedure' | 'example' | 'analysis' | 'application'
  complexity: 'simple' | 'moderate' | 'complex'
  requiresMultipleChunks: boolean
  estimatedTokens: number
  cacheStrategy: 'cache-only' | 'cache-first' | 'rag-first' | 'rag-only'
  optimalChunkCount: number
}

export interface RoutingDecision {
  route: 'cached-template' | 'semantic-cache' | 'hybrid' | 'full-rag'
  intent: QueryIntent
  confidence: number
  reasoning: string
}

/**
 * Analyze query and determine optimal routing strategy
 */
export async function routeQuery(
  query: string,
  profile: {
    board?: string
    classLevel?: string
    subject?: string
  }
): Promise<RoutingDecision> {
  
  // Step 1: Analyze query structure and intent
  const queryAnalysis = await analyzeQueryAndGenerateVariations(query, profile)
  const questionAnalysis = commandWordDetector.analyzeQuestion(query)
  
  // Step 2: Determine complexity
  const complexity = determineComplexity(query, queryAnalysis, questionAnalysis)
  
  // Step 3: Classify intent type
  const intentType = classifyIntentType(queryAnalysis.intent, questionAnalysis.commandWord)
  
  // Step 4: Estimate resource requirements
  const requiresMultipleChunks = estimateChunkRequirement(complexity, intentType, questionAnalysis)
  const estimatedTokens = estimateTokenRequirement(complexity, questionAnalysis)
  const optimalChunkCount = getOptimalChunkCount(complexity, intentType, questionAnalysis)
  
  // Step 5: Determine cache strategy
  const cacheStrategy = determineCacheStrategy(complexity, intentType)
  
  const intent: QueryIntent = {
    type: intentType,
    complexity,
    requiresMultipleChunks,
    estimatedTokens,
    cacheStrategy,
    optimalChunkCount
  }
  
  // Step 6: Make routing decision
  const decision = makeRoutingDecision(intent, query, profile)
  
  console.log(`🧭 [Query Router] Route: ${decision.route}, Complexity: ${complexity}, Intent: ${intentType}`)
  console.log(`🧭 [Query Router] Reasoning: ${decision.reasoning}`)
  
  return decision
}

/**
 * Determine query complexity based on multiple factors
 */
function determineComplexity(
  query: string,
  queryAnalysis: any,
  questionAnalysis: any
): 'simple' | 'moderate' | 'complex' {
  
  let complexityScore = 0
  
  // Factor 1: Query length
  const wordCount = query.split(/\s+/).length
  if (wordCount <= 5) complexityScore += 0
  else if (wordCount <= 15) complexityScore += 1
  else complexityScore += 2
  
  // Factor 2: Command word complexity
  const simpleCommands = ['define', 'what', 'who', 'when', 'where', 'list', 'name', 'state']
  const moderateCommands = ['explain', 'describe', 'how', 'why', 'illustrate', 'outline']
  const complexCommands = ['analyze', 'evaluate', 'compare', 'contrast', 'assess', 'justify', 'critique']
  
  const commandWord = questionAnalysis.commandWord.toLowerCase()
  if (simpleCommands.some(cmd => commandWord.includes(cmd))) complexityScore += 0
  else if (moderateCommands.some(cmd => commandWord.includes(cmd))) complexityScore += 1
  else if (complexCommands.some(cmd => commandWord.includes(cmd))) complexityScore += 2
  
  // Factor 3: Estimated marks
  if (questionAnalysis.estimatedMarks <= 2) complexityScore += 0
  else if (questionAnalysis.estimatedMarks <= 5) complexityScore += 1
  else complexityScore += 2
  
  // Factor 4: Number of entities
  if (queryAnalysis.entities.length <= 2) complexityScore += 0
  else if (queryAnalysis.entities.length <= 4) complexityScore += 1
  else complexityScore += 2
  
  // Factor 5: Intent complexity
  if (queryAnalysis.intent === 'definition') complexityScore += 0
  else if (queryAnalysis.intent === 'informational') complexityScore += 1
  else complexityScore += 2
  
  // Calculate final complexity
  const avgScore = complexityScore / 5
  
  if (avgScore <= 0.5) return 'simple'
  if (avgScore <= 1.5) return 'moderate'
  return 'complex'
}

/**
 * Classify intent type from analysis
 */
function classifyIntentType(
  intent: string,
  commandWord: string
): QueryIntent['type'] {
  
  const lower = commandWord.toLowerCase()
  
  // Definition queries
  if (intent === 'definition' || lower.includes('define') || lower.includes('what is')) {
    return 'definition'
  }
  
  // Comparison queries
  if (intent === 'comparison' || lower.includes('compare') || lower.includes('difference')) {
    return 'comparison'
  }
  
  // Procedure queries
  if (intent === 'process' || lower.includes('how') || lower.includes('steps')) {
    return 'procedure'
  }
  
  // Analysis queries
  if (intent === 'analysis' || lower.includes('analyze') || lower.includes('evaluate')) {
    return 'analysis'
  }
  
  // Application queries
  if (intent === 'application' || lower.includes('why') || lower.includes('purpose')) {
    return 'application'
  }
  
  // Example queries
  if (lower.includes('example') || lower.includes('illustrate')) {
    return 'example'
  }
  
  // Default to explanation
  return 'explanation'
}

/**
 * Estimate if query requires multiple chunks
 */
function estimateChunkRequirement(
  complexity: string,
  intentType: string,
  questionAnalysis: any
): boolean {
  
  // Simple definitions usually need 1-2 chunks
  if (complexity === 'simple' && intentType === 'definition') {
    return false
  }
  
  // Comparisons always need multiple chunks
  if (intentType === 'comparison') {
    return true
  }
  
  // High-mark questions need multiple chunks
  if (questionAnalysis.estimatedMarks >= 5) {
    return true
  }
  
  // Complex queries need multiple chunks
  if (complexity === 'complex') {
    return true
  }
  
  return false
}

/**
 * Estimate token requirement for answer generation
 */
function estimateTokenRequirement(
  complexity: string,
  questionAnalysis: any
): number {
  
  // Base tokens by complexity
  let baseTokens = 0
  if (complexity === 'simple') baseTokens = 150
  else if (complexity === 'moderate') baseTokens = 300
  else baseTokens = 500
  
  // Adjust by estimated marks
  const marksMultiplier = Math.min(questionAnalysis.estimatedMarks / 3, 2)
  
  return Math.round(baseTokens * marksMultiplier)
}

/**
 * Get optimal chunk count for query
 */
function getOptimalChunkCount(
  complexity: string,
  intentType: string,
  questionAnalysis: any
): number {
  
  // Simple definitions: 1-2 chunks
  if (complexity === 'simple' && intentType === 'definition') {
    return 2
  }
  
  // Comparisons: 3-4 chunks (from different sections)
  if (intentType === 'comparison') {
    return 4
  }
  
  // Complex analysis: 5-6 chunks
  if (complexity === 'complex' || questionAnalysis.estimatedMarks >= 5) {
    return 6
  }
  
  // Moderate queries: 3-4 chunks
  if (complexity === 'moderate') {
    return 4
  }
  
  // Default: 3 chunks
  return 3
}

/**
 * Determine cache strategy based on query characteristics
 */
function determineCacheStrategy(
  complexity: string,
  intentType: string
): QueryIntent['cacheStrategy'] {
  
  // Simple definitions: Cache-first (high reuse potential)
  if (complexity === 'simple' && intentType === 'definition') {
    return 'cache-first'
  }
  
  // Complex analysis: RAG-only (low reuse, needs fresh context)
  if (complexity === 'complex') {
    return 'rag-first'
  }
  
  // Moderate queries: Hybrid (check cache, fallback to RAG)
  return 'cache-first'
}

/**
 * Make final routing decision
 */
function makeRoutingDecision(
  intent: QueryIntent,
  query: string,
  profile: any
): RoutingDecision {
  
  // Route 1: Cached Template (for very common, simple queries)
  if (
    intent.complexity === 'simple' &&
    intent.type === 'definition' &&
    query.split(/\s+/).length <= 5
  ) {
    return {
      route: 'cached-template',
      intent,
      confidence: 0.95,
      reasoning: 'Simple definition query - checking cached templates first'
    }
  }
  
  // Route 2: Semantic Cache (for moderate queries with high reuse)
  if (
    intent.complexity === 'simple' ||
    (intent.complexity === 'moderate' && intent.cacheStrategy === 'cache-first')
  ) {
    return {
      route: 'semantic-cache',
      intent,
      confidence: 0.85,
      reasoning: 'Moderate complexity - checking semantic cache before RAG'
    }
  }
  
  // Route 3: Hybrid (cache + minimal RAG for medium complexity)
  if (intent.complexity === 'moderate' && intent.requiresMultipleChunks) {
    return {
      route: 'hybrid',
      intent,
      confidence: 0.75,
      reasoning: 'Medium complexity with multiple chunks - hybrid approach'
    }
  }
  
  // Route 4: Full RAG (for complex queries)
  return {
    route: 'full-rag',
    intent,
    confidence: 0.90,
    reasoning: 'Complex query requiring comprehensive RAG pipeline'
  }
}

