import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { usingOpenRouter } from './client';

/**
 * ModelRouter estimates the complexity of a conversation or query
 * and routes it to the most cost-effective model tier.
 *
 * The model NAMES must match the active endpoint (see openrouter/client.ts):
 * OpenRouter uses `vendor/model` slugs; OpenAI-direct uses bare model ids.
 * Sending an OpenRouter slug like `meta-llama/…` to api.openai.com 404s, so the
 * tier table follows whichever endpoint the shared client resolved to.
 */
export class ModelRouter {
    private static readonly TIERS = usingOpenRouter
        ? {
            EASY: 'meta-llama/llama-3.3-70b-instruct',
            MEDIUM: 'meta-llama/llama-3.3-70b-instruct',
            HARD: 'meta-llama/llama-3.3-70b-instruct',
        }
        : {
            // OpenAI direct — models that exist on api.openai.com. Mini for the
            // common case (matches OpenAIService.CHAT_MODEL), gpt-4o for the
            // genuinely hard, reasoning-heavy queries flagged by the heuristics.
            EASY: 'gpt-4o-mini',
            MEDIUM: 'gpt-4o-mini',
            HARD: 'gpt-4o',
        };

    /**
     * Determine the optimal model based on the conversational context
     */
    static routeCurrentQuery(messages: ChatCompletionMessageParam[]): string {
        // 1. Extract the latest user prompt
        const latestUserMessage = [...messages].reverse().find(m => m.role === 'user');
        const query = latestUserMessage?.content?.toString() || '';

        // 2. Extract some context about the conversation depth
        const totalMessages = messages.length;
        let queryLength = query.length;

        // 3. Fallback to medium if we can't analyze deeply
        if (!query) {
            return this.TIERS.MEDIUM;
        }

        // --- Complex Heuristics ---
        const isHard = this.evaluateHardCriteria(query, totalMessages);
        if (isHard) {
            return this.TIERS.HARD;
        }

        const isMedium = this.evaluateMediumCriteria(query, queryLength);
        if (isMedium) {
            return this.TIERS.MEDIUM;
        }

        // Default to Easy for short/simple queries
        return this.TIERS.EASY;
    }

    private static evaluateHardCriteria(query: string, messageCount: number): boolean {
        const qLower = query.toLowerCase();

        // Very long, multi-turn conversations generally require stronger context windows and logic tracking
        if (messageCount > 10) return true;

        // Complex academic concepts
        const hardKeywords = [
            'derive', 'prove', 'theorem', 'critique', 'synthesize', 'differentiate between',
            'quantum', 'calculus', 'integration', 'thermodynamics', 'algorithm complexity',
            // Code related complexity
            'architect', 'refactor', 'system design', 'database schema'
        ];

        return hardKeywords.some(kw => qLower.includes(kw));
    }

    private static evaluateMediumCriteria(query: string, length: number): boolean {
        const qLower = query.toLowerCase();

        // Moderate length queries
        if (length > 150) return true;

        // Moderate complexity keywords
        const mediumKeywords = [
            'explain', 'describe', 'summarize', 'compare', 'analyze', 'why', 'how does',
            'steps', 'process', 'outline'
        ];

        if (mediumKeywords.some(kw => qLower.includes(kw))) return true;

        // Check if it contains multiple questions
        const questionMarks = (query.match(/\?/g) || []).length;
        if (questionMarks > 1) return true;

        return false;
    }
}
