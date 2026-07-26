import { logger } from '@/lib/logger';

/**
 * Enhanced Key Terms Extractor for DigiClassroom Pro AI Tutor
 * Extracts key terms from answer and enriches them with definitions from NCERT chunks
 */

import { OpenAIService } from '@/lib/services/openai_service';

export interface EnhancedKeyTerm {
  term: string;
  definition: string;
  source?: string;
}

export interface KeyTermsRequest {
  answer: string;
  chunks: Array<{
    text: string;
    metadata?: {
      subject?: string;
      class?: string;
      chapter?: string;
      page?: number;
    };
  }>;
  metadata: {
    subject: string;
    class: string;
    chapter?: string;
  };
}

export class KeyTermsEnhancer {
  private openai: OpenAIService;

  constructor() {
    this.openai = OpenAIService.getInstance();
  }

  /**
   * Extract and enhance key terms with definitions from NCERT chunks
   */
  async extractEnhancedKeyTerms(request: KeyTermsRequest): Promise<EnhancedKeyTerm[]> {
    try {
      logger.info(`📚 [KeyTerms] Extracting enhanced key terms...`);

      // Step 1: Extract key terms from answer
      const keyTerms = await this.extractKeyTerms(request.answer);

      if (keyTerms.length === 0) {
        logger.info(`⚠️ [KeyTerms] No key terms found in answer`);
        return [];
      }

        // @ts-ignore
      logger.info({ data: keyTerms }, `📚 [KeyTerms] Found ${keyTerms.length} key terms:`);

      // Step 2: Find definitions in chunks
      const enhancedTerms: EnhancedKeyTerm[] = [];

      for (const term of keyTerms) {
        const definition = this.findDefinitionInChunks(term, request.chunks);
        
        if (definition) {
          enhancedTerms.push({
            term,
            definition,
            source: this.getSource(request.chunks[0], request.metadata)
          });
        } else {
          // If no definition found in chunks, extract from answer
          const answerDefinition = this.extractDefinitionFromAnswer(term, request.answer);
          if (answerDefinition) {
            enhancedTerms.push({
              term,
              definition: answerDefinition,
              source: this.getSource(request.chunks[0], request.metadata)
            });
          }
        }
      }

      logger.info(`✅ [KeyTerms] Enhanced ${enhancedTerms.length} key terms with definitions`);

      return enhancedTerms.slice(0, 8); // Limit to top 8 terms

    } catch (error) {
        // @ts-ignore
      logger.error({ error: error }, '❌ [KeyTerms] Enhancement error:');
      return [];
    }
  }

  /**
   * Extract key terms from answer using LLM
   */
  private async extractKeyTerms(answer: string): Promise<string[]> {
    try {
      const prompt = `Extract the most important key terms/concepts from this NCERT textbook answer.

RULES:
1. Extract ONLY terms that are explicitly mentioned in the answer
2. Focus on subject-specific terminology, not common words
3. Return 5-8 most important terms
4. Return as a comma-separated list

Answer:
${answer}

Format: term1, term2, term3, ...`;

      const response = await this.openai.generateChatCompletion({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        maxTokens: 150
      });

      const terms = response
        // @ts-ignore
        .trim()
        .split(',')
        // @ts-ignore
        .map(t => t.trim())
        // @ts-ignore
        .filter(t => t.length > 0 && t.length < 50); // Filter out invalid terms

      return terms;

    } catch (error) {
        // @ts-ignore
      logger.error({ error: error }, '❌ [KeyTerms] Extraction error:');
      // Fallback: Extract bold terms from answer
      return this.extractBoldTerms(answer);
    }
  }

  /**
   * Fallback: Extract bold terms from answer
   */
  private extractBoldTerms(answer: string): string[] {
    const boldRegex = /\*\*([^*]+)\*\*/g;
    const matches = answer.match(boldRegex) || [];
    
    return matches
      .map(match => match.replace(/\*\*/g, '').trim())
      .filter(term => term.length > 3 && term.length < 50)
      .slice(0, 8);
  }

  /**
   * Find definition for a term in NCERT chunks
   */
  private findDefinitionInChunks(term: string, chunks: any[]): string | null {
    const termLower = term.toLowerCase();

    for (const chunk of chunks) {
      const text = chunk.text;
      const textLower = text.toLowerCase();

      // Look for definition patterns
      const patterns = [
        new RegExp(`${this.escapeRegex(termLower)}\\s+(?:is|are|refers to|means|is defined as)\\s+([^.!?]+[.!?])`, 'i'),
        new RegExp(`${this.escapeRegex(termLower)}[:\\-]\\s+([^.!?]+[.!?])`, 'i'),
        new RegExp(`(?:The|A|An)\\s+${this.escapeRegex(termLower)}\\s+(?:is|are)\\s+([^.!?]+[.!?])`, 'i')
      ];

      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          return match[1].trim();
        }
      }
    }

    return null;
  }

  /**
   * Extract definition from answer if not found in chunks
   */
  private extractDefinitionFromAnswer(term: string, answer: string): string | null {
    const termLower = term.toLowerCase();
    const sentences = answer.split(/[.!?]+/).filter(s => s.trim().length > 20);

    // Find sentence containing the term
    for (const sentence of sentences) {
      if (sentence.toLowerCase().includes(termLower)) {
        // Check if it's a definition sentence
        if (/(?:is|are|refers to|means|is defined as)/i.test(sentence)) {
          return sentence.trim() + '.';
        }
      }
    }

    // If no definition found, return first sentence containing the term
    for (const sentence of sentences) {
      if (sentence.toLowerCase().includes(termLower)) {
        return sentence.trim() + '.';
      }
    }

    return null;
  }

  /**
   * Get source citation
   */
  private getSource(chunk: any, metadata: any): string {
    if (chunk?.metadata?.page) {
      return `NCERT Class ${metadata.class} ${metadata.subject}, Page ${chunk.metadata.page}`;
    }
    return `NCERT Class ${metadata.class} ${metadata.subject}${metadata.chapter ? `, Chapter: ${metadata.chapter}` : ''}`;
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

