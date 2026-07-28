/**
 * Start Experiment API
 * POST /api/experiments/start
 * 
 * Activates an experiment to start collecting data
 */

import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db/connection'

interface StartExperimentRequest {
  experimentId: string
}

export async function POST(req: NextRequest) {
  try {
    const body: StartExperimentRequest = await req.json()
    
    if (!body.experimentId) {
      return NextResponse.json(
        { error: 'experimentId is required' },
        { status: 400 }
      )
    }
    
    // Check if experiment exists and is in draft status
    const experiments = await executeQuery(
      `SELECT status FROM experiments WHERE experiment_id = ?`,
      [body.experimentId]
    )
    
    if (experiments.length === 0) {
      return NextResponse.json(
        { error: 'Experiment not found' },
        { status: 404 }
      )
    }
    
    if (experiments[0].status !== 'draft') {
      return NextResponse.json(
        { error: `Cannot start experiment with status: ${experiments[0].status}` },
        { status: 400 }
      )
    }
    
    // Update status to active
    await executeQuery(
      `UPDATE experiments 
       SET status = 'active', started_at = NOW()
       WHERE experiment_id = ?`,
      [body.experimentId]
    )
    
    console.log(`[Experiments API] Started experiment: ${body.experimentId}`)
    
    return NextResponse.json(
      {
        success: true,
        experimentId: body.experimentId,
        status: 'active',
        message: 'Experiment started successfully'
      },
      { status: 200 }
    )
    
  } catch (error) {
    console.error('[Experiments API] Start error:', error)
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

