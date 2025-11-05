// VG Kosh Practest Engine - Test History API

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { PractestSessionQueries } from '@/lib/db/practest-session-queries'

export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    console.log('📊 Fetching test history for user:', userId, { page, limit })

    // Get user's test history
    const { sessions, total } = await PractestSessionQueries.getUserTestHistory(
      userId,
      limit,
      (page - 1) * limit
    )

    // Transform sessions for response
    const transformedSessions = sessions.map(session => ({
      id: session.id,
      subject: session.custom_parameters?.subject || 'Unknown',
      class_level: session.custom_parameters?.class_level || 0,
      board: session.custom_parameters?.board || 'Unknown',
      questions_total: session.selected_questions.length,
      questions_attempted: session.user_responses.length,
      total_score: session.total_score,
      max_possible_score: session.max_possible_score,
      percentage: session.percentage,
      duration_seconds: session.duration_seconds,
      status: session.status,
      created_at: session.created_at,
      completed_at: session.end_time
    }))

    console.log('✅ Test history retrieved:', {
      userId,
      sessionsCount: transformedSessions.length,
      totalSessions: total
    })

    return NextResponse.json({
      success: true,
      sessions: transformedSessions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('❌ Failed to get test history:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}
