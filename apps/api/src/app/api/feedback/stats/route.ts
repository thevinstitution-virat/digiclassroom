/**
 * DigiClassroom Pro - Feedback Stats API Endpoint
 * GET /api/feedback/stats
 * 
 * Returns aggregated feedback statistics with filtering options
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db/connection';
import {
  GetFeedbackStatsRequestSchema,
  validateRequest,
  getTimeWindowFilter,
  type GetFeedbackStatsResponse,
} from '@/lib/validation/feedback-schemas';

export const runtime = 'nodejs';

// ============================================================================
// GET /api/feedback/stats
// ============================================================================

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  let connection;

  try {
    // Parse and validate query parameters
    const { searchParams } = new URL(req.url);
    const queryParams = {
      board: searchParams.get('board') || undefined,
      classLevel: searchParams.get('classLevel') ? parseInt(searchParams.get('classLevel')!) : undefined,
      subject: searchParams.get('subject') || undefined,
      timeWindow: (searchParams.get('timeWindow') as any) || '24h',
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20,
    };

    const validation = validateRequest(GetFeedbackStatsRequestSchema, queryParams);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error,
          details: validation.details,
        },
        { status: 400 }
      );
    }

    const params = validation.data;

    // Get database connection
    const pool = getPool();
    connection = await pool.getConnection();

    // Build WHERE clause
        // @ts-ignore
    const conditions: string[] = [getTimeWindowFilter(params.timeWindow)];
    const queryValues: any[] = [];

    if (params.board) {
      conditions.push('board = ?');
      queryValues.push(params.board);
    }
    if (params.classLevel) {
      conditions.push('class_level = ?');
      queryValues.push(params.classLevel);
    }
    if (params.subject) {
      conditions.push('subject = ?');
      queryValues.push(params.subject);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Query 1: Overall Metrics
    const [overallMetrics] = await connection.query(
      `SELECT 
        COUNT(*) as total_feedback,
        AVG(star_rating) as avg_rating,
        SUM(CASE WHEN thumbs_rating = 'up' THEN 1 ELSE 0 END) / COUNT(*) * 100 as thumbs_up_percentage,
        AVG(faithfulness_score) as avg_faithfulness,
        AVG(relevance_score) as avg_relevance,
        AVG(response_time_ms) as avg_response_time,
        SUM(CASE WHEN cache_hit = 1 THEN 1 ELSE 0 END) / COUNT(*) * 100 as cache_hit_rate
      FROM answer_feedback
      ${whereClause}`,
      queryValues
    );

    const metrics = (overallMetrics as any[])[0];

    // Query 2: Rating Distribution
    const [ratingDist] = await connection.query(
      `SELECT 
        star_rating,
        COUNT(*) as count
      FROM answer_feedback
      ${whereClause}
      AND star_rating IS NOT NULL
      GROUP BY star_rating`,
      queryValues
    );

    const ratingDistribution = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    (ratingDist as any[]).forEach(row => {
      ratingDistribution[row.star_rating as keyof typeof ratingDistribution] = Number(row.count);
    });

    // Query 3: Top Feedback Categories
    const [categories] = await connection.query(
      `SELECT 
        feedback_category as category,
        COUNT(*) as count
      FROM answer_feedback
      ${whereClause}
      AND feedback_category IS NOT NULL
      GROUP BY feedback_category
      ORDER BY count DESC
      LIMIT 5`,
      queryValues
    );

    const totalCategorized = (categories as any[]).reduce((sum, cat) => sum + Number(cat.count), 0);
    const topCategories = (categories as any[]).map(cat => ({
      category: cat.category,
      count: Number(cat.count),
      percentage: totalCategorized > 0 ? (Number(cat.count) / totalCategorized) * 100 : 0,
    }));

    // Query 4: Subject Breakdown
    const [subjects] = await connection.query(
      `SELECT 
        subject,
        COUNT(*) as count,
        AVG(star_rating) as avg_rating
      FROM answer_feedback
      ${whereClause}
      GROUP BY subject
      ORDER BY count DESC
      LIMIT 10`,
      queryValues
    );

    const subjectBreakdown = (subjects as any[]).map(sub => ({
      subject: sub.subject,
      count: Number(sub.count),
      averageRating: sub.avg_rating ? Number(sub.avg_rating) : 0,
    }));

    // Query 5: Cache Performance
    const [cachePerf] = await connection.query(
      `SELECT 
        cache_type,
        COUNT(*) as count
      FROM answer_feedback
      ${whereClause}
      GROUP BY cache_type`,
      queryValues
    );

    const cacheBreakdown = {
      semantic: 0,
      openai: 0,
      preGenerated: 0,
      none: 0,
    };

    (cachePerf as any[]).forEach(row => {
      const type = row.cache_type;
      if (type === 'semantic') cacheBreakdown.semantic = Number(row.count);
      else if (type === 'openai') cacheBreakdown.openai = Number(row.count);
      else if (type === 'pre-generated') cacheBreakdown.preGenerated = Number(row.count);
      else cacheBreakdown.none = Number(row.count);
    });

    // Calculate pagination
    const totalFeedback = Number(metrics.total_feedback);
        // @ts-ignore
    const totalPages = Math.ceil(totalFeedback / params.limit);

    // Log execution time
    const executionTime = Date.now() - startTime;
    console.log(`⏱️  Stats query completed in ${executionTime}ms`);

    // Build response
    const response: GetFeedbackStatsResponse = {
      success: true,
      stats: {
        totalFeedback,
        averageRating: metrics.avg_rating ? Number(metrics.avg_rating) : 0,
        thumbsUpPercentage: metrics.thumbs_up_percentage ? Number(metrics.thumbs_up_percentage) : 0,
        averageFaithfulness: metrics.avg_faithfulness ? Number(metrics.avg_faithfulness) : 0,
        averageRelevance: metrics.avg_relevance ? Number(metrics.avg_relevance) : 0,
        averageResponseTime: metrics.avg_response_time ? Number(metrics.avg_response_time) : 0,
        cacheHitRate: metrics.cache_hit_rate ? Number(metrics.cache_hit_rate) : 0,
        ratingDistribution,
        topCategories,
        subjectBreakdown,
        cacheBreakdown,
      },
      filters: {
        board: params.board,
        classLevel: params.classLevel,
        subject: params.subject,
        // @ts-ignore
        timeWindow: params.timeWindow,
      },
      pagination: {
        // @ts-ignore
        page: params.page,
        // @ts-ignore
        limit: params.limit,
        total: totalFeedback,
        totalPages,
      },
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('❌ Error fetching feedback stats:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch feedback statistics',
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
// OPTIONS handler for CORS
// ============================================================================

export async function OPTIONS(req: NextRequest) {
  return NextResponse.json({}, { status: 200 });
}

