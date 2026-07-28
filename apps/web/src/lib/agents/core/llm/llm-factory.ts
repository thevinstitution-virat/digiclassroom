// src/lib/agents/core/llm/llm-factory.ts

import { ILLMProvider } from './llm-provider';
import { OpenAIProvider } from './openai-provider';
import { AnthropicProvider } from './anthropic-provider';
import { GeminiProvider } from './gemini-provider';
import { getFeatureFlags } from '@/lib/config/feature-flags';

/**
 * LLM Factory
 * Returns the appropriate ILLMProvider based on feature flags and env config.
 *
 * Routing priority:
 * 1. If archMultiProviderLLM is OFF → always OpenAI (safe default)
 * 2. If ON → read LLM_PROVIDER env var: 'openai' | 'anthropic' | 'gemini'
 * 3. Fallback to OpenAI if env var is missing or unrecognized
 */
export class LLMFactory {
    static getProvider(): ILLMProvider {
        const flags = getFeatureFlags();

        // @ts-ignore
        if (!flags.archMultiProviderLLM) {
            return new OpenAIProvider();
        }

        const requestedProvider = (process.env.LLM_PROVIDER || 'openai').toLowerCase();

        switch (requestedProvider) {
            case 'anthropic':
            case 'claude':
                return new AnthropicProvider();
            case 'gemini':
            case 'google':
                return new GeminiProvider();
            case 'openai':
            default:
                return new OpenAIProvider();
        }
    }

    /** Get the active provider name without instantiating */
    static getActiveProviderName(): string {
        const flags = getFeatureFlags();
        // @ts-ignore
        if (!flags.archMultiProviderLLM)
  return 'openai';
        return (process.env.LLM_PROVIDER || 'openai').toLowerCase();
    }
}
