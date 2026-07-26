/**
 * DigiClassroom Pro - Feedback Validation Schemas
 * Zod schemas for validating feedback API requests and responses
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const ThumbsRatingEnum = z.enum(['up', 'down']);
export const FeedbackCategoryEnum = z.enum([
  'accuracy',
  'completeness',
  'clarity',
  'formatting',
  'citations',
  'other'
]);
export const CacheTypeEnum = z.enum(['semantic', 'openai', 'pre-generated', 'none']);
export const BoardEnum = z.enum(['CBSE', 'ICSE', 'STATE_BOARD']);

// ============================================================================
// Submit Feedback Request Schema
// ============================================================================

export const SubmitFeedbackRequestSchema = z.object({
  // Question & Answer (Required)
  questionText: z.string().min(1, 'Question is required'),
  answerText: z.string().min(1, 'Answer is required'),
  answerId: z.string().optional(),

  // Educational Context (Required)
  board: z.string().min(1).transform(v => {
    const upper = v.toUpperCase().replace(/-/g, '_');
    // Normalize to known values or keep as-is
    if (['CBSE', 'ICSE', 'STATE_BOARD'].includes(upper)) return upper;
    return upper || 'CBSE';
  }),
  classLevel: z.number().int().min(1).max(12).default(10),
  subject: z.string().min(1, 'Subject is required'),
  commandWord: z.string().optional(),
  marksAllocated: z.number().int().positive().optional(),

  // User Feedback (At least one required)
  thumbsRating: ThumbsRatingEnum.optional(),
  starRating: z.number().int().min(1).max(5).optional(),
  feedbackCategory: FeedbackCategoryEnum.optional(),
  feedbackText: z.string().max(1000, 'Feedback text must be less than 1000 characters').optional(),

  // Quality Metrics (Optional - from RAGAS)
  faithfulnessScore: z.number().min(0).max(1).optional(),
  relevanceScore: z.number().min(0).max(1).optional(),
  contextPrecisionScore: z.number().min(0).max(1).optional(),
  contextRecallScore: z.number().min(0).max(1).optional(),

  // Performance Metrics (Optional)
  responseTimeMs: z.number().int().positive().optional(),
  cacheHit: z.boolean().optional(),
  cacheType: CacheTypeEnum.optional(),

  // Routing Information (Optional)
  routeType: z.string().optional(),
  complexity: z.string().optional(),
  intentType: z.string().optional(),

  // A/B Testing Metadata (Optional)
  experimentId: z.string().optional(),
  experimentVariant: z.enum(['A', 'B']).optional(),

  // User Information (Required)
  sessionId: z.string().optional(),
  userId: z.string().min(1, 'User ID is required'),
  /** @deprecated Use userId instead — kept for backward DB column compat */
  clerkId: z.string().optional(),
}).refine(
  (data) => data.thumbsRating || data.starRating || data.feedbackText,
  {
    message: 'At least one of thumbsRating, starRating, or feedbackText must be provided',
  }
);

export type SubmitFeedbackRequest = z.infer<typeof SubmitFeedbackRequestSchema>;

// ============================================================================
// Submit Feedback Response Schema
// ============================================================================

export const SubmitFeedbackResponseSchema = z.object({
  success: z.boolean(),
  feedbackId: z.string(),
  message: z.string(),
  alertsCreated: z.array(z.object({
    alertType: z.string(),
    severity: z.string(),
    message: z.string(),
  })).optional(),
});

export type SubmitFeedbackResponse = z.infer<typeof SubmitFeedbackResponseSchema>;

// ============================================================================
// Get Feedback Stats Request Schema
// ============================================================================

export const GetFeedbackStatsRequestSchema = z.object({
  // Filters (All optional)
  board: BoardEnum.optional(),
  classLevel: z.number().int().min(1).max(12).optional(),
  subject: z.string().optional(),
  timeWindow: z.enum(['1h', '24h', '7d', '30d', 'all']).default('24h'),

  // Pagination
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export type GetFeedbackStatsRequest = z.infer<typeof GetFeedbackStatsRequestSchema>;

// ============================================================================
// Get Feedback Stats Response Schema
// ============================================================================

export const GetFeedbackStatsResponseSchema = z.object({
  success: z.boolean(),
  stats: z.object({
    // Overall Metrics
    totalFeedback: z.number(),
    averageRating: z.number(),
    thumbsUpPercentage: z.number(),

    // Quality Metrics
    averageFaithfulness: z.number(),
    averageRelevance: z.number(),

    // Performance Metrics
    averageResponseTime: z.number(),
    cacheHitRate: z.number(),

    // Rating Distribution
    ratingDistribution: z.object({
      1: z.number(),
      2: z.number(),
      3: z.number(),
      4: z.number(),
      5: z.number(),
    }),

    // Top Feedback Categories
    topCategories: z.array(z.object({
      category: z.string(),
      count: z.number(),
      percentage: z.number(),
    })),

    // Subject Breakdown
    subjectBreakdown: z.array(z.object({
      subject: z.string(),
      count: z.number(),
      averageRating: z.number(),
    })),

    // Cache Performance
    cacheBreakdown: z.object({
      semantic: z.number(),
      openai: z.number(),
      preGenerated: z.number(),
      none: z.number(),
    }),
  }),
  filters: z.object({
    board: z.string().optional(),
    classLevel: z.number().optional(),
    subject: z.string().optional(),
    timeWindow: z.string(),
  }),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
});

export type GetFeedbackStatsResponse = z.infer<typeof GetFeedbackStatsResponseSchema>;

// ============================================================================
// Error Response Schema
// ============================================================================

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  details: z.any().optional(),
  statusCode: z.number().optional(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert time window to SQL date filter
 */
export function getTimeWindowFilter(timeWindow: string): string {
  switch (timeWindow) {
    case '1h':
      return 'created_at >= NOW() - INTERVAL 1 HOUR';
    case '24h':
      return 'created_at >= NOW() - INTERVAL 24 HOUR';
    case '7d':
      return 'created_at >= NOW() - INTERVAL 7 DAY';
    case '30d':
      return 'created_at >= NOW() - INTERVAL 30 DAY';
    case 'all':
    default:
      return '1=1'; // No filter
  }
}

/**
 * Validate and parse request body
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string; details: any } {
  try {
    const parsed = schema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Validation failed',
        details: error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message,
        })),
      };
    }
    return {
      success: false,
      error: 'Unknown validation error',
      details: error,
    };
  }
}

