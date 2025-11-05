import { Suspense } from 'react'
import { ProtectedComponent } from '@/components/auth/ProtectedComponent'
import AdminSidebarWrapper from '@/components/layout/AdminSidebarWrapper'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import DashboardLayout from '@/components/layout/DashboardLayout'

export default function AdminLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedComponent
      roles={['admin']}
      fallback={
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Access Denied
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              You need admin privileges to access this page.
            </p>
          </div>
        </div>
      }
    >
      <DashboardLayout sidebar={<AdminSidebarWrapper />}>
        <Suspense fallback={<LoadingSkeleton />}>
          {children}
        </Suspense>
      </DashboardLayout>
    </ProtectedComponent>
  )
}