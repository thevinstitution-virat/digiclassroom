'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { UserRole, UserPersona } from '@/lib/validations'

export default function DashboardRouter() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const [isAssigningRole, setIsAssigningRole] = useState(false)
  const [hasAttemptedAssignment, setHasAttemptedAssignment] = useState(false)
  const [showFallback, setShowFallback] = useState(false)
  const [currentStep, setCurrentStep] = useState('Loading...')
  const [progress, setProgress] = useState(0)
  const [retryCount, setRetryCount] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')

  // Enhanced fallback timeout with earlier fallback options
  useEffect(() => {
    // Show fallback options after 5 seconds
    const earlyFallbackTimer = setTimeout(() => {
      if (isLoaded && user && !user.publicMetadata?.role && !hasAttemptedAssignment) {
        console.log('Early fallback options shown')
        setShowFallback(true)
        setCurrentStep('Taking longer than expected...')
        setErrorMessage('Role assignment is taking longer than usual. You can continue manually.')
      }
    }, 5000) // 5 seconds

    // Final timeout after 15 seconds
    const finalFallbackTimer = setTimeout(() => {
      if (isLoaded && user && !user.publicMetadata?.role) {
        console.log('Final timeout reached, redirecting to setup-role')
        setCurrentStep('Setup required')
        setErrorMessage('Automatic setup failed. Please complete your profile manually.')
        router.replace('/setup-role?error=timeout')
      }
    }, 15000) // 15 seconds

    return () => {
      clearTimeout(earlyFallbackTimer)
      clearTimeout(finalFallbackTimer)
    }
  }, [isLoaded, user, router, hasAttemptedAssignment])

  useEffect(() => {
    if (isLoaded && user) {
      // Get user role from public metadata
      const userRole = user.publicMetadata?.role as UserRole
      const userPersona = user.publicMetadata?.persona as UserPersona

      console.log('Dashboard router - user loaded:', {
        userId: user.id,
        userRole,
        userPersona,
        hasAttemptedAssignment,
        isAssigningRole
      })

      if (userRole) {
        // Role is assigned - redirect to appropriate dashboard
        console.log('Redirecting to dashboard with role:', userRole)
        setCurrentStep('Redirecting to your dashboard...')
        setProgress(100)
        redirectToDashboard(userRole, userPersona)
      } else if (!hasAttemptedAssignment && !isAssigningRole) {
        // User has no role assigned, auto-assign one (only once)
        console.log('No role found, attempting auto-assignment')
        setCurrentStep('Setting up your account...')
        setProgress(20)
        handleAutoRoleAssignment()
      } else if (hasAttemptedAssignment && !isAssigningRole && !userRole) {
        // Auto-assignment failed, redirect to manual setup
        console.log('Auto-assignment failed, redirecting to setup-role')
        setCurrentStep('Setup required')
        setErrorMessage('Automatic role assignment failed. Please complete setup manually.')
        setProgress(0)
        setTimeout(() => {
          router.replace('/setup-role?error=assignment-failed')
        }, 2000)
      }
    } else if (isLoaded && !user) {
      // User is not authenticated, redirect to sign-in
      console.log('User not authenticated, redirecting to sign-in')
      setCurrentStep('Authentication required')
      setErrorMessage('Please sign in to continue.')
      router.replace('/sign-in')
    } else if (isLoaded) {
      setCurrentStep('Loading your account...')
      setProgress(10)
    }
  }, [user, isLoaded, router, hasAttemptedAssignment, isAssigningRole])

  const redirectToDashboard = (role: UserRole, persona?: UserPersona) => {
    switch (role) {
      case 'admin':
        router.replace('/dashboard/admin')
        break
      case 'user':
        // For users, redirect to user dashboard with AI tutor as default
        router.replace('/dashboard/user')
        break
      default:
        console.error('Unknown role:', role)
        router.replace('/setup-role')
    }
  }

  const handleAutoRoleAssignment = async (attempt = 1) => {
    if (isAssigningRole || (hasAttemptedAssignment && attempt === 1)) return // Prevent multiple calls

    console.log(`Starting auto role assignment... (attempt ${attempt})`)
    setIsAssigningRole(true)
    if (attempt === 1) {
      setHasAttemptedAssignment(true)
    }

    try {
      setCurrentStep(`Setting up your account... (attempt ${attempt})`)
      setProgress(30 + (attempt * 10))

      const response = await fetch('/api/assign-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const result = await response.json()
      console.log('Role assignment API response:', result)

      if (result.success && result.role) {
        console.log('Role assignment successful, reloading user data...')
        setCurrentStep('Account setup complete! Loading dashboard...')
        setProgress(80)

        // Force reload user data to get updated role
        await user?.reload()

        setCurrentStep('Finalizing setup...')
        setProgress(90)

        // Reduced wait time to 1 second for metadata propagation
        setTimeout(() => {
          const assignedRole = result.role as UserRole
          const assignedPersona = result.persona as UserPersona
          console.log('Redirecting with assigned role:', assignedRole, assignedPersona)
          setProgress(100)
          redirectToDashboard(assignedRole, assignedPersona)
        }, 1000) // Reduced from 2000ms to 1000ms
      } else {
        console.error('Role assignment failed:', result.message)
        throw new Error(result.message || 'Role assignment failed')
      }
    } catch (error) {
      console.error(`Error assigning role (attempt ${attempt}):`, error)

      // Implement retry logic for failed API calls
      if (attempt < 3) {
        setRetryCount(attempt)
        setCurrentStep(`Retrying setup... (${attempt + 1}/3)`)
        setErrorMessage(`Attempt ${attempt} failed. Retrying...`)

        // Wait before retry with exponential backoff
        const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
        await new Promise(resolve => setTimeout(resolve, retryDelay))

        // Retry the assignment
        return handleAutoRoleAssignment(attempt + 1)
      } else {
        // All retries failed
        setCurrentStep('Setup failed')
        setErrorMessage('Unable to set up your account automatically. Please try manual setup.')
        setProgress(0)

        // Show fallback options immediately after all retries fail
        setShowFallback(true)

        // Still redirect to setup page after a delay
        setTimeout(() => {
          router.replace('/setup-role?error=assignment-failed')
        }, 3000)
      }
    } finally {
      setIsAssigningRole(false)
    }
  }

  // Show enhanced loading state with progress indicators
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-blue-50/40 to-indigo-100/50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900 flex items-center justify-center">
      <div className="text-center max-w-lg mx-auto px-4">
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20 dark:border-gray-700/20">
          {/* Progress Circle */}
          <div className="relative w-32 h-32 mx-auto mb-6">
            <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                className="text-gray-200 dark:text-gray-700"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 40}`}
                strokeDashoffset={`${2 * Math.PI * 40 * (1 - progress / 100)}`}
                className="text-blue-600 transition-all duration-500 ease-out"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                {progress}%
              </span>
            </div>
          </div>

          {/* Current Step */}
          <h2 className="text-2xl font-bold mb-3">
            <span className="bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
              {currentStep}
            </span>
          </h2>

          {/* Progress Description */}
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {isAssigningRole
              ? 'Please wait while we prepare your personalized experience'
              : 'Preparing your dashboard...'
            }
          </p>

          {/* Retry Information */}
          {retryCount > 0 && (
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950 rounded-xl border border-amber-200/30">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Retry {retryCount} of 3 attempts
              </p>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-950 rounded-xl border border-red-200/30">
              <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                {errorMessage}
              </p>
            </div>
          )}

          {/* Show fallback buttons after timeout */}
          {showFallback && (
            <div className="mt-6 space-y-4">
              <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                This is taking longer than expected. You can:
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => router.push('/setup-role')}
                  className="w-full h-12 bg-gradient-to-r from-orange-500 to-blue-600 hover:from-orange-600 hover:to-blue-700 text-white font-bold rounded-xl shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 transition-all duration-200"
                >
                  Complete Setup Manually
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="w-full h-12 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white font-bold rounded-xl shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 transition-all duration-200"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
