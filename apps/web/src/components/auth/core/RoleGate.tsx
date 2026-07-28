import { auth } from '@/auth'
import { headers } from 'next/headers'
import { UserRole } from '@/lib/validations'

interface RoleGateProps {
  children: React.ReactNode
  allowedRoles: UserRole[]
  fallback?: React.ReactNode
  showFallback?: boolean
}

export async function RoleGate({
  children,
  allowedRoles,
  fallback,
  showFallback = true,
}: RoleGateProps) {
  const session = await auth.api.getSession({ headers: await headers() })
  const userRole = (session?.user as any)?.role as UserRole

  const hasAccess = userRole && allowedRoles.includes(userRole)

  if (hasAccess) {
    return <>{children}</>
  }

  if (showFallback && fallback) {
    return <>{fallback}</>
  }

  return null
}

// Usage examples:
/*
<RoleGate allowedRoles={['admin', 'user']}>
  <UserPanel />
</RoleGate>

<RoleGate
  allowedRoles={['admin']}
  fallback={<div>Admin access required</div>}
>
  <AdminManagement />
</RoleGate>
*/
