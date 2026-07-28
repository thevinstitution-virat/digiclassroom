import { auth, getSafeSession } from '@/auth'
import { headers } from 'next/headers'
import { UserRole } from '@/lib/validations'

interface ProtectedComponentProps {
  children: React.ReactNode
  roles?: UserRole[]
  fallback?: React.ReactNode
}

export async function ProtectedComponent({
  children,
  roles = [],
  fallback = null,
}: ProtectedComponentProps) {
  const hdrs = await headers()
  const session = await getSafeSession(hdrs)
  const user = session?.user
  const userRole = (user as any)?.role as UserRole
  const userId = user?.id

  // Check role-based access.
  // Normalize roles for the coarse 'user' | 'admin' gate used by dashboard layouts:
  //   super_admin + admin → 'admin'; everyone else → 'user'.
  // (Finer tiers — institution-admin / teacher / parent — are gated by their own
  // server layouts via getOrgContext, not by this coarse check.)
  void userId
  let hasAccess = false
  if (user) {
    if (roles.length > 0) {
      if (roles.includes('user')) {
        // 'user' role requirement allows any authenticated account (student, teacher, parent, admin, super_admin)
        hasAccess = true
      } else {
        const normalizedRole: string =
          userRole === 'admin' || userRole === 'super_admin' ? 'admin' : (userRole || 'student')
        hasAccess = roles.includes(normalizedRole as UserRole) || roles.includes(userRole as UserRole)
      }
    } else {
      hasAccess = true
    }
  }

  return hasAccess ? <>{children}</> : <>{fallback}</>
}
