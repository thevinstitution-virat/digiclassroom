/**
 * Service Interfaces - Contract-based design for easy swapping
 * Any implementation that satisfies these interfaces can be used
 */

// ============================================================================
// LLM Service Interface
// ============================================================================

export interface LLMGenerationOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  stream?: boolean;
}

export interface LLMResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason: string;
}

export interface ILLMService {
  generateResponse(prompt: string, options?: LLMGenerationOptions): Promise<LLMResponse>;
  generateStreamingResponse(prompt: string, options?: LLMGenerationOptions): AsyncGenerator<string>;
  createEmbedding(text: string): Promise<number[]>;
  createEmbeddings(texts: string[]): Promise<number[][]>;
  getModelInfo(): { name: string; dimensions: number; maxTokens: number };
}

// ============================================================================
// Vector Search Service Interface
// ============================================================================

export interface VectorSearchOptions {
  query: string;
  subject: string;
  classLevel: string;
  board?: string;
  topK?: number;
  contentTypes?: string[];
  sectionLevel?: number;
  threshold?: number;
  enableHybridSearch?: boolean;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  text: string;
  metadata: {
    subject: string;
    class_level: number;
    content_type: string;
    section_level?: number;
    chapter?: string;
    page?: number;
  };
}

export interface IVectorSearchService {
  search(options: VectorSearchOptions): Promise<VectorSearchResult[]>;
  searchWithFallback(options: VectorSearchOptions): Promise<VectorSearchResult[]>;
  getCollectionInfo(): Promise<{ name: string; vectorCount: number; dimensions: number }>;
}

// ============================================================================
// Cache Service Interface
// ============================================================================

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // For cache invalidation
}

export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
  delete(key: string): Promise<void>;
  deleteByTags(tags: string[]): Promise<void>;
  clear(): Promise<void>;
  exists(key: string): Promise<boolean>;
  getStats(): Promise<{ hits: number; misses: number; hitRate: number }>;
}

// ============================================================================
// Pre-Generated Answers Service Interface
// ============================================================================

export interface AnswerMetadata {
  subject: string;
  class_level: string;
  board: string;
  content_type?: string;
}

export interface IPreGeneratedAnswersService {
  findAnswer(question: string, metadata?: Partial<AnswerMetadata>): Promise<string | null>;
  cacheAnswer(question: string, answer: string, metadata: AnswerMetadata): Promise<void>;
  getStats(): Promise<{ total: number; avgHitCount: number }>;
}

// ============================================================================
// Content Verification Service Interface
// ============================================================================

export interface VerificationResult {
  score: number; // 0-1 fidelity score
  isValid: boolean;
  issues: string[];
  citations: string[];
  sentenceScores?: { sentence: string; score: number }[];
}

export interface IContentVerificationService {
  verify(content: string, sources?: string[]): Promise<VerificationResult>;
  verifySentence(sentence: string, sources: string[]): Promise<number>;
  extractCitations(content: string): string[];
}

// ============================================================================
// User Service Interface
// ============================================================================

export interface UserContext {
  userId: string;
  userName: string;
  role: string;
  educationBoard: string;
  classLevel: string;
  subscription: {
    type: string;
    isActive: boolean;
    expiresAt?: Date;
  };
  quota: {
    current: number;
    limit: number;
    remaining: number;
  };
}

export interface IUserService {
  getUserContext(userId: string): Promise<UserContext>;
  validateAccess(userId: string, board: string, classLevel: string, subject: string): Promise<boolean>;
  incrementQuota(userId: string): Promise<void>;
  checkQuota(userId: string): Promise<{ allowed: boolean; remaining: number }>;
}

// ============================================================================
// Analytics Service Interface
// ============================================================================

export interface AnalyticsEvent {
  eventType: string;
  userId: string;
  metadata: Record<string, any>;
  timestamp: Date;
}

export interface IAnalyticsService {
  trackEvent(event: AnalyticsEvent): Promise<void>;
  trackAgentExecution(agentName: string, duration: number, success: boolean): Promise<void>;
  trackSearchPerformance(query: string, resultCount: number, latency: number): Promise<void>;
  trackCacheHit(cacheType: string, hit: boolean): Promise<void>;
}

// ============================================================================
// Service Health Check
// ============================================================================

export interface HealthCheckResult {
  service: string;
  healthy: boolean;
  latency?: number;
  error?: string;
  lastChecked: Date;
}

export interface IHealthCheckService {
  checkHealth(serviceName: string): Promise<HealthCheckResult>;
  checkAllServices(): Promise<HealthCheckResult[]>;
}

