/**
 * RAGAS Main Evaluator
 * Combines faithfulness and relevancy evaluations
 * 
 * Features:
 * - Parallel execution of both metrics for performance
 * - Redis caching with 24-hour TTL
 * - Overall score calculation
 * - Async background processing (non-blocking)
 * 
 * Target: Total execution time < 5 seconds
 */

import OpenAI from 'openai'
import { createClient } from 'redis'
import crypto from 'crypto'
import { evaluateFaithfulness, FaithfulnessResult } from './faithfulness'
import { evaluateRelevancy, RelevancyResult } from './answer-relevancy'
import { evaluateContextPrecision, ContextPrecisionResult } from './context-precision'
import { evaluateContextRecall, ContextRecallResult } from './context-recall'

export interface RAGASResult {
  faithfulnessScore: number
  relevanceScore: number
  contextPrecisionScore: number
  contextRecallScore: number
  overallScore: number
  executionTime: number
  cached: boolean
  details: {
    faithfulness: FaithfulnessResult
    relevancy: RelevancyResult
    contextPrecision: ContextPrecisionResult
    contextRecall: ContextRecallResult
  }
}

export interface RAGASInput {
  question: string
  answer: string
  context: string[]
  reference?: string         // Ground truth answer for Context Recall
  cacheKey?: string
}

// Redis client singleton
let redisClient: ReturnType<typeof createClient> | null = null
let redisAvailable = false

/**
 * Initialize Redis client for caching
 */
async function getRedisClient() {
  if (redisClient && redisAvailable) {
    return redisClient
  }
  
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
  
  try {
    redisClient = createClient({ url: redisUrl })
    
    redisClient.on('error', (err) => {
      console.error('[RAGAS Cache] Redis error:', err.message)
      redisAvailable = false
    })
    
    redisClient.on('connect', () => {
      console.log('[RAGAS Cache] Connected to Redis')
      redisAvailable = true
    })
    
    await redisClient.connect()
    redisAvailable = true
    return redisClient
    
  } catch (error) {
    console.error('[RAGAS Cache] Failed to connect to Redis:', error)
    redisClient = null
    redisAvailable = false
    return null
  }
}

/**
 * Generate cache key from input
 */
function generateCacheKey(input: RAGASInput): string {
  if (input.cacheKey) {
    return `ragas:${input.cacheKey}`
  }
  
  // Generate hash from question + answer
  const hash = crypto
    .createHash('md5')
    .update(input.question + input.answer)
    .digest('hex')
  
  return `ragas:${hash}`
}

/**
 * Evaluate answer quality using RAGAS metrics
 */
export async function evaluateRAGAS(
  input: RAGASInput
): Promise<RAGASResult> {
  const startTime = Date.now()
  
  try {
    // Check cache first
    const cacheKey = generateCacheKey(input)
    const cached = await getCachedResult(cacheKey)
    
    if (cached) {
      console.log(`[RAGAS] Cache HIT for key: ${cacheKey}`)
      return { ...cached, cached: true }
    }
    
    console.log(`[RAGAS] Cache MISS for key: ${cacheKey} - evaluating...`)
    
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
    
    // Run all 4 evaluations in parallel for performance
    const [faithfulness, relevancy, contextPrecision, contextRecall] = await Promise.all([
      evaluateFaithfulness(
        { answer: input.answer, context: input.context },
        openai
      ),
      evaluateRelevancy(
        { originalQuestion: input.question, answer: input.answer },
        openai
      ),
      evaluateContextPrecision(
        { question: input.question, answer: input.answer, context: input.context },
        openai
      ),
      evaluateContextRecall(
        {
          question: input.question,
          reference: input.reference || input.answer,  // Use reference if available, otherwise use answer
          context: input.context
        },
        openai
      )
    ])

    // Calculate overall score (average of all 4 metrics)
    const overallScore = (
      faithfulness.score +
      relevancy.score +
      contextPrecision.score +
      contextRecall.score
    ) / 4
    
    const result: RAGASResult = {
      faithfulnessScore: faithfulness.score,
      relevanceScore: relevancy.score,
      contextPrecisionScore: contextPrecision.score,
      contextRecallScore: contextRecall.score,
      overallScore,
      executionTime: Date.now() - startTime,
      cached: false,
      details: {
        faithfulness,
        relevancy,
        contextPrecision,
        contextRecall
      }
    }
    
    // Cache the result (24 hours)
    await cacheResult(cacheKey, result)

    console.log(`[RAGAS] Evaluation complete in ${result.executionTime}ms`)
    console.log(`[RAGAS] Scores - Faithfulness: ${faithfulness.score.toFixed(3)}, Relevancy: ${relevancy.score.toFixed(3)}, Context Precision: ${contextPrecision.score.toFixed(3)}, Context Recall: ${contextRecall.score.toFixed(3)}, Overall: ${overallScore.toFixed(3)}`)
    
    return result
    
  } catch (error) {
    console.error('[RAGAS] Evaluation error:', error)
    
    // Return neutral scores on error
    return {
      faithfulnessScore: 0.5,
      relevanceScore: 0.5,
      contextPrecisionScore: 0.5,
      contextRecallScore: 0.5,
      overallScore: 0.5,
      executionTime: Date.now() - startTime,
      cached: false,
      details: {
        faithfulness: {
          score: 0.5,
          totalClaims: 0,
          verifiedClaims: 0,
          unverifiedClaims: [],
          executionTime: 0,
          cached: false
        },
        relevancy: {
          score: 0.5,
          generatedQuestions: [],
          similarities: [],
          executionTime: 0,
          cached: false
        },
        contextPrecision: {
          score: 0.5,
          totalChunks: 0,
          relevantChunks: 0,
          precisionAtK: [],
          relevanceIndicators: [],
          executionTime: 0,
          cached: false
        },
        contextRecall: {
          score: 0.5,
          totalClaims: 0,
          supportedClaims: 0,
          unsupportedClaims: [],
          executionTime: 0,
          cached: false
        }
      }
    }
  }
}

/**
 * Get cached RAGAS result
 */
async function getCachedResult(cacheKey: string): Promise<RAGASResult | null> {
  try {
    const redis = await getRedisClient()
    if (!redis) {
      return null
    }
    
    const cached = await redis.get(cacheKey)
    if (!cached) {
      return null
    }
    
    return JSON.parse(cached)
    
  } catch (error) {
    console.error('[RAGAS Cache] Get error:', error)
    return null
  }
}

/**
 * Cache RAGAS result (24-hour TTL)
 */
async function cacheResult(cacheKey: string, result: RAGASResult): Promise<void> {
  try {
    const redis = await getRedisClient()
    if (!redis) {
      return
    }
    
    // Cache for 24 hours (86400 seconds)
    await redis.setEx(cacheKey, 86400, JSON.stringify(result))
    console.log(`[RAGAS Cache] Stored result for key: ${cacheKey}`)
    
  } catch (error) {
    console.error('[RAGAS Cache] Set error:', error)
  }
}

/**
 * Evaluate RAGAS in background (non-blocking)
 * Use this for async evaluation after answer generation
 */
export async function evaluateRAGASBackground(
  input: RAGASInput,
  callback?: (result: RAGASResult) => void
): Promise<void> {
  // Run evaluation in background without blocking
  evaluateRAGAS(input)
    .then(result => {
      if (callback) {
        callback(result)
      }
    })
    .catch(error => {
      console.error('[RAGAS Background] Evaluation error:', error)
    })
}

