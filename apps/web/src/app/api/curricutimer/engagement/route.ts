/**
 * CurricuTimer Engagement API
 * Tracks and saves user engagement metrics during study sessions
 */

import { NextRequest, NextResponse } from 'next/server'

// Mock database for engagement metrics
const mockEngagementDB = {
  metrics: new Map(),
  
  saveMetrics: (data: any) => {
    const id = `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const metric = {
      id,
      ...data,
      recordedAt: new Date().toISOString()
    }
    mockEngagementDB.metrics.set(id, metric)
    return metric
  },
  
  getSessionMetrics: (sessionId: string) => {
    return Array.from(mockEngagementDB.metrics.values())
      .filter(metric => metric.sessionId === sessionId)
  },
  
  getUserMetrics: (userId: string, limit = 50) => {
    return Array.from(mockEngagementDB.metrics.values())
      .filter(metric => metric.userId === userId)
      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())
      .slice(0, limit)
  }
}

// POST /api/curricutimer/engagement - Save engagement metrics
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, userId, metrics, engagementScore } = body

    // Validate required fields
    if (!sessionId || !metrics) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: sessionId, metrics'
      }, { status: 400 })
    }

    // Validate metrics structure
    const requiredMetrics = ['activeTime', 'idleTime', 'interactions', 'focusEvents']
    for (const metric of requiredMetrics) {
      if (typeof metrics[metric] !== 'number') {
        return NextResponse.json({
          success: false,
          error: `Invalid metric: ${metric} must be a number`
        }, { status: 400 })
      }
    }

    // Calculate engagement score if not provided
    let calculatedScore = engagementScore
    if (typeof calculatedScore !== 'number') {
      calculatedScore = calculateEngagementScore(metrics)
    }

    // Save metrics
    const savedMetric = mockEngagementDB.saveMetrics({
      sessionId,
      userId: userId || 'unknown',
      activeTime: metrics.activeTime,
      idleTime: metrics.idleTime,
      interactions: metrics.interactions,
      focusEvents: metrics.focusEvents,
      engagementScore: calculatedScore
    })

    // Update session with engagement score (mock update)
    // In real implementation, this would update the sessions table
    console.log(`Updated session ${sessionId} with engagement score: ${calculatedScore}`)

    return NextResponse.json({
      success: true,
      metricId: savedMetric.id,
      engagementScore: calculatedScore,
      analysis: analyzeEngagement(metrics, calculatedScore)
    })

  } catch (error) {
    console.error('Error saving engagement metrics:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to save engagement metrics'
    }, { status: 500 })
  }
}

// GET /api/curricutimer/engagement - Get engagement analytics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const sessionId = searchParams.get('sessionId')
    const days = parseInt(searchParams.get('days') || '7')

    if (!userId && !sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Either userId or sessionId is required'
      }, { status: 400 })
    }

    let metrics: any[] = []
    
    if (sessionId) {
      metrics = mockEngagementDB.getSessionMetrics(sessionId)
    } else if (userId) {
      metrics = mockEngagementDB.getUserMetrics(userId)
      
      // Filter by days if specified
      if (days > 0) {
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - days)
        metrics = metrics.filter(m => new Date(m.recordedAt) >= cutoffDate)
      }
    }

    // Calculate analytics
    const analytics = calculateAnalytics(metrics)

    return NextResponse.json({
      success: true,
      metrics: metrics.map(m => ({
        id: m.id,
        sessionId: m.sessionId,
        activeTime: m.activeTime,
        idleTime: m.idleTime,
        interactions: m.interactions,
        focusEvents: m.focusEvents,
        engagementScore: m.engagementScore,
        recordedAt: m.recordedAt
      })),
      analytics
    })

  } catch (error) {
    console.error('Error fetching engagement metrics:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch engagement metrics'
    }, { status: 500 })
  }
}

/**
 * Calculate engagement score from metrics
 */
function calculateEngagementScore(metrics: any): number {
  const { activeTime, idleTime, interactions, focusEvents } = metrics
  const totalTime = activeTime + idleTime
  
  if (totalTime === 0)
  return 0

  const activeRatio = activeTime / totalTime
  const interactionDensity = totalTime > 0 ? interactions / (totalTime / 60) : 0 // per minute
  const focusDensity = totalTime > 0 ? focusEvents / (totalTime / 60) : 0 // per minute

  // Weighted scoring
  const activeScore = activeRatio * 70 // 70% weight for active time
  const interactionScore = Math.min(interactionDensity * 2, 20) // 20% weight (capped)
  const focusScore = Math.min(focusDensity * 5, 10) // 10% weight (capped)

  return Math.min(100, Math.max(0, activeScore + interactionScore + focusScore))
}

/**
 * Analyze engagement patterns
 */
function analyzeEngagement(metrics: any, score: number) {
  const { activeTime, idleTime, interactions, focusEvents } = metrics
  const totalTime = activeTime + idleTime
  
  const analysis = {
    level: score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'fair' : 'poor',
    activePercentage: totalTime > 0 ? Math.round((activeTime / totalTime) * 100) : 0,
    interactionRate: totalTime > 0 ? Math.round((interactions / (totalTime / 60)) * 10) / 10 : 0,
    focusRate: totalTime > 0 ? Math.round((focusEvents / (totalTime / 60)) * 10) / 10 : 0,
    recommendations: [] as string[]
  }

  // Generate recommendations
  if (analysis.activePercentage < 60) {
    analysis.recommendations.push('Try to minimize distractions during study sessions')
  }
  
  if (analysis.interactionRate < 1) {
    analysis.recommendations.push('Engage more actively with the material - take notes or solve problems')
  }
  
  if (analysis.focusRate < 0.5) {
    analysis.recommendations.push('Consider shorter study sessions to maintain focus')
  }
  
  if (score >= 80) {
    analysis.recommendations.push('Excellent focus! Consider increasing session duration')
  }

  return analysis
}

/**
 * Calculate comprehensive analytics
 */
function calculateAnalytics(metrics: any[]) {
  if (metrics.length === 0) {
    return {
      totalSessions: 0,
      averageEngagement: 0,
      trend: 'neutral',
      bestPerformanceTime: null,
      improvementAreas: []
    }
  }

  const totalSessions = metrics.length
  const averageEngagement = metrics.reduce((sum, m) => sum + m.engagementScore, 0) / totalSessions
  
  // Calculate trend (last 3 vs previous 3)
  let trend = 'neutral'
  if (metrics.length >= 6) {
    const recent = metrics.slice(0, 3).reduce((sum, m) => sum + m.engagementScore, 0) / 3
    const previous = metrics.slice(3, 6).reduce((sum, m) => sum + m.engagementScore, 0) / 3
    
    if (recent > previous + 5) trend = 'improving'
    else if (recent < previous - 5) trend = 'declining'
  }

  // Find best performance time (mock - would analyze actual timestamps)
  const bestPerformanceTime = '9:00 AM - 11:00 AM'

  // Identify improvement areas
  const improvementAreas = []
  const avgActiveRatio = metrics.reduce((sum, m) => {
    const total = m.activeTime + m.idleTime
    return sum + (total > 0 ? m.activeTime / total : 0)
  }, 0) / metrics.length

  if (avgActiveRatio < 0.7) {
    improvementAreas.push('Focus and attention')
  }
  
  const avgInteractionRate = metrics.reduce((sum, m) => {
    const total = m.activeTime + m.idleTime
    return sum + (total > 0 ? m.interactions / (total / 60) : 0)
  }, 0) / metrics.length

  if (avgInteractionRate < 2) {
    improvementAreas.push('Active engagement')
  }

  return {
    totalSessions,
    averageEngagement: Math.round(averageEngagement),
    trend,
    bestPerformanceTime,
    improvementAreas,
    weeklyProgress: metrics.slice(0, 7).map(m => ({
      date: m.recordedAt,
      score: m.engagementScore
    }))
  }
}
