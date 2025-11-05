import { UserRole, UserPersona } from '@/lib/validations'

// Public routes that don't require authentication
export const PUBLIC_ROUTES = [
  '/',
  '/about',
  '/contact',
  '/pricing',
  '/features',
  '/api/webhook',
  '/api/health',
] as const

// Authentication routes
export const AUTH_ROUTES = [
  '/sign-in',
  '/sign-up',
  '/sign-in/[[...sign-in]]',
  '/sign-up/[[...sign-up]]',
] as const

// Check if route is public
export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route))
}

// Check if route is auth route
export function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some(route => pathname === route || pathname.startsWith(route))
}

// Simplified role hierarchy for permission checking
export const ROLE_HIERARCHY = {
  admin: 2,
  user: 1,
} as const

// Check if user has sufficient role level
export function hasRoleLevel(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}

// Simplified API route permissions
export const API_PERMISSIONS = {
  '/api/admin': ['admin'],
  '/api/content': ['admin', 'user'],
  '/api/assessment': ['admin', 'user'],
  '/api/analytics': ['admin', 'user'],
  '/api/user': ['admin', 'user'],
} as const

// Check API route permissions
export function hasAPIAccess(userRole: UserRole, apiPath: string): boolean {
  // Find matching API permission pattern
  const matchingPattern = Object.keys(API_PERMISSIONS).find(pattern => 
    apiPath.startsWith(pattern)
  )

  if (!matchingPattern) {
    // Default to allowing access if no specific permission is defined
    return true
  }

  const allowedRoles = API_PERMISSIONS[matchingPattern as keyof typeof API_PERMISSIONS]
  return allowedRoles.includes(userRole)
}

// Tenant-specific permissions
export interface TenantPermissions {
  canManageUsers: boolean
  canManageContent: boolean
  canViewAnalytics: boolean
  canManageSettings: boolean
  canManageClasses: boolean
  canCreateAssessments: boolean
}

// Get tenant permissions for user role (simplified to admin/user)
export function getTenantPermissions(userRole: UserRole): TenantPermissions {
  if (userRole === 'admin') {
    return {
      canManageUsers: true,
      canManageContent: true,
      canViewAnalytics: true,
      canManageSettings: true,
      canManageClasses: true,
      canCreateAssessments: true,
    }
  } else if (userRole === 'user') {
    return {
      canManageUsers: false,
      canManageContent: true,
      canViewAnalytics: true,
      canManageSettings: false,
      canManageClasses: true,
      canCreateAssessments: true,
    }
  } else {
    return {
      canManageUsers: false,
      canManageContent: false,
      canViewAnalytics: false,
      canManageSettings: false,
      canManageClasses: false,
      canCreateAssessments: false,
    }
  }
}

// Feature flags based on subscription plan
export interface FeatureFlags {
  maxClasses: number
  maxStudentsPerClass: number
  maxTeachers: number
  aiChatEnabled: boolean
  advancedAnalytics: boolean
  customBranding: boolean
  apiAccess: boolean
  prioritySupport: boolean
}

export function getFeatureFlags(subscriptionPlan: 'starter' | 'pro' | 'enterprise'): FeatureFlags {
  switch (subscriptionPlan) {
    case 'starter':
      return {
        maxClasses: 3,
        maxStudentsPerClass: 30,
        maxTeachers: 5,
        aiChatEnabled: true,
        advancedAnalytics: false,
        customBranding: false,
        apiAccess: false,
        prioritySupport: false,
      }
    case 'pro':
      return {
        maxClasses: 10,
        maxStudentsPerClass: 100,
        maxTeachers: 20,
        aiChatEnabled: true,
        advancedAnalytics: true,
        customBranding: true,
        apiAccess: true,
        prioritySupport: false,
      }
    case 'enterprise':
      return {
        maxClasses: -1, // Unlimited
        maxStudentsPerClass: -1, // Unlimited
        maxTeachers: -1, // Unlimited
        aiChatEnabled: true,
        advancedAnalytics: true,
        customBranding: true,
        apiAccess: true,
        prioritySupport: true,
      }
    default:
      return getFeatureFlags('starter')
  }
}
