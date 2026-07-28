import type { TutorGraphState } from './state'
import { queryAnalysisNode } from './nodes/query-analysis'
import { retrievalNode } from './nodes/retrieval'
import { rankingNode } from './nodes/ranking'
import { generationNode } from './nodes/generation'
import { responseSynthesisNode } from './nodes/response-synthesis'
import { hallucinationDetectionNode } from './nodes/hallucination'
import { createClient } from 'redis'

const MAX_GENERATION_ATTEMPTS = 2

// Redis client for answer caching (with graceful degradation)
let redisClient: ReturnType<typeof createClient> | null = null
let redisAvailable = false

/**
 * Initialize Redis client with error handling
 * If Redis is unavailable, the app continues without caching
 */
async function initializeRedis() {
  if (redisClient) {
    return redisClient
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

  try {
    redisClient = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 5000, // 5 second timeout
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            console.log('[Redis] Max reconnection attempts reached, disabling cache')
            return false // Stop reconnecting after 3 attempts
          }
          return Math.min(retries * 100, 3000) // Exponential backoff
        }
      }
    })

    redisClient.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message)
      redisAvailable = false
    })

    redisClient.on('connect', () => {
      console.log('[Redis] Connected successfully')
      redisAvailable = true
    })

    redisClient.on('ready', () => {
      console.log('[Redis] Ready to accept commands')
      redisAvailable = true
    })

    await redisClient.connect()
    redisAvailable = true
    console.log('[Redis] Cache initialized at', redisUrl)
    return redisClient
  } catch (error) {
    console.error('[Redis] Failed to initialize:', error instanceof Error ? error.message : 'Unknown error')
    console.log('[Redis] Continuing without cache (graceful degradation)')
    redisClient = null
    redisAvailable = false
    return null
  }
}

/**
 * Get Redis client if available
 */
export function getRedisClient() {
  return redisAvailable ? redisClient : null
}

// Initialize Redis on module load (non-blocking)
initializeRedis().catch((err) => {
  console.error('[Redis] Initialization failed:', err)
})

export async function runTutorGraph(
  query: string,
  profile: TutorGraphState['studentProfile'],
  routingIntent?: any,
  userId?: string
) {
  let state: TutorGraphState = {
    query,
    userId,
    studentProfile: profile,
    routingIntent
  }

  state = await queryAnalysisNode(state)
  state = await retrievalNode(state)
  state = await rankingNode(state)

  if (!state.rankedChunks || state.rankedChunks.length === 0) {
    return {
      ...state,
      finalAnswer: undefined,
      hallucinationReport: {
        supported: false,
        unsupportedClaims: ['No relevant textbook context found']
      }
    }
  }

  let attempts = 0

  while (attempts < MAX_GENERATION_ATTEMPTS) {
    state = await generationNode(state)
    state = responseSynthesisNode(state)
    state = hallucinationDetectionNode(state)

    if (state.hallucinationReport?.supported) {
      break
    }

    attempts += 1
    state = {
      ...state,
      generation: undefined,
      draftAnswer: undefined,
      finalAnswer: undefined,
      metadata: {
        ...state.metadata,
        regenerationAttempt: attempts,
        regenerationReason: state.hallucinationReport?.unsupportedClaims ?? []
      }
    }
  }

  return state
}

