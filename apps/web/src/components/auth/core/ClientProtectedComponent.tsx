'use client'

import { useSession } from '@/auth/client'
import { UserRole } from '@/lib/validations'

interface ClientProtectedComponentProps {
  children: React.ReactNode
  roles?: UserRole[]
  fallback?: React.ReactNode
  showLoading?: boolean
}

export function ClientProtectedComponent({
  children,
  roles = [],
  fallback = null,
  showLoading = true,
}: ClientProtectedComponentProps) {
  const { data: session, isPending } = useSession()
  const user = session?.user

  // Show loading state while user data is being fetched
  if (isPending && showLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
      </div>
    )
  }

  const userRole = (user as any)?.role as UserRole

  // If no roles specified, allow access to authenticated users
  if (roles.length === 0) {
    return user ? <>{children}</> : <>{fallback}</>
  }

  // Check if user has required role
  const hasAccess = userRole && roles.includes(userRole)

  return hasAccess ? <>{children}</> : <>{fallback}</>
}
