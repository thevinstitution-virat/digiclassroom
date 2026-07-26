import { logger } from '@/lib/logger';

/**
 * API Rate Limiting Middleware
 * 
 * Purpose: Prevent abuse and control OpenAI API costs
 * Strategy: Different limits for different endpoint types
 * 
 * Cost Savings:
 * - AI endpoints: 20 requests per 15 minutes per user
 * - Regular endpoints: 100 requests per 15 minutes per user
 * - Prevents runaway costs from bugs or malicious usage
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { headers } from 'next/headers';

/**
 * Rate limit configuration for different endpoint types
 */
export const RATE_LIMITS = {
  // AI-powered endpoints (expensive)
  ai: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 20, // 20 requests per 15 min
    message: 'Too many AI requests. Please try again in a few minutes.',
    costPerRequest: 0.05, // Estimated cost in USD
  },
  
  // Batch AI operations (very expensive)
  aiBatch: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5, // 5 batch operations per hour
    message: 'Batch AI operations are limited. Please try again later.',
    costPerRequest: 0.20,
  },
  
  // Semantic search (moderate cost)
  semanticSearch: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 30, // 30 searches per 15 min
    message: 'Too many search requests. Please try again shortly.',
    costPerRequest: 0.01,
  },
  
  // Regular CRUD operations (low cost)
  crud: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100, // 100 requests per 15 min
    message: 'Too many requests. Please slow down.',
    costPerRequest: 0.001,
  },
  
  // Export operations (resource intensive)
  export: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10, // 10 exports per hour
    message: 'Export limit reached. Please try again later.',
    costPerRequest: 0.02,
  },
} as const;

/**
 * In-memory rate limit store
 * TODO: Replace with Redis for production (multi-instance support)
 */
interface RateLimitEntry {
  count: number;
  resetAt: number;
  firstRequestAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Clean up expired entries every 5 minutes
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Rate limit middleware factory
 */
export function createRateLimiter(
  limitType: keyof typeof RATE_LIMITS
) {
  const config = RATE_LIMITS[limitType];
  
  return async function rateLimitMiddleware(
    request: NextRequest
  ): Promise<NextResponse | null> {
    try {
      // Get user ID from Clerk
      const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;
      
      // Allow unauthenticated requests to pass (they'll be blocked by auth middleware)
      if (!userId) {
        return null; // Continue to next middleware
      }
      
      // Create rate limit key
      const key = `${limitType}:${userId}`;
      const now = Date.now();
      
      // Get or create rate limit entry
      let entry = rateLimitStore.get(key);
      
      if (!entry || entry.resetAt < now) {
        // Create new entry
        entry = {
          count: 1,
          resetAt: now + config.windowMs,
          firstRequestAt: now,
        };
        rateLimitStore.set(key, entry);
        
        // Add rate limit headers
        return addRateLimitHeaders(null, config, entry);
      }
      
      // Increment count
      entry.count++;
      
      // Check if limit exceeded
      if (entry.count > config.maxRequests) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        
        // Log rate limit violation
        logger.warn(`⚠️ Rate limit exceeded: ${userId} - ${limitType} (${entry.count}/${config.maxRequests})`);
        
        return NextResponse.json(
          {
            success: false,
            error: config.message,
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter,
            limit: config.maxRequests,
            remaining: 0,
            resetAt: new Date(entry.resetAt).toISOString(),
          },
          {
            status: 429,
            headers: {
              'Retry-After': retryAfter.toString(),
              'X-RateLimit-Limit': config.maxRequests.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': entry.resetAt.toString(),
            },
          }
        );
      }
      
      // Update entry
      rateLimitStore.set(key, entry);
      
      // Continue to next middleware
      return addRateLimitHeaders(null, config, entry);
      
    } catch (error) {
      logger.error({ error: error }, '❌ Rate limiter error:');
      // On error, allow request to continue (fail open)
      return null;
    }
  };
}

/**
 * Add rate limit headers to response
 */
function addRateLimitHeaders(
  response: NextResponse | null,
  config: typeof RATE_LIMITS[keyof typeof RATE_LIMITS],
  entry: RateLimitEntry
): NextResponse | null {
  const headers = {
    'X-RateLimit-Limit': config.maxRequests.toString(),
    'X-RateLimit-Remaining': Math.max(0, config.maxRequests - entry.count).toString(),
    'X-RateLimit-Reset': entry.resetAt.toString(),
  };
  
  if (response) {
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }
  
  return response;
}

/**
 * Get rate limit status for a user
 */
export async function getRateLimitStatus(
  userId: string,
  limitType: keyof typeof RATE_LIMITS
): Promise<{
  limit: number;
  remaining: number;
  resetAt: Date;
  isLimited: boolean;
}> {
  const config = RATE_LIMITS[limitType];
  const key = `${limitType}:${userId}`;
  const entry = rateLimitStore.get(key);
  const now = Date.now();
  
  if (!entry || entry.resetAt < now) {
    return {
      limit: config.maxRequests,
      remaining: config.maxRequests,
      resetAt: new Date(now + config.windowMs),
      isLimited: false,
    };
  }
  
  return {
    limit: config.maxRequests,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetAt: new Date(entry.resetAt),
    isLimited: entry.count >= config.maxRequests,
  };
}

/**
 * Reset rate limit for a user (admin function)
 */
export function resetRateLimit(
  userId: string,
  limitType: keyof typeof RATE_LIMITS
): void {
  const key = `${limitType}:${userId}`;
  rateLimitStore.delete(key);
  logger.info(`✅ Rate limit reset: ${userId} - ${limitType}`);
}

/**
 * Get all rate limit stats (admin function)
 */
export function getRateLimitStats(): {
  totalKeys: number;
  byType: Record<string, number>;
  topUsers: Array<{ userId: string; type: string; count: number }>;
} {
  const byType: Record<string, number> = {};
  const userCounts: Array<{ userId: string; type: string; count: number }> = [];
  
  for (const [key, entry] of rateLimitStore.entries()) {
    const [type, userId] = key.split(':');
    
    byType[type] = (byType[type] || 0) + 1;
    userCounts.push({ userId, type, count: entry.count });
  }
  
  // Sort by count descending
  userCounts.sort((a, b) => b.count - a.count);
  
  return {
    totalKeys: rateLimitStore.size,
    byType,
    topUsers: userCounts.slice(0, 10),
  };
}

/**
 * Estimate cost savings from rate limiting
 */
export function estimateCostSavings(): {
  totalRequestsBlocked: number;
  estimatedSavings: number;
  byType: Record<string, { blocked: number; savings: number }>;
} {
  // This would need to track blocked requests
  // For now, return placeholder
  return {
    totalRequestsBlocked: 0,
    estimatedSavings: 0,
    byType: {},
  };
}

/**
 * Convenience functions for specific endpoint types
 */
export const aiRateLimiter = createRateLimiter('ai');
export const aiBatchRateLimiter = createRateLimiter('aiBatch');
export const semanticSearchRateLimiter = createRateLimiter('semanticSearch');
export const crudRateLimiter = createRateLimiter('crud');
export const exportRateLimiter = createRateLimiter('export');

/**
 * Apply rate limiter to Next.js API route
 * 
 * Usage:
 * export async function POST(request: NextRequest) {
 *   const rateLimitResponse = await aiRateLimiter(request);
 *   if (rateLimitResponse)
  return rateLimitResponse;
 *   
 *   // Your API logic here
 * }
 */

