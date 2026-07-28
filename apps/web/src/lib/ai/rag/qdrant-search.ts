/**
 * Qdrant Vector Database Integration for DigiClassroom
 * Advanced RAG search with hybrid capabilities and educational optimizations
 */

import { QdrantClient } from '@qdrant/js-client-rest';
// OpenAI embeddings enabled for NCERT search
import { OpenAIService } from '../../services/openai_service';
import { cacheQdrantSchema, getCachedQdrantSchema } from '../../services/service-lifecycle-manager';
import { hybridEmbedder, type HybridEmbedding } from './hybrid-embedder';
import { getAgentRetrievalProfile, getAgentSearchOptions, type AgentRetrievalProfile } from './agent-retrieval-profiles';

export interface QdrantSearchOptions {
  subject?: string;
  classLevel?: string;
  board?: string;
  medium?: string;
  topK?: number;
  enableHybridSearch?: boolean;
  contentTypes?: string[];
  sectionLevel?: number;
  requiresEquations?: boolean;
  requiresTables?: boolean;
  userId?: string; // For A/B testing
  subjectFilter?: Record<string, unknown>;
  /**
   * Batch 2b — per-org vector isolation. Mirrors the practest-queries tenancy convention.
   *   - string    → caller's org: returns org-owned vectors PLUS global (untagged) ones
   *   - null      → platform bypass (super_admin/admin): no org filter, sees everything
   *   - undefined → fail-closed default: only global/untagged (NCERT base) vectors
   * NCERT base content is ingested untagged, so `organization_id` is absent on those points.
   */
  organizationId?: string | null;
}

export interface QdrantSearchResult {
  id: string;
  content: string;
  score: number;
  metadata: {
    class: string;
    subject: string;
    chapter?: string;
    section_title?: string;
    content_type: string;
    page: number;
    contains_equation: boolean;
    contains_table: boolean;
    contains_figure: boolean;
    section_level: number;
    word_count: number;
  };
}

export interface QdrantSearchResponse {
  success?: boolean;
  results: QdrantSearchResult[];
  total_found?: number;
  totalResults?: number;
  search_strategy?: string;
  searchMethod?: string;
  processing_time?: number;
  processingTime?: number;
  debug_info?: Record<string, unknown>;
  debugInfo?: Record<string, unknown>;
}

export class QdrantRAGSearch {
  private client: QdrantClient;
  // OpenAI client initialized for embeddings
  private openai: OpenAIService | null = null;
  private collectionName: string;
  private embeddingModel: string;
  private useOpenAI: boolean = false;

  constructor() {
    // Initialize Qdrant client
    this.client = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: process.env.QDRANT_API_KEY, // Optional for self-hosted
    });

    // Initialize OpenAI for embeddings (primary)
    try {
      if (process.env.OPENAI_API_KEY) {
        this.openai = OpenAIService.getInstance();
        this.useOpenAI = true;
        console.log('âœ… Qdrant using OpenAI for embeddings');
      }
    } catch (error) {
      console.warn('âš ï¸ OpenAI not available for embeddings:', error);
      this.useOpenAI = false;
    }

    // Ensure at least one embedding provider is available
    if (!this.useOpenAI) {
      console.warn('âš ï¸ No OpenAI embedding provider available - will use keyword-based search');
    }

    this.collectionName = process.env.QDRANT_COLLECTION_NAME || 'ncert-books-enhanced';
    this.embeddingModel = 'text-embedding-3-large';

    // Debug collection configuration
    console.log(`ðŸ” Qdrant Search initialized with collection: ${this.collectionName}`);
    console.log(`ðŸ” Environment QDRANT_COLLECTION_NAME: ${process.env.QDRANT_COLLECTION_NAME}`);
  }

  /**
   * Advanced search with educational optimizations
   */
  async search(
    query: string,
    options: QdrantSearchOptions = {}
  ): Promise<QdrantSearchResponse> {
    const startTime = Date.now();

    try {
      console.log(`ðŸ” Qdrant search: "${query.substring(0, 50)}..."`);
      console.log(`ðŸ“š Options:`, JSON.stringify(options, null, 2));

      // Auto-detect subject if not provided
      const subject = options.subject || this.detectSubjectFromQuery(query);
      const enhancedOptions = { ...options, subject };

      // Try to generate embedding for vector search, fallback to keyword search if it fails
      let embedding: number[] | null = null;
      let experimentVariant: 'A' | 'B' | null = null;
      let experimentId: string | null = null;
      try {
        const embeddingResult = await this.generateEmbedding(query, options.userId);
        embedding = embeddingResult.embedding;
        experimentVariant = embeddingResult.variant;
        experimentId = embeddingResult.experimentId;
      } catch (embeddingError) {
        console.warn('âš ï¸ Embedding generation failed, using keyword search fallback');

        // Use keyword-based search when embeddings fail
        const keywordResult = await this.performKeywordSearch(query, enhancedOptions);

        return {
          success: true,
          results: keywordResult.results,
        // @ts-ignore
          totalResults: keywordResult.total_results,
          searchMethod: 'keyword_fallback',
          processingTime: Date.now() - startTime,
          debugInfo: {
            embedding_error: embeddingError instanceof Error ? embeddingError.message : 'Unknown error',
            fallback_used: true,
            ...keywordResult.debug_info
          }
        };
      }

      // Build advanced filter for educational content
      const filter = this.buildEducationalFilter(enhancedOptions);

      let searchResults;
      let searchStrategy: 'vector' | 'hybrid' | 'keyword' = 'vector';

      // ðŸ›¡ï¸ ENHANCED: Try hybrid search first if enabled with debugging
      console.log(`ðŸ” SEARCH DEBUG: Starting ${options.enableHybridSearch ? 'hybrid' : 'vector'} search`);

      if (options.enableHybridSearch) {
        searchResults = await this.performHybridSearch(
          query,
          embedding,
          filter,
          options.topK || 5
        );
        searchStrategy = 'hybrid';
      } else {
        // Standard vector search
        searchResults = await this.performVectorSearch(
          embedding,
          filter,
          options.topK || 5
        );
        searchStrategy = 'vector';
      }

      console.log(`ðŸ” SEARCH DEBUG: ${searchStrategy} search found ${searchResults.length} results`);

      // ðŸ›¡ï¸ ENHANCED: Debug search results
      if (searchResults.length > 0) {
        this.debugSearchResults(searchResults, `${searchStrategy} Search`);
      } else {
        console.log('âš ï¸ SEARCH DEBUG: No results found, analyzing potential issues...');
        await this.debugEmptyResults(options, filter);
      }

      // If no results and subject was "general", try without subject filter
      if (searchResults.length === 0 && options.subject === 'general') {
        console.log('ðŸ”„ No results with general subject, trying without subject filter...');

        const fallbackOptions = { ...enhancedOptions, subject: undefined };
        const fallbackFilter = this.buildEducationalFilter(fallbackOptions);

        if (options.enableHybridSearch) {
          searchResults = await this.performHybridSearch(
            query,
            embedding,
            fallbackFilter,
            options.topK || 5
          );
        } else {
          searchResults = await this.performVectorSearch(
            embedding,
            fallbackFilter,
            options.topK || 5
          );
        }

        console.log(`ðŸ”„ Fallback search found ${searchResults.length} results`);
      }

      // If still no results, try with increased topK and no filters
      if (searchResults.length === 0) {
        console.log('ðŸ”„ Still no results, trying emergency search with no filters...');

        // 🛡️ Batch 2b: drop educational filters but NEVER the org boundary — keep the
        // org/global isolation condition so emergency broadening can't leak other orgs' vectors.
        const orgOnlyCondition = this.buildOrgFilterCondition(enhancedOptions);
        const emergencyFilter = orgOnlyCondition ? { must: [orgOnlyCondition] } : {};

        searchResults = await this.performVectorSearch(
          embedding,
          emergencyFilter, // No educational filters, org isolation preserved
          (options.topK || 5) * 2 // Double the results
        );

        console.log(`ðŸ”„ Emergency search found ${searchResults.length} results`);
      }

      // Process and rank results with educational relevance
      const processedResults = this.processSearchResults(
        searchResults,
        enhancedOptions
      );

      const processingTime = Date.now() - startTime;

      console.log(`âœ… Found ${processedResults.length} results in ${processingTime}ms`);

      return {
        results: processedResults,
        total_found: searchResults.length,
        search_strategy: searchStrategy,
        processing_time: processingTime,
        debug_info: {
          filter_used: filter,
          embedding_dimensions: embedding.length,
          subject_detected: subject,
          experiment_id: experimentId,
          experiment_variant: experimentVariant
        }
      };

    } catch (error) {
      console.error('âŒ Qdrant search failed:', error);

      // Final fallback: try keyword search one more time
      try {
        console.log('ðŸ”„ Attempting final keyword search fallback');
        const keywordResult = await this.performKeywordSearch(query, options);

        return {
          success: true,
          results: keywordResult.results,
        // @ts-ignore
          totalResults: keywordResult.total_results,
          searchMethod: 'emergency_keyword_fallback',
          processingTime: Date.now() - startTime,
          debugInfo: {
            primary_error: error instanceof Error ? error.message : 'Unknown error',
            emergency_fallback_used: true,
            ...keywordResult.debug_info
          }
        };
      } catch (fallbackError) {
        console.error('âŒ All search methods failed:', fallbackError);

        // Return empty results if everything fails
        return {
          success: false,
          results: [],
          totalResults: 0,
          searchMethod: 'failed',
          processingTime: Date.now() - startTime,
          debugInfo: {
            primary_error: error instanceof Error ? error.message : 'Unknown error',
            fallback_error: fallbackError instanceof Error ? fallbackError.message : 'Unknown error'
          }
        };
      }
    }
  }

  /**
   * Perform hybrid search (dense vector + sparse vector with RRF)
   * Uses HybridEmbedder for BM25-based sparse vectors
   */
  private async performHybridSearch(
    query: string,
    embedding: number[],
    filter: any,
    topK: number
  ) {
    const enableHybridSearch = process.env.ENABLE_HYBRID_SEARCH === 'true';

    if (!enableHybridSearch) {
      // Fallback to dense-only search if hybrid search is disabled
      console.log('⚠️ Hybrid search requested but ENABLE_HYBRID_SEARCH=false, using dense-only search');
      return this.performVectorSearch(embedding, filter, topK);
    }

    try {
      // Generate sparse vector using HybridEmbedder (BM25)
      const sparseVectorMap = hybridEmbedder['bm25Index'].vectorize(query);

      // Convert sparse vector map to Qdrant format (indices + values)
      const terms = Object.keys(sparseVectorMap);
      const sparseVector = {
        indices: terms.map((_, idx) => idx),
        values: terms.map(term => sparseVectorMap[term])
      };

      console.log(`🔍 Hybrid search: dense (${embedding.length} dims) + sparse (${terms.length} terms)`);

      // Qdrant hybrid search with RRF (Reciprocal Rank Fusion)
      const searchRequest = {
        // Named vector for dense embeddings
        vector: {
          name: 'dense',
          vector: embedding
        },
        // Sparse vector for keyword matching
        sparse_vector: {
          name: 'sparse',
          vector: {
            indices: sparseVector.indices,
            values: sparseVector.values
          }
        },
        filter,
        limit: topK,
        with_payload: true,
        with_vector: false,
        // Hybrid search parameters
        params: {
          hnsw_ef: 128, // Higher for better recall
          exact: false
        }
      };

      const response = await this.client.search(this.collectionName, searchRequest);

      console.log(`✅ Hybrid search returned ${response.length} results`);

      return response;
    } catch (error) {
      console.error('❌ Hybrid search failed, falling back to dense-only search:', error);
      // Fallback to dense-only search on error
      return this.performVectorSearch(embedding, filter, topK);
    }
  }

  /**
   * Perform standard vector search
   */
  private async performVectorSearch(
    embedding: number[],
    filter: any,
    topK: number
  ) {
    const enableHybridSearch = process.env.ENABLE_HYBRID_SEARCH === 'true';

    // Use named vector if hybrid search is enabled (collection has named vectors)
    const searchRequest = enableHybridSearch ? {
      vector: {
        name: 'dense',
        vector: embedding
      },
      filter,
      limit: topK,
      with_payload: true,
      with_vector: false,
      params: {
        hnsw_ef: 64,
        exact: false
      }
    } : {
      vector: embedding,
      filter,
      limit: topK,
      with_payload: true,
      with_vector: false,
      params: {
        hnsw_ef: 64,
        exact: false
      }
    };

    const response = await this.client.search(this.collectionName, searchRequest);
    return response;
  }

  /**
   * ðŸ›¡ï¸ ENHANCED: Build advanced educational filter with comprehensive debugging
   */
  /**
   * 🛡️ Batch 2b: Build the per-org isolation condition for a Qdrant `must` clause.
   *
   * Tenancy convention (mirrors src/lib/db/practest-queries.ts):
   *   - organizationId is a non-empty string → org sees its OWN vectors + global/untagged ones
   *     → { should: [ org match, organization_id is_empty ] }
   *   - organizationId === null → platform bypass (super_admin/admin): NO org filter (sees all)
   *     → returns null (caller adds nothing)
   *   - organizationId === undefined → fail-closed default: global/untagged (NCERT) only
   *     → { is_empty: organization_id }
   *
   * `is_empty` matches points where the key is missing, null, or []. NCERT base content is
   * ingested without an organization_id, so it is always reachable as global content.
   */
  private buildOrgFilterCondition(options: QdrantSearchOptions): Record<string, unknown> | null {
    const orgId = options.organizationId;

    // null → super_admin / platform bypass: no org constraint at all.
    if (orgId === null) {
      return null;
    }

    // undefined (not supplied) → fail closed: only global/untagged vectors.
    if (orgId === undefined || orgId === '') {
      return { is_empty: { key: 'organization_id' } };
    }

    // Concrete org → own vectors OR global/untagged vectors.
    return {
      should: [
        { key: 'organization_id', match: { value: orgId } },
        { is_empty: { key: 'organization_id' } },
      ],
    };
  }

  private buildEducationalFilter(options: QdrantSearchOptions): any {
    const mustConditions = [];

    // 🛡️ Batch 2b: per-org isolation. MUST come first so it survives every fallback path.
    const orgCondition = this.buildOrgFilterCondition(options);
    if (orgCondition) {
      mustConditions.push(orgCondition);
    }

    console.log('ðŸ” FILTER DEBUG: Building educational filter with options:', {
      subject: options.subject,
      classLevel: options.classLevel,
      board: options.board,
      medium: options.medium
    });

    // ðŸ›¡ï¸ ENHANCED: Subject filter with debugging and normalization
    if (options.subject && options.subject !== 'general' && options.subject !== '') {
      const normalizedSubject = this.normalizeSubjectName(options.subject);
      console.log(`ðŸŽ¯ FILTER DEBUG: Adding subject filter - Original: "${options.subject}", Normalized: "${normalizedSubject}"`);

      // Try multiple subject variations for better matching
      const subjectVariations = this.generateSubjectVariations(normalizedSubject);
      console.log(`ðŸ” FILTER DEBUG: Subject variations: ${JSON.stringify(subjectVariations)}`);

      if (subjectVariations.length > 1) {
        mustConditions.push({
          should: subjectVariations.map(variation => ({
            key: 'subject',
            match: { value: variation }
          }))
        });
      } else {
        mustConditions.push({
          key: 'subject',
          match: { value: normalizedSubject }
        });
      }
    } else if (options.subject === 'general') {
      console.log('ðŸŒ FILTER DEBUG: Using general subject - no subject filter applied');
    }

    // ðŸ›¡ï¸ ENHANCED: Class level filter with debugging and multiple field checks
    if (options.classLevel) {
      const normalizedClass = this.normalizeClassName(options.classLevel);
      const classVariations = this.generateClassVariations(normalizedClass);

      console.log(`ðŸŽ“ FILTER DEBUG: Adding class filter - Original: "${options.classLevel}", Normalized: "${normalizedClass}"`);
      console.log(`ðŸ” FILTER DEBUG: Class variations: ${JSON.stringify(classVariations)}`);

      const shouldConditions: Record<string, unknown>[] = [];

      // Add variations for different field names and formats (support both old and new structures)
      classVariations.forEach(variation => {
        shouldConditions.push(
          { key: 'classLevel', match: { value: variation } }, // Old structure (currently in use)
          { key: 'class', match: { value: variation } }, // New structure
          { key: 'grade', match: { value: variation } } // Alternative field
        );
      });

      mustConditions.push({
        should: shouldConditions
      });
    }

    // ðŸ›¡ï¸ ENHANCED: Board/Curriculum filter with debugging
    if (options.board && options.board !== 'all') {
      const normalizedBoard = this.normalizeBoardName(options.board);
      console.log(`ðŸ›ï¸ FILTER DEBUG: Adding board filter - Original: "${options.board}", Normalized: "${normalizedBoard}"`);

      mustConditions.push({
        should: [
          { key: 'curriculum', match: { value: normalizedBoard } },
          { key: 'board', match: { value: normalizedBoard } },
          { key: 'board_type', match: { value: normalizedBoard } }
        ]
      });
    }

    // ðŸ›¡ï¸ ENHANCED: Medium/Language filter with debugging
    if (options.medium && options.medium !== 'all') {
      const normalizedMedium = this.normalizeMediumName(options.medium);
      console.log(`ðŸŒ FILTER DEBUG: Adding medium filter - Original: "${options.medium}", Normalized: "${normalizedMedium}"`);

      mustConditions.push({
        should: [
          { key: 'language', match: { value: normalizedMedium } },
          { key: 'medium', match: { value: normalizedMedium } }
        ]
      });
    }

    // ðŸ›¡ï¸ ENHANCED: Content type filter with debugging
    if (options.contentTypes && options.contentTypes.length > 0) {
      console.log(`ðŸ“„ FILTER DEBUG: Adding content type filters: ${JSON.stringify(options.contentTypes)}`);
      mustConditions.push({
        key: 'content_type',
        match: { any: options.contentTypes }
      });
    }

    // ðŸ›¡ï¸ ENHANCED: Section level filter with debugging
    if (options.sectionLevel !== undefined) {
      console.log(`ðŸ“‘ FILTER DEBUG: Adding section level filter: <= ${options.sectionLevel}`);
      mustConditions.push({
        key: 'section_level',
        range: { lte: options.sectionLevel }
      });
    }

    // ðŸ›¡ï¸ ENHANCED: Special content requirement filters with debugging
    if (options.requiresEquations) {
      console.log('ðŸ”¢ FILTER DEBUG: Requiring equations');
      mustConditions.push({
        key: 'contains_equation',
        match: { value: true }
      });
    }

    if (options.requiresTables) {
      console.log('ðŸ“Š FILTER DEBUG: Requiring tables');
      mustConditions.push({
        key: 'contains_table',
        match: { value: true }
      });
    }

    const filter = mustConditions.length > 0 ? { must: mustConditions } : undefined;
    console.log('ðŸ”§ FILTER DEBUG: Final built filter:', JSON.stringify(filter, null, 2));
    console.log(`ðŸ“ˆ FILTER DEBUG: Filter complexity: ${mustConditions.length} conditions`);

    return filter;
  }

  /**
   * Process and rank search results with educational relevance
   */
  private processSearchResults(
    searchResults: any[],
    options: QdrantSearchOptions
  ): QdrantSearchResult[] {
    return searchResults.map(result => {
      const payload = result.payload;

      // Calculate educational relevance score
      let relevanceBoost = 0;

      // Boost for subject match
      if (options.subject && payload.subject === options.subject) {
        relevanceBoost += 0.1;
      }

      // Boost for class level match (support both old and new metadata structures)
      if (options.classLevel && (payload.class === options.classLevel || payload.classLevel === options.classLevel)) {
        relevanceBoost += 0.1;
      }

      // Boost for content with equations (for STEM subjects)
      if (payload.contains_equation && this.isSTEMSubject(payload.subject)) {
        relevanceBoost += 0.05;
      }

      // Boost for appropriate section level
      if (payload.section_level <= 2) {
        relevanceBoost += 0.03;
      }

      const adjustedScore = Math.min(1.0, result.score + relevanceBoost);

      return {
        id: result.id,
        content: payload.text || '',
        score: adjustedScore,
        metadata: {
          class: payload.class,
          subject: payload.subject,
          chapter: payload.chapter,
          section_title: payload.section_title,
          content_type: payload.content_type,
          page: payload.page || payload.pageNumber,
          contains_equation: payload.contains_equation || payload.hasFormulas,
          contains_table: payload.contains_table || payload.hasTables,
          contains_figure: payload.contains_figure || false,
          section_level: payload.section_level || 2,
          word_count: payload.word_count || (payload.text ? payload.text.split(/\s+/).length : 0),
          extraction_method: payload.extractionMethod || 'unknown'
        }
      };
    });
  }

  /**
   * Generate embedding using available providers with fallback handling
   * Supports A/B testing when userId is provided
   */
  private async generateEmbedding(
    text: string,
    userId?: string
  ): Promise<{ embedding: number[]; variant: 'A' | 'B' | null; experimentId: string | null }> {
    // Use OpenAI embeddings when available
    if (this.useOpenAI && this.openai) {
      try {
        console.log('Generating OpenAI embedding for search query...');

        // Check if A/B testing is enabled and userId is available
        const experimentEnabled = process.env.ENABLE_EMBEDDING_EXPERIMENT === 'true';

        if (experimentEnabled && userId) {
          // Use A/B testing
          const { getEmbeddingWithOptionalExperiment } = await import('@/lib/experiments/embedding-ab-test');
          const result = await getEmbeddingWithOptionalExperiment(text, userId, this.openai.getClient());
          console.log(`OpenAI embedding generated: ${result.embedding.length} dimensions (Variant ${result.variant})`);
          return {
            embedding: result.embedding,
            variant: result.variant,
            experimentId: result.experimentId
          };
        } else {
          // Standard embedding (no A/B testing)
          const embedding = await this.openai.generateEmbedding(text);
          console.log('OpenAI embedding generated: ' + embedding.length + ' dimensions');
          return {
            embedding,
            variant: null,
            experimentId: null
          };
        }
      } catch (error) {
        console.warn('OpenAI embedding generation failed:', error);
      }
    }

    // If no OpenAI embedding provider is available, throw error to trigger keyword search
    throw new Error('No OpenAI embedding provider available - will use keyword-based search');
  }

  /**
   * Fallback search using keyword matching when embeddings fail
   */
  private async performKeywordSearch(
    query: string,
    options: QdrantSearchOptions
  ): Promise<QdrantSearchResponse> {
    console.log('ðŸ” Using keyword-based fallback search');

    try {
      // Extract keywords from query
      const keywords = this.extractKeywords(query);
      console.log('ðŸ”‘ Keywords extracted:', keywords);

      // Perform scroll search to get all documents and filter by keywords.
      // 🛡️ Batch 2b: scope the scroll to the caller's org + global content so the
      // keyword fallback can't surface other orgs' private vectors.
      const orgCondition = this.buildOrgFilterCondition(options);
      const scrollResult = await this.client.scroll(this.collectionName, {
        limit: 100,
        with_payload: true,
        with_vector: false,
        ...(orgCondition ? { filter: { must: [orgCondition] } } : {})
      });

      const results: any[] = [];

      for (const point of scrollResult.points) {
        const payload = point.payload as any;
        const content = payload.content || '';
        const title = payload.title || '';

        // Calculate keyword match score
        const matchScore = this.calculateKeywordMatchScore(
          query,
          content + ' ' + title,
          keywords
        );

        if (matchScore > 0.05) { // 5% minimum match threshold (more lenient)
          results.push({
            id: point.id,
            score: matchScore,
            payload: payload
          });

          // Debug logging for matches
          console.log(`ðŸŽ¯ Keyword match found: score=${matchScore.toFixed(3)}, content="${content.substring(0, 100)}..."`);
        }
      }

      // Sort by match score
      results.sort((a, b) => b.score - a.score);

      // Take top results
      const topResults = results.slice(0, options.topK || 5);

      console.log(`âœ… Keyword search found ${topResults.length} results`);

      return {
        results: this.processSearchResults(topResults, options),
        totalResults: topResults.length,
        search_strategy: 'keyword',
        processing_time: 0,
        debug_info: {
          keywords_used: keywords,
          total_documents_scanned: scrollResult.points.length,
          matches_found: results.length
        }
      };

    } catch (error) {
      console.error('âŒ Keyword search failed:', error);

      // Return empty results if everything fails
      return {
        results: [],
        totalResults: 0,
        search_strategy: 'keyword',
        processing_time: 0,
        debug_info: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Extract meaningful keywords from query with subject-specific expansion
   */
  private extractKeywords(query: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'what', 'how', 'why', 'when', 'where', 'who', 'which', 'is', 'are', 'was', 'were', 'be',
      'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'can', 'shall', 'this', 'that', 'these', 'those'
    ]);

    let keywords = query
      .toLowerCase()
      .split(/\W+/)
      .filter(word => word.length > 2 && !stopWords.has(word));

    // Add subject-specific keyword expansion
    keywords = this.expandSubjectKeywords(keywords);

    return keywords.slice(0, 15); // Increased limit for expanded keywords
  }

  /**
   * Expand keywords with subject-specific related terms
   */
  private expandSubjectKeywords(keywords: string[]): string[] {
    const expansions: { [key: string]: string[] } = {
      'unemployment': ['employment', 'job', 'work', 'labour', 'jobless', 'unemployed'],
      'economic': ['economy', 'economics', 'production', 'trade', 'business'],
      'activities': ['activity', 'work', 'production', 'occupation', 'sector'],
      'employment': ['job', 'work', 'occupation', 'labour', 'worker'],
      'poverty': ['poor', 'income', 'wealth', 'standard', 'living'],
      'agriculture': ['farming', 'crop', 'farmer', 'rural', 'village'],
      'industry': ['industrial', 'factory', 'manufacturing', 'production'],
      'service': ['services', 'tertiary', 'sector', 'trade']
    };

    const expandedKeywords = [...keywords];

    for (const keyword of keywords) {
      if (expansions[keyword]) {
        expandedKeywords.push(...expansions[keyword]);
      }
    }

    return [...new Set(expandedKeywords)]; // Remove duplicates
  }

  /**
   * Calculate keyword match score between query and content
   */
  private calculateKeywordMatchScore(query: string, content: string, keywords: string[]): number {
    const contentLower = content.toLowerCase();
    const queryLower = query.toLowerCase();

    let score = 0;

    // Exact phrase match (highest score)
    if (contentLower.includes(queryLower)) {
      score += 0.5;
    }

    // Individual keyword matches
    let keywordMatches = 0;
    for (const keyword of keywords) {
      if (contentLower.includes(keyword)) {
        keywordMatches++;
      }
    }

    // Keyword match ratio
    const keywordRatio = keywordMatches / keywords.length;
    score += keywordRatio * 0.4;

    // Content length penalty (prefer shorter, more focused content)
    const lengthPenalty = Math.min(content.length / 1000, 0.1);
    score -= lengthPenalty;

    return Math.max(score, 0);
  }

  /**
   * Auto-detect subject from query content
   */
  private detectSubjectFromQuery(query: string): string | undefined {
    const queryLower = query.toLowerCase();

    const subjectKeywords = {
      'Science': ['photosynthesis', 'cell', 'atom', 'molecule', 'biology', 'chemistry', 'physics', 'experiment'],
      'Mathematics': ['equation', 'algebra', 'geometry', 'trigonometry', 'calculus', 'theorem', 'proof'],
      'Economics': ['production', 'demand', 'supply', 'market', 'economy', 'trade', 'business'],
      'Political Science': ['democracy', 'government', 'constitution', 'rights', 'election', 'politics'],
      'Geography': ['climate', 'population', 'resources', 'continent', 'country', 'map'],
      'History': ['ancient', 'medieval', 'modern', 'civilization', 'empire', 'war', 'culture']
    };

    for (const [subject, keywords] of Object.entries(subjectKeywords)) {
      if (keywords.some(keyword => queryLower.includes(keyword))) {
        return subject;
      }
    }

    return undefined;
  }

  /**
   * Check if subject is STEM-related
   */
  private isSTEMSubject(subject: string): boolean {
    const stemSubjects = ['Science', 'Mathematics', 'Physics', 'Chemistry', 'Biology'];
    return stemSubjects.includes(subject);
  }

  /**
   * ðŸ›¡ï¸ ENHANCED: Initialize collection with schema caching
   */
  async initializeCollection(): Promise<void> {
    try {
      console.log(`ðŸ”§ Initializing Qdrant collection: ${this.collectionName}`);

      // ðŸ›¡ï¸ ENHANCED: Check cached schema first
      const cachedSchema = getCachedQdrantSchema(this.collectionName);
      if (cachedSchema) {
        console.log(`âš¡ Using cached schema for collection: ${this.collectionName}`);
        return;
      }

      // Check if collection exists
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(c => c.name === this.collectionName);

      if (!exists) {
        console.log(`ðŸ“¦ Creating Qdrant collection: ${this.collectionName}`);

        // Check if hybrid search is enabled
        const enableHybridSearch = process.env.ENABLE_HYBRID_SEARCH === 'true';

        if (enableHybridSearch) {
          console.log(`🔍 Creating collection with HYBRID SEARCH support (dense + sparse vectors)`);

          await this.client.createCollection(this.collectionName, {
            vectors: {
              dense: {
                size: 3072,  // text-embedding-3-large dimensions
                distance: 'Cosine'
              }
            },
            sparse_vectors: {
              sparse: {
                // BM25-style sparse vectors for keyword matching
                // No size needed - sparse vectors are dynamic
              }
            },
            optimizers_config: {
              default_segment_number: 2,
              max_segment_size: 20000,
              memmap_threshold: 50000,
              indexing_threshold: 20000,
              flush_interval_sec: 5,
              max_optimization_threads: 1
            }
          });
        } else {
          console.log(`🔍 Creating collection with DENSE VECTORS only (semantic search)`);

          await this.client.createCollection(this.collectionName, {
            vectors: {
              size: 3072,  // text-embedding-3-large dimensions (upgraded from 1536)
              distance: 'Cosine'
            },
            optimizers_config: {
              default_segment_number: 2,
              max_segment_size: 20000,
              memmap_threshold: 50000,
              indexing_threshold: 20000,
              flush_interval_sec: 5,
              max_optimization_threads: 1
            }
          });
        }

        // Create indexes for efficient filtering
        await this.createPayloadIndexes();

        console.log(`âœ… Collection ${this.collectionName} created successfully`);
      } else {
        console.log(`â™»ï¸ Collection ${this.collectionName} already exists`);
      }

      // ðŸ›¡ï¸ ENHANCED: Cache the schema information
      const schemaInfo = {
        collectionName: this.collectionName,
        vectorSize: 3072,  // text-embedding-3-large dimensions (upgraded from 1536)
        distance: 'Cosine',
        indexesCreated: true,
        lastUpdated: Date.now()
      };

      cacheQdrantSchema(this.collectionName, schemaInfo);

      console.log(`âœ… Collection initialized and cached: ${this.collectionName}`);
    } catch (error) {
      console.error('âŒ Failed to initialize collection:', error);
      throw error;
    }
  }

  /**
   * Create payload indexes for efficient filtering
   * Includes hierarchical fields for multi-level chunking
   */
  private async createPayloadIndexes(): Promise<void> {
    const indexes = [
      { field: 'subject', type: 'keyword' },
      { field: 'class', type: 'keyword' },
      { field: 'content_type', type: 'keyword' },
      { field: 'contains_equation', type: 'bool' },
      { field: 'contains_table', type: 'bool' },
      { field: 'section_level', type: 'integer' },
      { field: 'page', type: 'integer' },
      // Hierarchical fields for multi-level chunking
      { field: 'chunk_level', type: 'keyword' }, // atomic, paragraph, section
      { field: 'parent_id', type: 'keyword' },
      { field: 'chunk_index', type: 'integer' }
    ];

    for (const index of indexes) {
      try {
        await this.client.createPayloadIndex(this.collectionName, {
          field_name: index.field,
          field_schema: index.type as 'keyword' | 'integer' | 'float' | 'bool' | 'geo'
        });
        console.log(`âœ… Created index for ${index.field}`);
      } catch (error) {
        console.warn(`âš ï¸ Index creation failed for ${index.field}:`, error);
      }
    }
  }

  // ðŸ›¡ï¸ NEW: Normalization and variation generation methods for robust filtering

  /**
   * Normalize subject names for consistent filtering
   */
  private normalizeSubjectName(subject: string): string {
    const subjectMappings: { [key: string]: string } = {
      'history': 'History',
      'geography': 'Geography',
      'political science': 'Political Science',
      'economics': 'Economics',
      'social science': 'Social Science',
      'science': 'Science',
      'mathematics': 'Mathematics',
      'math': 'Mathematics',
      'english': 'English',
      'hindi': 'Hindi'
    };

    const normalized = subjectMappings[subject.toLowerCase()] || subject;
    console.log(`ðŸ”„ NORMALIZE: Subject "${subject}" -> "${normalized}"`);
    return normalized;
  }

  /**
   * Generate subject variations for flexible matching
   */
  private generateSubjectVariations(subject: string): string[] {
    const variations = [subject];

    // Add common variations
    const variationMappings: { [key: string]: string[] } = {
      'History': ['History', 'history', 'HISTORY'],
      'Geography': ['Geography', 'geography', 'GEOGRAPHY'],
      'Political Science': ['Political Science', 'political science', 'POLITICAL SCIENCE', 'Civics', 'civics'],
      'Economics': ['Economics', 'economics', 'ECONOMICS'],
      'Social Science': ['Social Science', 'social science', 'SOCIAL SCIENCE', 'History', 'Geography', 'Political Science', 'Economics'],
      'Science': ['Science', 'science', 'SCIENCE'],
      'Mathematics': ['Mathematics', 'mathematics', 'MATHEMATICS', 'Math', 'math', 'MATH']
    };

    if (variationMappings[subject]) {
      variations.push(...variationMappings[subject]);
    }

    // Remove duplicates
    return [...new Set(variations)];
  }

  /**
   * ðŸ›¡ï¸ CRITICAL FIX: Normalize class names to match database format (Arabic numbers)
   */
  private normalizeClassName(className: string): string {
    if (!className)
  return className;

    const normalized = className.toLowerCase().trim();

    // ðŸ›¡ï¸ CRITICAL: Convert Roman numerals to Arabic numbers to match database
    // Order matters: Check longer patterns first to avoid partial matches
    const romanToArabic: { [key: string]: string } = {
      'xii': '12', 'xi': '11', 'ix': '9', 'viii': '8', 'vii': '7', 'vi': '6',
      'v': '5', 'iv': '4', 'iii': '3', 'ii': '2', 'x': '10', 'i': '1'
    };

    // Check for Roman numerals in the input (exact word boundaries)
    for (const [roman, arabic] of Object.entries(romanToArabic)) {
      // Use word boundaries to ensure exact matches
      const romanPattern = new RegExp(`\\b${roman}\\b`, 'i');
      if (romanPattern.test(normalized)) {
        console.log(`ðŸ”„ NORMALIZE: Class "${className}" -> "${arabic}" (Roman to Arabic)`);
        return arabic;
      }
    }

    // Extract number from various formats
    const numberMatch = className.match(/(\d+)/);
    if (numberMatch) {
      const number = numberMatch[1];
      console.log(`ðŸ”„ NORMALIZE: Class "${className}" -> "${number}" (extracted number)`);
      return number;
    }

    console.log(`ðŸ”„ NORMALIZE: Class "${className}" -> "${className}" (no change)`);
    return className;
  }

  /**
   * Generate class variations for flexible matching
   */
  private generateClassVariations(className: string): string[] {
    const variations = [className];

    // Extract number for generating variations
    const numberMatch = className.match(/(\d+)/);
    if (numberMatch) {
      const number = parseInt(numberMatch[1]);
      const romanNumeral = this.convertToRoman(number);

      variations.push(
        `Class ${number}`,
        `Class ${romanNumeral}`,
        `class ${number}`,
        `class ${romanNumeral}`,
        `CLASS ${number}`,
        `CLASS ${romanNumeral}`,
        `Grade ${number}`,
        `grade ${number}`,
        number.toString(),
        romanNumeral
      );
    } else {
      // If no number found, try to extract Roman numeral and convert to Arabic
      const romanToArabic: { [key: string]: number } = {
        'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5,
        'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10,
        'XI': 11, 'XII': 12
      };

      // Check for Roman numerals in the className
      for (const [roman, arabic] of Object.entries(romanToArabic)) {
        const romanPattern = new RegExp(`\\b${roman}\\b`, 'i');
        if (romanPattern.test(className)) {
          const romanNumeral = this.convertToRoman(arabic);

          variations.push(
            `Class ${arabic}`,
            `Class ${romanNumeral}`,
            `class ${arabic}`,
            `class ${romanNumeral}`,
            `CLASS ${arabic}`,
            `CLASS ${romanNumeral}`,
            `Grade ${arabic}`,
            `grade ${arabic}`,
            arabic.toString(),
            romanNumeral
          );
          break; // Only process first match
        }
      }
    }

    // Remove duplicates
    return [...new Set(variations)];
  }

  /**
   * Convert number to Roman numeral
   */
  private convertToRoman(num: number): string {
    const romanNumerals: { [key: number]: string } = {
      1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V',
      6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X',
      11: 'XI', 12: 'XII'
    };
    return romanNumerals[num] || num.toString();
  }

  /**
   * Normalize board names for consistent filtering
   */
  private normalizeBoardName(board: string): string {
    const boardMappings: { [key: string]: string } = {
      'cbse': 'CBSE',
      'icse': 'ICSE',
      'state': 'State',
      'state board': 'State'
    };

    const normalized = boardMappings[board.toLowerCase()] || board;
    console.log(`ðŸ”„ NORMALIZE: Board "${board}" -> "${normalized}"`);
    return normalized;
  }

  /**
   * Normalize medium names for consistent filtering
   */
  private normalizeMediumName(medium: string): string {
    const mediumMappings: { [key: string]: string } = {
      'english': 'English',
      'hindi': 'Hindi',
      'en': 'English',
      'hi': 'Hindi'
    };

    const normalized = mediumMappings[medium.toLowerCase()] || medium;
    console.log(`ðŸ”„ NORMALIZE: Medium "${medium}" -> "${normalized}"`);
    return normalized;
  }

  // ðŸ›¡ï¸ NEW: Comprehensive search result debugging methods

  /**
   * Debug search results to analyze payload structure and content
   */
  private debugSearchResults(results: any[], searchType: string): void {
    console.log(`ðŸ” ${searchType.toUpperCase()} DEBUG: Analyzing ${results.length} results`);

    if (results.length === 0) return;

    // Analyze payload structure
    const sampleResult = results[0];
    const payload = sampleResult.payload || {};

    console.log(`ðŸ“Š ${searchType.toUpperCase()} DEBUG: Sample payload structure:`, {
      hasSubject: !!payload.subject,
      hasClass: !!payload.class || !!payload.classLevel,
      hasChapter: !!payload.chapter,
      hasContentType: !!payload.content_type,
      hasText: !!payload.text,
      subjectValue: payload.subject,
      classValue: payload.class || payload.classLevel,
      chapterValue: payload.chapter
    });

    // Analyze subject distribution
    const subjects = results.map(r => r.payload?.subject).filter(Boolean);
    const subjectCounts = subjects.reduce((acc: any, subject: string) => {
      acc[subject] = (acc[subject] || 0) + 1;
      return acc;
    }, {});

    console.log(`ðŸ“ˆ ${searchType.toUpperCase()} DEBUG: Subject distribution:`, subjectCounts);

    // Analyze class distribution
    const classes = results.map(r => r.payload?.class || r.payload?.classLevel).filter(Boolean);
    const classCounts = classes.reduce((acc: any, cls: string) => {
      acc[cls] = (acc[cls] || 0) + 1;
      return acc;
    }, {});

    console.log(`ðŸŽ“ ${searchType.toUpperCase()} DEBUG: Class distribution:`, classCounts);

    // Show top 3 results with scores
    console.log(`ðŸ† ${searchType.toUpperCase()} DEBUG: Top 3 results:`);
    results.slice(0, 3).forEach((result, index) => {
      console.log(`  ${index + 1}. Score: ${result.score?.toFixed(4)}, Subject: ${result.payload?.subject}, Class: ${result.payload?.class || result.payload?.classLevel}, Chapter: ${result.payload?.chapter}`);
    });
  }

  /**
   * Debug empty search results to identify potential issues
   */
  private async debugEmptyResults(options: QdrantSearchOptions, filter: any): Promise<void> {
    console.log('ðŸ” EMPTY RESULTS DEBUG: Analyzing why no results were found...');

    try {
      // Check if collection has any data
      const totalCount = await this.client.count(this.collectionName);
      console.log(`ðŸ“Š EMPTY RESULTS DEBUG: Total points in collection: ${totalCount.count}`);

      if (totalCount.count === 0) {
        console.log('âŒ EMPTY RESULTS DEBUG: Collection is empty!');
        return;
      }

      // Sample some points to analyze payload structure
      const samplePoints = await this.client.scroll(this.collectionName, {
        limit: 10,
        with_payload: true
      });

      if (samplePoints.points.length > 0) {
        console.log('ðŸ“‹ EMPTY RESULTS DEBUG: Sample payload analysis:');

        const subjects = new Set();
        const classes = new Set();
        const contentTypes = new Set();

        samplePoints.points.forEach(point => {
          const payload = point.payload || {};
          if (payload.subject) subjects.add(payload.subject);
          if (payload.class) classes.add(payload.class);
          if (payload.classLevel) classes.add(payload.classLevel);
          if (payload.content_type) contentTypes.add(payload.content_type);
        });

        console.log(`ðŸ“š EMPTY RESULTS DEBUG: Available subjects: ${Array.from(subjects).join(', ')}`);
        console.log(`ðŸŽ“ EMPTY RESULTS DEBUG: Available classes: ${Array.from(classes).join(', ')}`);
        console.log(`ðŸ“„ EMPTY RESULTS DEBUG: Available content types: ${Array.from(contentTypes).join(', ')}`);

        // Compare with requested filters
        if (options.subject) {
          const hasRequestedSubject = Array.from(subjects).some(s => {
            const subjectStr = String(s).toLowerCase();
            const optionStr = options.subject!.toLowerCase();
            return subjectStr.includes(optionStr) || optionStr.includes(subjectStr);
          });
          console.log(`ðŸŽ¯ EMPTY RESULTS DEBUG: Requested subject "${options.subject}" ${hasRequestedSubject ? 'FOUND' : 'NOT FOUND'} in database`);
        }

        if (options.classLevel) {
          const hasRequestedClass = Array.from(classes).some(c => {
            const classStr = String(c).toLowerCase();
            const optionStr = options.classLevel!.toLowerCase();
            return classStr.includes(optionStr) || optionStr.includes(classStr);
          });
          console.log(`ðŸŽ“ EMPTY RESULTS DEBUG: Requested class "${options.classLevel}" ${hasRequestedClass ? 'FOUND' : 'NOT FOUND'} in database`);
        }
      }

      // Test search without filters
      console.log('ðŸ” EMPTY RESULTS DEBUG: Testing unfiltered search...');
      const unfilteredResults = await this.client.search(this.collectionName, {
        vector: Array(3072).fill(0.1), // Dummy vector (3072 dimensions for text-embedding-3-large)
        limit: 5,
        with_payload: true
      });

      console.log(`ðŸ“Š EMPTY RESULTS DEBUG: Unfiltered search found ${unfilteredResults.length} results`);

    } catch (error) {
      console.error('âŒ EMPTY RESULTS DEBUG: Error during debugging:', error);
    }
  }

  /**
   * Search with agent-specific retrieval profile
   * Optimizes retrieval strategy based on agent type
   */
  async searchWithProfile(
    query: string,
    agentType: string,
    options: QdrantSearchOptions = {}
  ): Promise<QdrantSearchResponse> {
    console.log(`ðŸ¤– Agent-aware search: ${agentType}`);

    // Get agent profile
    const profile = getAgentRetrievalProfile(agentType);
    console.log(`ðŸ"Š Using retrieval profile: ${profile.agentName}`);
    console.log(`   - Preferred chunk levels: ${profile.retrievalStrategy.preferredChunkLevels.join(', ')}`);
    console.log(`   - Top K: ${profile.retrievalStrategy.topK}`);
    console.log(`   - Hybrid search: ${profile.retrievalStrategy.enableHybridSearch}`);

    // Merge options with profile
    const searchOptions = getAgentSearchOptions(agentType, options);

    // Perform initial search
    const initialResults = await this.search(query, searchOptions);

    // If neighbor retrieval is enabled, expand context
    if (profile.retrievalStrategy.includeNeighbors) {
      console.log(`ðŸ"— Expanding context with neighbors (radius: ${profile.retrievalStrategy.neighborRadius})`);
      const expandedResults = await this.expandWithNeighbors(
        initialResults.results,
        profile.retrievalStrategy
      );

      initialResults.results = expandedResults;
      initialResults.total_found = expandedResults.length;
    }

    // Apply chunk level filtering and weighting
    const filteredResults = this.applyChunkLevelWeighting(
      initialResults.results,
      profile.retrievalStrategy.chunkLevelWeights
    );

    initialResults.results = filteredResults;

    return initialResults;
  }

  /**
   * Expand results with neighbor chunks (siblings, parents, children)
   */
  private async expandWithNeighbors(
    results: QdrantSearchResult[],
    strategy: AgentRetrievalProfile['retrievalStrategy']
  ): Promise<QdrantSearchResult[]> {
    const expandedResults: QdrantSearchResult[] = [...results];
    const seenIds = new Set(results.map(r => r.id));

    for (const result of results) {
      const metadata = result.metadata as any;

      // Include parent chunk
      if (strategy.includeParent && metadata.parent_id) {
        const parent = await this.getChunkById(metadata.parent_id);
        if (parent && !seenIds.has(parent.id)) {
          expandedResults.push(parent);
          seenIds.add(parent.id);
        }
      }

      // Include children chunks
      if (strategy.includeChildren && metadata.children_ids) {
        for (const childId of metadata.children_ids) {
          const child = await this.getChunkById(childId);
          if (child && !seenIds.has(child.id)) {
            expandedResults.push(child);
            seenIds.add(child.id);
          }
        }
      }

      // Include sibling chunks (within radius)
      if (strategy.includeNeighbors && metadata.sibling_ids) {
        const siblingIds = metadata.sibling_ids.slice(0, strategy.neighborRadius);
        for (const siblingId of siblingIds) {
          const sibling = await this.getChunkById(siblingId);
          if (sibling && !seenIds.has(sibling.id)) {
            expandedResults.push(sibling);
            seenIds.add(sibling.id);
          }
        }
      }
    }

    return expandedResults;
  }

  /**
   * Get a chunk by ID
   */
  private async getChunkById(chunkId: string): Promise<QdrantSearchResult | null> {
    try {
      const response = await this.client.retrieve(this.collectionName, {
        ids: [chunkId],
        with_payload: true
      });

      if (response.length === 0)
  return null;

      const point = response[0];
      return {
        id: point.id.toString(),
        content: (point.payload as any)?.content || '',
        score: 1.0, // No score for direct retrieval
        metadata: point.payload as any
      };
    } catch (error) {
      console.error(`âš ï¸ Failed to retrieve chunk ${chunkId}:`, error);
      return null;
    }
  }

  /**
   * Apply chunk level weighting to results
   */
  private applyChunkLevelWeighting(
    results: QdrantSearchResult[],
    weights: { atomic: number; paragraph: number; section: number }
  ): QdrantSearchResult[] {
    return results
      .map(result => {
        const metadata = result.metadata as any;
        const chunkLevel = metadata.chunk_level || 'paragraph';
        const weight = weights[chunkLevel as keyof typeof weights] || 1.0;

        return {
          ...result,
          score: result.score * weight
        };
      })
      .sort((a, b) => b.score - a.score);
  }
}

export const qdrantSearch = new QdrantRAGSearch();

// Migration utilities removed - system now uses Qdrant exclusively






