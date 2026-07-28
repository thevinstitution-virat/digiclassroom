/**
 * RAGAS Evaluation API Endpoint
 * POST /api/ragas/evaluate
 *
 * Evaluates answer quality using RAGAS metrics and stores results
 *
 * Features:
 * - All 4 RAGAS metrics: Faithfulness, Relevancy, Context Precision, Context Recall
 * - Automatic quality alert creation for low scores
 * - Updates answer_feedback table with RAGAS scores
 * - Returns results in < 5 seconds
 */

import { NextRequest, NextResponse } from 'next/server'
import { evaluateRAGAS } from '@/lib/ragas/evaluator'
import { executeQuery } from '@/lib/db/connection'
import { v4 as uuidv4 } from 'uuid'

interface EvaluateRequest {
  question: string
  answer: string
  context: string[]
  reference?: string         // Ground truth answer for Context Recall
  feedbackId?: string
}

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Parse request body
    const body: EvaluateRequest = await req.json()
    
    // Validate inputs
    if (!body.question || !body.answer || !body.context || !Array.isArray(body.context)) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          details: 'question, answer, and context (array) are required'
        },
        { status: 400 }
      )
    }
    
    console.log(`[RAGAS API] Evaluating answer for question: "${body.question.substring(0, 50)}..."`)
    
    // Run RAGAS evaluation
    const result = await evaluateRAGAS({
      question: body.question,
      answer: body.answer,
      context: body.context,
      reference: body.reference,
      cacheKey: body.feedbackId
    })
    
    // Update answer_feedback table if feedbackId provided
    if (body.feedbackId) {
      await updateFeedbackWithRAGAS(body.feedbackId, result)
      
      // Create quality alerts for low scores
      await createQualityAlerts(body.feedbackId, result)
    }
    
    const totalTime = Date.now() - startTime
    
    console.log(`[RAGAS API] Evaluation complete in ${totalTime}ms`)
    
    return NextResponse.json(
      {
        success: true,
        result: {
          faithfulnessScore: result.faithfulnessScore,
          relevanceScore: result.relevanceScore,
          contextPrecisionScore: result.contextPrecisionScore,
          contextRecallScore: result.contextRecallScore,
          overallScore: result.overallScore,
          cached: result.cached
        },
        executionTime: totalTime,
        feedbackId: body.feedbackId
      },
      { status: 200 }
    )
    
  } catch (error) {
    console.error('[RAGAS API] Evaluation error:', error)
    
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
 * Update answer_feedback table with RAGAS scores
 */
async function updateFeedbackWithRAGAS(
  feedbackId: string,
  result: any
): Promise<void> {
  try {
    await executeQuery(
      `UPDATE answer_feedback 
       SET faithfulness_score = ?,
           relevance_score = ?,
           context_precision_score = ?,
           context_recall_score = ?,
           ragas_execution_time = ?
       WHERE feedback_id = ?`,
      [
        result.faithfulnessScore,
        result.relevanceScore,
        result.contextPrecisionScore,
        result.contextRecallScore,
        result.executionTime,
        feedbackId
      ]
    )
    
    console.log(`[RAGAS API] Updated feedback ${feedbackId} with RAGAS scores`)
    
  } catch (error) {
    console.error('[RAGAS API] Failed to update feedback:', error)
    // Don't throw - evaluation succeeded even if DB update failed
  }
}

/**
 * Create quality alerts for low RAGAS scores
 */
async function createQualityAlerts(
  feedbackId: string,
  result: any
): Promise<void> {
  const alerts: Array<{
    type: string
    severity: string
    value: number
    threshold: number
    message: string
  }> = []
  
  // Alert for low faithfulness (< 0.7)
  if (result.faithfulnessScore < 0.7) {
    alerts.push({
      type: 'low_faithfulness',
      severity: result.faithfulnessScore < 0.5 ? 'high' : 'medium',
      value: result.faithfulnessScore,
      threshold: 0.7,
      message: `Faithfulness score ${result.faithfulnessScore.toFixed(3)} is below threshold 0.7`
    })
  }
  
  // Alert for low relevance (< 0.7)
  if (result.relevanceScore < 0.7) {
    alerts.push({
      type: 'low_relevance',
      severity: result.relevanceScore < 0.5 ? 'high' : 'medium',
      value: result.relevanceScore,
      threshold: 0.7,
      message: `Relevance score ${result.relevanceScore.toFixed(3)} is below threshold 0.7`
    })
  }

  // Alert for low context precision (< 0.8)
  if (result.contextPrecisionScore < 0.8) {
    alerts.push({
      type: 'low_context_precision',
      severity: result.contextPrecisionScore < 0.6 ? 'high' : 'medium',
      value: result.contextPrecisionScore,
      threshold: 0.8,
      message: `Context Precision score ${result.contextPrecisionScore.toFixed(3)} is below threshold 0.8`
    })
  }

  // Alert for low context recall (< 0.8)
  if (result.contextRecallScore < 0.8) {
    alerts.push({
      type: 'low_context_recall',
      severity: result.contextRecallScore < 0.6 ? 'high' : 'medium',
      value: result.contextRecallScore,
      threshold: 0.8,
      message: `Context Recall score ${result.contextRecallScore.toFixed(3)} is below threshold 0.8`
    })
  }
  
  // Insert alerts into database
  for (const alert of alerts) {
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', NOW())`,
        [
          uuidv4(),
          alert.type,
          alert.severity,
          feedbackId,
          alert.value,
          alert.threshold,
          alert.message
        ]
      )
      
      console.log(`[RAGAS API] Created ${alert.severity} alert: ${alert.type}`)
      
    } catch (error) {
      console.error('[RAGAS API] Failed to create alert:', error)
      // Continue with other alerts
    }
  }
  
  if (alerts.length > 0) {
    console.log(`[RAGAS API] Created ${alerts.length} quality alerts for feedback ${feedbackId}`)
  }
}

