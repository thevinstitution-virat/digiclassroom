import { Suspense } from 'react'
import { ProtectedComponent } from '@/components/auth/core/ProtectedComponent'
import UserSidebarWrapper from '@/components/core/layout/UserSidebarWrapper'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import DashboardLayout from '@/components/layout/DashboardLayout'
import OnboardingWrapper from '@/components/onboarding/OnboardingWrapper'

export default function UserLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedComponent
      roles={['user']}
      fallback={
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Access Required
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Please sign in to access your learning dashboard.
            </p>
          </div>
        </div>
      }
    >
      <DashboardLayout
        sidebar={<UserSidebarWrapper />}
      >
        <Suspense fallback={<LoadingSkeleton />}>
          <OnboardingWrapper>
            {children}
          </OnboardingWrapper>
        </Suspense>
      </DashboardLayout>
    </ProtectedComponent>
  )
}
