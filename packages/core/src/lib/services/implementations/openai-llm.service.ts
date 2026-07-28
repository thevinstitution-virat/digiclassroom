import { openrouter } from '@/lib/openrouter/client';
/**
 * OpenAI LLM Service Implementation
 * Wraps existing OpenAI functionality with enterprise features:
 * - Retry logic with exponential backoff
 * - Rate limiting
 * - Token usage tracking
 * - Error handling
 * - Streaming support
 */


import type {
  ILLMService,
  LLMGenerationOptions,
  LLMResponse
} from '../interfaces';
import { APP_CONFIG } from '@/lib/config/app-config';

export interface OpenAILLMServiceConfig {
  apiKey?: string;
  embeddingModel?: string;
  embeddingDimensions?: number;
  generationModel?: string;
  maxRetries?: number;
  timeout?: number;
}

export class OpenAILLMService implements ILLMService {
        // @ts-ignore
  private client: OpenAI;
  private embeddingModel: string;
  private generationModel: string;
  private dimensions: number;
  private maxRetries: number;
  private requestTimestamps: number[] = [];
  private requestsPerMinute = 60;

  constructor(config?: OpenAILLMServiceConfig) {
    this.embeddingModel = config?.embeddingModel || APP_CONFIG.openai.embedding.model;
    this.dimensions = config?.embeddingDimensions || APP_CONFIG.openai.embedding.dimensions;
    this.generationModel = config?.generationModel || APP_CONFIG.openai.generation.model;
    this.maxRetries = config?.maxRetries || APP_CONFIG.openai.generation.maxRetries;

    this.client = openrouter;

    console.log(`âœ… OpenAI LLM Service initialized (${this.generationModel}, ${this.dimensions}D embeddings)`);
  }

  async generateResponse(prompt: string, options?: LLMGenerationOptions): Promise<LLMResponse> {
    return this.retryWithBackoff(async () => {
      await this.rateLimit();

      const response = await this.client.chat.completions.create({
        model: this.generationModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: options?.temperature ?? APP_CONFIG.openai.generation.defaultTemperature,
        max_tokens: options?.maxTokens ?? APP_CONFIG.openai.generation.defaultMaxTokens,
        top_p: options?.topP,
        frequency_penalty: options?.frequencyPenalty,
        presence_penalty: options?.presencePenalty,
        stop: options?.stop
      });

      return {
        content: response.choices[0].message.content || '',
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0
        },
        model: response.model,
        finishReason: response.choices[0].finish_reason
      };
    });
  }

  async *generateStreamingResponse(
    prompt: string,
    options?: LLMGenerationOptions
  ): AsyncGenerator<string> {
    await this.rateLimit();

    const stream = await this.client.chat.completions.create({
      model: this.generationModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: options?.temperature ?? APP_CONFIG.openai.generation.defaultTemperature,
      max_tokens: options?.maxTokens ?? APP_CONFIG.openai.generation.defaultMaxTokens,
      stream: true
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }

  async createEmbedding(text: string): Promise<number[]> {
    return this.retryWithBackoff(async () => {
      await this.rateLimit();

      const response = await this.client.embeddings.create({
        model: this.embeddingModel,
        input: text,
        dimensions: this.dimensions
      });

      return response.data[0].embedding;
    });
  }

  async createEmbeddings(texts: string[]): Promise<number[][]> {
    return this.retryWithBackoff(async () => {
      await this.rateLimit();

      const response = await this.client.embeddings.create({
        model: this.embeddingModel,
        input: texts,
        dimensions: this.dimensions
      });

        // @ts-ignore
      return response.data.map(item => item.embedding);
    });
  }

  getModelInfo() {
    return {
      name: this.generationModel,
      dimensions: this.dimensions,
      maxTokens: APP_CONFIG.openai.generation.defaultMaxTokens
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async retryWithBackoff<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let i = 0; i < this.maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (i < this.maxRetries - 1) {
          const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
          console.warn(`âš ï¸ OpenAI request failed, retry ${i + 1}/${this.maxRetries} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();

    // Remove timestamps older than 1 minute
    this.requestTimestamps = this.requestTimestamps.filter(
      ts => now - ts < 60000
    );

    // If at limit, wait
    if (this.requestTimestamps.length >= this.requestsPerMinute) {
      const oldestTimestamp = this.requestTimestamps[0];
      const waitTime = 60000 - (now - oldestTimestamp) + 100; // +100ms buffer
      console.warn(`âš ï¸ Rate limit reached, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.requestTimestamps.push(now);
  }
}


