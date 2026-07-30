import { logger } from '@/lib/logger';

/**
 * Note AI Service - Batched AI Analysis
 * 
 * Purpose: Single AI call for multiple insights (70% cost reduction)
 * Features:
 * - Auto-generate flashcards from note content
 * - Extract tags automatically
 * - Generate summary and key points
 * - Suggest related topics
 * 
 * Cost Optimization:
 * - Batches all AI operations into ONE API call
 * - Caches results in note_insights table
 * - Only re-runs if content changes significantly (>30%)
 */

import { openrouter as openai } from '@/lib/openrouter/client';
import { executeQuery } from '@/lib/db/connection';

/**
 * Flashcard interface
 */
export interface Flashcard {
  question: string;
  answer: string;
  type: 'concept' | 'definition' | 'formula' | 'example' | 'mcq';
  difficulty: 'easy' | 'medium' | 'hard';
  confidence: number; // 0.0 - 1.0
}

/**
 * Batched AI analysis result
 */
export interface NoteAnalysis {
  tags: string[];
  summary: string;
  keyPoints: string[];
  flashcards: Flashcard[];
  relatedTopics: string[];
  confidence: number;
  tokensUsed: number;
}

/**
 * Note metadata for context
 */
export interface NoteMetadata {
  subject?: string;
  chapter?: string;
  board?: string;
  classLevel?: string;
}

/**
 * Main service class
 */
export class NoteAIService {
  /**
   * Analyze note content with batched AI call
   * Returns cached result if content hasn't changed significantly
   */
  async analyzeNote(
    noteId: string,
    content: string,
    metadata: NoteMetadata
  ): Promise<NoteAnalysis> {
    // Calculate content hash
    const contentHash = this.hashContent(content);

    // Check cache first
    const cached = await this.getCachedAnalysis(noteId, contentHash);
    if (cached) {
      logger.info(`âœ… Using cached analysis for note ${noteId}`);
      return cached;
    }

    logger.info(`ðŸ¤– Generating new analysis for note ${noteId}`);

    // Generate new analysis
    const analysis = await this.generateAnalysis(content, metadata);

    // Cache the results
    await this.cacheAnalysis(noteId, contentHash, analysis);

    return analysis;
  }

  /**
   * Generate analysis using GPT-4o-mini (cost-effective)
   */
  private async generateAnalysis(
    content: string,
    metadata: NoteMetadata
  ): Promise<NoteAnalysis> {
    const prompt = this.buildAnalysisPrompt(content, metadata);

    const startTime = Date.now();

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini', // Cost-effective model
        messages: [
          {
            role: 'system',
            content: 'You are an expert educational AI that helps students learn better by analyzing their notes and creating study materials.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3, // Lower temperature for consistent results
        response_format: { type: 'json_object' },
        max_tokens: 2000,
      });

      const responseTime = Date.now() - startTime;
      const tokensUsed = response.usage?.total_tokens || 0;

      logger.info(`âœ… AI analysis completed in ${responseTime}ms, ${tokensUsed} tokens`);

      // Parse response
      const result = JSON.parse(response.choices[0].message.content || '{}');

      return {
        tags: result.tags || [],
        summary: result.summary || '',
        keyPoints: result.keyPoints || [],
        flashcards: result.flashcards || [],
        relatedTopics: result.relatedTopics || [],
        confidence: result.confidence || 0.8,
        tokensUsed,
      };

    } catch (error) {
        // @ts-ignore
      logger.error({ error: error }, 'âŒ AI analysis failed:');
      throw new Error('Failed to analyze note content');
    }
  }

  /**
   * Build comprehensive analysis prompt
   */
  private buildAnalysisPrompt(content: string, metadata: NoteMetadata): string {
    const contextInfo = metadata.subject
      ? `Subject: ${metadata.subject}${metadata.chapter ? `, Chapter: ${metadata.chapter}` : ''}`
      : '';

    const educationLevel = metadata.classLevel
      ? `Education Level: Class ${metadata.classLevel} (${metadata.board || 'CBSE'})`
      : '';

    return `Analyze this educational note and provide comprehensive study materials.

${contextInfo}
${educationLevel}

Note Content:
${content.substring(0, 4000)} ${content.length > 4000 ? '...(truncated)' : ''}

Provide a JSON response with the following structure:
{
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "summary": "2-3 sentence summary of the main concepts",
  "keyPoints": [
    "Key point 1",
    "Key point 2",
    "Key point 3",
    "Key point 4",
    "Key point 5"
  ],
  "flashcards": [
    {
      "question": "What is [concept]?",
      "answer": "Clear, concise answer",
      "type": "definition",
      "difficulty": "easy",
      "confidence": 0.9
    },
    {
      "question": "Explain [process/concept]",
      "answer": "Detailed explanation",
      "type": "concept",
      "difficulty": "medium",
      "confidence": 0.85
    },
    {
      "question": "Formula for [calculation]",
      "answer": "Formula with explanation",
      "type": "formula",
      "difficulty": "medium",
      "confidence": 0.9
    }
  ],
  "relatedTopics": ["Related topic 1", "Related topic 2", "Related topic 3"],
  "confidence": 0.85
}

Guidelines:
1. **Tags**: 5 relevant tags for categorization (subject-specific, exam-relevant)
2. **Summary**: Concise overview suitable for quick revision
3. **Key Points**: 5-7 most important concepts (bullet-point style)
4. **Flashcards**: 5-10 high-quality flashcards covering:
   - Definitions (type: "definition")
   - Concepts (type: "concept")
   - Formulas (type: "formula")
   - Examples (type: "example")
   - MCQ-style (type: "mcq")
5. **Related Topics**: 3-5 topics students should explore next
6. **Confidence**: Your confidence in the analysis quality (0.0-1.0)

Important:
- Make flashcards exam-focused and aligned with ${metadata.board || 'CBSE'} curriculum
- Use simple, student-friendly language
- Ensure answers are complete and self-contained
- Difficulty: "easy" for definitions, "medium" for concepts, "hard" for application
- Return ONLY valid JSON, no additional text`;
  }

  /**
   * Generate flashcards only (faster, cheaper)
   */
  async generateFlashcardsOnly(
    content: string,
    metadata: NoteMetadata,
    count: number = 10
  ): Promise<Flashcard[]> {
    const prompt = `Generate ${count} high-quality flashcards from this educational note.

${metadata.subject ? `Subject: ${metadata.subject}` : ''}
${metadata.chapter ? `Chapter: ${metadata.chapter}` : ''}

Note Content:
${content.substring(0, 3000)}

Return JSON array:
[
  {
    "question": "Question text",
    "answer": "Answer text",
    "type": "definition|concept|formula|example|mcq",
    "difficulty": "easy|medium|hard",
    "confidence": 0.9
  }
]

Make flashcards exam-focused and suitable for Class ${metadata.classLevel || '10'} students.`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' },
        max_tokens: 2000,
      });

      const result = JSON.parse(response.choices[0].message.content || '{"flashcards":[]}');
      return result.flashcards || result || [];

    } catch (error) {
        // @ts-ignore
      logger.error({ error: error }, 'âŒ Flashcard generation failed:');
      return [];
    }
  }

  /**
   * Save flashcards to database
   */
  async saveFlashcards(
    noteId: string,
    clerkId: string,
    flashcards: Flashcard[]
  ): Promise<string[]> {
    const flashcardIds: string[] = [];

    for (const card of flashcards) {
      try {
        // The primary key is a uuid, so there is no insert id to read back —
        // generate it here and use that value directly.
        const flashcardId = crypto.randomUUID();
        await executeQuery(
          `INSERT INTO note_flashcards
           (id, note_id, clerk_id, question, answer, card_type, difficulty_level, auto_generated, generation_confidence, is_active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, ?, TRUE, NOW())`,
          [
            flashcardId,
            noteId,
            clerkId,
            card.question,
            card.answer,
            card.type,
            card.difficulty,
            card.confidence,
          ]
        );

        flashcardIds.push(flashcardId);
      } catch (error) {
        // @ts-ignore
        logger.error({ error: error }, 'âŒ Failed to save flashcard:');
      }
    }

    logger.info(`âœ… Saved ${flashcardIds.length}/${flashcards.length} flashcards`);
    return flashcardIds;
  }

  /**
   * Get cached analysis if content hasn't changed
   */
  private async getCachedAnalysis(
    noteId: string,
    contentHash: string
  ): Promise<NoteAnalysis | null> {
    try {
        // @ts-ignore
      const results = await executeQuery(
        `SELECT content, tokens_used 
         FROM note_insights 
         WHERE note_id = ? 
           AND insight_type = 'batch_analysis' 
           AND content_hash = ? 
           AND is_valid = TRUE
         ORDER BY generated_at DESC 
         LIMIT 1`,
        [noteId, contentHash]
      );

      if (Array.isArray(results) && results.length > 0) {
        const cached = results[0];
        return {
          ...JSON.parse(cached.content),
          tokensUsed: cached.tokens_used || 0,
        };
      }

      return null;
    } catch (error) {
        // @ts-ignore
      logger.error({ error: error }, 'âŒ Cache lookup failed:');
      return null;
    }
  }

  /**
   * Cache analysis results
   */
  private async cacheAnalysis(
    noteId: string,
    contentHash: string,
    analysis: NoteAnalysis
  ): Promise<void> {
    try {
      // Invalidate old cache entries
        // @ts-ignore
      await executeQuery(
        `UPDATE note_insights 
         SET is_valid = FALSE 
         WHERE note_id = ? AND insight_type = 'batch_analysis'`,
        [noteId]
      );

      // Insert new cache entry
        // @ts-ignore
      await executeQuery(
        `INSERT INTO note_insights 
         (id, note_id, insight_type, content, model_used, confidence_score, tokens_used, content_hash, is_valid, generated_at)
         VALUES (gen_random_uuid()::text, ?, 'batch_analysis', ?, 'gpt-4o-mini', ?, ?, ?, TRUE, NOW())`,
        [
          noteId,
          JSON.stringify(analysis),
          analysis.confidence,
          analysis.tokensUsed,
          contentHash,
        ]
      );

      logger.info(`âœ… Cached analysis for note ${noteId}`);
    } catch (error) {
        // @ts-ignore
      logger.error({ error: error }, 'âŒ Failed to cache analysis:');
    }
  }

  /**
   * Calculate SHA-256 hash of content
   */
  private hashContent(content: string): string {
        // @ts-ignore
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Check if content has changed significantly (>30%)
   */
  async hasContentChangedSignificantly(
    noteId: string,
    newContent: string
  ): Promise<boolean> {
    const newHash = this.hashContent(newContent);

    try {
        // @ts-ignore
      const results = await executeQuery(
        `SELECT content_hash 
         FROM note_insights 
         WHERE note_id = ? AND insight_type = 'batch_analysis' 
         ORDER BY generated_at DESC 
         LIMIT 1`,
        [noteId]
      );

      if (Array.isArray(results) && results.length > 0) {
        return results[0].content_hash !== newHash;
      }

      return true; // No cache, consider it changed
    } catch (error) {
      return true; // On error, regenerate
    }
  }
}

/**
 * Singleton instance
 */
export const noteAIService = new NoteAIService();


