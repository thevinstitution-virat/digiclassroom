import { logger } from '@/lib/logger';

import { createClient } from 'redis';

// Simple global client for dev/test without full cluster manager
const redisClient = process.env.REDIS_URL
    ? createClient({ url: process.env.REDIS_URL })
    : null;

let isConnected = false;

if (redisClient) {
        // @ts-ignore
    redisClient.on('error', err => logger.error({ error: err }, 'Redis Client Error'));
    redisClient.connect().then(() => {
        isConnected = true;
        logger.info('✅ Rate Limiter connected to Redis');
    }).catch(err => {
        // @ts-ignore
        logger.warn({ data: err.message }, '⚠️ Rate Limiter Redis connection failed (running in open mode)');
    });
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetTimeMs: number;
}

export const RATE_LIMITS = {
    FREE: parseInt(process.env.RATE_LIMIT_FREE || '15', 10),     // 15 queries / day
    SCHOOL: parseInt(process.env.RATE_LIMIT_SCHOOL || '50', 10), // 50 queries / day
    UNLIMITED: 999999
};

/**
 * studentRateLimiter - Redis sliding window
 * 
 * Fails OPEN if Redis is down to prevent blocking students.
 * Time window is 24 hours (86400000 ms).
 */
export async function studentRateLimiter(
    userId: string,
    planType: 'FREE' | 'SCHOOL' | 'PREMIUM' | 'ADMIN'
): Promise<RateLimitResult> {
    // 1. Fail open if no redis
    if (!redisClient || !isConnected) {
        return { allowed: true, remaining: 999, resetTimeMs: 0 };
    }

    // 2. Determine limit
    if (planType === 'PREMIUM' || planType === 'ADMIN') {
        return { allowed: true, remaining: RATE_LIMITS.UNLIMITED, resetTimeMs: 0 };
    }

    const limit = planType === 'SCHOOL' ? RATE_LIMITS.SCHOOL : RATE_LIMITS.FREE;
    const key = `ratelimit:chat:${userId}`;
    const now = Date.now();
    const windowMs = 24 * 60 * 60 * 1000; // 24 hours
    const windowStart = now - windowMs;

    try {
        // PER USER FEEDBACK: Redis pipeline atomicity acceptable as-is
        // We use a high-performance MULTI block (pipeline) instead of complex Lua since 
        // a race condition here only means a student gets 1 extra query, which is acceptable.

        const multi = redisClient.multi();

        // Remove old entries outside the 24h window
        multi.zRemRangeByScore(key, 0, windowStart);

        // Count remaining entries
        multi.zCard(key);

        // Add current timestamp (score) and unique request ID as value
        multi.zAdd(key, { score: now, value: `${now}-${Math.random()}` });

        // Set expiry on the whole set to drop idle keys overnight
        multi.expire(key, 86400); // 24h in seconds

        const results = await multi.exec();

        // The count is the result of zCard (index 1 of the multi results)
        const zCardResult = results?.[1];
        const currentCount = (typeof zCardResult === 'number' ? zCardResult : 0) + 1;

        if (currentCount > limit) {
            // Remove the one we just added because they are over limit
            await redisClient.zRemRangeByScore(key, now, now);

            // Get oldest entry to calculate reset time
            const oldest = await redisClient.zRangeWithScores(key, 0, 0);
            let resetTimeMs = now + windowMs; // Default fallback Full wait
            if (oldest && oldest.length > 0) {
                resetTimeMs = oldest[0].score + windowMs;
            }

            return {
                allowed: false,
                remaining: 0,
                resetTimeMs
            };
        }

        return {
            allowed: true,
            remaining: limit - currentCount,
            resetTimeMs: 0 // Not relevant unless blocked
        };

    } catch (e) {
        // Fallback open on Redis failure
        // @ts-ignore
        logger.error({ error: e }, `Rate limit pipeline error for user ${userId}:`);
        return { allowed: true, remaining: 1, resetTimeMs: 0 };
    }
}
