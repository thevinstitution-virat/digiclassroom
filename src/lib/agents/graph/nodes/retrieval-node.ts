import { logger } from '@/lib/logger';

/**
 * Retrieval Node — Shared graph node for vector search + web search.
 * Uses existing RetrievalService (which already integrates ScopedWebSearchService).
 */

import type { TutorState } from '../TutorGraphState';
import { RetrievalService } from '@/lib/agents/core/services/retrieval.service';
import type { EducationalContext } from '@/lib/services/vector_store_service';
import { isNCERTCitation } from '@/types/citations';
import type { AnyCitation, NCERTCitation } from '@/types/citations';

const retrievalService = new RetrievalService();

export async function retrievalNode(state: TutorState): Promise<Partial<TutorState>> {
    const query = state.messages.at(-1)?.content as string;
    const start = Date.now();

    const context: EducationalContext = {
        query,
        subject: state.subject,
        grade_level: state.grade,
        board_type: 'CBSE',
        limit: 10,
        // Batch 2b: scope retrieval to the querying org (+ global NCERT); see TutorGraphState.
        organizationId: state.organizationId,
    };

    // RetrievalService already has ScopedWebSearchService integrated (Phase 3)
    // Web search fires automatically if query is eligible — no extra code needed
    const response = await retrievalService.searchRelevantContent(context);

    // Phase 5.3: Chunk budget cap — each NCERT chunk averages ~400 tokens
    // 15 chunks × 400 tokens = ~6000 tokens (safe for gpt-4o 128k context)
    const MAX_CHUNKS = 15;
    const budgetedResults = response.results.slice(0, MAX_CHUNKS);
    if (response.results.length > MAX_CHUNKS) {
        logger.warn(
            `[RetrievalNode] Capped chunks: ${response.results.length} → ${MAX_CHUNKS} ` +
            `for query: "${query?.slice(0, 50)}..."`
        );
    }

    // Build citations from ContentResult metadata
    const ncertCitations: NCERTCitation[] = budgetedResults
        .filter(r => r.metadata.page && r.metadata.page > 0)
        .map((r, i) => ({
            id: `cite_${i + 1}`,
            textbookTitle: `NCERT Class ${r.metadata.class_level} ${r.metadata.subject}`,
            chapter: r.metadata.chapter || '',
            pageNumber: r.metadata.page || 0,
            classLevel: r.metadata.class_level,
            subject: r.metadata.subject,
            contentExcerpt: r.text.slice(0, 100),
            citationFormat: `NCERT Class ${r.metadata.class_level} ${r.metadata.subject}, Chapter ${r.metadata.chapter}, Page ${r.metadata.page}`,
            confidence: r.score,
        }));

    // Combine NCERT + web citations into AnyCitation[]
    const allCitations: AnyCitation[] = [
        ...ncertCitations,
        ...(response.webContext || []),
    ];

    const ncertCount = allCitations.filter(isNCERTCitation).length;
    const webCount = allCitations.filter(c => !isNCERTCitation(c)).length;

    return {
        retrievedChunks: budgetedResults,
        citations: allCitations,
        ncertCitationCount: ncertCount,
        webCitationCount: webCount,
        confidenceScore: response.confidence,
        retrievalTimeMs: Date.now() - start,
    };
}
