/**
 * Service Registry - Centralized service registration and initialization
 * This is the SINGLE SOURCE OF TRUTH for all services in the application
 */

import { Container, ServiceLifecycle } from './container';
import type {
  ILLMService,
  IVectorSearchService,
  ICacheService,
  IPreGeneratedAnswersService,
  IContentVerificationService,
  IUserService,
  IAnalyticsService,
  IHealthCheckService
} from '@/lib/services/interfaces';

// Service name constants (prevents typos)
export const SERVICE_NAMES = {
  LLM: 'llm',
  VECTOR_SEARCH: 'vectorSearch',
  CACHE: 'cache',
  PRE_GEN_ANSWERS: 'preGenAnswers',
  CONTENT_VERIFICATION: 'contentVerification',
  USER: 'user',
  ANALYTICS: 'analytics',
  HEALTH_CHECK: 'healthCheck'
} as const;

export type ServiceName = typeof SERVICE_NAMES[keyof typeof SERVICE_NAMES];

/**
 * Register all application services
 * Called once during application startup
 */
export async function registerServices(container: Container): Promise<void> {
  console.log('📦 Registering application services...');
  const startTime = Date.now();

  // ============================================================================
  // Infrastructure Services (Singleton - expensive to create)
  // ============================================================================

  // LLM Service - OpenAI integration
  container.register(
    SERVICE_NAMES.LLM,
    async () => {
      const { OpenAILLMService } = await import('@/lib/services/implementations/openai-llm.service');
      return new OpenAILLMService({
        apiKey: process.env.OPENAI_API_KEY!,
        embeddingModel: 'text-embedding-3-large',
        embeddingDimensions: 3072,
        generationModel: 'gpt-4o-mini',
        maxRetries: 3,
        timeout: 30000
      });
    },
    ServiceLifecycle.SINGLETON,
    []
  );

  // Cache Service - Redis integration
  container.register(
    SERVICE_NAMES.CACHE,
    async () => {
      const { RedisCacheService } = await import('@/lib/services/implementations/redis-cache.service');
      return new RedisCacheService({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        password: process.env.REDIS_PASSWORD,
        defaultTTL: 86400, // 24 hours
        keyPrefix: 'virat_gyankosh:'
      });
    },
    ServiceLifecycle.SINGLETON,
    []
  );

  // Vector Search Service - Qdrant integration
  container.register(
    SERVICE_NAMES.VECTOR_SEARCH,
    async (container) => {
      const { QdrantVectorSearchService } = await import('@/lib/services/implementations/qdrant-vector-search.service');
      const llmService = await container.resolve<ILLMService>(SERVICE_NAMES.LLM);
      const cacheService = await container.resolve<ICacheService>(SERVICE_NAMES.CACHE);
      
      return new QdrantVectorSearchService({
        url: process.env.QDRANT_URL || 'http://localhost:6333',
        apiKey: process.env.QDRANT_API_KEY,
        collectionName: 'ncert-books-enhanced',
        llmService,
        cacheService
      });
    },
    ServiceLifecycle.SINGLETON,
    [SERVICE_NAMES.LLM, SERVICE_NAMES.CACHE]
  );

  // ============================================================================
  // Application Services (Singleton - stateless)
  // ============================================================================

  // Pre-Generated Answers Service
  container.register(
    SERVICE_NAMES.PRE_GEN_ANSWERS,
    async () => {
      const { PreGeneratedAnswersService } = await import('@/lib/services/implementations/pre-generated-answers.service');
      return new PreGeneratedAnswersService();
    },
    ServiceLifecycle.SINGLETON,
    []
  );

  // Content Verification Service
  container.register(
    SERVICE_NAMES.CONTENT_VERIFICATION,
    async (container) => {
      const { ContentVerificationService } = await import('@/lib/services/implementations/content-verification.service');
      const llmService = await container.resolve<ILLMService>(SERVICE_NAMES.LLM);
      
      return new ContentVerificationService(llmService);
    },
    ServiceLifecycle.SINGLETON,
    [SERVICE_NAMES.LLM]
  );

  // User Service
  container.register(
    SERVICE_NAMES.USER,
    async (container) => {
      const { UserService } = await import('@/lib/services/implementations/user.service');
      const cacheService = await container.resolve<ICacheService>(SERVICE_NAMES.CACHE);
      
      return new UserService(cacheService);
    },
    ServiceLifecycle.SINGLETON,
    [SERVICE_NAMES.CACHE]
  );

  // Analytics Service
  container.register(
    SERVICE_NAMES.ANALYTICS,
    async () => {
      const { AnalyticsService } = await import('@/lib/services/implementations/analytics.service');
      return new AnalyticsService({
        enabled: process.env.NODE_ENV === 'production',
        batchSize: 100,
        flushInterval: 5000
      });
    },
    ServiceLifecycle.SINGLETON,
    []
  );

  // Health Check Service (no dependencies to avoid circular dependency)
  container.register(
    SERVICE_NAMES.HEALTH_CHECK,
    async (container) => {
      const { HealthCheckService } = await import('@/lib/services/implementations/health-check.service');
      return new HealthCheckService(container);
    },
    ServiceLifecycle.SINGLETON,
    [] // No dependencies - health check resolves services on-demand
  );

  const duration = Date.now() - startTime;
  console.log(`✅ All services registered in ${duration}ms`);
}

/**
 * Initialize all singleton services
 * Pre-warms the container to avoid cold starts on first request
 */
export async function initializeServices(container: Container): Promise<void> {
  console.log('🔥 Pre-warming singleton services...');
  const startTime = Date.now();

  // Resolve services in dependency order to avoid circular dependencies
  // First: Services with no dependencies
  await container.resolve(SERVICE_NAMES.LLM);
  await container.resolve(SERVICE_NAMES.CACHE);
  await container.resolve(SERVICE_NAMES.ANALYTICS);

  // Second: Services that depend on LLM/Cache
  await container.resolve(SERVICE_NAMES.VECTOR_SEARCH);
  await container.resolve(SERVICE_NAMES.PRE_GEN_ANSWERS);
  await container.resolve(SERVICE_NAMES.CONTENT_VERIFICATION);
  await container.resolve(SERVICE_NAMES.USER);

  // Last: Health check (resolves services on-demand)
  await container.resolve(SERVICE_NAMES.HEALTH_CHECK);

  const duration = Date.now() - startTime;
  console.log(`✅ All services initialized in ${duration}ms`);
}

