/**
 * List Experiments API
 * GET /api/experiments/list?status=active
 * 
 * Lists all experiments with optional status filter
 */

import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db/connection'

export async function GET(req: NextRequest) {
  try {
    const status = req.nextUrl.searchParams.get('status')
    
    let query = `
      SELECT 
        e.experiment_id,
        e.experiment_name,
        e.experiment_type,
        e.status,
        e.primary_metric,
        e.min_sample_size,
        e.created_at,
        e.started_at,
        e.completed_at,
        COUNT(DISTINCT CASE WHEN ea.variant = 'A' THEN ea.user_id END) as variant_a_users,
        COUNT(DISTINCT CASE WHEN ea.variant = 'B' THEN ea.user_id END) as variant_b_users,
        COUNT(DISTINCT CASE WHEN af.experiment_variant = 'A' THEN af.feedback_id END) as variant_a_samples,
        COUNT(DISTINCT CASE WHEN af.experiment_variant = 'B' THEN af.feedback_id END) as variant_b_samples
      FROM experiments e
      LEFT JOIN experiment_assignments ea ON e.experiment_id = ea.experiment_id
      LEFT JOIN answer_feedback af ON e.experiment_id = af.experiment_id
    `
    
    const params: any[] = []
    
    if (status) {
      query += ` WHERE e.status = ?`
      params.push(status)
    }
    
    query += ` GROUP BY e.experiment_id ORDER BY e.created_at DESC`
    
    const results = await executeQuery(query, params)
    
    const experiments = results.map((row: any) => ({
      experimentId: row.experiment_id,
      experimentName: row.experiment_name,
      experimentType: row.experiment_type,
      status: row.status,
      primaryMetric: row.primary_metric,
      minSampleSize: row.min_sample_size,
      variantA: {
        users: row.variant_a_users,
        samples: row.variant_a_samples
      },
      variantB: {
        users: row.variant_b_users,
        samples: row.variant_b_samples
      },
      totalSamples: row.variant_a_samples + row.variant_b_samples,
      progress: Math.min(
        100,
        Math.floor(
          ((row.variant_a_samples + row.variant_b_samples) / (row.min_sample_size * 2)) * 100
        )
      ),
      createdAt: row.created_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      daysRunning: row.started_at 
        ? Math.floor((Date.now() - new Date(row.started_at).getTime()) / (1000 * 60 * 60 * 24))
        : 0
    }))
    
    return NextResponse.json(
      {
        success: true,
        count: experiments.length,
        experiments
      },
      { status: 200 }
    )
    
  } catch (error) {
    console.error('[Experiments API] List error:', error)
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

