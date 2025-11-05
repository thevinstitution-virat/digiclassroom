/**
 * CurricuTimer Sessions API
 * Manages study session creation, updates, and completion
 */

import { NextRequest, NextResponse } from 'next/server'

// Mock database functions (replace with actual database calls)
const mockDatabase = {
  sessions: new Map(),
  
  createSession: (sessionData: any) => {
    const id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const session = {
      id,
      ...sessionData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    mockDatabase.sessions.set(id, session)
    return session
  },
  
  updateSession: (id: string, updates: any) => {
    const session = mockDatabase.sessions.get(id)
    if (!session) return null
    
    const updatedSession = {
      ...session,
      ...updates,
      updatedAt: new Date().toISOString()
    }
    mockDatabase.sessions.set(id, updatedSession)
    return updatedSession
  },
  
  getSession: (id: string) => {
    return mockDatabase.sessions.get(id) || null
  },
  
  getUserSessions: (userId: string, limit = 10) => {
    return Array.from(mockDatabase.sessions.values())
      .filter(session => session.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit)
  }
}

// POST /api/curricutimer/sessions - Create new session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, topic, subject, grade, board, duration, startTime } = body

    // Validate required fields
    if (!userId || !topic || !subject || !grade || !board || !duration) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields'
      }, { status: 400 })
    }

    // Create session
    const session = mockDatabase.createSession({
      userId,
      topic,
      subject,
      grade: parseInt(grade),
      board,
      duration: parseInt(duration),
      startTime: startTime || new Date().toISOString(),
      endTime: null,
      completed: false,
      engagementScore: null,
      activeTime: 0,
      idleTime: 0,
      interactions: 0,
      focusEvents: 0
    })

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      session: {
        id: session.id,
        topic: session.topic,
        subject: session.subject,
        duration: session.duration,
        startTime: session.startTime
      }
    })

  } catch (error) {
    console.error('Error creating session:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to create session'
    }, { status: 500 })
  }
}

// GET /api/curricutimer/sessions - Get user sessions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const limit = parseInt(searchParams.get('limit') || '10')

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'Missing userId parameter'
      }, { status: 400 })
    }

    const sessions = mockDatabase.getUserSessions(userId, limit)

    // Calculate statistics
    const stats = {
      totalSessions: sessions.length,
      completedSessions: sessions.filter(s => s.completed).length,
      totalStudyTime: sessions.reduce((sum, s) => sum + (s.duration || 0), 0),
      averageEngagement: sessions.length > 0 
        ? sessions.reduce((sum, s) => sum + (s.engagementScore || 0), 0) / sessions.length 
        : 0,
      lastSessionDate: sessions.length > 0 ? sessions[0].createdAt : null
    }

    return NextResponse.json({
      success: true,
      sessions: sessions.map(session => ({
        id: session.id,
        topic: session.topic,
        subject: session.subject,
        duration: session.duration,
        completed: session.completed,
        engagementScore: session.engagementScore,
        startTime: session.startTime,
        endTime: session.endTime,
        createdAt: session.createdAt
      })),
      stats
    })

  } catch (error) {
    console.error('Error fetching sessions:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch sessions'
    }, { status: 500 })
  }
}

// PUT /api/curricutimer/sessions - Update session
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, updates } = body

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Missing sessionId'
      }, { status: 400 })
    }

    const session = mockDatabase.getSession(sessionId)
    if (!session) {
      return NextResponse.json({
        success: false,
        error: 'Session not found'
      }, { status: 404 })
    }

    // Update session
    const updatedSession = mockDatabase.updateSession(sessionId, updates)

    return NextResponse.json({
      success: true,
      session: {
        id: updatedSession.id,
        topic: updatedSession.topic,
        subject: updatedSession.subject,
        duration: updatedSession.duration,
        completed: updatedSession.completed,
        engagementScore: updatedSession.engagementScore,
        startTime: updatedSession.startTime,
        endTime: updatedSession.endTime
      }
    })

  } catch (error) {
    console.error('Error updating session:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to update session'
    }, { status: 500 })
  }
}
