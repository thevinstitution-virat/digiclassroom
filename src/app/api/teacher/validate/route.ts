/**
 * Teacher Validation API
 * POST /api/teacher/validate
 * 
 * Submit teacher validation of AI-generated answers
 * Automatically adds approved answers to ground truth dataset
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { executeQuery, executeQuerySingle } from '@/lib/db/connection'
import { v4 as uuidv4 } from 'uuid'

interface TeacherValidateRequest {
  feedbackId?: string
  questionText: string
  answerText: string
  board: 'CBSE' | 'ICSE' | 'STATE_BOARD'
  classLevel: number
  subject: string
  chapter?: string
  topic?: string
  
  // Multi-dimensional scoring (0-100)
  accuracyScore: number
  completenessScore: number
  cbseAlignmentScore: number
  clarityScore: number
  citationQualityScore?: number
  
  // Overall assessment
  overallScore: number
  validationStatus: 'approved' | 'needs_improvement' | 'rejected'
  
  // Detailed feedback
  strengths?: string
  weaknesses?: string
  suggestions?: string
  improvementNotes?: string
  
  // Ground truth eligibility
  approvedForPreGeneration?: boolean
}

export async function POST(req: NextRequest) {
  try {
    // Authenticate teacher
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Verify teacher role and approval status
    const teacher = await executeQuerySingle<any>(
      'SELECT id, role, approval_status, email FROM users WHERE clerk_id = ?',
      [userId]
    )
    
    if (!teacher || teacher.role !== 'teacher' || teacher.approval_status !== 'approved') {
      return NextResponse.json(
        { error: 'Unauthorized - Teacher approval required' },
        { status: 403 }
      )
    }
    
    const body: TeacherValidateRequest = await req.json()
    
    // Validate required fields
    if (!body.questionText || !body.answerText || !body.board || !body.classLevel || !body.subject) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    if (!body.accuracyScore || !body.completenessScore || !body.cbseAlignmentScore || 
        !body.clarityScore || !body.overallScore || !body.validationStatus) {
      return NextResponse.json(
        { error: 'Missing validation scores or status' },
        { status: 400 }
      )
    }
    
    const validationId = uuidv4()
    
    // Insert into teacher_validation table
    await executeQuery(
      `INSERT INTO teacher_validation (
        validation_id,
        feedback_id,
        teacher_id,
        teacher_clerk_id,
        teacher_name,
        question_text,
        answer_text,
        board,
        class_level,
        subject,
        chapter,
        topic,
        accuracy_score,
        completeness_score,
        cbse_alignment_score,
        clarity_score,
        citation_quality_score,
        overall_score,
        validation_status,
        strengths,
        weaknesses,
        suggestions,
        improvement_notes,
        approved_for_pre_generation,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        validationId,
        body.feedbackId || null,
        teacher.id,
        userId,
        teacher.email,
        body.questionText,
        body.answerText,
        body.board,
        body.classLevel,
        body.subject,
        body.chapter || null,
        body.topic || null,
        body.accuracyScore,
        body.completenessScore,
        body.cbseAlignmentScore,
        body.clarityScore,
        body.citationQualityScore || null,
        body.overallScore,
        body.validationStatus,
        body.strengths || null,
        body.weaknesses || null,
        body.suggestions || null,
        body.improvementNotes || null,
        body.approvedForPreGeneration || false
      ]
    )
    
    console.log(`[Teacher Validation] Created validation: ${validationId} by ${teacher.email}`)
    
    // If approved and high quality, add to ground truth dataset
    if (body.validationStatus === 'approved' && 
        body.overallScore >= 85 && 
        body.approvedForPreGeneration) {
      
      const groundTruthId = uuidv4()
      
      await executeQuery(
        `INSERT INTO ground_truth_dataset (
          ground_truth_id,
          question_text,
          answer_text,
          board,
          class_level,
          subject,
          chapter,
          topic,
          validation_id,
          validated_by,
          accuracy_score,
          completeness_score,
          clarity_score,
          cbse_alignment_score,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          groundTruthId,
          body.questionText,
          body.answerText,
          body.board,
          body.classLevel,
          body.subject,
          body.chapter || null,
          body.topic || null,
          validationId,
          teacher.email,
          body.accuracyScore,
          body.completenessScore,
          body.clarityScore,
          body.cbseAlignmentScore
        ]
      )
      
      console.log(`[Ground Truth] Added Q&A pair: ${groundTruthId} from validation ${validationId}`)
      
      return NextResponse.json(
        {
          success: true,
          validationId,
          groundTruthId,
          message: 'Validation submitted and added to ground truth dataset'
        },
        { status: 201 }
      )
    }
    
    // Validation submitted but not added to ground truth
    return NextResponse.json(
      {
        success: true,
        validationId,
        message: 'Validation submitted successfully'
      },
      { status: 201 }
    )
    
  } catch (error) {
    console.error('[Teacher Validation] Error:', error)
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

