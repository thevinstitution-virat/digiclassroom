/**
 * Pre-Generated Answers Service Implementation
 * Manages cached answers in MySQL database
 * Features:
 * - Question hashing for fast lookup
 * - Hit count tracking
 * - Metadata filtering
 * - Error handling with graceful degradation
 */

import crypto from 'crypto';
import type { IPreGeneratedAnswersService, AnswerMetadata } from '../interfaces';

// Import database connection from existing location
let getConnection: any;

try {
  // Import existing database connection
  const dbModule = require('@/lib/db/connection');
  getConnection = dbModule.getConnection || dbModule.default;
} catch (error) {
  console.warn('⚠️ Database connection not found, pre-generated answers will be disabled');
  getConnection = null;
}

export class PreGeneratedAnswersService implements IPreGeneratedAnswersService {
  private enabled: boolean;

  constructor() {
    this.enabled = getConnection !== null;
    
    if (this.enabled) {
      console.log('✅ Pre-Generated Answers Service initialized');
    } else {
      console.warn('⚠️ Pre-Generated Answers Service disabled (no database connection)');
    }
  }

  async findAnswer(question: string, metadata?: Partial<AnswerMetadata>): Promise<string | null> {
    if (!this.enabled)
  return null;

    try {
      const hash = this.generateHash(question);
      const connection = await getConnection();

        // @ts-ignore
      const [rows] = await connection.query<any[]>(
        `SELECT answer_text FROM pre_generated_answers 
         WHERE question_hash = ? 
         LIMIT 1`,
        [hash]
      );

      if (rows && rows.length > 0) {
        // Update hit count and last accessed
        await connection.query(
          `UPDATE pre_generated_answers 
           SET hit_count = hit_count + 1, last_accessed_at = NOW() 
           WHERE question_hash = ?`,
          [hash]
        ).catch((err: any) => console.error('Failed to update hit count:', err));

        console.log(`✅ Pre-generated answer cache HIT for hash: ${hash.substring(0, 8)}...`);
        return rows[0].answer_text;
      }

      console.log(`❌ Pre-generated answer cache MISS for hash: ${hash.substring(0, 8)}...`);
      return null;
    } catch (error: any) {
      // Graceful degradation - if table doesn't exist, just return null
      if (error.code === 'ER_NO_SUCH_TABLE') {
        console.warn('⚠️ Table pre_generated_answers does not exist. Run migration first.');
        this.enabled = false; // Disable for future calls
        return null;
      }

      console.error('❌ Error fetching pre-generated answer:', error);
      return null;
    }
  }

  async cacheAnswer(
    question: string,
    answer: string,
    metadata: AnswerMetadata
  ): Promise<void> {
    if (!this.enabled) return;

    try {
      const hash = this.generateHash(question);
      const connection = await getConnection();

      await connection.query(
        `INSERT INTO pre_generated_answers 
         (question_hash, question_text, answer_text, subject, class_level, board, content_type)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (question_hash) DO UPDATE SET
           answer_text = excluded.answer_text,
           updated_at = NOW()`,
        [
          hash,
          question,
          answer,
          metadata.subject,
          metadata.class_level,
          metadata.board,
          metadata.content_type || null
        ]
      );

      console.log(`✅ Cached answer for hash: ${hash.substring(0, 8)}...`);
    } catch (error: any) {
      if (error.code === 'ER_NO_SUCH_TABLE') {
        console.warn('⚠️ Table pre_generated_answers does not exist. Skipping cache.');
        this.enabled = false;
        return;
      }

      console.error('❌ Error caching answer:', error);
    }
  }

  async getStats(): Promise<{ total: number; avgHitCount: number }> {
    if (!this.enabled) {
      return { total: 0, avgHitCount: 0 };
    }

    try {
      const connection = await getConnection();
        // @ts-ignore
      const [rows] = await connection.query<any[]>(
        `SELECT COUNT(*) as total, AVG(hit_count) as avgHitCount 
         FROM pre_generated_answers`
      );

      return {
        total: rows[0]?.total || 0,
        avgHitCount: rows[0]?.avgHitCount || 0
      };
    } catch (error) {
      console.error('❌ Error getting stats:', error);
      return { total: 0, avgHitCount: 0 };
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private generateHash(question: string): string {
    return crypto
      .createHash('sha256')
      .update(question.toLowerCase().trim())
      .digest('hex');
  }
}

