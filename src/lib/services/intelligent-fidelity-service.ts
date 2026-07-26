/**
 * Intelligent Fidelity Service
 * 🔧 CRITICAL FIX: Enhanced content verification with intelligent regeneration
 */

import { OpenAIService } from './openai_service';
import { ServiceLifecycleManager } from './service-lifecycle-manager';

export interface EnhancedSentenceVerification {
  sentence: string;
  fidelityScore: number;
  isAcceptable: boolean;
  sourceMatch: string | null;
  confidence: number;
  verificationMethod: 'exact' | 'semantic' | 'paraphrase' | 'failed';
  improvementSuggestion?: string;
}

export interface EnhancedFidelityReport {
  sentences: EnhancedSentenceVerification[];
  overallFidelity: number;
  isAcceptable: boolean;
  recommendations: string[];
  regenerationRequired: boolean;
  regeneratedContent?: string;
}

export interface SearchResult {
  content: string;
  score: number;
  metadata?: any;
}

export interface UserContext {
  role: string;
  educationalLevel: {
    grade: number;
    board: string;
    subjects: string[];
  };
  learningPreferences: {
    explanationComplexity: string;
    primaryStyle: string;
    needsScaffolding: boolean;
  };
}

export class IntelligentFidelityService {
  private readonly ACCEPTABLE_FIDELITY_THRESHOLD = 0.6; // 60% minimum
  private readonly REGENERATION_THRESHOLD = 0.4; // 40% triggers regeneration
  private openaiService: OpenAIService;

  constructor() {
    this.openaiService = OpenAIService.getInstance();
  }

  /**
   * 🔧 CRITICAL FIX: Enhanced content verification with intelligent regeneration
   */
  async enhancedContentVerification(
    generatedContent: string,
    sourceResults: SearchResult[],
    userContext: UserContext
  ): Promise<EnhancedFidelityReport> {
    console.log('🔍 Starting enhanced content verification...');
    
    const sentences = this.splitIntoSentences(generatedContent);
    const verificationResults: EnhancedSentenceVerification[] = [];
    
    for (const sentence of sentences) {
      const verification = await this.intelligentSentenceVerification(
        sentence, 
        sourceResults, 
        userContext
      );
      verificationResults.push(verification);
    }
    
    const overallFidelity = this.calculateWeightedFidelity(verificationResults);
    console.log(`📊 Overall fidelity: ${(overallFidelity * 100).toFixed(1)}%`);
    
    // If fidelity is too low, regenerate with better constraints
    if (overallFidelity < this.REGENERATION_THRESHOLD) {
      console.log(`⚠️ Fidelity too low (${(overallFidelity * 100).toFixed(1)}%), triggering regeneration`);
      return await this.triggerConstrainedRegeneration(
        generatedContent, 
        sourceResults, 
        userContext,
        verificationResults
      );
    }
    
    return {
      sentences: verificationResults,
      overallFidelity,
      isAcceptable: overallFidelity >= this.ACCEPTABLE_FIDELITY_THRESHOLD,
      recommendations: this.generateImprovementRecommendations(verificationResults),
      regenerationRequired: false
    };
  }

  /**
   * Intelligent sentence verification with multiple methods
   */
  private async intelligentSentenceVerification(
    sentence: string,
    sourceResults: SearchResult[],
    userContext: UserContext
  ): Promise<EnhancedSentenceVerification> {
    
    // Method 1: Exact phrase matching
    const exactMatch = this.findExactMatch(sentence, sourceResults);
    if (exactMatch) {
      return {
        sentence,
        fidelityScore: 0.95,
        isAcceptable: true,
        sourceMatch: exactMatch,
        confidence: 0.95,
        verificationMethod: 'exact'
      };
    }

    // Method 2: Semantic similarity
    const semanticMatch = await this.findSemanticMatch(sentence, sourceResults);
    if (semanticMatch.score > 0.7) {
      return {
        sentence,
        fidelityScore: semanticMatch.score,
        isAcceptable: semanticMatch.score > 0.6,
        sourceMatch: semanticMatch.content,
        confidence: semanticMatch.score,
        verificationMethod: 'semantic'
      };
    }

    // Method 3: Paraphrase detection
    const paraphraseMatch = await this.findParaphraseMatch(sentence, sourceResults);
    if (paraphraseMatch.score > 0.5) {
      return {
        sentence,
        fidelityScore: paraphraseMatch.score,
        isAcceptable: paraphraseMatch.score > 0.5,
        sourceMatch: paraphraseMatch.content,
        confidence: paraphraseMatch.score,
        verificationMethod: 'paraphrase'
      };
    }

    // Failed verification
    return {
      sentence,
      fidelityScore: 0.1,
      isAcceptable: false,
      sourceMatch: null,
      confidence: 0.1,
      verificationMethod: 'failed',
      improvementSuggestion: 'Consider using more direct quotes from source material'
    };
  }

  /**
   * Find exact phrase matches
   */
  private findExactMatch(sentence: string, sourceResults: SearchResult[]): string | null {
    const cleanSentence = sentence.toLowerCase().trim();
    
    for (const result of sourceResults) {
      const cleanContent = result.content.toLowerCase();
      if (cleanContent.includes(cleanSentence) || cleanSentence.includes(cleanContent.substring(0, 50))) {
        return result.content;
      }
    }
    
    return null;
  }

  /**
   * Find semantic matches using embeddings
   */
  private async findSemanticMatch(sentence: string, sourceResults: SearchResult[]): Promise<{
    score: number;
    content: string | null;
  }> {
    try {
      const sentenceEmbedding = await this.openaiService.generateEmbedding(sentence);
      let bestMatch = { score: 0, content: null as string | null };

      for (const result of sourceResults) {
        const resultEmbedding = await this.openaiService.generateEmbedding(result.content);
        const similarity = this.calculateCosineSimilarity(sentenceEmbedding, resultEmbedding);
        
        if (similarity > bestMatch.score) {
          bestMatch = { score: similarity, content: result.content };
        }
      }
      
      return bestMatch;
    } catch (error) {
      console.error('❌ Semantic matching failed:', error);
      return { score: 0, content: null };
    }
  }

  /**
   * Find paraphrase matches
   */
  private async findParaphraseMatch(sentence: string, sourceResults: SearchResult[]): Promise<{
    score: number;
    content: string | null;
  }> {
    // Simple keyword-based paraphrase detection
    const sentenceWords = sentence.toLowerCase().split(/\s+/).filter(word => word.length > 3);
    let bestMatch = { score: 0, content: null as string | null };
    
    for (const result of sourceResults) {
      const resultWords = result.content.toLowerCase().split(/\s+/);
      const commonWords = sentenceWords.filter(word => resultWords.includes(word));
      const score = commonWords.length / Math.max(sentenceWords.length, 1);
      
      if (score > bestMatch.score && score > 0.3) {
        bestMatch = { score: score * 0.7, content: result.content }; // Lower confidence for paraphrase
      }
    }
    
    return bestMatch;
  }

  /**
   * Calculate cosine similarity between embeddings
   */
  private calculateCosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length)
  return 0;
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Calculate weighted fidelity score
   */
  private calculateWeightedFidelity(verifications: EnhancedSentenceVerification[]): number {
    if (verifications.length === 0)
  return 0;
    
    const weights = {
      exact: 1.0,
      semantic: 0.8,
      paraphrase: 0.6,
      failed: 0.0
    };
    
    let totalScore = 0;
    let totalWeight = 0;
    
    for (const verification of verifications) {
      const weight = weights[verification.verificationMethod];
      totalScore += verification.fidelityScore * weight;
      totalWeight += weight;
    }
    
    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  /**
   * 🔧 CRITICAL FIX: Trigger constrained regeneration for low fidelity content
   */
  private async triggerConstrainedRegeneration(
    originalContent: string,
    sources: SearchResult[],
    context: UserContext,
    failedVerifications: EnhancedSentenceVerification[]
  ): Promise<EnhancedFidelityReport> {
    console.log('🔄 Triggering constrained regeneration...');
    
    // Extract the most reliable source content
    const highConfidenceSources = sources
      .filter(source => source.score > 0.7)
      .slice(0, 3); // Use top 3 most relevant sources
    
    if (highConfidenceSources.length === 0) {
      console.warn('⚠️ No high-confidence sources available for regeneration');
      return {
        sentences: failedVerifications,
        overallFidelity: 0.1,
        isAcceptable: false,
        recommendations: ['No reliable sources available for content regeneration'],
        regenerationRequired: true
      };
    }
    
    // Create strictly constrained prompt
    const constrainedPrompt = this.buildStrictTextbookPrompt(
      originalContent,
      highConfidenceSources,
      context,
      failedVerifications
    );
    
    try {
      // Regenerate with stricter constraints
      const response = await this.openaiService.generateChatCompletion({
        messages: [
          { role: 'system', content: `You are a strict textbook-based tutor. ONLY use information directly from the provided sources. Do not add external knowledge. Quote directly from the sources when possible.` },
          { role: 'user', content: constrainedPrompt }
        ],
        temperature: 0.2, // Lower temperature for more deterministic output
        maxTokens: 400
      });

      const regeneratedContent = { text: response.choices[0]?.message?.content || '' };
      
      console.log('✅ Content regenerated with strict constraints');
      
      // Re-verify the regenerated content
      const newVerification = await this.enhancedContentVerification(
        regeneratedContent.text,
        highConfidenceSources,
        context
      );
      
      newVerification.regeneratedContent = regeneratedContent.text;
      newVerification.regenerationRequired = true;
      
      return newVerification;
    } catch (error) {
      console.error('❌ Constrained regeneration failed:', error);
      return {
        sentences: failedVerifications,
        overallFidelity: 0.1,
        isAcceptable: false,
        recommendations: ['Content regeneration failed - manual review required'],
        regenerationRequired: true
      };
    }
  }

  /**
   * Build strict textbook-based prompt
   */
  private buildStrictTextbookPrompt(
    originalContent: string,
    sources: SearchResult[],
    context: UserContext,
    failedVerifications: EnhancedSentenceVerification[]
  ): string {
    const sourceTexts = sources.map((source, index) => 
      `Source ${index + 1}: ${source.content}`
    ).join('\n\n');
    
    const failedSentences = failedVerifications
      .filter(v => !v.isAcceptable)
      .map(v => v.sentence)
      .join('\n- ');
    
    return `
You are answering a ${context.educationalLevel.grade}th grade ${context.educationalLevel.board} student's question.

STRICT REQUIREMENTS:
1. ONLY use information from the provided textbook sources below
2. Do NOT add any external knowledge or information
3. Quote directly from sources when possible
4. Keep explanations at ${context.learningPreferences.explanationComplexity} level

TEXTBOOK SOURCES:
${sourceTexts}

ORIGINAL RESPONSE (needs improvement):
${originalContent}

SENTENCES THAT FAILED VERIFICATION:
- ${failedSentences}

Please rewrite the response using ONLY the information from the textbook sources above. Make sure every sentence can be traced back to the provided sources.
`;
  }

  /**
   * Generate improvement recommendations
   */
  private generateImprovementRecommendations(verifications: EnhancedSentenceVerification[]): string[] {
    const recommendations: string[] = [];
    
    const failedCount = verifications.filter(v => !v.isAcceptable).length;
    const totalCount = verifications.length;
    
    if (failedCount > totalCount * 0.5) {
      recommendations.push('High failure rate - consider using more direct quotes from source material');
    }
    
    const exactMatches = verifications.filter(v => v.verificationMethod === 'exact').length;
    if (exactMatches < totalCount * 0.3) {
      recommendations.push('Increase use of exact phrases and quotes from textbook sources');
    }
    
    const semanticMatches = verifications.filter(v => v.verificationMethod === 'semantic').length;
    if (semanticMatches < totalCount * 0.4) {
      recommendations.push('Improve semantic alignment with source content');
    }
    
    return recommendations;
  }

  /**
   * Split content into sentences
   */
  private splitIntoSentences(content: string): string[] {
    return content
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 10); // Filter out very short fragments
  }
}
