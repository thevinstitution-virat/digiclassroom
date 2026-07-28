/**
 * Create Experiment API
 * POST /api/experiments/create
 * 
 * Creates a new A/B test experiment
 */

import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db/connection'
import { v4 as uuidv4 } from 'uuid'

interface CreateExperimentRequest {
  experimentName: string
  experimentType: 'embedding_model' | 'chunk_count' | 'retrieval_strategy' | 'prompt_variation' | 'custom'
  description?: string
  hypothesis?: string
  variantAConfig: Record<string, any>
  variantBConfig: Record<string, any>
  trafficSplitPercentage?: number
  primaryMetric: string
  secondaryMetrics?: string[]
  successThreshold?: number
  minSampleSize?: number
  createdBy?: string
  notes?: string
}

export async function POST(req: NextRequest) {
  try {
    const body: CreateExperimentRequest = await req.json()
    
    // Validate required fields
    if (!body.experimentName || !body.experimentType || !body.variantAConfig || !body.variantBConfig || !body.primaryMetric) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          details: 'experimentName, experimentType, variantAConfig, variantBConfig, and primaryMetric are required'
        },
        { status: 400 }
      )
    }
    
    const experimentId = uuidv4()
    
    // Insert experiment into database
    await executeQuery(
      `INSERT INTO experiments (
        experiment_id,
        experiment_name,
        experiment_type,
        description,
        hypothesis,
        variant_a_config,
        variant_b_config,
        traffic_split_percentage,
        status,
        primary_metric,
        secondary_metrics,
        success_threshold,
        min_sample_size,
        created_by,
        notes,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, NOW())`,
      [
        experimentId,
        body.experimentName,
        body.experimentType,
        body.description || null,
        body.hypothesis || null,
        JSON.stringify(body.variantAConfig),
        JSON.stringify(body.variantBConfig),
        body.trafficSplitPercentage || 50,
        body.primaryMetric,
        body.secondaryMetrics ? JSON.stringify(body.secondaryMetrics) : null,
        body.successThreshold || null,
        body.minSampleSize || 100,
        body.createdBy || 'system',
        body.notes || null
      ]
    )
    
    console.log(`[Experiments API] Created experiment: ${experimentId}`)
    
    return NextResponse.json(
      {
        success: true,
        experimentId,
        message: 'Experiment created successfully',
        status: 'draft'
      },
      { status: 201 }
    )
    
  } catch (error) {
    console.error('[Experiments API] Create error:', error)
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

