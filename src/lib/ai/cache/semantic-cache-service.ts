/**
 * Semantic Cache Service
 * Embedding-based cache lookup for similar questions
 * 
 * Features:
 * - Embedding-based similarity search
 * - Configurable similarity threshold
 * - TTL-based expiration
 * - Hit rate tracking
 * - Cache warming for common questions
 */

import { createClient, RedisClientType } from 'redis'
import { OpenAIService } from '@/lib/services/openai_service'
import crypto from 'crypto'

export interface CachedAnswer {
  question: string
  answer: string
  sources: any[]
  embedding: number[]
  metadata: {
    classLevel?: string
    subject?: string
    board?: string
    complexity: string
    intent: string
  }
  stats: {
    hitCount: number
    lastAccessed: number
    created: number
  }
}

export interface SemanticCacheResult {
  found: boolean
  answer?: string
  sources?: any[]
  similarity?: number
  cacheKey?: string
  isExactMatch: boolean
}

export class SemanticCacheService {
  private redis: RedisClientType | null = null
  private openai: OpenAIService
  private isConnected = false
  
  // Configuration
  private readonly SIMILARITY_THRESHOLD = 0.92 // High threshold for semantic match
  private readonly EXACT_MATCH_THRESHOLD = 0.98 // Very high for exact match
  private readonly DEFAULT_TTL = 86400 * 7 // 7 days
  private readonly CACHE_KEY_PREFIX = 'semantic_cache:'
  private readonly INDEX_KEY = 'semantic_cache:index'
  
  constructor() {
    this.openai = new OpenAIService()
    this.initializeRedis()
  }
  
  /**
   * Initialize Redis connection
   */
  private async initializeRedis() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
    
    try {
      this.redis = createClient({ url: redisUrl })
      
      this.redis.on('error', (err) => {
        console.error('[Semantic Cache] Redis error:', err.message)
        this.isConnected = false
      })
      
      this.redis.on('connect', () => {
        console.log('[Semantic Cache] Connected to Redis')
        this.isConnected = true
      })
      
      await this.redis.connect()
    } catch (error) {
      console.error('[Semantic Cache] Failed to connect:', error)
      this.redis = null
      this.isConnected = false
    }
  }
  
  /**
   * Search cache for semantically similar questions
   */
  async searchCache(
    question: string,
    metadata: {
      classLevel?: string
      subject?: string
      board?: string
    }
  ): Promise<SemanticCacheResult> {
    
    if (!this.isConnected || !this.redis) {
      return { found: false, isExactMatch: false }
    }
    
    try {
      const startTime = Date.now()
      
      // Step 1: Generate embedding for query
      const queryEmbedding = await this.openai.generateEmbedding(question)
      
      // Step 2: Get all cached entries for this context
      const cacheKeys = await this.getCacheKeysForContext(metadata)
      
      if (cacheKeys.length === 0) {
        console.log('[Semantic Cache] No cached entries for context')
        return { found: false, isExactMatch: false }
      }
      
      // Step 3: Find best match
      let bestMatch: CachedAnswer | null = null
      let bestSimilarity = 0
      let bestKey = ''
      
      for (const key of cacheKeys) {
        const cached = await this.getCachedEntry(key)
        if (!cached) continue
        
        const similarity = this.cosineSimilarity(queryEmbedding, cached.embedding)
        
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity
          bestMatch = cached
          bestKey = key
        }
      }
      
      const searchTime = Date.now() - startTime
      
      // Step 4: Check if similarity meets threshold
      if (bestMatch && bestSimilarity >= this.SIMILARITY_THRESHOLD) {
        // Update hit stats
        await this.updateHitStats(bestKey)
        
        const isExactMatch = bestSimilarity >= this.EXACT_MATCH_THRESHOLD
        
        console.log(`[Semantic Cache] ✅ HIT - Similarity: ${(bestSimilarity * 100).toFixed(1)}% (${searchTime}ms)`)
        console.log(`[Semantic Cache] Original: "${bestMatch.question}"`)
        console.log(`[Semantic Cache] Query: "${question}"`)
        
        return {
          found: true,
          answer: bestMatch.answer,
          sources: bestMatch.sources,
          similarity: bestSimilarity,
          cacheKey: bestKey,
          isExactMatch
        }
      }
      
      console.log(`[Semantic Cache] ❌ MISS - Best similarity: ${(bestSimilarity * 100).toFixed(1)}% (${searchTime}ms)`)
      return { found: false, isExactMatch: false }
      
    } catch (error) {
      console.error('[Semantic Cache] Search error:', error)
      return { found: false, isExactMatch: false }
    }
  }
  
  /**
   * Store answer in semantic cache
   */
  async storeAnswer(
    question: string,
    answer: string,
    sources: any[],
    metadata: {
      classLevel?: string
      subject?: string
      board?: string
      complexity: string
      intent: string
    },
    ttl: number = this.DEFAULT_TTL
  ): Promise<void> {
    
    if (!this.isConnected || !this.redis) {
      return
    }
    
    try {
      // Generate embedding
      const embedding = await this.openai.generateEmbedding(question)
      
      // Create cache entry
      const cached: CachedAnswer = {
        question,
        answer,
        sources,
        embedding,
        metadata,
        stats: {
          hitCount: 0,
          lastAccessed: Date.now(),
          created: Date.now()
        }
      }
      
      // Generate cache key
      const cacheKey = this.generateCacheKey(question, metadata)
      
      // Store in Redis
      await this.redis.setEx(
        `${this.CACHE_KEY_PREFIX}${cacheKey}`,
        ttl,
        JSON.stringify(cached)
      )
      
      // Add to index
      await this.addToIndex(cacheKey, metadata)
      
      console.log(`[Semantic Cache] ✍️ WRITE - Key: ${cacheKey}, TTL: ${ttl}s`)
      
    } catch (error) {
      console.error('[Semantic Cache] Store error:', error)
    }
  }
  
  /**
   * Get cache keys for specific context
   */
  private async getCacheKeysForContext(metadata: {
    classLevel?: string
    subject?: string
    board?: string
  }): Promise<string[]> {
    
    if (!this.redis) return []
    
    try {
      // Build context key
      const contextKey = this.buildContextKey(metadata)
      
      // Get keys from index
      const keys = await this.redis.sMembers(`${this.INDEX_KEY}:${contextKey}`)
      
      return keys
      
    } catch (error) {
      console.error('[Semantic Cache] Error getting context keys:', error)
      return []
    }
  }
  
  /**
   * Get cached entry by key
   */
  private async getCachedEntry(key: string): Promise<CachedAnswer | null> {
    if (!this.redis) return null
    
    try {
      const data = await this.redis.get(`${this.CACHE_KEY_PREFIX}${key}`)
      if (!data) return null
      
      return JSON.parse(data) as CachedAnswer
    } catch (error) {
      console.error('[Semantic Cache] Error getting entry:', error)
      return null
    }
  }
  
  /**
   * Update hit statistics
   */
  private async updateHitStats(key: string): Promise<void> {
    if (!this.redis) return
    
    try {
      const cached = await this.getCachedEntry(key)
      if (!cached) return
      
      cached.stats.hitCount++
      cached.stats.lastAccessed = Date.now()
      
      // Get current TTL
      const ttl = await this.redis.ttl(`${this.CACHE_KEY_PREFIX}${key}`)
      
      // Update with same TTL
      await this.redis.setEx(
        `${this.CACHE_KEY_PREFIX}${key}`,
        ttl > 0 ? ttl : this.DEFAULT_TTL,
        JSON.stringify(cached)
      )
    } catch (error) {
      console.error('[Semantic Cache] Error updating stats:', error)
    }
  }
  
  /**
   * Add key to index for fast context-based lookup
   */
  private async addToIndex(key: string, metadata: any): Promise<void> {
    if (!this.redis) return
    
    try {
      const contextKey = this.buildContextKey(metadata)
      await this.redis.sAdd(`${this.INDEX_KEY}:${contextKey}`, key)
    } catch (error) {
      console.error('[Semantic Cache] Error adding to index:', error)
    }
  }
  
  /**
   * Build context key for indexing
   */
  private buildContextKey(metadata: {
    classLevel?: string
    subject?: string
    board?: string
  }): string {
    const parts = [
      metadata.board || 'any',
      metadata.classLevel || 'any',
      metadata.subject || 'any'
    ]
    return parts.join(':').toLowerCase()
  }
  
  /**
   * Generate cache key from question and metadata
   */
  private generateCacheKey(question: string, metadata: any): string {
    const normalized = question.toLowerCase().trim()
    const contextKey = this.buildContextKey(metadata)
    const combined = `${contextKey}:${normalized}`
    
    return crypto
      .createHash('sha256')
      .update(combined)
      .digest('hex')
      .substring(0, 32)
  }
  
  /**
   * Calculate cosine similarity between two embeddings
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0
    
    let dotProduct = 0
    let normA = 0
    let normB = 0
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }
    
    const denominator = Math.sqrt(normA) * Math.sqrt(normB)
    return denominator === 0 ? 0 : dotProduct / denominator
  }
  
  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalEntries: number
    hitRate: number
    avgSimilarity: number
  }> {
    if (!this.redis) {
      return { totalEntries: 0, hitRate: 0, avgSimilarity: 0 }
    }
    
    try {
      const keys = await this.redis.keys(`${this.CACHE_KEY_PREFIX}*`)
      let totalHits = 0
      let totalAccesses = 0
      
      for (const key of keys) {
        const data = await this.redis.get(key)
        if (data) {
          const cached = JSON.parse(data) as CachedAnswer
          totalHits += cached.stats.hitCount
          totalAccesses += cached.stats.hitCount + 1 // +1 for initial store
        }
      }
      
      return {
        totalEntries: keys.length,
        hitRate: totalAccesses > 0 ? totalHits / totalAccesses : 0,
        avgSimilarity: 0 // TODO: Track this
      }
    } catch (error) {
      console.error('[Semantic Cache] Error getting stats:', error)
      return { totalEntries: 0, hitRate: 0, avgSimilarity: 0 }
    }
  }
  
  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit()
      this.isConnected = false
    }
  }
}

// Singleton instance
let semanticCacheInstance: SemanticCacheService | null = null

export function getSemanticCache(): SemanticCacheService {
  if (!semanticCacheInstance) {
    semanticCacheInstance = new SemanticCacheService()
  }
  return semanticCacheInstance
}

