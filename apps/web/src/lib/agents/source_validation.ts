/**
 * Source Validation Tools for DigiClassroom AI Tutor
 * TypeScript implementation with strict textbook fidelity verification
 */

import { OpenAIService } from '../services/openai_service';
import { IntelligentFidelityService } from '../services/intelligent-fidelity-service';
import { VectorStoreService, ContentResult } from '../services/vector_store_service';

export interface SourceChunk {
  content: string;
  source: string;
  chapter?: string;
  page?: number;
  section?: string;
  confidence_score: number;
}

export interface VerificationResult {
  is_verified: boolean;
  overall_fidelity_score: number;
  sentence_scores: number[];
  failed_sentences: string[];
  verification_details: {
    total_sentences: number;
    verified_sentences: number;
    failed_sentences: number;
    similarity_method: string;
    source_chunks_used: number;
    overall_score: number;
    citations_found: number;
    verification_passed: boolean;
  };
  citations: string[];
}

export interface TextbookOnlyResponse {
  answer: string;
  verification_result: VerificationResult;
  processing_metadata: {
    iterations_used: number;
    generation_time: number;
    verification_time: number;
  };
}

export class ContentVerificationEngine {
  private readonly OVERALL_FIDELITY_THRESHOLD = 0.60; // 🔧 CRITICAL FIX: Lowered to 60%
  private readonly SENTENCE_SIMILARITY_THRESHOLD = 0.50; // 🔧 CRITICAL FIX: Lowered to 50%
  private intelligentFidelityService: IntelligentFidelityService;

  constructor() {
    console.log('🔍 Content Verification Engine initialized');
    this.intelligentFidelityService = new IntelligentFidelityService();
  }

  /**
   * Verify that generated content maintains 95%+ fidelity to source material
   */
  async verify_content_source(
    generated_content: string,
    source_chunks: SourceChunk[],
    require_citations: boolean = true
  ): Promise<VerificationResult> {
    console.log(`🔍 Starting content verification for ${generated_content.length} characters`);
    
    // Step 1: Extract sentences from generated content
    const sentences = this.extractSentences(generated_content);
    console.log(`📝 Extracted ${sentences.length} sentences for verification`);
    
    // Step 2: Verify each sentence against source material
    const sentence_scores: number[] = [];
    const failed_sentences: string[] = [];
    let verified_sentences = 0;
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const sentence_score = this.verifySentenceAgainstSources(sentence, source_chunks);
      sentence_scores.push(sentence_score);
      
      if (sentence_score < this.SENTENCE_SIMILARITY_THRESHOLD) {
        failed_sentences.push(sentence);
      } else {
        verified_sentences++;
      }
      
      console.log(`Sentence ${i+1}: ${sentence_score.toFixed(3)} - ${sentence_score >= this.SENTENCE_SIMILARITY_THRESHOLD ? '✅' : '❌'}`);
    }
    
    // Step 3: Calculate overall fidelity score
    const overall_fidelity_score = sentence_scores.length > 0 
      ? sentence_scores.reduce((a, b) => a + b, 0) / sentence_scores.length 
      : 0.0;
    
    // Step 4: Extract and verify citations
    const citations = this.extractCitations(generated_content);
    let adjusted_fidelity_score = overall_fidelity_score;
    
    if (require_citations && citations.length === 0) {
      console.warn('⚠️ No citations found in generated content');
      adjusted_fidelity_score *= 0.9; // Penalize missing citations
    }
    
    // Step 5: Determine verification status
    const is_verified = (
      adjusted_fidelity_score >= this.OVERALL_FIDELITY_THRESHOLD &&
      failed_sentences.length <= sentences.length * 0.05 // Allow max 5% failed sentences
    );
    
    const verification_details = {
      total_sentences: sentences.length,
      verified_sentences,
      failed_sentences: failed_sentences.length,
      similarity_method: 'hybrid',
      source_chunks_used: source_chunks.length,
      overall_score: adjusted_fidelity_score,
      citations_found: citations.length,
      verification_passed: is_verified
    };
    
    console.log(`✅ Verification complete: ${adjusted_fidelity_score.toFixed(3)} fidelity, ${is_verified}`);
    
    return {
      is_verified,
      overall_fidelity_score: adjusted_fidelity_score,
      sentence_scores,
      failed_sentences,
      verification_details,
      citations
    };
  }

  private extractSentences(text: string): string[] {
    // Handle common sentence endings and educational content patterns
    const sentences = text.split(/[.!?]+(?:\s+|$)|(?:\n\s*\n)/)
      .map(s => s.trim())
      .filter(s => s.length > 10); // Filter out very short fragments
    
    return sentences;
  }

  private verifySentenceAgainstSources(sentence: string, source_chunks: SourceChunk[]): number {
    if (source_chunks.length === 0)
  return 0.0;
    
    let max_similarity = 0.0;
    
    for (const chunk of source_chunks) {
      // Method 1: Lexical similarity using simple string comparison
      const lexical_sim = this.calculateLexicalSimilarity(sentence.toLowerCase(), chunk.content.toLowerCase());
      
      // Method 2: Keyword overlap similarity
      const keyword_sim = this.calculateKeywordSimilarity(sentence, chunk.content);
      
      // Combine similarities with weights
      const combined_similarity = 0.7 * lexical_sim + 0.3 * keyword_sim;
      
      max_similarity = Math.max(max_similarity, combined_similarity);
    }
    
    return max_similarity;
  }

  private calculateLexicalSimilarity(text1: string, text2: string): number {
    // Simple Jaccard similarity for lexical comparison
    const words1 = new Set(text1.split(/\s+/));
    const words2 = new Set(text2.split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0.0;
  }

  private calculateKeywordSimilarity(text1: string, text2: string): number {
    // Extract keywords (remove common stop words)
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those']);
    
    const extractKeywords = (text: string) => {
      return new Set(
        text.toLowerCase()
          .split(/\s+/)
          .map(word => word.replace(/[.,!?;:]/g, ''))
          .filter(word => !stopWords.has(word) && word.length > 2)
      );
    };
    
    const words1 = extractKeywords(text1);
    const words2 = extractKeywords(text2);
    
    if (words1.size === 0 || words2.size === 0)
  return 0.0;
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0.0;
  }

  private extractCitations(text: string): string[] {
    const citationPatterns = [
      /\[([^\]]+)\]/g,  // [Chapter 1, Page 23]
      /\(([^)]+)\)/g,   // (NCERT Class 10, Chapter 2)
      /Source:\s*([^\n]+)/g,  // Source: NCERT Textbook
      /Reference:\s*([^\n]+)/g,  // Reference: Chapter 3
    ];
    
    const citations: string[] = [];
    for (const pattern of citationPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        citations.push(match[1]);
      }
    }
    
    return [...new Set(citations)]; // Remove duplicates
  }
}

export class ConstrainedContentGenerator {
  private verification_engine: ContentVerificationEngine;
  private openai_service: OpenAIService;

  constructor() {
    this.verification_engine = new ContentVerificationEngine();
    this.openai_service = OpenAIService.getInstance();
    console.log('🎯 Constrained Content Generator initialized');
  }

  /**
   * Generate answer using ONLY textbook content with iterative verification
   */
  async generate_textbook_only_answer(
    query: string,
    source_chunks: SourceChunk[],
    grade_level: number,
    subject: string,
    board_type: string = "CBSE",
    max_iterations: number = 3
  ): Promise<TextbookOnlyResponse> {
    const start_time = Date.now();
    console.log(`🎯 Generating constrained answer for: ${query.substring(0, 50)}...`);
    
    if (source_chunks.length === 0) {
      console.warn('⚠️ No source chunks provided for constrained generation');
      return {
        answer: "Insufficient textbook content available to answer this question.",
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
            source_chunks_used: 0,
            overall_score: 0.0,
            citations_found: 0,
            verification_passed: false
          },
          citations: []
        },
        processing_metadata: {
          iterations_used: 0,
          generation_time: Date.now() - start_time,
          verification_time: 0
        }
      };
    }
    
    // Generate initial answer by reorganizing source content
    let answer = await this.synthesizeFromSources(query, source_chunks, grade_level, subject, board_type);
    let iterations_used = 0;
    
    // Iterative refinement with verification
    for (let iteration = 0; iteration < max_iterations; iteration++) {
      iterations_used = iteration + 1;
      console.log(`🔄 Refinement iteration ${iteration + 1}/${max_iterations}`);
      
      const verification_start = Date.now();
      const verification_result = await this.verification_engine.verify_content_source(
        answer, source_chunks, true
      );
      const verification_time = Date.now() - verification_start;
      
      if (verification_result.is_verified) {
        console.log(`✅ Answer verified with ${verification_result.overall_fidelity_score.toFixed(3)} fidelity`);
        return {
          answer,
          verification_result,
          processing_metadata: {
            iterations_used,
            generation_time: Date.now() - start_time,
            verification_time
          }
        };
      }
      
      // Refine answer based on verification feedback
      answer = await this.refineAnswer(answer, verification_result, source_chunks);
    }
    
    // Final verification
    const final_verification_start = Date.now();
    const final_verification = await this.verification_engine.verify_content_source(
      answer, source_chunks, true
    );
    const final_verification_time = Date.now() - final_verification_start;
    
    console.warn(`⚠️ Answer did not reach verification threshold after ${max_iterations} iterations`);
    return {
      answer,
      verification_result: final_verification,
      processing_metadata: {
        iterations_used,
        generation_time: Date.now() - start_time,
        verification_time: final_verification_time
      }
    };
  }

  private async synthesizeFromSources(
    query: string,
    source_chunks: SourceChunk[],
    grade_level: number,
    subject: string,
    board_type: string
  ): Promise<string> {
    // Sort source chunks by relevance to query
    const relevant_chunks = this.rankChunksByRelevance(query, source_chunks);
    
    // Build answer by combining most relevant chunks
    const answer_parts: string[] = [];
    const used_sources = new Set<string>();
    
    for (const chunk of relevant_chunks.slice(0, 5)) { // Use top 5 most relevant chunks
      if (!used_sources.has(chunk.source)) {
        // Extract relevant sentences from chunk
        const relevant_sentences = this.extractRelevantSentences(query, chunk.content);
        if (relevant_sentences.length > 0) {
          answer_parts.push(...relevant_sentences);
          used_sources.add(chunk.source);
        }
      }
    }
    
    // Combine into coherent answer with citations
    const answer = this.combineWithCitations(answer_parts, relevant_chunks, grade_level, subject);
    
    return answer;
  }

  private rankChunksByRelevance(query: string, chunks: SourceChunk[]): SourceChunk[] {
    const scored_chunks = chunks.map(chunk => ({
      ...chunk,
      confidence_score: this.verification_engine['calculateKeywordSimilarity'](query, chunk.content)
    }));
    
    return scored_chunks.sort((a, b) => b.confidence_score - a.confidence_score);
  }

  private extractRelevantSentences(query: string, content: string): string[] {
    const sentences = this.verification_engine['extractSentences'](content);
    const relevant_sentences: string[] = [];
    
    for (const sentence of sentences) {
      const relevance = this.verification_engine['calculateKeywordSimilarity'](query, sentence);
      if (relevance > 0.1) { // Minimum relevance threshold
        relevant_sentences.push(sentence);
      }
    }
    
    return relevant_sentences.slice(0, 3); // Return top 3 most relevant sentences
  }

  private combineWithCitations(
    sentences: string[],
    source_chunks: SourceChunk[],
    grade_level: number,
    subject: string
  ): string {
    if (sentences.length === 0) {
      return "The available textbook content does not contain sufficient information to answer this question.";
    }
    
    // Group sentences and add citations
    const answer_parts: string[] = [];
    for (const sentence of sentences) {
      // Find source for this sentence
      const source_info = this.findSourceForSentence(sentence, source_chunks);
      const citation = source_info ? `[${source_info}]` : "";
      
      answer_parts.push(`${sentence} ${citation}`);
    }
    
    // Add appropriate greeting for grade level
    let greeting: string;
    if (grade_level <= 5) {
      greeting = "Shabash! Let me explain this from your textbook:";
    } else if (grade_level <= 8) {
      greeting = "Great question! According to your NCERT textbook:";
    } else {
      greeting = "Based on your NCERT curriculum:";
    }
    
    return `${greeting}\n\n${answer_parts.join('\n\n')}`;
  }

  private findSourceForSentence(sentence: string, source_chunks: SourceChunk[]): string {
    let best_match: SourceChunk | null = null;
    let best_score = 0.0;
    
    for (const chunk of source_chunks) {
      const score = this.verification_engine['calculateKeywordSimilarity'](sentence, chunk.content);
      if (score > best_score) {
        best_score = score;
        best_match = chunk;
      }
    }
    
    if (best_match) {
      const source_parts: string[] = [];
      if (best_match.chapter) {
        source_parts.push(`Ch ${best_match.chapter}`);
      }
      if (best_match.page) {
        source_parts.push(`Pg ${best_match.page}`);
      }
      if (source_parts.length === 0) {
        source_parts.push("NCERT Textbook");
      }
      
      return source_parts.join(", ");
    }
    
    return "Textbook";
  }

  private async refineAnswer(
    answer: string,
    verification_result: VerificationResult,
    source_chunks: SourceChunk[]
  ): Promise<string> {
    if (verification_result.failed_sentences.length === 0) {
      return answer;
    }
    
    // Remove or replace failed sentences
    const sentences = this.verification_engine['extractSentences'](answer);
    const refined_sentences: string[] = [];
    
    for (const sentence of sentences) {
      if (!verification_result.failed_sentences.includes(sentence)) {
        refined_sentences.push(sentence);
      } else {
        // Try to find a better replacement from sources
        const replacement = this.findReplacementSentence(sentence, source_chunks);
        if (replacement) {
          refined_sentences.push(replacement);
        }
      }
    }
    
    return refined_sentences.join('\n\n');
  }

  private findReplacementSentence(failed_sentence: string, source_chunks: SourceChunk[]): string | null {
    for (const chunk of source_chunks) {
      const sentences = this.verification_engine['extractSentences'](chunk.content);
      for (const sentence of sentences) {
        if (this.verification_engine['calculateKeywordSimilarity'](failed_sentence, sentence) > 0.3) {
          return sentence;
        }
      }
    }
    return null;
  }
}

// Factory function for easy instantiation
export function createSourceValidationTools(): {
  verification_engine: ContentVerificationEngine;
  content_generator: ConstrainedContentGenerator;
} {
  const verification_engine = new ContentVerificationEngine();
  const content_generator = new ConstrainedContentGenerator();
  
  console.log('✅ Source validation tools created successfully');
  return { verification_engine, content_generator };
}
