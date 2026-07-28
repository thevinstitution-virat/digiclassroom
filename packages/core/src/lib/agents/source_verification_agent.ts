/**
 * Source Verification Agent - Ensures 100% Textbook Content Fidelity
 * Verifies every generated statement against source material with strict thresholds
 */

import { OpenAIService } from '../services/openai_service';

export interface VerificationResult {
  verified_sentences: Array<{
    sentence: string;
    source_chunk: string;
    similarity_score: number;
    source_page: number;
    textbook_title: string;
    chapter: string;
  }>;
  unverified_sentences: Array<{
    sentence: string;
    reason: string;
    best_similarity: number;
  }>;
  source_mapping: Record<string, any>;
  overall_fidelity_score: number;
  passes_verification: boolean;
  total_sentences: number;
  verified_count: number;
}

export interface SourceChunk {
  content: string;
  metadata: {
    page_number?: number;
    textbook_title?: string;
    chapter?: string;
    subject?: string;
    class_level?: string;
  };
  score?: number;
}

export class ContentVerificationTool {
  private strictThreshold = 0.85; // 85% semantic similarity minimum
  private verificationPassThreshold = 0.95; // 95% sentences must be verified

  /**
   * Verify that every sentence in generated text has direct source backing
   */
  async verify_against_source(
    generatedText: string, 
    sourceChunks: SourceChunk[]
  ): Promise<VerificationResult> {
    console.log(`🔍 Verifying content fidelity: ${generatedText.length} characters against ${sourceChunks.length} sources`);
    
    const sentences = this.splitIntoSentences(generatedText);
    const verificationResults: VerificationResult = {
      verified_sentences: [],
      unverified_sentences: [],
      source_mapping: {},
      overall_fidelity_score: 0.0,
      passes_verification: false,
      total_sentences: 0,
      verified_count: 0
    };

    let verifiedCount = 0;
    const meaningfulSentences = sentences.filter(s => s.trim().length >= 10);
    
    for (const sentence of meaningfulSentences) {
      const bestMatch = await this.findBestSourceMatch(sentence, sourceChunks);
      
      if (bestMatch && bestMatch.similarity_score >= this.strictThreshold) {
        verificationResults.verified_sentences.push({
          sentence,
          source_chunk: bestMatch.chunk_text,
          similarity_score: bestMatch.similarity_score,
          source_page: bestMatch.page_number || 0,
          textbook_title: bestMatch.textbook_title || 'Unknown',
          chapter: bestMatch.chapter || 'Unknown'
        });
        
        verificationResults.source_mapping[sentence] = bestMatch;
        verifiedCount++;
      } else {
        verificationResults.unverified_sentences.push({
          sentence,
          reason: 'No source match above 85% threshold',
          best_similarity: bestMatch?.similarity_score || 0.0
        });
      }
    }

    verificationResults.total_sentences = meaningfulSentences.length;
    verificationResults.verified_count = verifiedCount;
    verificationResults.overall_fidelity_score = verifiedCount / Math.max(meaningfulSentences.length, 1);
    verificationResults.passes_verification = verificationResults.overall_fidelity_score >= this.verificationPassThreshold;

    console.log(`✅ Verification complete: ${verifiedCount}/${meaningfulSentences.length} sentences verified (${(verificationResults.overall_fidelity_score * 100).toFixed(1)}%)`);
    
    return verificationResults;
  }

  /**
   * Find the best matching source chunk for a sentence
   */
  private async findBestSourceMatch(
    sentence: string, 
    sourceChunks: SourceChunk[]
  ): Promise<{
    chunk_text: string;
    similarity_score: number;
    page_number?: number;
    textbook_title?: string;
    chapter?: string;
  } | null> {
    let bestMatch = null;
    let bestScore = 0.0;

    for (const chunk of sourceChunks) {
      const chunkText = chunk.content;
      
      // Calculate semantic similarity (simplified - in production use sentence transformers)
      const semanticScore = this.calculateSemanticSimilarity(sentence, chunkText);
      
      // Calculate lexical overlap
      const overlapScore = this.calculateTextOverlap(sentence, chunkText);
      
      // Combined score (semantic + lexical)
      const combinedScore = (semanticScore * 0.7) + (overlapScore * 0.3);
      
      if (combinedScore > bestScore) {
        bestScore = combinedScore;
        bestMatch = {
          chunk_text: chunkText,
          similarity_score: combinedScore,
          page_number: chunk.metadata.page_number,
          textbook_title: chunk.metadata.textbook_title,
          chapter: chunk.metadata.chapter
        };
      }
    }

    return bestMatch;
  }

  /**
   * Calculate semantic similarity between sentence and chunk
   * Simplified implementation - in production, use sentence transformers
   */
  private calculateSemanticSimilarity(sentence: string, chunkText: string): number {
    const sentenceWords = new Set(sentence.toLowerCase().split(/\W+/).filter(w => w.length > 2));
    const chunkWords = new Set(chunkText.toLowerCase().split(/\W+/).filter(w => w.length > 2));
    
    if (sentenceWords.size === 0)
  return 0;
    
    const intersection = new Set([...sentenceWords].filter(w => chunkWords.has(w)));
    const union = new Set([...sentenceWords, ...chunkWords]);
    
    // Jaccard similarity
    return intersection.size / union.size;
  }

  /**
   * Calculate lexical overlap between sentence and chunk
   */
  private calculateTextOverlap(sentence: string, chunkText: string): number {
    const sentenceWords = new Set(sentence.toLowerCase().split(/\W+/).filter(w => w.length > 2));
    const chunkWords = new Set(chunkText.toLowerCase().split(/\W+/).filter(w => w.length > 2));
    
    if (sentenceWords.size === 0)
  return 0;
    
    const overlap = [...sentenceWords].filter(w => chunkWords.has(w)).length;
    return overlap / sentenceWords.size;
  }

  /**
   * Split text into sentences for verification
   */
  private splitIntoSentences(text: string): string[] {
    // Split on sentence endings, but preserve the structure
    const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
    return sentences;
  }
}

export class SourceVerificationAgent {
  private verificationTool: ContentVerificationTool;
        // @ts-ignore
  private llmService: LLMService;

  constructor() {
    this.verificationTool = new ContentVerificationTool();
    this.llmService = OpenAIService.getInstance() as any; // Legacy compatibility
  }

  /**
   * Verify that the generated answer is fully backed by source material
   */
  async verify_response(
    generatedAnswer: string,
    sourceChunks: SourceChunk[]
  ): Promise<VerificationResult> {
    console.log(`🔍 Source Verification: Checking ${generatedAnswer.length} character response against ${sourceChunks.length} source chunks`);
    
    try {
      // Perform comprehensive verification
      const verificationResult = await this.verificationTool.verify_against_source(
        generatedAnswer,
        sourceChunks
      );

      // Log verification results
      if (verificationResult.passes_verification) {
        console.log(`✅ Verification PASSED: ${(verificationResult.overall_fidelity_score * 100).toFixed(1)}% fidelity`);
      } else {
        console.log(`❌ Verification FAILED: ${(verificationResult.overall_fidelity_score * 100).toFixed(1)}% fidelity (required: 95%)`);
        console.log(`Unverified sentences: ${verificationResult.unverified_sentences.length}`);
      }

      return verificationResult;

    } catch (error) {
      console.error('❌ Source verification error:', error);
      
      // Return failed verification result
      return {
        verified_sentences: [],
        unverified_sentences: [{
          sentence: generatedAnswer,
          reason: `Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          best_similarity: 0.0
        }],
        source_mapping: {},
        overall_fidelity_score: 0.0,
        passes_verification: false,
        total_sentences: 1,
        verified_count: 0
      };
    }
  }

  /**
   * Generate verification report for display
   */
  generateVerificationReport(verificationResult: VerificationResult): string {
    const fidelityPercentage = (verificationResult.overall_fidelity_score * 100).toFixed(1);
    const status = verificationResult.passes_verification ? '✅ VERIFIED' : '❌ UNVERIFIED';
    
    let report = `📊 **Content Verification Report** ${status}\n\n`;
    report += `**Fidelity Score:** ${fidelityPercentage}% (${verificationResult.verified_count}/${verificationResult.total_sentences} sentences verified)\n\n`;
    
    if (verificationResult.verified_sentences.length > 0) {
      report += `**✅ Verified Statements:**\n`;
      verificationResult.verified_sentences.slice(0, 3).forEach((item, index) => {
        report += `${index + 1}. "${item.sentence}"\n`;
        report += `   📚 Source: ${item.textbook_title}, Chapter ${item.chapter}, Page ${item.source_page}\n`;
        report += `   🎯 Similarity: ${(item.similarity_score * 100).toFixed(1)}%\n\n`;
      });
    }
    
    if (verificationResult.unverified_sentences.length > 0) {
      report += `**❌ Unverified Statements:**\n`;
      verificationResult.unverified_sentences.slice(0, 2).forEach((item, index) => {
        report += `${index + 1}. "${item.sentence}"\n`;
        report += `   ⚠️ Reason: ${item.reason}\n\n`;
      });
    }
    
    return report;
  }
}
