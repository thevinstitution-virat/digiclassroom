/**
 * Enhanced Textbook Fidelity Engine
 * Fixes content verification catastrophic failures
 */

import { OpenAIService } from './openai_service';

export interface SearchResult {
  content: string;
  payload?: any;
  score?: number;
}

export interface SentenceVerification {
  sentence: string;
  fidelityScore: number;
  isVerified: boolean;
  matchType: 'exact' | 'semantic' | 'paraphrase' | 'none';
  sourceReference: SearchResult | null;
  confidence: 'high' | 'medium' | 'low';
}

export interface FidelityReport {
  overallFidelity: number;
  totalSentences: number;
  verifiedSentences: number;
  unverifiedSentences: number;
  sentenceVerifications: SentenceVerification[];
  recommendations: string[];
  isAcceptable: boolean;
}

export class EnhancedFidelityEngine {
  private openaiService: OpenAIService;
  private semanticThreshold = 0.75; // Lowered from 0.85 for better recall
  private exactMatchWeight = 0.6;
  private semanticMatchWeight = 0.4;
  private acceptableThreshold = 0.6; // 60% fidelity required

  constructor() {
    this.openaiService = OpenAIService.getInstance();
  }

  /**
   * Verify content fidelity with enhanced algorithms
   */
  async verifyContentFidelity(
    generatedText: string,
    sourceDocuments: SearchResult[]
  ): Promise<FidelityReport> {
    console.log('🔍 Starting enhanced content verification...');
    
    if (!sourceDocuments || sourceDocuments.length === 0) {
      console.warn('⚠️ No source documents provided for verification');
      return this.createEmptyReport(generatedText);
    }

    const sentences = this.splitIntoSentences(generatedText);
    const verificationResults: SentenceVerification[] = [];

    console.log(`📝 Verifying ${sentences.length} sentences against ${sourceDocuments.length} source documents`);

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      if (sentence.trim().length < 10) continue; // Skip very short sentences
      
      console.log(`🔍 Verifying sentence ${i + 1}/${sentences.length}: "${sentence.substring(0, 50)}..."`);
      
      const verification = await this.verifySentence(sentence, sourceDocuments);
      verificationResults.push(verification);
      
      console.log(`📊 Sentence ${i + 1}: ${verification.fidelityScore.toFixed(3)} - ${verification.isVerified ? '✅' : '❌'} (${verification.matchType})`);
    }

    return this.generateFidelityReport(verificationResults);
  }

  /**
   * Verify individual sentence against source documents
   */
  private async verifySentence(
    sentence: string,
    sources: SearchResult[]
  ): Promise<SentenceVerification> {
    let bestMatch = {
      score: 0,
      source: null as SearchResult | null,
      matchType: 'none' as 'exact' | 'semantic' | 'paraphrase' | 'none'
    };

    for (const source of sources) {
      // Exact phrase matching
      const exactScore = this.calculateExactMatch(sentence, source.content);
      
      // Semantic similarity using embeddings (only if exact match is low)
      let semanticScore = 0;
      if (exactScore < 0.8) {
        semanticScore = await this.calculateSemanticSimilarity(sentence, source.content);
      }

      // Combined score with weighted approach
      const combinedScore = (exactScore * this.exactMatchWeight) + 
                           (semanticScore * this.semanticMatchWeight);

      if (combinedScore > bestMatch.score) {
        bestMatch = {
          score: combinedScore,
          source,
          matchType: exactScore > 0.8 ? 'exact' : 
                    semanticScore > this.semanticThreshold ? 'semantic' : 
                    combinedScore > 0.4 ? 'paraphrase' : 'none'
        };
      }
    }

    return {
      sentence,
      fidelityScore: bestMatch.score,
      isVerified: bestMatch.score >= 0.5, // Lowered threshold for better acceptance
      matchType: bestMatch.matchType,
      sourceReference: bestMatch.source,
      confidence: this.calculateConfidence(bestMatch.score)
    };
  }

  /**
   * Calculate exact match score using fuzzy string matching
   */
  private calculateExactMatch(sentence: string, sourceText: string): number {
    const normalizedSentence = this.normalizeText(sentence);
    const normalizedSource = this.normalizeText(sourceText);

    // Check for exact phrase matches
    if (normalizedSource.includes(normalizedSentence)) {
      return 1.0;
    }

    // Check for partial phrase matches
    const sentenceWords = normalizedSentence.split(' ').filter(word => word.length > 3);
    const sourceWords = new Set(normalizedSource.split(' '));
    
    let matchingWords = 0;
    let consecutiveMatches = 0;
    let maxConsecutive = 0;

    for (let i = 0; i < sentenceWords.length; i++) {
      if (sourceWords.has(sentenceWords[i])) {
        matchingWords++;
        consecutiveMatches++;
        maxConsecutive = Math.max(maxConsecutive, consecutiveMatches);
      } else {
        consecutiveMatches = 0;
      }
    }

    // Calculate score based on word overlap and consecutive matches
    const wordOverlapScore = matchingWords / sentenceWords.length;
    const consecutiveBonus = maxConsecutive >= 3 ? 0.2 : 0;
    
    return Math.min(1.0, wordOverlapScore + consecutiveBonus);
  }

  /**
   * Calculate semantic similarity using embeddings
   */
  private async calculateSemanticSimilarity(sentence: string, sourceText: string): Promise<number> {
    try {
      // Generate embeddings for both texts
      const [sentenceEmbedding, sourceEmbedding] = await Promise.all([
        this.openaiService.generateEmbedding(sentence),
        this.openaiService.generateEmbedding(sourceText)
      ]);

      // Calculate cosine similarity
      return this.cosineSimilarity(sentenceEmbedding, sourceEmbedding);
    } catch (error) {
        // @ts-ignore
      console.warn('⚠️ Semantic similarity calculation failed:', error.message);
      return 0;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length)
  return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0)
  return 0;
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Normalize text for comparison
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Split text into sentences
   */
  private splitIntoSentences(text: string): string[] {
    return text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  /**
   * Calculate confidence level based on score
   */
  private calculateConfidence(score: number): 'high' | 'medium' | 'low' {
    if (score >= 0.8)
  return 'high';
    if (score >= 0.5)
  return 'medium';
    return 'low';
  }

  /**
   * Generate comprehensive fidelity report
   */
  private generateFidelityReport(verifications: SentenceVerification[]): FidelityReport {
    const totalSentences = verifications.length;
    const verifiedSentences = verifications.filter(v => v.isVerified).length;
    const unverifiedSentences = totalSentences - verifiedSentences;
    
    const overallFidelity = totalSentences > 0 ? 
      verifications.reduce((sum, v) => sum + v.fidelityScore, 0) / totalSentences : 0;

    const recommendations: string[] = [];
    
    if (overallFidelity < this.acceptableThreshold) {
      recommendations.push('Content fidelity is below acceptable threshold');
      recommendations.push('Consider using more specific search queries');
      recommendations.push('Verify that source documents contain relevant information');
    }

    if (unverifiedSentences > totalSentences * 0.5) {
      recommendations.push('High number of unverified sentences detected');
      recommendations.push('Review source document quality and relevance');
    }

    const report: FidelityReport = {
      overallFidelity,
      totalSentences,
      verifiedSentences,
      unverifiedSentences,
      sentenceVerifications: verifications,
      recommendations,
      isAcceptable: overallFidelity >= this.acceptableThreshold
    };

    console.log(`📊 Fidelity Report: ${(overallFidelity * 100).toFixed(1)}% overall fidelity`);
    console.log(`✅ Verified: ${verifiedSentences}/${totalSentences} sentences`);
    console.log(`🎯 Acceptable: ${report.isAcceptable ? 'Yes' : 'No'}`);

    return report;
  }

  /**
   * Create empty report when no sources available
   */
  private createEmptyReport(text: string): FidelityReport {
    const sentences = this.splitIntoSentences(text);
    return {
      overallFidelity: 0,
      totalSentences: sentences.length,
      verifiedSentences: 0,
      unverifiedSentences: sentences.length,
      sentenceVerifications: [],
      recommendations: ['No source documents available for verification'],
      isAcceptable: false
    };
  }
}
