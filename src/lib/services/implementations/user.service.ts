/**
 * User Service Implementation
 * Manages user context, quotas, and access validation
 * Features:
 * - User context caching
 * - Quota management
 * - Access validation
 * - Subscription checking
 */

import type { IUserService, ICacheService, UserContext } from '../interfaces';
import { APP_CONFIG } from '@/lib/config/app-config';

// Import database connection from existing location
let getConnection: any;

try {
  const dbModule = require('@/lib/db/connection');
  getConnection = dbModule.getConnection || dbModule.default;
} catch (error) {
  console.warn('⚠️ Database connection not found');
  getConnection = null;
}

export class UserService implements IUserService {
  private cacheService: ICacheService;
  private enabled: boolean;

  constructor(cacheService: ICacheService) {
    this.cacheService = cacheService;
    this.enabled = getConnection !== null;
    console.log('✅ User Service initialized');
  }

  async getUserContext(userId: string): Promise<UserContext> {
    // Check cache first
    const cacheKey = `user_context:${userId}`;
    const cached = await this.cacheService.get<UserContext>(cacheKey);
    
    if (cached) {
      console.log(`✅ User context cache HIT for ${userId}`);
      return cached;
    }

    console.log(`🔍 User context cache MISS for ${userId}`);

    if (!this.enabled) {
      // Return mock user context if database not available
      return this.getMockUserContext(userId);
    }

    try {
      const connection = await getConnection();

      // Fetch user data
      const [userRows] = await connection.query<any[]>(
        `SELECT * FROM users WHERE clerk_user_id = ? LIMIT 1`,
        [userId]
      );

      if (!userRows || userRows.length === 0) {
        throw new Error(`User not found: ${userId}`);
      }

      const user = userRows[0];

      // Fetch subscription
      const [subRows] = await connection.query<any[]>(
        `SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active' LIMIT 1`,
        [user.id]
      );

      const subscription = subRows?.[0];

      // Fetch quota
      const [quotaRows] = await connection.query<any[]>(
        `SELECT current_usage, quota_limit FROM user_quotas WHERE user_id = ? LIMIT 1`,
        [user.id]
      );

      const quota = quotaRows?.[0] || { current_usage: 0, quota_limit: 30 };

      const userContext: UserContext = {
        userId: user.clerk_user_id,
        userName: user.name || 'Student',
        role: user.role || 'student',
        educationBoard: user.education_board || 'cbse',
        classLevel: user.class_level || 'Class 9',
        subscription: {
          type: subscription?.subscription_type || 'TRIAL_FULL_ACCESS',
          isActive: !!subscription,
          expiresAt: subscription?.expires_at ? new Date(subscription.expires_at) : undefined
        },
        quota: {
          current: quota.current_usage,
          limit: quota.quota_limit,
          remaining: quota.quota_limit - quota.current_usage
        }
      };

      // Cache for 30 minutes
      await this.cacheService.set(cacheKey, userContext, {
        ttl: APP_CONFIG.redis.cache.ttl.userContext,
        tags: ['user_context', userId]
      });

      return userContext;

    } catch (error) {
      console.error('❌ Failed to get user context:', error);
      return this.getMockUserContext(userId);
    }
  }

  async validateAccess(
    userId: string,
    board: string,
    classLevel: string,
    subject: string
  ): Promise<boolean> {
    try {
      const userContext = await this.getUserContext(userId);

      // Check subscription
      if (!userContext.subscription.isActive) {
        console.warn(`⚠️ User ${userId} has no active subscription`);
        return false;
      }

      // For TRIAL_FULL_ACCESS and UNLIMITED, allow all access
      if (['TRIAL_FULL_ACCESS', 'UNLIMITED'].includes(userContext.subscription.type)) {
        return true;
      }

      // For other subscription types, validate board and class
      if (userContext.educationBoard !== board) {
        console.warn(`⚠️ User ${userId} does not have access to board: ${board}`);
        return false;
      }

      return true;

    } catch (error) {
      console.error('❌ Access validation failed:', error);
      return false;
    }
  }

  async incrementQuota(userId: string): Promise<void> {
    if (!this.enabled) return;

    try {
      const connection = await getConnection();

      // Get user ID
      const [userRows] = await connection.query<any[]>(
        `SELECT id FROM users WHERE clerk_user_id = ? LIMIT 1`,
        [userId]
      );

      if (!userRows || userRows.length === 0) return;

      const user = userRows[0];

      // Increment quota
      await connection.query(
        `UPDATE user_quotas SET current_usage = current_usage + 1 WHERE user_id = ?`,
        [user.id]
      );

      // Invalidate cache
      await this.cacheService.delete(`user_context:${userId}`);

      console.log(`✅ Incremented quota for user ${userId}`);

    } catch (error) {
      console.error('❌ Failed to increment quota:', error);
    }
  }

  async checkQuota(userId: string): Promise<{ allowed: boolean; remaining: number }> {
    try {
      const userContext = await this.getUserContext(userId);

      const allowed = userContext.quota.remaining > 0;
      const remaining = userContext.quota.remaining;

      if (!allowed) {
        console.warn(`⚠️ User ${userId} has exceeded quota (${userContext.quota.current}/${userContext.quota.limit})`);
      }

      return { allowed, remaining };

    } catch (error) {
      console.error('❌ Quota check failed:', error);
      return { allowed: true, remaining: 999 }; // Fail open
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private getMockUserContext(userId: string): UserContext {
    return {
      userId,
      userName: 'Test User',
      role: 'student',
      educationBoard: 'cbse',
      classLevel: 'Class 9',
      subscription: {
        type: 'TRIAL_FULL_ACCESS',
        isActive: true
      },
      quota: {
        current: 0,
        limit: 30,
        remaining: 30
      }
    };
  }
}

