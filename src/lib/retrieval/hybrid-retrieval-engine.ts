/**
 * Hybrid Semantic-Exact Retrieval Engine
 * 🎯 MULTI-STRATEGY RETRIEVAL: Combines exact matching, semantic search, entity-based, and structural retrieval
 */

import { OpenAIService } from '../services/openai_service';
import { ServiceLifecycleManager } from '../services/service-lifecycle-manager';
import { StructuredChunk } from '../content/entity-aware-chunker';

export interface UserContext {
  educationalLevel: {
    grade: number;
    board: 'CBSE' | 'ICSE' | 'State';
    subject: string;
  };
  learningPreferences: {
    explanationComplexity: 'basic' | 'intermediate' | 'advanced';
    preferredLanguage: 'English' | 'Hindi' | 'Bilingual';
  };
  currentTopic?: string;
  sessionContext?: any;
}

export interface RetrievalOptions {
  maxResults?: number;
  minScore?: number;
  preferredChunkTypes?: string[];
  includeContextualChunks?: boolean;
  strictFiltering?: boolean;
}

export interface HybridRetrievalResult {
  query: string;
  results: RankedChunk[];
  strategies: {
    exact: ExactMatchResult[];
    semantic: SemanticMatchResult[];
    entity: EntityMatchResult[];
    structural: StructuralMatchResult[];
  };
  totalResults: number;
  processingTime: number;
  retrievalMetrics: RetrievalMetrics;
}

export interface RankedChunk extends StructuredChunk {
  hybridScore: number;
  scoring: HybridScore;
  relevanceReason: string;
  matchHighlights: string[];
  sourceReliability: number;
}

export interface HybridScore {
  exactScore: number;
  semanticScore: number;
  entityScore: number;
  structuralScore: number;
  hasExactMatch: boolean;
  isDefinition: boolean;
  isMicroChunk: boolean;
  matchedEntities: ExtractedEntity[];
  contextualRelevance: number;
}

export interface ExactMatchResult {
  chunkId: string;
  content: string;
  metadata: any;
  matchType: 'exact_phrase' | 'exact_term' | 'definition_match';
  confidence: number;
  matchedTerm?: string;
  isDefinition?: boolean;
  highlightedText?: string;
}

export interface SemanticMatchResult {
  chunkId: string;
  content: string;
  metadata: any;
  score: number;
  matchType: 'semantic';
  semanticScore: number;
  chunkType: string;
}

export interface EntityMatchResult {
  chunkId: string;
  content: string;
  metadata: any;
  matchType: 'entity';
  matchedEntity: ExtractedEntity;
  entityType: string;
  confidence: number;
}

export interface StructuralMatchResult {
  chunkId: string;
  content: string;
  metadata: any;
  matchType: 'structural';
  structuralRelevance: number;
  hierarchyMatch: boolean;
}

export interface ExtractedEntity {
  text: string;
  type: 'concept' | 'definition' | 'person' | 'place' | 'process' | 'formula';
  confidence: number;
  context: string;
}

export interface RetrievalMetrics {
  exactMatches: number;
  semanticMatches: number;
  entityMatches: number;
  structuralMatches: number;
  totalCandidates: number;
  averageScore: number;
  processingTimeMs: number;
}

export class HybridRetrievalEngine {
  private openaiService: OpenAIService;
  private fullTextSearchEngine: any; // Placeholder for full-text search
  
  // Retrieval strategy weights
  private readonly STRATEGY_WEIGHTS = {
    exact: 0.4,      // 40% weight for exact matches
    semantic: 0.3,   // 30% weight for semantic similarity
    entity: 0.2,     // 20% weight for entity matches
    structural: 0.1  // 10% weight for structural relevance
  };

  // Query classification patterns
  private readonly QUERY_PATTERNS = {
    definition: [
      /what is|what are|define|definition of|meaning of/i,
      /explain the term|what does.*mean/i
    ],
    factual: [
      /how many|when did|where is|who was|which/i,
      /list|name.*that|give.*examples/i
    ],
    explanation: [
      /why|how|explain|describe|discuss/i,
      /what causes|what happens when/i
    ],
    comparison: [
      /difference between|compare|contrast|versus|vs/i,
      /similarities.*differences|how.*different/i
    ]
  };

  constructor() {
    this.openaiService = OpenAIService.getInstance();
    // Initialize full-text search engine (placeholder)
    this.fullTextSearchEngine = null;
  }

  /**
   * 🎯 MAIN RETRIEVAL METHOD: Multi-strategy hybrid retrieval
   */
  async retrieveRelevantChunks(
    query: string,
    userContext: UserContext,
    options: RetrievalOptions = {}
  ): Promise<HybridRetrievalResult> {
    console.log('🔍 Starting hybrid retrieval for query:', query.substring(0, 50) + '...');
    const startTime = Date.now();

    try {
      // Execute all retrieval strategies in parallel
      const retrievalStrategies = [
        this.exactTextMatching(query, userContext, options),
        this.semanticVectorSearch(query, userContext, options),
        this.entityBasedRetrieval(query, userContext, options),
        this.structuralRetrieval(query, userContext, options)
      ];

      const strategyResults = await Promise.all(retrievalStrategies);

      // Merge and rank results using hybrid scoring
      const mergedResults = await this.mergeWithHybridScoring(
        strategyResults,
        query,
        userContext,
        options
      );

      // Apply final filtering and validation
      const validatedResults = await this.validateAndFilterResults(
        mergedResults,
        userContext,
        options
      );

      const processingTime = Date.now() - startTime;

      const result: HybridRetrievalResult = {
        query,
        results: validatedResults,
        strategies: {
          exact: strategyResults[0],
          semantic: strategyResults[1],
          entity: strategyResults[2],
          structural: strategyResults[3]
        },
        totalResults: validatedResults.length,
        processingTime,
        retrievalMetrics: this.calculateRetrievalMetrics(strategyResults, validatedResults, processingTime)
      };

      console.log(`✅ Hybrid retrieval completed: ${validatedResults.length} results in ${processingTime}ms`);
      return result;

    } catch (error) {
      console.error('❌ Hybrid retrieval failed:', error);
      throw new Error(`Hybrid retrieval failed: ${error.message}`);
    }
  }

  /**
   * Strategy 1: Exact Text Matching
   */
  private async exactTextMatching(
    query: string,
    context: UserContext,
    options: RetrievalOptions
  ): Promise<ExactMatchResult[]> {
    console.log('🎯 Executing exact text matching strategy...');

    const queryTerms = this.extractQueryTerms(query);
    const exactMatches: ExactMatchResult[] = [];

    try {
      // Search for exact phrase matches
      const phraseMatches = await this.searchExactPhrases(query, context);
      exactMatches.push(...phraseMatches.map(match => ({
        ...match,
        matchType: 'exact_phrase' as const,
        confidence: 1.0
      })));

      // Search for key term matches
      for (const term of queryTerms) {
        if (term.length > 2) { // Skip very short terms
          const termMatches = await this.searchExactTerm(term, context);
          exactMatches.push(...termMatches.map(match => ({
            ...match,
            matchType: 'exact_term' as const,
            confidence: 0.9,
            matchedTerm: term
          })));
        }
      }

      // For definition queries, prioritize micro-chunks
      if (this.isDefinitionQuery(query)) {
        const definitionMatches = await this.searchDefinitionChunks(query, context);
        exactMatches.push(...definitionMatches.map(match => ({
          ...match,
          matchType: 'definition_match' as const,
          confidence: 0.95,
          isDefinition: true
        })));
      }

      const deduplicatedMatches = this.deduplicateExactMatches(exactMatches);
      console.log(`🎯 Exact matching found ${deduplicatedMatches.length} matches`);
      return deduplicatedMatches;

    } catch (error) {
      console.warn('⚠️ Exact text matching failed:', error);
      return [];
    }
  }

  /**
   * Strategy 2: Semantic Vector Search
   */
  private async semanticVectorSearch(
    query: string,
    context: UserContext,
    options: RetrievalOptions
  ): Promise<SemanticMatchResult[]> {
    console.log('🧠 Executing semantic vector search strategy...');

    try {
      const queryEmbedding = await this.openaiService.generateEmbedding(query);

      // Multi-level semantic search with different chunk types
      const searchPromises = [
        this.searchChunkType('micro', queryEmbedding, context, options),
        this.searchChunkType('concept', queryEmbedding, context, options),
        this.searchChunkType('visual', queryEmbedding, context, options),
        this.searchChunkType('contextual', queryEmbedding, context, options)
      ];

      const chunkTypeResults = await Promise.all(searchPromises);
      const semanticResults = chunkTypeResults.flat().map(result => ({
        ...result,
        matchType: 'semantic' as const,
        semanticScore: result.score
      }));

      console.log(`🧠 Semantic search found ${semanticResults.length} matches`);
      return semanticResults;

    } catch (error) {
      console.warn('⚠️ Semantic vector search failed:', error);
      return [];
    }
  }

  /**
   * Strategy 3: Entity-Based Retrieval
   */
  private async entityBasedRetrieval(
    query: string,
    context: UserContext,
    options: RetrievalOptions
  ): Promise<EntityMatchResult[]> {
    console.log('🏷️ Executing entity-based retrieval strategy...');

    try {
      // Extract entities from query
      const extractedEntities = await this.extractEntitiesFromQuery(query);

      if (extractedEntities.length === 0) {
        console.log('🏷️ No entities extracted from query');
        return [];
      }

      const entityMatches: EntityMatchResult[] = [];

      for (const entity of extractedEntities) {
        // Search for chunks containing this entity
        const entityChunks = await this.searchByEntity(entity, context);

        entityMatches.push(...entityChunks.map(chunk => ({
          ...chunk,
          matchType: 'entity' as const,
          matchedEntity: entity,
          entityType: entity.type,
          confidence: this.calculateEntityConfidence(entity, chunk)
        })));
      }

      console.log(`🏷️ Entity-based retrieval found ${entityMatches.length} matches`);
      return entityMatches;

    } catch (error) {
      console.warn('⚠️ Entity-based retrieval failed:', error);
      return [];
    }
  }

  /**
   * Strategy 4: Structural Retrieval
   */
  private async structuralRetrieval(
    query: string,
    context: UserContext,
    options: RetrievalOptions
  ): Promise<StructuralMatchResult[]> {
    console.log('🏗️ Executing structural retrieval strategy...');

    try {
      // Analyze query for structural hints
      const structuralHints = this.extractStructuralHints(query);
      const structuralMatches: StructuralMatchResult[] = [];

      // Search based on chapter/section structure
      if (structuralHints.chapter) {
        const chapterChunks = await this.searchByChapter(structuralHints.chapter, context);
        structuralMatches.push(...chapterChunks.map(chunk => ({
          ...chunk,
          matchType: 'structural' as const,
          structuralRelevance: 0.8,
          hierarchyMatch: true
        })));
      }

      // Search based on content type preferences
      if (options.preferredChunkTypes) {
        for (const chunkType of options.preferredChunkTypes) {
          const typeChunks = await this.searchByChunkType(chunkType, context);
          structuralMatches.push(...typeChunks.map(chunk => ({
            ...chunk,
            matchType: 'structural' as const,
            structuralRelevance: 0.6,
            hierarchyMatch: false
          })));
        }
      }

      console.log(`🏗️ Structural retrieval found ${structuralMatches.length} matches`);
      return structuralMatches;

    } catch (error) {
      console.warn('⚠️ Structural retrieval failed:', error);
      return [];
    }
  }

  /**
   * Merge results with hybrid scoring
   */
  private async mergeWithHybridScoring(
    strategyResults: any[][],
    query: string,
    context: UserContext,
    options: RetrievalOptions
  ): Promise<RankedChunk[]> {
    console.log('🔄 Merging results with hybrid scoring...');

    const chunkScores: Map<string, HybridScore> = new Map();

    // Process exact matches (highest priority)
    for (const exactResult of strategyResults[0]) {
      const existing = chunkScores.get(exactResult.chunkId) || this.initializeScore();
      existing.exactScore = Math.max(existing.exactScore, exactResult.confidence);
      existing.hasExactMatch = true;
      if (exactResult.isDefinition) existing.isDefinition = true;
      chunkScores.set(exactResult.chunkId, existing);
    }

    // Process semantic matches
    for (const semanticResult of strategyResults[1]) {
      const existing = chunkScores.get(semanticResult.chunkId) || this.initializeScore();
      existing.semanticScore = Math.max(existing.semanticScore, semanticResult.score);
      chunkScores.set(semanticResult.chunkId, existing);
    }

    // Process entity matches
    for (const entityResult of strategyResults[2]) {
      const existing = chunkScores.get(entityResult.chunkId) || this.initializeScore();
      existing.entityScore = Math.max(existing.entityScore, entityResult.confidence);
      existing.matchedEntities.push(entityResult.matchedEntity);
      chunkScores.set(entityResult.chunkId, existing);
    }

    // Process structural matches
    for (const structuralResult of strategyResults[3]) {
      const existing = chunkScores.get(structuralResult.chunkId) || this.initializeScore();
      existing.structuralScore = Math.max(existing.structuralScore, structuralResult.structuralRelevance);
      chunkScores.set(structuralResult.chunkId, existing);
    }

    // Calculate final hybrid scores
    const rankedChunks: RankedChunk[] = [];

    for (const [chunkId, scores] of chunkScores) {
      const finalScore = this.calculateHybridScore(scores, query, context);

      if (finalScore > (options.minScore || 0.3)) {
        const chunkData = await this.getChunkById(chunkId);
        if (chunkData) {
          rankedChunks.push({
            ...chunkData,
            hybridScore: finalScore,
            scoring: scores,
            relevanceReason: this.explainRelevance(scores, query),
            matchHighlights: this.generateMatchHighlights(chunkData, query),
            sourceReliability: this.calculateSourceReliability(chunkData)
          });
        }
      }
    }

    const sortedChunks = rankedChunks.sort((a, b) => b.hybridScore - a.hybridScore);
    console.log(`🔄 Merged and ranked ${sortedChunks.length} chunks`);
    return sortedChunks;
  }

  /**
   * Calculate hybrid score with query-aware weighting
   */
  private calculateHybridScore(
    scores: HybridScore,
    query: string,
    context: UserContext
  ): number {
    const weights = this.determineWeights(query, context);

    let finalScore = 0;

    // Exact matches get highest priority
    if (scores.hasExactMatch) {
      finalScore += scores.exactScore * weights.exact;
    }

    // Semantic similarity
    finalScore += scores.semanticScore * weights.semantic;

    // Entity matches
    finalScore += scores.entityScore * weights.entity;

    // Structural relevance
    finalScore += scores.structuralScore * weights.structural;

    // Apply query-type specific boosts
    if (this.isDefinitionQuery(query) && scores.isDefinition) {
      finalScore *= 1.5; // 50% boost for definitions
    }

    if (this.isFactualQuery(query) && scores.isMicroChunk) {
      finalScore *= 1.3; // 30% boost for factual micro-chunks
    }

    // Apply contextual relevance
    finalScore *= (1 + scores.contextualRelevance * 0.2);

    return Math.min(finalScore, 1.0); // Cap at 1.0
  }

  // Helper methods (implementations would be added)
  private initializeScore(): HybridScore {
    return {
      exactScore: 0,
      semanticScore: 0,
      entityScore: 0,
      structuralScore: 0,
      hasExactMatch: false,
      isDefinition: false,
      isMicroChunk: false,
      matchedEntities: [],
      contextualRelevance: 0
    };
  }

  private extractQueryTerms(query: string): string[] {
    return query.toLowerCase()
      .split(/\s+/)
      .filter(term => term.length > 2)
      .map(term => term.replace(/[^\w]/g, ''));
  }

  private isDefinitionQuery(query: string): boolean {
    return this.QUERY_PATTERNS.definition.some(pattern => pattern.test(query));
  }

  private isFactualQuery(query: string): boolean {
    return this.QUERY_PATTERNS.factual.some(pattern => pattern.test(query));
  }

  private determineWeights(query: string, context: UserContext): typeof this.STRATEGY_WEIGHTS {
    // Adjust weights based on query type and context
    if (this.isDefinitionQuery(query)) {
      return { exact: 0.6, semantic: 0.2, entity: 0.15, structural: 0.05 };
    }
    if (this.isFactualQuery(query)) {
      return { exact: 0.5, semantic: 0.3, entity: 0.15, structural: 0.05 };
    }
    return this.STRATEGY_WEIGHTS; // Default weights
  }

  // Placeholder methods for implementation
  private async searchExactPhrases(query: string, context: UserContext): Promise<any[]> {
    // Implementation would search for exact phrases
    return [];
  }

  private async searchExactTerm(term: string, context: UserContext): Promise<any[]> {
    // Implementation would search for exact terms
    return [];
  }

  private async searchDefinitionChunks(query: string, context: UserContext): Promise<any[]> {
    // Implementation would search definition chunks
    return [];
  }

  private deduplicateExactMatches(matches: ExactMatchResult[]): ExactMatchResult[] {
    // Implementation would remove duplicates
    return matches;
  }

  private async searchChunkType(type: string, embedding: number[], context: UserContext, options: RetrievalOptions): Promise<any[]> {
    // Implementation would search by chunk type
    return [];
  }

  private async extractEntitiesFromQuery(query: string): Promise<ExtractedEntity[]> {
    // Implementation would extract entities
    return [];
  }

  private async searchByEntity(entity: ExtractedEntity, context: UserContext): Promise<any[]> {
    // Implementation would search by entity
    return [];
  }

  private calculateEntityConfidence(entity: ExtractedEntity, chunk: any): number {
    // Implementation would calculate entity confidence
    return 0.8;
  }

  private extractStructuralHints(query: string): any {
    // Implementation would extract structural hints
    return {};
  }

  private async searchByChapter(chapter: any, context: UserContext): Promise<any[]> {
    // Implementation would search by chapter
    return [];
  }

  private async searchByChunkType(chunkType: string, context: UserContext): Promise<any[]> {
    // Implementation would search by chunk type
    return [];
  }

  private async getChunkById(chunkId: string): Promise<StructuredChunk | null> {
    // Implementation would retrieve chunk by ID
    return null;
  }

  private explainRelevance(scores: HybridScore, query: string): string {
    const reasons = [];
    if (scores.hasExactMatch) reasons.push('exact text match');
    if (scores.semanticScore > 0.7) reasons.push('high semantic similarity');
    if (scores.matchedEntities.length > 0) reasons.push('entity match');
    return reasons.join(', ') || 'general relevance';
  }

  private generateMatchHighlights(chunk: StructuredChunk, query: string): string[] {
    // Implementation would generate highlights
    return [];
  }

  private calculateSourceReliability(chunk: StructuredChunk): number {
    // Implementation would calculate source reliability
    return chunk.fidelityScore || 0.8;
  }

  private async validateAndFilterResults(
    results: RankedChunk[],
    context: UserContext,
    options: RetrievalOptions
  ): Promise<RankedChunk[]> {
    // Apply final filtering
    let filtered = results;

    // Filter by minimum score
    if (options.minScore) {
      filtered = filtered.filter(r => r.hybridScore >= options.minScore!);
    }

    // Limit results
    if (options.maxResults) {
      filtered = filtered.slice(0, options.maxResults);
    }

    return filtered;
  }

  private calculateRetrievalMetrics(
    strategyResults: any[][],
    finalResults: RankedChunk[],
    processingTime: number
  ): RetrievalMetrics {
    return {
      exactMatches: strategyResults[0].length,
      semanticMatches: strategyResults[1].length,
      entityMatches: strategyResults[2].length,
      structuralMatches: strategyResults[3].length,
      totalCandidates: strategyResults.flat().length,
      averageScore: finalResults.reduce((sum, r) => sum + r.hybridScore, 0) / finalResults.length,
      processingTimeMs: processingTime
    };
  }
}
