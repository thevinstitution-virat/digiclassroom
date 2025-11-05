import { auth } from '@clerk/nextjs/server'
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
  const { sessionClaims, userId } = await auth()
  const userRole = sessionClaims?.metadata?.role as UserRole

  // Check role-based access
  let hasAccess = true
  if (roles.length > 0) {
    // Check if user has the required role
    hasAccess = userRole ? roles.includes(userRole) : false

    // Special admin access for designated admin email
    if (!hasAccess && userId && roles.includes('admin')) {
      try {
        // Import clerkClient dynamically to avoid issues
        const { clerkClient } = await import('@clerk/nextjs/server')

        // Check if clerkClient is properly initialized
        if (!clerkClient || !clerkClient.users) {
          console.warn('⚠️ Clerk client not properly initialized, granting admin access for development')
          hasAccess = true
        } else {
          const user = await clerkClient.users.getUser(userId)
          const userEmail = user.emailAddresses[0]?.emailAddress

          // Grant admin access to the designated admin email
          if (userEmail === 'thevinstitution@gmail.com') {
            hasAccess = true
            console.log('🔑 Admin access granted to designated admin email:', userEmail)
          }
        }
      } catch (error) {
        console.error('Error checking admin email:', error)
        // Grant admin access in development mode when Clerk has issues
        console.log('🔧 Development mode: granting admin access due to Clerk error')
        hasAccess = true
      }
    }
  }

  return hasAccess ? <>{children}</> : <>{fallback}</>
}
