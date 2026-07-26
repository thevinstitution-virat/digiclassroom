import { HumanMessage } from "@langchain/core/messages";
import { cbseAnswerFormatterNode } from '@/lib/agents/graph/agents/CbseAnswerFormatterNode';
import type { TutorState } from '@/lib/agents/graph/TutorGraphState';

// Mock LangChainModelFactory
jest.mock('@/lib/llm/LangChainModelFactory', () => ({
    getLangChainModel: jest.fn().mockReturnValue({
        invoke: jest.fn().mockImplementation(async (messages: any[]) => {
            const text = typeof messages[messages.length - 1].content === 'string'
                ? messages[messages.length - 1].content
                : 'test';

            // If asking for 3 marks, simulate a 3-point answer
            if (text.includes('[3 marks]')) {
                return {
                    content: "**Introduction:** Photosynthesis is a process.\n\n### 1. Light Absorption.\n Chlorophyll absorbs light.\n\n### 2. Water Splitting.\n Water splits into oxygen and hydrogen.\n\n### 3. Carbon Reduction.\n CO2 reduces to glucose.",
                    usage_metadata: { input_tokens: 10, output_tokens: 50 }
                };
            }

            // Default mock response
            return {
                content: "This is a formatted answer based on context.",
                usage_metadata: { input_tokens: 10, output_tokens: 20 }
            };
        })
    }),
    getActiveProviderName: jest.fn().mockReturnValue('openai'),
    getActiveModelName: jest.fn().mockReturnValue('gpt-4o-mini'),
    clearModelCache: jest.fn(),
}));

const mockState: Partial<TutorState> = {
    sessionId: 'test-session',
    studentId: 'student123',
    subject: 'science',
    grade: 10,
    ncertScopeValid: true,
    citations: [],
    messages: []
};

describe('CBSE Answer Formatter Node', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('formats 3-mark answer with exactly 3 numbered points', async () => {
        const state = {
            ...mockState,
            messages: [new HumanMessage('[3 marks] Define photosynthesis.')],
        };
        const result = await cbseAnswerFormatterNode(state as TutorState);
        const numberedPoints = result.rawResponse!.match(/^\d+\./gm) || result.rawResponse!.match(/### \d+\./gm);
        expect(numberedPoints?.length).toBeGreaterThanOrEqual(3);
    });

    it('returns tokenUsage metrics', async () => {
        const state = {
            ...mockState,
            messages: [new HumanMessage('Define photosynthesis.')],
        };
        const result = await cbseAnswerFormatterNode(state as TutorState);
        expect(result.tokenUsage).toBeDefined();
        expect(result.tokenUsage?.totalTokens).toBeGreaterThan(0);
    });
});
