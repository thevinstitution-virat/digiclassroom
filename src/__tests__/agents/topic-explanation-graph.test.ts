/**
 * TopicExplanation Generation Node — Unit Tests
 *
 * Validates the LangGraph topic explanation agent node
 * with mocked LLM.
 */

import { topicExplanationNode } from '@/lib/agents/graph/agents/TopicExplanationNode';
import type { TutorState } from '@/lib/agents/graph/TutorGraphState';
import { HumanMessage } from '@langchain/core/messages';

// Mock LangChainModelFactory
jest.mock('@/lib/llm/LangChainModelFactory', () => ({
    getLangChainModel: jest.fn().mockReturnValue({
        invoke: jest.fn().mockResolvedValue({
            content: '## 🔬 Photosynthesis — A Complete Explanation\n\n' +
                'Photosynthesis is the process by which green plants convert sunlight ' +
                'into chemical energy.\n\n' +
                '### Key Steps\n' +
                '1. Light Absorption by chlorophyll\n' +
                '2. Water splitting (Photolysis)\n' +
                '3. Carbon fixation (Calvin cycle)\n\n' +
                '📚 **Reference:** Chapter 6: Life Processes, Page(s) 95-102',
            usage_metadata: {
                input_tokens: 380,
                output_tokens: 150,
                total_tokens: 530,
            },
        }),
    }),
    getActiveProviderName: jest.fn().mockReturnValue('openai'),
    getActiveModelName: jest.fn().mockReturnValue('gpt-4o-mini'),
    clearModelCache: jest.fn(),
}));

// Mock citation type guard
jest.mock('@/types/citations', () => ({
    isNCERTCitation: jest.fn().mockReturnValue(true),
}));

const mockState: Partial<TutorState> = {
    messages: [new HumanMessage('Explain photosynthesis in detail')],
    studentName: 'Ravi',
    grade: 10,
    subject: 'science',
    language: 'english',
    sessionId: 'unit-test-topic-001',
    studentId: 'student-003',
    retrievedChunks: [],
    citations: [
        {
            id: 'cite_topic_1',
            textbookTitle: 'NCERT Class 10 Science',
            chapter: 'Life Processes',
            pageNumber: 95,
            sectionHeading: 'Photosynthesis',
            contentExcerpt: 'The process of photosynthesis occurs in chloroplasts.',
            citationFormat: 'NCERT Class 10 Science, Chapter Life Processes, Page 95',
            classLevel: 'Class 10',
            subject: 'Science',
        },
    ],
    ncertScopeValid: true,
};

describe('TopicExplanation Generation Node — Unit Tests', () => {
    it('should return a non-empty rawResponse', async () => {
        const result = await topicExplanationNode(mockState as TutorState);
        expect(result.rawResponse).toBeDefined();
        expect(result.rawResponse!.length).toBeGreaterThan(50);
    });

    it('should contain topic explanation content', async () => {
        const result = await topicExplanationNode(mockState as TutorState);
        expect(result.rawResponse).toContain('Photosynthesis');
    });

    it('should populate tokenUsage', async () => {
        const result = await topicExplanationNode(mockState as TutorState);
        expect(result.tokenUsage).toBeDefined();
        expect(result.tokenUsage!.totalTokens).toBe(530);
    });

    it('should set generationTimeMs >= 0', async () => {
        const result = await topicExplanationNode(mockState as TutorState);
        expect(result.generationTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should return string content', async () => {
        const result = await topicExplanationNode(mockState as TutorState);
        expect(typeof result.rawResponse).toBe('string');
    });
});
