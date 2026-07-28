/**
 * Content Verification Service Implementation
 * Verifies content fidelity against source materials
 * Features:
 * - Sentence-by-sentence verification
 * - Citation extraction
 * - Fidelity scoring
 * - Hallucination detection
 */

import type { IContentVerificationService, ILLMService, VerificationResult } from '../interfaces';

export class ContentVerificationService implements IContentVerificationService {
  private llmService: ILLMService;
  private fidelityThreshold = 0.7;

  constructor(llmService: ILLMService) {
    this.llmService = llmService;
    console.log('✅ Content Verification Service initialized');
  }

  async verify(content: string, sources?: string[]): Promise<VerificationResult> {
    if (!sources || sources.length === 0) {
      // No sources to verify against
      return {
        score: 0.5,
        isValid: false,
        issues: ['No source materials provided for verification'],
        citations: []
      };
    }

    try {
      // Extract sentences from content
      const sentences = this.extractSentences(content);
      
      // Verify each sentence
      const sentenceScores = await Promise.all(
        sentences.map(sentence => this.verifySentence(sentence, sources))
      );

      // Calculate overall score
      const avgScore = sentenceScores.reduce((sum, score) => sum + score, 0) / sentenceScores.length;

      // Extract citations
      const citations = this.extractCitations(content);

      // Identify issues
      const issues: string[] = [];
      if (avgScore < this.fidelityThreshold) {
        issues.push(`Low fidelity score: ${avgScore.toFixed(2)}`);
      }
      if (citations.length === 0) {
        issues.push('No citations found in content');
      }

      return {
        score: avgScore,
        isValid: avgScore >= this.fidelityThreshold,
        issues,
        citations,
        sentenceScores: sentences.map((sentence, idx) => ({
          sentence,
          score: sentenceScores[idx]
        }))
      };

    } catch (error) {
      console.error('❌ Content verification failed:', error);
      return {
        score: 0,
        isValid: false,
        issues: ['Verification failed due to error'],
        citations: []
      };
    }
  }

  async verifySentence(sentence: string, sources: string[]): Promise<number> {
    // Simple heuristic: Check if sentence content appears in sources
    const normalizedSentence = sentence.toLowerCase().trim();
    
    // Skip very short sentences
    if (normalizedSentence.length < 20) {
      return 1.0; // Assume valid
    }

    // Check for keyword overlap with sources
    const sentenceWords = new Set(
      normalizedSentence
        .split(/\s+/)
        .filter(word => word.length > 3) // Filter out short words
    );

    let maxOverlap = 0;
    for (const source of sources) {
      const sourceWords = new Set(
        source.toLowerCase()
          .split(/\s+/)
          .filter(word => word.length > 3)
      );

      const overlap = Array.from(sentenceWords).filter(word => sourceWords.has(word)).length;
      const overlapRatio = overlap / sentenceWords.size;
      maxOverlap = Math.max(maxOverlap, overlapRatio);
    }

    return maxOverlap;
  }

  extractCitations(content: string): string[] {
    const citations: string[] = [];

    // Pattern 1: [Source 1], [Source 2], etc.
    const sourcePattern = /\[Source \d+\]/g;
    const sourceMatches = content.match(sourcePattern);
    if (sourceMatches) {
      citations.push(...sourceMatches);
    }

    // Pattern 2: According to..., As mentioned in..., etc.
    const referencePattern = /(according to|as mentioned in|as stated in|based on)[^.!?]+/gi;
    const referenceMatches = content.match(referencePattern);
    if (referenceMatches) {
      citations.push(...referenceMatches);
    }

    return [...new Set(citations)]; // Remove duplicates
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private extractSentences(content: string): string[] {
    // Split by sentence boundaries
    const sentencePattern = /[^.!?]+[.!?]+/g;
    const sentences = content.match(sentencePattern) || [];
    
    return sentences
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }
}

