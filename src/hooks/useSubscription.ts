/**
 * useSubscription Hook
 * 
 * Centralized subscription data fetching and management hook.
 * Provides subscription details, quota information, and access control data.
 * 
 * This hook eliminates code duplication across AI Tutor, Materials, and PracTest pages.
 * 
 * @returns {Object} Subscription data and computed values
 */

import { useState, useEffect } from 'react'
import { useSession } from '@/auth/client';
import type { Medium, Stream } from '@/config/subject-matrix'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface SubscriptionData {
  subscription: {
    id?: string
    plan_name: string
    plan_code: string
    subscription_type?: string
    subscription_status: string
    purchased_board: string | null
    purchased_class: number | null
    class_access_type: string
    purchased_subjects: string[] | null
    daily_question_limit: number
    expiry_date: string
    monthly_price?: number
    billing_cycle?: string
    start_date?: string
    next_billing_date?: string
    payment_status?: string
    auto_renew?: boolean
  }
  quota: {
    daily_limit: number
    questions_asked: number
    questions_remaining: number
    can_ask_question: boolean
    message?: string
    percentage_used: number
  }
  access: {
    boards: string[]
    has_full_access: boolean
    has_all_classes: boolean
    has_all_subjects: boolean
    classes?: number[]
    subjects?: string[]
  }
  is_trial?: boolean
  is_active?: boolean
  is_expired?: boolean
  needs_upgrade?: boolean
}

export interface UseSubscriptionReturn {
  // Raw subscription data
  subscriptionData: SubscriptionData | null

  // Loading and error states
  isLoading: boolean
  error: string | null

  // Computed values for easy access
  userClass: number | null
  userBoard: string | null
  hasAllSubjects: boolean
  purchasedSubjects: string[] | null

  // Utility functions
  refetch: () => Promise<void>
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useSubscription(): UseSubscriptionReturn {
  const { data: sessionData } = useSession();
  const user = sessionData?.user;

  // State management
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch subscription data
  const fetchSubscription = async () => {
    if (!user) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      console.log('🔄 [useSubscription] Fetching subscription data...')

      const response = await fetch('/api/user/subscription')

      if (!response.ok) {
        const errorData = await response.json()

        if (response.status === 404) {
          // No subscription found - provide a fallback so quota doesn't show 0/0
          setError('NO_SUBSCRIPTION')
          console.warn('⚠️ [useSubscription] No subscription found')
          setSubscriptionData({
            subscription: {
              plan_name: 'No Plan',
              plan_code: 'NONE',
              subscription_status: 'inactive',
              purchased_board: null,
              purchased_class: null,
              class_access_type: 'none',
              purchased_subjects: null,
              daily_question_limit: 0,
              expiry_date: new Date().toISOString()
            },
            quota: { daily_limit: 0, questions_asked: 0, questions_remaining: 0, can_ask_question: false, percentage_used: 100 },
            access: { boards: [], classes: [], subjects: [], has_full_access: false, has_all_classes: false, has_all_subjects: false },
            is_trial: false,
            is_active: false,
            is_expired: true,
            needs_upgrade: true
          })
        } else {
          setError(errorData.error || 'Failed to load subscription')
          console.error('❌ [useSubscription] Error response:', errorData)
        }
        return
      }

      const data = await response.json()

      if (data.success && data.data) {
        setSubscriptionData(data.data)
        console.log('✅ [useSubscription] Subscription loaded:', {
          plan: data.data.subscription.plan_name,
          class: data.data.subscription.purchased_class,
          board: data.data.subscription.purchased_board,
          subjects: data.data.subscription.purchased_subjects,
          hasAllSubjects: data.data.access.has_all_subjects
        })
      } else {
        setError('Invalid subscription data')
        console.error('❌ [useSubscription] Invalid data structure:', data)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError('FETCH_ERROR')
      console.error('❌ [useSubscription] Fetch error:', errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch on mount and when user changes
  useEffect(() => {
    fetchSubscription()
  }, [user])

  // Computed values
  const userClass = subscriptionData?.subscription.purchased_class ?? null
  const userBoard = subscriptionData?.subscription.purchased_board ?? null
  const hasAllSubjects = subscriptionData?.access.has_all_subjects ?? false
  const purchasedSubjects = subscriptionData?.subscription.purchased_subjects ?? null

  return {
    subscriptionData,
    isLoading,
    error,
    userClass,
    userBoard,
    hasAllSubjects,
    purchasedSubjects,
    refetch: fetchSubscription
  }
}

