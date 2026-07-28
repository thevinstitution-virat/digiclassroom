/**
 * Subscription Validation Service
 * Handles all subscription-related access control and quota management
 *
 * Features:
 * - Board/Class/Subject access validation
 * - Daily question quota enforcement
 * - Free trial management
 * - Subscription status checking
 *
 * Migrated to Drizzle ORM (Phase 4)
 */

import { db } from '@/db'
import { userSubscriptions, freeTrials, aiTutorUsage, quotaAlerts } from '@/db/schema'
import { eq, and, gt, sql, inArray } from 'drizzle-orm'
import type {
  UserSubscription,
  FreeTrial,
  QuotaCheckResponse,
  AccessCheckResponse,
  SubscriptionValidationResult,
  Board,
  IncrementQuestionRequest,
  QuestionLogEntry
} from '@/types/subscription'

export class SubscriptionValidationService {

  // ============================================================================
  // BOARD ACCESS VALIDATION
  // ============================================================================

  /**
   * Check if user has access to specific board
   */
  async hasAccessToBoard(userId: string, board: string): Promise<boolean> {
    try {
      const subscription = await this.getUserSubscription(userId)

      if (!subscription) {
        console.log(`❌ No subscription found for user ${userId}`)
        return false
      }

      if (subscription.subscription_status !== 'active' && subscription.subscription_status !== 'trial') {
        console.log(`❌ Subscription not active for user ${userId}: ${subscription.subscription_status}`)
        return false
      }

      // Full access plan
      if (subscription.purchased_board === 'ALL') {
        console.log(`✅ User ${userId} has full board access`)
        return true
      }

      // Board-specific access
      const hasAccess = subscription.purchased_board === board.toUpperCase()
      console.log(`${hasAccess ? '✅' : '❌'} User ${userId} board access: ${subscription.purchased_board} vs ${board}`)
      return hasAccess

    } catch (error) {
      console.error('Error checking board access:', error)
      return false
    }
  }

  // ============================================================================
  // CLASS ACCESS VALIDATION
  // ============================================================================

  /**
   * Check if user has access to specific class
   */
  async hasAccessToClass(userId: string, board: string, classLevel: number): Promise<boolean> {
    try {
      // First check board access
      const hasBoardAccess = await this.hasAccessToBoard(userId, board)
      if (!hasBoardAccess) {
        console.log(`❌ User ${userId} doesn't have board access for ${board}`)
        return false
      }

      const subscription = await this.getUserSubscription(userId)
      if (!subscription) return false

      // Full access to all classes
      if (subscription.purchased_class === null || subscription.class_access_type === 'all') {
        console.log(`✅ User ${userId} has access to all classes`)
        return true
      }

      // Class-specific access
      const hasAccess = subscription.purchased_class === classLevel
      console.log(`${hasAccess ? '✅' : '❌'} User ${userId} class access: ${subscription.purchased_class} vs ${classLevel}`)
      return hasAccess

    } catch (error) {
      console.error('Error checking class access:', error)
      return false
    }
  }

  // ============================================================================
  // SUBJECT ACCESS VALIDATION
  // ============================================================================

  /**
   * Check if user has access to specific subject
   */
  async hasAccessToSubject(userId: string, board: string, classLevel: number, subject: string): Promise<boolean> {
    try {
      // First check class access
      const hasClassAccess = await this.hasAccessToClass(userId, board, classLevel)
      if (!hasClassAccess) {
        console.log(`❌ User ${userId} doesn't have class access for ${board} Class ${classLevel}`)
        return false
      }

      const subscription = await this.getUserSubscription(userId)
      if (!subscription) return false

      // All subjects included (NULL or empty array)
      if (!subscription.purchased_subjects || subscription.purchased_subjects.length === 0) {
        console.log(`✅ User ${userId} has access to all subjects`)
        return true
      }

      // Subject-specific access
      const hasAccess = subscription.purchased_subjects.includes(subject)
      console.log(`${hasAccess ? '✅' : '❌'} User ${userId} subject access: ${subject} in [${subscription.purchased_subjects.join(', ')}]`)
      return hasAccess

    } catch (error) {
      console.error('Error checking subject access:', error)
      return false
    }
  }

  // ============================================================================
  // DAILY QUESTION QUOTA
  // ============================================================================

  /**
   * Check if user can ask a question (daily quota check)
   */
  async canAskQuestion(userId: string): Promise<QuotaCheckResponse> {
    try {
      const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

      // Get the user's subscription to determine the daily limit
      const subscription = await this.getUserSubscription(userId)
      const limit = subscription?.daily_question_limit || 30

      // Get today's usage via Drizzle (only select columns that exist in the table)
      const [usage] = await db
        .select({
          questionsAsked: aiTutorUsage.questionsAsked,
        })
        .from(aiTutorUsage)
        .where(
          and(
            eq(aiTutorUsage.userId, userId),
            sql`DATE(${aiTutorUsage.date}) = ${today}`
          )
        )
        .limit(1)

      if (!usage) {
        // First question of the day
        console.log(`✅ First question of the day for user ${userId}, limit: ${limit}`)
        return { allowed: true, remaining: limit - 1, limit }
      }

      const remaining = limit - (usage.questionsAsked || 0)
      const allowed = remaining > 0

      console.log(`${allowed ? '✅' : '❌'} User ${userId} quota: ${usage.questionsAsked}/${limit}, remaining: ${remaining}`)

      return {
        allowed,
        remaining: Math.max(0, remaining),
        limit,
        message: allowed ? undefined : `Daily limit of ${limit} questions reached. Upgrade your plan for more questions!`
      }

    } catch (error) {
      console.error('Error checking question quota:', error)
      return { allowed: true, remaining: 10, limit: 10, message: 'Using default free quota' }
    }
  }

  // ============================================================================
  // INCREMENT QUESTION COUNT
  // ============================================================================

  /**
   * Increment question count for the day
   * NOTE: This still uses raw SQL via the shared pool for the complex
   * JSON operations (questions_log append). Will be fully migrated in Phase 5.
   */
  async incrementQuestionCount(userId: string, clerkId: string, metadata: QuestionLogEntry): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0]
      const { executeQuery, executeQuerySingle } = await import('@/lib/db/connection')

      // Check if record exists for today
      const existing = await executeQuerySingle<any>(
        'SELECT id, questions_asked FROM ai_tutor_usage WHERE user_id = ? AND DATE(date) = ?',
        [userId, today]
      )

      if (existing) {
        // Update existing record
        await executeQuery(
          `UPDATE ai_tutor_usage
           SET questions_asked = questions_asked + 1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [existing.id]
        )

        console.log(`✅ Incremented question count for user ${userId}: ${existing.questions_asked + 1}`)

      } else {
        // Create new record for today
        const subscription = await this.getUserSubscription(userId)
        const dailyLimit = subscription?.daily_question_limit || 30

        await executeQuery(
          `INSERT INTO ai_tutor_usage (user_id, date, questions_asked)
           VALUES (?, ?, 1)`,
          [userId, today]
        )

        console.log(`✅ Created new usage record for user ${userId}, limit: ${dailyLimit}`)
      }

      // Check if we should create quota alerts
      await this.checkAndCreateQuotaAlerts(userId, clerkId)

    } catch (error) {
      console.error('Error incrementing question count:', error)
      throw error
    }
  }

  // ============================================================================
  // GET USER SUBSCRIPTION
  // ============================================================================

  /**
   * Get active subscription for user
   */
  async getUserSubscription(userId: string): Promise<UserSubscription | null> {
    try {
      // Try to get active paid subscription first via Drizzle
      const [subscription] = await db
        .select()
        .from(userSubscriptions)
        .where(
          and(
            eq(userSubscriptions.userId, userId),
            inArray(userSubscriptions.subscriptionStatus, ['active', 'trial']),
            gt(userSubscriptions.expiryDate, new Date())
          )
        )
        .orderBy(sql`${userSubscriptions.expiryDate} DESC`)
        .limit(1)

      if (subscription) {
        console.log(`✅ Found active subscription for user ${userId}: ${subscription.planCode}`)
        return this.mapSubscriptionFromDb(subscription)
      }

      // Check for free trial
      const trial = await this.getFreeTrial(userId)
      if (trial) {
        console.log(`✅ User ${userId} is on free trial`)
        return this.convertTrialToSubscription(trial)
      }

      console.log(`❌ No active subscription or trial found for user ${userId}`)
      return null

    } catch (error) {
      console.error('Error getting user subscription:', error)
      return null
    }
  }

  // ============================================================================
  // FREE TRIAL MANAGEMENT
  // ============================================================================

  /**
   * Get free trial details for user
   */
  async getFreeTrial(userId: string): Promise<FreeTrial | null> {
    try {
      const { db } = await import('@/db')
      const { freeTrials } = await import('@/db/schema')

      const [trial] = await db
        .select()
        .from(freeTrials)
        .where(
          and(
            eq(freeTrials.userId, userId),
            gt(freeTrials.trialEnd, new Date()),
            eq(freeTrials.isConverted, false)
          )
        )
        .limit(1)

      if (!trial) return null

      // Map Drizzle row to FreeTrial interface
      return {
        id: trial.id,
        user_id: trial.userId,
        clerk_id: trial.userId, // fallback
        trial_type: 'hybrid',
        trial_questions_limit: 10,
        trial_questions_used: 0,
        trial_days_limit: 7,
        trial_start_date: trial.trialStart || new Date(),
        trial_end_date: trial.trialEnd || new Date(),
        trial_status: 'active',
        converted_to_paid: trial.isConverted || false,
        conversion_date: null,
        converted_plan_code: null,
        first_question_at: null,
        last_question_at: null,
        total_sessions: 0,
        created_at: trial.createdAt || new Date(),
        updated_at: trial.createdAt || new Date()
      } as any

    } catch (error) {
      console.error('Error getting free trial:', error)
      return null
    }
  }

  /**
   * Expire free trial
   */
  async expireFreeTrial(userId: string): Promise<void> {
    try {
      const { db } = await import('@/db')
      const { freeTrials } = await import('@/db/schema')

      await db.update(freeTrials)
        .set({ trialEnd: new Date() })
        .where(eq(freeTrials.userId, userId))

      console.log(`✅ Expired free trial for user ${userId}`)
    } catch (error) {
      console.error('Error expiring free trial:', error)
    }
  }

  // ============================================================================
  // GET AVAILABLE CONTENT
  // ============================================================================

  /**
   * Get available boards for user
   */
  async getAvailableBoards(userId: string): Promise<Board[]> {
    try {
      const subscription = await this.getUserSubscription(userId)

      if (!subscription) return []

      if (subscription.purchased_board === 'ALL') {
        return ['CBSE', 'ICSE', 'STATE_BOARD']
      }

      if (subscription.purchased_board) {
        return [subscription.purchased_board as Board]
      }

      return []

    } catch (error) {
      console.error('Error getting available boards:', error)
      return []
    }
  }

  /**
   * Get available classes for user (for a specific board)
   */
  async getAvailableClasses(userId: string, board: string): Promise<number[]> {
    try {
      const subscription = await this.getUserSubscription(userId)

      if (!subscription) return []

      // Check board access first
      const hasBoardAccess = await this.hasAccessToBoard(userId, board)
      if (!hasBoardAccess) return []

      // Full access to all classes
      if (subscription.purchased_class === null || subscription.class_access_type === 'all') {
        return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
      }

      // Class-specific access
      return [subscription.purchased_class]

    } catch (error) {
      console.error('Error getting available classes:', error)
      return []
    }
  }

  /**
   * Get available subjects for user (for a specific board and class)
   */
  async getAvailableSubjects(userId: string, board: string, classLevel: number): Promise<string[]> {
    try {
      const subscription = await this.getUserSubscription(userId)

      if (!subscription) return []

      // Check class access first
      const hasClassAccess = await this.hasAccessToClass(userId, board, classLevel)
      if (!hasClassAccess) return []

      // All subjects included
      if (!subscription.purchased_subjects || subscription.purchased_subjects.length === 0) {
        return this.getAllSubjectsForClass(classLevel)
      }

      // Subject-specific access
      return subscription.purchased_subjects

    } catch (error) {
      console.error('Error getting available subjects:', error)
      return []
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Get all subjects for a class level
   */
  private getAllSubjectsForClass(classLevel: number): string[] {
    if (classLevel <= 5) {
      return ['English', 'Hindi', 'Mathematics', 'Environmental Studies']
    } else if (classLevel <= 8) {
      return ['English', 'Hindi', 'Mathematics', 'Science', 'Social Science', 'Sanskrit']
    } else if (classLevel <= 10) {
      return ['English', 'Hindi', 'Mathematics', 'Science', 'Social Science', 'Sanskrit', 'Computer Science']
    } else {
      return ['English', 'Physics', 'Chemistry', 'Mathematics', 'Biology', 'Computer Science', 'Economics', 'Business Studies', 'Accountancy']
    }
  }

  /**
   * Check and create quota alerts
   * NOTE: Still uses raw SQL for the complex alert date logic. Will be migrated in Phase 5.
   */
  private async checkAndCreateQuotaAlerts(userId: string, clerkId: string): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0]
      const { executeQuery, executeQuerySingle } = await import('@/lib/db/connection')

      const usage = await executeQuerySingle<any>(
        'SELECT questions_asked FROM ai_tutor_usage WHERE user_id = ? AND DATE(date) = ?',
        [userId, today]
      )

      if (!usage) return

      // Get daily limit from subscription since the column doesn't exist in ai_tutor_usage
      const subscription = await this.getUserSubscription(userId)
      const dailyLimit = subscription?.daily_question_limit || 30

      const percentUsed = (usage.questions_asked / dailyLimit) * 100
      const remaining = dailyLimit - usage.questions_asked

      let alertType: string | null = null

      if (percentUsed >= 100) {
        alertType = 'quota_exhausted'
      } else if (percentUsed >= 80) {
        alertType = 'quota_80_percent'
      } else if (percentUsed >= 50) {
        alertType = 'quota_50_percent'
      }

      if (alertType) {
        // Check if alert already exists for today
        const existingAlert = await executeQuerySingle<any>(
          'SELECT id FROM quota_alerts WHERE user_id = ? AND alert_type = ? AND DATE(created_at) = ?',
          [userId, alertType, today]
        )

        if (!existingAlert) {
          await db.insert(quotaAlerts).values({
            userId,
            alertType,
            message: `Quota alert: ${alertType}. ${remaining} questions remaining.`,
            isRead: false,
          })
          console.log(`✅ Created ${alertType} alert for user ${userId}`)
        }
      }

    } catch (error) {
      console.error('Error creating quota alerts:', error)
    }
  }

  /**
   * Map database row to UserSubscription
   */
  private mapSubscriptionFromDb(row: any): UserSubscription {
    // Handle purchased_subjects - could be string (raw SQL) or already parsed (Drizzle JSON)
    let purchasedSubjects = null
    if (row.purchased_subjects || row.purchasedSubjects) {
      const raw = row.purchased_subjects || row.purchasedSubjects
      if (typeof raw === 'string') {
        try { purchasedSubjects = JSON.parse(raw) } catch { purchasedSubjects = null }
      } else {
        purchasedSubjects = raw
      }
    }

    return {
      id: row.id,
      user_id: row.user_id || row.userId,
      clerk_id: row.clerk_id || row.clerkId,
      subscription_plan_id: row.subscription_plan_id || row.subscriptionPlanId,
      subscription_type: row.subscription_type || row.subscriptionType,
      subscription_status: row.subscription_status || row.subscriptionStatus,
      purchased_board: row.purchased_board || row.purchasedBoard,
      purchased_class: row.purchased_class ?? row.purchasedClass ?? null,
      class_access_type: row.class_access_type || row.classAccessType,
      purchased_subjects: purchasedSubjects,
      plan_name: row.plan_name || row.planName,
      plan_code: row.plan_code || row.planCode,
      monthly_price: parseFloat(row.monthly_price || row.monthlyPrice || '0'),
      billing_cycle: row.billing_cycle || row.billingCycle,
      daily_question_limit: row.daily_question_limit || row.dailyQuestionLimit,
      start_date: new Date(row.start_date || row.startDate),
      expiry_date: new Date(row.expiry_date || row.expiryDate),
      last_payment_date: (row.last_payment_date || row.lastPaymentDate) ? new Date(row.last_payment_date || row.lastPaymentDate) : null,
      next_billing_date: (row.next_billing_date || row.nextBillingDate) ? new Date(row.next_billing_date || row.nextBillingDate) : null,
      cancelled_at: (row.cancelled_at || row.cancelledAt) ? new Date(row.cancelled_at || row.cancelledAt) : null,
      payment_status: row.payment_status || row.paymentStatus,
      payment_gateway: row.payment_gateway || row.paymentGateway,
      transaction_id: row.transaction_id || row.transactionId,
      payment_metadata: (() => {
        const raw = row.payment_metadata || row.paymentMetadata
        if (!raw) return null
        if (typeof raw === 'string') { try { return JSON.parse(raw) } catch { return null } }
        return raw
      })(),
      auto_renew: Boolean(row.auto_renew ?? row.autoRenew),
      created_at: new Date(row.created_at || row.createdAt),
      updated_at: new Date(row.updated_at || row.updatedAt)
    }
  }

  /**
   * Map database row to FreeTrial
   */
  private mapFreeTrialFromDb(row: any): FreeTrial {
    return {
      id: row.id,
      user_id: row.user_id,
      clerk_id: row.clerk_id,
      trial_type: row.trial_type,
      trial_questions_limit: row.trial_questions_limit,
      trial_questions_used: row.trial_questions_used,
      trial_days_limit: row.trial_days_limit,
      trial_start_date: new Date(row.trial_start_date),
      trial_end_date: new Date(row.trial_end_date),
      trial_status: row.trial_status,
      converted_to_paid: Boolean(row.converted_to_paid),
      conversion_date: row.conversion_date ? new Date(row.conversion_date) : null,
      converted_plan_code: row.converted_plan_code,
      first_question_at: row.first_question_at ? new Date(row.first_question_at) : null,
      last_question_at: row.last_question_at ? new Date(row.last_question_at) : null,
      total_sessions: row.total_sessions,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    }
  }

  /**
   * Convert FreeTrial to UserSubscription format
   */
  private convertTrialToSubscription(trial: FreeTrial): UserSubscription {
    return {
      id: trial.id,
      user_id: trial.user_id,
      clerk_id: trial.clerk_id,
      subscription_plan_id: null,
      subscription_type: 'free_trial',
      subscription_status: 'trial',
      purchased_board: 'ALL',
      purchased_class: null,
      class_access_type: 'all',
      purchased_subjects: null,
      plan_name: 'Free Trial',
      plan_code: 'FREE_TRIAL',
      monthly_price: 0,
      billing_cycle: 'monthly',
      daily_question_limit: trial.trial_questions_limit,
      start_date: trial.trial_start_date,
      expiry_date: trial.trial_end_date,
      last_payment_date: null,
      next_billing_date: null,
      cancelled_at: null,
      payment_status: 'paid',
      payment_gateway: null,
      transaction_id: null,
      payment_metadata: null,
      auto_renew: false,
      created_at: trial.created_at,
      updated_at: trial.updated_at
    }
  }
}

// Export singleton instance
export const subscriptionValidationService = new SubscriptionValidationService()
