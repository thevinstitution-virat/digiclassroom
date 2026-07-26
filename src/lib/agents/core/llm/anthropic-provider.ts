// src/lib/agents/core/llm/anthropic-provider.ts

import { ILLMProvider, LLMChatRequest, LLMChatResponse } from './llm-provider';

/**
 * Anthropic (Claude) Provider Implementation
 * Normalizes Anthropic's token format (input_tokens/output_tokens) to the
 * canonical LLMChatResponse.usage shape (promptTokens/completionTokens).
 */
export class AnthropicProvider implements ILLMProvider {
    private client: Record<string, unknown>; // Anthropic SDK type
    private model: string;

    constructor() {
        // Dynamic import avoids hard dependency when provider is not used
        const Anthropic = require('@anthropic-ai/sdk');
        this.client = new Anthropic.default({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
        this.model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
    }

    get providerName(): string {
        return 'anthropic';
    }

    public async generateChatCompletion(request: LLMChatRequest): Promise<LLMChatResponse> {
        // Anthropic requires system message as a separate parameter
        const systemMessage = request.messages.find(m => m.role === 'system');
        const nonSystemMessages = request.messages
            .filter(m => m.role !== 'system')
            .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

        const response = await this.client.messages.create({
            model: this.model,
            max_tokens: request.maxTokens || 1024,
            ...(systemMessage ? { system: systemMessage.content } : {}),
            messages: nonSystemMessages,
            temperature: request.temperature ?? 0.7,
        });

        const text = response.content
            .filter((block: Record<string, unknown>) => block.type === 'text')
            .map((block: Record<string, unknown>) => block.text)
            .join('');

        // Token normalization: Anthropic → canonical format
        return {
            text,
            model: response.model,
            usage: response.usage ? {
                promptTokens: response.usage.input_tokens ?? 0,
                completionTokens: response.usage.output_tokens ?? 0,
                totalTokens: (response.usage.input_tokens ?? 0) + (response.usage.output_tokens ?? 0),
                cachedTokens: response.usage.cache_read_input_tokens ?? 0,
            } : undefined,
        };
    }

    public async *generateChatCompletionStream(request: LLMChatRequest): AsyncGenerator<string, void, unknown> {
        const systemMessage = request.messages.find(m => m.role === 'system');
        const nonSystemMessages = request.messages
            .filter(m => m.role !== 'system')
            .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

        const stream = this.client.messages.stream({
            model: this.model,
            max_tokens: request.maxTokens || 1024,
            ...(systemMessage ? { system: systemMessage.content } : {}),
            messages: nonSystemMessages,
            temperature: request.temperature ?? 0.7,
        });

        for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                yield event.delta.text;
            }
        }
    }

    public async generateEmbedding(text: string): Promise<number[]> {
        // Anthropic does not offer embeddings — fall back to OpenAI
        const { OpenAIProvider } = require('./openai-provider');
        const openai = new OpenAIProvider();
        return openai.generateEmbedding(text);
    }

    public async generateEmbeddings(texts: string[]): Promise<number[][]> {
        const { OpenAIProvider } = require('./openai-provider');
        const openai = new OpenAIProvider();
        return openai.generateEmbeddings(texts);
    }
}
