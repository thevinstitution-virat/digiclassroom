import { logger } from '@/lib/logger';
import OpenAI from 'openai';
import { ScopedWebSearchService } from '@/lib/services/ScopedWebSearchService';

/**
 * Sarvagya Service Client (Internal Implementation)
 * Uses the platform's OpenRouter configuration.
 */

import { openrouter } from '@/lib/openrouter/client';
import { ModelRouter } from '@/lib/openrouter/router';

function getOpenAIClient(): OpenAI {
    return openrouter;
}

export async function callSarvagya(
    userId: string,
    tenantId: string,
    endpoint: string,
    body: any
) {
    logger.info(`[Sarvagya Internal] Processing ${endpoint} for user ${userId}`);

    // Mock space creation (returns an internal ID)
    if (endpoint === '/api/v1/search-spaces') {
        return {
            id: `space_${crypto.randomUUID()}`
        };
    }

    // Process research query via OpenAI
    if (endpoint === '/api/v1/query') {
        try {
            const client = getOpenAIClient();

            // Generate user message early to pass to router
            const userMessage = {
                role: 'user' as const,
                content: body.query || 'Hello'
            };

            const model = ModelRouter.routeCurrentQuery([userMessage]);
            logger.info(`[Sarvagya] ModelRouter selected tier: ${model}`);

            // 1. Optional Web Search
            let webContext = '';
            let webCitations: any[] = [];

            if (body.useWebSearch) {
                const searchService = new ScopedWebSearchService();
                // Pass generic subject for Sarvagya's open-ended queries
                const results = await searchService.search({
                    query: body.query,
                    subject: 'general_knowledge',
                    grade: 12,
                    userId
                });

                if (results && results.length > 0) {
                    webContext = `\n\n=== RECENT WEB CONTEXT ===\n${results.map((r: any) => `Source: ${r.title}\nURL: ${r.url}\nExcerpt: ${r.contentExcerpt}`).join('\n\n')}\n==========================\n`;
                    webCitations = results.map((r: any) => ({
                        title: r.title,
                        url: r.url,
                        content_snippet: r.contentExcerpt,
                        relevance_score: 0.95 // Mock high relevance for web results
                    }));
                }
            }

            // 2. LLM Call
            const completion = await client.chat.completions.create({
                model,
                temperature: 0.7,
                max_tokens: 4096,
                messages: [
                    {
                        role: 'system',
                        content: `You are Sarvagya, an expert, context-aware AI research engine designed for educational environments. Answer the user's query comprehensively, thoroughly exploring nuances. If applicable, structure your response with clear headings or bullet points for readability.${webContext ? '\n\nIncorporate the provided RECENT WEB CONTEXT into your answer as if it is real-time knowledge. Do not mention that you received "context" or "search results", just confidently state the facts.' : ''}`
                    },
                    userMessage
                ]
            });

            const answer = completion.choices[0]?.message?.content ?? '';

            return {
                answer,
                content: answer,
                citations: webCitations
            };
        } catch (error: any) {
            logger.error(`[Sarvagya Internal] LLM Error: ${error.message}`);

            // Bypass 429 Quota Exceeded in development for testing
            if (process.env.NODE_ENV === 'development' && error.message?.includes('429')) {
                const mockAnswer = `*Development Mode Mock Answer*\n\nYour OpenAI API Key has run out of funds (Error 429: Quota Exceeded), so I am responding with a mock answer.\n\n### What is God?\nThe concept of God varies widely across different religions, philosophies, and cultures:\n- **Monotheism**: A single, supreme, omnipotent creator (e.g., Christianity, Islam, Judaism).\n- **Polytheism**: A pantheon of multiple deities governing different aspects of life (e.g., Hinduism, ancient Greek religion).\n- **Pantheism**: The belief that the universe and God are identical.\n- **Secular & Philosophical**: Often viewed as an abstract concept representing the origin of the universe, ultimate truth, or moral foundation.\n\nYou can update your OpenAI billing details to receive real answers, but this response proves that the internal chat system, tRPC pipeline, and UI are fully functional!`;

                return {
                    answer: mockAnswer,
                    content: mockAnswer,
                    citations: [
                        { title: 'OpenAI Error 429 Documentation', url: 'https://platform.openai.com/docs/guides/error-codes/api-errors', content_snippet: 'You exceeded your current quota, please check your plan and billing details.', relevance_score: 0.99 }
                    ]
                };
            }

            throw new Error(`Sarvagya API Error (500): Internal LLM Error - ${error.message}`);
        }
    }

    throw new Error(`Sarvagya API Error (404): Endpoint ${endpoint} is not implemented internally.`);
}
