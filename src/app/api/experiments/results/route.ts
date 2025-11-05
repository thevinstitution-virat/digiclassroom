/**
 * Experiment Results API
 * GET /api/experiments/results?experimentId=xxx
 * 
 * Analyzes experiment results with statistical significance testing
 */

import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db/connection'
import { compareVariants, ExperimentData } from '@/lib/experiments/statistics'

export async function GET(req: NextRequest) {
  try {
    const experimentId = req.nextUrl.searchParams.get('experimentId')
    
    if (!experimentId) {
      return NextResponse.json(
        { error: 'experimentId parameter is required' },
        { status: 400 }
      )
    }
    
    // Get experiment details
    const experiments = await executeQuery(
      `SELECT * FROM experiments WHERE experiment_id = ?`,
      [experimentId]
    )
    
    if (experiments.length === 0) {
      return NextResponse.json(
        { error: 'Experiment not found' },
        { status: 404 }
      )
    }
    
    const experiment = experiments[0]
    const primaryMetric = experiment.primary_metric
    
    // Get results for variant A
    const variantAResults = await executeQuery(
      `SELECT ${primaryMetric}, rating, faithfulness_score, relevance_score, 
              context_precision_score, context_recall_score, response_time_ms
       FROM answer_feedback
       WHERE experiment_id = ? AND experiment_variant = 'A'
       AND ${primaryMetric} IS NOT NULL`,
      [experimentId]
    )
    
    // Get results for variant B
    const variantBResults = await executeQuery(
      `SELECT ${primaryMetric}, rating, faithfulness_score, relevance_score,
              context_precision_score, context_recall_score, response_time_ms
       FROM answer_feedback
       WHERE experiment_id = ? AND experiment_variant = 'B'
       AND ${primaryMetric} IS NOT NULL`,
      [experimentId]
    )
    
    if (variantAResults.length === 0 || variantBResults.length === 0) {
      return NextResponse.json(
        {
          experimentId,
          experimentName: experiment.experiment_name,
          status: experiment.status,
          message: 'Insufficient data for analysis',
          variantA: { sampleSize: variantAResults.length },
          variantB: { sampleSize: variantBResults.length },
          minSampleSize: experiment.min_sample_size
        },
        { status: 200 }
      )
    }
    
    // Extract primary metric values
    const variantAValues = variantAResults.map((r: any) => parseFloat(r[primaryMetric]))
    const variantBValues = variantBResults.map((r: any) => parseFloat(r[primaryMetric]))
    
    // Perform statistical analysis
    const data: ExperimentData = {
      variantA: variantAValues,
      variantB: variantBValues
    }
    
    const analysis = compareVariants(data)
    
    // Calculate secondary metrics
    const secondaryMetrics = experiment.secondary_metrics 
      ? JSON.parse(experiment.secondary_metrics) 
      : []
    
    const secondaryAnalysis: any = {}
    
    for (const metric of secondaryMetrics) {
      if (metric === primaryMetric) continue
      
      const aValues = variantAResults
        .map((r: any) => r[metric])
        .filter((v: any) => v !== null && v !== undefined)
        .map((v: any) => parseFloat(v))
      
      const bValues = variantBResults
        .map((r: any) => r[metric])
        .filter((v: any) => v !== null && v !== undefined)
        .map((v: any) => parseFloat(v))
      
      if (aValues.length > 0 && bValues.length > 0) {
        const metricAnalysis = compareVariants({
          variantA: aValues,
          variantB: bValues
        })
        
        secondaryAnalysis[metric] = {
          variantA: metricAnalysis.variantA.mean,
          variantB: metricAnalysis.variantB.mean,
          percentChange: metricAnalysis.percentChange,
          isSignificant: metricAnalysis.tTest.isSignificant
        }
      }
    }
    
    // Determine if experiment has enough samples
    const hasEnoughSamples = 
      variantAResults.length >= experiment.min_sample_size &&
      variantBResults.length >= experiment.min_sample_size
    
    // Generate decision
    let decision = ''
    if (!hasEnoughSamples) {
      decision = `Continue collecting data. Need ${experiment.min_sample_size - Math.min(variantAResults.length, variantBResults.length)} more samples.`
    } else if (!analysis.tTest.isSignificant) {
      decision = 'No significant difference detected. Keep Variant A (Control).'
    } else if (analysis.percentChange > 0) {
      decision = `Deploy Variant B. Shows ${analysis.percentChange.toFixed(2)}% improvement (p=${analysis.tTest.pValue.toFixed(4)}).`
    } else {
      decision = `Keep Variant A. Variant B shows ${Math.abs(analysis.percentChange).toFixed(2)}% decline (p=${analysis.tTest.pValue.toFixed(4)}).`
    }
    
    return NextResponse.json(
      {
        experimentId,
        experimentName: experiment.experiment_name,
        experimentType: experiment.experiment_type,
        status: experiment.status,
        primaryMetric,
        hasEnoughSamples,
        minSampleSize: experiment.min_sample_size,
        variantA: {
          sampleSize: variantAResults.length,
          mean: analysis.variantA.mean,
          std: analysis.variantA.std,
          min: analysis.variantA.min,
          max: analysis.variantA.max,
          median: analysis.variantA.median,
          config: JSON.parse(experiment.variant_a_config)
        },
        variantB: {
          sampleSize: variantBResults.length,
          mean: analysis.variantB.mean,
          std: analysis.variantB.std,
          min: analysis.variantB.min,
          max: analysis.variantB.max,
          median: analysis.variantB.median,
          config: JSON.parse(experiment.variant_b_config)
        },
        statistics: {
          tStatistic: analysis.tTest.tStatistic,
          pValue: analysis.tTest.pValue,
          degreesOfFreedom: analysis.tTest.degreesOfFreedom,
          isSignificant: analysis.tTest.isSignificant,
          effectSize: analysis.effectSize,
          confidenceInterval: analysis.confidenceInterval,
          percentChange: analysis.percentChange
        },
        secondaryMetrics: secondaryAnalysis,
        recommendation: analysis.recommendation,
        decision,
        startedAt: experiment.started_at,
        daysRunning: experiment.started_at 
          ? Math.floor((Date.now() - new Date(experiment.started_at).getTime()) / (1000 * 60 * 60 * 24))
          : 0
      },
      { status: 200 }
    )
    
  } catch (error) {
    console.error('[Experiments API] Results error:', error)
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

