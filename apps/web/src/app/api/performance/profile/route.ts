/**
 * Performance Profiling API Endpoint
 * POST /api/performance/profile
 * 
 * Stores performance profiling data for AI answer generation pipeline
 * 
 * Features:
 * - Tracks timing breakdown for all pipeline stages
 * - Tracks token usage (prompt, completion, cached)
 * - Identifies bottlenecks (stages taking >40% of total time)
 * - Auto-creates performance alerts for slow stages
 * - Stores data in performance_profiling table
 */

import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db/connection'
import { v4 as uuidv4 } from 'uuid'

interface PerformanceProfile {
  feedbackId: string
  totalTime: number
  stages: {
    queryAnalysis?: number
    embedding?: number
    retrieval?: number
    reranking?: number
    generation?: number
    ragas?: number
    caching?: number
    postProcessing?: number
    [key: string]: number | undefined
  }
  tokens: {
    prompt: number
    completion: number
    cached: number
  }
  cacheHits: {
    embedding?: boolean
    retrieval?: boolean
    answer?: boolean
    [key: string]: boolean | undefined
  }
}

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const profile: PerformanceProfile = await req.json()
    
    // Validate inputs
    if (!profile.feedbackId || !profile.totalTime || !profile.stages || !profile.tokens) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          details: 'feedbackId, totalTime, stages, and tokens are required'
        },
        { status: 400 }
      )
    }
    
    console.log(`[Performance API] Profiling feedback ${profile.feedbackId} - Total: ${profile.totalTime}ms`)
    
    // Generate profile ID
    const profileId = uuidv4()
    
    // Store performance data
    await storePerformanceProfile(profileId, profile)
    
    // Identify bottlenecks
    const bottlenecks = identifyBottlenecks(profile)
    
    // Create alerts for bottlenecks
    if (bottlenecks.length > 0) {
      await createBottleneckAlerts(profile.feedbackId, bottlenecks, profile.totalTime)
    }
    
    return NextResponse.json(
      {
        success: true,
        profileId,
        bottlenecks,
        totalTime: profile.totalTime
      },
      { status: 201 }
    )
    
  } catch (error) {
    console.error('[Performance API] Profiling error:', error)
    
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
 * Store performance profile in database
 */
async function storePerformanceProfile(
  profileId: string,
  profile: PerformanceProfile
): Promise<void> {
  try {
    await executeQuery(
      `INSERT INTO performance_profiling (
        profile_id,
        feedback_id,
        total_time_ms,
        query_analysis_time_ms,
        embedding_time_ms,
        retrieval_time_ms,
        reranking_time_ms,
        generation_time_ms,
        ragas_time_ms,
        caching_time_ms,
        post_processing_time_ms,
        prompt_tokens,
        completion_tokens,
        cached_tokens,
        embedding_cache_hit,
        retrieval_cache_hit,
        answer_cache_hit,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        profileId,
        profile.feedbackId,
        profile.totalTime,
        profile.stages.queryAnalysis || 0,
        profile.stages.embedding || 0,
        profile.stages.retrieval || 0,
        profile.stages.reranking || 0,
        profile.stages.generation || 0,
        profile.stages.ragas || 0,
        profile.stages.caching || 0,
        profile.stages.postProcessing || 0,
        profile.tokens.prompt,
        profile.tokens.completion,
        profile.tokens.cached,
        profile.cacheHits.embedding || false,
        profile.cacheHits.retrieval || false,
        profile.cacheHits.answer || false
      ]
    )
    
    console.log(`[Performance API] Stored profile ${profileId}`)
    
  } catch (error) {
    console.error('[Performance API] Failed to store profile:', error)
    throw error
  }
}

/**
 * Identify bottlenecks (stages taking >40% of total time)
 */
function identifyBottlenecks(profile: PerformanceProfile): string[] {
  const bottlenecks: string[] = []
  const threshold = profile.totalTime * 0.4 // 40% threshold
  
  for (const [stage, time] of Object.entries(profile.stages)) {
    if (time && time > threshold) {
      bottlenecks.push(stage)
      console.log(`[Performance API] Bottleneck detected: ${stage} (${time}ms / ${profile.totalTime}ms = ${((time / profile.totalTime) * 100).toFixed(1)}%)`)
    }
  }
  
  return bottlenecks
}

/**
 * Create performance alerts for bottlenecks
 */
async function createBottleneckAlerts(
  feedbackId: string,
  bottlenecks: string[],
  totalTime: number
): Promise<void> {
  for (const stage of bottlenecks) {
    try {
      await executeQuery(
        `INSERT INTO quality_alerts (
          alert_id,
          alert_type,
          severity,
          feedback_id,
          metric_value,
          threshold,
          message,
          status,
          created_at
        ) VALUES (?, 'performance_bottleneck', 'medium', ?, ?, 0.4, ?, 'active', NOW())`,
        [
          uuidv4(),
          feedbackId,
          totalTime,
          `Performance bottleneck detected in ${stage} stage`
        ]
      )
      
      console.log(`[Performance API] Created bottleneck alert for ${stage}`)
      
    } catch (error) {
      console.error('[Performance API] Failed to create alert:', error)
      // Continue with other alerts
    }
  }
}

