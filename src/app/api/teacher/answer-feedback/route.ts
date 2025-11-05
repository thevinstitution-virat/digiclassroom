/**
 * Teacher Answer Feedback API
 * GET /api/teacher/answer-feedback
 * 
 * Fetches answer feedback items for teacher validation
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getPool } from '@/lib/db/connection'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    // Authenticate teacher
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get query parameters
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'pending'
    const limit = parseInt(searchParams.get('limit') || '50')

    const pool = getPool()
    const connection = await pool.getConnection()

    try {
      let query = `
        SELECT 
          id,
          question_text as questionText,
          answer_text as answerText,
          subject,
          class_level as classLevel,
          board,
          star_rating as starRating,
          thumbs_rating as thumbsRating,
          feedback_text as feedbackText,
          created_at as createdAt,
          user_id as userId,
          COALESCE(validation_status, 'pending') as validationStatus
        FROM answer_feedback
      `

      const params: any[] = []

      // Filter by validation status
      if (status === 'pending') {
        query += ` WHERE (validation_status IS NULL OR validation_status = 'pending')`
      } else if (status === 'validated') {
        query += ` WHERE validation_status = 'validated'`
      } else if (status === 'rejected') {
        query += ` WHERE validation_status = 'rejected'`
      }
      // 'all' - no filter

      // Order by created date (newest first)
      query += ` ORDER BY created_at DESC LIMIT ?`
      params.push(limit)

      const [rows] = await connection.query(query, params)

      return NextResponse.json({
        success: true,
        items: rows,
        count: (rows as any[]).length
      })

    } finally {
      connection.release()
    }

  } catch (error) {
    console.error('❌ Error fetching answer feedback:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch answer feedback',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

