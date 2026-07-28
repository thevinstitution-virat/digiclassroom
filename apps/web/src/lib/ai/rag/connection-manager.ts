import { QdrantClient } from '@qdrant/js-client-rest'

// Configuration
const CONNECTION_CONFIG = {
  qdrant: {
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY,
    collectionName: process.env.QDRANT_COLLECTION_NAME || 'ncert-books-enhanced'
  },
  retry: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 5000
  }
}

// Health check interfaces
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  services: {
    qdrant: ServiceHealth
  }
  timestamp: string
  uptime: number
}

export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  responseTime?: number
  lastChecked: string
  error?: string
}

// Connection Manager Class
class ConnectionManager {
  private static instance: ConnectionManager
  private qdrant: QdrantClient | null = null
  private isInitialized = false
  private initializationPromise: Promise<void> | null = null
  private lastHealthCheck: HealthStatus | null = null
  private startTime = Date.now()

  private constructor() {}

  static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager()
    }
    return ConnectionManager.instance
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return
    if (this.initializationPromise)
  return this.initializationPromise

    this.initializationPromise = this._initialize()
    await this.initializationPromise
  }

  private async _initialize(): Promise<void> {
    console.log('🔧 Initializing AI services...')

    try {
      // Initialize Qdrant
      this.qdrant = new QdrantClient({
        url: CONNECTION_CONFIG.qdrant.url,
        apiKey: CONNECTION_CONFIG.qdrant.apiKey
      })
      console.log('✅ Qdrant client initialized')

      this.isInitialized = true
      console.log('✅ AI services initialized successfully')

      // Perform initial health check
      await this.performHealthCheck()

    } catch (error) {
      console.error('❌ AI services initialization failed:', error)
      this.isInitialized = false
      throw error
    }
  }

  // Note: Embedding generation removed - using keyword-based search fallback

  // Search vectors with retry logic
  async searchVectors(
    embedding: number[],
    options: {
      topK: number
      filter?: any
      includeMetadata: boolean
    }
  ): Promise<any> {
    if (!this.qdrant) {
      throw new Error('Qdrant client not initialized')
    }

    return this.withRetry(async () => {
      return await this.qdrant!.search(CONNECTION_CONFIG.qdrant.collectionName, {
        vector: embedding,
        limit: options.topK,
        filter: options.filter,
        with_payload: options.includeMetadata
      })
    }, 'searchVectors')
  }

  // Upsert vectors with retry logic
  async upsertVectors(
    vectors: Array<{
      id: string
      vector: number[]
      payload?: Record<string, any>
    }>
  ): Promise<void> {
    if (!this.qdrant) {
      throw new Error('Qdrant client not initialized')
    }

    return this.withRetry(async () => {
      await this.qdrant!.upsert(CONNECTION_CONFIG.qdrant.collectionName, {
        wait: true,
        points: vectors
      })
    }, 'upsertVectors')
  }

  // Get collection info
  async getCollectionInfo(): Promise<any> {
    if (!this.qdrant) {
      throw new Error('Qdrant client not initialized')
    }

    return this.withRetry(async () => {
      return await this.qdrant!.getCollection(CONNECTION_CONFIG.qdrant.collectionName)
    }, 'getCollectionInfo')
  }

  // Perform comprehensive health check
  async performHealthCheck(): Promise<HealthStatus> {
    console.log('🏥 Performing health check...')

    const healthStatus: HealthStatus = {
      status: 'healthy',
      services: {
        qdrant: {
          status: 'unhealthy',
          lastChecked: new Date().toISOString()
        }
      },
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime
    }

    // Check Qdrant
    try {
      const startTime = Date.now()
      await this.getCollectionInfo()

      healthStatus.services.qdrant = {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        lastChecked: new Date().toISOString()
      }
    } catch (error) {
      healthStatus.services.qdrant = {
        status: 'unhealthy',
        lastChecked: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Determine overall status
    const services = Object.values(healthStatus.services)
    const healthyServices = services.filter(s => s.status === 'healthy').length

    if (healthyServices === services.length) {
      healthStatus.status = 'healthy'
    } else if (healthyServices > 0) {
      healthStatus.status = 'degraded'
    } else {
      healthStatus.status = 'unhealthy'
    }

    this.lastHealthCheck = healthStatus
    console.log(`🏥 Health check completed: ${healthStatus.status}`)

    return healthStatus
  }

  // Get last health check result
  getLastHealthCheck(): HealthStatus | null {
    return this.lastHealthCheck
  }

  // Generic retry wrapper with exponential backoff
  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = CONNECTION_CONFIG.retry.maxRetries
  ): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation()
        if (attempt > 0) {
          console.log(`✅ ${operationName} succeeded on attempt ${attempt + 1}`)
        }
        return result
      } catch (error) {
        lastError = error as Error
        console.warn(`⚠️ ${operationName} attempt ${attempt + 1} failed:`, error)
        
        if (attempt < maxRetries) {
          const delay = this.calculateDelay(attempt)
          console.log(`🔄 Retrying ${operationName} in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    throw new Error(`${operationName} failed after ${maxRetries + 1} attempts: ${lastError?.message}`)
  }

  private calculateDelay(attempt: number): number {
    const delay = Math.min(
      CONNECTION_CONFIG.retry.baseDelay * Math.pow(2, attempt),
      CONNECTION_CONFIG.retry.maxDelay
    )
    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000
  }

  // Cleanup resources
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up AI services...')
    this.qdrant = null
    this.isInitialized = false
    this.initializationPromise = null
    this.lastHealthCheck = null
  }

  // Check if services are available
  isQdrantAvailable(): boolean {
    return !!this.qdrant
  }

  isFullyAvailable(): boolean {
    return this.isQdrantAvailable()
  }
}

// Export singleton instance
export const connectionManager = ConnectionManager.getInstance()

// Export types
export { ConnectionManager }
