/**
 * Ground Truth Dataset API
 * POST /api/ground-truth/add
 * 
 * Adds validated Q&A pairs to ground truth dataset
 * Automatically triggered when teacher approves validation
 */

import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db/connection'
import { v4 as uuidv4 } from 'uuid'

interface AddGroundTruthRequest {
  questionText: string
  answerText: string
  board: 'CBSE' | 'ICSE' | 'STATE_BOARD'
  classLevel: number
  subject: string
  chapter?: string
  topic?: string
  validationId?: string
  validatedBy?: string
  accuracyScore?: number
  completenessScore?: number
  clarityScore?: number
  cbseAlignmentScore?: number
}

export async function POST(req: NextRequest) {
  try {
    const body: AddGroundTruthRequest = await req.json()
    
    // Validate required fields
    if (!body.questionText || !body.answerText || !body.board || !body.classLevel || !body.subject) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    const groundTruthId = uuidv4()
    
    // Insert into ground_truth_dataset table
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
        body.validationId || null,
        body.validatedBy || null,
        body.accuracyScore || null,
        body.completenessScore || null,
        body.clarityScore || null,
        body.cbseAlignmentScore || null
      ]
    )
    
    console.log(`[Ground Truth] Added Q&A pair: ${groundTruthId}`)
    
    return NextResponse.json(
      {
        success: true,
        groundTruthId,
        message: 'Q&A pair added to ground truth dataset'
      },
      { status: 201 }
    )
    
  } catch (error) {
    console.error('[Ground Truth] Add error:', error)
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

