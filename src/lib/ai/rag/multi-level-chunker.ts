/**
 * Multi-Level Chunker for RAG Pipeline
 * Implements 3-tier chunking strategy for optimal retrieval at different granularities
 *
 * Levels:
 * 1. Atomic (50-100 tokens): Single facts, definitions, formulas
 * 2. Paragraph (200-400 tokens): Complete concepts with context
 * 3. Section (800-1200 tokens): Full topics with comprehensive coverage
 *
 * Uses GPT-4o-mini for intelligent atomic fact extraction with enhanced educational content handling
 */

import { OpenAIService } from '@/lib/services/openai_service';

/**
 * Quality metrics for atomic fact extraction
 */
export interface AtomicFactQualityMetrics {
  totalFactsExtracted: number;
  avgFactLength: number;
  formulaPreservationRate: number;  // % of formulas preserved correctly
  numericalAccuracyRate: number;    // % of numbers preserved exactly
  contextCompletenessRate: number;  // % of facts with sufficient context
  jsonParseSuccessRate: number;     // % of successful JSON parsing
  extractionFailures: number;       // Number of failed extractions
  retryAttempts: number;            // Number of retry attempts
  fallbackUsed: number;             // Number of times fallback was used
}

/**
 * Options for atomic fact extraction
 */
export interface AtomicExtractionOptions {
  useEnhancedPrompt?: boolean;      // Use new educational-content-specific prompt (default: true)
  maxRetries?: number;               // Max retry attempts for malformed responses (default: 2)
  enableQualityMetrics?: boolean;   // Track quality metrics (default: true)
}

export interface ChunkLevel {
  level: 'atomic' | 'paragraph' | 'section';
  minTokens: number;
  maxTokens: number;
  description: string;
}

/**
 * Result of chunking operation with quality metrics
 */
export interface ChunkingResult {
  atomic: MultiLevelChunk[];
  paragraph: MultiLevelChunk[];
  section: MultiLevelChunk[];
  qualityMetrics?: AtomicFactQualityMetrics;
}

export const CHUNK_LEVELS: Record<string, ChunkLevel> = {
  atomic: {
    level: 'atomic',
    minTokens: 50,
    maxTokens: 100,
    description: 'Single facts, definitions, formulas'
  },
  paragraph: {
    level: 'paragraph',
    minTokens: 200,
    maxTokens: 400,
    description: 'Complete concepts with context'
  },
  section: {
    level: 'section',
    minTokens: 800,
    maxTokens: 1200,
    description: 'Full topics with comprehensive coverage'
  }
};

export interface MultiLevelChunk {
  id: string;
  text: string;
  level: 'atomic' | 'paragraph' | 'section';
  tokenCount: number;
  metadata: {
    parent_id?: string;
    children_ids?: string[];
    sibling_ids?: string[];
    section_title?: string;
    chunk_index: number;
    total_chunks: number;
    [key: string]: any;
  };
}

export interface ChunkingResultLegacy {
  atomic: MultiLevelChunk[];
  paragraph: MultiLevelChunk[];
  section: MultiLevelChunk[];
  hierarchy: ChunkHierarchy[];
}

export interface ChunkHierarchy {
  section_id: string;
  paragraph_ids: string[];
  atomic_ids: string[];
}

/**
 * Multi-Level Chunker
 */
export class MultiLevelChunker {
  private openaiService: OpenAIService;
  private qualityMetrics: AtomicFactQualityMetrics;

  constructor() {
    this.openaiService = new OpenAIService();
    this.resetQualityMetrics();
  }

  /**
   * Reset quality metrics
   */
  private resetQualityMetrics(): void {
    this.qualityMetrics = {
      totalFactsExtracted: 0,
      avgFactLength: 0,
      formulaPreservationRate: 0,
      numericalAccuracyRate: 0,
      contextCompletenessRate: 0,
      jsonParseSuccessRate: 0,
      extractionFailures: 0,
      retryAttempts: 0,
      fallbackUsed: 0
    };
  }

  /**
   * Get current quality metrics
   */
  public getQualityMetrics(): AtomicFactQualityMetrics {
    return { ...this.qualityMetrics };
  }

  /**
   * Estimate token count (rough approximation: 1 token ≈ 4 characters)
   */
  private estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Split text into sentences
   */
  private splitIntoSentences(text: string): string[] {
    // Split on sentence boundaries (., !, ?)
    return text
      .split(/(?<=[.!?])\s+/)
      .filter(s => s.trim().length > 0);
  }

  /**
   * Split text into paragraphs
   */
  private splitIntoParagraphs(text: string): string[] {
    // Split on double newlines or paragraph markers
    return text
      .split(/\n\n+/)
      .filter(p => p.trim().length > 0);
  }

  /**
   * Detect if text contains mathematical formulas or equations
   */
  private containsFormulas(text: string): boolean {
    // Check for common mathematical patterns
    const formulaPatterns = [
      /[a-z]\s*[²³⁴⁵⁶⁷⁸⁹⁰]/i,  // Superscripts (e.g., x², a³)
      /[a-z]\s*[₀₁₂₃₄₅₆₇₈₉]/i,  // Subscripts (e.g., H₂O)
      /[=≠<>≤≥±∓×÷√∑∏∫]/,       // Mathematical operators
      /\b\d+\s*[+\-*/=]\s*\d+/,  // Simple equations (e.g., 2 + 2 = 4)
      /[a-z]\s*[+\-*/=]\s*[a-z]/i, // Variable equations (e.g., a + b = c)
    ];
    return formulaPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Detect if text contains numerical data
   */
  private containsNumericalData(text: string): boolean {
    // Check for numbers with units or precision
    const numericalPatterns = [
      /\d+\.\d+/,                    // Decimal numbers
      /\d+\s*[a-zA-Z]+/,             // Numbers with units (e.g., 10 kg)
      /\d+\s*[°℃℉]/,                 // Temperature values
      /\d+\s*×\s*10\^?\d+/,          // Scientific notation
    ];
    return numericalPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Generate enhanced prompt for educational content
   */
  private generateEnhancedPrompt(text: string): string {
    return `You are an expert at extracting atomic facts from Indian educational textbooks (CBSE/ICSE, Classes 6-12).

TASK: Extract self-contained atomic facts from the text below.

REQUIREMENTS:
1. Each fact must be 50-100 tokens (1-2 sentences)
2. Preserve ALL mathematical formulas, equations, and symbols EXACTLY as written
3. Keep numerical values with full precision (e.g., "3.14159", not "approximately 3.14")
4. Maintain scientific terminology and technical terms verbatim
5. For multi-step processes, create separate facts for each step
6. Include context for pronouns (replace "it" with the actual subject)
7. Preserve units of measurement (e.g., "m/s", "kg", "°C")
8. For definitions, include the term being defined

EXAMPLES:
Input: "Photosynthesis is the process by which plants convert sunlight into energy. It occurs in chloroplasts."
Output:
[
  "Photosynthesis is the process by which plants convert sunlight into energy.",
  "Photosynthesis occurs in chloroplasts."
]

Input: "The Pythagorean theorem states that a² + b² = c², where c is the hypotenuse."
Output:
[
  "The Pythagorean theorem states that a² + b² = c², where a and b are the legs of a right triangle and c is the hypotenuse."
]

Input: "Water boils at 100°C at sea level. The boiling point decreases with altitude."
Output:
[
  "Water boils at 100°C at sea level.",
  "The boiling point of water decreases with altitude."
]

TEXT TO PROCESS:
${text}

OUTPUT FORMAT: Return ONLY a JSON array of strings. No explanations. No markdown formatting.`;
  }

  /**
   * Generate legacy prompt (for A/B testing)
   */
  private generateLegacyPrompt(text: string): string {
    return `Extract atomic facts from the following educational text. Each fact should be:
- A single, self-contained piece of information
- 50-100 tokens (1-2 sentences)
- Understandable on its own
- Preserve exact terminology and numbers

Text:
${text}

Return ONLY a JSON array of strings, each containing one atomic fact. Example:
["The Himalayas are the highest mountain range in the world.", "Mount Everest is 8,849 meters tall."]`;
  }

  /**
   * Parse JSON response with error handling
   */
  private parseFactsFromResponse(content: string): string[] | null {
    try {
      // Remove markdown code blocks if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/```\n?/g, '');
      }

      const facts = JSON.parse(cleanContent);
      return Array.isArray(facts) ? facts : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Validate extracted facts quality
   */
  private validateFactQuality(facts: string[], originalText: string): void {
    if (!facts || facts.length === 0) return;

    const hasFormulas = this.containsFormulas(originalText);
    const hasNumericalData = this.containsNumericalData(originalText);

    // Check formula preservation
    if (hasFormulas) {
      const formulasPreserved = facts.some(fact => this.containsFormulas(fact));
      if (formulasPreserved) {
        this.qualityMetrics.formulaPreservationRate++;
      }
    }

    // Check numerical accuracy
    if (hasNumericalData) {
      const numbersPreserved = facts.some(fact => this.containsNumericalData(fact));
      if (numbersPreserved) {
        this.qualityMetrics.numericalAccuracyRate++;
      }
    }

    // Check context completeness (facts should not start with pronouns)
    const pronounStarts = ['it ', 'this ', 'that ', 'these ', 'those ', 'they '];
    const completeContextFacts = facts.filter(fact => {
      const lowerFact = fact.toLowerCase();
      return !pronounStarts.some(pronoun => lowerFact.startsWith(pronoun));
    });
    if (completeContextFacts.length === facts.length) {
      this.qualityMetrics.contextCompletenessRate++;
    }

    // Update average fact length
    const totalLength = facts.reduce((sum, fact) => sum + this.estimateTokenCount(fact), 0);
    const currentAvg = this.qualityMetrics.avgFactLength;
    const currentTotal = this.qualityMetrics.totalFactsExtracted;
    this.qualityMetrics.avgFactLength =
      (currentAvg * currentTotal + totalLength) / (currentTotal + facts.length);
  }

  /**
   * Extract atomic facts using GPT-4o-mini with enhanced prompt and error handling
   */
  private async extractAtomicFacts(
    text: string,
    options: AtomicExtractionOptions = {}
  ): Promise<string[]> {
    const {
      useEnhancedPrompt = true,
      maxRetries = 2,
      enableQualityMetrics = true
    } = options;

    // Generate appropriate prompt
    const prompt = useEnhancedPrompt
      ? this.generateEnhancedPrompt(text)
      : this.generateLegacyPrompt(text);

    let lastError: any = null;

    // Retry loop
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          this.qualityMetrics.retryAttempts++;
          console.log(`🔄 Retry attempt ${attempt} for atomic fact extraction`);
        }

        const response = await this.openaiService.generateChatCompletion({
          messages: [
            {
              role: 'system',
              content: 'You are an expert at extracting atomic facts from educational content. Always return valid JSON arrays.'
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.1,
          maxTokens: 1500  // Increased from 1000 for longer texts
        });

        const content = response.message || '[]';
        const facts = this.parseFactsFromResponse(content);

        if (facts && facts.length > 0) {
          // Success - update metrics
          this.qualityMetrics.totalFactsExtracted += facts.length;
          this.qualityMetrics.jsonParseSuccessRate++;

          if (enableQualityMetrics) {
            this.validateFactQuality(facts, text);
          }

          console.log(`✅ Extracted ${facts.length} atomic facts (attempt ${attempt + 1})`);
          return facts;
        } else {
          throw new Error('Parsed result is not a valid array or is empty');
        }

      } catch (error) {
        lastError = error;
        console.error(`❌ Attempt ${attempt + 1} failed:`, error);

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
      }
    }

    // All retries failed - use fallback
    console.error('❌ All extraction attempts failed, using fallback:', lastError);
    this.qualityMetrics.extractionFailures++;
    this.qualityMetrics.fallbackUsed++;

    // Fallback: split by sentences
    const fallbackFacts = this.splitIntoSentences(text).slice(0, 5);
    this.qualityMetrics.totalFactsExtracted += fallbackFacts.length;

    return fallbackFacts;
  }

  /**
   * Create section-level chunks (800-1200 tokens)
   */
  private createSectionChunks(
    text: string,
    baseMetadata: any
  ): MultiLevelChunk[] {
    const paragraphs = this.splitIntoParagraphs(text);
    const chunks: MultiLevelChunk[] = [];
    let currentChunk = '';
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      const testChunk = currentChunk + (currentChunk ? '\n\n' : '') + paragraph;
      const tokenCount = this.estimateTokenCount(testChunk);

      if (tokenCount > CHUNK_LEVELS.section.maxTokens && currentChunk) {
        // Save current chunk
        chunks.push({
          id: `${baseMetadata.source || 'doc'}_section_${chunkIndex}`,
          text: currentChunk,
          level: 'section',
          tokenCount: this.estimateTokenCount(currentChunk),
          metadata: {
            ...baseMetadata,
            chunk_index: chunkIndex,
            total_chunks: 0, // Will be updated later
            sibling_ids: []
          }
        });
        chunkIndex++;
        currentChunk = paragraph;
      } else {
        currentChunk = testChunk;
      }
    }

    // Add last chunk
    if (currentChunk) {
      chunks.push({
        id: `${baseMetadata.source || 'doc'}_section_${chunkIndex}`,
        text: currentChunk,
        level: 'section',
        tokenCount: this.estimateTokenCount(currentChunk),
        metadata: {
          ...baseMetadata,
          chunk_index: chunkIndex,
          total_chunks: 0,
          sibling_ids: []
        }
      });
    }

    // Update total_chunks and sibling_ids
    chunks.forEach((chunk, idx) => {
      chunk.metadata.total_chunks = chunks.length;
      chunk.metadata.sibling_ids = chunks
        .filter((_, i) => i !== idx)
        .map(c => c.id);
    });

    return chunks;
  }

  /**
   * Create paragraph-level chunks (200-400 tokens)
   */
  private createParagraphChunks(
    sectionChunk: MultiLevelChunk
  ): MultiLevelChunk[] {
    const paragraphs = this.splitIntoParagraphs(sectionChunk.text);
    const chunks: MultiLevelChunk[] = [];
    let currentChunk = '';
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      const testChunk = currentChunk + (currentChunk ? '\n\n' : '') + paragraph;
      const tokenCount = this.estimateTokenCount(testChunk);

      if (tokenCount > CHUNK_LEVELS.paragraph.maxTokens && currentChunk) {
        // Save current chunk
        chunks.push({
          id: `${sectionChunk.id}_para_${chunkIndex}`,
          text: currentChunk,
          level: 'paragraph',
          tokenCount: this.estimateTokenCount(currentChunk),
          metadata: {
            ...sectionChunk.metadata,
            parent_id: sectionChunk.id,
            chunk_index: chunkIndex,
            total_chunks: 0,
            sibling_ids: []
          }
        });
        chunkIndex++;
        currentChunk = paragraph;
      } else {
        currentChunk = testChunk;
      }
    }

    // Add last chunk
    if (currentChunk) {
      chunks.push({
        id: `${sectionChunk.id}_para_${chunkIndex}`,
        text: currentChunk,
        level: 'paragraph',
        tokenCount: this.estimateTokenCount(currentChunk),
        metadata: {
          ...sectionChunk.metadata,
          parent_id: sectionChunk.id,
          chunk_index: chunkIndex,
          total_chunks: 0,
          sibling_ids: []
        }
      });
    }

    // Update total_chunks and sibling_ids
    chunks.forEach((chunk, idx) => {
      chunk.metadata.total_chunks = chunks.length;
      chunk.metadata.sibling_ids = chunks
        .filter((_, i) => i !== idx)
        .map(c => c.id);
    });

    return chunks;
  }

  /**
   * Create atomic-level chunks (50-100 tokens)
   */
  private async createAtomicChunks(
    paragraphChunk: MultiLevelChunk,
    useGPT: boolean = true,
    extractionOptions: AtomicExtractionOptions = {}
  ): Promise<MultiLevelChunk[]> {
    let facts: string[];

    if (useGPT) {
      // Use GPT-4o-mini for intelligent fact extraction with enhanced prompt
      facts = await this.extractAtomicFacts(paragraphChunk.text, extractionOptions);
    } else {
      // Fallback: split by sentences
      facts = this.splitIntoSentences(paragraphChunk.text);
    }

    return facts.map((fact, idx) => ({
      id: `${paragraphChunk.id}_atomic_${idx}`,
      text: fact,
      level: 'atomic' as const,
      tokenCount: this.estimateTokenCount(fact),
      metadata: {
        ...paragraphChunk.metadata,
        parent_id: paragraphChunk.id,
        chunk_index: idx,
        total_chunks: facts.length,
        sibling_ids: facts
          .map((_, i) => `${paragraphChunk.id}_atomic_${i}`)
          .filter((_, i) => i !== idx)
      }
    }));
  }

  /**
   * Chunk text into all 3 levels with hierarchical relationships
   */
  async chunkText(
    text: string,
    metadata: any = {},
    options: {
      useGPTForAtomic?: boolean;
      useEnhancedPrompt?: boolean;
      maxRetries?: number;
      enableQualityMetrics?: boolean;
    } = {}
  ): Promise<ChunkingResult> {
    console.log('📚 Starting multi-level chunking...');

    // Reset quality metrics for this chunking operation
    this.resetQualityMetrics();

    // Extract atomic extraction options
    const extractionOptions: AtomicExtractionOptions = {
      useEnhancedPrompt: options.useEnhancedPrompt ?? true,
      maxRetries: options.maxRetries ?? 2,
      enableQualityMetrics: options.enableQualityMetrics ?? true
    };

    // 1. Create section-level chunks
    const sectionChunks = this.createSectionChunks(text, metadata);
    console.log(`📄 Created ${sectionChunks.length} section chunks`);

    // 2. Create paragraph-level chunks from each section
    const paragraphChunks: MultiLevelChunk[] = [];
    for (const section of sectionChunks) {
      const paras = this.createParagraphChunks(section);
      paragraphChunks.push(...paras);

      // Update section's children_ids
      section.metadata.children_ids = paras.map(p => p.id);
    }
    console.log(`📝 Created ${paragraphChunks.length} paragraph chunks`);

    // 3. Create atomic-level chunks from each paragraph
    const atomicChunks: MultiLevelChunk[] = [];
    for (const paragraph of paragraphChunks) {
      const atoms = await this.createAtomicChunks(
        paragraph,
        options.useGPTForAtomic ?? true,
        extractionOptions
      );
      atomicChunks.push(...atoms);

      // Update paragraph's children_ids
      paragraph.metadata.children_ids = atoms.map(a => a.id);
    }
    console.log(`⚛️  Created ${atomicChunks.length} atomic chunks`);

    // 4. Build hierarchy
    const hierarchy: ChunkHierarchy[] = sectionChunks.map(section => ({
      section_id: section.id,
      paragraph_ids: section.metadata.children_ids || [],
      atomic_ids: paragraphChunks
        .filter(p => p.metadata.parent_id === section.id)
        .flatMap(p => p.metadata.children_ids || [])
    }));

    // 5. Calculate final quality metrics percentages
    const finalMetrics = this.calculateFinalMetrics(paragraphChunks.length);

    // Log quality metrics
    if (extractionOptions.enableQualityMetrics) {
      this.logQualityMetrics(finalMetrics);
    }

    return {
      atomic: atomicChunks,
      paragraph: paragraphChunks,
      section: sectionChunks,
      qualityMetrics: finalMetrics
    };
  }

  /**
   * Calculate final quality metrics as percentages
   */
  private calculateFinalMetrics(totalParagraphs: number): AtomicFactQualityMetrics {
    const metrics = { ...this.qualityMetrics };

    if (totalParagraphs > 0) {
      // Convert counts to percentages
      metrics.formulaPreservationRate = (metrics.formulaPreservationRate / totalParagraphs) * 100;
      metrics.numericalAccuracyRate = (metrics.numericalAccuracyRate / totalParagraphs) * 100;
      metrics.contextCompletenessRate = (metrics.contextCompletenessRate / totalParagraphs) * 100;
      metrics.jsonParseSuccessRate = (metrics.jsonParseSuccessRate / totalParagraphs) * 100;
    }

    return metrics;
  }

  /**
   * Log quality metrics to console
   */
  private logQualityMetrics(metrics: AtomicFactQualityMetrics): void {
    console.log('\n📊 Atomic Fact Extraction Quality Metrics:');
    console.log(`   ✅ Total Facts Extracted: ${metrics.totalFactsExtracted}`);
    console.log(`   📏 Average Fact Length: ${metrics.avgFactLength.toFixed(1)} tokens`);
    console.log(`   🔢 Formula Preservation Rate: ${metrics.formulaPreservationRate.toFixed(1)}%`);
    console.log(`   🔢 Numerical Accuracy Rate: ${metrics.numericalAccuracyRate.toFixed(1)}%`);
    console.log(`   📝 Context Completeness Rate: ${metrics.contextCompletenessRate.toFixed(1)}%`);
    console.log(`   ✅ JSON Parse Success Rate: ${metrics.jsonParseSuccessRate.toFixed(1)}%`);

    if (metrics.extractionFailures > 0) {
      console.log(`   ⚠️  Extraction Failures: ${metrics.extractionFailures}`);
    }
    if (metrics.retryAttempts > 0) {
      console.log(`   🔄 Retry Attempts: ${metrics.retryAttempts}`);
    }
    if (metrics.fallbackUsed > 0) {
      console.log(`   ⚠️  Fallback Used: ${metrics.fallbackUsed} times`);
    }
    console.log('');
  }
}

// Export singleton instance
export const multiLevelChunker = new MultiLevelChunker();

