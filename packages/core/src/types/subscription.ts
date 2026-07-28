/**
 * TypeScript Type Definitions for Subscription & Monetization System
 * Corresponds to: src/lib/db/subscription-schema.sql
 */

// ============================================================================
// ENUMS
// ============================================================================

export type PlanType = 'free_trial' | 'board_access' | 'class_access' | 'subject_bundle' | 'full_access'

export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'trial' | 'pending'

export type PaymentStatus = 'paid' | 'pending' | 'failed' | 'refunded'

export type BillingCycle = 'monthly' | 'quarterly' | 'yearly'

export type Board = 'CBSE' | 'ICSE' | 'STATE_BOARD' | 'ALL'

export type ClassAccessType = 'single' | 'all'

export type TrialType = 'questions_based' | 'time_based' | 'hybrid'

export type TrialStatus = 'active' | 'expired' | 'converted' | 'cancelled'

export type SubscriptionAction = 'created' | 'renewed' | 'upgraded' | 'downgraded' | 'cancelled' | 'expired' | 'refunded'

export type AlertType = 'quota_50_percent' | 'quota_80_percent' | 'quota_exhausted' | 'trial_expiring' | 'subscription_expiring'

export type PaymentGateway = 'razorpay' | 'stripe' | 'manual' | null

// ============================================================================
// SUBSCRIPTION PLANS
// ============================================================================

export interface SubscriptionPlan {
  id: string
  
  // Plan Details
  plan_name: string
  plan_code: string // 'FREE_TRIAL', 'BASIC_CBSE', 'PRO_CBSE', 'PREMIUM'
  plan_type: PlanType
  
  // Content Scope
  board: Board
  class_level: number | null // 1-12 or NULL for all classes
  class_access_type: ClassAccessType
  included_subjects: string[] | null // NULL = all subjects
  
  // Pricing
  monthly_price: number
  quarterly_price: number | null
  yearly_price: number | null
  
  // Limits & Features
  daily_question_limit: number
  features: Record<string, any> | null // e.g., { priority_support: true, downloadable_materials: true }
  
  // Display & Marketing
  display_name: string
  description: string | null
  highlight_text: string | null // "Most Popular", "Best Value"
  display_order: number
  is_active: boolean
  is_featured: boolean
  
  // Metadata
  created_at: Date
  updated_at: Date
}

// ============================================================================
// USER SUBSCRIPTIONS
// ============================================================================

export interface UserSubscription {
  id: string
  user_id: string
  clerk_id: string
  
  // Subscription Details
  subscription_plan_id: string | null
  subscription_type: PlanType
  subscription_status: SubscriptionStatus
  
  // Content Access (denormalized for performance)
  purchased_board: Board | null
  purchased_class: number | null // 1-12 or NULL for all classes
  class_access_type: ClassAccessType
  purchased_subjects: string[] | null // NULL or empty = all subjects
  
  // Pricing & Billing
  plan_name: string
  plan_code: string
  monthly_price: number
  billing_cycle: BillingCycle
  
  // Limits
  daily_question_limit: number
  
  // Dates
  start_date: Date
  expiry_date: Date
  last_payment_date: Date | null
  next_billing_date: Date | null
  cancelled_at: Date | null
  
  // Payment
  payment_status: PaymentStatus
  payment_gateway: PaymentGateway
  transaction_id: string | null
  payment_metadata: Record<string, any> | null
  
  // Auto-renewal
  auto_renew: boolean
  
  // Metadata
  created_at: Date
  updated_at: Date
}

// ============================================================================
// AI TUTOR USAGE
// ============================================================================

export interface QuestionLogEntry {
  timestamp: string
  subject: string
  board: string
  class: string
  menu_type: string
  tokens_used?: number
}

export interface AITutorUsage {
  id: string
  user_id: string
  clerk_id: string
  
  // Usage Tracking
  usage_date: string // DATE format: YYYY-MM-DD
  questions_asked: number
  daily_limit: number
  
  // Question Details (for analytics)
  questions_log: QuestionLogEntry[] | null
  
  // Analytics
  total_tokens_used: number
  avg_response_time_ms: number
  
  // Metadata
  created_at: Date
  updated_at: Date
}

// ============================================================================
// FREE TRIALS
// ============================================================================

export interface FreeTrial {
  id: string
  user_id: string
  clerk_id: string
  
  // Trial Details
  trial_type: TrialType
  trial_questions_limit: number // Default: 10
  trial_questions_used: number
  trial_days_limit: number // Default: 7
  
  // Dates
  trial_start_date: Date
  trial_end_date: Date
  trial_status: TrialStatus
  
  // Conversion Tracking
  converted_to_paid: boolean
  conversion_date: Date | null
  converted_plan_code: string | null
  
  // Engagement Metrics
  first_question_at: Date | null
  last_question_at: Date | null
  total_sessions: number
  
  // Metadata
  created_at: Date
  updated_at: Date
}

// ============================================================================
// SUBSCRIPTION HISTORY
// ============================================================================

export interface SubscriptionHistory {
  id: string
  user_id: string
  clerk_id: string
  subscription_id: string
  
  // Change Details
  action: SubscriptionAction
  old_plan_code: string | null
  new_plan_code: string | null
  old_status: string | null
  new_status: string | null
  
  // Financial
  amount: number | null
  transaction_id: string | null
  
  // Metadata
  reason: string | null
  changed_by: string | null // user_id or 'system' or 'admin'
  metadata: Record<string, any> | null
  created_at: Date
}

// ============================================================================
// QUOTA ALERTS
// ============================================================================

export interface QuotaAlert {
  id: string
  user_id: string
  clerk_id: string
  
  // Alert Details
  alert_type: AlertType
  alert_date: string // DATE format: YYYY-MM-DD
  questions_remaining: number
  
  // Notification Status
  notification_sent: boolean
  notification_sent_at: Date | null
  
  // User Action
  user_upgraded: boolean
  upgraded_at: Date | null
  
  // Metadata
  created_at: Date
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface SubscriptionCheckResponse {
  success: boolean
  subscription: UserSubscription | null
  remaining: number
  limit: number
  hasActiveSubscription: boolean
}

export interface QuotaCheckResponse {
  allowed: boolean
  remaining: number
  limit: number
  message?: string
}

export interface AccessCheckResponse {
  hasAccess: boolean
  reason?: string
  upgradeUrl?: string
}

export interface SubscriptionValidationResult {
  isValid: boolean
  subscription: UserSubscription | null
  trial: FreeTrial | null
  quotaInfo: {
    questionsAsked: number
    dailyLimit: number
    remaining: number
  }
  accessInfo: {
    boards: Board[]
    classes: number[]
    subjects: string[]
  }
}

// ============================================================================
// SERVICE REQUEST/RESPONSE TYPES
// ============================================================================

export interface CreateSubscriptionRequest {
  user_id: string
  clerk_id: string
  plan_code: string
  billing_cycle: BillingCycle
  payment_gateway: PaymentGateway
  transaction_id: string
  payment_metadata?: Record<string, any>
}

export interface CreateFreeTrialRequest {
  user_id: string
  clerk_id: string
  trial_questions_limit?: number // Default: 10
  trial_days_limit?: number // Default: 7
}

export interface IncrementQuestionRequest {
  user_id: string
  clerk_id: string
  metadata: {
    subject: string
    board: string
    class: string
    menu_type: string
    tokens_used?: number
  }
}

export interface UpgradeSubscriptionRequest {
  user_id: string
  new_plan_code: string
  billing_cycle: BillingCycle
  payment_gateway: PaymentGateway
  transaction_id: string
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface PlanFeatures {
  priority_support?: boolean
  downloadable_materials?: boolean
  personalized_learning?: boolean
  one_on_one_sessions?: boolean
  unlimited_questions?: boolean
}

export interface SubscriptionSummary {
  plan_name: string
  plan_code: string
  status: SubscriptionStatus
  board: Board | null
  class: number | null
  subjects: string[] | null
  daily_limit: number
  questions_used_today: number
  questions_remaining: number
  expiry_date: Date
  days_remaining: number
  auto_renew: boolean
}

