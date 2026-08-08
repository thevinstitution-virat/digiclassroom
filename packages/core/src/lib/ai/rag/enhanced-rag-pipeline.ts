/**
 * Simplified RAG Pipeline with doc-extract-engine + Qdrant Integration
 * Single-tier processing using doc-extract-engine for all documents
 */

import { pdfExtractKitProcessor, PDFExtractKitMetadata } from '../../content/pdf-extract-kit-processor';
// Simplified architecture: doc-extract-engine only
import { qdrantSearch, QdrantSearchOptions } from './qdrant-search';
import { QdrantClient } from '@qdrant/js-client-rest';
import { OpenAIService } from '../../services/openai_service';
import { EnhancedStructureAnalyzer, BookStructure } from '../../content/enhanced-structure-analyzer';
import { VisualContentAnalysisService } from '../../services/visual-content-analysis-service';
import { transformToHierarchicalChunks } from './hierarchical-chunker';
import { resolveOrCreateBook } from './book-registry-service';
import {
  resolveOrCreateContentItem,
  insertContentChunks,
  pruneChunksBeyond,
  recordSourceAsset,
  findSourceAssetId,
  replaceTaxonomyLinks,
  resolveScopeAndGrant,
  startIngestRun,
  registerAsset,
  hasActiveIngestRun,
  hasActiveRunForAsset,
  supersedePriorActiveRun,
  activateIngestRun,
  failIngestRun,
  type SourceApp,
} from '../../db/content-identity';
import { buildSparseVector } from './sparse-tokenizer';

/**
 * One document's shared-content run, threaded through every batch of it.
 * Created by beginSharedContentRun(), consumed by indexChunksInQdrant(), closed
 * by finalizeSharedContentRun().
 */
interface SharedContentRun {
  contentItemId: string;
  ingestRunId: string | null;
  scope: { visibility: 'public' | 'restricted'; grantOrgIds: string[] };
  taxonomyNodeIds: string[];
  /** Document-wide running chunk_index, advanced by each batch. */
  nextChunkIndex: number;
  /** Identical bytes already ingested — caller must skip embedding entirely. */
  deduped: boolean;
  /** The `source` rendition this run embedded. Null means the rule is violated. */
  sourceAssetId: string | null;
  /** The asset whose chunks this run writes — chunk_index is contiguous within it. */
  assetId: string | null;
}

/**
 * One FILE's worth of work, handed to ingestPart() already parsed.
 *
 * `part` names the SLOT the file occupies — (role, partIndex, variant) — not the
 * file. Chapter 3's markdown is a slot; the file in it changes when the chapter
 * is corrected, and the slot's identity must not.
 */
export interface SpineIngestInput {
  // ── Work identity ──
  sourceApp: SourceApp;
  sourceLocalId: string;
  contentTitle: string;
  /** Work key. Fifteen chapter files share one ISBN and resolve to one work. */
  isbn?: string | null;
  edition?: string | null;
  lang?: string | null;
  /** App-local org id. Resolved to a canonical grant; never assumed public. */
  organizationId?: string | null;
  taxonomyNodeIds?: string[];

  // ── Which slot this file occupies ──
  part: {
    /** content_asset_role_check: source | enriched_md | pdf_paginated | epub | audio | audio_sync | cover | thumbnail */
    role: string;
    partIndex: number;
    partLabel?: string | null;
    variant?: string;
    sha256: string;
    storageAccount: string;
    storageUri: string;
    bytes?: number | null;
    pageCount?: number | null;
    /** printed page = file page + pageOffset */
    pageOffset?: number | null;
  };

  chunks: SpineChunk[];
}

export interface SpineChunk {
  text: string;
  pageStart: number | null;
  pageEnd: number | null;
  chapter?: string | null;
  /**
   * 'skip' is not stored — it means drop this chunk before embedding. The other
   * two are persisted and become filterable.
   */
  retrievalClass?: 'reference' | 'practice' | 'skip';
  /**
   * The lane's own payload fields, passed through untouched.
   *
   * DEVIATION from the signature agreed in 2A, which had bare chunks and no
   * metadata. Bare chunks cannot work: the payload every DCP consumer filters on
   * (subject, classLevel, board, medium, chapter hierarchy) is built from these,
   * and validateChunkBatch REQUIRES class/subject/book_title/page. A spine
   * function that dropped them would index content nothing could retrieve. The
   * spine owns the named fields above; everything else belongs to the lane.
   */
  metadata?: Record<string, any>;
}

export interface SpineIngestResult {
  status: 'indexed' | 'skipped_unchanged' | 'failed';
  contentItemId: string | null;
  assetId: string | null;
  ingestRunId: string | null;
  partIndex: number;
  chunksWritten: number;
  pointsUpserted: number;
  /** Why it was refused or skipped. Operator-facing, not a stack trace. */
  reason?: string;
}

// Enhanced RAG Options with query decomposition and re-ranking support
export interface EnhancedRAGOptions extends QdrantSearchOptions {
  enableFallback?: boolean;
  enableStrictValidation?: boolean;
  requireTextbookContent?: boolean;
  minRelevanceScore?: number;
  enableVisualAnalysis?: boolean;
  includeVisualDescriptions?: boolean;
  prioritizeVisualContent?: boolean;
  enableQueryDecomposition?: boolean; // Enable query decomposition for complex queries
  enableReranking?: boolean; // Enable cross-encoder re-ranking for better precision
  rerankingInitialTopK?: number; // Number of chunks to retrieve before re-ranking (default: 20)
  rerankingFinalTopK?: number; // Number of chunks to return after re-ranking (default: 5)
  subjectFilter?: any;
}

export interface ContentValidationResult {
  isValid: boolean;
  relevanceScore: number;
  hasTextbookContent: boolean;
  validationErrors: string[];
  recommendedAction: 'use_content' | 'knowledge_gap_response' | 'retry_search';
}

export interface EnhancedRAGResult {
  results: Array<{
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
      // Enhanced Docling metadata
      bounding_box?: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
      parent_section?: string;
      subsection?: string;
      extraction_method: string;
      confidence_score: number;
    };
  }>;
  search_strategy: string;
  processing_time: number;
  total_found: number;
  debug_info?: any;
  // New validation fields
  validation?: ContentValidationResult;
  textbook_fidelity_score?: number;
  knowledge_gap_detected?: boolean;
}

export class EnhancedRAGPipeline {
  private qdrant: QdrantClient;
  private collectionName: string;
  private openai: OpenAIService;
  private structureAnalyzer: EnhancedStructureAnalyzer;
  private visualAnalysisService: VisualContentAnalysisService; // Phase 3 Enhancement

  constructor() {
    // Initialize Qdrant client
    this.qdrant = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: process.env.QDRANT_API_KEY,
        // @ts-ignore
      checkCompatibility: false
    });

    // Initialize collection name
    this.collectionName = process.env.QDRANT_COLLECTION_NAME || 'ncert-books-enhanced';

    // Initialize OpenAI service
    this.openai = OpenAIService.getInstance();

    // Initialize other services
    this.structureAnalyzer = new EnhancedStructureAnalyzer();
    this.visualAnalysisService = new VisualContentAnalysisService();

    console.log('✅ EnhancedRAGPipeline initialized successfully');
    console.log(`📦 Qdrant URL: ${process.env.QDRANT_URL || 'http://localhost:6333'}`);
    console.log(`📚 Collection: ${this.collectionName}`);
  }

  /**
   * Validate content relevance and quality for educational responses
   */
  private validateContentRelevance(
    query: string,
    results: any[],
    options: EnhancedRAGOptions
  ): ContentValidationResult {
    const minScore = options.minRelevanceScore || 0.02; // Adjusted for OpenAI embeddings
    const strictValidation = options.enableStrictValidation !== false; // Default to true
    const requireTextbook = options.requireTextbookContent !== false; // Default to true

    console.log(`🔍 Validating content relevance for query: "${query.substring(0, 50)}..."`);
    console.log(`📊 Validation settings: minScore=${minScore}, strict=${strictValidation}, requireTextbook=${requireTextbook}`);

    if (!results || results.length === 0) {
      console.log('❌ No content retrieved from search');
      return {
        isValid: false,
        relevanceScore: 0,
        hasTextbookContent: false,
        validationErrors: ['No content retrieved from search'],
        recommendedAction: 'knowledge_gap_response'
      };
    }

    // Calculate relevance scores
    const scores = results.map(r => r.score || 0);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const maxScore = Math.max(...scores);

    console.log(`📊 Relevance scores: max=${maxScore.toFixed(3)}, avg=${avgScore.toFixed(3)}`);

    // Check for textbook content indicators
    const hasTextbookContent = results.some(result =>
      result.payload?.source?.includes('NCERT') ||
      result.payload?.curriculum === 'CBSE' ||
      result.payload?.book_title ||
      result.payload?.chapter ||
      result.metadata?.extraction_method === 'doc-extract-engine'
    );

    console.log(`📚 Textbook content detected: ${hasTextbookContent}`);

    // Validation checks
    const validationErrors: string[] = [];

    if (maxScore < minScore) {
      validationErrors.push(`Low relevance score: ${maxScore.toFixed(3)} < ${minScore}`);
    }

    if (requireTextbook && !hasTextbookContent) {
      validationErrors.push('No verified textbook content found');
    }

    // Check for content completeness for structured queries (like NMPI indicators)
    if (query.toLowerCase().includes('indicators') ||
        query.toLowerCase().includes('list') ||
        query.toLowerCase().includes('steps') ||
        query.toLowerCase().includes('types')) {

      const hasCompleteStructuredContent = results.some(r => {
        const content = r.payload?.content || r.content || '';
        return content.length > 300 && // Substantial content
               (content.includes('1.') || content.includes('2.') ||
                content.includes('•') || content.includes('i.') ||
                content.match(/\d+\./g)?.length >= 3); // At least 3 numbered items
      });

      if (!hasCompleteStructuredContent) {
        validationErrors.push('Incomplete structured content detected for list/indicators query');
      }
    }

    const isValid = strictValidation ?
      (validationErrors.length === 0 && maxScore >= minScore) :
      (maxScore >= minScore * 0.7); // More lenient for non-strict mode

    console.log(`✅ Content validation result: ${isValid ? 'VALID' : 'INVALID'}`);
    if (validationErrors.length > 0) {
      console.log(`⚠️ Validation errors: ${validationErrors.join(', ')}`);
    }

    return {
      isValid,
      relevanceScore: maxScore,
      hasTextbookContent,
      validationErrors,
      recommendedAction: isValid ? 'use_content' :
        (maxScore > minScore * 0.5 ? 'retry_search' : 'knowledge_gap_response')
    };
  }

  /**
   * Check if query is asking about book structure
   */
  private isStructuralQuery(query: string): boolean {
    const structuralPatterns = [
      /how many chapters/i,
      /how many units/i,
      /explain chapter/i,
      /summarize.*chapter/i,
      /chapter.*summary/i,
      /what exercises/i,
      /exercise.*chapter/i,
      /distinguish.*between/i,
      /compare.*topics/i,
      /book structure/i,
      /textbook organization/i
    ];

    return structuralPatterns.some(pattern => pattern.test(query));
  }

  /**
   * Handle structural queries about textbook organization
   */
  private async handleStructuralQuery(
    query: string,
    options: EnhancedRAGOptions = {}
  ): Promise<EnhancedRAGResult> {
    console.log('📚 Processing structural query:', query);

    try {
      // Create a mock book structure for demonstration
      // In production, this would be retrieved from processed PDF metadata
      const mockBookStructure: BookStructure = {
        title: `${options.subject || 'Science'} Class ${options.classLevel || 'IX'}`,
        totalChapters: 15,
        totalUnits: 5,
        chapters: [
          {
            number: 1,
            title: 'Fundamental Unit of Life',
            pageStart: 58,
            pageEnd: 79,
            sections: [
              { title: 'What is a Living Organism?', level: 1, page: 58, contentType: 'concept', hasEquations: false, hasTables: false, hasDiagrams: true },
              { title: 'Cell Theory', level: 2, page: 60, contentType: 'concept', hasEquations: false, hasTables: false, hasDiagrams: false },
              { title: 'Plant Cell vs Animal Cell', level: 2, page: 65, contentType: 'concept', hasEquations: false, hasTables: true, hasDiagrams: true }
            ],
            exercises: [],
            keyTopics: ['Cell Theory', 'Plant Cell', 'Animal Cell', 'Cell Wall', 'Chloroplasts'],
            difficulty: 'intermediate' as const,
            estimatedReadingTime: 45
          }
        ],
        units: [],
        exercises: [
          {
            chapter: 1,
            type: 'end_chapter' as const,
            questionCount: 12,
            difficulty: 'medium' as const,
            topics: ['Cell Structure', 'Cell Functions'],
            pageNumbers: [78, 79]
          }
        ],
        metadata: {
          subject: options.subject || 'Science',
          class: options.classLevel || 'Class IX',
          board: 'CBSE' as const,
          language: 'English' as const,
          publisher: 'NCERT',
          year: 2023
        }
      };

      const structuralAnswer = await this.structureAnalyzer.answerStructuralQuery(query, mockBookStructure);

      return {
        answer: structuralAnswer,
        sources: [{
          content: 'Textbook Structure Analysis',
          metadata: {
            source: `${mockBookStructure.metadata.subject} ${mockBookStructure.metadata.class} Textbook`,
            page: 1,
            confidence: 0.95,
            content_type: 'text' as const
          },
          relevance_score: 0.95
        }],
        confidence: 0.95,
        processing_time: Date.now(),
        search_strategy: 'structural_analysis',
        validation: {
        // @ts-ignore
          is_relevant: true,
          confidence_score: 0.95,
          content_quality: 'high',
          curriculum_alignment: true,
          age_appropriate: true,
          factual_accuracy: 'verified'
        }
      };

    } catch (error) {
      console.error('❌ Structural query processing failed:', error);
      throw error;
    }
  }

  /**
   * Enhanced search with Docling-processed content and Qdrant vector search
   */
  async search(query: string, options: EnhancedRAGOptions = {}): Promise<EnhancedRAGResult> {
    const startTime = Date.now();

    try {
      console.log(`🔍 Enhanced RAG search: "${query.substring(0, 50)}..."`);
      console.log(`📚 Options:`, JSON.stringify(options, null, 2));

      // Check if this is a structural query
      if (this.isStructuralQuery(query)) {
        console.log('📚 Detected structural query - using structure analyzer');
        return await this.handleStructuralQuery(query, options);
      }

      // Auto-detect subject and enhance query
      const enhancedQuery = await this.enhanceQuery(query, options);
      
      // Check if re-ranking is enabled
      const rerankingEnabled = process.env.ENABLE_RERANKING === 'true' &&
                               (options.enableReranking !== false);

      // Adjust topK for re-ranking (retrieve more chunks initially)
      const initialTopK = rerankingEnabled
        ? (options.rerankingInitialTopK || parseInt(process.env.RERANKING_INITIAL_TOPK || '20'))
        : (options.topK || 5);

      const finalTopK = options.rerankingFinalTopK || options.topK || 5;

      // Convert options to Qdrant format
      const qdrantOptions: QdrantSearchOptions = {
        subject: options.subject,
        classLevel: options.classLevel,
        topK: initialTopK, // Use initial topK for re-ranking
        enableHybridSearch: options.enableHybridSearch || true,
        contentTypes: options.contentTypes,
        sectionLevel: options.sectionLevel, // ✅ Only add if explicitly provided (don't default to 3)
        requiresEquations: options.requiresEquations,
        requiresTables: options.requiresTables
      };

      // Perform search with fallback strategies
      let searchResult;
      let searchStrategy = 'primary';

      try {
        // 🔧 CRITICAL FIX: Use smart subject filtering BEFORE primary search
        if (options.subject) {
          console.log('🔧 Creating smart subject filter for:', options.subject);
          const smartFilter = await this.createSmartSubjectFilter(options.subject);
          if (smartFilter) {
            console.log('✅ Using smart subject filter');
            qdrantOptions.subjectFilter = smartFilter;
          } else {
            console.log('⚠️ Smart filter creation failed, proceeding without subject filter');
        // @ts-ignore
            qdrantOptions.subjectFilter = null;
          }
        }

        // Primary search with strict filters
        searchResult = await qdrantSearch.search(enhancedQuery, qdrantOptions);

        // 🛡️ ENHANCED: Auto-correct filter mismatches when no results found
        if (searchResult.results.length === 0 && options.enableFallback) {
          console.log('🔄 FILTER AUTO-CORRECTION: No results found, analyzing and correcting filters...');

          const correctedOptions = await this.autoCorrectFilterMismatches(qdrantOptions, enhancedQuery);

          if (correctedOptions) {
            console.log('🔧 FILTER AUTO-CORRECTION: Applying corrected filters...');
            searchResult = await qdrantSearch.search(enhancedQuery, correctedOptions);
            searchStrategy = 'auto_corrected';

            if (searchResult.results.length > 0) {
              console.log(`✅ FILTER AUTO-CORRECTION: Found ${searchResult.results.length} results with corrected filters`);
            }
          }

          // Fallback to smart subject filter if auto-correction didn't work
          if (searchResult.results.length === 0 && options.subject) {
            console.log('🔄 FILTER AUTO-CORRECTION: Trying smart subject filter fallback...');

            const smartFilter = await this.createSmartSubjectFilter(options.subject);
            const smartOptions = {
              ...qdrantOptions,
              subjectFilter: smartFilter
            };

            searchResult = await qdrantSearch.search(enhancedQuery, smartOptions);
            searchStrategy = 'smart_fallback';
          }
        }

        // If insufficient results and fallback enabled, try relaxed search
        if (searchResult.results.length < 2 && options.enableFallback) {
          console.log('🔄 Primary search insufficient, trying relaxed fallback...');

          const fallbackOptions = {
            ...qdrantOptions,
            sectionLevel: undefined, // Remove section level restriction
            contentTypes: undefined, // Remove content type restriction
            subjectFilter: null, // Remove subject filter
            topK: (options.topK || 5) * 2 // Increase result count
          };

        // @ts-ignore
          searchResult = await qdrantSearch.search(enhancedQuery, fallbackOptions);
          searchStrategy = 'relaxed_fallback';
        }

        // Emergency search with no filters
        if (searchResult.results.length === 0 && options.enableFallback) {
          console.log('🔄 Still no results, trying emergency search with no filters...');

          const emergencyOptions = {
            topK: (options.topK || 5) * 3,
            enableHybridSearch: false // Use simple vector search
          };

          searchResult = await qdrantSearch.search(query, emergencyOptions); // Use original query
          searchStrategy = 'emergency';
        }

      } catch (error) {
        console.error('❌ Enhanced search failed:', error);
        throw error;
      }

      // 🛡️ RETRIEVAL VALIDATION: Filter out low-relevance chunks before ranking
      const validatedResults = this.filterByRelevanceThreshold(
        searchResult.results,
        query,
        options
      );

      // 🎯 CROSS-ENCODER RE-RANKING: Re-score chunks for better precision
      let rerankedResults = validatedResults;
      let rerankingStats = null;

      if (rerankingEnabled && validatedResults.length > 0) {
        try {
          console.log(`🎯 Re-ranking ${validatedResults.length} chunks with cross-encoder...`);

          const { crossEncoderReranker } = await import('./cross-encoder-reranker');

          const rerankResult = await crossEncoderReranker.rerankWithStats(
            query,
            validatedResults,
            finalTopK
          );

          rerankedResults = rerankResult.results;
          rerankingStats = rerankResult.stats;

          console.log(`✅ Re-ranking completed: ${rerankingStats.processing_time_ms}ms`);
          console.log(`   Avg score delta: ${rerankingStats.avg_score_delta.toFixed(3)}`);
          console.log(`   Avg rank change: ${rerankingStats.avg_rank_change.toFixed(1)}`);
        } catch (error) {
          console.error('⚠️ Re-ranking failed, using original ranking:', error);
          // Fallback to original ranking
          rerankedResults = validatedResults.slice(0, finalTopK);
        }
      } else {
        // No re-ranking, just take top K
        rerankedResults = validatedResults.slice(0, finalTopK);
      }

      // Post-process results with educational ranking
      const rankedResults = this.rankEducationalRelevance(
        rerankedResults,
        query,
        options
      );

      // CRITICAL: Validate content before returning
      const validation = this.validateContentRelevance(query, rankedResults, options);

      // Calculate textbook fidelity score
      const textbookFidelityScore = validation.hasTextbookContent ?
        Math.min(validation.relevanceScore * 100, 95) : 0;

      const processingTime = Date.now() - startTime;

      console.log(`✅ Enhanced RAG found ${rankedResults.length} results in ${processingTime}ms`);
      console.log(`📊 Validation: ${validation.isValid ? 'PASSED' : 'FAILED'} (${validation.recommendedAction})`);
      console.log(`📚 Textbook fidelity: ${textbookFidelityScore.toFixed(1)}%`);

      return {
        results: rankedResults,
        search_strategy: `${searchStrategy}_${searchResult.search_strategy}${rerankingEnabled ? '_reranked' : ''}`,
        processing_time: processingTime,
        // @ts-ignore
        total_found: searchResult.total_found,
        validation,
        textbook_fidelity_score: textbookFidelityScore,
        knowledge_gap_detected: !validation.isValid,
        debug_info: {
          ...searchResult.debug_info,
          enhanced_query: enhancedQuery,
          original_query: query,
          search_strategy: searchStrategy,
          validation_errors: validation.validationErrors,
          reranking_stats: rerankingStats
        }
      };

    } catch (error) {
      console.error('❌ Enhanced RAG pipeline failed:', error);
      throw new Error(`Enhanced RAG search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search with query decomposition for complex multi-part questions
   */
  async searchWithDecomposition(query: string, options: EnhancedRAGOptions = {}): Promise<EnhancedRAGResult> {
    const startTime = Date.now();

    try {
      console.log(`🔍 Search with query decomposition: "${query}"`);

      // Check if query decomposition is enabled
      const decompositionEnabled = process.env.ENABLE_QUERY_DECOMPOSITION === 'true' &&
                                   (options.enableQueryDecomposition !== false);

      if (!decompositionEnabled) {
        console.log('⚠️ Query decomposition disabled, using standard search');
        return await this.search(query, options);
      }

      // Import query decomposer
      const { queryDecomposer } = await import('./query-decomposer');

      // Decompose query
      const decomposition = await queryDecomposer.decomposeQuery(query);

      // If query is not complex, use standard search
      if (!decomposition.isComplex || decomposition.subQueries.length === 1) {
        console.log('✅ Query is simple, using standard search');
        return await this.search(query, options);
      }

      console.log(`🔄 Decomposed into ${decomposition.subQueries.length} sub-queries`);

      // Retrieve chunks for each sub-query
      const subQueryResults: Array<{
        subQuery: string;
        results: any[];
        type: string;
        priority: number;
      }> = [];

      for (let i = 0; i < decomposition.subQueries.length; i++) {
        const subQuery = decomposition.subQueries[i];
        console.log(`📝 Sub-query ${i + 1}/${decomposition.subQueries.length}: "${subQuery.query}"`);

        try {
          // Search for this sub-query with reduced topK to avoid overwhelming results
          const subTopK = Math.ceil((options.topK || 5) / decomposition.subQueries.length) + 1;

          const result = await this.search(subQuery.query, {
            ...options,
            topK: subTopK,
            enableQueryDecomposition: false // Prevent recursive decomposition
          });

          subQueryResults.push({
            subQuery: subQuery.query,
            results: result.results,
            type: subQuery.type,
            priority: subQuery.priority
          });

          console.log(`   ✅ Found ${result.results.length} chunks for sub-query ${i + 1}`);
        } catch (error) {
          console.error(`   ❌ Sub-query ${i + 1} failed:`, error);
          // Continue with other sub-queries
        }
      }

      // Synthesize results from all sub-queries
      const synthesizedResults = this.synthesizeSubQueryResults(
        subQueryResults,
        query,
        options.topK || 5
      );

      const processingTime = Date.now() - startTime;

      console.log(`✅ Query decomposition complete: ${synthesizedResults.length} chunks in ${processingTime}ms`);

      // Validate synthesized results
      const validation = this.validateContentRelevance(query, synthesizedResults, options);
      const textbookFidelityScore = this.calculateTextbookFidelityScore(synthesizedResults);

      return {
        results: synthesizedResults,
        search_strategy: 'query_decomposition',
        processing_time: processingTime,
        total_found: synthesizedResults.length,
        validation,
        textbook_fidelity_score: textbookFidelityScore,
        knowledge_gap_detected: !validation.isValid,
        debug_info: {
          original_query: query,
          decomposition: {
            isComplex: decomposition.isComplex,
            subQueries: decomposition.subQueries.map(sq => sq.query),
            reasoning: decomposition.reasoning,
            complexity: decomposition.complexity
          },
          subQueryResults: subQueryResults.map(sqr => ({
            subQuery: sqr.subQuery,
            resultCount: sqr.results.length,
            type: sqr.type,
            priority: sqr.priority
          }))
        }
      };

    } catch (error) {
      console.error('❌ Query decomposition failed:', error);
      console.log('⚠️ Falling back to standard search');
      return await this.search(query, options);
    }
  }

  /**
   * Synthesize results from multiple sub-queries
   * - Deduplicate chunks across sub-queries
   * - Maintain diversity (ensure all sub-queries are represented)
   * - Rank by relevance to original query
   * - Respect topK limit
   */
  private synthesizeSubQueryResults(
    subQueryResults: Array<{
      subQuery: string;
      results: any[];
      type: string;
      priority: number;
    }>,
    originalQuery: string,
    topK: number
  ): any[] {
    console.log(`🔄 Synthesizing results from ${subQueryResults.length} sub-queries...`);

    // Deduplicate chunks by ID
    const chunkMap = new Map<string, any>();
    const chunkSubQueries = new Map<string, string[]>();

    for (const sqResult of subQueryResults) {
      for (const chunk of sqResult.results) {
        const chunkId = chunk.id;

        if (!chunkMap.has(chunkId)) {
          // New chunk - add it
          chunkMap.set(chunkId, {
            ...chunk,
            // Boost score based on sub-query priority
            score: chunk.score * (sqResult.priority / 5),
            // Add metadata about which sub-query matched this chunk
            subQueryMatch: sqResult.subQuery,
            subQueryType: sqResult.type
          });
          chunkSubQueries.set(chunkId, [sqResult.subQuery]);
        } else {
          // Duplicate chunk - boost score and track multiple sub-query matches
          const existingChunk = chunkMap.get(chunkId)!;

          // Boost score for chunks that match multiple sub-queries
          existingChunk.score = Math.max(
            existingChunk.score,
            chunk.score * (sqResult.priority / 5)
          ) * 1.1; // 10% boost for multi-match

          // Track all sub-queries that matched this chunk
          chunkSubQueries.get(chunkId)!.push(sqResult.subQuery);
        }
      }
    }

    console.log(`   📊 Deduplicated: ${chunkMap.size} unique chunks from ${subQueryResults.reduce((sum, sqr) => sum + sqr.results.length, 0)} total`);

    // Convert to array and sort by score
    let synthesizedChunks = Array.from(chunkMap.values());

    // Add metadata about multi-query matches
    synthesizedChunks = synthesizedChunks.map(chunk => ({
      ...chunk,
      matchedSubQueries: chunkSubQueries.get(chunk.id) || [],
      multiQueryMatch: (chunkSubQueries.get(chunk.id)?.length || 0) > 1
    }));

    // Sort by score (descending)
    synthesizedChunks.sort((a, b) => b.score - a.score);

    // Ensure diversity: make sure all sub-queries are represented in top results
    const diverseChunks = this.ensureSubQueryDiversity(
      synthesizedChunks,
      subQueryResults,
      topK
    );

    console.log(`   ✅ Synthesized ${diverseChunks.length} chunks (topK: ${topK})`);

    return diverseChunks;
  }

  /**
   * Ensure diversity in results - make sure all sub-queries are represented
   */
  private ensureSubQueryDiversity(
    chunks: any[],
    subQueryResults: Array<{ subQuery: string; results: any[]; type: string; priority: number }>,
    topK: number
  ): any[] {
    // If we have fewer chunks than topK, return all
    if (chunks.length <= topK) {
      return chunks;
    }

    // Ensure at least one chunk from each sub-query in top results
    const selectedChunks: any[] = [];
    const selectedIds = new Set<string>();
    const subQueriesRepresented = new Set<string>();

    // First pass: select top chunk from each sub-query
    for (const chunk of chunks) {
      if (selectedChunks.length >= topK) break;

      const matchedSubQueries = chunk.matchedSubQueries || [];

      // Check if this chunk represents a new sub-query
      const representsNewSubQuery = matchedSubQueries.some(
        (sq: string) => !subQueriesRepresented.has(sq)
      );

      if (representsNewSubQuery) {
        selectedChunks.push(chunk);
        selectedIds.add(chunk.id);
        matchedSubQueries.forEach((sq: string) => subQueriesRepresented.add(sq));
      }
    }

    // Second pass: fill remaining slots with highest-scoring chunks
    for (const chunk of chunks) {
      if (selectedChunks.length >= topK) break;

      if (!selectedIds.has(chunk.id)) {
        selectedChunks.push(chunk);
        selectedIds.add(chunk.id);
      }
    }

    return selectedChunks;
  }

  /**
   * Process and index PDF using doc-extract-engine (simplified single-tier processing)
   */
  async indexPDF(
    buffer: Buffer,
    metadata: {
      classLevel: string;
      subject: string;
      bookTitle: string;
      curriculum?: string;
      language?: string;
      // Content hierarchy (see content-taxonomy.ts). Book-level constants,
      // stored on every chunk payload. subject (above) = the searchable leaf.
      domain?: string;
      course?: string;
      level?: string;
      book?: string;
      subjectGroup?: string;
      board?: string;
      medium?: string;
    },
    filename: string,
    options?: {
      uploadId?: string;
      organizationId?: string | null;
      materialId?: string | null;
      sourceApp?: SourceApp;
      sourceLocalId?: string | null;
      contentTitle?: string;
      /**
       * The uploaded original. Hashed by the CALLER before this point: the hash
       * drives the dedupe check, and a duplicate must never re-upload the file.
       */
      sourceFile?: {
        buffer: Buffer;
        contentType: string;
        sha256: string;
        bytes: number;
        pageCount?: number | null;
      } | null;
    }
  ): Promise<{
    success: boolean;
    chunks_indexed: number;
    errors: string[];
    processor_used: string;
    stats?: {
      total_pages: number;
      total_chunks: number;
      total_words: number;
      processing_time: number;
      extraction_method: string;
      tables_found?: number;
      equations_found?: number;
      figures_found?: number;
    };
    // PHASE 3: Add validation statistics
    validationStats?: {
      validCount: number;
      invalidCount: number;
      validationRate: number;
      invalidChunks?: Array<{ chunkId: string; error: string }>;
    };
    strategy?: string;
    contentItemId?: string;
  }> {
    // Hoisted above the try so the outer catch can still reach the run and clean
    // up after it. An exception escaping the batch loop — an embedding-API
    // failure, an OOM during extraction — otherwise leaves exactly the leak
    // B.11 exists to close.
    let openRun: SharedContentRun | null = null;

    try {
      console.log(`📚 Processing PDF with doc-extract-engine: ${filename}`);

      // Prepare metadata for doc-extract-engine
      const pdfExtractKitMetadata: PDFExtractKitMetadata = {
        classLevel: metadata.classLevel,
        subject: metadata.subject,
        bookTitle: metadata.bookTitle,
        curriculum: metadata.curriculum,
        language: metadata.language
      };

      // Process with doc-extract-engine (single-tier processing)
      console.log('🚀 Using doc-extract-engine for all document processing');
      const processingResult = await pdfExtractKitProcessor.processPDF(buffer, pdfExtractKitMetadata, filename, options?.uploadId);

      if (!processingResult.success) {
        throw new Error(`doc-extract-engine processing failed: ${processingResult.errors.join(', ')}`);
      }

      // Inject the book-level content hierarchy onto every chunk's metadata so it
      // flows through batching → indexChunksInQdrant → the Qdrant payload.
      const hierarchyMeta = {
        domain: metadata.domain,
        course: metadata.course || metadata.curriculum,
        level: metadata.level,
        book: metadata.book,
        subjectGroup: metadata.subjectGroup,
      };
      for (const ch of processingResult.chunks as any[]) {
        ch.metadata = { ...(ch.metadata || {}), ...hierarchyMeta };
      }

      // Check if multi-level chunking is enabled
      const enableMultiLevelChunking = process.env.ENABLE_MULTI_LEVEL_CHUNKING === 'true';

      // PARTIAL SAVING: Process chunks in batches and save each batch to Qdrant immediately
      const BATCH_SIZE = 50;
      let totalIndexedCount = 0;
      let totalValidCount = 0;
      let totalInvalidCount = 0;
      let resolvedContentItemId: string | undefined;
      const batchFailures: string[] = [];
      let sharedRunAbortReason: string | null = null;
      const allInvalidChunks: Array<{ chunkId: string; error: string }> = [];

      console.log(`📚 Processing ${processingResult.chunks.length} chunks in batches of ${BATCH_SIZE}`);

      // Open the shared-content run ONCE for the whole document, before any
      // embedding. Doing this per batch would create one ingest_run per batch and
      // make each batch supersede (and delete the points of) the one before it.
      const firstChunkMeta: any = (processingResult.chunks as any[])[0]?.metadata || hierarchyMeta || {};
      const sharedRun = await this.beginSharedContentRun(firstChunkMeta, {
        organizationId: options?.organizationId,
        materialId: options?.materialId,
        sourceApp: options?.sourceApp,
        sourceLocalId: options?.sourceLocalId,
        contentTitle: options?.contentTitle || metadata.bookTitle,
        sourceFile: options?.sourceFile,
      });
      openRun = sharedRun;

      // Recorded before indexing so the failure message can tell the operator
      // whether anything is still live for this book.
      let priorActiveRunExisted = false;
      if (sharedRun?.contentItemId) {
        priorActiveRunExisted = await hasActiveIngestRun(sharedRun.contentItemId);
      }

      // Identical bytes already ingested — return before spending a single token.
      if (sharedRun?.deduped) {
        console.log(
          `♻️ Identical file already ingested as content_item ${sharedRun.contentItemId} — ` +
            `linked this upload to it and skipped embedding entirely (0 tokens).`,
        );
        return {
          success: true,
          chunks_indexed: 0,
          deduped: true,
          contentItemId: sharedRun.contentItemId,
          errors: [],
          stats: processingResult.stats,
        } as any;
      }

      for (let batchStart = 0; batchStart < processingResult.chunks.length; batchStart += BATCH_SIZE) {
        const batchChunks = processingResult.chunks.slice(batchStart, batchStart + BATCH_SIZE);
        const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;
        console.log(`🔄 Processing batch ${batchNum} (chunks ${batchStart + 1} to ${batchStart + batchChunks.length})...`);

        let chunksToIndex: any[] = [];

        if (enableMultiLevelChunking) {
          console.log('📚 Multi-level chunking ENABLED for this batch');
          const { multiLevelChunker } = await import('./multi-level-chunker');
          const fullText = batchChunks.map(c => c.text).join('\n\n');

          const multiLevelResult = await multiLevelChunker.chunkText(fullText, {
            class: metadata.classLevel,
            subject: metadata.subject,
            book_title: metadata.bookTitle,
            source: filename,
            curriculum: metadata.curriculum || 'CBSE',
            language: metadata.language || 'English',
            // Carry the content hierarchy through multi-level chunking too
            domain: metadata.domain,
            course: metadata.course || metadata.curriculum,
            level: metadata.level,
            book: metadata.book,
            subjectGroup: metadata.subjectGroup,
          } as any, {
            useGPTForAtomic: true,
            useEnhancedPrompt: true,
            maxRetries: 2,
            enableQualityMetrics: true
          });

          chunksToIndex = [
            ...multiLevelResult.atomic.map(c => ({ ...c, metadata: { ...c.metadata, chunk_level: 'atomic' } })),
            ...multiLevelResult.paragraph.map(c => ({ ...c, metadata: { ...c.metadata, chunk_level: 'paragraph' } })),
            ...multiLevelResult.section.map(c => ({ ...c, metadata: { ...c.metadata, chunk_level: 'section' } }))
          ];
        } else {
          const hierarchicalChunks = transformToHierarchicalChunks(batchChunks);
          chunksToIndex = hierarchicalChunks;
        }

        // Index this batch in Qdrant immediately (partial saving!)
        try {
          const indexingResult = await this.indexChunksInQdrant(chunksToIndex, {
            organizationId: options?.organizationId,
            materialId: options?.materialId,
            sourceApp: options?.sourceApp,
            sourceLocalId: options?.sourceLocalId,
            contentTitle: options?.contentTitle || metadata.bookTitle,
            sharedRun,
          });
          totalIndexedCount += indexingResult.indexedCount;
          totalValidCount += indexingResult.validationStats.validCount;
          totalInvalidCount += indexingResult.validationStats.invalidCount;
          allInvalidChunks.push(...indexingResult.validationStats.invalidChunks);
          resolvedContentItemId = resolvedContentItemId || indexingResult.contentItemId;
          console.log(`✅ Batch ${batchNum} saved to Qdrant: ${indexingResult.indexedCount} chunks indexed`);
        } catch (batchError) {
          console.error(`⚠️ Batch ${batchNum} failed to index in Qdrant:`, batchError);
          batchFailures.push(
            `batch ${batchNum}: ${batchError instanceof Error ? batchError.message : String(batchError)}`,
          );
          // Continue to next batch — partial progress is preserved for DCP's own
          // collection. The shared run is still abandoned after the loop: a
          // half-ingested textbook marked `active` would answer questions from
          // the chapters that happened to survive and silently omit the rest.
        }
      }

      console.log(`🏁 All batches completed. Total indexed: ${totalIndexedCount}`);

      // Close the run. Three outcomes, not two:
      //   - every batch succeeded            -> supersede, delete old, activate
      //   - any batch failed                 -> delete this run's points, fail
      //   - nothing indexed at all           -> same, with a clearer reason
      //
      // Partial success is treated as failure for the SHARED schema on purpose.
      // DCP's own collection keeps whatever landed, but a shared content_item
      // advertising `active` with three of five chapters is worse than one that
      // failed loudly: Varta would answer confidently from the chapters that
      // made it and never mention the ones that didn't.
      if (sharedRun) {
        if (batchFailures.length > 0) {
          await this.abortSharedContentRun(
            sharedRun,
            `${batchFailures.length} batch(es) failed, run abandoned: ${batchFailures.join('; ')}`.slice(0, 1900),
          );
          // Operator-facing, and deliberately specific. "Ingest failed" sends
          // someone hunting; this says which batch broke, that NOTHING was
          // published, and that the previously published version is untouched —
          // so the reply to a failed upload is "fix and retry", not "investigate".
          sharedRunAbortReason =
            `Nothing was published to the shared library. ${batchFailures.length} of ` +
            `${Math.ceil(processingResult.chunks.length / BATCH_SIZE)} batches failed ` +
            `(${batchFailures.join('; ')}). The partial content was removed rather than ` +
            `published half-complete. ` +
            (priorActiveRunExisted
              ? 'The previously published version of this book is still live and unchanged.'
              : 'This book has no previously published version, so nothing is currently live for it.') +
            ' Fix the cause and re-upload the same file.';
        } else if (totalIndexedCount === 0) {
          await this.abortSharedContentRun(sharedRun, 'No chunks were indexed.');
          sharedRunAbortReason =
            'Nothing was published to the shared library: no chunks could be indexed from this file. ' +
            'Check that the PDF contains extractable text rather than page images.';
        } else {
          await this.finalizeSharedContentRun(sharedRun, totalIndexedCount);
        }
        // Closed one way or another — the catch below must not touch it again.
        openRun = null;
      }

      // Get extraction strategy from environment
      const { getValidatedExtractionStrategy } = await import('@/lib/content/chunk-metadata-schema');
      const strategy = getValidatedExtractionStrategy();

      return {
        // A partial ingest that abandoned the shared run is NOT a success, even
        // though DCP's own collection kept what landed. Reporting `success` here
        // because some batches worked is how a loud failure becomes a silent
        // one: the operator sees a green upload and never learns the book is
        // missing from the shared library.
        success: sharedRunAbortReason ? false : totalIndexedCount > 0,
        chunks_indexed: totalIndexedCount,
        errors: sharedRunAbortReason
          ? [sharedRunAbortReason, ...processingResult.errors]
          : processingResult.errors,
        processor_used: 'doc-extract-engine',
        stats: {
          total_pages: processingResult.stats.total_pages,
          total_chunks: totalIndexedCount,
          total_words: processingResult.stats.total_words,
          processing_time: processingResult.stats.processing_time,
          extraction_method: enableMultiLevelChunking ? 'doc-extract-engine + multi-level' : 'doc-extract-engine',
          tables_found: processingResult.stats.tables_found,
          equations_found: processingResult.stats.equations_found,
          figures_found: processingResult.stats.figures_found
        },
        validationStats: {
          validCount: totalValidCount,
          invalidCount: totalInvalidCount,
          validationRate: (totalValidCount + totalInvalidCount) > 0 ? totalValidCount / (totalValidCount + totalInvalidCount) : 1,
          invalidChunks: allInvalidChunks
        },
        strategy,
        contentItemId: resolvedContentItemId
      };

    } catch (error) {
      console.error('❌ doc-extract-engine processing failed:', error);

      // An exception reached here with a run still open: delete its points and
      // mark it failed, rather than leaving a `running` row and orphaned vectors
      // that no later supersede will ever collect.
      if (openRun) {
        await this.abortSharedContentRun(
          openRun,
          `Ingestion threw: ${error instanceof Error ? error.message : String(error)}`.slice(0, 1900),
        ).catch((cleanupErr) => {
          console.error('❌ Failed to clean up the open ingest run:', cleanupErr);
        });
      }

      return {
        success: false,
        chunks_indexed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        processor_used: 'doc-extract-engine'
      };
    }
  }

  /**
   * CURATED LANE — index pre-chunked, human-validated enriched-markdown chunks.
   * Bypasses PDF-Extract-Kit/OCR entirely; the chunks already carry printed page
   * numbers, chapter/section, and typed-block metadata. Reuses the exact same
   * validate → embed (text-embedding-3-large, 3072) → Qdrant tail as the PDF lane,
   * so citations and retrieval behave identically — just from higher-fidelity input.
   */
  async indexMarkdownChunks(
    chunks: any[],
    options?: {
      organizationId?: string | null;
      materialId?: string | null;
      sourceApp?: SourceApp;
      sourceLocalId?: string | null;
      contentTitle?: string;
    }
  ): Promise<{
    success: boolean;
    chunks_indexed: number;
    errors: string[];
    validationStats: {
      validCount: number;
      invalidCount: number;
      validationRate: number;
      invalidChunks: Array<{ chunkId: string; error: string }>;
    };
  }> {
    try {
      await this.ensureCollectionExists();
      const BATCH_SIZE = 50;
      let totalIndexed = 0, totalValid = 0, totalInvalid = 0;
      const allInvalid: Array<{ chunkId: string; error: string }> = [];

      for (let start = 0; start < chunks.length; start += BATCH_SIZE) {
        const batch = chunks.slice(start, start + BATCH_SIZE);
        try {
          const r = await this.indexChunksInQdrant(batch, {
            organizationId: options?.organizationId,
            materialId: options?.materialId,
            sourceApp: options?.sourceApp,
            sourceLocalId: options?.sourceLocalId,
            contentTitle: options?.contentTitle,
          });
          totalIndexed += r.indexedCount;
          totalValid += r.validationStats.validCount;
          totalInvalid += r.validationStats.invalidCount;
          allInvalid.push(...r.validationStats.invalidChunks);
        } catch (batchErr) {
          console.error(`⚠️ Markdown batch ${Math.floor(start / BATCH_SIZE) + 1} failed:`, batchErr);
        }
      }

      return {
        success: totalIndexed > 0,
        chunks_indexed: totalIndexed,
        errors: [],
        validationStats: {
          validCount: totalValid,
          invalidCount: totalInvalid,
          validationRate: (totalValid + totalInvalid) > 0 ? totalValid / (totalValid + totalInvalid) : 1,
          invalidChunks: allInvalid,
        },
      };
    } catch (error) {
      console.error('❌ Markdown ingestion failed:', error);
      return {
        success: false,
        chunks_indexed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        validationStats: { validCount: 0, invalidCount: 0, validationRate: 0, invalidChunks: [] },
      };
    }
  }

  /**
   * Index chunks in Qdrant with enhanced metadata (supports both Docling and doc-extract-engine chunks)
   * Returns validation statistics for Phase 3 monitoring
   *
   * Batch 2b — per-org isolation + bridge tracking:
   *   - options.organizationId (non-empty) tags every point payload with organization_id,
   *     making the chunks private to that org. Omit/null/empty → untagged = global (NCERT base).
   *   - options.materialId (when supplied) records each point in the qdrant_vector_ids bridge
   *     so the material's vectors can later be purged on delete/reconciliation.
   */
  /**
   * Open a document-level shared-content run.
   *
   * Everything true of the DOCUMENT rather than of a batch lives here: canonical
   * identity, dedupe, tenant scope, the stored original, taxonomy links, and the
   * ingest_run itself. indexChunksInQdrant() then consumes the returned context
   * once per batch.
   *
   * Returns null when the caller supplied no identity to anchor on, which keeps
   * DCP's legacy DCP-only ingestion behaving exactly as it did.
   */
  private async beginSharedContentRun(
    firstChunkMeta: any,
    options: {
      organizationId?: string | null;
      materialId?: string | null;
      sourceApp?: SourceApp;
      sourceLocalId?: string | null;
      contentTitle?: string;
      sourceFile?: {
        buffer: Buffer;
        contentType: string;
        sha256: string;
        bytes: number;
        pageCount?: number | null;
      } | null;
    },
  ): Promise<SharedContentRun | null> {
    const ingestionOrgId =
      typeof options.organizationId === 'string' && options.organizationId !== ''
        ? options.organizationId
        : null;

    // Resolve the book registry once — it supplies both the payload tags and the
    // canonical anchor below.
    let taxonomyNodeIds: string[] = [];
    let bookRegistryId: string | null = null;
    try {
      const bookTitle = firstChunkMeta?.bookTitle || firstChunkMeta?.book_title || options.contentTitle;
      if (bookTitle) {
        const book = await resolveOrCreateBook(bookTitle, ingestionOrgId);
        taxonomyNodeIds = book.taxonomyNodeIds;
        bookRegistryId = book.id;
      }
    } catch (err) {
      console.warn('⚠️ Book registry resolution failed, ingesting without taxonomy tags:', err);
    }

    const sharedSourceApp: SourceApp = options.sourceApp || 'digiclassroom';

    // The book-registry row id IS this book's identity in DCP, so it is the
    // anchor — not a fallback behind materialId. Two candidate anchors for one
    // book is how the shared schema ends up with two content_items for the same
    // textbook. One registry row, one content_source_ref. An explicit
    // sourceLocalId still wins for callers with their own identity, but a
    // disagreement is surfaced rather than silently resolved.
    if (options.sourceLocalId && bookRegistryId && options.sourceLocalId !== bookRegistryId) {
      console.warn(
        `⚠️ Two candidate anchors for this book — explicit sourceLocalId="${options.sourceLocalId}" ` +
          `vs book registry id="${bookRegistryId}". Using the explicit one.`,
      );
    }
    const sharedSourceLocalId =
      options.sourceLocalId ||
      bookRegistryId ||
      (typeof options.materialId === 'string' && options.materialId !== '' ? options.materialId : null);

    if (!sharedSourceLocalId) return null;

    const contentTitle =
      options.contentTitle || firstChunkMeta?.bookTitle || firstChunkMeta?.book_title || 'Untitled';

    const resolved = await resolveOrCreateContentItem({
      sourceApp: sharedSourceApp,
      sourceLocalId: sharedSourceLocalId,
      title: contentTitle,
      lang: firstChunkMeta?.medium || firstChunkMeta?.language || null,
      canonicalSha256: options.sourceFile?.sha256 ?? null,
    });

    // Dedupe: identical bytes already ingested. Signalled to the caller BEFORE
    // any embedding happens — the entire value of the hash is that it spares the
    // OpenAI call. Deduping rows after embedding costs exactly the same money and
    // merely hides the waste.
    if (resolved.deduped) {
      return {
        contentItemId: resolved.contentItemId,
        ingestRunId: null,
        scope: { visibility: 'public', grantOrgIds: [] },
        taxonomyNodeIds,
        nextChunkIndex: 0,
        deduped: true,
        sourceAssetId: await findSourceAssetId(resolved.contentItemId),
        assetId: null,
      };
    }

    // Scope. Throws on an unresolvable org rather than defaulting to public.
    const scope = await resolveScopeAndGrant({
      contentItemId: resolved.contentItemId,
      sourceApp: sharedSourceApp,
      localOrgId: ingestionOrgId,
    });
    console.log(`🔐 Scope resolved: visibility=${scope.visibility}, orgs=[${scope.grantOrgIds.join(',')}]`);

    // Store the original under canonical identity. New items only — a duplicate
    // returned above and never reaches this point.
    let sourceAssetId: string | null = await findSourceAssetId(resolved.contentItemId);
    if (options.sourceFile) {
      const { uploadSourceDocumentToR2 } = await import('../../services/r2');
      const key = `content/${resolved.contentItemId}/source.pdf`;
      const { bucket } = await uploadSourceDocumentToR2({
        buffer: options.sourceFile.buffer,
        key,
        contentType: options.sourceFile.contentType,
      });
      sourceAssetId = await recordSourceAsset({
        contentItemId: resolved.contentItemId,
        storageAccount: 'digiclassroom-pro',
        storageUri: `r2://${bucket}/${key}`,
        sha256: options.sourceFile.sha256,
        bytes: options.sourceFile.bytes,
        pageCount: options.sourceFile.pageCount ?? null,
      });
      console.log(`📦 Source stored: r2://${bucket}/${key}`);
    }

    if (taxonomyNodeIds.length > 0) {
      const linked = await replaceTaxonomyLinks(resolved.contentItemId, taxonomyNodeIds);
      console.log(`🏷️ Linked ${linked} taxonomy node(s), first is primary`);
    }

    const ingestRunId = await startIngestRun({
      contentItemId: resolved.contentItemId,
      contentAssetId: sourceAssetId,
      sourceApp: sharedSourceApp,
      embeddingModel: 'text-embedding-3-large',
      embeddingDim: 3072,
      collection: this.collectionName,
    });

    return {
      contentItemId: resolved.contentItemId,
      ingestRunId,
      scope,
      taxonomyNodeIds,
      nextChunkIndex: 0,
      deduped: false,
      sourceAssetId,
      // The PDF lane embeds the source PDF itself, so the chunk-owning asset and
      // the source asset are the same row. The markdown lane sets this to the
      // chapter's enriched_md asset instead.
      assetId: sourceAssetId,
    };
  }

  /**
   * Close a document-level run: supersede -> delete the old run's points ->
   * activate.
   *
   * The order is deliberate. If the process dies partway, the collection still
   * holds the PREVIOUS run's points and the new run is not yet active — stale but
   * retrievable. Activating first would open a window where an active run claims
   * live points that have just been deleted: a book that exists according to
   * Postgres and returns nothing from search.
   */
  /**
   * Abandon a document-level run: delete its points, then mark it failed.
   *
   * Without this, a mid-document failure leaks. The run stays `running`, the
   * PREVIOUS run stays `active`, and the batches that did succeed leave points
   * behind tagged with a run_id that never activates. Supersede only ever
   * targets the *active* run, so nothing collects them — they sit in the
   * collection forever, blending a half-ingested edition into every future
   * search. That is exactly the corruption B.3 exists to prevent, reached
   * through a different branch.
   *
   * Points first, status second — the same discipline as finalize. If cleanup
   * itself dies, a `running` row pointing at real points is recoverable; a
   * `failed` row pointing at ghosts is not, because nothing will ever look for
   * them again.
   */
  private async abortSharedContentRun(
    run: SharedContentRun,
    reason: string,
  ): Promise<void> {
    if (!run.ingestRunId) return;
    try {
      const deleted = await this.qdrant.delete(this.collectionName, {
        wait: true,
        filter: { must: [{ key: 'run_id', match: { value: run.ingestRunId } }] },
      });
      console.log(`🧹 Aborting run ${run.ingestRunId} — deleted its points (${JSON.stringify(deleted?.status ?? 'ok')})`);
    } catch (cleanupErr) {
      // Leave the run `running` so the reconcile query can still find it. A
      // `failed` row whose points were never deleted is invisible garbage.
      console.error(`❌ Could not delete points for failed run ${run.ingestRunId}:`, cleanupErr);
      throw cleanupErr;
    }
    await failIngestRun(run.ingestRunId, reason);
    console.log(`⛔ Ingest run ${run.ingestRunId} marked failed: ${reason}`);
  }

  private async finalizeSharedContentRun(
    run: SharedContentRun,
    indexedCount: number,
  ): Promise<void> {
    if (!run.ingestRunId) return;

    // ── The source-rendition rule ────────────────────────────────────────
    // Re-checked at close rather than trusted from the start: the asset could
    // have been written by a concurrent run, or not at all if this lane never
    // uploaded one. Chunks and assets live in independent tables, so an item
    // with perfect chunks and no source file raises nothing anywhere — iTutor
    // cites it correctly while the reader opens an empty shelf. Refuse to
    // publish that state.
    const sourceAssetId = await findSourceAssetId(run.contentItemId);
    if (!sourceAssetId) {
      throw new Error(
        `Refusing to activate run ${run.ingestRunId}: content_item ${run.contentItemId} ` +
          `has no asset with role='source'. Chunks alone are not a publishable work — ` +
          `the reader would have nothing to open, and nothing would report it. ` +
          `Every lane must upload and register the original file, even when the ` +
          `chunks came from curated markdown.`,
      );
    }

    const priorRunId = await supersedePriorActiveRun(
      run.contentItemId,
      sourceAssetId,
      run.ingestRunId,
    );
    if (priorRunId) {
      console.log(`🔁 Superseding prior run ${priorRunId} — deleting its points`);
      await this.qdrant.delete(this.collectionName, {
        wait: true,
        filter: { must: [{ key: 'run_id', match: { value: priorRunId } }] },
      });
    }

    // A shorter re-ingest would otherwise leave the previous run's tail rows
    // behind, breaking the "points_count equals chunk count" invariant.
    const pruned = await pruneChunksBeyond(sourceAssetId, indexedCount);
    if (pruned > 0) console.log(`🧹 Pruned ${pruned} stale chunk row(s) from a longer previous run`);

    await activateIngestRun(run.ingestRunId, indexedCount);
    console.log(`✅ Ingest run ${run.ingestRunId} is now active with ${indexedCount} chunks`);
  }

  /**
   * Ingest ONE FILE into the shared content spine. Everything after parsing,
   * in one place.
   *
   * Parser-agnostic on purpose: this function never reads a PDF, never reads
   * markdown, and never decides what a chunk is. It is handed a slot and a list
   * of chunks and owns the whole sequence that turns them into published,
   * retrievable content — which is the part that has to be identical across
   * lanes, because every mistake in it (an orphaned run, a lost chapter, a book
   * published without its source file) is invisible until someone asks the
   * library a question and gets a confident wrong answer.
   *
   * The sequence, and why it is ordered this way:
   *
   *   1  resolve the WORK        — by (app, local id), then ISBN, then bytes
   *   2  register the SLOT       — the file occupying (role, part, variant)
   *   3  unchanged? stop here    — before a single embedding token is spent
   *   4  require a source file   — before spending tokens, not after
   *   5  resolve scope + grant   — throws on an org it cannot resolve
   *   6  link taxonomy
   *   7  open the run            — keyed to the ASSET, so sibling chapters do
   *                                not supersede each other
   *   8  embed + upsert
   *   9  supersede -> delete old points -> prune -> activate
   *
   * On any failure from 7 onward the run's points are deleted and the run is
   * marked failed, so a half-ingested chapter never sits in the collection
   * blending into every future search.
   *
   * Returns rather than throws: a batch of fifteen chapters needs to report
   * per-chapter outcomes, and one bad chapter must not abort the other fourteen.
   */
  async ingestPart(input: SpineIngestInput): Promise<SpineIngestResult> {
    const partIndex = input.part.partIndex ?? 0;
    const variant = input.part.variant ?? 'default';
    const label = `${input.part.role}[${partIndex}/${variant}]`;

    const base: SpineIngestResult = {
      status: 'failed',
      contentItemId: null,
      assetId: null,
      ingestRunId: null,
      partIndex,
      chunksWritten: 0,
      pointsUpserted: 0,
    };

    // A 'skip' chunk is not content with a property, it is content that was
    // never ingested — so it gets no row and no vector, and chunk_index counts
    // only what remains.
    const usable = input.chunks.filter((c) => c.retrievalClass !== 'skip');
    const skippedByClass = input.chunks.length - usable.length;
    if (usable.length === 0) {
      return {
        ...base,
        reason: `${label}: nothing indexable — all ${input.chunks.length} chunk(s) were marked skip.`,
      };
    }

    let contentItemId: string | null = null;
    let assetId: string | null = null;
    let ingestRunId: string | null = null;

    try {
      // ── 1. The work ────────────────────────────────────────────────────
      const resolved = await resolveOrCreateContentItem({
        sourceApp: input.sourceApp,
        sourceLocalId: input.sourceLocalId,
        title: input.contentTitle,
        lang: input.lang ?? null,
        isbn: input.isbn ?? null,
        edition: input.edition ?? null,
        // Deliberately NOT the part's sha256. canonical_sha256 identifies the
        // work's own bytes; setting it from a chapter file would make the
        // second chapter of one book dedupe against the first.
        canonicalSha256: null,
      });
      contentItemId = resolved.contentItemId;
      console.log(`📖 ${label}: work ${contentItemId} (${resolved.matchedBy})`);

      // ── 2. The slot ────────────────────────────────────────────────────
      const asset = await registerAsset({
        contentItemId,
        role: input.part.role,
        partIndex,
        partLabel: input.part.partLabel ?? null,
        variant,
        storageAccount: input.part.storageAccount,
        storageUri: input.part.storageUri,
        sha256: input.part.sha256,
        bytes: input.part.bytes ?? null,
        pageCount: input.part.pageCount ?? null,
        pageOffset: input.part.pageOffset ?? null,
      });
      assetId = asset.assetId;

      // ── 3. Unchanged bytes AND something already live for this slot ────
      // Both conditions, not just the first: identical bytes whose previous run
      // failed means nothing is published for this chapter, and reporting
      // "already ingested" there is the one message that stops an operator
      // looking for the chapter that is missing.
      if (!asset.changed && (await hasActiveRunForAsset(assetId))) {
        console.log(`♻️ ${label}: byte-identical and already live — skipped, 0 tokens.`);
        return {
          ...base,
          status: 'skipped_unchanged',
          contentItemId,
          assetId,
          reason: 'Identical file already published for this slot. Nothing re-embedded.',
        };
      }

      // ── 4. The source-rendition rule, checked BEFORE embedding ─────────
      // Chunks and assets are independent tables, so a work with perfect chunks
      // and no source file raises nothing anywhere: iTutor answers and cites it
      // flawlessly while the reader opens an empty shelf. finalize re-checks
      // this at close; checking here as well is what makes the refusal free
      // instead of costing a full embedding run first.
      if (input.part.role !== 'source') {
        const sourceAssetId = await findSourceAssetId(contentItemId);
        if (!sourceAssetId) {
          return {
            ...base,
            contentItemId,
            assetId,
            reason:
              `${label}: this work has no asset with role='source'. Chunks alone are not a ` +
              `publishable work — the reader would have nothing to open and nothing would ` +
              `report it. Upload and register the original file first, then re-run this part.`,
          };
        }
      }

      // ── 5. Scope ───────────────────────────────────────────────────────
      const scope = await resolveScopeAndGrant({
        contentItemId,
        sourceApp: input.sourceApp,
        localOrgId:
          typeof input.organizationId === 'string' && input.organizationId !== ''
            ? input.organizationId
            : null,
      });

      // ── 6. Taxonomy ────────────────────────────────────────────────────
      const taxonomyNodeIds = input.taxonomyNodeIds ?? [];
      if (taxonomyNodeIds.length > 0) {
        await replaceTaxonomyLinks(contentItemId, taxonomyNodeIds);
      }

      // ── 7. The run, keyed to THIS asset ────────────────────────────────
      ingestRunId = await startIngestRun({
        contentItemId,
        contentAssetId: assetId,
        sourceApp: input.sourceApp,
        embeddingModel: 'text-embedding-3-large',
        embeddingDim: 3072,
        collection: this.collectionName,
      });

      const run: SharedContentRun = {
        contentItemId,
        ingestRunId,
        scope,
        taxonomyNodeIds,
        nextChunkIndex: 0,
        deduped: false,
        sourceAssetId: input.part.role === 'source' ? assetId : await findSourceAssetId(contentItemId),
        // chunk_index is contiguous within THIS file. This is the whole reason
        // migration 007 moved the chunk key onto the asset.
        assetId,
      };

      // ── 8. Embed + upsert ──────────────────────────────────────────────
      await this.ensureCollectionExists();
      const laneChunks = usable.map((c, i) => this.toLaneChunk(c, i, input));

      const BATCH_SIZE = 50;
      let indexed = 0;
      for (let start = 0; start < laneChunks.length; start += BATCH_SIZE) {
        const r = await this.indexChunksInQdrant(laneChunks.slice(start, start + BATCH_SIZE), {
          organizationId: input.organizationId,
          sourceApp: input.sourceApp,
          sourceLocalId: input.sourceLocalId,
          contentTitle: input.contentTitle,
          sharedRun: run,
        });
        indexed += r.indexedCount;
      }

      // Every chunk failing validation is a failure, not an empty success —
      // publishing a run with no points gives a book that exists in Postgres and
      // returns nothing from search.
      if (indexed === 0) {
        throw new Error(
          `no chunks survived validation (${usable.length} submitted). ` +
            `Check that each chunk carries class, subject, book_title and page.`,
        );
      }

      // ── 9. Close: supersede -> delete old points -> prune -> activate ──
      const priorRunId = await supersedePriorActiveRun(contentItemId, assetId, ingestRunId);
      if (priorRunId) {
        console.log(`🔁 ${label}: superseding run ${priorRunId} — deleting its points`);
        await this.qdrant.delete(this.collectionName, {
          wait: true,
          filter: { must: [{ key: 'run_id', match: { value: priorRunId } }] },
        });
      }

      const pruned = await pruneChunksBeyond(assetId, indexed);
      if (pruned > 0) console.log(`🧹 ${label}: pruned ${pruned} row(s) left by a longer previous run`);

      await activateIngestRun(ingestRunId, indexed);
      console.log(
        `✅ ${label}: ${indexed} chunk(s) live` +
          (skippedByClass > 0 ? ` (${skippedByClass} skipped by class)` : ''),
      );

      return {
        status: 'indexed',
        contentItemId,
        assetId,
        ingestRunId,
        partIndex,
        chunksWritten: indexed,
        pointsUpserted: indexed,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (ingestRunId) {
        try {
          await this.qdrant.delete(this.collectionName, {
            wait: true,
            filter: { must: [{ key: 'run_id', match: { value: ingestRunId } }] },
          });
          await failIngestRun(ingestRunId, `${label}: ${message}`.slice(0, 1900));
        } catch (cleanupErr) {
          // Left `running` on purpose: a running row pointing at real points is
          // recoverable by the reconcile query, a failed row pointing at ghosts
          // is not, because nothing will ever look for them again.
          console.error(`❌ ${label}: could not clean up run ${ingestRunId}:`, cleanupErr);
        }
      }
      console.error(`⛔ ${label}: ${message}`);
      return { ...base, contentItemId, assetId, ingestRunId, reason: `${label}: ${message}` };
    }
  }

  /**
   * Spine chunk -> the shape indexChunksInQdrant validates and embeds.
   *
   * retrievalClass rides on the chunk OBJECT rather than inside metadata
   * because validation rebuilds metadata from a fixed field list; a top-level
   * property survives that untouched.
   */
  private toLaneChunk(chunk: SpineChunk, index: number, input: SpineIngestInput): any {
    const meta = { ...(chunk.metadata ?? {}) };
    // The spine owns these four; the lane owns everything else it put in
    // metadata. Written unconditionally so a lane cannot disagree with the
    // pages and chapter it declared on the chunk itself.
    if (chunk.pageStart != null) {
      meta.page = chunk.pageStart;
      meta.pageNumber = chunk.pageStart;
    }
    if (chunk.pageEnd != null) meta.pageEndNumber = chunk.pageEnd;
    if (chunk.chapter) meta.chapter = chunk.chapter;
    if (input.lang && !meta.medium && !meta.language) meta.language = input.lang;

    return {
      id: `${input.sourceLocalId}:${input.part.role}:${input.part.partIndex}:${index}`,
      text: chunk.text,
      metadata: meta,
      retrieval_class: chunk.retrievalClass === 'practice' || chunk.retrievalClass === 'reference'
        ? chunk.retrievalClass
        : null,
      /** Spine-supplied page range, kept off metadata so validation cannot reshape it. */
      spine_page_start: chunk.pageStart,
      spine_page_end: chunk.pageEnd,
    };
  }

  private async indexChunksInQdrant(
        // @ts-ignore
    chunks: DoclingChunk[] | any[],
    options: {
      organizationId?: string | null;
      materialId?: string | null;
      // Trio shared-identity registration — when sourceLocalId (or materialId, as a
      // fallback) is present, this batch's chunks also get a canonical content_item
      // + content_chunk rows in the shared `trio` DB, making them reachable from
      // PDLMS's Varta and any other shared-collection consumer, not just DCP's own
      // iTutor. Omit both to keep today's DCP-only behavior unchanged.
      sourceApp?: SourceApp;
      sourceLocalId?: string | null;
      contentTitle?: string;
      /**
       * The document-level run this batch belongs to, from beginSharedContentRun().
       * Absent for legacy DCP-only callers, which keeps their behaviour unchanged.
       */
      sharedRun?: SharedContentRun | null;
    } = {}
  ): Promise<{
    indexedCount: number;
    contentItemId?: string;
    /** True when this file's bytes were already ingested and the run was skipped. */
    deduped?: boolean;
    validationStats: {
      validCount: number;
      invalidCount: number;
      validationRate: number;
      invalidChunks: Array<{ chunkId: string; error: string }>;
    };
  }> {
    // Batch 2b: only a concrete, non-empty org id tags content as private; everything else
    // (platform/system ingestion of NCERT base) stays untagged → global.
    const ingestionOrgId =
      typeof options.organizationId === 'string' && options.organizationId !== ''
        ? options.organizationId
        : null;
    const bridgeMaterialId =
      typeof options.materialId === 'string' && options.materialId !== ''
        ? options.materialId
        : null;
    // PHASE 2: Validate chunks before indexing
    const { validateChunkBatch } = await import('@/lib/content/chunk-metadata-schema');
    const { valid, invalid, stats } = validateChunkBatch(chunks);

    console.log('📊 Chunk Validation Before Indexing:');
    console.log(`  - Total chunks: ${stats.total}`);
    console.log(`  - Valid: ${stats.validCount} (${(stats.validationRate * 100).toFixed(1)}%)`);
    console.log(`  - Invalid: ${stats.invalidCount}`);

    // Collect invalid chunk details for reporting
    const invalidChunks = invalid.map(({ chunk, error }) => ({
      chunkId: chunk.id || 'unknown',
      error: error.message
    }));

    // Log detailed errors for invalid chunks
    if (invalid.length > 0) {
      console.error(`❌ ${invalid.length} chunks failed validation - skipping:`);
      invalid.slice(0, 5).forEach(({ chunk, error }) => {
        console.error(`  - Chunk ${chunk.id || 'unknown'}: ${error.message}`);
      });
      if (invalid.length > 5) {
        console.error(`  ... and ${invalid.length - 5} more`);
      }
    }

    // Use only valid chunks with normalized metadata
    const validatedChunks = valid.map(({ chunk, metadata }) => ({
      ...chunk,
      metadata // Use validated, normalized metadata
    }));

    if (validatedChunks.length === 0) {
      console.warn('⚠️ No valid chunks to index after validation');
      return {
        indexedCount: 0,
        validationStats: {
          validCount: stats.validCount,
          invalidCount: stats.invalidCount,
          validationRate: stats.validationRate,
          invalidChunks
        }
      };
    }

    // Shared registration — content_item, scope, source asset, taxonomy links
    // and the ingest_run — happens ONCE PER DOCUMENT in beginSharedContentRun(),
    // not here.
    //
    // This method is called once per OUTER BATCH by indexPDF. Doing registration
    // here would start a separate ingest_run per batch, and the supersede step
    // would then delete the previous batch's points as a stale run: a
    // three-batch textbook would finish with only its last batch retrievable,
    // reporting success the whole way.
    const sharedRun = options.sharedRun ?? null;
    const contentItemId = sharedRun?.contentItemId ?? null;
    const ingestRunId = sharedRun?.ingestRunId ?? null;
    const scope = sharedRun?.scope ?? { visibility: 'public' as const, grantOrgIds: [] as string[] };

    // Payload taxonomy tags. With a shared run these are already resolved; the
    // fallback keeps DCP's legacy direct callers (no shared identity) behaving
    // exactly as before rather than silently losing their tags.
    let taxonomyNodeIds: string[] = sharedRun?.taxonomyNodeIds ?? [];
    if (!sharedRun) {
      try {
        const firstMeta: any = validatedChunks[0]?.metadata || {};
        const batchBookTitle = firstMeta.bookTitle || firstMeta.book_title;
        if (batchBookTitle) {
          const book = await resolveOrCreateBook(batchBookTitle, ingestionOrgId);
          taxonomyNodeIds = book.taxonomyNodeIds;
        }
      } catch (err) {
        console.warn('⚠️ Book registry resolution failed, ingesting without taxonomy tags:', err);
      }
    }

    // Ensure collection exists before indexing
    await this.ensureCollectionExists();

    const batchSize = 100;
    let indexedCount = 0;
    // Document-wide, NOT per-call. This method runs once per outer batch, so a
    // counter starting at 0 here made every batch reuse chunk_index 0..n — and
    // insertContentChunks' ON CONFLICT (content_item_id, chunk_index) DO UPDATE
    // then overwrote the previous batch's rows instead of appending. A multi-batch
    // book silently kept only its final batch. The offset lives on the shared run
    // so it survives across calls.
    let bridgeChunkIndex = sharedRun ? sharedRun.nextChunkIndex : 0;

    try {
    for (let i = 0; i < validatedChunks.length; i += batchSize) {
      const batch = validatedChunks.slice(i, i + batchSize);

      // Generate embeddings for batch
      const embeddings = await this.generateBatchEmbeddings(
        batch.map(chunk => chunk.text)
      );

      // Generate sparse vectors if hybrid search is enabled
      const enableHybridSearch = process.env.ENABLE_HYBRID_SEARCH === 'true';
      let sparseVectors: any[] = [];

      if (enableHybridSearch) {
        try {
          // Sparse vectors come from the shared tokenizer, NOT from hybridEmbedder.
          //
          // The previous implementation had two defects that produced vectors
          // which looked plausible and retrieved nonsense:
          //
          //   1. `indices: terms.map((_, idx) => idx)` used a term's ARRAY
          //      POSITION WITHIN ITS OWN CHUNK as its sparse index. The same word
          //      therefore got a different index in every chunk, so no two
          //      vectors were comparable and the query side could never line up
          //      with the document side. Nothing errors; recall just collapses.
          //   2. It sent BM25-weighted values while the collection is configured
          //      `modifier: idf`, so Qdrant applied IDF a second time on top.
          //
          // Now: stable FNV-1a hash of the normalized term as index, raw term
          // frequency as value, Qdrant applies IDF. PDLMS/Varta MUST build query
          // vectors with the identical algorithm — see sparse-tokenizer.ts and
          // the shared fixture.
          sparseVectors = batch.map(chunk => buildSparseVector(chunk.text || chunk.content || ''));

          console.log(`🔍 Generated ${sparseVectors.length} sparse vectors for hybrid search`);
        } catch (error) {
          console.error('⚠️ Failed to generate sparse vectors, continuing with dense-only:', error);
          enableHybridSearch && console.log('   Hybrid search will be disabled for this batch');
        }
      }

      // Zip chunk+embedding+sparse-vector together by original batch position BEFORE
      // filtering — the previous filter().map() dropped low-quality chunks first and
      // then re-indexed from 0, which silently misaligned embeddings[index]/
      // sparseVectors[index] against the wrong chunk whenever anything was filtered.
      const qualified = batch
        .map((chunk, originalIndex) => ({ chunk, originalIndex }))
        .filter(({ chunk }) => {
          // Quality threshold: Skip chunks with quality_score < 70
          const qualityScore = chunk.metadata?.quality_score;
          if (qualityScore !== undefined && qualityScore < 70) {
            console.log(`⏭️  Skipping low-quality chunk: quality_score=${qualityScore}%`);
            return false;
          }
          return true;
        });

      // Trio shared identity: pre-write each qualified chunk's Postgres row so its
      // generated UUID can be reused as the Qdrant point id (chunk row and vector
      // always share one identity, no separate bridge needed for the shared side).
      // chunkIndex is a running counter across the whole document (all batches),
      // reused below for the qdrant_vector_ids bridge too, so both stay in sync.
      let chunkUuidByOriginalIndex: Map<number, string> | null = null;
      if (contentItemId) {
        const chunkInputs = qualified.map(({ chunk }, qualifiedIndex) => {
          const m = chunk.metadata || {};
          const cls = chunk.retrieval_class;
          return {
            chunkIndex: bridgeChunkIndex + qualifiedIndex,
            text: chunk.text || chunk.content || '',
            // A spine lane declares the range explicitly, and a block spanning
            // pages 12-13 must not be recorded as ending on 12. Metadata is the
            // fallback for lanes that only ever produce single-page chunks.
            pageStart: chunk.spine_page_start ?? m.pageNumber ?? m.page ?? null,
            pageEnd: chunk.spine_page_end ?? m.pageEndNumber ?? m.pageNumber ?? m.page ?? null,
            chapter: m.chapter || null,
            retrievalClass: cls === 'reference' || cls === 'practice' ? cls : null,
          };
        });
        // Chunks belong to the ASSET that produced them, so chunk_index is
        // contiguous within a file rather than across the book.
        if (!sharedRun?.assetId) {
          throw new Error(
            'Cannot write content_chunk rows without an asset id — chunk_index is keyed per asset.',
          );
        }
        const uuids = await insertContentChunks(contentItemId, sharedRun.assetId, chunkInputs);
        chunkUuidByOriginalIndex = new Map(
          qualified.map(({ originalIndex }, i) => [originalIndex, uuids[i]]),
        );
      }

      const points = qualified.map(({ chunk, originalIndex }, index) => {
          const chunkMetadata = chunk.metadata || {};
          const chunkText = chunk.text || chunk.content || '';
          // Shared-identity chunks use their Postgres content_chunk UUID as the
          // point id; legacy (no contentItemId) ingestion keeps the old numeric id.
          const chunkId = chunkUuidByOriginalIndex?.get(originalIndex) ?? Date.now() + index;

          // Normalize class level to Arabic numerals for consistent filtering
          const rawClassLevel = chunkMetadata.classLevel || chunkMetadata.class || 'Unknown';
          const normalizedClassLevel = this.normalizeClassLevel(rawClassLevel);

        // Build point with dense vector (and sparse vector if available)
        const point: any = {
          id: chunkId,
          payload: {
            text: chunkText,
            subject: chunkMetadata.subject || 'Unknown', // searchable leaf (= book)
            classLevel: normalizedClassLevel, // Store normalized value (e.g., "Class 9" instead of "Class IX")
            class: normalizedClassLevel, // Also store in 'class' field for compatibility
            board: chunkMetadata.board || chunkMetadata.curriculum || 'Unknown',
            medium: chunkMetadata.medium || chunkMetadata.language || 'Unknown',
            bookTitle: chunkMetadata.bookTitle || chunkMetadata.book_title || 'Unknown',
            // ── Content hierarchy (injected onto each chunk in indexPDF) ──
            domain: chunkMetadata.domain || 'Unknown',
            course: chunkMetadata.course || chunkMetadata.curriculum || 'Unknown',
            level: chunkMetadata.level || normalizedClassLevel || 'Unknown',
            book: chunkMetadata.book || chunkMetadata.bookTitle || chunkMetadata.subject || 'Unknown',
            subjectGroup: chunkMetadata.subjectGroup || chunkMetadata.subject || 'Unknown',
            chapter: chunkMetadata.chapter || 'Unknown',
            section: chunkMetadata.section || chunkMetadata.section_title || 'General Section',
            paragraphIndex: chunkMetadata.paragraphIndex || 1,
            hierarchyPath: chunkMetadata.hierarchyPath || [],
            pageNumber: chunkMetadata.pageNumber || chunkMetadata.page || 1,
            hasFormulas: chunkMetadata.hasFormulas || chunkMetadata.contains_equation || false,
            hasTables: chunkMetadata.hasTables || chunkMetadata.contains_table || false,
            chunkType: chunkMetadata.chunkType || chunkMetadata.content_type || 'text',
            extractionMethod: chunkMetadata.extraction_method || 'doc-extract-engine',
            originalId: chunk.id || `chunk_${index}`, // Keep original ID in payload

            // Provenance for the curated (enriched-markdown) lane — lets us tell
            // human-validated content apart from auto-extracted, and surface it in citations.
            ...(chunkMetadata.content_source ? { content_source: chunkMetadata.content_source } : {}),
            ...(chunkMetadata.validation_status ? { validation_status: chunkMetadata.validation_status } : {}),

            // 🛡️ Batch 2b: tag org-private content. Spread keeps NCERT base untagged (global)
            // so it stays matchable by the search-side `organization_id is_empty` condition.
            ...(ingestionOrgId ? { organization_id: ingestionOrgId } : {}),

            // Shared cross-repo curriculum taxonomy — every node this book is tagged
            // onto (primary + cross-listed), resolved once above. See
            // qdrant-search.ts's taxonomyScopeNodeIds for the retrieval-side filter.
            taxonomy_node_ids: taxonomyNodeIds,

            // Enhanced quality metadata
            quality_score: chunkMetadata.quality_score,
            quality_grade: chunkMetadata.quality_grade,
            ocr_quality_score: chunkMetadata.ocr_quality_score,
            ocr_corrections_made: chunkMetadata.ocr_corrections_made,
            chapter_extraction_confidence: chunkMetadata.chapter_extraction_confidence,
            metadata_detection_confidence: chunkMetadata.metadata_detection_confidence,
            detected_formulas_count: chunkMetadata.detected_formulas_count,
            detected_tables_count: chunkMetadata.detected_tables_count,
            detected_sections_count: chunkMetadata.detected_sections_count,
            isAtomic: chunkMetadata.isAtomic,
            minChunkSize: chunkMetadata.minChunkSize,
            section_level: chunkMetadata.section_level,

            // Trio shared-collection fields (see TRIO_RESET_PROGRESS.md Step 5) —
            // only present when this chunk was also registered in the shared
            // content schema above. `visibility`/`grant_org_ids` are denormalized
            // from content.content_grant onto the point so cross-app consumers can
            // filter at query time without a Postgres round-trip.
            ...(contentItemId ? {
              content_item_id: contentItemId,
              // Resolved from identity.org_app_ref, never assumed. A hardcoded
              // 'public' here would publish an org's private book to every
              // tenant — failing OPEN on the one axis that must fail closed.
              visibility: scope.visibility,
              grant_org_ids: scope.grantOrgIds,
              // Which run put this point here. Supersede deletes by this field;
              // without it, a re-ingest leaves the old run's points orphaned
              // alongside the new ones and every future search silently blends
              // two editions of the same book.
              run_id: ingestRunId,
              // Chunk hierarchy level. Multi-level chunking is off (see the
              // known-issue note in docs), so everything is a leaf — but the
              // field is written now because Step 3's retrieval filters
              // `level = 0`. If it were absent, that filter would match nothing
              // against a collection that looks perfectly healthy.
              level: 0,
              lang: chunkMetadata.medium || chunkMetadata.language || null,
              kind: 'book',
              page_start: chunk.spine_page_start ?? chunkMetadata.pageNumber ?? chunkMetadata.page ?? null,
              page_end: chunk.spine_page_end ?? chunkMetadata.pageEndNumber ?? chunkMetadata.pageNumber ?? chunkMetadata.page ?? null,
              // Explanatory prose vs a question/prompt/activity. Denormalized
              // onto the point so retrieval can stop answering a student's
              // question with the textbook's own question. Null when the lane
              // did not classify — absent, not guessed.
              ...(chunk.retrieval_class ? { retrieval_class: chunk.retrieval_class } : {}),
            } : {}),
          }
        };

        // Named vectors, always. The collection declares `dense` and sparse
        // `bm25`; anything else is rejected outright by Qdrant.
        //
        // Both previous shapes were wrong, and neither had ever run:
        //   flag ON  -> { dense, sparse }  ->  "Not existing vector name: sparse"
        //   flag OFF -> a bare array       ->  "Not existing vector name"
        // So ingestion failed on the first batch in either state. The sparse
        // vector is named `bm25` here to match the collection; the query side
        // (qdrant-search.ts) already uses `bm25` via the Query API.
        point.vector = enableHybridSearch && sparseVectors.length > 0
          ? { dense: embeddings[originalIndex], bm25: sparseVectors[originalIndex] }
          : { dense: embeddings[originalIndex] };

        return point;
      });

      // Upsert to Qdrant with error handling
      try {
        await this.qdrant.upsert(this.collectionName, {
          wait: true,
          points
        });
      } catch (error) {
        console.error('❌ Qdrant upsert error:', error);
        console.error('Collection name:', this.collectionName);
        console.error('Points sample:', JSON.stringify(points[0], null, 2));
        throw error;
      }

      // 🛡️ Batch 2b: record this batch's point ids in the bridge (delete/reconciliation).
      // Best-effort and per-batch — bridge bookkeeping must never fail a successful upsert,
      // and recording per-batch keeps earlier batches tracked even if a later one throws.
      // Reuses the SAME running index the content_chunk insert above used, so a
      // chunk's bridge row and its Postgres row agree on chunk_index.
      if (bridgeMaterialId) {
        try {
          const { recordQdrantVectorIds } = await import('@/lib/db/qdrant-vector-ids');
          await recordQdrantVectorIds(
            points.map((p: any, qualifiedIndex: number) => ({
              materialId: bridgeMaterialId,
              pointId: p.id,
              collection: this.collectionName,
              chunkIndex: bridgeChunkIndex + qualifiedIndex,
            }))
          );
        } catch (bridgeError) {
          console.warn('⚠️ Batch 2b: failed to record qdrant_vector_ids bridge rows:', bridgeError);
        }
      }
      bridgeChunkIndex += qualified.length;
      if (sharedRun) sharedRun.nextChunkIndex = bridgeChunkIndex;

      indexedCount += qualified.length;
      console.log(`📥 Indexed batch ${Math.floor(i / batchSize) + 1}: ${indexedCount}/${validatedChunks.length} chunks`);
    }

    console.log(`✅ Indexing complete: ${indexedCount} chunks indexed (${stats.invalidCount} skipped due to validation failures)`);

    return {
      indexedCount,
      contentItemId: contentItemId ?? undefined,
      validationStats: {
        validCount: stats.validCount,
        invalidCount: stats.invalidCount,
        validationRate: stats.validationRate,
        invalidChunks
      }
    };
    } catch (err) {
      // Mark the run honestly on partial/total failure — earlier batches in this
      // call may already have written real content_chunk rows + vectors, so this
      // is "failed after indexing N" not "nothing happened", and chunkCount
      // reflects what actually landed rather than being left at null.
      // NOTE: the ingest_run is document-level and owned by the caller, so a
      // single failed batch is not recorded as a failed run here — indexPDF
      // decides that after all batches have had their turn.
      throw err;
    }
  }

  /**
   * Generate embeddings for batch of texts using OpenAI text-embedding-3-large (3072 dimensions)
   */
  private async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    console.log(`🔢 Generating embeddings for ${texts.length} texts using OpenAI text-embedding-3-large (3072 dims)...`);

    try {
      const embeddings = await this.openai.generateEmbeddings(texts);
      console.log(`?o. Successfully generated ${embeddings.length} embeddings with OpenAI`);
      return embeddings;
    } catch (error) {
      console.error('??O OpenAI embedding generation failed:', error);
      throw error;
    }
  }
  /**
   * Ensure Qdrant collection exists with proper configuration
   */
  private async ensureCollectionExists(): Promise<void> {
    const collections = await this.qdrant.getCollections();
    const exists = collections.collections.some((col: any) => col.name === this.collectionName);

    if (!exists) {
      // Create with the SHAPE THIS PIPELINE WRITES: a named dense vector plus
      // sparse `bm25`. The previous version created `vectors: { size, distance }`
      // — an unnamed vector — so a freshly created collection could never have
      // accepted a single point from this same file.
      console.log(`🔧 Creating Qdrant collection: ${this.collectionName}`);
      await this.qdrant.createCollection(this.collectionName, {
        vectors: { dense: { size: 3072, distance: 'Cosine' } },
        sparse_vectors: { bm25: { modifier: 'idf' } },
        optimizers_config: {
          default_segment_number: 2,
          max_segment_size: 20000,
          memmap_threshold: 50000,
          indexing_threshold: 20000,
          flush_interval_sec: 5,
          max_optimization_threads: 1,
        },
      } as any);
      console.log(`✅ Collection ${this.collectionName} created`);
      return;
    }

    // Collection exists — verify it matches what we are about to write, rather
    // than discovering the mismatch one rejected upsert at a time.
    const info: any = await this.qdrant.getCollection(this.collectionName);
    const params = info?.config?.params ?? {};
    const denseNames = Object.keys(params.vectors ?? {});
    const sparseNames = Object.keys(params.sparse_vectors ?? {});

    if (!denseNames.includes('dense')) {
      throw new Error(
        `Collection "${this.collectionName}" has no named dense vector "dense" ` +
          `(found: ${denseNames.length ? denseNames.join(', ') : 'an unnamed vector'}). ` +
          `This pipeline writes named vectors only; ingesting would fail on every point.`,
      );
    }

    const hybridEnabled = process.env.ENABLE_HYBRID_SEARCH === 'true';

    // The trap this guard exists to close: a dense-only point is perfectly
    // VALID under named vectors. If the collection declares a sparse vector and
    // we ingest with hybrid off, every point lands without `bm25`, Qdrant raises
    // nothing, retrieval quietly degrades to dense-only, and the only fix is
    // re-embedding the entire corpus. Refuse at the start of the run instead.
    if (sparseNames.includes('bm25') && !hybridEnabled) {
      throw new Error(
        `Collection "${this.collectionName}" declares a sparse vector "bm25", but ` +
          `ENABLE_HYBRID_SEARCH is not "true". Ingesting now would write dense-only ` +
          `points that Qdrant accepts without complaint, silently disabling sparse ` +
          `retrieval for this content until it is re-embedded. Set ` +
          `ENABLE_HYBRID_SEARCH=true, or ingest into a collection with no sparse vector.`,
      );
    }

    if (hybridEnabled && !sparseNames.includes('bm25')) {
      throw new Error(
        `ENABLE_HYBRID_SEARCH is "true" but collection "${this.collectionName}" ` +
          `declares no sparse vector "bm25" (found: ${sparseNames.join(', ') || 'none'}). ` +
          `Every upsert would be rejected.`,
      );
    }

    console.log(
      `✅ Collection ${this.collectionName} ready — dense:[${denseNames.join(',')}] ` +
        `sparse:[${sparseNames.join(',') || 'none'}] hybrid:${hybridEnabled}`,
    );
  }


  /**
   * Enhance query with educational context
   */
  private async enhanceQuery(query: string, options: EnhancedRAGOptions): Promise<string> {
    // Add educational context to query
    let enhancedQuery = query;

    // Add subject context
    if (options.subject) {
      enhancedQuery += ` (${options.subject} subject)`;
    }

    // Add class level context
    if (options.classLevel) {
      enhancedQuery += ` (${options.classLevel} level)`;
    }

    // Add content type preferences
    if (options.requiresEquations) {
      enhancedQuery += ' with mathematical equations';
    }

    if (options.requiresTables) {
      enhancedQuery += ' with data tables';
    }

    return enhancedQuery;
  }

  /**
   * 🛡️ RETRIEVAL VALIDATION: Filter chunks by relevance threshold
   * Removes low-relevance chunks to reduce hallucinations
   *
   * @param results - Search results from Qdrant
   * @param query - Original user query
   * @param options - RAG options
   * @returns Filtered results with only high-relevance chunks
   */
  private filterByRelevanceThreshold(
    results: any[],
    query: string,
    options: EnhancedRAGOptions
  ): any[] {
    // Get relevance threshold from environment or options
    // Default: 0.55 for dense-only, 0.65 for hybrid search (more realistic for educational content)
    const defaultThreshold = process.env.ENABLE_HYBRID_SEARCH === 'true' ? '0.65' : '0.55';
    const threshold = parseFloat(process.env.RAG_RELEVANCE_THRESHOLD || defaultThreshold);
    const minChunks = 3; // Minimum chunks to return (fallback threshold)
    const fallbackThreshold = 0.45; // Lower threshold if too few chunks (was 0.6, too strict)

    console.log(`🔍 Filtering chunks by relevance threshold: ${threshold}`);
    console.log(`📊 Initial chunks: ${results.length}`);

    // Filter chunks by threshold
    const filteredResults = results.filter(result => {
      // Qdrant returns score in 0-1 range (cosine similarity)
      return result.score > threshold;
    });

    console.log(`✅ Chunks passing threshold (${threshold}): ${filteredResults.length}`);

    // 🛡️ FALLBACK: If too few chunks pass threshold, use lower threshold
    if (filteredResults.length < minChunks && results.length >= minChunks) {
      console.log(`⚠️ Too few chunks (${filteredResults.length}), applying fallback threshold: ${fallbackThreshold}`);

      const fallbackResults = results.filter(result => result.score > fallbackThreshold);

      console.log(`✅ Chunks passing fallback threshold (${fallbackThreshold}): ${fallbackResults.length}`);

      // Log filtering statistics
      if (fallbackResults.length < results.length) {
        console.log(`🔍 Filtered ${results.length - fallbackResults.length} low-relevance chunks (fallback threshold: ${fallbackThreshold})`);
        console.log(`   Kept: ${fallbackResults.length}/${results.length} chunks`);

        // Log score distribution
        const scores = fallbackResults.map(r => r.score.toFixed(3)).join(', ');
        console.log(`   Scores: [${scores}]`);
      }

      return fallbackResults;
    }

    // Log filtering statistics
    if (filteredResults.length < results.length) {
      console.log(`🔍 Filtered ${results.length - filteredResults.length} low-relevance chunks (threshold: ${threshold})`);
      console.log(`   Kept: ${filteredResults.length}/${results.length} chunks`);

      // Log score distribution
      const scores = filteredResults.map(r => r.score.toFixed(3)).join(', ');
      console.log(`   Scores: [${scores}]`);

      // Log filtered out chunks for monitoring
      const filteredOut = results.filter(r => r.score <= threshold);
      if (filteredOut.length > 0) {
        const filteredScores = filteredOut.map(r => r.score.toFixed(3)).join(', ');
        console.log(`   Filtered out scores: [${filteredScores}]`);
      }
    } else {
      console.log(`✅ All chunks passed relevance threshold`);
    }

    return filteredResults;
  }

  /**
   * Calculate textbook fidelity score from search results
   * Returns a percentage (0-95) indicating how well results match textbook content
   */
  private calculateTextbookFidelityScore(results: any[]): number {
    if (!results || results.length === 0) {
      return 0;
    }

    // Check for textbook content indicators
    const hasTextbookContent = results.some(result =>
      result.payload?.source?.includes('NCERT') ||
      result.payload?.curriculum === 'CBSE' ||
      result.payload?.book_title ||
      result.payload?.chapter ||
      result.metadata?.extraction_method === 'doc-extract-engine'
    );

    if (!hasTextbookContent) {
      return 0;
    }

    // Calculate average relevance score
    const scores = results.map(r => r.score || 0);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Convert to percentage, capped at 95%
    return Math.min(avgScore * 100, 95);
  }

  /**
   * Rank results by educational relevance
   */
  private rankEducationalRelevance(
    results: any[],
    query: string,
    options: EnhancedRAGOptions
  ): any[] {
    return results.map(result => {
      let relevanceBoost = 0;

      // Boost for content type match
      if (options.contentTypes?.includes(result.metadata.content_type)) {
        relevanceBoost += 0.1;
      }

      // Boost for equation content in STEM queries
      if (result.metadata.contains_equation && this.isSTEMQuery(query)) {
        relevanceBoost += 0.08;
      }

      // Boost for table content in data-related queries
      if (result.metadata.contains_table && this.isDataQuery(query)) {
        relevanceBoost += 0.08;
      }

      // Boost for appropriate section level
      if (result.metadata.section_level <= 2) {
        relevanceBoost += 0.05;
      }

      // Boost for high confidence extraction
      if (result.metadata.confidence_score > 0.8) {
        relevanceBoost += 0.03;
      }

      return {
        ...result,
        score: Math.min(1.0, result.score + relevanceBoost)
      };
    }).sort((a, b) => b.score - a.score);
  }

  /**
   * Check if query is STEM-related
   */
  private isSTEMQuery(query: string): boolean {
    const stemKeywords = [
      'equation', 'formula', 'calculate', 'solve', 'theorem', 'proof',
      'experiment', 'reaction', 'molecule', 'atom', 'cell', 'photosynthesis'
    ];
    
    return stemKeywords.some(keyword => 
      query.toLowerCase().includes(keyword)
    );
  }

  /**
   * Check if query requires data/tables
   */
  private isDataQuery(query: string): boolean {
    const dataKeywords = [
      'table', 'data', 'statistics', 'comparison', 'chart', 'graph',
      'population', 'production', 'consumption', 'distribution'
    ];
    
    return dataKeywords.some(keyword => 
      query.toLowerCase().includes(keyword)
    );
  }

  /**
   * 🛡️ NEW: Auto-correct filter mismatches by analyzing actual database content
   */
  private async autoCorrectFilterMismatches(
    originalOptions: any,
    query: string
  ): Promise<any | null> {
    try {
      console.log('🔍 FILTER AUTO-CORRECTION: Analyzing database content for filter mismatches...');

      // Sample database content to understand actual field values
      const samplePayloads = await this.sampleDatabasePayloads();

      if (samplePayloads.length === 0) {
        console.log('⚠️ FILTER AUTO-CORRECTION: No sample payloads found');
        return null;
      }

      console.log(`📊 FILTER AUTO-CORRECTION: Analyzing ${samplePayloads.length} sample payloads`);

      // Analyze subject mismatches
      const correctedSubject = this.correctSubjectMismatch(
        originalOptions.subject,
        samplePayloads
      );

      // Analyze class level mismatches
      const correctedClassLevel = this.correctClassLevelMismatch(
        originalOptions.classLevel,
        samplePayloads
      );

      // Analyze board mismatches
      const correctedBoard = this.correctBoardMismatch(
        originalOptions.board,
        samplePayloads
      );

      // Build corrected options if any corrections were made
      const hasCorrections = correctedSubject !== originalOptions.subject ||
                           correctedClassLevel !== originalOptions.classLevel ||
                           correctedBoard !== originalOptions.board;

      if (hasCorrections) {
        const correctedOptions = {
          ...originalOptions,
          subject: correctedSubject,
          classLevel: correctedClassLevel,
          board: correctedBoard
        };

        console.log('🔧 FILTER AUTO-CORRECTION: Applied corrections:', {
          subject: `"${originalOptions.subject}" -> "${correctedSubject}"`,
          classLevel: `"${originalOptions.classLevel}" -> "${correctedClassLevel}"`,
          board: `"${originalOptions.board}" -> "${correctedBoard}"`
        });

        return correctedOptions;
      }

      console.log('ℹ️ FILTER AUTO-CORRECTION: No corrections needed');
      return null;

    } catch (error) {
      console.error('❌ FILTER AUTO-CORRECTION: Error during auto-correction:', error);
      return null;
    }
  }

  /**
   * 🛡️ NEW: Sample database payloads to understand actual field values
   */
  private async sampleDatabasePayloads(): Promise<any[]> {
    try {
      const scrollResult = await this.qdrant.scroll(this.collectionName, {
        limit: 50,
        with_payload: true
      });

      return scrollResult.points.map(point => point.payload || {});
    } catch (error) {
      console.error('❌ Failed to sample database payloads:', error);
      return [];
    }
  }

  /**
   * 🛡️ NEW: Correct subject name mismatches
   */
  private correctSubjectMismatch(requestedSubject: string, samplePayloads: any[]): string {
    if (!requestedSubject) return requestedSubject;

    // Extract all unique subjects from sample payloads
    const availableSubjects = new Set<string>();
    samplePayloads.forEach(payload => {
      if (payload.subject) {
        availableSubjects.add(payload.subject.toString());
      }
    });

    const availableSubjectsArray = Array.from(availableSubjects);
    console.log(`📚 FILTER AUTO-CORRECTION: Available subjects: ${availableSubjectsArray.join(', ')}`);

    // Try exact match first
    if (availableSubjectsArray.includes(requestedSubject)) {
      return requestedSubject;
    }

    // Try case-insensitive match
    const caseInsensitiveMatch = availableSubjectsArray.find(subject =>
      subject.toLowerCase() === requestedSubject.toLowerCase()
    );
    if (caseInsensitiveMatch) {
      console.log(`🔧 SUBJECT CORRECTION: "${requestedSubject}" -> "${caseInsensitiveMatch}" (case correction)`);
      return caseInsensitiveMatch;
    }

    // Try partial match
    const partialMatch = availableSubjectsArray.find(subject =>
      subject.toLowerCase().includes(requestedSubject.toLowerCase()) ||
      requestedSubject.toLowerCase().includes(subject.toLowerCase())
    );
    if (partialMatch) {
      console.log(`🔧 SUBJECT CORRECTION: "${requestedSubject}" -> "${partialMatch}" (partial match)`);
      return partialMatch;
    }

    // Try subject mapping for common variations
    const subjectMappings: { [key: string]: string } = {
      'social science': 'History', // Default to History for Social Science
      'social studies': 'History',
      'civics': 'Political Science',
      'political science': 'Political Science',
      'economics': 'Economics',
      'geography': 'Geography',
      'history': 'History'
    };

    const mappedSubject = subjectMappings[requestedSubject.toLowerCase()];
    if (mappedSubject && availableSubjectsArray.includes(mappedSubject)) {
      console.log(`🔧 SUBJECT CORRECTION: "${requestedSubject}" -> "${mappedSubject}" (mapping)`);
      return mappedSubject;
    }

    console.log(`⚠️ SUBJECT CORRECTION: No match found for "${requestedSubject}"`);
    return requestedSubject;
  }

  /**
   * 🛡️ NEW: Correct class level mismatches
   */
  private async createSmartSubjectFilter(subject?: string): Promise<any> {
    if (!subject) {
      return null;
    }

    const variations = Array.from(
      new Set([
        subject,
        subject.toLowerCase(),
        subject.toUpperCase(),
        subject.charAt(0).toUpperCase() + subject.slice(1).toLowerCase()
      ])
    ).filter(Boolean);

    if (variations.length === 0) {
      return null;
    }

    if (variations.length === 1) {
      return { must: [{ key: 'subject', match: { value: variations[0] } }] };
    }

    return {
      should: variations.map((value) => ({
        key: 'subject',
        match: { value }
      }))
    };
  }

  private correctClassLevelMismatch(requestedClass: string, samplePayloads: any[]): string {
    if (!requestedClass) return requestedClass;

    // Extract all unique class levels from sample payloads
    const availableClasses = new Set<string>();
    samplePayloads.forEach(payload => {
      if (payload.class) availableClasses.add(payload.class.toString());
      if (payload.classLevel) availableClasses.add(payload.classLevel.toString());
      if (payload.grade) availableClasses.add(payload.grade.toString());
    });

    const availableClassesArray = Array.from(availableClasses);
    console.log(`🎓 FILTER AUTO-CORRECTION: Available classes: ${availableClassesArray.join(', ')}`);

    // Try exact match first
    if (availableClassesArray.includes(requestedClass)) {
      return requestedClass;
    }

    // Try case-insensitive match
    const caseInsensitiveMatch = availableClassesArray.find(cls =>
      cls.toLowerCase() === requestedClass.toLowerCase()
    );
    if (caseInsensitiveMatch) {
      console.log(`🔧 CLASS CORRECTION: "${requestedClass}" -> "${caseInsensitiveMatch}" (case correction)`);
      return caseInsensitiveMatch;
    }

    // Try format variations (Class IX vs Class 9 vs 9)
    const numberMatch = requestedClass.match(/(\d+)/);
    if (numberMatch) {
      const number = parseInt(numberMatch[1]);
      const variations = [
        `Class ${number}`,
        `Class ${this.convertToRoman(number)}`,
        `Grade ${number}`,
        number.toString()
      ];

      for (const variation of variations) {
        if (availableClassesArray.includes(variation)) {
          console.log(`🔧 CLASS CORRECTION: "${requestedClass}" -> "${variation}" (format correction)`);
          return variation;
        }
      }
    }

    console.log(`⚠️ CLASS CORRECTION: No match found for "${requestedClass}"`);
    return requestedClass;
  }

  /**
   * 🛡️ NEW: Correct board name mismatches
   */
  private correctBoardMismatch(requestedBoard: string, samplePayloads: any[]): string {
    if (!requestedBoard) return requestedBoard;

    // Extract all unique boards from sample payloads
    const availableBoards = new Set<string>();
    samplePayloads.forEach(payload => {
      if (payload.board) availableBoards.add(payload.board.toString());
      if (payload.curriculum) availableBoards.add(payload.curriculum.toString());
      if (payload.board_type) availableBoards.add(payload.board_type.toString());
    });

    const availableBoardsArray = Array.from(availableBoards);
    console.log(`🏛️ FILTER AUTO-CORRECTION: Available boards: ${availableBoardsArray.join(', ')}`);

    // Try exact match first
    if (availableBoardsArray.includes(requestedBoard)) {
      return requestedBoard;
    }

    // Try case-insensitive match
    const caseInsensitiveMatch = availableBoardsArray.find(board =>
      board.toLowerCase() === requestedBoard.toLowerCase()
    );
    if (caseInsensitiveMatch) {
      console.log(`🔧 BOARD CORRECTION: "${requestedBoard}" -> "${caseInsensitiveMatch}" (case correction)`);
      return caseInsensitiveMatch;
    }

    console.log(`⚠️ BOARD CORRECTION: No match found for "${requestedBoard}"`);
    return requestedBoard;
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
   * Initialize the enhanced RAG system
   */
  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing Enhanced RAG Pipeline...');

      // Initialize Qdrant collection
      await qdrantSearch.initializeCollection();

      console.log('✅ Enhanced RAG Pipeline initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Enhanced RAG Pipeline:', error);
      throw error;
    }
  }

  /**
   * Normalize class level to Arabic numerals for consistent filtering
   * Converts "Class IX" -> "Class 9", "9" -> "Class 9", "IX" -> "Class 9", etc.
   * Always returns "Class X" format with Arabic numerals
   */
  private normalizeClassLevel(classLevel: string): string {
    if (!classLevel || classLevel === 'Unknown') return 'Unknown';

    const cleaned = classLevel.trim();

    // Roman numeral to Arabic conversion map
    const romanToArabic: { [key: string]: string } = {
      'XII': '12', 'XI': '11', 'X': '10', 'IX': '9', 'VIII': '8',
      'VII': '7', 'VI': '6', 'V': '5', 'IV': '4', 'III': '3', 'II': '2', 'I': '1'
    };

    // Extract numeric value (Roman or Arabic)
    const romanMatch = cleaned.match(/(?:Class\s+)?([IVX]+)/i);
    const arabicMatch = cleaned.match(/(?:Class\s+)?(\d{1,2})/);

    if (romanMatch) {
      const roman = romanMatch[1].toUpperCase();
      const arabic = romanToArabic[roman];
      if (arabic) {
        console.log(`📝 Normalized class level: "${classLevel}" -> "Class ${arabic}"`);
        return `Class ${arabic}`;
      }
    } else if (arabicMatch) {
      const arabic = arabicMatch[1];
      console.log(`📝 Normalized class level: "${classLevel}" -> "Class ${arabic}"`);
      return `Class ${arabic}`;
    }

    console.warn(`⚠️ Could not normalize class level: "${classLevel}"`);
    return 'Unknown';
  }
}

export const enhancedRAG = new EnhancedRAGPipeline();
export const enhancedRAGPipeline = enhancedRAG; // Alias for backward compatibility












