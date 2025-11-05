'use client'

import { useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { EnhancedLandingPage } from '@/components/landing/EnhancedLandingPage'

export default function Home() {
  const { user, isLoaded } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (isLoaded) {
      if (user) {
        // User is authenticated, redirect to dashboard for auth processing
        router.push('/dashboard')
      } else {
        // User is not authenticated, show landing page
        // No redirect needed - component will render below
      }
    }
  }, [user, isLoaded, router])

  // Show loading state while checking authentication
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-500 mx-auto"></div>
          <h2 className="mt-4 text-xl font-semibold text-gray-900 dark:text-gray-100">
            Loading Digi Classroom...
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Preparing your personalized learning experience
          </p>
        </div>
      </div>
    )
  }

  // Show comprehensive landing page for unauthenticated users
  if (!user) {
    return <EnhancedLandingPage />
  }

  // Fallback loading state during redirect for authenticated users
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
      <div className="flex flex-col items-center space-y-4">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-500"></div>
        <p className="text-gray-600 dark:text-gray-300 font-medium">Processing authentication...</p>
      </div>
    </div>
  )
}
