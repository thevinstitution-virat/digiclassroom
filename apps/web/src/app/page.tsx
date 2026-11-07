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

  // The landing page is rendered on the server and shown straight away, while the session is still being checked. Only once we know the
  // visitor is signed in do we swap to the short "processing" screen below and send them to the dashboard.
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
