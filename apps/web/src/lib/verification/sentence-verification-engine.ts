/**
 * Sentence-Level Verification Engine
 * 🎯 GRANULAR FIDELITY VERIFICATION: Validates every sentence against textbook sources
 */

import { RankedChunk } from '../retrieval/hybrid-retrieval-engine';
import { OpenAIService } from '../services/openai_service';
import { ServiceLifecycleManager } from '../services/service-lifecycle-manager';

export interface SentenceVerificationResult {
  originalText: string;
  verifiedResponse: string;
  verifiedSentences: VerifiedSentence[];
  rejectedSentences: RejectedSentence[];
  fidelityScore: number;
  isAcceptable: boolean;
  mappedSources: SourceMapping[];
  verificationMetrics: VerificationMetrics;
}

export interface VerifiedSentence {
  sentence: string;
  sourceMapping: SourceMapping;
  confidence: number;
  exactMatch: boolean;
  verificationMethod: 'exact_match' | 'semantic_match' | 'paraphrase_match' | 'citation_only';
}

export interface RejectedSentence {
  sentence: string;
  rejectionReason: string;
  confidence: number;
  suggestedFix?: string;
  hallucinationIndicators?: string[];
}

export interface SourceMapping {
  sourceId: string;
  chunkId: string;
  matchType: 'exact_substring' | 'exact_sentence' | 'semantic_similarity' | 'paraphrase_match';
  matchText: string;
  sourceText: string;
  metadata: any;
  confidence: number;
  boundingBox?: BoundingBox;
}

export interface ParsedSentence {
  text: string;
  index: number;
  wordCount: number;
  tokens: string[];
  isQuestion: boolean;
  isCitation: boolean;
  containsNumbers: boolean;
}

export interface SingleSentenceVerification {
  isVerified: boolean;
  confidence: number;
  exactMatch: boolean;
  sourceMapping: SourceMapping | null;
  rejectionReason: string | null;
  suggestedFix?: string;
  verificationMethod?: string;
}

export interface HallucinationDetection {
  isLikelyHallucination: boolean;
  reason: string | null;
  confidence: number;
  matchedPattern?: string;
  indicators: string[];
}

export interface VerificationMetrics {
  totalSentences: number;
  verifiedSentences: number;
  rejectedSentences: number;
  exactMatches: number;
  semanticMatches: number;
  paraphraseMatches: number;
  citationOnlyMatches: number;
  averageConfidence: number;
  processingTimeMs: number;
}

export class SentenceVerificationEngine {
  private openaiService: OpenAIService;
  // 🛡️ ENHANCED: Raised acceptance thresholds for stricter verification
  private readonly VERIFICATION_THRESHOLD = 0.90;  // Raised from 0.75 to 0.90
  private readonly SEMANTIC_THRESHOLD = 0.92;      // Raised from 0.85 to 0.92
  private readonly PARAPHRASE_THRESHOLD = 0.90;    // Raised from 0.80 to 0.90
  private readonly EXACT_MATCH_THRESHOLD = 0.95;   // New: For exact substring matching
  private readonly CITATION_SIMILARITY_THRESHOLD = 0.95; // New: For citation verification

  // Hallucination detection patterns
  private readonly HALLUCINATION_PATTERNS = [
    {
      pattern: /\b(generally|typically|usually|commonly|often|sometimes|mostly|mainly)\b/i,
      reason: 'Contains generalization words indicating external knowledge',
      severity: 'high'
    },
    {
      pattern: /\b(it is known that|research shows|studies indicate|experts say|scientists believe)\b/i,
      reason: 'References external research not in textbook',
      severity: 'high'
    },
    {
      pattern: /\b(in modern times|nowadays|currently|today|recently|these days)\b/i,
      reason: 'Contains temporal references likely not in textbook',
      severity: 'medium'
    },
    {
      pattern: /\b(experts believe|scientists think|scholars argue|researchers claim)\b/i,
      reason: 'References external expert opinions',
      severity: 'high'
    },
    {
      pattern: /\b(obviously|clearly|of course|naturally|as we all know)\b/i,
      reason: 'Contains assumption-based language',
      severity: 'medium'
    },
    {
      pattern: /\b(in my opinion|i think|i believe|personally)\b/i,
      reason: 'Contains personal opinion indicators',
      severity: 'high'
    }
  ];

  constructor() {
    this.openaiService = OpenAIService.getInstance();
  }

  /**
   * 🎯 MAIN VERIFICATION METHOD: Verify sentence-level fidelity
   */
  async verifySentenceFidelity(
    generatedText: string,
    sourceChunks: RankedChunk[]
  ): Promise<SentenceVerificationResult> {
    console.log('🔍 Starting sentence-level verification...');
    const startTime = Date.now();

    try {
      const sentences = this.splitIntoSentences(generatedText);
      const verifiedSentences: VerifiedSentence[] = [];
      const rejectedSentences: RejectedSentence[] = [];

      console.log(`📝 Verifying ${sentences.length} sentences...`);

      for (const sentence of sentences) {
        const verification = await this.verifySingleSentence(sentence, sourceChunks);

        if (verification.isVerified) {
          verifiedSentences.push({
            sentence: sentence.text,
            sourceMapping: verification.sourceMapping!,
            confidence: verification.confidence,
            exactMatch: verification.exactMatch,
            verificationMethod: verification.verificationMethod as any
          });
        } else {
          rejectedSentences.push({
            sentence: sentence.text,
            rejectionReason: verification.rejectionReason!,
            confidence: verification.confidence,
            suggestedFix: verification.suggestedFix,
            hallucinationIndicators: await this.extractHallucinationIndicators(sentence.text)
          });
        }
      }

      const fidelityScore = sentences.length > 0 ? verifiedSentences.length / sentences.length : 0;
      const isAcceptable = fidelityScore >= this.VERIFICATION_THRESHOLD;

      // Reconstruct response with only verified sentences
      const verifiedResponse = verifiedSentences
        .map(vs => vs.sentence)
        .join(' ');

      const mappedSources = this.extractMappedSources(verifiedSentences);
      const verificationMetrics = this.calculateVerificationMetrics(
        sentences,
        verifiedSentences,
        rejectedSentences,
        Date.now() - startTime
      );

      console.log(`✅ Sentence verification completed: ${(fidelityScore * 100).toFixed(1)}% fidelity`);

      return {
        originalText: generatedText,
        verifiedResponse,
        verifiedSentences,
        rejectedSentences,
        fidelityScore,
        isAcceptable,
        mappedSources,
        verificationMetrics
      };

    } catch (error) {
      console.error('❌ Sentence verification failed:', error);
        // @ts-ignore
      throw new Error(`Sentence verification failed: ${error.message}`);
    }
  }

  /**
   * Verify a single sentence against source chunks
   */
  private async verifySingleSentence(
    sentence: ParsedSentence,
    sourceChunks: RankedChunk[]
  ): Promise<SingleSentenceVerification> {
    // Skip very short sentences or citations
    if (sentence.wordCount < 3 || sentence.isCitation) {
      return {
        isVerified: true,
        confidence: 1.0,
        exactMatch: false,
        sourceMapping: null,
        rejectionReason: null,
        verificationMethod: 'citation_only'
      };
    }

    // Check for hallucination patterns first
    const hallucinationCheck = await this.detectHallucination(sentence);
    if (hallucinationCheck.isLikelyHallucination) {
      return {
        isVerified: false,
        confidence: 0.0,
        exactMatch: false,
        sourceMapping: null,
        rejectionReason: hallucinationCheck.reason!,
        suggestedFix: 'Remove or rephrase to use only textbook content'
      };
    }

    // Check for exact matches first (highest confidence)
    const exactMatch = await this.findExactMatch(sentence, sourceChunks);
    if (exactMatch) {
      return {
        isVerified: true,
        confidence: exactMatch.confidence,
        exactMatch: true,
        sourceMapping: exactMatch,
        rejectionReason: null,
        verificationMethod: 'exact_match'
      };
    }

    // 🛡️ ENHANCED: Check for semantic similarity with raised threshold
    const semanticMatch = await this.findSemanticMatch(sentence, sourceChunks);
    if (semanticMatch && semanticMatch.confidence >= this.SEMANTIC_THRESHOLD) {
      console.log(`✅ SEMANTIC MATCH: Found semantic match (confidence: ${semanticMatch.confidence.toFixed(3)})`);
      return {
        isVerified: true,
        confidence: semanticMatch.confidence,
        exactMatch: false,
        sourceMapping: semanticMatch,
        rejectionReason: null,
        verificationMethod: 'semantic_match'
      };
    } else if (semanticMatch) {
      console.log(`❌ SEMANTIC MATCH: Similarity too low (${semanticMatch.confidence.toFixed(3)} < ${this.SEMANTIC_THRESHOLD})`);
    }

    // 🛡️ ENHANCED: Check for paraphrase matches with raised threshold
    const paraphraseMatch = await this.findParaphraseMatch(sentence, sourceChunks);
    if (paraphraseMatch && paraphraseMatch.confidence >= this.PARAPHRASE_THRESHOLD) {
      console.log(`✅ PARAPHRASE MATCH: Found paraphrase match (confidence: ${paraphraseMatch.confidence.toFixed(3)})`);
      return {
        isVerified: true,
        confidence: paraphraseMatch.confidence,
        exactMatch: false,
        sourceMapping: paraphraseMatch,
        rejectionReason: null,
        verificationMethod: 'paraphrase_match'
      };
    } else if (paraphraseMatch) {
      console.log(`❌ PARAPHRASE MATCH: Similarity too low (${paraphraseMatch.confidence.toFixed(3)} < ${this.PARAPHRASE_THRESHOLD})`);
    }

    // Sentence failed verification
    return {
      isVerified: false,
      confidence: semanticMatch?.confidence || 0,
      exactMatch: false,
      sourceMapping: null,
      rejectionReason: 'No matching source content found with sufficient confidence',
      suggestedFix: await this.suggestFix(sentence, sourceChunks)
    };
  }

  /**
   * 🛡️ ENHANCED: Find exact matches with stricter substring matching and citation mapping
   */
  private async findExactMatch(
    sentence: ParsedSentence,
    sourceChunks: RankedChunk[]
  ): Promise<SourceMapping | null> {
    const normalizedSentence = this.normalizeText(sentence.text);
    console.log(`🔍 EXACT MATCH: Searching for exact match of: "${sentence.text.substring(0, 50)}..."`);

    for (const chunk of sourceChunks) {
      const normalizedChunk = this.normalizeText(chunk.content);

      // 🛡️ ENHANCED: Strict exact substring match with minimum length requirement
      if (normalizedSentence.length >= 10 && normalizedChunk.includes(normalizedSentence)) {
        console.log(`✅ EXACT MATCH: Found exact substring match in chunk ${chunk.id}`);

        // Map to chunk metadata for proper citation
        const citationInfo = this.extractCitationInfo(chunk);

        return {
          sourceId: chunk.id,
          chunkId: chunk.id,
          matchType: 'exact_substring',
          matchText: sentence.text,
          sourceText: this.extractMatchingContext(chunk.content, sentence.text),
          metadata: {
            ...chunk.metadata,
            ...citationInfo
          },
          confidence: 1.0
        };
      }

      // 🛡️ ENHANCED: Exact sentence match with raised threshold
      const chunkSentences = this.splitIntoSentences(chunk.content);
      for (const chunkSentence of chunkSentences) {
        const similarity = this.calculateExactSimilarity(
          normalizedSentence,
          this.normalizeText(chunkSentence.text)
        );

        if (similarity >= this.EXACT_MATCH_THRESHOLD) {
          console.log(`✅ EXACT MATCH: Found exact sentence match (similarity: ${similarity.toFixed(3)}) in chunk ${chunk.id}`);

          const citationInfo = this.extractCitationInfo(chunk);

          return {
            sourceId: chunk.id,
            chunkId: chunk.id,
            matchType: 'exact_sentence',
            matchText: sentence.text,
            sourceText: chunkSentence.text,
            metadata: {
              ...chunk.metadata,
              ...citationInfo
            },
            confidence: similarity
          };
        }
      }

      // 🛡️ NEW: Multi-word phrase exact matching for better precision
      const phraseMatch = this.findExactPhraseMatch(sentence.text, chunk.content);
      if (phraseMatch && phraseMatch.confidence >= this.EXACT_MATCH_THRESHOLD) {
        console.log(`✅ EXACT MATCH: Found exact phrase match in chunk ${chunk.id}`);

        const citationInfo = this.extractCitationInfo(chunk);

        return {
          sourceId: chunk.id,
          chunkId: chunk.id,
        // @ts-ignore
          matchType: 'exact_phrase',
          matchText: sentence.text,
          sourceText: phraseMatch.matchedText,
          metadata: {
            ...chunk.metadata,
            ...citationInfo
          },
          confidence: phraseMatch.confidence
        };
      }
    }

    console.log('❌ EXACT MATCH: No exact matches found');
    return null;
  }

  /**
   * Find semantic matches using embeddings
   */
  private async findSemanticMatch(
    sentence: ParsedSentence,
    sourceChunks: RankedChunk[]
  ): Promise<SourceMapping | null> {
    try {
      const sentenceEmbedding = await this.openaiService.generateEmbedding(sentence.text);
      let bestMatch: SourceMapping | null = null;
      let highestSimilarity = 0;

      for (const chunk of sourceChunks) {
        const chunkEmbedding = await this.openaiService.generateEmbedding(chunk.content);
        const similarity = this.calculateCosineSimilarity(sentenceEmbedding, chunkEmbedding);

        // 🛡️ ENHANCED: Stricter semantic threshold and additional validation
        if (similarity > highestSimilarity && similarity >= this.SEMANTIC_THRESHOLD) {
          // Additional validation: check for key concept overlap
          const conceptOverlap = this.calculateConceptOverlap(sentence.text, chunk.content);
          const adjustedSimilarity = similarity * (0.7 + 0.3 * conceptOverlap);

          if (adjustedSimilarity >= this.SEMANTIC_THRESHOLD) {
            highestSimilarity = adjustedSimilarity;

            // Extract citation information
            const citationInfo = this.extractCitationInfo(chunk);

            bestMatch = {
              sourceId: chunk.id,
              chunkId: chunk.id,
              matchType: 'semantic_similarity',
              matchText: sentence.text,
              sourceText: chunk.content,
              metadata: {
                ...chunk.metadata,
                ...citationInfo
              },
              confidence: adjustedSimilarity
            };

            console.log(`🔍 SEMANTIC: Chunk ${chunk.id} - Raw: ${similarity.toFixed(3)}, Adjusted: ${adjustedSimilarity.toFixed(3)}, Concept overlap: ${conceptOverlap.toFixed(3)}`);
          }
        }
      }

      return bestMatch;
    } catch (error) {
      console.warn('Semantic matching failed for sentence:', error);
      return null;
    }
  }

  /**
   * Find paraphrase matches using word overlap and synonyms
   */
  private async findParaphraseMatch(
    sentence: ParsedSentence,
    sourceChunks: RankedChunk[]
  ): Promise<SourceMapping | null> {
    const sentenceWords = new Set(
      sentence.tokens
        .filter(word => word.length > 3)
        .map(word => word.toLowerCase())
    );

    let bestMatch: SourceMapping | null = null;
    let highestSimilarity = 0;

    for (const chunk of sourceChunks) {
      const chunkWords = new Set(
        chunk.content.toLowerCase()
          .split(/\s+/)
          .filter(word => word.length > 3)
          .map(word => word.replace(/[^\w]/g, ''))
      );

      // Calculate Jaccard similarity
      const intersection = new Set([...sentenceWords].filter(x => chunkWords.has(x)));
      const union = new Set([...sentenceWords, ...chunkWords]);
      const jaccardSimilarity = intersection.size / union.size;

      // Boost similarity for educational keywords
      const educationalBoost = this.calculateEducationalKeywordBoost(sentenceWords, chunkWords);
      const adjustedSimilarity = jaccardSimilarity + educationalBoost;

      if (adjustedSimilarity > highestSimilarity && adjustedSimilarity > this.PARAPHRASE_THRESHOLD) {
        highestSimilarity = adjustedSimilarity;
        bestMatch = {
          sourceId: chunk.id,
          chunkId: chunk.id,
          matchType: 'paraphrase_match',
          matchText: sentence.text,
          sourceText: chunk.content,
          metadata: chunk.metadata,
          confidence: adjustedSimilarity
        };
      }
    }

    return bestMatch;
  }

  /**
   * Detect hallucination patterns in sentence
   */
  private async detectHallucination(sentence: ParsedSentence): Promise<HallucinationDetection> {
    const indicators: string[] = [];
    let highestSeverity = 'low';
    let matchedReason = null;

    for (const { pattern, reason, severity } of this.HALLUCINATION_PATTERNS) {
      if (pattern.test(sentence.text)) {
        indicators.push(reason);
        if (severity === 'high' || (severity === 'medium' && highestSeverity === 'low')) {
          highestSeverity = severity;
          matchedReason = reason;
        }
      }
    }

    const isLikelyHallucination = highestSeverity === 'high' || 
      (highestSeverity === 'medium' && indicators.length > 1);

    return {
      isLikelyHallucination,
      reason: matchedReason,
      confidence: isLikelyHallucination ? 0.8 : 0.9,
      indicators
    };
  }

  /**
   * Split text into parsed sentences
   */
  private splitIntoSentences(text: string): ParsedSentence[] {
    const sentences = text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    return sentences.map((sentence, index) => {
      const tokens = sentence.split(/\s+/).filter(t => t.length > 0);
      return {
        text: sentence,
        index,
        wordCount: tokens.length,
        tokens,
        isQuestion: sentence.includes('?'),
        isCitation: this.isCitationOnly(sentence),
        containsNumbers: /\d/.test(sentence)
      };
    });
  }

  /**
   * Check if sentence is citation only
   */
  private isCitationOnly(text: string): boolean {
    const citationPatterns = [
      /^\[.*\]$/,
      /^Chapter \d+/,
      /^Page \d+/,
      /^\(.*\)$/
    ];
    return citationPatterns.some(pattern => pattern.test(text.trim()));
  }

  /**
   * Normalize text for comparison
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Calculate exact similarity between normalized texts
   */
  private calculateExactSimilarity(text1: string, text2: string): number {
    if (text1 === text2)
  return 1.0;
    
    const words1 = text1.split(/\s+/);
    const words2 = text2.split(/\s+/);
    
    if (Math.abs(words1.length - words2.length) > 2)
  return 0;
    
    let matches = 0;
    const maxLength = Math.max(words1.length, words2.length);
    
    for (let i = 0; i < maxLength; i++) {
      if (words1[i] === words2[i]) matches++;
    }
    
    return matches / maxLength;
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
   * Calculate educational keyword boost
   */
  private calculateEducationalKeywordBoost(words1: Set<string>, words2: Set<string>): number {
    const educationalKeywords = new Set([
      'definition', 'explain', 'describe', 'process', 'method', 'theory',
      'concept', 'principle', 'example', 'characteristic', 'property',
      'function', 'structure', 'system', 'classification', 'category'
    ]);

    const educationalMatches = [...words1].filter(word => 
      educationalKeywords.has(word) && words2.has(word)
    ).length;

    return educationalMatches * 0.1; // 10% boost per educational keyword match
  }

  // Helper methods
  private extractMappedSources(verifiedSentences: VerifiedSentence[]): SourceMapping[] {
    return verifiedSentences.map(vs => vs.sourceMapping);
  }

  private async extractHallucinationIndicators(text: string): Promise<string[]> {
    const indicators: string[] = [];
    for (const { pattern, reason } of this.HALLUCINATION_PATTERNS) {
      if (pattern.test(text)) {
        indicators.push(reason);
      }
    }
    return indicators;
  }

  private async suggestFix(sentence: ParsedSentence, sourceChunks: RankedChunk[]): Promise<string> {
    // Find the most relevant chunk for suggestion
    const bestChunk = sourceChunks[0];
    if (bestChunk) {
      return `Consider using content from: "${bestChunk.content.substring(0, 100)}..."`;
    }
    return 'Remove sentence or find supporting textbook content';
  }

  private calculateVerificationMetrics(
    sentences: ParsedSentence[],
    verified: VerifiedSentence[],
    rejected: RejectedSentence[],
    processingTime: number
  ): VerificationMetrics {
    const exactMatches = verified.filter(v => v.exactMatch).length;
    const semanticMatches = verified.filter(v => v.verificationMethod === 'semantic_match').length;
    const paraphraseMatches = verified.filter(v => v.verificationMethod === 'paraphrase_match').length;
    const citationOnlyMatches = verified.filter(v => v.verificationMethod === 'citation_only').length;

    return {
      totalSentences: sentences.length,
      verifiedSentences: verified.length,
      rejectedSentences: rejected.length,
      exactMatches,
      semanticMatches,
      paraphraseMatches,
      citationOnlyMatches,
      averageConfidence: verified.reduce((sum, v) => sum + v.confidence, 0) / verified.length,
      processingTimeMs: processingTime
    };
  }

  // 🛡️ NEW: Enhanced verification methods for stricter matching

  /**
   * Extract citation information from chunk metadata
   */
  private extractCitationInfo(chunk: RankedChunk): any {
    return {
      chapter: chunk.metadata.chapter || 'Unknown Chapter',
      chapterTitle: chunk.metadata.chapterTitle || 'Unknown Title',
      page: chunk.metadata.page || 'Unknown Page',
      section: chunk.metadata.section || null,
        // @ts-ignore
      textbookTitle: chunk.metadata.textbookTitle || 'Textbook'
    };
  }

  /**
   * Extract matching context around found text
   */
  private extractMatchingContext(content: string, matchText: string, contextLength: number = 100): string {
    const index = content.toLowerCase().indexOf(matchText.toLowerCase());
    if (index === -1)
  return content.substring(0, Math.min(200, content.length));

    const start = Math.max(0, index - contextLength);
    const end = Math.min(content.length, index + matchText.length + contextLength);

    return content.substring(start, end);
  }

  /**
   * Find exact phrase matches with high precision
   */
  private findExactPhraseMatch(sentence: string, content: string): { confidence: number; matchedText: string } | null {
    const words = sentence.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (words.length < 3)
  return null; // Require at least 3 significant words

    const contentLower = content.toLowerCase();
    let bestMatch = { confidence: 0, matchedText: '' };

    // Check for consecutive word sequences
    for (let i = 0; i <= words.length - 3; i++) {
      const phrase = words.slice(i, i + 3).join(' ');
      if (contentLower.includes(phrase)) {
        const confidence = 0.95 + (0.05 * (words.length - 3) / words.length);
        if (confidence > bestMatch.confidence) {
          bestMatch = {
            confidence: Math.min(confidence, 1.0),
            matchedText: this.extractMatchingContext(content, phrase)
          };
        }
      }
    }

    return bestMatch.confidence >= this.EXACT_MATCH_THRESHOLD ? bestMatch : null;
  }

  /**
   * Calculate concept overlap between sentence and chunk
   */
  private calculateConceptOverlap(sentence: string, content: string): number {
    const sentenceWords = new Set(
      sentence.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3 && !this.isStopWord(word))
    );

    const contentWords = new Set(
      content.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3 && !this.isStopWord(word))
    );

    const intersection = new Set([...sentenceWords].filter(x => contentWords.has(x)));
    const union = new Set([...sentenceWords, ...contentWords]);

    return intersection.size / Math.max(sentenceWords.size, 1);
  }

  /**
   * Check if word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
      'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
      'can', 'shall', 'this', 'that', 'these', 'those', 'and', 'but', 'or', 'nor',
      'for', 'yet', 'so', 'in', 'on', 'at', 'by', 'with', 'from', 'to', 'of', 'as'
    ]);
    return stopWords.has(word.toLowerCase());
  }
}

// Additional interfaces
interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
