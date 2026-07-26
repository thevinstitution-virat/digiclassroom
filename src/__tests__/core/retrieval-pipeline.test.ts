import { RetrievalService } from '@/lib/agents/core/services/retrieval.service';

// Mock VectorStoreService
jest.mock('@/lib/services/vector_store_service', () => {
    return {
        VectorStoreService: jest.fn().mockImplementation(() => ({
            search_relevant_content: jest.fn().mockResolvedValue({
                results: [
                    {
                        text: "Sample retrieved text from Biology chapter 4",
                        score: 0.88,
                        metadata: {
                            source: "NCERT Biology Class 10",
                            chapter: "4",
                            page: 45,
                            subject: "Biology",
                            class_level: "Class 10",
                            content_type: "text",
                            relevance_score: 0.88
                        }
                    }
                ],
                total_results: 1,
                search_strategy: 'hybrid',
                processing_time: 15,
                confidence: 0.88,
            }),
            format_educational_context: jest.fn().mockReturnValue(
                '📚 Relevant Textbook Content:\n\n1. Biology - Class 10\n   Content: Sample retrieved text...'
            ),
        }))
    };
});

// Mock cache service — return null (cache miss) so we exercise the search path
jest.mock('@/lib/agents/core/services/cache.service', () => ({
    getCachedRAGResult: jest.fn().mockResolvedValue(null),
    setCachedRAGResult: jest.fn().mockResolvedValue(undefined),
}));

// Mock the cross-encoder reranker — passthrough with rerank_score
jest.mock('@/lib/ai/rag/cross-encoder-reranker', () => ({
    crossEncoderReranker: {
        rerank: jest.fn().mockImplementation((_query: string, results: Array<{ content: string; metadata: unknown; score: number }>, _limit: number) => {
            return results.map(r => ({
                ...r,
                rerank_score: r.score, // preserve original score
            }));
        }),
    }
}));

// Mock ScopedWebSearchService
jest.mock('@/lib/services/ScopedWebSearchService', () => ({
    ScopedWebSearchService: jest.fn().mockImplementation(() => ({
        search: jest.fn().mockResolvedValue(null),
    }))
}));

describe('RetrievalService Pipeline', () => {
    let retrievalService: RetrievalService;

    beforeEach(() => {
        retrievalService = new RetrievalService();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should fetch content matching board and grade filters', async () => {
        const query = "What is Photosynthesis?";

        const response = await retrievalService.searchRelevantContent({
            query,
            subject: "Biology",
            grade_level: 10,
            board_type: "CBSE",
            limit: 3
        });

        expect(response.results).toBeDefined();
        expect(response.results.length).toBeGreaterThan(0);
        expect(response.results[0].text).toContain("Sample retrieved text");
        expect(response.results[0].metadata.source).toContain("NCERT");
    });
});
