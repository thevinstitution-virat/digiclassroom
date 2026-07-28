/**
 * Batch RAGAS Evaluation API
 * POST /api/ragas/batch-evaluate
 * 
 * Evaluates multiple Q&A pairs in batch for ground truth dataset validation
 * Useful for evaluating existing ground truth or validating multiple answers
 */

import { NextRequest, NextResponse } from 'next/server'
import { evaluateRAGAS } from '@/lib/ragas/evaluator'
import { executeQuery } from '@/lib/db/connection'

interface BatchEvaluateItem {
  id: string  // Unique identifier for this item (e.g., feedbackId or groundTruthId)
  question: string
  answer: string
  context: string[]
  reference?: string
}

interface BatchEvaluateRequest {
  items: BatchEvaluateItem[]
  updateDatabase?: boolean  // Whether to update answer_feedback table
}

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  
  try {
    const body: BatchEvaluateRequest = await req.json()
    
    // Validate inputs
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        {
          error: 'Missing or invalid items array',
          details: 'items must be a non-empty array'
        },
        { status: 400 }
      )
    }
    
    if (body.items.length > 50) {
      return NextResponse.json(
        {
          error: 'Batch size too large',
          details: 'Maximum 50 items per batch'
        },
        { status: 400 }
      )
    }
    
    console.log(`[RAGAS Batch] Evaluating ${body.items.length} items...`)
    
    // Evaluate all items in parallel (with concurrency limit)
    const results = await evaluateBatch(body.items, body.updateDatabase || false)
    
    const totalTime = Date.now() - startTime
    const avgTime = totalTime / body.items.length
    
    // Calculate summary statistics
    const summary = {
      totalItems: body.items.length,
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length,
      avgFaithfulness: calculateAverage(results, 'faithfulnessScore'),
      avgRelevance: calculateAverage(results, 'relevanceScore'),
      avgContextPrecision: calculateAverage(results, 'contextPrecisionScore'),
      avgContextRecall: calculateAverage(results, 'contextRecallScore'),
      avgOverallScore: calculateAverage(results, 'overallScore'),
      totalExecutionTime: totalTime,
      avgExecutionTime: avgTime
    }
    
    console.log(`[RAGAS Batch] Complete: ${summary.successCount}/${summary.totalItems} successful in ${totalTime}ms`)
    
    return NextResponse.json(
      {
        success: true,
        summary,
        results
      },
      { status: 200 }
    )
    
  } catch (error) {
    console.error('[RAGAS Batch] Evaluation error:', error)
    
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
 * Evaluate items in batch with concurrency control
 */
async function evaluateBatch(
  items: BatchEvaluateItem[],
  updateDatabase: boolean
): Promise<any[]> {
  const CONCURRENCY_LIMIT = 5  // Process 5 at a time to avoid rate limits
  
  const results: any[] = []
  
  // Process in chunks
  for (let i = 0; i < items.length; i += CONCURRENCY_LIMIT) {
    const chunk = items.slice(i, i + CONCURRENCY_LIMIT)
    
    const chunkResults = await Promise.all(
      chunk.map(item => evaluateItem(item, updateDatabase))
    )
    
    results.push(...chunkResults)
    
    // Small delay between chunks to avoid rate limiting
    if (i + CONCURRENCY_LIMIT < items.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  
  return results
}

/**
 * Evaluate a single item
 */
async function evaluateItem(
  item: BatchEvaluateItem,
  updateDatabase: boolean
): Promise<any> {
  try {
    const result = await evaluateRAGAS({
      question: item.question,
      answer: item.answer,
      context: item.context,
      reference: item.reference,
      cacheKey: item.id
    })
    
    // Update database if requested
    if (updateDatabase && item.id) {
      await updateFeedbackWithRAGAS(item.id, result)
    }
    
    return {
      id: item.id,
      success: true,
      faithfulnessScore: result.faithfulnessScore,
      relevanceScore: result.relevanceScore,
      contextPrecisionScore: result.contextPrecisionScore,
      contextRecallScore: result.contextRecallScore,
      overallScore: result.overallScore,
      executionTime: result.executionTime,
      cached: result.cached
    }
    
  } catch (error) {
    console.error(`[RAGAS Batch] Error evaluating item ${item.id}:`, error)
    
    return {
      id: item.id,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
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
  } catch (error) {
    console.error(`[RAGAS Batch] Failed to update feedback ${feedbackId}:`, error)
    // Don't throw - evaluation succeeded even if DB update failed
  }
}

/**
 * Calculate average of a metric across results
 */
function calculateAverage(results: any[], metric: string): number {
  const successfulResults = results.filter(r => r.success && r[metric] !== undefined)
  
  if (successfulResults.length === 0) {
    return 0
  }
  
  const sum = successfulResults.reduce((acc, r) => acc + r[metric], 0)
  return Math.round((sum / successfulResults.length) * 100) / 100
}

