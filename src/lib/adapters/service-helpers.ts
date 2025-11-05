/**
 * Service Helpers - Convenience functions for using new services
 * These helpers make it easy to add new features to existing code
 */

import { LegacyAgentAdapter } from './legacy-agent-adapter';

// ============================================================================
// Cache Helpers
// ============================================================================

/**
 * Try to get answer from new database cache
 * Falls back gracefully if cache is unavailable
 */
export async function tryDatabaseCache(
  question: string,
  metadata: {
    subject?: string;
    classLevel?: string;
    board?: string;
  }
): Promise<string | null> {
  try {
    const services = await LegacyAgentAdapter.getServices();
    const cached = await services.preGenAnswers.findAnswer(question, {
      subject: metadata.subject || '',
      class_level: metadata.classLevel || '',
      board: metadata.board || 'CBSE'
    });

    if (cached) {
      console.log('✅ Database cache HIT');
      return cached;
    }

    return null;
  } catch (error) {
    console.warn('⚠️ Database cache lookup failed:', error);
    return null;
  }
}

/**
 * Cache an answer in the new database cache
 * Fails gracefully if cache is unavailable
 */
export async function cacheDatabaseAnswer(
  question: string,
  answer: string,
  metadata: {
    subject: string;
    classLevel: string;
    board: string;
  }
): Promise<void> {
  try {
    const services = await LegacyAgentAdapter.getServices();
    await services.preGenAnswers.cacheAnswer(question, answer, {
      subject: metadata.subject,
      class_level: metadata.classLevel,
      board: metadata.board
    });
    console.log('✅ Answer cached in database');
  } catch (error) {
    console.warn('⚠️ Failed to cache answer:', error);
  }
}

// ============================================================================
// Analytics Helpers
// ============================================================================

/**
 * Track a chat request event
 */
export async function trackChatRequest(
  userId: string,
  metadata: {
    menuIntent?: string;
    subject?: string;
    classLevel?: string;
    duration?: number;
    cached?: boolean;
  }
): Promise<void> {
  try {
    const services = await LegacyAgentAdapter.getServices();
    await services.analytics.trackEvent({
      eventType: 'chat_request',
      userId,
      metadata,
      timestamp: new Date()
    });
  } catch (error) {
    console.warn('⚠️ Analytics tracking failed:', error);
  }
}

/**
 * Track a cache hit/miss
 */
export async function trackCacheEvent(
  cacheType: 'database' | 'semantic' | 'vector',
  hit: boolean
): Promise<void> {
  try {
    const services = await LegacyAgentAdapter.getServices();
    await services.analytics.trackCacheHit(cacheType, hit);
  } catch (error) {
    console.warn('⚠️ Analytics tracking failed:', error);
  }
}

/**
 * Track agent execution
 */
export async function trackAgentExecution(
  agentName: string,
  duration: number,
  success: boolean
): Promise<void> {
  try {
    const services = await LegacyAgentAdapter.getServices();
    await services.analytics.trackAgentExecution(agentName, duration, success);
  } catch (error) {
    console.warn('⚠️ Analytics tracking failed:', error);
  }
}

// ============================================================================
// Content Verification Helpers
// ============================================================================

/**
 * Verify content fidelity against sources
 */
export async function verifyContent(
  content: string,
  sources?: string[]
): Promise<{ score: number; isValid: boolean; issues: string[] }> {
  try {
    const services = await LegacyAgentAdapter.getServices();
    const result = await services.verification.verify(content, sources);
    return {
      score: result.score,
      isValid: result.isValid,
      issues: result.issues
    };
  } catch (error) {
    console.warn('⚠️ Content verification failed:', error);
    return { score: 0, isValid: false, issues: ['Verification failed'] };
  }
}

// ============================================================================
// User Service Helpers
// ============================================================================

/**
 * Get user context with caching
 */
export async function getUserContext(userId: string) {
  try {
    const services = await LegacyAgentAdapter.getServices();
    return await services.user.getUserContext(userId);
  } catch (error) {
    console.warn('⚠️ Failed to get user context:', error);
    return null;
  }
}

/**
 * Check user quota
 */
export async function checkUserQuota(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const services = await LegacyAgentAdapter.getServices();
    return await services.user.checkQuota(userId);
  } catch (error) {
    console.warn('⚠️ Quota check failed:', error);
    return { allowed: true, remaining: 999 }; // Fail open
  }
}

