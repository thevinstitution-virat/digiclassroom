// src/lib/agents/core/llm/llm-provider.ts

export type MessageRole = 'system' | 'user' | 'assistant';

export interface LLMChatMessage {
    role: MessageRole;
    content: string;
}

export interface LLMChatRequest {
    messages: LLMChatMessage[];
    temperature?: number;
    maxTokens?: number;
}

export interface LLMChatResponse {
    text: string;
    model: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        cachedTokens?: number;
    };
}

/**
 * Core LLM Provider Interface
 * Allows DigiClassroom to swap backend LLMs (OpenAI, Gemini, Claude)
 * without altering any agent logic.
 */
export interface ILLMProvider {
    /** Identifier for the provider */
    readonly providerName: string;

    /** Generate an atomic text completion */
    generateChatCompletion(request: LLMChatRequest): Promise<LLMChatResponse>;

    /** Stream a text completion chunk-by-chunk */
    generateChatCompletionStream(request: LLMChatRequest): AsyncGenerator<string, void, unknown>;

    /** Generate a standardized embedding vector for RAG */
    generateEmbedding(text: string): Promise<number[]>;

    /** Generate multiple standardized embedding vectors */
    generateEmbeddings(texts: string[]): Promise<number[][]>;
}
