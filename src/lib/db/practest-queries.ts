// VG Kosh Practest Engine - Database Query Utilities

import mysql from 'mysql2/promise'
import {
  PractestQuestion,
  TestConfiguration,
  TestSession,
  CurriculumStructure,
  Board,
  DifficultyLevel,
  ValidationStatus,
  GenerateTestRequest,
  CustomTestParameters
} from '@/types/practest'
import { getConnection } from './connection' // ✅ Use centralized connection pool

// Question Bank Queries
export class PractestQuestionQueries {
  
  // Create new question
  static async createQuestion(question: Omit<PractestQuestion, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    const connection = await getConnection()
    
    try {
      const [result] = await connection.execute(`
        INSERT INTO practest_question_bank (
          question_text, question_type, option_a, option_b, option_c, option_d,
          correct_option, model_answer, marking_rubric, keywords, explanation,
          max_marks, time_limit_seconds, question_image_url, option_images,
          explanation_image_url, has_math_content, has_chemical_formulas,
          has_diagrams, board, class_level, subject, chapter, topic, subtopic,
          difficulty_level, bloom_level, cognitive_load, content_hash,
          validation_status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        question.question_text,
        question.question_type,
        question.option_a || null,
        question.option_b || null,
        question.option_c || null,
        question.option_d || null,
        question.correct_option || null,
        question.model_answer || null,
        question.marking_rubric ? JSON.stringify(question.marking_rubric) : null,
        question.keywords ? JSON.stringify(question.keywords) : null,
        question.explanation,
        question.max_marks,
        question.time_limit_seconds,
        question.question_image_url || null,
        question.option_images ? JSON.stringify(question.option_images) : null,
        question.explanation_image_url || null,
        question.has_math_content,
        question.has_chemical_formulas,
        question.has_diagrams,
        question.board,
        question.class_level,
        question.subject,
        question.chapter,
        question.topic,
        question.subtopic || null,
        question.difficulty_level,
        question.bloom_level,
        question.cognitive_load,
        question.content_hash,
        question.validation_status,
        question.created_by
      ])
      
      return (result as any).insertId
    } finally {
      connection.release() // ✅ Release connection back to pool
    }
  }

  // Get questions by curriculum filters
  static async getQuestionsByCurriculum(
    board: Board,
    classLevel: number,
    subject: string,
    chapters?: string[],
    topics?: string[],
    limit?: number
  ): Promise<PractestQuestion[]> {
    const connection = await getConnection()
    
    try {
      let query = `
        SELECT * FROM practest_question_bank 
        WHERE board = ? AND class_level = ? AND subject = ? AND validation_status = 'APPROVED'
      `
      const params: any[] = [board, classLevel, subject]
      
      if (chapters && chapters.length > 0) {
        query += ` AND chapter IN (${chapters.map(() => '?').join(', ')})`
        params.push(...chapters)
      }
      
      if (topics && topics.length > 0) {
        query += ` AND topic IN (${topics.map(() => '?').join(', ')})`
        params.push(...topics)
      }
      
      query += ` ORDER BY RAND()`
      
      if (limit) {
        query += ` LIMIT ?`
        params.push(limit)
      }
      
      const [rows] = await connection.execute(query, params)
      return this.mapRowsToQuestions(rows as any[])
    } finally {
      connection.release() // ✅ Release connection back to pool
    }
  }

  // Get questions by difficulty distribution
  static async getQuestionsByDifficulty(
    baseFilters: {
      board: Board
      classLevel: number
      subject: string
      chapters?: string[]
      topics?: string[]
    },
    difficultyDistribution: { EASY: number; MEDIUM: number; HARD: number }
  ): Promise<PractestQuestion[]> {
    const connection = await getConnection()
    const allQuestions: PractestQuestion[] = []
    
    try {
      for (const [difficulty, count] of Object.entries(difficultyDistribution)) {
        if (count === 0) continue
        
        let query = `
          SELECT * FROM practest_question_bank 
          WHERE board = ? AND class_level = ? AND subject = ? 
          AND difficulty_level = ? AND validation_status = 'APPROVED'
        `
        const params: any[] = [baseFilters.board, baseFilters.classLevel, baseFilters.subject, difficulty]
        
        if (baseFilters.chapters && baseFilters.chapters.length > 0) {
          query += ` AND chapter IN (${baseFilters.chapters.map(() => '?').join(', ')})`
          params.push(...baseFilters.chapters)
        }
        
        if (baseFilters.topics && baseFilters.topics.length > 0) {
          query += ` AND topic IN (${baseFilters.topics.map(() => '?').join(', ')})`
          params.push(...baseFilters.topics)
        }
        
        query += ` ORDER BY RAND() LIMIT ?`
        params.push(count * 2) // Get extra for variety
        
        const [rows] = await connection.execute(query, params)
        const questions = this.mapRowsToQuestions(rows as any[])
        allQuestions.push(...questions.slice(0, count))
      }

      return allQuestions
    } finally {
      connection.release() // ✅ Release connection back to pool
    }
  }

  // Update question usage statistics
  static async updateQuestionStats(
    questionId: string,
    isCorrect: boolean,
    timeSpent: number
  ): Promise<void> {
    const connection = await getConnection()
    
    try {
      await connection.execute(`
        UPDATE practest_question_bank 
        SET 
          usage_count = usage_count + 1,
          total_attempts = total_attempts + 1,
          correct_attempts = correct_attempts + ?,
          average_time_seconds = (average_time_seconds * (total_attempts - 1) + ?) / total_attempts
        WHERE id = ?
      `, [isCorrect ? 1 : 0, timeSpent, questionId])
    } finally {
      connection.release() // ✅ Release connection back to pool
    }
  }

  // Get questions for admin management
  static async getQuestionsForAdmin(
    filters: {
      board?: Board
      classLevel?: number
      subject?: string
      validationStatus?: ValidationStatus
      createdBy?: string
    },
    pagination: { page: number; limit: number }
  ): Promise<{ questions: PractestQuestion[]; total: number }> {
    const connection = await getConnection()
    
    try {
      let whereClause = 'WHERE 1=1'
      const params: any[] = []
      
      if (filters.board) {
        whereClause += ' AND board = ?'
        params.push(filters.board)
      }
      
      if (filters.classLevel) {
        whereClause += ' AND class_level = ?'
        params.push(filters.classLevel)
      }
      
      if (filters.subject) {
        whereClause += ' AND subject = ?'
        params.push(filters.subject)
      }
      
      if (filters.validationStatus) {
        whereClause += ' AND validation_status = ?'
        params.push(filters.validationStatus)
      }
      
      if (filters.createdBy) {
        whereClause += ' AND created_by = ?'
        params.push(filters.createdBy)
      }
      
      // Get total count
      const [countResult] = await connection.execute(
        `SELECT COUNT(*) as total FROM practest_question_bank ${whereClause}`,
        params
      )
      const total = (countResult as any[])[0].total
      
      // Get paginated results
      const offset = (pagination.page - 1) * pagination.limit
      const [rows] = await connection.execute(
        `SELECT * FROM practest_question_bank ${whereClause} 
         ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...params, pagination.limit, offset]
      )
      
      const questions = this.mapRowsToQuestions(rows as any[])

      return { questions, total }
    } finally {
      connection.release() // ✅ Release connection back to pool
    }
  }

  // Get single question by ID
  static async getQuestionById(questionId: string): Promise<PractestQuestion | null> {
    const connection = await getConnection()

    try {
      const [rows] = await connection.execute(
        'SELECT * FROM practest_question_bank WHERE id = ? AND validation_status = "APPROVED"',
        [questionId]
      )

      const questions = this.mapRowsToQuestions(rows as any[])
      return questions.length > 0 ? questions[0] : null
    } finally {
      connection.release() // ✅ Release connection back to pool
    }
  }

  // Helper method to map database rows to Question objects
  private static mapRowsToQuestions(rows: any[]): PractestQuestion[] {
    return rows.map(row => ({
      id: row.id,
      question_text: row.question_text,
      question_type: row.question_type,
      option_a: row.option_a,
      option_b: row.option_b,
      option_c: row.option_c,
      option_d: row.option_d,
      correct_option: row.correct_option,
      model_answer: row.model_answer,
      marking_rubric: row.marking_rubric ? JSON.parse(row.marking_rubric) : undefined,
      keywords: row.keywords ? JSON.parse(row.keywords) : undefined,
      explanation: row.explanation,
      max_marks: parseFloat(row.max_marks),
      time_limit_seconds: row.time_limit_seconds,
      question_image_url: row.question_image_url,
      option_images: row.option_images ? JSON.parse(row.option_images) : undefined,
      explanation_image_url: row.explanation_image_url,
      has_math_content: row.has_math_content,
      has_chemical_formulas: row.has_chemical_formulas,
      has_diagrams: row.has_diagrams,
      board: row.board,
      class_level: row.class_level,
      subject: row.subject,
      chapter: row.chapter,
      topic: row.topic,
      subtopic: row.subtopic,
      difficulty_level: row.difficulty_level,
      bloom_level: row.bloom_level,
      cognitive_load: row.cognitive_load,
      usage_count: row.usage_count,
      correct_attempts: row.correct_attempts,
      total_attempts: row.total_attempts,
      average_time_seconds: parseFloat(row.average_time_seconds),
      discrimination_index: parseFloat(row.discrimination_index),
      difficulty_index: parseFloat(row.difficulty_index),
      content_hash: row.content_hash,
      validation_status: row.validation_status,
      rejection_reason: row.rejection_reason,
      created_by: row.created_by,
      reviewed_by: row.reviewed_by,
      approved_by: row.approved_by,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      approved_at: row.approved_at ? new Date(row.approved_at) : undefined
    }))
  }
}
