// VG Kosh Practest Engine - Test Generation API

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { QuestionSelectionEngine } from '@/lib/practest/question-selection-engine'
import { PractestSessionQueries } from '@/lib/db/practest-session-queries'
import { 
  GenerateTestRequest, 
  GenerateTestResponse, 
  TestMetadata,
  DifficultyDistribution 
} from '@/types/practest'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    // Parse request body
    const body: GenerateTestRequest = await request.json()
    
    // Validate required fields
    const validation = validateGenerateTestRequest(body)
    if (!validation.isValid) {
      return NextResponse.json({
        success: false,
        error: validation.error
      }, { status: 400 })
    }

    console.log('🎯 Generating test for user:', userId, {
      board: body.board,
      class: body.class_level,
      subject: body.subject,
      chapters: body.chapters,
      totalQuestions: body.total_questions
    })

    // Initialize question selection engine
    const selectionEngine = new QuestionSelectionEngine()
    
    // Select questions based on parameters
    const selectedQuestions = await selectionEngine.selectQuestions(body, userId)
    
    if (selectedQuestions.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No questions found matching the specified criteria'
      }, { status: 404 })
    }

    // Calculate test metadata
    const testMetadata: TestMetadata = {
      total_questions: selectedQuestions.length,
      duration_minutes: calculateTestDuration(selectedQuestions),
      max_marks: selectedQuestions.reduce((sum, q) => sum + q.max_marks, 0),
      difficulty_distribution: analyzeDifficultyDistribution(selectedQuestions),
      topic_distribution: analyzeTopicDistribution(selectedQuestions),
      instructions: generateTestInstructions(body, testMetadata)
    }

    // Create test session
    const sessionId = await PractestSessionQueries.createSession({
      user_id: userId,
      custom_parameters: {
        board: body.board,
        class_level: body.class_level,
        subject: body.subject,
        chapters: body.chapters,
        topics: body.topics,
        total_questions: body.total_questions,
        duration_minutes: testMetadata.duration_minutes,
        difficulty_distribution: body.difficulty_distribution || {
          EASY: Math.floor(body.total_questions * 0.3),
          MEDIUM: Math.floor(body.total_questions * 0.5),
          HARD: Math.floor(body.total_questions * 0.2)
        }
      },
      selected_questions: selectedQuestions.map(q => q.id),
      max_possible_score: testMetadata.max_marks,
      start_time: new Date()
    })

    console.log('✅ Test generated successfully:', {
      sessionId,
      questionsSelected: selectedQuestions.length,
      maxMarks: testMetadata.max_marks,
      duration: testMetadata.duration_minutes
    })

    // Return response
    const response: GenerateTestResponse = {
      success: true,
      session_id: sessionId,
      questions: selectedQuestions.map(sanitizeQuestionForUser),
      test_metadata: testMetadata
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Test generation failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}

// Validation function
function validateGenerateTestRequest(body: any): { isValid: boolean; error?: string } {
  if (!body.board || !['CBSE', 'ICSE', 'STATE_UP', 'STATE_MH', 'STATE_TN'].includes(body.board)) {
    return { isValid: false, error: 'Valid board is required' }
  }

  if (!body.class_level || body.class_level < 1 || body.class_level > 12) {
    return { isValid: false, error: 'Class level must be between 1 and 12' }
  }

  if (!body.subject || typeof body.subject !== 'string') {
    return { isValid: false, error: 'Subject is required' }
  }

  if (!body.chapters || !Array.isArray(body.chapters) || body.chapters.length === 0) {
    return { isValid: false, error: 'At least one chapter is required' }
  }

  if (!body.total_questions || ![10, 20, 30, 50].includes(body.total_questions)) {
    return { isValid: false, error: 'Total questions must be 10, 20, 30, or 50' }
  }

  // Validate difficulty distribution if provided
  if (body.difficulty_distribution) {
    const dist = body.difficulty_distribution
    const total = (dist.EASY || 0) + (dist.MEDIUM || 0) + (dist.HARD || 0)
    if (total !== body.total_questions) {
      return { isValid: false, error: 'Difficulty distribution must sum to total questions' }
    }
  }

  return { isValid: true }
}

// Calculate test duration based on questions
function calculateTestDuration(questions: any[]): number {
  const baseTimePerQuestion = 2 // 2 minutes base time
  const totalBaseTime = questions.length * baseTimePerQuestion
  
  // Add extra time for difficult questions
  const extraTime = questions.reduce((sum, q) => {
    switch (q.difficulty_level) {
      case 'HARD': return sum + 1
      case 'MEDIUM': return sum + 0.5
      default: return sum
    }
  }, 0)
  
  // Add time for questions with multimedia content
  const multimediaTime = questions.reduce((sum, q) => {
    let extra = 0
    if (q.has_math_content) extra += 0.5
    if (q.has_chemical_formulas) extra += 0.5
    if (q.has_diagrams || q.question_image_url) extra += 1
    return sum + extra
  }, 0)
  
  return Math.ceil(totalBaseTime + extraTime + multimediaTime)
}

// Analyze difficulty distribution
function analyzeDifficultyDistribution(questions: any[]): DifficultyDistribution {
  return questions.reduce((acc, q) => {
    acc[q.difficulty_level as keyof DifficultyDistribution]++
    return acc
  }, { EASY: 0, MEDIUM: 0, HARD: 0 })
}

// Analyze topic distribution
function analyzeTopicDistribution(questions: any[]): Record<string, number> {
  return questions.reduce((acc, q) => {
    acc[q.topic] = (acc[q.topic] || 0) + 1
    return acc
  }, {} as Record<string, number>)
}

// Generate test instructions
function generateTestInstructions(request: GenerateTestRequest, metadata: TestMetadata): string[] {
  return [
    `This test contains ${metadata.total_questions} questions worth ${metadata.max_marks} marks.`,
    `Time allowed: ${metadata.duration_minutes} minutes.`,
    `All questions are compulsory.`,
    `Read each question carefully before answering.`,
    `For multiple choice questions, select the most appropriate option.`,
    `You can review and change your answers before submitting.`,
    `Click "Submit Test" when you have completed all questions.`
  ]
}

// Sanitize question data for user (remove correct answers)
function sanitizeQuestionForUser(question: any) {
  const sanitized = { ...question }
  
  // Remove sensitive information
  delete sanitized.correct_option
  delete sanitized.model_answer
  delete sanitized.marking_rubric
  delete sanitized.keywords
  delete sanitized.content_hash
  delete sanitized.validation_status
  delete sanitized.created_by
  delete sanitized.reviewed_by
  delete sanitized.approved_by
  delete sanitized.usage_count
  delete sanitized.correct_attempts
  delete sanitized.total_attempts
  delete sanitized.discrimination_index
  delete sanitized.difficulty_index
  
  return sanitized
}

// GET endpoint for test status
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    // Get active test sessions for user
    const activeSessions = await PractestSessionQueries.getActiveSessionsForUser(userId)
    
    return NextResponse.json({
      success: true,
      active_sessions: activeSessions.length,
      sessions: activeSessions.map(session => ({
        id: session.id,
        subject: session.custom_parameters?.subject,
        questions_total: session.selected_questions.length,
        questions_answered: session.user_responses?.length || 0,
        time_remaining: session.time_remaining_seconds,
        started_at: session.start_time
      }))
    })

  } catch (error) {
    console.error('❌ Failed to get test status:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve test status'
    }, { status: 500 })
  }
}
