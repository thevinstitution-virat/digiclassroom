/**
 * Ground Truth Dataset List API
 * GET /api/ground-truth/list
 * 
 * Retrieves ground truth Q&A pairs with filtering
 */

import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db/connection'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const board = searchParams.get('board')
    const classLevel = searchParams.get('classLevel')
    const subject = searchParams.get('subject')
    const limit = parseInt(searchParams.get('limit') || '100')
    
    let query = `
      SELECT 
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
      FROM ground_truth_dataset
      WHERE 1=1
    `
    
    const params: any[] = []
    
    if (board) {
      query += ' AND board = ?'
      params.push(board)
    }
    
    if (classLevel) {
      query += ' AND class_level = ?'
      params.push(parseInt(classLevel))
    }
    
    if (subject) {
      query += ' AND subject = ?'
      params.push(subject)
    }
    
    query += ' ORDER BY created_at DESC LIMIT ?'
    params.push(limit)
    
    const results = await executeQuery(query, params)
    
    return NextResponse.json(
      {
        success: true,
        count: Array.isArray(results) ? results.length : 0,
        data: results
      },
      { status: 200 }
    )
    
  } catch (error) {
    console.error('[Ground Truth] List error:', error)
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

