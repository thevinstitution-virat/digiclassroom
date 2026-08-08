import OpenAI from 'openai'
type ChatCompletionMessageParam = OpenAI.Chat.ChatCompletionMessageParam
import { ServiceLifecycleManager } from './service-lifecycle-manager'
import { openrouter } from '@/lib/openrouter/client'
import { ModelRouter } from '@/lib/openrouter/router'

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
  private client: OpenAI            // OpenRouter — chat completions
  private embeddingClient: OpenAI   // Direct OpenAI — embeddings (uses OPENAI_API_KEY)
  private static readonly CHAT_MODEL = 'gpt-4o-mini'  // Changed from gpt-4o for 10x faster responses
  private static readonly EMBEDDING_MODEL = 'text-embedding-3-large'  // Direct OpenAI, 3072 dims — matches the ncert-books-enhanced collection

  static getInstance(): OpenAIService {
    return ServiceLifecycleManager.getInstance('OpenAIService', () => new OpenAIService())
  }

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required but not set')
    }

    console.log(`🔧 OpenAI Embedding Model: ${OpenAIService.EMBEDDING_MODEL} (3072 dimensions, direct OpenAI)`)

    // Chat completions route through OpenRouter (ModelRouter selects the tier).
    this.client = openrouter
    // Embeddings go DIRECT to OpenAI so OPENAI_API_KEY is actually used and we get
    // text-embedding-3-large (3072 dims) with proper semantics, matching the collection.
    this.embeddingClient = new OpenAI({ apiKey })
  }

  async generateChatCompletion(request: OpenAIChatRequest): Promise<OpenAIChatResponse> {
    const targetModel = ModelRouter.routeCurrentQuery(request.messages);
    console.log(`[ModelRouter] Selected tier: ${targetModel}`);

    const response = await this.client.chat.completions.create({
      model: targetModel,
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
    const targetModel = ModelRouter.routeCurrentQuery(request.messages);
    console.log(`[ModelRouter] Selected tier (streaming): ${targetModel}`);

    const stream = await this.client.chat.completions.create({
      model: targetModel,
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
    const embeddingResponse = await this.embeddingClient.embeddings.create({
      model: OpenAIService.EMBEDDING_MODEL,
      input: text
    })

    const vector = embeddingResponse.data?.[0]?.embedding
    if (!vector) {
      throw new Error('Failed to generate embedding from OpenAI API')
    }

    return vector
  }

  /**
   * Cumulative embedding usage for this process, straight off the API response.
   * Process-scoped and static on purpose: a one-shot ingest script wants the
   * total for a run, and threading a counter through the pipeline would touch
   * every call site to answer a question only the entry point asks.
   */
  private static embeddingUsage = { calls: 0, inputs: 0, promptTokens: 0, totalTokens: 0 }

  static getEmbeddingUsage() {
    return { ...OpenAIService.embeddingUsage }
  }

  /** Snapshot boundary, so usage can be attributed to one chapter rather than the whole run. */
  static resetEmbeddingUsage() {
    OpenAIService.embeddingUsage = { calls: 0, inputs: 0, promptTokens: 0, totalTokens: 0 }
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return []
    }

    const embeddingResponse = await this.embeddingClient.embeddings.create({
      model: OpenAIService.EMBEDDING_MODEL,
      input: texts
    })

    // Real usage off the API response, which was being thrown away. An ingest
    // has to be able to report what it actually spent — a chars/4 estimate is
    // the wrong thing to put next to a bill, and "no tokens were spent" is a
    // claim about a skipped re-ingest that must be measured, not asserted.
    OpenAIService.embeddingUsage.calls += 1
    OpenAIService.embeddingUsage.promptTokens += embeddingResponse.usage?.prompt_tokens ?? 0
    OpenAIService.embeddingUsage.totalTokens += embeddingResponse.usage?.total_tokens ?? 0
    OpenAIService.embeddingUsage.inputs += texts.length

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
    return this.embeddingClient
  }
}

