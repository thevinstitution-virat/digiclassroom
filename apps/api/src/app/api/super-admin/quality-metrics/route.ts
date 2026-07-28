/**
 * Quality Metrics Dashboard API
 * GET /api/super-admin/quality-metrics
 * 
 * Provides real-time quality metrics for admin dashboard
 * 
 * Features:
 * - 8 key quality metrics
 * - Time window filtering (1h, 24h, 7d, 30d)
 * - Active alerts panel data
 * - Performance breakdown
 * - Query execution time < 200ms
 */

import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db/connection'
import { requirePlatformStaff } from '@/lib/auth/require-platform-staff'

interface QualityMetrics {
  timeWindow: string
  metrics: {
    avgUserRating: number
    avgFaithfulness: number
    avgRelevance: number
    avgResponseTime: number
    totalAnswers: number
    cacheHitRate: number
    alertCount: number
    satisfactionRate: number
  }
  alerts: Array<{
    alertId: string
    type: string
    severity: string
    message: string
    createdAt: string
    feedbackId: string
  }>
  performanceBreakdown: {
    queryAnalysis: number
    embedding: number
    retrieval: number
    reranking: number
    generation: number
    ragas: number
    caching: number
    postProcessing: number
  }
  trends: {
    userRating: Array<{ date: string; value: number }>
    faithfulness: Array<{ date: string; value: number }>
    relevance: Array<{ date: string; value: number }>
  }
}

export async function GET(req: NextRequest) {
  const guard = await requirePlatformStaff()
  if (!guard.ok) return guard.response

  const startTime = Date.now()

  try {
    // Get time window from query params (default: 24h)
    const { searchParams } = new URL(req.url)
    const timeWindow = searchParams.get('window') || '24h'
    
    // Calculate time range
    const hours = parseTimeWindow(timeWindow)
    
    console.log(`[Quality Metrics API] Fetching metrics for ${timeWindow} window`)
    
    // Fetch all metrics in parallel
    const [metrics, alerts, performanceBreakdown, trends] = await Promise.all([
      fetchMetrics(hours),
      fetchActiveAlerts(),
      fetchPerformanceBreakdown(hours),
      fetchTrends(hours)
    ])
    
    const response: QualityMetrics = {
      timeWindow,
      metrics,
      alerts,
      performanceBreakdown,
      trends
    }
    
    const executionTime = Date.now() - startTime
    console.log(`[Quality Metrics API] Metrics fetched in ${executionTime}ms`)
    
    return NextResponse.json(response, { status: 200 })
    
  } catch (error) {
    console.error('[Quality Metrics API] Error:', error)
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Parse time window string to hours
 */
function parseTimeWindow(window: string): number {
  const map: Record<string, number> = {
    '1h': 1,
    '24h': 24,
    '7d': 168,
    '30d': 720
  }
  return map[window] || 24
}

/**
 * Fetch core quality metrics
 */
async function fetchMetrics(hours: number): Promise<any> {
  const results = await executeQuery<any>(
    `SELECT 
      COUNT(*) as total_answers,
      AVG(star_rating) as avg_rating,
      AVG(faithfulness_score) as avg_faithfulness,
      AVG(relevance_score) as avg_relevance,
      AVG(total_time_ms) as avg_response_time,
      SUM(CASE WHEN answer_cache_hit = 1 THEN 1 ELSE 0 END) / COUNT(*) as cache_hit_rate,
      SUM(CASE WHEN star_rating >= 4 THEN 1 ELSE 0 END) / COUNT(*) as satisfaction_rate
    FROM answer_feedback
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)`,
    [hours]
  )
  
  const row = results[0] || {}
  
  // Get alert count
  const alertResults = await executeQuery<any>(
    `SELECT COUNT(*) as count
    FROM quality_alerts
    WHERE status = 'active'
      AND created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)`,
    [hours]
  )
  
  return {
    avgUserRating: parseFloat(row.avg_rating || 0).toFixed(2),
    avgFaithfulness: parseFloat(row.avg_faithfulness || 0).toFixed(3),
    avgRelevance: parseFloat(row.avg_relevance || 0).toFixed(3),
    avgResponseTime: parseInt(row.avg_response_time || 0),
    totalAnswers: parseInt(row.total_answers || 0),
    cacheHitRate: parseFloat(row.cache_hit_rate || 0).toFixed(2),
    alertCount: parseInt(alertResults[0]?.count || 0),
    satisfactionRate: parseFloat(row.satisfaction_rate || 0).toFixed(2)
  }
}

/**
 * Fetch active alerts
 */
async function fetchActiveAlerts(): Promise<any[]> {
  const results = await executeQuery<any>(
    `SELECT 
      alert_id,
      alert_type,
      severity,
      message,
      created_at,
      feedback_id
    FROM quality_alerts
    WHERE status = 'active'
    ORDER BY created_at DESC
    LIMIT 20`,
    []
  )
  
  return results.map(row => ({
    alertId: row.alert_id,
    type: row.alert_type,
    severity: row.severity,
    message: row.message,
    createdAt: row.created_at,
    feedbackId: row.feedback_id
  }))
}

/**
 * Fetch performance breakdown
 */
async function fetchPerformanceBreakdown(hours: number): Promise<any> {
  const results = await executeQuery<any>(
    `SELECT 
      AVG(query_analysis_time_ms) as query_analysis,
      AVG(embedding_time_ms) as embedding,
      AVG(retrieval_time_ms) as retrieval,
      AVG(reranking_time_ms) as reranking,
      AVG(generation_time_ms) as generation,
      AVG(ragas_time_ms) as ragas,
      AVG(caching_time_ms) as caching,
      AVG(post_processing_time_ms) as post_processing
    FROM performance_profiling
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)`,
    [hours]
  )
  
  const row = results[0] || {}
  
  return {
    queryAnalysis: parseInt(row.query_analysis || 0),
    embedding: parseInt(row.embedding || 0),
    retrieval: parseInt(row.retrieval || 0),
    reranking: parseInt(row.reranking || 0),
    generation: parseInt(row.generation || 0),
    ragas: parseInt(row.ragas || 0),
    caching: parseInt(row.caching || 0),
    postProcessing: parseInt(row.post_processing || 0)
  }
}

/**
 * Fetch trends data for charts
 */
async function fetchTrends(hours: number): Promise<any> {
  // Determine grouping interval based on time window
  const interval = hours <= 24 ? 'HOUR' : 'DAY'
  
  const results = await executeQuery<any>(
    `SELECT 
      DATE_FORMAT(created_at, ${interval === 'HOUR' ? "'%Y-%m-%d %H:00'" : "'%Y-%m-%d'"}) as date,
      AVG(star_rating) as avg_rating,
      AVG(faithfulness_score) as avg_faithfulness,
      AVG(relevance_score) as avg_relevance
    FROM answer_feedback
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? ${interval})
    GROUP BY date
    ORDER BY date ASC`,
    [hours]
  )
  
  return {
    userRating: results.map(r => ({ date: r.date, value: parseFloat(r.avg_rating || 0) })),
    faithfulness: results.map(r => ({ date: r.date, value: parseFloat(r.avg_faithfulness || 0) })),
    relevance: results.map(r => ({ date: r.date, value: parseFloat(r.avg_relevance || 0) }))
  }
}

