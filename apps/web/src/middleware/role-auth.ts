/**
 * Role-Based Authentication Middleware
 * Enforces Clerk-based role authentication and injects role into requests
 */

import { auth } from '@/auth';
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server'
        // @ts-ignore
import { UserRole } from '@/config/menu-config'

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: string
    role: UserRole
    email: string
    firstName?: string
    lastName?: string
    metadata?: any
  }
}

interface RoleAuthOptions {
  allowedRoles?: UserRole[]
  requireAuth?: boolean
  adminEmail?: string
}

/**
 * Role-based authentication middleware factory
 */
export function withRoleAuth(options: RoleAuthOptions = {}) {
  const {
    allowedRoles = ['student', 'teacher', 'parent', 'admin'],
    requireAuth = true,
    adminEmail = 'thevinstitution@gmail.com'
  } = options

  return async function roleAuthMiddleware(
    request: NextRequest,
    handler: (req: AuthenticatedRequest) => Promise<NextResponse>
  ): Promise<NextResponse> {
    try {
      // Get authentication info from Clerk
      const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id// Check if authentication is required
      if (requireAuth && !userId) {
        return NextResponse.json(
          { error: 'Authentication required', code: 'UNAUTHORIZED' },
          { status: 401 }
        )
      }

      // If no user ID, proceed without user context (for public endpoints)
      if (!userId) {
        return handler(request as AuthenticatedRequest)
      }

      // Get user details from Clerk
      // User data is already available from session
    const user = session?.user as any;
    const userEmail = user?.email

      // Determine user role
      let userRole: UserRole = 'student' // default role
      
      // Check metadata for role
        // @ts-ignore
      const metadataRole = sessionClaims?.metadata?.role as UserRole
      if (metadataRole && ['student', 'teacher', 'parent', 'admin'].includes(metadataRole)) {
        userRole = metadataRole
      }
      
      // Special admin access for designated email
      if (userEmail === adminEmail) {
        userRole = 'admin'
      }

      // Check if user role is allowed for this endpoint
      if (!allowedRoles.includes(userRole)) {
        return NextResponse.json(
          { 
            error: 'Insufficient permissions', 
            code: 'FORBIDDEN',
            requiredRoles: allowedRoles,
            userRole 
          },
          { status: 403 }
        )
      }

      // Inject user information into request
      const authenticatedRequest = request as AuthenticatedRequest
      authenticatedRequest.user = {
        id: userId,
        role: userRole,
        email: userEmail || '',
        firstName: user?.name?.split(' ')[0] || undefined,
        lastName: user?.name?.split(' ').slice(1).join(' ') || undefined,
        // @ts-ignore
        metadata: sessionClaims?.metadata
      }

      // Add role to request headers for downstream processing
      const requestHeaders = new Headers(request.headers)
      requestHeaders.set('x-user-id', userId)
      requestHeaders.set('x-user-role', userRole)
      requestHeaders.set('x-user-email', userEmail || '')

      // Create new request with updated headers
      const newRequest = new NextRequest(request.url, {
        method: request.method,
        headers: requestHeaders,
        body: request.body
      })

      // Copy user info to new request
      ;(newRequest as AuthenticatedRequest).user = authenticatedRequest.user

      return handler(newRequest as AuthenticatedRequest)
    } catch (error) {
      console.error('Role authentication error:', error)
      return NextResponse.json(
        { 
          error: 'Authentication service error', 
          code: 'AUTH_SERVICE_ERROR' 
        },
        { status: 500 }
      )
    }
  }
}

/**
 * Utility function to extract user info from request
 */
export function getUserFromRequest(request: AuthenticatedRequest) {
  return request.user || null
}

/**
 * Utility function to check if user has specific role
 */
export function hasRole(request: AuthenticatedRequest, role: UserRole): boolean {
  return request.user?.role === role
}

/**
 * Utility function to check if user has any of the specified roles
 */
export function hasAnyRole(request: AuthenticatedRequest, roles: UserRole[]): boolean {
  return request.user ? roles.includes(request.user.role) : false
}

/**
 * Utility function to require specific role or throw error
 */
export function requireRole(request: AuthenticatedRequest, role: UserRole): void {
  if (!hasRole(request, role)) {
    throw new Error(`Access denied. Required role: ${role}, User role: ${request.user?.role || 'none'}`)
  }
}

/**
 * Utility function to require admin role
 */
export function requireAdmin(request: AuthenticatedRequest): void {
  requireRole(request, 'admin')
}

/**
 * Middleware for student-only endpoints
 */
export const withStudentAuth = withRoleAuth({ allowedRoles: ['student'] })

/**
 * Middleware for teacher-only endpoints
 */
export const withTeacherAuth = withRoleAuth({ allowedRoles: ['teacher'] })

/**
 * Middleware for parent-only endpoints
 */
export const withParentAuth = withRoleAuth({ allowedRoles: ['parent'] })

/**
 * Middleware for admin-only endpoints
 */
export const withAdminAuth = withRoleAuth({ allowedRoles: ['admin'] })

/**
 * Middleware for teacher and admin endpoints
 */
export const withEducatorAuth = withRoleAuth({ allowedRoles: ['teacher', 'admin'] })

/**
 * Middleware for all authenticated users
 */
export const withAuth = withRoleAuth({ allowedRoles: ['student', 'teacher', 'parent', 'admin'] })

/**
 * Middleware for public endpoints (no auth required)
 */
export const withPublicAccess = withRoleAuth({ requireAuth: false })

/**
 * Role validation utility for client-side
 */
export function validateUserRole(role: string): role is UserRole {
  return ['student', 'teacher', 'parent', 'admin'].includes(role)
}

/**
 * Get role hierarchy level (for permission checking)
 */
export function getRoleLevel(role: UserRole): number {
  const levels = {
    student: 1,
    parent: 2,
    teacher: 3,
    admin: 4
  }
        // @ts-ignore
  return levels[role] || 0
}

/**
 * Check if user has sufficient role level
 */
export function hasMinimumRoleLevel(request: AuthenticatedRequest, minimumRole: UserRole): boolean {
  if (!request.user)
  return false
  
  const userLevel = getRoleLevel(request.user.role)
  const requiredLevel = getRoleLevel(minimumRole)
  
  return userLevel >= requiredLevel
}

/**
 * Enhanced error responses for role-based access
 */
export const RoleAuthErrors = {
  UNAUTHORIZED: {
    error: 'Authentication required',
    code: 'UNAUTHORIZED',
    message: 'Please sign in to access this resource'
  },
  FORBIDDEN: {
    error: 'Insufficient permissions',
    code: 'FORBIDDEN',
    message: 'You do not have permission to access this resource'
  },
  INVALID_ROLE: {
    error: 'Invalid user role',
    code: 'INVALID_ROLE',
    message: 'User role is not recognized or valid'
  },
  AUTH_SERVICE_ERROR: {
    error: 'Authentication service error',
    code: 'AUTH_SERVICE_ERROR',
    message: 'Unable to verify authentication at this time'
  }
} as const

/**
 * Type guard for authenticated requests
 */
export function isAuthenticatedRequest(request: NextRequest): request is AuthenticatedRequest {
  return 'user' in request && request.user !== undefined
}
