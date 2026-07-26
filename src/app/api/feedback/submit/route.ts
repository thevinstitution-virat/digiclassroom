/**
 * DigiClassroom Pro - Submit Feedback API Endpoint
 * POST /api/feedback/submit
 *
 * Collects user feedback on AI-generated answers and creates quality alerts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db/connection';
import { db } from '@/db';
import { answerFeedback } from '@/db/schema';
import {
  SubmitFeedbackRequestSchema,
  validateRequest,
  type SubmitFeedbackResponse,
} from '@/lib/validation/feedback-schemas';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';

// ============================================================================
// POST /api/feedback/submit
// ============================================================================

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let connection;

  try {
    // Parse and validate request body
    const body = await req.json() as Record<string, unknown>;
    console.log('📥 [API] Received feedback submission:', JSON.stringify(body, null, 2));

    const validation = validateRequest(SubmitFeedbackRequestSchema, body);

    if (!validation.success) {
      console.error('❌ [API] Validation failed:', validation.error);
      console.error('❌ [API] Validation details:', JSON.stringify(validation.details, null, 2));
      return NextResponse.json(
        {
          success: false,
          error: validation.error,
          details: validation.details,
        },
        { status: 400 }
      );
    }

    console.log('✅ [API] Validation passed');

    const data = validation.data;

    // Get database connection
    const pool = getPool();
    connection = await pool.getConnection();

    // Insert feedback into database using Drizzle
    const [result] = await db.insert(answerFeedback).values({
      userId: data.userId,
      questionText: data.questionText,
      answerText: data.answerText,
      board: data.board,
      classLevel: data.classLevel,
      subject: data.subject,
      starRating: data.starRating || null,
      thumbsRating: data.thumbsRating || null,
      feedbackText: data.feedbackText || null,
    });

    const feedbackId = result.insertId.toString();
    console.log(`✅ Feedback submitted with ID: ${feedbackId}`);

    // Create quality alerts if needed
    const alertsCreated = await createQualityAlerts(
      connection,
      feedbackId,
      data
    );

    // Log execution time
    const executionTime = Date.now() - startTime;
    console.log(`⏱️  Feedback submission completed in ${executionTime}ms`);

    // Return success response
    const response: SubmitFeedbackResponse = {
      success: true,
      feedbackId,
      message: 'Feedback submitted successfully',
      alertsCreated: alertsCreated.length > 0 ? alertsCreated : undefined,
    };

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('❌ Error submitting feedback:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to submit feedback',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// ============================================================================
// Helper: Create Quality Alerts
// ============================================================================

async function createQualityAlerts(
  connection: any,
  feedbackId: string,
  data: any
): Promise<Array<{ alertType: string; severity: string; message: string }>> {
  const alerts: Array<{ alertType: string; severity: string; message: string }> = [];

  try {
    // Alert 1: Low Star Rating (≤ 2)
    if (data.starRating && data.starRating <= 2) {
      const alertId = uuidv4();
      await connection.query(
        `INSERT INTO quality_alerts (
          id, alert_type, severity, message, feedback_id, question_text,
          board, class_level, subject, metric_value, threshold_value
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          alertId,
          'low_rating',
          data.starRating === 1 ? 'critical' : 'high',
          `Low user rating detected: ${data.starRating}⭐ for ${data.subject} (Class ${data.classLevel})`,
          feedbackId,
          data.questionText.substring(0, 500),
          data.board,
          data.classLevel,
          data.subject,
          data.starRating,
          3,
        ]
      );

      alerts.push({
        alertType: 'low_rating',
        severity: data.starRating === 1 ? 'critical' : 'high',
        message: `Low user rating: ${data.starRating}⭐`,
      });

      console.log(`🚨 Alert created: Low rating (${data.starRating}⭐)`);
    }

    // Alert 2: Low Faithfulness Score (< 0.7)
    if (data.faithfulnessScore && data.faithfulnessScore < 0.7) {
      const alertId = uuidv4();
      await connection.query(
        `INSERT INTO quality_alerts (
          id, alert_type, severity, message, feedback_id, question_text,
          board, class_level, subject, metric_value, threshold_value
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          alertId,
          'low_faithfulness',
          data.faithfulnessScore < 0.5 ? 'critical' : 'high',
          `Low faithfulness score detected: ${data.faithfulnessScore.toFixed(2)} for ${data.subject} (Class ${data.classLevel})`,
          feedbackId,
          data.questionText.substring(0, 500),
          data.board,
          data.classLevel,
          data.subject,
          data.faithfulnessScore,
          0.7,
        ]
      );

      alerts.push({
        alertType: 'low_faithfulness',
        severity: data.faithfulnessScore < 0.5 ? 'critical' : 'high',
        message: `Low faithfulness: ${data.faithfulnessScore.toFixed(2)}`,
      });

      console.log(`🚨 Alert created: Low faithfulness (${data.faithfulnessScore.toFixed(2)})`);
    }

    // Alert 3: Low Relevance Score (< 0.7)
    if (data.relevanceScore && data.relevanceScore < 0.7) {
      const alertId = uuidv4();
      await connection.query(
        `INSERT INTO quality_alerts (
          id, alert_type, severity, message, feedback_id, question_text,
          board, class_level, subject, metric_value, threshold_value
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          alertId,
          'low_relevance',
          data.relevanceScore < 0.5 ? 'critical' : 'medium',
          `Low relevance score detected: ${data.relevanceScore.toFixed(2)} for ${data.subject} (Class ${data.classLevel})`,
          feedbackId,
          data.questionText.substring(0, 500),
          data.board,
          data.classLevel,
          data.subject,
          data.relevanceScore,
          0.7,
        ]
      );

      alerts.push({
        alertType: 'low_relevance',
        severity: data.relevanceScore < 0.5 ? 'critical' : 'medium',
        message: `Low relevance: ${data.relevanceScore.toFixed(2)}`,
      });

      console.log(`🚨 Alert created: Low relevance (${data.relevanceScore.toFixed(2)})`);
    }

    // Alert 4: Slow Response (> 6000ms)
    if (data.responseTimeMs && data.responseTimeMs > 6000) {
      const alertId = uuidv4();
      await connection.query(
        `INSERT INTO quality_alerts (
          id, alert_type, severity, message, feedback_id, question_text,
          board, class_level, subject, metric_value, threshold_value
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          alertId,
          'slow_response',
          data.responseTimeMs > 10000 ? 'high' : 'medium',
          `Slow response time detected: ${data.responseTimeMs}ms for ${data.subject} (Class ${data.classLevel})`,
          feedbackId,
          data.questionText.substring(0, 500),
          data.board,
          data.classLevel,
          data.subject,
          data.responseTimeMs,
          6000,
        ]
      );

      alerts.push({
        alertType: 'slow_response',
        severity: data.responseTimeMs > 10000 ? 'high' : 'medium',
        message: `Slow response: ${data.responseTimeMs}ms`,
      });

      console.log(`🚨 Alert created: Slow response (${data.responseTimeMs}ms)`);
    }

    return alerts;

  } catch (error) {
    console.error('❌ Error creating quality alerts:', error);
    // Don't fail the entire request if alert creation fails
    return alerts;
  }
}

// ============================================================================
// OPTIONS handler for CORS
// ============================================================================

export async function OPTIONS(req: NextRequest) {
  return NextResponse.json({}, { status: 200 });
}
