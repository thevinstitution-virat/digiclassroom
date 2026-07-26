/**
 * ExamPreparation Generation Node — Unit Tests
 *
 * Validates the LangGraph exam preparation agent node
 * with mocked LLM and services.
 */

import { examPreparationNode } from '@/lib/agents/graph/agents/ExamPreparationNode';
import type { TutorState } from '@/lib/agents/graph/TutorGraphState';
import { HumanMessage } from '@langchain/core/messages';

// Mock LangChainModelFactory
jest.mock('@/lib/llm/LangChainModelFactory', () => ({
    getLangChainModel: jest.fn().mockReturnValue({
        invoke: jest.fn().mockResolvedValue({
            content: '## 📝 Exam Preparation Plan for Class 10 Science\n\n' +
                '### 🔴 High Priority Chapters\n' +
                '1. Chemical Reactions (15% weightage)\n' +
                '2. Life Processes (12% weightage)\n\n' +
                '### 📅 Study Timeline\n' +
                'Week 1: Foundation Building\n' +
                'Week 2: Application & Practice\n\n' +
                '📚 **Reference:** Chapter 1: Chemical Reactions, Page(s) 3-15\n\n' +
                '**हौसला रखो, सफलता ज़रूर मिलेगी!** 🌟',
            usage_metadata: {
                input_tokens: 450,
                output_tokens: 200,
                total_tokens: 650,
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
    messages: [new HumanMessage('How should I prepare for my science exam?')],
    studentName: 'Priya',
    grade: 10,
    subject: 'science',
    language: 'english',
    sessionId: 'unit-test-exam-001',
    studentId: 'student-002',
    retrievedChunks: [],
    citations: [
        {
            id: 'cite_exam_1',
            textbookTitle: 'NCERT Class 10 Science',
            chapter: 'Chemical Reactions',
            pageNumber: 5,
            sectionHeading: 'Introduction',
            contentExcerpt: 'Chemical reactions involve the transformation of substances.',
            citationFormat: 'NCERT Class 10 Science, Chapter Chemical Reactions, Page 5',
            classLevel: 'Class 10',
            subject: 'Science',
        },
    ],
    ncertScopeValid: true,
};

describe('ExamPreparation Generation Node — Unit Tests', () => {
    it('should return a non-empty rawResponse', async () => {
        const result = await examPreparationNode(mockState as TutorState);
        expect(result.rawResponse).toBeDefined();
        expect(result.rawResponse!.length).toBeGreaterThan(50);
    });

    it('should contain exam preparation content markers', async () => {
        const result = await examPreparationNode(mockState as TutorState);
        expect(result.rawResponse).toContain('Exam Preparation');
    });

    it('should populate tokenUsage from LLM response', async () => {
        const result = await examPreparationNode(mockState as TutorState);
        expect(result.tokenUsage).toBeDefined();
        expect(result.tokenUsage!.promptTokens).toBe(450);
        expect(result.tokenUsage!.completionTokens).toBe(200);
        expect(result.tokenUsage!.totalTokens).toBe(650);
    });

    it('should set generationTimeMs >= 0', async () => {
        const result = await examPreparationNode(mockState as TutorState);
        expect(result.generationTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should set confidenceScore based on response length', async () => {
        const result = await examPreparationNode(mockState as TutorState);
        expect(result.confidenceScore).toBeGreaterThan(0.5);
    });

    it('should return string content (not object)', async () => {
        const result = await examPreparationNode(mockState as TutorState);
        expect(typeof result.rawResponse).toBe('string');
    });
});
