import { ExamPreparationAgent } from '@/lib/agents/exam_preparation_agent';
import { RetrievalService } from '@/lib/agents/core/services/retrieval.service';
import { CitationService } from '@/lib/agents/core/services/citation.service';

// Mock LLM Factory and Provider
jest.mock('@/lib/agents/core/llm/llm-factory', () => ({
    LLMFactory: {
        getProvider: jest.fn().mockReturnValue({
            generateChatCompletion: jest.fn().mockResolvedValue({
                text: "This is a mock AI response covering Newton's laws.",
                model: "mock-model",
                usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
            })
        })
    }
}));

// Mock Retrieval Service
jest.mock('@/lib/agents/core/services/retrieval.service', () => ({
    RetrievalService: jest.fn().mockImplementation(() => ({
        searchRelevantContent: jest.fn().mockResolvedValue({
            results: [
                {
                    text: "Newton's first law states that an object will remain at rest...",
                    score: 0.95,
                    metadata: { source: "NCERT Physics Class 11", chapter: "Laws of Motion", page: 12 }
                }
            ]
        }),
        formatEducationalContext: jest.fn().mockReturnValue("Formatted context string")
    }))
}));

describe('Golden Flow: ExamPreparationAgent', () => {
    let agent: ExamPreparationAgent;

    beforeEach(() => {
        agent = new ExamPreparationAgent();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should generate an exam preparation guide based on retrieved content', async () => {
        const request = {
            query: "Explain Newton's Laws of Motion",
            subject: "Physics",
            classLevel: "11",
            userId: "test-student-123",
            metadata: {
                board: "CBSE",
                marks: 5,
                questionType: "explanation"
            }
        };

        const response = await agent.execute(request);

        // Verify response structure
        expect(response).toBeDefined();
        expect(response.content).toContain("This is a mock AI response");
        expect(response.metadata).toBeDefined();
        expect(response.metadata.agentName).toBe('exam_preparation');
        expect(response.metadata.route).toBe('exam_prep');

        // Test passes if it didn't crash and returned formatted AgentResponse
    });
});
