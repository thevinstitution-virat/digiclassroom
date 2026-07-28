// VG Kosh Practest Engine - Test Session Database Queries

import mysql from 'mysql2/promise'
import {
  TestSession,
  UserResponse,
  CustomTestParameters,
  TestSessionStatus
} from '@/types/practest'
import { v4 as uuidv4 } from 'uuid'
import { getConnection } from './connection' // ✅ Use centralized connection pool

export class PractestSessionQueries {
  
  /**
   * Create a new test session
   */
  static async createSession(sessionData: {
    user_id: string
    configuration_id?: string
    custom_parameters?: CustomTestParameters
    selected_questions: string[]
    max_possible_score: number
    start_time: Date
  }): Promise<string> {
    const connection = await getConnection()
    const sessionId = uuidv4()
    
    try {
      await connection.execute(`
        INSERT INTO practest_test_sessions (
          id, user_id, configuration_id, custom_parameters, selected_questions,
          max_possible_score, start_time, status, current_question_index,
          user_responses, time_remaining_seconds
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 0, '[]', ?)
      `, [
        sessionId,
        sessionData.user_id,
        sessionData.configuration_id || null,
        sessionData.custom_parameters ? JSON.stringify(sessionData.custom_parameters) : null,
        JSON.stringify(sessionData.selected_questions),
        sessionData.max_possible_score,
        sessionData.start_time,
        sessionData.custom_parameters?.duration_minutes ? sessionData.custom_parameters.duration_minutes * 60 : 3600
      ])
      
      console.log('✅ Test session created:', sessionId)
      return sessionId
    } finally {
      connection.release() // ✅ Release connection back to pool
    }
  }

  /**
   * Get test session by ID
   */
  static async getSession(sessionId: string): Promise<TestSession | null> {
    const connection = await getConnection()
    
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM practest_test_sessions WHERE id = ?',
        [sessionId]
      )
      
      const sessions = rows as any[]
      if (sessions.length === 0)
  return null

      return this.mapRowToSession(sessions[0])
    } finally {
      connection.release() // ✅ Release connection back to pool
    }
  }

  /**
   * Get active sessions for a user
   */
  static async getActiveSessionsForUser(userId: string): Promise<TestSession[]> {
    const connection = await getConnection()
    
    try {
      const [rows] = await connection.execute(`
        SELECT * FROM practest_test_sessions 
        WHERE user_id = ? AND status = 'ACTIVE'
        ORDER BY start_time DESC
      `, [userId])
      
      const sessions = rows as any[]
      return sessions.map(row => this.mapRowToSession(row))
    } finally {
      connection.release() // ✅ Release connection back to pool
    }
  }

  /**
   * Submit an answer for a question
   */
  static async submitAnswer(
    sessionId: string,
    questionId: string,
    answer: string,
    timeSpentSeconds: number,
    isCorrect: boolean,
    marksAwarded: number,
    confidenceLevel?: number
  ): Promise<void> {
    const connection = await getConnection()
    
    try {
      // Get current session
      const session = await this.getSession(sessionId)
      if (!session) {
        throw new Error('Session not found')
      }
      
      // Create new response
      const newResponse: UserResponse = {
        question_id: questionId,
        selected_option: answer.length === 1 ? answer as any : undefined,
        text_answer: answer.length > 1 ? answer : undefined,
        is_correct: isCorrect,
        marks_awarded: marksAwarded,
        time_spent_seconds: timeSpentSeconds,
        timestamp: new Date(),
        is_skipped: false,
        confidence_level: confidenceLevel
      }
      
      // Update existing response or add new one
      const existingResponses = session.user_responses || []
      const existingIndex = existingResponses.findIndex(r => r.question_id === questionId)
      
      if (existingIndex >= 0) {
        existingResponses[existingIndex] = newResponse
      } else {
        existingResponses.push(newResponse)
      }
      
      // Calculate new total score
      const totalScore = existingResponses.reduce((sum, r) => sum + r.marks_awarded, 0)
      const percentage = (totalScore / session.max_possible_score) * 100
      
      // Update session in database
      await connection.execute(`
        UPDATE practest_test_sessions 
        SET 
          user_responses = ?,
          total_score = ?,
          percentage = ?,
          current_question_index = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        JSON.stringify(existingResponses),
        totalScore,
        percentage,
        Math.min(existingResponses.length, session.selected_questions.length),
        sessionId
      ])

      console.log('✅ Answer submitted:', { sessionId, questionId, isCorrect, marksAwarded })
    } finally {
      connection.release() // ✅ Release connection back to pool
    }
  }

  /**
   * Complete a test session
   */
  static async completeSession(sessionId: string): Promise<TestSession> {
    const connection = await getConnection()
    
    try {
      const session = await this.getSession(sessionId)
      if (!session) {
        throw new Error('Session not found')
      }
      
      const endTime = new Date()
      const durationSeconds = Math.floor((endTime.getTime() - session.start_time.getTime()) / 1000)
      
      // Generate analytics
      const analytics = await this.generateSessionAnalytics(session)
      
      await connection.execute(`
        UPDATE practest_test_sessions 
        SET 
          status = 'COMPLETED',
          end_time = ?,
          duration_seconds = ?,
          question_wise_results = ?,
          topic_wise_performance = ?,
          difficulty_wise_performance = ?,
          time_analytics = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        endTime,
        durationSeconds,
        JSON.stringify(analytics.questionWiseResults),
        JSON.stringify(analytics.topicWisePerformance),
        JSON.stringify(analytics.difficultyWisePerformance),
        JSON.stringify(analytics.timeAnalytics),
        sessionId
      ])
      
      console.log('✅ Test session completed:', sessionId)
      
      // Return updated session
      return await this.getSession(sessionId) as TestSession
    } finally {
      connection.release() // ✅ Release connection back to pool
    }
  }

  /**
   * Update session time remaining
   */
  static async updateTimeRemaining(sessionId: string, timeRemainingSeconds: number): Promise<void> {
    const connection = await getConnection()
    
    try {
      await connection.execute(`
        UPDATE practest_test_sessions 
        SET time_remaining_seconds = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [timeRemainingSeconds, sessionId])
    } finally {
      connection.release() // ✅ Release connection back to pool
    }
  }

  /**
   * Get user's test history
   */
  static async getUserTestHistory(
    userId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<{ sessions: TestSession[]; total: number }> {
    const connection = await getConnection()
    
    try {
      // Get total count
      const [countResult] = await connection.execute(
        'SELECT COUNT(*) as total FROM practest_test_sessions WHERE user_id = ?',
        [userId]
      )
      const total = (countResult as any[])[0].total
      
      // Get sessions
      const [rows] = await connection.execute(`
        SELECT * FROM practest_test_sessions 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `, [userId, limit, offset])
      
      const sessions = (rows as any[]).map(row => this.mapRowToSession(row))

      return { sessions, total }
    } finally {
      connection.release() // ✅ Release connection back to pool
    }
  }

  /**
   * Generate comprehensive analytics for a completed session
   */
  private static async generateSessionAnalytics(session: TestSession) {
    // This would integrate with the existing question bank to get question details
    // For now, returning mock structure
    return {
      questionWiseResults: [],
      topicWisePerformance: [],
      difficultyWisePerformance: [],
      timeAnalytics: {
        total_time_seconds: 0,
        average_time_per_question: 0,
        fastest_question_time: 0,
        slowest_question_time: 0,
        time_distribution_by_difficulty: {},
        time_distribution_by_topic: {}
      }
    }
  }
  
  /**
   * Map database row to TestSession object
   */
  private static mapRowToSession(row: any): TestSession {
    return {
      id: row.id,
      user_id: row.user_id,
      configuration_id: row.configuration_id,
      custom_parameters: row.custom_parameters ? JSON.parse(row.custom_parameters) : undefined,
      selected_questions: JSON.parse(row.selected_questions),
      user_responses: row.user_responses ? JSON.parse(row.user_responses) : [],
      start_time: new Date(row.start_time),
      end_time: row.end_time ? new Date(row.end_time) : undefined,
      duration_seconds: row.duration_seconds,
      time_remaining_seconds: row.time_remaining_seconds,
      current_question_index: row.current_question_index,
      status: row.status,
      total_score: parseFloat(row.total_score || '0'),
      max_possible_score: parseFloat(row.max_possible_score),
      percentage: parseFloat(row.percentage || '0'),
      question_wise_results: row.question_wise_results ? JSON.parse(row.question_wise_results) : [],
      topic_wise_performance: row.topic_wise_performance ? JSON.parse(row.topic_wise_performance) : [],
      difficulty_wise_performance: row.difficulty_wise_performance ? JSON.parse(row.difficulty_wise_performance) : [],
      time_analytics: row.time_analytics ? JSON.parse(row.time_analytics) : {
        total_time_seconds: 0,
        average_time_per_question: 0,
        fastest_question_time: 0,
        slowest_question_time: 0,
        time_distribution_by_difficulty: {},
        time_distribution_by_topic: {}
      },
      review_completed: row.review_completed || false,
      feedback_submitted: row.feedback_submitted || false,
      session_feedback: row.session_feedback,
      ip_address: row.ip_address,
      user_agent: row.user_agent,
      device_info: row.device_info ? JSON.parse(row.device_info) : undefined,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    }
  }
}
