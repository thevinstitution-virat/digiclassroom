/**
 * Teacher Answer Feedback API
 * GET /api/teacher/answer-feedback
 * 
 * Fetches answer feedback items for teacher validation
 * Migrated to Drizzle ORM (Phase 4)
 */

import { auth } from '@/auth';
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { answerFeedback } from '@/db/schema'
import { eq, isNull, sql, desc } from 'drizzle-orm'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    // Authenticate teacher using BetterAuth
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get query parameters
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'pending'
    const limit = parseInt(searchParams.get('limit') || '50')

    // Build where condition based on status filter
    let whereCondition;
    if (status === 'pending') {
      whereCondition = sql`(${answerFeedback.validationStatus} IS NULL OR ${answerFeedback.validationStatus} = 'pending')`
    } else if (status === 'validated') {
      whereCondition = eq(answerFeedback.validationStatus, 'validated')
    } else if (status === 'rejected') {
      whereCondition = eq(answerFeedback.validationStatus, 'rejected')
    }
    // 'all' - no filter

    const query = db
      .select({
        id: answerFeedback.id,
        questionText: answerFeedback.questionText,
        answerText: answerFeedback.answerText,
        subject: answerFeedback.subject,
        classLevel: answerFeedback.classLevel,
        board: answerFeedback.board,
        starRating: answerFeedback.starRating,
        thumbsRating: answerFeedback.thumbsRating,
        feedbackText: answerFeedback.feedbackText,
        createdAt: answerFeedback.createdAt,
        userId: answerFeedback.userId,
        validationStatus: answerFeedback.validationStatus,
      })
      .from(answerFeedback)

    const rows = whereCondition
      ? await query.where(whereCondition).orderBy(desc(answerFeedback.createdAt)).limit(limit)
      : await query.orderBy(desc(answerFeedback.createdAt)).limit(limit)

    return NextResponse.json({
      success: true,
      items: rows,
      count: rows.length
    })

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
