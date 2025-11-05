import OpenAI, { ChatCompletionMessageParam } from 'openai'
import { ServiceLifecycleManager } from './service-lifecycle-manager'

export interface OpenAIChatRequest {
  messages: ChatCompletionMessageParam[]
  temperature?: number
  maxTokens?: number
}

export interface OpenAIChatResponse {
  text: string
  model: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
    cachedTokens?: number  // OpenAI automatic prompt caching (Oct 2024+)
  }
}

export class OpenAIService {
  private client: OpenAI
  private static readonly CHAT_MODEL = 'gpt-4o-mini'  // Changed from gpt-4o for 10x faster responses
  private static readonly EMBEDDING_MODEL = 'text-embedding-3-large'  // Upgraded from text-embedding-3-small for better RAG quality (3072 dims)

  static getInstance(): OpenAIService {
    return ServiceLifecycleManager.getInstance('OpenAIService', () => new OpenAIService())
  }

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required but not set')
    }

    console.log(`🔧 OpenAI Embedding Model: ${OpenAIService.EMBEDDING_MODEL} (3072 dimensions)`)

    this.client = new OpenAI({ apiKey })
  }

  async generateChatCompletion(request: OpenAIChatRequest): Promise<OpenAIChatResponse> {
    const response = await this.client.chat.completions.create({
      model: OpenAIService.CHAT_MODEL,
      messages: request.messages,
      temperature: request.temperature ?? 0,
      max_tokens: request.maxTokens ?? 3000  // Increased from 1200 to allow comprehensive, detailed answers
    })

    const message = response.choices?.[0]?.message?.content ?? ''

    // Track OpenAI automatic prompt caching (Oct 2024+)
    const cachedTokens = (response.usage as any)?.prompt_tokens_details?.cached_tokens ?? 0
    if (cachedTokens > 0) {
      console.log(`💰 [OpenAI Cache] HIT: ${cachedTokens} tokens cached (50% cost reduction)`)
    }

    return {
      text: message,
      model: response.model ?? OpenAIService.CHAT_MODEL,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens ?? 0,
            completionTokens: response.usage.completion_tokens ?? 0,
            totalTokens: response.usage.total_tokens ?? 0,
            cachedTokens: cachedTokens
          }
        : undefined
    }
  }

  async *generateChatCompletionStream(
    request: OpenAIChatRequest
  ): AsyncGenerator<string, void, unknown> {
    const stream = await this.client.chat.completions.create({
      model: OpenAIService.CHAT_MODEL,
      messages: request.messages,
      temperature: request.temperature ?? 0,
      max_tokens: request.maxTokens ?? 3000,
      stream: true  // Enable streaming
    })

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content
      if (content) {
        yield content
      }
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const embeddingResponse = await this.client.embeddings.create({
      model: OpenAIService.EMBEDDING_MODEL,
      input: text
    })

    const vector = embeddingResponse.data?.[0]?.embedding
    if (!vector) {
      throw new Error('Failed to generate embedding from OpenAI API')
    }

    return vector
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return []
    }

    const embeddingResponse = await this.client.embeddings.create({
      model: OpenAIService.EMBEDDING_MODEL,
      input: texts
    })

    if (!embeddingResponse.data || embeddingResponse.data.length !== texts.length) {
      throw new Error('Embedding count mismatch returned by OpenAI API')
    }

    return embeddingResponse.data.map(item => {
      if (!item.embedding) {
        throw new Error('Missing embedding vector in OpenAI response')
      }
      return item.embedding
    })
  }

  /**
   * Get the raw OpenAI client for advanced use cases (e.g., A/B testing)
   */
  getClient(): OpenAI {
    return this.client
  }
}

