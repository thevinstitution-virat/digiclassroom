/**
 * Application Configuration - Single source of truth
 * All configuration values centralized here
 */

export const APP_CONFIG = {
  // ============================================================================
  // Application Info
  // ============================================================================
  app: {
    name: 'Virat Gyankosh AI Tutor',
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development'
  },

  // ============================================================================
  // OpenAI Configuration
  // ============================================================================
  openai: {
    apiKey: process.env.OPENAI_API_KEY!,

    // Embedding configuration
    embedding: {
      model: 'text-embedding-3-large',
      dimensions: 3072,
      batchSize: 100
    },

    // Generation configuration
    generation: {
      model: 'gpt-4o-mini',
      defaultTemperature: 0.7,
      defaultMaxTokens: 1000,
      maxRetries: 3,
      timeout: 30000
    }
  },

  // ============================================================================
  // Qdrant Configuration
  // ============================================================================
  qdrant: {
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY,
    collectionName: process.env.QDRANT_COLLECTION_NAME || 'digiclassroom',

    search: {
      defaultTopK: 5,
      maxTopK: 20,

      thresholds: {
        primary: 0.65,
        fallback: 0.45,
        emergency: 0.0
      },

      hybrid: {
        enabled: true,
        denseWeight: 0.7,
        sparseWeight: 0.3
      }
    }
  },

  // ============================================================================
  // Redis Configuration
  // ============================================================================
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD,

    cache: {
      keyPrefix: 'virat_gyankosh:',
      defaultTTL: 86400,

      ttl: {
        search: 3600,
        userContext: 1800,
        preGenAnswers: 604800,
        semantic: 86400
      }
    },

    pool: {
      min: 2,
      max: 10
    }
  },

  // ============================================================================
  // MySQL Configuration
  // ============================================================================
  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    database: process.env.MYSQL_DATABASE || 'virat_gyankosh',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD,

    pool: {
      min: 5,
      max: 20,
      acquireTimeout: 30000,
      idleTimeout: 600000
    }
  },

  // ============================================================================
  // Analytics Configuration
  // ============================================================================
  analytics: {
    enabled: process.env.NODE_ENV === 'production',
    batchSize: 100,
    flushInterval: 5000,

    events: {
      chatRequest: true,
      searchPerformance: true,
      cacheHit: true,
      agentExecution: true,
      errors: true
    }
  }
} as const;

export type AppConfig = typeof APP_CONFIG;
