import { logger } from '@/lib/logger';

// src/lib/agents/core/services/retrieval.service.ts

import { VectorStoreService, EducationalContext, SearchResponse, ContentResult } from '@/lib/services/vector_store_service';
import { getCachedRAGResult, setCachedRAGResult } from './cache.service';
import { ScopedWebSearchService } from '@/lib/services/ScopedWebSearchService';

/**
 * Retrieval Service
 * Abstracts the underlying VectorStore implementation and provides clean
 * methods for agents to fetch contextually relevant educational content.
 * Phase 2: Integrated Redis caching and cross-encoder reranking.
 */
export class RetrievalService {
    private vectorService: VectorStoreService;
    private webSearch: ScopedWebSearchService;

    constructor(vectorService?: VectorStoreService) {
        this.vectorService = vectorService || new VectorStoreService();
        this.webSearch = new ScopedWebSearchService();
    }

    public async searchRelevantContent(context: EducationalContext): Promise<SearchResponse> {
        const cached = await getCachedRAGResult<SearchResponse>({
            query: context.query,
            subject: context.subject,
            grade: context.grade_level,
            organizationId: context.organizationId,
        });
        if (cached) {
            logger.info(`\u26a1 [RetrievalService] Cache hit for: ${context.query.substring(0, 40)}...`);
            return { ...cached, search_strategy: cached.search_strategy + '_cached' };
        }

        const response = await this.vectorService.search_relevant_content(context);
        const reranked = await this.applyReranking(context.query, response, context.limit);

        // Track C: Append optional web results for current affairs queries
        const webResults = await this.webSearch.search({
            query: context.query,
            subject: context.subject,
            grade: context.grade_level
        });

        const finalResponse = {
            ...reranked,
            webContext: webResults || undefined
        };

        // Phase 4 pre-flight: shorter cache for web-enriched responses (current affairs)
        const cacheTtl = webResults && webResults.length > 0 ? 3600 : 604800; // 1hr vs 7 days
        await setCachedRAGResult({ query: context.query, subject: context.subject, grade: context.grade_level, organizationId: context.organizationId }, finalResponse, cacheTtl);
        return finalResponse;
    }

    public async searchExplanationContext(context: EducationalContext): Promise<SearchResponse> {
        const cached = await getCachedRAGResult<SearchResponse>({
            query: context.query,
            subject: context.subject,
            grade: context.grade_level,
            organizationId: context.organizationId,
        });
        if (cached)
  return { ...cached, search_strategy: cached.search_strategy + '_cached' };

        const response = await this.vectorService.search_explanation_content(context);
        const reranked = await this.applyReranking(context.query, response, context.limit);

        // Track C: Append optional web results for current affairs queries
        const webResults = await this.webSearch.search({
            query: context.query,
            subject: context.subject,
            grade: context.grade_level
        });

        const finalResponse = {
            ...reranked,
            webContext: webResults || undefined
        };

        await setCachedRAGResult({ query: context.query, subject: context.subject, grade: context.grade_level, organizationId: context.organizationId }, finalResponse);
        return finalResponse;
    }

    public async searchHomeworkContext(context: EducationalContext): Promise<SearchResponse> {
        const cached = await getCachedRAGResult<SearchResponse>({
            query: context.query,
            subject: context.subject,
            grade: context.grade_level,
            organizationId: context.organizationId,
        });
        if (cached)
  return { ...cached, search_strategy: cached.search_strategy + '_cached' };

        const response = await this.vectorService.search_homework_content(context);
        const reranked = await this.applyReranking(context.query, response, context.limit);
        await setCachedRAGResult({ query: context.query, subject: context.subject, grade: context.grade_level, organizationId: context.organizationId }, reranked);
        return reranked;
    }

    private async applyReranking(query: string, response: SearchResponse, limit = 5): Promise<SearchResponse> {
        try {
            const { crossEncoderReranker } = await import('../../../ai/rag/cross-encoder-reranker');

            // Map ContentResult -> any chunk for reranker
            // The reranker expects chunk.content for model input. ContentResult has chunk.text.
            const mappedResults = response.results.map(r => ({
                ...r,
                content: r.text
            }));

            const reranked = await crossEncoderReranker.rerank(query, mappedResults, limit);

            // Map back to ContentResult
            response.results = reranked.map(r => ({
                text: r.content, // preserve from spread content
                metadata: r.metadata,
                score: r.rerank_score
            }));

            return response;
        } catch (error) {
            // Reranker is an optimization, not a dependency: if its native runtime
            // (onnxruntime) fails to load, return vector-search order unreranked.
            logger.warn(`⚠️ [RetrievalService] Reranker unavailable, using vector order: ${error instanceof Error ? error.message.split('\n')[0] : 'unknown error'}`);
            response.results = response.results.slice(0, limit);
            return response;
        }
    }

    public formatEducationalContext(results: ContentResult[]): string {
        return this.vectorService.format_educational_context(results);
    }
}
