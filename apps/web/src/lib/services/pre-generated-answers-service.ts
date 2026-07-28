/**
 * Pre-Generated Answers Service
 * Handles lookup and management of pre-generated answers for common questions
 */

import crypto from 'crypto';
import { getConnection } from '@/lib/db/connection';

export interface PreGeneratedAnswer {
  id: string;
  question_hash: string;
  question_text: string;
  answer: string;
  key_terms: string[];
  subject: string;
  class_level: string;
  board: string;
  difficulty_level: 'easy' | 'medium' | 'hard';
  sources: any[] | null;
  metadata: any | null;
  hit_count: number;
  last_served_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Generate SHA256 hash for question lookup
 * Same algorithm as used in import script
 */
export function generateQuestionHash(
  question: string,
  grade: string,
  subject: string,
  board: string = 'CBSE'
): string {
  // Normalize question (lowercase, remove extra whitespace, remove punctuation)
  const normalized = question
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');

  // Create hash string
  const hashString = `${normalized}:${grade}:${subject.toLowerCase()}:${board.toLowerCase()}`;

  // Generate SHA256 hash
  return crypto.createHash('sha256').update(hashString).digest('hex');
}

/**
 * Look up a pre-generated answer by question hash
 */
export async function findPreGeneratedAnswer(
  question: string,
  grade: string,
  subject: string,
  board: string = 'CBSE'
): Promise<PreGeneratedAnswer | null> {
  try {
    const questionHash = generateQuestionHash(question, grade, subject, board);

    const connection = await getConnection();
    const [rows] = await connection.query<any[]>(
      `SELECT * FROM pre_generated_answers WHERE question_hash = ? LIMIT 1`,
      [questionHash]
    );

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];

    // Parse JSON fields
    const answer: PreGeneratedAnswer = {
      ...row,
      key_terms: row.key_terms ? JSON.parse(row.key_terms) : [],
      sources: row.sources ? JSON.parse(row.sources) : null,
      metadata: row.metadata ? JSON.parse(row.metadata) : null
    };

    return answer;
  } catch (error) {
    console.error('❌ Error finding pre-generated answer:', error);
    return null;
  }
}

/**
 * Increment hit count and update last_served_at for a pre-generated answer
 */
export async function recordPreGeneratedAnswerHit(questionHash: string): Promise<void> {
  try {
    const connection = await getConnection();
    await connection.query(
      `UPDATE pre_generated_answers 
       SET hit_count = hit_count + 1, 
           last_served_at = CURRENT_TIMESTAMP 
       WHERE question_hash = ?`,
      [questionHash]
    );
  } catch (error) {
    console.error('❌ Error recording pre-generated answer hit:', error);
    // Don't throw - this is non-critical
  }
}

/**
 * Get statistics about pre-generated answers
 */
export async function getPreGeneratedAnswersStats(): Promise<{
  total: number;
  totalHits: number;
  avgHitsPerAnswer: number;
  mostPopular: Array<{ question: string; hits: number }>;
}> {
  try {
    const connection = await getConnection();

    // Get total count and total hits
    const [statsRows] = await connection.query<any[]>(
      `SELECT 
        COUNT(*) as total,
        SUM(hit_count) as total_hits,
        AVG(hit_count) as avg_hits
       FROM pre_generated_answers`
    );

    const stats = statsRows[0];

    // Get most popular answers
    const [popularRows] = await connection.query<any[]>(
      `SELECT question_text, hit_count 
       FROM pre_generated_answers 
       WHERE hit_count > 0
       ORDER BY hit_count DESC 
       LIMIT 10`
    );

    return {
      total: stats.total || 0,
      totalHits: stats.total_hits || 0,
      avgHitsPerAnswer: stats.avg_hits || 0,
      mostPopular: popularRows.map((row: any) => ({
        question: row.question_text,
        hits: row.hit_count
      }))
    };
  } catch (error) {
    console.error('❌ Error getting pre-generated answers stats:', error);
    return {
      total: 0,
      totalHits: 0,
      avgHitsPerAnswer: 0,
      mostPopular: []
    };
  }
}

/**
 * Delete a pre-generated answer by ID
 */
export async function deletePreGeneratedAnswer(id: string): Promise<boolean> {
  try {
    const connection = await getConnection();
    const [result] = await connection.query<any>(
      `DELETE FROM pre_generated_answers WHERE id = ?`,
      [id]
    );

    return result.affectedRows > 0;
  } catch (error) {
    console.error('❌ Error deleting pre-generated answer:', error);
    return false;
  }
}

/**
 * Update a pre-generated answer
 */
export async function updatePreGeneratedAnswer(
  id: string,
  updates: Partial<Pick<PreGeneratedAnswer, 'answer' | 'key_terms' | 'difficulty_level'>>
): Promise<boolean> {
  try {
    const connection = await getConnection();

    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (updates.answer !== undefined) {
      updateFields.push('answer = ?');
      updateValues.push(updates.answer);
    }

    if (updates.key_terms !== undefined) {
      updateFields.push('key_terms = ?');
      updateValues.push(JSON.stringify(updates.key_terms));
    }

    if (updates.difficulty_level !== undefined) {
      updateFields.push('difficulty_level = ?');
      updateValues.push(updates.difficulty_level);
    }

    if (updateFields.length === 0) {
      return false;
    }

    updateValues.push(id);

    const [result] = await connection.query<any>(
      `UPDATE pre_generated_answers SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      updateValues
    );

    return result.affectedRows > 0;
  } catch (error) {
    console.error('❌ Error updating pre-generated answer:', error);
    return false;
  }
}

/**
 * List all pre-generated answers with pagination
 */
export async function listPreGeneratedAnswers(options: {
  page?: number;
  limit?: number;
  subject?: string;
  classLevel?: string;
  board?: string;
  sortBy?: 'created_at' | 'hit_count' | 'last_served_at';
  sortOrder?: 'ASC' | 'DESC';
}): Promise<{
  answers: PreGeneratedAnswer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  try {
    const {
      page = 1,
      limit = 20,
      subject,
      classLevel,
      board,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = options;

    const offset = (page - 1) * limit;
    const connection = await getConnection();

    // Build WHERE clause
    const whereConditions: string[] = [];
    const whereValues: any[] = [];

    if (subject) {
      whereConditions.push('subject = ?');
      whereValues.push(subject);
    }

    if (classLevel) {
      whereConditions.push('class_level = ?');
      whereValues.push(classLevel);
    }

    if (board) {
      whereConditions.push('board = ?');
      whereValues.push(board);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const [countRows] = await connection.query<any[]>(
      `SELECT COUNT(*) as total FROM pre_generated_answers ${whereClause}`,
      whereValues
    );

    const total = countRows[0].total;

    // Get paginated results
    const [rows] = await connection.query<any[]>(
      `SELECT * FROM pre_generated_answers 
       ${whereClause}
       ORDER BY ${sortBy} ${sortOrder}
       LIMIT ? OFFSET ?`,
      [...whereValues, limit, offset]
    );

    const answers: PreGeneratedAnswer[] = rows.map((row: any) => ({
      ...row,
      key_terms: row.key_terms ? JSON.parse(row.key_terms) : [],
      sources: row.sources ? JSON.parse(row.sources) : null,
      metadata: row.metadata ? JSON.parse(row.metadata) : null
    }));

    return {
      answers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  } catch (error) {
    console.error('❌ Error listing pre-generated answers:', error);
    return {
      answers: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0
    };
  }
}

