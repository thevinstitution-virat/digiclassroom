/**
 * Agent Capabilities - Composable behaviors for all agents
 * Uses composition pattern for maximum flexibility and reusability
 */

import type {
  ILLMService,
  IVectorSearchService,
  ICacheService,
  IContentVerificationService,
  IAnalyticsService,
  VectorSearchOptions,
  VectorSearchResult,
  VerificationResult
} from '@/lib/services/interfaces';

// ============================================================================
// Agent Dependencies (injected via DI container)
// ============================================================================

export interface AgentDependencies {
  llmService: ILLMService;
  vectorSearchService: IVectorSearchService;
  cacheService: ICacheService;
  verificationService: IContentVerificationService;
  analyticsService: IAnalyticsService;
}

// ============================================================================
// Agent Configuration
// ============================================================================

export interface AgentConfig {
  name: string;
  description: string;
  contentTypes: string[];
  topK: number;
  sectionLevel?: number;
  temperature?: number;
  maxTokens?: number;
}

// ============================================================================
// Search Capability
// ============================================================================

export class SearchCapability {
  constructor(private deps: AgentDependencies) {}

  /**
   * Search with automatic caching and fallback
   */
  async search(
    config: AgentConfig,
    context: {
      query: string;
      subject: string;
      classLevel: string;
      board?: string;
    }
  ): Promise<VectorSearchResult[]> {
    const cacheKey = this.generateCacheKey(config.name, context);
    
    // Check cache first
    const cached = await this.deps.cacheService.get<VectorSearchResult[]>(cacheKey);
    if (cached) {
      console.log(`✅ [${config.name}] Cache HIT for search`);
      await this.deps.analyticsService.trackCacheHit('search', true);
      return cached;
    }

    console.log(`🔍 [${config.name}] Cache MISS - performing search`);
    await this.deps.analyticsService.trackCacheHit('search', false);

    const startTime = Date.now();

    // Perform search with fallback
    const results = await this.deps.vectorSearchService.searchWithFallback({
      query: context.query,
      subject: context.subject,
      classLevel: context.classLevel,
      board: context.board || 'cbse',
      topK: config.topK,
      contentTypes: config.contentTypes,
      sectionLevel: config.sectionLevel,
      enableHybridSearch: true
    });

    const latency = Date.now() - startTime;

    // Track performance
    await this.deps.analyticsService.trackSearchPerformance(
      context.query,
      results.length,
      latency
    );

    // Cache results
    await this.deps.cacheService.set(cacheKey, results, {
      ttl: 3600, // 1 hour
      tags: [config.name, context.subject, context.classLevel]
    });

    console.log(`✅ [${config.name}] Found ${results.length} results in ${latency}ms`);

    return results;
  }

  private generateCacheKey(agentName: string, context: any): string {
    const parts = [
      agentName,
      context.query,
      context.subject,
      context.classLevel,
      context.board || 'cbse'
    ];
    return `search:${parts.join(':')}`;
  }
}

// ============================================================================
// Content Generation Capability
// ============================================================================

export class ContentGenerationCapability {
  constructor(private deps: AgentDependencies) {}

  /**
   * Generate content with LLM
   */
  async generate(
    config: AgentConfig,
    prompt: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
    }
  ): Promise<string> {
    const response = await this.deps.llmService.generateResponse(prompt, {
      temperature: options?.temperature ?? config.temperature ?? 0.7,
      maxTokens: options?.maxTokens ?? config.maxTokens ?? 1000,
      stream: false
    });

    return response.content;
  }

  /**
   * Generate streaming content
   */
  async *generateStreaming(
    config: AgentConfig,
    prompt: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): AsyncGenerator<string> {
    const stream = this.deps.llmService.generateStreamingResponse(prompt, {
      temperature: options?.temperature ?? config.temperature ?? 0.7,
      maxTokens: options?.maxTokens ?? config.maxTokens ?? 1000
    });

    for await (const chunk of stream) {
      yield chunk;
    }
  }
}

// ============================================================================
// Content Verification Capability
// ============================================================================

export class VerificationCapability {
  constructor(private deps: AgentDependencies) {}

  /**
   * Verify content fidelity
   */
  async verify(
    config: AgentConfig,
    content: string,
    sources?: string[]
  ): Promise<VerificationResult> {
    console.log(`🔍 [${config.name}] Verifying content fidelity...`);

    const result = await this.deps.verificationService.verify(content, sources);

    if (!result.isValid) {
      console.warn(`⚠️ [${config.name}] Low fidelity score: ${result.score.toFixed(2)}`);
      console.warn(`Issues: ${result.issues.join(', ')}`);
    } else {
      console.log(`✅ [${config.name}] Content verified (score: ${result.score.toFixed(2)})`);
    }

    return result;
  }
}

// ============================================================================
// Response Streaming Capability
// ============================================================================

export class StreamingCapability {
  /**
   * Stream response in chunks (for better UX)
   */
  async *stream(content: string, chunkSize: number = 50): AsyncGenerator<string> {
    const words = content.split(' ');
    
    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize).join(' ');
      yield chunk + (i + chunkSize < words.length ? ' ' : '');
      
      // Small delay for streaming effect
      await new Promise(resolve => setTimeout(resolve, 30));
    }
  }
}

// ============================================================================
// Agent Capabilities Facade
// ============================================================================

export class AgentCapabilities {
  public readonly search: SearchCapability;
  public readonly generation: ContentGenerationCapability;
  public readonly verification: VerificationCapability;
  public readonly streaming: StreamingCapability;

  constructor(dependencies: AgentDependencies) {
    this.search = new SearchCapability(dependencies);
    this.generation = new ContentGenerationCapability(dependencies);
    this.verification = new VerificationCapability(dependencies);
    this.streaming = new StreamingCapability();
  }
}

