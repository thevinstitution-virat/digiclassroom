// src/lib/agents/core/llm/openai-provider.ts

import { ILLMProvider, LLMChatRequest, LLMChatResponse } from './llm-provider';
import { OpenAIService } from '@/lib/services/openai_service';
import OpenAI from 'openai';
type ChatCompletionMessageParam = OpenAI.Chat.ChatCompletionMessageParam;

/**
 * OpenAI Provider Implementation
 * Wraps the legacy OpenAIService to fulfill the unified ILLMProvider contract.
 */
export class OpenAIProvider implements ILLMProvider {
    private service: OpenAIService;

    constructor() {
        this.service = OpenAIService.getInstance();
    }

    get providerName(): string {
        return 'openai';
    }

    public async generateChatCompletion(request: LLMChatRequest): Promise<LLMChatResponse> {
        const rawResponse = await this.service.generateChatCompletion({
            messages: request.messages as ChatCompletionMessageParam[],
            temperature: request.temperature,
            maxTokens: request.maxTokens
        });

        return {
            text: rawResponse.text,
            model: rawResponse.model,
            usage: rawResponse.usage
        };
    }

    public async *generateChatCompletionStream(request: LLMChatRequest): AsyncGenerator<string, void, unknown> {
        yield* this.service.generateChatCompletionStream({
            messages: request.messages as ChatCompletionMessageParam[],
            temperature: request.temperature,
            maxTokens: request.maxTokens
        });
    }

    public async generateEmbedding(text: string): Promise<number[]> {
        return this.service.generateEmbedding(text);
    }

    public async generateEmbeddings(texts: string[]): Promise<number[][]> {
        return this.service.generateEmbeddings(texts);
    }
}
