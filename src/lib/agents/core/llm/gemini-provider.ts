// src/lib/agents/core/llm/gemini-provider.ts

import { ILLMProvider, LLMChatRequest, LLMChatResponse } from './llm-provider';

/**
 * Google Gemini Provider Implementation
 * Normalizes Gemini's token format (promptTokenCount/candidatesTokenCount)
 * to the canonical LLMChatResponse.usage shape (promptTokens/completionTokens).
 */
export class GeminiProvider implements ILLMProvider {
    private client: Record<string, unknown>; // GoogleGenerativeAI SDK type
    private model: string;

    constructor() {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        this.client = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');
        this.model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    }

    get providerName(): string {
        return 'gemini';
    }

    public async generateChatCompletion(request: LLMChatRequest): Promise<LLMChatResponse> {
        const genModel = this.client.getGenerativeModel({
            model: this.model,
            generationConfig: {
                temperature: request.temperature ?? 0.7,
                maxOutputTokens: request.maxTokens || 1024,
            },
        });

        // Convert messages to Gemini format
        const systemMessage = request.messages.find(m => m.role === 'system');
        const chatMessages = request.messages
            .filter(m => m.role !== 'system')
            .map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }],
            }));

        const chat = genModel.startChat({
            history: chatMessages.slice(0, -1),
            ...(systemMessage ? { systemInstruction: { parts: [{ text: systemMessage.content }] } } : {}),
        });

        const lastMessage = chatMessages[chatMessages.length - 1];
        const result = await chat.sendMessage(lastMessage.parts[0].text);
        const response = result.response;
        const text = response.text();

        // Token normalization: Gemini → canonical format
        const usageMetadata = response.usageMetadata;
        return {
            text,
            model: this.model,
            usage: usageMetadata ? {
                promptTokens: usageMetadata.promptTokenCount ?? 0,
                completionTokens: usageMetadata.candidatesTokenCount ?? 0,
                totalTokens: usageMetadata.totalTokenCount ?? 0,
                cachedTokens: usageMetadata.cachedContentTokenCount ?? 0,
            } : undefined,
        };
    }

    public async *generateChatCompletionStream(request: LLMChatRequest): AsyncGenerator<string, void, unknown> {
        const genModel = this.client.getGenerativeModel({
            model: this.model,
            generationConfig: {
                temperature: request.temperature ?? 0.7,
                maxOutputTokens: request.maxTokens || 1024,
            },
        });

        const systemMessage = request.messages.find(m => m.role === 'system');
        const chatMessages = request.messages
            .filter(m => m.role !== 'system')
            .map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }],
            }));

        const chat = genModel.startChat({
            history: chatMessages.slice(0, -1),
            ...(systemMessage ? { systemInstruction: { parts: [{ text: systemMessage.content }] } } : {}),
        });

        const lastMessage = chatMessages[chatMessages.length - 1];
        const result = await chat.sendMessageStream(lastMessage.parts[0].text);

        for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) yield text;
        }
    }

    public async generateEmbedding(text: string): Promise<number[]> {
        const embeddingModel = this.client.getGenerativeModel({ model: 'text-embedding-004' });
        const result = await embeddingModel.embedContent(text);
        return result.embedding.values;
    }

    public async generateEmbeddings(texts: string[]): Promise<number[][]> {
        const embeddingModel = this.client.getGenerativeModel({ model: 'text-embedding-004' });
        const results = await embeddingModel.batchEmbedContents({
            requests: texts.map(text => ({ content: { parts: [{ text }] } })),
        });
        return results.embeddings.map((e: Record<string, unknown>) => e.values);
    }
}
