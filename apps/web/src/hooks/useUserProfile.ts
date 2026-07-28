/**
 * useUserProfile Hook
 * 
 * Fetches and manages user profile data including medium and stream preferences.
 * This is separate from subscription data as they come from different API endpoints.
 * 
 * @returns User profile data with medium, stream, and other preferences
 */

import { useState, useEffect } from 'react'
import { useSession } from '@/auth/client';
import type { Medium, Stream } from '@/config/subject-matrix'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface UserProfileData {
  userId: string
  clerkId: string
  role: string
  board: string
  medium: Medium
  class: number
  stream?: Stream
  subjects: string[]
  isOnboardingComplete: boolean
  preferences: {
    language: string
    learningStyle: string
    difficulty: string
  }
  subscription?: any
  createdAt: Date
  updatedAt: Date
}

export interface UseUserProfileReturn {
  // Raw profile data
  profileData: UserProfileData | null
  
  // Loading and error states
  isLoading: boolean
  error: string | null
  
  // Computed values for easy access
  userMedium: Medium
  userStream: Stream | undefined
  userClass: number | null
  userBoard: string | null
  
  // Utility functions
  refetch: () => Promise<void>
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useUserProfile(): UseUserProfileReturn {
  const { data: sessionData } = useSession();
  const user = sessionData?.user;
  
  // State management
  const [profileData, setProfileData] = useState<UserProfileData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch profile data
  const fetchProfile = async () => {
    if (!user) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      console.log('🔄 [useUserProfile] Fetching user profile...')

      const response = await fetch('/api/user/profile')

      if (!response.ok) {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to load profile')
        console.error('❌ [useUserProfile] Error response:', errorData)
        return
      }

      const data = await response.json()

      if (data.success && data.data) {
        setProfileData(data.data)
        console.log('✅ [useUserProfile] Profile loaded:', {
          medium: data.data.medium,
          class: data.data.class,
          board: data.data.board,
          stream: data.data.stream
        })
      } else if (data.success && !data.data) {
        // Profile not found - onboarding required
        setError('NO_PROFILE')
        console.warn('⚠️ [useUserProfile] No profile found - onboarding required')
      } else {
        setError('Invalid profile data')
        console.error('❌ [useUserProfile] Invalid data structure:', data)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError('FETCH_ERROR')
      console.error('❌ [useUserProfile] Fetch error:', errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch on mount and when user changes
  useEffect(() => {
    fetchProfile()
  }, [user])

  // Computed values with fallbacks
  const userMedium = (profileData?.medium?.toUpperCase() || 'ENGLISH') as Medium
  const userStream = profileData?.stream as Stream | undefined
  const userClass = profileData?.class ?? null
  const userBoard = profileData?.board ?? null

  return {
    profileData,
    isLoading,
    error,
    userMedium,
    userStream,
    userClass,
    userBoard,
    refetch: fetchProfile
  }
}

