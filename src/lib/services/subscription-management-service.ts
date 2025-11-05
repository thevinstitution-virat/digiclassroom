/**
 * Subscription Management Service
 * Handles subscription creation, upgrades, cancellations, and free trial management
 *
 * Features:
 * - Create free trials for new users
 * - Create paid subscriptions
 * - Upgrade/downgrade subscriptions
 * - Cancel subscriptions
 * - Track subscription history
 */

import { executeQuery, executeQuerySingle, withTransaction } from '@/lib/db/connection'
import type {
  UserSubscription,
  FreeTrial,
  CreateSubscriptionRequest,
  CreateFreeTrialRequest,
  UpgradeSubscriptionRequest,
  SubscriptionPlan
} from '@/types/subscription'
import type { PoolConnection } from 'mysql2/promise'

export class SubscriptionManagementService {

  // ============================================================================
  // FREE TRIAL MANAGEMENT
  // ============================================================================

  /**
   * Create a free trial for a new user
   */
  async createFreeTrial(request: CreateFreeTrialRequest): Promise<FreeTrial | null> {
    try {
      const { user_id, clerk_id, trial_questions_limit = 10, trial_days_limit = 7 } = request

      // Check if user already has a trial
      const existingTrial = await executeQuerySingle<any>(
        'SELECT id FROM free_trials WHERE user_id = ?',
        [user_id]
      )

      if (existingTrial) {
        console.log(`⚠️ User ${user_id} already has a trial`)
        return null
      }

      // Calculate trial end date
      const trialStartDate = new Date()
      const trialEndDate = new Date()
      trialEndDate.setDate(trialEndDate.getDate() + trial_days_limit)

      // Create trial
      const result = await executeQuery(
        `INSERT INTO free_trials (
          user_id, clerk_id, trial_type, trial_questions_limit, trial_questions_used,
          trial_days_limit, trial_start_date, trial_end_date, trial_status
        ) VALUES (?, ?, 'hybrid', ?, 0, ?, ?, ?, 'active')`,
        [user_id, clerk_id, trial_questions_limit, trial_days_limit, trialStartDate, trialEndDate]
      )

      console.log(`✅ Created free trial for user ${user_id}: ${trial_questions_limit} questions, ${trial_days_limit} days`)

      // Fetch and return the created trial
      const trial = await executeQuerySingle<any>(
        'SELECT * FROM free_trials WHERE user_id = ?',
        [user_id]
      )

      return trial ? this.mapFreeTrialFromDb(trial) : null

    } catch (error) {
      console.error('Error creating free trial:', error)
      return null
    }
  }

  /**
   * Increment trial question usage
   */
  async incrementTrialUsage(userId: string): Promise<void> {
    try {
      await executeQuery(
        `UPDATE free_trials
         SET trial_questions_used = trial_questions_used + 1,
             last_question_at = CURRENT_TIMESTAMP,
             total_sessions = total_sessions + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND trial_status = 'active'`,
        [userId]
      )

      // Update first_question_at if this is the first question
      await executeQuery(
        `UPDATE free_trials
         SET first_question_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND first_question_at IS NULL`,
        [userId]
      )

      console.log(`✅ Incremented trial usage for user ${userId}`)

    } catch (error) {
      console.error('Error incrementing trial usage:', error)
    }
  }

  // ============================================================================
  // SUBSCRIPTION CREATION
  // ============================================================================

  /**
   * Create a paid subscription
   */
  async createSubscription(request: CreateSubscriptionRequest): Promise<UserSubscription | null> {
    try {
      const { user_id, clerk_id, plan_code, billing_cycle, payment_gateway, transaction_id, payment_metadata } = request

      // Get plan details
      const plan = await this.getSubscriptionPlan(plan_code)
      if (!plan) {
        console.error(`❌ Plan not found: ${plan_code}`)
        return null
      }

      // Calculate dates
      const startDate = new Date()
      const expiryDate = new Date()

      switch (billing_cycle) {
        case 'monthly':
          expiryDate.setMonth(expiryDate.getMonth() + 1)
          break
        case 'quarterly':
          expiryDate.setMonth(expiryDate.getMonth() + 3)
          break
        case 'yearly':
          expiryDate.setFullYear(expiryDate.getFullYear() + 1)
          break
      }

      const nextBillingDate = new Date(expiryDate)

      // Use transaction to ensure atomicity
      return await withTransaction(async (connection: PoolConnection) => {
        // Create subscription
        const [result] = await connection.execute(
          `INSERT INTO user_subscriptions (
            user_id, clerk_id, subscription_plan_id, subscription_type, subscription_status,
            purchased_board, purchased_class, class_access_type, purchased_subjects,
            plan_name, plan_code, monthly_price, billing_cycle, daily_question_limit,
            start_date, expiry_date, next_billing_date, payment_status, payment_gateway,
            transaction_id, payment_metadata, auto_renew
          ) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?, ?, TRUE)`,
          [
            user_id, clerk_id, plan.id, plan.plan_type, plan.board, plan.class_level,
            plan.class_access_type, plan.included_subjects ? JSON.stringify(plan.included_subjects) : null,
            plan.plan_name, plan.plan_code, plan.monthly_price, billing_cycle, plan.daily_question_limit,
            startDate, expiryDate, nextBillingDate, payment_gateway, transaction_id,
            payment_metadata ? JSON.stringify(payment_metadata) : null
          ]
        )

        const subscriptionId = (result as any).insertId

        // Create subscription history entry
        await connection.execute(
          `INSERT INTO subscription_history (
            user_id, clerk_id, subscription_id, action, new_plan_code, new_status,
            amount, transaction_id, changed_by
          ) VALUES (?, ?, ?, 'created', ?, 'active', ?, ?, ?)`,
          [user_id, clerk_id, subscriptionId, plan.plan_code, plan.monthly_price, transaction_id, user_id]
        )

        // If user had a free trial, mark it as converted
        await connection.execute(
          `UPDATE free_trials
           SET trial_status = 'converted',
               converted_to_paid = TRUE,
               conversion_date = CURRENT_TIMESTAMP,
               converted_plan_code = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE user_id = ? AND trial_status = 'active'`,
          [plan.plan_code, user_id]
        )

        console.log(`✅ Created subscription for user ${user_id}: ${plan.plan_code}`)

        // Fetch and return the created subscription
        const [rows] = await connection.execute(
          'SELECT * FROM user_subscriptions WHERE user_id = ? AND id = ?',
          [user_id, subscriptionId]
        )

        const subscription = (rows as any[])[0]
        return subscription ? this.mapSubscriptionFromDb(subscription) : null
      })

    } catch (error) {
      console.error('Error creating subscription:', error)
      return null
    }
  }

  // ============================================================================
  // SUBSCRIPTION UPGRADES
  // ============================================================================

  /**
   * Upgrade user subscription to a new plan
   */
  async upgradeSubscription(request: UpgradeSubscriptionRequest): Promise<UserSubscription | null> {
    try {
      const { user_id, new_plan_code, billing_cycle, payment_gateway, transaction_id } = request

      // Get current subscription
      const currentSubscription = await executeQuerySingle<any>(
        `SELECT * FROM user_subscriptions
         WHERE user_id = ? AND subscription_status = 'active'
         ORDER BY expiry_date DESC LIMIT 1`,
        [user_id]
      )

      if (!currentSubscription) {
        console.error(`❌ No active subscription found for user ${user_id}`)
        return null
      }

      // Get new plan details
      const newPlan = await this.getSubscriptionPlan(new_plan_code)
      if (!newPlan) {
        console.error(`❌ Plan not found: ${new_plan_code}`)
        return null
      }

      // Calculate new expiry date
      const startDate = new Date()
      const expiryDate = new Date()

      switch (billing_cycle) {
        case 'monthly':
          expiryDate.setMonth(expiryDate.getMonth() + 1)
          break
        case 'quarterly':
          expiryDate.setMonth(expiryDate.getMonth() + 3)
          break
        case 'yearly':
          expiryDate.setFullYear(expiryDate.getFullYear() + 1)
          break
      }

      return await withTransaction(async (connection: PoolConnection) => {
        // Cancel old subscription
        await connection.execute(
          `UPDATE user_subscriptions
           SET subscription_status = 'cancelled',
               cancelled_at = CURRENT_TIMESTAMP,
               auto_renew = FALSE,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [currentSubscription.id]
        )

        // Create new subscription
        const [result] = await connection.execute(
          `INSERT INTO user_subscriptions (
            user_id, clerk_id, subscription_plan_id, subscription_type, subscription_status,
            purchased_board, purchased_class, class_access_type, purchased_subjects,
            plan_name, plan_code, monthly_price, billing_cycle, daily_question_limit,
            start_date, expiry_date, next_billing_date, payment_status, payment_gateway,
            transaction_id, auto_renew
          ) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?, TRUE)`,
          [
            user_id, currentSubscription.clerk_id, newPlan.id, newPlan.plan_type, newPlan.board,
            newPlan.class_level, newPlan.class_access_type,
            newPlan.included_subjects ? JSON.stringify(newPlan.included_subjects) : null,
            newPlan.plan_name, newPlan.plan_code, newPlan.monthly_price, billing_cycle,
            newPlan.daily_question_limit, startDate, expiryDate, expiryDate, payment_gateway, transaction_id
          ]
        )

        const newSubscriptionId = (result as any).insertId

        // Create subscription history entry
        await connection.execute(
          `INSERT INTO subscription_history (
            user_id, clerk_id, subscription_id, action, old_plan_code, new_plan_code,
            old_status, new_status, amount, transaction_id, changed_by
          ) VALUES (?, ?, ?, 'upgraded', ?, ?, 'active', 'active', ?, ?, ?)`,
          [
            user_id, currentSubscription.clerk_id, newSubscriptionId,
            currentSubscription.plan_code, newPlan.plan_code, newPlan.monthly_price, transaction_id, user_id
          ]
        )

        console.log(`✅ Upgraded subscription for user ${user_id}: ${currentSubscription.plan_code} → ${newPlan.plan_code}`)

        // Fetch and return the new subscription
        const [rows] = await connection.execute(
          'SELECT * FROM user_subscriptions WHERE id = ?',
          [newSubscriptionId]
        )

        const subscription = (rows as any[])[0]
        return subscription ? this.mapSubscriptionFromDb(subscription) : null
      })

    } catch (error) {
      console.error('Error upgrading subscription:', error)
      return null
    }
  }

  // ============================================================================
  // SUBSCRIPTION CANCELLATION
  // ============================================================================

  /**
   * Cancel user subscription
   */
  async cancelSubscription(userId: string, reason?: string): Promise<boolean> {
    try {
      const subscription = await executeQuerySingle<any>(
        `SELECT * FROM user_subscriptions
         WHERE user_id = ? AND subscription_status = 'active'
         ORDER BY expiry_date DESC LIMIT 1`,
        [userId]
      )

      if (!subscription) {
        console.error(`❌ No active subscription found for user ${userId}`)
        return false
      }

      return await withTransaction(async (connection: PoolConnection) => {
        // Update subscription status
        await connection.execute(
          `UPDATE user_subscriptions
           SET subscription_status = 'cancelled',
               cancelled_at = CURRENT_TIMESTAMP,
               auto_renew = FALSE,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [subscription.id]
        )

        // Create subscription history entry
        await connection.execute(
          `INSERT INTO subscription_history (
            user_id, clerk_id, subscription_id, action, old_plan_code, old_status,
            new_status, reason, changed_by
          ) VALUES (?, ?, ?, 'cancelled', ?, 'active', 'cancelled', ?, ?)`,
          [userId, subscription.clerk_id, subscription.id, subscription.plan_code, reason, userId]
        )

        console.log(`✅ Cancelled subscription for user ${userId}`)
        return true
      })

    } catch (error) {
      console.error('Error cancelling subscription:', error)
      return false
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Get subscription plan by code
   */
  private async getSubscriptionPlan(planCode: string): Promise<SubscriptionPlan | null> {
    try {
      const plan = await executeQuerySingle<any>(
        'SELECT * FROM subscription_plans WHERE plan_code = ? AND is_active = TRUE',
        [planCode]
      )

      return plan ? this.mapPlanFromDb(plan) : null

    } catch (error) {
      console.error('Error getting subscription plan:', error)
      return null
    }
  }

  /**
   * Map database row to SubscriptionPlan
   */
  private mapPlanFromDb(row: any): SubscriptionPlan {
    return {
      id: row.id,
      plan_name: row.plan_name,
      plan_code: row.plan_code,
      plan_type: row.plan_type,
      board: row.board,
      class_level: row.class_level,
      class_access_type: row.class_access_type,
      included_subjects: row.included_subjects ? JSON.parse(row.included_subjects) : null,
      monthly_price: parseFloat(row.monthly_price),
      quarterly_price: row.quarterly_price ? parseFloat(row.quarterly_price) : null,
      yearly_price: row.yearly_price ? parseFloat(row.yearly_price) : null,
      daily_question_limit: row.daily_question_limit,
      features: row.features ? JSON.parse(row.features) : null,
      display_name: row.display_name,
      description: row.description,
      highlight_text: row.highlight_text,
      display_order: row.display_order,
      is_active: Boolean(row.is_active),
      is_featured: Boolean(row.is_featured),
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    }
  }

  /**
   * Map database row to UserSubscription
   */
  private mapSubscriptionFromDb(row: any): UserSubscription {
    return {
      id: row.id,
      user_id: row.user_id,
      clerk_id: row.clerk_id,
      subscription_plan_id: row.subscription_plan_id,
      subscription_type: row.subscription_type,
      subscription_status: row.subscription_status,
      purchased_board: row.purchased_board,
      purchased_class: row.purchased_class,
      class_access_type: row.class_access_type,
      purchased_subjects: row.purchased_subjects ? JSON.parse(row.purchased_subjects) : null,
      plan_name: row.plan_name,
      plan_code: row.plan_code,
      monthly_price: parseFloat(row.monthly_price),
      billing_cycle: row.billing_cycle,
      daily_question_limit: row.daily_question_limit,
      start_date: new Date(row.start_date),
      expiry_date: new Date(row.expiry_date),
      last_payment_date: row.last_payment_date ? new Date(row.last_payment_date) : null,
      next_billing_date: row.next_billing_date ? new Date(row.next_billing_date) : null,
      cancelled_at: row.cancelled_at ? new Date(row.cancelled_at) : null,
      payment_status: row.payment_status,
      payment_gateway: row.payment_gateway,
      transaction_id: row.transaction_id,
      payment_metadata: row.payment_metadata ? JSON.parse(row.payment_metadata) : null,
      auto_renew: Boolean(row.auto_renew),
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
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
}

// Export singleton instance
export const subscriptionManagementService = new SubscriptionManagementService()

