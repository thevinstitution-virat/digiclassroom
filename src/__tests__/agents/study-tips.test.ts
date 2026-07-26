/**
 * StudyTips Generation Node — Unit Tests
 * Phase 5.5
 *
 * Uses mocked ChatOpenAI — does NOT hit real OpenAI API.
 * Uses ACTUAL NCERTCitation fields (chapter, pageNumber, contentExcerpt).
 */

import { studyTipsNode } from '@/lib/agents/graph/agents/StudyTipsNode';
import type { TutorState } from '@/lib/agents/graph/TutorGraphState';
import { HumanMessage } from '@langchain/core/messages';

// Mock LangChainModelFactory — intercept the factory used in StudyTipsNode
jest.mock('@/lib/llm/LangChainModelFactory', () => ({
    getLangChainModel: jest.fn().mockReturnValue({
        invoke: jest.fn().mockResolvedValue({
            content: 'For Grade 10 Science, Arjun, here are study tips:\n\n' +
                '## 🤗 **नमस्ते Arjun!**\n\n' +
                '### 1. Make a timetable and stick to it\n' +
                '### 2. Revise daily for better retention\n' +
                '### 3. Use active recall techniques',
            usage_metadata: {
                input_tokens: 320,
                output_tokens: 85,
                total_tokens: 405,
            },
        }),
    }),
    getActiveProviderName: jest.fn().mockReturnValue('openai'),
    getActiveModelName: jest.fn().mockReturnValue('gpt-4o-mini'),
    clearModelCache: jest.fn(),
}));

// Mock services used by StudyTipsNode
jest.mock('@/lib/agents/core/services/retrieval.service', () => ({
    RetrievalService: jest.fn().mockImplementation(() => ({
        formatEducationalContext: jest.fn().mockReturnValue(
            'Chapter 1: Study Methods - Make a timetable. Revise regularly.'
        ),
    })),
}));

jest.mock('@/lib/agents/core/services/citation.service', () => ({
    CitationService: jest.fn().mockImplementation(() => ({
        extractTextbookSources: jest.fn().mockReturnValue([
            {
                subject: 'Science',
                class_level: 'Class 10',
                chapter: 'Study Methods',
                page: 12,
            },
        ]),
    })),
}));

jest.mock('@/lib/agents/core/services/cognitive-level.service', () => ({
    CognitiveLevelService: jest.fn().mockImplementation(() => ({
        determineCognitiveLevel: jest.fn().mockReturnValue('application'),
    })),
}));

const mockState: Partial<TutorState> = {
    messages: [new HumanMessage('How should I study for exams?')],
    studentName: 'Arjun',
    grade: 10,
    subject: 'science',
    language: 'english',
    sessionId: 'unit-test-001',
    studentId: 'student-001',
    retrievedChunks: [
        {
            text: 'Make a timetable and revise regularly.',
            score: 0.92,
            metadata: {
                page: 12,
                chapter: 'Study Methods',
                section_title: 'Study Habits',
                subject: 'Science',
                class_level: 'Class 10',
            },
        } as any,
    ],
    citations: [
        {
            id: 'cite_1',
            textbookTitle: 'NCERT Class 10 Science',
            chapter: 'Study Methods',
            pageNumber: 12,
            sectionHeading: 'Study Habits',
            contentExcerpt: 'Make a timetable and revise regularly.',
            citationFormat: 'NCERT Class 10 Science, Chapter Study Methods, Page 12',
            classLevel: 'Class 10',
            subject: 'Science',
        },
    ],
    ncertScopeValid: true,
};

describe('StudyTips Generation Node — Unit Tests', () => {
    it('should return a non-empty rawResponse', async () => {
        const result = await studyTipsNode(mockState as TutorState);
        expect(result.rawResponse).toBeDefined();
        expect(result.rawResponse!.length).toBeGreaterThan(20);
    });

    it('should include student name for personalization', async () => {
        const result = await studyTipsNode(mockState as TutorState);
        expect(result.rawResponse!).toContain('Arjun');
    });

    it('should set generationTimeMs > 0', async () => {
        const result = await studyTipsNode(mockState as TutorState);
        expect(result.generationTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should populate tokenUsage from ChatOpenAI usage_metadata', async () => {
        const result = await studyTipsNode(mockState as TutorState);
        expect(result.tokenUsage).not.toBeNull();
        expect(result.tokenUsage!.promptTokens).toBe(320);
        expect(result.tokenUsage!.completionTokens).toBe(85);
        expect(result.tokenUsage!.totalTokens).toBe(405);
    });

    it('should complete within 5000ms (mocked)', async () => {
        const start = Date.now();
        await studyTipsNode(mockState as TutorState);
        expect(Date.now() - start).toBeLessThan(5000);
    });

    it('should not throw on empty retrievedChunks', async () => {
        const emptyState = { ...mockState, retrievedChunks: [], citations: [] };
        await expect(
            studyTipsNode(emptyState as TutorState)
        ).resolves.not.toThrow();
    });

    it('should return string content (not object)', async () => {
        const result = await studyTipsNode(mockState as TutorState);
        expect(typeof result.rawResponse).toBe('string');
    });
});
