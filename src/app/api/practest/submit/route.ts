// VG Kosh Practest Engine - Answer Submission API

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { PractestSessionQueries } from '@/lib/db/practest-session-queries'
import { PractestQuestionQueries } from '@/lib/db/practest-queries'
import { 
  SubmitAnswerRequest, 
  SubmitAnswerResponse,
  CorrectOption 
} from '@/types/practest'

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
    const body: SubmitAnswerRequest = await request.json()
    
    // Validate request
    const validation = validateSubmitAnswerRequest(body)
    if (!validation.isValid) {
      return NextResponse.json({
        success: false,
        error: validation.error
      }, { status: 400 })
    }

    console.log('📝 Processing answer submission:', {
      sessionId: body.session_id,
      questionId: body.question_id,
      userId
    })

    // Get test session and verify ownership
    const session = await PractestSessionQueries.getSession(body.session_id)
    if (!session) {
      return NextResponse.json({
        success: false,
        error: 'Test session not found'
      }, { status: 404 })
    }

    if (session.user_id !== userId) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized access to test session'
      }, { status: 403 })
    }

    if (session.status !== 'ACTIVE') {
      return NextResponse.json({
        success: false,
        error: 'Test session is not active'
      }, { status: 400 })
    }

    // Verify question belongs to this test
    if (!session.selected_questions.includes(body.question_id)) {
      return NextResponse.json({
        success: false,
        error: 'Question not found in this test'
      }, { status: 400 })
    }

    // Get question details for evaluation
    const question = await PractestQuestionQueries.getQuestionById(body.question_id)
    if (!question) {
      return NextResponse.json({
        success: false,
        error: 'Question not found'
      }, { status: 404 })
    }

    // Evaluate the answer
    const evaluation = await evaluateAnswer(question, body.answer)
    
    // Submit answer to database
    await PractestSessionQueries.submitAnswer(
      body.session_id,
      body.question_id,
      body.answer,
      body.time_spent_seconds,
      evaluation.isCorrect,
      evaluation.marksAwarded,
      body.confidence_level
    )

    // Update question statistics
    await PractestQuestionQueries.updateQuestionStats(
      body.question_id,
      evaluation.isCorrect,
      body.time_spent_seconds
    )

    // Check if test is completed
    const updatedSession = await PractestSessionQueries.getSession(body.session_id)
    const isTestCompleted = updatedSession && 
      updatedSession.user_responses.length >= updatedSession.selected_questions.length

    let nextQuestionId: string | undefined
    if (!isTestCompleted && updatedSession) {
      const currentIndex = updatedSession.current_question_index
      if (currentIndex < updatedSession.selected_questions.length) {
        nextQuestionId = updatedSession.selected_questions[currentIndex]
      }
    }

    console.log('✅ Answer submitted successfully:', {
      sessionId: body.session_id,
      questionId: body.question_id,
      isCorrect: evaluation.isCorrect,
      marksAwarded: evaluation.marksAwarded,
      testCompleted: isTestCompleted
    })

    // Prepare response
    const response: SubmitAnswerResponse = {
      success: true,
      is_correct: evaluation.isCorrect,
      marks_awarded: evaluation.marksAwarded,
      next_question_id: nextQuestionId,
      test_completed: isTestCompleted
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Answer submission failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}

// Complete test endpoint
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const { session_id } = await request.json()
    
    if (!session_id) {
      return NextResponse.json({
        success: false,
        error: 'Session ID is required'
      }, { status: 400 })
    }

    // Verify session ownership
    const session = await PractestSessionQueries.getSession(session_id)
    if (!session || session.user_id !== userId) {
      return NextResponse.json({
        success: false,
        error: 'Session not found or unauthorized'
      }, { status: 404 })
    }

    // Complete the session
    const completedSession = await PractestSessionQueries.completeSession(session_id)
    
    console.log('🏁 Test completed:', {
      sessionId: session_id,
      totalScore: completedSession.total_score,
      percentage: completedSession.percentage
    })

    return NextResponse.json({
      success: true,
      session: {
        id: completedSession.id,
        total_score: completedSession.total_score,
        percentage: completedSession.percentage,
        duration_seconds: completedSession.duration_seconds,
        questions_attempted: completedSession.user_responses.length,
        questions_total: completedSession.selected_questions.length
      }
    })

  } catch (error) {
    console.error('❌ Test completion failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}

// Validation function
function validateSubmitAnswerRequest(body: any): { isValid: boolean; error?: string } {
  if (!body.session_id || typeof body.session_id !== 'string') {
    return { isValid: false, error: 'Session ID is required' }
  }

  if (!body.question_id || typeof body.question_id !== 'string') {
    return { isValid: false, error: 'Question ID is required' }
  }

  if (!body.answer || typeof body.answer !== 'string') {
    return { isValid: false, error: 'Answer is required' }
  }

  if (typeof body.time_spent_seconds !== 'number' || body.time_spent_seconds < 0) {
    return { isValid: false, error: 'Valid time spent is required' }
  }

  if (body.confidence_level && (body.confidence_level < 1 || body.confidence_level > 5)) {
    return { isValid: false, error: 'Confidence level must be between 1 and 5' }
  }

  return { isValid: true }
}

// Answer evaluation function
async function evaluateAnswer(question: any, userAnswer: string): Promise<{
  isCorrect: boolean
  marksAwarded: number
  feedback?: string
}> {
  switch (question.question_type) {
    case 'MCQ':
      return evaluateMCQAnswer(question, userAnswer)
    
    case 'TRUE_FALSE':
      return evaluateTrueFalseAnswer(question, userAnswer)
    
    case 'FILL_BLANK':
      return evaluateFillBlankAnswer(question, userAnswer)
    
    case 'SUBJECTIVE':
      return evaluateSubjectiveAnswer(question, userAnswer)
    
    default:
      throw new Error(`Unsupported question type: ${question.question_type}`)
  }
}

// MCQ evaluation
function evaluateMCQAnswer(question: any, userAnswer: string): {
  isCorrect: boolean
  marksAwarded: number
} {
  const isCorrect = userAnswer.toUpperCase() === question.correct_option
  const marksAwarded = isCorrect ? question.max_marks : 0
  
  return { isCorrect, marksAwarded }
}

// True/False evaluation
function evaluateTrueFalseAnswer(question: any, userAnswer: string): {
  isCorrect: boolean
  marksAwarded: number
} {
  const normalizedAnswer = userAnswer.toLowerCase()
  const correctAnswer = question.correct_option?.toLowerCase()
  
  const isCorrect = normalizedAnswer === correctAnswer || 
    (normalizedAnswer === 'true' && correctAnswer === 't') ||
    (normalizedAnswer === 'false' && correctAnswer === 'f')
  
  const marksAwarded = isCorrect ? question.max_marks : 0
  
  return { isCorrect, marksAwarded }
}

// Fill in the blank evaluation
function evaluateFillBlankAnswer(question: any, userAnswer: string): {
  isCorrect: boolean
  marksAwarded: number
} {
  const userAnswerNormalized = userAnswer.toLowerCase().trim()
  const correctAnswers = question.keywords || [question.model_answer]
  
  const isCorrect = correctAnswers.some((answer: string) => 
    answer.toLowerCase().trim() === userAnswerNormalized
  )
  
  // Partial credit for close matches
  let marksAwarded = 0
  if (isCorrect) {
    marksAwarded = question.max_marks
  } else {
    // Check for partial matches (simple keyword matching)
    const partialMatch = correctAnswers.some((answer: string) => 
      userAnswerNormalized.includes(answer.toLowerCase()) || 
      answer.toLowerCase().includes(userAnswerNormalized)
    )
    
    if (partialMatch) {
      marksAwarded = question.max_marks * 0.5 // 50% partial credit
    }
  }
  
  return { isCorrect, marksAwarded }
}

// Subjective answer evaluation (basic keyword matching)
async function evaluateSubjectiveAnswer(question: any, userAnswer: string): Promise<{
  isCorrect: boolean
  marksAwarded: number
  feedback?: string
}> {
  const keywords = question.keywords || []
  const userAnswerLower = userAnswer.toLowerCase()
  
  // Count keyword matches
  const keywordMatches = keywords.filter((keyword: string) => 
    userAnswerLower.includes(keyword.toLowerCase())
  ).length
  
  const keywordMatchRatio = keywords.length > 0 ? keywordMatches / keywords.length : 0
  
  // Basic scoring based on keyword matches
  let marksAwarded = 0
  let isCorrect = false
  
  if (keywordMatchRatio >= 0.8) {
    marksAwarded = question.max_marks
    isCorrect = true
  } else if (keywordMatchRatio >= 0.6) {
    marksAwarded = question.max_marks * 0.8
  } else if (keywordMatchRatio >= 0.4) {
    marksAwarded = question.max_marks * 0.6
  } else if (keywordMatchRatio >= 0.2) {
    marksAwarded = question.max_marks * 0.4
  }
  
  const feedback = `Keyword matches: ${keywordMatches}/${keywords.length}`
  
  return { isCorrect, marksAwarded, feedback }
}
