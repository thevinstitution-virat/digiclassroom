'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { EnhancedLandingPage } from '@/components/landing/EnhancedLandingPage'
import { useBetterAuthUser } from '@/hooks/useBetterAuthUser'

export default function Home() {
  const { user, isLoaded } = useBetterAuthUser()
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
      <div className="indic-landing indic-hero-canvas min-h-screen flex items-center justify-center">
        <div className="relative z-10 text-center">
          <div
            className="animate-spin rounded-full h-24 w-24 mx-auto border-4 border-transparent"
            style={{ borderBottomColor: 'var(--accent-strong)', borderRightColor: 'var(--gold)' }}
          />
          <h2 className="mt-6 text-xl">Loading Digi Classroom…</h2>
          <p className="indic-muted mt-2">Preparing your personalized learning experience</p>
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
    <div className="indic-landing min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <div
          className="animate-spin rounded-full h-16 w-16 border-4 border-transparent"
          style={{ borderBottomColor: 'var(--accent-strong)', borderRightColor: 'var(--gold)' }}
        />
        <p className="indic-muted font-medium">Processing authentication…</p>
      </div>
    </div>
  )
}
