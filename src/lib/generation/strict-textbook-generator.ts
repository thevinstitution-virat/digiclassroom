/**
 * Strict Textbook Generator
 * 🎯 ABSOLUTE TEXTBOOK FIDELITY: Generates responses using ONLY textbook content with strict verification
 */

import { RankedChunk } from '../retrieval/hybrid-retrieval-engine';
import { UserContext } from '../retrieval/hybrid-retrieval-engine';
import { OpenAIService } from '../services/openai_service';
import { ServiceLifecycleManager } from '../services/service-lifecycle-manager';
// 🔍 SENTENCE-LEVEL VERIFICATION ENHANCEMENT: Granular fidelity verification
import { SentenceVerificationEngine, SentenceVerificationResult } from '../verification/sentence-verification-engine';
import { AccurateCitationGenerator, VerifiedCitation } from '../citations/accurate-citation-generator';

export interface ResponseConstraints {
  maxTokens: number;
  targetWordCount: number;
  allowedContentTypes: string[];
  strictCitation: boolean;
  format: ResponseFormat;
  minFidelityScore: number;
}

export type ResponseFormat = 
  | 'concise_definition'
  | 'factual_answer'
  | 'structured_explanation'
  | 'comparative_analysis'
  | 'general_response';

export interface StrictGenerationResult {
  response: string;
  sources: VerifiedCitation[];
  fidelityScore: number;
  generationMethod: 'strict_constrained' | 'no_sources_available' | 'regenerated_strict';
  verificationDetails: SentenceVerificationResult;
  wordCount: number;
  responseType: ResponseFormat;
  citationSummary: string;
}

export interface AccurateCitation {
  chunkId: string;
  chapter: number;
  chapterTitle: string;
  page: number;
  section?: string;
  exactText: string;
  citationFormat: string;
}

export interface SentenceVerificationResult {
  verifiedResponse: string;
  mappedSources: SourceMapping[];
  fidelityScore: number;
  totalSentences: number;
  verifiedSentences: number;
  failedSentences: FailedSentence[];
  verificationMethod: 'sentence_by_sentence' | 'chunk_mapping';
}

export interface SourceMapping {
  sentence: string;
  sourceChunkId: string;
  fidelityScore: number;
  verificationMethod: 'exact_match' | 'semantic_match' | 'paraphrase_match';
  confidence: number;
}

export interface FailedSentence {
  sentence: string;
  reason: string;
  suggestedFix?: string;
}

export class StrictTextbookGenerator {
  private openaiService: OpenAIService;
  // 🔍 SENTENCE-LEVEL VERIFICATION ENHANCEMENT: Advanced verification services
  private sentenceVerificationEngine: SentenceVerificationEngine;
  private accurateCitationGenerator: AccurateCitationGenerator;
  
  private readonly STRICT_GENERATION_PROMPT = `
You are a STRICT textbook-based educational assistant. You must follow these ABSOLUTE rules:

CONTENT RULES:
1. ONLY use information that appears EXACTLY in the provided source chunks
2. NEVER add external knowledge, explanations, or examples not in the sources
3. NEVER use phrases like "generally", "typically", "usually" that imply external knowledge
4. If the sources don't contain enough information, say "The textbook content provided doesn't contain sufficient information about [topic]"

FORMAT RULES:
5. For definition questions: Provide EXACTLY 50-100 words from the textbook
6. For explanation questions: Use ONLY sentences that can be mapped to source chunks
7. NEVER create placeholder citations like [Ch X, Pg Y] - only use specific citations

VERIFICATION:
8. Every sentence you write MUST be traceable to a specific source chunk
9. If you cannot find textbook content for any part of your response, omit that part
10. When in doubt, provide a shorter response that is 100% accurate rather than a longer response with any uncertainty

FORBIDDEN PHRASES:
- "Generally speaking"
- "Typically"
- "Usually"
- "In most cases"
- "It is commonly known"
- "As we know"
- "Obviously"
- Any phrase that implies knowledge beyond the sources
`;

  // Query classification patterns
  private readonly QUERY_CLASSIFICATION = {
    definition: [
      /what is|what are|define|definition of|meaning of/i,
      /explain the term|what does.*mean/i,
      /^define\s+/i
    ],
    factual: [
      /how many|when did|where is|who was|which/i,
      /list|name.*that|give.*examples/i,
      /what are the.*of/i
    ],
    explanation: [
      /why|how|explain|describe|discuss/i,
      /what causes|what happens when/i,
      /how does.*work/i
    ],
    comparison: [
      /difference between|compare|contrast|versus|vs/i,
      /similarities.*differences|how.*different/i,
      /distinguish between/i
    ]
  };

  constructor() {
    this.openaiService = OpenAIService.getInstance();
    // 🔍 SENTENCE-LEVEL VERIFICATION ENHANCEMENT: Initialize verification services
    this.sentenceVerificationEngine = new SentenceVerificationEngine();
    this.accurateCitationGenerator = new AccurateCitationGenerator();
  }

  /**
   * 🎯 MAIN GENERATION METHOD: Generate strictly textbook-based response
   * 🛡️ ENHANCED: Pre-validate non-empty chunks before generation
   */
  async generateStrictResponse(
    query: string,
    sourceChunks: RankedChunk[],
    userContext: UserContext
  ): Promise<StrictGenerationResult> {
    console.log('📚 Starting strict textbook response generation...');
    const startTime = Date.now();

    try {
      // 🛡️ ENHANCED: Pre-validate source chunks are non-empty and valid
      const validationResult = this.preValidateSourceChunks(sourceChunks, query);

      if (!validationResult.isValid) {
        console.log(`❌ CHUNK VALIDATION: ${validationResult.reason}`);
        return this.generateNoContentResponse(query, validationResult.reason, validationResult.details);
      }

      console.log(`✅ CHUNK VALIDATION: ${validationResult.validChunks} valid chunks found`);

      // Pre-filter chunks for strict relevance from validated chunks
      const strictlyRelevantChunks = await this.filterForStrictRelevance(
        validationResult.chunks,
        query
      );

      if (strictlyRelevantChunks.length === 0) {
        console.log('❌ RELEVANCE FILTER: No strictly relevant chunks after filtering');
        return this.generateNoContentResponse(
          query,
          'No relevant textbook content found for this query',
          {
            totalChunks: sourceChunks.length,
            validChunks: validationResult.validChunks,
            relevantChunks: 0,
            filteringStage: 'relevance_filtering'
          }
        );
      }

      console.log(`✅ RELEVANCE FILTER: ${strictlyRelevantChunks.length} strictly relevant chunks selected`);

      // 🛡️ ENHANCED: Final content quality validation
      const contentQualityCheck = this.validateContentQuality(strictlyRelevantChunks, query);

      if (!contentQualityCheck.isAcceptable) {
        console.log(`❌ CONTENT QUALITY: ${contentQualityCheck.reason}`);
        return this.generateNoContentResponse(
          query,
          'Textbook content quality insufficient for reliable response',
          contentQualityCheck.details
        );
      }

      console.log(`✅ CONTENT QUALITY: Content meets quality standards (score: ${contentQualityCheck.qualityScore})`);

      // Use quality-validated chunks for generation
      const finalChunks = contentQualityCheck.acceptableChunks;

      // Determine response type and constraints
      const responseConstraints = this.determineResponseConstraints(query, userContext);

      // Build strictly constrained prompt using quality-validated chunks
      const constrainedPrompt = await this.buildConstrainedPrompt(
        query,
        finalChunks,
        responseConstraints,
        userContext
      );

      // Generate with low temperature for consistency
      const generationOptions = {
        temperature: 0.1,
        max_tokens: responseConstraints.maxTokens,
        stop_sequences: ['</response>', 'External knowledge:', 'Generally,', 'Typically,'],
        frequency_penalty: 0.3,
        presence_penalty: 0.2
      };

      const response = await this.openaiService.generateChatCompletion({
        messages: [
          { role: 'system', content: 'You are a strict textbook content extractor. Only use information from the provided sources.' },
          { role: 'user', content: constrainedPrompt }
        ],
        temperature: generationOptions.temperature,
        maxTokens: generationOptions.max_tokens
      });

      const responseText = response.choices[0]?.message?.content || '';

      // 🔍 SENTENCE-LEVEL VERIFICATION ENHANCEMENT: Use advanced verification engine with validated chunks
      const verificationResult = await this.sentenceVerificationEngine.verifySentenceFidelity(
        responseText,
        finalChunks
      );

      // If fidelity is too low, regenerate with even stricter constraints
      if (verificationResult.fidelityScore < responseConstraints.minFidelityScore) {
        console.log('⚠️ Fidelity too low, regenerating with stricter constraints...');
        return await this.regenerateWithStricterConstraints(
          query,
          finalChunks,
          responseConstraints,
          userContext,
          verificationResult
        );
      }

      // 🔍 SENTENCE-LEVEL VERIFICATION ENHANCEMENT: Generate verified citations
      const verifiedCitations = await this.accurateCitationGenerator.generateVerifiedCitations(
        verificationResult.mappedSources
      );
      const citationSummary = this.accurateCitationGenerator.generateCitationSummary(verifiedCitations);

      const result: StrictGenerationResult = {
        response: verificationResult.verifiedResponse,
        sources: verifiedCitations,
        fidelityScore: verificationResult.fidelityScore,
        generationMethod: 'strict_constrained',
        verificationDetails: verificationResult,
        wordCount: this.countWords(verificationResult.verifiedResponse),
        responseType: responseConstraints.format,
        citationSummary
      };

      console.log(`📚 Strict generation completed: ${result.fidelityScore.toFixed(3)} fidelity, ${result.wordCount} words`);
      return result;

    } catch (error) {
      console.error('❌ Strict textbook generation failed:', error);
      throw new Error(`Strict generation failed: ${error.message}`);
    }
  }

  /**
   * Determine response constraints based on query type and context
   */
  private determineResponseConstraints(
    query: string,
    context: UserContext
  ): ResponseConstraints {
    const queryType = this.classifyQuery(query);

    switch (queryType) {
      case 'definition':
        return {
          maxTokens: 120,
          targetWordCount: 75, // 50-100 word range
          allowedContentTypes: ['micro_definition', 'concept_explanation'],
          strictCitation: true,
          format: 'concise_definition',
          minFidelityScore: 0.85
        };

      case 'factual':
        return {
          maxTokens: 200,
          targetWordCount: 150,
          allowedContentTypes: ['micro_fact', 'concept_explanation'],
          strictCitation: true,
          format: 'factual_answer',
          minFidelityScore: 0.80
        };

      case 'explanation':
        return {
          maxTokens: 400,
          targetWordCount: 300,
          allowedContentTypes: ['concept_explanation', 'contextual_bridge'],
          strictCitation: true,
          format: 'structured_explanation',
          minFidelityScore: 0.75
        };

      case 'comparison':
        return {
          maxTokens: 500,
          targetWordCount: 400,
          allowedContentTypes: ['concept_explanation', 'contextual_bridge'],
          strictCitation: true,
          format: 'comparative_analysis',
          minFidelityScore: 0.75
        };

      default:
        return {
          maxTokens: 300,
          targetWordCount: 250,
          allowedContentTypes: ['concept_explanation', 'contextual_bridge'],
          strictCitation: true,
          format: 'general_response',
          minFidelityScore: 0.70
        };
    }
  }

  /**
   * Build constrained prompt with strict textbook-only instructions
   */
  private async buildConstrainedPrompt(
    query: string,
    sourceChunks: RankedChunk[],
    constraints: ResponseConstraints,
    context: UserContext
  ): Promise<string> {
    const sourcesText = this.formatSourcesForPrompt(sourceChunks);
    const exampleResponse = await this.generateExampleResponse(constraints.format);

    return `${this.STRICT_GENERATION_PROMPT}

QUERY: ${query}
RESPONSE FORMAT: ${constraints.format}
TARGET LENGTH: ${constraints.targetWordCount} words
USER LEVEL: ${context.educationalLevel.grade}th grade, ${context.educationalLevel.board}

AVAILABLE TEXTBOOK SOURCES:
${sourcesText}

EXAMPLE RESPONSE FORMAT:
${exampleResponse}

Now provide your response following ALL rules above. Remember:
- Use ONLY information from the sources above
- Target ${constraints.targetWordCount} words for ${constraints.format}
- Every sentence must be mappable to a source chunk
- Use specific citations, not placeholders

RESPONSE:`;
  }

  /**
   * Format sources for prompt with clear structure
   */
  private formatSourcesForPrompt(chunks: RankedChunk[]): string {
    return chunks.map((chunk, index) => {
      const metadata = chunk.metadata;
      return `
SOURCE ${index + 1}:
Chapter: ${metadata.chapter} - ${metadata.chapterTitle}
${metadata.section ? `Section: ${metadata.section}` : ''}
Page: ${metadata.page}
Content: "${chunk.content}"
Type: ${chunk.type}
Reliability: ${(chunk.sourceReliability * 100).toFixed(0)}%
---`;
    }).join('\n');
  }

  /**
   * Generate example response based on format
   */
  private async generateExampleResponse(format: ResponseFormat): Promise<string> {
    const examples = {
      concise_definition: `
Example: "Monsoon is the seasonal wind system that brings heavy rainfall to India during summer months. According to the textbook (Chapter 4, Page 67), 'The monsoon winds carry moisture from the oceans and cause widespread precipitation across the Indian subcontinent from June to September.'"`,

      factual_answer: `
Example: "The textbook states that India has 28 states and 8 union territories (Chapter 1, Page 12). The largest state by area is Rajasthan, covering 342,239 square kilometers (Chapter 2, Page 34)."`,

      structured_explanation: `
Example: "The process occurs in three stages as described in the textbook:
1. First stage: [exact textbook content] (Chapter X, Page Y)
2. Second stage: [exact textbook content] (Chapter X, Page Z)
3. Final stage: [exact textbook content] (Chapter X, Page W)"`,

      comparative_analysis: `
Example: "The textbook distinguishes between these concepts:
Concept A: [exact definition from textbook] (Chapter X, Page Y)
Concept B: [exact definition from textbook] (Chapter X, Page Z)
Key difference: [exact comparison from textbook] (Chapter X, Page W)"`,

      general_response: `
Example: "According to the textbook, [exact information] (Chapter X, Page Y). This is further explained as [exact explanation] (Chapter X, Page Z)."`,
    };

    return examples[format] || examples.general_response;
  }

  /**
   * Verify sentence-level fidelity against source chunks
   */
  private async verifySentenceFidelity(
    generatedResponse: string,
    sourceChunks: RankedChunk[]
  ): Promise<SentenceVerificationResult> {
    console.log('🔍 Verifying sentence-level fidelity...');

    const sentences = this.extractSentences(generatedResponse);
    const mappedSources: SourceMapping[] = [];
    const failedSentences: FailedSentence[] = [];

    for (const sentence of sentences) {
      const mapping = await this.mapSentenceToSource(sentence, sourceChunks);
      
      if (mapping) {
        mappedSources.push(mapping);
      } else {
        failedSentences.push({
          sentence,
          reason: 'No matching source content found',
          suggestedFix: 'Remove sentence or find supporting textbook content'
        });
      }
    }

    const fidelityScore = mappedSources.length / Math.max(sentences.length, 1);
    const verifiedResponse = this.buildVerifiedResponse(mappedSources, failedSentences);

    return {
      verifiedResponse,
      mappedSources,
      fidelityScore,
      totalSentences: sentences.length,
      verifiedSentences: mappedSources.length,
      failedSentences,
      verificationMethod: 'sentence_by_sentence'
    };
  }

  /**
   * Regenerate with stricter constraints
   */
  private async regenerateWithStricterConstraints(
    query: string,
    sourceChunks: RankedChunk[],
    constraints: ResponseConstraints,
    userContext: UserContext,
    previousVerification: SentenceVerificationResult
  ): Promise<StrictGenerationResult> {
    console.log('🔄 Regenerating with stricter constraints...');

    // Use only the highest-fidelity chunks
    const highFidelityChunks = sourceChunks
      .filter(chunk => chunk.sourceReliability > 0.8)
      .slice(0, 3); // Use only top 3 most reliable chunks

    if (highFidelityChunks.length === 0) {
      return {
        response: `The available textbook content does not contain sufficient reliable information to answer "${query}". Please refer to the specific chapter or section that covers this topic.`,
        sources: [],
        fidelityScore: 0,
        generationMethod: 'no_sources_available',
        verificationDetails: previousVerification,
        wordCount: 0,
        responseType: constraints.format
      };
    }

    // Build ultra-strict prompt
    const ultraStrictPrompt = `
ULTRA-STRICT MODE: Use ONLY direct quotes from the sources below.

QUERY: ${query}
INSTRUCTION: Provide a response using ONLY direct quotes or very close paraphrases from the sources.

HIGH-FIDELITY SOURCES:
${this.formatSourcesForPrompt(highFidelityChunks)}

Response (use direct quotes only):`;

    const response = await this.openaiService.generateChatCompletion({
      messages: [
        { role: 'system', content: 'You are a strict textbook content extractor. Only use direct quotes from provided sources.' },
        { role: 'user', content: ultraStrictPrompt }
      ],
      temperature: 0.05, // Ultra-low temperature
      maxTokens: Math.min(constraints.maxTokens, 200), // Shorter response
    });

    const responseText = response.choices[0]?.message?.content || '';

    const verificationResult = await this.sentenceVerificationEngine.verifySentenceFidelity(
      responseText,
      highFidelityChunks
    );

    // Generate verified citations for regenerated content
    const verifiedCitations = await this.accurateCitationGenerator.generateVerifiedCitations(
      verificationResult.mappedSources
    );
    const citationSummary = this.accurateCitationGenerator.generateCitationSummary(verifiedCitations);

    return {
      response: verificationResult.verifiedResponse,
      sources: verifiedCitations,
      fidelityScore: verificationResult.fidelityScore,
      generationMethod: 'regenerated_strict',
      verificationDetails: verificationResult,
      wordCount: this.countWords(verificationResult.verifiedResponse),
      responseType: constraints.format,
      citationSummary
    };
  }

  // Helper methods
  private classifyQuery(query: string): 'definition' | 'factual' | 'explanation' | 'comparison' | 'general' {
    for (const [type, patterns] of Object.entries(this.QUERY_CLASSIFICATION)) {
      if (patterns.some(pattern => pattern.test(query))) {
        return type as any;
      }
    }
    return 'general';
  }

  private extractSentences(text: string): string[] {
    return text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 5);
  }

  private countWords(text: string): number {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  // Placeholder methods for implementation
  private async filterForStrictRelevance(chunks: RankedChunk[], query: string): Promise<RankedChunk[]> {
    // Filter chunks based on strict relevance criteria
    return chunks.filter(chunk => chunk.hybridScore > 0.5).slice(0, 5);
  }

  private async mapSentenceToSource(sentence: string, sourceChunks: RankedChunk[]): Promise<SourceMapping | null> {
    // Implementation would map sentence to source chunk
    // For now, return a placeholder
    if (sourceChunks.length > 0) {
      return {
        sentence,
        sourceChunkId: sourceChunks[0].id,
        fidelityScore: 0.8,
        verificationMethod: 'semantic_match',
        confidence: 0.8
      };
    }
    return null;
  }

  private buildVerifiedResponse(mappedSources: SourceMapping[], failedSentences: FailedSentence[]): string {
    // Build response from verified sentences only
    return mappedSources.map(mapping => mapping.sentence).join(' ');
  }

  private generateAccurateCitations(mappings: SourceMapping[], chunks: RankedChunk[]): AccurateCitation[] {
    return mappings.map(mapping => {
      const chunk = chunks.find(c => c.id === mapping.sourceChunkId);
      if (chunk) {
        return {
          chunkId: chunk.id,
          chapter: chunk.metadata.chapter,
          chapterTitle: chunk.metadata.chapterTitle,
          page: chunk.metadata.page,
          section: chunk.metadata.section,
          exactText: mapping.sentence,
          citationFormat: `Chapter ${chunk.metadata.chapter}, Page ${chunk.metadata.page}`
        };
      }
      return null;
    }).filter(Boolean) as AccurateCitation[];
  }

  // 🛡️ NEW: Comprehensive chunk validation methods

  /**
   * Pre-validate source chunks for non-empty content and basic quality
   */
  private preValidateSourceChunks(sourceChunks: RankedChunk[], query: string): ChunkValidationResult {
    console.log(`🔍 CHUNK VALIDATION: Validating ${sourceChunks.length} source chunks`);

    if (!sourceChunks || sourceChunks.length === 0) {
      return {
        isValid: false,
        reason: 'No source chunks provided',
        validChunks: 0,
        chunks: [],
        details: {
          totalChunks: 0,
          emptyChunks: 0,
          shortChunks: 0,
          validChunks: 0,
          averageLength: 0
        }
      };
    }

    const validChunks: RankedChunk[] = [];
    let emptyChunks = 0;
    let shortChunks = 0;
    let totalLength = 0;

    for (const chunk of sourceChunks) {
      // Check for empty or null content
      if (!chunk.content || chunk.content.trim().length === 0) {
        emptyChunks++;
        console.log(`⚠️ CHUNK VALIDATION: Empty chunk found (ID: ${chunk.id})`);
        continue;
      }

      // Check for minimum content length (at least 20 characters)
      if (chunk.content.trim().length < 20) {
        shortChunks++;
        console.log(`⚠️ CHUNK VALIDATION: Short chunk found (ID: ${chunk.id}, length: ${chunk.content.length})`);
        continue;
      }

      // Check for basic content quality
      if (this.isValidChunkContent(chunk.content)) {
        validChunks.push(chunk);
        totalLength += chunk.content.length;
      } else {
        console.log(`⚠️ CHUNK VALIDATION: Invalid content quality (ID: ${chunk.id})`);
      }
    }

    const averageLength = validChunks.length > 0 ? totalLength / validChunks.length : 0;

    console.log(`📊 CHUNK VALIDATION: ${validChunks.length}/${sourceChunks.length} chunks valid (avg length: ${averageLength.toFixed(0)})`);

    if (validChunks.length === 0) {
      return {
        isValid: false,
        reason: 'No valid chunks found - all chunks are empty, too short, or invalid',
        validChunks: 0,
        chunks: [],
        details: {
          totalChunks: sourceChunks.length,
          emptyChunks,
          shortChunks,
          validChunks: 0,
          averageLength: 0
        }
      };
    }

    // Require at least 1 valid chunk for basic queries, 2+ for complex queries
    const minRequiredChunks = this.isComplexQuery(query) ? 2 : 1;

    if (validChunks.length < minRequiredChunks) {
      return {
        isValid: false,
        reason: `Insufficient valid chunks (${validChunks.length} found, ${minRequiredChunks} required)`,
        validChunks: validChunks.length,
        chunks: validChunks,
        details: {
          totalChunks: sourceChunks.length,
          emptyChunks,
          shortChunks,
          validChunks: validChunks.length,
          averageLength
        }
      };
    }

    return {
      isValid: true,
      reason: 'Chunks validation passed',
      validChunks: validChunks.length,
      chunks: validChunks,
      details: {
        totalChunks: sourceChunks.length,
        emptyChunks,
        shortChunks,
        validChunks: validChunks.length,
        averageLength
      }
    };
  }

  /**
   * Validate content quality of chunks
   */
  private validateContentQuality(chunks: RankedChunk[], query: string): ContentQualityResult {
    console.log(`🔍 CONTENT QUALITY: Validating quality of ${chunks.length} chunks`);

    const acceptableChunks: RankedChunk[] = [];
    let totalQualityScore = 0;

    for (const chunk of chunks) {
      const qualityScore = this.calculateChunkQualityScore(chunk, query);

      if (qualityScore >= 0.6) { // Minimum quality threshold
        acceptableChunks.push(chunk);
        totalQualityScore += qualityScore;
        console.log(`✅ CONTENT QUALITY: Chunk ${chunk.id} accepted (score: ${qualityScore.toFixed(2)})`);
      } else {
        console.log(`❌ CONTENT QUALITY: Chunk ${chunk.id} rejected (score: ${qualityScore.toFixed(2)})`);
      }
    }

    const averageQuality = acceptableChunks.length > 0 ? totalQualityScore / acceptableChunks.length : 0;

    if (acceptableChunks.length === 0) {
      return {
        isAcceptable: false,
        reason: 'No chunks meet minimum quality standards',
        qualityScore: 0,
        acceptableChunks: [],
        details: {
          totalChunks: chunks.length,
          acceptableChunks: 0,
          averageQuality: 0,
          qualityThreshold: 0.6
        }
      };
    }

    // Require minimum average quality
    if (averageQuality < 0.7) {
      return {
        isAcceptable: false,
        reason: `Average content quality too low (${averageQuality.toFixed(2)} < 0.7)`,
        qualityScore: averageQuality,
        acceptableChunks: [],
        details: {
          totalChunks: chunks.length,
          acceptableChunks: acceptableChunks.length,
          averageQuality,
          qualityThreshold: 0.7
        }
      };
    }

    return {
      isAcceptable: true,
      reason: 'Content quality validation passed',
      qualityScore: averageQuality,
      acceptableChunks,
      details: {
        totalChunks: chunks.length,
        acceptableChunks: acceptableChunks.length,
        averageQuality,
        qualityThreshold: 0.7
      }
    };
  }

  /**
   * Generate standardized no-content response
   */
  private generateNoContentResponse(query: string, reason: string, details: any): StrictGenerationResult {
    const responseMessage = this.buildNoContentMessage(query, reason, details);

    return {
      response: responseMessage,
      sources: [],
      fidelityScore: 0,
      generationMethod: 'no_content_available',
      verificationDetails: {
        originalText: '',
        verifiedResponse: responseMessage,
        verifiedSentences: [],
        rejectedSentences: [],
        mappedSources: [],
        fidelityScore: 0,
        isAcceptable: false,
        verificationMetrics: {
          totalSentences: 0,
          verifiedSentences: 0,
          rejectedSentences: 0,
          exactMatches: 0,
          semanticMatches: 0,
          paraphraseMatches: 0,
          citationOnlyMatches: 0,
          averageConfidence: 0,
          processingTimeMs: 0
        }
      },
      wordCount: responseMessage.split(' ').length,
      responseType: 'no_content_response',
      citationSummary: 'No textbook sources available'
    };
  }

  /**
   * Build appropriate no-content message based on reason
   */
  private buildNoContentMessage(query: string, reason: string, details: any): string {
    const baseMessage = `I cannot find reliable information about "${query}" in the available textbook content.`;

    if (reason.includes('No source chunks')) {
      return `${baseMessage} No textbook content has been uploaded or indexed yet. Please upload relevant textbook materials first.`;
    }

    if (reason.includes('empty') || reason.includes('short')) {
      return `${baseMessage} The available content appears to be incomplete or corrupted. Please check the uploaded textbook materials.`;
    }

    if (reason.includes('quality')) {
      return `${baseMessage} The available content does not meet the quality standards required for a reliable response. Please ensure the textbook content is properly formatted and complete.`;
    }

    if (reason.includes('relevant')) {
      return `${baseMessage} This topic may not be covered in the uploaded textbook materials, or it might be in a different chapter or section. Please check the table of contents or try a more specific question.`;
    }

    return `${baseMessage} Please check if this topic is covered in the uploaded materials or try rephrasing your question.`;
  }

  // Helper methods for validation

  private isValidChunkContent(content: string): boolean {
    // Check for basic content validity
    const trimmed = content.trim();

    // Must have reasonable length
    if (trimmed.length < 20)
  return false;

    // Must contain some alphabetic characters
    if (!/[a-zA-Z]/.test(trimmed))
  return false;

    // Must not be mostly special characters or numbers
    const alphaRatio = (trimmed.match(/[a-zA-Z]/g) || []).length / trimmed.length;
    if (alphaRatio < 0.3)
  return false;

    return true;
  }

  private isComplexQuery(query: string): boolean {
    // Determine if query is complex and requires multiple sources
    const complexIndicators = [
      'compare', 'contrast', 'difference', 'relationship', 'analyze', 'explain why',
      'how does', 'what causes', 'multiple', 'various', 'different types'
    ];

    return complexIndicators.some(indicator =>
      query.toLowerCase().includes(indicator)
    );
  }

  private calculateChunkQualityScore(chunk: RankedChunk, query: string): number {
    let score = 0.5; // Base score

    // Content length factor
    const length = chunk.content.length;
    if (length > 100) score += 0.1;
    if (length > 300) score += 0.1;

    // Relevance score factor
    if (chunk.score && chunk.score > 0.7) score += 0.2;
    if (chunk.score && chunk.score > 0.8) score += 0.1;

    // Content structure factor
    if (chunk.content.includes('.') && chunk.content.split('.').length > 2) score += 0.1;

    return Math.min(score, 1.0);
  }
}

// 🛡️ NEW: Validation result interfaces

interface ChunkValidationResult {
  isValid: boolean;
  reason: string;
  validChunks: number;
  chunks: RankedChunk[];
  details: {
    totalChunks: number;
    emptyChunks: number;
    shortChunks: number;
    validChunks: number;
    averageLength: number;
  };
}

interface ContentQualityResult {
  isAcceptable: boolean;
  reason: string;
  qualityScore: number;
  acceptableChunks: RankedChunk[];
  details: {
    totalChunks: number;
    acceptableChunks: number;
    averageQuality: number;
    qualityThreshold: number;
  };
}
