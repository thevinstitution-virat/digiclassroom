/**
 * Enhanced Agent Service with Strict Validation
 * Processes queries with 100% textbook content fidelity verification
 */

import { VectorStoreService } from './vector_store_service';
import { OpenAIService } from './openai_service';
import { SourceVerificationAgent, VerificationResult, SourceChunk } from '../agents/source_verification_agent';
import { EnhancedSynthesisAgent, SynthesisRequest, SynthesisResult } from '../agents/enhanced_synthesis_agent';
import { CitationAgent, CitationResult } from '../agents/citation_agent';

export interface EnhancedQueryRequest {
  query: string;
  user_context: {
    grade_level: number;
    subject: string;
    board_type: 'CBSE' | 'ICSE' | 'State Board';
    user_role: string;
    subscription_tier?: string;
  };
}

export interface EnhancedQueryResponse {
  status: 'success' | 'insufficient_content' | 'verification_failed' | 'error';
  answer?: string;
  citations?: Array<{
    id: string;
    textbook_title: string;
    chapter: string;
    page_number: number;
    citation_format: string;
  }>;
  verification_score?: number;
  sources_used?: number;
  model_used?: string;
  content_type?: string;
  processing_metadata?: {
    retrieval_time: number;
    synthesis_time: number;
    verification_time: number;
    citation_time: number;
  };
  error_details?: {
    message: string;
    available_content?: string[];
    verification_issues?: string[];
  };
}

export class EnhancedAgentService {
  private vectorService: VectorStoreService;
  private openaiService: OpenAIService;
  private verificationAgent: SourceVerificationAgent;
  private synthesisAgent: EnhancedSynthesisAgent;
  private citationAgent: CitationAgent;

  constructor() {
    this.vectorService = new VectorStoreService();
    this.openaiService = OpenAIService.getInstance();
    this.verificationAgent = new SourceVerificationAgent();
    this.synthesisAgent = new EnhancedSynthesisAgent();
    this.citationAgent = new CitationAgent();
  }

  /**
   * Process query with strict textbook content validation
   */
  async process_query_with_validation(request: EnhancedQueryRequest): Promise<EnhancedQueryResponse> {
    const startTime = Date.now();
    console.log(`🎓 Enhanced Query Processing: "${request.query.substring(0, 50)}..." for Class ${request.user_context.grade_level} ${request.user_context.subject}`);

    try {
      // Step 1: Retrieve relevant content with higher threshold
      const retrievalStart = Date.now();
      const retrievedContent = await this.retrieveRelevantContent(request);
      const retrievalTime = Date.now() - retrievalStart;

      if (!retrievedContent || retrievedContent.length === 0) {
        return {
          status: 'insufficient_content',
          error_details: {
            message: 'No relevant textbook content found for this query',
            available_content: []
          }
        };
      }

      // Step 2: Enhanced content filtering for exact matches
      const filteredContent = await this.filterForExactRelevance(request.query, retrievedContent);
      
      if (filteredContent.length === 0) {
        return {
          status: 'insufficient_content',
          error_details: {
            message: 'Textbook content does not contain sufficient information to answer this query',
            available_content: this.summarizeAvailableContent(retrievedContent)
          }
        };
      }

      // Step 3: Synthesize answer with constraints
      const synthesisStart = Date.now();
      const synthesisRequest: SynthesisRequest = {
        query: request.query,
        retrieved_content: filteredContent,
        user_grade: request.user_context.grade_level,
        subject: request.user_context.subject,
        board_type: request.user_context.board_type
      };

      const synthesisResult = await this.synthesisAgent.synthesize_textbook_answer(synthesisRequest);
      const synthesisTime = Date.now() - synthesisStart;

      // Step 4: Strict source verification
      const verificationStart = Date.now();
      const verificationResult = await this.verificationAgent.verify_response(
        synthesisResult.answer,
        filteredContent
      );
      const verificationTime = Date.now() - verificationStart;

      // Step 5: Reject if verification fails
      if (!verificationResult.passes_verification) {
        return {
          status: 'verification_failed',
          error_details: {
            message: `Generated content failed source verification (fidelity: ${(verificationResult.overall_fidelity_score * 100).toFixed(1)}%)`,
            verification_issues: verificationResult.unverified_sentences.map(s => s.sentence)
          },
          verification_score: verificationResult.overall_fidelity_score
        };
      }

      // Step 6: Add citations
      const citationStart = Date.now();
      const citationResult = await this.citationAgent.add_citations(
        synthesisResult.answer,
        filteredContent
      );
      const citationTime = Date.now() - citationStart;

      // Step 7: Return successful result
      const totalTime = Date.now() - startTime;
      console.log(`✅ Enhanced processing complete in ${totalTime}ms with ${(verificationResult.overall_fidelity_score * 100).toFixed(1)}% fidelity`);

      return {
        status: 'success',
        answer: citationResult.answer,
        citations: citationResult.citations.map(c => ({
          id: c.id,
          textbook_title: c.textbook_title,
          chapter: c.chapter,
          page_number: c.page_number,
          citation_format: c.citation_format
        })),
        verification_score: verificationResult.overall_fidelity_score,
        sources_used: filteredContent.length,
        model_used: 'openai-constrained',
        content_type: 'textbook_verified',
        processing_metadata: {
          retrieval_time: retrievalTime,
          synthesis_time: synthesisTime,
          verification_time: verificationTime,
          citation_time: citationTime
        }
      };

    } catch (error) {
      console.error('❌ Enhanced processing error:', error);
      
      return {
        status: 'error',
        error_details: {
          message: `Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      };
    }
  }

  /**
   * Retrieve relevant content from vector database
   */
  private async retrieveRelevantContent(request: EnhancedQueryRequest): Promise<SourceChunk[]> {
    const searchContext = {
      query: request.query,
      grade_level: request.user_context.grade_level,
      subject: request.user_context.subject,
      board_type: request.user_context.board_type,
      limit: 10,
      content_types: ['definitions', 'concepts', 'explanations', 'examples']
    };

    const searchResult = await this.vectorService.search_relevant_content(searchContext);
    
    // Convert to SourceChunk format
    return searchResult.results.map(result => ({
      content: result.text,
      metadata: {
        page_number: result.metadata.page,
        textbook_title: result.metadata.source,
        chapter: result.metadata.chapter,
        subject: result.metadata.subject,
        class_level: result.metadata.class_level
      },
      score: result.score
    }));
  }

  /**
   * Filter content for exact query relevance
   */
  private async filterForExactRelevance(
    query: string,
    content: SourceChunk[]
  ): Promise<SourceChunk[]> {
    const queryKeywords = new Set(
      query.toLowerCase()
        .split(/\W+/)
        .filter(word => word.length > 2)
        .filter(word => !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 'did', 'she', 'use', 'way', 'why'].includes(word))
    );

    const filteredContent: SourceChunk[] = [];

    for (const item of content) {
      const contentText = item.content.toLowerCase();
      const contentWords = new Set(contentText.split(/\W+/));

      // Calculate keyword overlap
      const overlap = [...queryKeywords].filter(keyword => contentWords.has(keyword)).length;
      const overlapRatio = overlap / queryKeywords.size;

      // Only include content with high keyword overlap
      if (overlapRatio >= 0.4) { // 40% keyword overlap minimum
        filteredContent.push({
          ...item,
          score: (item.score || 0) + overlapRatio // Boost score with overlap
        });
      }
    }

    // Sort by combined relevance score
    filteredContent.sort((a, b) => (b.score || 0) - (a.score || 0));
    
    console.log(`🔍 Filtered to ${filteredContent.length} highly relevant sources from ${content.length} total`);
    return filteredContent.slice(0, 5); // Top 5 most relevant
  }

  /**
   * Summarize what content is available in textbooks
   */
  private summarizeAvailableContent(content: SourceChunk[]): string[] {
    const topics: string[] = [];
    
    for (const item of content.slice(0, 3)) { // Top 3 available topics
      const contentPreview = item.content.length > 100 
        ? item.content.substring(0, 100) + '...'
        : item.content;
      
      const sourceInfo = `${item.metadata.textbook_title || 'NCERT'} - Chapter ${item.metadata.chapter || 'Unknown'}`;
      topics.push(`${sourceInfo}: ${contentPreview}`);
    }
    
    return topics;
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: Record<string, boolean>;
    verification_enabled: boolean;
    citation_enabled: boolean;
  }> {
    try {
      // Test each component
      const vectorHealthy = await this.testVectorService();
      const openaiHealthy = await this.testOpenAIService();
      const verificationHealthy = this.verificationAgent !== null;
      const citationHealthy = this.citationAgent !== null;

      const allHealthy = vectorHealthy && openaiHealthy && verificationHealthy && citationHealthy;
      const someHealthy = vectorHealthy || openaiHealthy;

      return {
        status: allHealthy ? 'healthy' : someHealthy ? 'degraded' : 'unhealthy',
        components: {
          vector_service: vectorHealthy,
          llm_service: openaiHealthy,
          verification_agent: verificationHealthy,
          citation_agent: citationHealthy
        },
        verification_enabled: verificationHealthy,
        citation_enabled: citationHealthy
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        components: {
          vector_service: false,
          llm_service: false,
          verification_agent: false,
          citation_agent: false
        },
        verification_enabled: false,
        citation_enabled: false
      };
    }
  }

  private async testVectorService(): Promise<boolean> {
    try {
      // Simple test query
      const result = await this.vectorService.search_relevant_content({
        query: 'test',
        grade_level: 9,
        subject: 'Science',
        board_type: 'CBSE',
        limit: 1
      });
      return true;
    } catch {
      return false;
    }
  }

  private async testOpenAIService(): Promise<boolean> {
    try {
      await this.openaiService.generateChatCompletion({
        messages: [{ role: 'user', content: 'test' }],
        temperature: 0.1,
        maxTokens: 10
      });
      return true;
    } catch {
      return false;
    }
  }
}
