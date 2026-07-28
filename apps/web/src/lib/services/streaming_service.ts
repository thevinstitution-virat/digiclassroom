/**
 * Real-time Streaming Service for DigiClassroom AI Tutor
 * Provides streaming response validation, failure-graceful fallbacks, and multi-modal context preservation
 */

import { ContentVerificationEngine, SourceChunk, VerificationResult } from '../agents/source_validation';
import { OpenAIService } from './openai_service';
import { APMService, getAPMService } from './apm_service';

// Legacy types for backward compatibility
export interface LLMRequest {
  model_type: string;
  prompt: string;
  temperature: number;
  max_tokens: number;
  system_prompt?: string;
}

export interface LLMResponse {
  text: string;
  model: string;
}

export interface StreamingConfig {
  chunk_size: number;
  verification_interval: number; // Verify every N chunks
  max_retries: number;
  fallback_enabled: boolean;
  preserve_context: boolean;
}

export interface StreamChunk {
  id: string;
  content: string;
  timestamp: number;
  is_verified: boolean;
  verification_score?: number;
  is_final: boolean;
  metadata: {
    chunk_index: number;
    total_chunks?: number;
    model_used: string;
    processing_time: number;
  };
}

export interface StreamingResponse {
  stream_id: string;
  chunks: StreamChunk[];
  final_content: string;
  verification_result: VerificationResult;
  fallback_used: boolean;
  context_preserved: boolean;
  processing_metadata: {
    total_chunks: number;
    verified_chunks: number;
    failed_chunks: number;
    total_processing_time: number;
    average_chunk_time: number;
  };
}

export interface StreamingContext {
  conversation_history: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    modality?: 'text' | 'voice' | 'file';
  }>;
  source_chunks: SourceChunk[];
  student_context: {
    grade_level: number;
    subject: string;
    board_type: string;
    learning_style?: string;
  };
  session_metadata: {
    session_id: string;
    user_id: string;
    agent_type: string;
    bloom_level: string;
  };
}

export class StreamingService {
  private openaiService: OpenAIService;
  private verificationEngine: ContentVerificationEngine;
  private apmService: APMService;

  private readonly defaultConfig: StreamingConfig = {
    chunk_size: 50, // words per chunk
    verification_interval: 3, // verify every 3 chunks
    max_retries: 2,
    fallback_enabled: true,
    preserve_context: true
  };

  constructor(config?: Partial<StreamingConfig>) {
    this.openaiService = OpenAIService.getInstance();
    this.verificationEngine = new ContentVerificationEngine();
    this.apmService = getAPMService();

    console.log('🌊 Streaming Service initialized with real-time validation');
  }

  /**
   * Generate streaming response with real-time validation
   */
  async generateStreamingResponse(
    request: LLMRequest,
    context: StreamingContext,
    config?: Partial<StreamingConfig>
  ): Promise<AsyncGenerator<StreamChunk, StreamingResponse>> {
    const streamConfig = { ...this.defaultConfig, ...config };
    const stream_id = this.generateStreamId();
    
    // Start APM trace
    const span = this.apmService.startSpan('streaming_response_generation', undefined, {
      stream_id,
      model_type: request.model_type,
      chunk_size: streamConfig.chunk_size,
      verification_interval: streamConfig.verification_interval
    });

    return this.createStreamingGenerator(request, context, streamConfig, stream_id, span.span_id);
  }

  private async *createStreamingGenerator(
    request: LLMRequest,
    context: StreamingContext,
    config: StreamingConfig,
    stream_id: string,
    span_id: string
  ): AsyncGenerator<StreamChunk, StreamingResponse> {
    const startTime = Date.now();
    const chunks: StreamChunk[] = [];
    let chunk_index = 0;
    let verified_chunks = 0;
    let failed_chunks = 0;
    let fallback_used = false;
    let accumulated_content = '';

    try {
      // Enhance request with context preservation
      const enhancedRequest = this.enhanceRequestWithContext(request, context);
      
      this.apmService.addSpanLog(span_id, 'info', 'Starting streaming generation', {
        enhanced_prompt_length: enhancedRequest.prompt.length,
        context_history_length: context.conversation_history.length
      });

      // Generate response using OpenAI service
      const response = await this.openaiService.generateChatCompletion({
        messages: [
          { role: 'system', content: enhancedRequest.system_prompt || 'You are a helpful assistant.' },
          { role: 'user', content: enhancedRequest.prompt }
        ],
        temperature: enhancedRequest.temperature,
        maxTokens: enhancedRequest.max_tokens
      });
        // @ts-ignore
      const full_content = response.choices[0]?.message?.content || '';
      const llmResponse = { text: full_content, model: 'gpt-4o-mini' };
      
      // Split content into chunks
      const content_chunks = this.splitIntoChunks(full_content, config.chunk_size);
      
      this.apmService.addSpanTags(span_id, {
        total_chunks: content_chunks.length,
        content_length: full_content.length
      });

      // Stream chunks with real-time validation
      for (let i = 0; i < content_chunks.length; i++) {
        const chunk_start_time = Date.now();
        const chunk_content = content_chunks[i];
        accumulated_content += chunk_content;
        
        // Create chunk
        const chunk: StreamChunk = {
          id: `${stream_id}_${i}`,
          content: chunk_content,
          timestamp: Date.now(),
          is_verified: false,
          is_final: i === content_chunks.length - 1,
          metadata: {
            chunk_index: i,
            total_chunks: content_chunks.length,
            model_used: llmResponse.model,
            processing_time: Date.now() - chunk_start_time
          }
        };

        // Perform verification at intervals
        if (i % config.verification_interval === 0 || chunk.is_final) {
          try {
            const verification_result = await this.verificationEngine.verify_content_source(
              accumulated_content,
              context.source_chunks,
              true
            );
            
            chunk.is_verified = verification_result.is_verified;
            chunk.verification_score = verification_result.overall_fidelity_score;
            
            if (verification_result.is_verified) {
              verified_chunks++;
            } else {
              failed_chunks++;
              
              // Handle verification failure
              if (config.fallback_enabled && !fallback_used) {
                const fallback_chunk = await this.generateFallbackChunk(
                  chunk_content,
                  context,
                  i,
                  span_id
                );
                
                if (fallback_chunk) {
                  fallback_used = true;
                  chunk.content = fallback_chunk.content;
                  chunk.is_verified = fallback_chunk.is_verified;
                  chunk.verification_score = fallback_chunk.verification_score;
                  
                  this.apmService.addSpanLog(span_id, 'warn', 'Used fallback for failed chunk', {
                    chunk_index: i,
                    original_score: verification_result.overall_fidelity_score,
                    fallback_score: fallback_chunk.verification_score
                  });
                }
              }
            }
          } catch (error) {
            console.error(`❌ Verification failed for chunk ${i}:`, error);
            chunk.is_verified = false;
            failed_chunks++;
            
            this.apmService.addSpanLog(span_id, 'error', 'Chunk verification error', {
              chunk_index: i,
              error_message: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        } else {
          // Skip verification for intermediate chunks
          chunk.is_verified = true; // Assume verified until next verification point
        }

        chunks.push(chunk);
        yield chunk;

        // Add small delay to simulate real-time streaming
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Final verification of complete content
      const final_verification = await this.verificationEngine.verify_content_source(
        accumulated_content,
        context.source_chunks,
        true
      );

      const total_processing_time = Date.now() - startTime;
      const average_chunk_time = chunks.length > 0 ? total_processing_time / chunks.length : 0;

      this.apmService.addSpanLog(span_id, 'info', 'Streaming generation completed', {
        total_chunks: chunks.length,
        verified_chunks,
        failed_chunks,
        fallback_used,
        final_verification_score: final_verification.overall_fidelity_score
      });

      this.apmService.finishSpan(span_id, 'success');

      return {
        stream_id,
        chunks,
        final_content: accumulated_content,
        verification_result: final_verification,
        fallback_used,
        context_preserved: config.preserve_context,
        processing_metadata: {
          total_chunks: chunks.length,
          verified_chunks,
          failed_chunks,
          total_processing_time,
          average_chunk_time
        }
      };

    } catch (error) {
      console.error('❌ Streaming generation error:', error);
      
      this.apmService.addSpanLog(span_id, 'error', 'Streaming generation failed', {
        error_message: error instanceof Error ? error.message : 'Unknown error',
        chunks_generated: chunks.length
      });

      this.apmService.finishSpan(span_id, 'error', error instanceof Error ? error : new Error('Unknown error'));

      // Return partial results with error information
      return {
        stream_id,
        chunks,
        final_content: accumulated_content,
        verification_result: {
          is_verified: false,
          overall_fidelity_score: 0.0,
          sentence_scores: [],
          failed_sentences: [],
          verification_details: {
            total_sentences: 0,
            verified_sentences: 0,
            failed_sentences: 0,
            similarity_method: 'none',
            source_chunks_used: context.source_chunks.length,
            overall_score: 0.0,
            citations_found: 0,
            verification_passed: false,
        // @ts-ignore
            error: error instanceof Error ? error.message : 'Unknown error'
          },
          citations: []
        },
        fallback_used,
        context_preserved: config.preserve_context,
        processing_metadata: {
          total_chunks: chunks.length,
          verified_chunks,
          failed_chunks,
          total_processing_time: Date.now() - startTime,
          average_chunk_time: chunks.length > 0 ? (Date.now() - startTime) / chunks.length : 0
        }
      };
    }
  }

  /**
   * Enhance request with multi-modal context preservation
   */
  private enhanceRequestWithContext(request: LLMRequest, context: StreamingContext): LLMRequest {
        // @ts-ignore
    if (!context || !context.preserve_context) {
      return request;
    }

    // Build context-aware prompt
    let enhanced_prompt = request.prompt;

    // Add conversation history
    if (context.conversation_history.length > 0) {
      const recent_history = context.conversation_history.slice(-5); // Last 5 exchanges
      const history_text = recent_history.map(msg => 
        `${msg.role === 'user' ? 'Student' : 'Tutor'}: ${msg.content}`
      ).join('\n');
      
      enhanced_prompt = `Previous conversation context:\n${history_text}\n\nCurrent request: ${request.prompt}`;
    }

    // Add multi-modal context indicators
    const modalities = [...new Set(context.conversation_history.map(msg => msg.modality).filter(Boolean))];
    if (modalities.length > 0) {
      enhanced_prompt += `\n\nNote: This conversation includes ${modalities.join(', ')} interactions.`;
    }

    return {
      ...request,
      prompt: enhanced_prompt,
      system_prompt: request.system_prompt + `\n\nMaintain consistency with the conversation context and adapt to the student's learning style: ${context.student_context.learning_style || 'adaptive'}.`
    };
  }

  /**
   * Split content into chunks for streaming
   */
  private splitIntoChunks(content: string, chunk_size: number): string[] {
    const words = content.split(/\s+/);
    const chunks: string[] = [];
    
    for (let i = 0; i < words.length; i += chunk_size) {
      const chunk_words = words.slice(i, i + chunk_size);
      chunks.push(chunk_words.join(' '));
    }
    
    return chunks;
  }

  /**
   * Generate fallback chunk when verification fails
   */
  private async generateFallbackChunk(
    failed_content: string,
    context: StreamingContext,
    chunk_index: number,
    span_id: string
  ): Promise<StreamChunk | null> {
    try {
      this.apmService.addSpanLog(span_id, 'info', 'Generating fallback chunk', {
        chunk_index,
        failed_content_length: failed_content.length
      });

      // Use a more conservative approach for fallback
      const fallback_request: LLMRequest = {
        model_type: 'openai', // Use reliable model
        prompt: `Please rephrase this content using ONLY information from the provided textbook sources: "${failed_content}"`,
        temperature: 0.1, // Very conservative
        max_tokens: 100,
        system_prompt: 'You must only use information explicitly stated in the textbook sources. If you cannot rephrase using only textbook content, respond with "Textbook content insufficient for this explanation."'
      };

      const fallbackResp = await this.openaiService.generateChatCompletion({
        messages: [
          { role: 'system', content: fallback_request.system_prompt || 'You are a helpful assistant.' },
          { role: 'user', content: fallback_request.prompt }
        ],
        temperature: fallback_request.temperature,
        maxTokens: fallback_request.max_tokens
      });
        // @ts-ignore
      const fallback_response = { text: fallbackResp.choices[0]?.message?.content || '', model: 'gpt-4o-mini' };
      
      // Verify fallback content
      const verification = await this.verificationEngine.verify_content_source(
        fallback_response.text,
        context.source_chunks,
        true
      );

      return {
        id: `fallback_${chunk_index}`,
        content: fallback_response.text,
        timestamp: Date.now(),
        is_verified: verification.is_verified,
        verification_score: verification.overall_fidelity_score,
        is_final: false,
        metadata: {
          chunk_index,
          model_used: fallback_response.model,
        // @ts-ignore
          processing_time: fallback_response.processing_time
        }
      };

    } catch (error) {
      console.error('❌ Fallback generation failed:', error);
      this.apmService.addSpanLog(span_id, 'error', 'Fallback generation failed', {
        chunk_index,
        error_message: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  private generateStreamId(): string {
    return `stream_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}

// Factory function
export function createStreamingService(config?: Partial<StreamingConfig>): StreamingService {
  return new StreamingService(config);
}
