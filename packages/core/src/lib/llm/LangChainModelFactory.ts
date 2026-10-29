/**
 * LangChainModelFactory
 * Returns the appropriate LangChain BaseChatModel based on LLM_PROVIDER env var.
 *
 * WHY THIS EXISTS:
 * LLMFactory (Phase 1) returns ILLMProvider — our custom interface for legacy agents.
 * LangGraph nodes need LangChain BaseChatModel — a different type hierarchy.
 * This factory bridges that gap.
 *
 * WHY SEPARATE FROM LLMFactory:
 * ILLMProvider and BaseChatModel are incompatible types.
 * Two factories, each serving their consumer, is the correct pattern.
 */

import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { addTutorTokens, tutorModelOverride } from '../ai/tutor-tiers';
import { reportAiFailure } from '../ai/ai-alert';

/**
 * Adds each OpenAI call's tokens to the current tutor request (its token window counts every agent call), and reports
 * a failed call to GlitchTip. Awaited, so the count is complete before the route records it.
 */
class TutorUsageHandler extends BaseCallbackHandler {
    name = 'tutor-usage';
    awaitHandlers = true;

    handleLLMEnd(output: any): void {
        const lo = output?.llmOutput?.tokenUsage ?? output?.llmOutput?.estimatedTokenUsage;
        if (lo) return addTutorTokens(lo.promptTokens ?? 0, lo.completionTokens ?? 0);
        const m = output?.generations?.[0]?.[0]?.message?.usage_metadata;
        if (m) addTutorTokens(m.input_tokens ?? 0, m.output_tokens ?? 0);
    }

    handleLLMError(err: unknown): void {
        reportAiFailure('tutor-agent', err);
    }
}
const tutorUsage = new TutorUsageHandler();

export interface LangChainModelConfig {
    temperature?: number;
    maxTokens?: number;
    streaming?: boolean;
    providerOverride?: string; // Phase 8: Used for A/B testing variants
}

// Module-level cache — built in from day one
// Key: "{provider}:{temperature}:{streaming}"
const modelCache = new Map<string, BaseChatModel>();

export function getLangChainModel(config: LangChainModelConfig = {}): BaseChatModel {
    const provider = config.providerOverride || getActiveProviderName();
    // A Basic/Prime tier chosen for this request picks the OpenAI model; it is part of the cache key, so each tier
    // keeps its own model object.
    const tierModel = provider === 'openai' ? tutorModelOverride() : undefined;
    const cacheKey = `${provider}:${config.temperature ?? 0.3}:${config.streaming ?? false}${tierModel ? `:${tierModel}` : ''}`;

    if (modelCache.has(cacheKey)) {
        return modelCache.get(cacheKey)!;
    }

    const model = createLangChainModel(provider, config);
    modelCache.set(cacheKey, model);
    return model;
}

function createLangChainModel(
    provider: string,
    config: LangChainModelConfig,
): BaseChatModel {
    const baseConfig = {
        temperature: config.temperature ?? 0.3,
        maxTokens: config.maxTokens,
        streaming: config.streaming ?? false,
    };

    switch (provider) {
        case 'anthropic':
        case 'claude': {
            const { ChatAnthropic } = require('@langchain/anthropic');
            return new ChatAnthropic({
                model: process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-20241022',
                apiKey: process.env.ANTHROPIC_API_KEY,
                ...baseConfig,
            });
        }

        case 'gemini':
        case 'google': {
            const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
            return new ChatGoogleGenerativeAI({
                model: process.env.GEMINI_MODEL ?? 'gemini-1.5-pro',
                apiKey: process.env.GOOGLE_AI_API_KEY,
                ...baseConfig,
            });
        }

        case 'groq': {
            const { ChatGroq } = require('@langchain/groq');
            return new ChatGroq({
                model: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
                apiKey: process.env.GROQ_API_KEY,
                ...baseConfig,
            });
        }

        case 'ollama': {
            const { ChatOllama } = require('@langchain/ollama');
            return new ChatOllama({
                model: process.env.OLLAMA_MODEL ?? 'llama3.2',
                baseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
                ...baseConfig,
            });
        }

        case 'openai':
        default: {
            const { ChatOpenAI } = require('@langchain/openai');
            return new ChatOpenAI({
                model: tutorModelOverride() ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
                apiKey: process.env.OPENAI_API_KEY,
                ...baseConfig,
                // Usage on streamed calls too, for the tutor's token window.
                streamUsage: true,
                callbacks: [tutorUsage],
            });
        }
    }
}

/** Provider name for logging/tracing — does NOT instantiate the model */
export function getActiveProviderName(): string {
    // archMultiProviderLLM flag was removed in the feature-flags rewrite;
    // preserve its env-driven behaviour (default OFF → 'openai').
    return (process.env.ARCH_MULTI_PROVIDER_LLM === 'true' || process.env.ARCH_MULTI_PROVIDER_LLM === '1')
        ? (process.env.LLM_PROVIDER ?? 'openai').toLowerCase()
        : 'openai';
}

/** Model name for the active provider */
export function getActiveModelName(): string {
    const provider = getActiveProviderName();
    const modelMap: Record<string, string> = {
        anthropic: process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-20241022',
        claude: process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-20241022',
        gemini: process.env.GEMINI_MODEL ?? 'gemini-1.5-pro',
        google: process.env.GEMINI_MODEL ?? 'gemini-1.5-pro',
        groq: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
        ollama: process.env.OLLAMA_MODEL ?? 'llama3.2',
        openai: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    };
    return modelMap[provider] ?? 'gpt-4o-mini';
}

/** Clear cache — tests only. Never call in production. */
export function clearModelCache(): void {
    modelCache.clear();
}
