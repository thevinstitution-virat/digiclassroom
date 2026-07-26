/**
 * GPT-4-Based Chapter Validation Service
 *
 * Validates and corrects chapter extraction results using GPT-4o-mini
 * to improve chapter extraction confidence from 75% to 90%
 *
 * Features:
 * - Uses GPT-4o-mini to verify chapter extraction accuracy
 * - Corrects malformed chapter names
 * - Provides confidence scores (0-1)
 * - Caches validation results to avoid redundant API calls
 * - Handles edge cases (missing chapters, incorrect extraction)
 */

import { OpenAIService } from '@/lib/services/openai_service';

export interface ChapterValidationInput {
  extractedChapter: string;
  textSample: string; // First 500 chars of chunk
  bookTitle?: string;
  subject?: string;
  classLevel?: string;
}

export interface ChapterValidationResult {
  isValid: boolean;
  correctedChapter: string;
  confidence: number; // 0-1
  reasoning: string;
  validationMethod: 'gpt4' | 'cache' | 'fallback';
}

interface CacheEntry {
  result: ChapterValidationResult;
  timestamp: number;
}

/**
 * Chapter Validator Service
 * Singleton pattern for efficient caching and API usage
 */
export class ChapterValidator {
  private static instance: ChapterValidator;
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_CACHE_SIZE = 1000;

  private constructor() {}

  static getInstance(): ChapterValidator {
    if (!ChapterValidator.instance) {
      ChapterValidator.instance = new ChapterValidator();
    }
    return ChapterValidator.instance;
  }

  /**
   * Validate and correct chapter extraction
   */
  async validateChapter(input: ChapterValidationInput): Promise<ChapterValidationResult> {
    // Generate cache key
    const cacheKey = this.generateCacheKey(input);

    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    // Validate using GPT-4o-mini
    const result = await this.validateWithGPT4(input);

    // Cache the result
    this.addToCache(cacheKey, result);

    return result;
  }

  /**
   * Validate chapter using GPT-4o-mini
   */
  private async validateWithGPT4(input: ChapterValidationInput): Promise<ChapterValidationResult> {
    try {
      const prompt = this.buildValidationPrompt(input);

      const openAIService = OpenAIService.getInstance();

      // Use generateChatCompletion with JSON mode
      const systemPrompt = `You are an expert at analyzing NCERT textbook content and validating chapter extraction.
Your task is to verify if the extracted chapter name is correct based on the text sample.

Return a JSON object with this exact structure:
{
  "isValid": boolean,
  "correctedChapter": "Chapter X: Correct Title",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation"
}

Rules:
1. Chapter names should follow format: "Chapter X: Title" or "Chapter X"
2. Validate that the chapter number and title match the text content
3. Correct malformed chapter names (e.g., "Chapter 1947: there were..." → "Chapter 1: India After Independence")
4. Use book title and subject as context clues
5. Confidence should be 0.9+ for clear matches, 0.7-0.9 for likely matches, <0.7 for uncertain
6. If no chapter is found, return "General Chapter" with low confidence`;

      const response = await openAIService.generateChatCompletion({
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: prompt + '\n\nRespond with valid JSON only.'
          }
        ],
        temperature: 0.1, // Low temperature for consistent validation
        maxTokens: 300
      });

      const content = response.text;
      if (!content) {
        return this.getFallbackResult(input);
      }

      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```\n?/g, '').trim();
      }

      const parsed = JSON.parse(jsonStr);

      return {
        isValid: parsed.isValid ?? false,
        correctedChapter: parsed.correctedChapter || input.extractedChapter,
        confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.5)),
        reasoning: parsed.reasoning || 'GPT-4 validation completed',
        validationMethod: 'gpt4'
      };

    } catch (error: any) {
      const msg = error?.status === 402 || error?.message?.includes('402') ? '402 Insufficient Balance' : (error?.message || String(error));
      console.warn(`⚠️ Chapter validation fallback triggered: ${msg}`);
      return this.getFallbackResult(input);
    }
  }

  /**
   * Build validation prompt
   */
  private buildValidationPrompt(input: ChapterValidationInput): string {
    const parts = [
      `**Extracted Chapter:** "${input.extractedChapter}"`,
      ``,
      `**Text Sample (first 500 chars):**`,
      `${input.textSample}`,
      ``
    ];

    if (input.bookTitle) {
      parts.push(`**Book Title:** ${input.bookTitle}`);
    }

    if (input.subject) {
      parts.push(`**Subject:** ${input.subject}`);
    }

    if (input.classLevel) {
      parts.push(`**Class:** ${input.classLevel}`);
    }

    parts.push(``);
    parts.push(`Validate if the extracted chapter name is correct. If not, provide the corrected chapter name.`);

    return parts.join('\n');
  }

  /**
   * Get fallback result when GPT-4 validation fails
   */
  private getFallbackResult(input: ChapterValidationInput): ChapterValidationResult {
    // Simple heuristic validation
    const chapter = input.extractedChapter;
    
    // Check if chapter follows standard format
    const isStandardFormat = /^Chapter\s+\d{1,2}(?::\s*.+)?$/i.test(chapter);
    
    // Check if chapter appears in text sample
    const appearsInText = input.textSample.toLowerCase().includes(chapter.toLowerCase().substring(0, 20));

    return {
      isValid: isStandardFormat && appearsInText,
      correctedChapter: chapter,
      confidence: isStandardFormat ? 0.6 : 0.4,
      reasoning: 'Fallback validation (GPT-4 unavailable)',
      validationMethod: 'fallback'
    };
  }

  /**
   * Generate cache key from input
   */
  private generateCacheKey(input: ChapterValidationInput): string {
    // Use first 100 chars of text sample for cache key
    const textKey = input.textSample.substring(0, 100).replace(/\s+/g, ' ').trim();
    return `${input.extractedChapter}|${textKey}|${input.bookTitle || ''}`;
  }

  /**
   * Get result from cache
   */
  private getFromCache(key: string): ChapterValidationResult | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if cache entry is expired
    const now = Date.now();
    if (now - entry.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }

    // Return cached result with updated validation method
    return {
      ...entry.result,
      validationMethod: 'cache'
    };
  }

  /**
   * Add result to cache
   */
  private addToCache(key: string, result: ChapterValidationResult): void {
    // Enforce cache size limit (LRU-style)
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      result,
      timestamp: Date.now()
    });
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; ttl: number } {
    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      ttl: this.CACHE_TTL
    };
  }
}

// Export singleton instance
export const chapterValidator = ChapterValidator.getInstance();

